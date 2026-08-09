/**
 * OPT-IN DECISION PROBE:
 *   KEEPER_PRICE_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/keeper-drill-price-probe.test.ts
 *
 * Prices Keeper Drills against the value it actually delivers.
 *
 * Measured 2026-07-30, a TP spent on Keeper Drills buys roughly 14x what a TP
 * spent on Finishing buys at the opening roster. Three engine-side explanations
 * were tested and rejected: dampening REF in the aim reference moved goals
 * prevented per 100 TP by 1.7%, and dampening it in the shooter's shoot-or-pass
 * estimate moved goals conceded from 0.47 to 0.70 while doubling league-wide
 * shot volume — a far larger change than the defect it addressed.
 *
 * What remains is arithmetic rather than a bug. Seven taps add about 59 REF to
 * a base of 46, which lifts the save rate from 51% to 89%. Drill gains are
 * absolute, so a drill is worth most on a low stat, and the keeper holds the
 * lowest stat that matters in the only slot every attack must pass through.
 *
 * Price is therefore the lever that matches the defect: the rail is per TP, and
 * `tpCost` is its denominator. This probe sweeps that denominator. It changes
 * no engine behaviour and needs no ENGINE_VERSION decision.
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
  process.env.KEEPER_PRICE_PROBE === '1' ? describe : describe.skip;
const baseContent = loadLaunchContent();

const SEEDS = Array.from(
  { length: positiveIntegerEnv('KEEPER_PRICE_SEEDS', 150) },
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
 * Multipliers applied to the whole Keeper Drills ladder, not just Tier I.
 *
 * Re-pricing one tier would leave Keeper Drills 2 through 5 (15/21/28/36)
 * underpriced the moment the club reaches D4, and the leverage this probe
 * measures is not specific to Tier I — it comes from the keeper's contest
 * exposure, which grows with the division rather than shrinking.
 *
 * 1.0 is today's price and the control. 1.2 and 1.5 are the gentle end, a
 * visible nudge that keeps the drill recognisably priced against its peers.
 * 2.0 upward tests whether any price a player would accept closes the gap
 * unaided.
 */
const CANDIDATE_MULTIPLIERS = [1, 1.2, 1.5, 2, 3, 4, 5];

/** Every tier of the keeper path, cheapest first. */
const KEEPER_DRILL_IDS = [
  'keeper-drills',
  'keeper-drills-ii',
  'keeper-drills-iii',
  'keeper-drills-iv',
  'keeper-drills-v',
];

/** Re-prices the whole keeper ladder, leaving every other path untouched. */
function contentWithKeeperPriceScale(multiplier: number): LaunchContent {
  return {
    ...baseContent,
    training: {
      ...baseContent.training,
      focusDrills: baseContent.training.focusDrills.map((drill) =>
        KEEPER_DRILL_IDS.includes(drill.id)
          ? { ...drill, tpCost: Math.round(drill.tpCost * multiplier) }
          : drill,
      ),
    },
  };
}

function keeperLadder(multiplier: number): string {
  return KEEPER_DRILL_IDS.map((id) => {
    const drill = baseContent.training.focusDrills.find(
      (candidate) => candidate.id === id,
    );
    if (drill === undefined) throw new Error(`missing keeper drill ${id}`);
    return Math.round(drill.tpCost * multiplier);
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

describeProbe('keeper drill price sweep', () => {
  it('reports leverage and opener difficulty at each candidate price', () => {
    const lines: string[] = [
      '',
      `=== KEEPER DRILL PRICE SWEEP (${SEEDS.length} paired seeds) ===`,
      'The opener only ever uses Tier I, so the ladder column shows what the same',
      'multiplier does to the later tiers a climbing club will meet.',
      '',
      ' x     ladder (I..V)   taps  refAfter  goalsPrev/100TP  ratio  keeperArm L%  ordinary W%',
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
      const content = contentWithKeeperPriceScale(multiplier);
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
        `${multiplier.toFixed(1).padStart(4)}` +
          ` ${keeperLadder(multiplier).padStart(17)}` +
          ` ${mean(keeper.map((run) => run.tapCount))
            .toFixed(1)
            .padStart(6)}` +
          ` ${refAfter.toFixed(0).padStart(9)}` +
          ` ${keeperLift.toFixed(3).padStart(16)}` +
          ` ${(keeperLift / finishingLift).toFixed(2).padStart(6)}` +
          ` ${pct(keeper.filter((run) => run.opener.outcome === 'L').length / keeper.length).padStart(13)}` +
          ` ${pct(ordinary.filter((run) => run.opener.outcome === 'W').length / ordinary.length).padStart(12)}`,
      );
    }
    lines.push(
      '',
      `striker reference: goals created/100TP = ${finishingLift.toFixed(3)}`,
      'target ratio 1.5; today measures ~14 at multiplier 1.0',
    );
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(CANDIDATE_MULTIPLIERS.length).toBeGreaterThan(0);
  }, 7_200_000);
});

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
