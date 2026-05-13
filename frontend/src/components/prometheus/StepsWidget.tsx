import { Footprints, Pencil } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';

import { api } from '../../services/api';
import type { StepLogDay } from '../../types';
import { shortWeekdayPl, todayIso } from '../../utils/date';

interface StepsWidgetProps {
  /** Optional callback fired after a successful upsert. */
  onLogged?: () => void;
}

const COLOR_AMBER = '#F59E0B';
const COLOR_EMERALD = '#10B981';
const COLOR_RED = '#EF4444';
const COLOR_BLUE = '#3B82F6';
const COLOR_MUTED = '#374151';

function formatThousands(n: number): string {
  return n.toLocaleString('pl-PL').replace(/,/g, ' ');
}

function progressColor(pct: number): string {
  if (pct >= 100) return COLOR_EMERALD;
  if (pct >= 70) return COLOR_AMBER;
  return COLOR_RED;
}

/**
 * Inline daily step tracker with weekly progress bar + 7-day mini chart.
 * Tap the today value (or pencil icon) to edit inline; Enter or blur
 * commits via `POST /api/v1/steps/log`. Optimistic update; on failure
 * the UI reverts and shows an inline error.
 */
export default function StepsWidget({ onLogged }: StepsWidgetProps) {
  const [week, setWeek] = useState<StepLogDay[] | null>(null);
  const [goal, setGoal] = useState<number>(70000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [w, s] = await Promise.all([
        api.getStepsWeek(),
        api.getUserSettings(),
      ]);
      setWeek(w);
      setGoal(s.weekly_step_goal);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania kroków');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const today = todayIso();
  const todayEntry = week?.find((d) => d.date === today) ?? null;
  const todaySteps = todayEntry?.steps ?? 0;

  const weeklyTotal = useMemo(
    () => (week ?? []).reduce((sum, d) => sum + (d.steps ?? 0), 0),
    [week],
  );
  const pct =
    goal > 0 ? Math.min(999, Math.round((weeklyTotal / goal) * 100)) : 0;
  const barColor = progressColor(pct);

  const chartData = (week ?? []).map((d) => ({
    day: shortWeekdayPl(d.date),
    steps: d.steps ?? 0,
    missing: d.steps === null,
    isToday: d.date === today,
    iso: d.date,
  }));

  const commit = useCallback(
    async (raw: string) => {
      const parsed = Number.parseInt(raw, 10);
      const steps = Number.isFinite(parsed)
        ? Math.max(0, Math.min(100000, parsed))
        : 0;
      const prevWeek = week;
      setWeek((w) =>
        (w ?? []).map((d) => (d.date === today ? { ...d, steps } : d)),
      );
      setEditing(false);
      setSubmitting(true);
      try {
        await api.logSteps(today, steps);
        onLogged?.();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Nie udało się zapisać');
        setWeek(prevWeek);
      } finally {
        setSubmitting(false);
      }
    },
    [today, week, onLogged],
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="h-4 w-32 animate-pulse rounded bg-surface2" />
        <div className="mt-4 h-6 w-48 animate-pulse rounded bg-surface2" />
        <div className="mt-2 h-2 w-full animate-pulse rounded bg-surface2" />
        <div className="mt-4 h-20 w-full animate-pulse rounded bg-surface2" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {error && (
        <div className="mb-3 flex items-center justify-between rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded bg-accent-red/20 px-2 py-0.5 text-[11px] font-medium text-accent-red hover:bg-accent-red/30"
          >
            Spróbuj ponownie
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted">
          <Footprints size={14} /> Kroki
        </div>
        <span className="text-[11px] text-muted">
          tygodniowy cel:{' '}
          <span className="font-mono text-white/80">
            {formatThousands(goal)}
          </span>
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted">
            Dziś
          </div>
          {editing ? (
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              min={0}
              max={100000}
              defaultValue={String(todaySteps)}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={(e) => void commit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                  void commit(draft || e.currentTarget.value);
                if (e.key === 'Escape') setEditing(false);
              }}
              className="mt-1 w-32 rounded-md border border-accent-blue bg-surface2 px-2 py-1 text-right font-mono text-2xl text-white outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-1 inline-flex items-center gap-2 rounded-md px-1 py-1 font-mono text-2xl text-white hover:bg-surface2"
              aria-label="Edytuj dzisiejsze kroki"
            >
              <span>{formatThousands(todaySteps)}</span>
              <Pencil size={14} className="text-muted" />
            </button>
          )}
          {submitting && (
            <div className="mt-1 text-[10px] text-muted">Zapisuję…</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-muted">
            Tydzień
          </div>
          <div className="mt-1 font-mono text-sm text-white/85">
            {formatThousands(weeklyTotal)} /{' '}
            <span className="text-muted">{formatThousands(goal)}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {goal > 0 ? `${pct}%` : '—'}
          </div>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface2">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: barColor }}
        />
      </div>

      {weeklyTotal === 0 && (
        <p className="mt-3 text-xs text-muted">
          Brak danych — zacznij logować kroki
        </p>
      )}

      <div className="mt-4 h-24">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
          >
            <XAxis
              dataKey="day"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: '#1f293733' }}
              contentStyle={{
                background: '#12121A',
                border: '1px solid #1f2937',
                fontSize: 11,
                color: '#fff',
              }}
              formatter={(value: number, _name, payload) => {
                const d = payload?.payload as { missing: boolean } | undefined;
                return d?.missing
                  ? ['—', 'kroki']
                  : [formatThousands(value), 'kroki'];
              }}
            />
            <Bar dataKey="steps" radius={[3, 3, 0, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.iso}
                  fill={
                    entry.missing
                      ? COLOR_MUTED
                      : entry.isToday
                        ? COLOR_BLUE
                        : COLOR_AMBER
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
