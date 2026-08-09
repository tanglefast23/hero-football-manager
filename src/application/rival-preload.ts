import { createFixtureResolver, type FixtureResolver } from '../game/matchday';
import type { TeamDef } from '../sim/types';
import type { LeagueFixture } from '../game/types';
import { hasRivalResult, storeRivalResult } from './rival-result-cache';

export interface PreloadPump {
  readonly done: boolean;
  /** Advances the current fixture by at most `maxTicks`, publishing on finish. */
  step(maxTicks: number): void;
}

/**
 * Works through the division's other fixtures one at a time, publishing each to
 * the cache the moment it finishes.
 *
 * Sequential rather than interleaved so a pump interrupted half way leaves
 * whole, usable results behind. Already-cached fixtures are skipped, which is
 * what lets a torn-down session resume instead of starting over: the session is
 * rebuilt whenever the matchday identity changes, and any screen the player
 * reaches from here can replace the career object under it.
 *
 * No React and no react-native on purpose. Jest runs in a node environment with
 * a transform matching only `.tsx?`, so anything reachable from a react-native
 * import cannot be loaded by a test — which is why the scheduling lives apart
 * from this, in `src/ui/use-rival-preload`.
 */
export function createPreloadPump(
  fixtures: readonly LeagueFixture[],
  teamsByClubId: Readonly<Record<string, TeamDef>>,
  makeResolver: (
    fixture: LeagueFixture,
    teams: Readonly<Record<string, TeamDef>>,
  ) => FixtureResolver = createFixtureResolver,
): PreloadPump {
  let index = 0;
  let current: FixtureResolver | null = null;

  const skipSettled = (): void => {
    while (
      current === null &&
      index < fixtures.length &&
      hasRivalResult(fixtures[index], teamsByClubId)
    ) {
      index += 1;
    }
  };

  skipSettled();

  return {
    get done(): boolean {
      return index >= fixtures.length;
    },
    step(maxTicks: number): void {
      skipSettled();
      if (index >= fixtures.length) return;
      if (current === null)
        current = makeResolver(fixtures[index], teamsByClubId);

      current.advance(maxTicks);
      if (!current.done) return;

      storeRivalResult(fixtures[index], teamsByClubId, current.result());
      current = null;
      index += 1;
      skipSettled();
    },
  };
}
