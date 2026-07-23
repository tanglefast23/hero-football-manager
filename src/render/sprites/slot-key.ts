import type { SlideTackleSpriteFrame } from './slide-tackle';
import { playerLookId, type PlayerVisualRole } from './player-look';

export type PlayerSpriteFrame =
  | 'run0' | 'run1' | 'back0' | 'back1'
  | 'ready0' | 'ready1' | 'backReady0' | 'backReady1'
  | SlideTackleSpriteFrame;

/**
 * Selects the same face/build used by management portraits, then applies the
 * current match side's kit. Moving lineup slots no longer changes identity.
 */
export function spriteKeyForMatchPlayer(
  matchPlayerIndex: number,
  playerId: string,
  role: PlayerVisualRole,
  frame: PlayerSpriteFrame,
  lookId?: string,
): string {
  if (!Number.isInteger(matchPlayerIndex) || matchPlayerIndex < 0 || matchPlayerIndex >= 24) {
    throw new Error('match player sprite index must be an integer from 0 to 23');
  }
  if ((frame === 'ready0' || frame === 'ready1'
    || frame === 'backReady0' || frame === 'backReady1') && role !== 'GK') {
    throw new Error('only goalkeepers have ready sprite frames');
  }
  return `${visualIdForMatchPlayer(matchPlayerIndex, playerId, role, lookId)}:${frame}`;
}

export function visualIdForMatchPlayer(
  matchPlayerIndex: number,
  playerId: string,
  role: PlayerVisualRole,
  lookId?: string,
): string {
  if (!Number.isInteger(matchPlayerIndex) || matchPlayerIndex < 0 || matchPlayerIndex >= 24) {
    throw new Error('match player sprite index must be an integer from 0 to 23');
  }
  // 22 and 23 are the fixed home/away Decoy render identities. Keeping them
  // outside the starting-XI range avoids index shifts while still selecting
  // the source forward's correct kit from the shared Atlas.
  const side = matchPlayerIndex < 11 || matchPlayerIndex === 22 ? 'r' : 'u';
  return `${side}:${playerLookId(playerId, role, lookId)}`;
}
