import type { PowerId, Role } from '../sim/types';

export const LAUNCH_POWER_IDS: readonly PowerId[] = [
  'SUPER_SPEED',
  'BLINK_RUN',
  'THUNDER_STRIKE',
  'FIRE_TORCH',
  'PHASE_RUN',
  'PORTAL_PASS',
  'DECOY_DOUBLE',
  'FUTURE_SIGHT',
  'SUPER_STRENGTH',
  'WEB_TRAP',
  'ELASTIC_KEEPER',
];

/** Gives generated clubs a stable slice of the full launch catalog. */
export function powerIsCompatibleWithRole(power: PowerId, role: Role): boolean {
  return power === 'ELASTIC_KEEPER' ? role === 'GK' : role !== 'GK';
}

export function generatedClubPower(clubId: string, heroIndex: number, role: Role): PowerId {
  if (!Number.isSafeInteger(heroIndex) || heroIndex < 0) {
    throw new Error('generated hero index must be a nonnegative safe integer');
  }
  const hash = stableClubHash(clubId);
  const candidates = LAUNCH_POWER_IDS.filter(power => powerIsCompatibleWithRole(power, role));
  return candidates[(hash + heroIndex) % candidates.length];
}

/**
 * Canonical generated-opponent hero ramp. D5 and D4 heroes remain rare enough
 * that a powerless club can compete, while every D1 opponent fields 2-3.
 */
export function generatedClubHeroCount(clubId: string, division: 1 | 2 | 3 | 4 | 5): number {
  const hash = stableClubHash(clubId);
  if (division === 5) return hash % 10 === 0 ? 1 : 0;
  if (division === 4) return hash % 3 === 0 ? 1 : 0;
  if (division === 3) return 1 + (hash % 2);
  if (division === 2) return 2 + (hash % 3 === 0 ? 1 : 0);
  return 2 + (hash % 2);
}

function stableClubHash(clubId: string): number {
  let hash = 0;
  for (let index = 0; index < clubId.length; index += 1) {
    hash = (Math.imul(hash, 31) + clubId.charCodeAt(index)) >>> 0;
  }
  return hash;
}
