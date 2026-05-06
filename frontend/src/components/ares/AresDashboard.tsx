import { useEffect, useState } from 'react';
import { aresApi } from '../../api/ares';
import type { AresDashboard as AresDashboardData } from '../../types';
import AresAnalysis from './AresAnalysis';
import AresTrendChart from './AresTrendChart';
import HealthScoreGauge from './HealthScoreGauge';
import SubcategoryBar from './SubcategoryBar';

export default function AresDashboard() {
  const [data, setData] = useState<AresDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    aresApi
      .getDashboard()
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load ARES dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-64 animate-pulse rounded-xl border border-border bg-surface" />
        <div className="h-64 animate-pulse rounded-xl border border-border bg-surface md:col-span-2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const noTasks = data.current_score.subcategory_scores.every((s) => s.tasks_detected === 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <section className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-5">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted">
            Health score
          </div>
          <HealthScoreGauge
            score={data.current_score.health_score}
            tone={data.current_score.tone_mode}
          />
          {data.current_score.score_delta !== null && (
            <div
              className={`mt-3 font-mono text-xs ${
                data.current_score.score_delta >= 0
                  ? 'text-accent-emerald'
                  : 'text-accent-red'
              }`}
            >
              {data.current_score.score_delta >= 0 ? '+' : ''}
              {data.current_score.score_delta.toFixed(1)} vs poprzedni wynik
            </div>
          )}
        </section>

        <section className="space-y-3 md:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {data.current_score.subcategory_scores.map((sub) => (
              <SubcategoryBar key={sub.subcategory} data={sub} />
            ))}
          </div>
        </section>
      </div>

      {noTasks ? (
        <div className="rounded-xl border border-accent-amber/40 bg-accent-amber/10 px-5 py-4 text-sm text-accent-amber">
          Dodaj pierwsze zadania sportowe aby ARES mógł Cię ocenić.
        </div>
      ) : (
        <AresTrendChart history={data.score_history} />
      )}

      <AresAnalysis />
    </div>
  );
}
