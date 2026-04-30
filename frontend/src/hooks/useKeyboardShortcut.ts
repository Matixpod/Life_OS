import { useEffect, useRef } from 'react';

/**
 * Fire `callback` when the given key is pressed at the document level.
 *
 * Skips the callback when the user is typing in an editable element
 * (`<input>`, `<textarea>`, or any `contenteditable` host) so that the
 * `N`-to-add shortcut does not steal a keystroke from another input.
 *
 * `key` is matched against `KeyboardEvent.key` case-insensitively. Pass
 * the modifier-bearing combo by checking `e.ctrlKey`/`metaKey` inside
 * the callback if you need it — this hook intentionally stays minimal.
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: { enabled?: boolean } = {},
): void {
  const callbackRef = useRef(callback);
  // Keep the ref fresh without re-binding the listener every render.
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const enabled = options.enabled !== false;

  useEffect(() => {
    if (!enabled) return;
    const target = key.toLowerCase();

    function handler(e: KeyboardEvent): void {
      if (e.key.toLowerCase() !== target) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      callbackRef.current();
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, key]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}
