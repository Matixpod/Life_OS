import { ArrowLeft, ExternalLink, Quote } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ErrorBanner from '../components/ErrorBanner';
import { api } from '../services/api';
import type { DailyIntelligence, NewsCategory } from '../types';

const CATEGORY_BORDER: Record<NewsCategory, string> = {
  health: 'border-l-accent-emerald',
  science: 'border-l-accent-blue',
  psychology: 'border-l-accent-purple',
  tech: 'border-l-accent-amber',
  productivity: 'border-l-accent-orange',
};

const CATEGORY_CHIP: Record<NewsCategory, string> = {
  health: 'text-accent-emerald bg-accent-emerald/10',
  science: 'text-accent-blue bg-accent-blue/10',
  psychology: 'text-accent-purple bg-accent-purple/10',
  tech: 'text-accent-amber bg-accent-amber/10',
  productivity: 'text-accent-orange bg-accent-orange/10',
};

export default function Intelligence() {
  const [data, setData] = useState<DailyIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getIntelligence()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load intelligence');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-muted hover:text-white text-sm mb-6"
      >
        <ArrowLeft size={14} /> Dashboard
      </Link>

      <header className="mb-6">
        <div className="text-[11px] tracking-widest uppercase text-muted">Daily Intelligence</div>
        <h1 className="text-2xl md:text-3xl font-semibold mt-1">Today's curated digest</h1>
        <p className="text-sm text-muted mt-2">
          3 research-backed insights and a quote — refreshed once per day.
        </p>
      </header>

      {error && (
        <div className="mb-6">
          <ErrorBanner message={error} />
        </div>
      )}

      <section className="space-y-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-surface border border-border animate-pulse" />
            ))
          : data?.news_items.map((item, i) => (
              <article
                key={i}
                className={`rounded-xl bg-surface border border-border border-l-4 ${CATEGORY_BORDER[item.category]} p-5`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-[10px] tracking-widest uppercase rounded-full px-2 py-0.5 ${CATEGORY_CHIP[item.category]}`}
                  >
                    {item.category}
                  </span>
                </div>
                <h2 className="text-lg font-semibold leading-snug">{item.title}</h2>
                <p className="text-sm text-muted mt-2">{item.summary}</p>
                {item.source_url && (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent-blue hover:underline mt-3"
                  >
                    Source <ExternalLink size={12} />
                  </a>
                )}
              </article>
            ))}
      </section>

      {!loading && data && (
        <section className="mt-8">
          <div className="rounded-xl bg-gradient-to-br from-surface to-surface2 border border-border p-6 md:p-8">
            <Quote size={28} className="text-accent-blue/60 mb-3" />
            <blockquote className="text-lg md:text-xl italic leading-relaxed">
              "{data.quote}"
            </blockquote>
            <div className="text-sm text-muted mt-3">— {data.quote_author}</div>
          </div>
        </section>
      )}
    </div>
  );
}
