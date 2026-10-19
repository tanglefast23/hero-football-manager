import type { PowerId, Role } from '../sim/types';
import type { CareerPlayer } from './types';
import type { DivisionLevel } from './pyramid';
import { heroLicenseLimitForDivision } from './promotion-progression';

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
  'RALLY_CRY',
  'ICE_RINK',
  'SHADOW_MARK',
  'GRAVITY_WELL',
  'GIANT_GK',
  'GUST',
];

/**
 * Which roles may awaken which power. Before this, every outfielder could
 * awaken any non-keeper power, so a defender drew a carrier-only striker power
 * roughly 47% of the time and could almost never fire it. Membership here is by
 * what the trigger actually needs, not by flavour.
 */
const ROLE_POOL: Readonly<Record<Role, readonly PowerId[]>> = {
  GK: ['ELASTIC_KEEPER', 'GIANT_GK', 'GUST'],
  DEF: [
    'FUTURE_SIGHT',
    'GUST',
    'SUPER_STRENGTH',
    'WEB_TRAP',
    'ICE_RINK',
    'SHADOW_MARK',
    'SUPER_SPEED',
    'RALLY_CRY',
  ],
  MID: [
    'PORTAL_PASS',
    'DECOY_DOUBLE',
    'PHASE_RUN',
    'BLINK_RUN',
    'FUTURE_SIGHT',
    'GUST',
    'WEB_TRAP',
    'ICE_RINK',
    'SHADOW_MARK',
    'GRAVITY_WELL',
    'SUPER_SPEED',
    'FIRE_TORCH',
    'RALLY_CRY',
  ],
  FWD: [
    'SUPER_SPEED',
    'BLINK_RUN',
    'THUNDER_STRIKE',
    'PHASE_RUN',
    'PORTAL_PASS',
    'GRAVITY_WELL',
    'FIRE_TORCH',
    'RALLY_CRY',
  ],
};

/** Gives generated clubs a stable slice of the full launch catalog. */
export function powerIsCompatibleWithRole(power: PowerId, role: Role): boolean {
  return ROLE_POOL[role].includes(power);
}

export function generatedClubPower(
  clubId: string,
  heroIndex: number,
  role: Role,
): PowerId {
  if (!Number.isSafeInteger(heroIndex) || heroIndex < 0) {
    throw new Error('generated hero index must be a nonnegative safe integer');
  }
  const hash = stableClubHash(clubId);
  const candidates = LAUNCH_POWER_IDS.filter((power) =>
    powerIsCompatibleWithRole(power, role),
  );
  return candidates[(hash + heroIndex) % candidates.length];
}

/**
 * Canonical generated-opponent hero ramp. D5 has no generated heroes so the
 * player's first awakening is unique, while every D1 opponent fields 2-3.
 */
export function generatedClubHeroCount(
  clubId: string,
  division: 1 | 2 | 3 | 4 | 5,
): number {
  const hash = stableClubHash(clubId);
  if (division === 5) return 0;
  if (division === 4) return hash % 3 === 0 ? 1 : 0;
  if (division === 3) return 1 + (hash % 2);
  if (division === 2) return 2 + (hash % 3 === 0 ? 1 : 0);
  return 2 + (hash % 2);
}

export interface AiHeroAssignment {
  power?: PowerId;
  licensed: boolean;
}

/** Acquired players cannot move the club's native players between power slots. */
export function aiClubHeroAssignments(
  clubId: string,
  division: DivisionLevel,
  squad: readonly { id: string; role: Role; power?: PowerId }[],
): ReadonlyMap<string, AiHeroAssignment> {
  const assignments = new Map<string, AiHeroAssignment>();
  const generated: string[] = [];
  const owned: string[] = [];
  let nativeIndex = 0;
  for (const player of squad) {
    const eligibleIndex =
      player.id.startsWith(`${clubId}-p`) &&
      (player.role === 'MID' || player.role === 'FWD')
        ? nativeIndex++
        : -1;
    const power =
      player.power ??
      (eligibleIndex >= 0 &&
      eligibleIndex < generatedClubHeroCount(clubId, division)
        ? generatedClubPower(clubId, eligibleIndex, player.role)
        : undefined);
    assignments.set(player.id, {
      ...(power === undefined ? {} : { power }),
      licensed: false,
    });
    if (power !== undefined)
      (player.power === undefined ? generated : owned).push(player.id);
  }
  let slots = heroLicenseLimitForDivision(division);
  for (const id of [...generated, ...owned]) {
    const assignment = assignments.get(id)!;
    assignment.licensed = slots > 0;
    if (slots > 0) slots--;
  }
  return assignments;
}

/** Legacy transferred heroes keep their currently saved identity too. */
export function ownsAiPlayerPower(
  player: Pick<CareerPlayer, 'id' | 'clubId' | 'power' | 'ownsPower'>,
): boolean {
  return (
    player.power !== undefined &&
    (player.ownsPower === true || !player.id.startsWith(`${player.clubId}-p`))
  );
}

/** Both normal and forced sales use the buyer's earned cap, not the user's permits. */
export function aiTransferHeroStatus(
  player: Pick<CareerPlayer, 'power'>,
  buyerRoster: readonly Pick<CareerPlayer, 'power' | 'licensed'>[],
  division: DivisionLevel,
): Pick<CareerPlayer, 'licensed' | 'ownsPower'> {
  const slotsUsed = buyerRoster.filter(
    (candidate) => candidate.power !== undefined && candidate.licensed,
  ).length;
  return {
    licensed:
      player.power !== undefined &&
      slotsUsed < heroLicenseLimitForDivision(division),
    ...(player.power === undefined ? {} : { ownsPower: true as const }),
  };
}

function stableClubHash(clubId: string): number {
  let hash = 0;
  for (let index = 0; index < clubId.length; index += 1) {
    hash = (Math.imul(hash, 31) + clubId.charCodeAt(index)) >>> 0;
  }
  return hash;
}
