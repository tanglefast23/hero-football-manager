import { loadLaunchContent } from '../../content';
import { applyCareerTraining, createCareer } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { trainingTransitionScene } from '../training-transition';

describe('training transition scene', () => {
  const content = loadLaunchContent();

  it('shows up to three assigned players across the selected drills', () => {
    const initial = {
      ...createCareer(createLaunchCareerSetup(123)),
      trainingPoints: 100,
    };
    const drills = content.training.focusDrills.filter(drill =>
      ['sprints', 'finishing', 'rondo'].includes(drill.id),
    );
    const state = applyCareerTraining(
      initial,
      ['bramble-rovers-p01', 'bramble-rovers-p02', 'bramble-rovers-p03', 'bramble-rovers-p04'],
      drills,
    );

    expect(trainingTransitionScene(state, content)).toMatchObject({
      mode: 'plan',
      drillLabels: ['Sprints I', 'Finishing I', 'Rondo I'],
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
      drillLabels: ['Basic Conditioning'],
      participants: [{ activityId: 'generic', activityLabel: 'Ball Work' }],
    });
  });

  it('maps the defensive, conditioning, and keeper drills to distinct activities', () => {
    const initial = {
      ...createCareer(createLaunchCareerSetup(654)),
      trainingPoints: 100,
    };
    const drills = content.training.focusDrills.filter(drill =>
      ['duels', 'circuit', 'keeper-drills'].includes(drill.id),
    );
    const state = applyCareerTraining(
      initial,
      ['bramble-rovers-p01', 'bramble-rovers-p02', 'bramble-rovers-p03'],
      drills,
    );

    expect(trainingTransitionScene(state, content).participants.map(participant =>
      participant.activityId,
    )).toEqual(['duels', 'circuit', 'keeper-drills']);
  });

  it('maps upgraded drill tiers to their path activity', () => {
    const initial = {
      ...createCareer(createLaunchCareerSetup(655)),
      trainingPoints: 100,
    };
    const drills = content.training.focusDrills.filter(drill =>
      ['sprints-ii', 'first-touch-iii'].includes(drill.id),
    );
    const state = applyCareerTraining(
      initial,
      ['bramble-rovers-p01', 'bramble-rovers-p02'],
      drills,
    );

    expect(trainingTransitionScene(state, content).participants.map(participant =>
      participant.activityId,
    )).toEqual(['sprints', 'rondo']);
  });

  it('does not present an unaffordable repeating plan as completed training', () => {
    const initial = createCareer(createLaunchCareerSetup(789));
    const sprint = content.training.focusDrills.find(drill => drill.id === 'sprints')!;
    const planned = applyCareerTraining(initial, ['bramble-rovers-p01'], [sprint]);
    const state = {
      ...planned,
      trainingPoints: 0,
    };

    expect(trainingTransitionScene(state, content).mode).toBe('generic');
  });
});
