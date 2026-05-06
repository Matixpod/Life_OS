import { Bot, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { aiSettingsApi } from '../../api/aiSettings';
import type {
  AIAvailableModels,
  AIModelPreference,
  AIProvider,
  AIProviderHealthStatus,
} from '../../types';
import ModelSelector from './ModelSelector';
import ProviderHealthBadge from './ProviderHealthBadge';

interface AgentDef {
  id: string;
  label: string;
  description: string;
  icon: typeof ShieldCheck;
}

const AGENTS: AgentDef[] = [
  {
    id: 'global',
    label: 'Global Default',
    description: 'Używany gdy agent nie ma własnego ustawienia',
    icon: Sparkles,
  },
  {
    id: 'kronos',
    label: 'KRONOS — Discipline',
    description: 'Streak tracker, pattern analyzer, plan-vs-execution',
    icon: ShieldCheck,
  },
  {
    id: 'ares',
    label: 'ARES — Vitality',
    description: 'Health score & physical training analyst',
    icon: Bot,
  },
];

const DEFAULT_TEMP = 0.7;

const DEFAULT_MODEL_FOR: Record<AIProvider, string> = {
  claude: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.0-flash',
  deepseek: 'deepseek-chat',
  ollama: 'qwen2.5:7b-instruct-q4_K_M',
};

export default function AISettings() {
  const [models, setModels] = useState<AIAvailableModels | null>(null);
  const [preferences, setPreferences] = useState<AIModelPreference[]>([]);
  const [health, setHealth] = useState<AIProviderHealthStatus[]>([]);
  const [editing, setEditing] = useState<AgentDef | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function refreshAll() {
    setRefreshing(true);
    setError(null);
    try {
      const [m, p, h] = await Promise.all([
        aiSettingsApi.getModels(),
        aiSettingsApi.getPreferences(),
        aiSettingsApi.getHealth(),
      ]);
      setModels(m);
      setPreferences(p.preferences);
      setHealth(h.providers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshAll();
  }, []);

  function preferenceFor(agentId: string): AIModelPreference | null {
    return preferences.find((p) => p.agent_id === agentId) ?? null;
  }

  function modelLabel(provider: AIProvider, modelId: string): string {
    const list = models?.[provider] ?? [];
    return list.find((m) => m.id === modelId)?.name ?? modelId;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI Settings</h1>
          <p className="text-sm text-muted">
            Wybierz dostawcę i model dla każdego agenta. Zmiany zaczynają obowiązywać przy kolejnej analizie.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-md border border-border bg-surface2 px-3 py-2 text-sm hover:bg-surface disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Odśwież
        </button>
      </header>

      {error && (
        <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-4 py-2 text-sm text-accent-red">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs uppercase tracking-widest text-muted">Provider Health</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {health.length === 0 && (
            <div className="text-sm text-muted">Sprawdzam dostępność…</div>
          )}
          {health.map((h) => (
            <ProviderHealthBadge
              key={h.provider}
              status={h}
              onRefreshed={(next) =>
                setHealth((prev) =>
                  prev.map((p) => (p.provider === next.provider ? next : p)),
                )
              }
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface">
        <ul className="divide-y divide-border">
          {AGENTS.map((agent) => {
            const pref = preferenceFor(agent.id);
            const provider = pref?.provider ?? 'claude';
            const modelId = pref?.model_name ?? DEFAULT_MODEL_FOR[provider];
            const Icon = agent.icon;
            return (
              <li key={agent.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex size-9 items-center justify-center rounded-md bg-surface2 text-muted">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium">{agent.label}</div>
                    <div className="text-xs text-muted truncate">{agent.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest text-muted">
                      {provider}
                    </div>
                    <div className="font-mono text-xs">{modelLabel(provider, modelId)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(agent)}
                    className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-sm hover:bg-surface"
                    disabled={!models}
                  >
                    Zmień
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {editing && models && (
        <ModelSelector
          agentId={editing.id}
          agentLabel={editing.label}
          models={models}
          health={health}
          initialProvider={preferenceFor(editing.id)?.provider ?? 'claude'}
          initialModel={
            preferenceFor(editing.id)?.model_name ??
            DEFAULT_MODEL_FOR[preferenceFor(editing.id)?.provider ?? 'claude']
          }
          initialTemperature={preferenceFor(editing.id)?.temperature ?? DEFAULT_TEMP}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refreshAll();
          }}
        />
      )}
    </div>
  );
}
