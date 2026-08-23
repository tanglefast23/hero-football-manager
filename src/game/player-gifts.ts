import { recordCashTransaction } from './cash-transactions';
import { LOW_MORALE_THRESHOLD, shouldWithdrawTransferRequest } from './pyramid';
import type { CareerPlayer, GameState } from './types';

export const PLAYER_GIFT_MORALE_GAIN = 20;
export const PLAYER_GIFT_WEEKLY_CLUB_LIMIT = 3;
export const PLAYER_GIFT_WAGE_WEEKS = 4;
export const LOW_MORALE_GIFT_TUTORIAL_ALERT_ID = 'low-morale-gift-tutorial';

const LOW_MORALE_GIFT_TUTORIAL_COMPLETE_FLAG =
  'guide:player-gift:low-morale-complete';
const LOW_MORALE_GIFT_TUTORIAL_TARGET_PREFIX =
  'guide:player-gift:low-morale-target:';

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

export function playerGiftCost(weeklyWage: number): number {
  if (!Number.isSafeInteger(weeklyWage) || weeklyWage < 0) {
    throw new Error('player weekly wage must be a non-negative safe integer');
  }
  const cost = weeklyWage * PLAYER_GIFT_WAGE_WEEKS;
  if (!Number.isSafeInteger(cost)) {
    throw new Error('player gift cost exceeds the safe integer range');
  }
  return cost;
}

export function playerGiftQuote(
  state: GameState,
  playerId: string,
): PlayerGiftQuote {
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined)
    throw new Error(`unknown user club ${state.userClubId}`);
  const player = userClubPlayer(state, playerId);
  if (player === undefined) {
    return {
      cost: 0,
      moraleGain: 0,
      clubGiftsRemaining: remainingClubGifts(state),
      blockedReason: 'PLAYER_NOT_AT_CLUB',
    };
  }

  const cost = playerGiftCost(player.weeklyWage);
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
  if (player === undefined)
    throw new Error('player gift blocked: PLAYER_NOT_AT_CLUB');

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
    amount: quote.cost === 0 ? 0 : -quote.cost,
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

export function lowMoraleGiftTutorialPlayerId(
  state: Pick<GameState, 'eventFlags'>,
): string | undefined {
  return state.eventFlags
    .find((flag) => flag.startsWith(LOW_MORALE_GIFT_TUTORIAL_TARGET_PREFIX))
    ?.slice(LOW_MORALE_GIFT_TUTORIAL_TARGET_PREFIX.length);
}

export function reconcileLowMoraleGiftTutorialTarget(
  state: GameState,
): GameState {
  const targetFlags = state.eventFlags.filter((flag) =>
    flag.startsWith(LOW_MORALE_GIFT_TUTORIAL_TARGET_PREFIX),
  );
  if (state.eventFlags.includes(LOW_MORALE_GIFT_TUTORIAL_COMPLETE_FLAG)) {
    return targetFlags.length === 0
      ? state
      : {
          ...state,
          eventFlags: state.eventFlags.filter(
            (flag) => !flag.startsWith(LOW_MORALE_GIFT_TUTORIAL_TARGET_PREFIX),
          ),
        };
  }

  const eligible = state.players.filter(
    (player) =>
      player.clubId === state.userClubId &&
      player.morale < LOW_MORALE_THRESHOLD &&
      player.transferRequested !== true,
  );
  const target = eligible.reduce<CareerPlayer | undefined>(
    (lowest, player) =>
      lowest === undefined || player.morale < lowest.morale ? player : lowest,
    undefined,
  );
  const targetFlag =
    target === undefined
      ? undefined
      : `${LOW_MORALE_GIFT_TUTORIAL_TARGET_PREFIX}${target.id}`;
  if (
    targetFlags.length === (targetFlag === undefined ? 0 : 1) &&
    targetFlags[0] === targetFlag
  ) {
    return state;
  }
  return {
    ...state,
    eventFlags: [
      ...state.eventFlags.filter(
        (flag) => !flag.startsWith(LOW_MORALE_GIFT_TUTORIAL_TARGET_PREFIX),
      ),
      ...(targetFlag === undefined ? [] : [targetFlag]),
    ],
  };
}

export function completeLowMoraleGiftTutorial(state: GameState): GameState {
  return {
    ...state,
    eventFlags: [
      ...state.eventFlags.filter(
        (flag) => !flag.startsWith(LOW_MORALE_GIFT_TUTORIAL_TARGET_PREFIX),
      ),
      ...(state.eventFlags.includes(LOW_MORALE_GIFT_TUTORIAL_COMPLETE_FLAG)
        ? []
        : [LOW_MORALE_GIFT_TUTORIAL_COMPLETE_FLAG]),
    ],
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
