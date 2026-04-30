import type { PatternData, TaskCategory } from '../../types';
import { CATEGORY_META } from './StreakCard';

const DAYS: { key: string; label: string }[] = [
  { key: 'monday', label: 'Mo' },
  { key: 'tuesday', label: 'Tu' },
  { key: 'wednesday', label: 'We' },
  { key: 'thursday', label: 'Th' },
  { key: 'friday', label: 'Fr' },
  { key: 'saturday', label: 'Sa' },
  { key: 'sunday', label: 'Su' },
];

const CATEGORIES: TaskCategory[] = [
  'vitality',
  'intellect',
  'discipline',
  'wealth',
  'charisma',
  'willpower',
];

function cellColor(rate: number | undefined): string {
  if (rate === undefined) return 'rgba(255,255,255,0.04)';
  if (rate < 0.3) return `rgba(239, 68, 68, ${0.25 + rate})`; // red
  if (rate < 0.7) return `rgba(245, 158, 11, ${0.3 + rate * 0.4})`; // amber
  return `rgba(16, 185, 129, ${0.3 + rate * 0.6})`; // emerald
}

interface Props {
  patterns: PatternData[];
}

export default function PatternHeatmap({ patterns }: Props) {
  const byCat = new Map<TaskCategory, PatternData>(patterns.map((p) => [p.category, p]));

  return (
    <div className="rounded-xl bg-surface border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] tracking-widest uppercase text-muted">Patterns</div>
          <h3 className="text-sm font-medium">Completion rate by day-of-week</h3>
        </div>
        <Legend />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="w-28" />
              {DAYS.map((d) => (
                <th key={d.key} className="font-mono font-normal text-muted py-1">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat];
              const p = byCat.get(cat);
              return (
                <tr key={cat}>
                  <td className="py-1 pr-2">
                    <div className="inline-flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="text-xs">{meta.label}</span>
                    </div>
                  </td>
                  {DAYS.map((d) => {
                    const rate = p?.insufficient_data ? undefined : p?.by_day_of_week[d.key];
                    const pct = rate === undefined ? '—' : `${(rate * 100).toFixed(0)}%`;
                    return (
                      <td key={d.key} className="p-0.5">
                        <div
                          className="h-8 rounded-md flex items-center justify-center font-mono text-[10px] text-white/85"
                          style={{ backgroundColor: cellColor(rate) }}
                          title={`${meta.label} · ${d.label}: ${pct}`}
                        >
                          {rate !== undefined ? pct : ''}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="hidden md:flex items-center gap-3 text-[11px] text-muted">
      <span className="inline-flex items-center gap-1">
        <span className="size-2.5 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.55)' }} />
        &lt;30%
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="size-2.5 rounded" style={{ backgroundColor: 'rgba(245,158,11,0.55)' }} />
        30–70%
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="size-2.5 rounded" style={{ backgroundColor: 'rgba(16,185,129,0.7)' }} />
        &gt;70%
      </span>
    </div>
  );
}
