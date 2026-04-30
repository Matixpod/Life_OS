import type { CategoryFilterValue } from '../../hooks/useCategoryFilter';
import { CATEGORIES, CATEGORY_META } from './categories';

interface CategoryFilterProps {
  value: CategoryFilterValue;
  onChange: (next: CategoryFilterValue) => void;
}

/**
 * Persisted icon-pill filter. Selection survives reloads via localStorage.
 *
 * Pure controlled component — the persistence is wired through `useCategoryFilter`
 * below so the component can also be used statelessly in tests.
 */
export default function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Pill
        active={value === 'all'}
        color="#8B8B9F"
        label="Wszystkie"
        onClick={() => onChange('all')}
      />
      {CATEGORIES.map((c) => {
        const meta = CATEGORY_META[c];
        const Icon = meta.icon;
        return (
          <Pill
            key={c}
            active={value === c}
            color={meta.color}
            label={meta.label}
            onClick={() => onChange(c)}
            icon={<Icon size={12} />}
          />
        );
      })}
    </div>
  );
}

function Pill({
  active,
  color,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  color: string;
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] border transition-colors"
      style={
        active
          ? { backgroundColor: `${color}25`, borderColor: `${color}80`, color }
          : { backgroundColor: 'transparent', borderColor: '#262636', color: '#8B8B9F' }
      }
    >
      {icon}
      {label}
    </button>
  );
}

