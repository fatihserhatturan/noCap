// ── Elements ──────────────────────────────────────────────────────────────────

const audioEl    = document.getElementById('audio-el');
const playBtn    = document.getElementById('play-btn');
const timeline   = document.getElementById('timeline');
const progress   = document.getElementById('timeline-progress');
const cursor     = document.getElementById('timeline-cursor');
const timeDisp   = document.getElementById('time-display');

let rafId     = null;
let scrubbing = false;

// ── Init ──────────────────────────────────────────────────────────────────────

async function initPlayer() {
  // probe the server for an audio file
  try {
    const res = await fetch('/api/audio', { method: 'HEAD' });
    if (res.ok) {
      audioEl.src = '/api/audio';
      audioEl.load();
      playBtn.disabled = false;
      playBtn.title    = 'Play / Pause';
    }
  } catch {
    // no audio — player stays disabled
  }

  // events
  playBtn.addEventListener('click', togglePlay);

  audioEl.addEventListener('loadedmetadata', _updateTime);
  audioEl.addEventListener('ended', _onEnded);

  // timeline scrub
  timeline.addEventListener('mousedown', (e) => { scrubbing = true; _seekTo(e); });
  window.addEventListener('mousemove',   (e) => { if (scrubbing) _seekTo(e); });
  window.addEventListener('mouseup',     ()  => { scrubbing = false; });

  // keyboard: space = play/pause
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.target.matches('input, textarea')) {
      e.preventDefault();
      togglePlay();
    }
  });
}

// ── Controls ──────────────────────────────────────────────────────────────────

function togglePlay() {
  if (audioEl.paused) {
    audioEl.play().catch(() => {});
    playBtn.textContent = '⏸';
    _startRaf();
  } else {
    audioEl.pause();
    playBtn.textContent = '▶';
    cancelAnimationFrame(rafId);
  }
}

function _onEnded() {
  playBtn.textContent = '▶';
  cancelAnimationFrame(rafId);
  _updateTime();
}

// ── RAF loop ──────────────────────────────────────────────────────────────────

function _startRaf() {
  cancelAnimationFrame(rafId);
  function tick() {
    _syncUI();
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
}

function _syncUI() {
  const t   = audioEl.currentTime || 0;
  const dur = audioEl.duration    || 1;
  const pct = (t / dur) * 100;

  progress.style.width = pct + '%';
  cursor.style.left    = pct + '%';
  _updateTime();

  // drive the flowmap playhead (defined in flowmap.js)
  if (typeof setPlayhead === 'function') setPlayhead(t);
}

// ── Seek ──────────────────────────────────────────────────────────────────────

function _seekTo(e) {
  const rect = timeline.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audioEl.currentTime = pct * (audioEl.duration || 0);
  _syncUI();
}

// ── Time display ──────────────────────────────────────────────────────────────

function _updateTime() {
  timeDisp.textContent = `${_fmt(audioEl.currentTime)} / ${_fmt(audioEl.duration || 0)}`;
}

function _fmt(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// ── Boot ──────────────────────────────────────────────────────────────────────

initPlayer();
