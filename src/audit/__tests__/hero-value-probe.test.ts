/**
 * SCRATCH PROBE (not a gate): measures what one hero power is worth, expressed
 * in points of squad strength at Tier 1 and Tier 3, for both auto-fire (Quick
 * Result) and a well-tapped watched match.
 *
 * Method: points-per-match is measured for a no-hero baseline across a fine
 * strength ladder, then each power is run at even strength. The power's value
 * is the strength delta that would produce the same points-per-match.
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
  buildCareerMatchTeams,
  createCareer,
  powerIsCompatibleWithRole,
  roleOverall,
  withoutPowers,
} from '../../game';
import { createMatch, queueInput, tick } from '../../sim/match';
import type { PowerId, TeamDef } from '../../sim/types';
import { EVEN_DELTA, scaleTeam as scale } from '../probe-calibration';
import { shouldQueueWellTappedPower } from '../hero-value-tap-policy';

const content = loadLaunchContent();
const POWERS = content.powers.powers.map((power) => power.id) as PowerId[];
const SOLO_POWERS = POWERS.filter((power) => power !== 'RALLY_CRY');
const FILTERED_POWERS = selectedPowerFilter(
  process.env.HERO_VALUE_ONLY,
  SOLO_POWERS,
);
const SEEDS = positiveIntegerEnv('HERO_VALUE_SEEDS', 1000);
const BOOTSTRAP_RESAMPLES = 400;
/** Engine slot for each power's designed carrier: 0 GK, 2 DEF, 6 MID, 9 FWD. */
const CARRIER_SLOT: Record<PowerId, number> = {
  SUPER_SPEED: 9,
  BLINK_RUN: 9,
  THUNDER_STRIKE: 9,
  FIRE_TORCH: 9,
  PHASE_RUN: 9,
  PORTAL_PASS: 6,
  DECOY_DOUBLE: 6,
  FUTURE_SIGHT: 2,
  SUPER_STRENGTH: 2,
  WEB_TRAP: 2,
  ELASTIC_KEEPER: 0,
  RALLY_CRY: 6,
  ICE_RINK: 2,
  SHADOW_MARK: 2,
  GRAVITY_WELL: 6,
  GIANT_GK: 0,
  GUST: 2,
};
const SHARD = parseShard(process.env.HERO_VALUE_SHARD, FILTERED_POWERS.length);
const SELECTED_POWERS = FILTERED_POWERS.filter(
  (_, index) => index % SHARD.count === SHARD.index,
);

function selectedPowerFilter(
  value: string | undefined,
  available: readonly PowerId[],
): PowerId[] {
  if (value === undefined) return [...available];
  const requested = value
    .split(',')
    .map((power) => power.trim())
    .filter(Boolean);
  if (requested.length === 0)
    throw new Error('HERO_VALUE_ONLY must name at least one solo power');
  const availableIds: ReadonlySet<string> = new Set(available);
  for (const power of requested) {
    if (!availableIds.has(power)) {
      throw new Error(
        `HERO_VALUE_ONLY contains unknown or non-solo power: ${power}`,
      );
    }
  }
  const selected = new Set(requested);
  return available.filter((power) => selected.has(power));
}

interface LadderRow {
  readonly delta: number;
  readonly ppm: number;
}

interface WorthEstimate {
  readonly value: number;
  readonly bound: 'exact' | 'at-least' | 'at-most';
}

interface SeedOutcome {
  readonly points: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
}

interface MatchSample {
  readonly ppm: number;
  readonly outcomes: readonly SeedOutcome[];
}

interface LadderSample {
  readonly delta: number;
  readonly sample: MatchSample;
}

interface PairedDeltaSummary {
  readonly mean: number;
  readonly lower: number;
  readonly upper: number;
  readonly meanGoalDifferenceDelta: number;
  readonly better: number;
  readonly same: number;
  readonly worse: number;
}

interface BootstrapWorthSummary {
  readonly median: number;
  readonly lower: number;
  readonly upper: number;
  readonly boundRate: number;
  readonly plateauSpan: number;
  readonly confidence: string;
}

describe('hero value', () => {
  it('fits noisy ladder reversals without mutation', () => {
    const raw: LadderRow[] = [
      { delta: -2, ppm: 1.8 },
      { delta: -1, ppm: 1.2 },
      { delta: 0, ppm: 1.4 },
      { delta: 1, ppm: 0.9 },
    ];
    const before = raw.map((row) => ({ ...row }));

    const fitted = fitNonIncreasingPpm(raw);

    expect(fitted).toHaveLength(raw.length);
    expect(fitted[0]).toEqual(raw[0]);
    expect(fitted.at(-1)).toEqual(raw.at(-1));
    const expectedPpm = [1.8, 1.3, 1.3, 0.9];
    for (let index = 0; index < fitted.length; index += 1) {
      expect(fitted[index].ppm).toBeCloseTo(expectedPpm[index], 12);
    }
    for (let index = 1; index < fitted.length; index += 1) {
      expect(fitted[index].ppm).toBeLessThanOrEqual(fitted[index - 1].ppm);
      expect(fitted[index].delta).toBe(raw[index].delta);
    }
    expect(raw).toEqual(before);
    expect(fitted).not.toBe(raw);
  });

  it('centers worth on the measured no-hero PPM across an isotonic plateau', () => {
    const ladder: LadderRow[] = [
      { delta: -2, ppm: 2 },
      { delta: -1, ppm: 1.5 },
      { delta: 0, ppm: 1.5 },
      { delta: 1, ppm: 1 },
    ];

    expect(estimateEquivalentDelta(ladder, 1.5)).toEqual({
      value: -0.5,
      bound: 'exact',
    });
    expect(estimateCenteredWorth(ladder, 1.5, 1.5)).toEqual({
      value: 0,
      bound: 'exact',
    });
    expect(estimateCenteredWorth(ladder, 1.75, 1.5)).toEqual({
      value: 1,
      bound: 'exact',
    });
    expect(estimateCenteredWorth(ladder, 1.25, 1.5)).toEqual({
      value: -1,
      bound: 'exact',
    });
  });

  it('keeps paired summaries and bootstrap resampling deterministic', () => {
    const control: MatchSample = {
      ppm: 1,
      outcomes: [
        { points: 0, goalsFor: 0, goalsAgainst: 1 },
        { points: 1, goalsFor: 1, goalsAgainst: 1 },
        { points: 2, goalsFor: 2, goalsAgainst: 1 },
      ],
    };
    const treatment: MatchSample = {
      ppm: 2,
      outcomes: [
        { points: 3, goalsFor: 2, goalsAgainst: 1 },
        { points: 1, goalsFor: 1, goalsAgainst: 1 },
        { points: 2, goalsFor: 1, goalsAgainst: 1 },
      ],
    };

    expect(summarizePairedDelta(treatment, control)).toMatchObject({
      mean: 1,
      meanGoalDifferenceDelta: 1 / 3,
      better: 1,
      same: 2,
      worse: 0,
    });
    expect(createBootstrapWeights(3, 4, 12345)).toEqual(
      createBootstrapWeights(3, 4, 12345),
    );
  });

  it('assigns every power to its intended compatible carrier', () => {
    const { user } = openingTeams();
    expect(Object.keys(CARRIER_SLOT).sort()).toEqual([...POWERS].sort());
    for (const power of POWERS) {
      expect(
        grantPower(user, power, 1).players[CARRIER_SLOT[power]],
      ).toMatchObject({
        power,
        powerTier: 1,
      });
    }
  });

  it('prices every power in points of squad strength', () => {
    const { user, opponent } = openingTeams();
    const userStrength = teamStrength(user);
    const opponentStrength = teamStrength(opponent);
    const evenDelta = EVEN_DELTA;
    // Worth = evenDelta - measured opponent delta. These 11 points cover a
    // power worth +6 through -4 relative to the calibrated even matchup.
    const ladderDeltas = Array.from(
      { length: 11 },
      (_, index) => evenDelta - 6 + index,
    );

    const ladderSamples = ladderDeltas.map((delta) => ({
      delta,
      sample: sampleMatches(user, scale(opponent, delta), false),
    }));
    const rawLadder = ladderSamples.map(({ delta, sample }) => ({
      delta,
      ppm: sample.ppm,
    }));
    const fittedLadder = fitNonIncreasingPpm(rawLadder);
    const baselineSample = ladderSamples.find(
      (row) => row.delta === evenDelta,
    )!.sample;
    const rawBasePpm = baselineSample.ppm;
    const fittedBasePpm = fittedLadder.find(
      (row) => row.delta === evenDelta,
    )!.ppm;
    const bootstrapWeights = createBootstrapWeights(
      SEEDS,
      BOOTSTRAP_RESAMPLES,
      0x51f15e ^ SHARD.index,
    );

    const lines: string[] = [
      '',
      `=== HERO VALUE SHARD ${SHARD.index}/${SHARD.count} (${SEEDS} seeds per sample) ===`,
      `selected powers (${SELECTED_POWERS.length}/${SOLO_POWERS.length} solo-eligible): ${SELECTED_POWERS.join(', ')}`,
      `starting-XI strength: user ${userStrength}, opponent ${opponentStrength}, measured even delta ${evenDelta}`,
      '',
      '=== SHARED NO-HERO BASELINE LADDER ===',
      '  delta   raw ppm   fitted ppm',
    ];
    for (let index = 0; index < rawLadder.length; index += 1) {
      const raw = rawLadder[index];
      const fitted = fittedLadder[index];
      lines.push(
        `  ${String(raw.delta).padStart(5)}   ${raw.ppm.toFixed(3).padStart(7)}` +
          `   ${fitted.ppm.toFixed(3).padStart(10)}`,
      );
    }
    lines.push(
      `  (calibrated even match = delta ${evenDelta}, raw ${rawBasePpm.toFixed(3)},` +
        ` fitted ${fittedBasePpm.toFixed(3)}, centered worth` +
        ` ${worthLabel(fittedLadder, rawBasePpm, rawBasePpm)})`,
    );

    lines.push('', '=== POWER VALUE AT EVEN STRENGTH ===');
    lines.push(
      'power              T1 auto ppm/worth   T1 well-tapped ppm/worth   T3 well-tapped ppm/worth',
    );
    const evenOpponent = scale(opponent, evenDelta);
    const detailedRows: string[] = [
      '',
      `=== PAIRED SEED DELTAS + ${BOOTSTRAP_RESAMPLES}-RESAMPLE BOOTSTRAP WORTH ===`,
      'CIs compare the same match seeds; worth bootstrap resamples those shared seed indices and refits PAVA.',
    ];
    for (const power of SELECTED_POWERS) {
      const tier1 = grantPower(user, power, 1);
      const tier3 = grantPower(user, power, 3);
      const tier1Auto = sampleMatches(tier1, evenOpponent, false);
      const tier1Tapped = sampleMatches(tier1, evenOpponent, true);
      const tier3Tapped = sampleMatches(tier3, evenOpponent, true);
      lines.push(
        `${power.padEnd(19)}` +
          `${sampleLabel(fittedLadder, tier1Auto.ppm, rawBasePpm).padEnd(20)}` +
          `${sampleLabel(fittedLadder, tier1Tapped.ppm, rawBasePpm).padEnd(27)}` +
          sampleLabel(fittedLadder, tier3Tapped.ppm, rawBasePpm),
      );
      detailedRows.push(
        '',
        power,
        `  T1 auto - control: ${formatPairedDelta(summarizePairedDelta(tier1Auto, baselineSample))}`,
        `  T1 tap  - control: ${formatPairedDelta(summarizePairedDelta(tier1Tapped, baselineSample))}`,
        `  T3 tap  - control: ${formatPairedDelta(summarizePairedDelta(tier3Tapped, baselineSample))}`,
        `  T1 tap  - T1 auto: ${formatPairedDelta(summarizePairedDelta(tier1Tapped, tier1Auto))}`,
        `  T3 tap  - T1 tap:  ${formatPairedDelta(summarizePairedDelta(tier3Tapped, tier1Tapped))}`,
        `  T1 auto worth: ${formatBootstrapWorth(
          bootstrapWorth(
            ladderSamples,
            tier1Auto,
            baselineSample,
            fittedLadder,
            bootstrapWeights,
          ),
        )}`,
        `  T1 tap worth:  ${formatBootstrapWorth(
          bootstrapWorth(
            ladderSamples,
            tier1Tapped,
            baselineSample,
            fittedLadder,
            bootstrapWeights,
          ),
        )}`,
        `  T3 tap worth:  ${formatBootstrapWorth(
          bootstrapWorth(
            ladderSamples,
            tier3Tapped,
            baselineSample,
            fittedLadder,
            bootstrapWeights,
          ),
        )}`,
      );
    }
    detailedRows.push(
      '',
      'RALLY_CRY',
      '  N/A for the solo-power probe: Rally Cry requires another powered teammate.',
      '  Its valid matched pair is reported by multihero-value-probe.test.ts.',
    );
    lines.push(...detailedRows);

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(SELECTED_POWERS.length).toBeGreaterThan(0);
  }, 7_200_000);
});

/** Points per match: 3 for a win, 1 for a draw, from the user's perspective. */
function sampleMatches(
  home: TeamDef,
  away: TeamDef,
  wellTapped: boolean,
): MatchSample {
  const outcomes: SeedOutcome[] = [];
  for (let index = 0; index < SEEDS; index += 1) {
    const match = createMatch(1_000_003 + index * 104_729, home, away, {
      homePolicy: wellTapped ? 'SAVE_FOR_TAP' : 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
      // controlledTeam is deliberately NOT set. POWER_TAP inputs do not need
      // it, and setting it disables automatic coaching for the tapped side.
    });
    // One queued tap per Zone window, so a long window cannot spam the input log.
    const tappedThisWindow = new Array<boolean>(11).fill(false);
    while (match.phase !== 'fulltime') {
      if (wellTapped) {
        for (let slot = 0; slot < 11; slot += 1) {
          const player = match.players[slot];
          if (player?.def.power === undefined) continue;
          if (player.powerState.kind !== 'zone') {
            tappedThisWindow[slot] = false;
            continue;
          }
          // Tap at full strength only when the shipped control is pressable.
          if (
            !tappedThisWindow[slot] &&
            shouldQueueWellTappedPower(match, slot)
          ) {
            queueInput(match, {
              tick: match.tick + 1,
              kind: 'POWER_TAP',
              player: slot,
            });
            tappedThisWindow[slot] = true;
          }
        }
      }
      tick(match);
    }
    const [forGoals, againstGoals] = match.score;
    outcomes.push({
      points: forGoals > againstGoals ? 3 : forGoals === againstGoals ? 1 : 0,
      goalsFor: forGoals,
      goalsAgainst: againstGoals,
    });
  }
  return {
    ppm:
      outcomes.reduce((sum, outcome) => sum + outcome.points, 0) /
      outcomes.length,
    outcomes,
  };
}

/** A paired interval uses each seed's treatment-minus-control result, so match
 * variance shared by both policies is not mistaken for treatment uncertainty. */
function summarizePairedDelta(
  treatment: MatchSample,
  control: MatchSample,
): PairedDeltaSummary {
  if (
    treatment.outcomes.length !== control.outcomes.length ||
    treatment.outcomes.length === 0
  ) {
    throw new Error('paired samples must have the same non-zero seed count');
  }
  const pointDeltas = treatment.outcomes.map(
    (outcome, index) => outcome.points - control.outcomes[index].points,
  );
  const mean =
    pointDeltas.reduce((sum, value) => sum + value, 0) / pointDeltas.length;
  const variance =
    pointDeltas.length === 1
      ? 0
      : pointDeltas.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
        (pointDeltas.length - 1);
  const margin = 1.96 * Math.sqrt(variance / pointDeltas.length);
  const goalDifferenceDeltas = treatment.outcomes.map((outcome, index) => {
    const paired = control.outcomes[index];
    return (
      outcome.goalsFor -
      outcome.goalsAgainst -
      (paired.goalsFor - paired.goalsAgainst)
    );
  });
  return {
    mean,
    lower: mean - margin,
    upper: mean + margin,
    meanGoalDifferenceDelta:
      goalDifferenceDeltas.reduce((sum, value) => sum + value, 0) /
      goalDifferenceDeltas.length,
    better: pointDeltas.filter((value) => value > 0).length,
    same: pointDeltas.filter((value) => value === 0).length,
    worse: pointDeltas.filter((value) => value < 0).length,
  };
}

function formatPairedDelta(summary: PairedDeltaSummary): string {
  return (
    `ΔPPM ${formatSignedFixed(summary.mean, 3)}` +
    ` (95% CI ${formatInterval(summary.lower, summary.upper, 3)})` +
    `; ΔGD ${formatSignedFixed(summary.meanGoalDifferenceDelta, 3)}` +
    `; better/same/worse ${summary.better}/${summary.same}/${summary.worse}`
  );
}

/** Generates count vectors rather than copied samples. Reusing every vector
 * across ladder and hero samples preserves their seed pairing while PAVA is
 * refit inside each bootstrap replicate. */
function createBootstrapWeights(
  seedCount: number,
  resamples: number,
  seed: number,
): Uint16Array[] {
  if (seedCount <= 0 || resamples <= 0)
    throw new Error('bootstrap sizes must be positive');
  let state = seed >>> 0;
  const next = (): number => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
  return Array.from({ length: resamples }, () => {
    const weights = new Uint16Array(seedCount);
    for (let draw = 0; draw < seedCount; draw += 1) {
      weights[Math.floor(next() * seedCount)] += 1;
    }
    return weights;
  });
}

function bootstrapWorth(
  ladderSamples: readonly LadderSample[],
  sample: MatchSample,
  baseline: MatchSample,
  fittedLadder: readonly LadderRow[],
  resampleWeights: readonly Uint16Array[],
): BootstrapWorthSummary {
  const estimates = resampleWeights.map((weights) => {
    const ladder = fitNonIncreasingPpm(
      ladderSamples.map((row) => ({
        delta: row.delta,
        ppm: weightedPpm(row.sample, weights),
      })),
    );
    return estimateCenteredWorth(
      ladder,
      weightedPpm(sample, weights),
      weightedPpm(baseline, weights),
    );
  });
  const values = estimates
    .map((estimate) => estimate.value)
    .sort((left, right) => left - right);
  const boundRate =
    estimates.filter((estimate) => estimate.bound !== 'exact').length /
    estimates.length;
  const plateauSpan = Math.max(
    fittedPlateauSpan(fittedLadder, baseline.ppm),
    fittedPlateauSpan(fittedLadder, sample.ppm),
  );
  const lower = percentile(values, 0.025);
  const median = percentile(values, 0.5);
  const upper = percentile(values, 0.975);
  const labels: string[] = [];
  if (boundRate > 0)
    labels.push(`ladder-bound ${(boundRate * 100).toFixed(0)}%`);
  if (plateauSpan > 0) labels.push(`plateau span ${plateauSpan.toFixed(1)}`);
  if (lower <= 0 && upper >= 0) labels.push('direction uncertain');
  if (labels.length === 0) labels.push('interior');
  return {
    median,
    lower,
    upper,
    boundRate,
    plateauSpan,
    confidence: labels.join('; '),
  };
}

function weightedPpm(sample: MatchSample, weights: Uint16Array): number {
  if (sample.outcomes.length !== weights.length) {
    throw new Error('bootstrap weights must match the sample seed count');
  }
  let weightedPoints = 0;
  let totalWeight = 0;
  for (let index = 0; index < weights.length; index += 1) {
    weightedPoints += sample.outcomes[index].points * weights[index];
    totalWeight += weights[index];
  }
  if (totalWeight === 0)
    throw new Error('bootstrap resample must not be empty');
  return weightedPoints / totalWeight;
}

function fittedPlateauSpan(ladder: readonly LadderRow[], ppm: number): number {
  const matching = ladder.filter((row) => Math.abs(row.ppm - ppm) < 1e-12);
  if (matching.length < 2) return 0;
  return (
    Math.max(...matching.map((row) => row.delta)) -
    Math.min(...matching.map((row) => row.delta))
  );
}

function percentile(sorted: readonly number[], probability: number): number {
  if (sorted.length === 0)
    throw new Error('percentile sample must not be empty');
  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];
  const fraction = position - lowerIndex;
  return (
    sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * fraction
  );
}

function formatBootstrapWorth(summary: BootstrapWorthSummary): string {
  return (
    `median ${formatSignedFixed(summary.median, 1)}` +
    ` (95% CI ${formatInterval(summary.lower, summary.upper, 1)})` +
    `; confidence: ${summary.confidence}`
  );
}

function formatInterval(lower: number, upper: number, digits: number): string {
  return `[${formatSignedFixed(lower, digits)}, ${formatSignedFixed(upper, digits)}]`;
}

function formatSignedFixed(value: number, digits: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

/**
 * Equal-weight pool-adjacent-violators fit. Ladder rows arrive in increasing
 * opponent delta, so expected home PPM is non-increasing. The returned rows are
 * fresh objects and preserve every input delta and position.
 */
function fitNonIncreasingPpm(rows: readonly LadderRow[]): LadderRow[] {
  interface Block {
    readonly start: number;
    readonly end: number;
    readonly weight: number;
    readonly mean: number;
  }

  const blocks: Block[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    blocks.push({ start: index, end: index, weight: 1, mean: rows[index].ppm });
    while (blocks.length >= 2) {
      const right = blocks[blocks.length - 1];
      const left = blocks[blocks.length - 2];
      if (left.mean >= right.mean) break;
      const weight = left.weight + right.weight;
      blocks.splice(blocks.length - 2, 2, {
        start: left.start,
        end: right.end,
        weight,
        mean: (left.mean * left.weight + right.mean * right.weight) / weight,
      });
    }
  }

  const fitted = new Array<LadderRow>(rows.length);
  for (const block of blocks) {
    for (let index = block.start; index <= block.end; index += 1) {
      fitted[index] = { delta: rows[index].delta, ppm: block.mean };
    }
  }
  return fitted;
}

function sampleLabel(
  ladder: readonly LadderRow[],
  ppm: number,
  baselinePpm: number,
): string {
  return `${ppm.toFixed(3)} / ${worthLabel(ladder, ppm, baselinePpm)}`;
}

/** Prices a sample relative to the measured no-hero PPM, not an assumed ladder
 * coordinate. This guarantees the no-hero control is +0.0 even when isotonic
 * fitting moves or flattens the nominal even-strength row. */
function worthLabel(
  ladder: readonly LadderRow[],
  ppm: number,
  baselinePpm: number,
): string {
  const estimate = estimateCenteredWorth(ladder, ppm, baselinePpm);
  const marker =
    estimate.bound === 'at-least'
      ? '>='
      : estimate.bound === 'at-most'
        ? '<='
        : '';
  return `${marker}${estimate.value >= 0 ? '+' : ''}${estimate.value.toFixed(1)}`;
}

function estimateCenteredWorth(
  ladder: readonly LadderRow[],
  ppm: number,
  baselinePpm: number,
): WorthEstimate {
  if (ppm === baselinePpm) return { value: 0, bound: 'exact' };
  const baseline = estimateEquivalentDelta(ladder, baselinePpm);
  const sample = estimateEquivalentDelta(ladder, ppm);
  const bound =
    sample.bound === 'at-most'
      ? 'at-least'
      : sample.bound === 'at-least'
        ? 'at-most'
        : baseline.bound;
  return { value: baseline.value - sample.value, bound };
}

/** Inverts a fitted non-increasing PPM ladder. Exact plateaus map to the
 * midpoint of their strength span so the result does not depend on row order. */
function estimateEquivalentDelta(
  ladder: readonly LadderRow[],
  ppm: number,
): WorthEstimate {
  if (ladder.length === 0) throw new Error('worth ladder must not be empty');
  const sorted = [...ladder].sort((left, right) => left.delta - right.delta);
  if (ppm > sorted[0].ppm) return { value: sorted[0].delta, bound: 'at-most' };
  if (ppm < sorted[sorted.length - 1].ppm) {
    return { value: sorted[sorted.length - 1].delta, bound: 'at-least' };
  }

  const plateau = sorted.filter((row) => row.ppm === ppm);
  if (plateau.length > 0) {
    return {
      value: (plateau[0].delta + plateau[plateau.length - 1].delta) / 2,
      bound: 'exact',
    };
  }

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const left = sorted[index];
    const right = sorted[index + 1];
    if (ppm < left.ppm && ppm > right.ppm) {
      const ratio = (left.ppm - ppm) / (left.ppm - right.ppm);
      return {
        value: left.delta + (right.delta - left.delta) * ratio,
        bound: 'exact',
      };
    }
  }
  throw new Error(`PPM ${ppm} could not be located in the fitted worth ladder`);
}

/** Average role-weighted overall of the exact 11 players the engine will start. */
function teamStrength(team: TeamDef): number {
  if (team.players.length === 0)
    throw new Error('hero-value team must contain starters');
  const total = team.players.reduce(
    (sum, player) => sum + roleOverall(player.role, player.attrs),
    0,
  );
  return Math.round(total / team.players.length);
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(
      `${name} must be a positive integer, got ${JSON.stringify(raw)}`,
    );
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `${name} must be a safe positive integer, got ${JSON.stringify(raw)}`,
    );
  }
  return value;
}

function parseShard(
  raw: string | undefined,
  powerCount: number,
): { index: number; count: number } {
  if (raw === undefined) return { index: 0, count: 1 };
  const match = /^(0|[1-9]\d*)\/([1-9]\d*)$/.exec(raw);
  if (match === null) {
    throw new Error(
      `HERO_VALUE_SHARD must use index/count, got ${JSON.stringify(raw)}`,
    );
  }
  const index = Number(match[1]);
  const count = Number(match[2]);
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(count)) {
    throw new Error(
      `HERO_VALUE_SHARD must use safe integers, got ${JSON.stringify(raw)}`,
    );
  }
  if (index >= count) {
    throw new Error(
      `HERO_VALUE_SHARD index must be less than count, got ${raw}`,
    );
  }
  if (count > powerCount) {
    throw new Error(
      `HERO_VALUE_SHARD count must not exceed ${powerCount}, got ${count}`,
    );
  }
  return { index, count };
}

function openingTeams(): { user: TeamDef; opponent: TeamDef } {
  const state = addCreatedPlayer(
    beginStoryOnboarding(
      createCareer(
        createLaunchCareerSetup(4_000_000, undefined, content, 'COZY'),
      ),
    ),
    {
      name: 'Probe Rookie',
      ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 },
    },
  );
  const opponentId = content.clubs.clubs
    .map((club) => club.id)
    .find((id) => id !== state.userClubId)!;
  const teams = buildCareerMatchTeams(state, [state.userClubId, opponentId]);
  return {
    user: withoutPowers(teams[state.userClubId]),
    opponent: withoutPowers(teams[opponentId]),
  };
}

/** Gives the power to its designed carrier slot, and to nobody else. */
function grantPower(
  team: TeamDef,
  power: PowerId,
  powerTier: 1 | 2 | 3,
): TeamDef {
  const slot = CARRIER_SLOT[power];
  const carrier = team.players[slot];
  if (
    carrier === undefined ||
    !powerIsCompatibleWithRole(power, carrier.role)
  ) {
    throw new Error(
      `slot ${slot} cannot carry ${power} (role ${carrier?.role})`,
    );
  }
  return {
    ...team,
    players: team.players.map((player, index) =>
      index === slot
        ? { ...player, power, powerTier }
        : { ...player, power: undefined, powerTier: undefined },
    ),
  };
}
