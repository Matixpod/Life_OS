import { Clock, MoreHorizontal, Pencil, SkipForward, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Task } from '../../types';
import { CATEGORY_META, PRIORITY_BORDER, PRIORITY_LABEL } from './categories';

interface TaskCardProps {
  task: Task;
  onComplete: (task: Task) => void;
  onUncomplete?: (task: Task) => void;
  onSkip?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onEdit?: (task: Task) => void;
}

/**
 * Single task row — checkbox + title + meta + hover actions.
 *
 * Min height 44px (mobile tap-target requirement). The whole row sits
 * inside a left-border colored by priority. The category icon is rendered
 * as a small swatch using the shared `CATEGORY_META` palette.
 */
export default function TaskCard({
  task,
  onComplete,
  onUncomplete,
  onSkip,
  onDelete,
  onEdit,
}: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDone = task.status === 'done';
  const isSkipped = task.status === 'skipped';
  const meta = task.category ? CATEGORY_META[task.category] : null;
  const Icon = meta?.icon;

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent): void {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  return (
    <div
      className={`group relative rounded-lg bg-surface border border-border overflow-hidden transition-all duration-200 ${
        isDone || isSkipped ? 'opacity-55' : 'hover:border-accent-blue/40'
      }`}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: PRIORITY_BORDER[task.priority],
        minHeight: 44,
      }}
    >
      <div className="px-3 py-2.5 md:py-3 flex items-center gap-3">
        <button
          type="button"
          aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
          title={isDone ? 'Cofnij wykonanie' : 'Oznacz jako zrobione'}
          disabled={isSkipped || (isDone && !onUncomplete)}
          onClick={(e) => {
            e.stopPropagation();
            if (isSkipped) return;
            if (isDone) {
              onUncomplete?.(task);
            } else {
              onComplete(task);
            }
          }}
          className={`shrink-0 size-5 rounded-md border flex items-center justify-center transition-all ${
            isDone
              ? 'bg-accent-emerald border-accent-emerald scale-100 hover:bg-accent-emerald/70'
              : 'border-border hover:border-accent-emerald hover:scale-110'
          }`}
        >
          {isDone && (
            <svg viewBox="0 0 16 16" className="size-3 text-white" fill="none">
              <path
                d="M3 8.5L6.5 12L13 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        {Icon && meta && (
          <div
            className="shrink-0 size-6 rounded-md flex items-center justify-center"
            style={{
              backgroundColor: `${meta.color}25`,
              border: `1px solid ${meta.color}55`,
            }}
            title={meta.label}
          >
            <Icon size={13} style={{ color: meta.color }} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-medium truncate ${
              isDone ? 'line-through text-muted' : ''
            }`}
          >
            {task.title}
          </div>
          {task.notes && !isDone && (
            <div className="text-[11px] text-muted truncate mt-0.5">{task.notes}</div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className="font-mono text-[10px] tracking-widest rounded px-1.5 py-0.5 border"
            style={{
              color: PRIORITY_BORDER[task.priority],
              borderColor: `${PRIORITY_BORDER[task.priority]}55`,
            }}
            title={`${task.priority} priority`}
          >
            {PRIORITY_LABEL[task.priority]}
          </span>
          {task.estimated_minutes != null && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted font-mono">
              <Clock size={11} /> {task.estimated_minutes}m
            </span>
          )}
          {!isDone && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-label="Task actions"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                className="p-1 rounded text-muted hover:text-white hover:bg-surface2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-7 z-20 w-40 rounded-lg bg-surface2 border border-border shadow-lg py-1 animate-fade-in">
                  {onEdit && (
                    <MenuItem
                      onClick={() => {
                        setMenuOpen(false);
                        onEdit(task);
                      }}
                      icon={<Pencil size={13} />}
                      label="Edit"
                    />
                  )}
                  {onSkip && !isSkipped && (
                    <MenuItem
                      onClick={() => {
                        setMenuOpen(false);
                        onSkip(task);
                      }}
                      icon={<SkipForward size={13} />}
                      label="Skip"
                    />
                  )}
                  {onDelete && (
                    <MenuItem
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete(task);
                      }}
                      icon={<Trash2 size={13} />}
                      label="Delete"
                      tone="red"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  onClick,
  icon,
  label,
  tone,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone?: 'red';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm hover:bg-surface flex items-center gap-2 ${
        tone === 'red' ? 'text-accent-red' : ''
      }`}
    >
      {icon} {label}
    </button>
  );
}
