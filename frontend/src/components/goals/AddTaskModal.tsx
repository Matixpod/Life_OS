import { X } from 'lucide-react';
import { useState } from 'react';
import type { CreateTaskPayload, Priority, Project } from '../../types';

interface AddTaskModalProps {
  open: boolean;
  date: string;
  projects: Project[];
  onClose: () => void;
  onSubmit: (payload: CreateTaskPayload) => Promise<void>;
}

const TIME_OPTIONS = [15, 30, 45, 60, 90, 120];
const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 1, label: 'P1' },
  { value: 2, label: 'P2' },
  { value: 3, label: 'P3' },
];

export default function AddTaskModal({ open, date, projects, onClose, onSubmit }: AddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [priority, setPriority] = useState<Priority>(2);
  const [estimated, setEstimated] = useState<number>(30);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const reset = () => {
    setTitle('');
    setProjectId('');
    setPriority(2);
    setEstimated(30);
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    const project = projects.find((p) => p.id === projectId);
    try {
      await onSubmit({
        title: title.trim(),
        date,
        project_id: project?.id ?? null,
        life_area_id: project?.life_area_id ?? null,
        priority,
        estimated_minutes: estimated,
        notes: notes.trim() || null,
      });
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-3 md:p-6 animate-fade-in"
    >
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[11px] tracking-widest uppercase text-muted">Add task</div>
            <h2 className="text-base font-medium mt-0.5">{date}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] tracking-widest uppercase text-muted">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to get done?"
              className="mt-2 w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue"
            />
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-muted">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-2 w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue"
            >
              <option value="">— None —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.life_area?.icon ?? ''} {p.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-muted">Priority</label>
            <div className="mt-2 flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`flex-1 py-2 rounded-md border text-sm font-mono transition-colors ${
                    priority === p.value
                      ? 'bg-accent-blue/15 border-accent-blue text-white'
                      : 'bg-surface2 border-border hover:border-accent-blue/40'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-muted">Estimated time</label>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {TIME_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setEstimated(m)}
                  className={`py-2 rounded-md border text-xs font-mono transition-colors ${
                    estimated === m
                      ? 'bg-accent-blue/15 border-accent-blue text-white'
                      : 'bg-surface2 border-border hover:border-accent-blue/40'
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-muted">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-2 w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue resize-none"
              placeholder="How to start, context, etc."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted hover:text-white px-3 py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!title.trim() || submitting}
              className="px-4 py-2 rounded-lg bg-accent-blue text-white text-sm font-medium disabled:opacity-40 hover:bg-accent-blue/90"
            >
              {submitting ? 'Saving…' : 'Add task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
