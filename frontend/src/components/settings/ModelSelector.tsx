import { useEffect, useMemo, useState } from 'react';
import { aiSettingsApi } from '../../api/aiSettings';
import type {
  AIAvailableModels,
  AIModelInfo,
  AIProvider,
  AIProviderHealthStatus,
} from '../../types';
import OllamaSetupGuide from './OllamaSetupGuide';

interface Props {
  agentId: string;
  agentLabel: string;
  models: AIAvailableModels;
  health: AIProviderHealthStatus[];
  initialProvider: AIProvider;
  initialModel: string;
  initialTemperature: number;
  onClose: () => void;
  onSaved: () => void;
}

const PROVIDER_ORDER: AIProvider[] = ['claude', 'gemini', 'deepseek', 'ollama'];
const PROVIDER_LABELS: Record<AIProvider, string> = {
  claude: 'Claude',
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
  ollama: 'Ollama',
};

export default function ModelSelector({
  agentId,
  agentLabel,
  models,
  health,
  initialProvider,
  initialModel,
  initialTemperature,
  onClose,
  onSaved,
}: Props) {
  const [provider, setProvider] = useState<AIProvider>(initialProvider);
  const [model, setModel] = useState<string>(initialModel);
  const [temperature, setTemperature] = useState<number>(initialTemperature);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const healthByProvider = useMemo(() => {
    const map: Record<AIProvider, AIProviderHealthStatus | undefined> = {
      claude: undefined,
      gemini: undefined,
      deepseek: undefined,
      ollama: undefined,
    };
    for (const h of health) map[h.provider] = h;
    return map;
  }, [health]);

  const currentList: AIModelInfo[] = models[provider] ?? [];
  const ollamaOffline = !(healthByProvider.ollama?.online ?? false);

  useEffect(() => {
    if (!currentList.find((m) => m.id === model)) {
      const recommended = currentList.find((m) => m.recommended) ?? currentList[0];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (recommended) setModel(recommended.id);
    }
  }, [provider, currentList, model]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await aiSettingsApi.setPreference(agentId, {
        provider,
        model_name: model,
        temperature,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-surface shadow-xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted">Model dla</div>
            <div className="text-lg font-semibold">{agentLabel}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex border-b border-border px-2">
          {PROVIDER_ORDER.map((p) => {
            const offline = !(healthByProvider[p]?.online ?? false);
            const disabled = offline && p !== provider;
            const isActive = provider === p;
            return (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => setProvider(p)}
                className={`px-4 py-3 text-sm transition-colors border-b-2 ${
                  isActive
                    ? 'border-accent-blue text-white'
                    : 'border-transparent text-muted hover:text-white'
                } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${offline ? 'bg-accent-red' : 'bg-accent-emerald'}`}
                    aria-hidden
                  />
                  {PROVIDER_LABELS[p]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-3">
          {provider === 'ollama' && ollamaOffline && (
            <OllamaSetupGuide />
          )}

          {provider === 'ollama' && (
            <div className="text-xs text-muted">
              Wymaga lokalnej instalacji Ollama. Modele 7–9B w Q4_K_M mieszczą się w 8 GB VRAM.
            </div>
          )}

          {currentList.length === 0 ? (
            <div className="rounded-md border border-border bg-surface2 p-4 text-sm text-muted">
              Brak dostępnych modeli dla tego dostawcy.
            </div>
          ) : (
            <ul className="space-y-2">
              {currentList.map((m) => {
                const isSelected = m.id === model;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setModel(m.id)}
                      className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-accent-blue bg-surface2'
                          : 'border-border bg-surface2 hover:border-accent-blue/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{m.name}</div>
                          <div className="font-mono text-xs text-muted">{m.id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.vram_gb !== null && (
                            <span className="rounded bg-bg px-2 py-0.5 text-[10px] text-muted">
                              ~{m.vram_gb} GB VRAM
                            </span>
                          )}
                          {m.recommended && (
                            <span className="rounded bg-accent-blue/20 px-2 py-0.5 text-[10px] text-accent-blue">
                              Recommended
                            </span>
                          )}
                        </div>
                      </div>
                      {provider === 'ollama' && (
                        <div className="mt-2 font-mono text-[11px] text-muted">
                          ollama pull {m.id}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="rounded-md border border-border bg-surface2 p-4">
            <label className="flex items-center justify-between text-sm">
              <span>Temperature</span>
              <span className="font-mono text-xs">{temperature.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="mt-2 w-full accent-accent-blue"
            />
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          {error ? (
            <span className="text-xs text-accent-red">{error}</span>
          ) : (
            <span className="text-xs text-muted">
              Wybór zapamiętany dla agenta. Zmiana zacznie obowiązywać przy kolejnej analizie.
            </span>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted hover:text-white"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-md bg-accent-blue px-4 py-2 text-sm text-white hover:bg-accent-blue/80 disabled:opacity-60"
            >
              {saving ? 'Zapisywanie…' : 'Zapisz'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
