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

  test('catalog is baked into state and a D5 start resolves to tier 1', () => {
    const state = runHeadlessFullCareer(createLaunchCareerSetup(0), 1);
    expect(state.trainingRules?.focusDrills.length).toBe(14);
    const drill = resolveTrainingDrillForPath(state, 'sprints');
    // The starting division resolves to the FIRST rung now. It used to resolve
    // to the second, which is why the first was dead content.
    expect(drill.id).toBe('sprints');
    expect(drill.gains.pac).toBe(5);
  });
});
