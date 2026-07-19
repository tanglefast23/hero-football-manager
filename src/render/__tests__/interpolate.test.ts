import { lerpVec, lerpFrame, snapshotFrame } from '../interpolate';
import { createMatch, tick } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';
import { ZONE_WINDOW_TICKS } from '../../sim/powers';

describe('lerpVec', () => {
  it('blends between two points', () => {
    expect(lerpVec({ x: 0, y: 0 }, { x: 100, y: 200 }, 0.5)).toEqual({ x: 50, y: 100 });
    expect(lerpVec({ x: 0, y: 0 }, { x: 100, y: 200 }, 0)).toEqual({ x: 0, y: 0 });
    expect(lerpVec({ x: 0, y: 0 }, { x: 100, y: 200 }, 1)).toEqual({ x: 100, y: 200 });
  });
});

describe('snapshotFrame', () => {
  it('captures players, ball, carrier, statuses, zoneFraction, moved, and travel', () => {
    const m = createMatch(42, ROVERS, UNITED);
    tick(m);
    const s = snapshotFrame(m);
    expect(s.players).toHaveLength(22);
    expect(s.statuses).toHaveLength(22);
    expect(s.zoneFraction).toHaveLength(22);
    expect(s.moved).toHaveLength(22);
    expect(s.travel).toHaveLength(22);
    expect(typeof s.carrier).toBe('number');
    expect(s.ball).toBeDefined();
    expect(s.ballHeight).toBe(0);
  });

  it('moved defaults to false for every player when no prev positions are given', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const s = snapshotFrame(m);
    expect(s.moved.every((v) => v === false)).toBe(true);
    expect(s.travel.every((v) => v === 0)).toBe(true);
  });

  it('moved is true only for players whose position changed since the passed prev positions', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const before = snapshotFrame(m);
    tick(m);
    const after = snapshotFrame(m, before);
    expect(after.moved.some(Boolean)).toBe(true);
    for (let i = 0; i < 22; i++) {
      const changed = before.players[i].x !== after.players[i].x || before.players[i].y !== after.players[i].y;
      expect(after.moved[i]).toBe(changed);
    }
  });

  it('accumulates the actual distance each player travelled', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const before = snapshotFrame(m);
    tick(m);
    const after = snapshotFrame(m, before);
    for (let i = 0; i < 22; i++) {
      const dx = after.players[i].x - before.players[i].x;
      const dy = after.players[i].y - before.players[i].y;
      expect(after.travel[i]).toBeCloseTo(Math.sqrt(dx * dx + dy * dy));
    }
  });

  it('statuses report "ok" for an untouched player at kickoff', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const s = snapshotFrame(m);
    expect(s.statuses.every((st) => st === 'ok')).toBe(true);
  });

  it('statuses report "zone" (not "ready") for a hero in the zone window, with zoneFraction = remainingTicks / 70', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[9].powerState = { kind: 'zone', remainingTicks: 35 };
    const s = snapshotFrame(m);
    expect(s.statuses[9]).toBe('zone');
    expect(s.zoneFraction[9]).toBeCloseTo(35 / ZONE_WINDOW_TICKS);
  });

  it('zoneFraction is 0 for every player not currently in the zone window', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const s = snapshotFrame(m);
    expect(s.zoneFraction.every((f) => f === 0)).toBe(true);
  });

  it('statuses report "windup" while winding and "active" once fired', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[9].powerState = { kind: 'winding', untilTick: m.tick + 15, strength: 1 };
    expect(snapshotFrame(m).statuses[9]).toBe('windup');
    m.players[9].powerState = { kind: 'active', untilTick: m.tick + 80, strength: 1 };
    expect(snapshotFrame(m).statuses[9]).toBe('active');
  });

  it('statuses report "ignited" or "out" per outReason while a player is unavailable', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[3].outUntilTick = m.tick + 140;
    m.players[3].outReason = 'ignited';
    m.players[15].outUntilTick = m.tick + 80;
    m.players[15].outReason = 'ko';
    const s = snapshotFrame(m);
    expect(s.statuses[3]).toBe('ignited');
    expect(s.statuses[15]).toBe('out');
  });

  it('statuses expose committed slide movement and its recovery window', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[3].slideTackle = {
      targetIdx: 14,
      startTick: m.tick,
      untilTick: m.tick + 4,
      direction: { x: 1, y: 0 },
      remainingDistance: 400,
      previousPos: { ...m.players[3].pos },
      targetPreviousPos: { ...m.players[14].pos },
    };
    expect(snapshotFrame(m).statuses[3]).toBe('sliding');
    m.players[3].slideTackle = undefined;
    m.players[3].tackleRecoveryUntil = m.tick + 6;
    expect(snapshotFrame(m).statuses[3]).toBe('recovering');
  });

  it('carrier is -1 when the ball is not held', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.ball = { kind: 'loose', pos: { x: 100, y: 100 }, vel: { x: 0, y: 0 }, z: 0, vz: 0 };
    expect(snapshotFrame(m).carrier).toBe(-1);
  });

  it('ball is a copy, never an alias of live sim state', () => {
    const m = createMatch(42, ROVERS, UNITED);
    if (m.ball.kind !== 'held') throw new Error('expected kickoff ball to be held');
    const carrierPos = m.players[m.ball.by].pos;
    expect(snapshotFrame(m).ball).not.toBe(carrierPos);
    expect(snapshotFrame(m).ball).toEqual(carrierPos);

    const loosePos = { x: 100, y: 100 };
    m.ball = { kind: 'loose', pos: loosePos, vel: { x: 0, y: 0 }, z: 0, vz: 0 };
    expect(snapshotFrame(m).ball).not.toBe(loosePos);
    expect(snapshotFrame(m).ball).toEqual(loosePos);
  });

  it('captures and interpolates airborne ball height', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const prev = snapshotFrame(m);
    m.ball = {
      kind: 'pass', pos: { x: 2000, y: 2000 }, from: 1, to: 2,
      willSucceed: true, interceptor: -1, z: 180, vz: 20, speed: 250,
    };
    const next = snapshotFrame(m, prev);
    expect(next.ballHeight).toBe(180);
    expect(lerpFrame(prev, next, 0.5).ballHeight).toBe(90);
  });
});

describe('lerpFrame', () => {
  it('blends player and ball positions but carries statuses/carrier/zoneFraction/moved from next', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const prev = snapshotFrame(m);
    tick(m);
    const next = snapshotFrame(m, prev);
    const mid = lerpFrame(prev, next, 0.5);
    expect(mid.carrier).toBe(next.carrier);
    expect(mid.statuses).toBe(next.statuses);
    expect(mid.zoneFraction).toBe(next.zoneFraction);
    expect(mid.moved).toBe(next.moved);
    for (let i = 0; i < 22; i++) {
      expect(mid.travel[i]).toBeCloseTo((prev.travel[i] + next.travel[i]) / 2);
    }
    for (let i = 0; i < 22; i++) {
      expect(mid.players[i]).toEqual(lerpVec(prev.players[i], next.players[i], 0.5));
    }
    expect(mid.ball).toEqual(lerpVec(prev.ball, next.ball, 0.5));
    expect(mid.ballHeight).toBeCloseTo((prev.ballHeight + next.ballHeight) / 2);
  });
});
