import { createLaunchCareerSetup } from '../../application/launch';
import { superTrainingChancePercent } from '../archetype-caps';
import {
  applyCareerContractPromise,
  TRAINING_PRIORITY_DRILLS,
} from '../contract-promises';
import { runHeadlessFullCareer } from '../headless';
import { overtrainingInjuryChancePercent } from '../player-wellbeing';
import {
  INSTANT_DRILL_CONDITION_COST,
  SUPER_TRAINING_PITY_DRILLS,
  trainPlayerInstantly,
} from '../training';
import type { GameState } from '../types';

function fullCareerState(seed = 0): GameState {
  const state = runHeadlessFullCareer(createLaunchCareerSetup(seed, undefined, undefined, 'full'), 1);
  return { ...state, phase: 'manage', trainingPoints: 100 };
}

function userPlayer(state: GameState) {
  const player = state.players.find(p => p.clubId === state.userClubId && p.role !== 'GK');
  if (player === undefined) throw new Error('no user outfield player');
  return player;
}

describe('superTrainingChancePercent', () => {
  it('is 5% at E- and 33% at A+', () => {
    expect(superTrainingChancePercent('E-')).toBe(5);
    expect(superTrainingChancePercent('A+')).toBe(33);
  });

  it('adds exactly 2 points per grade step', () => {
    expect(superTrainingChancePercent('E')).toBe(7);
    expect(superTrainingChancePercent('D-')).toBe(11);
    expect(superTrainingChancePercent('B-')).toBe(23);
  });
});

describe('trainPlayerInstantly', () => {
  it('deducts TP and condition, increments the drill nonce, and raises the stat', () => {
    const state = fullCareerState();
    const player = userPlayer(state);
    const res = trainPlayerInstantly(state, player.id, 'sprints');
    const trained = res.state.players.find(p => p.id === player.id)!;

    expect(res.tpSpent).toBe(6); // tier-I sprints in D5
    expect(res.state.trainingPoints).toBe(state.trainingPoints - 6);
    expect(trained.condition).toBe((player.condition ?? 100) - INSTANT_DRILL_CONDITION_COST);
    expect(res.conditionAfter).toBe(trained.condition);
    expect(res.state.totalInstantDrills).toBe(1);
    expect(res.attribute).toBe('pac');
    expect(res.before).toBe(player.attrs.pac);
    expect(res.after).toBe(trained.attrs.pac);
    expect(res.after).toBeGreaterThan(res.before);
  });

  it('floors condition at zero', () => {
    const state = fullCareerState();
    const player = userPlayer(state);
    const drained = {
      ...state,
      players: state.players.map(p => p.id === player.id ? { ...p, condition: 3 } : p),
    };
    const res = trainPlayerInstantly(drained, player.id, 'sprints');
    expect(res.conditionAfter).toBe(0);
  });

  it('rejects opponents, the injured, unknown players, and empty banks', () => {
    const state = fullCareerState();
    const player = userPlayer(state);
    const opponent = state.players.find(p => p.clubId !== state.userClubId)!;

    expect(() => trainPlayerInstantly(state, opponent.id, 'sprints')).toThrow('not on the user club');
    expect(() => trainPlayerInstantly(state, 'nobody', 'sprints')).toThrow('not on the user club');
    const hurt = {
      ...state,
      players: state.players.map(p => p.id === player.id ? { ...p, injuryWeeks: 2 } : p),
    };
    expect(() => trainPlayerInstantly(hurt, player.id, 'sprints')).toThrow('injured');
    expect(() => trainPlayerInstantly({ ...state, trainingPoints: 5 }, player.id, 'sprints'))
      .toThrow('needs 6 TP');
  });

  it('is deterministic: the same state resolves identically twice', () => {
    const state = fullCareerState();
    const player = userPlayer(state);
    const first = trainPlayerInstantly(state, player.id, 'finishing');
    const second = trainPlayerInstantly(state, player.id, 'finishing');
    expect(second).toEqual(first);
  });

  it('forces a SUPER on the pity drill and resets the counter', () => {
    const state = fullCareerState();
    const player = userPlayer(state);
    const pitiful = {
      ...state,
      players: state.players.map(p => p.id === player.id
        ? { ...p, drillsSinceSuper: SUPER_TRAINING_PITY_DRILLS - 1 }
        : p),
    };
    const res = trainPlayerInstantly(pitiful, player.id, 'sprints');
    expect(res.isSuper).toBe(true);
    expect(res.state.players.find(p => p.id === player.id)!.drillsSinceSuper).toBe(0);
  });

  it('rolls both SUPER and ordinary sessions across nonces; counters track them', () => {
    const state = fullCareerState();
    const player = userPlayer(state);
    let sawSuper = false;
    let sawOrdinary = false;
    for (let nonce = 0; nonce < 200 && !(sawSuper && sawOrdinary); nonce += 1) {
      const staged = { ...state, totalInstantDrills: nonce };
      const res = trainPlayerInstantly(staged, player.id, 'sprints');
      const trained = res.state.players.find(p => p.id === player.id)!;
      expect(res.state.totalInstantDrills).toBe(nonce + 1);
      if (res.isSuper) {
        sawSuper = true;
        expect(trained.drillsSinceSuper).toBe(0);
      } else {
        sawOrdinary = true;
        expect(trained.drillsSinceSuper).toBe(1);
      }
    }
    expect(sawSuper).toBe(true);
    expect(sawOrdinary).toBe(true);
  });

  it('a SUPER session outgains an ordinary one from the same state', () => {
    const state = fullCareerState();
    const player = userPlayer(state);
    const ordinary = trainPlayerInstantly(state, player.id, 'sprints');
    const pitiful = {
      ...state,
      players: state.players.map(p => p.id === player.id
        ? { ...p, drillsSinceSuper: SUPER_TRAINING_PITY_DRILLS - 1 }
        : p),
    };
    const superRes = trainPlayerInstantly(pitiful, player.id, 'sprints');
    expect(superRes.isSuper).toBe(true);
    if (!ordinary.isSuper) {
      expect(superRes.after - superRes.before).toBeGreaterThan(ordinary.after - ordinary.before);
    }
  });

  it('enforces a TRAINING_PRIORITY debt: owed drills block others, count down, then clear', () => {
    const state = fullCareerState();
    const roster = state.players.filter(p => p.clubId === state.userClubId);
    const promised = roster[0];
    const other = roster.find(p => p.id !== promised.id && p.role !== 'GK')!;
    let owed: GameState = applyCareerContractPromise(
      { ...state, trainingPoints: 1_000 },
      promised.id,
      'TRAINING_PRIORITY',
    );
    expect(owed.players.find(p => p.id === promised.id)?.priorityDrillsRemaining)
      .toBe(TRAINING_PRIORITY_DRILLS);

    // The promised player reminds you: nobody else may train while drills are owed.
    expect(() => trainPlayerInstantly(owed, other.id, 'sprints'))
      .toThrow(`${promised.name} was promised the next 5 drills`);

    // Each of their drills ticks the countdown down.
    for (let drill = TRAINING_PRIORITY_DRILLS; drill > 0; drill -= 1) {
      expect(owed.players.find(p => p.id === promised.id)?.priorityDrillsRemaining).toBe(drill);
      owed = trainPlayerInstantly(owed, promised.id, 'sprints').state;
    }
    expect(owed.players.find(p => p.id === promised.id)?.priorityDrillsRemaining).toBe(0);

    // Debt paid: everyone trains freely again.
    expect(() => trainPlayerInstantly(owed, other.id, 'sprints')).not.toThrow();
  });

  it('pauses a TRAINING_PRIORITY debt while the promised player is injured', () => {
    const state = fullCareerState();
    const roster = state.players.filter(p => p.clubId === state.userClubId);
    const promised = roster[0];
    const other = roster.find(p => p.id !== promised.id && p.role !== 'GK')!;
    const owed = applyCareerContractPromise(
      { ...state, trainingPoints: 1_000 },
      promised.id,
      'TRAINING_PRIORITY',
    );
    const paused = {
      ...owed,
      players: owed.players.map(p => p.id === promised.id ? { ...p, injuryWeeks: 3 } : p),
    };

    expect(() => trainPlayerInstantly(paused, other.id, 'sprints')).not.toThrow();
    // The debt survives the pause rather than being forgiven.
    expect(paused.players.find(p => p.id === promised.id)?.priorityDrillsRemaining)
      .toBe(TRAINING_PRIORITY_DRILLS);
  });

  it('never rolls injury at 30+ condition, and gambles honestly below it', () => {
    const state = fullCareerState();
    const player = userPlayer(state);
    const fresh = trainPlayerInstantly(state, player.id, 'sprints');
    expect(fresh.injury).toBeUndefined();

    const tiredState = {
      ...state,
      players: state.players.map(p => p.id === player.id ? { ...p, condition: 10 } : p),
    };
    const expectedChance = overtrainingInjuryChancePercent(10, 0);
    let sawInjury = false;
    let sawEscape = false;
    for (let nonce = 0; nonce < 50 && !(sawInjury && sawEscape); nonce += 1) {
      const staged = { ...tiredState, totalInstantDrills: nonce };
      const res = trainPlayerInstantly(staged, player.id, 'sprints');
      if (res.injury === undefined) {
        sawEscape = true;
        continue;
      }
      sawInjury = true;
      expect(res.injury.chancePercent).toBe(expectedChance);
      expect(res.injury.recoveryWeeks).toBeGreaterThanOrEqual(1);
      const trained = res.state.players.find(p => p.id === player.id)!;
      expect(trained.injuryWeeks).toBe(res.injury.recoveryWeeks);
      // The drill still paid out: you trained, then pulled something.
      expect(res.after).toBeGreaterThan(res.before);
    }
    expect(sawInjury).toBe(true);
    expect(sawEscape).toBe(true);
  });
});
