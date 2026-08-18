import type { PlayerSpriteFrame } from './slot-key';

/** Players always face the ball. When it sits up-screen of them (smaller y)
 * the back-of-head sprite shows; level with them or below, the face shows.
 *
 * The carrier is the one exception. His ball is at his own boots, just below
 * his centre, so the ball rule would turn him to face the camera even while he
 * runs up-screen at the goal he is attacking. `carryingUpScreen` is true for
 * the holder of the ball on the team attacking y=0, and turns him around: we
 * see his back, and the held ball reads through him as the x-ray marker. */
export function runFrameFacingBall(
  playerY: number,
  ballY: number,
  frontFrame: 'run0' | 'run1',
  carryingUpScreen = false,
): PlayerSpriteFrame {
  if (!carryingUpScreen && ballY >= playerY) return frontFrame;
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
