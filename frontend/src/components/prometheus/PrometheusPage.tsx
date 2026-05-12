import { BookMarked, CalendarDays, Dumbbell, Flame, Heart, Library } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { prometheusApi } from '../../api/prometheus';
import {
  RECOVERY_COLORS,
  fineMapToRecoveryMap,
  type GymSession,
  type RecoveryState,
} from '../../types/prometheus';
import BodyMap from './BodyMap';
import CardioTab from './cardio/CardioTab';
import ExerciseLibrary from './ExerciseLibrary';
import MuscleRecoveryBar from './MuscleRecoveryBar';
import PrometheusChat from './PrometheusChat';
import RecoveryGroupsCard from './RecoveryGroupsCard';
import WeeklyReportView from './WeeklyReport';
import WeekView from './WeekView';
import WorkoutBuilder from './WorkoutBuilder';
import WorkoutLog from './WorkoutLog';
import WorkoutTemplatesLibrary from './WorkoutTemplatesLibrary';

type Tab = 'training' | 'plans' | 'week' | 'prometheus' | 'library' | 'cardio';

const TABS: { id: Tab; label: string; icon: typeof Dumbbell }[] = [
  { id: 'training', label: 'Trening', icon: Dumbbell },
  { id: 'plans', label: 'Plany', icon: BookMarked },
  { id: 'week', label: 'Tygodnik', icon: CalendarDays },
  { id: 'prometheus', label: 'PROMETHEUS', icon: Flame },
  { id: 'cardio', label: 'Cardio', icon: Heart },
  { id: 'library', label: 'Biblioteka', icon: Library },
];

export default function PrometheusPage() {
  const [tab, setTab] = useState<Tab>('training');
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [recoveryState, setRecoveryState] = useState<RecoveryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        prometheusApi.getSessions(30),
        prometheusApi.getRecovery(),
      ]);
      setSessions(s);
      setRecoveryState(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([prometheusApi.getSessions(30), prometheusApi.getRecovery()])
      .then(([s, r]) => {
        if (cancelled) return;
        setSessions(s);
        setRecoveryState(r);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Błąd ładowania');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const legacyRecoveryMap = useMemo(
    () =>
      recoveryState ? fineMapToRecoveryMap(recoveryState.recovery_fine) : {},
    [recoveryState],
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted">
            Moduł treningu siłowego
          </div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Flame size={22} className="text-accent-orange" /> PROMETHEUS
          </h1>
        </div>
        <nav className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === t.id
                    ? 'bg-accent-orange text-black'
                    : 'text-muted hover:text-white hover:bg-surface2'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      {error && (
        <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
          {error}
        </div>
      )}

      {loading && !sessions.length ? (
        <div className="text-sm text-muted">Ładowanie modułu PROMETHEUS...</div>
      ) : tab === 'training' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <aside className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-widest text-muted">
                  Mapa ciała
                </span>
                <div className="flex rounded-md border border-border bg-surface2 p-0.5">
                  {(['front', 'back'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSide(s)}
                      className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                        side === s ? 'bg-accent-orange text-black' : 'text-muted'
                      }`}
                    >
                      {s === 'front' ? 'Przód' : 'Tył'}
                    </button>
                  ))}
                </div>
              </div>
              <BodyMap recoveryMap={legacyRecoveryMap} side={side} />
              <div className="mt-3 flex flex-wrap gap-2 justify-center">
                {RECOVERY_COLORS.map((color, i) => (
                  <span
                    key={color}
                    className="inline-flex items-center gap-1 text-[10px] text-muted"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded"
                      style={{ backgroundColor: color }}
                    />
                    {['Śladowo', 'Lekko', 'Średnio', 'Mocno'][i]}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="text-[11px] uppercase tracking-widest text-muted mb-2">
                Regeneracja
              </div>
              <MuscleRecoveryBar recoveryMap={legacyRecoveryMap} />
            </div>
          </aside>

          <section className="space-y-4">
            {recoveryState && <RecoveryGroupsCard state={recoveryState} />}
            <WorkoutBuilder onSessionSaved={() => void refresh()} />
            <WorkoutLog sessions={sessions} onChanged={() => void refresh()} />
          </section>
        </div>
      ) : tab === 'plans' ? (
        <WorkoutTemplatesLibrary onStartTraining={() => setTab('training')} />
      ) : tab === 'week' ? (
        <div className="space-y-4">
          <WeekView sessions={sessions} />
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="text-[11px] uppercase tracking-widest text-muted mb-2">
              Aktualna intensywność
            </div>
            <MuscleRecoveryBar recoveryMap={legacyRecoveryMap} />
          </div>
        </div>
      ) : tab === 'library' ? (
        <ExerciseLibrary />
      ) : tab === 'cardio' ? (
        <CardioTab />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          <WeeklyReportView />
          <div className="h-[600px]">
            <PrometheusChat />
          </div>
        </div>
      )}
    </div>
  );
}
