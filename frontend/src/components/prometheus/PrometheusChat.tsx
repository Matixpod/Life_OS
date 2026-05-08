import { Flame, Loader2, Send } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { prometheusApi, readSSE, type SSEChatEvent } from '../../api/prometheus';
import type { ChatMessage } from '../../types/prometheus';

export default function PrometheusChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setStreaming(true);
    setError(null);

    let assistantText = '';
    setMessages([...next, { role: 'assistant', content: '' }]);

    try {
      const res = await prometheusApi.chatStream(next);
      for await (const event of readSSE<SSEChatEvent>(res)) {
        if (event.error) {
          setError(event.error);
          continue;
        }
        if (event.chunk) {
          assistantText += event.chunk;
          setMessages([...next, { role: 'assistant', content: assistantText }]);
        }
        if (event.done) break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd połączenia z PROMETHEUS');
      setMessages(next);
    } finally {
      setStreaming(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-surface">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Flame size={16} className="text-accent-orange" />
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted">PROMETHEUS</div>
          <div className="text-sm font-medium text-white">Twój trener</div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.length === 0 && !streaming && (
          <p className="text-xs text-muted italic">
            Mów do mnie. Pytaj o trening, plan tygodnia, technikę, regenerację.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[90%] rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${
              m.role === 'user'
                ? 'ml-auto bg-accent-orange/20 text-white border border-accent-orange/30'
                : 'mr-auto bg-surface2 text-white border border-border'
            }`}
          >
            {m.content || (streaming && i === messages.length - 1 ? '...' : '')}
          </div>
        ))}
        {error && (
          <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={streaming}
            placeholder="Pytaj PROMETHEUS..."
            className="flex-1 resize-none rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent-orange disabled:opacity-50"
          />
          <button
            type="button"
            onClick={send}
            disabled={streaming || !input.trim()}
            className="rounded-md bg-accent-orange px-3 text-black disabled:opacity-50"
          >
            {streaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
