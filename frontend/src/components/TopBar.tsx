import { Bell } from 'lucide-react';
import StaminaBar from './daily/StaminaBar';
import type { StaminaStatus } from '../types';
import { formatLongDate } from '../utils/date';

interface TopBarProps {
  userName?: string;
  stamina: StaminaStatus | null;
  staminaLoading: boolean;
  onOpenStamina: () => void;
}

export default function TopBar({
  userName,
  stamina,
  staminaLoading,
  onOpenStamina,
}: TopBarProps) {
  const initials = (userName ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('');

  return (
    <header className="border-b border-border bg-bg/80 backdrop-blur sticky top-0 z-10">
      <div className="flex items-center justify-between gap-4 px-4 md:px-6 py-3">
        <div className="min-w-0 text-sm">
          <div className="text-muted text-xs">Today</div>
          <div className="font-medium truncate">{formatLongDate()}</div>
        </div>
        <div className="hidden flex-1 justify-center md:flex">
          <StaminaBar
            status={stamina}
            isLoading={staminaLoading}
            onClick={onOpenStamina}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            aria-label="Notifications"
            className="size-9 rounded-md bg-surface text-muted hover:text-white border border-border flex items-center justify-center"
          >
            <Bell size={16} />
          </button>
          <div className="size-9 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-xs font-semibold">
            {initials.toUpperCase() || '?'}
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <StaminaBar
          status={stamina}
          isLoading={staminaLoading}
          onClick={onOpenStamina}
        />
      </div>
    </header>
  );
}
