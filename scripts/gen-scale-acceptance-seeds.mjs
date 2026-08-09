// Freezes the paired baseline/final outcomes for the scale-invariant opening gate.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const [
  outputPath = 'src/audit/fixtures/scale-invariant-opening-gate.json',
  baselineFitPath,
  phaseAFitPath,
  baselineHeldOutPath,
  phaseAHeldOutPath,
] = process.argv.slice(2);

if (
  [baselineFitPath, phaseAFitPath, baselineHeldOutPath, phaseAHeldOutPath].some(
    (path) => path === undefined,
  )
) {
  throw new Error(
    'usage: node scripts/gen-scale-acceptance-seeds.mjs <output>' +
      ' <baseline-fit> <phase-a-fit> <baseline-held-out> <phase-a-held-out>',
  );
}

const readOutcomes = (path) => JSON.parse(readFileSync(path, 'utf8'));
const baselineFit = readOutcomes(baselineFitPath);
const phaseAFit = readOutcomes(phaseAFitPath);
const baselineHeldOut = readOutcomes(baselineHeldOutPath);
const phaseAHeldOut = readOutcomes(phaseAHeldOutPath);

const aggregate = (outcomes) => ({
  wins: outcomes.filter((outcome) => outcome === 'W').length,
  draws: outcomes.filter((outcome) => outcome === 'D').length,
  losses: outcomes.filter((outcome) => outcome === 'L').length,
});

const validatePair = (
  label,
  baseline,
  phaseA,
  expectedOffset,
  expectedCount,
) => {
  if (
    baseline.seedOffset !== expectedOffset ||
    phaseA.seedOffset !== expectedOffset
  ) {
    throw new Error(`${label} seed offset must be ${expectedOffset}`);
  }
  if (
    baseline.seeds.length !== expectedCount ||
    phaseA.seeds.length !== expectedCount
  ) {
    throw new Error(`${label} must contain ${expectedCount} seeds`);
  }
  if (JSON.stringify(baseline.seeds) !== JSON.stringify(phaseA.seeds)) {
    throw new Error(`${label} baseline/final seed lists differ`);
  }
  for (const build of [baseline, phaseA]) {
    for (const training of ['trained', 'control']) {
      if (
        build[training].length !== expectedCount ||
        build[training].some((outcome) => !['W', 'D', 'L'].includes(outcome))
      ) {
        throw new Error(
          `${label} ${training} outcomes are incomplete or invalid`,
        );
      }
    }
  }
};

validatePair('fit', baselineFit, phaseAFit, 700, 1_000);
validatePair('held-out', baselineHeldOut, phaseAHeldOut, 1_700, 1_000);

const cohort = (baseline, phaseA) => ({
  seeds: baseline.seeds,
  baseline: {
    trained: baseline.trained,
    control: baseline.control,
  },
  phaseAFinal: {
    trained: phaseA.trained,
    control: phaseA.control,
  },
  aggregateResults: {
    baseline: {
      trained: aggregate(baseline.trained),
      control: aggregate(baseline.control),
    },
    phaseAFinal: {
      trained: aggregate(phaseA.trained),
      control: aggregate(phaseA.control),
    },
  },
});

const artifact = {
  version: 3,
  fitted: {
    logRatioK: 29,
    shotKeeperModD64: 0,
  },
  bootstrap: {
    resamples: 10_000,
    seed: 20_260_729,
  },
  cohorts: {
    fit: cohort(baselineFit, phaseAFit),
    heldOut: cohort(baselineHeldOut, phaseAHeldOut),
  },
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(
  'wrote paired 1,000-seed fit and 1,000-seed held-out opening outcomes',
);
