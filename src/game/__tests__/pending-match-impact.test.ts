import { pendingImpactFromProduction, appendPendingUserMatchImpact } from '../pending-match-impact';
import type { ProductionFixtureResult } from '../matchday';
import type { GameState, LeagueFixture } from '../types';

function careerState(): GameState {
  return {
  userClubId: 'home',
  players: [
    player('hero', 'home', true),
    player('starter', 'home'),
    player('sub-hero', 'home', true),
    player('away-player', 'away'),
  ],
  } as GameState;
}

function player(id: string, clubId: string, hero = false) {
  return {
    id,
    clubId,
    name: id,
    role: 'FWD' as const,
    attrs: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50, ref: 50 },
    ...(hero ? { power: 'SUPER_SPEED' as const, powerTier: 1 as const } : {}),
    licensed: hero,
    weeklyWage: 0,
    onHeroWage: false,
    contractSeasonsRemaining: 2,
    morale: 50,
    injuryWeeks: 0,
  };
}

function fixture(homeClubId = 'home', awayClubId = 'away'): LeagueFixture {
  return {
    id: 'f1',
    season: 1,
    round: 1,
    week: 1,
    homeClubId,
    awayClubId,
    matchSeed: 10,
    status: 'scheduled',
  };
}

function production(homeGoals = 2, awayGoals = 1): ProductionFixtureResult {
  return {
    fixtureResult: {
      fixtureId: 'f1',
      homeGoals,
      awayGoals,
      scorerPlayerIds: ['hero', 'sub-hero'],
      contributions: [],
    },
    goals: [],
    participantPlayerIds: ['hero', 'starter', 'sub-hero'],
    powerFiredPlayerIds: ['sub-hero'],
  };
}

describe('durable production match impact', () => {
  it('snapshots actual participants, hero status, and audience components', () => {
    const state = careerState();
    const result = pendingImpactFromProduction({
      state,
      fixture: fixture(),
      production: production(),
      competition: 'LEAGUE',
    });

    expect(result).toMatchObject({
      fixtureId: 'f1',
      source: 'PRODUCTION',
      outcome: 'WIN',
      regulationGoals: 2,
      participantPlayerIds: ['hero', 'starter', 'sub-hero'],
      heroAppearancePlayerIds: ['hero', 'sub-hero'],
      powerFiredPlayerIds: ['sub-hero'],
      divisionScale: 1,
      supporterWinUnits: 5,
      supporterHeroUnits: 2,
      buzzWin: 4,
      buzzGoals: 2,
      buzzHeroMoments: 2,
    });
  });

  it('uses the penalty winner for a tied Cup without counting shootout kicks as goals', () => {
    const state = careerState();
    expect(pendingImpactFromProduction({
      state,
      fixture: fixture(),
      production: production(1, 1),
      competition: 'CUP',
      cupWinnerClubId: 'home',
    })).toMatchObject({
      outcome: 'WIN',
      regulationGoals: 1,
      settlementOrder: 1,
      buzzWin: 4,
      buzzGoals: 1,
    });
  });

  it('rejects missing production truth instead of falling back to the saved XI', () => {
    const state = careerState();
    expect(() => pendingImpactFromProduction({
      state,
      fixture: fixture(),
      production: {
        ...production(),
        participantPlayerIds: ['away-player'],
        powerFiredPlayerIds: [],
      },
      competition: 'LEAGUE',
    })).toThrow(/outside the user club/);
    expect(() => pendingImpactFromProduction({
      state,
      fixture: fixture(),
      production: { ...production(), powerFiredPlayerIds: ['starter'] },
      competition: 'LEAGUE',
    })).toThrow(/is not a hero/);
  });

  it('makes an exact retry a no-op and rejects a conflicting duplicate fixture', () => {
    const state = careerState();
    const first = pendingImpactFromProduction({
      state,
      fixture: fixture(),
      production: production(),
      competition: 'LEAGUE',
    });
    expect(appendPendingUserMatchImpact([first], first)).toEqual([first]);
    expect(() => appendPendingUserMatchImpact([first], { ...first, buzzGoals: 99 }))
      .toThrow(/different pending match impact/);
  });
});
