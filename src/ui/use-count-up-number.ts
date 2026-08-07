import { useEffect, useRef, useState } from 'react';

/**
 * How long a resource takes to travel from its old value to its new one.
 *
 * The top bar's money and training points change on every week advance, every
 * drill and every signing. Snapping them means the player is told the number
 * changed only if they happened to be looking at that corner; rolling them
 * makes the change itself the thing that catches the eye. Kept short — this
 * runs on the busiest chrome in the game, and a long roll would still be
 * counting when the next screen arrives.
 */
export const RESOURCE_ROLL_MS = 520;

/**
 * A number that travels to its new value instead of jumping to it.
 *
 * Mount shows the value outright: arriving at a screen is not a change, and
 * counting up from zero on every mount would tell the player they had just
 * earned everything they own. Reduced motion pins it to the target too.
 */
export function useCountUpNumber(target: number, reduceMotion: boolean): number {
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = target;
    if (reduceMotion || from === target) {
      setShown(target);
      return undefined;
    }
    const startedAt = Date.now();
    const step = () => {
      const progress = Math.min(1, (Date.now() - startedAt) / RESOURCE_ROLL_MS);
      if (progress < 1) {
        setShown(Math.round(from + (target - from) * easeOut(progress)));
        frameRef.current = requestAnimationFrame(step);
        return;
      }
      // Land on the exact number. A rounded blend is fine mid-flight, but a
      // resource the player is about to spend must never read one short.
      setShown(target);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
  }, [reduceMotion, target]);

  return shown;
}

/** The same cubic ease-out `count-up.ts` uses, so every rolling number matches. */
function easeOut(progress: number): number {
  return 1 - (1 - progress) ** 3;
}
