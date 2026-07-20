import type { Attrs } from '../../sim/types';
import {
  ARCHETYPE_ATTRIBUTE_CAPS,
  PLAYER_ARCHETYPES,
  archetypeAttributeCap,
  capArchetypeTrainingGain,
  remainingDevelopmentPotential,
} from '../archetype-caps';

const ATTRIBUTES = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'] as const;

describe('archetype training caps', () => {
  test.each(PLAYER_ARCHETYPES)('%s defines a safe, explicit cap for every attribute', archetype => {
    expect(Object.keys(ARCHETYPE_ATTRIBUTE_CAPS[archetype]).sort()).toEqual([...ATTRIBUTES].sort());
    for (const attribute of ATTRIBUTES) {
      const cap = archetypeAttributeCap(archetype, attribute);
      expect(Number.isSafeInteger(cap)).toBe(true);
      expect(cap).toBeGreaterThanOrEqual(1);
      expect(cap).toBeLessThanOrEqual(99);
    }
  });

  test('locks the documented Speedster identity and gives goalkeepers a real REF path', () => {
    expect(ARCHETYPE_ATTRIBUTE_CAPS.Speedster).toMatchObject({ pac: 95, sho: 70 });
    expect(ARCHETYPE_ATTRIBUTE_CAPS.Wall.ref).toBe(95);
    expect(ARCHETYPE_ATTRIBUTE_CAPS.Wall.ref).toBeGreaterThan(
      ARCHETYPE_ATTRIBUTE_CAPS.Wall.pac,
    );
    expect(ARCHETYPE_ATTRIBUTE_CAPS.Wall.ref).toBeGreaterThan(
      ARCHETYPE_ATTRIBUTE_CAPS['All-Rounder'].ref,
    );
  });

  test('uses neutral caps for legacy players without archetype metadata', () => {
    for (const attribute of ATTRIBUTES) {
      expect(archetypeAttributeCap(undefined, attribute)).toBe(
        ARCHETYPE_ATTRIBUTE_CAPS['All-Rounder'][attribute],
      );
    }
  });

  test.each(PLAYER_ARCHETYPES)('%s gains stop at the cap without reducing above-cap ratings', archetype => {
    const attribute: keyof Attrs = archetype === 'Wall' ? 'ref' : 'pac';
    const cap = archetypeAttributeCap(archetype, attribute);
    const below = Math.max(1, cap - 1);
    expect(capArchetypeTrainingGain(archetype, attribute, below, below + 20)).toBe(cap);
    expect(capArchetypeTrainingGain(archetype, attribute, below, below - 1)).toBe(below);
    if (cap < 99) {
      expect(capArchetypeTrainingGain(archetype, attribute, cap + 1, 99)).toBe(cap + 1);
    }
  });

  test('sums every remaining cap point and never subtracts above-cap attributes', () => {
    const attrs: Attrs = { pac: 60, sho: 61, pas: 70, def: 96, tec: 71, sta: 80, ref: 90 };
    expect(remainingDevelopmentPotential('Wall', attrs)).toBe(
      (70 - 60)
      + 0
      + (76 - 70)
      + 0
      + (78 - 71)
      + (90 - 80)
      + (95 - 90),
    );
  });

  test('reaches zero when every attribute is at its archetype cap', () => {
    expect(remainingDevelopmentPotential('Anchor', ARCHETYPE_ATTRIBUTE_CAPS.Anchor)).toBe(0);
  });
});
