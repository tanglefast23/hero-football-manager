import { loadLaunchContent } from '../../content';
import {
  advanceWeek,
  applyCareerTraining,
  createCareer,
  type GameState,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { weeklyReviewViewModel } from '../view-models';

describe('weekly review view model', () => {
  it('reports exact focused gains and the settled money movement', () => {
    const content = loadLaunchContent();
    const sprint = content.training.focusDrills.find(drill => drill.id === 'sprints')!;
    let before = createCareer(createLaunchCareerSetup(1234));
    const playerId = 'bramble-rovers-p13';
    before = applyCareerTraining(before, [playerId], [sprint]);
    const playerBefore = before.players.find(player => player.id === playerId)!;

    const after = advanceWeek(before);
    const review = weeklyReviewViewModel(before, after);

    expect(review).toMatchObject({
      completedWeekLabel: 'Week 1 complete',
      nextWeekLabel: 'Week 2',
      cashBefore: requireUserClub(before).cash,
      cashAfter: requireUserClub(after).cash,
      netAmount: requireUserClub(after).cash - requireUserClub(before).cash,
    });
    expect(review.ledger.some(line => line.label === 'Weekly wages')).toBe(true);
    expect(review.development.focusedTrainees).toHaveLength(1);
    expect(review.development.focusedTrainees[0].gains).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'PAC',
        before: playerBefore.attrs.pac,
        after: playerBefore.attrs.pac + 3,
        delta: 3,
      }),
    ]));
    expect(review.development.conditioning).toEqual(expect.arrayContaining([
      expect.objectContaining({ attributeLabel: 'STA', gain: 1 }),
    ]));
  });

  it('includes only applicable recovery and upcoming-fixture notices', () => {
    const initial = createCareer(createLaunchCareerSetup(5678));
    const injuredId = 'bramble-rovers-p13';
    const before: GameState = {
      ...initial,
      week: 4,
      players: initial.players.map(player => player.id === injuredId
        ? { ...player, injuryWeeks: 1 }
        : player),
    };

    const after = advanceWeek(before);
    const review = weeklyReviewViewModel(before, after);

    expect(review.nextWeekLabel).toBe('Week 5');
    expect(review.nextFixture?.weekLabel).toBe('W5');
    expect(review.updates).toContainEqual(expect.objectContaining({
      id: `injury-${injuredId}`,
      title: expect.stringContaining('cleared to play'),
    }));
    expect(review.updates.some(update => update.id.startsWith('contract-'))).toBe(false);
    expect(review.updates.some(update => update.id.startsWith('event-'))).toBe(false);
  });

  it('announces a new injury and names the automatic Starting XI replacement', () => {
    const before = createCareer(createLaunchCareerSetup(6789));
    const beforeLineup = before.lineups.find(lineup => lineup.clubId === before.userClubId)!;
    const injuredId = beforeLineup.playerIds[1];
    const injuredPlayer = before.players.find(player => player.id === injuredId)!;
    const replacement = before.players.find(player => (
      player.clubId === before.userClubId
      && player.role === injuredPlayer.role
      && !beforeLineup.playerIds.includes(player.id)
      && player.power === undefined
    ))!;
    const settled = advanceWeek(before);
    const after: GameState = {
      ...settled,
      players: settled.players.map(player => player.id === injuredId
        ? { ...player, injuryWeeks: 4 }
        : player),
      lineups: settled.lineups.map(lineup => lineup.clubId === settled.userClubId
        ? {
            ...lineup,
            playerIds: lineup.playerIds.map(playerId => playerId === injuredId ? replacement.id : playerId),
          }
        : lineup),
    };

    const review = weeklyReviewViewModel(before, after);

    expect(review.updates).toContainEqual({
      id: `injury-${injuredId}`,
      title: `${injuredPlayer.name} ruled out`,
      detail: `OUT · 4 WEEKS. ${replacement.name} has moved into the Starting XI.`,
      tone: 'warning',
    });
  });
});

function requireUserClub(state: GameState) {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error('test career is missing the user club');
  return club;
}
