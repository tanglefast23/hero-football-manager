import { useCallback, useEffect, useRef } from 'react';

/**
 * Long enough to swallow the second tap of a double-tap (~300ms is the usual
 * threshold), short enough that deliberate consecutive taps never feel stuck.
 */
const DEFAULT_GUARD_MS = 400;

/**
 * Guards a commit whose button is immediately re-rendered holding a *different*
 * decision — the season-end renewal queue, the legacy queue, the negotiation
 * round counter. In all three the store updates synchronously, so the second
 * tap of an ordinary double-tap lands on a button that has already become the
 * next player, the next legend, or the next round, and commits it unread.
 *
 * The window is time-based rather than identity-based on purpose: keying off
 * the item would re-arm the instant the item changed, which is exactly the
 * frame the stray tap arrives in. It always re-arms on a timer, so a commit the
 * store refuses can never leave the button latched off.
 */
export function useTapGuard(guardMs: number = DEFAULT_GUARD_MS): (commit: () => void) => void {
  const blockedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  return useCallback((commit: () => void) => {
    if (blockedRef.current) return;
    blockedRef.current = true;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      blockedRef.current = false;
    }, guardMs);
    commit();
  }, [guardMs]);
}
