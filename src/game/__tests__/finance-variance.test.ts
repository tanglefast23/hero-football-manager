import {
  applyVariancePercent,
  matchdayVarianceRoll,
} from '../finance-variance';

// In-range seeds only: the persisted careerSeed contract is uint32
// (game-state-codec pins it; event-clock validates 0…0xffffffff).
const seedGrid = Array.from(
  { length: 3000 },
  (_, i) => Math.imul(i, 2654435761) >>> 0,
);

describe('matchdayVarianceRoll', () => {
  it('is deterministic for identical inputs', () => {
    expect(matchdayVarianceRoll(123456, 1, 5, 'league-gate')).toEqual(
      matchdayVarianceRoll(123456, 1, 5, 'league-gate'),
    );
  });

  it('rolls independently per source in the same week', () => {
    const seeds = seedGrid.slice(0, 200);
    const gate = seeds.map(
      (seed) => matchdayVarianceRoll(seed, 2, 9, 'league-gate').percent,
    );
    const merch = seeds.map(
      (seed) => matchdayVarianceRoll(seed, 2, 9, 'merch').percent,
    );
    expect(gate).not.toEqual(merch);
  });

  it('always lands inside a legal band and surge matches the band', () => {
    for (const seed of seedGrid.slice(0, 500)) {
      for (const source of ['league-gate', 'cup-gate', 'merch'] as const) {
        const roll = matchdayVarianceRoll(
          seed,
          1 + (seed % 3),
          1 + (seed % 29),
          source,
        );
        expect(Number.isSafeInteger(roll.percent)).toBe(true);
        if (roll.surge) {
          expect(roll.percent).toBeGreaterThanOrEqual(11);
          expect(roll.percent).toBeLessThanOrEqual(20);
        } else {
          expect(roll.percent).toBeGreaterThanOrEqual(-10);
          expect(roll.percent).toBeLessThanOrEqual(10);
        }
      }
    }
  });

  it('surges close to 10% of the time over the fixed seed grid', () => {
    const surges = seedGrid.filter(
      (seed) => matchdayVarianceRoll(seed, 1, 5, 'merch').surge,
    ).length;
    // 308/3000 = 10.27%, measured once on the fixed grid and pinned: any drift
    // means the roll or the seed mixing changed, which is a determinism break.
    expect(surges).toBe(308);
  });

  it('rejects out-of-contract inputs', () => {
    expect(() => matchdayVarianceRoll(0.5, 1, 1, 'merch')).toThrow();
    expect(() => matchdayVarianceRoll(-1, 1, 1, 'merch')).toThrow();
    expect(() => matchdayVarianceRoll(0x100000000, 1, 1, 'merch')).toThrow();
    expect(() => matchdayVarianceRoll(1, 0, 1, 'merch')).toThrow();
    expect(() => matchdayVarianceRoll(1, 1, 0, 'merch')).toThrow();
  });
});

describe('applyVariancePercent', () => {
  it('applies the rolled percent with round()', () => {
    expect(applyVariancePercent(1000, 10)).toBe(1100);
    expect(applyVariancePercent(1000, -10)).toBe(900);
    expect(applyVariancePercent(999, 15)).toBe(1149);
    expect(applyVariancePercent(0, 20)).toBe(0);
  });

  it('keeps every intermediate a safe integer', () => {
    expect(() =>
      applyVariancePercent(Number.MAX_SAFE_INTEGER - 1, 20),
    ).toThrow();
  });
});
