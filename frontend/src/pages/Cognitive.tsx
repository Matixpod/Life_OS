import { ArrowLeft, Brain, Check, ExternalLink, HelpCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ChallengeTimer from '../components/ChallengeTimer';
import ErrorBanner from '../components/ErrorBanner';
import SocraticChat from '../components/SocraticChat';
import { api } from '../services/api';
import {
  type CognitiveChallenge,
  TIMER_SECONDS,
} from '../types';
import { todayIso } from '../utils/date';

const DIFFICULTY_BADGE: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'bg-accent-emerald/15 text-accent-emerald border-accent-emerald/40',
  medium: 'bg-accent-amber/15 text-accent-amber border-accent-amber/40',
  hard: 'bg-accent-red/15 text-accent-red border-accent-red/40',
};

export default function Cognitive() {
  const [challenge, setChallenge] = useState<CognitiveChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getCognitiveToday()
      .then((c) => {
        if (cancelled) return;
        setChallenge(c);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load challenge');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const duration = challenge?.timer_seconds ?? (challenge?.difficulty ? TIMER_SECONDS[challenge.difficulty] : 1800);

  const handleComplete = async () => {
    if (!challenge || completing) return;
    setCompleting(true);
    try {
      await api.completeCognitive({
        date: todayIso(),
        time_spent_seconds: 0,
        ai_help_used: unlocked,
      });
      setChallenge({ ...challenge, completed: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to mark complete');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-muted hover:text-white text-sm mb-6"
      >
        <ArrowLeft size={14} /> Dashboard
      </Link>

      {error && (
        <div className="mb-6">
          <ErrorBanner message={error} />
        </div>
      )}

      {loading ? (
        <div className="rounded-xl bg-surface border border-border p-10 animate-pulse">
          <div className="h-6 w-48 bg-surface2 rounded mb-4" />
          <div className="h-4 w-32 bg-surface2 rounded" />
        </div>
      ) : !challenge ? (
        <div className="rounded-xl bg-surface border border-border p-10 text-center">
          <Brain size={32} className="mx-auto text-muted mb-3" />
          <p className="text-sm text-muted">No challenge for today yet.</p>
        </div>
      ) : (
        <>
          <header className="rounded-xl bg-surface border border-border p-6 md:p-7 mb-6">
            <div className="text-[11px] tracking-widest uppercase text-muted">Today's Challenge</div>
            <h1 className="text-2xl md:text-3xl font-semibold mt-1">{challenge.title}</h1>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {challenge.difficulty && (
                <span
                  className={`text-[10px] tracking-widest uppercase rounded-full px-2 py-1 border ${DIFFICULTY_BADGE[challenge.difficulty]}`}
                >
                  {challenge.difficulty}
                </span>
              )}
              <span className="text-[10px] tracking-widest uppercase rounded-full px-2 py-1 bg-surface2 border border-border text-muted">
                {challenge.type}
              </span>
              {challenge.completed && (
                <span className="text-[10px] tracking-widest uppercase rounded-full px-2 py-1 bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/40">
                  Completed
                </span>
              )}
            </div>
            {challenge.external_url && (
              <a
                href={challenge.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-blue text-white text-sm hover:bg-accent-blue/90"
              >
                Open challenge <ExternalLink size={14} />
              </a>
            )}
          </header>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-xl bg-surface border border-border p-6 flex flex-col items-center">
              <ChallengeTimer durationSeconds={duration} onExpire={() => setUnlocked(true)} />
              <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
                <button
                  onClick={() => setUnlocked(true)}
                  disabled={unlocked}
                  className="px-4 py-2 rounded-md bg-surface2 border border-border hover:border-accent-amber/40 text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <HelpCircle size={14} /> I need help
                </button>
                <button
                  onClick={handleComplete}
                  disabled={completing || challenge.completed}
                  className="px-4 py-2 rounded-md bg-accent-emerald text-white text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Check size={14} /> {challenge.completed ? 'Completed' : 'Mark as completed'}
                </button>
              </div>
            </div>

            <SocraticChat challengeTitle={challenge.title ?? 'Untitled'} isUnlocked={unlocked} />
          </div>
        </>
      )}
    </div>
  );
}
