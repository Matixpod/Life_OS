import { ChevronDown, ChevronUp, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { prometheusApi } from '../../api/prometheus';
import {
  MUSCLE_LABELS_PL,
  intensityLabel,
  type Exercise,
  type ExerciseSet,
  type MuscleKey,
  type RecoveryMap,
  type SessionExerciseInput,
} from '../../types/prometheus';
import SetEditor from './SetEditor';

interface WorkoutBuilderProps {
  onSessionSaved: () => void;
}

interface BuilderItem {
  exercise_id: string;
  exercise_name: string;
  muscle_load: RecoveryMap;
  sets: ExerciseSet[];
  last_sets_label: string | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function deriveLabel(items: BuilderItem[]): string {
  if (items.length === 0) return 'Trening';
  if (items.length === 1) return items[0].exercise_name;
  if (items.length === 2) return `${items[0].exercise_name} + ${items[1].exercise_name}`;
  return `${items[0].exercise_name} + ${items[1].exercise_name} +${items.length - 2}`;
}

function summariseSets(sets: ExerciseSet[]): string {
  return sets.map((s) => `${s.reps}×${s.kg}kg`).join(', ');
}

export default function WorkoutBuilder({ onSessionSaved }: WorkoutBuilderProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<BuilderItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hrOpen, setHrOpen] = useState(false);
  const [duration, setDuration] = useState<string>('');
  const [avgHr, setAvgHr] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    prometheusApi
      .getExercises()
      .then((rows) => {
        if (!cancelled) setExercises(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Błąd biblioteki');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises.slice(0, 10);
    return exercises.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 12);
  }, [exercises, search]);

  const addExercise = async (ex: Exercise) => {
    if (items.some((it) => it.exercise_id === ex.id)) return;
    const placeholder: BuilderItem = {
      exercise_id: ex.id,
      exercise_name: ex.name,
      muscle_load: ex.muscle_load,
      sets: [{ reps: 0, kg: 0 }],
      last_sets_label: null,
    };
    setItems((prev) => [...prev, placeholder]);

    try {
      const { sets } = await prometheusApi.getLastSets(ex.id);
      if (sets.length === 0) return;
      setItems((prev) =>
        prev.map((it) =>
          it.exercise_id === ex.id
            ? { ...it, sets, last_sets_label: summariseSets(sets) }
            : it,
        ),
      );
    } catch {
      // non-fatal; keep placeholder sets
    }
  };

  const updateSets = (exerciseId: string, sets: ExerciseSet[]) => {
    setItems((prev) =>
      prev
        .map((it) => (it.exercise_id === exerciseId ? { ...it, sets } : it))
        .filter((it) => it.sets.length > 0),
    );
  };

  const removeItem = (exerciseId: string) => {
    setItems((prev) => prev.filter((it) => it.exercise_id !== exerciseId));
  };

  const validate = (): string | null => {
    if (items.length === 0) return 'Dodaj choć jedno ćwiczenie';
    for (const it of items) {
      if (it.sets.length === 0) return 'Każde ćwiczenie potrzebuje co najmniej jednej serii';
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
      const payload: SessionExerciseInput[] = items.map((it) => ({
        exercise_name: it.exercise_name,
        sets: it.sets,
        muscle_load: it.muscle_load,
      }));
      await prometheusApi.createSession({
        date: todayIso(),
        label: deriveLabel(items),
        exercises: payload,
        ...(Number(duration) > 0 ? { duration_min: Number(duration) } : {}),
        ...(Number(avgHr) > 0 ? { avg_hr: Number(avgHr) } : {}),
      });
      setItems([]);
      setSearch('');
      setDuration('');
      setAvgHr('');
      onSessionSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-muted mb-2">
          Wybierz z biblioteki
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
        <div className="max-h-44 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <p className="text-[11px] text-muted py-2 text-center">
              {exercises.length === 0
                ? 'Biblioteka pusta — najpierw dodaj ćwiczenia tekstowo.'
                : 'Brak wyników.'}
            </p>
          ) : (
            filtered.map((ex) => {
              const added = items.some((it) => it.exercise_id === ex.id);
              return (
                <button
                  key={ex.id}
                  type="button"
                  disabled={added}
                  onClick={() => addExercise(ex)}
                  className="flex w-full items-center justify-between rounded-md border border-border bg-surface2 px-3 py-1.5 text-left text-xs hover:border-accent-orange disabled:opacity-50 disabled:hover:border-border"
                >
                  <span className="text-white truncate">{ex.name}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                    {added ? 'dodane' : <><Plus size={11} /> Dodaj</>}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-widest text-muted">
            Trening na dziś
          </span>
          <span className="text-[10px] font-mono text-muted">
            {items.length} ćw.
          </span>
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-muted text-center py-4">
            Wybierz ćwiczenia z listy powyżej.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div
                key={it.exercise_id}
                className="rounded-md border border-border bg-surface2/60 p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-sm font-medium text-white">{it.exercise_name}</div>
                    {it.last_sets_label && (
                      <div className="text-[10px] text-muted font-mono">
                        ↩ ostatnie: {it.last_sets_label}
                      </div>
                    )}
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
                    onClick={() => removeItem(it.exercise_id)}
                    className="text-muted hover:text-accent-red"
                    title="Usuń ćwiczenie"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <SetEditor
                  value={it.sets}
                  onChange={(next) => updateSets(it.exercise_id, next)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-surface2/40">
        <button
          type="button"
          onClick={() => setHrOpen((v) => !v)}
          aria-expanded={hrOpen}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] uppercase tracking-widest text-muted hover:text-white"
        >
          <span>⏱ Czas i tętno (opcjonalne)</span>
          {hrOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {hrOpen && (
          <div className="space-y-2 border-t border-border px-3 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-muted">Czas treningu</span>
                  <span className="text-[10px] text-muted">min</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-surface2 px-3 py-2 font-mono text-sm text-white focus:border-accent-orange focus:outline-none"
                />
              </div>
              <div>
                <label className="flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-muted">Średnie tętno</span>
                  <span className="text-[10px] text-muted">bpm</span>
                </label>
                <input
                  type="number"
                  min={30}
                  max={240}
                  value={avgHr}
                  onChange={(e) => setAvgHr(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-surface2 px-3 py-2 font-mono text-sm text-white focus:border-accent-orange focus:outline-none"
                />
              </div>
            </div>
            <div className="text-[10px] text-muted">
              💡 Czas wymagany do obliczeń kalorii. Tętno zwiększa dokładność o ~30%.
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving || items.length === 0}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent-orange px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? 'Zapisuję...' : 'Zapisz trening'}
      </button>
    </div>
  );
}
