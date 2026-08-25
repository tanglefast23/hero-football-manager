import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import {
  PLAYER_GIFT_WEEKLY_CLUB_LIMIT,
  completeLowMoraleGiftTutorial,
  givePlayerGift,
  lowMoraleGiftTutorialPlayerId,
  playerGiftCost,
  playerGiftQuote,
  reconcileLowMoraleGiftTutorialTarget,
} from '../player-gifts';
import type { CareerPlayer, GameState } from '../types';

function richCareer(seed = 71): GameState {
  const state = createCareer(createLaunchCareerSetup(seed));
  return {
    ...state,
    clubs: state.clubs.map((club) =>
      club.id === state.userClubId ? { ...club, cash: 1_000_000 } : club,
    ),
  };
}

function roster(state: GameState): CareerPlayer[] {
  return state.players.filter((player) => player.clubId === state.userClubId);
}

function replacePlayer(
  state: GameState,
  playerId: string,
  update: Partial<CareerPlayer>,
): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, ...update } : player,
    ),
  };
}

describe('player gifts', () => {
  test('prices every gift at four current weekly wages', () => {
    expect(playerGiftCost(500)).toBe(2_000);
    expect(playerGiftCost(0)).toBe(0);
  });

  test('charges once, adds morale once, and records localized transaction data', () => {
    const initial = richCareer();
    const player = roster(initial)[0]!;
    const before = replacePlayer(initial, player.id, { morale: 61 });
    const cashBefore = before.clubs.find(
      (club) => club.id === before.userClubId,
    )!.cash;

    const result = givePlayerGift(before, player.id);
    const afterPlayer = result.state.players.find(
      (candidate) => candidate.id === player.id,
    )!;
    const transaction = result.state.cashTransactions!.at(-1)!;

    expect(afterPlayer.morale).toBe(81);
    expect(result.moraleGain).toBe(20);
    expect(result).not.toHaveProperty('transferRequestOutcome');
    expect(transaction).toMatchObject({
      kind: 'player-gift',
      label: `Gift for ${player.name}`,
      labelKey: 'playerGift.transaction',
      labelParams: { player: player.name, amount: result.cost },
      amount: -result.cost,
      balanceAfter: cashBefore - result.cost,
      referenceId: player.id,
      season: before.season,
      week: before.week,
    });
  });

  test('shows and applies the actual capped gain', () => {
    const initial = richCareer();
    const player = roster(initial)[0]!;
    const before = replacePlayer(initial, player.id, { morale: 98 });

    expect(playerGiftQuote(before, player.id).moraleGain).toBe(2);
    expect(givePlayerGift(before, player.id).moraleAfter).toBe(100);
  });

  test('records and limits a free gift for a zero-wage player', () => {
    const initial = richCareer();
    const players = roster(initial);
    let state = replacePlayer(initial, players[0]!.id, { weeklyWage: 0 });

    state = givePlayerGift(state, players[0]!.id).state;

    expect(state.cashTransactions?.at(-1)).toMatchObject({
      kind: 'player-gift',
      amount: 0,
      referenceId: players[0]!.id,
    });
    expect(playerGiftQuote(state, players[0]!.id).blockedReason).toBe(
      'ALREADY_GIFTED',
    );
    expect(playerGiftQuote(state, players[1]!.id).clubGiftsRemaining).toBe(2);
  });

  test.each([
    ['MORALE_FULL', { morale: 100 }],
    ['PLAYER_NOT_AT_CLUB', { clubId: 'another-club' }],
  ] as const)('%s rejects without changing state', (reason, update) => {
    const initial = richCareer();
    const player = roster(initial)[0]!;
    const before = replacePlayer(initial, player.id, update);
    const snapshot = JSON.stringify(before);

    expect(playerGiftQuote(before, player.id).blockedReason).toBe(reason);
    expect(() => givePlayerGift(before, player.id)).toThrow(reason);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  test('rejects insufficient cash without changing the input', () => {
    const initial = richCareer();
    const player = roster(initial)[0]!;
    const before: GameState = {
      ...initial,
      clubs: initial.clubs.map((club) =>
        club.id === initial.userClubId ? { ...club, cash: 0 } : club,
      ),
    };
    const snapshot = JSON.stringify(before);

    expect(playerGiftQuote(before, player.id).blockedReason).toBe(
      'NOT_ENOUGH_CASH',
    );
    expect(() => givePlayerGift(before, player.id)).toThrow('NOT_ENOUGH_CASH');
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  test('allows one gift per player and three gifts per club each week', () => {
    let state = richCareer();
    const players = roster(state).slice(0, PLAYER_GIFT_WEEKLY_CLUB_LIMIT + 1);

    state = givePlayerGift(state, players[0]!.id).state;
    expect(playerGiftQuote(state, players[0]!.id).blockedReason).toBe(
      'ALREADY_GIFTED',
    );
    state = givePlayerGift(state, players[1]!.id).state;
    state = givePlayerGift(state, players[2]!.id).state;
    const fourth = playerGiftQuote(state, players[3]!.id);
    expect(fourth.clubGiftsRemaining).toBe(0);
    expect(fourth.blockedReason).toBe('CLUB_LIMIT_REACHED');
  });

  test('uses the canonical withdrawal line and preserves the low-morale streak', () => {
    const initial = richCareer();
    const player = roster(initial)[0]!;
    const below = replacePlayer(initial, player.id, {
      morale: 12,
      personality: 'Professional',
      transferRequested: true,
      consecutiveLowMoraleWeeks: 7,
    });
    const belowAfter = givePlayerGift(below, player.id).state.players.find(
      (candidate) => candidate.id === player.id,
    )!;
    expect(belowAfter.transferRequested).toBe(true);
    expect(belowAfter.consecutiveLowMoraleWeeks).toBe(7);

    const crossing = replacePlayer(initial, player.id, {
      morale: 24,
      personality: undefined,
      transferRequested: true,
      consecutiveLowMoraleWeeks: 9,
    });
    const crossingAfter = givePlayerGift(
      crossing,
      player.id,
    ).state.players.find((candidate) => candidate.id === player.id)!;
    expect(crossingAfter.transferRequested).toBe(false);
    expect(crossingAfter.consecutiveLowMoraleWeeks).toBe(9);
  });

  test.each([
    ['below', 'Fiery', 24, 'STILL_ACTIVE', 45],
    ['exact', 'Fiery', 25, 'WITHDRAWN', undefined],
    ['above', 'Fiery', 26, 'WITHDRAWN', undefined],
    ['greedy 25 to 45', 'Greedy', 25, 'STILL_ACTIVE', 50],
  ] as const)(
    'reports the transfer-request outcome at %s threshold',
    (_case, personality, morale, status, moraleTarget) => {
      const initial = richCareer();
      const player = roster(initial)[0]!;
      const before = replacePlayer(initial, player.id, {
        morale,
        personality,
        transferRequested: true,
      });

      const result = givePlayerGift(before, player.id);

      expect(result.transferRequestOutcome).toEqual(
        status === 'WITHDRAWN' ? { status } : { status, moraleTarget },
      );
      expect(
        result.state.players.find((candidate) => candidate.id === player.id)
          ?.transferRequested,
      ).toBe(status !== 'WITHDRAWN');
    },
  );

  test('is deterministic for the same state and player', () => {
    const initial = richCareer(97);
    const player = roster(initial)[0]!;
    expect(givePlayerGift(initial, player.id)).toEqual(
      givePlayerGift(initial, player.id),
    );
  });

  test('targets the lowest eligible low-morale player and retargets stale alerts', () => {
    const initial = richCareer();
    const players = roster(initial);
    const low = players[2]!;
    const tiedLater = players[3]!;
    const ready = {
      ...initial,
      players: initial.players.map((player) =>
        player.clubId !== initial.userClubId
          ? player
          : {
              ...player,
              morale:
                player.id === low.id || player.id === tiedLater.id ? 17 : 50,
            },
      ),
    };

    const targeted = reconcileLowMoraleGiftTutorialTarget(ready);
    expect(lowMoraleGiftTutorialPlayerId(targeted)).toBe(low.id);
    expect(reconcileLowMoraleGiftTutorialTarget(targeted)).toBe(targeted);

    const stale = {
      ...targeted,
      players: targeted.players.map((player) =>
        player.id === low.id ? { ...player, transferRequested: true } : player,
      ),
    };
    expect(
      lowMoraleGiftTutorialPlayerId(
        reconcileLowMoraleGiftTutorialTarget(stale),
      ),
    ).toBe(tiedLater.id);
  });

  test('never targets another player after the tutorial completes', () => {
    const initial = richCareer();
    const player = roster(initial)[0]!;
    const low = replacePlayer(initial, player.id, { morale: 10 });
    const completed = completeLowMoraleGiftTutorial(
      reconcileLowMoraleGiftTutorialTarget(low),
    );

    expect(lowMoraleGiftTutorialPlayerId(completed)).toBeUndefined();
    expect(
      lowMoraleGiftTutorialPlayerId(
        reconcileLowMoraleGiftTutorialTarget(completed),
      ),
    ).toBeUndefined();
  });

  test('does not target a player at exactly 30 morale', () => {
    const initial = richCareer();
    const player = roster(initial)[0]!;
    const boundary = {
      ...initial,
      players: initial.players.map((candidate) =>
        candidate.clubId !== initial.userClubId
          ? candidate
          : { ...candidate, morale: candidate.id === player.id ? 30 : 50 },
      ),
    };

    expect(
      lowMoraleGiftTutorialPlayerId(
        reconcileLowMoraleGiftTutorialTarget(boundary),
      ),
    ).toBeUndefined();
  });
});
