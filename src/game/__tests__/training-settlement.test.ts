import { createLaunchCareerSetup } from '../../application/launch';
import { runHeadlessFullCareer } from '../headless';
import { setCareerTrainingPlan, resolveCareerTrainingWeek } from '../training';

test('each slot trains only its own player on its own stat; TP-only', () => {
  let state = runHeadlessFullCareer(createLaunchCareerSetup(0, undefined, undefined, 'full'), 1);
  const roster = state.players.filter(p => p.clubId === state.userClubId);
  const target = roster.find(p => p.attrs.pac < 90)!;
  state = { ...state, phase: 'manage', trainingPoints: 100 };
  state = setCareerTrainingPlan(state, [{ playerId: target.id, pathId: 'sprints' }]);
  const before = target.attrs.pac;
  const res = resolveCareerTrainingWeek(state);
  const after = res.players.find(p => p.id === target.id)!.attrs.pac;
  expect(after).toBeGreaterThan(before);
  expect(res.moneyCost).toBe(0);
  const otherBefore = roster.find(p => p.id !== target.id)!;
  const otherAfter = res.players.find(p => p.id === otherBefore.id)!;
  expect(otherAfter.attrs.pac).toBe(otherBefore.attrs.pac); // not trained on pac
});
