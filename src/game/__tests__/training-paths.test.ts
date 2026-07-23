import { createLaunchCareerSetup } from '../../application/launch';
import { runHeadlessFullCareer } from '../headless';
import { TRAINING_PATHS, trainingPathLabel, resolveTrainingDrillForPath } from '../training-paths';

describe('training paths', () => {
  test('there are 7 paths, one per stat, with labels', () => {
    expect(TRAINING_PATHS.map(p => p.pathId).sort()).toEqual(
      ['circuit', 'duels', 'finishing', 'first-touch', 'keeper-drills', 'rondo', 'sprints'],
    );
    expect(trainingPathLabel('duels')).toBe('Defense');
    expect(TRAINING_PATHS.find(p => p.pathId === 'duels')?.attribute).toBe('def');
  });

  test('catalog is baked into state and resolver returns tier I at a D5 start', () => {
    const state = runHeadlessFullCareer(createLaunchCareerSetup(0, undefined, undefined, 'full'), 1);
    expect(state.trainingRules?.focusDrills.length).toBe(21);
    const drill = resolveTrainingDrillForPath(state, 'sprints');
    expect(drill.id).toBe('sprints');   // brand-new career is in D5, only tier I unlocked
    expect(drill.gains.pac).toBe(3);
  });
});
