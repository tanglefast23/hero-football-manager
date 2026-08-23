import {
  applyCareerCoachTrainingModifier,
  coachMotivatorBonusPercent,
  coachMotivatorStrengthHalfPercentUnits,
  coachTrainingBonusPercent,
  careerCoachTrainingModifiers,
  careerCoachWeeklyTrainingPoints,
  careerCoachWageLedgerAmount,
} from '../coach-weekly';
import type { CareerMarketState } from '../market-career';
import type { CoachCandidate, CoachSpecialty } from '../market';

function marketWithCoach(
  specialties: readonly [CoachSpecialty, CoachSpecialty] = [
    'ATTACK',
    'FITNESS',
  ],
  level = 3,
  weeklyWage = 1_500,
): CareerMarketState {
  const coach: CoachCandidate = {
    id: 'coach-test',
    name: 'Coach Test',
    specialties,
    level,
    weeklyWage,
    personality: 'PROFESSIONAL',
    requiredDivision: 5,
    requiredFame: 0,
    loyaltyDiscountPercent: 0,
  };
  return {
    nextMissionNumber: 1,
    scoutReports: [],
    coachCandidates: [coach],
    headCoach: coach,
  };
}

describe('career coach weekly effects', () => {
  test('defines the exact training and Motivator ladders', () => {
    const levels = [1, 2, 3, 4, 5];
    expect(
      levels.map((level) => coachTrainingBonusPercent(level, 'HEAD')),
    ).toEqual([6, 12, 18, 24, 30]);
    expect(
      levels.map((level) => coachTrainingBonusPercent(level, 'ASSISTANT')),
    ).toEqual([3, 6, 9, 12, 15]);
    expect(
      levels.map((level) => coachMotivatorBonusPercent(level, 'HEAD')),
    ).toEqual([4, 8, 12, 16, 20]);
    expect(
      levels.map((level) => coachMotivatorBonusPercent(level, 'ASSISTANT')),
    ).toEqual([2, 4, 6, 8, 10]);

    const market = marketWithCoach(['MOTIVATOR', 'ATTACK'], 1);
    expect(
      coachMotivatorStrengthHalfPercentUnits({
        ...market,
        assistantCoach: {
          ...market.headCoach!,
          id: 'assistant-motivator',
          level: 1,
        },
      }),
    ).toBe(12);
  });

  test('returns zero-cost, neutral training data before a head coach is hired', () => {
    const market: CareerMarketState = {
      nextMissionNumber: 1,
      scoutReports: [],
      coachCandidates: [],
    };

    expect(careerCoachWageLedgerAmount(market)).toBe(0);
    expect(careerCoachTrainingModifiers(market)).toEqual({
      qualityLevel: 0,
      specialtyBonusPercent: 0,
      specialties: [],
      gainScalePercentByAttribute: {
        pac: 100,
        sho: 100,
        pas: 100,
        def: 100,
        tec: 100,
        sta: 100,
        ref: 100,
      },
    });
  });

  test('turns the existing coach wage into a negative weekly ledger amount', () => {
    const market = marketWithCoach(['ATTACK', 'FITNESS'], 3, 1_500);

    expect(careerCoachWageLedgerAmount(market)).toBe(-1_500);
  });

  test('creates stable weekly TP from employed head and assistant coaches', () => {
    const market = marketWithCoach(['ATTACK', 'FITNESS'], 3);
    expect(careerCoachWeeklyTrainingPoints(market)).toBe(7);
    expect(
      careerCoachWeeklyTrainingPoints({
        ...market,
        assistantCoach: {
          ...market.headCoach!,
          id: 'assistant-test',
          level: 2,
        },
      }),
    ).toBe(10);
    expect(
      careerCoachWeeklyTrainingPoints({ ...market, headCoach: undefined }),
    ).toBe(0);
  });

  test('gives every head-coach level a distinct weekly TP step', () => {
    expect(
      [1, 2, 3, 4, 5].map((level) =>
        careerCoachWeeklyTrainingPoints(marketWithCoach(undefined, level)),
      ),
    ).toEqual([5, 6, 7, 8, 9]);
  });

  test('applies +6% per quality level only to attributes in either specialty', () => {
    const market = marketWithCoach(['ATTACK', 'FITNESS'], 3);
    const before = JSON.stringify(market);
    const modifiers = careerCoachTrainingModifiers(market);

    expect(modifiers).toEqual({
      coachId: 'coach-test',
      qualityLevel: 3,
      specialtyBonusPercent: 18,
      specialties: ['ATTACK', 'FITNESS'],
      gainScalePercentByAttribute: {
        pac: 118,
        sho: 118,
        pas: 100,
        def: 100,
        tec: 100,
        sta: 118,
        ref: 100,
      },
    });
    expect(JSON.stringify(market)).toBe(before);
    expect(JSON.parse(JSON.stringify(modifiers))).toEqual(modifiers);
  });

  test('adds the smaller assistant effect and includes both weekly wages', () => {
    const market = marketWithCoach(['ATTACK', 'FITNESS'], 4, 2_000);
    const assistant: CoachCandidate = {
      id: 'assistant-test',
      name: 'Assistant Test',
      specialties: ['ATTACK', 'TECHNIQUE'],
      level: 2,
      weeklyWage: 1_000,
      personality: 'LOYAL',
      requiredDivision: 5,
      requiredFame: 0,
      loyaltyDiscountPercent: 0,
    };
    const staffed = { ...market, assistantCoach: assistant };

    expect(careerCoachWageLedgerAmount(staffed)).toBe(-3_000);
    expect(careerCoachTrainingModifiers(staffed)).toMatchObject({
      coachId: 'coach-test',
      assistantCoachId: 'assistant-test',
      gainScalePercentByAttribute: {
        pac: 124,
        sho: 130,
        pas: 106,
        def: 100,
        tec: 106,
        sta: 124,
        ref: 100,
      },
    });
  });

  test.each<[CoachSpecialty, readonly string[]]>([
    ['ATTACK', ['sho']],
    ['DEFENSE', ['def']],
    ['FITNESS', ['pac', 'sta']],
    ['TECHNIQUE', ['pas', 'tec']],
    ['GOALKEEPING', ['ref']],
  ])(
    'maps %s to its documented training attributes',
    (specialty, boostedAttributes) => {
      const modifiers = careerCoachTrainingModifiers(
        marketWithCoach(
          [specialty, 'MOTIVATOR'] as readonly [CoachSpecialty, CoachSpecialty],
          2,
        ),
      );
      const boosted = Object.entries(modifiers.gainScalePercentByAttribute)
        .filter(([, scale]) => scale > 100)
        .map(([attribute]) => attribute);

      expect(boosted).toEqual(boostedAttributes);
      expect(modifiers.specialtyBonusPercent).toBe(12);
    },
  );

  test('does not treat Motivator as a direct stat-training specialty', () => {
    const modifiers = careerCoachTrainingModifiers(
      marketWithCoach(['MOTIVATOR', 'ATTACK'], 2),
    );
    const boosted = Object.entries(modifiers.gainScalePercentByAttribute)
      .filter(([, scale]) => scale > 100)
      .map(([attribute]) => attribute);

    expect(boosted).toEqual(['sho']);
  });

  test('scales a matching integer gain deterministically and leaves other gains unchanged', () => {
    const modifiers = careerCoachTrainingModifiers(
      marketWithCoach(['ATTACK', 'FITNESS'], 3),
    );

    expect(applyCareerCoachTrainingModifier(3, 'sho', modifiers)).toBe(4);
    expect(applyCareerCoachTrainingModifier(3, 'pas', modifiers)).toBe(3);
    expect(applyCareerCoachTrainingModifier(0, 'sho', modifiers)).toBe(0);
  });

  test('rejects malformed persisted coach values and unsafe gain calculations', () => {
    expect(() =>
      careerCoachTrainingModifiers(marketWithCoach(['ATTACK', 'FITNESS'], 0)),
    ).toThrow(/level/);
    expect(() =>
      careerCoachWageLedgerAmount(
        marketWithCoach(['ATTACK', 'FITNESS'], 1, -1),
      ),
    ).toThrow(/wage/);
    const modifiers = careerCoachTrainingModifiers(marketWithCoach());
    expect(() =>
      applyCareerCoachTrainingModifier(-1, 'sho', modifiers),
    ).toThrow(/gain/);
    expect(() =>
      applyCareerCoachTrainingModifier(
        Number.MAX_SAFE_INTEGER,
        'sho',
        modifiers,
      ),
    ).toThrow(/safe integer range/);
  });
});
