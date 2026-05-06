import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AresScoreHistoryPoint } from '../../types';

interface Props {
  history: AresScoreHistoryPoint[];
}

interface ChartRow {
  label: string;
  raw: string;
  score: number | null;
}

function formatLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface TooltipPayloadItem {
  payload?: ChartRow;
  value?: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  if (!row) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow">
      <div className="text-muted">{row.raw}</div>
      <div className="font-mono">
        {row.score === null ? 'brak danych' : `${row.score.toFixed(0)} / 100`}
      </div>
    </div>
  );
}

export default function AresTrendChart({ history }: Props) {
  const data: ChartRow[] = history.map((p) => ({
    raw: p.date,
    label: formatLabel(p.date),
    score: p.score === null ? null : Math.max(0, Math.min(100, p.score)),
  }));

  return (
    <div className="h-56 w-full rounded-xl border border-border bg-surface p-3">
      <div className="mb-1 flex items-center justify-between px-1 text-xs text-muted">
        <span>Health score — ostatnie {history.length} dni</span>
        <span className="font-mono">0–100</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1A1A24" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            stroke="#8B8B9F"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#8B8B9F"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={40} stroke="#EF4444" strokeDasharray="2 4" />
          <ReferenceLine y={60} stroke="#F59E0B" strokeDasharray="2 4" />
          <ReferenceLine y={80} stroke="#10B981" strokeDasharray="2 4" />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#F97316"
            strokeWidth={2}
            dot={{ r: 3, fill: '#F97316' }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
