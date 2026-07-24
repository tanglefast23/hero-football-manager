import { createLaunchCareerSetup } from '../../application/launch';
import { playerAttributeCaps } from '../archetype-caps';
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
  expect(otherAfter.attrs.sta).toBe(otherBefore.attrs.sta); // no passive conditioning
});

test('Circuit deliberately trains STA for its assigned player only', () => {
  let state = runHeadlessFullCareer(createLaunchCareerSetup(1, undefined, undefined, 'full'), 1);
  const roster = state.players.filter(p => p.clubId === state.userClubId);
  const target = roster.find(p => p.attrs.sta < playerAttributeCaps(p).sta)!;
  const unassigned = roster.find(p => p.id !== target.id)!;
  state = { ...state, phase: 'manage', trainingPoints: 100 };
  state = setCareerTrainingPlan(state, [{ playerId: target.id, pathId: 'circuit' }]);

  const res = resolveCareerTrainingWeek(state);
  expect(res.players.find(p => p.id === target.id)!.attrs.sta).toBeGreaterThan(target.attrs.sta);
  expect(res.players.find(p => p.id === unassigned.id)!.attrs.sta).toBe(unassigned.attrs.sta);
});
