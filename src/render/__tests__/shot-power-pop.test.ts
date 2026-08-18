import {
  SHOT_POWER_BAND_COLORS,
  SHOT_POWER_POP_MS,
  shotPowerBand,
  shotPowerPopOpacity,
  shotPowerPopRise,
  shotPowerPopScale,
} from '../shot-power-pop';

const AGES = [-50, 0, 1, 55, 110, 180, 260, 400, 500, 620, 749, 750, 5000];

describe('shot power pop', () => {
  it('overshoots full size, then settles on exactly full size', () => {
    expect(shotPowerPopScale(0)).toBeLessThan(1);
    expect(shotPowerPopScale(110)).toBeGreaterThan(1.2);
    expect(shotPowerPopScale(260)).toBe(1);
    expect(shotPowerPopScale(SHOT_POWER_POP_MS)).toBe(1);
  });

  it('holds solid, then fades to nothing by the end', () => {
    expect(shotPowerPopOpacity(0)).toBe(1);
    expect(shotPowerPopOpacity(499)).toBe(1);
    expect(shotPowerPopOpacity(625)).toBeCloseTo(0.5, 5);
    expect(shotPowerPopOpacity(SHOT_POWER_POP_MS)).toBe(0);
  });

  it('stays put until the fade starts, then drifts up', () => {
    expect(shotPowerPopRise(0)).toBe(0);
    expect(shotPowerPopRise(500)).toBe(0);
    expect(shotPowerPopRise(SHOT_POWER_POP_MS)).toBeGreaterThan(0);
    expect(shotPowerPopRise(625)).toBeLessThan(
      shotPowerPopRise(SHOT_POWER_POP_MS),
    );
  });

  it('bands power on the range play actually reaches, not the 999 clamp', () => {
    expect(shotPowerBand(59)).toBe(0);
    expect(shotPowerBand(60)).toBe(1);
    expect(shotPowerBand(89)).toBe(1);
    expect(shotPowerBand(90)).toBe(2);
    expect(shotPowerBand(141)).toBe(2);
    expect(SHOT_POWER_BAND_COLORS).toHaveLength(3);
  });

  it('never returns a value out of range, for any age it can be handed', () => {
    for (const age of [...AGES, Number.NaN, Number.POSITIVE_INFINITY]) {
      const scale = shotPowerPopScale(age);
      const opacity = shotPowerPopOpacity(age);
      const rise = shotPowerPopRise(age);
      expect(Number.isFinite(scale)).toBe(true);
      expect(scale).toBeGreaterThan(0);
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(1);
      expect(rise).toBeGreaterThanOrEqual(0);
    }
    expect(shotPowerBand(Number.NaN)).toBe(0);
  });
});
