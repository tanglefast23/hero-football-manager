/**
 * OPT-IN DECISION PROBE:
 *   PATH_LEVERAGE_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/training-path-leverage-probe.test.ts
 *
 * Answers "is defence training too strong?" at the level a player experiences
 * it: value per TP spent, on the real opening roster, rather than value per raw
 * attribute point at matched baselines.
 *
 * The distinction matters because three career-layer effects sit between a TP
 * and a contest, and none of them appear in the sim-level leverage probe:
 *
 *   1. Contests are log-ratio, so +5 on a defender's DEF 46 is a larger move
 *      than +5 on a striker's SHO 65. Where a stat starts decides what it buys.
 *   2. The Training Pitch is the DEF drill multiplier and no other path's
 *      (see trainingFacilityType in src/game/training.ts) — so the building
 *      every club builds first silently prices Duels below every other drill.
 *   3. DEF is read at four contest sites by every defending outfielder, while
 *      SHO fires only on that one striker's own shots.
 *
 * Each arm pours the entire opening bank into a single path and is compared to
 * a no-training baseline that shares its facility state, so the reported lift
 * is attributable to the drills alone.
 */
import { loadLaunchContent } from '../../content';
import { kitOnlyPolicy, singlePathPolicies } from '../opening/policies';
import {
  productionLaunchTrainingPoints,
  reconcileTrainingPoints,
  runOpening,
  type CreationRatings,
} from '../opening/runner';
import { bootstrapProportion, mean } from '../opening/stats';

const describeProbe = process.env.PATH_LEVERAGE_PROBE === '1' ? describe : describe.skip;
const content = loadLaunchContent();
const LAUNCH_TP = productionLaunchTrainingPoints(content);

const SEEDS = positiveIntegerEnv('PATH_LEVERAGE_SEEDS', 150);
const OFFSET = nonNegativeIntegerEnv('PATH_LEVERAGE_OFFSET', 0);
const SEED_LIST = Array.from({ length: SEEDS }, (_, index) => 4_000_000 + (index + OFFSET) * 7919);
const CREATION: CreationRatings = { pac: 50, sho: 65, pas: 50, def: 50, tec: 50, sta: 50 };

/**
 * `bare` isolates the contest-structure value of each path. `pitch` adds the
 * Training Pitch every real club builds first, which multiplies DEF drills by
 * 1.25 and nothing else — the gap between the two columns is that subsidy.
 */
const KITS = [
  { name: 'bare', coach: 'none' as const, buildTrainingPitch: false },
  { name: 'pitch', coach: 'none' as const, buildTrainingPitch: true },
];

interface PathRow {
  readonly kit: string;
  readonly pathId: string;
  readonly winRate: number;
  readonly drawRate: number;
  readonly lossRate: number;
  readonly meanGoalDifference: number;
  readonly taps: number;
  readonly tpSpent: number;
  /** Total attribute points the drills actually added across the squad. */
  readonly statPointsGained: number;
  /** Attribute points per 100 TP: how efficiently the path converts currency. */
  readonly statPointsPer100Tp: number;
  /** Squad-strength lift over the matched no-training baseline. */
  readonly strengthLift: number;
  readonly strengthLiftPer100Tp: number;
  /** Goal-difference lift over the matched baseline, per 100 TP. */
  readonly goalDifferenceLiftPer100Tp: number;
}

describeProbe('training path leverage per TP', () => {
  it('prices every drill path at the real opening roster', () => {
    const rows: PathRow[] = [];
    const lines: string[] = [
      '',
      `=== PATH LEVERAGE PER TP (${SEEDS} paired seeds, offset ${OFFSET}) ===`,
    ];

    for (const kit of KITS) {
      // Matched control: same coach and facility state, no drills.
      const baseline = SEED_LIST.map(seed => runOpening({
        seed,
        difficulty: 'COZY',
        policy: kitOnlyPolicy(kit),
        creation: CREATION,
        content,
      }));
      const baselineStrength = mean(baseline.map(run => run.opener.userStrength));
      const baselineGoalDifference = mean(
        baseline.map(run => run.opener.goalsFor - run.opener.goalsAgainst),
      );

      for (const policy of singlePathPolicies(kit)) {
        const pathId = policy.id.replace(/^single-path-/, '').replace(/-(bare|kit)$/, '');
        const runs = SEED_LIST.map(seed => {
          const run = runOpening({
            seed, difficulty: 'COZY', policy, creation: CREATION, content,
          });
          reconcileTrainingPoints(run, LAUNCH_TP);
          return run;
        });

        const tpSpent = mean(runs.map(run => run.tpSpent));
        const statPoints = mean(runs.map(run => run.statGains.reduce(
          (sum, gain) => sum + (gain.after - gain.before),
          0,
        )));
        const strength = mean(runs.map(run => run.opener.userStrength));
        const goalDifference = mean(runs.map(run => run.opener.goalsFor - run.opener.goalsAgainst));
        const per100 = (value: number) => (tpSpent === 0 ? 0 : (value / tpSpent) * 100);

        rows.push({
          kit: kit.name,
          pathId,
          winRate: bootstrapProportion(runs.map(run => run.opener.outcome === 'W')).rate,
          drawRate: bootstrapProportion(runs.map(run => run.opener.outcome === 'D')).rate,
          lossRate: bootstrapProportion(runs.map(run => run.opener.outcome === 'L')).rate,
          meanGoalDifference: round2(goalDifference),
          taps: round2(mean(runs.map(run => run.tapCount))),
          tpSpent: round2(tpSpent),
          statPointsGained: round2(statPoints),
          statPointsPer100Tp: round2(per100(statPoints)),
          strengthLift: round2(strength - baselineStrength),
          strengthLiftPer100Tp: round2(per100(strength - baselineStrength)),
          goalDifferenceLiftPer100Tp: round2(per100(goalDifference - baselineGoalDifference)),
        });
      }
    }

    for (const kit of KITS) {
      lines.push('', `--- kit: ${kit.name} ---`);
      lines.push(
        'path            taps   TP   statPts  statPts/100TP  strength+  str+/100TP'
        + '   GD+/100TP     W%     D%     L%',
      );
      const kitRows = rows.filter(row => row.kit === kit.name)
        .sort((left, right) => right.goalDifferenceLiftPer100Tp - left.goalDifferenceLiftPer100Tp);
      for (const row of kitRows) {
        lines.push(
          `${row.pathId.padEnd(14)}`
          + ` ${row.taps.toFixed(1).padStart(4)}`
          + ` ${row.tpSpent.toFixed(0).padStart(4)}`
          + ` ${row.statPointsGained.toFixed(1).padStart(8)}`
          + ` ${row.statPointsPer100Tp.toFixed(1).padStart(14)}`
          + ` ${row.strengthLift.toFixed(2).padStart(10)}`
          + ` ${row.strengthLiftPer100Tp.toFixed(2).padStart(11)}`
          + ` ${row.goalDifferenceLiftPer100Tp.toFixed(3).padStart(11)}`
          + ` ${pct(row.winRate)} ${pct(row.drawRate)} ${pct(row.lossRate)}`,
        );
      }
    }

    // The headline the question asks for: Duels against Finishing, per TP.
    for (const kit of KITS) {
      const duels = rows.find(row => row.kit === kit.name && row.pathId === 'duels')!;
      const finishing = rows.find(row => row.kit === kit.name && row.pathId === 'finishing')!;
      const keeper = rows.find(row => row.kit === kit.name && row.pathId === 'keeper-drills')!;
      lines.push(
        '',
        `[${kit.name}] per 100 TP -- duels GD+${duels.goalDifferenceLiftPer100Tp.toFixed(3)}`
        + ` | keeper-drills GD+${keeper.goalDifferenceLiftPer100Tp.toFixed(3)}`
        + ` | finishing GD+${finishing.goalDifferenceLiftPer100Tp.toFixed(3)}`,
        `[${kit.name}] stat points per 100 TP -- duels ${duels.statPointsPer100Tp.toFixed(1)}`
        + ` | keeper-drills ${keeper.statPointsPer100Tp.toFixed(1)}`
        + ` | finishing ${finishing.statPointsPer100Tp.toFixed(1)}`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(rows).toHaveLength(KITS.length * 7);
  }, 7_200_000);
});

function pct(value: number): string {
  return `${(value * 100).toFixed(1).padStart(5)}%`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function nonNegativeIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}
