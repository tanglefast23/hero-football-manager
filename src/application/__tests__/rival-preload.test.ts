import { ROVERS, UNITED } from '../../sim/teams';
import type { TeamDef } from '../../sim/types';
import { quickResultForFixture } from '../../game/matchday';
import type { LeagueFixture } from '../../game/types';
import {
  cachedRivalResults,
  clearRivalResultCache,
} from '../rival-result-cache';
import { createPreloadPump, type PreloadPump } from '../rival-preload';

const TEAMS: Readonly<Record<string, TeamDef>> = {
  [ROVERS.id]: ROVERS,
  [UNITED.id]: UNITED,
};

function fixture(id: string, matchSeed: number): LeagueFixture {
  return {
    id,
    season: 1,
    round: 1,
    week: 5,
    homeClubId: ROVERS.id,
    awayClubId: UNITED.id,
    matchSeed,
    status: 'scheduled',
  };
}

function drain(pump: PreloadPump): void {
  let guard = 0;
  while (!pump.done) {
    pump.step(64);
    guard += 1;
    if (guard > 200_000) throw new Error('pump did not finish');
  }
}

describe('rival preload pump', () => {
  beforeEach(() => {
    clearRivalResultCache();
  });

  it('fills the cache with results identical to the synchronous path', () => {
    const rivals = [fixture('rival-a', 101), fixture('rival-b', 202)];

    drain(createPreloadPump(rivals, TEAMS));

    expect(cachedRivalResults(rivals, TEAMS)).toEqual(
      rivals.map((scheduled) => quickResultForFixture(scheduled, TEAMS)),
    );
  });

  it('publishes each fixture as it finishes rather than all at the end', () => {
    const rivals = [fixture('rival-a', 303), fixture('rival-b', 404)];
    const pump = createPreloadPump(rivals, TEAMS);

    let guard = 0;
    while (cachedRivalResults(rivals, TEAMS).length === 0) {
      pump.step(64);
      guard += 1;
      if (guard > 200_000) throw new Error('pump published nothing');
    }

    expect(cachedRivalResults(rivals, TEAMS)).toHaveLength(1);
    expect(pump.done).toBe(false);
  });

  it('resumes rather than restarting when a previous pump already finished work', () => {
    const rivals = [fixture('rival-a', 505), fixture('rival-b', 606)];
    drain(createPreloadPump(rivals, TEAMS));

    // A lineup edit tears the session down; its replacement must not redo
    // matches already cached against these same squads.
    const replacement = createPreloadPump(rivals, TEAMS);

    expect(replacement.done).toBe(true);
  });

  it('redoes only what a squad change invalidated', () => {
    const rivals = [fixture('rival-a', 707), fixture('rival-b', 808)];
    drain(createPreloadPump(rivals, TEAMS));

    const afterTransfer: Readonly<Record<string, TeamDef>> = {
      ...TEAMS,
      [ROVERS.id]: { ...ROVERS, players: ROVERS.players.slice(0, 10) },
    };
    const replacement = createPreloadPump(rivals, afterTransfer);

    expect(replacement.done).toBe(false);
  });

  it('is a no-op with nothing to preload', () => {
    const pump = createPreloadPump([], TEAMS);

    expect(pump.done).toBe(true);
    expect(() => pump.step(64)).not.toThrow();
  });
});
