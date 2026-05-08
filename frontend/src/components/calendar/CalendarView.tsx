import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { calendarApi } from '../../api/calendar';
import type { CalendarDay } from '../../types';
import CalendarItem from './CalendarItem';
import ProposalCard from './ProposalCard';
import { sortCalendarItems } from './dayPart';

export type CalendarMode = 'day' | 'week' | 'month';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function startOfIsoWeek(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  const dow = d.getUTCDay() || 7; // Sun=7
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

function startOfMonth(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}

function endOfMonth(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

const DOW_LABELS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];

interface CalendarViewProps {
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  anchor: string;
  onAnchorChange: (iso: string) => void;
  /** Bump this number to force a refetch (e.g. after QuickAdd creates a task). */
  refreshKey?: number;
}

export default function CalendarView({
  mode,
  onModeChange,
  anchor,
  onAnchorChange,
  refreshKey = 0,
}: CalendarViewProps) {
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo<{ start: string; end: string }>(() => {
    if (mode === 'day') return { start: anchor, end: anchor };
    if (mode === 'week') {
      const start = startOfIsoWeek(anchor);
      return { start, end: addDays(start, 6) };
    }
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }, [anchor, mode]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'day') {
        const d = await calendarApi.day(anchor);
        setDays([d]);
      } else {
        const r = await calendarApi.range(range.start, range.end);
        setDays(r.days);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setLoading(false);
    }
  }, [anchor, mode, range.end, range.start, refreshKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function shift(delta: number): void {
    if (mode === 'day') return onAnchorChange(addDays(anchor, delta));
    if (mode === 'week') return onAnchorChange(addDays(anchor, delta * 7));
    const d = new Date(anchor + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + delta);
    onAnchorChange(d.toISOString().slice(0, 10));
  }

  function dropProposal(id: string): void {
    setDays((prev) =>
      prev.map((day) => ({ ...day, proposals: day.proposals.filter((p) => p.id !== id) })),
    );
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
          {(['day', 'week', 'month'] as CalendarMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`px-3 py-1 text-xs rounded-sm capitalize transition-colors ${
                mode === m ? 'bg-surface2 text-white' : 'text-muted hover:text-white'
              }`}
            >
              {m === 'day' ? 'Dzień' : m === 'week' ? 'Tydzień' : 'Miesiąc'}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="size-7 inline-flex items-center justify-center rounded-md border border-border bg-surface text-muted hover:text-white"
            aria-label="Wstecz"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => onAnchorChange(todayIso())}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:text-white"
          >
            Dziś
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="size-7 inline-flex items-center justify-center rounded-md border border-border bg-surface text-muted hover:text-white"
            aria-label="Dalej"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="ml-auto font-mono text-xs text-muted">
          {range.start === range.end ? range.start : `${range.start} → ${range.end}`}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
          {error}
        </div>
      )}
      {loading && days.length === 0 && (
        <div className="h-32 animate-pulse rounded-xl border border-border bg-surface" />
      )}

      {mode === 'day' &&
        days.map((day) => (
          <DayPanel key={day.date} day={day} onProposalResolved={dropProposal} onItemToggled={load} />
        ))}

      {mode === 'week' && (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((day) => (
            <DayColumn key={day.date} day={day} onProposalResolved={dropProposal} onItemToggled={load} />
          ))}
        </div>
      )}

      {mode === 'month' && <MonthGrid days={days} onProposalResolved={dropProposal} onItemToggled={load} anchor={anchor} />}
    </div>
  );
}

interface DayPanelProps {
  day: CalendarDay;
  onProposalResolved: (id: string) => void;
  onItemToggled: () => void;
}

function DayPanel({ day, onProposalResolved, onItemToggled }: DayPanelProps) {
  const sortedItems = sortCalendarItems(day.items);
  const habits = sortedItems.filter((it) => it.type === 'habit_entry');
  const tasks = sortedItems.filter((it) => it.type !== 'habit_entry');
  const completionPct = Math.round(day.completion_rate * 100);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-mono text-sm">{day.date}</div>
        <div className="font-mono text-[11px] text-muted">{completionPct}%</div>
      </div>
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
        <div
          className="h-full rounded-full bg-accent-emerald transition-all duration-500"
          style={{ width: `${completionPct}%` }}
        />
      </div>

      {day.proposals.length > 0 && (
        <div className="mb-5 space-y-2">
          {day.proposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} onResolved={onProposalResolved} />
          ))}
        </div>
      )}

      {day.items.length === 0 && day.proposals.length === 0 ? (
        <div className="text-xs text-muted">Brak pozycji.</div>
      ) : (
        <div className="space-y-8">
          {habits.length > 0 && (
            <section>
              <h3 className="mb-3 text-[11px] uppercase tracking-widest text-muted">
                Nawyki i Rutyny
              </h3>
              <div className="space-y-2">
                {habits.map((it) => (
                  <CalendarItem key={it.id} item={it} compact onToggled={onItemToggled} />
                ))}
              </div>
            </section>
          )}
          {tasks.length > 0 && (
            <section>
              <h3 className="mb-3 text-[11px] uppercase tracking-widest text-muted">
                Zadania i Projekty
              </h3>
              <div className="space-y-3">
                {tasks.map((it) => (
                  <CalendarItem key={it.id} item={it} onToggled={onItemToggled} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function DayColumn({ day, onProposalResolved, onItemToggled }: DayPanelProps) {
  const dow = new Date(day.date + 'T00:00:00Z').getUTCDay() || 7;
  const sortedItems = sortCalendarItems(day.items);
  return (
    <div className="rounded-lg border border-border bg-surface p-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted">
          {DOW_LABELS[dow - 1]}
        </div>
        <div className="font-mono text-xs">{day.date.slice(8)}</div>
      </div>
      {day.proposals.map((p) => (
        <div key={p.id} className="mb-1.5">
          <ProposalCard proposal={p} onResolved={onProposalResolved} />
        </div>
      ))}
      <div className="space-y-1">
        {sortedItems.length === 0 ? (
          <div className="text-[11px] text-muted">—</div>
        ) : (
          sortedItems.map((it) => <CalendarItem key={it.id} item={it} compact onToggled={onItemToggled} />)
        )}
      </div>
    </div>
  );
}

interface MonthGridProps {
  days: CalendarDay[];
  onProposalResolved: (id: string) => void;
  onItemToggled: () => void;
  anchor: string;
}

function MonthGrid({ days, onProposalResolved, onItemToggled, anchor }: MonthGridProps) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const start = startOfMonth(anchor);
  const end = endOfMonth(anchor);
  const startDow = new Date(start + 'T00:00:00Z').getUTCDay() || 7; // 1..7
  const cells: (CalendarDay | null)[] = [];
  for (let i = 1; i < startDow; i++) cells.push(null);
  let cursor = start;
  while (cursor <= end) {
    cells.push(byDate.get(cursor) ?? { date: cursor, items: [], proposals: [], completion_rate: 0 });
    cursor = addDays(cursor, 1);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {DOW_LABELS.map((d) => (
        <div key={d} className="text-center text-[10px] uppercase tracking-widest text-muted">
          {d}
        </div>
      ))}
      {cells.map((cell, idx) => (
        <div
          key={idx}
          className={`min-h-20 rounded-md border border-border bg-surface p-1.5 text-[11px] ${
            cell ? '' : 'opacity-40'
          }`}
        >
          {cell && (
            <>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono">{cell.date.slice(8)}</span>
                {cell.items.length > 0 && (
                  <span className="font-mono text-[10px] text-muted">
                    {cell.items.length}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {cell.proposals.slice(0, 1).map((p) => (
                  <ProposalCard key={p.id} proposal={p} onResolved={onProposalResolved} />
                ))}
                {sortCalendarItems(cell.items).slice(0, 3).map((it) => (
                  <CalendarItem key={it.id} item={it} compact onToggled={onItemToggled} />
                ))}
                {cell.items.length > 3 && (
                  <div className="text-[10px] text-muted">+{cell.items.length - 3} więcej</div>
                )}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
