import { Check, Dumbbell, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface WorkoutCompleteModalProps {
  taskTitle: string;
  estimatedMinutes: number;
  onConfirm: (duration: number, avgHr: number | null) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export default function WorkoutCompleteModal({
  taskTitle,
  estimatedMinutes,
  onConfirm,
  onSkip,
  onCancel,
}: WorkoutCompleteModalProps) {
  const [duration, setDuration] = useState<string>(
    estimatedMinutes > 0 ? String(estimatedMinutes) : '60',
  );
  const [avgHr, setAvgHr] = useState<string>('');
  const durationRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    durationRef.current?.focus();
    durationRef.current?.select();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onCancel]);

  const durationN = Number(duration);
  const avgHrN = avgHr.trim() ? Number(avgHr) : null;
  const canSubmit = durationN > 0 && Number.isFinite(durationN);

  function handleSubmit(): void {
    if (!canSubmit) return;
    onConfirm(Math.max(1, Math.min(300, Math.round(durationN))), avgHrN);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-complete-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
              <Dumbbell size={14} className="text-accent-orange" />
              <span id="workout-complete-title" className="truncate">
                {taskTitle}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted">Podaj dane treningu</div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Zamknij"
            className="text-muted hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted">
              Czas treningu
            </label>
            <div className="mt-1 inline-flex items-center gap-2">
              <input
                ref={durationRef}
                type="number"
                min={1}
                max={300}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                onKeyDown={onKeyDown}
                className="w-24 rounded-lg border border-border bg-surface2 px-3 py-2 text-center font-mono text-white focus:border-accent-orange focus:outline-none"
              />
              <span className="text-xs text-muted">min</span>
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted">
              Średnie tętno <span className="text-muted/70">(opcjonalne)</span>
            </label>
            <div className="mt-1 inline-flex items-center gap-2">
              <input
                type="number"
                min={40}
                max={220}
                value={avgHr}
                onChange={(e) => setAvgHr(e.target.value)}
                onKeyDown={onKeyDown}
                className="w-24 rounded-lg border border-border bg-surface2 px-3 py-2 text-center font-mono text-white focus:border-accent-orange focus:outline-none"
              />
              <span className="text-xs text-muted">bpm</span>
            </div>
          </div>

          <div className="rounded-md border border-border bg-surface2/60 px-3 py-2 text-[11px] text-muted">
            💡 Tętno pozwoli obliczyć spalone kalorie i spalony tłuszcz.
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-xs text-muted hover:text-white"
          >
            Pomiń
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-xs text-muted hover:text-white"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-accent-orange to-amber-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              <Check size={12} /> Zapisz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
