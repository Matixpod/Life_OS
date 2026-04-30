import { AlertTriangle, CalendarClock } from 'lucide-react';
import type { Project } from '../../types';

interface ProjectCardProps {
  project: Project;
  onResume?: (id: string) => void;
  onPause?: (id: string) => void;
  onDrop?: (id: string) => void;
}

const PRIORITY_BADGE: Record<1 | 2 | 3, string> = {
  1: 'bg-accent-red/15 text-accent-red border-accent-red/40',
  2: 'bg-accent-amber/15 text-accent-amber border-accent-amber/40',
  3: 'bg-surface2 text-muted border-border',
};

const STATUS_DOT: Record<Project['status'], string> = {
  active: 'bg-accent-emerald',
  paused: 'bg-accent-amber',
  completed: 'bg-accent-blue',
  dropped: 'bg-muted',
};

function relativeDays(dateStr: string | null): string {
  if (!dateStr) return 'No tasks yet';
  const d = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export default function ProjectCard({ project, onResume, onPause, onDrop }: ProjectCardProps) {
  const stalled = project.stalled_flag;
  const areaColor = project.life_area?.color ?? '#3B82F6';

  return (
    <div
      className={`rounded-xl bg-surface border p-5 transition-colors ${
        stalled ? 'border-accent-red/50' : 'border-border hover:border-accent-blue/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`size-2 rounded-full ${stalled ? 'bg-accent-red' : STATUS_DOT[project.status]}`}
            />
            <h3 className="font-medium truncate">{project.title}</h3>
          </div>
          {project.description && (
            <p className="text-xs text-muted line-clamp-2">{project.description}</p>
          )}
        </div>
        <span
          className={`text-[10px] tracking-widest uppercase rounded-full px-2 py-0.5 border font-mono shrink-0 ${PRIORITY_BADGE[project.priority]}`}
        >
          {`P${project.priority}`}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-muted mb-1.5">
          <span>Progress</span>
          <span className="font-mono">{project.progress_pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${project.progress_pct}%`, backgroundColor: areaColor }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted">
        <span>Last task: {relativeDays(project.last_task_date)}</span>
        {project.target_date && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock size={11} /> {project.target_date}
          </span>
        )}
      </div>

      {stalled && (
        <div className="mt-3 rounded-lg border border-accent-red/40 bg-accent-red/5 p-3">
          <div className="flex items-start gap-2 text-[12px] text-accent-red">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>Agent: this stalled. Decide now.</span>
          </div>
          <div className="mt-2 flex gap-2 flex-wrap">
            {onResume && (
              <button
                type="button"
                onClick={() => onResume(project.id)}
                className="text-[11px] px-2.5 py-1 rounded-md border border-border hover:border-accent-emerald/50 text-accent-emerald"
              >
                Resume
              </button>
            )}
            {onPause && (
              <button
                type="button"
                onClick={() => onPause(project.id)}
                className="text-[11px] px-2.5 py-1 rounded-md border border-border hover:border-accent-amber/50 text-accent-amber"
              >
                Pause
              </button>
            )}
            {onDrop && (
              <button
                type="button"
                onClick={() => onDrop(project.id)}
                className="text-[11px] px-2.5 py-1 rounded-md border border-border hover:border-accent-red/60 text-accent-red"
              >
                Drop
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
