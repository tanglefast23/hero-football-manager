/**
 * OPT-IN CLUB BUSINESS COHORT PROBE.
 *
 * Smoke:
 *   npm run test:probe -- src/audit/__tests__/club-business-cohort-probe.test.ts
 * Approval sample:
 *   CLUB_BUSINESS_SEEDS=300 CLUB_BUSINESS_SEED_OFFSET=10000 npm run test:probe -- \
 *     src/audit/__tests__/club-business-cohort-probe.test.ts
 *
 * The outcome policy is intentionally frozen and documented in the shared
 * harness (45% win / 25% draw / 30% loss with complete hero facts). This probe
 * approves the audience/economy formulas under that representative active-play
 * workload. It does not claim promotion or survival evidence.
 */
import {
  applySupporterImpacts,
  type DifficultyMode,
  type PendingUserMatchImpact,
} from '../../game';
import type { DivisionLevel } from '../../game/pyramid';
import {
  runClubBusinessBalanceScenario,
  type ClubBusinessBalanceResult,
} from '../club-business-balance-harness';

const SEEDS = positiveIntegerEnv('CLUB_BUSINESS_SEEDS', 24, 10_000);
const SEED_OFFSET = nonNegativeIntegerEnv(
  'CLUB_BUSINESS_SEED_OFFSET',
  10_000,
  100_000,
);
const CELLS: readonly {
  readonly division: DivisionLevel;
  readonly difficulty: DifficultyMode;
}[] = [
  { division: 5, difficulty: 'COZY' },
  { division: 5, difficulty: 'CHAIRMAN' },
  { division: 4, difficulty: 'COZY' },
  { division: 4, difficulty: 'CHAIRMAN' },
] as const;

describe('Club Business representative active-play cohort probe', () => {
  it('keeps realized income, Buzz, and supporters inside the approved rails', () => {
    const lines = [
      '',
      `=== CLUB BUSINESS COHORT (${SEEDS} seeds per cell) ===`,
      'cell                income P25/med/P75     Buzz med   cap     fans med',
    ];
    const violations: string[] = [];

    for (const cell of CELLS) {
      const runs = sample(cell);
      const income = runs.map((run) => run.attribution.totalNewIncome);
      const buzz = runs.flatMap((run) => run.buzzHalfValues);
      const capRate =
        runs.reduce((sum, run) => sum + run.buzzCapCount, 0) / buzz.length;
      const endingFans = runs.map((run) => run.endingFans);

      // Even the lower quartile must cover the mandatory $2,000 Training Pitch
      // Level-2 uplift with a 25% buffer. A previous $4,000 rail exceeded the
      // typical realized D5 income in the 300-seed calibration cohort.
      const incomeP25 = percentile(income, 0.25);
      const buzzMedian = percentile(buzz, 0.5);
      if (incomeP25 < 2_500) {
        violations.push(
          `D${cell.division} ${cell.difficulty} income P25 ${incomeP25} < 2500`,
        );
      }
      if (buzzMedian < 55 || buzzMedian > 85) {
        violations.push(
          `D${cell.division} ${cell.difficulty} Buzz median ${buzzMedian} outside 55-85`,
        );
      }
      if (capRate >= 0.25) {
        violations.push(
          `D${cell.division} ${cell.difficulty} Buzz cap rate ${capRate} >= 0.25`,
        );
      }
      expect(runs.every((run) => run.minimumFans >= 0)).toBe(true);
      expect(runs.every((run) => run.endingFans - run.startingFans < 500)).toBe(
        true,
      );

      lines.push(
        `${`D${cell.division} ${cell.difficulty}`.padEnd(18)}` +
          ` ${money(percentile(income, 0.25)).padStart(7)}` +
          `/${money(percentile(income, 0.5))}` +
          `/${money(percentile(income, 0.75))}` +
          `${String(percentile(buzz, 0.5)).padStart(13)}` +
          `${`${(capRate * 100).toFixed(1)}%`.padStart(7)}` +
          `${String(percentile(endingFans, 0.5)).padStart(13)}`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(violations).toEqual([]);
  });

  it('makes a seven-loss streak slow, bounded decline at every division scale', () => {
    for (const division of [5, 4, 3, 2, 1] as const) {
      const scale = 6 - division;
      let supporters = { consecutiveLosses: 0 };
      let fans = 500 * scale;
      const startingFans = fans;
      for (let match = 1; match <= 7; match += 1) {
        const impact = losingImpact(`D${division}-loss-${match}`, scale);
        const applied = applySupporterImpacts(
          supporters,
          fans,
          [impact],
          3,
          match,
        );
        if (match >= 3) expect(applied.fanCount).toBeLessThan(fans);
        supporters = applied.supporters;
        fans = applied.fanCount;
      }
      expect(startingFans - fans).toBe(22 * scale);
      expect(fans).toBeGreaterThan(0);
    }
  });
});

function sample(cell: (typeof CELLS)[number]): ClubBusinessBalanceResult[] {
  return Array.from({ length: SEEDS }, (_, index) =>
    runClubBusinessBalanceScenario({
      seed: 3_100_003 + (SEED_OFFSET + index) * 104_729,
      division: cell.division,
      difficulty: cell.difficulty,
      profile: 'BALANCED',
    }),
  );
}

function losingImpact(
  fixtureId: string,
  scale: number,
): PendingUserMatchImpact {
  return {
    fixtureId,
    competition: 'LEAGUE',
    settlementOrder: 0,
    source: 'PRODUCTION',
    outcome: 'LOSS',
    regulationGoals: 0,
    participantPlayerIds: ['player-1'],
    powerFiredPlayerIds: [],
    heroAppearancePlayerIds: [],
    divisionScale: scale,
    supporterWinUnits: 0,
    supporterHeroUnits: 0,
    buzzWin: 0,
    buzzGoals: 0,
    buzzHeroMoments: 0,
  };
}

function percentile(values: readonly number[], quantile: number): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor((ordered.length - 1) * quantile)];
}

function money(value: number): string {
  return `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('en-US')}`;
}

function positiveIntegerEnv(
  name: string,
  fallback: number,
  maximum: number,
): number {
  const value =
    process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} must be an integer from 1 to ${maximum}`);
  }
  return value;
}

function nonNegativeIntegerEnv(
  name: string,
  fallback: number,
  maximum: number,
): number {
  const value =
    process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${name} must be an integer from 0 to ${maximum}`);
  }
  return value;
}
