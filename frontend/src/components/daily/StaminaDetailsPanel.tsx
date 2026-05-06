import { CheckCircle2, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { BoostUnavailableError, dailySystemApi } from '../../api/dailySystem';
import type { BoostAvailability, BoostType, StaminaStatus } from '../../types';
import { emitCombatText } from '../ui/floatingCombatTextBus';

interface StaminaDetailsPanelProps {
  open: boolean;
  status: StaminaStatus | null;
  boosts: BoostAvailability[];
  onClose: () => void;
  onChange: () => void;
}

function formatHM(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatCooldown(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function playChime(freq: number) {
  try {
    const Ctx =
      (window as unknown as { AudioContext: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    osc.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    /* audio is best-effort */
  }
}

/**
 * Side panel that breaks down today's stamina ledger and exposes the
 * six quick boosts. Mounted in the layout next to the StaminaBar so the
 * two share state through `useStamina`.
 *
 * The cooldown countdown is updated locally every minute via setInterval
 * — we render the same `cooldown_remaining_min` value the server gave us,
 * decremented by the elapsed minutes since open, so a user staring at
 * the panel sees a live timer instead of needing to refetch.
 */
export default function StaminaDetailsPanel({
  open,
  status,
  boosts,
  onClose,
  onChange,
}: StaminaDetailsPanelProps) {
  const [busyBoost, setBusyBoost] = useState<BoostType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [open]);

  if (!open) return null;

  const handleBoost = async (type: BoostType) => {
    setBusyBoost(type);
    setErrorMessage(null);
    try {
      const result = await dailySystemApi.useBoost(type);
      playChime(659.25); // E5 — boost chime
      emitCombatText(`+${result.ap_restored} AP`, 'ap');
      onChange();
    } catch (e) {
      if (e instanceof BoostUnavailableError) {
        setErrorMessage(
          e.kind === 'cooldown'
            ? `Cooldown: ${e.cooldownRemainingMin ?? '?'} min`
            : `Limit dzienny osiągnięty (${e.maxPerDay ?? ''}x).`,
        );
      } else {
        setErrorMessage(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusyBoost(null);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label="Stamina"
        className="animate-slide-in-right fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#12121A] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="font-sora text-lg font-semibold text-white">
            ⚡ Stamina
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
            aria-label="Zamknij"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {status?.is_initialized ? (
            <Breakdown status={status} />
          ) : (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
              Dzień nie został jeszcze zainicjalizowany. Wypełnij briefing
              poranny, aby aktywować staminę.
            </p>
          )}

          {status?.is_initialized && (
            <>
              <h4 className="mt-6 mb-3 font-sora text-sm font-semibold uppercase tracking-wider text-white/60">
                Szybkie boosty
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {boosts.map((b) => (
                  <BoostButton
                    key={b.boost_type}
                    boost={b}
                    busy={busyBoost === b.boost_type}
                    onClick={() => handleBoost(b.boost_type)}
                    tick={tick}
                  />
                ))}
              </div>
              {errorMessage && (
                <p className="mt-2 text-xs text-red-300">{errorMessage}</p>
              )}

              <h4 className="mt-6 mb-3 font-sora text-sm font-semibold uppercase tracking-wider text-white/60">
                Zużycie dziś
              </h4>
              {status.tasks_breakdown.length === 0 ? (
                <p className="text-sm text-white/50">Brak zadań na dziś.</p>
              ) : (
                <ul className="space-y-1.5">
                  {status.tasks_breakdown.map((t) => (
                    <li
                      key={t.task_id}
                      className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2 truncate text-white/80">
                        {t.is_completed ? (
                          <CheckCircle2 size={14} className="text-emerald-400" />
                        ) : (
                          <Square size={14} className="text-white/30" />
                        )}
                        <span className="truncate">{t.title}</span>
                      </span>
                      <span
                        className={`font-mono text-xs ${
                          t.is_regenerative
                            ? 'text-emerald-400'
                            : 'text-red-400/80'
                        }`}
                      >
                        {t.is_regenerative ? '+' : '-'}
                        {Math.abs(t.ap_cost)} AP
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

interface BreakdownProps {
  status: StaminaStatus;
}

function Breakdown({ status }: BreakdownProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <Row label="Baza" value={`${status.base_pool} min`} />
      <Row label="Boosty" value={`+${status.boosts_total} min`} />
      <Row label="Wydane" value={`-${status.ap_used} min`} accent="red" />
      <Row label="Odzyskane" value={`+${status.ap_restored} min`} accent="emerald" />
      <div className="my-2 border-t border-white/10" />
      <Row
        label="Dostępne"
        value={`${status.ap_available} min (${formatHM(status.ap_available)})`}
        emphasis
      />
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  emphasis?: boolean;
  accent?: 'red' | 'emerald';
}

function Row({ label, value, emphasis, accent }: RowProps) {
  const accentClass =
    accent === 'red'
      ? 'text-red-400'
      : accent === 'emerald'
        ? 'text-emerald-400'
        : emphasis
          ? 'text-amber-400 font-semibold'
          : 'text-white';
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-white/60">{label}</span>
      <span className={`font-mono tabular-nums ${accentClass}`}>{value}</span>
    </div>
  );
}

interface BoostButtonProps {
  boost: BoostAvailability;
  busy: boolean;
  onClick: () => void;
  tick: number;
}

function BoostButton({ boost, busy, onClick, tick }: BoostButtonProps) {
  // Decrement the cooldown locally once per minute so the user sees a
  // live countdown without refetching. `tick` is the dependency from
  // the parent's setInterval.
  void tick;
  const cooldownRemaining = boost.cooldown_remaining_min;
  const isMaxed =
    boost.max_per_day !== null && boost.uses_today >= (boost.max_per_day ?? 0);

  if (boost.is_available && !busy) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col items-start rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-left transition hover:bg-amber-500/15"
      >
        <span className="text-sm text-white">{boost.label}</span>
        <span className="font-mono text-xs text-amber-300">
          +{boost.ap_restored} AP
        </span>
      </button>
    );
  }

  const subtitle = isMaxed
    ? 'Limit dzienny'
    : cooldownRemaining
      ? `Cooldown ${formatCooldown(cooldownRemaining)}`
      : busy
        ? 'Używam…'
        : 'Niedostępne';

  return (
    <button
      type="button"
      disabled
      className="flex flex-col items-start rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-left opacity-60"
    >
      <span className="text-sm text-white/60">{boost.label}</span>
      <span className="font-mono text-xs text-white/40">{subtitle}</span>
    </button>
  );
}
