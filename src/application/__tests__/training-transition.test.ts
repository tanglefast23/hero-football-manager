import { loadLaunchContent } from '../../content';
import { createCareer, setCareerTrainingPlan } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { trainingTransitionScene } from '../training-transition';

describe('training transition scene', () => {
  const content = loadLaunchContent();

  it('shows the assigned players across their training paths', () => {
    const initial = {
      ...createCareer(createLaunchCareerSetup(123)),
      trainingPoints: 100,
    };
    const state = setCareerTrainingPlan(initial, [
      { playerId: 'bramble-rovers-p01', pathId: 'sprints' },
      { playerId: 'bramble-rovers-p02', pathId: 'finishing' },
      { playerId: 'bramble-rovers-p03', pathId: 'rondo' },
    ]);

    expect(trainingTransitionScene(state, content)).toMatchObject({
      mode: 'plan',
      drillLabels: ['Sprints 3', 'Finishing 3', 'Rondo 3'],
      participants: [
        { playerId: 'bramble-rovers-p01', activityId: 'sprints' },
        { playerId: 'bramble-rovers-p02', activityId: 'finishing' },
        { playerId: 'bramble-rovers-p03', activityId: 'rondo' },
      ],
    });
  });

  it('uses generic ball work when no focus plan is active', () => {
    const state = createCareer(createLaunchCareerSetup(456));

    expect(trainingTransitionScene(state, content)).toMatchObject({
      mode: 'generic',
      drillLabels: ['Open Training'],
      participants: [{ activityId: 'generic', activityLabel: 'Ball Work' }],
    });
  });

  it('maps the defensive, conditioning, and keeper paths to distinct activities', () => {
    const initial = {
      ...createCareer(createLaunchCareerSetup(654)),
      trainingPoints: 100,
    };
    const state = setCareerTrainingPlan(initial, [
      { playerId: 'bramble-rovers-p01', pathId: 'duels' },
      { playerId: 'bramble-rovers-p02', pathId: 'circuit' },
      { playerId: 'bramble-rovers-p03', pathId: 'keeper-drills' },
    ]);

    expect(trainingTransitionScene(state, content).participants.map(participant =>
      participant.activityId,
    )).toEqual(['duels', 'circuit', 'keeper-drills']);
  });

  it('maps the first-touch path to the rondo activity', () => {
    const initial = {
      ...createCareer(createLaunchCareerSetup(655)),
      trainingPoints: 100,
    };
    const state = setCareerTrainingPlan(initial, [
      { playerId: 'bramble-rovers-p01', pathId: 'sprints' },
      { playerId: 'bramble-rovers-p02', pathId: 'first-touch' },
    ]);

    expect(trainingTransitionScene(state, content).participants.map(participant =>
      participant.activityId,
    )).toEqual(['sprints', 'rondo']);
  });

  it('does not present an unaffordable plan as completed training', () => {
    const initial = createCareer(createLaunchCareerSetup(789));
    const planned = setCareerTrainingPlan(initial, [
      { playerId: 'bramble-rovers-p01', pathId: 'sprints' },
    ]);
    const state = {
      ...planned,
      trainingPoints: 0,
    };

    expect(trainingTransitionScene(state, content).mode).toBe('generic');
  });
});
