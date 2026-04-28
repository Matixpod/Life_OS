import { Lock, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SocraticChatProps {
  challengeTitle: string;
  isUnlocked: boolean;
}

export default function SocraticChat({ challengeTitle, isUnlocked }: SocraticChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  if (!isUnlocked) {
    return (
      <div className="rounded-xl bg-surface border border-border p-8 text-center">
        <Lock size={28} className="mx-auto text-muted mb-3" />
        <p className="text-sm text-muted">
          Timer must expire — or click "I need help" — to unlock the Socratic tutor.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;

    setError(null);
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: question }, { role: 'assistant', content: '' }]);
    setStreaming(true);

    try {
      const res = await api.explainCognitive(challengeTitle, question);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream body');
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const updated = [...m];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { role: 'assistant', content: last.content + chunk };
          }
          return updated;
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Streaming failed');
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="rounded-xl bg-surface border border-border flex flex-col h-[500px] animate-slide-up">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-[11px] tracking-widest uppercase text-muted">Socratic tutor</div>
        <div className="text-sm">Ask questions to deepen your understanding.</div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-sm text-muted text-center pt-12">
            Start with a question — e.g. "What data structure could help here?"
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'ml-auto bg-accent-blue/15 border border-accent-blue/30'
                  : 'bg-surface2 border border-border'
              }`}
            >
              {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
            </div>
          ))
        )}
        {error && <div className="text-sm text-accent-red">{error}</div>}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the tutor…"
          className="flex-1 bg-surface2 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent-blue/60"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="px-3 py-2 rounded-md bg-accent-blue text-white disabled:opacity-40"
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
