import { Save, X } from 'lucide-react';
import { useState } from 'react';
import { projectsApi } from '../../api/projects';
import type { ProjectV2, ProjectV2CreatePayload, ProjectV2UpdatePayload, TaskCategory, TaskPriority } from '../../types';
import { CATEGORY_COLORS } from '../../types';
import { CATEGORIES, CATEGORY_META, PRIORITY_BORDER, PRIORITY_LABEL } from '../tasks/categories';

interface Props {
  initial?: ProjectV2;
  onCreated: () => void;
  onCancel: () => void;
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];

export default function ProjectForm({ initial, onCreated, onCancel }: Props) {
  const isEdit = initial !== undefined;
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState<TaskCategory>(initial?.category ?? 'other');
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '');
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
        const payload: ProjectV2UpdatePayload = {
          title: trimmed,
          description: description.trim() || null,
          category,
          priority,
          due_date: dueDate || null,
          color: CATEGORY_COLORS[category].hex,
        };
        await projectsApi.update(initial.id, payload);
      } else {
        const payload: ProjectV2CreatePayload = {
          title: trimmed,
          description: description.trim() || null,
          category,
          priority,
          due_date: dueDate || null,
          color: CATEGORY_COLORS[category].hex,
        };
        await projectsApi.create(payload);
      }
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Nowy projekt</span>
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
        placeholder="Nazwa projektu"
        autoFocus
        className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm focus:border-accent-blue focus:outline-none"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Opis (opcjonalnie)"
        rows={3}
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
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors"
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

      <label className="block text-xs text-muted">
        Termin (opcjonalnie):
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="ml-2 rounded-md border border-border bg-surface2 px-2 py-1 font-mono text-xs focus:border-accent-blue focus:outline-none"
        />
      </label>

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
