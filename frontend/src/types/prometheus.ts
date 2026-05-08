/**
 * PROMETHEUS Gym Module — TypeScript types & constants
 *
 * Place this file at: frontend/src/types/prometheus.ts
 */

import type { Slug } from 'react-muscle-highlighter';

// ─── Muscle keys (internal) ───────────────────────────────────────────────
// These are the keys used everywhere in the backend and frontend.

export type MuscleKey =
  | 'chest'
  | 'front_delt'
  | 'rear_delt'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'traps'
  | 'lats'
  | 'rhomboids'
  | 'lower_back'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves';

export const ALL_MUSCLE_KEYS: MuscleKey[] = [
  'chest', 'front_delt', 'rear_delt', 'biceps', 'triceps', 'forearms',
  'abs', 'obliques', 'traps', 'lats', 'rhomboids', 'lower_back',
  'glutes', 'quads', 'hamstrings', 'calves',
];

export const MUSCLE_LABELS_PL: Record<MuscleKey, string> = {
  chest:      'Klatka piersiowa',
  front_delt: 'Barki (przód)',
  rear_delt:  'Barki (tył)',
  biceps:     'Biceps',
  triceps:    'Triceps',
  forearms:   'Przedramiona',
  abs:        'Brzuch',
  obliques:   'Skośne brzucha',
  traps:      'Czworoboczny',
  lats:       'Najszerszy grzbietu',
  rhomboids:  'Romboidalne',
  lower_back: 'Dolny grzbiet',
  glutes:     'Pośladki',
  quads:      'Czwórgłowy uda',
  hamstrings: 'Dwugłowy uda',
  calves:     'Łydki',
};

// ─── react-muscle-highlighter slug mapping ────────────────────────────────
// Maps internal MuscleKey → react-muscle-highlighter Slug.
// Note: 'lats' and 'rhomboids' both map to 'upper-back' (library limitation).
// When computing BodyMap intensity: take the MAX of lats + rhomboids for upper-back.

// react-muscle-highlighter v1.2 slugs are coarse: no front/back deltoid split,
// `forearm` is singular, no separate rhomboids. We collapse appropriately.
export const INTERNAL_TO_SLUG: Record<MuscleKey, Slug> = {
  chest:      'chest',
  front_delt: 'deltoids',
  rear_delt:  'deltoids',         // collapsed with front delts in this lib
  biceps:     'biceps',
  triceps:    'triceps',
  forearms:   'forearm',
  abs:        'abs',
  obliques:   'obliques',
  traps:      'trapezius',
  lats:       'upper-back',
  rhomboids:  'upper-back',       // grouped with lats
  lower_back: 'lower-back',
  glutes:     'gluteal',
  quads:      'quadriceps',
  hamstrings: 'hamstring',
  calves:     'calves',
};

// Reverse map: slug → best matching internal key (for click handlers)
export const SLUG_TO_INTERNAL: Partial<Record<Slug, MuscleKey>> = {
  'chest':           'chest',
  'deltoids':        'front_delt',
  'biceps':          'biceps',
  'triceps':         'triceps',
  'forearm':         'forearms',
  'abs':             'abs',
  'obliques':        'obliques',
  'trapezius':       'traps',
  'upper-back':      'lats',
  'lower-back':      'lower_back',
  'gluteal':         'glutes',
  'quadriceps':      'quads',
  'hamstring':       'hamstrings',
  'calves':          'calves',
};

/**
 * Convert a RecoveryMap (internal keys) to ExtendedBodyPart[] for react-muscle-highlighter.
 *
 * react-muscle-highlighter uses intensity as index into a `colors` array.
 * We pass colors = ['#22C55E', '#EAB308', '#F97316', '#EF4444'] (intensity 1-4).
 *
 * Usage:
 *   import Body from 'react-muscle-highlighter';
 *   <Body
 *     data={recoveryMapToBodyParts(recoveryMap)}
 *     side="front"
 *     gender="male"
 *     colors={RECOVERY_COLORS}
 *     scale={1.5}
 *   />
 */
export const RECOVERY_COLORS = ['#22C55E', '#EAB308', '#F97316', '#EF4444'] as const;

export function recoveryMapToBodyParts(
  recoveryMap: RecoveryMap
): Array<{ slug: Slug; intensity: number }> {
  // Aggregate: multiple internal keys → same slug → take max
  const slugIntensities = new Map<Slug, number>();

  for (const [key, intensity] of Object.entries(recoveryMap) as [MuscleKey, number][]) {
    if (intensity < 0.05) continue;
    const slug = INTERNAL_TO_SLUG[key];
    if (!slug) continue;
    const current = slugIntensities.get(slug) ?? 0;
    slugIntensities.set(slug, Math.max(current, intensity));
  }

  return Array.from(slugIntensities.entries()).map(([slug, intensity]) => ({
    slug,
    intensity: intensityToLevel(intensity),
  }));
}

/** Maps continuous intensity 0–1 to discrete level 1–4 for the colors array. */
export function intensityToLevel(intensity: number): number {
  if (intensity >= 0.72) return 4; // red
  if (intensity >= 0.50) return 3; // orange
  if (intensity >= 0.28) return 2; // yellow
  return 1;                         // green
}

/** Human-readable intensity label in Polish. */
export function intensityLabel(intensity: number): { label: string; color: string } | null {
  if (!intensity || intensity < 0.05) return null;
  if (intensity >= 0.72) return { label: 'Mocno',    color: '#EF4444' };
  if (intensity >= 0.50) return { label: 'Średnio',  color: '#F97316' };
  if (intensity >= 0.28) return { label: 'Lekko',    color: '#EAB308' };
  return                         { label: 'Śladowo', color: '#22C55E' };
}

/** Estimated recovery hours remaining. */
export function recoveryHoursLeft(intensity: number): number {
  return Math.round((1 - intensity) * 96);
}

// ─── API types ────────────────────────────────────────────────────────────

export type RecoveryMap = Partial<Record<MuscleKey, number>>;

export interface ExerciseSet {
  reps: number;
  kg: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscle_load: RecoveryMap;
  created_at: string;
}

export interface SessionExercise {
  id: string;
  session_id: string;
  exercise_name: string;
  sets: ExerciseSet[];
  muscle_load: RecoveryMap;
  order_index: number;
}

export interface GymSession {
  id: string;
  date: string;
  label: string;
  notes?: string;
  exercises: SessionExercise[];
  created_at: string;
}

export interface ParsedExercise {
  exercise_name: string;
  sets: ExerciseSet[];
  muscle_load: RecoveryMap;
  comment: string;
}

export interface SessionExerciseInput {
  exercise_name: string;
  sets: ExerciseSet[];
  muscle_load: RecoveryMap;
}

export interface SessionCreate {
  date: string;            // YYYY-MM-DD
  label: string;
  notes?: string;
  exercises: SessionExerciseInput[];
}

export interface SessionUpdatePayload {
  label?: string;
  notes?: string;
  exercises?: SessionExerciseInput[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WeeklyReportDay {
  day: string;             // "Poniedziałek"
  focus: string;           // "Klatka + Triceps"
  exercises: string[];
}

export interface WeeklyReport {
  week_start: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  missed_muscles: MuscleKey[];
  next_week_plan: WeeklyReportDay[];
  prometheus_words: string;
}
