import type { SlideTackleSpriteFrame } from './slide-tackle';

export type PlayerSpriteFrame = 'run0' | 'run1' | 'ready0' | 'ready1' | SlideTackleSpriteFrame;

/**
 * M1 content owns player identity; the first sprite set owns only 22 visual
 * slots. Map match order to those slots so any validated career roster can
 * use the one-kit atlas without rewriting its player IDs.
 */
export function spriteKeyForMatchSlot(
  matchPlayerIndex: number,
  frame: PlayerSpriteFrame,
): string {
  if (!Number.isInteger(matchPlayerIndex) || matchPlayerIndex < 0 || matchPlayerIndex >= 22) {
    throw new Error('match player sprite index must be an integer from 0 to 21');
  }
  const side = matchPlayerIndex < 11 ? 'r' : 'u';
  const slot = matchPlayerIndex % 11;
  return `${side}${slot}:${frame}`;
}
