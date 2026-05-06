import { Activity, Apple, Droplet, Moon } from 'lucide-react';
import type { AresSubcategoryScore, VitalitySubcategory } from '../../types';

interface Props {
  data: AresSubcategoryScore;
}

const ICONS: Record<VitalitySubcategory, typeof Activity> = {
  activity: Activity,
  nutrition: Apple,
  sleep: Moon,
  hydration: Droplet,
};

const LABELS: Record<VitalitySubcategory, string> = {
  activity: 'Aktywność',
  nutrition: 'Odżywianie',
  sleep: 'Sen',
  hydration: 'Nawodnienie',
};

function colorFor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#A3E635';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
}

export default function SubcategoryBar({ data }: Props) {
  const Icon = ICONS[data.subcategory];
  const fill = Math.max(0, Math.min(100, data.score));
  const color = colorFor(fill);

  return (
    <div className="rounded-lg border border-border bg-surface2 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-surface text-muted">
            <Icon size={16} />
          </span>
          <div>
            <div className="text-sm font-medium">{LABELS[data.subcategory]}</div>
            <div className="text-xs text-muted">
              {data.tasks_detected} zadań · {data.days_active}/{data.days_analyzed} dni
            </div>
          </div>
        </div>
        <div className="font-mono text-base" style={{ color }}>
          {fill.toFixed(0)}%
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${fill}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
