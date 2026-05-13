import { Sparkles, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { dailySystemApi } from '../../api/dailySystem';
import { api } from '../../services/api';
import type { DailyLog } from '../../types';
import { yesterdayIso } from '../../utils/date';

interface DailyBriefingModalProps {
  onComplete: (log: DailyLog) => void;
}

const DEFAULT_SLEEP = 60;
const DEFAULT_ENERGY = 60;

function trackBackground(value: number): string {
  // 0..30 = red, 31..70 = amber, 71..100 = emerald.
  const accent =
    value <= 30 ? '#ef4444' : value <= 70 ? '#f59e0b' : '#10b981';
  return `linear-gradient(to right, ${accent} 0%, ${accent} ${value}%, #1f1f2e ${value}%, #1f1f2e 100%)`;
}

function describe(value: number): string {
  if (value <= 30) return 'Niski';
  if (value <= 70) return 'Średni';
  return 'Wysoki';
}

function formatStaminaPool(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function formatDatePl(d: Date): string {
  return d.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Blocking modal that shows on the first app load each day.
 *
 * Cannot be dismissed without submitting — the stamina pool is the
 * foundation for every other Daily-System UI piece, so allowing the
 * user to skip would leave the rest of the dashboard in a stub state.
 */
export default function DailyBriefingModal({ onComplete }: DailyBriefingModalProps) {
  const [sleep, setSleep] = useState(DEFAULT_SLEEP);
  const [energy, setEnergy] = useState(DEFAULT_ENERGY);
  const [touched, setTouched] = useState({ sleep: false, energy: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [yesterdayMissing, setYesterdayMissing] = useState<boolean>(false);
  const [stepsValue, setStepsValue] = useState<number>(0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getStepsYesterday()
      .then((log) => {
        if (!cancelled && log === null) setYesterdayMissing(true);
      })
      .catch(() => {
        // Silent — the steps section is non-blocking by design.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const staminaPool = useMemo(
    () => Math.max(0, Math.min(600, Math.round(((sleep + energy) / 2) * 6))),
    [sleep, energy],
  );
  const canSubmit =
    touched.sleep && touched.energy && !submitting && !closing;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const log = await dailySystemApi.createLog({
        sleep_score: sleep,
        energy_score: energy,
      });
      if (yesterdayMissing && stepsValue > 0) {
        // Non-blocking — failure here shouldn't keep the modal open.
        try {
          await api.logSteps(yesterdayIso(), stepsValue);
        } catch {
          /* silent */
        }
      }
      setClosing(true);
      // Match the fade-out duration in the wrapper className below.
      window.setTimeout(() => onComplete(log), 220);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Inicjalizacja Dnia"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md transition-opacity duration-200 ${
        closing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        className={`w-full max-w-lg rounded-2xl border border-white/10 bg-[#12121A] p-8 shadow-2xl transition-all duration-200 ${
          closing ? 'scale-95 opacity-0' : 'scale-100 opacity-100 animate-briefing-in'
        }`}
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <Sparkles size={24} />
          </div>
          <div>
            <h2 className="font-sora text-xl font-semibold text-white">
              Inicjalizacja Dnia
            </h2>
            <p className="text-sm text-white/50">{formatDatePl(new Date())}</p>
          </div>
        </div>

        <div className="space-y-6">
          <SliderField
            label="😴 Jakość Snu"
            description={describe(sleep)}
            value={sleep}
            onChange={(v) => {
              setSleep(v);
              setTouched((t) => ({ ...t, sleep: true }));
            }}
          />
          <SliderField
            label="⚡ Poziom Energii"
            description={describe(energy)}
            value={energy}
            onChange={(v) => {
              setEnergy(v);
              setTouched((t) => ({ ...t, energy: true }));
            }}
          />
        </div>

        {yesterdayMissing && (
          <div className="mt-6 border-t border-white/5 pt-4">
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              Opcjonalnie
            </p>
            <p className="mt-2 flex items-center gap-2 font-sora text-sm text-white/80">
              🦶 Ile kroków zrobiłeś wczoraj?
            </p>
            <div className="mt-3 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setStepsValue((v) => Math.max(0, v - 1000))}
                className="h-9 w-9 rounded-md border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
              >
                −
              </button>
              <div className="w-28 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-center font-mono text-base text-white">
                {stepsValue.toLocaleString('pl-PL').replace(/,/g, ' ')}
              </div>
              <button
                type="button"
                onClick={() => setStepsValue((v) => Math.min(50000, v + 1000))}
                className="h-9 w-9 rounded-md border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
              >
                +
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-white/30">
              Pole opcjonalne — możesz pominąć
            </p>
          </div>
        )}

        <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-amber-400/70">
            💪 Stamina na dziś
          </p>
          <p className="mt-2 font-mono text-3xl font-bold text-amber-400">
            {staminaPool}
            <span className="ml-1 text-base font-medium text-amber-400/60">min</span>
          </p>
          <p className="mt-1 font-mono text-sm text-white/40">
            (~{formatStaminaPool(staminaPool)})
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-sora text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
        >
          <Zap size={18} />
          {submitting ? 'Inicjalizuję…' : 'Inicjalizuj Dzień'}
        </button>
      </div>
    </div>
  );
}

interface SliderFieldProps {
  label: string;
  description: string;
  value: number;
  onChange: (next: number) => void;
}

function SliderField({ label, description, value, onChange }: SliderFieldProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-sora text-sm font-medium text-white/85">{label}</span>
        <span className="font-mono text-sm text-white/60">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
        className="briefing-slider h-2 w-full cursor-pointer appearance-none rounded-full"
        style={{ background: trackBackground(value) }}
      />
      <p className="mt-1 text-xs text-white/40">{description}</p>
    </div>
  );
}
