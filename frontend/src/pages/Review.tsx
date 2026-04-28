import { ArrowLeft, ChevronDown, ChevronRight, Library, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import ErrorBanner from '../components/ErrorBanner';
import { api } from '../services/api';
import type { PeriodicReview } from '../types';

type Tab = 'weekly' | 'monthly';

export default function Review() {
  const [tab, setTab] = useState<Tab>('weekly');
  const [reviews, setReviews] = useState<PeriodicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [active, setActive] = useState<PeriodicReview | null>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);

  const refresh = (kind: Tab) => {
    setLoading(true);
    api
      .listReviews(kind)
      .then((list) => {
        setReviews(list);
        setActive(list[0] ?? null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load reviews');
        setLoading(false);
      });
  };

  useEffect(() => {
    let cancelled = false;
    api
      .listReviews(tab)
      .then((list) => {
        if (cancelled) return;
        setReviews(list);
        setActive(list[0] ?? null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load reviews');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const created = await api.generateReview(tab);
      setReviews((r) => [created, ...r]);
      setActive(created);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <Link to="/" className="inline-flex items-center gap-1 text-muted hover:text-white text-sm mb-6">
        <ArrowLeft size={14} /> Dashboard
      </Link>

      <header className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[11px] tracking-widest uppercase text-muted">Periodic Review</div>
          <h1 className="text-2xl md:text-3xl font-semibold mt-1">Reflect & compress</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-surface border border-border p-1 flex">
            {(['weekly', 'monthly'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded text-xs uppercase tracking-widest ${
                  tab === t ? 'bg-accent-blue text-white' : 'text-muted hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 rounded-md bg-accent-blue text-white text-sm flex items-center gap-2 disabled:opacity-40"
          >
            <Sparkles size={14} /> {generating ? 'Generating… (~30s)' : `Generate ${tab}`}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6">
          <ErrorBanner message={error} onRetry={() => refresh(tab)} />
        </div>
      )}

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <aside className="rounded-xl bg-surface border border-border p-3 max-h-[70vh] overflow-y-auto">
          <div className="text-[11px] tracking-widest uppercase text-muted px-2 pt-1 pb-3">Past</div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 rounded bg-surface2 animate-pulse" />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-sm text-muted text-center py-8 px-2">
              No {tab} reviews yet. Click "Generate {tab}" to create one.
            </div>
          ) : (
            <ul className="space-y-1">
              {reviews.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setActive(r)}
                    className={`w-full text-left rounded px-3 py-2 text-sm transition-colors ${
                      active?.id === r.id
                        ? 'bg-surface2 border-l-2 border-accent-blue'
                        : 'hover:bg-surface2 text-muted hover:text-white'
                    }`}
                  >
                    <div className="font-mono text-xs">{r.period_end}</div>
                    {r.avg_potential_score != null && (
                      <div className="text-[11px] text-muted">avg {r.avg_potential_score}</div>
                    )}
                    {r.context_snapshot && (
                      <span className="inline-block mt-1 text-[9px] tracking-widest uppercase rounded-full px-1.5 py-0.5 bg-accent-emerald/15 text-accent-emerald">
                        compressed
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main>
          {!active ? (
            <div className="rounded-xl bg-surface border border-border p-10 text-center">
              <Library size={32} className="mx-auto text-muted mb-3" />
              <p className="text-sm text-muted">Select or generate a review to see its content.</p>
            </div>
          ) : (
            <article className="rounded-xl bg-surface border border-border p-6 md:p-8">
              <div className="text-[11px] tracking-widest uppercase text-muted">
                {active.type} · {active.period_start} → {active.period_end}
              </div>
              {active.avg_potential_score != null && (
                <div className="font-mono text-2xl font-semibold mt-1">
                  {active.avg_potential_score}
                  <span className="text-muted text-sm"> avg potential</span>
                </div>
              )}

              <div className="prose prose-invert prose-sm md:prose-base max-w-none mt-6">
                <ReactMarkdown>{active.review_markdown}</ReactMarkdown>
              </div>

              {active.context_snapshot && (
                <div className="mt-6 border-t border-border pt-4">
                  <button
                    onClick={() => setSnapshotOpen((o) => !o)}
                    className="flex items-center gap-1 text-sm text-muted hover:text-white"
                  >
                    {snapshotOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Agent memory snapshot
                  </button>
                  {snapshotOpen && (
                    <pre className="mt-3 text-xs font-mono bg-surface2 border border-border rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                      {active.context_snapshot}
                    </pre>
                  )}
                </div>
              )}
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
