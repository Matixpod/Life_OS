import { useEffect, useState } from 'react';

import {
  type CombatTextTone,
  type FloatingText,
  subscribeCombatText,
} from './floatingCombatTextBus';

const TONE_CLASSES: Record<CombatTextTone, string> = {
  xp: 'text-amber-300 bg-amber-400/15 border-amber-400/40',
  stat: 'text-red-300 bg-red-500/15 border-red-500/40',
  ap: 'text-yellow-300 bg-yellow-400/15 border-yellow-400/40',
  'ap-cost': 'text-red-400 bg-red-500/10 border-red-500/30',
};

interface FloatingCombatTextProps {
  /** ms before the text auto-removes; matches the CSS animation. */
  durationMs?: number;
}

/**
 * Stack of floating combat-text chips, mounted once at the layout level.
 * Subscribes to the module-level bus in `floatingCombatTextBus.ts` so
 * any component can fire-and-forget via `emitCombatText(...)`.
 */
export default function FloatingCombatText({ durationMs = 1500 }: FloatingCombatTextProps) {
  const [items, setItems] = useState<FloatingText[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeCombatText((msg) => {
      setItems((prev) => [...prev, msg]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((m) => m.id !== msg.id));
      }, durationMs);
    });
    return unsubscribe;
  }, [durationMs]);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[120] flex flex-col items-center gap-1">
      {items.map((m, i) => (
        <div
          key={m.id}
          className={`animate-xp-float rounded-full border px-3 py-1 font-mono text-sm shadow-lg ${TONE_CLASSES[m.tone]}`}
          style={{ marginTop: i === 0 ? 0 : -4 }}
        >
          {m.text}
        </div>
      ))}
    </div>
  );
}
