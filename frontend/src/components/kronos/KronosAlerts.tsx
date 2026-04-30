import { AlertTriangle } from 'lucide-react';
import type { KronosAlert } from '../../types';

interface Props {
  alerts: KronosAlert[];
}

export default function KronosAlerts({ alerts }: Props) {
  if (alerts.length === 0) return null;

  return (
    <div className="hidden md:block max-w-md">
      <div className="text-[11px] tracking-widest uppercase text-muted mb-1.5 inline-flex items-center gap-1">
        <AlertTriangle size={11} className="text-accent-amber" /> Alerts
      </div>
      <ul className="space-y-1 text-xs text-white/85">
        {alerts.slice(0, 3).map((a, i) => (
          <li key={i} className="truncate">
            · {a.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
