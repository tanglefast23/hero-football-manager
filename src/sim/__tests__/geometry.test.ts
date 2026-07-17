import { dist, dist2, moveToward, clamp, PITCH_W, PITCH_H, GOAL_W, GOAL_CENTER_X, TICK_MS, HALF_TICKS } from '../geometry';

describe('geometry', () => {
  it('constants match the design doc', () => {
    expect(TICK_MS).toBe(100);
    expect(HALF_TICKS).toBe(1000);
    expect(PITCH_W).toBe(6800);
    expect(PITCH_H).toBe(10500);
    expect(GOAL_W).toBe(1400);
    expect(GOAL_CENTER_X).toBe(3400);
  });

  it('dist is euclidean, rounded; dist2 is the exact integer square', () => {
    expect(dist({ x: 0, y: 0 }, { x: 300, y: 400 })).toBe(500);
    expect(dist2({ x: 0, y: 0 }, { x: 300, y: 400 })).toBe(250000);
  });

  it('moveToward advances by speed, never overshoots, stays integer', () => {
    expect(moveToward({ x: 0, y: 0 }, { x: 100, y: 0 }, 60)).toEqual({ x: 60, y: 0 });
    expect(moveToward({ x: 0, y: 0 }, { x: 30, y: 0 }, 60)).toEqual({ x: 30, y: 0 });
    const p = moveToward({ x: 0, y: 0 }, { x: 1000, y: 1000 }, 100);
    expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
  });

  it('clamp bounds values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});
