/**
 * OPT-IN DECISION PROBE:
 *   OPENING_BALANCE_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/real-player-opening-probe.test.ts
 *
 * Measures the opening match for managers who actually prepare: hiring the
 * Week 1 coach, starting the Training Pitch, and spending the bank on
 * role-correct drills. Every arm runs through production actions only, and the
 * TP ledger must reconcile or the run is discarded as invalid rather than
 * quietly averaged in.
 *
 * Env:
 *   OPENING_BALANCE_SEEDS   seeds per cell (default 200)
 *   OPENING_BALANCE_OFFSET  seed-window offset for a held-out cohort
 *   OPENING_BALANCE_ARTIFACT  path to write the JSON artifact
 */
import { writeFileSync } from 'node:fs';

import { loadLaunchContent } from '../../content';
import type { DifficultyMode } from '../../game';
import {
  JOE_OBSERVED_COACH_POLICY,
  JOE_OBSERVED_NO_COACH_POLICY,
  NO_TRAINING_POLICY,
  ORDINARY_POLICY,
  PAC_CONTROL_POLICY,
  SMART_BREADTH_POLICY,
  SMART_CONCENTRATION_POLICY,
  SMART_EXTRA_FWD_POLICY,
  type OpeningPolicy,
} from '../opening/policies';
import {
  reconcileTrainingPoints,
  runOpening,
  type CreationRatings,
  type OpeningRun,
  productionLaunchTrainingPoints,
} from '../opening/runner';
import {
  bootstrapProportion,
  mean,
  openerRailVerdict,
  percentile,
  type RailVerdict,
} from '../opening/stats';

const describeProbe =
  process.env.OPENING_BALANCE_PROBE === '1' ? describe : describe.skip;
const content = loadLaunchContent();
const LAUNCH_TP = productionLaunchTrainingPoints(content);

const SEEDS = positiveIntegerEnv('OPENING_BALANCE_SEEDS', 200);
const OFFSET = nonNegativeIntegerEnv('OPENING_BALANCE_OFFSET', 0);
const ARTIFACT = process.env.OPENING_BALANCE_ARTIFACT;

/** Paired seeds: every cell sees the identical career population. */
const SEED_LIST = Array.from(
  { length: SEEDS },
  (_, index) => 4_000_000 + (index + OFFSET) * 7919,
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

interface Cell {
  readonly label: string;
  readonly policy: OpeningPolicy;
  readonly difficulty: DifficultyMode;
  readonly creation: CreationRatings;
  /** Primary cells carry the 5%/90% contract; diagnostics only explain them. */
  readonly primary: boolean;
}

const CELLS: readonly Cell[] = [
  {
    label: 'Ordinary x Cozy',
    policy: ORDINARY_POLICY,
    difficulty: 'COZY',
    creation: ORDINARY_CREATION,
    primary: true,
  },
  {
    label: 'Smart x Chairman',
    policy: SMART_BREADTH_POLICY,
    difficulty: 'CHAIRMAN',
    creation: SMART_CREATION,
    primary: true,
  },
  {
    label: 'Ordinary x Chairman',
    policy: ORDINARY_POLICY,
    difficulty: 'CHAIRMAN',
    creation: ORDINARY_CREATION,
    primary: false,
  },
  {
    label: 'Smart x Cozy',
    policy: SMART_BREADTH_POLICY,
    difficulty: 'COZY',
    creation: SMART_CREATION,
    primary: false,
  },
  {
    label: 'Smart extra-FWD x Chairman',
    policy: SMART_EXTRA_FWD_POLICY,
    difficulty: 'CHAIRMAN',
    creation: SMART_CREATION,
    primary: false,
  },
  {
    label: 'Smart concentration x Chairman',
    policy: SMART_CONCENTRATION_POLICY,
    difficulty: 'CHAIRMAN',
    creation: SMART_CREATION,
    primary: false,
  },
  {
    label: 'Joe observed (coach) x Cozy',
    policy: JOE_OBSERVED_COACH_POLICY,
    difficulty: 'COZY',
    creation: ORDINARY_CREATION,
    primary: false,
  },
  {
    label: 'Joe observed (no coach) x Cozy',
    policy: JOE_OBSERVED_NO_COACH_POLICY,
    difficulty: 'COZY',
    creation: ORDINARY_CREATION,
    primary: false,
  },
  {
    label: 'PAC control x Cozy',
    policy: PAC_CONTROL_POLICY,
    difficulty: 'COZY',
    creation: ORDINARY_CREATION,
    primary: false,
  },
  {
    label: 'No training x Cozy',
    policy: NO_TRAINING_POLICY,
    difficulty: 'COZY',
    creation: ORDINARY_CREATION,
    primary: false,
  },
];

interface CellReport {
  readonly label: string;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly difficulty: DifficultyMode;
  readonly primary: boolean;
  readonly seeds: number;
  readonly wins: ReturnType<typeof bootstrapProportion>;
  readonly draws: ReturnType<typeof bootstrapProportion>;
  readonly losses: ReturnType<typeof bootstrapProportion>;
  readonly verdict: RailVerdict;
  readonly meanGoalsFor: number;
  readonly meanGoalsAgainst: number;
  readonly meanGoalDifference: number;
  /** 5th percentile goal difference: the heavy-loss tail a buff must not worsen. */
  readonly heavyLossTail: number;
  readonly meanUserStrength: number;
  readonly meanOpponentStrength: number;
  readonly meanUserShots: number;
  readonly meanOpponentShots: number;
  readonly meanTaps: number;
  readonly meanTpSpent: number;
  readonly meanTpBanked: number;
  readonly meanKickoffCondition: number;
  readonly skippedIntents: number;
  readonly statGainsByPath: Readonly<Record<string, number>>;
}

function measureCell(cell: Cell): CellReport {
  const runs: OpeningRun[] = [];
  for (const seed of SEED_LIST) {
    const run = runOpening({
      seed,
      difficulty: cell.difficulty,
      policy: cell.policy,
      creation: cell.creation,
      content,
    });
    // A ledger that does not reconcile means TP moved outside the recorded
    // actions. That invalidates the cohort; it must throw, not be dropped.
    reconcileTrainingPoints(run, LAUNCH_TP);
    runs.push(run);
  }

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

  const statGainsByPath: Record<string, number> = {};
  for (const run of runs) {
    for (const gain of run.statGains) {
      statGainsByPath[gain.attribute] =
        (statGainsByPath[gain.attribute] ?? 0) + (gain.after - gain.before);
    }
  }
  for (const key of Object.keys(statGainsByPath)) {
    statGainsByPath[key] =
      Math.round((statGainsByPath[key] / runs.length) * 100) / 100;
  }

  return {
    label: cell.label,
    policyId: cell.policy.id,
    policyVersion: cell.policy.version,
    difficulty: cell.difficulty,
    primary: cell.primary,
    seeds: runs.length,
    wins,
    draws,
    losses,
    verdict: openerRailVerdict(wins, losses),
    meanGoalsFor: round2(mean(runs.map((run) => run.opener.goalsFor))),
    meanGoalsAgainst: round2(mean(runs.map((run) => run.opener.goalsAgainst))),
    meanGoalDifference: round2(mean(goalDifferences)),
    heavyLossTail: percentile(goalDifferences, 0.05),
    meanUserStrength: round2(mean(runs.map((run) => run.opener.userStrength))),
    meanOpponentStrength: round2(
      mean(runs.map((run) => run.opener.opponentStrength)),
    ),
    meanUserShots: round2(mean(runs.map((run) => run.opener.userShots))),
    meanOpponentShots: round2(
      mean(runs.map((run) => run.opener.opponentShots)),
    ),
    meanTaps: round2(mean(runs.map((run) => run.tapCount))),
    meanTpSpent: round2(mean(runs.map((run) => run.tpSpent))),
    meanTpBanked: round2(mean(runs.map((run) => run.tpBanked))),
    meanKickoffCondition: round2(
      mean(runs.map((run) => mean(Object.values(run.kickoffCondition)))),
    ),
    skippedIntents: runs.reduce((sum, run) => sum + run.skippedIntents, 0),
    statGainsByPath,
  };
}

describeProbe('real-player opening balance', () => {
  it('measures the current opener across every prepared-manager arm', () => {
    const reports = CELLS.map(measureCell);
    const lines: string[] = [
      '',
      `=== REAL-PLAYER OPENER (${SEEDS} paired seeds, offset ${OFFSET}) ===`,
      'cell                                W%     D%     L%    [W 95% CI]      verdict' +
        '   GF-GA   tail  squad vs opp  shots  taps  TP sp/bk  cond',
    ];
    for (const report of reports) {
      lines.push(
        `${report.label.padEnd(32)}` +
          ` ${pct(report.wins.rate)} ${pct(report.draws.rate)} ${pct(report.losses.rate)}` +
          `  [${pct(report.wins.lower95)},${pct(report.wins.upper95)}]` +
          ` ${(report.primary ? report.verdict : '-').padEnd(13)}` +
          ` ${report.meanGoalsFor.toFixed(2)}-${report.meanGoalsAgainst.toFixed(2)}` +
          ` ${String(report.heavyLossTail).padStart(5)}` +
          ` ${report.meanUserStrength.toFixed(1).padStart(6)} vs ${report.meanOpponentStrength.toFixed(1)}` +
          ` ${report.meanUserShots.toFixed(1).padStart(5)}/${report.meanOpponentShots.toFixed(1)}` +
          ` ${report.meanTaps.toFixed(1).padStart(5)}` +
          ` ${report.meanTpSpent.toFixed(0)}/${report.meanTpBanked.toFixed(0)}` +
          ` ${report.meanKickoffCondition.toFixed(0).padStart(5)}`,
      );
    }
    lines.push('', 'mean stat gain by attribute, per career:');
    for (const report of reports) {
      lines.push(
        `  ${report.label.padEnd(32)} ${JSON.stringify(report.statGainsByPath)}`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    if (ARTIFACT !== undefined) {
      writeFileSync(
        ARTIFACT,
        `${JSON.stringify(
          {
            generator: 'real-player-opening-probe',
            artifactVersion: 1,
            seedList: SEED_LIST,
            seedCount: SEEDS,
            seedOffset: OFFSET,
            railMaximumWinRate: 0.05,
            railMinimumLossRate: 0.9,
            cells: reports,
          },
          null,
          2,
        )}\n`,
      );
    }

    // The probe reports; it does not decide. The only hard assertion is that
    // every arm produced a reconciled, complete cohort.
    for (const report of reports) {
      expect(report.seeds).toBe(SEEDS);
    }
    expect(reports.filter((report) => report.primary)).toHaveLength(2);
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
