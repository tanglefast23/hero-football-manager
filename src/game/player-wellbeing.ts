import { coachMotivatorStrengthHalfLevels } from './coach-weekly';
import {
  cappedFacilityBoost,
  isFacilityOperational,
  type FacilityGridState,
  type PlacedFacility,
} from './facilities';
import { growthSinceSigningPercent } from './market-career';
import { renewalContractAsk, renewalFamePercent } from './market';
import {
  shouldRequestTransfer,
  shouldWithdrawTransferRequest,
  updatePlayerWellbeing,
} from './pyramid';
import type {
  CareerPlayer,
  FixtureResult,
  GameState,
  LeagueFixture,
} from './types';
import type { DivisionLevel } from './pyramid';

const WEEKLY_CONDITION_RECOVERY = 10;
export const OVERTRAINING_CONDITION_THRESHOLD = 30;

/**
 * Each Dorm level speeds weekly condition recovery, the way each Medical Bay
 * level shortens an injury. An instant drill costs 8 condition, so bare
 * recovery of 10 sustains 1.25 taps per player per week; a Dorm lifts that to
 * 1.625 / 2.0 / 2.375 taps and keeps players clear of the condition-30 floor
 * where overtraining injury rolls start. Before this the Dorm had no effect
 * site at all beyond the Gym adjacency.
 */
export const DORM_CONDITION_RECOVERY_PER_LEVEL = 3;
const MATCH_CONDITION_COST_BY_DIVISION: Readonly<
  Record<DivisionLevel, number>
> = { 5: 4, 4: 6, 3: 8, 2: 10, 1: 12 };

/** A played match costs more condition in each stronger division. */
export function matchConditionCost(division: DivisionLevel): number {
  return MATCH_CONDITION_COST_BY_DIVISION[division];
}

/** A substitute pays half the starter cost, rounded to a whole condition point. */
export function substituteMatchConditionCost(
  division: DivisionLevel,
): number {
  return Math.round(matchConditionCost(division) / 2);
}

/** Applies both clubs' starter/substitute costs as soon as a match finishes. */
export function applyMatchConditionCosts(
  state: GameState,
  fixtures: readonly LeagueFixture[],
  results: readonly FixtureResult[],
): GameState {
  const costs = new Map<string, number>();
  const resultByFixtureId = new Map(
    results.map((result) => [result.fixtureId, result]),
  );

  for (const fixture of fixtures) {
    const result = resultByFixtureId.get(fixture.id);
    if (result === undefined) continue;
    addClubMatchCosts(
      state,
      fixture.homeClubId,
      result.homeParticipantPlayerIds,
      costs,
    );
    addClubMatchCosts(
      state,
      fixture.awayClubId,
      result.awayParticipantPlayerIds,
      costs,
    );
  }

  if (costs.size === 0) return state;
  const conditionAfterCost = (player: { id: string; condition?: number }) =>
    Math.max(0, (player.condition ?? 100) - (costs.get(player.id) ?? 0));
  return {
    ...state,
    players: state.players.map((player) =>
      costs.has(player.id)
        ? { ...player, condition: conditionAfterCost(player) }
        : player,
    ),
    ...(state.m2 === undefined
      ? {}
      : {
          m2: {
            ...state.m2,
            pyramid: {
              ...state.m2.pyramid,
              divisions: state.m2.pyramid.divisions.map((division) => ({
                ...division,
                clubs: division.clubs.map((club) => ({
                  ...club,
                  squad: club.squad.map((player) =>
                    costs.has(player.id)
                      ? { ...player, condition: conditionAfterCost(player) }
                      : player,
                  ),
                })),
              })),
            },
          },
        }),
  };
}

function addClubMatchCosts(
  state: GameState,
  clubId: string,
  suppliedParticipantIds: readonly string[] | undefined,
  costs: Map<string, number>,
): void {
  const playerClubById = new Map(
    state.players.map((player) => [player.id, player.clubId]),
  );
  const pyramidClub = state.m2?.pyramid.divisions
    .flatMap((division) => division.clubs)
    .find((club) => club.id === clubId);
  for (const player of pyramidClub?.squad ?? []) {
    if (!playerClubById.has(player.id))
      playerClubById.set(player.id, player.clubId);
  }
  const participantIds =
    suppliedParticipantIds ??
    state.lineups.find((lineup) => lineup.clubId === clubId)?.playerIds ??
    defaultPyramidLineupIds(pyramidClub?.squad ?? []);
  if (participantIds.length < 11) {
    throw new Error(`club ${clubId} needs eleven match participants`);
  }
  if (new Set(participantIds).size !== participantIds.length) {
    throw new Error(`club ${clubId} match participants must be unique`);
  }
  const division = divisionForClub(state, clubId);
  const starterCost = matchConditionCost(division);
  const substituteCost = substituteMatchConditionCost(division);
  participantIds.forEach((playerId, index) => {
    if (playerClubById.get(playerId) !== clubId) {
      throw new Error(`match participant ${playerId} is outside club ${clubId}`);
    }
    costs.set(
      playerId,
      (costs.get(playerId) ?? 0) +
        (index < 11 ? starterCost : substituteCost),
    );
  });
}

function defaultPyramidLineupIds(
  squad: readonly { id: string; role: CareerPlayer['role'] }[],
): string[] {
  const take = (role: CareerPlayer['role'], count: number) =>
    squad
      .filter((player) => player.role === role)
      .slice(0, count)
      .map((player) => player.id);
  return [
    ...take('GK', 1),
    ...take('DEF', 4),
    ...take('MID', 4),
    ...take('FWD', 2),
  ];
}

function divisionForClub(state: GameState, clubId: string): DivisionLevel {
  return (
    state.m2?.pyramid.divisions.find((division) =>
      division.clubs.some((club) => club.id === clubId),
    )?.level ?? 5
  );
}

interface WeeklyPlayerWellbeingContext {
  /** Results played outside the league fixture list, such as a Cup tie. */
  readonly additionalMatchOutcomes?: readonly WeeklyMatchOutcome[];
  /**
   * Production appearances, one set per match. When supplied, completed-match
   * morale never re-reads the club's current saved lineup.
   */
  readonly matchParticipations?: readonly WeeklyMatchParticipation[];
}

export type WeeklyMatchOutcome = 'win' | 'draw' | 'loss';

interface WeeklyMatchParticipation {
  readonly fixtureId: string;
  readonly outcome: WeeklyMatchOutcome;
  readonly participantPlayerIds: readonly string[];
}

interface WeeklyPlayerWellbeingResult {
  readonly players: CareerPlayer[];
  readonly m2?: GameState['m2'];
  readonly matchOutcome?: WeeklyMatchOutcome;
}

/**
 * Applies one user-club wellbeing tick for the settling week: condition
 * recovery, match/underpaid morale, and transfer-request checks. Training
 * costs and overtraining injuries resolve at drill tap time, not here.
 * Computer clubs get the best Dorm recovery available in their division.
 */
export function resolveWeeklyPlayerWellbeing(
  state: GameState,
  context: WeeklyPlayerWellbeingContext = {},
): WeeklyPlayerWellbeingResult {
  validateStateClock(state);

  const matchParticipations = context.matchParticipations;
  const match =
    matchParticipations === undefined ? currentUserMatch(state) : undefined;
  const additionalMatchOutcomes =
    matchParticipations === undefined
      ? (context.additionalMatchOutcomes ?? [])
      : [];
  if (
    additionalMatchOutcomes.some(
      (outcome) => !['win', 'draw', 'loss'].includes(outcome),
    )
  ) {
    throw new Error('additional match outcomes must be win, draw, or loss');
  }
  const matchOutcomes = matchParticipations?.map(
    (participation) => participation.outcome,
  ) ?? [
    ...(match === undefined ? [] : [match.outcome]),
    ...additionalMatchOutcomes,
  ];
  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === state.userClubId,
  );
  if (
    matchOutcomes.length > 0 &&
    lineup === undefined &&
    matchParticipations === undefined
  ) {
    throw new Error('a played user match requires a user lineup');
  }
  const starters = new Set(lineup?.playerIds ?? []);
  const participantSets = matchParticipations?.map((participation) => {
    if (!['win', 'draw', 'loss'].includes(participation.outcome)) {
      throw new Error('match participation outcome must be win, draw, or loss');
    }
    const participants = new Set(participation.participantPlayerIds);
    if (participants.size !== participation.participantPlayerIds.length) {
      throw new Error(
        `match ${participation.fixtureId} participant IDs must be unique`,
      );
    }
    return { outcome: participation.outcome, participants };
  });
  const motivatorStrengthHalfLevels =
    state.market === undefined
      ? 0
      : coachMotivatorStrengthHalfLevels(state.market);
  const bestDorm = bestOperationalDorm(state.facilities.grid);
  const conditionDelta =
    weeklyConditionRecovery(bestDorm?.level ?? 0) +
    cappedFacilityBoost(bestDorm?.boosts, 'recoveryBonus');
  const players = state.players.map((player) => {
    if (player.clubId !== state.userClubId) {
      return {
        ...player,
        condition: Math.min(
          100,
          (player.condition ?? 100) +
            weeklyConditionRecovery(
              computerDormLevel(divisionForClub(state, player.clubId)),
            ),
        ),
      };
    }

    const matchMoraleDelta =
      participantSets === undefined
        ? matchOutcomes.reduce(
            (total, outcome) =>
              total + moraleDeltaForMatch(outcome, starters.has(player.id)),
            0,
          )
        : participantSets.reduce(
            (total, participation) =>
              total +
              moraleDeltaForMatch(
                participation.outcome,
                participation.participants.has(player.id),
              ),
            0,
          );
    const underpaidMoraleDelta = isUnderpaidPlayer(player) ? -2 : 0;
    const motivation = applyMotivatorProtection(
      matchMoraleDelta + underpaidMoraleDelta,
      motivatorStrengthHalfLevels,
      player.motivatorMoraleRemainderHalfPoints ??
        (player.motivatorMoraleRemainder ?? 0) * 2,
    );
    const updated = updatePlayerWellbeing(
      {
        ...player,
        condition: player.condition ?? 100,
        personality: player.personality ?? 'Professional',
        consecutiveLowMoraleWeeks: player.consecutiveLowMoraleWeeks ?? 0,
      },
      {
        conditionDelta,
        moraleDelta: motivation.moraleDelta,
      },
    );
    const updatedCondition = updated.condition ?? 100;
    const {
      motivatorMoraleRemainder: _legacyMotivatorRemainder,
      ...withoutLegacyRemainder
    } = updated;
    return {
      ...withoutLegacyRemainder,
      condition: updatedCondition,
      motivatorMoraleRemainderHalfPoints: motivation.remainderHalfPoints,
      // A standing request holds until it is won back, and a contented player
      // does not carry one. Writing this as `was || shouldRequest` made the
      // flag a memory instead of a state: it could only ever be set, so a squad
      // accumulated permanent "wants to leave" alerts, and `eligibleAskers`
      // — which drops listed players — starved until nobody could ask at all.
      transferRequested:
        player.transferRequested === true
          ? !shouldWithdrawTransferRequest(updated)
          : shouldRequestTransfer(updated),
    };
  });
  const activePlayerById = new Map(
    players.map((player) => [player.id, player]),
  );

  return {
    players,
    ...(state.m2 === undefined
      ? {}
      : {
          m2: {
            ...state.m2,
            pyramid: {
              ...state.m2.pyramid,
              divisions: state.m2.pyramid.divisions.map((division) => ({
                ...division,
                clubs: division.clubs.map((club) => ({
                  ...club,
                  squad: club.squad.map((player) => {
                    const activePlayer = activePlayerById.get(player.id);
                    return activePlayer === undefined
                      ? {
                          ...player,
                          condition: Math.min(
                            100,
                            player.condition +
                              weeklyConditionRecovery(
                                computerDormLevel(division.level),
                              ),
                          ),
                        }
                      : {
                          ...player,
                          condition: activePlayer.condition ?? 100,
                        };
                  }),
                })),
              })),
            },
          },
        }),
    ...(matchOutcomes.length === 0
      ? {}
      : { matchOutcome: matchOutcomes[matchOutcomes.length - 1] }),
  };
}

function computerDormLevel(division: DivisionLevel): 1 | 2 | 3 {
  return division === 5 ? 1 : division >= 3 ? 2 : 3;
}

function isUnderpaidPlayer(player: CareerPlayer): boolean {
  const fairWage = renewalContractAsk(
    {
      weeklyWage: player.weeklyWage,
      personality: (player.personality ?? 'Professional')
        .toUpperCase()
        .replace('-', '_') as Parameters<
        typeof renewalContractAsk
      >[0]['personality'],
      ...(player.power === undefined ? {} : { power: player.power }),
      onHeroWage: player.onHeroWage,
    },
    {
      growthSinceSigningPercent: growthSinceSigningPercent(player),
      famePercent: renewalFamePercent(player.fame ?? 0),
      heroMultiplier: 4,
      // Deliberately not the player's real loyalty. Loyalty has exactly one job —
      // the price of the next contract — and the player card says so. Feeding it
      // here would make every refused request ALSO raise the "fair wage" line,
      // adding a silent -2 morale a week and a faster transfer request that no
      // button on the decision card ever mentioned. A third punishment channel
      // the manager was never shown is worse than no punishment at all.
      loyaltyPercent: 0,
    },
  );
  return player.weeklyWage * 100 < fairWage * 70;
}

function applyMotivatorProtection(
  moraleDelta: number,
  strengthHalfLevels: number,
  remainderHalfPoints: number,
): { moraleDelta: number; remainderHalfPoints: number } {
  if (
    !Number.isSafeInteger(strengthHalfLevels) ||
    strengthHalfLevels < 0 ||
    strengthHalfLevels > 15
  ) {
    throw new Error('Motivator strength must be from 0 to 15 half-levels');
  }
  if (
    !Number.isSafeInteger(remainderHalfPoints) ||
    remainderHalfPoints < 0 ||
    remainderHalfPoints >= 200
  ) {
    throw new Error(
      'Motivator morale remainder must be from 0 to 199 half-points',
    );
  }
  if (moraleDelta >= 0 || strengthHalfLevels === 0) {
    return { moraleDelta, remainderHalfPoints };
  }
  // One half-level is 2.5%. A denominator of 200 keeps assistant effects exact
  // without introducing floating-point morale or fractional player ratings.
  const scaled =
    Math.abs(moraleDelta) * strengthHalfLevels * 5 + remainderHalfPoints;
  const prevented = Math.floor(scaled / 200);
  return {
    moraleDelta: moraleDelta + prevented,
    remainderHalfPoints: scaled % 200,
  };
}

/** Medical Bay levels remove one recovery week each, with a one-week floor. */
export function medicalBayRecoveryWeeks(
  baseRecoveryWeeks: number,
  medicalBayLevel: number,
): number {
  if (!Number.isSafeInteger(baseRecoveryWeeks) || baseRecoveryWeeks < 1) {
    throw new Error('base recovery weeks must be a positive safe integer');
  }
  if (
    !Number.isSafeInteger(medicalBayLevel) ||
    medicalBayLevel < 0 ||
    medicalBayLevel > 3
  ) {
    throw new Error('Medical Bay level must be an integer from 0 to 3');
  }
  return Math.max(1, baseRecoveryWeeks - medicalBayLevel);
}

export function overtrainingInjuryChancePercent(
  condition: number,
  riskReductionPercent = 0,
): number {
  if (!Number.isSafeInteger(condition) || condition < 0 || condition > 100) {
    throw new Error('player condition must be an integer from 0 to 100');
  }
  if (
    !Number.isSafeInteger(riskReductionPercent) ||
    riskReductionPercent < 0 ||
    riskReductionPercent > 100
  ) {
    throw new Error('injury risk reduction must be an integer from 0 to 100');
  }
  if (condition >= OVERTRAINING_CONDITION_THRESHOLD) return 0;

  const missingCondition = OVERTRAINING_CONDITION_THRESHOLD - condition;
  const baseChance =
    10 + checkedMultiply(missingCondition, 2, 'overtraining injury chance');
  return Math.floor((baseChance * (100 - riskReductionPercent)) / 100);
}

function moraleDeltaForMatch(
  outcome: WeeklyMatchOutcome,
  started: boolean,
): number {
  const resultDelta = outcome === 'win' ? 3 : outcome === 'draw' ? 1 : -3;
  return resultDelta + (started ? 2 : -1);
}

function currentUserMatch(
  state: GameState,
): { outcome: WeeklyMatchOutcome } | undefined {
  const fixtures = state.fixtures.filter(
    (fixture) =>
      fixture.season === state.season &&
      fixture.week === state.week &&
      fixture.status === 'played' &&
      (fixture.homeClubId === state.userClubId ||
        fixture.awayClubId === state.userClubId),
  );
  if (fixtures.length > 1)
    throw new Error('a club cannot have more than one played match per week');
  const fixture = fixtures[0];
  if (fixture === undefined) return undefined;
  if (fixture.score === undefined)
    throw new Error('a played wellbeing fixture requires a score');

  const isHome = fixture.homeClubId === state.userClubId;
  const goalsFor = isHome ? fixture.score.homeGoals : fixture.score.awayGoals;
  const goalsAgainst = isHome
    ? fixture.score.awayGoals
    : fixture.score.homeGoals;
  return {
    outcome:
      goalsFor > goalsAgainst
        ? 'win'
        : goalsFor === goalsAgainst
          ? 'draw'
          : 'loss',
  };
}

/** The best operational Medical Bay wins; one still being built treats nobody. */
export function gridMedicalBayLevel(
  grid: FacilityGridState | undefined,
): number {
  if (grid === undefined) return 0;
  let level = 0;
  for (const building of grid.buildings) {
    if (building.type !== 'medical-bay') continue;
    if (!isFacilityOperational(grid, building.id)) continue;
    level = Math.max(level, building.level);
  }
  return level;
}

/** The best operational Dorm wins; a second Dorm is not a second bonus. */
/**
 * The dorm whose level is read, so its own boost can be read from the same
 * building. A percent would be useless here — the dorm gives 4 points a level,
 * and a tenth of that rounds to zero — so its boost is flat points.
 */
function bestOperationalDorm(
  grid: FacilityGridState | undefined,
): PlacedFacility | undefined {
  if (grid === undefined) return undefined;
  let best: PlacedFacility | undefined;
  for (const building of grid.buildings) {
    if (building.type !== 'dorm') continue;
    if (!isFacilityOperational(grid, building.id)) continue;
    if (best === undefined || building.level > best.level) best = building;
  }
  return best;
}

function gridDormLevel(grid: FacilityGridState | undefined): number {
  if (grid === undefined) return 0;
  let level = 0;
  for (const building of grid.buildings) {
    if (building.type !== 'dorm') continue;
    if (!isFacilityOperational(grid, building.id)) continue;
    level = Math.max(level, building.level);
  }
  return level;
}

/** Weekly condition recovery for the user club, Dorm levels included. */
export function weeklyConditionRecovery(dormLevel: number): number {
  if (!Number.isSafeInteger(dormLevel) || dormLevel < 0 || dormLevel > 3) {
    throw new Error('Dorm level must be an integer from 0 to 3');
  }
  return (
    WEEKLY_CONDITION_RECOVERY + dormLevel * DORM_CONDITION_RECOVERY_PER_LEVEL
  );
}

function validateStateClock(
  state: Pick<GameState, 'careerSeed' | 'season' | 'week'>,
): void {
  if (
    !Number.isInteger(state.careerSeed) ||
    state.careerSeed < 0 ||
    state.careerSeed > 4294967295
  ) {
    throw new Error('wellbeing career seed must be a uint32');
  }
  if (!Number.isSafeInteger(state.season) || state.season < 1) {
    throw new Error('wellbeing season must be a positive safe integer');
  }
  if (!Number.isSafeInteger(state.week) || state.week < 1) {
    throw new Error('wellbeing week must be a positive safe integer');
  }
}

function checkedMultiply(left: number, right: number, label: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result))
    throw new Error(`${label} exceeds the safe integer range`);
  return result;
}
