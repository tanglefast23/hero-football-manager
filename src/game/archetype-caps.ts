import type { Attrs, Role } from '../sim/types';
import type { PlayerArchetype } from './types';

const ATTRIBUTES = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'] as const satisfies readonly (keyof Attrs)[];
const OUT_FIELD_ATTRIBUTES = ['pac', 'sho', 'pas', 'def', 'tec', 'sta'] as const satisfies readonly (keyof Attrs)[];
const GOALKEEPER_ATTRIBUTES = ['pac', 'pas', 'def', 'tec', 'sta', 'ref'] as const satisfies readonly (keyof Attrs)[];

export type PotentialGrade =
  | 'A+' | 'A' | 'A-'
  | 'B+' | 'B' | 'B-'
  | 'C+' | 'C' | 'C-'
  | 'D+' | 'D' | 'D-'
  | 'E+' | 'E' | 'E-'
  | 'F+' | 'F' | 'F-';

export interface PotentialGradeBand {
  readonly grade: PotentialGrade;
  readonly minimum: number;
  readonly maximum: number;
}

export const POTENTIAL_GRADE_BANDS: readonly PotentialGradeBand[] = [
  { grade: 'F-', minimum: 1, maximum: 48 },
  { grade: 'F', minimum: 49, maximum: 51 },
  { grade: 'F+', minimum: 52, maximum: 54 },
  { grade: 'E-', minimum: 55, maximum: 57 },
  { grade: 'E', minimum: 58, maximum: 60 },
  { grade: 'E+', minimum: 61, maximum: 63 },
  { grade: 'D-', minimum: 64, maximum: 66 },
  { grade: 'D', minimum: 67, maximum: 69 },
  { grade: 'D+', minimum: 70, maximum: 72 },
  { grade: 'C-', minimum: 73, maximum: 75 },
  { grade: 'C', minimum: 76, maximum: 78 },
  { grade: 'C+', minimum: 79, maximum: 81 },
  { grade: 'B-', minimum: 82, maximum: 84 },
  { grade: 'B', minimum: 85, maximum: 87 },
  { grade: 'B+', minimum: 88, maximum: 90 },
  { grade: 'A-', minimum: 91, maximum: 93 },
  { grade: 'A', minimum: 94, maximum: 96 },
  { grade: 'A+', minimum: 97, maximum: 99 },
] as const;

const POTENTIAL_TIER_CEILING_RANGES: Readonly<Record<1 | 2 | 3 | 4 | 5, readonly [number, number]>> = {
  1: [46, 57],
  2: [58, 69],
  3: [70, 81],
  4: [82, 93],
  5: [94, 99],
};

export interface PotentialProfile {
  readonly id: string;
  readonly role: Role;
  readonly attrs: Readonly<Attrs>;
  readonly archetype?: PlayerArchetype;
  readonly potential?: 1 | 2 | 3 | 4 | 5;
  readonly potentialCeiling?: number;
}

export const PLAYER_ARCHETYPES = [
  'Speedster',
  'Sniper',
  'Playmaker',
  'Anchor',
  'Wall',
  'Engine',
  'All-Rounder',
  'Prodigy',
] as const satisfies readonly PlayerArchetype[];

/**
 * M2's visible training ceilings. These limit development only: an imported,
 * awakened, or otherwise exceptional player who is already above a ceiling is
 * never reduced.
 */
export const ARCHETYPE_ATTRIBUTE_CAPS: Readonly<Record<PlayerArchetype, Readonly<Attrs>>> = {
  Speedster: { pac: 95, sho: 70, pas: 82, def: 68, tec: 84, sta: 88, ref: 60 },
  Sniper: { pac: 82, sho: 95, pas: 80, def: 65, tec: 90, sta: 82, ref: 55 },
  Playmaker: { pac: 82, sho: 78, pas: 95, def: 74, tec: 95, sta: 86, ref: 65 },
  Anchor: { pac: 76, sho: 68, pas: 84, def: 95, tec: 82, sta: 90, ref: 75 },
  Wall: { pac: 70, sho: 60, pas: 76, def: 95, tec: 78, sta: 90, ref: 95 },
  Engine: { pac: 90, sho: 80, pas: 88, def: 84, tec: 86, sta: 95, ref: 65 },
  'All-Rounder': { pac: 88, sho: 88, pas: 88, def: 88, tec: 88, sta: 88, ref: 88 },
  Prodigy: { pac: 99, sho: 99, pas: 99, def: 99, tec: 99, sta: 99, ref: 99 },
};

/** Legacy players without archetype metadata use the neutral All-Rounder caps. */
export function archetypeAttributeCap(
  archetype: PlayerArchetype | undefined,
  attribute: keyof Attrs,
): number {
  return ARCHETYPE_ATTRIBUTE_CAPS[archetype ?? 'All-Rounder'][attribute];
}

/** Total attribute points normal training can still add before every cap. */
export function remainingDevelopmentPotential(
  archetype: PlayerArchetype | undefined,
  attrs: Readonly<Attrs>,
): number {
  return ATTRIBUTES.reduce((total, attribute) => {
    const currentValue = attrs[attribute];
    assertAttributeValue(currentValue, `current ${attribute} attribute`);
    return total + Math.max(0, archetypeAttributeCap(archetype, attribute) - currentValue);
  }, 0);
}

/**
 * Applies a development ceiling without ever turning training into a stat loss.
 * A current value above its ceiling is grandfathered and simply cannot grow.
 */
export function capArchetypeTrainingGain(
  archetype: PlayerArchetype | undefined,
  attribute: keyof Attrs,
  currentValue: number,
  proposedValue: number,
): number {
  assertAttributeValue(currentValue, 'current attribute');
  if (!Number.isSafeInteger(proposedValue)) {
    throw new Error('proposed training attribute must be a safe integer');
  }
  const maximum = Math.max(currentValue, archetypeAttributeCap(archetype, attribute));
  return Math.min(maximum, Math.max(currentValue, proposedValue));
}

/** Current rating from the six attributes that the player's role can actually use. */
export function roleOverall(role: Role, attrs: Readonly<Attrs>): number {
  const attributes = roleAttributes(role);
  const total = attributes.reduce((sum, attribute) => {
    const value = attrs[attribute];
    assertAttributeValue(value, `${role} ${attribute} attribute`);
    return sum + value;
  }, 0);
  return Math.round(total / attributes.length);
}

/** Absolute grade: the same projected rating always means the same grade in every division. */
export function potentialGradeForOverall(overall: number): PotentialGrade {
  assertAttributeValue(overall, 'projected overall');
  return POTENTIAL_GRADE_BANDS.find(band => overall <= band.maximum)!.grade;
}

/** Stable fine-grained ceiling for legacy players that only persisted a 1–5 potential tier. */
export function deterministicPotentialCeiling(
  playerId: string,
  potential: 1 | 2 | 3 | 4 | 5,
): number {
  if (playerId.trim().length === 0) throw new Error('player ID is required for a potential ceiling');
  const range = POTENTIAL_TIER_CEILING_RANGES[potential];
  if (range === undefined) throw new Error('player potential must be an integer from 1 to 5');
  let hash = 2166136261;
  for (let index = 0; index < playerId.length; index += 1) {
    hash = Math.imul(hash ^ playerId.charCodeAt(index), 16777619) >>> 0;
  }
  hash = Math.imul(hash ^ potential, 16777619) >>> 0;
  return range[0] + hash % (range[1] - range[0] + 1);
}

/** Division 1 is strongest. A stable 0–99 roll selects from its fixed tier curve. */
export function potentialTierForDivision(
  division: number,
  roll: number,
): 1 | 2 | 3 | 4 | 5 {
  if (!Number.isSafeInteger(division) || division < 1 || division > 5) {
    throw new Error('division must be an integer from 1 to 5');
  }
  if (!Number.isSafeInteger(roll) || roll < 0 || roll > 99) {
    throw new Error('potential roll must be an integer from 0 to 99');
  }
  const thresholds: Readonly<Record<number, readonly [number, number, number, number]>> = {
    1: [55, 95, 100, 100],
    2: [35, 80, 98, 100],
    3: [15, 50, 85, 98],
    4: [5, 25, 60, 90],
    5: [1, 8, 30, 65],
  };
  const [tier5, tier4, tier3, tier2] = thresholds[division];
  if (roll < tier5) return 5;
  if (roll < tier4) return 4;
  if (roll < tier3) return 3;
  if (roll < tier2) return 2;
  return 1;
}

export function resolvedPotentialCeiling(player: PotentialProfile): number {
  if (player.potentialCeiling !== undefined) {
    if (!Number.isSafeInteger(player.potentialCeiling)
      || player.potentialCeiling < 46
      || player.potentialCeiling > 99) {
      throw new Error('player potential ceiling must be an integer from 46 to 99');
    }
    return player.potentialCeiling;
  }
  return deterministicPotentialCeiling(player.id, player.potential ?? 3);
}

/**
 * Personal stat ceilings. Archetype controls the shape while potential controls
 * the role-aware average. Existing above-cap ratings are grandfathered.
 */
export function playerAttributeCaps(player: PotentialProfile): Attrs {
  const target = resolvedPotentialCeiling(player);
  const archetypeCaps = ARCHETYPE_ATTRIBUTE_CAPS[player.archetype ?? 'All-Rounder'];
  const relevant = roleAttributes(player.role);
  const archetypeMean = relevant.reduce((sum, attribute) => sum + archetypeCaps[attribute], 0)
    / relevant.length;
  const offsets = ATTRIBUTES.map(attribute => archetypeCaps[attribute] - archetypeMean);
  const maximumOffset = Math.max(0, ...offsets);
  const minimumOffset = Math.min(0, ...offsets);
  const shapeScale = Math.min(
    1,
    maximumOffset === 0 ? 1 : (99 - target) / maximumOffset,
    minimumOffset === 0 ? 1 : (target - 1) / Math.abs(minimumOffset),
  );
  const caps = Object.fromEntries(ATTRIBUTES.map(attribute => [
    attribute,
    Math.max(
      player.attrs[attribute],
      clampRating(Math.round(target + (archetypeCaps[attribute] - archetypeMean) * shapeScale)),
    ),
  ])) as unknown as Attrs;

  rebalanceRelevantCaps(caps, player.attrs, relevant, archetypeCaps, target * relevant.length);
  return caps;
}

/** Rating the player will have after every personal role-relevant cap is filled. */
export function projectedPlayerOverall(player: PotentialProfile): number {
  return roleOverall(player.role, playerAttributeCaps(player));
}

/** Applies the player's personal ceiling without ever turning training into a loss. */
export function capPlayerTrainingGain(
  player: PotentialProfile,
  attribute: keyof Attrs,
  currentValue: number,
  proposedValue: number,
): number {
  assertAttributeValue(currentValue, 'current attribute');
  if (!Number.isSafeInteger(proposedValue)) {
    throw new Error('proposed training attribute must be a safe integer');
  }
  const maximum = Math.max(currentValue, playerAttributeCaps(player)[attribute]);
  return Math.min(maximum, Math.max(currentValue, proposedValue));
}

function roleAttributes(role: Role): readonly (keyof Attrs)[] {
  return role === 'GK' ? GOALKEEPER_ATTRIBUTES : OUT_FIELD_ATTRIBUTES;
}

function rebalanceRelevantCaps(
  caps: Attrs,
  current: Readonly<Attrs>,
  relevant: readonly (keyof Attrs)[],
  archetypeCaps: Readonly<Attrs>,
  targetTotal: number,
): void {
  let difference = targetTotal - relevant.reduce((sum, attribute) => sum + caps[attribute], 0);
  const increaseOrder = [...relevant].sort((left, right) => (
    archetypeCaps[right] - archetypeCaps[left] || left.localeCompare(right)
  ));
  const decreaseOrder = [...increaseOrder].reverse();
  while (difference !== 0) {
    const order = difference > 0 ? increaseOrder : decreaseOrder;
    const candidate = order.find(attribute => difference > 0
      ? caps[attribute] < 99
      : caps[attribute] > current[attribute]);
    if (candidate === undefined) break;
    caps[candidate] += difference > 0 ? 1 : -1;
    difference += difference > 0 ? -1 : 1;
  }
}

function clampRating(value: number): number {
  return Math.max(1, Math.min(99, value));
}

function assertAttributeValue(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 99) {
    throw new Error(`${label} must be a safe integer from 1 to 99`);
  }
}
