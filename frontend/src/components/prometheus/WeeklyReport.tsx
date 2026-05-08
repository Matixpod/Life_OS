import { Loader2, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { prometheusApi, readSSE, type SSEReportEvent } from '../../api/prometheus';
import {
  MUSCLE_LABELS_PL,
  type MuscleKey,
  type WeeklyReport,
} from '../../types/prometheus';

function startOfWeekIso(d = new Date()): string {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export default function WeeklyReportView() {
  const weekStart = startOfWeekIso();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [streamPreview, setStreamPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    prometheusApi
      .getReport(weekStart)
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Błąd');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setStreamPreview('');
    try {
      const res = await prometheusApi.generateReport(weekStart);
      let buffer = '';
      for await (const event of readSSE<SSEReportEvent>(res)) {
        if (event.error) {
          setError(event.error);
          continue;
        }
        if (event.chunk) {
          buffer += event.chunk;
          setStreamPreview(buffer);
        }
        if (event.done && event.report && event.week_start) {
          setReport({ ...event.report, week_start: event.week_start });
          setStreamPreview('');
          break;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd generowania raportu');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted">
            Raport tygodniowy
          </div>
          <h3 className="text-sm font-medium text-white">
            Tydzień od {weekStart}
          </h3>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-orange px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
        >
          {generating ? (
            <Loader2 size={13} className="animate-spin" />
          ) : report ? (
            <RefreshCw size={13} />
          ) : (
            <Sparkles size={13} />
          )}
          {generating ? 'Generuję...' : report ? 'Regeneruj' : 'Generuj raport'}
        </button>
      </header>

      <div className="px-5 py-5 min-h-[200px] space-y-4">
        {error && <div className="text-xs text-accent-red">{error}</div>}
        {loading && <div className="text-xs text-muted">Ładowanie...</div>}

        {generating && streamPreview && (
          <pre className="text-[11px] font-mono text-muted whitespace-pre-wrap max-h-48 overflow-y-auto bg-surface2 rounded-md p-2">
            {streamPreview}
          </pre>
        )}

        {report && !generating && (
          <>
            <section>
              <h4 className="text-xs uppercase tracking-widest text-muted mb-1">Podsumowanie</h4>
              <p className="text-sm text-white">{report.summary || '—'}</p>
            </section>

            {report.strengths.length > 0 && (
              <section>
                <h4 className="text-xs uppercase tracking-widest text-accent-emerald mb-1 flex items-center gap-1">
                  <TrendingUp size={12} /> Mocne strony
                </h4>
                <ul className="space-y-0.5 text-sm text-white">
                  {report.strengths.map((s, i) => (
                    <li key={i}>· {s}</li>
                  ))}
                </ul>
              </section>
            )}

            {report.weaknesses.length > 0 && (
              <section>
                <h4 className="text-xs uppercase tracking-widest text-accent-amber mb-1">
                  Do poprawy
                </h4>
                <ul className="space-y-0.5 text-sm text-white">
                  {report.weaknesses.map((s, i) => (
                    <li key={i}>· {s}</li>
                  ))}
                </ul>
              </section>
            )}

            {report.missed_muscles.length > 0 && (
              <section>
                <h4 className="text-xs uppercase tracking-widest text-accent-red mb-1">
                  Pominięte mięśnie
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {report.missed_muscles.map((m: MuscleKey) => (
                    <span
                      key={m}
                      className="rounded-md border border-accent-red/40 bg-accent-red/10 px-2 py-0.5 text-[11px] text-accent-red"
                    >
                      {MUSCLE_LABELS_PL[m] ?? m}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {report.next_week_plan.length > 0 && (
              <section>
                <h4 className="text-xs uppercase tracking-widest text-muted mb-2">
                  Plan na następny tydzień
                </h4>
                <div className="space-y-2">
                  {report.next_week_plan.map((day, i) => (
                    <div key={i} className="rounded-md border border-border bg-surface2 p-3">
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-sm font-medium text-white">{day.day}</span>
                        <span className="text-[11px] text-accent-orange">{day.focus}</span>
                      </div>
                      <ul className="text-[12px] text-muted space-y-0.5">
                        {day.exercises.map((ex, j) => (
                          <li key={j}>· {ex}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {report.prometheus_words && (
              <blockquote className="border-l-2 border-accent-orange pl-3 italic text-sm text-white">
                {report.prometheus_words}
              </blockquote>
            )}
          </>
        )}

        {!loading && !report && !generating && !streamPreview && (
          <p className="text-sm text-muted">
            Brak raportu dla tego tygodnia. Kliknij <strong>Generuj raport</strong>.
          </p>
        )}
      </div>
    </div>
  );
}
