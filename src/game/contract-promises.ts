import { compareIds } from './ordering';

import type {
  CareerContractPerk,
  CareerContractPromise,
  CareerPlayer,
  GameState,
} from './types';
import { playerAttributeCaps, roleOverall } from './archetype-caps';
import { highestDivisionReached } from './promotion-progression';
import { TRAINING_PATHS } from './training-paths';
import { isAvailableForSelection } from './lineup';

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
  /**
   * The cap this promise was validated against. Defaults to the club's current
   * one; season-end callers pass the projected post-promotion cap so completion
   * cannot reject a promise that offer-submit already allowed.
   */
  heroLimit?: number,
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
    if (licensedCount >= (heroLimit ?? contractPromiseHeroLimit(state))) {
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

  // TRAINING_PRIORITY is an obligation, not a slot: the manager owes the
  // player their next TRAINING_PRIORITY_DRILLS drills. Until the countdown
  // drains, other players' instant drills are blocked (the promised player
  // reminds you). Re-read the promised player from the immutable copy so the
  // returned state is plain data even when no reassignment was necessary.
  players = players.map(candidate => candidate.id === playerId
    ? {
        ...candidate,
        contractPromise: { ...promise },
        ...(perk === 'TRAINING_PRIORITY'
          ? { priorityDrillsRemaining: TRAINING_PRIORITY_DRILLS }
          : {}),
      }
    : candidate);
  return { ...state, players, lineups };
}

/** Drills owed to a player the moment a TRAINING_PRIORITY promise is agreed. */
export const TRAINING_PRIORITY_DRILLS = 5;

/**
 * The fit promise-holder still owed drills, if any. While one exists, only
 * they may train; an injured holder pauses the debt rather than deadlocking
 * the training screen, and a player maxed at 999 everywhere has nothing left
 * to drill, so their debt can never block anyone.
 */
export function pendingTrainingPriorityHolder(
  state: GameState,
): { playerId: string; playerName: string; remaining: number } | undefined {
  const holder = state.players.find(player => (
    player.clubId === state.userClubId
    && isAvailableForSelection(player)
    && (player.priorityDrillsRemaining ?? 0) > 0
    && hasActiveCareerContractPromise(player, 'TRAINING_PRIORITY')
    && !isFullyCappedPlayer(player)
  ));
  return holder === undefined
    ? undefined
    : {
        playerId: holder.id,
        playerName: holder.name,
        remaining: holder.priorityDrillsRemaining ?? 0,
      };
}

/** Restores recovered promised starters after injury repair and weekly settlement. */
export function restoreCareerContractPromiseLineup(state: GameState): GameState {
  const promised = state.players
    .filter(player => (
      player.clubId === state.userClubId
      && isAvailableForSelection(player)
      && hasActiveCareerContractPromise(player)
      && STARTING_PROMISES.includes(player.contractPromise!.perk)
    ))
    .slice()
    .sort((left, right) => (
      (left.contractPromise!.agreedSeason - right.contractPromise!.agreedSeason)
      || compareIds(left.id, right.id)
    ));
  return promised.reduce((current, player) => ({
    ...current,
    lineups: putPromisedPlayerInStartingLineup(current, player.id),
  }), state);
}

/**
 * Rejects a lineup edit that would break a fit player's accepted promise.
 *
 * Only enforceable promises are demanded. The club can overcommit — two
 * promised goalkeepers compete for the single GK slot — and the settlement
 * fail-soft in `putPromisedPlayerInStartingLineup` deliberately leaves the
 * later promise unhonoured. Demanding it here anyway froze every lineup edit
 * for the promise's whole duration, so this mirrors the same seniority order
 * (agreedSeason, then id): one GK promise and at most ten outfield promises
 * are enforceable.
 */
export function assertCareerLineupHonorsContractPromises(
  state: GameState,
  playerIds: readonly string[],
): void {
  const selected = new Set(playerIds);
  const promised = state.players
    .filter(player => (
      player.clubId === state.userClubId
      && isAvailableForSelection(player)
      && hasActiveCareerContractPromise(player)
      && STARTING_PROMISES.includes(player.contractPromise!.perk)
    ))
    .sort((left, right) => (
      (left.contractPromise!.agreedSeason - right.contractPromise!.agreedSeason)
      || compareIds(left.id, right.id)
    ));
  const enforceable = [
    ...promised.filter(player => player.role === 'GK').slice(0, 1),
    ...promised.filter(player => player.role !== 'GK').slice(0, 10),
  ];
  for (const player of enforceable) {
    if (!selected.has(player.id)) {
      throw new Error(`${player.name} was promised a place in the starting XI`);
    }
  }
}

/** True only once every trainable attribute reaches the universal 999 maximum. */
export function isFullyCappedPlayer(player: CareerPlayer): boolean {
  const caps = playerAttributeCaps(player);
  return TRAINING_PATHS.every(path => player.attrs[path.attribute] >= caps[path.attribute]);
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
  // Two promises can compete for one slot (there is only ever a single GK slot).
  // Leaving the promise unhonoured is the correct outcome — the club overcommitted
  // — whereas throwing here ran during weekly settlement and bricked the career.
  if (replacementSlot < 0) return state.lineups;
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
      || compareIds(left.player.id, right.player.id)
    ))[0]?.index ?? -1;
}

/**
 * Why this promise cannot be given to this player, or undefined when it can.
 *
 * Every reason here used to be discovered the same way: the agent shook your
 * hand, and then `applyCareerContractPromise` threw and `guarded()` discarded
 * the agreed deal. Checking at offer-submit means an ACCEPTED negotiation can
 * always be completed, and the panel can grey the row with the reason instead.
 *
 * `heroLimit` is passed in rather than read here because at season end the
 * correct cap is the one the club is about to have, not the one it has — the
 * screen announces a promotion's new Hero License two panels above the renewal
 * that would be checked against the old cap. Only the caller knows the standings.
 */
export function careerContractPromiseBlockedReason(
  state: GameState,
  player: CareerPlayer,
  perk: CareerContractPerk,
  heroLimit: number,
): string | undefined {
  const squad = state.players.filter(candidate => (
    candidate.clubId === state.userClubId && candidate.id !== player.id
  ));
  const holderOf = (held: CareerContractPerk): CareerPlayer | undefined =>
    squad.find(candidate => hasActiveCareerContractPromise(candidate, held));

  if (STARTING_PROMISES.includes(perk) && player.power !== undefined && !player.licensed) {
    const licensed = state.players.filter(candidate => (
      candidate.clubId === state.userClubId && candidate.licensed
    )).length;
    if (licensed >= heroLimit) {
      return `No Hero License is free. ${player.name} needs one to be promised a place.`;
    }
  }

  // Single-holder roles. The second promise used to silently strip the first,
  // leaving a live contract carrying a promise the club could never honour.
  if (perk === 'CAPTAINCY') {
    const captain = holderOf('CAPTAINCY');
    if (captain !== undefined) {
      return `${captain.name} was promised the captaincy until his contract ends.`;
    }
  }
  if (perk === 'JERSEY_10') {
    const wearer = holderOf('JERSEY_10');
    if (wearer !== undefined) {
      return `${wearer.name} was promised the number 10 shirt until his contract ends.`;
    }
  }
  if (perk === 'TRAINING_PRIORITY') {
    const owed = squad.find(candidate => (
      hasActiveCareerContractPromise(candidate, 'TRAINING_PRIORITY')
      && (candidate.priorityDrillsRemaining ?? 0) > 0
    ));
    if (owed !== undefined) {
      return `${owed.name} is still owed ${owed.priorityDrillsRemaining} drills.`;
    }
  }

  // A starting promise the lineup could never satisfy. Enforcement fail-softs at
  // one GK and ten outfielders, so beyond that the club would be recording an
  // obligation it has already decided not to keep.
  if (STARTING_PROMISES.includes(perk)) {
    const promisedStarters = squad.filter(candidate => (
      hasActiveCareerContractPromise(candidate)
      && STARTING_PROMISES.includes(candidate.contractPromise!.perk)
    ));
    if (player.role === 'GK') {
      const promisedKeeper = promisedStarters.find(candidate => candidate.role === 'GK');
      if (promisedKeeper !== undefined) {
        return `${promisedKeeper.name} already has the promised goalkeeper's shirt.`;
      }
    } else if (promisedStarters.filter(candidate => candidate.role !== 'GK').length >= 10) {
      return 'Every outfield place in the XI is already promised.';
    }
  }
  return undefined;
}

/**
 * The Hero License cap a promise is checked against.
 *
 * Exported so callers can pass the projected season-end value; see
 * `careerContractPromiseBlockedReason`.
 */
export function contractPromiseHeroLimitForDivision(division: number): number {
  if (division === 1) return 4;
  if (division <= 3) return 3;
  return 2;
}

export function careerContractPromiseHeroLimit(state: GameState): number {
  return contractPromiseHeroLimit(state);
}

function contractPromiseHeroLimit(state: GameState): number {
  if (state.m2 === undefined) return 2;
  // Ratchets on the highest division reached, matching `careerHeroLimit`:
  // promotion unlocks are permanent, so relegation must not shrink the cap a
  // promise negotiation checks against while match day still honours 4 slots.
  return contractPromiseHeroLimitForDivision(highestDivisionReached(state));
}
