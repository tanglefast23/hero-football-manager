import { attackingDecision, movementTick, possessionTick } from '../engine';
import { createMatch } from '../match';
import { GOAL_CENTER_X } from '../geometry';
import { ROVERS, UNITED } from '../teams';
import type { MatchState } from '../types';

const CARRIER = 9;
const OPP_GK = 11;

function attackingScenario(y: number): MatchState {
  const m = createMatch(42, ROVERS, UNITED);
  m.tick = 5;
  m.ball = { kind: 'held', by: CARRIER };
  m.players[CARRIER].pos = { x: GOAL_CENTER_X, y };

  // Keep the opposing keeper in goal and move every outfielder behind the
  // carrier. Individual tests opt specific defenders/teammates back in.
  m.players[OPP_GK].pos = { x: GOAL_CENTER_X, y: 0 };
  for (let i = 12; i < 22; i++) m.players[i].pos = { x: 300, y: 9000 };
  for (let i = 0; i < 11; i++) {
    if (i !== CARRIER) m.players[i].outUntilTick = Number.MAX_SAFE_INTEGER;
  }
  return m;
}

function addAvailableTeammate(m: MatchState, idx: number, x: number, y: number): void {
  m.players[idx].outUntilTick = 0;
  m.players[idx].pos = { x, y };
}

describe('attacking decisions', () => {
  it('shoots immediately from a clear central chance inside the box', () => {
    const m = attackingScenario(1500);

    expect(attackingDecision(m, CARRIER).kind).toBe('shoot');
    possessionTick(m);
    expect(m.events.at(-1)?.kind).toBe('SHOT');
  });

  it('a defender behind the carrier does not suppress a clear shot', () => {
    const m = attackingScenario(1500);
    m.players[12].pos = { x: GOAL_CENTER_X, y: 1700 };

    expect(attackingDecision(m, CARRIER).kind).toBe('shoot');
  });

  // Distance is calibrated so the two branches straddle the shoot/carry line:
  // clear shoots, blocked does not. It moves when keeper strength changes —
  // m1.28's KEEPER_SAVE_BASELINE made shooting more attractive, pushing the
  // tipping point out from 2300 to 2500 (measured: clear 0.184 / blocked 0.084).
  it('a defender in the shooting corridor lowers shot value and changes a marginal decision', () => {
    const clear = attackingScenario(2500);
    const blocked = attackingScenario(2500);
    blocked.players[12].pos = { x: GOAL_CENTER_X, y: 1250 };

    const clearDecision = attackingDecision(clear, CARRIER);
    const blockedDecision = attackingDecision(blocked, CARRIER);

    expect(clearDecision.kind).toBe('shoot');
    expect(blockedDecision.kind).not.toBe('shoot');
    expect(blockedDecision.values.shot).toBeLessThan(clearDecision.values.shot);
  });

  it('an unpressured carrier outside shooting range carries instead of randomly passing', () => {
    const m = attackingScenario(4000);
    addAvailableTeammate(m, 6, 4800, 4300); // safe but backward
    m.rng = () => 0; // the old 35% rule always passed on this draw

    expect(attackingDecision(m, CARRIER).kind).toBe('carry');
    possessionTick(m);
    expect(m.ball).toEqual({ kind: 'held', by: CARRIER });
    expect(m.events.some(e => e.kind === 'PASS')).toBe(false);
  });

  it('an advancing carrier steers around a defender occupying the central lane', () => {
    const m = attackingScenario(4000);
    m.players[12].pos = { x: GOAL_CENTER_X, y: 3300 };
    const before = { ...m.players[CARRIER].pos };

    movementTick(m);

    expect(m.players[CARRIER].pos.y).toBeLessThan(before.y);
    expect(m.players[CARRIER].pos.x).not.toBe(before.x);
  });

  // Same calibration note as the corridor test: the tipping point moved out
  // from 3000 to 3200 in m1.28 (measured: sho90 0.164 / sho25 0.046). ~32m out,
  // so this is a long-range decision, not the edge of the box.
  it('SHO changes a marginal long-range decision', () => {
    const strong = attackingScenario(3200);
    const weak = attackingScenario(3200);
    strong.players[CARRIER].def.attrs.sho = 90;
    weak.players[CARRIER].def.attrs.sho = 25;

    expect(attackingDecision(strong, CARRIER).kind).toBe('shoot');
    expect(attackingDecision(weak, CARRIER).kind).toBe('carry');
  });

  it('chooses a progressive chance over a very open backward pass under pressure', () => {
    const m = attackingScenario(3600);
    m.players[12].pos = { x: GOAL_CENTER_X, y: 3300 }; // frontal pressure
    addAvailableTeammate(m, 6, 4400, 1700); // progressive, near the box
    addAvailableTeammate(m, 7, 2600, 5000); // backward and open

    const decision = attackingDecision(m, CARRIER);
    expect(decision.kind).toBe('pass');
    if (decision.kind === 'pass') expect(decision.to).toBe(6);
  });

  it('allows a backpass as a pressure release when no progressive option is viable', () => {
    const m = attackingScenario(3600);
    m.players[12].pos = { x: GOAL_CENTER_X, y: 3400 };
    addAvailableTeammate(m, 7, 2500, 4800);

    const decision = attackingDecision(m, CARRIER);
    expect(decision.kind).toBe('pass');
    if (decision.kind === 'pass') expect(decision.to).toBe(7);
  });

  it('does not change attacking behavior because a team leads by four goals', () => {
    const level = attackingScenario(2200);
    const leading = attackingScenario(2200);
    leading.score = [5, 0];

    expect(attackingDecision(leading, CARRIER)).toEqual(attackingDecision(level, CARRIER));
  });
});
