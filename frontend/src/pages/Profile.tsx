import { Check, Flame, User } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { api } from '../services/api';
import type { UserProfile, UserSettings } from '../types';

/**
 * Profile page — user info plus user-level settings (currently the
 * weekly step goal). All data flows through `api.ts`; no Supabase
 * client lives on the frontend (CLAUDE.md ADR-002).
 */
export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [goal, setGoal] = useState<number>(70000);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getUserProfile(), api.getUserSettings()])
      .then(([p, s]) => {
        if (cancelled) return;
        setProfile(p);
        setGoal(s.weekly_step_goal);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Błąd ładowania profilu');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const next: UserSettings = await api.updateUserSettings({
        weekly_step_goal: goal,
      });
      setGoal(next.weekly_step_goal);
      setSavedAt(Date.now());
      window.setTimeout(() => setSavedAt(null), 2200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted">Ładowanie profilu…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-accent-blue">
          <User size={22} />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted">
            Profil
          </div>
          <h1 className="font-sora text-2xl font-semibold text-white">
            {profile?.name ?? '—'}
          </h1>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="text-[11px] uppercase tracking-widest text-muted">
          Statystyki
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <Stat label="Start systemu" value={profile?.system_start_date ?? '—'} />
          <Stat
            label="Aktualna seria"
            value={`${profile?.current_streak_days ?? 0} dni`}
            accent="amber"
            icon={<Flame size={14} />}
          />
          <Stat
            label="Najdłuższa"
            value={`${profile?.longest_streak_days ?? 0} dni`}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted">
              Cel kroków tygodniowy
            </div>
            <div className="mt-0.5 text-xs text-muted">
              Domyślnie 70 000 kroków / tydzień (≈ 10 000 / dzień)
            </div>
          </div>
          {savedAt !== null && (
            <span className="inline-flex items-center gap-1 rounded-md border border-accent-emerald/40 bg-accent-emerald/10 px-2 py-1 text-[11px] font-medium text-accent-emerald">
              <Check size={12} /> Zapisano
            </span>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <input
            type="number"
            min={7000}
            max={200000}
            step={1000}
            value={goal}
            onChange={(e) => setGoal(Number.parseInt(e.target.value, 10) || 0)}
            className="w-40 rounded-md border border-border bg-surface2 px-3 py-2 text-right font-mono text-sm text-white outline-none focus:border-accent-blue"
          />
          <span className="text-xs text-muted">kroków / tydzień</span>
          <button
            type="button"
            disabled={saving || goal < 7000 || goal > 200000}
            onClick={() => void handleSave()}
            className="ml-auto rounded-md bg-accent-blue px-4 py-2 text-xs font-medium text-white transition hover:bg-accent-blue/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Zapisuję…' : 'Zapisz'}
          </button>
        </div>
      </section>
    </div>
  );
}

interface StatProps {
  label: string;
  value: string;
  accent?: 'amber';
  icon?: ReactNode;
}

function Stat({ label, value, accent, icon }: StatProps) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted">
        {label}
      </div>
      <div
        className={`mt-1 inline-flex items-center gap-1 font-mono text-lg ${
          accent === 'amber' ? 'text-accent-amber' : 'text-white'
        }`}
      >
        {icon}
        {value}
      </div>
    </div>
  );
}
