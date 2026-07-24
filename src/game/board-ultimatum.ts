import { sellingTransferQuote, type ValuationPlayer } from './market';
import { currentUserDivision } from './m2-career';
import { clearCareerContractPromise } from './contract-promises';
import { createEmergencyYouthReplacement } from './youth-intake';
import type {
  BoardSaleCandidate,
  BoardUltimatumResolution,
  BoardUltimatumState,
  CareerPlayer,
  GameState,
} from './types';

export const BOARD_ULTIMATUM_WEEKS = 4;
export const BOARD_FORCED_SALE_DISCOUNT_PERCENT = 30 as const;
export const BOARD_FORCED_SALE_MORALE_DELTA = -8 as const;

export type BoardForcedSaleResolution = Extract<
  BoardUltimatumResolution,
  { kind: 'FORCED_SALE' }
>;

/**
 * Creates the exact player list shown to the manager. The board never sells
 * anyone outside this persisted list, and all ordering is deterministic.
 */
export function createBoardUltimatum(state: GameState): BoardUltimatumState | undefined {
  const candidates = eligibleBoardSaleCandidates(state);
  if (candidates.length < 3) return undefined;
  return {
    id: `board-ultimatum-s${state.season}-w${state.week}`,
    issuedSeason: state.season,
    issuedWeek: state.week,
    weeksRemaining: BOARD_ULTIMATUM_WEEKS,
    targetCash: 0,
    candidates: candidates.slice(0, candidates.length >= 4 ? 4 : 3),
  };
}

/**
 * Repairs the saved visible list after a player leaves. Existing safe entries
 * retain their quoted fee; deterministic replacements fill any empty slots.
 */
export function reconcileBoardUltimatumCandidates(state: GameState): GameState {
  const safety = state.financialSafety;
  const ultimatum = safety?.boardUltimatum;
  if (safety === undefined || ultimatum === undefined) return state;

  const eligible = eligibleBoardSaleCandidates(state);
  if (eligible.length < 3) {
    const { boardUltimatum: _boardUltimatum, ...withoutUltimatum } = safety;
    return { ...state, financialSafety: withoutUltimatum };
  }
  const eligibleIds = new Set(eligible.map(candidate => candidate.playerId));
  const targetCount = eligible.length >= 4 ? 4 : 3;
  const candidates = ultimatum.candidates
    .filter(candidate => eligibleIds.has(candidate.playerId))
    .slice(0, targetCount);
  const retainedIds = new Set(candidates.map(candidate => candidate.playerId));
  for (const candidate of eligible) {
    if (candidates.length >= targetCount) break;
    if (retainedIds.has(candidate.playerId)) continue;
    candidates.push(candidate);
    retainedIds.add(candidate.playerId);
  }
  const protectedPlayerId = ultimatum.protectedPlayerId !== undefined
    && retainedIds.has(ultimatum.protectedPlayerId)
    ? ultimatum.protectedPlayerId
    : undefined;
  const unchanged = candidates.length === ultimatum.candidates.length
    && candidates.every((candidate, index) => (
      candidate.playerId === ultimatum.candidates[index].playerId
      && candidate.marketValue === ultimatum.candidates[index].marketValue
      && candidate.forcedSaleFee === ultimatum.candidates[index].forcedSaleFee
      && candidate.discountPercent === ultimatum.candidates[index].discountPercent
    ))
    && protectedPlayerId === ultimatum.protectedPlayerId;
  if (unchanged) return state;
  const { protectedPlayerId: _protectedPlayerId, ...unprotectedUltimatum } = ultimatum;
  return {
    ...state,
    financialSafety: {
      ...safety,
      boardUltimatum: {
        ...unprotectedUltimatum,
        candidates,
        ...(protectedPlayerId === undefined ? {} : { protectedPlayerId }),
      },
    },
  };
}

function eligibleBoardSaleCandidates(state: GameState): BoardSaleCandidate[] {
  const lineup = userLineup(state);
  const starters = new Set(lineup.playerIds);
  const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
  return state.players
    .filter(player => (
      player.clubId === state.userClubId
      && player.contractSeasonsRemaining > 0
      && canLeaveWithoutBreakingLineup(state, player)
    ))
    .map(player => candidateForPlayer(state, player, division))
    .sort((left, right) => {
      const leftStarter = starters.has(left.playerId) ? 1 : 0;
      const rightStarter = starters.has(right.playerId) ? 1 : 0;
      return leftStarter - rightStarter
        || right.forcedSaleFee - left.forcedSaleFee
        || left.playerId.localeCompare(right.playerId);
    });
}

/** Selects or changes the one player protected from a board-enforced sale. */
export function protectBoardUltimatumPlayer(
  state: GameState,
  playerId: string,
): GameState {
  if (state.phase !== 'manage') {
    throw new Error('board protection can only change during the manage phase');
  }
  const safety = state.financialSafety;
  const ultimatum = safety?.boardUltimatum;
  if (safety === undefined || ultimatum === undefined) {
    throw new Error('there is no active board ultimatum');
  }
  if (!ultimatum.candidates.some(candidate => candidate.playerId === playerId)) {
    throw new Error('only a player from the visible board candidates may be protected');
  }
  return {
    ...state,
    financialSafety: {
      ...safety,
      boardUltimatum: { ...ultimatum, protectedPlayerId: playerId },
    },
  };
}

/** Clears a target immediately after an in-week cash-producing transaction. */
export function clearMetBoardUltimatum(state: GameState): GameState {
  const safety = state.financialSafety;
  const ultimatum = safety?.boardUltimatum;
  if (safety === undefined || ultimatum === undefined) return state;
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  if (club.cash < ultimatum.targetCash) return state;
  const { boardUltimatum: _boardUltimatum, ...withoutUltimatum } = safety;
  return {
    ...state,
    financialSafety: {
      ...withoutUltimatum,
      latestBoardResolution: targetMetResolution(state, ultimatum),
    },
  };
}

/** Resolves only from the visible list, skipping its one protected player. */
export function boardForcedSaleAtDeadline(
  state: GameState,
  ultimatum: BoardUltimatumState,
): BoardForcedSaleResolution | undefined {
  const userClub = state.clubs.find(club => club.id === state.userClubId);
  if (userClub === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  for (const candidate of ultimatum.candidates) {
    if (candidate.playerId === ultimatum.protectedPlayerId) continue;
    const player = state.players.find(item => (
      item.id === candidate.playerId && item.clubId === state.userClubId
    ));
    if (player === undefined || !canLeaveWithoutBreakingLineup(state, player)) continue;
    const buyer = state.clubs
      .filter(club => club.id !== state.userClubId && club.cash >= candidate.forcedSaleFee)
      .slice()
      .sort((left, right) => right.cash - left.cash || left.id.localeCompare(right.id))[0];
    if (buyer === undefined) continue;
    const fansLost = Math.min(
      userClub.fans,
      Math.max(25, Math.floor(userClub.fans / 10)),
    );
    const replacement = createEmergencyYouthReplacement(state, player.role, ultimatum.id);
    return {
      id: ultimatum.id,
      kind: 'FORCED_SALE',
      resolvedSeason: state.season,
      resolvedWeek: state.week,
      targetCash: ultimatum.targetCash,
      playerId: player.id,
      buyerClubId: buyer.id,
      replacementPlayerId: replacement.id,
      fee: candidate.forcedSaleFee,
      discountPercent: BOARD_FORCED_SALE_DISCOUNT_PERCENT,
      moraleDelta: BOARD_FORCED_SALE_MORALE_DELTA,
      fansLost,
    };
  }
  return undefined;
}

/**
 * Applies roster, payroll, buyer-cash, fan, and morale effects. The caller owns
 * the user cash credit because the forced fee is itemized in the weekly ledger.
 */
export function applyBoardForcedSaleConsequences(
  state: GameState,
  resolution: BoardForcedSaleResolution,
): GameState {
  const player = state.players.find(candidate => (
    candidate.id === resolution.playerId && candidate.clubId === state.userClubId
  ));
  if (player === undefined) throw new Error(`unknown board-sale player ${resolution.playerId}`);
  const buyer = state.clubs.find(candidate => candidate.id === resolution.buyerClubId);
  if (buyer === undefined || buyer.id === state.userClubId) {
    throw new Error(`unknown board-sale buyer ${resolution.buyerClubId}`);
  }
  if (buyer.cash < resolution.fee) throw new Error('the board-sale buyer cannot afford the fee');
  const replacement = createEmergencyYouthReplacement(state, player.role, resolution.id);
  if (replacement.id !== resolution.replacementPlayerId) {
    throw new Error('the board-sale replacement does not match the saved resolution');
  }
  const lineups = replaceDepartingStarter(state, player);
  return {
    ...state,
    clubs: state.clubs.map(club => {
      if (club.id === state.userClubId) {
        return {
          ...club,
          fans: Math.max(0, club.fans - resolution.fansLost),
          weeklyWages: checkedAdd(
            checkedSubtract(club.weeklyWages, player.weeklyWage, 'board-sale payroll'),
            replacement.weeklyWage,
            'board relief payroll',
          ),
        };
      }
      if (club.id === buyer.id) {
        return {
          ...club,
          cash: checkedSubtract(club.cash, resolution.fee, 'board-sale buyer cash'),
          weeklyWages: checkedAdd(club.weeklyWages, player.weeklyWage, 'board-sale buyer payroll'),
        };
      }
      return club;
    }),
    players: [...state.players.map(candidate => {
      if (candidate.id === player.id) {
        return {
          ...clearCareerContractPromise(candidate),
          clubId: buyer.id,
          licensed: false,
        };
      }
      if (candidate.clubId !== state.userClubId) return candidate;
      return {
        ...candidate,
        morale: Math.max(0, candidate.morale + resolution.moraleDelta),
      };
    }), replacement],
    lineups,
    market: state.market === undefined
      ? undefined
      : {
          ...state.market,
          transferListings: (state.market.transferListings ?? [])
            .filter(listing => listing.playerId !== player.id),
        },
  };
}

export function targetMetResolution(
  state: Pick<GameState, 'season' | 'week'>,
  ultimatum: BoardUltimatumState,
): BoardUltimatumResolution {
  return {
    id: ultimatum.id,
    kind: 'TARGET_MET',
    resolvedSeason: state.season,
    resolvedWeek: state.week,
    targetCash: ultimatum.targetCash,
  };
}

function candidateForPlayer(
  state: GameState,
  player: CareerPlayer,
  division: number,
): BoardSaleCandidate {
  const quote = sellingTransferQuote(valuationPlayer(player), {
    careerSeed: state.careerSeed,
    season: state.season,
    week: state.week,
    sellingClubDivision: division,
  });
  return {
    playerId: player.id,
    marketValue: quote.valuation,
    forcedSaleFee: Math.max(1, Math.floor(quote.fee * 0.7)),
    discountPercent: BOARD_FORCED_SALE_DISCOUNT_PERCENT,
  };
}

function valuationPlayer(player: CareerPlayer): ValuationPlayer {
  return {
    id: player.id,
    role: player.role,
    attrs: player.attrs,
    age: player.age ?? 24,
    potential: player.potential ?? 3,
    ...(player.power === undefined
      ? {}
      : { power: player.power, powerTier: player.powerTier ?? 1 }),
    contractSeasonsRemaining: player.contractSeasonsRemaining,
  };
}

function canLeaveWithoutBreakingLineup(state: GameState, player: CareerPlayer): boolean {
  const lineup = userLineup(state);
  if (!lineup.playerIds.includes(player.id)) return true;
  const starterIds = new Set(lineup.playerIds);
  return state.players.some(candidate => (
    candidate.clubId === state.userClubId
    && candidate.id !== player.id
    && !starterIds.has(candidate.id)
    && isEligibleBoardLineupReplacement(candidate)
    && (candidate.role === player.role
      || (candidate.role !== 'GK' && player.role !== 'GK'))
  ));
}

function replaceDepartingStarter(
  state: GameState,
  player: CareerPlayer,
): GameState['lineups'] {
  const lineup = userLineup(state);
  if (!lineup.playerIds.includes(player.id)) return state.lineups;
  const starters = new Set(lineup.playerIds);
  const replacement = state.players.find(candidate => (
    candidate.clubId === state.userClubId
    && candidate.id !== player.id
    && !starters.has(candidate.id)
    && isEligibleBoardLineupReplacement(candidate)
    && candidate.role === player.role
  )) ?? state.players.find(candidate => (
    candidate.clubId === state.userClubId
    && candidate.id !== player.id
    && !starters.has(candidate.id)
    && isEligibleBoardLineupReplacement(candidate)
    && candidate.role !== 'GK'
    && player.role !== 'GK'
  ));
  if (replacement === undefined) {
    throw new Error('the board-sale player has no eligible lineup replacement');
  }
  return state.lineups.map(candidate => candidate.clubId === state.userClubId
    ? {
        ...candidate,
        playerIds: candidate.playerIds.map(id => id === player.id ? replacement.id : id),
      }
    : candidate);
}

function isEligibleBoardLineupReplacement(player: CareerPlayer): boolean {
  return player.contractSeasonsRemaining > 0
    && player.injuryWeeks === 0
    && !(player.power !== undefined && !player.licensed);
}

function userLineup(state: GameState) {
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  if (lineup === undefined) throw new Error('the user club has no lineup');
  return lineup;
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

function checkedSubtract(left: number, right: number, label: string): number {
  const result = left - right;
  if (!Number.isSafeInteger(result) || result < 0) throw new Error(`${label} is invalid`);
  return result;
}
