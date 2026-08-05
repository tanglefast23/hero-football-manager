import type { ProductionFixtureResult } from './matchday';
import { BUZZ_WIN_POINTS } from './club-business';
import { currentUserDivision } from './m2-career';
import type { PendingUserMatchImpact, UserMatchCompetition, UserMatchOutcome } from './club-business-types';
import type { GameState, LeagueFixture } from './types';

/**
 * Converts validated production facts into the one durable audience/wellbeing
 * input shared by Quick and watched matches.
 */
export function pendingImpactFromProduction(input: {
  readonly state: GameState;
  readonly fixture: LeagueFixture;
  readonly production: ProductionFixtureResult;
  readonly competition: UserMatchCompetition;
  /** Required only for a tied Cup score that was decided on penalties. */
  readonly cupWinnerClubId?: string;
}): PendingUserMatchImpact {
  const { state, fixture, production, competition } = input;
  if (production.fixtureResult.fixtureId !== fixture.id) {
    throw new Error(`production result ${production.fixtureResult.fixtureId} does not match ${fixture.id}`);
  }
  const userIsHome = fixture.homeClubId === state.userClubId;
  if (!userIsHome && fixture.awayClubId !== state.userClubId) {
    throw new Error(`fixture ${fixture.id} does not contain user club ${state.userClubId}`);
  }

  const participants = uniqueIds(production.participantPlayerIds, `${fixture.id} participant`);
  const powerFired = uniqueIds(production.powerFiredPlayerIds, `${fixture.id} power owner`);
  const participantSet = new Set(participants);
  if (powerFired.some(playerId => !participantSet.has(playerId))) {
    throw new Error(`fixture ${fixture.id} power owners must be participants`);
  }
  const playerById = new Map(state.players.map(player => [player.id, player]));
  for (const playerId of participants) {
    const player = playerById.get(playerId);
    if (player === undefined || player.clubId !== state.userClubId) {
      throw new Error(`fixture ${fixture.id} participant ${playerId} is outside the user club`);
    }
  }
  for (const playerId of powerFired) {
    if (playerById.get(playerId)?.power === undefined) {
      throw new Error(`fixture ${fixture.id} power owner ${playerId} is not a hero`);
    }
  }

  const heroAppearancePlayerIds = participants.filter(playerId => playerById.get(playerId)?.power !== undefined);
  const homeGoals = production.fixtureResult.homeGoals;
  const awayGoals = production.fixtureResult.awayGoals;
  requireNonnegativeInteger(homeGoals, `${fixture.id} home goals`);
  requireNonnegativeInteger(awayGoals, `${fixture.id} away goals`);
  const userGoals = userIsHome ? homeGoals : awayGoals;
  const outcome = userOutcome({
    competition,
    userClubId: state.userClubId,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    homeGoals,
    awayGoals,
    cupWinnerClubId: input.cupWinnerClubId,
  });
  const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
  const divisionScale = 6 - division;
  const supporterHeroes = Math.min(4, heroAppearancePlayerIds.length);

  return {
    fixtureId: fixture.id,
    competition,
    settlementOrder: competition === 'LEAGUE' ? 0 : 1,
    source: 'PRODUCTION',
    outcome,
    regulationGoals: userGoals,
    participantPlayerIds: [...participants],
    powerFiredPlayerIds: [...powerFired],
    heroAppearancePlayerIds,
    divisionScale,
    supporterWinUnits: outcome === 'WIN' ? 5 * divisionScale : 0,
    supporterHeroUnits: supporterHeroes * divisionScale,
    buzzWin: outcome === 'WIN' ? BUZZ_WIN_POINTS : 0,
    buzzGoals: userGoals,
    buzzHeroMoments: powerFired.length * 2,
  };
}

export function appendPendingUserMatchImpact(
  pending: readonly PendingUserMatchImpact[],
  impact: PendingUserMatchImpact,
): PendingUserMatchImpact[] {
  const existing = pending.find(candidate => candidate.fixtureId === impact.fixtureId);
  if (existing === undefined) return [...pending, impact];
  if (JSON.stringify(existing) !== JSON.stringify(impact)) {
    throw new Error(`fixture ${impact.fixtureId} already has a different pending match impact`);
  }
  return [...pending];
}

function userOutcome(input: {
  readonly competition: UserMatchCompetition;
  readonly userClubId: string;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly cupWinnerClubId?: string;
}): UserMatchOutcome {
  const userIsHome = input.homeClubId === input.userClubId;
  if (input.homeGoals !== input.awayGoals) {
    const homeWon = input.homeGoals > input.awayGoals;
    return homeWon === userIsHome ? 'WIN' : 'LOSS';
  }
  if (input.competition === 'LEAGUE') return 'DRAW';
  if (input.cupWinnerClubId !== input.homeClubId && input.cupWinnerClubId !== input.awayClubId) {
    throw new Error('a tied Cup result requires the penalty winner');
  }
  return input.cupWinnerClubId === input.userClubId ? 'WIN' : 'LOSS';
}

function uniqueIds(ids: readonly string[], label: string): string[] {
  const unique = new Set(ids);
  if (unique.size !== ids.length) throw new Error(`${label} IDs must be unique`);
  return [...ids];
}

function requireNonnegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative safe integer`);
}
