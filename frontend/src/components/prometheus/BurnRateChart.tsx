import { Flame } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { api } from '../../services/api';
import type { BurnRateDay } from '../../types';
import { shortWeekdayPl } from '../../utils/date';

const COLOR_AMBER = '#F59E0B';
const COLOR_MUTED = '#6B7280';

function formatThousands(n: number): string {
  return n.toLocaleString('pl-PL').replace(/,/g, ' ');
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: { kcal: number };
}

/**
 * Smooth-line chart of cardio kcal burn over the last 7 calendar days.
 * Backend values come from `cardio_sessions.kcal_total` (computed by
 * `cardio_agent`); rest days arrive as `kcal=0` and render as a muted
 * dot. The 75kg footnote is a UX hint — burn values are still
 * informative regardless of body-weight availability.
 */
export default function BurnRateChart() {
  const [data, setData] = useState<BurnRateDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getBurnRate()
      .then((rows) => {
        if (!cancelled) setData(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Błąd ładowania');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const chartData = useMemo(
    () =>
      (data ?? []).map((d) => ({
        day: shortWeekdayPl(d.date),
        iso: d.date,
        kcal: d.kcal,
        duration: d.duration_minutes,
        workoutType: d.workout_type,
      })),
    [data],
  );

  const weeklyTotal = useMemo(
    () => (data ?? []).reduce((sum, d) => sum + d.kcal, 0),
    [data],
  );
  const hasAnyCardio = weeklyTotal > 0;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="h-4 w-40 animate-pulse rounded bg-surface2" />
        <div className="mt-3 h-[180px] w-full animate-pulse rounded bg-surface2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted">
          <Flame size={14} className="text-accent-amber" /> Burn Rate — ostatnie 7 dni
        </div>
        <span className="text-[11px] text-muted">kcal z cardio</span>
      </div>

      <div className="mt-3 h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
          >
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              axisLine={{ stroke: '#1f2937' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              cursor={{ stroke: '#1f2937' }}
              contentStyle={{
                background: '#12121A',
                border: '1px solid #1f2937',
                fontSize: 11,
                color: '#fff',
              }}
              formatter={(value: number, _name, payload) => {
                const d = payload?.payload as { duration: number } | undefined;
                return [
                  `${formatThousands(value)} kcal · ${d?.duration ?? 0} min`,
                  'burn',
                ];
              }}
              labelFormatter={(label) => String(label)}
            />
            <Line
              type="monotone"
              dataKey="kcal"
              stroke={COLOR_AMBER}
              strokeWidth={2}
              dot={(props: DotProps) => {
                const { cx, cy, payload } = props;
                const kcal = payload?.kcal ?? 0;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={kcal > 0 ? 4 : 3}
                    fill={kcal > 0 ? COLOR_AMBER : COLOR_MUTED}
                    stroke="#12121A"
                    strokeWidth={1}
                  />
                );
              }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {hasAnyCardio ? (
        <div className="mt-2 font-mono text-sm text-accent-amber">
          Łącznie: {formatThousands(weeklyTotal)} kcal ten tydzień
        </div>
      ) : (
        <div className="mt-2 text-xs text-muted">
          Brak treningów cardio w ostatnich 7 dniach
        </div>
      )}

      <p className="mt-2 text-[10px] text-muted">
        * kalkulacja dla 75 kg (gdy w sesji brak własnej kalorymetrii)
      </p>
    </div>
  );
}
