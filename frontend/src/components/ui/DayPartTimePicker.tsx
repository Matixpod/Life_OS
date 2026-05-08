import type { DayPart } from '../../types';
import { DAY_PART_LABEL, DAY_PART_ORDER } from '../calendar/dayPart';

interface Props {
  dayPart: DayPart | null;
  onChange: (next: DayPart | null) => void;
}

/**
 * Day-part chips: Rano · Dzień · Wieczór. Click a selected chip to clear it.
 */
export default function DayPartTimePicker({ dayPart, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {DAY_PART_ORDER.map((dp) => {
        const active = dayPart === dp;
        return (
          <button
            key={dp}
            type="button"
            onClick={() => onChange(active ? null : dp)}
            aria-pressed={active}
            className={`rounded-full border px-2.5 py-1 transition-colors ${
              active
                ? 'border-accent-blue/60 bg-accent-blue/15 text-accent-blue'
                : 'border-border bg-transparent text-muted hover:text-white'
            }`}
          >
            {DAY_PART_LABEL[dp]}
          </button>
        );
      })}
    </div>
  );
}
