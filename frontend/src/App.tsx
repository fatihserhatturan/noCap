import { useEffect, useMemo, useState } from 'react';
import { Upload, Plus } from 'lucide-react';
import { analyzeTrack, fetchFlowmap, hasAudio } from './api/analyze';
import { FlowPixiStage } from './components/FlowPixiStage';
import { MetricsPanel } from './components/MetricsPanel';
import { PlayerBar } from './components/PlayerBar';
import { ProgressPanel } from './components/ProgressPanel';
import { SourcePanel } from './components/SourcePanel';
import { sampleFlowmap } from './sampleFlowmap';
import type { AnalyzeMessage, FlowMap, StepId, StepState } from './types';

const initialSteps: Record<StepId, StepState> = {
  load: { status: 'idle', msg: '' },
  beat: { status: 'idle', msg: '' },
  transcribe: { status: 'idle', msg: '' },
  align: { status: 'idle', msg: '' },
};

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
    setMode('upload');
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
          <button className="ghost-btn" onClick={reset}>
            <Plus size={15} /> New Track
          </button>
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
            onTimeChange={setCurrentTime}
          />
        </>
      )}
    </div>
  );
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
