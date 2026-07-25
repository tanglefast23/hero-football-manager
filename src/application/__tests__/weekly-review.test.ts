import {
  advanceWeek,
  BASE_WEEKLY_TRAINING_POINTS,
  buildCareerFacility,
  completeMatchday,
  createCareer,
  fixturesForCurrentWeek,
  type GameState,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { weeklyReviewViewModel } from '../view-models';

describe('weekly review view model', () => {
  it('reports the settled money and TP movement with no development section', () => {
    const before = createCareer(createLaunchCareerSetup(1234));

    const after = advanceWeek(before);
    const review = weeklyReviewViewModel(before, after);

    expect(review).toMatchObject({
      completedWeekLabel: 'Week 1 complete',
      nextWeekLabel: 'Week 2',
      cashBefore: requireUserClub(before).cash,
      cashAfter: requireUserClub(after).cash,
      netAmount: requireUserClub(after).cash - requireUserClub(before).cash,
      trainingPointsBefore: before.trainingPoints,
      trainingPointsAfter: after.trainingPoints,
      netTrainingPoints: after.trainingPoints - before.trainingPoints,
    });
    expect(review.ledger.some(line => line.label === 'Weekly wages')).toBe(true);
    // Drills resolve instantly in the popup now; the review carries no
    // training results section at all.
    expect(review).not.toHaveProperty('development');
  });

  it('includes only applicable recovery and upcoming-fixture notices', () => {
    const initial = createCareer(createLaunchCareerSetup(5678));
    const injuredId = 'bramble-rovers-p13';
    const before: GameState = {
      ...initial,
      week: 4,
      fixtures: initial.fixtures.map(fixture => fixture.week <= 4
        ? { ...fixture, status: 'played' as const, score: { homeGoals: 0, awayGoals: 0 } }
        : fixture),
      players: initial.players.map(player => player.id === injuredId
        ? { ...player, injuryWeeks: 1 }
        : player),
    };

    // Season-1 league rounds now start in week 3, so week 4 is a matchday
    // that must be played before the weekly ledger settles.
    let after = advanceWeek(before);
    if (after.phase === 'matchday') {
      after = completeMatchday(after, fixturesForCurrentWeek(after).map(fixture => ({
        fixtureId: fixture.id,
        homeGoals: 0,
        awayGoals: 0,
      })));
    }
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

  it('celebrates the first Training Pitch without paying TP before it opens', () => {
    const fresh = createCareer(createLaunchCareerSetup(5680));
    const started = buildCareerFacility(fresh, 'training-pitch', { x: 5, y: 1 }).state;
    // The pitch now takes two weeks: no completion after the first settlement.
    const before = advanceWeek(started);
    expect(weeklyReviewViewModel(started, before).facilityCompletion).toBeUndefined();
    const after = advanceWeek(before);
    const review = weeklyReviewViewModel(before, after);

    // The pitch itself pays nothing until it opens; the club's unconditional
    // baseline still lands in both build weeks.
    expect(after.trainingPoints).toBe(started.trainingPoints + BASE_WEEKLY_TRAINING_POINTS * 2);
    expect(review.netTrainingPoints).toBe(BASE_WEEKLY_TRAINING_POINTS);
    expect(review.facilityCompletion).toEqual({
      type: 'training-pitch',
      name: 'Training Pitch',
      level: 1,
      kind: 'BUILD',
    });
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

  // "uses the real facility and coach TP when explaining an unfunded plan" was
  // deleted: it relied on a per-trainee training MONEY cost (400) to make the
  // plan unaffordable despite ample TP. Training money is always 0 now, and
  // every path's TP cost is tiny next to any real facility/coach TP income, so
  // there is no way to reconstruct a genuine "affordable TP-wise, not
  // cash-wise" shortfall — the mechanism this case tested is gone.
});

function requireUserClub(state: GameState) {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error('test career is missing the user club');
  return club;
}
