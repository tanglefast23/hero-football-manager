import type { PowerId, TeamDef } from '../sim/types';
import { buildTeamDef } from './lineup';
import {
  applyTrainingPlan,
  renewContract,
  resolveAwakening,
  selectLicensedHeroes,
  type FocusDrill,
} from './progression';
import type { CareerPlayer, GameState } from './types';

const DEFAULT_HERO_LIMIT = 2;
const TRAINING_GROUND_COST = 8000;

export function rosterForClub(state: GameState, clubId: string): CareerPlayer[] {
  if (!state.clubs.some(club => club.id === clubId)) {
    throw new Error(`unknown club ${clubId}`);
  }
  return state.players
    .filter(player => player.clubId === clubId)
    .map(player => ({ ...player, attrs: { ...player.attrs } }));
}

export function buildCareerTeamDef(state: GameState, clubId: string): TeamDef {
  const club = state.clubs.find(candidate => candidate.id === clubId);
  if (club === undefined) throw new Error(`unknown club ${clubId}`);

  const lineup = state.lineups.find(candidate => candidate.clubId === clubId);
  if (lineup === undefined) throw new Error(`missing lineup for club ${clubId}`);

  const injured = rosterForClub(state, clubId).find(
    player => lineup.playerIds.includes(player.id) && player.injuryWeeks > 0,
  );
  if (injured !== undefined) throw new Error(`injured player ${injured.id} must be replaced in the lineup`);

  return buildTeamDef(club, rosterForClub(state, clubId), lineup.playerIds, DEFAULT_HERO_LIMIT);
}

export function buildCareerTeams(state: GameState): Readonly<Record<string, TeamDef>> {
  return Object.fromEntries(
    state.clubs.map(club => [club.id, buildCareerTeamDef(state, club.id)]),
  );
}

export function setCareerLineup(state: GameState, playerIds: readonly string[]): GameState {
  assertManagementChoicePhase(state, 'the lineup');
  const nextLineups = state.lineups.map(lineup =>
    lineup.clubId === state.userClubId ? { ...lineup, playerIds: [...playerIds] } : lineup,
  );
  if (!nextLineups.some(lineup => lineup.clubId === state.userClubId)) {
    throw new Error(`missing lineup for club ${state.userClubId}`);
  }

  const candidate = { ...state, lineups: nextLineups };
  buildCareerTeamDef(candidate, state.userClubId);
  return candidate;
}

export function selectCareerLicensedHeroes(
  state: GameState,
  selectedPlayerIds: readonly string[],
): GameState {
  assertManagementChoicePhase(state, 'hero licenses');
  const userRoster = rosterForClub(state, state.userClubId);
  const selected = selectLicensedHeroes(userRoster, selectedPlayerIds, DEFAULT_HERO_LIMIT);
  const selectedById = new Map(selected.map(player => [player.id, player]));

  return {
    ...state,
    players: state.players.map(player => {
      const next = selectedById.get(player.id);
      return next === undefined ? player : { ...player, ...next, attrs: { ...next.attrs } };
    }),
  };
}

/** Each focus drill is paired with one player at the same array index. */
export function applyCareerTraining(
  state: GameState,
  assignedPlayerIds: readonly string[],
  drills: readonly FocusDrill[],
): GameState {
  if (state.phase !== 'manage') {
    throw new Error('training can only be assigned during the manage phase');
  }
  if (assignedPlayerIds.length !== drills.length) {
    throw new Error('each focus drill must be assigned to exactly one player');
  }

  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);

  let roster = rosterForClub(state, state.userClubId);
  let resources = { money: club.cash, tp: state.trainingPoints };
  for (let index = 0; index < drills.length; index += 1) {
    const result = applyTrainingPlan(
      roster,
      [assignedPlayerIds[index]],
      [drills[index]],
      resources,
    );
    roster = result.players.map(player => {
      const original = roster.find(candidate => candidate.id === player.id);
      if (original === undefined) throw new Error(`training lost player ${player.id}`);
      return { ...original, ...player, attrs: { ...player.attrs } };
    });
    resources = result.resources;
  }

  const trainedById = new Map(roster.map(player => [player.id, player]));
  return {
    ...state,
    clubs: state.clubs.map(candidate =>
      candidate.id === state.userClubId ? { ...candidate, cash: resources.money } : candidate,
    ),
    trainingPoints: resources.tp,
    players: state.players.map(player => {
      const trained = trainedById.get(player.id);
      return trained === undefined ? player : { ...trained, attrs: { ...trained.attrs } };
    }),
  };
}

export function buildTrainingGround(
  state: GameState,
  cost = TRAINING_GROUND_COST,
): GameState {
  if (state.phase !== 'manage') {
    throw new Error('facilities can only be built during the manage phase');
  }
  if (!Number.isSafeInteger(cost) || cost < 0) {
    throw new Error('training ground cost must be a non-negative safe integer');
  }
  if (state.facilities.trainingGroundBuilt) {
    throw new Error('the training ground is already built');
  }

  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  if (club.cash < cost) throw new Error('the training ground is not affordable');

  return {
    ...state,
    clubs: state.clubs.map(candidate =>
      candidate.id === state.userClubId ? { ...candidate, cash: candidate.cash - cost } : candidate,
    ),
    facilities: { ...state.facilities, trainingGroundBuilt: true },
  };
}

export function resolveCareerAwakening(
  state: GameState,
  playerId: string,
  rollPercent: number,
  power: PowerId,
): { state: GameState; awakened: boolean; chancePercent: number } {
  if (state.phase !== 'manage') {
    throw new Error('awakening events resolve during the manage phase');
  }
  const player = state.players.find(
    candidate => candidate.id === playerId && candidate.clubId === state.userClubId,
  );
  if (player === undefined) throw new Error(`unknown user-club player ${playerId}`);

  const result = resolveAwakening(
    player,
    { failedRiskyChoices: state.eventClock.riskyChoices },
    rollPercent,
    power,
  );
  return {
    state: {
      ...state,
      players: state.players.map(candidate =>
        candidate.id === playerId
          ? { ...candidate, ...result.player, attrs: { ...result.player.attrs } }
          : candidate,
      ),
      eventClock: {
        ...state.eventClock,
        riskyChoices: result.pityState.failedRiskyChoices,
      },
    },
    awakened: result.awakened,
    chancePercent: result.chancePercent,
  };
}

export function renewCareerPlayer(
  state: GameState,
  playerId: string,
  heroMultiplier = 4,
  termSeasons = 1,
): GameState {
  if (state.phase !== 'season-end') {
    throw new Error('expired contracts can only be renewed at season end');
  }
  const player = state.players.find(
    candidate => candidate.id === playerId && candidate.clubId === state.userClubId,
  );
  if (player === undefined) throw new Error(`unknown user-club player ${playerId}`);

  const renewed = renewContract(player, heroMultiplier, termSeasons);
  const wageIncrease = renewed.weeklyWage - player.weeklyWage;
  if (!Number.isSafeInteger(wageIncrease)) {
    throw new Error('renewal wage increase exceeds the safe integer range');
  }

  return {
    ...state,
    clubs: state.clubs.map(club => {
      if (club.id !== state.userClubId) return club;
      const weeklyWages = club.weeklyWages + wageIncrease;
      if (!Number.isSafeInteger(weeklyWages) || weeklyWages < 0) {
        throw new Error('club weekly wages exceed the supported range');
      }
      return { ...club, weeklyWages };
    }),
    players: state.players.map(candidate =>
      candidate.id === playerId ? { ...candidate, ...renewed, attrs: { ...renewed.attrs } } : candidate,
    ),
  };
}

function assertManagementChoicePhase(state: GameState, choice: string): void {
  if (state.phase !== 'manage' && state.phase !== 'matchday') {
    throw new Error(`${choice} can only change before a match`);
  }
}
