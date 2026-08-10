import { createLaunchCareerSetup } from '../../application/launch';
import { runHeadlessFullCareer } from '../headless';
import {
  TRAINING_PATHS,
  trainingPathLabel,
  trainingPathLabelKey,
  resolveTrainingDrillForPath,
} from '../training-paths';

describe('training paths', () => {
  test('there are 7 paths, one per stat, with labels', () => {
    expect(TRAINING_PATHS.map((p) => p.pathId).sort()).toEqual([
      'circuit',
      'duels',
      'finishing',
      'first-touch',
      'keeper-drills',
      'rondo',
      'sprints',
    ]);
    expect(trainingPathLabel('duels')).toBe('Defense');
    expect(TRAINING_PATHS.find((p) => p.pathId === 'duels')?.attribute).toBe(
      'def',
    );
  });

  test('every label is written twice: the English, and the key beside it', () => {
    // The English alone is what shipped, and it drew "Pace" and "Reflexes" into
    // six otherwise translated screens. A path without a key is that bug.
    expect(TRAINING_PATHS.map((path) => [path.pathId, path.labelKey])).toEqual([
      ['sprints', 'trainingPath.pac'],
      ['finishing', 'trainingPath.sho'],
      ['rondo', 'trainingPath.pas'],
      ['duels', 'trainingPath.def'],
      ['first-touch', 'trainingPath.tec'],
      ['circuit', 'trainingPath.sta'],
      ['keeper-drills', 'trainingPath.ref'],
    ]);
    expect(trainingPathLabelKey('duels')).toBe('trainingPath.def');
    expect(() => trainingPathLabelKey('nope')).toThrow(
      'unknown training path nope',
    );
  });

  test('catalog is baked into state and the resolver returns the OWNED tier', () => {
    const state = runHeadlessFullCareer(createLaunchCareerSetup(0), 1);
    expect(state.trainingRules?.focusDrills.length).toBe(35);
    // Nothing has been bought, so the club still trains on tier 1 whatever
    // division it reached: promotion puts upgrades on sale, it does not gift them.
    const drill = resolveTrainingDrillForPath(state, 'sprints');
    expect(drill.id).toBe('sprints');
    expect(drill.gains.pac).toBe(2);

    const bought = resolveTrainingDrillForPath(
      { ...state, ownedTrainingTiers: { sprints: 3 } },
      'sprints',
    );
    expect(bought.id).toBe('sprints-iii');
    expect(bought.gains.pac).toBe(6);
  });
});
