import { useEffect, useState } from 'react';
import type { AresToneMode } from '../../types';

interface Props {
  score: number;
  tone: AresToneMode;
  size?: number;
}

const TONE_LABELS: Record<AresToneMode, string> = {
  peak: 'Szczytowa forma',
  good: 'Dobra baza',
  needs_work: 'Wymaga pracy',
  crisis: 'Tryb kryzysowy',
};

const TONE_COLORS: Record<AresToneMode, string> = {
  peak: '#10B981', // emerald
  good: '#A3E635', // lime/green
  needs_work: '#F59E0B', // amber
  crisis: '#EF4444', // red
};

const TRACK_COLOR = '#262636';
const RADIUS = 80;
const STROKE = 14;
const ARC_START = -210; // degrees — open at the bottom
const ARC_END = 30;
const FULL_ARC_LENGTH = ARC_END - ARC_START; // 240°

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export default function HealthScoreGauge({ score, tone, size = 220 }: Props) {
  const [rendered, setRendered] = useState(0);

  useEffect(() => {
    const target = Math.max(0, Math.min(100, score));
    let frame = 0;
    let raf = 0;
    const total = 30; // ~500ms at 60fps
    const start = rendered;

    const tick = () => {
      frame += 1;
      const t = Math.min(1, frame / total);
      const eased = 1 - Math.pow(1 - t, 3);
      setRendered(start + (target - start) * eased);
      if (frame < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const cx = size / 2;
  const cy = size / 2;
  const trackPath = arcPath(cx, cy, RADIUS, ARC_START, ARC_END);

  const fillEndDeg = ARC_START + (FULL_ARC_LENGTH * Math.max(0, Math.min(100, rendered))) / 100;
  const fillPath = arcPath(cx, cy, RADIUS, ARC_START, Math.max(ARC_START + 0.01, fillEndDeg));
  const color = TONE_COLORS[tone];

  return (
    <div className="flex flex-col items-center select-none">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path
          d={trackPath}
          stroke={TRACK_COLOR}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={fillPath}
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
        />
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="central"
          className="font-mono"
          fontSize={size * 0.28}
          fontWeight={700}
          fill="#FFFFFF"
        >
          {Math.round(rendered)}
        </text>
        <text
          x={cx}
          y={cy + size * 0.16}
          textAnchor="middle"
          fontSize={size * 0.07}
          fill="#8B8B9F"
        >
          / 100
        </text>
      </svg>
      <div className="-mt-2 text-sm font-semibold tracking-wide" style={{ color }}>
        {TONE_LABELS[tone]}
      </div>
    </div>
  );
}
