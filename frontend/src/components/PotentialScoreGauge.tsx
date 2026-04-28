import { useEffect, useState } from 'react';

interface PotentialScoreGaugeProps {
  score: number;
  isLoading?: boolean;
}

const SIZE = 220;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function PotentialScoreGauge({ score, isLoading = false }: PotentialScoreGaugeProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (isLoading) return;
    const id = window.setTimeout(() => setAnimated(clamped), 80);
    return () => window.clearTimeout(id);
  }, [clamped, isLoading]);

  const offset = CIRCUMFERENCE * (1 - animated / 100);

  const color =
    clamped >= 80 ? '#10B981' : clamped >= 60 ? '#3B82F6' : clamped >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="#1A1A24"
            strokeWidth={STROKE}
            fill="none"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.4s ease-out, stroke 0.4s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isLoading ? (
            <div className="h-12 w-24 rounded bg-surface2 animate-pulse" />
          ) : (
            <>
              <div className="font-mono text-5xl font-bold tracking-tight">{clamped}</div>
              <div className="text-[11px] tracking-widest uppercase text-muted mt-1">/ 100</div>
            </>
          )}
        </div>
      </div>
      <div className="text-[11px] tracking-widest uppercase text-muted mt-3">Daily Potential</div>
    </div>
  );
}
