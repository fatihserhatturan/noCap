import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

export function PlayerBar({
  enabled,
  source,
  playRange,
  onTimeChange,
}: {
  enabled: boolean;
  source: 'mix' | 'vocals';
  playRange: { id: number; start: number; end: number } | null;
  onTimeChange: (time: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const segmentEndRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!enabled) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      segmentEndRef.current = null;
      setPlaying(false);
      setDuration(0);
      setTime(0);
      onTimeChange(0);
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
  }, [enabled, source, onTimeChange]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      const current = audioRef.current?.currentTime || 0;
      setTime(current);
      onTimeChange(current);
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
  }, [playing, onTimeChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !enabled || !playRange) return;
    segmentEndRef.current = playRange.end;
    audio.currentTime = playRange.start;
    setTime(playRange.start);
    onTimeChange(playRange.start);
    void audio.play().then(() => setPlaying(true)).catch(() => {
      segmentEndRef.current = null;
    });
  }, [enabled, playRange, onTimeChange]);

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
    setTime(next);
    onTimeChange(next);
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
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onEnded={() => setPlaying(false)}
      />
    </footer>
  );
}

function fmt(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}
