import { Trophy } from 'lucide-react';
import type { FatSummary } from '../../../types/prometheus';

interface Props {
  summary: FatSummary | null;
}

const JAR_CAPACITY = 500; // grams per week ⇒ "full jar"
const TOP_Y = 11;
const HEIGHT = 208;

export default function FatJar({ summary }: Props) {
  const week = summary?.week_fat_grams ?? 0;
  const fillPct = Math.min(1, week / JAR_CAPACITY);
  const color = fillPct < 0.30 ? '#60A5FA' : fillPct < 0.65 ? '#F97316' : '#EF4444';
  const goalReached = week >= JAR_CAPACITY;
  const liquidY = TOP_Y + (1 - fillPct) * HEIGHT;

  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-surface p-4">
      <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted">
        🔥 Ten tydzień
      </div>

      <div className="relative">
        {goalReached && (
          <div className="absolute inset-x-0 -top-3 z-10 flex justify-center">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-yellow/20 px-2 py-0.5 text-[10px] font-medium text-accent-yellow">
              <Trophy size={10} /> Cel tygodniowy!
            </span>
          </div>
        )}
        <svg width="160" height="260" aria-hidden="true">
          <defs>
            <clipPath id="jar-clip">
              <path d="M20,10 Q10,10 10,30 L10,220 Q10,240 30,240 L130,240 Q150,240 150,220 L150,30 Q150,10 140,10 Z" />
            </clipPath>
          </defs>

          {/* Glass outline */}
          <path
            d="M20,10 Q10,10 10,30 L10,220 Q10,240 30,240 L130,240 Q150,240 150,220 L150,30 Q150,10 140,10 Z"
            fill="none"
            stroke={color}
            strokeWidth={2}
            style={{ filter: `drop-shadow(0 0 8px ${color}66)` }}
          />

          {/* Liquid fill */}
          <g clipPath="url(#jar-clip)">
            <rect
              x="11"
              y={liquidY}
              width="138"
              height={fillPct * HEIGHT}
              fill={color}
              opacity={0.35}
              style={{ transition: 'y 1.2s ease-out, height 1.2s ease-out' }}
            />
            <path
              d="M11,0 Q40,-8 69,0 Q98,8 127,0 Q156,-8 185,0 V20 H11 Z"
              fill={color}
              opacity={0.5}
              transform={`translate(0 ${liquidY})`}
              style={{ transition: 'transform 1.2s ease-out' }}
            />
          </g>

          {/* Percentage label */}
          <text
            x="80"
            y={TOP_Y + (1 - fillPct / 2) * HEIGHT}
            textAnchor="middle"
            fill="white"
            fontSize="18"
            fontWeight={700}
            style={{ transition: 'y 1.2s ease-out' }}
          >
            {Math.round(fillPct * 100)}%
          </text>
        </svg>
      </div>

      <div className="mt-2 font-mono text-xs text-muted">
        {week.toFixed(0)}g / {JAR_CAPACITY}g tłuszczu
      </div>

      {summary && (summary.week_cardio_grams != null || summary.week_strength_grams != null) && (
        <div className="mt-1 inline-flex items-center gap-3 font-mono text-[10px] text-muted">
          <span title="Cardio w tym tygodniu">
            🏃 <span className="text-white">{(summary.week_cardio_grams ?? 0).toFixed(1)}g</span>
          </span>
          <span title="Trening siłowy w tym tygodniu">
            🏋️ <span className="text-white">{(summary.week_strength_grams ?? 0).toFixed(1)}g</span>
          </span>
        </div>
      )}

      <div className="mt-4 grid w-full grid-cols-4 gap-1 text-center">
        <Stat label="Dziś" value={summary?.today_fat_grams ?? 0} />
        <Stat label="Tydzień" value={summary?.week_fat_grams ?? 0} />
        <Stat label="Miesiąc" value={summary?.month_fat_grams ?? 0} />
        <Stat label="Łącznie" value={summary?.total_fat_grams ?? 0} />
      </div>

      {summary && (
        <div className="mt-3 text-[11px] text-muted">
          {summary.sessions_this_week} treningów w tym tygodniu
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-xs text-white">{formatGrams(value)}</div>
    </div>
  );
}

function formatGrams(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1)}kg`;
  if (g >= 100) return `${Math.round(g)}g`;
  return `${g.toFixed(1)}g`;
}
