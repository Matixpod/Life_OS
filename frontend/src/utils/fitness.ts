/**
 * MET-based kcal estimation for cardio activities.
 *
 * Formula: `kcal = (MET × 3.5 × bodyWeightKg / 200) × durationMinutes`.
 * Defaults are intentionally conservative; the backend's
 * `cardio_agent.analyze_cardio_session` performs the authoritative
 * calculation and the values it stores in `cardio_sessions.kcal_total`
 * always take priority. This utility is the fallback for sessions where
 * the backend value is missing.
 */

export const DEFAULT_BODY_WEIGHT_KG = 75;

/** MET values per activity. Unknown activities fall back to MET 6. */
export const MET_VALUES: Record<string, number> = {
  running: 9,
  treadmill: 7,
  bike: 6,
  elliptical: 7,
  swimming: 7,
  rowing: 7,
  hiit: 8,
  cardio: 7,
  other: 6,
};

/** Estimate kcal burn for a single cardio session. */
export function estimateKcal(
  durationMinutes: number,
  workoutType: string | null | undefined,
  weightKg: number = DEFAULT_BODY_WEIGHT_KG,
): number {
  const safeDuration = Math.max(0, durationMinutes);
  const met = MET_VALUES[(workoutType ?? '').toLowerCase()] ?? 6;
  return Math.round(((met * 3.5 * weightKg) / 200) * safeDuration);
}
