import { createLaunchCareerSetup } from '../../application/launch';
import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
  weeklyAmbientTrainingPoints,
} from '../career';
import { setCareerTrainingPlan } from '../training';
import { buildCareerFacility } from '../management';
import { playerAttributeCaps } from '../archetype-caps';
import type { GameState } from '../types';

function newFullCareer(seed: number): GameState {
  return createCareer({ ...createLaunchCareerSetup(seed, undefined, undefined, 'full'), careerMode: 'full' });
}

// Drive to the first manage-phase week that also has a scheduled match, without
// setting any training plan (so no interrupt fires en route).
function driveToManageMatchWeek(seed: number): GameState {
  let state = newFullCareer(seed);
  let guard = 0;
  while (!(state.phase === 'manage' && activeCareerMatchday(state) !== undefined)) {
    if (guard++ > 40) throw new Error('no manage-phase match week reached');
    if (state.phase === 'manage') {
      state = advanceWeek(state);
    } else if (state.phase === 'matchday') {
      const md = activeCareerMatchday(state)!;
      state = completeMatchday(state, md.fixtures.map(f => ({ fixtureId: f.id, homeGoals: 1, awayGoals: 1 })));
    } else {
      throw new Error(`unexpected phase ${state.phase}`);
    }
  }
  return state;
}

describe('training interrupts are enforced on every week, not just bye weeks', () => {
  test('advanceWeek blocks a capped slot even when a match is scheduled this week', () => {
    let state = driveToManageMatchWeek(0);
    expect(activeCareerMatchday(state)).not.toBeUndefined(); // precondition: a match IS scheduled

    const target = state.players.find(p => p.clubId === state.userClubId)!;
    const defCap = playerAttributeCaps(target).def;
    state = {
      ...state,
      players: state.players.map(p => (p.id === target.id ? { ...p, attrs: { ...p.attrs, def: defCap } } : p)),
    };
    state = setCareerTrainingPlan(state, [{ playerId: target.id, pathId: 'duels' }]);

    // Regression: before the fix, advanceWeek returned { phase: 'matchday' } here
    // (guard skipped on match weeks) and the capped slot settled silently.
    expect(() => advanceWeek(state)).toThrow(/training/i);
  });
});

describe('this week\'s TP income is credited before training charges', () => {
  test('a plan the guard allows via bank+income is not silently skipped at settlement', () => {
    // Build and complete a training pitch so the club earns ambient TP each week,
    // then reach a bye manage week (playing through any match weeks en route).
    let state = buildCareerFacility(newFullCareer(20260718), 'training-pitch', { x: 0, y: 0 }).state;
    let warmup = 0;
    while (weeklyAmbientTrainingPoints(state) < 6 || activeCareerMatchday(state) !== undefined) {
      if (warmup++ > 12) throw new Error('training pitch never became operational');
      if (state.phase === 'matchday') {
        const md = activeCareerMatchday(state)!;
        state = completeMatchday(state, md.fixtures.map(f => ({ fixtureId: f.id, homeGoals: 1, awayGoals: 1 })));
      } else {
        state = advanceWeek(state); // no plan set -> no interrupt
      }
    }
    expect(activeCareerMatchday(state)).toBeUndefined(); // a bye week -> settles directly

    const target = state.players.find(p => p.clubId === state.userClubId && p.attrs.pac < 90)!;
    state = { ...state, phase: 'manage', trainingPoints: 4 }; // bank below the 6-TP tier-I slot cost
    state = setCareerTrainingPlan(state, [{ playerId: target.id, pathId: 'sprints' }]);
    const before = state.players.find(p => p.id === target.id)!.attrs.pac;

    // 4 (bank) + 10 (ambient income) >= 6, so the guard allows it AND settlement
    // must actually train. Before the fix, settlement charged against the bank
    // alone (4 < 6) and silently skipped the slot, contradicting the guard.
    const settled = advanceWeek(state);
    const after = settled.players.find(p => p.id === target.id)!.attrs.pac;
    expect(after).toBeGreaterThan(before);
  });
});
