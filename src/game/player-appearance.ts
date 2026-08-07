import { compareIds } from './ordering';

export type PlayerVisualRole = 'GK' | 'DEF' | 'MID' | 'FWD';

interface PlayerAppearanceIdentity {
  readonly id: string;
  readonly role: PlayerVisualRole;
  readonly lookId?: string;
}

export const FIELD_PLAYER_LOOK_COUNT = 183;
export const GOALKEEPER_LOOK_COUNT = 25;
export const CREATED_PLAYER_LOOK_COUNT = 240;

interface CreatedAppearanceChoice {
  readonly skinTone: 0 | 1 | 2 | 3 | 4 | 5;
  readonly hairstyle: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  readonly kitAccent: 0 | 1 | 2 | 3;
}

/**
 * How many options each paper-doll control cycles through. Their product is
 * CREATED_PLAYER_LOOK_COUNT, and the creation screen steps by these rather than
 * repeating the numbers, so a control can never offer a look the atlas lacks.
 */
export const CREATED_APPEARANCE_OPTION_COUNTS = {
  skinTone: 6,
  hairstyle: 10,
  kitAccent: 4,
} as const satisfies Record<keyof CreatedAppearanceChoice, number>;

/** Maps the editable paper-doll controls onto the dedicated 240-look paper-doll atlas. */
export function createdAppearanceLookId(appearance: CreatedAppearanceChoice): string {
  const index = appearance.skinTone * 40 + appearance.hairstyle * 4 + appearance.kitAccent;
  return `c${String(index).padStart(3, '0')}`;
}

/**
 * Stable fallback for generated players. Career state persists the chosen ID;
 * this hash is only the first candidate before collision probing.
 */
export function generatedPlayerLookId(playerId: string, role: PlayerVisualRole): string {
  const poolSize = lookPoolSize(role);
  return formatPlayerLookId(role, lookIndex(playerId, poolSize));
}

export function isPlayerLookIdForRole(lookId: string, role: PlayerVisualRole): boolean {
  const createdMatch = /^c(\d{3})$/.exec(lookId);
  if (createdMatch !== null) {
    const index = Number(createdMatch[1]);
    return role !== 'GK'
      && index >= 0
      && index < CREATED_PLAYER_LOOK_COUNT
      && lookId === `c${String(index).padStart(3, '0')}`;
  }
  const match = /^(f|g)(\d+)$/.exec(lookId);
  if (match === null || match[1] !== (role === 'GK' ? 'g' : 'f')) return false;
  const index = Number(match[2]);
  return Number.isInteger(index)
    && index >= 0
    && index < lookPoolSize(role)
    && lookId === formatPlayerLookId(role, index);
}

/**
 * Assigns one stable role-appropriate appearance per active player. Existing
 * valid assignments win; missing or colliding IDs probe the shipped pool in a
 * deterministic player-ID order. If a future roster exceeds the art capacity,
 * the allocator fails soft by returning the stable fallback for the overflow.
 */
export function assignDistinctPlayerLooks<T extends PlayerAppearanceIdentity>(
  players: readonly T[],
  preferredLook: (player: T) => string = player => generatedPlayerLookId(player.id, player.role),
): Array<T & { lookId: string }> {
  const ids = new Set<string>();
  for (const player of players) {
    if (ids.has(player.id)) throw new Error(`duplicate player appearance ID ${player.id}`);
    ids.add(player.id);
  }

  const assigned = new Map<string, string>();
  const used = new Set<string>();
  // Persisted identities take priority in caller order. Career season
  // projection places the user's squad first, so a returning opponent can
  // never displace a face the user already knows.
  for (const player of players) {
    if (player.lookId === undefined
      || !isPlayerLookIdForRole(player.lookId, player.role)
      || used.has(player.lookId)) continue;
    assigned.set(player.id, player.lookId);
    used.add(player.lookId);
  }

  const pending = players
    .filter(player => !assigned.has(player.id))
    .sort((left, right) => compareIds(left.id, right.id));
  for (const player of pending) {
    const preferred = preferredLook(player);
    const lookId = firstAvailableLook(preferred, player.role, used);
    assigned.set(player.id, lookId);
    used.add(lookId);
  }

  return players.map(player => ({ ...player, lookId: assigned.get(player.id)! }));
}

export function nextDistinctPlayerLook(
  player: Pick<PlayerAppearanceIdentity, 'id' | 'role'>,
  activePlayers: readonly PlayerAppearanceIdentity[],
): string {
  const used = new Set(activePlayers
    .filter(candidate => candidate.lookId !== undefined)
    .map(candidate => candidate.lookId!));
  return firstAvailableLook(generatedPlayerLookId(player.id, player.role), player.role, used);
}

export function stablePlayerLookHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function firstAvailableLook(
  preferred: string,
  role: PlayerVisualRole,
  used: ReadonlySet<string>,
): string {
  const poolSize = lookPoolSize(role);
  const preferredIndex = isPlayerLookIdForRole(preferred, role)
    ? Number(preferred.slice(1))
    : lookIndex(preferred, poolSize);
  for (let offset = 0; offset < poolSize; offset += 1) {
    const lookId = formatPlayerLookId(role, (preferredIndex + offset) % poolSize);
    if (!used.has(lookId)) return lookId;
  }
  return formatPlayerLookId(role, preferredIndex);
}

function lookPoolSize(role: PlayerVisualRole): number {
  return role === 'GK' ? GOALKEEPER_LOOK_COUNT : FIELD_PLAYER_LOOK_COUNT;
}

function formatPlayerLookId(role: PlayerVisualRole, index: number): string {
  return `${role === 'GK' ? 'g' : 'f'}${String(index).padStart(2, '0')}`;
}

function lookIndex(playerId: string, poolSize: number): number {
  const numberedId = /^(.*?)(\d+)$/.exec(playerId);
  if (numberedId === null) return stablePlayerLookHash(playerId) % poolSize;
  // Generated club squads end in p01, p02, ... . Walking the pool with a
  // larger coprime step keeps new-season squads visually distinct.
  return (stablePlayerLookHash(numberedId[1]) + Number(numberedId[2]) * 101) % poolSize;
}
