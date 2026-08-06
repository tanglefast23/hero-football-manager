import { clamp, PITCH_H, PITCH_W, type Vec } from './geometry';

export const FORMATION_IDS = ['4-4-2', '4-3-3', '3-5-2', '5-3-2', '4-5-1', '3-4-3'] as const;
export type FormationId = typeof FORMATION_IDS[number];

// Only empirically validated shapes are offered in Settings. The engine keeps
// the other IDs replay-compatible while their match behavior is tuned.
export const COACHING_FORMATION_IDS: readonly FormationId[] = [
  '4-4-2',
  '4-3-3',
  '5-3-2',
  '3-4-3',
];

export const DEFAULT_FORMATION_PRESETS: readonly [FormationId, FormationId, FormationId] = [
  '4-4-2',
  '3-4-3',
  '5-3-2',
];

export const MENTALITIES = ['BALANCED', 'ATTACK', 'PROTECT'] as const;
export type Mentality = typeof MENTALITIES[number];

export const ENERGY_USE_MODES = ['SAVE_ENERGY', 'BALANCED', 'ALL_OUT'] as const;
export type EnergyUse = typeof ENERGY_USE_MODES[number];

const ENERGY_DRAIN_MULTIPLIER: Readonly<Record<EnergyUse, number>> = {
  SAVE_ENERGY: 0.60,
  BALANCED: 1.00,
  ALL_OUT: 1.65,
};

const ENERGY_MOVEMENT_MULTIPLIER: Readonly<Record<EnergyUse, number>> = {
  SAVE_ENERGY: 0.90,
  BALANCED: 1.00,
  ALL_OUT: 1.12,
};

export interface TeamTactics {
  formation: FormationId;
  mentality: Mentality;
  energyUse: EnergyUse;
}

// The formation blurbs used to live here as English strings. They are display
// copy, not simulation data, so they moved to the copy catalog
// (`formation.<id>.blurb`) — a pure ring must not hold text that changes with
// the player's language. The ring keeps `FormationId`, which is what it
// actually reasons about.

type NormalizedPoint = readonly [number, number];

// Engine slots 1..10. A player keeps their identity and match slot while the
// chosen layout changes that slot's positional job. The match is deliberately
// arcade-readable: switching formation changes the ten dots the player sees,
// without opening a role-assignment spreadsheet mid-match.
export const FORMATION_LAYOUTS: Readonly<Record<FormationId, readonly NormalizedPoint[]>> = {
  '4-4-2': [
    [0.15, 0.78], [0.38, 0.80], [0.62, 0.80], [0.85, 0.78],
    [0.15, 0.55], [0.38, 0.58], [0.62, 0.58], [0.85, 0.55],
    [0.38, 0.30], [0.62, 0.30],
  ],
  '4-3-3': [
    [0.15, 0.78], [0.38, 0.80], [0.62, 0.80], [0.85, 0.78],
    [0.25, 0.56], [0.50, 0.59], [0.75, 0.56],
    [0.84, 0.29], [0.16, 0.29], [0.50, 0.25],
  ],
  '3-5-2': [
    [0.25, 0.80], [0.50, 0.82], [0.75, 0.80],
    [0.09, 0.57], [0.30, 0.59], [0.50, 0.62], [0.70, 0.59], [0.91, 0.57],
    [0.38, 0.29], [0.62, 0.29],
  ],
  '5-3-2': [
    [0.09, 0.76], [0.30, 0.81], [0.50, 0.83], [0.70, 0.81], [0.91, 0.76],
    [0.25, 0.58], [0.50, 0.61], [0.75, 0.58],
    [0.38, 0.30], [0.62, 0.30],
  ],
  '4-5-1': [
    [0.15, 0.79], [0.38, 0.81], [0.62, 0.81], [0.85, 0.79],
    [0.09, 0.56], [0.30, 0.60], [0.50, 0.63], [0.70, 0.60], [0.91, 0.56],
    [0.50, 0.28],
  ],
  '3-4-3': [
    [0.25, 0.80], [0.50, 0.82], [0.75, 0.80],
    [0.12, 0.57], [0.38, 0.60], [0.62, 0.60], [0.88, 0.57],
    [0.16, 0.29], [0.50, 0.25], [0.84, 0.29],
  ],
};

// Positional anchors indexed by the fixed engine slot, rather than by the
// visual top-to-bottom dot order above. This distinction matters whenever a
// formation changes line counts: a 3-4-3 should advance the right back on the
// right and the right midfielder on the right, not send either across the
// entire pitch just because the fourth display dot begins the midfield line.
const FORMATION_ENGINE_ANCHORS: Readonly<Record<FormationId, readonly NormalizedPoint[]>> = {
  '4-4-2': FORMATION_LAYOUTS['4-4-2'],
  '4-3-3': FORMATION_LAYOUTS['4-3-3'],
  '3-5-2': [
    [0.25, 0.83], [0.50, 0.85], [0.75, 0.83], [0.88, 0.62],
    [0.12, 0.62], [0.32, 0.62], [0.68, 0.62], [0.50, 0.68],
    [0.38, 0.29], [0.62, 0.29],
  ],
  '5-3-2': [
    [0.09, 0.82], [0.30, 0.86], [0.50, 0.88], [0.70, 0.86],
    [0.25, 0.62], [0.50, 0.64], [0.75, 0.62], [0.91, 0.82],
    [0.38, 0.30], [0.62, 0.30],
  ],
  '4-5-1': [
    [0.15, 0.81], [0.38, 0.84], [0.62, 0.84], [0.85, 0.81],
    [0.09, 0.58], [0.30, 0.61], [0.70, 0.61], [0.91, 0.58],
    [0.50, 0.42], [0.50, 0.25],
  ],
  '3-4-3': [
    [0.25, 0.72], [0.50, 0.74], [0.75, 0.72], [0.88, 0.52],
    [0.12, 0.52], [0.38, 0.54], [0.62, 0.54], [0.84, 0.22],
    [0.16, 0.24], [0.50, 0.20],
  ],
};

export type FormationRole = 'GK' | 'DEF' | 'MID' | 'FWD';

/**
 * The positional line owned by each fixed engine slot in every formation.
 *
 * Player identity and natural role stay with the player, while this table says
 * where that lineup slot is actually drawn and played. Most shapes read in
 * simple groups; 5-3-2 is the important exception because fixed slot 8 drops
 * from right midfield into the fifth defensive position.
 */
const FORMATION_SLOT_ROLES: Readonly<Record<FormationId, readonly Exclude<FormationRole, 'GK'>[]>> = {
  '4-4-2': ['DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD'],
  '4-3-3': ['DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'],
  '3-5-2': ['DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD'],
  '5-3-2': ['DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'DEF', 'FWD', 'FWD'],
  '4-5-1': ['DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD'],
  '3-4-3': ['DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'],
};

export function formationRoleForSlot(
  formation: FormationId,
  engineSlot: number,
): FormationRole {
  if (!Number.isSafeInteger(engineSlot) || engineSlot < 0 || engineSlot > 10) {
    throw new Error(`formation slot must be an integer from 0 to 10, got ${String(engineSlot)}`);
  }
  return engineSlot === 0 ? 'GK' : FORMATION_SLOT_ROLES[formation][engineSlot - 1];
}

export function isFormationId(value: unknown): value is FormationId {
  return typeof value === 'string' && FORMATION_IDS.includes(value as FormationId);
}

export function isMentality(value: unknown): value is Mentality {
  return typeof value === 'string' && MENTALITIES.includes(value as Mentality);
}

export function isEnergyUse(value: unknown): value is EnergyUse {
  return typeof value === 'string' && ENERGY_USE_MODES.includes(value as EnergyUse);
}

export function energyDrainMultiplier(mode: EnergyUse): number {
  return ENERGY_DRAIN_MULTIPLIER[mode];
}

export function energyMovementMultiplier(mode: EnergyUse, condition: number): number {
  if (mode === 'ALL_OUT') {
    return 1 + (ENERGY_MOVEMENT_MULTIPLIER.ALL_OUT - 1) * clamp(condition, 0, 100) / 100;
  }
  return ENERGY_MOVEMENT_MULTIPLIER[mode];
}

export function nextMentality(current: Mentality): Mentality {
  return MENTALITIES[(MENTALITIES.indexOf(current) + 1) % MENTALITIES.length];
}

export function nextFormation(current: FormationId, presets: readonly FormationId[]): FormationId {
  if (presets.length === 0) return current;
  const index = presets.indexOf(current);
  return presets[(index + 1 + presets.length) % presets.length];
}

/** Applies a formation's anchor delta to the proven 4-4-2 movement-table target. */
export function formationTarget(
  team: 0 | 1,
  engineSlot: number,
  formation: FormationId,
  baseTarget: Vec,
  inPossession?: boolean,
): Vec {
  if (engineSlot === 0 || formation === '4-4-2') return baseTarget;
  const base = FORMATION_ENGINE_ANCHORS['4-4-2'][engineSlot - 1];
  const chosen = FORMATION_ENGINE_ANCHORS[formation][engineSlot - 1];
  const direction = team === 0 ? 1 : -1;
  const target = {
    x: clamp(Math.round(baseTarget.x + (chosen[0] - base[0]) * PITCH_W * direction), 0, PITCH_W),
    y: clamp(Math.round(baseTarget.y + (chosen[1] - base[1]) * PITCH_H * direction), 0, PITCH_H),
  };
  if (formation !== '3-4-3' || inPossession !== false) return target;

  // The extra attacker has to come from somewhere. Out of possession, 3-4-3
  // holds a high, wider back three: better pressure, but visible counter space.
  const teamForward = team === 0 ? -1 : 1;
  const line = engineSlot <= 3 ? 'DEF' : engineSlot <= 7 ? 'MID' : 'FWD';
  const shift = line === 'DEF' ? 600 : line === 'MID' ? 350 : 150;
  const width = line === 'DEF' ? 1.16 : 1.06;
  const centerX = PITCH_W / 2;
  return {
    x: clamp(Math.round(centerX + (target.x - centerX) * width), 0, PITCH_W),
    y: clamp(Math.round(target.y + shift * teamForward), 0, PITCH_H),
  };
}

/** A visible shape instruction: ATTACK steps toward goal; PROTECT drops home. */
export function mentalityTarget(
  team: 0 | 1,
  engineSlot: number,
  mentality: Mentality,
  inPossession: boolean,
  target: Vec,
): Vec {
  if (engineSlot === 0 || mentality === 'BALANCED') return target;
  const slotLine = engineSlot <= 5 ? 'DEF' : engineSlot <= 8 ? 'MID' : 'FWD';
  const teamForward = team === 0 ? -1 : 1;
  const centerX = PITCH_W / 2;
  if (mentality === 'ATTACK') {
    // Commit the whole block. The stronger out-of-possession step leaves real
    // counter space, so ATTACK is pressure plus risk rather than a free buff.
    const shift = inPossession
      ? (slotLine === 'DEF' ? 260 : slotLine === 'MID' ? 460 : 650)
      : (slotLine === 'DEF' ? 1050 : slotLine === 'MID' ? 800 : 500);
    const width = inPossession ? 1.05 : 1.10;
    return {
      x: clamp(Math.round(centerX + (target.x - centerX) * width), 0, PITCH_W),
      y: clamp(Math.round(target.y + shift * teamForward), 0, PITCH_H),
    };
  }

  // PROTECT forms a deep, narrow shell. It sacrifices outlets and shot volume
  // but closes the central lane instead of merely backing every player away.
  const shift = inPossession
    ? (slotLine === 'DEF' ? 460 : slotLine === 'MID' ? 500 : 260)
    : (slotLine === 'DEF' ? 760 : slotLine === 'MID' ? 700 : 420);
  const compactness = slotLine === 'DEF' ? 0.74 : slotLine === 'MID' ? 0.82 : 0.92;
  return {
    x: clamp(Math.round(centerX + (target.x - centerX) * compactness), 0, PITCH_W),
    y: clamp(Math.round(target.y - shift * teamForward), 0, PITCH_H),
  };
}
