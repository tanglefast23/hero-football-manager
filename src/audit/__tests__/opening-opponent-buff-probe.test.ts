/**
 * OPT-IN DECISION PROBE:
 *   OPPONENT_BUFF_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/opening-opponent-buff-probe.test.ts
 *
 * The spec's conditional opening-opponent experiment, run because the opener
 * still fails its contract after the training side was balanced.
 *
 * With the Keeper Drills ladder repriced by exposure, the opener sits at 10.2%
 * wins against a 5% cap and 71.8% losses against a 90% floor. Per-career stat
 * gains are now `ref +10.5, def +27.7, sho +25.2` — no single path dominates,
 * so the residual is not a training-balance defect. Fifty-odd points of DEF and
 * SHO across three starters simply outweigh the opening opponent's 8.6-point
 * squad-mean edge. That makes it an opponent-strength question, which is what
 * this experiment was pre-registered to answer.
 *
 * +5 is the spec's predeclared candidate. The neighbours are measured alongside
 * it because a candidate chosen after inspecting results is development data,
 * not evidence: if a size other than +5 is selected here, it needs confirming
 * on a second frozen cohort before it can ship.
 *
 * The buff clones the fixture's opponent only. No saved career state, caps,
 * contracts, or later fixtures are touched.
 */
import { loadLaunchContent } from '../../content';
import type { DifficultyMode } from '../../game';
import {
  ORDINARY_POLICY,
  SMART_BREADTH_POLICY,
  type OpeningPolicy,
} from '../opening/policies';
import {
  productionLaunchTrainingPoints,
  reconcileTrainingPoints,
  runOpening,
  type CreationRatings,
} from '../opening/runner';
import {
  bootstrapProportion,
  mean,
  openerRailVerdict,
  percentile,
} from '../opening/stats';

const describeProbe =
  process.env.OPPONENT_BUFF_PROBE === '1' ? describe : describe.skip;
const content = loadLaunchContent();
const LAUNCH_TP = productionLaunchTrainingPoints(content);

const SEEDS = Array.from(
  { length: positiveIntegerEnv('OPPONENT_BUFF_SEEDS', 300) },
  (_, index) => 4_000_000 + index * 7919,
);
const ORDINARY_CREATION: CreationRatings = {
  pac: 50,
  sho: 65,
  pas: 50,
  def: 50,
  tec: 50,
  sta: 50,
};
const SMART_CREATION: CreationRatings = {
  pac: 55,
  sho: 65,
  pas: 50,
  def: 35,
  tec: 60,
  sta: 50,
};
const CANDIDATE_BUFFS = [0, 5, 10, 15, 20, 25];

const CELLS: readonly {
  label: string;
  policy: OpeningPolicy;
  difficulty: DifficultyMode;
  creation: CreationRatings;
}[] = [
  {
    label: 'Ordinary x Cozy',
    policy: ORDINARY_POLICY,
    difficulty: 'COZY',
    creation: ORDINARY_CREATION,
  },
  {
    label: 'Smart x Chairman',
    policy: SMART_BREADTH_POLICY,
    difficulty: 'CHAIRMAN',
    creation: SMART_CREATION,
  },
];

describeProbe('opening opponent buff', () => {
  it('measures each candidate against the 5% win / 90% loss contract', () => {
    const lines: string[] = [
      '',
      `=== OPPONENT ROLE BUFF (${SEEDS.length} paired seeds) ===`,
      'Buff adds +N SHO to FWDs, +N DEF to DEFs, +N REF to the GK. MID unchanged.',
      '',
      'cell               buff     W%     D%     L%   [W 95% CI]   verdict  GF-GA   tail  shots',
    ];

    for (const cell of CELLS) {
      for (const buff of CANDIDATE_BUFFS) {
        const runs = SEEDS.map((seed) => {
          const run = runOpening({
            seed,
            difficulty: cell.difficulty,
            policy: cell.policy,
            creation: cell.creation,
            content,
            opponentRoleBuff: buff,
          });
          reconcileTrainingPoints(run, LAUNCH_TP);
          return run;
        });
        const wins = bootstrapProportion(
          runs.map((run) => run.opener.outcome === 'W'),
        );
        const draws = bootstrapProportion(
          runs.map((run) => run.opener.outcome === 'D'),
        );
        const losses = bootstrapProportion(
          runs.map((run) => run.opener.outcome === 'L'),
        );
        const goalDifferences = runs.map(
          (run) => run.opener.goalsFor - run.opener.goalsAgainst,
        );

        lines.push(
          `${cell.label.padEnd(18)}` +
            ` ${String(buff).padStart(4)}` +
            ` ${pct(wins.rate)} ${pct(draws.rate)} ${pct(losses.rate)}` +
            `  [${pct(wins.lower95)},${pct(wins.upper95)}]` +
            ` ${openerRailVerdict(wins, losses).padEnd(13)}` +
            ` ${mean(runs.map((r) => r.opener.goalsFor)).toFixed(2)}` +
            `-${mean(runs.map((r) => r.opener.goalsAgainst)).toFixed(2)}` +
            // The heavy-loss tail is the blowout guard: a candidate that reaches
            // the rail by turning a teaching match into a rout is rejected.
            ` ${String(percentile(goalDifferences, 0.05)).padStart(5)}` +
            ` ${mean(runs.map((r) => r.opener.userShots)).toFixed(1)}` +
            `/${mean(runs.map((r) => r.opener.opponentShots)).toFixed(1)}`,
        );
      }
      lines.push('');
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(CANDIDATE_BUFFS.length).toBeGreaterThan(0);
  }, 7_200_000);
});

function pct(value: number): string {
  return `${(value * 100).toFixed(1).padStart(5)}%`;
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
