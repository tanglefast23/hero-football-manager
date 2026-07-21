import manifestData from './player-look-manifest.json';
import {
  generatedPlayerLookId,
  isPlayerLookIdForRole,
  stablePlayerLookHash,
  type PlayerVisualRole,
} from '../../game/player-appearance';

export type { PlayerVisualRole } from '../../game/player-appearance';

interface PlayerLookManifest {
  readonly field: readonly string[];
  readonly goalkeeper: readonly string[];
  readonly created: readonly string[];
  readonly legacy: Readonly<Record<string, string>>;
}

const manifest = manifestData as PlayerLookManifest;

export const FIELD_PLAYER_LOOK_IDS = manifest.field;
export const GOALKEEPER_LOOK_IDS = manifest.goalkeeper;
export const CREATED_PLAYER_LOOK_IDS = manifest.created;

/**
 * A career player keeps the same visual identity everywhere. The original
 * named cast retains its hand-authored look; generated players use a stable
 * hash into the large role-appropriate pool.
 */
export function playerLookId(
  playerId: string,
  role: PlayerVisualRole,
  assignedLookId?: string,
): string {
  if (assignedLookId !== undefined) {
    if (!isPlayerLookIdForRole(assignedLookId, role)) {
      throw new Error(`invalid ${role} player look ${assignedLookId}`);
    }
    return assignedLookId;
  }
  const legacy = manifest.legacy[playerId];
  if (legacy !== undefined) return legacy;
  return generatedPlayerLookId(playerId, role);
}

export { stablePlayerLookHash };
