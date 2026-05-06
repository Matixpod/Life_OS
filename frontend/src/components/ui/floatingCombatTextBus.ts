export type CombatTextTone = 'xp' | 'stat' | 'ap' | 'ap-cost';

export interface FloatingText {
  id: string;
  text: string;
  tone: CombatTextTone;
}

type Listener = (msg: FloatingText) => void;

const listeners: Set<Listener> = new Set();
let nextId = 0;

/**
 * Imperative API: emit a combat text from anywhere in the app. The
 * `<FloatingCombatText />` component subscribes to this bus and renders
 * a stack of animated chips.
 *
 * Why module-level pub/sub instead of context? The trigger sites (boost
 * panel, task complete, stat updates) live in unrelated subtrees —
 * wiring a Provider through every page would add scaffolding for a
 * feature whose data flow is intrinsically fire-and-forget.
 */
export function emitCombatText(text: string, tone: CombatTextTone): void {
  nextId += 1;
  const msg: FloatingText = { id: `ct-${nextId}`, text, tone };
  listeners.forEach((l) => l(msg));
}

export function subscribeCombatText(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
