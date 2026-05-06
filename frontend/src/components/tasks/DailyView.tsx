import { AlertTriangle, CalendarPlus, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { tasksApi } from '../../api/tasks';
import { useStamina } from '../../hooks/useStamina';
import { useTasks } from '../../hooks/useTasks';
import type { Task, TaskBonusReason, TaskCategory } from '../../types';
import { CATEGORIES, CATEGORY_META } from './categories';
import { useCategoryFilter } from '../../hooks/useCategoryFilter';
import CategoryFilter from './CategoryFilter';
import QuestCard from './QuestCard';
import TaskEditModal from './TaskEditModal';
import XPPopup from './XPPopup';
import { emitCombatText } from '../ui/floatingCombatTextBus';

interface PopupState {
  taskId: string;
  xp: number;
  reasons: TaskBonusReason[];
}

/**
 * Today's view — overdue alert strip → category filter → grouped task lists.
 * Empty categories (after filtering) collapse; if every category is empty
 * the user sees a single "Add your first task" hint.
 */
export default function DailyView() {
  const {
    today,
    loading,
    refreshToday,
    completeTask,
    uncompleteTask,
    skipTask,
    deleteTask,
    updateTask,
  } = useTasks();
  const [filter, setFilter] = useCategoryFilter();
  const [overdue, setOverdue] = useState<Task[]>([]);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const { status: stamina, refresh: refreshStamina } = useStamina();

  // Overdue: any todo task with scheduled_date < today. Fetched separately
  // because /api/v1/tasks/today only returns rows for today's date.
  useEffect(() => {
    let cancelled = false;
    const isoToday = new Date().toISOString().slice(0, 10);
    tasksApi
      .listTasks({ status: 'todo', limit: 200 })
      .then((rows) => {
        if (cancelled) return;
        setOverdue(
          rows.filter((t) => t.scheduled_date != null && t.scheduled_date < isoToday),
        );
      })
      .catch(() => {
        /* swallowed — overdue strip is a best-effort UX */
      });
    return () => {
      cancelled = true;
    };
  }, [today]);

  const grouped = useMemo(() => {
    const out: Record<TaskCategory, Task[]> = {
      health: [],
      work: [],
      knowledge: [],
      relationships: [],
      other: [],
    };
    if (!today) return out;
    for (const t of today.tasks) {
      if (filter !== 'all' && t.category !== filter) continue;
      if (!t.category) continue;
      out[t.category].push(t);
    }
    return out;
  }, [today, filter]);

  async function handleComplete(task: Task): Promise<void> {
    try {
      const result = await completeTask(task.id);
      setPopup({ taskId: task.id, xp: result.xp_earned, reasons: result.bonus_reasons });
      emitCombatText(`+${result.xp_earned} XP`, 'xp');
      const minutes = task.estimated_minutes ?? 0;
      if (minutes > 0) {
        emitCombatText(
          task.is_regenerative ? `+${minutes} AP` : `-${minutes} AP`,
          task.is_regenerative ? 'ap' : 'ap-cost',
        );
      }
      window.setTimeout(() => {
        setPopup((p) => (p?.taskId === task.id ? null : p));
      }, 1500);
      // Completing a task drains (or restores) stamina — keep the bar in sync.
      void refreshStamina();
    } catch {
      /* refreshToday already fired in hook */
    }
  }

  // Stamina overflow: how many minutes the planned (non-regenerative,
  // non-completed) tasks exceed the day's pool by. Negative when within
  // budget — the banner only renders when this is > 0.
  const overStamina = useMemo(() => {
    if (!stamina?.is_initialized || !today) return { overMinutes: 0, overflowIds: new Set<string>() };
    let cumulative = 0;
    const overflowIds = new Set<string>();
    const ordered = [...today.tasks].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    for (const t of ordered) {
      if (t.is_regenerative) continue;
      if (t.status === 'done' || t.status === 'skipped') continue;
      const minutes = t.estimated_minutes ?? 0;
      cumulative += minutes;
      if (cumulative > stamina.base_pool) overflowIds.add(t.id);
    }
    return {
      overMinutes: Math.max(0, cumulative - stamina.base_pool),
      overflowIds,
    };
  }, [stamina, today]);

  async function moveOverdueToToday(task: Task): Promise<void> {
    const isoToday = new Date().toISOString().slice(0, 10);
    await updateTask(task.id, { scheduled_date: isoToday });
    setOverdue((prev) => prev.filter((t) => t.id !== task.id));
    void refreshToday();
  }

  if (loading && !today) return <DailyViewSkeleton />;

  const totalVisible = Object.values(grouped).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <div className="space-y-4 animate-fade-in">
      {overdue.length > 0 && (
        <div className="rounded-xl border border-accent-red/40 bg-accent-red/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-accent-red text-xs uppercase tracking-widest">
            <AlertTriangle size={14} /> Zaległe ({overdue.length})
          </div>
          <ul className="space-y-1.5">
            {overdue.slice(0, 5).map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate">{t.title}</div>
                  <div className="text-[11px] text-muted font-mono">{t.scheduled_date}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void moveOverdueToToday(t)}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] text-accent-blue hover:text-white"
                >
                  <CalendarPlus size={12} /> Przenieś na dziś
                </button>
              </li>
            ))}
            {overdue.length > 5 && (
              <li className="text-[11px] text-muted px-3">+ {overdue.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      {overStamina.overMinutes > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
          <Zap size={14} />
          Plan dnia przekracza Staminę o{' '}
          <span className="font-mono">{overStamina.overMinutes} min</span>. Rozważ
          przeniesienie nadmiarowych zadań lub dodanie boostów.
        </div>
      )}

      <CategoryFilter value={filter} onChange={setFilter} />

      {totalVisible === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 p-6 text-center text-sm text-muted">
          Brak zadań — dodaj pierwsze
        </div>
      )}

      {editing && (
        <TaskEditModal
          task={editing}
          onSave={async (id, payload) => {
            await updateTask(id, payload);
            void refreshToday();
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {CATEGORIES.map((cat) => {
        const tasks = grouped[cat];
        if (tasks.length === 0 && filter !== cat) return null;
        const meta = CATEGORY_META[cat];
        const Icon = meta.icon;
        const summary = today?.by_category[cat];
        const xp = summary?.xp_earned ?? 0;

        return (
          <section key={cat} className="space-y-2">
            <header className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2">
                <div
                  className="size-6 rounded-md flex items-center justify-center"
                  style={{
                    backgroundColor: `${meta.color}25`,
                    border: `1px solid ${meta.color}55`,
                  }}
                >
                  <Icon size={13} style={{ color: meta.color }} />
                </div>
                <span className="text-sm font-medium">{meta.label}</span>
                <span className="text-[11px] text-muted">
                  {summary?.completed ?? 0}/{summary?.planned ?? tasks.length}
                </span>
              </div>
              {xp > 0 && (
                <span className="font-mono text-[11px] text-accent-emerald">
                  +{xp} XP
                </span>
              )}
            </header>

            {tasks.length === 0 ? (
              <div className="text-[11px] text-muted px-2 py-2">
                Brak zadań — dodaj pierwsze
              </div>
            ) : (
              <ul className="space-y-1.5">
                {tasks.map((t) => (
                  <li key={t.id} className="relative">
                    {popup?.taskId === t.id && (
                      <XPPopup xp={popup.xp} bonusReasons={popup.reasons} />
                    )}
                    <QuestCard
                      task={t}
                      isOverStamina={overStamina.overflowIds.has(t.id)}
                      onComplete={handleComplete}
                      onUncomplete={(task) => {
                        void uncompleteTask(task.id).catch(() => {});
                        void refreshStamina();
                      }}
                      onSkip={(task) => {
                        void skipTask(task.id).catch(() => {});
                        void refreshStamina();
                      }}
                      onDelete={(task) => {
                        void deleteTask(task.id).catch(() => {});
                        void refreshStamina();
                      }}
                      onEdit={(task) => setEditing(task)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function DailyViewSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-14 rounded-lg bg-surface border border-border animate-pulse"
        />
      ))}
    </div>
  );
}
