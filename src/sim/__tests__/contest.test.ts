import {
  conditionedRatingD64,
  contest,
  contestProbability,
  conditionD64,
  D64_SCALE,
  ratingD64,
} from '../contest';
import { mulberry32 } from '../rng';

describe('scale-invariant fixed-point contests', () => {
  it('gives equal conditioned ratings a 50% chance', () => {
    expect(contestProbability(
      conditionedRatingD64(50, 100),
      conditionedRatingD64(50, 100),
    )).toBeCloseTo(0.5, 3);
  });

  it('maps a 1.2x advantage through the fitted opening-match sensitivity', () => {
    const probability = contestProbability(ratingD64(60), ratingD64(50));
    expect(probability).toBeGreaterThan(0.60);
    expect(probability).toBeLessThan(0.62);
  });

  it('interpolates the committed logistic table exactly at whole d64 points', () => {
    for (let difference = -99; difference <= 99; difference += 1) {
      const truth = Math.round(65536 / (1 + Math.exp(-difference / 12))) / 65536;
      expect(contestProbability(difference * D64_SCALE, 0)).toBe(truth);
    }
  });

  it('is monotonic at sub-point precision and clamps beyond ±99 points', () => {
    expect(contestProbability(100 * D64_SCALE, 0))
      .toBe(contestProbability(99 * D64_SCALE, 0));
    let previous = 0;
    for (let differenceD64 = -99 * D64_SCALE;
      differenceD64 <= 99 * D64_SCALE;
      differenceD64 += 1) {
      const probability = contestProbability(differenceD64, 0);
      expect(probability).toBeGreaterThanOrEqual(previous);
      previous = probability;
    }
  });

  it('keeps random equal ratios within one interpolation step across the 1–999 scale', () => {
    for (const [attacker, defender, scale] of [
      [4, 5, 10],
      [7, 11, 9],
      [20, 17, 20],
      [31, 23, 30],
    ] as const) {
      const base = contestProbability(ratingD64(attacker), ratingD64(defender));
      const scaled = contestProbability(
        ratingD64(attacker * scale),
        ratingD64(defender * scale),
      );
      expect(Math.abs(base - scaled)).toBeLessThanOrEqual(0.001);
    }
    const random = mulberry32(20_260_729);
    for (let sample = 0; sample < 1_000; sample += 1) {
      const attacker = 1 + Math.floor(random() * 333);
      const defender = 1 + Math.floor(random() * 333);
      const maximumScale = Math.floor(999 / Math.max(attacker, defender));
      const scale = 1 + Math.floor(random() * maximumScale);
      const base = contestProbability(ratingD64(attacker), ratingD64(defender));
      const scaled = contestProbability(
        ratingD64(attacker * scale),
        ratingD64(defender * scale),
      );
      expect(Math.abs(base - scaled)).toBeLessThanOrEqual(0.001);
    }
  });

  it('keeps every division home-tier drill measurable at its star rating', () => {
    for (const [rating, gain] of [
      [94, 5],
      [180, 8],
      [268, 12],
      [356, 17],
      [442, 23],
    ] as const) {
      const before = contestProbability(ratingD64(rating), ratingD64(rating));
      const after = contestProbability(ratingD64(rating + gain), ratingD64(rating));
      expect(after - before).toBeGreaterThanOrEqual(0.01);
    }
  });

  it('floors fractional condition deterministically and preserves the 75% floor', () => {
    expect(conditionD64(63.999)).toBe(conditionD64(63));
    expect(conditionD64(64)).toBeGreaterThan(conditionD64(63));
    expect(conditionD64(-10)).toBe(conditionD64(0));
    expect(conditionD64(110)).toBe(conditionD64(100));
    expect(contestProbability(
      conditionedRatingD64(100, 0),
      conditionedRatingD64(75, 100),
    )).toBeCloseTo(0.5, 3);
  });

  it('rejects invalid ratings instead of silently clamping them', () => {
    expect(() => ratingD64(0)).toThrow(/1 to 999/);
    expect(() => ratingD64(1000)).toThrow(/1 to 999/);
    expect(() => ratingD64(1.5)).toThrow(/1 to 999/);
  });

  it('statistically follows the calculated ratio probability', () => {
    const rng = mulberry32(123);
    const attacker = ratingD64(60);
    const defender = ratingD64(40);
    const expected = contestProbability(attacker, defender);
    let wins = 0;
    for (let index = 0; index < 10_000; index += 1) {
      if (contest(rng, attacker, defender)) wins += 1;
    }
    expect(Math.abs(wins / 10_000 - expected)).toBeLessThan(0.025);
  });

  it('consumes exactly one RNG draw per contest, win or lose', () => {
    let calls = 0;
    const winRng = () => { calls += 1; return 0; };
    const loseRng = () => { calls += 1; return 0.999999; };
    const attacker = ratingD64(60);
    const defender = ratingD64(40);
    expect(contest(winRng, attacker, defender)).toBe(true);
    expect(calls).toBe(1);
    expect(contest(loseRng, attacker, defender)).toBe(false);
    expect(calls).toBe(2);
  });
});
