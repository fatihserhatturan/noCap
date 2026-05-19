import { useEffect, useMemo, useState } from 'react';
import { FileCode2, FileImage, Plus, Upload } from 'lucide-react';
import { analyzeTrack, fetchFlowmap, hasAudio } from './api/analyze';
import { FlowPixiStage } from './components/FlowPixiStage';
import { MetricsPanel } from './components/MetricsPanel';
import { PlayerBar } from './components/PlayerBar';
import { ProgressPanel } from './components/ProgressPanel';
import { SourcePanel } from './components/SourcePanel';
import { downloadFlowmapPng, downloadFlowmapSvg } from './export/flowExport';
import { sampleFlowmap } from './sampleFlowmap';
import type { AnalyzeMessage, FlowMap, FlowSyllable, StepId, StepState } from './types';

const initialSteps: Record<StepId, StepState> = {
  load: { status: 'idle', msg: '' },
  beat: { status: 'idle', msg: '' },
  transcribe: { status: 'idle', msg: '' },
  align: { status: 'idle', msg: '' },
};

interface PlayRange {
  id: number;
  start: number;
  end: number;
}

export function App() {
  const [flowmap, setFlowmap] = useState<FlowMap | null>(null);
  const [hasVocals, setHasVocals] = useState(false);
  const [hasPlayableAudio, setHasPlayableAudio] = useState(false);
  const [steps, setSteps] = useState(initialSteps);
  const [mode, setMode] = useState<'upload' | 'progress' | 'viewer'>('upload');
  const [error, setError] = useState('');
  const [filename, setFilename] = useState('');
  const [model, setModel] = useState('small');
  const [currentTime, setCurrentTime] = useState(0);
  const [source, setSource] = useState<'mix' | 'vocals'>('mix');
  const [activeRhyme, setActiveRhyme] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [playRange, setPlayRange] = useState<PlayRange | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('sample') === '1') {
      setFlowmap(sampleFlowmap());
      setMode('viewer');
      return;
    }
    void fetchFlowmap().then(async (data) => {
      if (!data) return;
      setFlowmap(data);
      setHasPlayableAudio(await hasAudio());
      setMode('viewer');
    });
  }, []);

  const title = flowmap?.metadata.title || '';
  const meta = useMemo(() => {
    if (!flowmap) return '';
    return `${flowmap.metadata.bpm.toFixed(1)} BPM · ${flowmap.bars.length} bars · ${flowmap.syllables.length} syllables`;
  }, [flowmap]);

  async function start(file: File) {
    setFilename(file.name);
    setError('');
    setSteps(initialSteps);
    setMode('progress');
    try {
      await analyzeTrack(file, model, handleAnalyzeMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMode('upload');
    }
  }

  function handleAnalyzeMessage(message: AnalyzeMessage) {
    if (message.type === 'progress') {
      setSteps((prev) => ({
        ...prev,
        [message.step]: {
          status: message.done ? 'done' : 'active',
          msg: message.msg || '',
        },
      }));
      return;
    }
    if (message.type === 'complete') {
      setFlowmap(message.flowmap);
      setHasVocals(message.has_vocals);
      setHasPlayableAudio(true);
      setSource('mix');
      setMode('viewer');
      return;
    }
    setError(message.msg + (message.trace ? `\n\n${message.trace}` : ''));
    setMode('upload');
  }

  function reset() {
    setFlowmap(null);
    setHasVocals(false);
    setHasPlayableAudio(false);
    setSource('mix');
    setCurrentTime(0);
    setActiveRhyme(null);
    setHoveredBar(null);
    setPlayRange(null);
    setMode('upload');
  }

  function playBar(barNo: number) {
    if (!flowmap) return;
    const range = getBarTimeRange(flowmap, barNo);
    if (!range) return;
    setPlayRange({ id: Date.now(), start: range.start, end: range.end });
  }

  function playWord(syllable: FlowSyllable) {
    if (!flowmap) return;
    const range = getWordTimeRange(flowmap, syllable);
    if (!range) return;
    setPlayRange({ id: Date.now(), start: range.start, end: range.end });
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <button className="brand" onClick={reset}>noCap</button>
        <div className="track-info">
          <span className="track-title">{title}</span>
          <span className="track-meta">{meta}</span>
        </div>
        {mode === 'viewer' && (
          <div className="top-actions">
            {flowmap && (
              <>
                <button className="icon-btn" onClick={() => void downloadFlowmapPng(flowmap)} title="Export PNG" aria-label="Export PNG">
                  <FileImage size={15} />
                </button>
                <button className="icon-btn" onClick={() => downloadFlowmapSvg(flowmap)} title="Export SVG" aria-label="Export SVG">
                  <FileCode2 size={15} />
                </button>
              </>
            )}
            <button className="ghost-btn" onClick={reset}>
              <Plus size={15} /> New Track
            </button>
          </div>
        )}
      </header>

      {mode === 'upload' && (
        <main className="upload-screen">
          <UploadPanel onAnalyze={start} model={model} onModelChange={setModel} />
          {error && <pre className="error-panel">{error}</pre>}
        </main>
      )}

      {mode === 'progress' && (
        <main className="upload-screen">
          <ProgressPanel filename={filename} steps={steps} error={error} />
        </main>
      )}

      {mode === 'viewer' && flowmap && (
        <>
          <main className="viewer-layout">
            <SourcePanel source={source} onSourceChange={setSource} hasVocals={hasVocals} />
            <section className="canvas-area">
              <FlowPixiStage
                flowmap={flowmap}
                currentTime={currentTime}
                activeRhyme={activeRhyme}
                onBarHover={setHoveredBar}
                onBarPlay={playBar}
                onWordPlay={playWord}
              />
            </section>
            <MetricsPanel
              flowmap={flowmap}
              activeRhyme={activeRhyme}
              onActiveRhymeChange={setActiveRhyme}
              hoveredBar={hoveredBar}
            />
          </main>
          <PlayerBar
            enabled={hasPlayableAudio}
            source={source}
            playRange={playRange}
            onTimeChange={setCurrentTime}
          />
        </>
      )}
    </div>
  );
}

function getBarTimeRange(flowmap: FlowMap, barNo: number): { start: number; end: number } | null {
  const barBeats = flowmap.beats.filter((beat) => beat.bar_no === barNo);
  if (barBeats.length === 0) return null;

  const start = barBeats[0].time;
  const nextBarBeat = flowmap.beats.find((beat) => beat.bar_no > barNo);
  const lastBeat = barBeats[barBeats.length - 1];
  const beatLength = flowmap.metadata.bpm > 0 ? 60 / flowmap.metadata.bpm : 0.75;
  const end = nextBarBeat?.time ?? Math.min(flowmap.metadata.duration || lastBeat.time + beatLength, lastBeat.time + beatLength);
  return end > start ? { start, end } : null;
}

function getWordTimeRange(flowmap: FlowMap, target: FlowSyllable): { start: number; end: number } | null {
  if (target.time < 0) return null;
  const index = flowmap.syllables.findIndex((syllable) => (
    syllable.word === target.word
    && syllable.bar_no === target.bar_no
    && syllable.beat_no === target.beat_no
    && syllable.syllable_index === target.syllable_index
    && Math.abs(syllable.time - target.time) < 0.001
  ));
  if (index < 0) return null;

  let first = index;
  while (
    first > 0
    && flowmap.syllables[first - 1].word === target.word
    && flowmap.syllables[first - 1].bar_no === target.bar_no
  ) {
    first -= 1;
  }

  let last = index;
  while (
    last + 1 < flowmap.syllables.length
    && flowmap.syllables[last + 1].word === target.word
    && flowmap.syllables[last + 1].bar_no === target.bar_no
  ) {
    last += 1;
  }

  const beatLength = flowmap.metadata.bpm > 0 ? 60 / flowmap.metadata.bpm : 0.75;
  const start = Math.max(0, flowmap.syllables[first].time - 0.04);
  const next = flowmap.syllables[last + 1];
  const estimatedEnd = flowmap.syllables[last].time + Math.min(0.65, beatLength * 0.8);
  const end = Math.min(
    flowmap.metadata.duration || estimatedEnd,
    Math.max(start + 0.28, next?.time ? next.time - 0.03 : estimatedEnd),
  );
  return end > start ? { start, end } : null;
}

function UploadPanel({
  onAnalyze,
  model,
  onModelChange,
}: {
  onAnalyze: (file: File) => void;
  model: string;
  onModelChange: (model: string) => void;
}) {
  const [dragging, setDragging] = useState(false);

  function pick(fileList: FileList | null) {
    const file = fileList?.[0];
    if (file) onAnalyze(file);
  }

  return (
    <>
      <label
        className={`drop-zone ${dragging ? 'drag-over' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          pick(event.dataTransfer.files);
        }}
      >
        <Upload size={40} />
        <span className="drop-label">Drop your track here</span>
        <span className="drop-sub">MP3, WAV, AIFF, M4A</span>
        <span className="select-btn">Select File</span>
        <input
          type="file"
          accept=".mp3,.wav,.aiff,.aif,.m4a,.ogg,.flac"
          hidden
          onChange={(event) => pick(event.currentTarget.files)}
        />
      </label>
      <div className="analysis-options">
        <label className="opt-field">
          <span>Model</span>
          <select value={model} onChange={(event) => onModelChange(event.target.value)}>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="base">Base</option>
          </select>
        </label>
      </div>
    </>
  );
}
