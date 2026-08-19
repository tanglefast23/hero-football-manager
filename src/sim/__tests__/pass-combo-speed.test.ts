import { createMatch } from '../match';
import {
  PASS_COMBO_DECAY_TICKS,
  PASS_COMBO_TIER_D,
  comboBonusD,
  decayPassCombo,
  endChain,
} from '../pass-combo';
import { ROVERS, UNITED } from '../teams';
import type { DecoyCloneState, MatchState } from '../types';

const POLICIES = {
  homePolicy: 'FIRE_WHEN_READY' as const,
  awayPolicy: 'FIRE_WHEN_READY' as const,
};

function freshMatch(seed = 7): MatchState {
  return createMatch(seed, ROVERS, UNITED, POLICIES);
}

/** A live home clone copied off the striker, parked well away from play. */
function spawnHomeClone(state: MatchState): void {
  const source = state.players[9];
  const clone: DecoyCloneState = {
    ...source,
    def: { ...source.def, id: `${source.def.id}:decoy:test` },
    pos: { ...source.pos },
    comboTierD: 0,
    comboTicks: 0,
    comboChainId: 0,
    ownerIdx: 9,
    ownerPlayerId: source.def.id,
    sourceIdx: 9,
    sourcePlayerId: source.def.id,
    formationSlot: 9,
    untilTick: 99999,
  };
  state.decoyClones[0] = clone;
}

describe('pass combo bonus arithmetic', () => {
  it('derives the bonus from tier and remaining ticks', () => {
    const p = freshMatch().players[3];
    p.comboTierD = 2000;
    p.comboTicks = 30;
    expect(comboBonusD(p)).toBe(2000);
    p.comboTicks = 15;
    expect(comboBonusD(p)).toBe(1000);
    p.comboTicks = 0;
    expect(comboBonusD(p)).toBe(0);
  });

  it('reaches exactly zero after 30 decay ticks from every tier', () => {
    for (const tier of [200, 400, 1000, 1500, 2000]) {
      const state = freshMatch();
      const p = state.players[3];
      p.comboTierD = tier;
      p.comboTicks = PASS_COMBO_DECAY_TICKS;
      for (let i = 0; i < PASS_COMBO_DECAY_TICKS - 1; i += 1) {
        decayPassCombo(state);
        expect(comboBonusD(p)).toBeGreaterThan(0);
      }
      decayPassCombo(state);
      expect(comboBonusD(p)).toBe(0);
      expect(p.comboTierD).toBe(0);
    }
  });

  it('decays a live Decoy clone, not just state.players', () => {
    const state = freshMatch();
    spawnHomeClone(state);
    state.decoyClones[0]!.comboTierD = 2000;
    state.decoyClones[0]!.comboTicks = 30;
    decayPassCombo(state);
    expect(state.decoyClones[0]!.comboTicks).toBe(29);
  });

  it('endChain zeroes the count and always increments the id', () => {
    const state = freshMatch();
    const start = state.passCombo[0].chainId;
    state.passCombo[0].count = 4;
    endChain(state, 0);
    expect(state.passCombo[0]).toEqual({ count: 0, chainId: start + 1 });
    endChain(state, 0);
    expect(state.passCombo[0]).toEqual({ count: 0, chainId: start + 2 });
  });

  it('never produces a chain id of 0 or a reset to 1', () => {
    // Read the starting id rather than hardcoding 1. `createMatch` calls
    // `restartKickoff`, and once that is hooked a fresh match already starts
    // above 1.
    const state = freshMatch();
    const start = state.passCombo[1].chainId;
    expect(start).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 50; i += 1) endChain(state, 1);
    expect(state.passCombo[1].chainId).toBe(start + 50);
  });

  it('has a tier table indexed by chain length', () => {
    expect(PASS_COMBO_TIER_D[2]).toBe(200);
    expect(PASS_COMBO_TIER_D[3]).toBe(400);
    expect(PASS_COMBO_TIER_D[4]).toBe(1000);
    expect(PASS_COMBO_TIER_D[5]).toBe(1500);
    expect(PASS_COMBO_TIER_D[6]).toBe(2000);
  });
});
