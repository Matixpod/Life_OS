import { Check, Flame, X, Zap } from 'lucide-react';
import {
  fatGramsAnalogy,
  HR_ZONE_META,
  type CardioSession,
} from '../../../types/prometheus';

interface Props {
  session: CardioSession;
  onDismiss: () => void;
}

export default function CardioResult({ session, onDismiss }: Props) {
  const fatPct = session.fat_pct ?? 50;
  const carbPct = session.carb_pct ?? 100 - fatPct;
  const zone = session.hr_zone ? HR_ZONE_META[session.hr_zone] : null;
  const fatGrams = session.fat_grams ?? 0;

  return (
    <div className="rounded-xl border border-accent-orange/40 bg-surface p-4 animate-fade-in">
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-white">
          <Check size={14} className="text-accent-green" />
          {session.label}
          <span className="text-muted font-mono">·</span>
          <span className="font-mono text-muted">{session.duration_min} min</span>
          {zone && (
            <span
              className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${zone.color}22`,
                color: zone.color,
                border: `1px solid ${zone.color}55`,
              }}
            >
              {zone.label}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Zamknij"
          className="text-muted hover:text-white"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Metric label="Łącznie" value={`${Math.round(session.kcal_total ?? 0)} kcal`} accent="#F97316" />
        <Metric label="Tłuszcz" value={`${Math.round(session.fat_kcal ?? 0)} kcal`} accent="#F97316" />
        <Metric label="Węgle" value={`${Math.round(session.carb_kcal ?? 0)} kcal`} accent="#3B82F6" />
      </div>

      <div className="space-y-1.5">
        <Bar pct={fatPct} color="#F97316" label={`${Math.round(fatPct)}% tłuszcz`} />
        <Bar pct={carbPct} color="#3B82F6" label={`${Math.round(carbPct)}% węgle`} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="inline-flex items-center gap-1.5 text-white">
          <Flame size={12} className="text-accent-orange" />
          <span>
            Spalono tłuszczu: <span className="font-mono">{fatGrams.toFixed(2)} g</span>
          </span>
          <span className="text-muted">{fatGramsAnalogy(fatGrams)}</span>
        </div>
        {session.kcal_epoc != null && (
          <div
            className="inline-flex items-center gap-1.5 text-muted"
            title="Kalorie spalane po treningu w wyniku efektu EPOC"
          >
            <Zap size={12} className="text-accent-yellow" />
            EPOC (po treningu): <span className="font-mono text-white">+{Math.round(session.kcal_epoc)} kcal</span>
          </div>
        )}
      </div>

      {session.analysis_note && (
        <p className="mt-3 text-xs italic text-muted">&quot;{session.analysis_note}&quot;</p>
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-md border border-border bg-surface2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-base" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function Bar({ pct, color, label }: { pct: number; color: string; label: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-24 shrink-0 text-right font-mono text-[10px] text-muted">{label}</span>
    </div>
  );
}
