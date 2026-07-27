import { ROVERS, UNITED } from '../../sim/teams';
import type { TeamDef } from '../../sim/types';
import type { FixtureResult, LeagueFixture } from '../../game/types';
import {
  cachedRivalResults,
  clearRivalResultCache,
  hasRivalResult,
  storeRivalResult,
} from '../rival-result-cache';

const TEAMS: Readonly<Record<string, TeamDef>> = {
  [ROVERS.id]: ROVERS,
  [UNITED.id]: UNITED,
};

function fixture(id: string): LeagueFixture {
  return {
    id,
    season: 1,
    round: 1,
    week: 5,
    homeClubId: ROVERS.id,
    awayClubId: UNITED.id,
    matchSeed: 7,
    status: 'scheduled',
  };
}

const RESULT: FixtureResult = { fixtureId: 'rival-1', homeGoals: 2, awayGoals: 1 };

describe('rival result cache', () => {
  beforeEach(() => {
    clearRivalResultCache();
  });

  it('returns a stored result when the squads are unchanged', () => {
    const scheduled = fixture('rival-1');
    storeRivalResult(scheduled, TEAMS, RESULT);

    expect(hasRivalResult(scheduled, TEAMS)).toBe(true);
    expect(cachedRivalResults([scheduled], TEAMS)).toEqual([RESULT]);
  });

  it('misses when a squad changed after the result was stored', () => {
    const scheduled = fixture('rival-1');
    storeRivalResult(scheduled, TEAMS, RESULT);
    // A transfer out of the home club: the stored result was computed against a
    // squad that no longer exists, so it must not be served.
    const afterTransfer: Readonly<Record<string, TeamDef>> = {
      ...TEAMS,
      [ROVERS.id]: { ...ROVERS, players: ROVERS.players.slice(0, 10) },
    };

    expect(hasRivalResult(scheduled, afterTransfer)).toBe(false);
    expect(cachedRivalResults([scheduled], afterTransfer)).toEqual([]);
  });

  it('returns only the fixtures it actually holds', () => {
    const stored = fixture('rival-1');
    storeRivalResult(stored, TEAMS, RESULT);

    expect(cachedRivalResults([stored, fixture('rival-2')], TEAMS)).toEqual([RESULT]);
  });

  it('clears completely so a settled week never leaks into the next', () => {
    const scheduled = fixture('rival-1');
    storeRivalResult(scheduled, TEAMS, RESULT);
    clearRivalResultCache();

    expect(cachedRivalResults([scheduled], TEAMS)).toEqual([]);
  });
});
