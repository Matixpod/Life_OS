import { Loader2, Send, Sparkles } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { prometheusApi } from '../../api/prometheus';
import {
  MUSCLE_LABELS_PL,
  intensityLabel,
  type MuscleKey,
  type ParsedExercise,
} from '../../types/prometheus';

interface ExerciseInputProps {
  onExerciseAdded: (parsed: ParsedExercise) => void;
}

export default function ExerciseInput({ onExerciseAdded }: ExerciseInputProps) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedExercise | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setParsed(null);
    try {
      const result = await prometheusApi.parseExercise(trimmed);
      setParsed(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd analizy');
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!parsed) return;
    setAdding(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await prometheusApi.createSession({
        date: today,
        label: parsed.exercise_name,
        exercises: [
          {
            exercise_name: parsed.exercise_name,
            sets: parsed.sets,
            muscle_load: parsed.muscle_load,
          },
        ],
      });
      onExerciseAdded(parsed);
      setParsed(null);
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać');
    } finally {
      setAdding(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-accent-orange" />
        <span className="text-[11px] uppercase tracking-widest text-muted">
          Dodaj ćwiczenie
        </span>
      </div>
      <textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="np. Wyciskanie na klatę 12x80kg 10x85kg 8x85kg"
        disabled={loading || adding}
        className="w-full resize-none rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent-orange disabled:opacity-50"
      />
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted">Enter = analizuj · Shift+Enter = nowa linia</span>
        <button
          type="button"
          onClick={submit}
          disabled={loading || adding || !text.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-orange px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {loading ? 'PROMETHEUS analizuje...' : 'Analizuj'}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
          {error}
        </div>
      )}

      {parsed && (
        <div className="rounded-md border border-accent-emerald/40 bg-accent-emerald/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-white">{parsed.exercise_name}</span>
            <button
              type="button"
              onClick={confirm}
              disabled={adding}
              className="rounded-md bg-accent-emerald px-3 py-1 text-[11px] font-medium text-black disabled:opacity-50"
            >
              {adding ? 'Zapisuję...' : 'Zapisz w treningu'}
            </button>
          </div>
          {parsed.sets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {parsed.sets.map((s, i) => (
                <span
                  key={i}
                  className="rounded-md border border-border bg-surface2 px-2 py-0.5 font-mono text-[11px] text-white"
                >
                  {s.reps}×{s.kg}kg
                </span>
              ))}
            </div>
          )}
          {Object.keys(parsed.muscle_load).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(parsed.muscle_load).map(([key, intensity]) => {
                const label = intensityLabel(intensity);
                return (
                  <span
                    key={key}
                    className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${label?.color ?? '#22C55E'}20`,
                      color: label?.color ?? '#22C55E',
                    }}
                  >
                    {MUSCLE_LABELS_PL[key as MuscleKey] ?? key} · {Math.round(intensity * 100)}%
                  </span>
                );
              })}
            </div>
          )}
          {parsed.comment && (
            <p className="text-xs italic text-muted border-l-2 border-accent-orange pl-2">
              {parsed.comment}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
