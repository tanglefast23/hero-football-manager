import { createMatch, runMatch, tick } from '../match';
import { drainStamina, effectiveStat, movementTick, speedFor, tackleTick } from '../engine';
import { ROVERS, UNITED } from '../teams';
import type { BallState } from '../types';

describe('possession', () => {
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

  it('remains deterministic', () => {
    expect(runMatch(9, ROVERS, UNITED).events).toEqual(runMatch(9, ROVERS, UNITED).events);
  });

  it('loose balls decay and get picked up by the nearest available player', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.ball = { kind: 'loose', pos: { x: 3400, y: 5250 }, vel: { x: 200, y: 0 } } as BallState;
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
    m.ball = { kind: 'loose', pos: { ...m.players[nearIdx].pos }, vel: { x: 0, y: 0 } } as BallState;
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
    m.ball = { kind: 'pass', pos: { x: targetPos.x - 2000, y: targetPos.y }, from: 5, to: 6, willSucceed: true, interceptor: -1 } as BallState;
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

  it('launches from range, moves the real sim coordinate faster than running, and recovers where it lands', () => {
    const { m, carrierIdx, tacklerIdx } = rigChallenge(400, 90);
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
    if (m.players[tacklerIdx].slideTackle) {
      m.tick++;
      movementTick(m);
      tackleTick(m);
    }

    const resolved = m.events.find(e => e.kind === 'TACKLE' && e.style === 'slide');
    expect(resolved).toMatchObject({ by: tacklerIdx, on: carrierIdx, won: true, contact: true });
    expect(m.players[tacklerIdx].slideTackle).toBeUndefined();
    expect(m.players[tacklerIdx].tackleRecoveryUntil).toBeGreaterThan(m.tick);

    const landingPos = { ...m.players[tacklerIdx].pos };
    m.tick++;
    movementTick(m);
    expect(m.players[tacklerIdx].pos).toEqual(landingPos);
    expect(m.players[tacklerIdx].pos).not.toEqual(launchPos);
  });

  it('treats 80% as the preferred slide band, narrows reach below it, and keeps a 30% hard floor', () => {
    const tired = rigChallenge(400, 29);
    tackleTick(tired.m);
    expect(tired.m.players[tired.tacklerIdx].slideTackle).toBeUndefined();

    const middling = rigChallenge(400, 60);
    middling.m.players[middling.tacklerIdx].def.attrs.def = 1;
    middling.m.players[middling.carrierIdx].def.attrs.tec = 99;
    tackleTick(middling.m);
    expect(middling.m.players[middling.tacklerIdx].slideTackle).toBeUndefined();

    const closerMiddling = rigChallenge(350, 60);
    closerMiddling.m.players[closerMiddling.tacklerIdx].def.attrs.def = 1;
    closerMiddling.m.players[closerMiddling.carrierIdx].def.attrs.tec = 99;
    tackleTick(closerMiddling.m);
    expect(closerMiddling.m.players[closerMiddling.tacklerIdx].slideTackle).toBeDefined();

    const emergency = rigChallenge(400, 40);
    emergency.m.players[emergency.carrierIdx].pos = { x: 3400, y: 1000 };
    emergency.m.players[emergency.tacklerIdx].pos = { x: 3400, y: 700 };
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
});
