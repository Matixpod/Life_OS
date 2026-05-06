import { Check, Folder } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { habitsApi } from '../../api/habits';
import { projectsApi } from '../../api/projects';
import { tasksApi } from '../../api/tasks';
import type { CalendarItem as CalendarItemModel } from '../../types';
import { CATEGORY_COLORS } from '../../types';
import { PRIORITY_LABEL } from '../tasks/categories';

interface Props {
  item: CalendarItemModel;
  compact?: boolean;
  onToggled?: () => void;
}

export default function CalendarItem({ item, compact = false, onToggled }: Props) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const isDone = item.status === 'done';
  const color = item.category ? CATEGORY_COLORS[item.category].hex : '#475569';

  function handleClick(e: React.MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target.closest('button[data-checkbox]')) return;
    navigate(item.agent_route, { state: { focusItemId: item.id, itemType: item.type } });
  }

  async function handleToggle(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      if (item.type === 'task') {
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

  // 10-15% opacity of tag's color
  const bgOpacityHex = isDone ? 'transparent' : color + '1A';
  
  // Differentiate Habits (rounded-full) from Tasks (rounded-md)
  const radiusClass = item.type === 'habit_entry' ? 'rounded-[1.25rem]' : 'rounded-md';
  
  // Main Quest highlight
  const isMainQuest = item.is_main_quest;
  const questStyles = isMainQuest && !isDone
    ? 'border-accent-amber/50 shadow-[0_0_8px_rgba(245,158,11,0.25)]' 
    : 'border-border';

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleClick(e as unknown as React.MouseEvent);
      }}
      className={`group flex w-full items-center gap-2 border px-2 py-1.5 text-left text-xs transition-all duration-200 cursor-pointer ${radiusClass} ${questStyles} ${
        isDone ? 'opacity-40 hover:opacity-60' : 'hover:border-accent-blue/60'
      }`}
      style={{
        borderLeftColor: color,
        borderLeftWidth: 3,
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
        <span className="font-mono text-[10px] text-muted">{PRIORITY_LABEL[item.priority]}</span>
      )}
    </div>
  );
}
