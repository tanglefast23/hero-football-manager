import type { Rng } from '../../sim/rng';
import type { PowerId, TeamDef } from '../../sim/types';
import type { CareerPlayer, GameState, LeagueFixture } from '../types';
import { resolveFirstAwakening, type OnboardingOrigin } from './first-awakening';
import {
  CREATED_PLAYER_ROOKIE_WAGE,
  validateCreatedPlayerDraft,
  type CreatedPlayerDraft,
} from './player-creation';

export const CREATED_PLAYER_ID_SUFFIX = 'created-player';

export function beginStoryOnboarding(state: GameState): GameState {
  if (state.phase !== 'manage' || state.season !== 1 || state.week !== 1) {
    throw new Error('Story onboarding must begin at Season 1, Week 1 management');
  }
  const userPlayers = state.players.filter(player => player.clubId === state.userClubId);
  if (userPlayers.length === 0) throw new Error('Story onboarding requires a user-club roster');
  return {
    ...state,
    players: state.players.map(player => player.clubId === state.userClubId
      ? { ...player, power: undefined, licensed: false, onHeroWage: false }
      : player),
    onboarding: { stage: 'create-player' },
  };
}

export function addCreatedPlayer(state: GameState, draft: CreatedPlayerDraft): GameState {
  if (state.onboarding?.stage !== 'create-player') {
    throw new Error('A player can only be created at the start of onboarding');
  }
  const { name, attrs } = validateCreatedPlayerDraft(draft);
  const playerId = `${state.userClubId}-${CREATED_PLAYER_ID_SUFFIX}`;
  if (state.players.some(player => player.id === playerId)) {
    throw new Error('The created player already exists');
  }
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  if (lineup === undefined) throw new Error('The user club has no starting lineup');
  const playerById = new Map(state.players.map(player => [player.id, player]));
  let replacementIndex = -1;
  for (let index = lineup.playerIds.length - 1; index >= 0; index -= 1) {
    if (playerById.get(lineup.playerIds[index])?.role === 'FWD') {
      replacementIndex = index;
      break;
    }
  }
  if (replacementIndex < 0) throw new Error('The starting lineup needs an outfield forward slot');
  const firstFixture = firstUserFixture(state);
  const created: CareerPlayer = {
    id: playerId,
    clubId: state.userClubId,
    name,
    role: 'FWD',
    attrs,
    licensed: false,
    weeklyWage: CREATED_PLAYER_ROOKIE_WAGE,
    onHeroWage: false,
    contractSeasonsRemaining: 1,
    morale: 50,
    injuryWeeks: 0,
  };
  return {
    ...state,
    clubs: state.clubs.map(club => club.id === state.userClubId
      ? { ...club, weeklyWages: safeAdd(club.weeklyWages, CREATED_PLAYER_ROOKIE_WAGE) }
      : club),
    players: [...state.players, created],
    lineups: state.lineups.map(candidate => candidate.clubId === state.userClubId
      ? {
          ...candidate,
          playerIds: candidate.playerIds.map((id, index) =>
            index === replacementIndex ? playerId : id),
        }
      : candidate),
    onboarding: {
      stage: 'first-match',
      createdPlayerId: playerId,
      firstFixtureId: firstFixture.id,
    },
  };
}

export function isFirstOnboardingFixture(state: GameState, fixtureId: string): boolean {
  return state.onboarding?.stage === 'first-match'
    && state.onboarding.firstFixtureId === fixtureId;
}

export function completeFirstOnboardingMatch(state: GameState, fixtureId: string): GameState {
  if (!isFirstOnboardingFixture(state, fixtureId)) {
    throw new Error('The completed fixture is not the onboarding match');
  }
  const fixture = state.fixtures.find(candidate => candidate.id === fixtureId);
  if (fixture?.status !== 'played') throw new Error('The onboarding fixture must be played first');
  return {
    ...state,
    onboarding: { ...state.onboarding, stage: 'collapse' },
  };
}

export function awakenCreatedPlayer(
  state: GameState,
  origin: OnboardingOrigin,
  rng: Rng,
): GameState {
  const onboarding = state.onboarding;
  if (onboarding?.stage !== 'collapse' || onboarding.createdPlayerId === undefined) {
    throw new Error('The first awakening requires the post-match collapse');
  }
  const created = state.players.find(player => player.id === onboarding.createdPlayerId);
  if (created === undefined || created.clubId !== state.userClubId) {
    throw new Error('The created player is missing from the user club');
  }
  if (created.power !== undefined) throw new Error('The created player has already awakened');
  const existingUserHeroes = state.players.filter(
    player => player.clubId === state.userClubId && player.power !== undefined,
  );
  if (existingUserHeroes.length !== 0) {
    throw new Error('The created player must be the campaign’s first hero');
  }
  const power = resolveFirstAwakening(origin, rng);
  return {
    ...state,
    players: state.players.map(player => player.id === created.id
      ? { ...player, power, licensed: true }
      : player),
    onboarding: {
      ...onboarding,
      stage: 'reveal',
      selectedOrigin: origin,
      awakenedPower: power,
    },
  };
}

export function completeStoryOnboarding(state: GameState): GameState {
  if (state.onboarding?.stage !== 'reveal') {
    throw new Error('The awakening reveal must resolve before onboarding completes');
  }
  return { ...state, onboarding: { ...state.onboarding, stage: 'complete' } };
}

export function withoutPowers(team: TeamDef): TeamDef {
  return {
    ...team,
    players: team.players.map(player => {
      const { power: _power, ...regular } = player;
      return { ...regular, attrs: { ...regular.attrs } };
    }),
  };
}

export function onboardingAwakeningSeed(state: GameState): number {
  return (state.careerSeed ^ 0xa11ce123) >>> 0;
}

export function createdPlayer(state: GameState): CareerPlayer | undefined {
  const id = state.onboarding?.createdPlayerId;
  return id === undefined ? undefined : state.players.find(player => player.id === id);
}

export function onboardingPower(state: GameState): PowerId | undefined {
  return state.onboarding?.awakenedPower;
}

function firstUserFixture(state: GameState): LeagueFixture {
  const fixture = state.fixtures
    .filter(candidate => candidate.season === 1 && (
      candidate.homeClubId === state.userClubId || candidate.awayClubId === state.userClubId
    ))
    .sort((left, right) => left.week - right.week || left.round - right.round || left.id.localeCompare(right.id))[0];
  if (fixture === undefined) throw new Error('The career has no first user fixture');
  return fixture;
}

function safeAdd(left: number, right: number): number {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || !Number.isSafeInteger(left + right)) {
    throw new Error('The created player wage exceeds the safe integer range');
  }
  return left + right;
}
