import { X } from 'lucide-react';
import { useState } from 'react';

interface PostponeModalProps {
  open: boolean;
  taskTitle: string;
  defaultDate: string;
  onClose: () => void;
  onConfirm: (reason: string, newDate: string) => void;
}

const QUICK_REASONS = [
  'Too big — needs breaking down',
  'No energy right now',
  'Blocked by something else',
  'Not a priority today',
];

export default function PostponeModal({
  open,
  taskTitle,
  defaultDate,
  onClose,
  onConfirm,
}: PostponeModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [date, setDate] = useState(defaultDate);

  if (!open) return null;

  const handleConfirm = () => {
    const reason = selected ?? custom.trim();
    if (!reason) return;
    onConfirm(reason, date);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-3 md:p-6 animate-fade-in"
    >
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] tracking-widest uppercase text-muted">Postpone task</div>
            <h2 className="text-base font-medium mt-0.5 truncate" title={taskTitle}>
              {taskTitle}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-[11px] tracking-widest uppercase text-muted mb-2">Why?</div>
            <div className="grid gap-2">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setSelected(r);
                    setCustom('');
                  }}
                  className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                    selected === r
                      ? 'bg-accent-blue/15 border-accent-blue text-white'
                      : 'bg-surface2 border-border hover:border-accent-blue/40'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Or write your own reason…"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setSelected(null);
              }}
              className="mt-2 w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue"
            />
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-muted">Move to</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
              onClick={handleConfirm}
              disabled={!selected && !custom.trim()}
              className="px-4 py-2 rounded-lg bg-accent-blue text-white text-sm font-medium disabled:opacity-40 hover:bg-accent-blue/90"
            >
              Postpone
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
