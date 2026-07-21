import type { Attrs } from '../../sim/types';
import {
  ARCHETYPE_ATTRIBUTE_CAPS,
  PLAYER_ARCHETYPES,
  POTENTIAL_GRADE_BANDS,
  archetypeAttributeCap,
  capArchetypeTrainingGain,
  capPlayerTrainingGain,
  deterministicPotentialCeiling,
  playerAttributeCaps,
  potentialTierForDivision,
  potentialGradeForOverall,
  projectedPlayerOverall,
  remainingDevelopmentPotential,
  roleOverall,
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

  test('defines an absolute F− through A+ grade scale with no gaps', () => {
    expect(POTENTIAL_GRADE_BANDS.map(band => band.grade)).toEqual([
      'F-', 'F', 'F+', 'E-', 'E', 'E+', 'D-', 'D', 'D+',
      'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+',
    ]);
    expect(potentialGradeForOverall(1)).toBe('F-');
    expect(potentialGradeForOverall(48)).toBe('F-');
    expect(potentialGradeForOverall(49)).toBe('F');
    expect(potentialGradeForOverall(84)).toBe('B-');
    expect(potentialGradeForOverall(93)).toBe('A-');
    expect(potentialGradeForOverall(94)).toBe('A');
    expect(potentialGradeForOverall(97)).toBe('A+');
    expect(potentialGradeForOverall(99)).toBe('A+');
  });

  test('calculates current overall from the six role-relevant attributes', () => {
    const attrs: Attrs = { pac: 60, sho: 90, pas: 60, def: 60, tec: 60, sta: 60, ref: 30 };
    expect(roleOverall('FWD', attrs)).toBe(65);
    expect(roleOverall('GK', attrs)).toBe(55);
  });

  test('maps legacy potential tiers into deterministic fine-grained ceilings', () => {
    const first = deterministicPotentialCeiling('player-1', 3);
    expect(deterministicPotentialCeiling('player-1', 3)).toBe(first);
    expect(first).toBeGreaterThanOrEqual(70);
    expect(first).toBeLessThanOrEqual(81);
    expect(deterministicPotentialCeiling('player-1', 1)).toBeGreaterThanOrEqual(46);
    expect(deterministicPotentialCeiling('player-1', 1)).toBeLessThanOrEqual(57);
    expect(deterministicPotentialCeiling('player-1', 5)).toBeGreaterThanOrEqual(94);
    expect(deterministicPotentialCeiling('player-1', 5)).toBeLessThanOrEqual(99);
  });

  test('higher divisions have deterministically stronger potential-tier distributions', () => {
    const averages = [1, 2, 3, 4, 5].map(division => (
      Array.from({ length: 100 }, (_, roll) => potentialTierForDivision(division, roll))
        .reduce((sum, tier) => sum + tier, 0) / 100
    ));
    expect(averages[0]).toBeGreaterThan(averages[1]);
    expect(averages[1]).toBeGreaterThan(averages[2]);
    expect(averages[2]).toBeGreaterThan(averages[3]);
    expect(averages[3]).toBeGreaterThan(averages[4]);
  });

  test('Division 5 contains only F and E potential while A potential first appears in Division 4', () => {
    const divisionFiveTiers = Array.from(
      { length: 100 },
      (_, roll) => potentialTierForDivision(5, roll),
    );

    expect(new Set(divisionFiveTiers)).toEqual(new Set([1]));
    expect(potentialTierForDivision(4, 0)).toBe(5);
  });

  test('personal caps preserve archetype shape while landing on the fixed projected overall', () => {
    const attrs: Attrs = { pac: 30, sho: 30, pas: 30, def: 30, tec: 30, sta: 30, ref: 30 };
    const player = {
      id: 'speedster-prospect',
      role: 'FWD' as const,
      attrs,
      archetype: 'Speedster' as const,
      potential: 3 as const,
      potentialCeiling: 78,
    };
    const caps = playerAttributeCaps(player);
    expect(caps.pac).toBeGreaterThan(caps.sho);
    expect(projectedPlayerOverall(player)).toBe(78);
    expect(potentialGradeForOverall(projectedPlayerOverall(player))).toBe('C');
  });

  test('A+ is the top possible cap and F− stays mediocre even when fully developed', () => {
    const attrs: Attrs = { pac: 20, sho: 20, pas: 20, def: 20, tec: 20, sta: 20, ref: 20 };
    const elite = {
      id: 'elite', role: 'MID' as const, attrs, archetype: 'Playmaker' as const,
      potential: 5 as const, potentialCeiling: 99,
    };
    const limited = {
      id: 'limited', role: 'DEF' as const, attrs, archetype: 'Anchor' as const,
      potential: 1 as const, potentialCeiling: 48,
    };
    expect(projectedPlayerOverall(elite)).toBe(99);
    expect(potentialGradeForOverall(projectedPlayerOverall(elite))).toBe('A+');
    expect(projectedPlayerOverall(limited)).toBe(48);
    expect(potentialGradeForOverall(projectedPlayerOverall(limited))).toBe('F-');
  });

  test('training stops at the personal cap without reducing grandfathered ratings', () => {
    const attrs: Attrs = { pac: 40, sho: 40, pas: 40, def: 40, tec: 40, sta: 40, ref: 40 };
    const player = {
      id: 'capped-player', role: 'FWD' as const, attrs, archetype: 'Sniper' as const,
      potential: 2 as const, potentialCeiling: 60,
    };
    const cap = playerAttributeCaps(player).sho;
    expect(capPlayerTrainingGain(player, 'sho', cap - 1, cap + 20)).toBe(cap);
    expect(capPlayerTrainingGain(player, 'sho', cap + 1, 99)).toBe(cap + 1);
  });
});
