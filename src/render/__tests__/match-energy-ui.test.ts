import {
  ENERGY_USE_ACCESSIBILITY,
  ENERGY_USE_LABELS,
  energyBand,
  summarizeTeamEnergy,
} from '../match-energy-ui';

describe('match energy UI', () => {
  test('uses the same three visible energy bands at their exact boundaries', () => {
    expect(energyBand(100)).toBe('green');
    expect(energyBand(61)).toBe('green');
    expect(energyBand(60)).toBe('amber');
    expect(energyBand(31)).toBe('amber');
    expect(energyBand(30)).toBe('red');
    expect(energyBand(0)).toBe('red');
  });

  test('summarizes team energy and counts current players at 40 or below', () => {
    expect(summarizeTeamEnergy([100, 61, 60, 41, 40, 30, 0])).toEqual({
      average: 47,
      tiredCount: 3,
    });
    expect(summarizeTeamEnergy([])).toEqual({ average: 0, tiredCount: 0 });
  });

  test('keeps exact labels and explains the consequence of each effort choice', () => {
    expect(ENERGY_USE_LABELS).toEqual({
      SAVE_ENERGY: 'SAVE ENERGY',
      BALANCED: 'BALANCED',
      ALL_OUT: 'ALL OUT',
    });
    expect(ENERGY_USE_ACCESSIBILITY.SAVE_ENERGY).toContain('conserve energy');
    expect(ENERGY_USE_ACCESSIBILITY.BALANCED).toContain('normal movement');
    expect(ENERGY_USE_ACCESSIBILITY.ALL_OUT).toContain('higher energy cost');
  });
});
