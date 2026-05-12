import {
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { prometheusApi, workoutTemplatesApi } from '../../api/prometheus';
import {
  MUSCLE_LABELS_PL,
  intensityLabel,
  type Exercise,
  type ExerciseSet,
  type MuscleKey,
  type ParsedExercise,
  type RecoveryMap,
  type SessionExerciseInput,
  type WorkoutTemplate,
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

function summariseSets(sets: ExerciseSet[]): string {
  return sets.map((s) => `${s.reps}×${s.kg}kg`).join(', ');
}

export default function WorkoutBuilder({ onSessionSaved }: WorkoutBuilderProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<BuilderItem[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hrOpen, setHrOpen] = useState(false);
  const [duration, setDuration] = useState<string>('');
  const [avgHr, setAvgHr] = useState<string>('');
  const [textInputOpen, setTextInputOpen] = useState(false);
  const [parseText, setParseText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseFailures, setParseFailures] = useState<
    Array<{ line: string; error: string }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([prometheusApi.getExercises(), workoutTemplatesApi.list()])
      .then(([rows, tpls]) => {
        if (cancelled) return;
        setExercises(rows);
        setTemplates(tpls);
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

  const loadTemplate = async (templateId: string) => {
    if (!templateId) return;
    setLoadingTemplate(true);
    setError(null);
    try {
      const template = await workoutTemplatesApi.get(templateId);
      setName(template.name);
      const next: BuilderItem[] = template.exercises.map((ex) => {
        const libEntry = exercises.find(
          (e) => e.name.toLowerCase() === ex.exercise_name.toLowerCase(),
        );
        const baseSets =
          ex.last_sets && ex.last_sets.length > 0
            ? ex.last_sets
            : Array.from({ length: ex.target_sets || 3 }, () => ({ reps: 0, kg: 0 }));
        return {
          exercise_id: libEntry?.id ?? `tpl:${ex.id}`,
          exercise_name: ex.exercise_name,
          muscle_load: ex.muscle_load,
          sets: baseSets,
          last_sets_label:
            ex.last_sets && ex.last_sets.length > 0 ? summariseSets(ex.last_sets) : null,
        };
      });
      setItems(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się załadować planu');
    } finally {
      setLoadingTemplate(false);
    }
  };

  const parseAndAdd = async () => {
    const lines = parseText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setParsing(true);
    setError(null);
    setParseFailures([]);
    try {
      const results = await Promise.all(
        lines.map(async (line) => {
          try {
            const parsed = await prometheusApi.parseExercise(line);
            return { ok: true as const, line, parsed };
          } catch (e) {
            return {
              ok: false as const,
              line,
              error: e instanceof Error ? e.message : 'Błąd analizy',
            };
          }
        }),
      );

      const ok: ParsedExercise[] = [];
      const bad: Array<{ line: string; error: string }> = [];
      for (const r of results) {
        if (r.ok) ok.push(r.parsed);
        else bad.push({ line: r.line, error: r.error });
      }

      if (ok.length > 0) {
        setItems((prev) => {
          const next = [...prev];
          for (const p of ok) {
            const libEntry = exercises.find(
              (e) => e.name.toLowerCase() === p.exercise_name.toLowerCase(),
            );
            const id = libEntry?.id ?? `parsed:${p.exercise_name.toLowerCase()}`;
            if (next.some((it) => it.exercise_id === id)) continue;
            next.push({
              exercise_id: id,
              exercise_name: libEntry?.name ?? p.exercise_name,
              muscle_load: libEntry?.muscle_load ?? p.muscle_load,
              sets: p.sets.length > 0 ? p.sets : [{ reps: 0, kg: 0 }],
              last_sets_label: null,
            });
          }
          return next;
        });
        setParseText('');
      }
      setParseFailures(bad);
      if (ok.length === 0 && bad.length > 0) {
        setError('Żadna linia nie została poprawnie zinterpretowana.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd analizy');
    } finally {
      setParsing(false);
    }
  };

  const onParseKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void parseAndAdd();
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
    if (!name.trim()) return 'Nazwa treningu jest wymagana';
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
        label: name.trim(),
        exercises: payload,
        save_as_template: true,
        ...(Number(duration) > 0 ? { duration_min: Number(duration) } : {}),
        ...(Number(avgHr) > 0 ? { avg_hr: Number(avgHr) } : {}),
      });
      setItems([]);
      setName('');
      setSearch('');
      setDuration('');
      setAvgHr('');
      // Refresh templates list so the newly saved one shows up next time.
      try {
        const tpls = await workoutTemplatesApi.list();
        setTemplates(tpls);
      } catch {
        /* non-fatal */
      }
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
        <label className="block text-[11px] uppercase tracking-widest text-muted mb-1.5">
          Nazwa treningu <span className="text-accent-red">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="np. Push A"
          className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent-orange"
        />
      </div>

      {templates.length > 0 && (
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-muted mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              <FolderOpen size={11} /> Załaduj zapisany trening
            </span>
          </label>
          <select
            value=""
            onChange={(e) => loadTemplate(e.target.value)}
            disabled={loadingTemplate}
            className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-orange disabled:opacity-50"
          >
            <option value="">— wybierz —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.exercises.length} ćw.)
              </option>
            ))}
          </select>
        </div>
      )}

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
        disabled={saving || items.length === 0 || !name.trim()}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent-orange px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? 'Zapisuję...' : 'Zapisz trening'}
      </button>
    </div>
  );
}
