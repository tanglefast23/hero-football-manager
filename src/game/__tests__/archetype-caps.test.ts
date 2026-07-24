import type { Attrs, Role } from '../../sim/types';
import { MAX_PLAYER_ATTRIBUTE } from '../../sim/attributes';
import {
  PLAYER_ARCHETYPES,
  POSITION_TRAINING_ATTRIBUTES,
  POTENTIAL_GRADES,
  archetypeTrainingBonusPercent,
  capPlayerTrainingGain,
  playerAttributeCaps,
  playerPotentialGrade,
  playerPotentialTrainingBonusPercent,
  positionTrainingBonusPercent,
  potentialTierForDivision,
  potentialTrainingBonusPercent,
  remainingDevelopmentPotential,
  roleOverall,
} from '../archetype-caps';

const ATTRIBUTES = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'] as const;
const BASE_ATTRS: Attrs = {
  pac: 50,
  sho: 50,
  pas: 50,
  def: 50,
  tec: 50,
  sta: 50,
  ref: 50,
};

describe('open-ended player development', () => {
  test('uses the exact E− through A+ potential bonus ladder', () => {
    expect(POTENTIAL_GRADES).toEqual([
      'E-', 'E', 'E+',
      'D-', 'D', 'D+',
      'C-', 'C', 'C+',
      'B-', 'B', 'B+',
      'A-', 'A', 'A+',
    ]);
    expect(POTENTIAL_GRADES.map(potentialTrainingBonusPercent))
      .toEqual(Array.from({ length: 15 }, (_, index) => index));
  });

  test.each([
    ['Speedster', { pac: 15 }],
    ['Sniper', { sho: 15 }],
    ['Playmaker', { pas: 15, tec: 15 }],
    ['Anchor', { def: 15, sta: 15 }],
    ['Wall', { def: 15, ref: 15 }],
    ['Engine', { pac: 15, sta: 15 }],
    ['All-Rounder', Object.fromEntries(ATTRIBUTES.map(attribute => [attribute, 5]))],
    ['Prodigy', Object.fromEntries(ATTRIBUTES.map(attribute => [attribute, 20]))],
  ] as const)('%s exposes its exact innate training bonuses', (archetype, expected) => {
    for (const attribute of ATTRIBUTES) {
      expect(archetypeTrainingBonusPercent(archetype, attribute))
        .toBe(expected[attribute as keyof typeof expected] ?? 0);
    }
  });

  test.each(Object.entries(POSITION_TRAINING_ATTRIBUTES) as [Role, readonly (keyof Attrs)[]][])(
    '%s gains +5%% only on its three position attributes',
    (role, positionAttributes) => {
      expect(positionAttributes).toHaveLength(3);
      for (const attribute of ATTRIBUTES) {
        expect(positionTrainingBonusPercent(role, attribute))
          .toBe(positionAttributes.includes(attribute) ? 5 : 0);
      }
    },
  );

  test('derives a stable three-step grade inside each persisted talent tier', () => {
    for (const potential of [1, 2, 3, 4, 5] as const) {
      const first = playerPotentialGrade({ id: `player-${potential}`, potential });
      const second = playerPotentialGrade({ id: `player-${potential}`, potential });
      expect(first).toBe(second);
      expect(POTENTIAL_GRADES.indexOf(first)).toBeGreaterThanOrEqual((potential - 1) * 3);
      expect(POTENTIAL_GRADES.indexOf(first)).toBeLessThan(potential * 3);
      expect(playerPotentialTrainingBonusPercent({ id: `player-${potential}`, potential }))
        .toBe(POTENTIAL_GRADES.indexOf(first));
    }
  });

  test('gates talent so A-range players first appear in D1', () => {
    const tiersByDivision = ([5, 4, 3, 2, 1] as const).map(division => (
      new Set(Array.from({ length: 100 }, (_, roll) => potentialTierForDivision(division, roll)))
    ));
    expect(tiersByDivision[0]).toEqual(new Set([1, 2]));
    expect(tiersByDivision[1]).toEqual(new Set([1, 2, 3]));
    expect(tiersByDivision[2]).toEqual(new Set([1, 2, 3, 4]));
    expect(tiersByDivision[3]).toEqual(new Set([2, 3, 4]));
    expect(tiersByDivision[4]).toEqual(new Set([4, 5]));
    expect(potentialTierForDivision(1, 0)).toBe(5);
    expect(potentialTierForDivision(2, 0)).not.toBe(5);
    const d1TopTierGrades = new Set(Array.from(
      { length: 200 },
      (_, index) => playerPotentialGrade({ id: `d1-candidate-${index}`, potential: 5 }),
    ));
    expect(d1TopTierGrades).toEqual(new Set(['A-', 'A', 'A+']));
  });

  test('keeps current role overall separate from future training speed', () => {
    const attrs: Attrs = { ...BASE_ATTRS, sho: 80, ref: 20 };
    expect(roleOverall('FWD', attrs)).toBe(55);
    expect(roleOverall('GK', attrs)).toBe(45);
    expect(playerPotentialTrainingBonusPercent({ id: 'fast-learner', potential: 5 }))
      .toBeGreaterThan(playerPotentialTrainingBonusPercent({ id: 'slow-learner', potential: 1 }));
  });

  test('allows growth through 99 and stops only at the universal 999 safety ceiling', () => {
    const player = {
      id: 'open-ended-player',
      role: 'FWD' as const,
      attrs: { ...BASE_ATTRS },
      archetype: 'Sniper' as const,
      potential: 1 as const,
      potentialCeiling: 60,
    };
    expect(playerAttributeCaps(player)).toEqual({
      pac: 999,
      sho: 999,
      pas: 999,
      def: 999,
      tec: 999,
      sta: 999,
      ref: 999,
    });
    expect(capPlayerTrainingGain(player, 'sho', 98, 105)).toBe(105);
    expect(capPlayerTrainingGain(player, 'sho', 998, 1_020)).toBe(MAX_PLAYER_ATTRIBUTE);
  });

  test('reports only the remaining room to the rare universal ceiling', () => {
    expect(remainingDevelopmentPotential('Wall', BASE_ATTRS))
      .toBe(ATTRIBUTES.length * (MAX_PLAYER_ATTRIBUTE - 50));
    const maximums = Object.fromEntries(
      ATTRIBUTES.map(attribute => [attribute, MAX_PLAYER_ATTRIBUTE]),
    ) as unknown as Attrs;
    expect(remainingDevelopmentPotential('Prodigy', maximums)).toBe(0);
  });

  test('defines every supported archetype without using it as a cap', () => {
    expect(PLAYER_ARCHETYPES).toHaveLength(8);
    for (const archetype of PLAYER_ARCHETYPES) {
      expect(ATTRIBUTES.some(attribute => (
        archetypeTrainingBonusPercent(archetype, attribute) > 0
      ))).toBe(true);
    }
  });
});
