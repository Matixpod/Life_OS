import {
  Activity,
  Anchor,
  AlertTriangle,
  Bike,
  Flame,
  Footprints,
  Loader2,
  MoreHorizontal,
  PersonStanding,
  Waves,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  ACTIVITY_LABELS_PL,
  type ActivityType,
  type CardioSessionCreate,
  type CardioSessionParams,
} from '../../../types/prometheus';

interface Props {
  hasProfile: boolean;
  onSubmit: (payload: CardioSessionCreate) => Promise<void>;
  loading: boolean;
  onSwitchToProfile: () => void;
}

interface IconProps {
  size?: number;
  className?: string;
}

const ACTIVITY_ICONS: Record<ActivityType, ComponentType<IconProps>> = {
  treadmill: Footprints,
  running: PersonStanding,
  bike: Bike,
  elliptical: Activity,
  swimming: Waves,
  rowing: Anchor,
  hiit: Zap,
  other: MoreHorizontal,
};

const ACTIVITIES: ActivityType[] = [
  'treadmill', 'running', 'bike', 'elliptical',
  'swimming', 'rowing', 'hiit', 'other',
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CardioForm({
  hasProfile,
  onSubmit,
  loading,
  onSwitchToProfile,
}: Props) {
  const [activity, setActivity] = useState<ActivityType | null>(null);
  const [label, setLabel] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [avgHr, setAvgHr] = useState<string>('');
  const [params, setParams] = useState<CardioSessionParams>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activity) setLabel((prev) => prev || ACTIVITY_LABELS_PL[activity]);
  }, [activity]);

  const canSubmit = useMemo(
    () => !!activity && label.trim().length > 0 && Number(duration) > 0,
    [activity, label, duration],
  );

  function reset(): void {
    setActivity(null);
    setLabel('');
    setDuration('');
    setAvgHr('');
    setParams({});
  }

  async function submit(): Promise<void> {
    if (!activity || !canSubmit) return;
    setError(null);
    try {
      const payload: CardioSessionCreate = {
        date: todayIso(),
        activity_type: activity,
        label: label.trim(),
        duration_min: Number(duration),
        ...(avgHr.trim() ? { avg_hr: Number(avgHr) } : {}),
        params,
      };
      await onSubmit(payload);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać sesji');
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Flame size={16} className="text-accent-orange" />
        <span className="text-sm font-medium text-white">Nowa sesja cardio</span>
      </div>

      {/* Section 1 — activity grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIVITIES.map((a) => {
          const Icon = ACTIVITY_ICONS[a];
          const active = activity === a;
          return (
            <button
              key={a}
              type="button"
              onClick={() => {
                setActivity(a);
                setParams({});
              }}
              aria-pressed={active}
              className={`flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-xs transition-colors ${
                active
                  ? 'border-accent-orange bg-surface2 text-white'
                  : 'border-border bg-transparent text-muted hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span>{ACTIVITY_LABELS_PL[a]}</span>
            </button>
          );
        })}
      </div>

      {/* Section 2 — details */}
      {activity && (
        <div className="space-y-3 border-t border-border pt-4">
          {!hasProfile && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-accent-orange/40 bg-accent-orange/10 px-3 py-2 text-[11px] text-accent-orange">
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle size={12} /> Brak profilu cardio — obliczenia będą przybliżone.
              </span>
              <button
                type="button"
                onClick={onSwitchToProfile}
                className="font-medium underline"
              >
                Ustaw profil ↑
              </button>
            </div>
          )}

          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted">Nazwa</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={ACTIVITY_LABELS_PL[activity]}
              className="mt-1 w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-white focus:border-accent-orange focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-widest text-muted">Czas trwania</span>
                <span className="text-[10px] text-muted">min</span>
              </label>
              <input
                type="number"
                min={1}
                max={600}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface2 px-3 py-2 font-mono text-sm text-white focus:border-accent-orange focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-widest text-muted">Średnie tętno</span>
                <span className="text-[10px] text-muted">bpm</span>
              </label>
              <input
                type="number"
                min={30}
                max={240}
                value={avgHr}
                onChange={(e) => setAvgHr(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface2 px-3 py-2 font-mono text-sm text-white focus:border-accent-orange focus:outline-none"
              />
              <div className="mt-1 text-[10px] text-muted">💡 Tętno poprawia dokładność o ~30%.</div>
            </div>
          </div>

          <ParamsBlock activity={activity} params={params} onChange={setParams} />

          {error && (
            <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || loading}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent-orange px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Flame size={14} />}
            {loading ? 'PROMETHEUS oblicza…' : 'Analizuj i zapisz'}
          </button>
        </div>
      )}
    </div>
  );
}

interface ParamsBlockProps {
  activity: ActivityType;
  params: CardioSessionParams;
  onChange: (next: CardioSessionParams) => void;
}

function ParamsBlock({ activity, params, onChange }: ParamsBlockProps) {
  function setField<K extends keyof CardioSessionParams>(
    key: K,
    raw: string,
  ): void {
    const next: CardioSessionParams = { ...params };
    if (key === 'notes') {
      next.notes = raw || undefined;
    } else if (raw === '') {
      delete next[key];
    } else {
      const n = Number(raw);
      if (Number.isFinite(n)) (next as Record<string, number>)[key as string] = n;
    }
    onChange(next);
  }

  if (activity === 'hiit') return null;
  if (activity === 'other') {
    return (
      <div>
        <label className="text-[11px] uppercase tracking-widest text-muted">Notatka</label>
        <textarea
          value={params.notes ?? ''}
          onChange={(e) => setField('notes', e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-white focus:border-accent-orange focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {activity === 'treadmill' && (
        <>
          <NumField label="Prędkość" suffix="km/h" value={params.speed_kmh} onChange={(v) => setField('speed_kmh', v)} />
          <NumField label="Nachylenie" suffix="%" value={params.incline_pct} onChange={(v) => setField('incline_pct', v)} />
        </>
      )}
      {activity === 'running' && (
        <>
          <NumField label="Prędkość" suffix="km/h" value={params.speed_kmh} onChange={(v) => setField('speed_kmh', v)} />
          <NumField label="Dystans" suffix="km" value={params.distance_km} onChange={(v) => setField('distance_km', v)} />
        </>
      )}
      {activity === 'bike' && (
        <>
          <NumField label="Opór" suffix="1–20" value={params.resistance} onChange={(v) => setField('resistance', v)} />
          <NumField label="RPM" suffix="" value={params.rpm} onChange={(v) => setField('rpm', v)} />
        </>
      )}
      {activity === 'elliptical' && (
        <NumField label="Opór" suffix="1–20" value={params.resistance} onChange={(v) => setField('resistance', v)} />
      )}
      {activity === 'swimming' && (
        <>
          <NumField label="Dług. basenu" suffix="m" value={params.pool_length_m} onChange={(v) => setField('pool_length_m', v)} />
          <NumField label="Baseny" suffix="ilość" value={params.laps} onChange={(v) => setField('laps', v)} />
        </>
      )}
      {activity === 'rowing' && (
        <NumField label="Dystans" suffix="m" value={params.distance_km} onChange={(v) => setField('distance_km', v)} />
      )}
    </div>
  );
}

function NumField({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number | undefined;
  onChange: (raw: string) => void;
}) {
  return (
    <div>
      <label className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-widest text-muted">{label}</span>
        {suffix && <span className="text-[10px] text-muted">{suffix}</span>}
      </label>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-surface2 px-3 py-2 font-mono text-sm text-white focus:border-accent-orange focus:outline-none"
      />
    </div>
  );
}
