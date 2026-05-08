import { Check, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const PRESETS_MIN = [15, 30, 60, 90] as const;

export function labelForMinutes(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${(minutes / 60).toFixed(1).replace('.0', '')} h`;
}

interface Props {
  open: boolean;
  value: number;
  onChange: (minutes: number) => void;
  onClose: () => void;
}

export default function DurationPickerModal({ open, value, onChange, onClose }: Props) {
  const initialHours = value > 0 ? Math.floor(value / 60) : 0;
  const initialMinutes = value > 0 ? value % 60 : 0;
  const [hours, setHours] = useState(initialHours);
  const [minutes, setMinutes] = useState(initialMinutes);
  const firstChipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setHours(value > 0 ? Math.floor(value / 60) : 0);
    setMinutes(value > 0 ? value % 60 : 0);
    const id = window.setTimeout(() => firstChipRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const customTotal = Math.max(0, Math.min(600, hours * 60 + minutes));
  const canConfirmCustom = customTotal > 0;

  function pickPreset(min: number): void {
    onChange(min);
  }

  function confirmCustom(): void {
    if (!canConfirmCustom) return;
    onChange(customTotal);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="duration-picker-title"
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-3 md:p-6 animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 id="duration-picker-title" className="text-sm font-semibold">
            Czas trwania
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="text-muted hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {PRESETS_MIN.map((min, idx) => {
            const active = value === min;
            return (
              <button
                key={min}
                ref={idx === 0 ? firstChipRef : undefined}
                type="button"
                onClick={() => pickPreset(min)}
                aria-pressed={active}
                className={`rounded-lg border py-2 text-sm font-mono transition-colors ${
                  active
                    ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
                    : 'border-border bg-surface2 text-white hover:border-amber-400/40'
                }`}
              >
                {labelForMinutes(min)}
              </button>
            );
          })}
        </div>

        <div className="my-4 h-px bg-border" />

        <div>
          <div className="text-[11px] tracking-widest uppercase text-muted mb-2">
            Własny czas
          </div>
          <div className="flex items-center gap-2">
            <NumberStepper
              value={hours}
              onChange={setHours}
              min={0}
              max={8}
              step={1}
              suffix="h"
              ariaLabel="Godziny"
            />
            <NumberStepper
              value={minutes}
              onChange={setMinutes}
              min={0}
              max={55}
              step={5}
              suffix="m"
              ariaLabel="Minuty"
            />
            <span className="ml-auto font-mono text-xs text-muted">
              {customTotal > 0 ? labelForMinutes(customTotal) : '—'}
            </span>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-xs text-muted hover:text-white"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={confirmCustom}
            disabled={!canConfirmCustom}
            className="inline-flex items-center gap-1 rounded-md bg-accent-blue/15 border border-accent-blue/40 hover:bg-accent-blue/25 text-accent-blue px-3 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check size={12} /> Zatwierdź
          </button>
        </div>
      </div>
    </div>
  );
}

interface StepperProps {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
  ariaLabel: string;
}

function NumberStepper({ value, onChange, min, max, step, suffix, ariaLabel }: StepperProps) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <div
      className="flex items-center bg-surface2 border border-border rounded-md overflow-hidden"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        className="px-2 py-1.5 text-muted hover:text-white disabled:opacity-30"
        aria-label={`Zmniejsz ${suffix}`}
      >
        −
      </button>
      <div className="px-2 font-mono text-sm min-w-[3rem] text-center">
        {value}
        <span className="text-muted text-[10px] ml-0.5">{suffix}</span>
      </div>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        className="px-2 py-1.5 text-muted hover:text-white disabled:opacity-30"
        aria-label={`Zwiększ ${suffix}`}
      >
        +
      </button>
    </div>
  );
}
