import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import {
  givePlayerGift,
  lowMoraleGiftTutorialPlayerId,
  reconcileLowMoraleGiftTutorialTarget,
} from '../../game/player-gifts';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

test('round-trips the full player gift receipt', () => {
  const base = createCareer(createLaunchCareerSetup(20260823));
  const player = base.players.find(
    (candidate) => candidate.clubId === base.userClubId,
  )!;
  const rich = {
    ...base,
    clubs: base.clubs.map((club) =>
      club.id === base.userClubId ? { ...club, cash: 1_000_000 } : club,
    ),
  };
  const gifted = givePlayerGift(rich, player.id).state;

  expect(parseStoredGameState(serializeGameState(gifted))).toEqual(gifted);
  expect(gifted.cashTransactions?.at(-1)).toMatchObject({
    kind: 'player-gift',
    labelKey: 'playerGift.transaction',
    labelParams: { player: player.name },
    referenceId: player.id,
  });
});

test('round-trips a free gift receipt for a zero-wage player', () => {
  const base = createCareer(createLaunchCareerSetup(20260824));
  const player = base.players.find(
    (candidate) => candidate.clubId === base.userClubId,
  )!;
  const ready = {
    ...base,
    players: base.players.map((candidate) =>
      candidate.id === player.id ? { ...candidate, weeklyWage: 0 } : candidate,
    ),
  };
  const gifted = givePlayerGift(ready, player.id).state;

  expect(gifted.cashTransactions?.at(-1)?.amount).toBe(0);
  expect(parseStoredGameState(serializeGameState(gifted))).toEqual(gifted);
});

test('round-trips the pending low-morale tutorial target', () => {
  const base = createCareer(createLaunchCareerSetup(20260825));
  const player = base.players.find(
    (candidate) => candidate.clubId === base.userClubId,
  )!;
  const targeted = reconcileLowMoraleGiftTutorialTarget({
    ...base,
    players: base.players.map((candidate) =>
      candidate.id === player.id ? { ...candidate, morale: 12 } : candidate,
    ),
  });
  const restored = parseStoredGameState(serializeGameState(targeted));

  expect(lowMoraleGiftTutorialPlayerId(restored)).toBe(player.id);
  expect(restored).toEqual(targeted);
});
