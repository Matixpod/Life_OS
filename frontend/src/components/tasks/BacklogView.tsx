import { CalendarPlus, Inbox, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTasks } from '../../hooks/useTasks';
import type { Task } from '../../types';
import { CATEGORY_META, PRIORITY_BORDER, PRIORITY_LABEL } from './categories';
import TaskEditModal from './TaskEditModal';

const PRIORITY_RANK: Record<Task['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export default function BacklogView() {
  const { backlog, refreshBacklog, updateTask, deleteTask, refreshToday } = useTasks();
  const [editing, setEditing] = useState<Task | null>(null);

  useEffect(() => {
    void refreshBacklog();
  }, [refreshBacklog]);

  const sorted = [...backlog].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      b.created_at.localeCompare(a.created_at),
  );

  async function scheduleToday(task: Task): Promise<void> {
    const isoToday = new Date().toISOString().slice(0, 10);
    await updateTask(task.id, { scheduled_date: isoToday });
    await Promise.all([refreshBacklog(), refreshToday()]);
  }

  async function handleDelete(task: Task): Promise<void> {
    if (!confirm(`Usunąć zadanie "${task.title}"?`)) return;
    await deleteTask(task.id);
    await refreshBacklog();
  }

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl bg-surface border border-border p-10 text-center animate-fade-in">
        <Inbox size={32} className="mx-auto text-muted mb-3" />
        <div className="text-sm text-muted">Backlog pusty — brawo!</div>
      </div>
    );
  }

  return (
    <>
      {editing && (
        <TaskEditModal
          task={editing}
          onSave={async (id, payload) => {
            await updateTask(id, payload);
            await refreshBacklog();
          }}
          onClose={() => setEditing(null)}
        />
      )}
      <ul className="space-y-1.5 animate-fade-in">
        {sorted.map((t) => {
          const meta = t.category ? CATEGORY_META[t.category] : null;
          const Icon = meta?.icon;
          return (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-lg bg-surface border border-border px-3 py-2"
              style={{ borderLeftWidth: 3, borderLeftColor: PRIORITY_BORDER[t.priority] }}
            >
              {Icon && meta && (
                <div
                  className="shrink-0 size-6 rounded-md flex items-center justify-center"
                  style={{
                    backgroundColor: `${meta.color}25`,
                    border: `1px solid ${meta.color}55`,
                  }}
                >
                  <Icon size={13} style={{ color: meta.color }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{t.title}</div>
                {t.notes && (
                  <div className="text-[11px] text-muted truncate">{t.notes}</div>
                )}
              </div>
              <span
                className="font-mono text-[10px] tracking-widest rounded px-1.5 py-0.5 border"
                style={{
                  color: PRIORITY_BORDER[t.priority],
                  borderColor: `${PRIORITY_BORDER[t.priority]}55`,
                }}
              >
                {PRIORITY_LABEL[t.priority]}
              </span>
              <button
                type="button"
                onClick={() => void scheduleToday(t)}
                className="inline-flex items-center gap-1 text-[11px] text-accent-blue hover:text-white"
              >
                <CalendarPlus size={12} /> Zaplanuj na dziś
              </button>
              <button
                type="button"
                onClick={() => setEditing(t)}
                aria-label="Edytuj zadanie"
                className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:text-accent-blue"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(t)}
                aria-label="Usuń zadanie"
                className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:text-accent-red"
              >
                <Trash2 size={13} />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
