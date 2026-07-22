import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

describe('training drill tier unlocks', () => {
  const content = loadLaunchContent();

  test('hides locked tiers and keeps earned tiers after relegation', () => {
    const divisionFive = createCareer(createLaunchCareerSetup(
      20260722,
      undefined,
      content,
      'full',
    ));
    const viewAt = (highestDivisionReached: 5 | 4 | 2) => squadTrainingViewModel(
      {
        ...divisionFive,
        trainingPoints: 100,
        m2: { ...divisionFive.m2!, highestDivisionReached },
      },
      content,
      undefined,
      [],
      [],
    );

    const tierOne = viewAt(5).drills.find(drill => drill.id === 'sprints')!;
    const tierTwoLocked = viewAt(5).drills.find(drill => drill.id === 'sprints-ii');
    const tierTwoEarned = viewAt(4).drills.find(drill => drill.id === 'sprints-ii')!;
    const tierThreeLocked = viewAt(4).drills.find(drill => drill.id === 'sprints-iii');
    const tierThreeEarned = viewAt(2).drills.find(drill => drill.id === 'sprints-iii')!;

    expect(tierOne.available).toBe(true);
    expect(tierOne.lockedReason).toBeUndefined();
    expect(tierTwoLocked).toBeUndefined();
    expect(tierTwoEarned.available).toBe(true);
    expect(tierTwoEarned.lockedReason).toBeUndefined();
    expect(tierThreeLocked).toBeUndefined();
    expect(tierThreeEarned.available).toBe(true);
    expect(tierThreeEarned.lockedReason).toBeUndefined();
  });

  test('totals Money per eligible trainee while charging TP once per drill', () => {
    const initial = createCareer(createLaunchCareerSetup(20260723, undefined, content, 'full'));
    const players = initial.players
      .filter(player => player.clubId === initial.userClubId)
      .slice(0, 2);
    const state = {
      ...initial,
      trainingPoints: 100,
      players: initial.players.map(player => players.some(trainee => trainee.id === player.id)
        ? {
            ...player,
            potential: 5 as const,
            potentialCeiling: 99,
            attrs: { ...player.attrs, pac: 20 },
          }
        : player),
    };
    const viewModel = squadTrainingViewModel(
      state,
      content,
      undefined,
      players.map(player => player.id),
      ['sprints'],
    );

    expect(viewModel).toMatchObject({
      totalMoneyCost: 800,
      totalTrainingPointCost: 10,
      canApply: true,
    });
  });

  it('hides division-locked drills instead of listing them greyed', () => {
    const state = createCareer(createLaunchCareerSetup(413, undefined, content, 'full'));
    const model = squadTrainingViewModel(state, content, undefined, [], []);

    expect(model.drills.length).toBeGreaterThan(0);
    expect(model.drills.every(drill => drill.lockedReason === undefined)).toBe(true);
    expect(model.drills.some(drill => drill.name.includes('II'))).toBe(false);
  });
});
