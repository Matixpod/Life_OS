import { useEffect, useMemo, useState } from 'react';
import { prometheusApi } from '../../../api/prometheus';
import type {
  CardioProfile,
  CardioSession,
  CardioSessionCreate,
  FatSummary,
  GymSession,
} from '../../../types/prometheus';
import CardioForm from './CardioForm';
import CardioHistory, { type HistoryItem } from './CardioHistory';
import CardioProfileForm from './CardioProfileForm';
import CardioResult from './CardioResult';
import FatJar from './FatJar';

function strengthToHistoryItem(s: GymSession): HistoryItem {
  return {
    source: 'strength',
    id: s.id,
    title: s.label || 'Trening',
    date: s.date,
    duration_min: s.duration_min ?? null,
    kcal_total: s.kcal_total ?? null,
    kcal_epoc: s.kcal_epoc ?? null,
    fat_grams: s.fat_grams ?? null,
    analysis_note: s.analysis_note ?? null,
  };
}

function cardioToHistoryItem(s: CardioSession): HistoryItem {
  return {
    source: 'cardio',
    id: s.id,
    title: s.label,
    date: s.date,
    activity_type: s.activity_type,
    duration_min: s.duration_min,
    kcal_total: s.kcal_total ?? null,
    kcal_epoc: s.kcal_epoc ?? null,
    fat_grams: s.fat_grams ?? null,
    hr_zone: s.hr_zone ?? null,
    analysis_note: s.analysis_note ?? null,
  };
}

export default function CardioTab() {
  const [profile, setProfile] = useState<CardioProfile | null>(null);
  const [cardioSessions, setCardioSessions] = useState<CardioSession[]>([]);
  const [strengthSessions, setStrengthSessions] = useState<GymSession[]>([]);
  const [summary, setSummary] = useState<FatSummary | null>(null);
  const [lastResult, setLastResult] = useState<CardioSession | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      prometheusApi.getCardioProfile(),
      prometheusApi.getCardioSessions(),
      prometheusApi.getCardioSummary(),
      prometheusApi.getSessions(90),
    ])
      .then(([p, c, sm, s]) => {
        if (cancelled) return;
        setProfile(p);
        setCardioSessions(c);
        setSummary(sm);
        setStrengthSessions(s);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Błąd ładowania');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const historyItems = useMemo<HistoryItem[]>(() => {
    const merged: HistoryItem[] = [
      ...cardioSessions.map(cardioToHistoryItem),
      ...strengthSessions.map(strengthToHistoryItem),
    ];
    merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return merged;
  }, [cardioSessions, strengthSessions]);

  async function refreshSummary(): Promise<void> {
    try {
      const sm = await prometheusApi.getCardioSummary();
      setSummary(sm);
    } catch {
      /* non-fatal */
    }
  }

  async function handleSubmit(payload: CardioSessionCreate): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const session = await prometheusApi.createCardioSession(payload);
      setLastResult(session);
      setCardioSessions((prev) => [session, ...prev]);
      await refreshSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać sesji');
      throw e;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: HistoryItem): Promise<void> {
    if (item.source === 'cardio') {
      setCardioSessions((prev) => prev.filter((s) => s.id !== item.id));
      if (lastResult?.id === item.id) setLastResult(null);
      try {
        await prometheusApi.deleteCardioSession(item.id);
        await refreshSummary();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Nie udało się usunąć sesji');
      }
      return;
    }
    // strength
    setStrengthSessions((prev) => prev.filter((s) => s.id !== item.id));
    try {
      await prometheusApi.deleteSession(item.id);
      await refreshSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się usunąć sesji');
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {error && (
        <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
          {error}
        </div>
      )}

      <CardioProfileForm
        profile={profile}
        forceOpen={profileOpen}
        onSave={(p) => {
          setProfile(p);
          setProfileOpen(false);
        }}
      />

      <CardioForm
        hasProfile={!!profile}
        onSubmit={handleSubmit}
        loading={submitting}
        onSwitchToProfile={() => setProfileOpen(true)}
      />

      {lastResult && (
        <CardioResult session={lastResult} onDismiss={() => setLastResult(null)} />
      )}

      <div className="grid gap-4 md:[grid-template-columns:220px_1fr]">
        <FatJar summary={summary} />
        <CardioHistory items={historyItems} onDelete={handleDelete} />
      </div>
    </div>
  );
}
