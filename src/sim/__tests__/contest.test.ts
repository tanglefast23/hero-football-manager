import { contestProbability, contest } from '../contest';
import { mulberry32 } from '../rng';

describe('contest (table-based logistic)', () => {
  it('equal stats = 50%', () => {
    expect(contestProbability(50, 50)).toBeCloseTo(0.5, 3);
  });

  it('+20 advantage ≈ 84%', () => {
    expect(contestProbability(60, 40)).toBeCloseTo(0.8411, 2);
  });

  it('matches the true logistic within 1e-4 across the whole range', () => {
    for (let d = -99; d <= 99; d++) {
      const truth = 1 / (1 + Math.exp(-d / 12)); // Math.exp fine IN TESTS (approximation check, not runtime)
      expect(Math.abs(contestProbability(50 + d, 50) - truth)).toBeLessThan(1e-4);
      expect(contestProbability(50 + d, 50)).toBe(Math.round(65536 / (1 + Math.exp(-d / 12))) / 65536);
    }
  });

  it('is monotonic and clamps beyond ±99', () => {
    expect(contestProbability(200, 0)).toBe(contestProbability(149, 50));
    let prev = 0;
    for (let d = -99; d <= 99; d++) {
      const p = contestProbability(50 + d, 50);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it('statistical: 60v40 wins ~84% over 10k seeded rolls', () => {
    const rng = mulberry32(123);
    let wins = 0;
    for (let i = 0; i < 10000; i++) if (contest(rng, 60, 40)) wins++;
    expect(wins / 10000).toBeGreaterThan(0.81);
    expect(wins / 10000).toBeLessThan(0.87);
  });
});
