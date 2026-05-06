import { useEffect, useMemo, useRef } from 'react';

interface DurationPickerProps {
  /** Currently selected total minutes. */
  value: number;
  onChange: (minutes: number) => void;
  /** Tweaks the AP-cost preview shown under the picker. */
  isRegenerative?: boolean;
  /** Hide the AP preview when the picker is embedded in a form. */
  hideAPPreview?: boolean;
}

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i); // 0..12
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,…,55
const ITEM_HEIGHT = 40;
const VISIBLE_PADDING = 2; // items above and below the centre

function splitMinutes(total: number): { hours: number; minutes: number } {
  const safeTotal = Math.max(0, Math.min(12 * 60 + 55, total));
  // Snap to the nearest 5-minute multiple so the DB value always matches a
  // valid slot in the picker (otherwise the wheel would drift on every load).
  const snapped = Math.round(safeTotal / 5) * 5;
  return { hours: Math.floor(snapped / 60), minutes: snapped % 60 };
}

/**
 * iOS-alarm-style drum-roll picker for task duration.
 *
 * Two scrollable columns (hours, minutes). The selected value is whatever
 * sits in the centre line. We listen to `scroll` and snap the resolved
 * index → minutes back through `onChange` so the parent always has the
 * canonical total.
 */
export default function DurationPicker({
  value,
  onChange,
  isRegenerative = false,
  hideAPPreview = false,
}: DurationPickerProps) {
  const { hours, minutes } = useMemo(() => splitMinutes(value), [value]);

  const hoursRef = useRef<HTMLDivElement | null>(null);
  const minutesRef = useRef<HTMLDivElement | null>(null);

  // Drive scroll position from the controlled value.
  useEffect(() => {
    if (hoursRef.current) {
      hoursRef.current.scrollTop = hours * ITEM_HEIGHT;
    }
    if (minutesRef.current) {
      const idx = MINUTE_OPTIONS.indexOf(minutes);
      minutesRef.current.scrollTop = (idx >= 0 ? idx : 0) * ITEM_HEIGHT;
    }
  }, [hours, minutes]);

  const emit = (h: number, m: number) => {
    onChange(h * 60 + m);
  };

  const handleHoursScroll = () => {
    const el = hoursRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(HOUR_OPTIONS.length - 1, idx));
    if (clamped !== hours) emit(clamped, minutes);
  };

  const handleMinutesScroll = () => {
    const el = minutesRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(MINUTE_OPTIONS.length - 1, idx));
    const m = MINUTE_OPTIONS[clamped];
    if (m !== minutes) emit(hours, m);
  };

  const total = hours * 60 + minutes;

  return (
    <div className="rounded-xl border border-white/10 bg-[#161622] p-4">
      <p className="mb-3 font-sora text-sm text-white/70">Czas trwania zadania</p>

      <div className="relative flex items-center justify-center gap-6">
        {/* Centre highlight stripe — purely decorative. */}
        <div
          className="pointer-events-none absolute inset-x-2 rounded-md border-y border-white/10 bg-white/5"
          style={{ top: ITEM_HEIGHT * VISIBLE_PADDING, height: ITEM_HEIGHT }}
        />

        <Column
          innerRef={hoursRef}
          options={HOUR_OPTIONS}
          selected={hours}
          unitLabel="godz."
          onScroll={handleHoursScroll}
        />
        <Column
          innerRef={minutesRef}
          options={MINUTE_OPTIONS}
          selected={minutes}
          unitLabel="min."
          onScroll={handleMinutesScroll}
        />
      </div>

      <div className="mt-3 text-center font-mono text-sm text-white/60">
        Łącznie:{' '}
        <span className="text-white">
          {hours > 0 ? `${hours}h ` : ''}
          {minutes}min
        </span>
      </div>

      {!hideAPPreview && (
        <p
          className={`mt-1 text-center font-mono text-xs ${
            total === 0
              ? 'text-white/40'
              : isRegenerative
                ? 'text-emerald-400'
                : 'text-red-400'
          }`}
        >
          {total === 0
            ? 'Bez limitu'
            : isRegenerative
              ? `Zwrot: +${total} AP`
              : `Koszt: -${total} AP`}
        </p>
      )}
    </div>
  );
}

interface ColumnProps {
  innerRef: React.MutableRefObject<HTMLDivElement | null>;
  options: number[];
  selected: number;
  unitLabel: string;
  onScroll: () => void;
}

function Column({ innerRef, options, selected, unitLabel, onScroll }: ColumnProps) {
  return (
    <div className="flex flex-col items-center">
      <div
        ref={innerRef}
        onScroll={onScroll}
        className="duration-column h-[200px] w-[80px] overflow-y-scroll"
        style={{ scrollPaddingTop: ITEM_HEIGHT * VISIBLE_PADDING }}
      >
        <div style={{ height: ITEM_HEIGHT * VISIBLE_PADDING }} />
        {options.map((opt) => {
          const isActive = opt === selected;
          return (
            <div
              key={opt}
              className={`duration-item flex items-center justify-center font-mono transition-all ${
                isActive
                  ? 'text-2xl font-bold text-white'
                  : 'text-base text-white/35'
              }`}
              style={{ height: ITEM_HEIGHT }}
            >
              {opt.toString().padStart(2, '0')}
            </div>
          );
        })}
        <div style={{ height: ITEM_HEIGHT * VISIBLE_PADDING }} />
      </div>
      <p className="mt-1 text-xs text-white/50">{unitLabel}</p>
    </div>
  );
}
