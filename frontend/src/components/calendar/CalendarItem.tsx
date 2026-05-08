import { Check, Folder, Trash2 } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { habitsApi } from '../../api/habits';
import { projectsApi } from '../../api/projects';
import { tasksApi } from '../../api/tasks';
import type { CalendarItem as CalendarItemModel } from '../../types';
import { CATEGORY_COLORS } from '../../types';
import WorkoutCompleteModal from '../prometheus/WorkoutCompleteModal';
import { PRIORITY_LABEL } from '../tasks/categories';

interface Props {
  item: CalendarItemModel;
  compact?: boolean;
  onToggled?: () => void;
}

export default function CalendarItem({ item, compact = false, onToggled }: Props) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const isDone = item.status === 'done';
  const isWorkout = item.type === 'workout';
  const color = item.category ? CATEGORY_COLORS[item.category].hex : '#475569';

  function handleClick(e: React.MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target.closest('button[data-checkbox]') || target.closest('button[data-delete]')) return;
    navigate(item.agent_route, { state: { focusItemId: item.id, itemType: item.type } });
  }

  async function completeWorkoutWithMeta(
    meta?: { duration_min?: number; avg_hr?: number },
  ): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await tasksApi.completeTask(item.id, meta);
      onToggled?.();
    } catch (e) {
      console.error('Failed to complete workout', e);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(): Promise<void> {
    if (busy) return;
    if (isWorkout && !isDone) {
      setShowWorkoutModal(true);
      return;
    }
    setBusy(true);
    try {
      if (item.type === 'task' || item.type === 'workout') {
        if (isDone) {
          await tasksApi.uncompleteTask(item.id);
        } else {
          await tasksApi.completeTask(item.id);
        }
      } else if (item.type === 'habit_entry') {
        if (item.habit_id) {
          if (isDone) {
            await habitsApi.uncompleteEntry(item.id);
          } else {
            await habitsApi.completeEntry(item.id);
          }
        }
      } else if (item.type === 'project_task') {
        if (isDone) {
          await projectsApi.updateTask(item.id, { status: 'todo' });
        } else {
          await projectsApi.completeTask(item.id);
        }
      }
      onToggled?.();
    } catch (e) {
      console.error('Failed to toggle item', e);
    } finally {
      setBusy(false);
    }
  }

  const canDelete =
    item.type === 'task' || item.type === 'project_task' || item.type === 'workout';

  async function handleDelete(e: React.MouseEvent): Promise<void> {
    e.stopPropagation();
    if (busy || !canDelete) return;
    if (!window.confirm(`Usunąć „${item.title}"?`)) return;
    setBusy(true);
    try {
      if (item.type === 'task' || item.type === 'workout') {
        await tasksApi.deleteTask(item.id);
      } else if (item.type === 'project_task') {
        await projectsApi.deleteTask(item.id);
      }
      onToggled?.();
    } catch (err) {
      console.error('Failed to delete item', err);
    } finally {
      setBusy(false);
    }
  }

  const bgOpacityHex = isDone ? 'transparent' : color + '1A';

  const isMainQuest = item.is_main_quest;
  const questGlow = isMainQuest && !isDone
    ? 'shadow-[0_0_10px_rgba(245,158,11,0.25)]'
    : '';

  const padding = compact ? 'px-3 py-2' : 'px-4 py-3';
  const textSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleClick(e as unknown as React.MouseEvent);
      }}
      className={`group flex w-full items-center gap-3 rounded-lg ${padding} ${textSize} text-left transition-all duration-200 cursor-pointer ${questGlow} ${
        isDone ? 'opacity-40 hover:opacity-60' : 'hover:bg-opacity-80'
      }`}
      style={{
        borderLeftColor: color,
        borderLeftWidth: 3,
        borderLeftStyle: 'solid',
        backgroundColor: bgOpacityHex,
      }}
      aria-label={`${item.type}: ${item.title}`}
    >
      <button
        data-checkbox="true"
        type="button"
        onClick={handleToggle}
        disabled={busy}
        className="shrink-0 flex items-center justify-center size-4 rounded-sm border transition-all"
        style={{
          backgroundColor: isDone ? color : 'transparent',
          borderColor: isDone ? color : '#475569',
        }}
        aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
      >
        {isDone && <Check size={12} strokeWidth={3} className="text-white" />}
      </button>

      <div className={`flex-1 min-w-0 flex flex-col justify-center ${isDone ? 'opacity-70' : ''}`}>
        {item.type === 'project_task' && item.project_title && (
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted mb-0.5">
            <Folder size={9} />
            <span className="truncate">{item.project_title}</span>
          </div>
        )}
        <span className={`truncate ${isDone ? 'line-through text-muted' : ''}`}>
          {item.title}
        </span>
      </div>
      {!compact && (
        <span className="shrink-0 inline-flex items-center justify-center rounded-md bg-surface2 px-2 py-1 font-mono text-[10px] text-muted">
          {PRIORITY_LABEL[item.priority]}
        </span>
      )}
      {canDelete && (
        <button
          data-delete="true"
          type="button"
          onClick={handleDelete}
          disabled={busy}
          aria-label="Usuń"
          className="shrink-0 inline-flex items-center justify-center size-6 rounded-md text-muted opacity-0 transition-opacity hover:text-accent-red focus:opacity-100 group-hover:opacity-100 disabled:opacity-30"
        >
          <Trash2 size={13} />
        </button>
      )}
      {showWorkoutModal && (
        <WorkoutCompleteModal
          taskTitle={item.title}
          estimatedMinutes={60}
          onConfirm={(duration, hr) => {
            setShowWorkoutModal(false);
            void completeWorkoutWithMeta({
              duration_min: duration,
              ...(hr != null ? { avg_hr: hr } : {}),
            });
          }}
          onSkip={() => {
            setShowWorkoutModal(false);
            void completeWorkoutWithMeta();
          }}
          onCancel={() => setShowWorkoutModal(false)}
        />
      )}
    </div>
  );
}
