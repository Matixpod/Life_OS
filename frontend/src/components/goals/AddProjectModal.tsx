import { X } from 'lucide-react';
import { useState } from 'react';
import type { CreateProjectPayload, LifeArea, Priority } from '../../types';

interface AddProjectModalProps {
  open: boolean;
  lifeAreas: LifeArea[];
  onClose: () => void;
  onSubmit: (payload: CreateProjectPayload) => Promise<void>;
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 1, label: 'P1' },
  { value: 2, label: 'P2' },
  { value: 3, label: 'P3' },
];

export default function AddProjectModal({
  open,
  lifeAreas,
  onClose,
  onSubmit,
}: AddProjectModalProps) {
  const [title, setTitle] = useState('');
  const [areaId, setAreaId] = useState<string>('');
  const [why, setWhy] = useState('');
  const [priority, setPriority] = useState<Priority>(2);
  const [targetDate, setTargetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        life_area_id: areaId || null,
        why: why.trim() || null,
        priority,
        target_date: targetDate || null,
        status: 'active',
      });
      setTitle('');
      setAreaId('');
      setWhy('');
      setPriority(2);
      setTargetDate('');
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
            <div className="text-[11px] tracking-widest uppercase text-muted">New project</div>
            <h2 className="text-base font-medium mt-0.5">What do you want to build?</h2>
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
              placeholder="Project title"
              className="mt-2 w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue"
            />
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-muted">Life Area</label>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="mt-2 w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue"
            >
              <option value="">— None —</option>
              {lifeAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.icon} {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-muted">
              Why does this matter?
            </label>
            <textarea
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              rows={3}
              placeholder="Connect it to a deeper outcome — keeps you committed when motivation dips."
              className="mt-2 w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue resize-none"
            />
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
            <label className="text-[11px] tracking-widest uppercase text-muted">
              Target date (optional)
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="mt-2 w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent-blue"
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
              {submitting ? 'Saving…' : 'Create project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
