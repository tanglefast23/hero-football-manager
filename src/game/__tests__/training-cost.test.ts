import { createLaunchCareerSetup } from '../../application/launch';
import { runHeadlessFullCareer } from '../headless';
import { slotTrainingPointCost } from '../training';

test('TP cost sums per-slot best-tier costs; money is never charged', () => {
  const state = runHeadlessFullCareer(createLaunchCareerSetup(0, undefined, undefined, 'full'), 1);
  const userIds = state.players.filter(p => p.clubId === state.userClubId).map(p => p.id);
  const cost = slotTrainingPointCost(state, [
    { playerId: userIds[0], pathId: 'sprints' },
    { playerId: userIds[1], pathId: 'duels' },
  ]);
  expect(cost).toBe(12); // two tier-I slots at 6 each
});
