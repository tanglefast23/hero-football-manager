import { ROVERS, UNITED } from '../../sim/teams';
import type { TeamDef } from '../../sim/types';
import { createFixtureResolver, quickResultForFixture } from '../matchday';
import type { LeagueFixture } from '../types';

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

function drain(scheduled: LeagueFixture, ticksPerSlice: number) {
  const resolver = createFixtureResolver(scheduled, TEAMS);
  let guard = 0;
  while (!resolver.done) {
    resolver.advance(ticksPerSlice);
    guard += 1;
    if (guard > 100_000) throw new Error('resolver did not finish');
  }
  return resolver.result();
}

describe('createFixtureResolver', () => {
  it('produces the identical result to the all-at-once path', () => {
    const scheduled = fixture('resolver-1', 4242);

    expect(drain(scheduled, 64)).toEqual(
      quickResultForFixture(scheduled, TEAMS),
    );
  });

  it('is unaffected by slice size — chunking cannot change a result', () => {
    const scheduled = fixture('resolver-2', 99);

    expect(drain(scheduled, 1)).toEqual(drain(scheduled, 100_000));
    expect(drain(scheduled, 1)).toEqual(
      quickResultForFixture(scheduled, TEAMS),
    );
  });

  it('refuses to hand over a result before the match has finished', () => {
    const resolver = createFixtureResolver(fixture('resolver-3', 7), TEAMS);
    resolver.advance(10);

    expect(resolver.done).toBe(false);
    expect(() => resolver.result()).toThrow('has not finished');
  });

  it('validates the fixture exactly as the synchronous path does', () => {
    const unscheduled = {
      ...fixture('resolver-4', 7),
      status: 'played' as const,
    };

    expect(() => createFixtureResolver(unscheduled, TEAMS)).toThrow(
      /scheduled/i,
    );
  });

  it('stops advancing once finished so extra pumps are harmless', () => {
    const resolver = createFixtureResolver(fixture('resolver-5', 11), TEAMS);
    while (!resolver.done) resolver.advance(256);
    const settled = resolver.result();

    resolver.advance(1_000);

    expect(resolver.result()).toEqual(settled);
  });
});
