import {
  CalendarPlus,
  Dumbbell,
  Loader2,
  Pencil,
  Play,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { workoutTemplatesApi } from '../../api/prometheus';
import {
  MUSCLE_LABELS_PL,
  intensityLabel,
  type MuscleKey,
  type RecoveryMap,
  type WorkoutTemplate,
} from '../../types/prometheus';
import TemplateEditModal from './TemplateEditModal';
import TemplateSchedulePopover from './TemplateSchedulePopover';

interface WorkoutTemplatesLibraryProps {
  onStartTraining?: () => void;
}

function topMuscles(template: WorkoutTemplate): Array<[MuscleKey, number]> {
  const aggregated: RecoveryMap = {};
  for (const ex of template.exercises) {
    for (const [key, value] of Object.entries(ex.muscle_load) as [
      MuscleKey,
      number,
    ][]) {
      const current = aggregated[key] ?? 0;
      if (value > current) aggregated[key] = value;
    }
  }
  return (Object.entries(aggregated) as [MuscleKey, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function WorkoutTemplatesLibrary({
  onStartTraining,
}: WorkoutTemplatesLibraryProps) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null);
  const [scheduling, setScheduling] = useState<WorkoutTemplate | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await workoutTemplatesApi.list();
      setTemplates(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się załadować planów');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, search]);

  const remove = async (id: string) => {
    setConfirmId(null);
    try {
      await workoutTemplatesApi.remove(id);
      setInfo('Plan usunięty.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się usunąć');
    }
  };

  const startToday = async (template: WorkoutTemplate) => {
    setStartingId(template.id);
    try {
      await workoutTemplatesApi.startToday(template.id);
      setInfo(`„${template.name}" dodany do dzisiejszych zadań.`);
      onStartTraining?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się uruchomić');
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted">
            Plany treningowe
          </div>
          <h2 className="text-lg font-semibold text-white inline-flex items-center gap-2">
            <Dumbbell size={16} className="text-accent-orange" />
            Biblioteka planów
          </h2>
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj planu..."
            className="w-full rounded-md border border-border bg-surface2 pl-8 pr-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent-orange"
          />
        </div>
      </div>

      {info && (
        <div className="rounded-md border border-accent-emerald/40 bg-accent-emerald/10 px-3 py-2 text-xs text-accent-emerald">
          {info}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted">Ładowanie...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
          <Dumbbell className="mx-auto mb-3 text-muted" size={28} />
          <p className="text-sm text-white">
            {templates.length === 0
              ? 'Brak zapisanych planów.'
              : 'Brak wyników dla wyszukiwania.'}
          </p>
          {templates.length === 0 && (
            <p className="mt-1 text-xs text-muted">
              Zapisz pierwszy trening — pojawi się tutaj jako plan do
              ponownego użycia.
            </p>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((t) => {
            const muscles = topMuscles(t);
            const isConfirming = confirmId === t.id;
            return (
              <li
                key={t.id}
                className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {t.name}
                    </h3>
                    <div className="mt-1 text-[10px] font-mono text-muted">
                      {t.exercises.length} ćw. · zmieniono{' '}
                      {formatRelative(t.updated_at)}
                    </div>
                  </div>
                </div>

                {muscles.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {muscles.map(([m, v]) => {
                      const label = intensityLabel(v);
                      return (
                        <span
                          key={m}
                          className="rounded px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: `${label?.color ?? '#22C55E'}18`,
                            color: label?.color ?? '#22C55E',
                          }}
                        >
                          {MUSCLE_LABELS_PL[m] ?? m}
                        </span>
                      );
                    })}
                  </div>
                )}

                {t.exercises.length > 0 && (
                  <ul className="text-[11px] text-muted space-y-0.5 line-clamp-3">
                    {t.exercises.slice(0, 4).map((ex) => (
                      <li key={ex.id} className="truncate">
                        · {ex.exercise_name}{' '}
                        <span className="font-mono">
                          ({ex.target_sets} ser.)
                        </span>
                      </li>
                    ))}
                    {t.exercises.length > 4 && (
                      <li className="text-muted/70 italic">
                        + {t.exercises.length - 4} więcej...
                      </li>
                    )}
                  </ul>
                )}

                {isConfirming ? (
                  <div className="flex items-center justify-between rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2">
                    <span className="text-[11px] text-accent-red">
                      Usunąć ten plan?
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => remove(t.id)}
                        className="rounded-md bg-accent-red px-2 py-0.5 text-[10px] font-medium text-white"
                      >
                        Tak
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="text-muted hover:text-white text-[10px] px-1"
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
                    <button
                      type="button"
                      onClick={() => startToday(t)}
                      disabled={startingId === t.id}
                      className="inline-flex items-center gap-1 rounded-md bg-accent-orange px-2.5 py-1 text-[11px] font-medium text-black disabled:opacity-50"
                      title="Dodaj jako zadanie na dziś"
                    >
                      {startingId === t.id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Play size={11} />
                      )}
                      Start dziś
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduling(t)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface2 px-2.5 py-1 text-[11px] text-white hover:border-accent-orange"
                    >
                      <CalendarPlus size={11} /> Plan w kalendarzu
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(t)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface2 px-2.5 py-1 text-[11px] text-white hover:border-accent-orange"
                    >
                      <Pencil size={11} /> Edytuj
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(t.id)}
                      className="ml-auto text-muted hover:text-accent-red"
                      title="Usuń plan"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <TemplateEditModal
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setInfo('Plan zaktualizowany.');
            void refresh();
          }}
        />
      )}
      {scheduling && (
        <TemplateSchedulePopover
          template={scheduling}
          onClose={() => setScheduling(null)}
          onScheduled={(count) => {
            setInfo(`Zaplanowano ${count} treningów.`);
          }}
        />
      )}
    </div>
  );
}
