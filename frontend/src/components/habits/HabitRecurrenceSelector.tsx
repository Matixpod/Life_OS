import { useState } from 'react';
import type { CustomRecurrenceRule, RecurrenceType } from '../../types';
import { ISO_DOW_LABELS_PL } from '../../types';

export interface HabitRecurrenceValue {
  recurrence_type: RecurrenceType;
  selected_days: number[] | null;
  monthly_day: number | null;
  custom_rule: CustomRecurrenceRule | null;
}

interface Props {
  value: HabitRecurrenceValue;
  onChange: (v: HabitRecurrenceValue) => void;
}

const SIMPLE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'daily', label: 'Codziennie' },
  { value: 'weekly', label: 'Co tydzień' },
  { value: 'monthly', label: 'Co miesiąc' },
  { value: 'selected_days', label: 'Wybrane dni' },
];

export default function HabitRecurrenceSelector({ value, onChange }: Props) {
  const [advanced, setAdvanced] = useState(value.recurrence_type === 'custom');

  function setSimple(type: RecurrenceType): void {
    onChange({
      recurrence_type: type,
      selected_days: type === 'selected_days' ? value.selected_days ?? [] : null,
      monthly_day: type === 'monthly' ? value.monthly_day ?? 1 : null,
      custom_rule: null,
    });
  }

  function toggleDay(dow: number): void {
    const current = value.selected_days ?? [];
    const next = current.includes(dow)
      ? current.filter((d) => d !== dow)
      : [...current, dow].sort((a, b) => a - b);
    onChange({ ...value, selected_days: next });
  }

  function setMonthlyDay(day: number): void {
    onChange({ ...value, monthly_day: Math.max(1, Math.min(31, day)) });
  }

  function setCustom(rule: CustomRecurrenceRule): void {
    onChange({
      recurrence_type: 'custom',
      selected_days: null,
      monthly_day: null,
      custom_rule: rule,
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface2 p-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-widest text-muted">Powtarzanie</span>
        <div className="ml-auto inline-flex rounded-md border border-border bg-surface p-0.5">
          <button
            type="button"
            onClick={() => {
              setAdvanced(false);
              if (value.recurrence_type === 'custom') setSimple('daily');
            }}
            className={`px-2 py-0.5 text-[11px] rounded-sm ${
              !advanced ? 'bg-surface2 text-white' : 'text-muted'
            }`}
          >
            Prosty
          </button>
          <button
            type="button"
            onClick={() => {
              setAdvanced(true);
              if (value.recurrence_type !== 'custom') {
                setCustom({ interval: 1, unit: 'days' });
              }
            }}
            className={`px-2 py-0.5 text-[11px] rounded-sm ${
              advanced ? 'bg-surface2 text-white' : 'text-muted'
            }`}
          >
            Zaawansowany
          </button>
        </div>
      </div>

      {!advanced && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {SIMPLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSimple(opt.value)}
                aria-pressed={value.recurrence_type === opt.value}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  value.recurrence_type === opt.value
                    ? 'border-accent-blue/60 bg-accent-blue/15 text-accent-blue'
                    : 'border-border text-muted hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {value.recurrence_type === 'selected_days' && (
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
                const active = (value.selected_days ?? []).includes(dow);
                return (
                  <button
                    key={dow}
                    type="button"
                    onClick={() => toggleDay(dow)}
                    aria-pressed={active}
                    className={`size-9 rounded-md border text-[11px] font-mono transition-colors ${
                      active
                        ? 'border-accent-blue/60 bg-accent-blue/15 text-accent-blue'
                        : 'border-border text-muted hover:text-white'
                    }`}
                  >
                    {ISO_DOW_LABELS_PL[dow]}
                  </button>
                );
              })}
            </div>
          )}

          {value.recurrence_type === 'monthly' && (
            <label className="flex items-center gap-2 text-xs text-muted">
              Dzień miesiąca:
              <input
                type="number"
                min={1}
                max={31}
                value={value.monthly_day ?? 1}
                onChange={(e) => setMonthlyDay(Number(e.target.value))}
                className="w-16 rounded-md border border-border bg-surface px-2 py-1 font-mono text-center text-xs focus:border-accent-blue focus:outline-none"
              />
              <span className="text-[11px] text-muted">
                (jeśli dzień nie istnieje w miesiącu — pomijamy go)
              </span>
            </label>
          )}
        </>
      )}

      {advanced && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            Co
            <input
              type="number"
              min={1}
              max={365}
              value={value.custom_rule?.interval ?? 1}
              onChange={(e) =>
                setCustom({
                  ...(value.custom_rule ?? { unit: 'days' }),
                  interval: Math.max(1, Number(e.target.value)),
                })
              }
              className="w-16 rounded-md border border-border bg-surface px-2 py-1 font-mono text-center text-xs focus:border-accent-blue focus:outline-none"
            />
            <select
              value={value.custom_rule?.unit ?? 'days'}
              onChange={(e) =>
                setCustom({
                  ...(value.custom_rule ?? { interval: 1 }),
                  unit: e.target.value as 'days' | 'weeks' | 'months',
                })
              }
              className="rounded-md border border-border bg-surface px-2 py-1 text-xs focus:border-accent-blue focus:outline-none"
            >
              <option value="days">dni</option>
              <option value="weeks">tygodni</option>
              <option value="months">miesięcy</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            lub
            <input
              type="number"
              min={1}
              max={14}
              value={value.custom_rule?.times_per ?? ''}
              onChange={(e) =>
                setCustom({
                  ...(value.custom_rule ?? { interval: 1, unit: 'days' }),
                  times_per: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="—"
              className="w-16 rounded-md border border-border bg-surface px-2 py-1 font-mono text-center text-xs focus:border-accent-blue focus:outline-none"
            />
            razy w
            <select
              value={value.custom_rule?.per ?? 'week'}
              onChange={(e) =>
                setCustom({
                  ...(value.custom_rule ?? { interval: 1, unit: 'days' }),
                  per: e.target.value as 'week' | 'month',
                })
              }
              className="rounded-md border border-border bg-surface px-2 py-1 text-xs focus:border-accent-blue focus:outline-none"
            >
              <option value="week">tygodniu</option>
              <option value="month">miesiącu</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
