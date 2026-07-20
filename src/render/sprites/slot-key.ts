import type { SlideTackleSpriteFrame } from './slide-tackle';
import { playerLookId, type PlayerVisualRole } from './player-look';

export type PlayerSpriteFrame = 'run0' | 'run1' | 'ready0' | 'ready1' | SlideTackleSpriteFrame;

/**
 * Selects the same face/build used by management portraits, then applies the
 * current match side's kit. Moving lineup slots no longer changes identity.
 */
export function spriteKeyForMatchPlayer(
  matchPlayerIndex: number,
  playerId: string,
  role: PlayerVisualRole,
  frame: PlayerSpriteFrame,
): string {
  if (!Number.isInteger(matchPlayerIndex) || matchPlayerIndex < 0 || matchPlayerIndex >= 22) {
    throw new Error('match player sprite index must be an integer from 0 to 21');
  }
  if ((frame === 'ready0' || frame === 'ready1') && role !== 'GK') {
    throw new Error('only goalkeepers have ready sprite frames');
  }
  return `${visualIdForMatchPlayer(matchPlayerIndex, playerId, role)}:${frame}`;
}

export function visualIdForMatchPlayer(
  matchPlayerIndex: number,
  playerId: string,
  role: PlayerVisualRole,
): string {
  if (!Number.isInteger(matchPlayerIndex) || matchPlayerIndex < 0 || matchPlayerIndex >= 22) {
    throw new Error('match player sprite index must be an integer from 0 to 21');
  }
  const side = matchPlayerIndex < 11 ? 'r' : 'u';
  return `${side}:${playerLookId(playerId, role)}`;
}
