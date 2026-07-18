import {
  chooseWeightedOutcome,
  deterministicCareerEventRoll,
  M1_AWAKENING_RETRY_FIRST_WEEK,
  M1_AWAKENING_RETRY_LAST_WEEK,
  recordEventChoice,
  rollWeeklyEvent,
  simulateWeeklyAwakeningRetryWindow,
  type EventClockState,
} from '../event-clock';

describe('weekly event clock', () => {
  it('offers at roll 17 and does not offer at roll 18', () => {
    const state = { weeksWithoutEvent: 0, riskyChoices: 0 };

    expect(rollWeeklyEvent(state, 17)).toEqual({
      offered: true,
      state: { weeksWithoutEvent: 0, riskyChoices: 0 },
    });
    expect(rollWeeklyEvent(state, 18)).toEqual({
      offered: false,
      state: { weeksWithoutEvent: 1, riskyChoices: 0 },
    });
  });

  it('guarantees an event on the eighth consecutive eventless week', () => {
    const seventhMiss = rollWeeklyEvent({ weeksWithoutEvent: 6, riskyChoices: 2 }, 99);
    expect(seventhMiss).toEqual({
      offered: false,
      state: { weeksWithoutEvent: 7, riskyChoices: 2 },
    });

    const guaranteed = rollWeeklyEvent(seventhMiss.state, 99);
    expect(guaranteed).toEqual({
      offered: true,
      state: { weeksWithoutEvent: 0, riskyChoices: 2 },
    });
  });

  it('resets the eventless count whenever a normal roll offers an event', () => {
    expect(rollWeeklyEvent({ weeksWithoutEvent: 4, riskyChoices: 3 }, 0)).toEqual({
      offered: true,
      state: { weeksWithoutEvent: 0, riskyChoices: 3 },
    });
  });

  it.each([-1, 100, 1.5, Number.NaN])('rejects invalid percent roll %p', roll => {
    expect(() => rollWeeklyEvent({ weeksWithoutEvent: 0, riskyChoices: 0 }, roll)).toThrow(
      'integer from 0 to 99',
    );
  });
});

describe('event choice risk count', () => {
  it('increments only for risky choices without mutating the input', () => {
    const state: EventClockState = { weeksWithoutEvent: 3, riskyChoices: 4 };

    const safe = recordEventChoice(state, false);
    const risky = recordEventChoice(state, true);

    expect(state).toEqual({ weeksWithoutEvent: 3, riskyChoices: 4 });
    expect(safe).toEqual({ weeksWithoutEvent: 3, riskyChoices: 4 });
    expect(risky).toEqual({ weeksWithoutEvent: 3, riskyChoices: 5 });
    expect(safe).not.toBe(state);
    expect(risky).not.toBe(state);
  });
});

describe('weighted outcome selection', () => {
  it.each([
    [0, 0],
    [1, 0],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 2],
  ])('maps roll %i to stable cumulative index %i', (roll, expectedIndex) => {
    expect(chooseWeightedOutcome([2, 3, 1], roll)).toBe(expectedIndex);
  });

  it('is deterministic and does not mutate weights', () => {
    const weights = Object.freeze([4, 2, 7]);

    const first = chooseWeightedOutcome(weights, 6);
    const second = chooseWeightedOutcome(weights, 6);

    expect(first).toBe(2);
    expect(second).toBe(first);
    expect(weights).toEqual([4, 2, 7]);
  });

  it.each([
    [[]],
    [[0]],
    [[-1, 2]],
    [[1.5, 2]],
    [[Number.MAX_SAFE_INTEGER + 1]],
    [[Number.MAX_SAFE_INTEGER, 1]],
  ])('rejects invalid weights %p', weights => {
    expect(() => chooseWeightedOutcome(weights, 0)).toThrow();
  });

  it.each([-1, 6, 1.5, Number.NaN])('rejects out-of-range weighted roll %p', roll => {
    expect(() => chooseWeightedOutcome([2, 3, 1], roll)).toThrow('weighted outcome roll');
  });
});

describe('event clock validation and immutability', () => {
  it.each([
    { weeksWithoutEvent: -1, riskyChoices: 0 },
    { weeksWithoutEvent: 1.5, riskyChoices: 0 },
    { weeksWithoutEvent: 0, riskyChoices: -1 },
    { weeksWithoutEvent: 0, riskyChoices: 1.5 },
  ])('rejects invalid state %p', state => {
    expect(() => rollWeeklyEvent(state, 50)).toThrow();
    expect(() => recordEventChoice(state, false)).toThrow();
  });

  it('returns byte-identical output for identical input and leaves that input unchanged', () => {
    const state = Object.freeze({ weeksWithoutEvent: 2, riskyChoices: 1 });

    const first = rollWeeklyEvent(state, 73);
    const second = rollWeeklyEvent(state, 73);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(state).toEqual({ weeksWithoutEvent: 2, riskyChoices: 1 });
    expect(first.state).not.toBe(state);
  });
});

describe('deterministic career event rolls', () => {
  it('returns the same stream value from the same persisted context', () => {
    const context = Object.freeze({ careerSeed: 456, season: 1, week: 9, riskyChoices: 1 });

    const first = deterministicCareerEventRoll(context, 'approach-spider', 0, 100);
    const second = deterministicCareerEventRoll(context, 'approach-spider', 0, 100);

    expect(first).toBe(second);
    expect(context).toEqual({ careerSeed: 456, season: 1, week: 9, riskyChoices: 1 });
  });

  it('keeps choice streams independent', () => {
    const context = { careerSeed: 456, season: 1, week: 9, riskyChoices: 1 };
    expect(deterministicCareerEventRoll(context, 'approach-spider', 0, 100))
      .not.toBe(deterministicCareerEventRoll(context, 'approach-spider', 1, 100));
  });

  it.each([
    [{ careerSeed: -1, season: 1, week: 9, riskyChoices: 1 }],
    [{ careerSeed: 1, season: 0, week: 9, riskyChoices: 1 }],
    [{ careerSeed: 1, season: 1, week: 0, riskyChoices: 1 }],
    [{ careerSeed: 1, season: 1, week: 9, riskyChoices: -1 }],
  ])('rejects invalid roll context %p', context => {
    expect(() => deterministicCareerEventRoll(context, 'approach-spider', 0, 100)).toThrow();
  });
});

describe('M1 awakening retry window', () => {
  it('retries weekly and always resolves by the Week-24 pity deadline', () => {
    for (let careerSeed = 1; careerSeed <= 200; careerSeed += 1) {
      const result = simulateWeeklyAwakeningRetryWindow({
        careerSeed,
        season: 1,
        firstWeek: M1_AWAKENING_RETRY_FIRST_WEEK,
        lastWeek: M1_AWAKENING_RETRY_LAST_WEEK,
        // Adopting the spider is itself the first failed risky choice.
        initialFailedRiskyChoices: 1,
        choiceId: 'approach-spider',
        baseChancePercent: 8,
        pityIncrementPercent: 6,
      });

      expect(result.awakened).toBe(true);
      expect(result.awakeningWeek).toBeGreaterThanOrEqual(M1_AWAKENING_RETRY_FIRST_WEEK);
      expect(result.awakeningWeek).toBeLessThanOrEqual(M1_AWAKENING_RETRY_LAST_WEEK);
      expect(result.attempts).toBe(result.awakeningWeek! - M1_AWAKENING_RETRY_FIRST_WEEK + 1);
      expect(result.failedRiskyChoices).toBe(0);
    }
  });

  it('reports an unresolved window when pity cannot reach a guaranteed roll', () => {
    const result = simulateWeeklyAwakeningRetryWindow({
      careerSeed: 1,
      season: 1,
      firstWeek: 9,
      lastWeek: 9,
      initialFailedRiskyChoices: 0,
      choiceId: 'approach-spider',
      baseChancePercent: 0,
      pityIncrementPercent: 0,
    });

    expect(result).toEqual({ awakened: false, attempts: 1, failedRiskyChoices: 1 });
  });
});
