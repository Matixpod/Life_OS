import { Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

const PULL_CMD = 'ollama pull qwen2.5:7b-instruct-q4_K_M';

interface Props {
  onTestConnection?: () => void;
}

export default function OllamaSetupGuide({ onTestConnection }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(PULL_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface2 p-4 text-sm space-y-3">
      <div className="font-semibold">Ollama nie jest uruchomione lokalnie</div>
      <ol className="space-y-2 text-muted list-decimal pl-5">
        <li>
          Pobierz Ollama:{' '}
          <a
            className="inline-flex items-center gap-1 text-accent-blue hover:underline"
            href="https://ollama.com"
            target="_blank"
            rel="noreferrer"
          >
            ollama.com <ExternalLink size={12} />
          </a>
        </li>
        <li>
          Pobierz model bazowy:
          <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs">
            <span className="flex-1 truncate">{PULL_CMD}</span>
            <button
              type="button"
              onClick={copy}
              className="text-muted hover:text-white"
              aria-label="Copy command"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </li>
        <li>
          Sprawdź połączenie po pobraniu modelu —{' '}
          <button
            type="button"
            onClick={onTestConnection}
            className="text-accent-blue hover:underline"
          >
            uruchom test
          </button>
          .
        </li>
      </ol>
    </div>
  );
}
