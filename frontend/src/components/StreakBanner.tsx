import { Flame } from 'lucide-react';

interface StreakBannerProps {
  streakDays: number;
}

function pickPhrase(n: number): string {
  if (n === 0) return 'Start today.';
  if (n < 3) return 'Building momentum.';
  if (n < 8) return 'Showing up consistently.';
  if (n < 22) return 'A real habit is forming.';
  if (n < 60) return 'Locked in. Keep going.';
  return 'Elite consistency.';
}

export default function StreakBanner({ streakDays }: StreakBannerProps) {
  const tier =
    streakDays >= 22 ? 'emerald' : streakDays >= 8 ? 'amber' : streakDays >= 1 ? 'blue' : 'muted';

  const colorMap = {
    emerald: {
      ring: 'border-accent-emerald/40 shadow-[0_0_24px_rgba(16,185,129,0.3)]',
      chip: 'bg-accent-emerald/15 text-accent-emerald',
      flame: 'text-accent-emerald',
    },
    amber: {
      ring: 'border-accent-amber/40',
      chip: 'bg-accent-amber/15 text-accent-amber',
      flame: 'text-accent-amber',
    },
    blue: {
      ring: 'border-accent-blue/40',
      chip: 'bg-accent-blue/15 text-accent-blue',
      flame: 'text-accent-blue',
    },
    muted: {
      ring: 'border-border',
      chip: 'bg-surface2 text-muted',
      flame: 'text-muted',
    },
  } as const;

  const c = colorMap[tier];

  return (
    <div className={`w-full rounded-xl bg-surface border ${c.ring} px-4 md:px-5 py-3 flex items-center gap-3`}>
      <div className={`size-9 rounded-md flex items-center justify-center ${c.chip}`}>
        <Flame size={18} className={c.flame} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm">
          <span className="font-mono font-semibold">{streakDays}</span>
          <span className="text-muted">{streakDays === 1 ? '-day streak' : '-day streak'} — </span>
          <span>{pickPhrase(streakDays)}</span>
        </div>
      </div>
      <span className={`hidden md:inline-block text-[10px] tracking-widest uppercase rounded-full px-2 py-1 ${c.chip}`}>
        {tier === 'muted' ? 'starter' : tier}
      </span>
    </div>
  );
}
