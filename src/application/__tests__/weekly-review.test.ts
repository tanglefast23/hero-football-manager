import { loadLaunchContent } from '../../content';
import {
  advanceWeek,
  applyCareerTraining,
  buildCareerFacility,
  createCareer,
  playerAttributeCaps,
  resolveTrainingDrillForPath,
  type GameState,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { weeklyReviewViewModel } from '../view-models';

describe('weekly review view model', () => {
  it('reports exact focused gains and the settled money movement', () => {
    const content = loadLaunchContent();
    const sprint = content.training.focusDrills.find(drill => drill.id === 'sprints')!;
    let before = createCareer(createLaunchCareerSetup(1234));
    // p12 has PAC headroom under this seed (p13's is already at its archetype
    // cap); the m1-slice career has no tier gating, so the slot always trains
    // at the highest unlocked tier (Sprints III, +8 PAC).
    const playerId = 'bramble-rovers-p12';
    before = applyCareerTraining(before, [{ playerId, pathId: sprint.id }]);
    const playerBefore = before.players.find(player => player.id === playerId)!;

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
    expect(review.development.focusedTrainees).toHaveLength(1);
    expect(review.development.focusedTrainees[0].gains).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'PAC',
        before: playerBefore.attrs.pac,
        after: playerBefore.attrs.pac + 8,
        delta: 8,
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

  it('celebrates the first Training Pitch and shows its immediate 10 TP reward', () => {
    const fresh = createCareer(createLaunchCareerSetup(5680, undefined, undefined, 'full'));
    const before = buildCareerFacility(fresh, 'training-pitch', { x: 5, y: 1 }).state;
    const after = advanceWeek(before);
    const review = weeklyReviewViewModel(before, after);

    expect(after.trainingPoints).toBe(before.trainingPoints + 10);
    expect(review.netTrainingPoints).toBe(10);
    expect(review.facilityCompletion).toEqual({
      type: 'training-pitch',
      name: 'Training Pitch',
      level: 1,
      kind: 'BUILD',
      trainingPointReward: 10,
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

  it('names a fully capped drill instead of reporting a funding failure', () => {
    const content = loadLaunchContent();
    const sprint = content.training.focusDrills.find(drill => drill.id === 'sprints')!;
    const initial = createCareer(createLaunchCareerSetup(6790));
    const player = initial.players.find(candidate => candidate.clubId === initial.userClubId)!;
    const cap = playerAttributeCaps(player).pac;
    const capped: GameState = {
      ...initial,
      players: initial.players.map(candidate => candidate.id === player.id
        ? { ...candidate, attrs: { ...candidate.attrs, pac: cap } }
        : candidate),
    };
    const before = applyCareerTraining(capped, [{ playerId: player.id, pathId: sprint.id }]);
    const drill = resolveTrainingDrillForPath(before, sprint.id);
    const drillName = content.training.focusDrills.find(candidate => candidate.id === drill.id)?.name ?? drill.id;
    const after = advanceWeek(before);
    const review = weeklyReviewViewModel(before, after);

    expect(after.trainingPoints).toBe(before.trainingPoints);
    expect(review.development).toMatchObject({
      focusedTrainees: [],
      trainingSkippedWarning: `${player.name} skipped ${drillName} — already at their PAC maximum of ${cap}.`,
    });
    expect(after.ledgers[0].lines.some(line => line.kind === 'training')).toBe(false);
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
