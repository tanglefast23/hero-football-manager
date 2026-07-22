import { createMatch, runMatch, tick } from '../match';
import { attackingDecision, attemptShot, drainStamina, effectiveStat, launchPass, movementTick, possessionTick, restartKickoff, speedFor, TACKLE_ATTEMPT_GAUGE, tackleTick } from '../engine';
import { ROVERS, UNITED } from '../teams';
import type { BallState } from '../types';
import { activatePower } from '../powers';

describe('possession', () => {
  it('hides Shadow Mark from pass choice, then consumes it on the ambush', () => {
    const inactive = createMatch(42, ROVERS, UNITED);
    const active = createMatch(42, ROVERS, UNITED);
    const passer = 5;
    const receiver = 6;
    const shadow = 13;
    for (const match of [inactive, active]) {
      match.ball = { kind: 'held', by: passer };
      match.players[passer].pos = { x: 2250, y: 7000 };
      match.players[receiver].pos = { x: 2250, y: 4700 };
      match.players[passer].def.attrs.pas = 45;
      match.players[shadow].def.attrs.def = 99;
      for (let index = 11; index < 22; index++) {
        match.players[index].pos = { x: 6500, y: 10000 };
      }
      match.players[shadow].pos = { ...match.players[receiver].pos };
      match.players[shadow].def.power = 'SHADOW_MARK';
    }
    activatePower(active, shadow, 1);

    expect(attackingDecision(active, passer).values.pass)
      .toBeGreaterThan(attackingDecision(inactive, passer).values.pass);

    active.players[passer].def.attrs.pas = 1;
    active.rng = () => 0.99;
    launchPass(active, passer, receiver, false);
    expect(active.ball).toMatchObject({
      kind: 'pass',
      willSucceed: false,
      interceptor: shadow,
    });
    const flight = active.ball as BallState;
    if (flight.kind !== 'pass') throw new Error('Shadow pass did not launch');
    flight.pos = { ...active.players[shadow].pos };
    possessionTick(active);

    expect(active.ball).toEqual({ kind: 'held', by: shadow });
    expect(active.players[shadow].powerState.kind).toBe('idle');
    expect(active.players[shadow].gauge).toBeGreaterThan(0);
  });

  it('spends Shadow Mark on a completed pass over the ambusher', () => {
    const match = createMatch(42, ROVERS, UNITED);
    const passer = 5;
    const receiver = 6;
    const shadow = 13;
    match.players[shadow].def.power = 'SHADOW_MARK';
    match.players[shadow].pos = { ...match.players[receiver].pos };
    activatePower(match, shadow, 1);
    match.ball = { kind: 'held', by: passer };
    match.rng = () => 0;

    launchPass(match, passer, receiver, false);
    expect(match.ball).toMatchObject({ kind: 'pass', willSucceed: true, interceptor: shadow });
    const flight = match.ball as BallState;
    if (flight.kind !== 'pass') throw new Error('completed Shadow pass did not launch');
    flight.pos = { ...match.players[receiver].pos };
    possessionTick(match);

    expect(match.ball).toEqual({ kind: 'held', by: receiver });
    expect(match.players[shadow].powerState.kind).toBe('idle');
  });

  it('spends Shadow Mark and earns attempt Heat when committing a slide', () => {
    const match = createMatch(42, ROVERS, UNITED);
    const shadow = 13;
    const target = 6;
    match.players[shadow].def.power = 'SHADOW_MARK';
    match.players[target].pos = { x: 2250, y: 5000 };
    match.players[shadow].pos = { x: 2250, y: 4100 };
    match.players[shadow].condition = 100;
    activatePower(match, shadow, 1);
    match.ball = { kind: 'held', by: target };

    tackleTick(match);

    expect(match.players[shadow].slideTackle).toMatchObject({
      targetIdx: target,
      shadowDefenseBonus: expect.any(Number),
    });
    expect(match.players[shadow].powerState.kind).toBe('idle');
    expect(match.players[shadow].gauge).toBe(TACKLE_ATTEMPT_GAUGE);
    restartKickoff(match, 0);
    expect(match.players[shadow].slideTackle).toBeUndefined();
    expect(match.players[shadow].powerState.kind).toBe('idle');
    expect(match.players[shadow].gauge).toBe(TACKLE_ATTEMPT_GAUGE);
  });

  it('spends Shadow Mark after its real pressure affects a shot', () => {
    const match = createMatch(42, ROVERS, UNITED);
    const shooter = 5;
    const shadow = 13;
    match.players[shooter].pos = { x: 2250, y: 3000 };
    match.players[shadow].pos = { x: 2250, y: 2750 };
    match.players[shadow].def.power = 'SHADOW_MARK';
    activatePower(match, shadow, 1);
    match.ball = { kind: 'held', by: shooter };

    attemptShot(match, shooter, 3000);

    expect(match.ball.kind).toBe('shot');
    expect(match.players[shadow].powerState.kind).toBe('idle');
  });

  it('passes happen and both teams touch the ball', () => {
    const r = runMatch(42, ROVERS, UNITED);
    const passes = r.events.filter(e => e.kind === 'PASS');
    expect(passes.length).toBeGreaterThan(10);
    const passers = new Set(passes.map(e => (e as { from: number }).from));
    expect([...passers].some(i => i < 11)).toBe(true);
    expect([...passers].some(i => i >= 11)).toBe(true);
  });

  it('some passes fail (interceptions exist)', () => {
    const r = runMatch(42, ROVERS, UNITED);
    expect(r.events.some(e => e.kind === 'PASS' && !(e as { ok: boolean }).ok)).toBe(true);
  });

  it('passes TRAVEL — the ball is observably in a pass state between launch and arrival', () => {
    const m = createMatch(42, ROVERS, UNITED);
    let sawFlight = false;
    for (let i = 0; i < 600 && !sawFlight; i++) {
      tick(m);
      if (m.ball.kind === 'pass') sawFlight = true;
    }
    expect(sawFlight).toBe(true);
  });

  it('can turn an ordinary failed pass into a deterministic loose-ball contest', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const passer = 5;
    const receiver = 6;
    const interceptor = 13;
    m.ball = { kind: 'held', by: passer };
    m.players[passer].pos = { x: 1000, y: 5000 };
    m.players[receiver].pos = { x: 3000, y: 5000 };
    for (let index = 11; index < 22; index++) m.players[index].pos = { x: 6500, y: 10000 };
    m.players[interceptor].pos = { ...m.players[receiver].pos };
    m.players[passer].def.attrs.pas = 1;
    m.players[interceptor].def.attrs.def = 99;
    const rolls = [0.99, 0];
    m.rng = () => rolls.shift() ?? 0;

    launchPass(m, passer, receiver, false);

    expect(m.ball).toMatchObject({
      kind: 'pass',
      willSucceed: false,
      interceptor,
      looseOnArrival: true,
    });
    const failedFlight = m.ball as BallState;
    if (failedFlight.kind !== 'pass') throw new Error('pass did not launch');
    failedFlight.pos = { ...m.players[interceptor].pos };
    possessionTick(m);
    expect(m.ball).toMatchObject({ kind: 'loose' });
  });

  it('delivers a successful pass cleanly when there is no eligible interceptor', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const passer = 5;
    const receiver = 6;
    m.ball = { kind: 'held', by: passer };
    for (let index = 11; index < 22; index++) {
      m.players[index].outUntilTick = 100;
      m.players[index].outReason = 'ko';
    }
    m.rng = () => 0;

    launchPass(m, passer, receiver, false);

    expect(m.events.at(-1)).toMatchObject({ kind: 'PASS', from: passer, to: receiver, ok: true });
    expect(m.ball).toMatchObject({
      kind: 'pass',
      willSucceed: true,
      interceptor: -1,
      looseOnArrival: false,
    });
    const flight = m.ball as BallState;
    if (flight.kind !== 'pass') throw new Error('pass did not launch');
    flight.pos = { ...m.players[receiver].pos };
    possessionTick(m);
    expect(m.ball).toEqual({ kind: 'held', by: receiver });
  });

  it('lets Gust bend the next enemy pass loose toward a recovery lane, then consumes', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const passer = 5;
    const receiver = 6;
    const gustHero = 13;
    m.players[gustHero].def.power = 'GUST';
    activatePower(m, gustHero, 1);
    m.ball = { kind: 'held', by: passer };
    m.rng = () => 0;

    launchPass(m, passer, receiver, false);

    expect(m.ball).toMatchObject({
      kind: 'pass',
      willSucceed: false,
      interceptor: -1,
      looseOnArrival: true,
    });
    expect(m.players[gustHero].powerState.kind).toBe('idle');
    const gustFlight = m.ball as BallState;
    if (gustFlight.kind !== 'pass') throw new Error('pass did not launch');
    expect(gustFlight.deflectionVel).toBeDefined();
    gustFlight.pos = { ...m.players[receiver].pos };
    possessionTick(m);
    expect(m.ball).toMatchObject({ kind: 'loose' });

    m.ball = { kind: 'held', by: passer };
    launchPass(m, passer, receiver, false);
    expect(m.ball).toMatchObject({ kind: 'pass' });
    const ordinaryFlight = m.ball as unknown as Extract<BallState, { kind: 'pass' }>;
    expect(ordinaryFlight.looseOnArrival).not.toBe(true);
  });

  it('remains deterministic', () => {
    expect(runMatch(9, ROVERS, UNITED).events).toEqual(runMatch(9, ROVERS, UNITED).events);
  });

  it('loose balls decay and get picked up by the nearest available player', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.ball = { kind: 'loose', pos: { x: 3400, y: 5250 }, vel: { x: 200, y: 0 }, z: 0, vz: 0 } as BallState;
    const before = m.ball.kind === 'loose' ? { ...m.ball.vel } : { x: 0, y: 0 };
    tick(m);
    if (m.ball.kind === 'loose') {
      expect(Math.abs(m.ball.vel.x)).toBeLessThan(Math.abs(before.x));
    }
    let picked = false;
    for (let i = 0; i < 100 && !picked; i++) {
      tick(m);
      if (m.ball.kind === 'held') picked = true;
    }
    expect(picked).toBe(true);
  });

  it('out players cannot pick up a loose ball', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const nearIdx = 6;
    m.ball = { kind: 'loose', pos: { ...m.players[nearIdx].pos }, vel: { x: 0, y: 0 }, z: 0, vz: 0 } as BallState;
    m.players[nearIdx].outUntilTick = m.tick + 500;
    m.players[nearIdx].outReason = 'ko';
    tick(m);
    if (m.ball.kind === 'held') {
      expect(m.ball.by).not.toBe(nearIdx);
    }
  });

  it('a pass target KO\'d mid-flight cannot receive the ball unconscious (phantom-pass bug)', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const targetPos = { ...m.players[6].pos };
    m.ball = {
      kind: 'pass', pos: { x: targetPos.x - 2000, y: targetPos.y }, from: 5, to: 6,
      willSucceed: true, interceptor: -1, z: 0, vz: 0, speed: 250,
    } as BallState;
    m.players[6].outUntilTick = m.tick + 300;
    m.players[6].outReason = 'ko';
    let flying = true;
    for (let i = 0; i < 200 && flying; i++) {
      tick(m);
      flying = m.ball.kind === 'pass';
    }
    expect(flying).toBe(false);
    if (m.ball.kind === 'held') {
      expect(m.ball.by).not.toBe(6);
    } else {
      expect(m.ball.kind).toBe('loose');
    }
  });
});

describe('tackling', () => {
  function rigChallenge(distance: number, condition = 100) {
    const m = createMatch(42, ROVERS, UNITED);
    const carrierIdx = 9;
    const tacklerIdx = 13;
    m.ball = { kind: 'held', by: carrierIdx };
    m.players[carrierIdx].pos = { x: 3400, y: 3000 };
    // Rovers attack toward y=0, so this is goal-side rather than a lunge from
    // behind. The tackler slides down-screen toward the carrier.
    m.players[tacklerIdx].pos = { x: 3400, y: 3000 - distance };
    m.players[tacklerIdx].condition = condition;
    for (let i = 11; i < 22; i++) {
      if (i !== tacklerIdx) m.players[i].pos = { x: 200, y: 9000 };
    }
    return { m, carrierIdx, tacklerIdx };
  }

  it('tackles occur, some won and some lost', () => {
    const r = runMatch(42, ROVERS, UNITED);
    const tackles = r.events.filter(e => e.kind === 'TACKLE') as Array<{ won: boolean }>;
    expect(tackles.length).toBeGreaterThan(5);
    expect(tackles.some(t => t.won)).toBe(true);
    expect(tackles.some(t => !t.won)).toBe(true);
  });

  it('uses a standing tackle inside 2m instead of turning every challenge into a slide', () => {
    const { m, tacklerIdx } = rigChallenge(150);
    tackleTick(m);
    const tackle = m.events.find(e => e.kind === 'TACKLE');
    expect(tackle).toMatchObject({ kind: 'TACKLE', by: tacklerIdx, style: 'standing', contact: true });
    expect(m.players[tacklerIdx].slideTackle).toBeUndefined();
  });

  it('launches a visibly long slide from range, moves the real sim coordinate faster than running, and recovers where it lands', () => {
    const { m, carrierIdx, tacklerIdx } = rigChallenge(1000, 90);
    m.players[tacklerIdx].def.attrs.def = 99;
    m.players[carrierIdx].def.attrs.tec = 1;
    const ordinarySpeed = speedFor(m, tacklerIdx);
    const conditionBefore = m.players[tacklerIdx].condition;

    tackleTick(m);
    expect(m.events.at(-1)).toMatchObject({ kind: 'SLIDE_STARTED', by: tacklerIdx, on: carrierIdx });
    expect(m.players[tacklerIdx].slideTackle).toBeDefined();
    expect(m.players[tacklerIdx].condition).toBeLessThan(conditionBefore);
    expect(m.players[tacklerIdx].tackleCooldownUntil).toBeGreaterThanOrEqual(m.tick + 20);

    const launchPos = { ...m.players[tacklerIdx].pos };
    m.tick++;
    movementTick(m);
    const firstStep = Math.hypot(
      m.players[tacklerIdx].pos.x - launchPos.x,
      m.players[tacklerIdx].pos.y - launchPos.y,
    );
    expect(firstStep).toBeGreaterThan(ordinarySpeed);
    tackleTick(m);
    for (let i = 0; i < 5 && m.players[tacklerIdx].slideTackle; i++) {
      m.tick++;
      movementTick(m);
      tackleTick(m);
    }

    const resolved = m.events.find(e => e.kind === 'TACKLE' && e.style === 'slide');
    expect(resolved).toMatchObject({ by: tacklerIdx, on: carrierIdx, won: true, contact: true });
    expect(m.players[tacklerIdx].slideTackle).toBeUndefined();
    expect(m.players[tacklerIdx].tackleRecoveryUntil).toBeGreaterThan(m.tick);

    const landingPos = { ...m.players[tacklerIdx].pos };
    expect(Math.hypot(landingPos.x - launchPos.x, landingPos.y - launchPos.y)).toBeGreaterThanOrEqual(800);
    m.tick++;
    movementTick(m);
    expect(m.players[tacklerIdx].pos).toEqual(landingPos);
    expect(m.players[tacklerIdx].pos).not.toEqual(launchPos);
  });

  it('finishes the committed long travel when the target releases the ball', () => {
    const { m, tacklerIdx } = rigChallenge(1000, 90);
    tackleTick(m);
    const launchPos = { ...m.players[tacklerIdx].pos };
    m.ball = { kind: 'held', by: 8 };

    for (let i = 0; i < 8 && m.players[tacklerIdx].slideTackle; i++) {
      m.tick++;
      movementTick(m);
      tackleTick(m);
    }

    expect(Math.hypot(
      m.players[tacklerIdx].pos.x - launchPos.x,
      m.players[tacklerIdx].pos.y - launchPos.y,
    )).toBeGreaterThanOrEqual(800);
    expect(m.events.at(-1)).toMatchObject({
      kind: 'TACKLE',
      by: tacklerIdx,
      won: false,
      style: 'slide',
      contact: false,
    });
  });

  it('treats 80% as the preferred slide band, narrows reach below it, and keeps a 30% hard floor', () => {
    const tired = rigChallenge(400, 29);
    tackleTick(tired.m);
    expect(tired.m.players[tired.tacklerIdx].slideTackle).toBeUndefined();

    const middling = rigChallenge(1050, 60);
    middling.m.players[middling.tacklerIdx].def.attrs.def = 1;
    middling.m.players[middling.carrierIdx].def.attrs.tec = 99;
    tackleTick(middling.m);
    expect(middling.m.players[middling.tacklerIdx].slideTackle).toBeUndefined();

    const closerMiddling = rigChallenge(950, 60);
    closerMiddling.m.players[closerMiddling.tacklerIdx].def.attrs.def = 1;
    closerMiddling.m.players[closerMiddling.carrierIdx].def.attrs.tec = 99;
    tackleTick(closerMiddling.m);
    expect(closerMiddling.m.players[closerMiddling.tacklerIdx].slideTackle).toBeDefined();

    const emergency = rigChallenge(900, 40);
    emergency.m.players[emergency.carrierIdx].pos = { x: 3400, y: 1000 };
    emergency.m.players[emergency.tacklerIdx].pos = { x: 3400, y: 100 };
    emergency.m.players[emergency.tacklerIdx].def.attrs.def = 99;
    emergency.m.players[emergency.carrierIdx].def.attrs.tec = 1;
    tackleTick(emergency.m);
    expect(emergency.m.players[emergency.tacklerIdx].slideTackle).toBeDefined();
  });

  it('the nearest defender presses the carrier (closes distance while possession is held)', () => {
    const m = createMatch(42, ROVERS, UNITED);
    for (let i = 0; i < 5 && m.ball.kind !== 'held'; i++) tick(m);
    expect(m.ball.kind).toBe('held');
    if (m.ball.kind !== 'held') return;
    const carrier = m.ball.by;
    const presser = m.players.map((p, i) => ({ i, d: p.team !== m.players[carrier].team ? Math.hypot(p.pos.x - m.players[carrier].pos.x, p.pos.y - m.players[carrier].pos.y) : Infinity }))
      .sort((a, b) => a.d - b.d)[0];
    const dBefore = presser.d;
    for (let i = 0; i < 20 && m.ball.kind === 'held' && m.ball.by === carrier; i++) tick(m);
    const dAfter = Math.hypot(m.players[presser.i].pos.x - m.players[carrier].pos.x, m.players[presser.i].pos.y - m.players[carrier].pos.y);
    expect(dAfter).toBeLessThan(dBefore);
  });

  it('the nearest eligible defender makes the tackle attempt, not the lowest index', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.ball = { kind: 'held', by: 9 };
    m.players[9].pos = { x: 3400, y: 3000 };
    m.players[11].pos = { x: 3400, y: 3240 };
    m.players[16].pos = { x: 3400, y: 3100 };
    for (const idx of [12, 13, 14, 15, 17, 18, 19, 20, 21]) {
      m.players[idx].pos = { x: 200, y: 9000 };
    }
    m.players[11].tackleCooldownUntil = 0;
    m.players[16].tackleCooldownUntil = 0;
    tick(m);
    const tackle = m.events.filter(e => e.kind === 'TACKLE').pop() as { by: number } | undefined;
    expect(tackle).toBeDefined();
    expect(tackle?.by).toBe(16);
  });
});

describe('condition and STA', () => {
  it('uses condition once to scale effective stats and speed by at most 25%', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const idx = 5;
    m.players[idx].condition = 100;
    expect(effectiveStat(m, idx, 'def')).toBe(m.players[idx].def.attrs.def);
    const freshSpeed = speedFor(m, idx);
    m.players[idx].condition = 0;
    expect(effectiveStat(m, idx, 'def')).toBe(Math.round(m.players[idx].def.attrs.def * 0.75));
    expect(speedFor(m, idx)).toBeLessThan(freshSpeed);
  });

  it('makes low-STA players drain condition faster for the same movement', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const low = m.players[5];
    const high = m.players[6];
    low.def.attrs.sta = 20;
    high.def.attrs.sta = 90;
    low.condition = high.condition = 100;
    drainStamina(low, true);
    drainStamina(high, true);
    expect(low.condition).toBeLessThan(high.condition);
  });

  it('applies Energy Use to real off-ball movement but never to carrier speed', () => {
    const movement = (energyUse: 'SAVE_ENERGY' | 'BALANCED' | 'ALL_OUT', condition: number, playerIndex: number) => {
      const m = createMatch(42, ROVERS, UNITED);
      m.tactics[0].energyUse = energyUse;
      m.players[playerIndex].condition = condition;
      const before = { ...m.players[playerIndex].pos };
      movementTick(m);
      return Math.hypot(
        m.players[playerIndex].pos.x - before.x,
        m.players[playerIndex].pos.y - before.y,
      );
    };

    const saved = movement('SAVE_ENERGY', 100, 5);
    const balanced = movement('BALANCED', 100, 5);
    const allOut = movement('ALL_OUT', 100, 5);
    expect(saved).toBeLessThan(balanced);
    expect(balanced).toBeLessThan(allOut);
    expect(movement('ALL_OUT', 0, 5)).toBeCloseTo(movement('BALANCED', 0, 5), 5);
    expect(movement('SAVE_ENERGY', 100, 9)).toBeCloseTo(movement('ALL_OUT', 100, 9), 5);
  });

  it('applies the selected Energy Use multiplier to slide-tackle condition cost', () => {
    const slideLoss = (energyUse: 'SAVE_ENERGY' | 'BALANCED' | 'ALL_OUT') => {
      const m = createMatch(42, ROVERS, UNITED);
      const carrierIdx = 9;
      const tacklerIdx = 13;
      m.tactics[1].energyUse = energyUse;
      m.ball = { kind: 'held', by: carrierIdx };
      m.players[carrierIdx].pos = { x: 3400, y: 3000 };
      m.players[tacklerIdx].pos = { x: 3400, y: 2100 };
      m.players[tacklerIdx].condition = 90;
      for (let index = 11; index < 22; index += 1) {
        if (index !== tacklerIdx) m.players[index].pos = { x: 200, y: 9000 };
      }
      const before = m.players[tacklerIdx].condition;
      tackleTick(m);
      expect(m.players[tacklerIdx].slideTackle).toBeDefined();
      return before - m.players[tacklerIdx].condition;
    };

    expect(slideLoss('SAVE_ENERGY')).toBeLessThan(slideLoss('BALANCED'));
    expect(slideLoss('BALANCED')).toBeLessThan(slideLoss('ALL_OUT'));
  });
});
