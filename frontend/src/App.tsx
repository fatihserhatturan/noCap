import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { BarChart3, ChevronDown, Download, FileCode2, FileImage, Library, Plus, Route, Trash2, Upload } from 'lucide-react';
import { analyzeTrack, deleteLibraryTrack, fetchLibrary, openLibraryTrack } from './api/analyze';
import { DetailsScreen } from './components/DetailsScreen';
import { FlowPixiStage } from './components/FlowPixiStage';
import { MetricsPanel } from './components/MetricsPanel';
import { PlayerBar } from './components/PlayerBar';
import { ProgressPanel } from './components/ProgressPanel';
import { SourcePanel } from './components/SourcePanel';
import { downloadFlowmapPng, downloadFlowmapSvg } from './export/flowExport';
import { sampleFlowmap } from './sampleFlowmap';
import type { AnalyzeMessage, FlowMap, FlowSyllable, LibraryTrack, StepId, StepState } from './types';
import logoUrl from '../../source/logo-transparent.png';

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
  const [library, setLibrary] = useState<LibraryTrack[]>([]);
  const [hasVocals, setHasVocals] = useState(false);
  const [hasPlayableAudio, setHasPlayableAudio] = useState(false);
  const [steps, setSteps] = useState(initialSteps);
  const [mode, setMode] = useState<'library' | 'viewer' | 'details'>('library');
  const [error, setError] = useState('');
  const [filename, setFilename] = useState('');
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [source, setSource] = useState<'mix' | 'vocals'>('mix');
  const [activeRhyme, setActiveRhyme] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [playRange, setPlayRange] = useState<PlayRange | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<LibraryTrack | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('sample') === '1') {
      setFlowmap(sampleFlowmap());
      setMode('viewer');
      return;
    }
    void refreshLibrary();
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
    setAnalysisStatus('running');
    setMode('library');
    try {
      await analyzeTrack(file, 'medium', handleAnalyzeMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setAnalysisStatus('error');
    }
  }

  async function refreshLibrary() {
    setLibrary(await fetchLibrary());
  }

  async function openTrack(trackId: string) {
    setError('');
    try {
      const result = await openLibraryTrack(trackId);
      setFlowmap(result.flowmap);
      setHasVocals(result.has_vocals);
      setHasPlayableAudio(result.has_audio);
      setSource('mix');
      setCurrentTime(0);
      setActiveRhyme(null);
      setHoveredBar(null);
      setPlayRange(null);
      setMode('viewer');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function confirmDeleteTrack() {
    if (!deleteCandidate) return;
    setError('');
    try {
      await deleteLibraryTrack(deleteCandidate.id);
      setLibrary((current) => current.filter((item) => item.id !== deleteCandidate.id));
      setDeleteCandidate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
      void refreshLibrary();
      setAnalysisStatus('done');
      return;
    }
    setError(message.msg + (message.trace ? `\n\n${message.trace}` : ''));
    setAnalysisStatus('error');
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
    setAnalysisStatus('idle');
    void refreshLibrary();
    setMode('library');
  }

  function closeAnalysisPopup() {
    setError('');
    setAnalysisStatus('idle');
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
        <button className="brand" onClick={reset} aria-label="noCap home">
          <img src={logoUrl} alt="noCap" />
        </button>
        <div className="track-info">
          <span className="track-title">{title}</span>
          <span className="track-meta">{meta}</span>
        </div>
        {(mode === 'viewer' || mode === 'details') && flowmap && (
          <div className="top-actions">
            <button className={`ghost-btn nav-view-btn ${mode === 'viewer' ? 'nav-view-active' : ''}`} onClick={() => setMode('viewer')}>
              <Route size={15} /> Flow
            </button>
            <button className={`ghost-btn nav-view-btn ${mode === 'details' ? 'nav-view-active' : ''}`} onClick={() => setMode('details')}>
              <BarChart3 size={15} /> Details
            </button>
            <button className="ghost-btn" onClick={reset}>
              <Library size={15} /> Library
            </button>
          </div>
        )}
      </header>

      {mode === 'library' && (
        <main className="library-screen">
          <LibraryPanel tracks={library} onOpenTrack={openTrack} onDeleteTrack={setDeleteCandidate} onNewTrack={start} />
          {error && analysisStatus === 'idle' && <pre className="error-panel">{error}</pre>}
          {deleteCandidate && (
            <DeleteTrackModal
              track={deleteCandidate}
              onCancel={() => setDeleteCandidate(null)}
              onConfirm={confirmDeleteTrack}
            />
          )}
          {analysisStatus !== 'idle' && (
            <AnalysisPopup
              filename={filename}
              steps={steps}
              error={error}
              status={analysisStatus}
              onClose={closeAnalysisPopup}
            />
          )}
        </main>
      )}

      {mode === 'viewer' && flowmap && (
        <>
          <main className="viewer-layout">
            <SourcePanel
              source={source}
              onSourceChange={setSource}
              hasVocals={hasVocals}
              flowmap={flowmap}
              hoveredBar={hoveredBar}
            />
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

      {mode === 'details' && flowmap && <DetailsScreen flowmap={flowmap} actions={<ExportMenu flowmap={flowmap} />} />}
    </div>
  );
}

function ExportMenu({ flowmap }: { flowmap: FlowMap }) {
  function closeMenu(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.closest('details')?.removeAttribute('open');
  }

  return (
    <details className="export-menu">
      <summary className="ghost-btn export-trigger">
        <Download size={15} />
        Export
        <ChevronDown className="export-chevron" size={14} />
      </summary>
      <div className="export-popover">
        <button
          className="export-option"
          onClick={(event) => {
            closeMenu(event);
            void downloadFlowmapPng(flowmap);
          }}
        >
          <FileImage className="export-option-icon" size={15} />
          <span>PNG</span>
        </button>
        <button
          className="export-option"
          onClick={(event) => {
            closeMenu(event);
            downloadFlowmapSvg(flowmap);
          }}
        >
          <FileCode2 className="export-option-icon" size={15} />
          <span>SVG</span>
        </button>
      </div>
    </details>
  );
}

function LibraryPanel({
  tracks,
  onOpenTrack,
  onDeleteTrack,
  onNewTrack,
}: {
  tracks: LibraryTrack[];
  onOpenTrack: (trackId: string) => void;
  onDeleteTrack: (track: LibraryTrack) => void;
  onNewTrack: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function pick(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    onNewTrack(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <section className="library-panel">
      <div className="library-head">
        <div>
          <h1>Library</h1>
          <p>{tracks.length ? `${tracks.length} analyzed tracks` : 'No analyzed tracks yet'}</p>
        </div>
        <button className="add-track-btn" onClick={() => fileInputRef.current?.click()}>
          <Plus size={16} /> Add Track
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,.aiff,.aif,.m4a,.ogg,.flac"
          hidden
          onChange={(event) => pick(event.currentTarget.files)}
        />
      </div>
      <div className="library-grid">
        {tracks.map((track) => (
          <article key={track.id} className="track-card">
            <button className="track-card-open" onClick={() => onOpenTrack(track.id)}>
              <span className="track-card-title">{track.title}</span>
              <span className="track-card-meta">
                {track.bpm.toFixed(1)} BPM · {track.bars} bars · {track.syllables} syllables
              </span>
              <span className="track-card-row">
                <span>Density</span>
                <b>{track.summary.avg_density?.toFixed?.(2) ?? '0.00'}</b>
              </span>
              <span className="track-card-row">
                <span>Sync</span>
                <b>{((track.summary.syncopation_score || 0) * 100).toFixed(0)}%</b>
              </span>
              <span className="track-card-date">{formatDate(track.created_at)}</span>
            </button>
            <button className="track-delete-btn" aria-label={`Delete ${track.title}`} onClick={() => onDeleteTrack(track)}>
              <Trash2 size={15} />
            </button>
          </article>
        ))}
        {tracks.length === 0 && (
          <div className="empty-library">
            <Upload size={34} />
            <span>Add a track to start building your analysis library.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function AnalysisPopup({
  filename,
  steps,
  error,
  status,
  onClose,
}: {
  filename: string;
  steps: Record<StepId, StepState>;
  error: string;
  status: 'running' | 'done' | 'error';
  onClose: () => void;
}) {
  return (
    <div className="analysis-modal-backdrop" role="presentation">
      <section className="analysis-modal" role="dialog" aria-modal="true" aria-label="Track analysis progress">
        <div className="analysis-modal-head">
          <div>
            <h2>{status === 'done' ? 'Analysis Complete' : status === 'error' ? 'Analysis Failed' : 'Analyzing Track'}</h2>
            <p>Medium model · {filename}</p>
          </div>
          {status !== 'running' && (
            <button className="ghost-btn" onClick={onClose}>
              Close
            </button>
          )}
        </div>
        <ProgressPanel filename={filename} steps={steps} error={error} />
      </section>
    </div>
  );
}

function DeleteTrackModal({
  track,
  onCancel,
  onConfirm,
}: {
  track: LibraryTrack;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="analysis-modal-backdrop" role="presentation">
      <section className="confirm-modal" role="dialog" aria-modal="true" aria-label="Delete track confirmation">
        <div className="confirm-icon">
          <Trash2 size={18} />
        </div>
        <h2>Delete Track</h2>
        <p>
          Remove <b>{track.title}</b> and all saved analysis data from the library.
        </p>
        <div className="confirm-actions">
          <button className="ghost-btn" onClick={onCancel}>Cancel</button>
          <button className="danger-btn" onClick={onConfirm}>
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
  if (target.center_time < 0) return null;
  const index = flowmap.syllables.findIndex((syllable) => (
    syllable.word === target.word
    && syllable.bar_no === target.bar_no
    && syllable.beat_no === target.beat_no
    && syllable.syllable_index === target.syllable_index
    && Math.abs(syllable.center_time - target.center_time) < 0.001
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
  const start = Math.max(0, flowmap.syllables[first].start - 0.04);
  const next = flowmap.syllables[last + 1];
  const estimatedEnd = flowmap.syllables[last].end + Math.min(0.2, beatLength * 0.25);
  const end = Math.min(
    flowmap.metadata.duration || estimatedEnd,
    Math.max(start + 0.28, next?.start ? next.start - 0.03 : estimatedEnd),
  );
  return end > start ? { start, end } : null;
}
