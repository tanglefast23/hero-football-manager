export interface Vec {
  x: number;
  y: number;
}

export const TICK_MS = 100;
export const HALF_TICKS = 1000;
export const PITCH_W = 6800;
export const PITCH_H = 10500;
export const GOAL_W = 1400;
export const GOAL_CENTER_X = PITCH_W / 2;

/**
 * Whether a shot's stamped aim is inside the posts. A pure read of launch
 * state: `targetX` never changes during the flight, so this is answerable the
 * moment the ball leaves the boot — ticks before SAVE, GOAL or MISS exists.
 * The engine, GK Zone windows and the renderer all grade a shot through here,
 * so the three cannot drift apart. It draws no RNG and emits nothing.
 */
export function shotOnTarget(targetX: number): boolean {
  return Math.abs(targetX - GOAL_CENTER_X) <= GOAL_W / 2;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist2(a: Vec, b: Vec): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function dist(a: Vec, b: Vec): number {
  return Math.round(Math.sqrt(dist2(a, b)));
}

export function moveToward(from: Vec, to: Vec, speed: number): Vec {
  const d2 = dist2(from, to);
  if (d2 === 0 || d2 <= speed * speed) return { x: to.x, y: to.y };
  const t = speed / Math.sqrt(d2);
  return {
    x: Math.round(from.x + (to.x - from.x) * t),
    y: Math.round(from.y + (to.y - from.y) * t),
  };
}
