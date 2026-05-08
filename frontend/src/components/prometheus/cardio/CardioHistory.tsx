import {
  Activity,
  Anchor,
  Bike,
  Dumbbell,
  Footprints,
  MoreHorizontal,
  PersonStanding,
  Trash2,
  Waves,
  Zap,
} from 'lucide-react';
import { useState, type ComponentType } from 'react';
import {
  ACTIVITY_LABELS_PL,
  fatGramsAnalogy,
  HR_ZONE_META,
  type ActivityType,
  type HRZone,
} from '../../../types/prometheus';

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

/** Unified row across the two history sources so the cardio tab can show
 *  both workout types in a single chronological list. Strength items are
 *  rendered with a dumbbell icon and skip cardio-only fields (zone, params).
 */
export interface HistoryItem {
  source: 'cardio' | 'strength';
  id: string;
  title: string;
  date: string;
  activity_type?: ActivityType;
  duration_min?: number | null;
  kcal_total?: number | null;
  kcal_epoc?: number | null;
  fat_grams?: number | null;
  hr_zone?: HRZone | null;
  analysis_note?: string | null;
}

interface Props {
  items: HistoryItem[];
  onDelete: (item: HistoryItem) => void;
}

function relativeDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'dziś';
  if (diffDays === 1) return 'wczoraj';
  if (diffDays < 7) return `${diffDays} dni temu`;
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function iconFor(item: HistoryItem): ComponentType<IconProps> {
  if (item.source === 'strength') return Dumbbell;
  if (item.activity_type) return ACTIVITY_ICONS[item.activity_type] ?? MoreHorizontal;
  return MoreHorizontal;
}

export default function CardioHistory({ items, onDelete }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const visible = items.slice(0, 15);

  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-sm text-muted">
        Brak treningów. Zacznij od pierwszej sesji! 🏃
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visible.map((item) => {
        const Icon = iconFor(item);
        const zone = item.hr_zone ? HR_ZONE_META[item.hr_zone] : null;
        const confirming = confirmId === item.id;
        const accent =
          item.source === 'strength' ? 'text-accent-emerald' : 'text-accent-orange';
        const fallbackTitle =
          item.title ||
          (item.activity_type ? ACTIVITY_LABELS_PL[item.activity_type] : 'Trening');
        return (
          <div
            key={`${item.source}:${item.id}`}
            className="rounded-md border border-border bg-surface p-3"
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 ${accent}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-medium text-white">
                    {fallbackTitle}
                  </div>
                  <span className="shrink-0 text-[10px] font-mono text-muted">
                    {relativeDate(item.date)}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  {item.source === 'strength' && (
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-1.5 py-px text-[10px] text-emerald-300">
                      siłowo
                    </span>
                  )}
                  {item.duration_min != null && (
                    <span className="font-mono">{item.duration_min} min</span>
                  )}
                  {zone && (
                    <span
                      className="inline-flex items-center rounded-full px-1.5 py-px text-[10px]"
                      style={{
                        backgroundColor: `${zone.color}22`,
                        color: zone.color,
                        border: `1px solid ${zone.color}55`,
                      }}
                    >
                      {zone.label}
                    </span>
                  )}
                  {item.kcal_total != null && (
                    <span className="font-mono">{Math.round(item.kcal_total)} kcal</span>
                  )}
                  {item.kcal_epoc != null && item.kcal_epoc > 0 && (
                    <span className="font-mono text-muted">
                      +{Math.round(item.kcal_epoc)} EPOC
                    </span>
                  )}
                </div>
                {item.fat_grams != null && (
                  <div className="mt-1 text-[11px] text-muted">
                    🔥 <span className="font-mono text-white">{item.fat_grams.toFixed(2)}g</span> tłuszczu
                    <span className="ml-1">{fatGramsAnalogy(item.fat_grams)}</span>
                  </div>
                )}
                {item.analysis_note && (
                  <p className="mt-1 truncate text-[11px] italic text-muted">
                    &quot;{item.analysis_note}&quot;
                  </p>
                )}
              </div>
              <div className="shrink-0">
                {confirming ? (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(item);
                        setConfirmId(null);
                      }}
                      className="rounded-md bg-accent-red px-2 py-0.5 text-[10px] font-medium text-white"
                    >
                      Usuń?
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="text-muted hover:text-white text-[10px] px-1"
                    >
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmId(item.id);
                      window.setTimeout(() => {
                        setConfirmId((cur) => (cur === item.id ? null : cur));
                      }, 3000);
                    }}
                    className="text-muted hover:text-accent-red"
                    aria-label="Usuń sesję"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
