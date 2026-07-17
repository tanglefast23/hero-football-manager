import { createMatch, runMatch, tick } from '../match';
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
});
