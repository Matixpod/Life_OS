import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { AnalysisType, TaskCategory } from '../types';

interface SSEEvent {
  chunk?: string;
  done?: boolean;
  analysis_id?: string;
  status?: string;
  error?: string;
}

function parseSSE(buffer: string): { events: SSEEvent[]; remainder: string } {
  const events: SSEEvent[] = [];
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() ?? '';
  for (const block of parts) {
    const line = block.split('\n').find((l) => l.startsWith('data: '));
    if (!line) continue;
    try {
      events.push(JSON.parse(line.slice(6)) as SSEEvent);
    } catch {
      // ignore malformed
    }
  }
  return { events, remainder };
}

interface UseKronosStreamOptions {
  onChunk: (chunk: string) => void;
  onDone: (analysisId: string) => void;
  onError: (error: string) => void;
}

export interface UseKronosStreamApi {
  start: (analysisType: AnalysisType, focusCategory?: TaskCategory) => void;
  stop: () => void;
  isStreaming: boolean;
}

export function useKronosStream(options: UseKronosStreamOptions): UseKronosStreamApi {
  const [isStreaming, setIsStreaming] = useState(false);
  const cancelledRef = useRef(false);
  const optsRef = useRef(options);

  useEffect(() => {
    optsRef.current = options;
  }, [options]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    setIsStreaming(false);
  }, []);

  const start = useCallback((analysisType: AnalysisType, focusCategory?: TaskCategory) => {
    cancelledRef.current = false;
    setIsStreaming(true);

    const run = async function run(attempt: number): Promise<void> {
      let res: Response;
      try {
        res = await api.streamKronosAnalysis({
          analysis_type: analysisType,
          ...(focusCategory ? { focus_category: focusCategory } : {}),
        });
      } catch (e: unknown) {
        // Initial fetch rejected (e.g. 400 "no data yet"). Don't retry — it's
        // not a transient disconnection.
        optsRef.current.onError(e instanceof Error ? e.message : 'Failed to start analysis');
        setIsStreaming(false);
        return;
      }

      try {
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No stream body');
        const decoder = new TextDecoder();
        let buffer = '';
        let finalEvent: SSEEvent | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelledRef.current) break;
          buffer += decoder.decode(value, { stream: true });
          const { events, remainder } = parseSSE(buffer);
          buffer = remainder;
          for (const evt of events) {
            if (evt.error) optsRef.current.onError(evt.error);
            if (evt.chunk) optsRef.current.onChunk(evt.chunk);
            if (evt.done) finalEvent = evt;
          }
        }

        if (finalEvent?.analysis_id) {
          optsRef.current.onDone(finalEvent.analysis_id);
        }
      } catch (e: unknown) {
        if (cancelledRef.current) return;
        optsRef.current.onError(e instanceof Error ? e.message : 'Stream interrupted');
        if (attempt < 1) {
          setTimeout(() => {
            void run(attempt + 1);
          }, 800);
          return;
        }
      } finally {
        if (!cancelledRef.current) setIsStreaming(false);
      }
    };

    void run(0);
  }, []);

  return { start, stop, isStreaming };
}
