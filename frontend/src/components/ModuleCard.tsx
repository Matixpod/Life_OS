import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export type ModuleStatus = 'completed' | 'in_progress' | 'pending' | 'locked';

interface ModuleCardProps {
  icon: LucideIcon;
  name: string;
  metric: string;
  metricLabel?: string;
  status: ModuleStatus;
  to: string;
}

const STATUS_STYLES: Record<ModuleStatus, { dot: string; label: string; chip: string }> = {
  completed: { dot: 'bg-accent-emerald', label: 'Completed', chip: 'text-accent-emerald' },
  in_progress: { dot: 'bg-accent-blue', label: 'In Progress', chip: 'text-accent-blue' },
  pending: { dot: 'bg-accent-amber', label: 'Pending', chip: 'text-accent-amber' },
  locked: { dot: 'bg-muted', label: 'Locked', chip: 'text-muted' },
};

export default function ModuleCard({ icon: Icon, name, metric, metricLabel, status, to }: ModuleCardProps) {
  const navigate = useNavigate();
  const s = STATUS_STYLES[status];

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="group text-left rounded-xl bg-surface border border-border p-4 transition-all duration-150 hover:border-accent-blue/40 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="size-9 rounded-md bg-surface2 border border-border flex items-center justify-center group-hover:border-accent-blue/40 transition-colors">
          <Icon size={18} className="text-muted group-hover:text-white transition-colors" />
        </div>
        <span className={`flex items-center gap-1.5 text-[10px] tracking-widest uppercase ${s.chip}`}>
          <span className={`size-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      </div>
      <div className="text-xs text-muted mb-1">{name}</div>
      <div className="font-mono text-xl font-semibold">{metric}</div>
      {metricLabel && <div className="text-[11px] text-muted mt-0.5">{metricLabel}</div>}
    </button>
  );
}
