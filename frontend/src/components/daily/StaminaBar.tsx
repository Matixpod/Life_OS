import { Zap } from 'lucide-react';

import type { StaminaStatus } from '../../types';

interface StaminaBarProps {
  status: StaminaStatus | null;
  isLoading: boolean;
  onClick: () => void;
}

function fillColor(percentage: number): string {
  if (percentage >= 60) return 'bg-emerald-500';
  if (percentage >= 30) return 'bg-amber-500';
  return 'bg-red-500';
}

function formatHM(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Persistent stamina bar — lives in the top navigation, always visible.
 *
 * Click expands the StaminaDetailsPanel. When the user hasn't run the
 * morning briefing yet (`is_initialized=false`), we render a muted
 * placeholder instead of a 0/0 bar, since 0 is a valid post-briefing
 * value and we don't want to conflate the two states.
 */
export default function StaminaBar({ status, isLoading, onClick }: StaminaBarProps) {
  if (isLoading) {
    return (
      <div className="flex h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3">
        <Zap size={14} className="text-white/30" />
        <div className="h-1.5 flex-1 animate-pulse rounded-full bg-white/10" />
      </div>
    );
  }

  if (!status || !status.is_initialized) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/50 transition hover:bg-white/10"
      >
        <Zap size={14} />
        Niezainicjalizowany
      </button>
    );
  }

  const pct =
    status.base_pool > 0
      ? Math.min(
          100,
          Math.max(0, (status.ap_available / status.base_pool) * 100),
        )
      : 0;
  const isLow = pct < 20;
  const fill = fillColor(pct);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 transition hover:bg-white/10"
      aria-label="Otwórz panel staminy"
    >
      <Zap
        size={14}
        className={
          isLow ? 'animate-stamina-pulse text-red-400' : 'text-amber-400'
        }
      />
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={`absolute inset-y-0 left-0 ${fill} transition-[width] duration-500 ease-out ${
            isLow ? 'animate-stamina-pulse' : ''
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-white/70">
        {formatHM(status.ap_available)}
        <span className="ml-1 text-white/30">/ {formatHM(status.base_pool)}</span>
      </span>
    </button>
  );
}
