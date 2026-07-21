import type { PowerId, TeamDef } from '../../sim/types';
import { developmentPotentialCeiling } from '../archetype-caps';
import { assignDistinctPlayerLooks, createdAppearanceLookId } from '../player-appearance';
import type { CareerPlayer, GameState, LeagueFixture } from '../types';
import { STORY_STARTING_ROSTER_SIZE } from '../story-progression';
import { reconcileStoryYouthIntake } from '../youth-intake';
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
  const prepared = trimStoryLaunchRoster(state, userPlayers);
  return reconcileStoryYouthIntake({
    ...prepared,
    players: prepared.players.map(player => player.clubId === state.userClubId
      ? { ...player, power: undefined, licensed: false, onHeroWage: false }
      : player),
    onboarding: { stage: 'create-player' },
  });
}

function trimStoryLaunchRoster(state: GameState, userPlayers: readonly CareerPlayer[]): GameState {
  const targetBeforeCreatedPlayer = STORY_STARTING_ROSTER_SIZE - 1;
  const removalCount = Math.max(0, userPlayers.length - targetBeforeCreatedPlayer);
  if (removalCount === 0) return state;

  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  if (lineup === undefined) throw new Error('Story onboarding requires a user-club lineup');
  const starters = new Set(lineup.playerIds);
  const removable = userPlayers
    .filter(player => !starters.has(player.id) && player.role !== 'GK')
    .slice()
    .sort((left, right) => (
      Number(right.role === 'FWD') - Number(left.role === 'FWD')
      || left.weeklyWage - right.weeklyWage
      || left.id.localeCompare(right.id)
    ));
  if (removable.length < removalCount) {
    throw new Error('Story onboarding needs enough reserve outfield players to open two roster slots');
  }

  const removed = new Set(removable.slice(0, removalCount).map(player => player.id));
  const removedWages = removable
    .slice(0, removalCount)
    .reduce((total, player) => total + player.weeklyWage, 0);
  return {
    ...state,
    players: state.players.filter(player => !removed.has(player.id)),
    clubs: state.clubs.map(club => club.id === state.userClubId
      ? { ...club, weeklyWages: club.weeklyWages - removedWages }
      : club),
  };
}

export function addCreatedPlayer(state: GameState, draft: CreatedPlayerDraft): GameState {
  if (state.onboarding?.stage !== 'create-player') {
    throw new Error('A player can only be created at the start of onboarding');
  }
  const { name, attrs, appearance, difficulty } = validateCreatedPlayerDraft(draft);
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
    lookId: createdAppearanceLookId(appearance),
    createdAppearance: appearance,
    attrs,
    licensed: false,
    weeklyWage: CREATED_PLAYER_ROOKIE_WAGE,
    onHeroWage: false,
    contractSeasonsRemaining: 1,
    morale: 50,
    injuryWeeks: 0,
    age: 18,
    archetype: 'All-Rounder',
    potential: 4,
    potentialCeiling: developmentPotentialCeiling({
      id: playerId,
      role: 'FWD',
      attrs,
      age: 18,
      potential: 4,
    }),
    consistency: 70,
    personality: 'Professional',
    condition: 100,
    seasonsAtClub: 0,
    fame: 0,
    retirementAge: 36,
    retirementAnnounced: false,
  };
  // The explicit paper-doll choice owns its atlas slot. Move a colliding
  // generated player instead of silently changing the selected appearance.
  const assignedLooks = assignDistinctPlayerLooks([created, ...state.players]);
  const assignedById = new Map(assignedLooks.map(player => [player.id, player]));
  return {
    ...state,
    difficulty,
    clubs: state.clubs.map(club => club.id === state.userClubId
      ? { ...club, weeklyWages: safeAdd(club.weeklyWages, CREATED_PLAYER_ROOKIE_WAGE) }
      : club),
    players: [
      ...state.players.map(player => assignedById.get(player.id)!),
      assignedById.get(created.id)!,
    ],
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

export function withoutPowers(team: TeamDef): TeamDef {
  return {
    ...team,
    players: team.players.map(player => {
      const { power: _power, ...regular } = player;
      return { ...regular, attrs: { ...regular.attrs } };
    }),
  };
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
