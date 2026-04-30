import { Clock, Lightbulb, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { DailyTask, Priority } from '../../types';

interface TaskCardProps {
  task: DailyTask;
  onComplete: (id: string) => void;
  onPostpone: (task: DailyTask) => void;
  onDelete: (id: string) => void;
}

const PRIORITY_BADGE: Record<Priority, string> = {
  1: 'bg-accent-red/15 text-accent-red border-accent-red/40',
  2: 'bg-accent-amber/15 text-accent-amber border-accent-amber/40',
  3: 'bg-surface2 text-muted border-border',
};

const PRIORITY_LABEL: Record<Priority, string> = {
  1: 'P1',
  2: 'P2',
  3: 'P3',
};

export default function TaskCard({ task, onComplete, onPostpone, onDelete }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const areaColor = task.life_area?.color ?? '#3B82F6';

  const accentStyle = {
    borderLeftColor: areaColor,
  };

  return (
    <div
      className={`group relative rounded-xl bg-surface border border-border overflow-hidden transition-all duration-200 ${
        task.completed ? 'opacity-60' : 'hover:border-accent-blue/40'
      }`}
      style={{ borderLeftWidth: 3, ...accentStyle }}
    >
      <div className="p-4 md:p-5 flex items-start gap-3">
        <button
          type="button"
          aria-label={task.completed ? 'Completed' : 'Mark complete'}
          onClick={(e) => {
            e.stopPropagation();
            if (!task.completed) onComplete(task.id);
          }}
          className={`mt-0.5 size-5 rounded-md border flex items-center justify-center transition-all ${
            task.completed
              ? 'bg-accent-emerald border-accent-emerald'
              : 'border-border hover:border-accent-emerald'
          }`}
        >
          {task.completed && (
            <svg viewBox="0 0 16 16" className="size-3 text-white" fill="none">
              <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left min-w-0"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] tracking-widest uppercase rounded-full px-2 py-0.5 border font-mono ${PRIORITY_BADGE[task.priority]}`}
            >
              {PRIORITY_LABEL[task.priority]}
            </span>
            {task.life_area && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                <span>{task.life_area.icon}</span>
                <span>{task.life_area.name}</span>
              </span>
            )}
            {task.postponed_count > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] tracking-widest uppercase rounded-full px-2 py-0.5 border border-accent-amber/40 text-accent-amber">
                <RotateCcw size={10} /> Postponed {task.postponed_count}×
              </span>
            )}
            {task.source === 'agent' && (
              <span className="text-[10px] tracking-widest uppercase rounded-full px-2 py-0.5 border border-accent-blue/40 text-accent-blue">
                Agent
              </span>
            )}
          </div>

          <div
            className={`mt-1.5 text-sm md:text-base font-medium ${task.completed ? 'line-through text-muted' : ''}`}
          >
            {task.title}
          </div>

          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted">
            {task.project && <span className="truncate">{task.project.title}</span>}
            {task.estimated_minutes != null && (
              <span className="inline-flex items-center gap-1 font-mono">
                <Clock size={11} /> {task.estimated_minutes}m
              </span>
            )}
          </div>

          {expanded && (task.agent_justification || task.notes) && (
            <div className="mt-3 space-y-2 text-[12px] text-muted border-t border-border pt-3 animate-fade-in">
              {task.agent_justification && (
                <p className="leading-relaxed">{task.agent_justification}</p>
              )}
              {task.notes && (
                <div className="flex items-start gap-1.5 text-accent-amber/90">
                  <Lightbulb size={13} className="mt-0.5 shrink-0" />
                  <span className="text-muted">{task.notes}</span>
                </div>
              )}
            </div>
          )}
        </button>

        {!task.completed && (
          <div className="relative">
            <button
              type="button"
              aria-label="Task actions"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="p-1 rounded text-muted hover:text-white hover:bg-surface2"
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-10 w-44 rounded-lg bg-surface2 border border-border shadow-lg py-1 animate-fade-in">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onPostpone(task);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface flex items-center gap-2"
                >
                  <RotateCcw size={13} /> Postpone
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(task.id);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-accent-red hover:bg-surface flex items-center gap-2"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
