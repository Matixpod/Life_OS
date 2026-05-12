import { Calendar, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { workoutTemplatesApi } from '../../api/prometheus';
import type { WorkoutTemplate } from '../../types/prometheus';

interface TemplateSchedulePopoverProps {
  template: WorkoutTemplate;
  onClose: () => void;
  onScheduled: (count: number) => void;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

const WEEKDAY_LABELS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

export default function TemplateSchedulePopover({
  template,
  onClose,
  onScheduled,
}: TemplateSchedulePopoverProps) {
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayIso = useMemo(() => isoDate(new Date()), []);

  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const total = daysInMonth(cursor);
    // Monday-first offset: getDay()=0 (Sun) → 6, getDay()=1 (Mon) → 0
    const offset = (first.getDay() + 6) % 7;
    const out: (string | null)[] = [];
    for (let i = 0; i < offset; i++) out.push(null);
    for (let day = 1; day <= total; day++) {
      out.push(isoDate(new Date(cursor.getFullYear(), cursor.getMonth(), day)));
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const toggle = (iso: string) => {
    if (iso < todayIso) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  };

  const prevMonth = () =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const nextMonth = () =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));

  const save = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const dates = Array.from(selected).sort();
      const created = await workoutTemplatesApi.schedule(template.id, dates);
      onScheduled(created.length);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zaplanować');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(10, 10, 15, 0.75)' }}
    >
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted">
              Zaplanuj
            </div>
            <h3 className="text-sm font-medium text-white inline-flex items-center gap-1.5">
              <Calendar size={13} className="text-accent-orange" /> {template.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-white"
            aria-label="Zamknij"
          >
            <X size={16} />
          </button>
        </header>

        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-md border border-border bg-surface2 p-1 text-muted hover:text-white"
              aria-label="Poprzedni miesiąc"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-medium text-white">
              {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-md border border-border bg-surface2 p-1 text-muted hover:text-white"
              aria-label="Następny miesiąc"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((w) => (
              <div
                key={w}
                className="text-center text-[10px] uppercase tracking-widest text-muted"
              >
                {w}
              </div>
            ))}
            {cells.map((iso, idx) => {
              if (iso === null) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }
              const isSelected = selected.has(iso);
              const isPast = iso < todayIso;
              const isToday = iso === todayIso;
              const day = Number(iso.slice(8));
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={isPast}
                  onClick={() => toggle(iso)}
                  className={`h-8 rounded-md text-xs font-mono transition-colors
                    ${isSelected
                      ? 'bg-accent-orange text-black font-semibold'
                      : isPast
                        ? 'text-muted/40 cursor-not-allowed'
                        : isToday
                          ? 'border border-accent-orange/60 text-white hover:bg-surface2'
                          : 'text-white hover:bg-surface2'}
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-2 py-1.5 text-[11px] text-accent-red">
              {error}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-[11px] text-muted">
            {selected.size === 0
              ? 'Wybierz dni'
              : `Wybrano: ${selected.size}`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-xs text-white hover:border-accent-orange disabled:opacity-50"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || selected.size === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent-orange px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              Zaplanuj {selected.size > 0 ? `${selected.size} dni` : ''}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
