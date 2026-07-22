import {
  applyCareerCoachTrainingModifier,
  coachMotivatorBonusPercent,
  coachMotivatorStrengthHalfLevels,
  coachTrainingBonusPercent,
  careerCoachTrainingModifiers,
  careerCoachWeeklyTrainingPoints,
  careerCoachWageLedgerAmount,
} from '../coach-weekly';
import type { CareerMarketState } from '../market-career';
import type { CoachCandidate, CoachSpecialty } from '../market';

function marketWithCoach(
  specialties: readonly [CoachSpecialty, CoachSpecialty] = ['ATTACK', 'FITNESS'],
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
  test('defines exact head and half-strength assistant percentages', () => {
    expect(coachTrainingBonusPercent(1, 'HEAD')).toBe(10);
    expect(coachTrainingBonusPercent(1, 'ASSISTANT')).toBe(5);
    expect(coachMotivatorBonusPercent(1, 'HEAD')).toBe(5);
    expect(coachMotivatorBonusPercent(1, 'ASSISTANT')).toBe(2.5);

    const market = marketWithCoach(['MOTIVATOR', 'ATTACK'], 1);
    expect(coachMotivatorStrengthHalfLevels({
      ...market,
      assistantCoach: {
        ...market.headCoach!,
        id: 'assistant-motivator',
        level: 1,
      },
    })).toBe(3);
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
    expect(careerCoachWeeklyTrainingPoints(market)).toBe(16);
    expect(careerCoachWeeklyTrainingPoints({
      ...market,
      assistantCoach: { ...market.headCoach!, id: 'assistant-test', level: 2 },
    })).toBe(23);
    expect(careerCoachWeeklyTrainingPoints({ ...market, headCoach: undefined })).toBe(0);
  });

  test('applies +10% per quality level only to attributes in either specialty', () => {
    const market = marketWithCoach(['ATTACK', 'FITNESS'], 3);
    const before = JSON.stringify(market);
    const modifiers = careerCoachTrainingModifiers(market);

    expect(modifiers).toEqual({
      coachId: 'coach-test',
      qualityLevel: 3,
      specialtyBonusPercent: 30,
      specialties: ['ATTACK', 'FITNESS'],
      gainScalePercentByAttribute: {
        pac: 130,
        sho: 130,
        pas: 100,
        def: 100,
        tec: 100,
        sta: 130,
        ref: 100,
      },
    });
    expect(JSON.stringify(market)).toBe(before);
    expect(JSON.parse(JSON.stringify(modifiers))).toEqual(modifiers);
  });

  test('adds an assistant at half strength and includes both weekly wages', () => {
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
        pac: 140,
        sho: 150,
        pas: 110,
        def: 100,
        tec: 110,
        sta: 140,
        ref: 100,
      },
    });
  });

  test.each<[
    CoachSpecialty,
    readonly string[],
  ]>([
    ['ATTACK', ['sho']],
    ['DEFENSE', ['def']],
    ['FITNESS', ['pac', 'sta']],
    ['TECHNIQUE', ['pas', 'tec']],
    ['GOALKEEPING', ['ref']],
  ])('maps %s to its documented training attributes', (specialty, boostedAttributes) => {
    const modifiers = careerCoachTrainingModifiers(
      marketWithCoach([specialty, 'MOTIVATOR'] as readonly [CoachSpecialty, CoachSpecialty], 2),
    );
    const boosted = Object.entries(modifiers.gainScalePercentByAttribute)
      .filter(([, scale]) => scale > 100)
      .map(([attribute]) => attribute);

    expect(boosted).toEqual(boostedAttributes);
    expect(modifiers.specialtyBonusPercent).toBe(20);
  });

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
    const modifiers = careerCoachTrainingModifiers(marketWithCoach(['ATTACK', 'FITNESS'], 3));

    expect(applyCareerCoachTrainingModifier(3, 'sho', modifiers)).toBe(4);
    expect(applyCareerCoachTrainingModifier(3, 'pas', modifiers)).toBe(3);
    expect(applyCareerCoachTrainingModifier(0, 'sho', modifiers)).toBe(0);
  });

  test('rejects malformed persisted coach values and unsafe gain calculations', () => {
    expect(() => careerCoachTrainingModifiers(marketWithCoach(['ATTACK', 'FITNESS'], 0)))
      .toThrow(/level/);
    expect(() => careerCoachWageLedgerAmount(marketWithCoach(['ATTACK', 'FITNESS'], 1, -1)))
      .toThrow(/wage/);
    const modifiers = careerCoachTrainingModifiers(marketWithCoach());
    expect(() => applyCareerCoachTrainingModifier(-1, 'sho', modifiers)).toThrow(/gain/);
    expect(() => applyCareerCoachTrainingModifier(Number.MAX_SAFE_INTEGER, 'sho', modifiers))
      .toThrow(/safe integer range/);
  });
});
