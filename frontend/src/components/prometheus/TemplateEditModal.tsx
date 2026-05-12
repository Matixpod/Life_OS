import { ArrowDown, ArrowUp, Loader2, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { prometheusApi, workoutTemplatesApi } from '../../api/prometheus';
import {
  MUSCLE_LABELS_PL,
  intensityLabel,
  type Exercise,
  type MuscleKey,
  type RecoveryMap,
  type WorkoutTemplate,
  type WorkoutTemplateExerciseInput,
} from '../../types/prometheus';

interface TemplateEditModalProps {
  template: WorkoutTemplate;
  onClose: () => void;
  onSaved: () => void;
}

interface EditExercise {
  exercise_name: string;
  target_sets: number;
  muscle_load: RecoveryMap;
}

export default function TemplateEditModal({
  template,
  onClose,
  onSaved,
}: TemplateEditModalProps) {
  const [name, setName] = useState(template.name);
  const [items, setItems] = useState<EditExercise[]>(() =>
    template.exercises
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((ex) => ({
        exercise_name: ex.exercise_name,
        target_sets: ex.target_sets || 3,
        muscle_load: { ...ex.muscle_load },
      })),
  );
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    prometheusApi
      .getExercises()
      .then((rows) => {
        if (!cancelled) setLibrary(rows);
      })
      .catch(() => {
        /* non-fatal */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as Exercise[];
    return library
      .filter((e) => e.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [library, search]);

  const addFromLibrary = (ex: Exercise) => {
    if (items.some((it) => it.exercise_name.toLowerCase() === ex.name.toLowerCase())) {
      setSearch('');
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        exercise_name: ex.name,
        target_sets: 3,
        muscle_load: { ...ex.muscle_load },
      },
    ]);
    setSearch('');
  };

  const move = (idx: number, delta: number) => {
    setItems((prev) => {
      const next = prev.slice();
      const target = idx + delta;
      if (target < 0 || target >= next.length) return prev;
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const setTargetSets = (idx: number, value: number) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, target_sets: Math.max(1, Math.min(50, value)) } : it,
      ),
    );
  };

  const remove = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Nazwa jest wymagana';
    if (items.length === 0) return 'Dodaj co najmniej jedno ćwiczenie';
    return null;
  };

  const save = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const exercises: WorkoutTemplateExerciseInput[] = items.map((it, idx) => ({
        exercise_name: it.exercise_name,
        order_index: idx,
        target_sets: it.target_sets,
        muscle_load: it.muscle_load,
      }));
      await workoutTemplatesApi.update(template.id, {
        name: name.trim(),
        exercises,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(10, 10, 15, 0.75)' }}
    >
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-hidden rounded-xl border border-border bg-surface flex flex-col">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted">
              Edytuj plan
            </div>
            <h3 className="text-sm font-medium text-white">{template.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-white"
            aria-label="Zamknij"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted block mb-1">
              Nazwa
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-orange"
            />
          </div>

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-widest text-muted">
              Ćwiczenia ({items.length})
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">
                Brak ćwiczeń. Dodaj z biblioteki poniżej.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((it, idx) => (
                  <li
                    key={`${it.exercise_name}-${idx}`}
                    className="rounded-md border border-border bg-surface2/60 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => move(idx, -1)}
                          className="text-muted hover:text-white disabled:opacity-30"
                          title="W górę"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === items.length - 1}
                          onClick={() => move(idx, 1)}
                          className="text-muted hover:text-white disabled:opacity-30"
                          title="W dół"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">
                          {it.exercise_name}
                        </div>
                        {Object.keys(it.muscle_load).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {Object.entries(it.muscle_load)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 3)
                              .map(([m, v]) => {
                                const label = intensityLabel(v);
                                return (
                                  <span
                                    key={m}
                                    className="rounded px-1.5 py-0.5 text-[9px]"
                                    style={{
                                      backgroundColor: `${label?.color ?? '#22C55E'}18`,
                                      color: label?.color ?? '#22C55E',
                                    }}
                                  >
                                    {MUSCLE_LABELS_PL[m as MuscleKey] ?? m}
                                  </span>
                                );
                              })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted">
                          Serie
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={it.target_sets}
                            onChange={(e) =>
                              setTargetSets(idx, Number(e.target.value) || 1)
                            }
                            className="w-12 rounded border border-border bg-surface2 px-1.5 py-0.5 font-mono text-xs text-white text-center focus:outline-none focus:border-accent-orange"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => remove(idx)}
                          className="text-muted hover:text-accent-red"
                          title="Usuń"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted mb-1">
              Dodaj z biblioteki
            </div>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Szukaj ćwiczenia..."
                className="w-full rounded-md border border-border bg-surface2 pl-8 pr-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent-orange"
              />
            </div>
            {filtered.length > 0 && (
              <div className="space-y-1">
                {filtered.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => addFromLibrary(ex)}
                    className="flex w-full items-center justify-between rounded-md border border-border bg-surface2 px-3 py-1.5 text-left text-xs hover:border-accent-orange"
                  >
                    <span className="text-white truncate">{ex.name}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                      <Plus size={11} /> Dodaj
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
              {error}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-xs text-white hover:border-accent-orange disabled:opacity-50"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-orange px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Zapisuję...' : 'Zapisz zmiany'}
          </button>
        </footer>
      </div>
    </div>
  );
}
