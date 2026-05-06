import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { aresApi } from '../../api/ares';
import { useAresStream } from '../../hooks/useAresStream';
import type { AresAnalysis as AresAnalysisRecord, AresToneMode } from '../../types';

interface ScoreInfo {
  score: number;
  delta: number | null;
  tone: AresToneMode;
}

const TONE_LABEL: Record<AresToneMode, string> = {
  peak: 'Szczytowa forma',
  good: 'Dobra baza',
  needs_work: 'Wymaga pracy',
  crisis: 'Tryb kryzysowy',
};

const TONE_COLOR: Record<AresToneMode, string> = {
  peak: 'text-accent-emerald',
  good: 'text-accent-amber',
  needs_work: 'text-accent-orange',
  crisis: 'text-accent-red',
};

export default function AresAnalysis() {
  const [history, setHistory] = useState<AresAnalysisRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [scoreInfo, setScoreInfo] = useState<ScoreInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { start, isStreaming } = useAresStream({
    onChunk: (chunk) => setStreamingText((t) => t + chunk),
    onScore: (info) => setScoreInfo(info),
    onDone: async (analysisId) => {
      const fresh = await aresApi.getAnalysisHistory(20);
      setHistory(fresh);
      if (analysisId) setSelectedId(analysisId);
      setStreamingText('');
    },
    onError: (msg) => setError(msg),
  });

  useEffect(() => {
    let cancelled = false;
    aresApi
      .getAnalysisHistory(20)
      .then((rows) => {
        if (cancelled) return;
        setHistory(rows);
        if (rows.length && !selectedId) setSelectedId(rows[0].id);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load history');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runStream = () => {
    setError(null);
    setStreamingText('');
    setSelectedId(null);
    setScoreInfo(null);
    start('weekly');
  };

  const selected = history.find((h) => h.id === selectedId) ?? null;
  const display = isStreaming ? streamingText : selected?.analysis_text ?? '';

  const headerScore = scoreInfo
    ? scoreInfo
    : selected
      ? {
          score: selected.health_score,
          delta: selected.score_delta,
          tone: deriveTone(selected.health_score),
        }
      : null;

  return (
    <div className="rounded-xl border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted">
              ARES analysis
            </div>
            <h3 className="text-sm font-medium">Raport siły fizycznej</h3>
          </div>
          {headerScore && (
            <div className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-xs">
              <span className="font-mono">{headerScore.score.toFixed(0)} / 100</span>
              {headerScore.delta !== null && (
                <span
                  className={`ml-2 font-mono ${
                    headerScore.delta >= 0 ? 'text-accent-emerald' : 'text-accent-red'
                  }`}
                >
                  {headerScore.delta >= 0 ? '+' : ''}
                  {headerScore.delta.toFixed(1)}
                </span>
              )}
              <span className={`ml-2 ${TONE_COLOR[headerScore.tone]}`}>
                {TONE_LABEL[headerScore.tone]}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <select
              value={selectedId ?? ''}
              disabled={isStreaming}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-xs"
            >
              {history.map((h) => (
                <option key={h.id} value={h.id}>
                  {new Date(h.created_at).toLocaleString()} · {h.analysis_type}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={runStream}
            disabled={isStreaming}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-orange px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
          >
            {isStreaming ? (
              <Loader2 size={13} className="animate-spin" />
            ) : selected ? (
              <RefreshCw size={13} />
            ) : (
              <Sparkles size={13} />
            )}
            {isStreaming ? 'Streaming…' : selected ? 'Generuj nową' : 'Generuj analizę'}
          </button>
        </div>
      </header>
      <div className="min-h-[260px] px-5 py-5">
        {error && <div className="mb-3 text-xs text-accent-red">{error}</div>}
        {isStreaming && !streamingText ? (
          <SkeletonLines />
        ) : display ? (
          <article className="prose prose-invert prose-sm max-w-none prose-headings:font-semibold prose-headings:text-white prose-strong:text-white">
            <ReactMarkdown>{display}</ReactMarkdown>
          </article>
        ) : (
          <p className="text-sm text-muted">
            Brak analiz. ARES odczytuje Twoje zadania z 14 dni i pisze raport
            siły fizycznej. Kliknij <strong>Generuj analizę</strong>.
          </p>
        )}
      </div>
    </div>
  );
}

function deriveTone(score: number): AresToneMode {
  if (score >= 80) return 'peak';
  if (score >= 60) return 'good';
  if (score >= 40) return 'needs_work';
  return 'crisis';
}

function SkeletonLines() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded bg-surface2"
          style={{ width: `${60 + ((i * 13) % 35)}%` }}
        />
      ))}
    </div>
  );
}
