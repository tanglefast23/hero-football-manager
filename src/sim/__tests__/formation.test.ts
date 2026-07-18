import { anchorFor } from '../formation';
import { PITCH_W, PITCH_H } from '../geometry';

describe('formation 4-4-2', () => {
  it('team 0 GK anchors near its own goal (high y — team 0 attacks toward y=0)', () => {
    const gk = anchorFor(0, 0, { x: PITCH_W / 2, y: PITCH_H / 2 });
    expect(gk.y).toBeGreaterThan(PITCH_H * 0.85);
  });

  it('team 1 mirrors team 0', () => {
    const ball = { x: PITCH_W / 2, y: PITCH_H / 2 };
    const t0 = anchorFor(0, 5, ball);
    const t1 = anchorFor(1, 5, ball);
    expect(t1.y).toBe(PITCH_H - t0.y);
    expect(t1.x).toBe(t0.x);
  });

  it('anchors shift toward the ball', () => {
    const left = anchorFor(0, 5, { x: 0, y: PITCH_H / 2 });
    const right = anchorFor(0, 5, { x: PITCH_W, y: PITCH_H / 2 });
    expect(left.x).toBeLessThan(right.x);
  });

  it('all 11 slots are in-bounds integers', () => {
    for (let slot = 0; slot < 11; slot++) {
      const a = anchorFor(0, slot, { x: 100, y: 100 });
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(PITCH_W);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThanOrEqual(PITCH_H);
      expect(Number.isInteger(a.x) && Number.isInteger(a.y)).toBe(true);
    }
  });
});
