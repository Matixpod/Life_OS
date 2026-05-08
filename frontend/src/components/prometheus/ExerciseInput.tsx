import { Loader2, Send, Sparkles, X } from 'lucide-react';
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

interface ParseFailure {
  line: string;
  error: string;
}

function deriveSessionLabel(items: ParsedExercise[]): string {
  if (items.length === 0) return 'Trening';
  if (items.length === 1) return items[0].exercise_name;
  if (items.length === 2)
    return `${items[0].exercise_name} + ${items[1].exercise_name}`;
  return `${items[0].exercise_name} + ${items[1].exercise_name} +${items.length - 2}`;
}

export default function ExerciseInput({ onExerciseAdded }: ExerciseInputProps) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedExercise[]>([]);
  const [failures, setFailures] = useState<ParseFailure[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setLoading(true);
    setError(null);
    setParsed([]);
    setFailures([]);
    try {
      const results = await Promise.all(
        lines.map(async (line) => {
          try {
            const parsed = await prometheusApi.parseExercise(line);
            return { ok: true as const, line, parsed };
          } catch (e) {
            return {
              ok: false as const,
              line,
              error: e instanceof Error ? e.message : 'Błąd analizy',
            };
          }
        }),
      );
      const ok: ParsedExercise[] = [];
      const bad: ParseFailure[] = [];
      for (const r of results) {
        if (r.ok) ok.push(r.parsed);
        else bad.push({ line: r.line, error: r.error });
      }
      setParsed(ok);
      setFailures(bad);
      if (ok.length === 0 && bad.length > 0) {
        setError('Żadna linia nie została poprawnie zinterpretowana.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd analizy');
    } finally {
      setLoading(false);
    }
  };

  const removeAt = (idx: number) => {
    setParsed((prev) => prev.filter((_, i) => i !== idx));
  };

  const confirm = async () => {
    if (parsed.length === 0) return;
    setAdding(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await prometheusApi.createSession({
        date: today,
        label: deriveSessionLabel(parsed),
        exercises: parsed.map((p) => ({
          exercise_name: p.exercise_name,
          sets: p.sets,
          muscle_load: p.muscle_load,
        })),
      });
      // Notify the page once per parsed exercise so the recovery map +
      // optimistic state pick up every muscle hit.
      for (const p of parsed) onExerciseAdded(p);
      setParsed([]);
      setFailures([]);
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać');
    } finally {
      setAdding(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Plain Enter inserts a newline (textarea default) so multi-line input
    // is comfortable. Cmd/Ctrl+Enter triggers analysis.
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  };

  const lineCount = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean).length;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <Sparkles size={14} className="text-accent-orange" />
          <span className="text-[11px] uppercase tracking-widest text-muted">
            Dodaj ćwiczenia (każda linia = osobne)
          </span>
        </div>
        {lineCount > 0 && (
          <span className="text-[10px] font-mono text-muted">
            {lineCount} {lineCount === 1 ? 'linia' : lineCount < 5 ? 'linie' : 'linii'}
          </span>
        )}
      </div>
      <textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={
          'np.\n' +
          'Wyciskanie na klatę 12x80kg 10x85kg 8x85kg\n' +
          'Wiosłowanie sztangą 3x10x60kg\n' +
          'Uginanie ramion 12x20kg 10x22kg'
        }
        disabled={loading || adding}
        className="w-full resize-y rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent-orange disabled:opacity-50"
      />
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted">
          Cmd/Ctrl + Enter = analizuj · Enter = nowa linia
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={loading || adding || lineCount === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-orange px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {loading
            ? 'PROMETHEUS analizuje...'
            : lineCount > 1
              ? `Analizuj ${lineCount} ćw.`
              : 'Analizuj'}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
          {error}
        </div>
      )}

      {failures.length > 0 && (
        <div className="rounded-md border border-accent-amber/40 bg-accent-amber/5 px-3 py-2 text-[11px] text-accent-amber space-y-0.5">
          <div className="font-medium">Pominięto {failures.length} linii:</div>
          {failures.map((f, i) => (
            <div key={i} className="font-mono text-muted truncate">
              · {f.line}
            </div>
          ))}
        </div>
      )}

      {parsed.length > 0 && (
        <div className="space-y-2">
          {parsed.map((p, idx) => (
            <ParsedExerciseCard
              key={idx}
              parsed={p}
              onRemove={() => removeAt(idx)}
            />
          ))}
          <button
            type="button"
            onClick={confirm}
            disabled={adding}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-accent-emerald px-3 py-2 text-xs font-medium text-black disabled:opacity-50"
          >
            {adding
              ? 'Zapisuję...'
              : parsed.length === 1
                ? 'Zapisz w treningu'
                : `Zapisz ${parsed.length} ćw. w treningu`}
          </button>
        </div>
      )}
    </div>
  );
}

interface ParsedExerciseCardProps {
  parsed: ParsedExercise;
  onRemove: () => void;
}

function ParsedExerciseCard({ parsed, onRemove }: ParsedExerciseCardProps) {
  return (
    <div className="rounded-md border border-accent-emerald/40 bg-accent-emerald/5 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-white">{parsed.exercise_name}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Usuń z listy"
          className="text-muted hover:text-accent-red"
        >
          <X size={13} />
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
  );
}
