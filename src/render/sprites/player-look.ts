import manifestData from './player-look-manifest.json';

export type PlayerVisualRole = 'GK' | 'DEF' | 'MID' | 'FWD';

interface PlayerLookManifest {
  readonly field: readonly string[];
  readonly goalkeeper: readonly string[];
  readonly legacy: Readonly<Record<string, string>>;
}

const manifest = manifestData as PlayerLookManifest;

export const FIELD_PLAYER_LOOK_IDS = manifest.field;
export const GOALKEEPER_LOOK_IDS = manifest.goalkeeper;

/**
 * A career player keeps the same visual identity everywhere. The original
 * named cast retains its hand-authored look; generated players use a stable
 * hash into the large role-appropriate pool.
 */
export function playerLookId(playerId: string, role: PlayerVisualRole): string {
  const legacy = manifest.legacy[playerId];
  if (legacy !== undefined) return legacy;
  const pool = role === 'GK' ? GOALKEEPER_LOOK_IDS : FIELD_PLAYER_LOOK_IDS;
  if (pool.length === 0) throw new Error(`no ${role === 'GK' ? 'goalkeeper' : 'field player'} looks are available`);
  return pool[lookIndex(playerId, pool.length)];
}

export function stablePlayerLookHash(value: string): number {
  return stableHash(value);
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  // FNV's lower bits cluster for similarly suffixed career IDs (club-p01,
  // club-p02, ...). Avalanche the result before taking the pool modulus.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function lookIndex(playerId: string, poolSize: number): number {
  const numberedId = /^(.*?)(\d+)$/.exec(playerId);
  if (numberedId === null) return stableHash(playerId) % poolSize;
  const prefix = numberedId[1];
  const ordinal = Number(numberedId[2]);
  // Generated club squads end in p01, p02, ... . Walking the pool with a
  // step coprime to both shipped pool sizes prevents same-club collisions.
  return (stableHash(prefix) + ordinal * 37) % poolSize;
}
