import { Library, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { prometheusApi } from '../../api/prometheus';
import {
  MUSCLE_LABELS_PL,
  intensityLabel,
  type Exercise,
  type MuscleKey,
} from '../../types/prometheus';

export default function ExerciseLibrary() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    prometheusApi
      .getExercises()
      .then((rows) => {
        if (!cancelled) setExercises(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Błąd');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((e) => e.name.toLowerCase().includes(q));
  }, [exercises, search]);

  const remove = async (id: string) => {
    const previous = exercises;
    setExercises((prev) => prev.filter((e) => e.id !== id));
    setConfirmId(null);
    try {
      await prometheusApi.deleteExercise(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się usunąć');
      setExercises(previous);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <header className="flex items-center gap-2">
        <Library size={14} className="text-accent-orange" />
        <span className="text-[11px] uppercase tracking-widest text-muted">
          Biblioteka ćwiczeń
        </span>
        <span className="ml-auto text-[10px] text-muted font-mono">
          {filtered.length} / {exercises.length}
        </span>
      </header>

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj ćwiczenia..."
          className="w-full rounded-md border border-border bg-surface2 pl-8 pr-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent-orange"
        />
      </div>

      {error && (
        <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
          {error}
        </div>
      )}

      <div className="max-h-[60vh] overflow-y-auto space-y-2">
        {loading ? (
          <SkeletonCards />
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted py-3 text-center">
            {exercises.length === 0
              ? 'Brak ćwiczeń. Dodaj pierwsze ćwiczenie wpisując je tekstowo.'
              : 'Brak wyników dla wyszukiwania.'}
          </p>
        ) : (
          filtered.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              confirming={confirmId === ex.id}
              onAskDelete={() => setConfirmId(ex.id)}
              onConfirmDelete={() => remove(ex.id)}
              onCancelDelete={() => setConfirmId(null)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface CardProps {
  exercise: Exercise;
  confirming: boolean;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

function ExerciseCard({
  exercise,
  confirming,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
}: CardProps) {
  const top3 = Object.entries(exercise.muscle_load ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="rounded-md border border-border bg-surface2 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-medium text-white text-sm truncate">{exercise.name}</span>
        {confirming ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onConfirmDelete}
              className="rounded-md bg-accent-red px-2 py-1 text-[10px] font-medium text-white"
            >
              Usuń?
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="text-muted hover:text-white text-[10px] px-1"
            >
              Anuluj
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAskDelete}
            className="text-muted hover:text-accent-red"
            title="Usuń ćwiczenie"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {top3.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {top3.map(([muscle, intensity]) => {
            const label = intensityLabel(intensity);
            return (
              <span
                key={muscle}
                className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: `${label?.color ?? '#22C55E'}20`,
                  color: label?.color ?? '#22C55E',
                }}
              >
                {MUSCLE_LABELS_PL[muscle as MuscleKey] ?? muscle} · {Math.round(intensity * 100)}%
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-md border border-border bg-surface2 p-3 space-y-2">
          <div className="h-3 rounded bg-border/60 animate-pulse" style={{ width: '60%' }} />
          <div className="flex gap-1">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-3 w-16 rounded bg-border/40 animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
