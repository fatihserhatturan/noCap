// ── Constants ────────────────────────────────────────────────────────────────

const PALETTE = [
  '#FF4081','#40C4FF','#69F0AE','#FFD740','#FF6D00',
  '#E040FB','#00BCD4','#EEFF41','#FF1744','#1DE9B6',
  '#F06292','#4FC3F7','#AED581','#FFB74D','#CE93D8',
  '#80DEEA','#A5D6A7','#FFF176','#EF9A9A','#80CBC4',
];

const D = {
  labelW:72, beatW:110, barH:50, headerH:30,
  sylH:28, sylBlockW:11, densW:38, subdivs:4,
};

const STEPS = ['load','beat','transcribe','align'];
const STEP_PCT = { load:15, beat:35, transcribe:80, align:100 };

// ── State ────────────────────────────────────────────────────────────────────

let fm       = null;
let colorMap = {};
let sylRects = [];
let curBar   = 0;
let curBeatX = null;
let curSyl   = null;   // active syllable during playback
let canvas, ctx;

// ── Screen management ────────────────────────────────────────────────────────

function showUploadScreen() {
  document.getElementById('upload-screen').hidden  = false;
  document.getElementById('viewer-screen').hidden  = true;
  document.getElementById('new-track-btn').hidden  = true;
  document.getElementById('track-title').textContent = '';
  document.getElementById('track-meta').textContent  = '';
  // reset progress panel
  document.getElementById('drop-zone').hidden      = false;
  document.getElementById('progress-panel').hidden = true;
  STEPS.forEach(s => {
    const el = document.getElementById('step-' + s);
    el.className = 'step';
    el.querySelector('.step-msg').textContent = '';
  });
  document.getElementById('progress-bar-fill').style.width = '0%';
  document.getElementById('progress-error').hidden = true;
}

function showViewerScreen() {
  document.getElementById('upload-screen').hidden  = true;
  document.getElementById('viewer-screen').hidden  = false;
  document.getElementById('new-track-btn').hidden  = false;
}

function resetToUpload() {
  fm = null; colorMap = {}; sylRects = []; curBar = 0; curBeatX = null;
  showUploadScreen();
  // reset player
  const a = document.getElementById('audio-el');
  a.pause(); a.src = '';
  document.getElementById('play-btn').disabled = true;
  document.getElementById('play-btn').textContent = '▶';
}

// ── Upload & SSE ─────────────────────────────────────────────────────────────

function setupUpload() {
  const input = document.getElementById('file-input');
  input.addEventListener('change', () => {
    if (input.files[0]) startAnalysis(input.files[0]);
  });
}

function onDragOver(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.add('drag-over');
}
function onDragLeave() {
  document.getElementById('drop-zone').classList.remove('drag-over');
}
function onDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) startAnalysis(file);
}

async function startAnalysis(file) {
  // switch to progress view
  document.getElementById('drop-zone').hidden      = true;
  document.getElementById('progress-panel').hidden = false;
  document.getElementById('progress-filename').textContent = file.name;
  document.getElementById('progress-error').hidden = true;

  const form = new FormData();
  form.append('audio', file);

  let response;
  try {
    response = await fetch('/api/analyze', { method: 'POST', body: form });
  } catch (e) {
    showError('Could not connect to server: ' + e.message);
    return;
  }

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop();           // keep incomplete chunk

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data: ')) continue;
      let msg;
      try { msg = JSON.parse(line.slice(6)); } catch { continue; }
      handleSSE(msg);
    }
  }
}

function handleSSE(msg) {
  if (msg.type === 'progress') {
    const el = document.getElementById('step-' + msg.step);
    if (!el) return;
    el.className = msg.done ? 'step done' : 'step active';
    el.querySelector('.step-msg').textContent = msg.msg || '';
    document.getElementById('progress-bar-fill').style.width =
      (msg.done ? STEP_PCT[msg.step] : Math.max(0, STEP_PCT[msg.step] - 15)) + '%';

  } else if (msg.type === 'complete') {
    document.getElementById('progress-bar-fill').style.width = '100%';
    // small delay so user sees 100%
    setTimeout(() => {
      loadFlowmap(msg.flowmap);
      showViewerScreen();
      // kick off audio
      const a = document.getElementById('audio-el');
      a.src = '/api/audio';
      a.load();
      document.getElementById('play-btn').disabled = false;
    }, 400);

  } else if (msg.type === 'error') {
    showError(msg.msg + (msg.trace ? '\n\n' + msg.trace : ''));
  }
}

function showError(text) {
  const el = document.getElementById('progress-error');
  el.textContent = text;
  el.hidden = false;
  document.getElementById('drop-zone').hidden = false;
}

// ── FlowMap loading ───────────────────────────────────────────────────────────

function loadFlowmap(data) {
  fm = data;
  colorMap = {};
  fm.rhyme_chains.forEach((c, i) => { colorMap[c.group] = PALETTE[i % PALETTE.length]; });

  document.getElementById('track-title').textContent = fm.metadata.title || 'Untitled';
  document.getElementById('track-meta').textContent  =
    `${fm.metadata.bpm.toFixed(1)} BPM · ${fm.bars.length} bars · ${fm.syllables.length} syllables`;

  _populateMetrics();
  _populateLegend();
  _sizeCanvas();
  render();
  _setupTooltip();
}

// ── Public API (called by player.js) ────────────────────────────────────────

function setPlayhead(time) {
  if (!fm || !fm.beats.length) return;
  const beats = fm.beats;
  let lo = 0, hi = beats.length - 1;
  while (lo < hi) { const mid = (lo+hi+1)>>1; beats[mid].time<=time?(lo=mid):(hi=mid-1); }
  const beat    = beats[lo];
  const nextT   = lo+1 < beats.length ? beats[lo+1].time : beat.time + 60/fm.metadata.bpm;
  const beatLen = nextT - beat.time;
  const frac    = beatLen > 0 ? Math.min((time-beat.time)/beatLen,1.0) : 0;
  curBar   = beat.bar_no;
  const beatW = (canvas && canvas._beatW) || D.beatW;
  curBeatX = D.labelW + (beat.beat_no - 1 + frac) * beatW;

  // find closest syllable to current time
  if (fm.syllables.length) {
    let best = fm.syllables[0], bestDiff = Infinity;
    for (const s of fm.syllables) {
      const diff = Math.abs(s.time - time);
      if (diff < bestDiff) { bestDiff = diff; best = s; }
    }
    curSyl = bestDiff < 1.0 ? best : null;
  }

  render();

  // auto-scroll to keep current bar in view
  const scrollEl = document.getElementById('canvas-scroll');
  const barIdx   = fm.bars.findIndex(b => b.bar_no === curBar);
  if (barIdx >= 0) {
    const barY = D.headerH + barIdx * D.barH;
    const vt = scrollEl.scrollTop, vb = vt + scrollEl.clientHeight;
    if (barY < vt + 20 || barY + D.barH > vb - 20)
      scrollEl.scrollTo({ top: Math.max(0, barY - 80), behavior: 'smooth' });
  }
}

// ── Canvas ────────────────────────────────────────────────────────────────────

function _sizeCanvas() {
  canvas = document.getElementById('flowmap-canvas');
  ctx    = canvas.getContext('2d');
  const sig       = fm.metadata.time_signature || 4;
  const container = document.getElementById('canvas-scroll');
  const availW    = Math.max(container.clientWidth - 64, sig * D.beatW + D.labelW + D.densW);
  const beatW     = Math.max(D.beatW, Math.floor((availW - D.labelW - D.densW) / sig));
  const cssW      = D.labelW + sig * beatW + D.densW;
  const cssH      = D.headerH + fm.bars.length * D.barH + 4;
  const dpr       = window.devicePixelRatio || 1;
  canvas.width    = cssW * dpr; canvas.height = cssH * dpr;
  canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas._cssW = cssW; canvas._cssH = cssH;
  canvas._beatW = beatW;
}

function render() {
  if (!fm || !canvas) return;
  const sig  = fm.metadata.time_signature || 4;
  const beatW = canvas._beatW || D.beatW;
  const w = canvas._cssW, h = canvas._cssH;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, w, h);
  _drawHeader(sig, w, beatW);
  _drawAllBars(sig, beatW);
  _drawPlayhead(beatW);
}

function _drawHeader(sig, w, beatW) {
  ctx.fillStyle = '#0f0f0f'; ctx.fillRect(0, 0, w, D.headerH);
  for (let b=0; b<sig; b++) {
    const bx = D.labelW + b*beatW;
    ctx.fillStyle='#505050'; ctx.font='11px monospace'; ctx.textAlign='center';
    ctx.fillText(String(b+1), bx+beatW/2, D.headerH-8);
    ctx.strokeStyle='#1f1f1f'; ctx.lineWidth=1; _vline(bx, 0, D.headerH);
    for (let s=1; s<D.subdivs; s++) {
      ctx.strokeStyle='#181818'; _vline(bx+(s/D.subdivs)*beatW, D.headerH-10, D.headerH);
    }
  }
  ctx.fillStyle='#2a2a2a'; ctx.font='8px monospace'; ctx.textAlign='center';
  ctx.fillText('dens', D.labelW+sig*beatW+D.densW/2, D.headerH-10);
}

function _drawAllBars(sig, beatW) {
  const sylsByBar={};
  for (const s of fm.syllables) (sylsByBar[s.bar_no]=sylsByBar[s.bar_no]||[]).push(s);
  const maxDens = Math.max(...fm.bars.map(b=>b.density), 0.01);
  sylRects = [];
  for (let i=0; i<fm.bars.length; i++) _drawBar(fm.bars[i], i, sig, sylsByBar, maxDens, beatW);
}

function _drawBar(bar, idx, sig, sylsByBar, maxDens, beatW) {
  const rowY  = D.headerH + idx*D.barH;
  const act   = bar.bar_no === curBar;
  const gridW = sig*beatW;
  ctx.fillStyle = act ? '#1a1a1a' : (idx%2===0 ? '#0e0e0e' : '#111');
  ctx.fillRect(D.labelW, rowY, gridW, D.barH);
  if (act) { ctx.fillStyle='#ff3d00'; ctx.fillRect(D.labelW, rowY, 2, D.barH); }
  ctx.fillStyle = act?'#999':'#383838';
  ctx.font = (act?'600 ':'')+'10px monospace'; ctx.textAlign='right';
  ctx.fillText(`Bar ${bar.bar_no}`, D.labelW-8, rowY+D.barH/2+4);
  for (let b=0; b<sig; b++) {
    const bx = D.labelW+b*beatW;
    ctx.strokeStyle='#191919'; ctx.lineWidth=1; _vline(bx, rowY, rowY+D.barH);
    for (let s=1; s<D.subdivs; s++) {
      ctx.strokeStyle='#151515'; _vline(bx+(s/D.subdivs)*beatW, rowY+D.barH*0.35, rowY+D.barH);
    }
  }
  ctx.strokeStyle='#171717'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,rowY+D.barH); ctx.lineTo(D.labelW+gridW+D.densW,rowY+D.barH); ctx.stroke();
  for (const syl of (sylsByBar[bar.bar_no]||[])) _drawSyl(syl, rowY, beatW);
  const dx=D.labelW+gridW+4, di=D.densW-8, pct=bar.density/maxDens;
  ctx.fillStyle='#161616'; ctx.fillRect(dx, rowY+6, di, D.barH-12);
  ctx.fillStyle=`rgba(255,61,0,${0.25+pct*0.65})`;
  const fh=(D.barH-12)*pct;
  ctx.fillRect(dx, rowY+6+(D.barH-12)-fh, di, fh);
  ctx.fillStyle='#303030'; ctx.font='8px monospace'; ctx.textAlign='center';
  ctx.fillText(bar.density.toFixed(1), dx+di/2, rowY+D.barH-4);
}

function _drawSyl(syl, rowY, beatW) {
  const x     = D.labelW+(syl.beat_no-1+syl.beat_pos)*beatW;
  const color = syl.rhyme_group ? (colorMap[syl.rhyme_group]||'#444') : '#2e2e2e';
  const bh    = syl.stress ? D.sylH : Math.round(D.sylH*0.55);
  const by    = rowY+Math.round((D.barH-bh)/2);
  const bx    = Math.round(x-D.sylBlockW/2);
  if (syl.stress && syl.rhyme_group) { ctx.shadowColor=color; ctx.shadowBlur=5; }
  ctx.fillStyle = syl.stress ? color : _rgba(color, 0.42);
  _roundRect(bx, by, D.sylBlockW, bh, 2); ctx.fill();
  ctx.shadowBlur = 0;
  sylRects.push({x:bx, y:by, w:D.sylBlockW, h:bh, syl});
}

function _drawPlayhead(beatW) {
  if (curBeatX===null||curBar===0) return;
  const idx = fm.bars.findIndex(b=>b.bar_no===curBar); if (idx<0) return;
  const rowY = D.headerH+idx*D.barH;

  // highlight active bar background
  ctx.fillStyle='rgba(255,61,0,0.06)';
  ctx.fillRect(D.labelW, rowY, (fm.metadata.time_signature||4)*beatW, D.barH);

  // playhead line
  ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=1.5;
  ctx.setLineDash([3,3]); _vline(curBeatX, rowY, rowY+D.barH); ctx.setLineDash([]);

  // active syllable highlight + word label
  if (curSyl && curSyl.bar_no === curBar) {
    const sx  = D.labelW + (curSyl.beat_no-1+curSyl.beat_pos)*beatW;
    const bh  = curSyl.stress ? D.sylH : Math.round(D.sylH*0.55);
    const by  = rowY + Math.round((D.barH-bh)/2);
    const bx  = Math.round(sx - D.sylBlockW/2);
    const col = curSyl.rhyme_group ? (colorMap[curSyl.rhyme_group]||'#ff3d00') : '#ff3d00';

    // glow ring around active syl
    ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    ctx.shadowColor = col; ctx.shadowBlur = 8;
    _roundRect(bx-2, by-2, D.sylBlockW+4, bh+4, 3); ctx.stroke();
    ctx.shadowBlur = 0;

    // word label above the syllable
    const label  = curSyl.word;
    const padX   = 6, padY = 3;
    ctx.font = 'bold 11px monospace';
    const tw = ctx.measureText(label).width;
    const lx = Math.max(D.labelW+2, Math.min(sx - tw/2 - padX, canvas._cssW - tw - padX*2 - 6));
    const ly = Math.max(2, by - 22);
    const lw = tw + padX*2, lh = 16 + padY*2;
    ctx.fillStyle = 'rgba(10,10,10,0.88)';
    _roundRect(lx, ly, lw, lh, 3); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    _roundRect(lx, ly, lw, lh, 3); ctx.stroke();
    ctx.fillStyle = col; ctx.textAlign = 'left';
    ctx.fillText(label, lx+padX, ly+lh-padY-3);
  }
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function _setupTooltip() {
  const tip = document.getElementById('tooltip');
  // remove old listeners by cloning; preserve custom properties
  const newCanvas = canvas.cloneNode(true);
  newCanvas._cssW  = canvas._cssW;
  newCanvas._cssH  = canvas._cssH;
  newCanvas._beatW = canvas._beatW;
  canvas.parentNode.replaceChild(newCanvas, canvas);
  canvas = newCanvas; ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio||1;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  render();

  canvas.addEventListener('mousemove', (e) => {
    const r=canvas.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
    const hit=sylRects.find(s=>mx>=s.x&&mx<=s.x+s.w&&my>=s.y&&my<=s.y+s.h);
    if (hit) {
      const s=hit.syl, c=s.rhyme_group?(colorMap[s.rhyme_group]||'#aaa'):'#888';
      tip.innerHTML=`<div class="tt-word" style="color:${c}">${s.word}</div>
        <div class="tt-row">Beat <span>${s.beat_no} + ${s.beat_pos.toFixed(2)}</span></div>
        <div class="tt-row">Bar  <span>${s.bar_no}</span></div>
        <div class="tt-row">Stress <span>${s.stress?'● stressed':'○ unstressed'}</span></div>
        ${s.rhyme_group?`<div class="tt-row">Rhyme <span>Group ${s.rhyme_group}</span></div>`:''}
        ${s.time>=0?`<div class="tt-row">Time <span>${s.time.toFixed(2)}s</span></div>`:''}`;
      tip.removeAttribute('hidden');
      tip.style.left=(e.clientX+14)+'px'; tip.style.top=(e.clientY-12)+'px';
      const bar=fm.bars.find(b=>b.bar_no===s.bar_no);
      if (bar) document.getElementById('bar-detail').innerHTML=
        `Bar ${bar.bar_no}<br>Density: ${bar.density} syl/beat<br>` +
        `Syncopation: ${(bar.syncopation*100).toFixed(0)}%<br>` +
        `Stressed: ${(bar.stressed_ratio*100).toFixed(0)}%<br>Syllables: ${bar.syllable_count}`;
    } else {
      tip.setAttribute('hidden','');
    }
  });
  canvas.addEventListener('mouseleave', () => tip.setAttribute('hidden',''));
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function _populateMetrics() {
  const s=fm.summary;
  const items=[
    {label:'Avg Density', value:`${s.avg_density} syl/beat`, pct:s.avg_density/8},
    {label:'Peak Density',value:`${s.peak_density} syl/beat`,pct:s.peak_density/8},
    {label:'Syncopation', value:`${(s.syncopation_score*100).toFixed(0)}%`,pct:s.syncopation_score},
    {label:'Consistency', value:`${(s.consistency*100).toFixed(0)}%`,     pct:s.consistency},
    {label:'Rhyme Chain', value:`${s.rhyme_chain_avg.toFixed(1)} avg`,     pct:s.rhyme_chain_avg/6},
  ];
  document.getElementById('metrics-list').innerHTML=items.map(it=>`
    <div>
      <div class="m-row"><span class="m-label">${it.label}</span><span class="m-value">${it.value}</span></div>
      <div class="m-bar"><div class="m-bar-fill" style="width:${Math.min(100,it.pct*100).toFixed(1)}%"></div></div>
    </div>`).join('');
}

function _populateLegend() {
  document.getElementById('rhyme-legend').innerHTML=fm.rhyme_chains.length
    ? fm.rhyme_chains.map(c=>`
        <div class="rh-item">
          <div class="rh-swatch" style="background:${colorMap[c.group]||'#333'}"></div>
          <span class="rh-label">Group ${c.group}</span>
          <span class="rh-count">${c.count}×</span>
        </div>`).join('')
    : '<div style="color:#444;font-size:11px">No rhymes detected</div>';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _vline(x,y1,y2){ctx.beginPath();ctx.moveTo(x+0.5,y1);ctx.lineTo(x+0.5,y2);ctx.stroke();}
function _roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}
function _rgba(hex,a){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `rgba(${r},${g},${b},${a})`;}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  setupUpload();
  // check if server already has a flowmap loaded (e.g. `nocap serve flowmap.json`)
  try {
    const res = await fetch('/api/flowmap.json');
    if (res.ok) {
      const data = await res.json();
      loadFlowmap(data);
      showViewerScreen();
      // try to load audio too
      const ar = await fetch('/api/audio', {method:'HEAD'});
      if (ar.ok) {
        const a = document.getElementById('audio-el');
        a.src = '/api/audio'; a.load();
        document.getElementById('play-btn').disabled = false;
      }
      return;
    }
  } catch {}
  showUploadScreen();
}

boot();
