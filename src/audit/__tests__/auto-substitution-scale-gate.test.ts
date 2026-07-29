import artifact from '../fixtures/auto-substitution-d5-gate.json';
import { automaticSubstitutionClearsMargin } from '../../sim/auto-coaching';
import type { Attrs, PlayerDef, Role } from '../../sim/types';

const ROLE_KEYS: Readonly<Record<Exclude<Role, 'GK'>, readonly (keyof Attrs)[]>> = {
  DEF: ['def', 'pac', 'pas', 'tec'],
  MID: ['pas', 'tec', 'pac', 'def'],
  FWD: ['sho', 'tec', 'pac', 'pas'],
};
const ROLES = ['DEF', 'MID', 'FWD'] as const;

interface Scenario {
  readonly outgoing: PlayerDef;
  readonly replacement: PlayerDef;
  readonly condition: number;
}

describe('scale-invariant automatic-substitution acceptance gate', () => {
  it('freezes the shipping D5 reference cohort and bootstrap protocol', () => {
    expect(artifact).toMatchObject({
      version: 1,
      scenarioGenerator: 'd5-role-candidates-v1',
      scenarios: 5_000,
      scenarioSeed: 20_260_729,
      bootstrap: { resamples: 10_000, seed: 20_260_713 },
      trainedScale: 8,
    });
    expect(artifact.baselineBits).toHaveLength(artifact.scenarios);
    expect([...artifact.baselineBits].every(bit => bit === '0' || bit === '1')).toBe(true);
    expect([...artifact.baselineBits].filter(bit => bit === '1')).toHaveLength(
      artifact.baselineAccepted,
    );
  });

  it('reproduces the old D5 frequency within ±3 pp and is no more eager at trained scale', () => {
    const scenarios = generateScenarios(artifact.scenarios, artifact.scenarioSeed);
    const baseline = [...artifact.baselineBits].map(bit => bit === '1');
    const d5 = scenarios.map(scenario => automaticSubstitutionClearsMargin(
      scenario.outgoing,
      scenario.condition,
      scenario.replacement,
    ));
    const trained = scenarios.map(scenario => automaticSubstitutionClearsMargin(
      scalePlayer(scenario.outgoing, artifact.trainedScale),
      scenario.condition,
      scalePlayer(scenario.replacement, artifact.trainedScale),
    ));
    const d5Interval = pairedBootstrapInterval(
      baseline,
      d5,
      artifact.bootstrap.resamples,
      artifact.bootstrap.seed,
    );
    const scaleInterval = pairedBootstrapInterval(
      d5,
      trained,
      artifact.bootstrap.resamples,
      artifact.bootstrap.seed ^ 0x5ca1e,
    );

    expect(d5Interval.low).toBeGreaterThanOrEqual(-0.03);
    expect(d5Interval.high).toBeLessThanOrEqual(0.03);
    const scalePointDifference = trained.filter(Boolean).length / trained.length
      - d5.filter(Boolean).length / d5.length;
    expect(scalePointDifference).toBeLessThanOrEqual(0.001);
    expect(scaleInterval.low).toBeGreaterThanOrEqual(-0.003);
    expect(scaleInterval.high).toBeLessThanOrEqual(0.003);
  });
});

function generateScenarios(count: number, seed: number): Scenario[] {
  const random = mulberry32(seed);
  return Array.from({ length: count }, (_, index) => {
    const role = ROLES[Math.floor(random() * ROLES.length)];
    const outgoingRatings = ROLE_KEYS[role].map(() => 35 + Math.floor(random() * 21));
    const replacementRatings = ROLE_KEYS[role].map(() => 35 + Math.floor(random() * 21));
    const condition = 30 + Math.floor(random() * 31);
    return {
      outgoing: candidate(`out-${index}`, role, ROLE_KEYS[role], outgoingRatings),
      replacement: candidate(`in-${index}`, role, ROLE_KEYS[role], replacementRatings),
      condition,
    };
  });
}

function candidate(
  id: string,
  role: Exclude<Role, 'GK'>,
  keys: readonly (keyof Attrs)[],
  ratings: readonly number[],
): PlayerDef {
  const attrs: Attrs = { pac: 40, sho: 40, pas: 40, def: 40, tec: 40, sta: 40, ref: 40 };
  keys.forEach((key, index) => {
    attrs[key] = ratings[index];
  });
  return { id, name: id, role, attrs };
}

function scalePlayer(player: PlayerDef, scale: number): PlayerDef {
  return {
    ...player,
    attrs: Object.fromEntries(Object.entries(player.attrs).map(([key, value]) => (
      [key, value * scale]
    ))) as unknown as Attrs,
  };
}

function pairedBootstrapInterval(
  baseline: readonly boolean[],
  candidate: readonly boolean[],
  resamples: number,
  seed: number,
): { low: number; high: number } {
  if (baseline.length !== candidate.length) throw new Error('paired cohorts must have equal length');
  const random = mulberry32(seed);
  const estimates = new Array<number>(resamples);
  for (let sample = 0; sample < resamples; sample += 1) {
    let difference = 0;
    for (let draw = 0; draw < baseline.length; draw += 1) {
      const index = Math.floor(random() * baseline.length);
      difference += Number(candidate[index]) - Number(baseline[index]);
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
    value = (value + 0x6D2B79F5) >>> 0;
    let output = value;
    output = Math.imul(output ^ (output >>> 15), output | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4_294_967_296;
  };
}
