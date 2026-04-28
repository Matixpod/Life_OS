import type { LucideIcon } from 'lucide-react';
import { Brain, Moon, Pill, Target } from 'lucide-react';

interface ActivityEvent {
  time: string;
  action: string;
  icon: LucideIcon;
}

const PLACEHOLDER: ActivityEvent[] = [
  { time: '07:12', action: 'Logged 7h 30m sleep', icon: Moon },
  { time: '08:04', action: 'Took morning supplements', icon: Pill },
  { time: '10:32', action: 'Started cognitive challenge', icon: Brain },
  { time: '11:48', action: 'Marked 2 daily goals complete', icon: Target },
];

interface ActivityTimelineProps {
  events?: ActivityEvent[];
}

export default function ActivityTimeline({ events = PLACEHOLDER }: ActivityTimelineProps) {
  return (
    <div className="rounded-xl bg-surface border border-border p-5">
      <div className="text-[11px] tracking-widest uppercase text-muted mb-4">Today's Activity</div>
      <ol className="relative pl-5">
        <span className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
        {events.map((e, i) => (
          <li key={i} className="relative mb-4 last:mb-0">
            <span className="absolute -left-3.5 top-1 size-3 rounded-full bg-surface border border-accent-blue/60" />
            <div className="flex items-center gap-3">
              <e.icon size={14} className="text-muted shrink-0" />
              <span className="font-mono text-xs text-muted">{e.time}</span>
              <span className="text-sm">{e.action}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
