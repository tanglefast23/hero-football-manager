import { useEffect } from 'react';
import { createPreloadPump } from '../application/rival-preload';
import type { TeamDef } from '../sim/types';
import type { LeagueFixture } from '../game/types';

/**
 * Ticks per inner burst. The deadline is only consulted *between* bursts, so
 * this bounds how far a slice can overshoot. Measured in Node/V8 on 2026-07-27,
 * steady state: 8 ticks = 0.61ms median / 1.82ms worst, 16 = 1.19/2.01,
 * 32 = 2.37/3.46. Hermes runs roughly 3-4x slower, which would put a 32-tick
 * burst near 10ms — a dropped frame on its own. Eight keeps the worst case
 * inside a frame even on device, and the cost is only loop overhead, which the
 * while-loop below amortises across one idle callback.
 */
const TICKS_PER_BURST = 8;
/**
 * Keep working while at least this much of the idle slice remains — enough
 * headroom for one burst to overrun without eating the frame. A static screen
 * may use most of the slice; while a match is animating the floor is higher so
 * the preload only ever takes genuinely spare time. There is far more of it
 * there — minutes of match against ~2s of work — so being timid costs nothing.
 */
const STATIC_FLOOR_MS = 3;
const WATCHING_FLOOR_MS = 6;
/** Upper bound on waiting for an idle moment that may never arrive. */
const IDLE_TIMEOUT_MS = 500;
/** Slice length assumed when falling back to a plain timer. */
const FALLBACK_BUDGET_MS = 6;

interface IdleDeadline {
  timeRemaining: () => number;
}

interface CancelHandle {
  cancel: () => void;
}

/**
 * `InteractionManager` is a deprecated stub in React Native 0.86, so this uses
 * `requestIdleCallback`, which React Native installs as a global. The fallback
 * keeps any runtime without it working on a plain timer.
 */
function scheduleIdle(run: (deadline: IdleDeadline) => void): CancelHandle {
  const host = globalThis as {
    requestIdleCallback?: (
      callback: (deadline: IdleDeadline) => void,
      options?: { timeout: number },
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (typeof host.requestIdleCallback === 'function') {
    const handle = host.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    return { cancel: () => host.cancelIdleCallback?.(handle) };
  }

  const timer = setTimeout(
    () => run({ timeRemaining: () => FALLBACK_BUDGET_MS }),
    IDLE_TIMEOUT_MS,
  );
  return { cancel: () => clearTimeout(timer) };
}

/**
 * Resolves the division's other fixtures in idle time so that settling the week
 * does not have to.
 *
 * Runs for the whole matchday phase rather than only the matchday screen: rival
 * squads are settled the moment the week advances, so time spent on the home
 * screen counts, and the watched match is the largest idle window there is.
 * Restricting this to the team sheet left a player who taps straight through
 * paying the full freeze anyway.
 *
 * Everything it produces is advisory. If it never runs, is cancelled, or is
 * invalidated by a transfer, settle simulates synchronously exactly as before.
 */
export function useRivalPreload(
  sessionKey: string | null,
  fixtures: readonly LeagueFixture[],
  teamsByClubId: Readonly<Record<string, TeamDef>> | null,
  watching: boolean,
): void {
  useEffect(() => {
    if (sessionKey === null || teamsByClubId === null || fixtures.length === 0) {
      return undefined;
    }

    const pump = createPreloadPump(fixtures, teamsByClubId);
    let cancelled = false;
    let scheduled: CancelHandle | null = null;

    const runSlice = (deadline: IdleDeadline): void => {
      if (cancelled) return;
      const floor = watching ? WATCHING_FLOOR_MS : STATIC_FLOOR_MS;
      while (!pump.done && deadline.timeRemaining() > floor) {
        try {
          pump.step(TICKS_PER_BURST);
        } catch {
          // A refused fixture must not escape a scheduler callback and take the
          // app with it. Settle recomputes it synchronously.
          cancelled = true;
          return;
        }
      }
      if (cancelled || pump.done) return;
      scheduled = scheduleIdle(runSlice);
    };

    scheduled = scheduleIdle(runSlice);

    return () => {
      cancelled = true;
      scheduled?.cancel();
    };
    // `fixtures` and `teamsByClubId` are rebuilt alongside `sessionKey`, which
    // is what decides when a session restarts. Listing them would restart the
    // work on every lineup edit, discarding a half-finished match each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, watching]);
}
