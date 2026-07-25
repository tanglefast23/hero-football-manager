import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
  startNextSeason,
} from './career';
import { renewCareerPlayer } from './squad';
import { mulberry32 } from '../sim/rng';
import type { CareerSetup, GameState } from './types';

export interface FullCareerBalanceSummary {
  completedSeasons: number;
  endingCash: number;
  minimumBalance: number;
  maximumBalance: number;
  minimumWeeklyNet: number;
  maximumWeeklyNet: number;
  trainingPoints: number;
  currentDivision: number;
  userRosterSize: number;
  userStartingLineupSize: number;
}

/**
 * Advances the endless M2 clock without rendering matches. Supplied fixture
 * scores are derived only from each fixture seed, so this exercises the whole
 * management/season transition path while remaining fast enough for CI rails.
 */
export function runHeadlessFullCareer(
  setup: CareerSetup,
  completedSeasons: number,
): GameState {
  if (!Number.isSafeInteger(completedSeasons) || completedSeasons < 1 || completedSeasons > 100) {
    throw new Error('completedSeasons must be an integer from 1 to 100');
  }

  let state = createCareer(setup);
  const maximumTransitions = completedSeasons * 64 + 1;
  let transitions = 0;

  while (!(state.phase === 'season-end' && state.season === completedSeasons)) {
    transitions += 1;
    if (transitions > maximumTransitions) {
      throw new Error(`headless full career exceeded ${maximumTransitions} transitions`);
    }

    if (state.phase === 'manage') {
      state = advanceWeek(state);
    } else if (state.phase === 'matchday') {
      const matchday = activeCareerMatchday(state);
      if (matchday === undefined) {
        throw new Error('headless full career entered matchday without an active fixture');
      }
      state = completeMatchday(
        state,
        matchday.fixtures.map(deterministicFixtureScore),
      );
    } else if (state.phase === 'season-end') {
      for (const player of state.players.filter(candidate => (
        candidate.clubId === state.userClubId && candidate.contractSeasonsRemaining === 0
      ))) {
        state = renewCareerPlayer(state, player.id, 4, 1);
      }
      state = startNextSeason(state);
    } else {
      throw new Error('a full career must never enter the complete phase');
    }
  }

  return state;
}

/**
 * Extracts the numeric M2 rails while rejecting corrupted/non-finite money.
 * The caller supplies the setup to the headless runner, so this pure game
 * helper never imports launch content or platform code.
 */
export function summarizeFullCareerBalance(state: GameState): FullCareerBalanceSummary {
  if (state.m2 === undefined) {
    throw new Error('full career balance requires an M2 career state');
  }
  const userClub = state.clubs.find(club => club.id === state.userClubId);
  const userLineup = state.lineups.find(lineup => lineup.clubId === state.userClubId);
  if (userClub === undefined || userLineup === undefined) {
    throw new Error('full career balance requires the user club and lineup');
  }
  const money = [
    userClub.cash,
    userClub.weeklyWages,
    ...state.ledgers.flatMap(ledger => [
      ledger.balanceAfter,
      ...ledger.lines.map(line => line.amount),
    ]),
    ...(state.cashTransactions ?? []).flatMap(transaction => [
      transaction.amount,
      transaction.balanceAfter,
    ]),
  ];
  if (money.some(value => !Number.isSafeInteger(value))) {
    throw new Error('full career balance contains non-finite or unsafe money');
  }
  if (!Number.isSafeInteger(state.trainingPoints) || state.trainingPoints < 0) {
    throw new Error('full career balance contains invalid Training Points');
  }

  const balances = state.ledgers.map(ledger => ledger.balanceAfter);
  const weeklyNets = state.ledgers.map(ledger => ledger.lines.reduce(
    (sum, line) => sum + line.amount,
    0,
  ));
  if (balances.length === 0 || weeklyNets.length === 0) {
    throw new Error('full career balance requires settled weeks');
  }
  const division = state.m2.pyramid.divisions.find(candidate => (
    candidate.clubs.some(club => club.id === state.userClubId)
  ));
  if (division === undefined) throw new Error('full career balance cannot find the user division');

  return {
    completedSeasons: state.season,
    endingCash: userClub.cash,
    minimumBalance: Math.min(...balances),
    maximumBalance: Math.max(...balances),
    minimumWeeklyNet: Math.min(...weeklyNets),
    maximumWeeklyNet: Math.max(...weeklyNets),
    trainingPoints: state.trainingPoints,
    currentDivision: division.level,
    userRosterSize: state.players.filter(player => player.clubId === state.userClubId).length,
    userStartingLineupSize: userLineup.playerIds.length,
  };
}

function deterministicFixtureScore(fixture: GameState['fixtures'][number]) {
  const random = mulberry32(fixture.matchSeed);
  const homeGoals = deterministicGoalRoll(random()) + (random() < 0.12 ? 1 : 0);
  const awayGoals = deterministicGoalRoll(random());
  return { fixtureId: fixture.id, homeGoals, awayGoals };
}

function deterministicGoalRoll(roll: number): number {
  if (roll < 0.34) return 0;
  if (roll < 0.68) return 1;
  if (roll < 0.88) return 2;
  if (roll < 0.97) return 3;
  return 4;
}
