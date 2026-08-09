/**
 * OPT-IN DECISION PROBE:
 *   KEEPER_GAIN_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/keeper-drill-gain-probe.test.ts
 *
 * Finds the Keeper Drills gain that prices the path against what it delivers.
 *
 * Gain rather than price, because the two dials do different things to a
 * per-TP ratio. Raising `tpCost` removes taps, but the save curve is concave —
 * REF 46 to 60 buys 15.4 points of save rate while 80 to 105 buys 8.5 — so
 * price strips the cheap tail and leaves the expensive head. A price sweep
 * (2026-07-30) bottomed out at 7.3x even at five times the going rate. Lowering
 * `gains.ref` shrinks the value of every tap including the first, which is the
 * numerator the ratio is built from.
 *
 * The multiplier applies to the whole keeper ladder. The leverage comes from
 * the keeper's contest exposure, which grows with the division rather than
 * shrinking, so re-tuning Tier I alone would leave the problem intact from D4.
 *
 * Content-only. No engine behaviour changes and no ENGINE_VERSION decision.
 *
 * KNOWN LIMITATION — measured 2026-08-04, before spending an hour on a full run.
 *
 * This scales the whole ladder but only ever *measures* Tier I. An opening
 * career buys about seven drills, so the keeper never reaches Tier II, and the
 * paragraph above is the one thing the instrument cannot check.
 *
 * After rounding, six candidates collapse to two distinguishable arms:
 *
 *   x1.00, x0.75          -> Tier I gain 2   (identical rows)
 *   x0.50 through x0.20   -> Tier I gain 1   (identical rows)
 *
 * A 25-seed run produced byte-identical output within each group. More seeds
 * cannot separate them — the collapse is structural, not sampling noise. Do not
 * pay for the 150-seed default expecting a finer answer than "2 versus 1".
 *
 * The striker reference also came back **negative** at 25 seeds
 * (goals created/100TP = -0.171), which makes the ratio column's denominator
 * negative and every ratio it prints meaningless. Fix that before trusting any
 * number here.
 *
 * To make this probe answer the question it poses, it needs to run past the
 * opening so Tiers II-V are actually bought.
 *
 * Env:
 *   KEEPER_GAIN_SEEDS  paired seeds per arm (default 150)
 */
import { loadLaunchContent, type LaunchContent } from '../../content';
import {
  kitOnlyPolicy,
  ORDINARY_POLICY,
  singlePathPolicies,
  type OpeningPolicy,
} from '../opening/policies';
import {
  runOpening,
  type CreationRatings,
  type OpeningRun,
} from '../opening/runner';
import { mean } from '../opening/stats';

const describeProbe =
  process.env.KEEPER_GAIN_PROBE === '1' ? describe : describe.skip;
const baseContent = loadLaunchContent();

const SEEDS = Array.from(
  { length: positiveIntegerEnv('KEEPER_GAIN_SEEDS', 150) },
  (_, index) => 4_000_000 + index * 7919,
);
const CREATION: CreationRatings = {
  pac: 50,
  sho: 65,
  pas: 50,
  def: 50,
  tec: 50,
  sta: 50,
};
const KIT = { coach: 'none' as const, buildTrainingPitch: false };

/**
 * 1.0 is today's ladder and the control. The rest walk down toward the point
 * where a keeper tap is worth what a striker tap is worth. Gains floor at 1:
 * a drill that awards nothing is a broken drill, not a balanced one.
 */
const CANDIDATE_MULTIPLIERS = [1, 0.75, 0.5, 0.4, 0.3, 0.2];

const KEEPER_DRILL_IDS = [
  'keeper-drills',
  'keeper-drills-ii',
  'keeper-drills-iii',
  'keeper-drills-iv',
  'keeper-drills-v',
];

/** Rescales `gains.ref` across the whole keeper ladder; costs stay at 10/15/21/28/36. */
function contentWithKeeperGainScale(multiplier: number): LaunchContent {
  return {
    ...baseContent,
    training: {
      ...baseContent.training,
      focusDrills: baseContent.training.focusDrills.map((drill) =>
        KEEPER_DRILL_IDS.includes(drill.id)
          ? {
              ...drill,
              gains: {
                ...drill.gains,
                ref: scaledGain(drill.gains.ref ?? 0, multiplier),
              },
            }
          : drill,
      ),
    },
  };
}

function scaledGain(base: number, multiplier: number): number {
  return Math.max(1, Math.round(base * multiplier));
}

function keeperLadder(multiplier: number): string {
  return KEEPER_DRILL_IDS.map((id) => {
    const drill = baseContent.training.focusDrills.find(
      (candidate) => candidate.id === id,
    );
    if (drill === undefined) throw new Error(`missing keeper drill ${id}`);
    return scaledGain(drill.gains.ref ?? 0, multiplier);
  }).join('/');
}

function runArm(policy: OpeningPolicy, content: LaunchContent): OpeningRun[] {
  return SEEDS.map((seed) =>
    runOpening({
      seed,
      difficulty: 'COZY',
      policy,
      creation: CREATION,
      content,
    }),
  );
}

describeProbe('keeper drill gain sweep', () => {
  it('finds the gain that prices keeper training against striker training', () => {
    const lines: string[] = [
      '',
      `=== KEEPER DRILL GAIN SWEEP (${SEEDS.length} paired seeds, costs unchanged) ===`,
      'Targets: ratio 1.5, ordinary opener wins <=5%, keeper-only losses >=90%.',
      '',
      '  x   gains I..V  taps  refAfter  goalsPrev/100TP  ratio  keeperArm L%  ordinary W%  ordinary L%',
    ];

    const finishing = runArm(
      singlePathPolicies(KIT).find(
        (policy) => policy.id === 'single-path-finishing-bare',
      )!,
      baseContent,
    );
    const control = runArm(kitOnlyPolicy(KIT), baseContent);
    const baselineGoalsFor = mean(control.map((run) => run.opener.goalsFor));
    const baselineGoalsAgainst = mean(
      control.map((run) => run.opener.goalsAgainst),
    );
    const finishingLift =
      ((mean(finishing.map((run) => run.opener.goalsFor)) - baselineGoalsFor) /
        mean(finishing.map((run) => run.tpSpent))) *
      100;

    for (const multiplier of CANDIDATE_MULTIPLIERS) {
      const content = contentWithKeeperGainScale(multiplier);
      const keeper = runArm(
        singlePathPolicies(KIT).find(
          (policy) => policy.id === 'single-path-keeper-drills-bare',
        )!,
        content,
      );
      const ordinary = runArm(ORDINARY_POLICY, content);
      const tpSpent = mean(keeper.map((run) => run.tpSpent));
      const keeperLift =
        tpSpent === 0
          ? 0
          : ((baselineGoalsAgainst -
              mean(keeper.map((run) => run.opener.goalsAgainst))) /
              tpSpent) *
            100;
      const refAfter = mean(
        keeper.map((run) => {
          const gain = run.statGains.find(
            (candidate) => candidate.attribute === 'ref',
          );
          return gain === undefined ? 46 : gain.after;
        }),
      );

      lines.push(
        `${multiplier.toFixed(2).padStart(5)}` +
          ` ${keeperLadder(multiplier).padStart(12)}` +
          ` ${mean(keeper.map((run) => run.tapCount))
            .toFixed(1)
            .padStart(5)}` +
          ` ${refAfter.toFixed(0).padStart(9)}` +
          ` ${keeperLift.toFixed(3).padStart(16)}` +
          ` ${(keeperLift / finishingLift).toFixed(2).padStart(6)}` +
          ` ${pct(rate(keeper, 'L')).padStart(13)}` +
          ` ${pct(rate(ordinary, 'W')).padStart(12)}` +
          ` ${pct(rate(ordinary, 'L')).padStart(12)}`,
      );
    }
    lines.push(
      '',
      `striker reference: goals created/100TP = ${finishingLift.toFixed(3)}`,
    );
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(CANDIDATE_MULTIPLIERS.length).toBeGreaterThan(0);
  }, 7_200_000);
});

function rate(runs: readonly OpeningRun[], outcome: 'W' | 'D' | 'L'): number {
  return (
    runs.filter((run) => run.opener.outcome === outcome).length / runs.length
  );
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
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
