import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { KronosDashboard as KronosDashboardData } from '../../types';
import KronosAlerts from './KronosAlerts';
import KronosAnalysis from './KronosAnalysis';
import PatternHeatmap from './PatternHeatmap';
import PvEChart from './PvEChart';
import StreakCard from './StreakCard';

export default function KronosDashboard() {
  const [data, setData] = useState<KronosDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getKronosDashboard()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load KRONOS dashboard');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-xl bg-surface border border-border animate-pulse" />
        <div className="grid md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-400">{error}</div>;
  }

  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="rounded-xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-border p-5 flex items-center justify-between">
        <div>
          <div className="text-[11px] tracking-widest uppercase text-muted">
            Global consistency
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-mono text-4xl text-accent-amber">
              {data.global_consistency_score === null
                ? '—'
                : data.global_consistency_score.toFixed(1)}
            </span>
            <span className="text-sm text-muted">/100</span>
          </div>
          {data.last_analysis_at && (
            <div className="text-[11px] text-muted mt-1">
              Last analysis {new Date(data.last_analysis_at).toLocaleString()}
            </div>
          )}
        </div>
        <KronosAlerts alerts={data.alerts} />
      </header>

      <section>
        <div className="text-[11px] tracking-widest uppercase text-muted mb-2">Streaks</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {data.streaks.map((s) => (
            <StreakCard key={s.category} streak={s} />
          ))}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <PvEChart scores={data.pve_scores} />
        <PatternHeatmap patterns={data.patterns} />
      </section>

      <KronosAnalysis />
    </div>
  );
}
