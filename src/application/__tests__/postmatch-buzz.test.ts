import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game';
import type { PendingUserMatchImpact } from '../../game/club-business-types';
import type { GameState } from '../../game/types';
import { createLaunchCareerSetup } from '../launch';
import { postMatchViewModel } from '../view-models';

const content = loadLaunchContent();

function seasonThreeMatch(seed = 20260805): {
  before: GameState;
  fixtureId: string;
  score: { homeGoals: number; awayGoals: number };
} {
  const career = createCareer(
    createLaunchCareerSetup(seed, undefined, content),
  );
  const fixture = career.fixtures.find(
    (candidate) =>
      candidate.homeClubId === career.userClubId ||
      candidate.awayClubId === career.userClubId,
  );
  if (fixture === undefined)
    throw new Error('launch career has no user fixture');
  const score =
    fixture.homeClubId === career.userClubId
      ? { homeGoals: 3, awayGoals: 1 }
      : { homeGoals: 1, awayGoals: 3 };
  return {
    before: {
      ...career,
      season: 3,
      week: fixture.week,
      phase: 'matchday',
      clubBusiness: {
        ...career.clubBusiness,
        buzz: { value: 40 },
      },
    },
    fixtureId: fixture.id,
    score,
  };
}

function impact(
  fixtureId: string,
  overrides: Partial<PendingUserMatchImpact> = {},
): PendingUserMatchImpact {
  return {
    fixtureId,
    competition: 'LEAGUE',
    settlementOrder: 0,
    source: 'PRODUCTION',
    outcome: 'WIN',
    regulationGoals: 3,
    participantPlayerIds: [],
    powerFiredPlayerIds: ['hero-one', 'hero-two'],
    heroAppearancePlayerIds: [],
    divisionScale: 1,
    supporterWinUnits: 5,
    supporterHeroUnits: 0,
    buzzWin: 4,
    buzzGoals: 3,
    buzzHeroMoments: 4,
    ...overrides,
  };
}

describe('post-match Buzz cause and effect', () => {
  it('shows the current match breakdown and projected total before a double-header settles', () => {
    const { before, fixtureId, score } = seasonThreeMatch();
    const after: GameState = {
      ...before,
      clubBusiness: {
        ...before.clubBusiness,
        pendingUserMatchImpacts: [impact(fixtureId)],
      },
    };

    expect(
      postMatchViewModel(
        before,
        after,
        fixtureId,
        score,
        [],
        ['hero-one', 'hero-two'],
      ).buzz,
    ).toEqual({
      earned: 11,
      rawEarned: 11,
      valueAfter: 51,
      win: 4,
      goals: 3,
      heroMoments: 4,
    });
  });

  it('credits only the current match when a league match is already pending', () => {
    const { before: initial, fixtureId, score } = seasonThreeMatch();
    const prior = impact('league-first', {
      buzzWin: 4,
      buzzGoals: 2,
      buzzHeroMoments: 2,
    });
    const before: GameState = {
      ...initial,
      clubBusiness: {
        ...initial.clubBusiness,
        pendingUserMatchImpacts: [prior],
      },
    };
    const current = impact(fixtureId, {
      competition: 'CUP',
      settlementOrder: 1,
    });
    const after: GameState = {
      ...before,
      clubBusiness: {
        ...before.clubBusiness,
        pendingUserMatchImpacts: [prior, current],
      },
    };

    expect(
      postMatchViewModel(
        before,
        after,
        fixtureId,
        score,
        [],
        ['hero-one', 'hero-two'],
      ).buzz,
    ).toMatchObject({ earned: 11, rawEarned: 11, valueAfter: 59 });
  });

  it('reports cap-limited earnings without hiding the match contribution', () => {
    const { before: initial, fixtureId, score } = seasonThreeMatch();
    const before: GameState = {
      ...initial,
      clubBusiness: {
        ...initial.clubBusiness,
        buzz: { value: 95 },
      },
    };
    const after: GameState = {
      ...before,
      clubBusiness: {
        ...before.clubBusiness,
        pendingUserMatchImpacts: [impact(fixtureId)],
      },
    };

    expect(
      postMatchViewModel(
        before,
        after,
        fixtureId,
        score,
        [],
        ['hero-one', 'hero-two'],
      ).buzz,
    ).toMatchObject({ earned: 5, rawEarned: 11, valueAfter: 100 });
  });

  it('shows the new half-season payout and reset exactly once', () => {
    const { before, fixtureId, score } = seasonThreeMatch();
    const after: GameState = {
      ...before,
      clubBusiness: {
        ...before.clubBusiness,
        pendingUserMatchImpacts: [],
        buzz: {
          value: 0,
          lastSettledSeason: 3,
          lastSettledHalf: 1,
          lastSettlementSummary: {
            season: 3,
            half: 1,
            before: 40,
            rawEarned: 11,
            realizedEarned: 11,
            prePayoutValue: 51,
            payout: 510,
            resetValue: 0,
            impacts: [],
          },
        },
      },
    };
    const first = postMatchViewModel(
      before,
      after,
      fixtureId,
      score,
      [],
      ['hero-one', 'hero-two'],
    );
    const reread = postMatchViewModel(
      after,
      after,
      fixtureId,
      score,
      [],
      ['hero-one', 'hero-two'],
    );

    expect(first.buzz).toMatchObject({
      earned: 11,
      valueAfter: 0,
      payout: 510,
    });
    expect(reread.buzz?.payout).toBeUndefined();
  });

  it('does not show Buzz before Season 3 or for a synthetic result without production facts', () => {
    const { before, fixtureId, score } = seasonThreeMatch();
    const seasonTwo = { ...before, season: 2 };

    expect(
      postMatchViewModel(seasonTwo, seasonTwo, fixtureId, score, [], []).buzz,
    ).toBeUndefined();
    expect(
      postMatchViewModel(before, before, fixtureId, score).buzz,
    ).toBeUndefined();
  });
});
