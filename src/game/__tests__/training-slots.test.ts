import type { CareerTrainingPlan } from '../types';

test('a training plan is a list of player+path slots', () => {
  const plan: CareerTrainingPlan = { slots: [
    { playerId: 'p1', pathId: 'duels' }, { playerId: 'p2', pathId: 'sprints' },
  ] };
  expect(plan.slots).toHaveLength(2);
  expect(plan.slots[0].pathId).toBe('duels');
});
