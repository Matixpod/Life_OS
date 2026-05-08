import {
  ALL_MUSCLE_KEYS,
  MUSCLE_LABELS_PL,
  intensityLabel,
  type GymSession,
  type MuscleKey,
} from '../../types/prometheus';

interface WeekViewProps {
  sessions: GymSession[];
}

const DAY_LABELS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // 0 = Mon
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function WeekView({ sessions }: WeekViewProps) {
  const weekStart = startOfWeek(new Date());
  const days: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return isoDate(d);
  });

  // matrix: muscle → day_iso → max intensity that day
  const matrix: Record<MuscleKey, Record<string, number>> = {} as Record<
    MuscleKey,
    Record<string, number>
  >;
  for (const key of ALL_MUSCLE_KEYS) {
    matrix[key] = {};
  }

  for (const s of sessions) {
    if (!days.includes(s.date)) continue;
    for (const ex of s.exercises) {
      for (const [muscle, load] of Object.entries(ex.muscle_load)) {
        const key = muscle as MuscleKey;
        if (!matrix[key]) continue;
        const current = matrix[key][s.date] ?? 0;
        if (load > current) matrix[key][s.date] = load;
      }
    }
  }

  const muscleHits: Record<MuscleKey, number> = {} as Record<MuscleKey, number>;
  for (const key of ALL_MUSCLE_KEYS) {
    muscleHits[key] = days.reduce(
      (acc, d) => acc + ((matrix[key][d] ?? 0) > 0.05 ? 1 : 0),
      0,
    );
  }
  const neglected = ALL_MUSCLE_KEYS.filter((k) => muscleHits[k] === 0);

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-muted mb-2">
          Tygodniowy heatmap
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted">
                <th className="text-left font-normal py-1 w-32">Mięsień</th>
                {DAY_LABELS.map((label, i) => (
                  <th key={label} className="text-center font-normal font-mono py-1">
                    {label}
                    <div className="text-[9px] text-muted/60">{days[i].slice(5)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_MUSCLE_KEYS.map((muscle) => (
                <tr key={muscle} className="border-t border-border/40">
                  <td className="py-1 text-muted truncate">
                    {MUSCLE_LABELS_PL[muscle]}
                  </td>
                  {days.map((d) => {
                    const intensity = matrix[muscle][d] ?? 0;
                    const label = intensityLabel(intensity);
                    return (
                      <td key={d} className="py-1 text-center">
                        <div
                          className="mx-auto h-5 w-7 rounded"
                          title={
                            label
                              ? `${MUSCLE_LABELS_PL[muscle]} · ${Math.round(intensity * 100)}%`
                              : undefined
                          }
                          style={{
                            backgroundColor: label?.color ?? '#1A1A24',
                            opacity: label ? 0.85 : 0.3,
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {neglected.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted mb-2">
            Zaniedbane mięśnie
          </div>
          <div className="flex flex-wrap gap-1.5">
            {neglected.map((key) => (
              <span
                key={key}
                className="rounded-md border border-accent-red/40 bg-accent-red/10 px-2 py-0.5 text-[11px] text-accent-red"
              >
                {MUSCLE_LABELS_PL[key]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
