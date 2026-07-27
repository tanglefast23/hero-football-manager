import { loadLaunchContent } from '../../content';
import { TRAINING_PATHS, createCareer, resolveTrainingDrillForPath } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

describe('training drill tier unlocks', () => {
  const content = loadLaunchContent();

  test('shows the best unlocked tier for a stat option and updates it as the club is promoted', () => {
    const divisionFive = createCareer(createLaunchCareerSetup(
      20260722,
      undefined,
      content,
    ));
    const player = divisionFive.players.find(candidate => candidate.clubId === divisionFive.userClubId)!;
    const optionAt = (highestDivisionReached: 5 | 4 | 2) => squadTrainingViewModel(
      {
        ...divisionFive,
        trainingPoints: 100,
        m2: { ...divisionFive.m2!, highestDivisionReached },
      },
      content,
      player.id,
    ).selectedPlayerStatOptions?.find(option => option.pathId === 'sprints');

    // Tier II is unlocked from the D5 start, alongside level-2 facilities.
    expect(optionAt(5)).toMatchObject({ drillName: 'Sprints 1' });
    // The first promotion is the upgrade, and it holds for the rest of the climb.
    expect(optionAt(4)).toMatchObject({ drillName: 'Sprints 2' });
    expect(optionAt(2)).toMatchObject({ drillName: 'Sprints 2' });
  });

  test('marks a stat option unaffordable when the bank cannot cover one tap', () => {
    const initial = createCareer(createLaunchCareerSetup(20260723, undefined, content));
    const player = initial.players.find(candidate => candidate.clubId === initial.userClubId)!;
    const sprints = resolveTrainingDrillForPath(initial, 'sprints');

    const funded = squadTrainingViewModel(
      { ...initial, trainingPoints: sprints.tpCost },
      content,
      player.id,
    ).selectedPlayerStatOptions?.find(option => option.pathId === 'sprints');
    const broke = squadTrainingViewModel(
      { ...initial, trainingPoints: sprints.tpCost - 1 },
      content,
      player.id,
    ).selectedPlayerStatOptions?.find(option => option.pathId === 'sprints');

    expect(funded?.affordable).toBe(true);
    expect(broke?.affordable).toBe(false);
  });

  it('resolves every stat path to its currently unlocked tier, never a locked one', () => {
    const state = createCareer(createLaunchCareerSetup(413, undefined, content));
    const player = state.players.find(candidate => candidate.clubId === state.userClubId)!;
    // Drill names end with their tier ("Sprints 2"), so the last word is the tier.
    const drillTiersAt = (highestDivisionReached: 5 | 2): readonly string[] => (
      squadTrainingViewModel(
        {
          ...state,
          trainingPoints: 100,
          m2: { ...state.m2!, highestDivisionReached },
        },
        content,
        player.id,
      ).selectedPlayerStatOptions ?? []
    ).map(option => option.drillName.replace(/^.* /, ''));

    // Role filtering hides one path (GK loses Finishing, outfield loses Keeper Drills).
    const unlockedPathCount = TRAINING_PATHS.length - 1;
    expect(squadTrainingViewModel(state, content, player.id).selectedPlayerStatOptions)
      .toHaveLength(unlockedPathCount);
    // One rung per promotion: the starting division offers tier 1, and the
    // first promotion upgrades every path at once.
    expect(drillTiersAt(5)).toEqual(Array.from({ length: unlockedPathCount }, () => '1'));
    expect(drillTiersAt(4)).toEqual(Array.from({ length: unlockedPathCount }, () => '2'));
  });
});
