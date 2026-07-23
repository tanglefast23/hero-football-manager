import { createLaunchCareerSetup } from '../../application/launch';
import { runHeadlessFullCareer } from '../headless';
import { advanceWeek } from '../career';
import { setCareerTrainingPlan } from '../training';
import { playerAttributeCaps } from '../archetype-caps';

test('advanceWeek refuses to run while a slot is capped', () => {
  let state = runHeadlessFullCareer(createLaunchCareerSetup(0, undefined, undefined, 'full'), 1);
  state = { ...state, phase: 'manage', trainingPoints: 100 };
  const capped = state.players.find(p => p.clubId === state.userClubId)!;
  const defCap = playerAttributeCaps(capped).def;
  state = { ...state, players: state.players.map(p => p.id === capped.id ? { ...p, attrs: { ...p.attrs, def: defCap } } : p) };
  state = setCareerTrainingPlan(state, [{ playerId: capped.id, pathId: 'duels' }]);
  expect(() => advanceWeek(state)).toThrow(/training/i);
});
