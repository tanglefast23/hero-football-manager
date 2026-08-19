import {
  launchPass,
  movementTick,
  possessionTick,
  restartKickoff,
  speedFor128,
} from '../engine';
import { createMatch, runMatch } from '../match';
import {
  PASS_COMBO_DECAY_TICKS,
  PASS_COMBO_TIER_D,
  breakPassCombo,
  chainMembers,
  comboBonusD,
  decayPassCombo,
  endChain,
  extendPassCombo,
} from '../pass-combo';
import { dismissDecoyClone, emitPowerTurnover, knockOut } from '../powers';
import { performSubstitution } from '../substitutions';
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

/**
 * Runs a pass from `from` to `to` all the way to its arrival, through the real
 * engine. The 4th argument is `lofted` (required) and the 5th is `guaranteed`,
 * which forces the contest to succeed so this always produces a clean catch.
 */
function completePass(state: MatchState, from: number, to: number): void {
  state.ball = { kind: 'held', by: from };
  launchPass(state, from, to, false, true);
  // Read through a function: the assignment above narrows `state.ball` to
  // 'held' for the rest of the block, and TS cannot see that launchPass and
  // possessionTick replace it.
  for (let i = 0; i < 60 && ballKind(state) === 'pass'; i += 1) {
    possessionTick(state);
  }
}

function ballKind(state: MatchState): MatchState['ball']['kind'] {
  return state.ball.kind;
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

describe('pass combo chain membership', () => {
  it('enrols both ends of a completed pass and nobody else', () => {
    const state = freshMatch();
    extendPassCombo(state, 0, 4, 7);
    expect(chainMembers(state, 0).sort((a, b) => a - b)).toEqual([4, 7]);
    expect(comboBonusD(state.players[5])).toBe(0);
  });

  it('grants nothing at x1 and 200 at x2', () => {
    const state = freshMatch();
    extendPassCombo(state, 0, 4, 7);
    expect(comboBonusD(state.players[4])).toBe(0);
    extendPassCombo(state, 0, 7, 5);
    expect(comboBonusD(state.players[4])).toBe(200);
    expect(comboBonusD(state.players[5])).toBe(200);
  });

  it('climbs the ladder and holds at 2000 above x6', () => {
    const state = freshMatch();
    const order = [4, 7, 5, 6, 8, 3, 2, 1];
    for (let i = 0; i + 1 < order.length; i += 1) {
      extendPassCombo(state, 0, order[i], order[i + 1]);
    }
    expect(state.passCombo[0].count).toBe(7);
    expect(comboBonusD(state.players[1])).toBe(2000);
  });

  it('enrols a Decoy clone and not the keeper or the copied forward', () => {
    const state = freshMatch();
    spawnHomeClone(state);
    extendPassCombo(state, 0, 6, 22);
    extendPassCombo(state, 0, 22, 8);
    expect(chainMembers(state, 0).sort((a, b) => a - b)).toEqual([6, 8, 22]);
    expect(comboBonusD(state.players[0])).toBe(0); // keeper, the 22 % 11 trap
    expect(comboBonusD(state.players[9])).toBe(0); // copied source forward
    expect(comboBonusD(state.decoyClones[0]!)).toBe(200);
  });

  it('does not lift a stale decayer from a previous chain', () => {
    const state = freshMatch();
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5);
    breakPassCombo(state);
    extendPassCombo(state, 0, 8, 6);
    extendPassCombo(state, 0, 6, 3);
    extendPassCombo(state, 0, 3, 2);
    extendPassCombo(state, 0, 2, 1);
    extendPassCombo(state, 0, 1, 10); // five extends = x5
    expect(state.passCombo[0].count).toBe(5);
    expect(comboBonusD(state.players[8])).toBe(1500);
    expect(comboBonusD(state.players[4])).toBe(200); // still the old tier
  });

  it('keeps the higher bonus and the old countdown across a break', () => {
    const state = freshMatch();
    const order = [4, 7, 5, 6, 8, 3, 2];
    for (let i = 0; i + 1 < order.length; i += 1) {
      extendPassCombo(state, 0, order[i], order[i + 1]);
    }
    expect(comboBonusD(state.players[4])).toBe(2000);
    breakPassCombo(state);
    for (let i = 0; i < 3; i += 1) decayPassCombo(state);
    const beforeSnap = comboBonusD(state.players[4]);
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5); // a fresh x2 = 200
    expect(comboBonusD(state.players[4])).toBe(beforeSnap);
    expect(state.players[4].comboTierD).toBe(2000);
  });

  it('ends the other team chain on a completion', () => {
    const state = freshMatch();
    const order = [4, 7, 5, 6, 8];
    for (let i = 0; i + 1 < order.length; i += 1) {
      extendPassCombo(state, 0, order[i], order[i + 1]);
    }
    const idBefore = state.passCombo[0].chainId;
    expect(state.passCombo[0].count).toBe(4);
    extendPassCombo(state, 1, 15, 17);
    expect(state.passCombo[0].count).toBe(0);
    expect(state.passCombo[0].chainId).toBeGreaterThan(idBefore);
    expect(chainMembers(state, 0)).toEqual([]);
    expect(chainMembers(state, 1).sort((a, b) => a - b)).toEqual([15, 17]);
  });

  it('does not re-enrol first-half members after a restart', () => {
    const state = freshMatch();
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5);
    restartKickoff(state, 0);
    expect(state.passCombo[0].count).toBe(0);
    expect(comboBonusD(state.players[4])).toBe(0);
    extendPassCombo(state, 0, 8, 6);
    extendPassCombo(state, 0, 6, 3);
    expect(comboBonusD(state.players[4])).toBe(0);
    expect(comboBonusD(state.players[8])).toBe(200);
  });

  it('extends through a real engine arrival, not just the helper', () => {
    // Every other membership case calls extendPassCombo directly. Without this
    // one the clean-catch predicate in possessionTick has NO test, and the
    // whole hook could be omitted with a green suite.
    const state = freshMatch();
    completePass(state, 4, 7);
    completePass(state, 7, 5);
    expect(state.passCombo[0].count).toBe(2);
    expect(chainMembers(state, 0).sort((a, b) => a - b)).toEqual([4, 5, 7]);
    expect(comboBonusD(state.players[4])).toBe(200);
  });

  it('breaks the chain when a pass fails at launch', () => {
    const state = freshMatch();
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5);
    state.ball = { kind: 'held', by: 5 };
    // `ok` comes from a contest roll, NOT from distance — a far-away target
    // still succeeds when the roll wins. Force the roll to lose instead.
    state.rng = () => 1;
    launchPass(state, 5, 7, false);
    expect(state.passCombo[0].count).toBe(0);
  });

  it('does not re-extend on a same-team Gust redirect', () => {
    const state = freshMatch();
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5);
    breakPassCombo(state);
    state.ball = {
      kind: 'pass',
      pos: { ...state.players[5].pos },
      from: 5,
      fromPlayerId: state.players[5].def.id,
      to: 0,
      willSucceed: true,
      interceptor: -1,
      z: 0,
      vz: 0,
      speed: 250,
      gustRedirect: true,
    };
    for (let i = 0; i < 60 && ballKind(state) === 'pass'; i += 1) {
      possessionTick(state);
    }
    expect(ballKind(state)).toBe('held');
    expect(state.passCombo[0].count).toBe(0);
  });

  it('breaks when a power strips the ball, not just a tackle', () => {
    // Three ball-stripping paths live in powers.ts, not engine.ts: a knocked
    // out carrier, a Decoy clone popping mid-carry, and Web Trap rooting the
    // carrier. Each is a turnover. Missing them let a team lose the ball at x4,
    // win it back, and climb to x5 off an interrupted move.
    const state = freshMatch();
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5);
    expect(state.passCombo[0].count).toBe(2);
    state.ball = { kind: 'held', by: 5 };
    knockOut(state, 5, state.tick + 50, 'ko');
    expect(state.ball.kind).toBe('loose');
    expect(state.passCombo[0].count).toBe(0);
    // The bonus still fades rather than snapping, as with any in-play break.
    expect(comboBonusD(state.players[4])).toBe(200);
  });

  it('breaks when a carrying Decoy clone pops', () => {
    const state = freshMatch();
    spawnHomeClone(state);
    extendPassCombo(state, 0, 6, 22);
    extendPassCombo(state, 0, 22, 8);
    expect(state.passCombo[0].count).toBe(2);
    state.ball = { kind: 'held', by: 22 };
    expect(dismissDecoyClone(state, 0, 'expired')).toBe(true);
    expect(state.ball.kind).toBe('loose');
    expect(state.passCombo[0].count).toBe(0);
  });

  it('breaks on a power turnover, at the shared funnel', () => {
    // Shadow Mark and Web Trap both steal through emitPowerTurnover, which
    // emits a won TACKLE. A won tackle ends the move whether a boot or a power
    // did it, so the break lives in that one funnel rather than at each caller.
    const state = freshMatch();
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5);
    expect(state.passCombo[0].count).toBe(2);
    emitPowerTurnover(state, 15, 5); // away hero steals from home
    expect(state.passCombo[0].count).toBe(0);
    expect(state.passCombo[1].count).toBe(0);
    // In-play break, so the bonus keeps fading rather than snapping off.
    expect(comboBonusD(state.players[4])).toBe(200);
  });

  it('does not enrol a substitute who replaced the passer mid-flight', () => {
    // `from` is a SLOT. A substitution during the flight puts a different
    // player in it, and enrolling by index would hand a stranger the bonus and,
    // at x5, a ghost trail. The passer is checked by stable id instead.
    const spare = {
      ...ROVERS.players[6],
      id: 'r-sub-mid',
      name: 'Late Arrival',
      attrs: { ...ROVERS.players[6].attrs },
    };
    const state = createMatch(
      7,
      { ...ROVERS, bench: [spare] },
      UNITED,
      POLICIES,
    );
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5);
    state.ball = { kind: 'held', by: 5 };
    launchPass(state, 5, 8, false, true);
    expect(ballKind(state)).toBe('pass');
    // Swap the passer out while the ball is still in the air.
    expect(performSubstitution(state, 0, 5, 'r-sub-mid')).toBe(true);
    for (let i = 0; i < 60 && ballKind(state) === 'pass'; i += 1) {
      possessionTick(state);
    }
    expect(state.players[5].def.id).toBe('r-sub-mid');
    expect(comboBonusD(state.players[5])).toBe(0);
    expect(chainMembers(state, 0)).not.toContain(5);
  });

  it('gives a substitute no membership', () => {
    // ROVERS ships no bench, so give it one. The substitute must arrive with
    // zeroed combo fields and outside the live chain — which it does by
    // construction, because performSubstitution builds a fresh SimPlayer.
    const spare = {
      ...ROVERS.players[6],
      id: 'r-sub-1',
      name: 'Spare Part',
      attrs: { ...ROVERS.players[6].attrs },
    };
    const state = createMatch(
      7,
      { ...ROVERS, bench: [spare] },
      UNITED,
      POLICIES,
    );
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5);
    const replacement = state.bench[0][0];
    expect(replacement).toBeDefined();
    expect(performSubstitution(state, 0, 5, replacement.id)).toBe(true);
    expect(state.players[5].comboChainId).toBe(0);
    expect(comboBonusD(state.players[5])).toBe(0);
    expect(chainMembers(state, 0)).not.toContain(5);
  });
});

describe('pass combo speed', () => {
  it('multiplies a member speed by the tier and leaves everyone else alone', () => {
    const state = freshMatch();
    const baseline = speedFor128(state, 4);
    const nonMemberBaseline = speedFor128(state, 10);
    const opponentBaseline = speedFor128(state, 15);
    const order = [4, 7, 5, 6, 8, 3, 2];
    for (let i = 0; i + 1 < order.length; i += 1) {
      extendPassCombo(state, 0, order[i], order[i + 1]);
    }
    expect(comboBonusD(state.players[4])).toBe(2000);
    expect(speedFor128(state, 4)).toBe(Math.round((baseline * 12000) / 10000));
    // A teammate who never touched the ball, and an opponent, are untouched.
    expect(speedFor128(state, 10)).toBe(nonMemberBaseline);
    expect(speedFor128(state, 15)).toBe(opponentBaseline);
  });

  it('fades the speed back to baseline over exactly 30 ticks', () => {
    const state = freshMatch();
    const baseline = speedFor128(state, 4);
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5);
    expect(speedFor128(state, 4)).toBeGreaterThan(baseline);
    for (let i = 0; i < PASS_COMBO_DECAY_TICKS; i += 1) decayPassCombo(state);
    expect(speedFor128(state, 4)).toBe(baseline);
  });

  it('moves a member further in one tick than an identical non-member', () => {
    // Assert the STEP, not the counter. Two matches from the same seed, one
    // with a chain and one without: the member must cover more ground.
    const withChain = freshMatch();
    const without = freshMatch();
    const order = [4, 7, 5, 6, 8, 3, 2];
    for (let i = 0; i + 1 < order.length; i += 1) {
      extendPassCombo(withChain, 0, order[i], order[i + 1]);
    }
    expect(comboBonusD(withChain.players[4])).toBe(2000);
    const startA = { ...withChain.players[4].pos };
    const startB = { ...without.players[4].pos };
    expect(startA).toEqual(startB);
    movementTick(withChain);
    movementTick(without);
    const movedA =
      Math.abs(withChain.players[4].pos.x - startA.x) +
      Math.abs(withChain.players[4].pos.y - startA.y);
    const movedB =
      Math.abs(without.players[4].pos.x - startB.x) +
      Math.abs(without.players[4].pos.y - startB.y);
    expect(movedB).toBeGreaterThan(0);
    expect(movedA).toBeGreaterThan(movedB);
  });

  it('is deterministic across two identical runs', () => {
    // runMatch(seed, home, away, inputs[], opts) — the 4th argument is the
    // input log, NOT the options object.
    const a = runMatch(12345, ROVERS, UNITED, [], POLICIES);
    const b = runMatch(12345, ROVERS, UNITED, [], POLICIES);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.score).toEqual(b.score);
  });
});
