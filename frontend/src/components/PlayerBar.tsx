import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-react';

export function PlayerBar({
  enabled,
  source,
  playRange,
  syncOffset,
  audioTimeRef,
  onSyncOffsetChange,
  onSyncOffsetReset,
}: {
  enabled: boolean;
  source: 'mix' | 'vocals';
  playRange: { id: number; start: number; end: number } | null;
  syncOffset: number;
  audioTimeRef: MutableRefObject<number>;
  onSyncOffsetChange: (delta: number) => void;
  onSyncOffsetReset: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const segmentEndRef = useRef<number | null>(null);
  // Keep syncOffset in a ref so the RAF closure always reads the latest value
  const syncOffsetRef = useRef(syncOffset);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);

  // Keep syncOffset in a ref so the RAF closure always reads the latest value
  // without needing to be in the dependency array.
  useEffect(() => {
    syncOffsetRef.current = syncOffset;
    // If paused, push the updated offset immediately so the Pixi ticker sees it.
    const audio = audioRef.current;
    if (audio) audioTimeRef.current = Math.max(0, audio.currentTime + syncOffset);
  }, [syncOffset, audioTimeRef]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!enabled) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      segmentEndRef.current = null;
      audioTimeRef.current = 0;
      setPlaying(false);
      setDuration(0);
      setTime(0);
      return;
    }
    const saved = audio.currentTime;
    audio.src = source === 'vocals' ? '/api/audio/vocals' : '/api/audio';
    audio.load();
    const restore = () => {
      audio.currentTime = Math.min(saved, audio.duration || saved);
      if (playing) void audio.play();
    };
    audio.addEventListener('loadedmetadata', restore, { once: true });
    return () => audio.removeEventListener('loadedmetadata', restore);
  }, [enabled, source]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      const current = audioRef.current?.currentTime || 0;
      // Write sync-offset-applied time directly to the ref — no React state,
      // no re-render. FlowPixiStage's Pixi ticker reads this every frame.
      audioTimeRef.current = Math.max(0, current + syncOffsetRef.current);
      // Keep local PlayerBar timeline display in sync (React state, for UI only).
      setTime(current);
      if (segmentEndRef.current !== null && current >= segmentEndRef.current) {
        if (audioRef.current) audioRef.current.pause();
        segmentEndRef.current = null;
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, audioTimeRef]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !enabled || !playRange) return;
    segmentEndRef.current = playRange.end;
    audio.currentTime = playRange.start;
    audioTimeRef.current = Math.max(0, playRange.start + syncOffsetRef.current);
    setTime(playRange.start);
    void audio.play().then(() => setPlaying(true)).catch(() => {
      segmentEndRef.current = null;
    });
  }, [enabled, playRange, audioTimeRef]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio || !enabled) return;
    if (audio.paused) {
      segmentEndRef.current = null;
      await audio.play();
      setPlaying(true);
    } else {
      segmentEndRef.current = null;
      audio.pause();
      setPlaying(false);
    }
  }

  function seek(clientX: number, target: HTMLDivElement) {
    const rect = target.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const next = pct * duration;
    if (audioRef.current) audioRef.current.currentTime = next;
    segmentEndRef.current = null;
    // Write immediately so the Pixi ticker sees the new position at once.
    audioTimeRef.current = Math.max(0, next + syncOffsetRef.current);
    setTime(next);
  }

  const pct = duration ? (time / duration) * 100 : 0;

  return (
    <footer className="player-bar">
      <button className="play-btn" disabled={!enabled} onClick={toggle}>
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <div
        className="timeline"
        onMouseDown={(event) => seek(event.clientX, event.currentTarget)}
      >
        <div className="timeline-progress" style={{ width: `${pct}%` }} />
        <div className="timeline-cursor" style={{ left: `${pct}%` }} />
      </div>
      <span className="time-display">{fmt(time)} / {fmt(duration)}</span>
      <div className="sync-controls">
        <button type="button" onClick={() => onSyncOffsetChange(-0.05)} title="Earlier">
          <StepBack size={13} />
        </button>
        <button type="button" onClick={onSyncOffsetReset} title="Reset sync">
          <RotateCcw size={13} />
        </button>
        <button type="button" onClick={() => onSyncOffsetChange(0.05)} title="Later">
          <StepForward size={13} />
        </button>
        <span>{fmtOffset(syncOffset)}</span>
      </div>
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onEnded={() => setPlaying(false)}
      />
    </footer>
  );
}

function fmtOffset(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  return `${ms >= 0 ? '+' : ''}${ms}ms`;
}

function fmt(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}
