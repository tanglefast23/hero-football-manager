import type { TeamDef } from '../sim/types';
import {
  advanceWeek,
  completeMatchday,
  createCareer,
  fixturesForCurrentWeek,
  leagueStandings,
  startNextSeason,
} from './career';
import { resolveMatchday } from './matchday';
import type { CareerSetup, GameState } from './types';

const MAX_HEADLESS_TRANSITIONS = 128;

export interface HeadlessCareerSummary {
  endingCash: number;
  trainingPoints: number;
  minimumBalance: number;
  finalPositionBySeason: Record<number, number>;
}

export function runHeadlessM1Career(
  setup: CareerSetup,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
): GameState {
  let state = createCareer(setup);
  let transitions = 0;

  while (state.phase !== 'complete') {
    transitions += 1;
    if (transitions > MAX_HEADLESS_TRANSITIONS) {
      throw new Error(`headless M1 career exceeded ${MAX_HEADLESS_TRANSITIONS} transitions`);
    }

    if (state.phase === 'manage') {
      state = advanceWeek(state);
    } else if (state.phase === 'matchday') {
      const fixtures = fixturesForCurrentWeek(state);
      const results = resolveMatchday(fixtures, teamsByClubId);
      state = completeMatchday(state, results);
    } else if (state.phase === 'season-end') {
      state = startNextSeason(state);
    }
  }

  return state;
}

export function summarizeCareer(state: GameState): HeadlessCareerSummary {
  const userClub = state.clubs.find(club => club.id === state.userClubId);
  if (userClub === undefined) {
    throw new Error(`user club ${state.userClubId} does not exist`);
  }

  const finalPositionBySeason: Record<number, number> = {};
  for (let season = 1; season <= state.season; season += 1) {
    const position = leagueStandings(state, season)
      .find(standing => standing.clubId === state.userClubId)?.position;
    if (position === undefined) {
      throw new Error(`user club ${state.userClubId} has no standing for season ${season}`);
    }
    finalPositionBySeason[season] = position;
  }

  return {
    endingCash: userClub.cash,
    trainingPoints: state.trainingPoints,
    minimumBalance: state.ledgers.reduce(
      (minimum, ledger) => Math.min(minimum, ledger.balanceAfter),
      userClub.cash,
    ),
    finalPositionBySeason,
  };
}
