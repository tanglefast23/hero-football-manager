import type {
  CareerContractPerk,
  CareerContractPromise,
  CareerPlayer,
  GameState,
} from './types';
import { roleOverall } from './archetype-caps';
import { currentUserDivision } from './m2-career';
import { TRAINING_PATHS } from './training-paths';

const STARTING_PROMISES: readonly CareerContractPerk[] = [
  'GUARANTEED_STARTER',
  'CAPTAINCY',
];

/** A promise remains binding for as long as the negotiated contract is active. */
export function hasActiveCareerContractPromise(
  player: CareerPlayer,
  perk?: CareerContractPerk,
): boolean {
  return player.contractSeasonsRemaining > 0
    && player.contractPromise !== undefined
    && (perk === undefined || player.contractPromise.perk === perk);
}

/**
 * Persists an accepted promise and immediately makes its visible consequence
 * true. Lineup and training boundaries keep it true on later edits.
 */
export function applyCareerContractPromise(
  state: GameState,
  playerId: string,
  perk: CareerContractPerk,
): GameState {
  const player = state.players.find(candidate => (
    candidate.id === playerId && candidate.clubId === state.userClubId
  ));
  if (player === undefined) throw new Error(`unknown user-club player ${playerId}`);
  if (player.contractSeasonsRemaining < 1) {
    throw new Error('a contract promise requires an active contract');
  }
  const needsHeroLicense = STARTING_PROMISES.includes(perk)
    && player.power !== undefined
    && !player.licensed;
  if (needsHeroLicense) {
    const licensedCount = state.players.filter(candidate => (
      candidate.clubId === state.userClubId && candidate.licensed
    )).length;
    if (licensedCount >= contractPromiseHeroLimit(state)) {
      throw new Error(`${player.name}'s starting promise requires an available Hero License`);
    }
  }

  const promise: CareerContractPromise = { perk, agreedSeason: state.season };
  let players = state.players.map(candidate => {
    if (candidate.clubId !== state.userClubId) return candidate;
    if (candidate.id === playerId) {
      return {
        ...candidate,
        contractPromise: promise,
        ...(needsHeroLicense ? { licensed: true } : {}),
        ...(perk === 'CAPTAINCY'
          ? { isCaptain: true }
          : candidate.contractPromise?.perk === 'CAPTAINCY'
            ? { isCaptain: false }
            : {}),
        ...(perk === 'JERSEY_10'
          ? { shirtNumber: 10 }
          : candidate.contractPromise?.perk === 'JERSEY_10'
            ? { shirtNumber: undefined }
            : {}),
      };
    }
    return {
      ...candidate,
      ...(perk === 'CAPTAINCY' && candidate.isCaptain === true ? { isCaptain: false } : {}),
      ...(perk === 'JERSEY_10' && candidate.shirtNumber === 10 ? { shirtNumber: undefined } : {}),
    };
  });

  let lineups = state.lineups;
  if (STARTING_PROMISES.includes(perk)) {
    lineups = restoreCareerContractPromiseLineup({ ...state, players }).lineups;
  }

  const maxTrainingSlots = state.trainingRules?.maxFocusDrillsPerWeek ?? 3;
  const trainingPlan = perk === 'TRAINING_PRIORITY' && state.trainingPlan !== undefined
    && !state.trainingPlan.slots.some(slot => slot.playerId === playerId)
    && state.trainingPlan.slots.length < maxTrainingSlots
    ? {
        slots: [
          ...state.trainingPlan.slots,
          { playerId, pathId: weakestTrainingPathId(player) },
        ],
      }
    : state.trainingPlan;

  // Re-read the promised player from the immutable copy so the returned state
  // is plain data even when no captain/shirt reassignment was necessary.
  players = players.map(candidate => candidate.id === playerId
    ? { ...candidate, contractPromise: { ...promise } }
    : candidate);
  return { ...state, players, lineups, trainingPlan };
}

/** Picks the trainee's lowest-rated stat as the default path for an auto-added training slot. */
function weakestTrainingPathId(player: CareerPlayer): string {
  return TRAINING_PATHS.reduce((weakest, path) => (
    player.attrs[path.attribute] < player.attrs[weakest.attribute] ? path : weakest
  )).pathId;
}

/** Restores recovered promised starters after injury repair and weekly settlement. */
export function restoreCareerContractPromiseLineup(state: GameState): GameState {
  const promised = state.players
    .filter(player => (
      player.clubId === state.userClubId
      && player.injuryWeeks === 0
      && hasActiveCareerContractPromise(player)
      && STARTING_PROMISES.includes(player.contractPromise!.perk)
    ))
    .slice()
    .sort((left, right) => (
      (left.contractPromise!.agreedSeason - right.contractPromise!.agreedSeason)
      || left.id.localeCompare(right.id)
    ));
  return promised.reduce((current, player) => ({
    ...current,
    lineups: putPromisedPlayerInStartingLineup(current, player.id),
  }), state);
}

/** Rejects a lineup edit that would break a fit player's accepted promise. */
export function assertCareerLineupHonorsContractPromises(
  state: GameState,
  playerIds: readonly string[],
): void {
  const selected = new Set(playerIds);
  for (const player of state.players) {
    if (player.clubId !== state.userClubId
      || player.injuryWeeks > 0
      || !hasActiveCareerContractPromise(player)
      || !STARTING_PROMISES.includes(player.contractPromise!.perk)) continue;
    if (!selected.has(player.id)) {
      throw new Error(`${player.name} was promised a place in the starting XI`);
    }
  }
}

/** Rejects a weekly plan that omits a fit player promised training priority. */
export function assertCareerTrainingHonorsContractPromises(
  state: GameState,
  assignedPlayerIds: readonly string[],
): void {
  const assigned = new Set(assignedPlayerIds);
  for (const player of state.players) {
    if (player.clubId !== state.userClubId
      || player.injuryWeeks > 0
      || !hasActiveCareerContractPromise(player, 'TRAINING_PRIORITY')) continue;
    if (!assigned.has(player.id)) {
      throw new Error(`${player.name} was promised training priority`);
    }
  }
}

/** Removes promises and club-owned presentation roles when a player is sold. */
export function clearCareerContractPromise(player: CareerPlayer): CareerPlayer {
  const {
    contractPromise: _contractPromise,
    isCaptain: _isCaptain,
    shirtNumber: _shirtNumber,
    ...rest
  } = player;
  return rest;
}

function putPromisedPlayerInStartingLineup(
  state: GameState,
  playerId: string,
): GameState['lineups'] {
  const player = state.players.find(candidate => candidate.id === playerId)!;
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  if (lineup === undefined) throw new Error('the user club has no lineup');
  if (lineup.playerIds.includes(playerId)) return state.lineups;

  const playerById = new Map(state.players.map(candidate => [candidate.id, candidate]));
  const replacementSlot = promisedReplacementSlot(lineup.playerIds, player, playerById);
  if (replacementSlot < 0) {
    throw new Error(`${player.name} cannot be placed in the starting XI`);
  }
  return state.lineups.map(candidate => candidate.clubId !== state.userClubId
    ? candidate
    : {
        ...candidate,
        playerIds: candidate.playerIds.map((id, index) => index === replacementSlot ? playerId : id),
      });
}

function promisedReplacementSlot(
  lineupIds: readonly string[],
  promisedPlayer: CareerPlayer,
  playerById: ReadonlyMap<string, CareerPlayer>,
): number {
  if (promisedPlayer.role === 'GK') {
    const current = playerById.get(lineupIds[0]);
    return current !== undefined
      && (hasActiveCareerContractPromise(current, 'GUARANTEED_STARTER')
        || hasActiveCareerContractPromise(current, 'CAPTAINCY'))
      ? -1
      : 0;
  }
  const eligible = lineupIds
    .map((id, index) => ({ index, player: playerById.get(id) }))
    .filter((candidate): candidate is { index: number; player: CareerPlayer } => (
      candidate.player !== undefined
      && candidate.player.role !== 'GK'
      && candidate.player.id !== promisedPlayer.id
      && !hasActiveCareerContractPromise(candidate.player, 'GUARANTEED_STARTER')
      && !hasActiveCareerContractPromise(candidate.player, 'CAPTAINCY')
    ));
  const sameRole = eligible.filter(candidate => candidate.player.role === promisedPlayer.role);
  const pool = sameRole.length > 0 ? sameRole : eligible;
  return pool
    .slice()
    .sort((left, right) => (
      roleOverall(left.player.role, left.player.attrs)
        - roleOverall(right.player.role, right.player.attrs)
      || left.player.id.localeCompare(right.player.id)
    ))[0]?.index ?? -1;
}

function contractPromiseHeroLimit(state: GameState): number {
  if (state.careerMode !== 'full' || state.m2 === undefined) return 2;
  const division = currentUserDivision(state.m2);
  if (division === 1) return 4;
  if (division <= 3) return 3;
  return 2;
}
