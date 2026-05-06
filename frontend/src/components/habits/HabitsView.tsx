import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { habitsApi } from '../../api/habits';
import type { Habit, TaskCategory } from '../../types';
import { CATEGORIES, CATEGORY_META } from '../tasks/categories';
import HabitCard from './HabitCard';
import HabitForm from './HabitForm';

export default function HabitsView() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await habitsApi.list();
      setHabits(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const grouped = useMemo<Map<TaskCategory, Habit[]>>(() => {
    const m = new Map<TaskCategory, Habit[]>();
    for (const c of CATEGORIES) m.set(c, []);
    for (const h of habits) m.get(h.category)?.push(h);
    return m;
  }, [habits]);

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm((s) => !s);
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-accent-blue/15 border border-accent-blue/40 hover:bg-accent-blue/25 text-accent-blue px-3 py-1.5 text-sm font-medium"
        >
          <Plus size={14} /> Dodaj habit
        </button>
      </div>

      {(showForm || editing) && (
        <HabitForm
          initial={editing ?? undefined}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            void load();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {error && (
        <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
          {error}
        </div>
      )}

      {loading && habits.length === 0 ? (
        <div className="h-32 animate-pulse rounded-xl border border-border bg-surface" />
      ) : habits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 px-5 py-8 text-center text-sm text-muted">
          Brak aktywnych habitów. Dodaj pierwszy — np. „Bieg 5km” lub „Czytanie 30 min”.
        </div>
      ) : (
        CATEGORIES.map((c) => {
          const list = grouped.get(c) ?? [];
          if (list.length === 0) return null;
          const meta = CATEGORY_META[c];
          return (
            <section key={c} className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted">
                <meta.icon size={12} style={{ color: meta.color }} />
                <span>{meta.label}</span>
                <span className="font-mono">{list.length}</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {list.map((h) => (
                  <HabitCard
                    key={h.id}
                    habit={h}
                    onChanged={() => void load()}
                    onEdit={(habit) => {
                      setShowForm(false);
                      setEditing(habit);
                    }}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
