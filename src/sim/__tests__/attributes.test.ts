import {
  matchAttribute,
  matchPaceAttribute,
  MAX_PLAYER_ATTRIBUTE,
  paceAdvantagePercent,
  paceSpeed128,
  PACE_SPEED_SCALE,
  slideStaminaDrainScale,
  staminaEnduranceScale,
} from '../attributes';

describe('open-ended career attribute match scale', () => {
  it('preserves every existing 1–99 rating exactly', () => {
    for (let rating = 1; rating <= 99; rating += 1) {
      expect(matchAttribute(rating)).toBe(rating);
    }
  });

  it('adds diminishing, bounded match strength above 99', () => {
    expect(matchAttribute(200)).toBe(116);
    expect(matchAttribute(500)).toBe(132);
    expect(matchAttribute(MAX_PLAYER_ATTRIBUTE)).toBe(140);
    expect(matchAttribute(MAX_PLAYER_ATTRIBUTE)).toBeLessThan(149);
  });

  it('anchors D5 pace, stays strictly increasing, and caps ordinary speed at 2x', () => {
    expect(paceSpeed128(73)).toBe(113 * PACE_SPEED_SCALE);
    let previous = 0;
    for (let rating = 1; rating <= MAX_PLAYER_ATTRIBUTE; rating += 1) {
      expect(paceSpeed128(rating)).toBeGreaterThan(previous);
      previous = paceSpeed128(rating);
    }
    expect(paceSpeed128(MAX_PLAYER_ATTRIBUTE)).toBeLessThanOrEqual(
      paceSpeed128(1) * 2,
    );
    expect(matchPaceAttribute(200)).toBe(85);
    expect(matchPaceAttribute(500)).toBe(97);
    expect(paceAdvantagePercent(MAX_PLAYER_ATTRIBUTE, 90)).toBe(27);
  });

  it('rejects ratings outside the universal safety scale', () => {
    expect(() => matchAttribute(0)).toThrow(/1 to 999/);
    expect(() => matchAttribute(1_000)).toThrow(/1 to 999/);
  });

  it('preserves the shipped stamina curve within 1/1000 and keeps every tier drill live', () => {
    const shipped = (rating: number, slide: boolean): number => {
      const effective = matchAttribute(rating);
      if (effective <= 99) {
        return slide
          ? 1 + (0.6 * (100 - effective)) / 100
          : 1.6 - effective * 0.006;
      }
      return Math.max(0.65, 1.006 - (effective - 99) * (slide ? 0.009 : 0.008));
    };
    for (let rating = 1; rating <= MAX_PLAYER_ATTRIBUTE; rating += 1) {
      expect(
        Math.abs(
          Math.round(staminaEnduranceScale(rating) * 1000) -
            Math.round(shipped(rating, false) * 1000),
        ),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(
          Math.round(slideStaminaDrainScale(rating) * 1000) -
            Math.round(shipped(rating, true) * 1000),
        ),
      ).toBeLessThanOrEqual(1);
    }
    for (const [rating, gain] of [
      [94, 5],
      [180, 8],
      [268, 12],
      [356, 17],
      [442, 23],
    ] as const) {
      expect(staminaEnduranceScale(rating + gain)).toBeLessThan(
        staminaEnduranceScale(rating),
      );
      expect(slideStaminaDrainScale(rating + gain)).toBeLessThan(
        slideStaminaDrainScale(rating),
      );
    }
    expect(staminaEnduranceScale(40)).toBeCloseTo(1.36);
    expect(staminaEnduranceScale(80)).toBeCloseTo(1.12);
    expect(staminaEnduranceScale(999)).toBeCloseTo(0.678);
    expect(slideStaminaDrainScale(999)).toBe(0.65);
  });
});
