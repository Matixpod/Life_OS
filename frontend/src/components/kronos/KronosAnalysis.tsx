import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useKronosStream } from '../../hooks/useKronosStream';
import { api } from '../../services/api';
import type { KronosAnalysis as KronosAnalysisRecord } from '../../types';

export default function KronosAnalysis() {
  const [history, setHistory] = useState<KronosAnalysisRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { start, isStreaming } = useKronosStream({
    onChunk: (chunk) => setStreamingText((t) => t + chunk),
    onDone: async (analysisId) => {
      const fresh = await api.getKronosHistory(20);
      setHistory(fresh);
      setSelectedId(analysisId);
      setStreamingText('');
    },
    onError: (msg) => setError(msg),
  });

  useEffect(() => {
    let cancelled = false;
    api
      .getKronosHistory(20)
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
    start('weekly');
  };

  const selected = history.find((h) => h.id === selectedId) ?? null;
  const display = isStreaming ? streamingText : selected?.analysis_text ?? '';

  return (
    <div className="rounded-xl bg-surface border border-border">
      <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div>
          <div className="text-[11px] tracking-widest uppercase text-muted">KRONOS analysis</div>
          <h3 className="text-sm font-medium">Discipline report</h3>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <select
              value={selectedId ?? ''}
              disabled={isStreaming}
              onChange={(e) => setSelectedId(e.target.value)}
              className="bg-surface2 border border-border text-xs rounded-md px-2 py-1.5"
            >
              {history.map((h) => (
                <option key={h.id} value={h.id}>
                  {new Date(h.created_at).toLocaleString()} · {h.triggered_by}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={runStream}
            disabled={isStreaming}
            className="px-3 py-1.5 rounded-md bg-accent-amber text-black text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {isStreaming ? (
              <Loader2 size={13} className="animate-spin" />
            ) : selected ? (
              <RefreshCw size={13} />
            ) : (
              <Sparkles size={13} />
            )}
            {isStreaming ? 'Streaming…' : selected ? 'Regenerate' : 'Generate analysis'}
          </button>
        </div>
      </header>

      <div className="px-5 py-5 min-h-[240px]">
        {error && <div className="mb-3 text-xs text-red-400">{error}</div>}
        {isStreaming && !streamingText ? (
          <SkeletonLines />
        ) : display ? (
          <article className="prose prose-invert prose-sm max-w-none prose-headings:font-semibold prose-headings:text-white prose-strong:text-white">
            <ReactMarkdown>{display}</ReactMarkdown>
          </article>
        ) : (
          <p className="text-sm text-muted">
            No analysis yet. KRONOS reads your last 90 days of behavior and writes a
            discipline report. Click <strong>Generate analysis</strong>.
          </p>
        )}
      </div>
    </div>
  );
}

function SkeletonLines() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded bg-surface2 animate-pulse"
          style={{ width: `${60 + ((i * 13) % 35)}%` }}
        />
      ))}
    </div>
  );
}
