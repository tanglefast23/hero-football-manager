import {
  applyCareerCoachTrainingModifier,
  cappedCoachBoost,
  careerCoachTrainingModifiers,
  careerCoachWeeklyTrainingPoints,
  coachWeeklyTrainingPoints,
  coachMotivatorStrengthHalfPercentUnits,
} from '../coach-weekly';
import type { CoachBoosts, CoachCandidate, CoachSpecialty } from '../market';
import type { CareerMarketState } from '../market-career';

/**
 * A story can permanently change a coach, and there are exactly two ways that
 * could have ruined a save.
 *
 * `applyCareerCoachTrainingModifier` throws outside 100..175 rather than
 * clamping. Permanent boosts cannot be un-earned, so the boundary must keep
 * both positive and negative story results inside that safe band.
 */

function coach(
  level: number,
  specialties: [CoachSpecialty, CoachSpecialty],
  boosts?: CoachBoosts,
): CoachCandidate {
  return {
    id: `coach-${level}-${specialties.join('-')}`,
    name: 'A Coach',
    specialties,
    level,
    weeklyWage: 100,
    personality: 'PROFESSIONAL',
    requiredDivision: 5,
    requiredFame: 0,
    loyaltyDiscountPercent: 0,
    ...(boosts === undefined ? {} : { boosts }),
  };
}

function market(
  head?: CoachCandidate,
  assistant?: CoachCandidate,
): CareerMarketState {
  return {
    coachCandidates: [],
    ...(head === undefined ? {} : { headCoach: head }),
    ...(assistant === undefined ? {} : { assistantCoach: assistant }),
  } as unknown as CareerMarketState;
}

const scaleFor = (state: CareerMarketState) =>
  careerCoachTrainingModifiers(state).gainScalePercentByAttribute.sho;

describe('coach training boosts', () => {
  it('keeps a boosted max-level pair inside the ceiling', () => {
    const maxed = market(
      coach(5, ['ATTACK', 'MOTIVATOR'], { trainingPercent: 5 }),
      coach(5, ['ATTACK', 'FITNESS']),
    );
    expect(scaleFor(maxed)).toBe(150);
    expect(() =>
      applyCareerCoachTrainingModifier(
        10,
        'sho',
        careerCoachTrainingModifiers(maxed),
      ),
    ).not.toThrow();
  });

  it('does not throw when a negative boost would drop below the floor', () => {
    const sulking = market(
      undefined,
      coach(1, ['ATTACK', 'FITNESS'], { trainingPercent: -10 }),
    );
    // 100 + 3 − 10 would be 93, which the validator rejects.
    expect(scaleFor(sulking)).toBe(100);
    expect(() =>
      applyCareerCoachTrainingModifier(
        10,
        'sho',
        careerCoachTrainingModifiers(sulking),
      ),
    ).not.toThrow();
  });

  it('applies the boost where it has room to land', () => {
    const room = market(
      coach(2, ['ATTACK', 'FITNESS'], { trainingPercent: 5 }),
    );
    expect(scaleFor(room)).toBe(117);
  });

  it('only pays the boost on the specialty the coach actually holds', () => {
    const attacker = market(
      coach(2, ['ATTACK', 'FITNESS'], { trainingPercent: 5 }),
    );
    const modifiers = careerCoachTrainingModifiers(attacker);
    expect(modifiers.gainScalePercentByAttribute.sho).toBe(117);
    // DEFENSE is not his, so neither the level bonus nor the boost applies.
    expect(modifiers.gainScalePercentByAttribute.def).toBe(100);
  });

  it('caps every permanent story facet however much content authors', () => {
    expect(cappedCoachBoost({ trainingPercent: 30 }, 'trainingPercent')).toBe(
      10,
    );
    expect(cappedCoachBoost({ trainingPercent: -30 }, 'trainingPercent')).toBe(
      -10,
    );
    expect(cappedCoachBoost({ weeklyTp: 9 }, 'weeklyTp')).toBe(4);
    expect(
      cappedCoachBoost({ motivatorHalfLevels: 9 }, 'motivatorHalfLevels'),
    ).toBe(2);
    expect(cappedCoachBoost(undefined, 'trainingPercent')).toBe(0);
  });
});

describe('coach weekly training points with boosts', () => {
  it('adds the boost to what the level already produces', () => {
    // Derived, not hardcoded: every weekly TP source is scaled by
    // TRAINING_POINT_SCALE_PERCENT, so a literal here would break the next time
    // that dial moves and would say nothing about the boost either way.
    const base = coachWeeklyTrainingPoints(3, 'HEAD');
    expect(
      careerCoachWeeklyTrainingPoints(market(coach(3, ['ATTACK', 'FITNESS']))),
    ).toBe(base);
    expect(
      careerCoachWeeklyTrainingPoints(
        market(coach(3, ['ATTACK', 'FITNESS'], { weeklyTp: 2 })),
      ),
    ).toBe(base + 2);
  });

  it('never lets a coach cost the club training points', () => {
    // The boost is bigger than the whole contribution, so the floor decides.
    const base = coachWeeklyTrainingPoints(1, 'ASSISTANT');
    expect(
      careerCoachWeeklyTrainingPoints(
        market(undefined, coach(1, ['ATTACK', 'FITNESS'], { weeklyTp: -4 })),
      ),
    ).toBe(Math.max(0, base - 4));
  });
});

describe('motivator boosts', () => {
  it('counts in half-percent units, including 2.5% story steps', () => {
    expect(
      coachMotivatorStrengthHalfPercentUnits(
        market(coach(2, ['MOTIVATOR', 'ATTACK'])),
      ),
    ).toBe(16);
    expect(
      coachMotivatorStrengthHalfPercentUnits(
        market(coach(2, ['MOTIVATOR', 'ATTACK'], { motivatorHalfLevels: 1 })),
      ),
    ).toBe(21);
  });

  it('ignores a motivator boost on a coach who is not a Motivator', () => {
    expect(
      coachMotivatorStrengthHalfPercentUnits(
        market(coach(2, ['ATTACK', 'FITNESS'], { motivatorHalfLevels: 2 })),
      ),
    ).toBe(0);
  });

  it('cannot drive the club below no motivation at all', () => {
    expect(
      coachMotivatorStrengthHalfPercentUnits(
        market(coach(1, ['MOTIVATOR', 'ATTACK'], { motivatorHalfLevels: -2 })),
      ),
    ).toBe(0);
  });
});
