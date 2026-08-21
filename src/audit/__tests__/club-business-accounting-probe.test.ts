/**
 * OPT-IN CLUB BUSINESS ACCOUNTING PROBE.
 *
 * Smoke:
 *   npm run test:probe -- src/audit/__tests__/club-business-accounting-probe.test.ts
 * Approval samples (both required):
 *   CLUB_BUSINESS_SEEDS=3000 CLUB_BUSINESS_SEED_OFFSET=0 npm run test:probe -- \
 *     src/audit/__tests__/club-business-accounting-probe.test.ts
 *   CLUB_BUSINESS_SEEDS=3000 CLUB_BUSINESS_SEED_OFFSET=40000 npm run test:probe -- \
 *     src/audit/__tests__/club-business-accounting-probe.test.ts
 *
 * This is frozen-outcome accounting, not a promotion simulation. The control
 * and feature sides receive the same complete match facts. Each category is
 * attributed separately and the harness rejects a one-dollar conservation
 * mismatch or a duplicate cash identity.
 */
import type { DifficultyMode } from '../../game';
import type { SponsorObjectiveKind, SponsorProfileId } from '../../game';
import type { DivisionLevel } from '../../game/pyramid';
import {
  CLUB_BUSINESS_FACILITY_UPGRADE_UPLIFT,
  runClubBusinessBalanceScenario,
  type ClubBusinessBalanceResult,
  type ClubBusinessSponsorContractResult,
} from '../club-business-balance-harness';

const SEEDS = positiveIntegerEnv('CLUB_BUSINESS_SEEDS', 24, 10_000);
const SEED_OFFSET = nonNegativeIntegerEnv(
  'CLUB_BUSINESS_SEED_OFFSET',
  0,
  100_000,
);
const SPONSOR_DOMINANCE_APPROVAL_SEEDS = 3_000;
const CELLS: readonly {
  readonly division: DivisionLevel;
  readonly difficulty: DifficultyMode;
}[] = [
  { division: 5, difficulty: 'COZY' },
  { division: 5, difficulty: 'CHAIRMAN' },
  { division: 4, difficulty: 'COZY' },
  { division: 4, difficulty: 'CHAIRMAN' },
  { division: 3, difficulty: 'COZY' },
  { division: 3, difficulty: 'CHAIRMAN' },
  { division: 2, difficulty: 'COZY' },
  { division: 2, difficulty: 'CHAIRMAN' },
  { division: 1, difficulty: 'COZY' },
  { division: 1, difficulty: 'CHAIRMAN' },
] as const;
const PROFILES: readonly SponsorProfileId[] = ['STEADY', 'BALANCED', 'BOLD'];
const OBJECTIVE_KINDS: readonly SponsorObjectiveKind[] = [
  'LEAGUE_CLEAN_SHEETS',
  'LEAGUE_THREE_GOAL_GAMES',
  'LEAGUE_AWAY_POINTS',
];
const SAMPLE_CACHE = new Map<string, ClubBusinessBalanceResult[]>();

describe('Club Business frozen-outcome accounting probe', () => {
  it('conserves every dollar and reports each new-income source separately', () => {
    const lines = [
      '',
      `=== CLUB BUSINESS ACCOUNTING (${SEEDS} paired seeds per cell) ===`,
      'cell              monthly   objective      gate     merch     total',
    ];

    for (const cell of CELLS) {
      const runs = sample(cell);
      expect(runs).toHaveLength(SEEDS);
      for (const run of runs) {
        const attributed =
          run.attribution.totalNewIncome - run.mandatoryPitchUplift;
        expect(
          run.featureCashAfterMandatoryPitchUplift -
            run.controlCashAfterMandatoryPitchUplift,
        ).toBe(attributed);
        expect(Object.values(run.attribution).every(Number.isSafeInteger)).toBe(
          true,
        );
        expect(run.minimumFans).toBeGreaterThanOrEqual(0);
      }

      if (cell.division === 5) {
        expect(
          runs.every((run) => run.attribution.monthlySponsorDelta === 0),
        ).toBe(true);
        expect(
          runs.every((run) => run.attribution.sponsorObjectiveBonus === 0),
        ).toBe(true);
      } else {
        expect(
          runs.every(
            (run) => run.objectiveCount === Math.min(3, 5 - cell.division),
          ),
        ).toBe(true);
      }
      lines.push(reportLine(cell, runs));
    }

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
  });

  it('measures sponsor profile expected value without hiding monthly tradeoffs', () => {
    const lines = [
      '',
      `=== SPONSOR PROFILE EV (${SEEDS} paired seeds per profile) ===`,
      'cell                    Steady      Balanced          Bold    max spread',
    ];
    const violations: string[] = [];

    for (const cell of CELLS.filter((candidate) => candidate.division < 5)) {
      const expectedValues = profileExpectedValues(cell);
      const smallest = Math.min(...expectedValues);
      const largest = Math.max(...expectedValues);
      const spread = largest / smallest - 1;
      if (spread > 0.1) {
        violations.push(
          `D${cell.division} ${cell.difficulty} profile EV spread ${(spread * 100).toFixed(1)}% > 10%`,
        );
      }
      lines.push(
        `${`D${cell.division} ${cell.difficulty}`.padEnd(20)}` +
          expectedValues
            .map((value) => money(Math.round(value)).padStart(14))
            .join('') +
          `${`${(spread * 100).toFixed(1)}%`.padStart(14)}`,
      );
    }

    if (violations.length > 0) {
      lines.push(
        'violations:',
        ...violations.map((violation) => `- ${violation}`),
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    if (SEEDS >= 300) {
      expect(violations).toEqual([]);
    } else {
      expect(
        violations.every((violation) =>
          violation.includes('profile EV spread'),
        ),
      ).toBe(true);
    }
  });

  it('stratifies completion and expected value by objective family through D1', () => {
    const spreadViolations: string[] = [];
    const dominanceFindings: string[] = [];
    const lines = [
      '',
      `=== SPONSOR OBJECTIVE-FAMILY EV (${SEEDS} careers per profile/cell) ===`,
      'cell/profile             objective       n       met%       season EV',
    ];

    for (const cell of CELLS.filter((candidate) => candidate.division < 5)) {
      const byProfile = new Map(
        PROFILES.map((profile) => [
          profile,
          sponsorContractStrata(sample(cell, profile)),
        ]),
      );
      for (const profile of PROFILES) {
        const strata = byProfile.get(profile)!;
        for (const objectiveKind of OBJECTIVE_KINDS) {
          const contracts = strata.get(objectiveKind) ?? [];
          expect(contracts.length).toBeGreaterThan(0);
          const completion =
            contracts.filter((contract) => contract.objectiveMet).length /
            contracts.length;
          const seasonValue = mean(
            contracts.map((contract) => contract.actualSeasonValue),
          );
          lines.push(
            `${`D${cell.division} ${cell.difficulty} ${profile}`.padEnd(25)}` +
              `${objectiveKind.padEnd(15)}` +
              `${String(contracts.length).padStart(5)}` +
              `${`${(completion * 100).toFixed(1)}%`.padStart(11)}` +
              `${money(Math.round(seasonValue)).padStart(16)}`,
          );
        }
      }

      for (const objectiveKind of OBJECTIVE_KINDS) {
        const values = PROFILES.map((profile) =>
          mean(
            byProfile
              .get(profile)!
              .get(objectiveKind)!
              .map((contract) => contract.actualSeasonValue),
          ),
        );
        const spread = Math.max(...values) / Math.min(...values) - 1;
        if (spread > 0.1) {
          spreadViolations.push(
            `D${cell.division} ${cell.difficulty} ${objectiveKind} profile EV spread ${(spread * 100).toFixed(1)}% > 10%`,
          );
        }
      }

      for (const candidate of PROFILES) {
        for (const alternative of PROFILES) {
          if (candidate === alternative) continue;
          const comparisons = OBJECTIVE_KINDS.map((objectiveKind) => {
            const candidateValue = mean(
              byProfile
                .get(candidate)!
                .get(objectiveKind)!
                .map((contract) => contract.actualSeasonValue),
            );
            const alternativeValue = mean(
              byProfile
                .get(alternative)!
                .get(objectiveKind)!
                .map((contract) => contract.actualSeasonValue),
            );
            return candidateValue - alternativeValue;
          });
          if (
            comparisons.every((delta) => delta >= 0) &&
            comparisons.some((delta) => delta > 0)
          ) {
            dominanceFindings.push(
              `D${cell.division} ${cell.difficulty} ${candidate} strictly dominates ${alternative}`,
            );
          }
        }
      }
    }

    if (spreadViolations.length > 0) {
      lines.push(
        'spread violations:',
        ...spreadViolations.map((violation) => `- ${violation}`),
      );
    }
    if (dominanceFindings.length > 0) {
      lines.push(
        'dominance findings:',
        ...dominanceFindings.map((finding) => `- ${finding}`),
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    if (SEEDS >= 300) expect(spreadViolations).toEqual([]);
    if (SEEDS >= SPONSOR_DOMINANCE_APPROVAL_SEEDS) {
      expect(dominanceFindings).toEqual([]);
    } else if (SEEDS < 300) {
      // Smoke samples prove all strata are observable; only the canonical
      // cohort is large enough to judge the authored EV band.
      expect(
        [...spreadViolations, ...dominanceFindings].every(
          (violation) =>
            violation.includes('profile EV spread') ||
            violation.includes('strictly dominates'),
        ),
      ).toBe(true);
    }
  });

  it('reports the exact frozen five-division facility-sink envelope', () => {
    const lines = [
      '',
      '=== FROZEN FIVE-DIVISION FACILITY-SINK ENVELOPE ===',
      `exact added Level-2/3 sink: ${money(CLUB_BUSINESS_FACILITY_UPGRADE_UPLIFT)}`,
      'This sums one independent frozen season in each division; it is not a continuous-career pacing approval.',
      'difficulty        income p25     median        p75    sink/income p25/median/p75',
    ];

    for (const difficulty of ['COZY', 'CHAIRMAN'] as const) {
      const byDivision = ([5, 4, 3, 2, 1] as const).map((division) =>
        sample({
          division,
          difficulty,
        }),
      );
      const cumulativeIncome = Array.from({ length: SEEDS }, (_, index) =>
        byDivision.reduce(
          (total, divisionRuns) =>
            total + divisionRuns[index].attribution.totalNewIncome,
          0,
        ),
      );
      expect(
        cumulativeIncome.every(
          (value) => Number.isSafeInteger(value) && value > 0,
        ),
      ).toBe(true);
      const absorption = cumulativeIncome.map(
        (value) => (CLUB_BUSINESS_FACILITY_UPGRADE_UPLIFT / value) * 100,
      );
      lines.push(
        `${difficulty.padEnd(14)}` +
          `${money(percentile(cumulativeIncome, 0.25)).padStart(12)}` +
          `${money(percentile(cumulativeIncome, 0.5)).padStart(12)}` +
          `${money(percentile(cumulativeIncome, 0.75)).padStart(12)}` +
          `${[
            percentile(absorption, 0.25),
            percentile(absorption, 0.5),
            percentile(absorption, 0.75),
          ]
            .map((value) => `${value.toFixed(1)}%`)
            .join('/')
            .padStart(30)}`,
      );
    }

    expect(CLUB_BUSINESS_FACILITY_UPGRADE_UPLIFT).toBe(670_000);
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
  });
});

function sample(
  cell: (typeof CELLS)[number],
  profile: SponsorProfileId = 'BALANCED',
  profileBonusPercent?: number,
  profileMonthlyPercent?: number,
  profileObjectiveBonusPercent?: Partial<Record<SponsorObjectiveKind, number>>,
): ClubBusinessBalanceResult[] {
  const cacheKey = [
    cell.division,
    cell.difficulty,
    profile,
    profileBonusPercent ?? 'shipped',
    profileMonthlyPercent ?? 'shipped',
    JSON.stringify(profileObjectiveBonusPercent ?? {}),
    SEED_OFFSET,
    SEEDS,
  ].join('/');
  const cached = SAMPLE_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;
  const runs = Array.from({ length: SEEDS }, (_, index) =>
    runClubBusinessBalanceScenario({
      seed: balanceSeed(SEED_OFFSET + index),
      division: cell.division,
      difficulty: cell.difficulty,
      profile,
      ...(profileBonusPercent === undefined ? {} : { profileBonusPercent }),
      ...(profileMonthlyPercent === undefined ? {} : { profileMonthlyPercent }),
      ...(profileObjectiveBonusPercent === undefined
        ? {}
        : { profileObjectiveBonusPercent }),
    }),
  );
  SAMPLE_CACHE.set(cacheKey, runs);
  return runs;
}

function sponsorContractStrata(
  runs: readonly ClubBusinessBalanceResult[],
): Map<SponsorObjectiveKind, ClubBusinessSponsorContractResult[]> {
  const strata = new Map(
    OBJECTIVE_KINDS.map((kind) => [
      kind,
      [] as ClubBusinessSponsorContractResult[],
    ]),
  );
  for (const run of runs) {
    for (const contract of run.sponsorContracts) {
      strata.get(contract.objectiveKind)!.push(contract);
    }
  }
  return strata;
}

function profileExpectedValues(
  cell: (typeof CELLS)[number],
  boldBonusPercent?: number,
): number[] {
  return PROFILES.map((profile) => {
    const runs = sample(
      cell,
      profile,
      profile === 'BOLD' ? boldBonusPercent : undefined,
    );
    return mean(
      runs.map(
        (run) =>
          run.featureSponsorIncome + run.attribution.sponsorObjectiveBonus,
      ),
    );
  });
}

function expectedValue(runs: readonly ClubBusinessBalanceResult[]): number {
  return mean(
    runs.map(
      (run) => run.featureSponsorIncome + run.attribution.sponsorObjectiveBonus,
    ),
  );
}

function reportLine(
  cell: (typeof CELLS)[number],
  runs: readonly ClubBusinessBalanceResult[],
): string {
  const median = (pick: (run: ClubBusinessBalanceResult) => number) =>
    percentile(runs.map(pick), 0.5);
  return (
    `${`D${cell.division} ${cell.difficulty}`.padEnd(17)}` +
    `${money(median((run) => run.attribution.monthlySponsorDelta)).padStart(10)}` +
    `${money(median((run) => run.attribution.sponsorObjectiveBonus)).padStart(12)}` +
    `${money(median((run) => run.attribution.supporterGateDelta)).padStart(10)}` +
    `${money(median((run) => run.attribution.supporterMerchDelta)).padStart(10)}` +
    `${money(median((run) => run.attribution.totalNewIncome)).padStart(10)}`
  );
}

function percentile(values: readonly number[], quantile: number): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor((ordered.length - 1) * quantile)];
}

function money(value: number): string {
  return `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('en-US')}`;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Odd step gives a collision-free uint32 permutation across the allowed window. */
function balanceSeed(seedIndex: number): number {
  return (2_100_001 + Math.imul(seedIndex, 104_729)) >>> 0;
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
