import { Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatMmSs, todayIso } from '../utils/date';

interface TimerState {
  startedAt: number | null; // ms epoch when last started; null if paused/idle
  duration: number; // total duration in seconds
  elapsed: number; // accumulated elapsed seconds across resumes
}

interface ChallengeTimerProps {
  durationSeconds: number;
  onExpire: () => void;
}

const SIZE = 220;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function storageKey() {
  return `lifeos_timer_${todayIso()}`;
}

function loadState(duration: number): TimerState {
  if (typeof window === 'undefined') return { startedAt: null, duration, elapsed: 0 };
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return { startedAt: null, duration, elapsed: 0 };
    const parsed = JSON.parse(raw) as Partial<TimerState>;
    return {
      startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : null,
      duration: typeof parsed.duration === 'number' ? parsed.duration : duration,
      elapsed: typeof parsed.elapsed === 'number' ? parsed.elapsed : 0,
    };
  } catch {
    return { startedAt: null, duration, elapsed: 0 };
  }
}

function saveState(s: TimerState) {
  localStorage.setItem(storageKey(), JSON.stringify(s));
}

function computeRemaining(s: TimerState): number {
  const elapsed = s.startedAt ? s.elapsed + (Date.now() - s.startedAt) / 1000 : s.elapsed;
  return Math.max(0, s.duration - elapsed);
}

export default function ChallengeTimer({ durationSeconds, onExpire }: ChallengeTimerProps) {
  const [state, setState] = useState<TimerState>(() => loadState(durationSeconds));
  const [now, setNow] = useState(() => Date.now());
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!state.startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [state.startedAt]);

  const remaining = computeRemaining({ ...state });
  const _ = now; // ensure remaining recomputes by depending on `now`
  void _;

  useEffect(() => {
    if (remaining <= 0 && state.startedAt && !expiredRef.current) {
      expiredRef.current = true;
      const stopped: TimerState = {
        startedAt: null,
        duration: state.duration,
        elapsed: state.duration,
      };
      saveState(stopped);
      setState(stopped);
      onExpire();
    }
  }, [remaining, state.startedAt, state.duration, onExpire]);

  const start = () => {
    const next: TimerState = { ...state, startedAt: Date.now() };
    saveState(next);
    setState(next);
  };

  const pause = () => {
    if (!state.startedAt) return;
    const accumulated = state.elapsed + (Date.now() - state.startedAt) / 1000;
    const next: TimerState = { ...state, startedAt: null, elapsed: accumulated };
    saveState(next);
    setState(next);
  };

  const reset = () => {
    const fresh: TimerState = { startedAt: null, duration: durationSeconds, elapsed: 0 };
    saveState(fresh);
    setState(fresh);
    expiredRef.current = false;
  };

  const fraction = state.duration > 0 ? remaining / state.duration : 0;
  const offset = CIRCUMFERENCE * (1 - fraction);
  const ringColor =
    fraction > 0.5 ? '#10B981' : fraction > 0.2 ? '#F59E0B' : '#EF4444';
  const isRunning = state.startedAt !== null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="#1A1A24"
            strokeWidth={STROKE}
            fill="none"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={ringColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: 'stroke 0.4s' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-5xl font-bold tracking-tight">{formatMmSs(remaining)}</div>
          <div className="text-[11px] tracking-widest uppercase text-muted mt-1">
            {isRunning ? 'Running' : remaining === 0 ? 'Expired' : 'Idle'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isRunning ? (
          <button
            onClick={pause}
            className="px-4 py-2 rounded-md bg-surface border border-border hover:border-accent-blue/40 text-sm flex items-center gap-2"
          >
            <Pause size={14} /> Pause
          </button>
        ) : (
          <button
            onClick={start}
            disabled={remaining === 0}
            className="px-4 py-2 rounded-md bg-accent-blue text-white text-sm flex items-center gap-2 disabled:opacity-40"
          >
            <Play size={14} /> Start
          </button>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 rounded-md bg-surface border border-border hover:border-accent-blue/40 text-sm flex items-center gap-2"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </div>
  );
}
