import { Loader2, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { prometheusApi } from '../../api/prometheus';
import {
  MUSCLE_LABELS_PL,
  intensityLabel,
  type Exercise,
  type ExerciseSet,
  type GymSession,
  type MuscleKey,
  type RecoveryMap,
  type SessionExerciseInput,
} from '../../types/prometheus';
import SetEditor from './SetEditor';

interface SessionEditModalProps {
  session: GymSession;
  onClose: () => void;
  onSaved: () => void;
}

interface EditItem {
  exercise_name: string;
  sets: ExerciseSet[];
  muscle_load: RecoveryMap;
}

export default function SessionEditModal({
  session,
  onClose,
  onSaved,
}: SessionEditModalProps) {
  const [items, setItems] = useState<EditItem[]>(() =>
    session.exercises.map((ex) => ({
      exercise_name: ex.exercise_name,
      sets: ex.sets.map((s) => ({ ...s })),
      muscle_load: { ...ex.muscle_load },
    })),
  );
  const [label, setLabel] = useState(session.label);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    prometheusApi
      .getExercises()
      .then((rows) => {
        if (!cancelled) setExercises(rows);
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
    return exercises
      .filter((e) => e.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [exercises, search]);

  const addFromLibrary = (ex: Exercise) => {
    if (items.some((it) => it.exercise_name === ex.name)) return;
    setItems((prev) => [
      ...prev,
      {
        exercise_name: ex.name,
        sets: [{ reps: 0, kg: 0 }],
        muscle_load: { ...ex.muscle_load },
      },
    ]);
    setSearch('');
  };

  const updateSets = (idx: number, sets: ExerciseSet[]) => {
    setItems((prev) =>
      prev
        .map((it, i) => (i === idx ? { ...it, sets } : it))
        .filter((it) => it.sets.length > 0),
    );
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const validate = (): string | null => {
    if (items.length === 0) return 'Co najmniej jedno ćwiczenie wymagane';
    for (const it of items) {
      if (it.sets.length === 0) return 'Każde ćwiczenie potrzebuje serii';
      for (const s of it.sets) {
        if (!(s.reps > 0) || !(s.kg > 0)) return 'Uzupełnij wszystkie serie';
      }
    }
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
      const exercisesPayload: SessionExerciseInput[] = items.map((it) => ({
        exercise_name: it.exercise_name,
        sets: it.sets,
        muscle_load: it.muscle_load,
      }));
      await prometheusApi.updateSession(session.id, {
        label,
        exercises: exercisesPayload,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(10, 10, 15, 0.75)' }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border border-border bg-surface flex flex-col">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted">
              Edytuj trening
            </div>
            <h3 className="text-sm font-medium text-white font-mono">{session.date}</h3>
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
              Etykieta
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-orange"
            />
          </div>

          <div className="space-y-3">
            {items.map((it, idx) => (
              <div
                key={`${it.exercise_name}-${idx}`}
                className="rounded-md border border-border bg-surface2/60 p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-sm font-medium text-white">{it.exercise_name}</div>
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
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-muted hover:text-accent-red"
                    title="Usuń ćwiczenie"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <SetEditor
                  value={it.sets}
                  onChange={(next) => updateSets(idx, next)}
                />
              </div>
            ))}
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
