import {
  Activity,
  Apple,
  BookOpen,
  Brain,
  Dumbbell,
  Heart,
  LayoutGrid,
  Library,
  Moon,
  Newspaper,
  Pill,
  Target,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import ActivityTimeline from '../components/ActivityTimeline';
import ErrorBanner from '../components/ErrorBanner';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ModuleCard, { type ModuleStatus } from '../components/ModuleCard';
import MorningPopup from '../components/MorningPopup';
import PotentialScoreGauge from '../components/PotentialScoreGauge';
import QuickAddFAB from '../components/QuickAddFAB';
import StreakBanner from '../components/StreakBanner';
import { api } from '../services/api';
import type { DailySummary, UserProfile } from '../types';
import { formatDuration, todayIso } from '../utils/date';

const MIN_SKELETON_MS = 1500;

interface ModuleCardSpec {
  to: string;
  name: string;
  icon: typeof Target;
  build: (s: DailySummary) => { metric: string; metricLabel?: string; status: ModuleStatus };
}

const SPECS: ModuleCardSpec[] = [
  {
    to: '/goals',
    name: 'Goals',
    icon: Target,
    build: ({ modules: { goals } }) => ({
      metric: `${goals.completed} / ${goals.total}`,
      metricLabel: 'completed',
      status: goals.total === 0 ? 'pending' : goals.completed === goals.total ? 'completed' : 'in_progress',
    }),
  },
  {
    to: '/sleep',
    name: 'Sleep & Energy',
    icon: Moon,
    build: ({ modules: { sleep } }) => ({
      metric: formatDuration(sleep.duration_minutes),
      metricLabel:
        sleep.energy_score != null ? `energy ${sleep.energy_score}/100` : 'no log',
      status: sleep.duration_minutes != null ? 'completed' : 'pending',
    }),
  },
  {
    to: '/supplements',
    name: 'Supplements',
    icon: Pill,
    build: ({ modules: { supplements } }) => ({
      metric: `${supplements.taken} / ${supplements.total}`,
      metricLabel: 'taken',
      status:
        supplements.total === 0
          ? 'pending'
          : supplements.taken === supplements.total
          ? 'completed'
          : supplements.taken > 0
          ? 'in_progress'
          : 'pending',
    }),
  },
  {
    to: '/workout',
    name: 'Workout',
    icon: Dumbbell,
    build: ({ modules: { workout } }) => ({
      metric: workout.completed ? workout.label ?? 'Logged' : '—',
      metricLabel: workout.muscle_groups.join(', ') || (workout.completed ? '' : 'no session'),
      status: workout.completed ? 'completed' : 'pending',
    }),
  },
  {
    to: '/cognitive',
    name: 'Cognitive',
    icon: Brain,
    build: ({ modules: { cognitive } }) => ({
      metric: cognitive.title ?? 'No challenge',
      metricLabel: cognitive.difficulty ?? '',
      status: cognitive.completed ? 'completed' : cognitive.title ? 'in_progress' : 'pending',
    }),
  },
  {
    to: '/mental-health',
    name: 'Mental Health',
    icon: Heart,
    build: ({ modules: { mental_health } }) => ({
      metric: mental_health.mood_score != null ? `${mental_health.mood_score} / 10` : '—',
      metricLabel: mental_health.logged ? 'mood' : 'no log',
      status: mental_health.logged ? 'completed' : 'pending',
    }),
  },
  {
    to: '/body',
    name: 'Body',
    icon: Activity,
    build: ({ modules: { body } }) => ({
      metric: body.weight_kg != null ? `${body.weight_kg} kg` : '—',
      metricLabel: body.logged ? 'weight' : 'no log',
      status: body.logged ? 'completed' : 'pending',
    }),
  },
  {
    to: '/nutrition',
    name: 'Nutrition',
    icon: Apple,
    build: ({ modules: { nutrition } }) => ({
      metric: `${nutrition.meals_logged}`,
      metricLabel: 'meals logged',
      status: nutrition.meals_logged > 0 ? 'in_progress' : 'pending',
    }),
  },
  {
    to: '/deep-work',
    name: 'Deep Work',
    icon: LayoutGrid,
    build: ({ modules: { deep_work } }) => ({
      metric: formatDuration(deep_work.total_minutes),
      metricLabel: 'today',
      status: deep_work.total_minutes > 0 ? 'in_progress' : 'pending',
    }),
  },
  {
    to: '/learning',
    name: 'Learning',
    icon: BookOpen,
    build: ({ modules: { learning } }) => ({
      metric: `${learning.items_logged}`,
      metricLabel: learning.avg_quiz_score != null ? `avg ${Math.round(learning.avg_quiz_score)}%` : 'items',
      status: learning.items_logged > 0 ? 'in_progress' : 'pending',
    }),
  },
  {
    to: '/intelligence',
    name: 'Intelligence',
    icon: Newspaper,
    build: ({ modules: { intelligence } }) => ({
      metric: intelligence.loaded ? 'Ready' : '—',
      metricLabel: intelligence.loaded ? 'today’s digest' : 'not generated',
      status: intelligence.loaded ? 'completed' : 'pending',
    }),
  },
  {
    to: '/review',
    name: 'Review',
    icon: Library,
    build: ({ modules: { review } }) => ({
      metric: review.last_review_date ?? '—',
      metricLabel: review.type ? `last ${review.type}` : 'no review yet',
      status: review.last_review_date ? 'completed' : 'pending',
    }),
  },
];

export default function Dashboard() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMorning, setShowMorning] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(`lifeos_morning_${todayIso()}`);
  });

  const load = () => {
    setLoading(true);
    setError(null);
    const t0 = performance.now();
    Promise.all([api.getDailySummary(), api.getUserProfile()])
      .then(([s, u]) => {
        const elapsed = performance.now() - t0;
        const wait = Math.max(0, MIN_SKELETON_MS - elapsed);
        window.setTimeout(() => {
          setSummary(s);
          setUser(u);
          setLoading(false);
        }, wait);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setLoading(false);
      });
  };

  useEffect(() => {
    let cancelled = false;
    const t0 = performance.now();
    Promise.all([api.getDailySummary(), api.getUserProfile()])
      .then(([s, u]) => {
        if (cancelled) return;
        const elapsed = performance.now() - t0;
        const wait = Math.max(0, MIN_SKELETON_MS - elapsed);
        window.setTimeout(() => {
          if (cancelled) return;
          setSummary(s);
          setUser(u);
          setLoading(false);
        }, wait);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMorningClose = () => setShowMorning(false);

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {error && (
        <div className="mb-6">
          <ErrorBanner message={`Could not load dashboard — ${error}`} onRetry={load} />
        </div>
      )}

      <section className="mb-8 grid md:grid-cols-[auto_1fr] gap-6 items-center">
        {loading ? (
          <LoadingSkeleton variant="gauge" />
        ) : (
          <PotentialScoreGauge score={summary?.potential_score ?? 0} />
        )}
        <div className="space-y-4">
          {loading ? (
            <LoadingSkeleton variant="banner" />
          ) : (
            <StreakBanner streakDays={user?.current_streak_days ?? 0} />
          )}
          <p className="text-sm text-muted">
            {user?.name ? `Welcome back, ${user.name}.` : 'Welcome.'}{' '}
            Snapshot of your day across all 12 modules.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {loading || !summary
          ? Array.from({ length: 12 }).map((_, i) => <LoadingSkeleton key={i} />)
          : SPECS.map((spec) => {
              const built = spec.build(summary);
              return (
                <ModuleCard
                  key={spec.to}
                  to={spec.to}
                  name={spec.name}
                  icon={spec.icon}
                  metric={built.metric}
                  metricLabel={built.metricLabel}
                  status={built.status}
                />
              );
            })}
      </section>

      <section className="mt-8">
        <ActivityTimeline />
      </section>

      <QuickAddFAB />
      {showMorning && <MorningPopup onClose={handleMorningClose} />}
    </div>
  );
}
