import {
  attackingDecision,
  launchPass,
  movementTick,
  possessionTick,
  shotFlightTick,
  tackleTick,
} from '../engine';
import { createMatch } from '../match';
import {
  activatePower,
  dribbleBonus,
  inUsefulContext,
  phaseRunPreventsShot,
  powerTick,
  speedMultiplier,
} from '../powers';
import { ROVERS, UNITED } from '../teams';
import type { MatchState, PowerId } from '../types';

function matchWith(power: PowerId, slot = 10): { match: MatchState; hero: number } {
  const home = {
    ...ROVERS,
    players: ROVERS.players.map((player, idx) => ({
      ...player,
      attrs: { ...player.attrs },
      power: idx === slot ? power : undefined,
    })),
  };
  return { match: createMatch(117, home, UNITED), hero: slot };
}

describe('m1.17 authored one-moment powers', () => {
  it('commits Thunder Strike to driving through windup and shooting once active', () => {
    const { match, hero } = matchWith('THUNDER_STRIKE');
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 2250, y: 3000 };
    match.players[hero].powerState = { kind: 'winding', untilTick: 15, strength: 1 };
    expect(attackingDecision(match, hero).kind).toBe('carry');

    activatePower(match, hero, 1);
    expect(attackingDecision(match, hero).kind).toBe('shoot');
    possessionTick(match);
    expect(match.ball.kind).toBe('shot');
    expect(match.players[hero].powerState.kind).toBe('idle');
  });

  it('Portal Pass always exits ahead and selects the lane with room', () => {
    const { match, hero } = matchWith('PORTAL_PASS');
    const carrier = 6;
    match.ball = { kind: 'held', by: carrier };
    match.players[carrier].pos = { x: 2250, y: 5000 };
    for (let idx = 0; idx < 11; idx += 1) {
      if (idx !== carrier && idx !== hero) match.players[idx].pos = { x: 600, y: 7000 };
    }
    match.players[hero].pos = { x: 3600, y: 6200 };
    for (let idx = 11; idx < 22; idx += 1) match.players[idx].pos = { x: 600, y: 4800 };
    const beforeProgress = 10500 - match.players[carrier].pos.y;

    activatePower(match, hero, 1);

    expect(match.ball.kind).toBe('held');
    const receiver = match.ball.kind === 'held' ? match.ball.by : carrier;
    expect(receiver).not.toBe(carrier);
    expect(10500 - match.players[receiver].pos.y).toBeGreaterThan(beforeProgress);
    expect(match.players[receiver].pos.x).toBeGreaterThan(600);
  });

  it('Decoy Double holds one marker in a persistent false lane without a teamwide dribble bonus', () => {
    const { match, hero } = matchWith('DECOY_DOUBLE');
    const carrier = 6;
    const marker = 11;
    match.ball = { kind: 'held', by: carrier };
    match.players[carrier].pos = { x: 2600, y: 4000 };
    match.players[hero].pos = { x: 3400, y: 4300 };
    match.players[marker].pos = { x: 2700, y: 4000 };
    activatePower(match, hero, 1);
    const before = { ...match.players[marker].pos };
    movementTick(match);
    expect(match.players[marker].pos).not.toEqual(before);
    expect(dribbleBonus(match, carrier)).toBe(0);
  });

  it('Fire Torch only removes the goal-side marker on its hero attacking run', () => {
    const { match, hero } = matchWith('FIRE_TORCH');
    const behind = 11;
    const goalSide = 12;
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 2250, y: 4000 };
    match.players[behind].pos = { x: 2250, y: 4500 };
    match.players[goalSide].pos = { x: 2300, y: 3400 };
    activatePower(match, hero, 1);
    expect(match.players[goalSide].outReason).toBe('ignited');
    expect(match.players[behind].outReason).toBeUndefined();
  });

  it('Blink Run appears beyond the actual last defender and its next choice cannot be a pass', () => {
    const { match, hero } = matchWith('BLINK_RUN');
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 2250, y: 5000 };
    for (let idx = 11; idx < 22; idx += 1) {
      match.players[idx].pos = { x: idx % 2 === 0 ? 1200 : 3300, y: idx === 11 ? 300 : 3600 + (idx - 12) * 100 };
    }
    const lastDefenderY = Math.min(...match.players.slice(12, 22).map(player => player.pos.y));
    activatePower(match, hero, 1);
    expect(match.players[hero].pos.y).toBeLessThan(lastDefenderY);
    expect(attackingDecision(match, hero).kind).not.toBe('pass');
  });

  it('Phase Run cancels the first real challenge, then immediately allows ordinary shooting', () => {
    const { match, hero } = matchWith('PHASE_RUN');
    const defender = 11;
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 2250, y: 1500 };
    match.players[defender].pos = { x: 2250, y: 1600 };
    activatePower(match, hero, 1);
    tackleTick(match);
    expect(match.players[hero].powerState.kind).toBe('idle');
    expect(match.ball).toEqual({ kind: 'held', by: hero });
    expect(phaseRunPreventsShot(match, hero)).toBe(false);
  });

  it('Future Sight spends one read and commits the interception to a forward outlet', () => {
    const { match, hero } = matchWith('FUTURE_SIGHT');
    const passer = 11;
    const receiver = 12;
    match.players[hero].pos = { x: 2200, y: 5000 };
    match.players[receiver].pos = { x: 2300, y: 4800 };
    match.players[9].pos = { x: 2500, y: 3000 };
    match.ball = { kind: 'held', by: passer };
    activatePower(match, hero, 1, passer);
    launchPass(match, passer, receiver, false);
    const futureFlight = match.ball as unknown as Extract<MatchState['ball'], { kind: 'pass' }>;
    expect(futureFlight).toMatchObject({ kind: 'pass', interceptor: hero });
    futureFlight.pos = { ...match.players[hero].pos };
    possessionTick(match);
    expect(match.ball).toEqual({ kind: 'held', by: hero });
    const decision = attackingDecision(match, hero);
    expect(decision).toMatchObject({ kind: 'pass' });
    if (decision.kind === 'pass') expect(match.players[decision.to].pos.y).toBeLessThan(match.players[hero].pos.y);
  });

  it('Web and Ice spill the carrier toward a friendly recovery lane and consume once', () => {
    for (const power of ['WEB_TRAP', 'ICE_RINK'] as const) {
      const { match, hero } = matchWith(power);
      const victim = 11;
      match.players[hero].pos = { x: 1800, y: 5000 };
      match.players[victim].pos = { x: 2200, y: 5000 };
      match.ball = { kind: 'held', by: victim };
      activatePower(match, hero, 1, victim);
      powerTick(match);
      const spill = match.ball as unknown as Extract<MatchState['ball'], { kind: 'loose' }>;
      expect(spill).toMatchObject({ kind: 'loose' });
      expect(spill.vel).not.toEqual({ x: 0, y: 0 });
      expect(match.players[hero].powerState.kind).toBe('idle');
    }
  });

  it('Giant GK survives the dangerous attack while Elastic spends on the next on-target shot', () => {
    const giant = matchWith('GIANT_GK', 0);
    giant.match.ball = { kind: 'held', by: 20 };
    activatePower(giant.match, giant.hero, 1);
    const giantState = giant.match.players[giant.hero].powerState as Extract<
      MatchState['players'][number]['powerState'], { kind: 'active' }
    >;
    const until = giantState.untilTick;
    giant.match.tick = until + 1;
    powerTick(giant.match);
    expect(giant.match.players[giant.hero].powerState.kind).toBe('active');
    giant.match.ball = { kind: 'held', by: 1 };
    powerTick(giant.match);
    expect(giant.match.players[giant.hero].powerState.kind).toBe('idle');

    const elastic = matchWith('ELASTIC_KEEPER', 0);
    elastic.match.players[elastic.hero].pos = { x: 3400, y: 300 };
    elastic.match.ball = { kind: 'held', by: 20 };
    activatePower(elastic.match, elastic.hero, 1);
    elastic.match.ball = {
      kind: 'shot', pos: { x: 3400, y: 500 }, vel: { x: 0, y: 300 }, by: 20,
      power: 200, targetX: 3400, z: 0, vz: 0, trajectory: 'driven', keeperChecked: false,
    };
    shotFlightTick(elastic.match);
    expect(elastic.match.players[elastic.hero].powerState.kind).toBe('idle');
  });

  it('Super Strength manual timing and tiers scale pursuit and landing reach', () => {
    const auto = matchWith('SUPER_STRENGTH');
    const manual = matchWith('SUPER_STRENGTH');
    auto.match.players[auto.hero].def.powerTier = 1;
    manual.match.players[manual.hero].def.powerTier = 3;
    auto.match.players[auto.hero].powerState = { kind: 'winding', untilTick: 15, strength: 0.85, targetIdx: 11 };
    manual.match.players[manual.hero].powerState = { kind: 'winding', untilTick: 15, strength: 1, targetIdx: 11 };
    expect(speedMultiplier(manual.match, manual.hero)).toBeGreaterThan(speedMultiplier(auto.match, auto.hero));

    auto.match.players[auto.hero].pos = { x: 2000, y: 5000 };
    manual.match.players[manual.hero].pos = { x: 2000, y: 5000 };
    auto.match.players[11].pos = { x: 3040, y: 5000 };
    manual.match.players[11].pos = { x: 3040, y: 5000 };
    activatePower(auto.match, auto.hero, 0.85, 11);
    activatePower(manual.match, manual.hero, 1, 11);
    expect(auto.match.players[11].outReason).toBeUndefined();
    expect(manual.match.players[11].outReason).toBe('ko');
  });

  it('Gravity Well only fires in friendly possession and pulls markers once toward its off-ball hero', () => {
    const { match, hero } = matchWith('GRAVITY_WELL');
    const carrier = 6;
    match.players[hero].pos = { x: 2250, y: 5000 };
    match.players[carrier].pos = { x: 3300, y: 4800 };
    match.players[11].pos = { x: 3200, y: 5000 };
    match.ball = { kind: 'held', by: carrier };
    expect(inUsefulContext(match, hero)).toBe(true);
    const before = { ...match.players[11].pos };
    activatePower(match, hero, 1);
    const after = { ...match.players[11].pos };
    expect(after.x).toBeLessThan(before.x);
    powerTick(match);
    expect(match.players[11].pos).toEqual(after);
  });
});
