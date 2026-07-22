import type { PlayerSpriteFrame } from './slot-key';

export function runFrameForTeam(
  team: 0 | 1,
  frontFrame: 'run0' | 'run1',
): PlayerSpriteFrame {
  if (team === 1) return frontFrame;
  return frontFrame === 'run0' ? 'back0' : 'back1';
}

export function keeperReadyFrameForTeam(
  team: 0 | 1,
  frontFrame: 'ready0' | 'ready1',
): PlayerSpriteFrame {
  if (team === 1) return frontFrame;
  return frontFrame === 'ready0' ? 'backReady0' : 'backReady1';
}
