import { createLaunchCareerSetup } from '../../application/launch';
import { runHeadlessFullCareer } from '../headless';
import { setCareerTrainingPlan, pendingTrainingInterrupts } from '../training';
import { playerAttributeCaps } from '../archetype-caps';

test('a capped slot is reported; a fresh slot is not', () => {
  let state = runHeadlessFullCareer(createLaunchCareerSetup(0, undefined, undefined, 'full'), 1);
  state = { ...state, phase: 'manage', trainingPoints: 100 };
  const roster = state.players.filter(p => p.clubId === state.userClubId);
  const fresh = roster.find(p => p.attrs.pac < 80)!;
  const capped = roster.find(p => p.id !== fresh.id)!;
  const defCap = playerAttributeCaps(capped).def;
  state = { ...state, players: state.players.map(p => p.id === capped.id ? { ...p, attrs: { ...p.attrs, def: defCap } } : p) };
  state = setCareerTrainingPlan(state, [
    { playerId: fresh.id, pathId: 'sprints' },
    { playerId: capped.id, pathId: 'duels' },
  ]);
  const interrupts = pendingTrainingInterrupts(state, state.trainingPoints);
  expect(interrupts.cappedSlots.map(s => s.playerId)).toEqual([capped.id]);
  expect(interrupts.cappedSlots[0].attribute).toBe('def');
  expect(interrupts.tpShortfall).toBe(0);
});

test('reports a TP shortfall when the plan costs more than available', () => {
  let state = runHeadlessFullCareer(createLaunchCareerSetup(0, undefined, undefined, 'full'), 1);
  state = { ...state, phase: 'manage', trainingPoints: 100 };
  const ids = state.players.filter(p => p.clubId === state.userClubId).map(p => p.id);
  state = setCareerTrainingPlan(state, [{ playerId: ids[0], pathId: 'sprints' }]); // 6 TP
  const interrupts = pendingTrainingInterrupts(state, 4);
  expect(interrupts.weeklyTrainingPointCost).toBe(6);
  expect(interrupts.tpShortfall).toBe(2);
});
