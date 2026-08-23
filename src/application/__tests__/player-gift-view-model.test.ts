import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game/career';
import { givePlayerGift } from '../../game/player-gifts';
import { copyFor, type Locale } from '../../i18n';
import { createLaunchCareerSetup } from '../launch';
import {
  homeViewModel,
  reconcileHomeAssistantInbox,
  squadTrainingViewModel,
} from '../view-models';

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
    cost: player.weeklyWage * 4,
    moraleGain: Math.min(20, 100 - player.morale),
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

test.each(['teacher', 'advisor'] as const)(
  'shows the persistent low-morale Gift alert in %s mode',
  (assistantMode) => {
    const base = createCareer(createLaunchCareerSetup(20260826));
    const player = base.players.find(
      (candidate) => candidate.clubId === base.userClubId,
    )!;
    const low = {
      ...base,
      assistantMode,
      players: base.players.map((candidate) =>
        candidate.clubId !== base.userClubId
          ? candidate
          : { ...candidate, morale: candidate.id === player.id ? 12 : 50 },
      ),
    };
    const reconciled = reconcileHomeAssistantInbox(low);
    const alert = homeViewModel(reconciled).alerts.find(
      (candidate) => candidate.id === 'low-morale-gift-tutorial',
    );

    expect(alert).toMatchObject({
      title: 'A PLAYER IS UNHAPPY',
      detail: `${player.name}'s morale is below 30. Raise it soon or they may ask for a transfer.`,
      tone: 'urgent',
      destination: 'squad',
      playerId: player.id,
    });
    expect(reconcileHomeAssistantInbox(reconciled)).toBe(reconciled);
  },
);
