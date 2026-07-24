import type { Attrs, Role } from '../sim/types';
import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import type { PlayerArchetype } from './types';

const ATTRIBUTES = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'] as const satisfies readonly (keyof Attrs)[];
const OUT_FIELD_ATTRIBUTES = ['pac', 'sho', 'pas', 'def', 'tec', 'sta'] as const satisfies readonly (keyof Attrs)[];
const GOALKEEPER_ATTRIBUTES = ['pac', 'pas', 'def', 'tec', 'sta', 'ref'] as const satisfies readonly (keyof Attrs)[];

export const POTENTIAL_GRADES = [
  'E-', 'E', 'E+',
  'D-', 'D', 'D+',
  'C-', 'C', 'C+',
  'B-', 'B', 'B+',
  'A-', 'A', 'A+',
] as const;

export type PotentialGrade = (typeof POTENTIAL_GRADES)[number];

export interface PotentialGradeBand {
  readonly grade: PotentialGrade;
  readonly minimum: number;
  readonly maximum: number;
}

export const POTENTIAL_GRADE_BANDS: readonly PotentialGradeBand[] = [
  { grade: 'E-', minimum: 1, maximum: 57 },
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
  readonly age?: number;
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

export const POSITION_TRAINING_ATTRIBUTES: Readonly<
  Record<Role, readonly (keyof Attrs)[]>
> = {
  GK: ['ref', 'def', 'sta'],
  DEF: ['def', 'sta', 'pas'],
  MID: ['pas', 'tec', 'sta'],
  FWD: ['sho', 'pac', 'tec'],
};

export const POSITION_TRAINING_BONUS_PERCENT = 5;

export function positionTrainingBonusPercent(
  role: Role,
  attribute: keyof Attrs,
): number {
  return POSITION_TRAINING_ATTRIBUTES[role].includes(attribute)
    ? POSITION_TRAINING_BONUS_PERCENT
    : 0;
}

export function archetypeTrainingBonusPercent(
  archetype: PlayerArchetype | undefined,
  attribute: keyof Attrs,
): number {
  if (archetype === 'Prodigy') return 20;
  if (archetype === 'All-Rounder') return 5;
  const specialties: Partial<Record<PlayerArchetype, readonly (keyof Attrs)[]>> = {
    Speedster: ['pac'],
    Sniper: ['sho'],
    Playmaker: ['pas', 'tec'],
    Anchor: ['def', 'sta'],
    Wall: ['ref', 'def'],
    Engine: ['sta', 'pac'],
  };
  return archetype !== undefined && specialties[archetype]?.includes(attribute) ? 15 : 0;
}

/** Stable E− through A+ grade within the player's persisted 1–5 talent tier. */
export function playerPotentialGrade(
  player: Pick<PotentialProfile, 'id' | 'potential'>,
): PotentialGrade {
  const potential = player.potential ?? 3;
  const range = POTENTIAL_TIER_CEILING_RANGES[potential];
  const legacyValue = deterministicPotentialCeiling(player.id, potential);
  const variant = Math.min(
    2,
    Math.floor((legacyValue - range[0]) * 3 / (range[1] - range[0] + 1)),
  );
  return POTENTIAL_GRADES[(potential - 1) * 3 + variant];
}

/** E− is +0%; every grade step adds exactly one percentage point. */
export function potentialTrainingBonusPercent(grade: PotentialGrade): number {
  return POTENTIAL_GRADES.indexOf(grade);
}

export function playerPotentialTrainingBonusPercent(
  player: Pick<PotentialProfile, 'id' | 'potential'>,
): number {
  return potentialTrainingBonusPercent(playerPotentialGrade(player));
}

/** Total attribute points normal training can still add before the 999 safety ceiling. */
export function remainingDevelopmentPotential(
  _archetype: PlayerArchetype | undefined,
  attrs: Readonly<Attrs>,
): number {
  return ATTRIBUTES.reduce((total, attribute) => {
    const currentValue = attrs[attribute];
    assertAttributeValue(currentValue, `current ${attribute} attribute`);
    return total + Math.max(0, MAX_PLAYER_ATTRIBUTE - currentValue);
  }, 0);
}

/**
 * Legacy helper retained for callers outside the full career. Archetypes no
 * longer impose a personal ceiling; only the universal safety ceiling remains.
 */
export function capArchetypeTrainingGain(
  _archetype: PlayerArchetype | undefined,
  _attribute: keyof Attrs,
  currentValue: number,
  proposedValue: number,
): number {
  assertAttributeValue(currentValue, 'current attribute');
  if (!Number.isSafeInteger(proposedValue)) {
    throw new Error('proposed training attribute must be a safe integer');
  }
  return Math.min(MAX_PLAYER_ATTRIBUTE, Math.max(currentValue, proposedValue));
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

/** Legacy score-to-grade adapter. New players derive their grade from talent tier and ID. */
export function potentialGradeForOverall(overall: number): PotentialGrade {
  assertAttributeValue(overall, 'projected overall');
  return POTENTIAL_GRADE_BANDS.find(band => overall <= band.maximum)?.grade ?? 'A+';
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

/** Minimum projected-overall room retained when a player is created or migrated. */
export function minimumDevelopmentHeadroom(age: number): number {
  if (!Number.isSafeInteger(age) || age < 1 || age > 99) {
    throw new Error('player age must be an integer from 1 to 99');
  }
  if (age <= 21) return 8;
  if (age <= 24) return 7;
  if (age <= 27) return 6;
  if (age <= 30) return 5;
  return 3;
}

/**
 * Fixes a player's ceiling at creation time. Division-scaled potential supplies
 * the baseline; age guarantees that even ordinary veterans retain some useful
 * development room without changing their current match rating.
 */
export function developmentPotentialCeiling(
  player: Pick<PotentialProfile, 'id' | 'role' | 'attrs' | 'age' | 'potential'>,
): number {
  const currentOverall = roleOverall(player.role, player.attrs);
  const headroomFloor = Math.min(
    99,
    currentOverall + minimumDevelopmentHeadroom(player.age ?? 24),
  );
  return Math.max(
    deterministicPotentialCeiling(player.id, player.potential ?? 3),
    headroomFloor,
  );
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
    // D1 is the first tier where A-range talent appears.
    1: [75, 100, 100, 100],
    2: [0, 60, 95, 100],
    3: [0, 5, 65, 95],
    4: [0, 0, 5, 65],
    // D5 is deliberately humble: 90% E-range, 10% D-range.
    5: [0, 0, 0, 10],
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
 * Compatibility adapter for old cap-aware callers. Personal caps have been
 * removed, so every attribute now reports the universal 999 safety ceiling.
 */
export function playerAttributeCaps(player: PotentialProfile): Attrs {
  for (const attribute of ATTRIBUTES) {
    assertAttributeValue(player.attrs[attribute], `current ${attribute} attribute`);
  }
  return {
    pac: MAX_PLAYER_ATTRIBUTE,
    sho: MAX_PLAYER_ATTRIBUTE,
    pas: MAX_PLAYER_ATTRIBUTE,
    def: MAX_PLAYER_ATTRIBUTE,
    tec: MAX_PLAYER_ATTRIBUTE,
    sta: MAX_PLAYER_ATTRIBUTE,
    ref: MAX_PLAYER_ATTRIBUTE,
  };
}

/** Legacy adapter: a cap-free player has no useful projected maximum. */
export function projectedPlayerOverall(player: PotentialProfile): number {
  return roleOverall(player.role, player.attrs);
}

/** Applies only the universal 999 safety ceiling. */
export function capPlayerTrainingGain(
  _player: PotentialProfile,
  _attribute: keyof Attrs,
  currentValue: number,
  proposedValue: number,
): number {
  assertAttributeValue(currentValue, 'current attribute');
  if (!Number.isSafeInteger(proposedValue)) {
    throw new Error('proposed training attribute must be a safe integer');
  }
  return Math.min(MAX_PLAYER_ATTRIBUTE, Math.max(currentValue, proposedValue));
}

function roleAttributes(role: Role): readonly (keyof Attrs)[] {
  return role === 'GK' ? GOALKEEPER_ATTRIBUTES : OUT_FIELD_ATTRIBUTES;
}

function assertAttributeValue(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_PLAYER_ATTRIBUTE) {
    throw new Error(`${label} must be an integer from 1 to ${MAX_PLAYER_ATTRIBUTE}`);
  }
}
