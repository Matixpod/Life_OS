import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useTasks } from '../../hooks/useTasks';
import type { DailyTaskList } from '../../types';

const DOW_LABELS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];

export default function WeeklyView() {
  const { week, refreshWeek } = useTasks();
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    void refreshWeek();
  }, [refreshWeek]);

  const isoToday = new Date().toISOString().slice(0, 10);
  const chartData = useMemo(() => {
    if (!week) return [];
    return week.days.map((d, i) => ({
      day: DOW_LABELS[i],
      date: d.date,
      xp: Object.values(d.by_category).reduce((acc, c) => acc + c.xp_earned, 0),
    }));
  }, [week]);

  if (!week) return <WeeklyViewSkeleton />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="rounded-xl bg-surface border border-border p-3">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] uppercase tracking-widest text-muted">
            Tydzień {week.week_start} → {week.week_end}
          </span>
          <span className="font-mono text-sm text-accent-amber">{week.total_xp} XP</span>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {week.days.map((d, i) => (
            <DayColumn
              key={d.date}
              day={d}
              dowLabel={DOW_LABELS[i]}
              isToday={d.date === isoToday}
              expanded={expanded === d.date}
              onToggle={() => setExpanded((prev) => (prev === d.date ? null : d.date))}
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-surface border border-border p-3">
        <div className="text-[11px] uppercase tracking-widest text-muted mb-2">
          XP per day
        </div>
        <div className="h-32 w-full" style={{ minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={chartData}>
              <XAxis dataKey="day" stroke="#8B8B9F" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: '#1A1A24' }}
                contentStyle={{
                  backgroundColor: '#12121A',
                  border: '1px solid #262636',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="xp" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {expanded && (
        <ExpandedDay day={week.days.find((d) => d.date === expanded) ?? null} />
      )}
    </div>
  );
}

function DayColumn({
  day,
  dowLabel,
  isToday,
  expanded,
  onToggle,
}: {
  day: DailyTaskList;
  dowLabel: string;
  isToday: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const ratio = day.completion_rate;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex flex-col items-stretch gap-1.5 rounded-lg p-2 text-left border transition-colors ${
        isToday
          ? 'border-accent-amber/60 bg-accent-amber/5'
          : 'border-border bg-surface2/40 hover:bg-surface2'
      } ${expanded ? 'ring-2 ring-accent-blue/40' : ''}`}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted">{dowLabel}</span>
        <span className="font-mono text-[10px] text-muted">{day.date.slice(8)}</span>
      </div>
      <div className="font-mono text-sm">
        {day.total_completed}/{day.total_planned}
      </div>
      <div className="h-1.5 rounded-full bg-surface overflow-hidden">
        <div
          className="h-full bg-accent-emerald transition-all"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </button>
  );
}

function ExpandedDay({ day }: { day: DailyTaskList | null }) {
  if (!day || day.tasks.length === 0) {
    return (
      <div className="rounded-xl bg-surface border border-border p-4 text-sm text-muted">
        Brak zadań w tym dniu.
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-surface border border-border p-3 space-y-1.5">
      <div className="text-[11px] uppercase tracking-widest text-muted mb-2">
        {day.date}
      </div>
      {day.tasks.map((t) => (
        <div
          key={t.id}
          className={`text-sm flex items-center justify-between gap-3 px-2 py-1.5 rounded-md ${
            t.status === 'done' ? 'opacity-60 line-through' : ''
          }`}
        >
          <span className="truncate">{t.title}</span>
          <span className="font-mono text-[11px] text-muted shrink-0">{t.priority}</span>
        </div>
      ))}
    </div>
  );
}

function WeeklyViewSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-32 rounded-xl bg-surface border border-border animate-pulse" />
      <div className="h-32 rounded-xl bg-surface border border-border animate-pulse" />
    </div>
  );
}
