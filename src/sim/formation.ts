import { PITCH_W, PITCH_H, clamp, type Vec } from './geometry';

const ANCHORS_442: ReadonlyArray<readonly [number, number]> = [
  [0.50, 0.94],
  [0.15, 0.78], [0.38, 0.80], [0.62, 0.80], [0.85, 0.78],
  [0.15, 0.55], [0.38, 0.58], [0.62, 0.58], [0.85, 0.55],
  [0.38, 0.30], [0.62, 0.30],
];

const BALL_PULL_X = 0.15;
const BALL_PULL_Y = 0.10;

export function anchorFor(team: 0 | 1, slot: number, ballPos: Vec): Vec {
  const [fx, fy] = ANCHORS_442[slot];
  const baseX = fx * PITCH_W;
  const baseY = (team === 0 ? fy : 1 - fy) * PITCH_H;
  const x = clamp(Math.round(baseX + (ballPos.x - baseX) * BALL_PULL_X), 0, PITCH_W);
  const y = clamp(Math.round(baseY + (ballPos.y - baseY) * BALL_PULL_Y), 0, PITCH_H);
  return { x, y };
}
