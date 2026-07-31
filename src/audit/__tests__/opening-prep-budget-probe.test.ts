/**
 * OPT-IN DECISION PROBE:
 *   PREP_BUDGET_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/opening-prep-budget-probe.test.ts
 *
 * The third lever on the opener, and the one the other two could not reach.
 *
 * With Keeper Drills repriced by exposure the opener sits at 10.2% wins against
 * a 5% cap. The opponent experiment can close that, but only at +20 or more,
 * where goals conceded rise from 2.17 to 3.75 and the user's shots per match
 * fall from 3.6 to 2.4 — the spec's own definition of an unacceptable blowout.
 *
 * Preparation budget is the alternative. A career launches with 30 TP and banks
 * two more weekly settlements before the Week 3 fixture: 78 TP with no coach,
 * 102 with one. Lowering the launch grant scales every drill path down at once
 * rather than singling one out, and it cannot widen the heavy-loss tail because
 * it never touches the opponent.
 *
 * `startingTrainingPoints` is a `CareerSetup` field, so this changes what a
 * career is created with. It is not an injection into a running career, and the
 * runner asserts the career actually opened on the granted amount.
 *
 * The sweep crosses the budget with small opponent buffs, because the two
 * levers are not substitutes: less preparation lowers the win rate without
 * touching the tail, and a small buff finishes the job at a fraction of the
 * blowout cost a large buff carries.
 */
import { loadLaunchContent } from '../../content';
import type { DifficultyMode } from '../../game';
import { ORDINARY_POLICY, SMART_BREADTH_POLICY, type OpeningPolicy } from '../opening/policies';
import { reconcileTrainingPoints, runOpening, type CreationRatings } from '../opening/runner';
import { bootstrapProportion, mean, openerRailVerdict, percentile } from '../opening/stats';

const describeProbe = process.env.PREP_BUDGET_PROBE === '1' ? describe : describe.skip;
const content = loadLaunchContent();

/**
 * `PREP_BUDGET_OFFSET` shifts the seed window. The exploratory sweep runs at
 * offset 0; a candidate selected by reading those results is development data,
 * so its confirmation must run on a disjoint window.
 */
const OFFSET = nonNegativeIntegerEnv('PREP_BUDGET_OFFSET', 0);
const SEEDS = Array.from(
  { length: positiveIntegerEnv('PREP_BUDGET_SEEDS', 300) },
  (_, index) => 4_000_000 + (index + OFFSET) * 7919,
);
const ORDINARY_CREATION: CreationRatings = { pac: 50, sho: 65, pas: 50, def: 50, tec: 50, sta: 50 };
const SMART_CREATION: CreationRatings = { pac: 55, sho: 65, pas: 50, def: 35, tec: 60, sta: 50 };

/** 30 is production. 0 still leaves the two weekly settlements intact. */
const LAUNCH_GRANTS = integerListEnv('PREP_BUDGET_GRANTS', [30, 15, 0]);
const BUFFS = integerListEnv('PREP_BUDGET_BUFFS', [0, 5, 10]);

const CELLS: readonly {
  label: string;
  policy: OpeningPolicy;
  difficulty: DifficultyMode;
  creation: CreationRatings;
}[] = [
  { label: 'Ordinary x Cozy', policy: ORDINARY_POLICY, difficulty: 'COZY', creation: ORDINARY_CREATION },
  { label: 'Smart x Chairman', policy: SMART_BREADTH_POLICY, difficulty: 'CHAIRMAN', creation: SMART_CREATION },
];

describeProbe('opening preparation budget', () => {
  it('crosses launch TP with opponent buff against the opener contract', () => {
    const lines: string[] = [
      '',
      `=== PREP BUDGET x OPPONENT BUFF (${SEEDS.length} paired seeds) ===`,
      'Contract: win upper bound <=5%, loss lower bound >=90%.',
      'Tail is the 5th-percentile goal difference; production baseline is -4.',
      '',
      'cell               launchTP buff   taps     W%     D%     L%  verdict       GF-GA   tail  shots',
    ];

    for (const cell of CELLS) {
      for (const launchTp of LAUNCH_GRANTS) {
        for (const buff of BUFFS) {
          const runs = SEEDS.map(seed => {
            const run = runOpening({
              seed,
              difficulty: cell.difficulty,
              policy: cell.policy,
              creation: cell.creation,
              content,
              startingTrainingPoints: launchTp,
              opponentRoleBuff: buff,
            });
            reconcileTrainingPoints(run, launchTp);
            return run;
          });
          const wins = bootstrapProportion(runs.map(run => run.opener.outcome === 'W'));
          const draws = bootstrapProportion(runs.map(run => run.opener.outcome === 'D'));
          const losses = bootstrapProportion(runs.map(run => run.opener.outcome === 'L'));
          const goalDifferences = runs.map(run => run.opener.goalsFor - run.opener.goalsAgainst);

          lines.push(
            `${cell.label.padEnd(18)}`
            + ` ${String(launchTp).padStart(8)}`
            + ` ${String(buff).padStart(4)}`
            + ` ${mean(runs.map(r => r.tapCount)).toFixed(1).padStart(6)}`
            + ` ${pct(wins.rate)} ${pct(draws.rate)} ${pct(losses.rate)}`
            + `  ${openerRailVerdict(wins, losses).padEnd(13)}`
            + ` ${mean(runs.map(r => r.opener.goalsFor)).toFixed(2)}`
            + `-${mean(runs.map(r => r.opener.goalsAgainst)).toFixed(2)}`
            + ` ${String(percentile(goalDifferences, 0.05)).padStart(5)}`
            + ` ${mean(runs.map(r => r.opener.userShots)).toFixed(1)}`
            + `/${mean(runs.map(r => r.opener.opponentShots)).toFixed(1)}`,
          );
        }
      }
      lines.push('');
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(LAUNCH_GRANTS.length * BUFFS.length).toBeGreaterThan(0);
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

function nonNegativeIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function integerListEnv(name: string, fallback: readonly number[]): number[] {
  const raw = process.env[name];
  if (raw === undefined) return [...fallback];
  const parsed = raw.split(',').map((entry: string) => Number(entry.trim()));
  if (parsed.length === 0 || parsed.some((value: number) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`${name} must be a comma-separated list of non-negative integers`);
  }
  return parsed;
}
