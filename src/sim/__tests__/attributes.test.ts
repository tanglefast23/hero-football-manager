import {
  matchAttribute,
  matchPaceAttribute,
  MAX_PLAYER_ATTRIBUTE,
  paceAdvantagePercent,
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

  it('keeps normal legendary pace near the 38% soft target and hard-caps raw 999 at 60%', () => {
    expect(matchPaceAttribute(200)).toBe(108);
    expect(matchPaceAttribute(500)).toBe(122);
    expect(matchPaceAttribute(930)).toBe(138);
    expect(paceAdvantagePercent(930, 90)).toBe(37);
    expect(matchPaceAttribute(MAX_PLAYER_ATTRIBUTE)).toBe(168);
    expect(paceAdvantagePercent(MAX_PLAYER_ATTRIBUTE, 90)).toBe(60);
  });

  it('rejects ratings outside the universal safety scale', () => {
    expect(() => matchAttribute(0)).toThrow(/1 to 999/);
    expect(() => matchAttribute(1_000)).toThrow(/1 to 999/);
  });

  it('keeps the old stamina curve through 99 and a non-zero drain floor above it', () => {
    expect(staminaEnduranceScale(40)).toBeCloseTo(1.36);
    expect(staminaEnduranceScale(80)).toBeCloseTo(1.12);
    expect(staminaEnduranceScale(999)).toBeCloseTo(0.678);
    expect(slideStaminaDrainScale(999)).toBe(0.65);
  });
});
