import type { Attrs } from '../sim/types';
import type { PlayerArchetype } from './types';

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

function assertAttributeValue(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 99) {
    throw new Error(`${label} must be a safe integer from 1 to 99`);
  }
}
