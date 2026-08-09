import artifact from '../fixtures/scale-invariant-opening-gate.json';

type Outcome = 'W' | 'D' | 'L';

describe('scale-invariant opening acceptance artifact', () => {
  it('freezes disjoint paired fit and held-out cohorts', () => {
    const fitSeeds = artifact.cohorts.fit.seeds;
    const heldOutSeeds = artifact.cohorts.heldOut.seeds;
    expect(fitSeeds).toHaveLength(1_000);
    expect(heldOutSeeds).toHaveLength(1_000);
    expect(new Set([...fitSeeds, ...heldOutSeeds]).size).toBe(2_000);
    expect(artifact.bootstrap).toEqual({ resamples: 10_000, seed: 20_260_729 });
  });

  it.each(['fit', 'heldOut'] as const)(
    'contains complete paired %s outcomes',
    (cohortName) => {
      const cohort = artifact.cohorts[cohortName];
      const expected = 1_000;
      for (const build of ['baseline', 'phaseAFinal'] as const) {
        for (const training of ['trained', 'control'] as const) {
          const outcomes = cohort[build][training];
          expect(outcomes).toHaveLength(expected);
          expect(
            outcomes.every((outcome) => ['W', 'D', 'L'].includes(outcome)),
          ).toBe(true);
          const aggregate = cohort.aggregateResults[build][training];
          expect(aggregate.wins + aggregate.draws + aggregate.losses).toBe(
            expected,
          );
        }
      }
    },
  );

  it('pins the accepted calibration', () => {
    expect(artifact.version).toBe(3);
    expect(artifact.fitted).toEqual({ logRatioK: 29, shotKeeperModD64: 0 });
  });

  it('fits every untrained calibration W/D/L point estimate inside ±3 percentage points', () => {
    const cohort = artifact.cohorts.fit;
    for (const outcome of ['W', 'D', 'L'] as const) {
      const difference =
        outcomeRate(cohort.phaseAFinal.control as Outcome[], outcome) -
        outcomeRate(cohort.baseline.control as Outcome[], outcome);
      expect(difference).toBeGreaterThanOrEqual(-0.03);
      expect(difference).toBeLessThanOrEqual(0.03);
    }
  });

  it('holds every paired untrained W/D/L bootstrap interval inside ±3 percentage points', () => {
    const cohort = artifact.cohorts.heldOut;
    for (const outcome of ['W', 'D', 'L'] as const) {
      const interval = pairedBootstrapInterval(
        cohort.baseline.control as Outcome[],
        cohort.phaseAFinal.control as Outcome[],
        outcome,
        artifact.bootstrap.resamples,
        artifact.bootstrap.seed,
      );
      expect(interval.low).toBeGreaterThanOrEqual(-0.03);
      expect(interval.high).toBeLessThanOrEqual(0.03);
    }
  });

  it.each(['fit', 'heldOut'] as const)(
    'keeps the final %s opening cohort inside both locked loss-rate rails',
    (cohortName) => {
      const final = artifact.cohorts[cohortName].aggregateResults.phaseAFinal;
      expect(final.control.losses / 1_000).toBeGreaterThanOrEqual(0.9);
      expect(final.control.losses / 1_000).toBeLessThanOrEqual(0.95);
      expect(final.trained.losses / 1_000).toBeGreaterThanOrEqual(0.9);
      expect(final.trained.losses / 1_000).toBeLessThanOrEqual(0.95);
    },
  );

  it('proves why the deliberately changed trained path is not a baseline-equivalence input', () => {
    for (const cohortName of ['fit', 'heldOut'] as const) {
      const cohort = artifact.cohorts[cohortName];
      const baselineLossRate =
        cohort.aggregateResults.baseline.trained.losses / 1_000;
      const finalLossRate =
        cohort.aggregateResults.phaseAFinal.trained.losses / 1_000;
      expect(finalLossRate).toBeGreaterThanOrEqual(0.9);
      if (baselineLossRate < 0.87) {
        expect(finalLossRate - baselineLossRate).toBeGreaterThan(0.03);
      }
    }
  });
});

function outcomeRate(outcomes: readonly Outcome[], outcome: Outcome): number {
  return (
    outcomes.filter((candidate) => candidate === outcome).length /
    outcomes.length
  );
}

function pairedBootstrapInterval(
  baseline: Outcome[],
  phaseA: Outcome[],
  outcome: Outcome,
  resamples: number,
  seed: number,
): { low: number; high: number } {
  if (baseline.length !== phaseA.length)
    throw new Error('paired cohorts must have equal length');
  const random = mulberry32(seed ^ outcome.charCodeAt(0) ^ baseline.length);
  const estimates = new Array<number>(resamples);
  for (let sample = 0; sample < resamples; sample += 1) {
    let difference = 0;
    for (let draw = 0; draw < baseline.length; draw += 1) {
      const index = Math.floor(random() * baseline.length);
      difference +=
        Number(phaseA[index] === outcome) - Number(baseline[index] === outcome);
    }
    estimates[sample] = difference / baseline.length;
  }
  estimates.sort((left, right) => left - right);
  return {
    low: estimates[Math.floor(resamples * 0.025)],
    high: estimates[Math.ceil(resamples * 0.975) - 1],
  };
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let output = value;
    output = Math.imul(output ^ (output >>> 15), output | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4_294_967_296;
  };
}
