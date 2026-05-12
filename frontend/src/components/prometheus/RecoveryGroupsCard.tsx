import { Activity } from 'lucide-react';
import {
  MUSCLE_GROUP_LABELS_PL,
  STATUS_COLORS,
  STATUS_LABELS_PL,
  TRAINING_REC_META,
  type MuscleGroup,
  type RecoveryState,
} from '../../types/prometheus';

interface RecoveryGroupsCardProps {
  state: RecoveryState;
}

const GROUP_ORDER: MuscleGroup[] = [
  'legs',
  'back',
  'chest',
  'shoulders',
  'triceps',
  'biceps',
  'forearms',
  'rear_delt',
  'core',
];

export default function RecoveryGroupsCard({ state }: RecoveryGroupsCardProps) {
  const rec = TRAINING_REC_META[state.training_recommendation];
  const groups = GROUP_ORDER.map((g) => state.recovery_groups[g]).filter(
    (g): g is NonNullable<typeof g> => Boolean(g),
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <Activity size={14} className="text-accent-orange" />
          <span className="text-[11px] uppercase tracking-widest text-muted">
            Regeneracja i rekomendacja
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted">
          stamina {state.stamina_pool} · mod {state.recovery_modifier_today.toFixed(2)}
        </span>
      </header>

      <div
        className="rounded-md border px-3 py-2 flex items-baseline gap-3"
        style={{ borderColor: `${rec.color}66`, backgroundColor: `${rec.color}10` }}
      >
        <span className="text-sm font-semibold" style={{ color: rec.color }}>
          {rec.label}
        </span>
        <span className="text-xs text-muted">{rec.tone}</span>
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-muted">
          Brak treningu w ostatnich 7 dniach — wszystkie partie gotowe.
        </p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {groups.map((g) => {
            const color = STATUS_COLORS[g.status];
            return (
              <li
                key={g.group}
                className="rounded-md border border-border bg-surface2 p-2 flex flex-col gap-1"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-white">
                    {MUSCLE_GROUP_LABELS_PL[g.group]}
                  </span>
                  <span className="text-[10px] font-medium font-mono" style={{ color }}>
                    {g.recovery_pct}%
                  </span>
                </div>
                <div className="h-1 rounded-full overflow-hidden bg-surface">
                  <div
                    style={{
                      width: `${g.recovery_pct}%`,
                      backgroundColor: color,
                    }}
                    className="h-full"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span style={{ color }}>{STATUS_LABELS_PL[g.status]}</span>
                  <span className="font-mono text-muted">
                    {g.days_since_last === 0
                      ? 'dziś'
                      : `${g.days_since_last}d temu`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
