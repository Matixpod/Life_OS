import { Minus, Plus, Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { MOOD_MAP, type MorningMoodEmoji } from '../types';
import { todayIso } from '../utils/date';

interface MorningPopupProps {
  onClose: () => void;
}

const MOOD_OPTIONS: MorningMoodEmoji[] = ['😴', '😕', '😐', '🙂', '⚡'];

export default function MorningPopup({ onClose }: MorningPopupProps) {
  const [hours, setHours] = useState(7);
  const [minutes, setMinutes] = useState(30);
  const [quality, setQuality] = useState(0);
  const [energy, setEnergy] = useState(70);
  const [mood, setMood] = useState<MorningMoodEmoji | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const canSubmit = mood !== null && quality > 0 && !submitting;
  const date = todayIso();
  const moodScore = mood ? MOOD_MAP[mood] : null;

  const handleSubmit = async () => {
    if (!mood || !moodScore) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.logSleep({
        date,
        duration_minutes: hours * 60 + minutes,
        quality_score: quality,
        energy_score: energy,
        morning_mood: moodScore,
      });
      localStorage.setItem(
        `lifeos_morning_${date}`,
        JSON.stringify({ submitted: true, at: new Date().toISOString() }),
      );
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to log sleep');
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(
      `lifeos_morning_${date}`,
      JSON.stringify({ skipped: true, at: new Date().toISOString() }),
    );
    onClose();
  };

  const energyColor =
    energy < 33 ? 'from-accent-red to-accent-amber' :
    energy < 66 ? 'from-accent-amber to-accent-blue' :
                  'from-accent-blue to-accent-emerald';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="morning-title"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-3 md:p-6 animate-fade-in"
    >
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 md:p-8 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[11px] tracking-widest uppercase text-muted">Good morning</div>
            <h2 id="morning-title" className="text-xl font-semibold mt-0.5">How did you sleep?</h2>
          </div>
          <button
            onClick={handleSkip}
            aria-label="Close"
            className="text-muted hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-[11px] tracking-widest uppercase text-muted">Sleep duration</label>
            <div className="mt-2 flex items-center gap-3">
              <Stepper value={hours} setValue={setHours} min={0} max={12} suffix="h" />
              <Stepper value={minutes} setValue={setMinutes} min={0} max={59} step={5} suffix="m" />
            </div>
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-muted">Quality</label>
            <div className="mt-2 flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} stars`}
                  onClick={() => setQuality(n)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    size={28}
                    className={n <= quality ? 'text-accent-amber fill-accent-amber' : 'text-muted'}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] tracking-widest uppercase text-muted">Energy</label>
              <span className="font-mono text-sm">{energy}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
              className={`mt-2 w-full h-2 rounded-full appearance-none bg-gradient-to-r ${energyColor}`}
              aria-label="Energy score"
            />
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-muted">Mood</label>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {MOOD_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(m)}
                  className={`text-2xl py-2 rounded-lg border transition-colors ${
                    mood === m
                      ? 'bg-accent-blue/20 border-accent-blue'
                      : 'bg-surface2 border-border hover:border-accent-blue/40'
                  }`}
                  aria-label={`Mood ${m}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="text-sm text-accent-red">{error}</div>}

          <div className="flex flex-col-reverse md:flex-row md:justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm text-muted hover:text-white"
            >
              Skip today
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-5 py-2.5 rounded-lg bg-accent-blue text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-blue/90 transition-colors"
            >
              {submitting ? 'Saving…' : 'Start my day →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StepperProps {
  value: number;
  setValue: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix: string;
}

function Stepper({ value, setValue, min, max, step = 1, suffix }: StepperProps) {
  const dec = () => setValue(Math.max(min, value - step));
  const inc = () => setValue(Math.min(max, value + step));
  return (
    <div className="flex items-center bg-surface2 border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={dec}
        className="px-3 py-2 text-muted hover:text-white"
        aria-label={`decrease ${suffix}`}
      >
        <Minus size={14} />
      </button>
      <div className="px-3 font-mono text-base min-w-[3.5rem] text-center">
        {value}
        <span className="text-muted text-xs ml-0.5">{suffix}</span>
      </div>
      <button
        type="button"
        onClick={inc}
        className="px-3 py-2 text-muted hover:text-white"
        aria-label={`increase ${suffix}`}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
