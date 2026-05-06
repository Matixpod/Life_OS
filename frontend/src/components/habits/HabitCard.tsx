import { Check, Flame, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { habitsApi } from '../../api/habits';
import type { Habit } from '../../types';
import { CATEGORY_COLORS, CATEGORY_LABELS_PL, ISO_DOW_LABELS_PL } from '../../types';

interface Props {
  habit: Habit;
  onChanged: () => void;
  onEdit?: (habit: Habit) => void;
}

function describeRecurrence(habit: Habit): string {
  switch (habit.recurrence_type) {
    case 'daily':
      return 'Codziennie';
    case 'weekly':
      return habit.selected_days?.length
        ? `Co tydzień (${habit.selected_days.map((d) => ISO_DOW_LABELS_PL[d]).join(', ')})`
        : 'Co tydzień';
    case 'monthly':
      return `Co miesiąc — dzień ${habit.monthly_day ?? '?'}`;
    case 'selected_days':
      return habit.selected_days?.length
        ? `Wybrane dni: ${habit.selected_days.map((d) => ISO_DOW_LABELS_PL[d]).join(', ')}`
        : 'Wybrane dni';
    case 'custom':
      if (habit.custom_rule?.times_per && habit.custom_rule.per) {
        return `${habit.custom_rule.times_per}× w ${habit.custom_rule.per === 'week' ? 'tygodniu' : 'miesiącu'}`;
      }
      if (habit.custom_rule?.interval && habit.custom_rule.unit) {
        const labels: Record<string, string> = {
          days: 'dni',
          weeks: 'tygodni',
          months: 'miesięcy',
        };
        return `Co ${habit.custom_rule.interval} ${labels[habit.custom_rule.unit] ?? habit.custom_rule.unit}`;
      }
      return 'Niestandardowe';
    default:
      return habit.recurrence_type;
  }
}

export default function HabitCard({ habit, onChanged, onEdit }: Props) {
  const [busy, setBusy] = useState<'complete' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const color = CATEGORY_COLORS[habit.category].hex;
  const doneToday = habit.completed_today;

  async function handleToggle(): Promise<void> {
    setBusy('complete');
    setError(null);
    try {
      if (doneToday) {
        await habitsApi.uncompleteToday(habit.id);
      } else {
        await habitsApi.completeToday(habit.id);
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!confirm(`Usunąć habit "${habit.title}"? (zostanie zarchiwizowany)`)) return;
    setBusy('delete');
    setError(null);
    try {
      await habitsApi.remove(habit.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="rounded-lg border border-border bg-surface p-3"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          <Flame size={18} className="text-accent-amber" />
          <div className="font-mono text-sm">{habit.streak}</div>
          <div className="text-[9px] uppercase tracking-widest text-muted">streak</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{habit.title}</span>
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[10px]"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {CATEGORY_LABELS_PL[habit.category]}
            </span>
            {habit.estimated_minutes != null && habit.estimated_minutes > 0 && (
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] border ${
                  habit.is_regenerative
                    ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                    : 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                }`}
                title={habit.is_regenerative ? 'Zwraca staminę' : 'Koszt staminy'}
              >
                {habit.is_regenerative ? '+' : '-'}
                {habit.estimated_minutes} AP
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-muted">{describeRecurrence(habit)}</div>
          {habit.longest_streak > 0 && (
            <div className="mt-0.5 text-[10px] text-muted">
              Najdłuższa seria: <span className="font-mono">{habit.longest_streak}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void handleToggle()}
            disabled={busy !== null}
            aria-pressed={doneToday}
            className={`inline-flex size-9 items-center justify-center rounded-md border disabled:opacity-50 ${
              doneToday
                ? 'border-accent-emerald bg-accent-emerald text-white hover:bg-accent-emerald/80'
                : 'border-accent-emerald/40 bg-accent-emerald/15 text-accent-emerald hover:bg-accent-emerald/25'
            }`}
            title={doneToday ? 'Cofnij wykonanie z dzisiaj' : 'Oznacz dziś jako zrobione'}
          >
            <Check size={14} />
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(habit)}
              disabled={busy !== null}
              className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface2 text-muted hover:text-accent-blue disabled:opacity-50"
              title="Edytuj habit"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={busy !== null}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface2 text-muted hover:text-accent-red disabled:opacity-50"
            title="Archiwizuj habit"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {error && <div className="mt-2 text-[11px] text-accent-red">{error}</div>}
    </div>
  );
}
