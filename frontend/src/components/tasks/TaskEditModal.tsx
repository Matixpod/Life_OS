import { Save, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DayPart, Task, TaskCategory, TaskPriority, TaskUpdatePayload } from '../../types';
import DayPartTimePicker from '../ui/DayPartTimePicker';
import { CATEGORIES, CATEGORY_META, PRIORITY_BORDER, PRIORITY_LABEL } from './categories';

interface Props {
  task: Task;
  onSave: (id: string, payload: TaskUpdatePayload) => Promise<void>;
  onClose: () => void;
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];

export default function TaskEditModal({ task, onSave, onClose }: Props) {
  const [title, setTitle] = useState(task.title);
  const [category, setCategory] = useState<TaskCategory>(task.category ?? 'health');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [scheduledDate, setScheduledDate] = useState(task.scheduled_date ?? '');
  const [estimatedMin, setEstimatedMin] = useState<string>(
    task.estimated_minutes != null ? String(task.estimated_minutes) : '',
  );
  const [notes, setNotes] = useState(task.notes ?? '');
  const [dayPart, setDayPart] = useState<DayPart | null>(task.day_part ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSave(): Promise<void> {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Tytuł jest wymagany.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: TaskUpdatePayload = {
        title: trimmed,
        category,
        priority,
        scheduled_date: scheduledDate || null,
        estimated_minutes: estimatedMin
          ? Math.max(5, Math.min(480, Number(estimatedMin)))
          : null,
        notes: notes.trim() ? notes.trim() : null,
        day_part: dayPart,
      };
      await onSave(task.id, payload);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 md:pt-24 animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-4 shadow-xl space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Edytuj zadanie</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-muted hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSave();
            }
          }}
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

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-[11px] uppercase tracking-widest text-muted">
            Data
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full rounded-md border border-border bg-surface2 px-2 py-1.5 font-mono text-xs focus:border-accent-blue focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-[11px] uppercase tracking-widest text-muted">
            Czas (min)
            <input
              type="number"
              min={5}
              max={480}
              step={5}
              value={estimatedMin}
              onChange={(e) => setEstimatedMin(e.target.value)}
              placeholder="—"
              className="w-full rounded-md border border-border bg-surface2 px-2 py-1.5 font-mono text-xs text-center focus:border-accent-blue focus:outline-none"
            />
          </label>
        </div>

        <DayPartTimePicker dayPart={dayPart} onChange={setDayPart} />

        <label className="block space-y-1 text-[11px] uppercase tracking-widest text-muted">
          Notatka
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Opcjonalne…"
            className="w-full resize-none rounded-md border border-border bg-surface2 px-2 py-1.5 text-xs normal-case tracking-normal text-white focus:border-accent-blue focus:outline-none"
          />
        </label>

        {error && <div className="text-[11px] text-accent-red">{error}</div>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-xs text-muted hover:text-white"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={submitting}
            className="inline-flex items-center gap-1 rounded-md border border-accent-blue/40 bg-accent-blue/15 px-3 py-1.5 text-xs font-medium text-accent-blue hover:bg-accent-blue/25 disabled:opacity-50"
          >
            <Save size={12} /> Zapisz
          </button>
        </div>
      </div>
    </div>
  );
}
