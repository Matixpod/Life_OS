import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

const PRESETS_MIN = [15, 30, 60, 90] as const;

function labelFor(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${(minutes / 60).toFixed(1).replace('.0', '')} h`;
}

interface Props {
  value: number;
  onChange: (minutes: number) => void;
}

/**
 * Collapsed by default behind a "Czas" button. Click to reveal preset chips
 * (15 min · 30 min · 1 h · 1.5 h) plus a "Własny" custom-minute input.
 * Once a value is selected, the trigger label switches to that value.
 * `value === 0` means no duration set; clicking an active preset clears it.
 */
export default function DurationChips({ value, onChange }: Props) {
  const isPreset = value > 0 && (PRESETS_MIN as readonly number[]).includes(value);
  const isCustom = value > 0 && !isPreset;

  const [expanded, setExpanded] = useState(false);
  const [showCustom, setShowCustom] = useState(isCustom);
  const [draft, setDraft] = useState<string>(isCustom ? String(value) : '');

  useEffect(() => {
    if (isCustom) {
      setDraft(String(value));
      setShowCustom(true);
    }
  }, [isCustom, value]);

  function pickPreset(min: number): void {
    if (value === min) {
      onChange(0);
      return;
    }
    setShowCustom(false);
    onChange(min);
  }

  function toggleCustom(): void {
    if (showCustom && isCustom) {
      onChange(0);
      setDraft('');
      setShowCustom(false);
      return;
    }
    setShowCustom((v) => !v);
  }

  function commitCustom(raw: string): void {
    setDraft(raw);
    if (!raw) {
      onChange(0);
      return;
    }
    const n = Math.max(1, Math.min(600, Number(raw)));
    if (Number.isFinite(n)) onChange(n);
  }

  const triggerActive = expanded || value > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition-colors ${
          triggerActive
            ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
            : 'border-border bg-transparent text-muted hover:text-white'
        }`}
      >
        <Clock size={11} />
        {value > 0 ? labelFor(value) : 'Czas'}
      </button>

      {expanded && (
        <>
          {PRESETS_MIN.map((min) => {
            const active = value === min;
            return (
              <button
                key={min}
                type="button"
                onClick={() => pickPreset(min)}
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-1 transition-colors ${
                  active
                    ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
                    : 'border-border bg-transparent text-muted hover:text-white'
                }`}
              >
                {labelFor(min)}
              </button>
            );
          })}

          <button
            type="button"
            onClick={toggleCustom}
            aria-pressed={showCustom}
            className={`rounded-full border px-2.5 py-1 transition-colors ${
              isCustom || showCustom
                ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
                : 'border-border bg-transparent text-muted hover:text-white'
            }`}
          >
            Własny
          </button>

          {showCustom && (
            <div className="inline-flex items-center gap-1 rounded-md border border-border bg-surface2 px-2 py-1 font-mono">
              <input
                type="number"
                min={1}
                max={600}
                value={draft}
                onChange={(e) => commitCustom(e.target.value)}
                placeholder="min"
                aria-label="Własny czas (min)"
                className="w-14 bg-transparent text-center text-xs focus:outline-none"
              />
              <span className="text-muted">min</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
