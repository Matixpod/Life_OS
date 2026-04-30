import { Brain, Coins, Flame, Heart, Target, TrendingDown, TrendingUp, Users, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StreakData, TaskCategory, TrendDirection } from '../../types';

const CATEGORY_META: Record<TaskCategory, { label: string; icon: LucideIcon; color: string }> = {
  vitality: { label: 'Vitality', icon: Heart, color: '#10b981' },
  intellect: { label: 'Intellect', icon: Brain, color: '#3b82f6' },
  discipline: { label: 'Discipline', icon: Target, color: '#f59e0b' },
  wealth: { label: 'Wealth', icon: Coins, color: '#eab308' },
  charisma: { label: 'Charisma', icon: Users, color: '#ec4899' },
  willpower: { label: 'Willpower', icon: Zap, color: '#a855f7' },
};

function TrendBadge({ trend }: { trend: TrendDirection }) {
  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
        <TrendingUp size={12} /> up
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-red-400">
        <TrendingDown size={12} /> down
      </span>
    );
  }
  return <span className="text-[11px] text-muted">stable</span>;
}

interface Props {
  streak: StreakData;
}

export default function StreakCard({ streak }: Props) {
  const meta = CATEGORY_META[streak.category];
  const Icon = meta.icon;

  return (
    <div className="rounded-xl bg-surface border border-border p-4 flex flex-col gap-2">
      <div className="inline-flex items-center gap-2 min-w-0">
        <div
          className="size-7 shrink-0 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${meta.color}25`, border: `1px solid ${meta.color}55` }}
        >
          <Icon size={15} style={{ color: meta.color }} />
        </div>
        <span className="text-sm font-medium truncate">{meta.label}</span>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <Flame size={20} className="text-accent-amber shrink-0" />
          <span className="font-mono text-3xl">{streak.current_streak}</span>
          <span className="text-xs text-muted">days</span>
        </div>
        <div className="shrink-0">
          <TrendBadge trend={streak.trend} />
        </div>
      </div>

      <div className="text-[11px] text-muted">
        Best <span className="font-mono text-white/80">{streak.longest_streak}d</span>
        {streak.last_active_date && (
          <>
            {' · '}
            Last <span className="font-mono">{streak.last_active_date}</span>
          </>
        )}
      </div>
    </div>
  );
}

export { CATEGORY_META };
