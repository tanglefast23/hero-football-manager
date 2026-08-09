import { gkTarget, kickoffPos } from '../movement-table';
import { createMatch } from '../match';
import { restartKickoff } from '../engine';
import { ROVERS, UNITED } from '../teams';
import { PITCH_W, PITCH_H, GOAL_CENTER_X, dist, type Vec } from '../geometry';

// Verification suite for GK angle-narrowing (m0.6, T7 — the follow-up the m0.5
// positional-movement spec deferred). The keeper stands on the goal-center→ball
// ray at a depth that grows as the ball approaches, clamped to penalty-box
// bounds. Constants under test (movement-table.ts): depth MIN 200 / MAX 1000,
// slope 0.2 (ramp ends at 4000 cm), box half-width 2015, box depth 1650.

const rot = (v: Vec): Vec => ({ x: PITCH_W - v.x, y: PITCH_H - v.y });

// Team-0 own goal center (team 0 defends the y = PITCH_H end).
const GOAL0: Vec = { x: GOAL_CENTER_X, y: PITCH_H };

// In-pitch probe grid (edges, near-edges, thirds, center — movement-rework style).
const IN_PITCH: Vec[] = [];
for (const x of [0, 137, 1700, 3400, 5100, 6663, 6800]) {
  for (const y of [0, 251, 2625, 5250, 7875, 10249, 10500])
    IN_PITCH.push({ x, y });
}

// Wider sweep including out-of-pitch transients (a shot-flight ball can sit
// beyond the goal line for a tick before shotFlightTick resolves it).
const WITH_TRANSIENTS: Vec[] = [...IN_PITCH];
for (const x of [-400, 3400, 7200]) {
  for (const y of [-600, 5250, 10800]) WITH_TRANSIENTS.push({ x, y });
}

describe('GK angle-narrowing: ray collinearity', () => {
  it('team 0 stands on the goal-center→ball ray within 1 cm across the in-pitch sweep', () => {
    for (const ball of IN_PITCH) {
      const d = Math.hypot(ball.x - GOAL0.x, ball.y - GOAL0.y);
      if (d === 0) continue; // degenerate ray, asserted separately below
      const p = gkTarget(0, ball);
      const cross =
        (ball.x - GOAL0.x) * (p.y - GOAL0.y) -
        (ball.y - GOAL0.y) * (p.x - GOAL0.x);
      expect(Math.abs(cross) / d).toBeLessThanOrEqual(1); // perpendicular distance off the ray
    }
  });

  it('a ball exactly at the goal center degenerates to the goal center itself', () => {
    expect(gkTarget(0, { ...GOAL0 })).toEqual(GOAL0);
    expect(gkTarget(1, rot(GOAL0))).toEqual(rot(GOAL0));
  });
});

describe('GK angle-narrowing: team mirror', () => {
  it('property: team 1 target == 180-degree rotation of team 0 sampled at the rotated ball (exact)', () => {
    for (const ball of WITH_TRANSIENTS) {
      expect(gkTarget(1, ball)).toEqual(rot(gkTarget(0, rot(ball))));
    }
  });
});

describe('GK angle-narrowing: depth ramp', () => {
  // Straight-ahead approach (x = GOAL_CENTER_X): off-line depth is exactly
  // PITCH_H - target.y. Expected values from depth = clamp(1000 - 0.2d, 200, 1000):
  // the far clamp holds to d = 4000, then the ramp adds 1 cm of depth per 5 cm
  // of approach down to d = 1000.
  const RAMP: Array<[number, number]> = [
    [5250, 200],
    [4500, 200],
    [4000, 200],
    [3500, 300],
    [3000, 400],
    [2500, 500],
    [2000, 600],
    [1500, 700],
    [1000, 800],
  ];

  it('depth grows monotonically as the ball approaches, both teams (exact expected values)', () => {
    let prev = -1;
    for (const [d, expected] of RAMP) {
      const depth0 =
        PITCH_H - gkTarget(0, { x: GOAL_CENTER_X, y: PITCH_H - d }).y;
      const depth1 = gkTarget(1, { x: GOAL_CENTER_X, y: d }).y; // team 1 defends y = 0
      expect(depth0).toBe(expected);
      expect(depth1).toBe(expected);
      expect(depth0).toBeGreaterThanOrEqual(prev); // non-decreasing as d shrinks
      prev = depth0;
    }
    // Strictly increasing inside the ramp (d in (1000, 4000)).
    const inRamp = RAMP.filter(([d]) => d <= 4000);
    for (let i = 1; i < inRamp.length; i++) {
      expect(inRamp[i][1]).toBeGreaterThan(inRamp[i - 1][1]);
    }
  });

  it('the keeper is never placed beyond the ball (rush-out caps at the ball itself)', () => {
    for (const ball of [
      { x: GOAL_CENTER_X, y: PITCH_H - 100 },
      { x: GOAL_CENTER_X, y: PITCH_H - 600 },
      { x: 2400, y: 9500 }, // diagonal, d ~ 1414
      { x: 6800, y: 10500 }, // corner, along the goal line
    ]) {
      const p = gkTarget(0, ball);
      expect(dist(GOAL0, p)).toBeLessThanOrEqual(dist(GOAL0, ball) + 1); // +1: integer-cm rounding
    }
  });
});

describe('GK angle-narrowing: clamps', () => {
  it('never outside penalty-box width/depth, never behind the goal line, integer cm (sweep incl. transients)', () => {
    for (const ball of WITH_TRANSIENTS) {
      const p0 = gkTarget(0, ball);
      expect(Number.isInteger(p0.x) && Number.isInteger(p0.y)).toBe(true);
      expect(p0.x).toBeGreaterThanOrEqual(GOAL_CENTER_X - 2015);
      expect(p0.x).toBeLessThanOrEqual(GOAL_CENTER_X + 2015);
      expect(p0.y).toBeGreaterThanOrEqual(PITCH_H - 1650);
      expect(p0.y).toBeLessThanOrEqual(PITCH_H); // never behind own goal line
      const p1 = gkTarget(1, ball);
      expect(Number.isInteger(p1.x) && Number.isInteger(p1.y)).toBe(true);
      expect(p1.x).toBeGreaterThanOrEqual(GOAL_CENTER_X - 2015);
      expect(p1.x).toBeLessThanOrEqual(GOAL_CENTER_X + 2015);
      expect(p1.y).toBeGreaterThanOrEqual(0);
      expect(p1.y).toBeLessThanOrEqual(1650);
    }
  });
});

describe('GK angle-narrowing: kickoff/restart legality', () => {
  it('both GKs restart at the frozen m0.4-derived spot, inside their own half and the box clamps', () => {
    const m = createMatch(7, ROVERS, UNITED);
    expect(m.players[0].pos).toEqual({ x: 3400, y: 9408 });
    expect(m.players[11].pos).toEqual({ x: PITCH_W - 3400, y: PITCH_H - 9408 });
    restartKickoff(m, 1); // e.g. after a home goal — same placement rule
    expect(m.players[0].pos).toEqual({ x: 3400, y: 9408 });
    expect(m.players[11].pos).toEqual({ x: 3400, y: 1092 });
    for (const [idx, ownHalf] of [
      [0, (y: number) => y >= PITCH_H / 2],
      [11, (y: number) => y <= PITCH_H / 2],
    ] as const) {
      const p = m.players[idx].pos;
      expect(ownHalf(p.y)).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(GOAL_CENTER_X - 2015);
      expect(p.x).toBeLessThanOrEqual(GOAL_CENTER_X + 2015);
    }
    expect(kickoffPos(0, 0)).toEqual({ x: 3400, y: 9408 });
    expect(kickoffPos(1, 0)).toEqual({ x: 3400, y: 1092 });
  });
});
