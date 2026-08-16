import spriteData from '../../render/sprites/management-sprites.json';

/**
 * Which coach portrait is actually drawable for a given portrait id.
 *
 * Coaches made from retired players carry `legend-<playerId>` ids (see
 * `market.ts`), and those are not in the management sprite sheet. They get a
 * stand-in picked by hash — stably, so the same legend is always the same face.
 *
 * WHY THIS IS ITS OWN MODULE. Two reasons, and the second is the load-bearing
 * one:
 *
 * 1. Any caller drawing one coach in MORE THAN ONE expression has to resolve
 *    the identity once and vary only the expression. Hashing the whole sprite
 *    key per expression picks a different stand-in for each, so a legend
 *    animated between two expressions changes face mid-animation. There is
 *    exactly one hash and it lives here.
 * 2. `ManagementSprite.tsx` imports react-native, which this project's `node`
 *    Jest environment cannot parse. A resolver living in the component would be
 *    reachable only by source-text assertions; here it gets a real test.
 */

interface ManagementSpriteSheet {
  readonly sprites: Record<string, readonly string[]>;
}

const sheet = spriteData as unknown as ManagementSpriteSheet;

const coachPortraitIds = Array.from(
  new Set(
    Object.keys(sheet.sprites)
      .filter((key) => key.startsWith('coach:') && key.endsWith(':rest'))
      .map((key) => key.split(':')[1]!),
  ),
);

export function coachSpriteExists(spriteKey: string): boolean {
  return sheet.sprites[spriteKey] !== undefined;
}

export function resolveCoachPortraitId(portraitId: string): string {
  if (coachSpriteExists(`coach:${portraitId}:rest`)) return portraitId;
  if (coachPortraitIds.length === 0) return portraitId;
  // Hashed from the `:rest` key alone, never from the caller's key: the
  // identity is a property of the portrait id, not of the expression asked for.
  const key = `coach:${portraitId}:rest`;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return coachPortraitIds[hash % coachPortraitIds.length]!;
}
