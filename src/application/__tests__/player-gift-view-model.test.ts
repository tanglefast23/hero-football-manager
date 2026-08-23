import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game/career';
import { givePlayerGift } from '../../game/player-gifts';
import { copyFor, type Locale } from '../../i18n';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

test('the Player File shows the exact gift cost, gain, limit, and blocker', () => {
  const content = loadLaunchContent();
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
  const before = squadTrainingViewModel(rich, content, player.id);

  expect(before.selectedPlayerGift).toEqual({
    cost: player.weeklyWage,
    moraleGain: Math.min(5, 100 - player.morale),
    clubGiftsRemaining: 3,
  });

  const gifted = givePlayerGift(rich, player.id).state;
  expect(
    squadTrainingViewModel(gifted, content, player.id).selectedPlayerGift
      ?.blockedReason,
  ).toBe('This player already received a gift this week.');
});

test.each([
  ['en', '1 club gift left this week'],
  ['de', 'Diese Woche bleibt 1 Vereinsgeschenk'],
  ['es', 'Queda 1 regalo del club esta semana'],
  ['fr', 'Encore 1 cadeau cette semaine'],
  ['id', 'Tersisa 1 hadiah klub minggu ini'],
  ['pt-BR', 'Resta 1 presente nesta semana'],
  ['vi', 'Còn 1 lượt tặng quà tuần này'],
] as const)('uses the singular gift count in %s', (locale, expected) => {
  expect(
    copyFor(locale as Locale)('playerGift.remaining', { n: 1, count: 1 }),
  ).toBe(expected);
});
