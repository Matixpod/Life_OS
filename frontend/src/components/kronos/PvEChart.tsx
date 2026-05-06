import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PvEScore } from '../../types';

interface WeeklyPoint {
  label: string;
  ratio: number;
}

function weeklyAggregate(scores: PvEScore[]): WeeklyPoint[] {
  // Bucket the per-category daily breakdowns into 4 trailing 7-day windows
  // ending today. For each bucket, average the daily ratios across categories
  // and across days. Empty buckets fall through as 0.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets: { sum: number; count: number; label: string }[] = [];
  for (let i = 3; i >= 0; i--) {
    const end = new Date(today);
    end.setDate(today.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    buckets.push({
      sum: 0,
      count: 0,
      label: i === 0 ? 'This wk' : `${i}w ago`,
    });

    for (const score of scores) {
      for (const day of score.daily_breakdown) {
        const d = new Date(day.date);
        if (d >= start && d <= end) {
          buckets[buckets.length - 1].sum += day.ratio;
          buckets[buckets.length - 1].count += 1;
        }
      }
    }
  }

  return buckets.map((b) => ({
    label: b.label,
    ratio: b.count > 0 ? Math.round((b.sum / b.count) * 1000) / 10 : 0,
  }));
}

interface Props {
  scores: PvEScore[];
}

export default function PvEChart({ scores }: Props) {
  const weekly = useMemo(() => weeklyAggregate(scores), [scores]);

  return (
    <div className="rounded-xl bg-surface border border-border p-5">
      <div className="text-[11px] tracking-widest uppercase text-muted">
        Plan vs execution
      </div>
      <h3 className="text-sm font-medium mb-4">Last 4 weeks (% executed)</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekly}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={{ stroke: '#1f2937' }}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={{ stroke: '#1f2937' }}
              domain={[0, 100]}
              unit="%"
            />
            <Tooltip
              cursor={{ fill: 'rgba(245,158,11,0.05)' }}
              contentStyle={{
                background: '#0f172a',
                border: '1px solid #1f2937',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v) => [`${Number(v ?? 0).toFixed(1)}%`, 'Executed']}
            />
            <Bar dataKey="ratio" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
