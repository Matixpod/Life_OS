import { Dumbbell, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { prometheusApi } from '../../api/prometheus';
import type { GymSession } from '../../types/prometheus';
import SessionEditModal from './SessionEditModal';

interface WorkoutLogProps {
  sessions: GymSession[];
  onChanged: () => void;
}

function isToday(dateIso: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dateIso === today;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pl-PL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

export default function WorkoutLog({ sessions, onChanged }: WorkoutLogProps) {
  const today = sessions.filter((s) => isToday(s.date));
  const recent = sessions.filter((s) => !isToday(s.date)).slice(0, 6);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editing, setEditing] = useState<GymSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (id: string) => {
    setConfirmId(null);
    try {
      await prometheusApi.deleteSession(id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się usunąć');
    }
  };

  const renderRow = (s: GymSession, compact = false) => (
    <SessionRow
      key={s.id}
      session={s}
      compact={compact}
      confirming={confirmId === s.id}
      onAskDelete={() => setConfirmId(s.id)}
      onCancelDelete={() => setConfirmId(null)}
      onConfirmDelete={() => remove(s.id)}
      onEdit={() => setEditing(s)}
    />
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <Dumbbell size={14} className="text-accent-orange" />
          <span className="text-[11px] uppercase tracking-widest text-muted">
            Dzisiejszy trening
          </span>
        </div>
        {today.length === 0 ? (
          <p className="text-xs text-muted">Brak ćwiczeń dzisiaj. Dodaj pierwsze powyżej.</p>
        ) : (
          <ul className="space-y-2">{today.map((s) => renderRow(s))}</ul>
        )}
      </section>

      {recent.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] uppercase tracking-widest text-muted">
              Ostatnie sesje
            </span>
          </div>
          <ul className="space-y-2">{recent.map((s) => renderRow(s, true))}</ul>
        </section>
      )}

      {editing && (
        <SessionEditModal
          session={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            onChanged();
          }}
        />
      )}
    </div>
  );
}

interface SessionRowProps {
  session: GymSession;
  compact?: boolean;
  confirming: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onEdit: () => void;
}

function SessionRow({
  session,
  compact,
  confirming,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  onEdit,
}: SessionRowProps) {
  return (
    <li className="rounded-md border border-border bg-surface2 p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-white truncate">
            {session.label || 'Trening'}
          </span>
          <span className="text-[10px] text-muted font-mono shrink-0">
            {formatDate(session.date)}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {confirming ? (
            <>
              <button
                type="button"
                onClick={onConfirmDelete}
                className="rounded-md bg-accent-red px-2 py-0.5 text-[10px] font-medium text-white"
              >
                Usuń?
              </button>
              <button
                type="button"
                onClick={onCancelDelete}
                className="text-muted hover:text-white text-[10px] px-1"
              >
                Anuluj
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="text-muted hover:text-white"
                title="Edytuj sesję"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={onAskDelete}
                className="text-muted hover:text-accent-red"
                title="Usuń sesję"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
      {session.exercises.length > 0 && (
        <ul className={compact ? 'text-[11px] text-muted space-y-0.5' : 'text-xs text-muted space-y-1'}>
          {session.exercises.map((ex) => (
            <li key={ex.id} className="flex items-baseline gap-2">
              <span className="text-white">{ex.exercise_name}</span>
              <span className="font-mono text-[10px]">
                {ex.sets.map((s) => `${s.reps}×${s.kg}kg`).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
      {session.kcal_total != null && <KcalRow session={session} />}
    </li>
  );
}

function KcalRow({ session }: { session: GymSession }) {
  const fatPct = session.fat_pct ?? 40;
  const carbPct = session.carb_pct ?? 100 - fatPct;
  return (
    <div className="mt-2 border-t border-border pt-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 text-accent-orange">
          🔥 <span className="font-mono">{Math.round(session.kcal_total ?? 0)} kcal</span>
        </span>
        {session.kcal_epoc != null && (
          <span className="text-muted">
            · +<span className="font-mono text-white">{Math.round(session.kcal_epoc)}</span> EPOC
          </span>
        )}
        {session.fat_grams != null && (
          <span className="text-muted">
            · 🧈 <span className="font-mono text-white">{session.fat_grams.toFixed(1)}g</span> tłuszczu
          </span>
        )}
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-surface2">
        <div style={{ width: `${fatPct}%`, backgroundColor: '#F97316' }} />
        <div style={{ width: `${carbPct}%`, backgroundColor: '#3B82F6' }} />
      </div>
      <div className="text-[10px] font-mono text-muted">
        {Math.round(fatPct)}% tłuszcz / {Math.round(carbPct)}% węgle
      </div>
      {session.analysis_note && (
        <p className="truncate text-[11px] italic text-muted">&quot;{session.analysis_note}&quot;</p>
      )}
    </div>
  );
}
