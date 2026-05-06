import { Clock, Leaf, Save, X } from 'lucide-react';
import { useState } from 'react';
import { habitsApi } from '../../api/habits';
import type {
  Habit,
  HabitCreatePayload,
  HabitUpdatePayload,
  TaskCategory,
  TaskPriority,
} from '../../types';
import { CATEGORIES, CATEGORY_META, PRIORITY_BORDER, PRIORITY_LABEL } from '../tasks/categories';
import DurationPicker from '../ui/DurationPicker';
import HabitRecurrenceSelector, { type HabitRecurrenceValue } from './HabitRecurrenceSelector';

interface Props {
  initial?: Habit;
  onSaved: () => void;
  onCancel: () => void;
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];

export default function HabitForm({ initial, onSaved, onCancel }: Props) {
  const isEdit = initial !== undefined;
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<TaskCategory>(initial?.category ?? 'health');
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'medium');
  const [recurrence, setRecurrence] = useState<HabitRecurrenceValue>({
    recurrence_type: initial?.recurrence_type ?? 'daily',
    selected_days: initial?.selected_days ?? null,
    monthly_day: initial?.monthly_day ?? null,
    custom_rule: initial?.custom_rule ?? null,
  });
  const [durationMin, setDurationMin] = useState<number>(initial?.estimated_minutes ?? 0);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [isRegenerative, setIsRegenerative] = useState<boolean>(initial?.is_regenerative ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Tytuł jest wymagany.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit) {
        const payload: HabitUpdatePayload = {
          title: trimmed,
          category,
          priority,
          recurrence_type: recurrence.recurrence_type,
          selected_days: recurrence.selected_days,
          monthly_day: recurrence.monthly_day,
          custom_rule: recurrence.custom_rule,
          estimated_minutes: durationMin > 0 ? durationMin : null,
          is_regenerative: isRegenerative,
        };
        await habitsApi.update(initial.id, payload);
      } else {
        const payload: HabitCreatePayload = {
          title: trimmed,
          category,
          priority,
          recurrence_type: recurrence.recurrence_type,
          selected_days: recurrence.selected_days,
          monthly_day: recurrence.monthly_day,
          custom_rule: recurrence.custom_rule,
          estimated_minutes: durationMin > 0 ? durationMin : null,
          is_regenerative: isRegenerative,
        };
        await habitsApi.create(payload);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{isEdit ? 'Edytuj habit' : 'Nowy habit'}</span>
        <button
          type="button"
          onClick={onCancel}
          className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-muted hover:text-white"
          aria-label="Zamknij"
        >
          <X size={14} />
        </button>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="np. Bieg 5km, Czytanie 30 min, Medytacja"
        autoFocus
        className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm focus:border-accent-blue focus:outline-none"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {CATEGORIES.map((c) => {
          const meta = CATEGORY_META[c];
          const Icon = meta.icon;
          const active = category === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={active}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] border transition-colors"
              style={
                active
                  ? {
                      backgroundColor: `${meta.color}25`,
                      borderColor: `${meta.color}80`,
                      color: meta.color,
                    }
                  : { backgroundColor: 'transparent', borderColor: '#262636', color: '#8B8B9F' }
              }
            >
              <Icon size={12} />
              {meta.label}
            </button>
          );
        })}
        <span className="mx-1 h-4 w-px bg-border" />
        {PRIORITIES.map((p) => {
          const active = priority === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              aria-pressed={active}
              className="font-mono text-[11px] rounded-full size-7 flex items-center justify-center border transition-colors"
              style={
                active
                  ? {
                      backgroundColor: `${PRIORITY_BORDER[p]}25`,
                      borderColor: `${PRIORITY_BORDER[p]}80`,
                      color: PRIORITY_BORDER[p],
                    }
                  : { backgroundColor: 'transparent', borderColor: '#262636', color: '#8B8B9F' }
              }
            >
              {PRIORITY_LABEL[p]}
            </button>
          );
        })}
      </div>

      <HabitRecurrenceSelector value={recurrence} onChange={setRecurrence} />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setShowDurationPicker((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition-colors ${
            showDurationPicker || durationMin > 0
              ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
              : 'border-border bg-transparent text-muted hover:text-white'
          }`}
        >
          <Clock size={11} />
          {durationMin > 0
            ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}min`
            : 'Czas'}
        </button>
        <button
          type="button"
          onClick={() => setIsRegenerative((v) => !v)}
          aria-pressed={isRegenerative}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition-colors ${
            isRegenerative
              ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300'
              : 'border-border bg-transparent text-muted hover:text-white'
          }`}
        >
          <Leaf size={11} /> Regeneratywne
        </button>
        {durationMin > 0 && (
          <span
            className={`font-mono ${
              isRegenerative ? 'text-emerald-400' : 'text-amber-300'
            }`}
          >
            {isRegenerative
              ? `Zwrot: +${durationMin} AP`
              : `Koszt: -${durationMin} AP`}
          </span>
        )}
      </div>

      {showDurationPicker && (
        <DurationPicker
          value={durationMin}
          onChange={setDurationMin}
          isRegenerative={isRegenerative}
        />
      )}

      {error && <div className="text-xs text-accent-red">{error}</div>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-xs text-muted hover:text-white"
        >
          Anuluj
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="inline-flex items-center gap-1 rounded-md bg-accent-blue/15 border border-accent-blue/40 hover:bg-accent-blue/25 text-accent-blue px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          <Save size={12} /> Zapisz
        </button>
      </div>
    </div>
  );
}
