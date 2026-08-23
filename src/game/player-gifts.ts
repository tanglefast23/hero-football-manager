import { recordCashTransaction } from './cash-transactions';
import { currentUserDivision } from './m2-career';
import { managementMoneyDivisionMultiplier } from './player-requests';
import { shouldWithdrawTransferRequest } from './pyramid';
import type { CareerPlayer, GameState } from './types';

export const PLAYER_GIFT_MORALE_GAIN = 5;
export const PLAYER_GIFT_WEEKLY_CLUB_LIMIT = 3;
export const PLAYER_GIFT_MINIMUM_COST = 50;

export type PlayerGiftBlockedReason =
  | 'PLAYER_NOT_AT_CLUB'
  | 'MORALE_FULL'
  | 'ALREADY_GIFTED'
  | 'CLUB_LIMIT_REACHED'
  | 'NOT_ENOUGH_CASH';

export interface PlayerGiftQuote {
  readonly cost: number;
  readonly moraleGain: number;
  readonly clubGiftsRemaining: number;
  readonly blockedReason?: PlayerGiftBlockedReason;
}

export interface PlayerGiftResult {
  readonly state: GameState;
  readonly playerId: string;
  readonly cost: number;
  readonly moraleGain: number;
  readonly moraleAfter: number;
}

export function playerGiftCost(weeklyWage: number, division: number): number {
  if (!Number.isSafeInteger(weeklyWage) || weeklyWage < 0) {
    throw new Error('player weekly wage must be a non-negative safe integer');
  }
  const base = Math.max(PLAYER_GIFT_MINIMUM_COST, weeklyWage);
  const cost = base * managementMoneyDivisionMultiplier(division);
  if (!Number.isSafeInteger(cost)) {
    throw new Error('player gift cost exceeds the safe integer range');
  }
  return cost;
}

export function playerGiftQuote(
  state: GameState,
  playerId: string,
): PlayerGiftQuote {
  const club = state.clubs.find((candidate) => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  const player = userClubPlayer(state, playerId);
  if (player === undefined) {
    return {
      cost: 0,
      moraleGain: 0,
      clubGiftsRemaining: remainingClubGifts(state),
      blockedReason: 'PLAYER_NOT_AT_CLUB',
    };
  }

  const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
  const cost = playerGiftCost(player.weeklyWage, division);
  const moraleGain = Math.min(PLAYER_GIFT_MORALE_GAIN, 100 - player.morale);
  const gifts = currentWeekGifts(state);
  const playerGifted = gifts.some(
    (transaction) => transaction.referenceId === playerId,
  );
  const clubGiftsRemaining = Math.max(
    0,
    PLAYER_GIFT_WEEKLY_CLUB_LIMIT - gifts.length,
  );
  const blockedReason =
    moraleGain === 0
      ? 'MORALE_FULL'
      : playerGifted
        ? 'ALREADY_GIFTED'
        : clubGiftsRemaining === 0
          ? 'CLUB_LIMIT_REACHED'
          : club.cash < cost
            ? 'NOT_ENOUGH_CASH'
            : undefined;

  return {
    cost,
    moraleGain,
    clubGiftsRemaining,
    ...(blockedReason === undefined ? {} : { blockedReason }),
  };
}

export function givePlayerGift(
  state: GameState,
  playerId: string,
): PlayerGiftResult {
  const quote = playerGiftQuote(state, playerId);
  if (quote.blockedReason !== undefined) {
    throw new Error(`player gift blocked: ${quote.blockedReason}`);
  }
  const player = userClubPlayer(state, playerId);
  if (player === undefined) throw new Error('player gift blocked: PLAYER_NOT_AT_CLUB');

  const moraleAfter = player.morale + quote.moraleGain;
  const players = state.players.map((candidate) => {
    if (candidate.id !== playerId || candidate.clubId !== state.userClubId) {
      return candidate;
    }
    const transferRequested =
      candidate.transferRequested === true &&
      shouldWithdrawTransferRequest({
        morale: moraleAfter,
        condition: candidate.condition ?? 100,
        personality: candidate.personality ?? 'Professional',
        consecutiveLowMoraleWeeks: candidate.consecutiveLowMoraleWeeks ?? 0,
      })
        ? false
        : candidate.transferRequested;
    return { ...candidate, morale: moraleAfter, transferRequested };
  });
  const charged: GameState = {
    ...state,
    players,
    clubs: state.clubs.map((club) =>
      club.id === state.userClubId
        ? { ...club, cash: club.cash - quote.cost }
        : club,
    ),
  };
  const recorded = recordCashTransaction(charged, {
    kind: 'player-gift',
    label: `Gift for ${player.name}`,
    labelKey: 'playerGift.transaction',
    labelParams: { player: player.name, amount: quote.cost },
    amount: -quote.cost,
    referenceId: playerId,
  });

  return {
    state: recorded,
    playerId,
    cost: quote.cost,
    moraleGain: quote.moraleGain,
    moraleAfter,
  };
}

function currentWeekGifts(state: GameState) {
  return (state.cashTransactions ?? []).filter(
    (transaction) =>
      transaction.kind === 'player-gift' &&
      transaction.season === state.season &&
      transaction.week === state.week,
  );
}

function remainingClubGifts(state: GameState): number {
  return Math.max(
    0,
    PLAYER_GIFT_WEEKLY_CLUB_LIMIT - currentWeekGifts(state).length,
  );
}

function userClubPlayer(
  state: GameState,
  playerId: string,
): CareerPlayer | undefined {
  return state.players.find(
    (player) => player.id === playerId && player.clubId === state.userClubId,
  );
}
