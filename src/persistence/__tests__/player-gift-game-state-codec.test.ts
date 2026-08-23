import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import { givePlayerGift } from '../../game/player-gifts';
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
