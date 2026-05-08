import { Plus, Trash2 } from 'lucide-react';
import type { ExerciseSet } from '../../types/prometheus';

interface SetEditorProps {
  value: ExerciseSet[];
  onChange: (next: ExerciseSet[]) => void;
}

export default function SetEditor({ value, onChange }: SetEditorProps) {
  const updateRow = (idx: number, patch: Partial<ExerciseSet>) => {
    const next = value.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange(next);
  };

  const removeRow = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    const last = value[value.length - 1];
    onChange([...value, { reps: 0, kg: last?.kg ?? 0 }]);
  };

  const bumpKg = (idx: number) => {
    updateRow(idx, { kg: Math.round((value[idx].kg + 1) * 10) / 10 });
  };

  return (
    <div className="space-y-1.5">
      {value.map((set, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          <input
            type="number"
            min={0}
            max={200}
            value={set.reps || ''}
            onChange={(e) =>
              updateRow(i, { reps: parseInt(e.target.value, 10) || 0 })
            }
            placeholder="reps"
            className="w-14 rounded-md border border-border bg-surface2 px-2 py-1 text-center text-white placeholder:text-muted focus:outline-none focus:border-accent-orange"
          />
          <span className="text-muted">×</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={set.kg || ''}
            onChange={(e) =>
              updateRow(i, { kg: parseFloat(e.target.value) || 0 })
            }
            placeholder="kg"
            className="w-20 rounded-md border border-border bg-surface2 px-2 py-1 text-center text-white placeholder:text-muted focus:outline-none focus:border-accent-orange"
          />
          <span className="text-muted text-[10px]">kg</span>
          <button
            type="button"
            onClick={() => bumpKg(i)}
            className="rounded border border-border bg-surface2 px-2 py-1 text-[10px] text-muted hover:border-accent-orange hover:text-white"
            title="Dodaj 1kg"
          >
            +1kg
          </button>
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="ml-auto text-muted hover:text-accent-red"
            title="Usuń serię"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-border bg-surface2/50 px-2 py-1 text-[11px] text-muted hover:border-accent-orange hover:text-white"
      >
        <Plus size={12} /> Seria
      </button>
    </div>
  );
}
