import {
  ALL_MUSCLE_KEYS,
  MUSCLE_LABELS_PL,
  intensityLabel,
  recoveryHoursLeft,
  type RecoveryMap,
} from '../../types/prometheus';

interface MuscleRecoveryBarProps {
  recoveryMap: RecoveryMap;
}

export default function MuscleRecoveryBar({ recoveryMap }: MuscleRecoveryBarProps) {
  const rows = ALL_MUSCLE_KEYS.map((key) => ({
    key,
    intensity: recoveryMap[key] ?? 0,
  }))
    .filter((r) => r.intensity > 0.05)
    .sort((a, b) => b.intensity - a.intensity);

  if (rows.length === 0) {
    return (
      <div className="text-xs text-muted px-1 py-2">
        Wszystkie mięśnie wypoczęte. Uderzaj.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {rows.map(({ key, intensity }) => {
        const label = intensityLabel(intensity);
        const hoursLeft = recoveryHoursLeft(intensity);
        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="w-32 truncate text-muted">{MUSCLE_LABELS_PL[key]}</span>
            <div className="flex-1 h-2 rounded bg-surface2 overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${Math.round(intensity * 100)}%`,
                  backgroundColor: label?.color ?? '#22C55E',
                }}
              />
            </div>
            <span className="w-12 text-right font-mono text-[10px] text-muted">
              {hoursLeft}h
            </span>
          </div>
        );
      })}
    </div>
  );
}
