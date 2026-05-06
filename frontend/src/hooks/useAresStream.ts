import { useCallback, useEffect, useRef, useState } from 'react';
import { aresApi } from '../api/ares';
import type { AresAnalysisRequest, AresToneMode } from '../types';

interface AresSSEEvent {
  chunk?: string;
  done?: boolean;
  analysis_id?: string;
  status?: string;
  error?: string;
  score?: number;
  delta?: number | null;
  tone?: AresToneMode;
}

function parseSSE(buffer: string): { events: AresSSEEvent[]; remainder: string } {
  const events: AresSSEEvent[] = [];
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() ?? '';
  for (const block of parts) {
    const line = block.split('\n').find((l) => l.startsWith('data: '));
    if (!line) continue;
    try {
      events.push(JSON.parse(line.slice(6)) as AresSSEEvent);
    } catch {
      /* ignore malformed */
    }
  }
  return { events, remainder };
}

interface Options {
  onChunk: (chunk: string) => void;
  onScore: (info: { score: number; delta: number | null; tone: AresToneMode }) => void;
  onDone: (analysisId: string | null) => void;
  onError: (msg: string) => void;
}

export interface UseAresStreamApi {
  start: (analysisType?: AresAnalysisRequest['analysis_type']) => void;
  stop: () => void;
  isStreaming: boolean;
}

export function useAresStream(options: Options): UseAresStreamApi {
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

  const start = useCallback((analysisType: AresAnalysisRequest['analysis_type'] = 'weekly') => {
    cancelledRef.current = false;
    setIsStreaming(true);

    const run = async () => {
      let res: Response;
      try {
        res = await aresApi.streamAnalysis({ analysis_type: analysisType });
      } catch (e) {
        optsRef.current.onError(
          e instanceof Error ? e.message : 'Failed to start ARES analysis',
        );
        setIsStreaming(false);
        return;
      }

      try {
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No stream body');
        const decoder = new TextDecoder();
        let buffer = '';
        let finalEvt: AresSSEEvent | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelledRef.current) break;
          buffer += decoder.decode(value, { stream: true });
          const { events, remainder } = parseSSE(buffer);
          buffer = remainder;
          for (const evt of events) {
            if (evt.error) optsRef.current.onError(evt.error);
            if (typeof evt.score === 'number' && evt.tone) {
              optsRef.current.onScore({
                score: evt.score,
                delta: evt.delta ?? null,
                tone: evt.tone,
              });
            }
            if (evt.chunk) optsRef.current.onChunk(evt.chunk);
            if (evt.done) finalEvt = evt;
          }
        }

        if (finalEvt) optsRef.current.onDone(finalEvt.analysis_id ?? null);
      } catch (e) {
        if (cancelledRef.current) return;
        optsRef.current.onError(
          e instanceof Error ? e.message : 'ARES stream interrupted',
        );
      } finally {
        if (!cancelledRef.current) setIsStreaming(false);
      }
    };

    void run();
  }, []);

  return { start, stop, isStreaming };
}
