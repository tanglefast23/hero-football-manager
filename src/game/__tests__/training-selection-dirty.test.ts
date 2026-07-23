import { trainingSelectionMatchesSavedPlan } from '../training';
import type { CareerTrainingPlan } from '../types';

function plan(assignedPlayerIds: string[], drillIds: string[]): CareerTrainingPlan {
  return {
    assignedPlayerIds,
    drills: drillIds.map(id => ({ id, moneyCost: 0, tpCost: 0, gains: {} })),
  };
}

describe('trainingSelectionMatchesSavedPlan', () => {
  it('is false when no plan has been saved yet', () => {
    expect(trainingSelectionMatchesSavedPlan(undefined, ['p1'], ['sprints'])).toBe(false);
  });

  it('is true when trainees and drills match, regardless of order', () => {
    const saved = plan(['p1', 'p2'], ['sprints', 'rondo']);
    expect(trainingSelectionMatchesSavedPlan(saved, ['p2', 'p1'], ['rondo', 'sprints'])).toBe(true);
  });

  it('is false when a drill is swapped', () => {
    const saved = plan(['p1'], ['sprints']);
    expect(trainingSelectionMatchesSavedPlan(saved, ['p1'], ['finishing'])).toBe(false);
  });

  it('is false when a trainee is added or removed', () => {
    const saved = plan(['p1'], ['sprints']);
    expect(trainingSelectionMatchesSavedPlan(saved, ['p1', 'p2'], ['sprints'])).toBe(false);
    expect(trainingSelectionMatchesSavedPlan(saved, [], ['sprints'])).toBe(false);
  });
});
