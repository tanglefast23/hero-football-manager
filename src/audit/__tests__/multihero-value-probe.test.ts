/**
 * OPT-IN BALANCE PROBE (not a gate): measures whether heroes two through four
 * retain the value they have alone now that teammates' powers can overlap.
 *
 * The weakest player case is used deliberately: Tier-1 heroes on contextual
 * auto-fire. Run with:
 *   npm run test:probe -- src/audit/__tests__/multihero-value-probe.test.ts
 * Override the default 1,000 paired seeds with MULTIHERO_VALUE_SEEDS.
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
import { runMatch } from '../../sim/match';
import type { PowerId, TeamDef } from '../../sim/types';

const content = loadLaunchContent();
const SEEDS = positiveIntegerEnv('MULTIHERO_VALUE_SEEDS', 1000);

interface RepresentativeHero {
  readonly slot: number;
  readonly power: PowerId;
}

/**
 * Prefix order follows the likely player journey: an attacking first hero,
 * then midfield, defence, and finally a goalkeeper. Slots are engine starter
 * slots: 0 GK, 2 DEF, 6 MID, 9 FWD.
 */
const REPRESENTATIVE_HEROES: readonly RepresentativeHero[] = [
  { slot: 9, power: 'SUPER_SPEED' },
  { slot: 6, power: 'DECOY_DOUBLE' },
  { slot: 2, power: 'FUTURE_SIGHT' },
  { slot: 0, power: 'GIANT_GK' },
];
const RALLY_HERO: RepresentativeHero = { slot: 6, power: 'RALLY_CRY' };

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

interface PairedDeltaSummary {
  readonly mean: number;
  readonly lower: number;
  readonly upper: number;
  readonly meanGoalDifferenceDelta: number;
  readonly better: number;
  readonly same: number;
  readonly worse: number;
}

interface SummaryRow {
  readonly soloWorth: number;
  readonly cumulativeWorth: number;
  readonly marginalWorth: number;
  readonly efficiency: number | null;
}

describe('multihero marginal value', () => {
  it('uses four unique, role-compatible starter slots', () => {
    const { user } = openingTeams();
    expect(REPRESENTATIVE_HEROES).toHaveLength(4);
    expect(new Set(REPRESENTATIVE_HEROES.map(hero => hero.slot)).size).toBe(4);
    expect(REPRESENTATIVE_HEROES.map(hero => user.players[hero.slot].role))
      .toEqual(['FWD', 'MID', 'DEF', 'GK']);

    for (const hero of REPRESENTATIVE_HEROES) {
      expect(powerIsCompatibleWithRole(hero.power, user.players[hero.slot].role)).toBe(true);
    }
    expect(powerIsCompatibleWithRole(RALLY_HERO.power, user.players[RALLY_HERO.slot].role)).toBe(true);
  });

  it('calculates each added hero relative to its own solo value', () => {
    const rows = summarizeWorths([2, 3, 4, 5], [2, 5, 9, 14]);
    expect(rows).toEqual([
      { soloWorth: 2, cumulativeWorth: 2, marginalWorth: 2, efficiency: 1 },
      { soloWorth: 3, cumulativeWorth: 5, marginalWorth: 3, efficiency: 1 },
      { soloWorth: 4, cumulativeWorth: 9, marginalWorth: 4, efficiency: 1 },
      { soloWorth: 5, cumulativeWorth: 14, marginalWorth: 5, efficiency: 1 },
    ]);
    expect(summarizeWorths([0], [1])[0].efficiency).toBeNull();
  });

  it('fits noisy ladder reversals without changing its strength deltas', () => {
    const fitted = fitNonIncreasingPpm([
      { delta: -2, ppm: 1.8 },
      { delta: -1, ppm: 1.2 },
      { delta: 0, ppm: 1.4 },
      { delta: 1, ppm: 0.9 },
    ]);
    expect(fitted.map(row => row.delta)).toEqual([-2, -1, 0, 1]);
    const expectedPpm = [1.8, 1.3, 1.3, 0.9];
    for (let index = 0; index < expectedPpm.length; index += 1) {
      expect(fitted[index].ppm).toBeCloseTo(expectedPpm[index], 12);
    }
  });

  it('centers worth on the measured no-hero PPM across an isotonic plateau', () => {
    const ladder: LadderRow[] = [
      { delta: -2, ppm: 2 },
      { delta: -1, ppm: 1.5 },
      { delta: 0, ppm: 1.5 },
      { delta: 1, ppm: 1 },
    ];

    expect(estimateEquivalentDelta(ladder, 1.5)).toEqual({ value: -0.5, bound: 'exact' });
    expect(estimateWorth(ladder, 1.5, 1.5)).toEqual({ value: 0, bound: 'exact' });
    expect(estimateWorth(ladder, 1.75, 1.5)).toEqual({ value: 1, bound: 'exact' });
    expect(estimateWorth(ladder, 1.25, 1.5)).toEqual({ value: -1, bound: 'exact' });
  });

  it('reports solo, cumulative, and marginal worth for heroes one through four', () => {
    const { user, opponent } = openingTeams();
    const userStrength = teamStrength(user);
    const opponentStrength = teamStrength(opponent);
    const evenDelta = userStrength - opponentStrength;
    // Four healthy heroes target roughly +8 combined. Cover +12 through -4 so
    // stacking upside is measured rather than clipped at the one-hero ladder.
    const ladderDeltas = Array.from({ length: 17 }, (_, index) => evenDelta - 12 + index);
    const ladderSamples = ladderDeltas.map(delta => ({
      delta,
      sample: sampleMatches(user, scale(opponent, delta)),
    }));
    const rawLadder = ladderSamples.map(({ delta, sample }) => ({ delta, ppm: sample.ppm }));
    const fittedLadder = fitNonIncreasingPpm(rawLadder);
    const baselineSample = ladderSamples.find(row => row.delta === evenDelta)!.sample;
    const rawBasePpm = baselineSample.ppm;
    const baselineDelta = estimateEquivalentDelta(fittedLadder, rawBasePpm).value;
    const evenOpponent = scale(opponent, evenDelta);

    const soloSamples = REPRESENTATIVE_HEROES.map(hero => {
      const sample = sampleMatches(withHeroes(user, [hero]), evenOpponent);
      return { sample, ppm: sample.ppm, worth: estimateWorth(fittedLadder, sample.ppm, rawBasePpm) };
    });
    const prefixSamples = REPRESENTATIVE_HEROES.map((_, index) => {
      const sample = sampleMatches(
        withHeroes(user, REPRESENTATIVE_HEROES.slice(0, index + 1)),
        evenOpponent,
      );
      return { sample, ppm: sample.ppm, worth: estimateWorth(fittedLadder, sample.ppm, rawBasePpm) };
    });
    // Rally Cry is deliberately unavailable as a club's first or only power.
    // Price it in its valid weakest case: Tier 1 contextual auto beside the
    // first Super Speed hero, then subtract that hero's measured prefix worth.
    const rallyPairSample = sampleMatches(
      withHeroes(user, [REPRESENTATIVE_HEROES[0], RALLY_HERO]),
      evenOpponent,
    );
    const rallyPairPpm = rallyPairSample.ppm;
    const rallyPairWorth = estimateWorth(fittedLadder, rallyPairPpm, rawBasePpm);
    const rallyMarginalWorth = rallyPairWorth.value - prefixSamples[0].worth.value;
    const rallyPairedDelta = summarizePairedDelta(rallyPairSample, prefixSamples[0].sample);
    const summaries = summarizeWorths(
      soloSamples.map(sample => sample.worth.value),
      prefixSamples.map(sample => sample.worth.value),
    );

    const lines: string[] = [
      '',
      `=== MULTI-HERO MARGINAL VALUE (${SEEDS} paired seeds per sample) ===`,
      'mode: Tier 1, contextual auto-fire (the weakest player case)',
      `starting-XI strength: user ${userStrength}, opponent ${opponentStrength}, calibrated even delta ${evenDelta}`,
      `centered ladder coverage: ${formatSigned(baselineDelta - Math.min(...ladderDeltas))}`
      + ` to ${formatSigned(baselineDelta - Math.max(...ladderDeltas))} points of squad worth`,
      '',
      '=== SHARED NO-HERO BASELINE LADDER ===',
      '  delta   raw ppm   fitted ppm',
    ];
    for (let index = 0; index < rawLadder.length; index += 1) {
      lines.push(
        `  ${String(rawLadder[index].delta).padStart(5)}`
        + `   ${rawLadder[index].ppm.toFixed(3).padStart(7)}`
        + `   ${fittedLadder[index].ppm.toFixed(3).padStart(10)}`,
      );
    }
    lines.push(
      `  (calibrated even raw ppm ${rawBasePpm.toFixed(3)}, centered worth`
      + ` ${formatEstimate(estimateWorth(fittedLadder, rawBasePpm, rawBasePpm))})`,
      '',
      '=== HERO STACK VALUE AT CALIBRATED EVEN STRENGTH ===',
      'order  slot/role  power             solo ppm/worth   prefix ppm/worth   marginal   efficiency',
    );

    for (let index = 0; index < REPRESENTATIVE_HEROES.length; index += 1) {
      const hero = REPRESENTATIVE_HEROES[index];
      const solo = soloSamples[index];
      const prefix = prefixSamples[index];
      const summary = summaries[index];
      lines.push(
        `${String(index + 1).padEnd(7)}`
        + `${`${hero.slot}/${user.players[hero.slot].role}`.padEnd(11)}`
        + `${hero.power.padEnd(18)}`
        + `${`${solo.ppm.toFixed(3)} / ${formatEstimate(solo.worth)}`.padEnd(17)}`
        + `${`${prefix.ppm.toFixed(3)} / ${formatEstimate(prefix.worth)}`.padEnd(19)}`
        + `${formatSigned(summary.marginalWorth).padEnd(11)}`
        + formatEfficiency(summary.efficiency, solo.worth, prefix.worth),
      );
    }

    lines.push(
      '',
      'Efficiency = added marginal worth / that same hero\'s solo worth; 100% means no stacking loss.',
      'Bound markers mean the result reached the edge of the calibrated ladder.',
      '',
      '=== RALLY CRY VALID-CONTEXT VALUE ===',
      'matched policy: Tier 1 contextual auto; pair and companion use identical seeds',
      `SUPER_SPEED companion control: ${prefixSamples[0].ppm.toFixed(3)} / ${formatEstimate(prefixSamples[0].worth)}`,
      `SUPER_SPEED + RALLY_CRY prefix: ${rallyPairPpm.toFixed(3)} / ${formatEstimate(rallyPairWorth)}`,
      `RALLY_CRY marginal beside first hero: ${formatSigned(rallyMarginalWorth)}`,
      `RALLY_CRY paired contribution: ${formatPairedDelta(rallyPairedDelta)}`,
    );

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(soloSamples).toHaveLength(4);
    expect(prefixSamples).toHaveLength(4);
    expect(Number.isFinite(rallyMarginalWorth)).toBe(true);
  }, 7_200_000);
});

/** Points per match: 3 for a win, 1 for a draw, from the user's perspective. */
function sampleMatches(home: TeamDef, away: TeamDef): MatchSample {
  const outcomes: SeedOutcome[] = [];
  for (let index = 0; index < SEEDS; index += 1) {
    const result = runMatch(1_000_003 + index * 104_729, home, away, [], {
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
    });
    const [forGoals, againstGoals] = result.score;
    outcomes.push({
      points: forGoals > againstGoals ? 3 : forGoals === againstGoals ? 1 : 0,
      goalsFor: forGoals,
      goalsAgainst: againstGoals,
    });
  }
  return {
    ppm: outcomes.reduce((sum, outcome) => sum + outcome.points, 0) / outcomes.length,
    outcomes,
  };
}

function summarizePairedDelta(
  treatment: MatchSample,
  control: MatchSample,
): PairedDeltaSummary {
  if (treatment.outcomes.length !== control.outcomes.length || treatment.outcomes.length === 0) {
    throw new Error('paired samples must have the same non-zero seed count');
  }
  const pointDeltas = treatment.outcomes.map((outcome, index) => (
    outcome.points - control.outcomes[index].points
  ));
  const mean = pointDeltas.reduce((sum, value) => sum + value, 0) / pointDeltas.length;
  const variance = pointDeltas.length === 1 ? 0 : pointDeltas.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  ) / (pointDeltas.length - 1);
  const margin = 1.96 * Math.sqrt(variance / pointDeltas.length);
  const goalDifferenceDeltas = treatment.outcomes.map((outcome, index) => {
    const paired = control.outcomes[index];
    return (outcome.goalsFor - outcome.goalsAgainst)
      - (paired.goalsFor - paired.goalsAgainst);
  });
  return {
    mean,
    lower: mean - margin,
    upper: mean + margin,
    meanGoalDifferenceDelta: goalDifferenceDeltas.reduce((sum, value) => sum + value, 0)
      / goalDifferenceDeltas.length,
    better: pointDeltas.filter(value => value > 0).length,
    same: pointDeltas.filter(value => value === 0).length,
    worse: pointDeltas.filter(value => value < 0).length,
  };
}

function formatPairedDelta(summary: PairedDeltaSummary): string {
  return `ΔPPM ${formatSignedFixed(summary.mean, 3)}`
    + ` (95% CI [${formatSignedFixed(summary.lower, 3)}, ${formatSignedFixed(summary.upper, 3)}])`
    + `; ΔGD ${formatSignedFixed(summary.meanGoalDifferenceDelta, 3)}`
    + `; better/same/worse ${summary.better}/${summary.same}/${summary.worse}`;
}

function formatSignedFixed(value: number, digits: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function summarizeWorths(
  soloWorths: readonly number[],
  cumulativeWorths: readonly number[],
): SummaryRow[] {
  if (soloWorths.length !== cumulativeWorths.length) {
    throw new Error('solo and cumulative worth samples must have the same length');
  }
  return soloWorths.map((soloWorth, index) => {
    const previousWorth = index === 0 ? 0 : cumulativeWorths[index - 1];
    const marginalWorth = cumulativeWorths[index] - previousWorth;
    return {
      soloWorth,
      cumulativeWorth: cumulativeWorths[index],
      marginalWorth,
      efficiency: soloWorth === 0 ? null : marginalWorth / soloWorth,
    };
  });
}

/** Equal-weight pool-adjacent-violators fit for expected non-increasing PPM. */
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

function estimateWorth(
  ladder: readonly LadderRow[],
  ppm: number,
  baselinePpm: number,
): WorthEstimate {
  if (ppm === baselinePpm) return { value: 0, bound: 'exact' };
  const baseline = estimateEquivalentDelta(ladder, baselinePpm);
  const sample = estimateEquivalentDelta(ladder, ppm);
  const bound = sample.bound === 'at-most' ? 'at-least'
    : sample.bound === 'at-least' ? 'at-most'
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

  const plateau = sorted.filter(row => row.ppm === ppm);
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

function formatEstimate(estimate: WorthEstimate): string {
  const marker = estimate.bound === 'at-least' ? '>=' : estimate.bound === 'at-most' ? '<=' : '';
  return `${marker}${formatSigned(estimate.value)}`;
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
}

function formatEfficiency(
  efficiency: number | null,
  solo: WorthEstimate,
  prefix: WorthEstimate,
): string {
  if (efficiency === null || solo.bound !== 'exact' || prefix.bound !== 'exact') return 'n/a (ladder bound)';
  return `${(efficiency * 100).toFixed(0)}%`;
}

function openingTeams(): { user: TeamDef; opponent: TeamDef } {
  const state = addCreatedPlayer(
    beginStoryOnboarding(createCareer(createLaunchCareerSetup(
      4_000_000, undefined, content, 'full', 'COZY',
    ))),
    { name: 'Probe Rookie', ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 } },
  );
  const opponentId = content.clubs.clubs.map(club => club.id).find(id => id !== state.userClubId)!;
  const teams = buildCareerMatchTeams(state, [state.userClubId, opponentId]);
  return {
    user: withoutPowers(teams[state.userClubId]),
    opponent: withoutPowers(teams[opponentId]),
  };
}

function withHeroes(team: TeamDef, heroes: readonly RepresentativeHero[]): TeamDef {
  const bySlot = new Map(heroes.map(hero => [hero.slot, hero]));
  return {
    ...team,
    players: team.players.map((player, slot) => {
      const hero = bySlot.get(slot);
      if (hero === undefined) return { ...player, power: undefined, powerTier: undefined };
      if (!powerIsCompatibleWithRole(hero.power, player.role)) {
        throw new Error(`slot ${slot} (${player.role}) cannot carry ${hero.power}`);
      }
      return { ...player, power: hero.power, powerTier: 1 as const };
    }),
  };
}

/** Average role-weighted overall of the exact 11 players the engine starts. */
function teamStrength(team: TeamDef): number {
  if (team.players.length === 0) throw new Error('multihero-value team must contain starters');
  return Math.round(team.players.reduce(
    (sum, player) => sum + roleOverall(player.role, player.attrs),
    0,
  ) / team.players.length);
}

function scale(team: TeamDef, delta: number): TeamDef {
  return {
    ...team,
    players: team.players.map(player => ({
      ...player,
      attrs: Object.fromEntries(
        Object.entries(player.attrs).map(([key, value]) => [
          key,
          Math.max(1, Math.min(99, value + delta)),
        ]),
      ) as unknown as typeof player.attrs,
    })),
  };
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${name} must be a positive integer, got ${JSON.stringify(raw)}`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a safe positive integer, got ${JSON.stringify(raw)}`);
  }
  return value;
}
