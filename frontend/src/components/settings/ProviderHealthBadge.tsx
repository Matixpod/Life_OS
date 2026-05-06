import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { aiSettingsApi } from '../../api/aiSettings';
import type { AIProvider, AIProviderHealthStatus } from '../../types';

interface Props {
  status: AIProviderHealthStatus;
  onRefreshed?: (next: AIProviderHealthStatus) => void;
}

const PROVIDER_LABELS: Record<AIProvider, string> = {
  claude: 'Claude',
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
  ollama: 'Ollama',
};

export default function ProviderHealthBadge({ status, onRefreshed }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dotClass = busy
    ? 'bg-accent-amber'
    : status.online
      ? 'bg-accent-emerald'
      : 'bg-accent-red';

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const next = await aiSettingsApi.getProviderHealth(status.provider);
      onRefreshed?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'health check failed');
    } finally {
      setBusy(false);
    }
  }

  const tooltip = error ?? status.error_message ?? (status.online ? 'Online' : 'Offline');

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={busy}
      title={tooltip}
      className="flex items-center gap-2 rounded-md border border-border bg-surface2 px-3 py-2 text-sm transition-colors hover:bg-surface disabled:opacity-60"
    >
      <span className={`size-2.5 rounded-full ${dotClass}`} aria-hidden />
      <span className="font-medium">{PROVIDER_LABELS[status.provider]}</span>
      <RefreshCw size={12} className={busy ? 'animate-spin text-muted' : 'text-muted'} />
    </button>
  );
}
