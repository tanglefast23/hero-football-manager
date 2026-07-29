import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCENARIOS = 5_000;
const SCENARIO_SEED = 20_260_729;
const BOOTSTRAP_RESAMPLES = 10_000;
const BOOTSTRAP_SEED = 20_260_713;

const ROLE_WEIGHTS = [
  [50, 20, 15, 15],
  [35, 30, 20, 15],
  [40, 25, 20, 15],
];

const random = mulberry32(SCENARIO_SEED);
let baselineBits = '';
let accepted = 0;
for (let index = 0; index < SCENARIOS; index += 1) {
  const weights = ROLE_WEIGHTS[Math.floor(random() * ROLE_WEIGHTS.length)];
  const outgoing = weights.map(() => 35 + Math.floor(random() * 21));
  const replacement = weights.map(() => 35 + Math.floor(random() * 21));
  const condition = 30 + Math.floor(random() * 31);
  const outgoingScore = outgoing.reduce((sum, rating, attributeIndex) => (
    sum + conditionedAttribute(rating, condition) * weights[attributeIndex]
  ), 0);
  const replacementScore = replacement.reduce((sum, rating, attributeIndex) => (
    sum + rating * weights[attributeIndex]
  ), 0);
  const clears = replacementScore >= outgoingScore + 300;
  baselineBits += clears ? '1' : '0';
  accepted += Number(clears);
}

const artifact = {
  version: 1,
  scenarioGenerator: 'd5-role-candidates-v1',
  scenarios: SCENARIOS,
  scenarioSeed: SCENARIO_SEED,
  bootstrap: {
    resamples: BOOTSTRAP_RESAMPLES,
    seed: BOOTSTRAP_SEED,
  },
  trainedScale: 8,
  baselineAccepted: accepted,
  baselineBits,
};

writeFileSync(
  resolve('src/audit/fixtures/auto-substitution-d5-gate.json'),
  `${JSON.stringify(artifact, null, 2)}\n`,
);

function conditionedAttribute(raw, condition) {
  const bounded = Math.max(0, Math.min(100, condition));
  return Math.max(1, Math.round(raw * (0.75 + 0.25 * bounded / 100)));
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let output = value;
    output = Math.imul(output ^ (output >>> 15), output | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4_294_967_296;
  };
}
