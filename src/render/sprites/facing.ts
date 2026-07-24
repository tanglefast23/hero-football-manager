import type { PlayerSpriteFrame } from './slot-key';

/** Players always face the ball. When it sits up-screen of them (smaller y)
 * the back-of-head sprite shows; level with them or below, the face shows. */
export function runFrameFacingBall(
  playerY: number,
  ballY: number,
  frontFrame: 'run0' | 'run1',
): PlayerSpriteFrame {
  if (ballY >= playerY) return frontFrame;
  return frontFrame === 'run0' ? 'back0' : 'back1';
}

export function keeperReadyFrameFacingBall(
  playerY: number,
  ballY: number,
  frontFrame: 'ready0' | 'ready1',
): PlayerSpriteFrame {
  if (ballY >= playerY) return frontFrame;
  return frontFrame === 'ready0' ? 'backReady0' : 'backReady1';
}
