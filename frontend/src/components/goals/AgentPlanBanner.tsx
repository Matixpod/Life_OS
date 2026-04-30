import { Bot, RefreshCw, Sparkles } from 'lucide-react';
import type { DailyPlan } from '../../types';

interface AgentPlanBannerProps {
  plan: DailyPlan | null;
  generating: boolean;
  onGenerate: () => void;
}

export default function AgentPlanBanner({ plan, generating, onGenerate }: AgentPlanBannerProps) {
  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-surface to-surface2 p-5 md:p-6 relative overflow-hidden">
      <div className="absolute -top-12 -right-12 size-48 rounded-full bg-accent-blue/10 blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between gap-3 mb-3 relative">
        <div className="flex items-center gap-2 text-[11px] tracking-widest uppercase text-muted">
          <Bot size={14} className="text-accent-blue" />
          Agent Plan
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-surface2 border border-border hover:border-accent-blue/40 text-muted hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />
          {plan ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {plan ? (
        <>
          <p className="text-sm md:text-base leading-relaxed text-white/90 relative">
            {plan.plan_summary || 'No plan summary.'}
          </p>
          {plan.energy_context && (
            <p className="mt-2 text-xs text-muted relative inline-flex items-center gap-1.5">
              <Sparkles size={12} className="text-accent-amber" />
              {plan.energy_context}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted relative">
          {generating
            ? 'Generating today’s plan…'
            : 'No plan generated yet — click Generate to have the agent draft an ordered list of tasks for today.'}
        </p>
      )}
    </div>
  );
}
