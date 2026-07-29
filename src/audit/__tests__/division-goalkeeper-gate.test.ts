import artifact from '../fixtures/division-goalkeeper-gate.json';
import { DIVISION_GOALKEEPER_REF_RATINGS } from '../../game/pyramid';

describe('division goalkeeper balance acceptance gate', () => {
  it('pins the explicit goalkeeper REF ladder and frozen sample protocol', () => {
    expect(artifact.version).toBe(1);
    expect(artifact.rosterSeed).toBe(20_260_729);
    expect(artifact.matchesPerDivision).toBe(100);
    expect(artifact.matchSeedStride).toBe(7_919);
    expect(DIVISION_GOALKEEPER_REF_RATINGS).toEqual(artifact.ratings);
  });

  it('keeps peer matches inside the locked score and keeper-dominance rails', () => {
    const [minimumGoals, maximumGoals] = artifact.rails.goalsPerMatch;
    const [minimumSaveRate, maximumSaveRate] = artifact.rails.saveRate;

    for (const sample of Object.values(artifact.divisions)) {
      expect(sample.goalsPerMatch).toBe(sample.goals / artifact.matchesPerDivision);
      expect(sample.saveRate).toBe(sample.saves / (sample.saves + sample.goals));
      expect(sample.goalsPerMatch).toBeGreaterThanOrEqual(minimumGoals);
      expect(sample.goalsPerMatch).toBeLessThanOrEqual(maximumGoals);
      expect(sample.saveRate).toBeGreaterThanOrEqual(minimumSaveRate);
      expect(sample.saveRate).toBeLessThanOrEqual(maximumSaveRate);
    }
  });
});
