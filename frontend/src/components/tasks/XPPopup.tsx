import { Zap } from 'lucide-react';
import type { TaskBonusReason } from '../../types';

const BONUS_LABEL: Record<TaskBonusReason, string> = {
  early_bird: 'Early bird',
  on_schedule: 'On schedule',
  streak_bonus: 'Streak',
};

interface XPPopupProps {
  xp: number;
  bonusReasons: TaskBonusReason[];
}

/**
 * Floating XP indicator that mounts on task completion and unmounts after
 * 1.5s (animation `xp-float` defined in `index.css`). The host (TaskCard
 * or DailyView) is responsible for removing it from state.
 *
 * Positioned absolutely with `left: 50%` + transform centering — pair with
 * a `relative` parent.
 */
export default function XPPopup({ xp, bonusReasons }: XPPopupProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute left-1/2 -top-2 z-30 animate-xp-float"
      style={{ transform: 'translate(-50%, 0)' }}
    >
      <div className="rounded-full bg-accent-emerald/15 border border-accent-emerald/40 px-3 py-1 flex items-center gap-1.5 shadow-lg">
        <Zap size={13} className="text-accent-emerald" />
        <span className="font-mono text-sm text-accent-emerald">+{xp} XP</span>
        {bonusReasons.length > 0 && (
          <span className="text-[10px] text-muted ml-1">
            {bonusReasons.map((r) => BONUS_LABEL[r]).join(' · ')}
          </span>
        )}
      </div>
    </div>
  );
}
