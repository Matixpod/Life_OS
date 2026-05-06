import { Crown, Leaf, MoreHorizontal, Pencil, SkipForward, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Task } from '../../types';
import { CATEGORY_META, PRIORITY_BORDER, PRIORITY_LABEL } from './categories';

interface QuestCardProps {
  task: Task;
  /** Pre-computed XP reward for this task (rendered as a gold badge). */
  xpReward?: number;
  /** When true, the card draws a red tint to flag a stamina overflow. */
  isOverStamina?: boolean;
  /** When true, the card draws the diagonal-stripe decay overlay. */
  isDecayed?: boolean;
  onComplete: (task: Task) => void;
  onUncomplete?: (task: Task) => void;
  onSkip?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onEdit?: (task: Task) => void;
}

function playChime(freq: number) {
  try {
    const Ctx =
      (window as unknown as { AudioContext: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    osc.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    /* best-effort; sound requires user gesture on first call */
  }
}

/**
 * Quest-flavoured presentation of a `Task`. Rendered in the daily and
 * calendar views where stamina cost matters; the compact `TaskCard`
 * remains for list contexts (backlog, goals, project boards) where the
 * extra gameification chrome would be noise.
 *
 * Visual states (mutually compatible — they layer):
 *   - Main quest: gold ring + 👑 badge.
 *   - Regenerative: leaf icon, AP cost in emerald (e.g. `+20 AP`).
 *   - Over stamina: red tinted background, AP cost in red.
 *   - Decayed (overdue): diagonal-stripe overlay (`.quest-card--decayed`).
 *   - Completed: line-through title, muted colors.
 */
export default function QuestCard({
  task,
  xpReward,
  isOverStamina = false,
  isDecayed = false,
  onComplete,
  onUncomplete,
  onSkip,
  onDelete,
  onEdit,
}: QuestCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDone = task.status === 'done';
  const isSkipped = task.status === 'skipped';
  const meta = task.category ? CATEGORY_META[task.category] : null;
  const Icon = meta?.icon;
  const minutes = task.estimated_minutes ?? 0;
  const isRegen = Boolean(task.is_regenerative);
  const isMainQuest = Boolean(task.is_main_quest);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent): void {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const handleToggle = () => {
    if (isSkipped) return;
    if (isDone) {
      onUncomplete?.(task);
    } else {
      playChime(523.25); // C5 — task-complete chime
      onComplete(task);
    }
  };

  // ─── Card-level visual modifiers ────────────────────────────────────────
  const ring = isMainQuest
    ? 'ring-2 ring-amber-400/80 shadow-[0_0_24px_rgba(245,158,11,0.25)]'
    : '';
  const tint =
    !isDone && isOverStamina
      ? 'bg-red-500/10 border-red-500/40'
      : 'bg-surface border-border';
  const decayClass = isDecayed && !isDone ? 'quest-card--decayed' : '';
  const dimmed = isDone || isSkipped ? 'opacity-60' : '';

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border transition-all duration-200 ${tint} ${ring} ${decayClass} ${dimmed} ${
        !isDone && !isSkipped ? 'hover:border-accent-blue/40' : ''
      }`}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: meta?.color ?? PRIORITY_BORDER[task.priority],
      }}
    >
      {isMainQuest && (
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
          <Crown size={11} /> Główny Quest
        </div>
      )}

      <div className="flex items-start gap-3 px-4 py-3">
        <button
          type="button"
          aria-label={isDone ? 'Cofnij wykonanie' : 'Oznacz jako gotowe'}
          disabled={isSkipped}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-all ${
            isDone
              ? 'border-accent-emerald bg-accent-emerald hover:bg-accent-emerald/70'
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

        <div className="min-w-0 flex-1">
          <div
            className={`pr-12 font-sora text-sm font-medium ${
              isDone ? 'text-muted line-through' : 'text-white'
            }`}
          >
            {task.title}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {Icon && meta && (
              <span
                className="inline-flex items-center gap-1 font-mono"
                style={{ color: meta.color }}
              >
                <Icon size={11} /> {meta.label.toLowerCase()}
              </span>
            )}
            {minutes > 0 && (
              <span className="font-mono text-muted">
                ⏱ {minutes >= 60 ? `${Math.floor(minutes / 60)}h ` : ''}
                {minutes % 60}min
              </span>
            )}
            <span
              className="rounded px-1.5 py-0.5 font-mono tracking-widest"
              style={{
                color: PRIORITY_BORDER[task.priority],
                border: `1px solid ${PRIORITY_BORDER[task.priority]}55`,
              }}
              title={task.priority}
            >
              {PRIORITY_LABEL[task.priority]}
            </span>
            {isRegen && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                <Leaf size={11} /> regen
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            {minutes > 0 && (
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
                  isRegen
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : isOverStamina
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-amber-500/15 text-amber-300'
                }`}
              >
                {isRegen ? '+' : '-'}
                {minutes} AP
              </span>
            )}
            {xpReward !== undefined && xpReward > 0 && (
              <span className="rounded bg-amber-400/15 px-1.5 py-0.5 font-mono text-[11px] text-amber-300">
                +{xpReward} XP
              </span>
            )}
          </div>
        </div>

        {!isDone && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="Akcje zadania"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="rounded p-1 text-muted opacity-0 transition-opacity hover:bg-surface2 hover:text-white focus:opacity-100 group-hover:opacity-100"
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-20 w-40 animate-fade-in rounded-lg border border-border bg-surface2 py-1 shadow-lg">
                {onEdit && (
                  <MenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(task);
                    }}
                    icon={<Pencil size={13} />}
                    label="Edytuj"
                  />
                )}
                {onSkip && !isSkipped && (
                  <MenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      onSkip(task);
                    }}
                    icon={<SkipForward size={13} />}
                    label="Pomiń"
                  />
                )}
                {onDelete && (
                  <MenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(task);
                    }}
                    icon={<Trash2 size={13} />}
                    label="Usuń"
                    tone="red"
                  />
                )}
              </div>
            )}
          </div>
        )}
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
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface ${
        tone === 'red' ? 'text-accent-red' : ''
      }`}
    >
      {icon} {label}
    </button>
  );
}
