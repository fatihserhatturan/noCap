import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Library, Route } from 'lucide-react';
import { AnalysisPopup } from './components/AnalysisPopup';
import { DeleteTrackModal } from './components/DeleteTrackModal';
import { DetailsScreen } from './components/DetailsScreen';
import { ExportMenu } from './components/ExportMenu';
import { FlowPixiStage } from './components/FlowPixiStage';
import { LibraryPanel } from './components/LibraryPanel';
import { MetricsPanel } from './components/MetricsPanel';
import { PlayerBar } from './components/PlayerBar';
import { SourcePanel } from './components/SourcePanel';
import { useAnalysis } from './hooks/useAnalysis';
import { useLibrary } from './hooks/useLibrary';
import { useViewerState } from './hooks/useViewerState';
import { t } from './i18n';
import { sampleFlowmap } from './sampleFlowmap';
import type { FlowMap } from './types';
import logoUrl from '../../source/logo-transparent.png';

export function App() {
  const [flowmap, setFlowmap] = useState<FlowMap | null>(null);
  const [hasVocals, setHasVocals] = useState(false);
  const [hasPlayableAudio, setHasPlayableAudio] = useState(false);
  const [mode, setMode] = useState<'library' | 'viewer' | 'details'>('library');
  const [error, setError] = useState('');
  const library = useLibrary();
  const viewer = useViewerState();
  const analysis = useAnalysis((nextFlowmap, nextHasVocals) => {
    setFlowmap(nextFlowmap);
    setHasVocals(nextHasVocals);
    setHasPlayableAudio(true);
    viewer.reset();
    void library.refreshLibrary();
  });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('sample') === '1') {
      setFlowmap(sampleFlowmap());
      setMode('viewer');
    } else {
      void library.refreshLibrary();
    }
  }, []);

  const meta = useMemo(() => {
    if (!flowmap) return '';
    return `${flowmap.metadata.bpm.toFixed(1)} BPM · ${flowmap.bars.length} bars · ${flowmap.syllables.length} syllables`;
  }, [flowmap]);

  async function openTrack(trackId: string) {
    setError('');
    try {
      const result = await library.openTrack(trackId);
      setFlowmap(result.flowmap);
      setHasVocals(result.hasVocals);
      setHasPlayableAudio(result.hasAudio);
      viewer.reset();
      setMode('viewer');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function reset() {
    setFlowmap(null);
    setHasVocals(false);
    setHasPlayableAudio(false);
    viewer.reset();
    analysis.reset();
    void library.refreshLibrary();
    setMode('library');
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <button className="brand" onClick={reset} aria-label={t('app.brandHome')}>
          <img src={logoUrl} alt="noCap" />
        </button>
        <div className="track-info">
          <span className="track-title">{flowmap?.metadata.title || ''}</span>
          <span className="track-meta">{meta}</span>
        </div>
        {(mode === 'viewer' || mode === 'details') && flowmap && <TopActions mode={mode} setMode={setMode} reset={reset} />}
      </header>
      {mode === 'library' && (
        <main className="library-screen">
          <LibraryPanel tracks={library.library} onOpenTrack={openTrack} onDeleteTrack={library.setDeleteCandidate} onNewTrack={analysis.start} />
          {error && analysis.status === 'idle' && <pre className="error-panel">{error}</pre>}
          {library.deleteCandidate && (
            <DeleteTrackModal track={library.deleteCandidate} onCancel={() => library.setDeleteCandidate(null)} onConfirm={library.confirmDeleteTrack} />
          )}
          {analysis.status !== 'idle' && (
            <AnalysisPopup filename={analysis.filename} steps={analysis.steps} error={analysis.error} status={analysis.status} onClose={analysis.close} />
          )}
        </main>
      )}
      {mode === 'viewer' && flowmap && <Viewer flowmap={flowmap} hasVocals={hasVocals} hasPlayableAudio={hasPlayableAudio} viewer={viewer} />}
      {mode === 'details' && flowmap && <DetailsScreen flowmap={flowmap} actions={<ExportMenu flowmap={flowmap} />} />}
    </div>
  );
}

function TopActions({ mode, setMode, reset }: {
  mode: 'viewer' | 'details';
  setMode: (mode: 'viewer' | 'details') => void;
  reset: () => void;
}) {
  return (
    <div className="top-actions">
      <button className={`ghost-btn nav-view-btn ${mode === 'viewer' ? 'nav-view-active' : ''}`} onClick={() => setMode('viewer')}>
        <Route size={15} /> {t('app.nav.flow')}
      </button>
      <button className={`ghost-btn nav-view-btn ${mode === 'details' ? 'nav-view-active' : ''}`} onClick={() => setMode('details')}>
        <BarChart3 size={15} /> {t('app.nav.details')}
      </button>
      <button className="ghost-btn" onClick={reset}>
        <Library size={15} /> {t('app.nav.library')}
      </button>
    </div>
  );
}

function Viewer({ flowmap, hasVocals, hasPlayableAudio, viewer }: {
  flowmap: FlowMap;
  hasVocals: boolean;
  hasPlayableAudio: boolean;
  viewer: ReturnType<typeof useViewerState>;
}) {
  return (
    <>
      <main className="viewer-layout">
        <SourcePanel source={viewer.source} onSourceChange={viewer.setSource} hasVocals={hasVocals} flowmap={flowmap} hoveredBar={viewer.hoveredBar} />
        <section className="canvas-area">
          <FlowPixiStage
            flowmap={flowmap}
            currentTime={viewer.currentTime}
            activeRhyme={viewer.activeRhyme}
            onBarHover={viewer.setHoveredBar}
            onBarPlay={(barNo) => viewer.playBar(flowmap, barNo)}
            onWordPlay={(syllable) => viewer.playWord(flowmap, syllable)}
          />
        </section>
        <MetricsPanel flowmap={flowmap} activeRhyme={viewer.activeRhyme} onActiveRhymeChange={viewer.setActiveRhyme} />
      </main>
      <PlayerBar enabled={hasPlayableAudio} source={viewer.source} playRange={viewer.playRange} onTimeChange={viewer.setCurrentTime} />
    </>
  );
}
