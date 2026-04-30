import { Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { useTasks } from '../../hooks/useTasks';
import type { TaskCategory, TaskPriority } from '../../types';
import { CATEGORIES, CATEGORY_META, PRIORITY_BORDER, PRIORITY_LABEL } from './categories';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];

/**
 * Always-visible task input bar. `N` from anywhere focuses the title input
 * (unless the user is already typing in another field — the keyboard
 * shortcut hook handles that). Submission requires a category and a
 * non-blank title; empty submit triggers a shake animation on the input.
 */
export default function QuickAdd() {
  const { createTask } = useTasks();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('vitality');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [estimatedMin, setEstimatedMin] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcut('n', () => inputRef.current?.focus());

  const today = new Date().toISOString().slice(0, 10);

  async function submit(): Promise<void> {
    const trimmed = title.trim();
    if (!trimmed) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await createTask({
        title: trimmed,
        category,
        priority,
        scheduled_date: today,
        estimated_minutes: estimatedMin ? Math.max(5, Math.min(480, Number(estimatedMin))) : null,
      });
      setTitle('');
      setEstimatedMin('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add task');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl bg-surface border border-border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
            if (e.key === 'Escape') {
              setTitle('');
              setEstimatedMin('');
              inputRef.current?.blur();
            }
          }}
          placeholder="Add a task… (press N)"
          aria-label="New task title"
          className={`flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-sm placeholder:text-muted py-2 px-2 rounded-md ${
            shake ? 'animate-shake border border-accent-red/60' : ''
          }`}
        />
        <input
          type="number"
          min={5}
          max={480}
          step={5}
          value={estimatedMin}
          onChange={(e) => setEstimatedMin(e.target.value)}
          placeholder="min"
          aria-label="Estimated minutes"
          className="w-16 bg-surface2 border border-border rounded-md px-2 py-1.5 text-xs font-mono text-center placeholder:text-muted focus:outline-none focus:border-accent-blue"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="shrink-0 inline-flex items-center gap-1 rounded-md bg-accent-blue/15 border border-accent-blue/40 hover:bg-accent-blue/25 text-accent-blue px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
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
                  : {
                      backgroundColor: 'transparent',
                      borderColor: '#262636',
                      color: '#8B8B9F',
                    }
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
                  : {
                      backgroundColor: 'transparent',
                      borderColor: '#262636',
                      color: '#8B8B9F',
                    }
              }
            >
              {PRIORITY_LABEL[p]}
            </button>
          );
        })}
      </div>

      {error && <div className="text-[11px] text-accent-red">{error}</div>}
    </div>
  );
}
