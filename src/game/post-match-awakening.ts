import { mulberry32 } from '../sim/rng';
import type { PowerId } from '../sim/types';
import {
  awakeningPowerRollSize,
  chooseStatWeightedAwakeningPower,
} from './career-events';
import type { GameState } from './types';
import { powerIsCompatibleWithRole } from './power-catalog';
import { hasActiveCareerContractPromise } from './contract-promises';
import { careerHeroLimit } from './squad';

export interface PostMatchAwakeningTuning {
  chancePercent: number;
  minimumMatchesBetween: number;
}

export interface PostMatchAwakeningResult {
  state: GameState;
  awakened: boolean;
}

/**
 * Resolves the single automatic awakening check after the user's match.
 * The first created player is guaranteed; later checks are deterministic from
 * the career seed + fixture ID and become eligible on the third match after
 * the previous awakening.
 */
export function resolvePostMatchAwakening(
  state: GameState,
  fixtureId: string,
  participantIds: readonly string[],
  powerIds: readonly PowerId[],
  triggerIds: readonly string[],
  tuning: PostMatchAwakeningTuning,
): PostMatchAwakeningResult {
  validateTuning(tuning);
  validatePowerIds(powerIds);
  validateTriggerIds(triggerIds);
  if (state.awakening.pending !== undefined) {
    throw new Error('the previous awakening cutscene must finish first');
  }
  const fixture = state.fixtures.find(candidate => candidate.id === fixtureId);
  if (fixture === undefined || fixture.status !== 'played') {
    throw new Error('post-match awakening requires the completed fixture');
  }
  if (fixture.homeClubId !== state.userClubId && fixture.awayClubId !== state.userClubId) {
    throw new Error('post-match awakening requires the user fixture');
  }

  const firstHero = state.onboarding?.firstFixtureId === fixtureId
    && (state.onboarding.stage === 'first-match' || state.onboarding.stage === 'collapse');
  const matchesSinceLastAwakening = state.awakening.matchesSinceLastAwakening + 1;
  const licensedCount = state.players.filter(candidate =>
    candidate.clubId === state.userClubId && candidate.licensed,
  ).length;
  const hasAvailableHeroLicense = licensedCount < careerHeroLimit(state);
  let playerId: string | undefined;

  if (firstHero) {
    playerId = state.onboarding?.createdPlayerId;
    if (playerId === undefined) throw new Error('the first awakening is missing the created player');
    if (!participantIds.includes(playerId)) {
      throw new Error('the created player must take part in the first awakening match');
    }
  } else {
    const nextWithoutAwakening = (): PostMatchAwakeningResult => ({
      state: {
        ...state,
        awakening: { ...state.awakening, matchesSinceLastAwakening, pending: undefined },
      },
      awakened: false,
    });
    if (matchesSinceLastAwakening < tuning.minimumMatchesBetween) {
      return nextWithoutAwakening();
    }
    if (deterministicPostMatchAwakeningRoll(state.careerSeed, fixtureId, 0, 100)
      >= tuning.chancePercent) {
      return nextWithoutAwakening();
    }
    const eligible = unique(participantIds).filter(id => state.players.some(player =>
      player.id === id
      && player.clubId === state.userClubId
      && player.power === undefined
      && powerIds.some(power => powerIsCompatibleWithRole(power, player.role))
      && canSafelyAwaken(state, id, hasAvailableHeroLicense),
    ));
    if (eligible.length === 0) return nextWithoutAwakening();
    playerId = eligible[
      deterministicPostMatchAwakeningRoll(state.careerSeed, fixtureId, 1, eligible.length)
    ];
  }

  const player = state.players.find(candidate =>
    candidate.id === playerId && candidate.clubId === state.userClubId,
  );
  if (player === undefined) throw new Error(`unknown awakening player ${String(playerId)}`);
  if (player.power !== undefined) throw new Error('the selected awakening player is already a hero');
  if (firstHero && state.players.some(candidate =>
    candidate.clubId === state.userClubId && candidate.power !== undefined,
  )) {
    throw new Error('the created player must be the campaign first hero');
  }

  const hasPoweredTeammate = state.players.some(candidate => candidate.id !== playerId
    && candidate.clubId === state.userClubId && candidate.power !== undefined);
  // Rally Cry is intentionally a squad-synergy power. It cannot be the first
  // or only awakening because there would be nobody for it to accelerate.
  const compatiblePowerIds = powerIds.filter(power => powerIsCompatibleWithRole(power, player.role)
    && (power !== 'RALLY_CRY' || hasPoweredTeammate));
  if (compatiblePowerIds.length === 0) {
    throw new Error(`no awakening power is compatible with ${player.role}`);
  }
  const powerRollSize = awakeningPowerRollSize(compatiblePowerIds, player.attrs);
  const power = chooseStatWeightedAwakeningPower(
    compatiblePowerIds,
    player.attrs,
    deterministicPostMatchAwakeningRoll(state.careerSeed, fixtureId, 2, powerRollSize),
  );
  const unusedTriggerIds = triggerIds.filter(id => !state.awakening.usedTriggerIds.includes(id));
  const triggerPool = unusedTriggerIds.length > 0 ? unusedTriggerIds : triggerIds;
  // Keep the campaign's first awakening recognizable and reviewable; later
  // awakenings rotate deterministically through the remaining visual causes.
  const triggerId = firstHero
    ? triggerIds[0]
    : triggerPool[
        deterministicPostMatchAwakeningRoll(state.careerSeed, fixtureId, 3, triggerPool.length)
      ];
  const usedTriggerIds = unusedTriggerIds.length > 0
    ? [...state.awakening.usedTriggerIds, triggerId]
    : state.awakening.usedTriggerIds;
  const nextPlayers = state.players.map(candidate => candidate.id === playerId
    ? { ...candidate, power, powerTier: 1 as const, licensed: hasAvailableHeroLicense }
    : candidate);
  const nextLineups = hasAvailableHeroLicense
    ? state.lineups
    : benchUnlicensedAwakening(state, nextPlayers, playerId);
  const next: GameState = {
    ...state,
    players: nextPlayers,
    lineups: nextLineups,
    awakening: {
      matchesSinceLastAwakening: 0,
      usedTriggerIds,
      pending: { fixtureId, playerId, power, triggerId, firstHero },
    },
    ...(firstHero && state.onboarding ? {
      onboarding: {
        ...state.onboarding,
        stage: 'reveal' as const,
        awakenedPower: power,
      },
    } : {}),
  };
  return { state: next, awakened: true };
}

export function completePostMatchAwakening(state: GameState): GameState {
  const pending = state.awakening.pending;
  if (pending === undefined) throw new Error('there is no awakening cutscene to complete');
  if (pending.firstHero && state.onboarding?.stage !== 'reveal') {
    throw new Error('the first awakening reveal is not ready');
  }
  return {
    ...state,
    awakening: {
      matchesSinceLastAwakening: state.awakening.matchesSinceLastAwakening,
      usedTriggerIds: [...state.awakening.usedTriggerIds],
    },
    ...(pending.firstHero && state.onboarding ? {
      onboarding: { ...state.onboarding, stage: 'complete' as const },
    } : {}),
  };
}

export function deterministicPostMatchAwakeningRoll(
  careerSeed: number,
  fixtureId: string,
  stream: number,
  upperExclusive: number,
): number {
  if (!Number.isInteger(careerSeed) || careerSeed < 0 || careerSeed > 4294967295) {
    throw new Error('awakening career seed must be a uint32');
  }
  if (fixtureId.trim().length === 0) throw new Error('awakening fixture ID must not be empty');
  if (!Number.isSafeInteger(stream) || stream < 0) {
    throw new Error('awakening RNG stream must be a nonnegative safe integer');
  }
  if (!Number.isSafeInteger(upperExclusive) || upperExclusive <= 0) {
    throw new Error('awakening RNG upper bound must be a positive safe integer');
  }
  const seed = (
    careerSeed
    ^ Math.imul(hashString(fixtureId), 0x9e3779b1)
    ^ Math.imul(stream + 1, 0x85ebca6b)
  ) >>> 0;
  return Math.floor(mulberry32(seed)() * upperExclusive);
}

function validateTuning(tuning: PostMatchAwakeningTuning): void {
  if (!Number.isInteger(tuning.chancePercent)
    || tuning.chancePercent < 0
    || tuning.chancePercent > 100) {
    throw new Error('post-match awakening chance must be an integer from 0 to 100');
  }
  if (!Number.isSafeInteger(tuning.minimumMatchesBetween)
    || tuning.minimumMatchesBetween < 0) {
    throw new Error('awakening match cooldown must be a nonnegative safe integer');
  }
}

function validatePowerIds(powerIds: readonly PowerId[]): void {
  if (powerIds.length === 0) throw new Error('post-match awakening needs at least one power');
  if (new Set(powerIds).size !== powerIds.length) {
    throw new Error('post-match awakening power IDs must be unique');
  }
}

function validateTriggerIds(triggerIds: readonly string[]): void {
  if (triggerIds.length === 0) throw new Error('post-match awakening needs at least one trigger');
  if (triggerIds.some(id => id.trim().length === 0)) {
    throw new Error('post-match awakening trigger IDs must not be empty');
  }
  if (new Set(triggerIds).size !== triggerIds.length) {
    throw new Error('post-match awakening trigger IDs must be unique');
  }
}

function canSafelyAwaken(
  state: GameState,
  playerId: string,
  hasAvailableHeroLicense: boolean,
): boolean {
  if (hasAvailableHeroLicense) return true;
  const player = state.players.find(candidate => candidate.id === playerId);
  if (player === undefined) return false;
  if (player.injuryWeeks === 0
    && (hasActiveCareerContractPromise(player, 'GUARANTEED_STARTER')
      || hasActiveCareerContractPromise(player, 'CAPTAINCY'))) return false;
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  if (lineup === undefined || !lineup.playerIds.includes(playerId)) return true;
  return replacementForAwakenedStarter(state, lineup.playerIds, playerId) !== undefined;
}

function benchUnlicensedAwakening(
  state: GameState,
  players: GameState['players'],
  playerId: string,
): GameState['lineups'] {
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  if (lineup === undefined || !lineup.playerIds.includes(playerId)) return state.lineups;
  const replacementId = replacementForAwakenedStarter({ ...state, players }, lineup.playerIds, playerId);
  if (replacementId === undefined) {
    throw new Error('the unlicensed awakening player has no safe bench replacement');
  }
  return state.lineups.map(candidate => candidate.clubId === state.userClubId
    ? {
        ...candidate,
        playerIds: candidate.playerIds.map(id => id === playerId ? replacementId : id),
      }
    : candidate);
}

function replacementForAwakenedStarter(
  state: GameState,
  lineupIds: readonly string[],
  playerId: string,
): string | undefined {
  const selected = state.players.find(player => player.id === playerId);
  if (selected === undefined) return undefined;
  const lineupSet = new Set(lineupIds);
  const bench = state.players.filter(player =>
    player.clubId === state.userClubId
    && !lineupSet.has(player.id)
    && player.power === undefined
    && player.injuryWeeks === 0,
  );
  return bench.find(player => player.role === selected.role)?.id
    ?? (selected.role === 'GK' ? undefined : bench.find(player => player.role !== 'GK')?.id);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
