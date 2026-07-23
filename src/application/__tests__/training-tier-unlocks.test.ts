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
      'full',
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
      [],
    ).selectedPlayerStatOptions?.find(option => option.pathId === 'sprints');

    expect(optionAt(5)).toMatchObject({ drillName: 'Sprints I' });
    expect(optionAt(4)).toMatchObject({ drillName: 'Sprints II' });
    expect(optionAt(2)).toMatchObject({ drillName: 'Sprints III' });
  });

  test('charges TP once per slot, independent of how many trainees share a stat', () => {
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
    const slots = players.map(player => ({ playerId: player.id, pathId: 'sprints' }));
    const sprints = resolveTrainingDrillForPath(state, 'sprints');

    const viewModel = squadTrainingViewModel(state, content, undefined, slots);

    expect(viewModel.weeklyTrainingPointCost).toBe(sprints.tpCost * players.length);
  });

  it('resolves every stat path to its currently unlocked tier, never a locked one', () => {
    const state = createCareer(createLaunchCareerSetup(413, undefined, content, 'full'));
    const player = state.players.find(candidate => candidate.clubId === state.userClubId)!;
    const model = squadTrainingViewModel(state, content, player.id, []);

    expect(model.selectedPlayerStatOptions).toHaveLength(TRAINING_PATHS.length - 1);
    expect(model.selectedPlayerStatOptions?.every(option => !option.drillName.includes('II'))).toBe(true);
  });
});
