/**
 * OPT-IN, production-path D5 -> completed-first-D1 probe.
 *
 * This is a current-feature cohort, not a before/after comparison. It never
 * reports historical deltas because no validated frozen pre-feature outcome
 * fixture exists for this continuous policy.
 *
 * Smoke (one seed per difficulty, the default):
 *   npm run test:probe -- src/audit/__tests__/club-business-long-career-probe.test.ts
 *
 * Sharded progression-gate runs (repeat with disjoint offset/count windows):
 *   CLUB_BUSINESS_LONG_CAREER_SEEDS=300 \
 *   CLUB_BUSINESS_LONG_CAREER_VERIFY_DETERMINISM=1 \
 *   CLUB_BUSINESS_LONG_CAREER_SEED_OFFSET=30000 \
 *   CLUB_BUSINESS_LONG_CAREER_DIFFICULTY=COZY \
 *   CLUB_BUSINESS_LONG_CAREER_SUMMARY_DIR=/tmp/club-business-long-career \
 *   npm run test:probe -- src/audit/__tests__/club-business-long-career-probe.test.ts
 *
 * Exact-coverage aggregate (the only mode that applies progression gates):
 *   CLUB_BUSINESS_LONG_CAREER_AGGREGATE=1 \
 *   CLUB_BUSINESS_LONG_CAREER_EXPECTED_SEEDS=300 \
 *   CLUB_BUSINESS_LONG_CAREER_SEED_OFFSET=30000 \
 *   CLUB_BUSINESS_LONG_CAREER_DIFFICULTY=ALL \
 *   CLUB_BUSINESS_LONG_CAREER_SUMMARY_DIR=/tmp/club-business-long-career \
 *   npm run test:probe -- src/audit/__tests__/club-business-long-career-probe.test.ts
 *
 * Use a disjoint offset/count for every shard. The reserved long-career window
 * is [30000, 40000), after accounting (0), end-to-end (10000), and facility
 * pacing (20000). CLUB_BUSINESS_LONG_CAREER_DIFFICULTY accepts ALL, COZY, or
 * CHAIRMAN. Every emitted line beginning with
 * CLUB_BUSINESS_LONG_CAREER_SHARD_JSON is a complete machine-readable shard.
 *
 * A 12-season censor is deliberately scored as position 11: failure for both
 * progression gates. Only an exact 300-per-difficulty aggregate containing
 * both COZY and CHAIRMAN applies them, after rejecting missing, extra,
 * duplicate, wrong-seed, wrong-schema, wrong-manifest, and wrong-policy shard data. Each
 * difficulty must finish its first D1 season top eight more than 50% of the
 * time, and its median gate position (including censors) must be 8 or better.
 * A shard—even a 299-seed shard—is evidence, never a standalone verdict.
 * Cash and intervention rows remain diagnostics: without a validated control
 * cohort this file never claims financial approval or invents a threshold.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { DifficultyMode, DivisionLevel } from '../../game';
import {
  CLUB_BUSINESS_LONG_CAREER_CENSOR_POSITION,
  CLUB_BUSINESS_LONG_CAREER_INPUT_HASH,
  CLUB_BUSINESS_LONG_CAREER_MAX_SEASONS,
  CLUB_BUSINESS_LONG_CAREER_POLICY,
  CLUB_BUSINESS_LONG_CAREER_POLICY_VERSION,
  runClubBusinessLongCareer,
  type ClubBusinessLongCareerResult,
} from '../club-business-long-career-harness';

const SUMMARY_SCHEMA_VERSION = 3;
const DEFAULT_SEED_OFFSET = 30_000;
const SEED_WINDOW_END = 40_000;
const PROGRESSION_GATE_SEED_COUNT = 300;
const SEED_BASE = 9_000_001;
const SEED_STEP = 104_729;
const SEED_COUNT = positiveIntegerEnv('CLUB_BUSINESS_LONG_CAREER_SEEDS', 1, 10_000);
const EXPECTED_SEED_COUNT = positiveIntegerEnv(
  'CLUB_BUSINESS_LONG_CAREER_EXPECTED_SEEDS',
  300,
  10_000,
);
const SEED_OFFSET = nonNegativeIntegerEnv(
  'CLUB_BUSINESS_LONG_CAREER_SEED_OFFSET',
  DEFAULT_SEED_OFFSET,
  SEED_WINDOW_END - 1,
);
const DIFFICULTIES = longCareerDifficulties(
  process.env.CLUB_BUSINESS_LONG_CAREER_DIFFICULTY,
);
const SUMMARY_DIR = optionalNonemptyEnv('CLUB_BUSINESS_LONG_CAREER_SUMMARY_DIR');
const AGGREGATE_MODE = booleanEnv('CLUB_BUSINESS_LONG_CAREER_AGGREGATE', false);
const VERIFY_CONTINUOUS_DETERMINISM = booleanEnv(
  'CLUB_BUSINESS_LONG_CAREER_VERIFY_DETERMINISM',
  SEED_COUNT === 1,
);

interface LongCareerShardRun {
  readonly seedIndex: number;
  readonly seed: number;
  readonly censored: boolean;
  readonly completedFirstD1: boolean;
  readonly firstD1Season?: number;
  readonly firstD1Position?: number;
  readonly firstD1GatePosition: number;
  readonly firstD1TopEight: boolean;
  readonly divisionEntrySeason: Readonly<Partial<Record<DivisionLevel, number>>>;
  readonly minimumObservedCash: number;
  readonly endingCash: number;
  readonly endingFans: number;
  readonly totalSponsorIncome: number;
  readonly totalSponsorObjectiveBonuses: number;
  readonly totalBuzzIncome: number;
  readonly totalWageExpense: number;
  readonly totalFacilityUpkeepExpense: number;
  readonly totalLoanRepaymentExpense: number;
  readonly totalOrdinaryLedgerNet: number;
  readonly totalSafetyIncome: number;
  readonly totalFacilityCapitalSpend: number;
  readonly totalDrillUpgradeSpend: number;
  readonly totalTransferSpend: number;
  readonly firstD4RecruitmentFund: number;
  readonly interventions: number;
  readonly stateFingerprint: string;
  readonly seasons: readonly {
    readonly season: number;
    readonly division: DivisionLevel;
    readonly firstSeasonInDivision: boolean;
    readonly position: number;
    readonly points: number;
    readonly endingCash: number;
    readonly endingFans: number;
    readonly sponsorIncome: number;
    readonly sponsorObjectiveBonuses: number;
    readonly buzzIncome: number;
    readonly wageExpense: number;
    readonly facilityUpkeepExpense: number;
    readonly loanRepaymentExpense: number;
    readonly ordinaryLedgerNet: number;
    readonly safetyIncome: number;
    readonly facilityCapitalSpend: number;
    readonly recruitmentEligible: boolean;
    readonly recruitmentStopReason: string;
    readonly signings: number;
  }[];
}

interface LongCareerShardAggregate {
  readonly completedFirstD1Count: number;
  readonly censorCount: number;
  readonly firstD1TopEightCount: number;
  readonly firstD1TopEightRate: number;
  readonly medianFirstD1GatePosition: number;
  readonly d5PromotionSeasonP25: number;
  readonly d5PromotionSeasonMedian: number;
  readonly d5PromotionSeasonP75: number;
  readonly endingCashP25: number;
  readonly endingCashMedian: number;
  readonly endingCashP75: number;
  readonly minimumCashP25: number;
  readonly interventionRunRate: number;
  readonly sponsorObjectiveCompletionRate: number;
  readonly buzzPrePayoutMedian: number;
  readonly buzzCapRate: number;
  readonly facilityCapitalSpendMedian: number;
  readonly totalObservedSponsorIncomeMedian: number;
  readonly totalObservedBuzzIncomeMedian: number;
  readonly totalWageExpenseMedian: number;
  readonly totalFacilityUpkeepExpenseMedian: number;
  readonly totalOrdinaryLedgerNetMedian: number;
  readonly totalSafetyIncomeMedian: number;
  readonly reachedDivisionCounts: Readonly<Record<DivisionLevel, number>>;
}

interface LongCareerShardSummary {
  readonly kind: 'club-business-long-career-shard';
  readonly schemaVersion: typeof SUMMARY_SCHEMA_VERSION;
  readonly policyVersion: typeof CLUB_BUSINESS_LONG_CAREER_POLICY_VERSION;
  readonly inputHash: typeof CLUB_BUSINESS_LONG_CAREER_INPUT_HASH;
  readonly comparison: 'CURRENT_FEATURE_ONLY';
  readonly progressionGatesApplied: false;
  readonly financialApprovalClaimed: false;
  readonly continuousDeterminismVerified: boolean;
  readonly difficulty: DifficultyMode;
  readonly seedOffset: number;
  readonly seedCount: number;
  readonly maxSeasons: number;
  readonly censorGatePosition: number;
  readonly policy: typeof CLUB_BUSINESS_LONG_CAREER_POLICY;
  readonly runs: readonly LongCareerShardRun[];
  readonly aggregate: LongCareerShardAggregate;
}

interface LongCareerAggregateDifficultySummary {
  readonly difficulty: DifficultyMode;
  readonly seedOffset: number;
  readonly seedCount: number;
  readonly completedFirstD1Count: number;
  readonly censorCount: number;
  readonly firstD1TopEightCount: number;
  readonly firstD1TopEightRate: number;
  readonly medianFirstD1GatePosition: number;
  readonly endingCashP25: number;
  readonly endingCashMedian: number;
  readonly endingCashP75: number;
  readonly minimumCashP25: number;
  readonly interventionRunRate: number;
  readonly continuousDeterminismVerified: boolean;
}

interface LongCareerAggregateSummary {
  readonly kind: 'club-business-long-career-aggregate';
  readonly schemaVersion: typeof SUMMARY_SCHEMA_VERSION;
  readonly policyVersion: typeof CLUB_BUSINESS_LONG_CAREER_POLICY_VERSION;
  readonly inputHash: typeof CLUB_BUSINESS_LONG_CAREER_INPUT_HASH;
  readonly comparison: 'CURRENT_FEATURE_ONLY';
  readonly progressionGatesApplied: boolean;
  readonly financialApprovalClaimed: false;
  readonly sourceShardCount: number;
  readonly seedOffset: number;
  readonly seedCountPerDifficulty: number;
  readonly difficulties: readonly LongCareerAggregateDifficultySummary[];
}

describe('Club Business long-career production-path probe', () => {
  if (AGGREGATE_MODE) {
    assertSeedWindow(SEED_OFFSET, EXPECTED_SEED_COUNT);
    it('validates exact shard coverage before applying first-D1 progression gates', () => {
      const aggregate = aggregateShardDirectory();
      emitAggregateSummary(aggregate);
      reportAggregate(aggregate);
      expect(aggregate.financialApprovalClaimed).toBe(false);
      if (aggregate.progressionGatesApplied) {
        expect(new Set(aggregate.difficulties.map(row => row.difficulty))).toEqual(
          new Set<DifficultyMode>(['COZY', 'CHAIRMAN']),
        );
        for (const difficulty of aggregate.difficulties) {
          expect(difficulty.continuousDeterminismVerified).toBe(true);
          // Censors are already mapped to 11 in both calculations. Never silently
          // drop an unfinished climb from either denominator.
          expect(difficulty.firstD1TopEightRate).toBeGreaterThan(0.5);
          expect(difficulty.medianFirstD1GatePosition).toBeLessThanOrEqual(8);
        }
      }
    });
  } else {
    assertSeedWindow(SEED_OFFSET, SEED_COUNT);
    it.each(DIFFICULTIES)(
      'runs continuously from D5 through the completed first D1 season on %s',
      difficulty => {
        const runs = Array.from({ length: SEED_COUNT }, (_, index) => {
          const seedIndex = SEED_OFFSET + index;
          const result = runProductionLongCareer(longCareerSeed(seedIndex), difficulty);
          assertRunContract(result, difficulty);
          if (VERIFY_CONTINUOUS_DETERMINISM
            && index === 0) {
            const replay = runProductionLongCareer(longCareerSeed(seedIndex), difficulty);
            expect(replay).toEqual(result);
          }
          return { seedIndex, result };
        });
        const summary = buildShardSummary(runs, difficulty);
        emitShardSummary(summary);
        reportShard(summary);
      },
      14_400_000,
    );
  }
});

function runProductionLongCareer(
  seed: number,
  difficulty: DifficultyMode,
): ClubBusinessLongCareerResult {
  const random = jest.spyOn(Math, 'random').mockImplementation(() => {
    throw new Error('long-career production policy called ambient random');
  });
  const now = jest.spyOn(Date, 'now').mockImplementation(() => {
    throw new Error('long-career production policy called ambient time');
  });
  try {
    return runClubBusinessLongCareer(seed, difficulty);
  } finally {
    random.mockRestore();
    now.mockRestore();
  }
}

function assertRunContract(
  run: ClubBusinessLongCareerResult,
  difficulty: DifficultyMode,
): void {
  expect(run.policyVersion).toBe(CLUB_BUSINESS_LONG_CAREER_POLICY_VERSION);
  expect(run.inputHash).toBe(CLUB_BUSINESS_LONG_CAREER_INPUT_HASH);
  expect(run.difficulty).toBe(difficulty);
  expect(run.seasons.length).toBeGreaterThan(0);
  expect(run.seasons.length).toBeLessThanOrEqual(CLUB_BUSINESS_LONG_CAREER_MAX_SEASONS);
  expect(run.completedFirstD1).toBe(!run.censored);
  expect(run.firstD1GatePosition).toBe(
    run.censored ? CLUB_BUSINESS_LONG_CAREER_CENSOR_POSITION : run.firstD1Position,
  );
  expect(run.seasons.every((season, index) => season.season === index + 1)).toBe(true);
  expect(run.seasons.every(season => (
    season.recruitment.eligible === (season.firstSeasonInDivision && season.division < 5)
  ))).toBe(true);
  expect(run.seasons.flatMap(season => season.sponsorObjectives).every(contract => (
    contract.profile === undefined || contract.profile === 'BALANCED'
  ))).toBe(true);
  expect(run.seasons.flatMap(season => season.sponsorObjectives).every(contract => (
    contract.profile === undefined || contract.objectiveMet !== undefined
  ))).toBe(true);
  expect(run.seasons[0]?.facilities.find(facility => facility.type === 'coaching-office')?.level)
    .toBeGreaterThanOrEqual(1);

  // Existing progression promises remain live rails inside this longer probe.
  const firstD4Season = run.divisionEntrySeason[4];
  if (firstD4Season !== undefined) {
    expect(run.totals.firstD4RecruitmentFund).toBe(15_000);
  }
}

function buildShardSummary(
  runs: readonly { readonly seedIndex: number; readonly result: ClubBusinessLongCareerResult }[],
  difficulty: DifficultyMode,
): LongCareerShardSummary {
  const compactRuns = runs.map(({ seedIndex, result }) => compactRun(seedIndex, result));
  const allBuzzSettlements = runs.flatMap(({ result }) => (
    result.seasons.flatMap(season => season.buzzSettlements)
  ));
  const objectives = runs.flatMap(({ result }) => (
    result.seasons.flatMap(season => season.sponsorObjectives)
  )).filter(objective => objective.objectiveMet !== undefined);
  const d5PromotionSeasons = runs.map(({ result }) => (
    result.divisionEntrySeason[4] === undefined
      ? CLUB_BUSINESS_LONG_CAREER_MAX_SEASONS + 1
      : result.divisionEntrySeason[4]! - 1
  ));
  const reachedDivisionCounts = Object.fromEntries(
    ([5, 4, 3, 2, 1] as const).map(division => [
      division,
      runs.filter(({ result }) => result.divisionEntrySeason[division] !== undefined).length,
    ]),
  ) as Record<DivisionLevel, number>;
  return {
    kind: 'club-business-long-career-shard',
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    policyVersion: CLUB_BUSINESS_LONG_CAREER_POLICY_VERSION,
    inputHash: CLUB_BUSINESS_LONG_CAREER_INPUT_HASH,
    comparison: 'CURRENT_FEATURE_ONLY',
    progressionGatesApplied: false,
    financialApprovalClaimed: false,
    continuousDeterminismVerified: VERIFY_CONTINUOUS_DETERMINISM,
    difficulty,
    seedOffset: SEED_OFFSET,
    seedCount: SEED_COUNT,
    maxSeasons: CLUB_BUSINESS_LONG_CAREER_MAX_SEASONS,
    censorGatePosition: CLUB_BUSINESS_LONG_CAREER_CENSOR_POSITION,
    policy: CLUB_BUSINESS_LONG_CAREER_POLICY,
    runs: compactRuns,
    aggregate: {
      completedFirstD1Count: compactRuns.filter(run => run.completedFirstD1).length,
      censorCount: compactRuns.filter(run => run.censored).length,
      firstD1TopEightCount: compactRuns.filter(run => run.firstD1TopEight).length,
      firstD1TopEightRate: rate(compactRuns, run => run.firstD1TopEight),
      medianFirstD1GatePosition: percentile(
        compactRuns.map(run => run.firstD1GatePosition),
        0.5,
      ),
      d5PromotionSeasonP25: percentile(d5PromotionSeasons, 0.25),
      d5PromotionSeasonMedian: percentile(d5PromotionSeasons, 0.5),
      d5PromotionSeasonP75: percentile(d5PromotionSeasons, 0.75),
      endingCashP25: percentile(compactRuns.map(run => run.endingCash), 0.25),
      endingCashMedian: percentile(compactRuns.map(run => run.endingCash), 0.5),
      endingCashP75: percentile(compactRuns.map(run => run.endingCash), 0.75),
      minimumCashP25: percentile(compactRuns.map(run => run.minimumObservedCash), 0.25),
      interventionRunRate: rate(compactRuns, run => run.interventions > 0),
      sponsorObjectiveCompletionRate: objectives.length === 0
        ? 0
        : objectives.filter(objective => objective.objectiveMet).length / objectives.length,
      buzzPrePayoutMedian: allBuzzSettlements.length === 0
        ? 0
        : percentile(allBuzzSettlements.map(settlement => settlement.prePayoutValue), 0.5),
      buzzCapRate: allBuzzSettlements.length === 0
        ? 0
        : allBuzzSettlements.filter(settlement => settlement.prePayoutValue >= 100).length
          / allBuzzSettlements.length,
      facilityCapitalSpendMedian: percentile(
        compactRuns.map(run => run.totalFacilityCapitalSpend),
        0.5,
      ),
      totalObservedSponsorIncomeMedian: percentile(
        compactRuns.map(run => run.totalSponsorIncome),
        0.5,
      ),
      totalObservedBuzzIncomeMedian: percentile(
        compactRuns.map(run => run.totalBuzzIncome),
        0.5,
      ),
      totalWageExpenseMedian: percentile(
        compactRuns.map(run => run.totalWageExpense),
        0.5,
      ),
      totalFacilityUpkeepExpenseMedian: percentile(
        compactRuns.map(run => run.totalFacilityUpkeepExpense),
        0.5,
      ),
      totalOrdinaryLedgerNetMedian: percentile(
        compactRuns.map(run => run.totalOrdinaryLedgerNet),
        0.5,
      ),
      totalSafetyIncomeMedian: percentile(
        compactRuns.map(run => run.totalSafetyIncome),
        0.5,
      ),
      reachedDivisionCounts,
    },
  };
}

function compactRun(seedIndex: number, result: ClubBusinessLongCareerResult): LongCareerShardRun {
  const interventions = result.totals.boardUltimatumsIssued
    + result.totals.boardForcedSales
    + result.totals.emergencyLoans
    + result.totals.boardRescues;
  return {
    seedIndex,
    seed: result.seed,
    censored: result.censored,
    completedFirstD1: result.completedFirstD1,
    ...(result.firstD1Season === undefined ? {} : { firstD1Season: result.firstD1Season }),
    ...(result.firstD1Position === undefined ? {} : { firstD1Position: result.firstD1Position }),
    firstD1GatePosition: result.firstD1GatePosition,
    firstD1TopEight: result.firstD1TopEight,
    divisionEntrySeason: result.divisionEntrySeason,
    minimumObservedCash: result.minimumObservedCash,
    endingCash: result.endingCash,
    endingFans: result.endingFans,
    totalSponsorIncome: result.totals.sponsorIncome,
    totalSponsorObjectiveBonuses: result.totals.sponsorObjectiveBonuses,
    totalBuzzIncome: result.totals.buzzIncome,
    totalWageExpense: result.totals.wageExpense,
    totalFacilityUpkeepExpense: result.totals.facilityUpkeepExpense,
    totalLoanRepaymentExpense: result.totals.loanRepaymentExpense,
    totalOrdinaryLedgerNet: result.totals.ordinaryLedgerNet,
    totalSafetyIncome: result.totals.safetyIncome,
    totalFacilityCapitalSpend: result.totals.facilityCapitalSpend,
    totalDrillUpgradeSpend: result.totals.drillUpgradeSpend,
    totalTransferSpend: result.totals.transferSpend,
    firstD4RecruitmentFund: result.totals.firstD4RecruitmentFund,
    interventions,
    stateFingerprint: result.finalStateFingerprint,
    seasons: result.seasons.map(season => ({
      season: season.season,
      division: season.division,
      firstSeasonInDivision: season.firstSeasonInDivision,
      position: season.position,
      points: season.points,
      endingCash: season.endingCash,
      endingFans: season.endingFans,
      sponsorIncome: season.sponsorIncome,
      sponsorObjectiveBonuses: season.sponsorObjectiveBonuses,
      buzzIncome: season.buzzIncome,
      wageExpense: season.wageExpense,
      facilityUpkeepExpense: season.facilityUpkeepExpense,
      loanRepaymentExpense: season.loanRepaymentExpense,
      ordinaryLedgerNet: season.ordinaryLedgerNet,
      safetyIncome: season.safetyIncome,
      facilityCapitalSpend: season.facilityCapitalSpend,
      recruitmentEligible: season.recruitment.eligible,
      recruitmentStopReason: season.recruitment.stopReason,
      signings: season.recruitment.signings,
    })),
  };
}

function emitShardSummary(summary: LongCareerShardSummary): void {
  // eslint-disable-next-line no-console
  console.log(`CLUB_BUSINESS_LONG_CAREER_SHARD_JSON ${JSON.stringify(summary)}`);
  if (SUMMARY_DIR === undefined) return;
  const directory = resolve(SUMMARY_DIR);
  mkdirSync(directory, { recursive: true });
  const filename = [
    'club-business-long-career',
    summary.difficulty.toLowerCase(),
    `offset-${String(summary.seedOffset).padStart(5, '0')}`,
    `count-${String(summary.seedCount).padStart(5, '0')}.json`,
  ].join('-');
  writeFileSync(join(directory, filename), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

function reportShard(summary: LongCareerShardSummary): void {
  const { aggregate } = summary;
  const lines = [
    '',
    `=== CLUB BUSINESS LONG CAREER · ${summary.difficulty}`
      + ` (${summary.seedCount} careers, offset ${summary.seedOffset}) ===`,
    'comparison: current feature only; no historical delta claimed',
    `input manifest: ${summary.inputHash}`,
    `completed first D1: ${aggregate.completedFirstD1Count}/${summary.seedCount}`
      + `  censors: ${aggregate.censorCount}`,
    `first-D1 top-8: ${percent(aggregate.firstD1TopEightRate)}`
      + `  median gate position: ${aggregate.medianFirstD1GatePosition}`,
    `D5 promotion season P25/median/P75: ${aggregate.d5PromotionSeasonP25}`
      + `/${aggregate.d5PromotionSeasonMedian}/${aggregate.d5PromotionSeasonP75}`,
    `ending cash P25/median/P75: ${aggregate.endingCashP25}`
      + `/${aggregate.endingCashMedian}/${aggregate.endingCashP75}`
      + `  minimum-cash P25: ${aggregate.minimumCashP25}`,
    `intervention run rate: ${percent(aggregate.interventionRunRate)}`
      + `  objective completion: ${percent(aggregate.sponsorObjectiveCompletionRate)}`,
    `Buzz median/cap rate: ${aggregate.buzzPrePayoutMedian}`
      + `/${percent(aggregate.buzzCapRate)}`,
    `observed medians — sponsor: ${aggregate.totalObservedSponsorIncomeMedian}`
      + `  Buzz: ${aggregate.totalObservedBuzzIncomeMedian}`
      + `  facility capital: ${aggregate.facilityCapitalSpendMedian}`,
    `cost medians — wages: ${aggregate.totalWageExpenseMedian}`
      + `  upkeep: ${aggregate.totalFacilityUpkeepExpenseMedian}`
      + `  ordinary net: ${aggregate.totalOrdinaryLedgerNetMedian}`
      + `  safety income: ${aggregate.totalSafetyIncomeMedian}`,
    `division reach: ${([5, 4, 3, 2, 1] as const)
      .map(division => `D${division} ${aggregate.reachedDivisionCounts[division]}/${summary.seedCount}`)
      .join('  ')}`,
    summary.seedCount === 1
      ? 'progression classification: SMOKE ONLY — no progression gates applied.'
      : 'progression classification: SHARD ONLY — exact two-difficulty aggregate mode applies gates.',
    'financial classification: NOT APPLIED — no validated control cohort or absolute threshold.',
    `continuous same-seed replay: ${summary.continuousDeterminismVerified ? 'VERIFIED' : 'NOT RUN'}`,
  ];
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
}

function aggregateShardDirectory(): LongCareerAggregateSummary {
  if (SUMMARY_DIR === undefined) {
    throw new Error('CLUB_BUSINESS_LONG_CAREER_SUMMARY_DIR is required in aggregate mode');
  }
  const directory = resolve(SUMMARY_DIR);
  const filenames = readdirSync(directory)
    .filter(filename => filename.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));
  if (filenames.length === 0) throw new Error(`no shard JSON files found in ${directory}`);
  const shards = filenames.map(filename => {
    const path = join(directory, filename);
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    } catch (error) {
      throw new Error(`could not parse long-career shard ${filename}`, { cause: error });
    }
    assertShardSummary(parsed, filename);
    return parsed;
  });

  const expectedDifficulties = new Set(DIFFICULTIES);
  const runByDifficulty = new Map<DifficultyMode, Map<number, LongCareerShardRun>>(
    DIFFICULTIES.map(difficulty => [difficulty, new Map()]),
  );
  const expectedEnd = SEED_OFFSET + EXPECTED_SEED_COUNT;
  for (const shard of shards) {
    if (!expectedDifficulties.has(shard.difficulty)) {
      throw new Error(`unexpected ${shard.difficulty} shard in aggregate directory`);
    }
    const runs = runByDifficulty.get(shard.difficulty)!;
    for (const run of shard.runs) {
      if (run.seedIndex < SEED_OFFSET || run.seedIndex >= expectedEnd) {
        throw new Error(
          `extra ${shard.difficulty} seed index ${run.seedIndex}; expected`
          + ` [${SEED_OFFSET}, ${expectedEnd})`,
        );
      }
      if (runs.has(run.seedIndex)) {
        throw new Error(`duplicate ${shard.difficulty} seed index ${run.seedIndex}`);
      }
      runs.set(run.seedIndex, run);
    }
  }

  const difficulties = DIFFICULTIES.map(difficulty => {
    const byIndex = runByDifficulty.get(difficulty)!;
    const missing: number[] = [];
    for (let seedIndex = SEED_OFFSET; seedIndex < expectedEnd; seedIndex += 1) {
      if (!byIndex.has(seedIndex)) missing.push(seedIndex);
    }
    if (missing.length > 0) {
      throw new Error(
        `missing ${difficulty} seed coverage: ${missing.slice(0, 10).join(', ')}`
        + (missing.length > 10 ? ` (+${missing.length - 10} more)` : ''),
      );
    }
    if (byIndex.size !== EXPECTED_SEED_COUNT) {
      throw new Error(
        `${difficulty} aggregate has ${byIndex.size} runs; expected ${EXPECTED_SEED_COUNT}`,
      );
    }
    const runs = [...byIndex.values()].sort((left, right) => left.seedIndex - right.seedIndex);
    return {
      difficulty,
      seedOffset: SEED_OFFSET,
      seedCount: EXPECTED_SEED_COUNT,
      completedFirstD1Count: runs.filter(run => run.completedFirstD1).length,
      censorCount: runs.filter(run => run.censored).length,
      firstD1TopEightCount: runs.filter(run => run.firstD1TopEight).length,
      firstD1TopEightRate: rate(runs, run => run.firstD1TopEight),
      medianFirstD1GatePosition: percentile(
        runs.map(run => run.firstD1GatePosition),
        0.5,
      ),
      endingCashP25: percentile(runs.map(run => run.endingCash), 0.25),
      endingCashMedian: percentile(runs.map(run => run.endingCash), 0.5),
      endingCashP75: percentile(runs.map(run => run.endingCash), 0.75),
      minimumCashP25: percentile(runs.map(run => run.minimumObservedCash), 0.25),
      interventionRunRate: rate(runs, run => run.interventions > 0),
      continuousDeterminismVerified: shards.some(shard => (
        shard.difficulty === difficulty && shard.continuousDeterminismVerified
      )),
    };
  });

  const hasBothDifficulties = difficulties.length === 2
    && difficulties.some(row => row.difficulty === 'COZY')
    && difficulties.some(row => row.difficulty === 'CHAIRMAN');
  const hasBothDeterminismProofs = difficulties.length === 2
    && difficulties.every(row => row.continuousDeterminismVerified);
  return {
    kind: 'club-business-long-career-aggregate',
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    policyVersion: CLUB_BUSINESS_LONG_CAREER_POLICY_VERSION,
    inputHash: CLUB_BUSINESS_LONG_CAREER_INPUT_HASH,
    comparison: 'CURRENT_FEATURE_ONLY',
    progressionGatesApplied: EXPECTED_SEED_COUNT === PROGRESSION_GATE_SEED_COUNT
      && hasBothDifficulties
      && hasBothDeterminismProofs,
    financialApprovalClaimed: false,
    sourceShardCount: shards.length,
    seedOffset: SEED_OFFSET,
    seedCountPerDifficulty: EXPECTED_SEED_COUNT,
    difficulties,
  };
}

function assertShardSummary(
  value: unknown,
  filename: string,
): asserts value is LongCareerShardSummary {
  if (!isRecord(value)) throw new Error(`${filename} is not a shard object`);
  if (value.kind !== 'club-business-long-career-shard') {
    throw new Error(`${filename} is an unexpected JSON file, not a long-career shard`);
  }
  if (value.schemaVersion !== SUMMARY_SCHEMA_VERSION) {
    throw new Error(`${filename} has wrong schema version ${String(value.schemaVersion)}`);
  }
  if (value.policyVersion !== CLUB_BUSINESS_LONG_CAREER_POLICY_VERSION) {
    throw new Error(`${filename} has wrong policy version ${String(value.policyVersion)}`);
  }
  if (value.inputHash !== CLUB_BUSINESS_LONG_CAREER_INPUT_HASH) {
    throw new Error(
      `${filename} has wrong input manifest ${String(value.inputHash)}; expected`
      + ` ${CLUB_BUSINESS_LONG_CAREER_INPUT_HASH}`,
    );
  }
  if (value.comparison !== 'CURRENT_FEATURE_ONLY') {
    throw new Error(`${filename} makes an unsupported comparison claim`);
  }
  if (value.progressionGatesApplied !== false) {
    throw new Error(`${filename} incorrectly claims to apply progression gates`);
  }
  if (value.financialApprovalClaimed !== false) {
    throw new Error(`${filename} incorrectly claims financial approval`);
  }
  if (typeof value.continuousDeterminismVerified !== 'boolean') {
    throw new Error(`${filename} has malformed determinism evidence`);
  }
  if (value.maxSeasons !== CLUB_BUSINESS_LONG_CAREER_MAX_SEASONS) {
    throw new Error(`${filename} has wrong season censor ${String(value.maxSeasons)}`);
  }
  if (value.censorGatePosition !== CLUB_BUSINESS_LONG_CAREER_CENSOR_POSITION) {
    throw new Error(`${filename} has wrong censor gate position`);
  }
  if (JSON.stringify(value.policy) !== JSON.stringify(CLUB_BUSINESS_LONG_CAREER_POLICY)) {
    throw new Error(`${filename} does not use the locked production policy`);
  }
  if (value.difficulty !== 'COZY' && value.difficulty !== 'CHAIRMAN') {
    throw new Error(`${filename} has invalid difficulty ${String(value.difficulty)}`);
  }
  if (!Number.isSafeInteger(value.seedOffset) || (value.seedOffset as number) < 0) {
    throw new Error(`${filename} has invalid seed offset`);
  }
  if (!Number.isSafeInteger(value.seedCount) || (value.seedCount as number) <= 0) {
    throw new Error(`${filename} has invalid seed count`);
  }
  if (!Array.isArray(value.runs) || value.runs.length !== value.seedCount) {
    throw new Error(`${filename} run count does not match its declared seed count`);
  }
  for (let index = 0; index < value.runs.length; index += 1) {
    const run = value.runs[index];
    if (!isRecord(run)) throw new Error(`${filename} run ${index} is not an object`);
    const expectedIndex = (value.seedOffset as number) + index;
    if (run.seedIndex !== expectedIndex) {
      throw new Error(`${filename} run ${index} has non-contiguous seed index ${String(run.seedIndex)}`);
    }
    if (run.seed !== longCareerSeed(expectedIndex)) {
      throw new Error(`${filename} seed index ${expectedIndex} has the wrong deterministic seed`);
    }
    if (typeof run.censored !== 'boolean'
      || typeof run.completedFirstD1 !== 'boolean'
      || typeof run.firstD1TopEight !== 'boolean'
      || !Number.isSafeInteger(run.firstD1GatePosition)) {
      throw new Error(`${filename} seed index ${expectedIndex} has malformed gate fields`);
    }
    if (run.censored) {
      if (run.completedFirstD1
        || run.firstD1TopEight
        || run.firstD1GatePosition !== CLUB_BUSINESS_LONG_CAREER_CENSOR_POSITION) {
        throw new Error(`${filename} seed index ${expectedIndex} does not score its censor as failure`);
      }
    } else {
      if (!run.completedFirstD1 || !Number.isSafeInteger(run.firstD1Position)) {
        throw new Error(`${filename} seed index ${expectedIndex} lacks a completed first-D1 result`);
      }
      if (run.firstD1GatePosition !== run.firstD1Position
        || run.firstD1TopEight !== ((run.firstD1Position as number) <= 8)) {
        throw new Error(`${filename} seed index ${expectedIndex} has inconsistent first-D1 gates`);
      }
    }
  }
}

function emitAggregateSummary(summary: LongCareerAggregateSummary): void {
  // eslint-disable-next-line no-console
  console.log(`CLUB_BUSINESS_LONG_CAREER_AGGREGATE_JSON ${JSON.stringify(summary)}`);
}

function reportAggregate(summary: LongCareerAggregateSummary): void {
  const lines = [
    '',
    `=== CLUB BUSINESS LONG CAREER · EXACT AGGREGATE (${summary.sourceShardCount} shards) ===`,
    `coverage: [${summary.seedOffset}, ${summary.seedOffset + summary.seedCountPerDifficulty})`
      + ` exactly ${summary.seedCountPerDifficulty} careers per difficulty`,
    'comparison: current feature only; no historical delta claimed',
    `input manifest: ${summary.inputHash}`,
    ...summary.difficulties.map(difficulty => (
      `${difficulty.difficulty}: completed ${difficulty.completedFirstD1Count}/${difficulty.seedCount}`
      + `  censors ${difficulty.censorCount}`
      + `  top-8 ${percent(difficulty.firstD1TopEightRate)}`
      + `  median gate position ${difficulty.medianFirstD1GatePosition}`
      + `  cash P25/median/P75 ${difficulty.endingCashP25}`
      + `/${difficulty.endingCashMedian}/${difficulty.endingCashP75}`
      + `  minimum-cash P25 ${difficulty.minimumCashP25}`
      + `  intervention runs ${percent(difficulty.interventionRunRate)}`
      + `  deterministic replay ${difficulty.continuousDeterminismVerified ? 'verified' : 'missing'}`
    )),
    summary.progressionGatesApplied
      ? 'progression classification: EXACT 300 × BOTH DIFFICULTIES + REPLAYS VERIFIED — progression gates applied.'
      : `progression classification: DIAGNOSTIC ONLY — gates require exactly ${PROGRESSION_GATE_SEED_COUNT} careers and a continuous replay proof in both COZY and CHAIRMAN.`,
    'financial classification: NOT APPLIED — cash/intervention rows are diagnostic until matched to a validated control.',
  ];
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function longCareerSeed(seedIndex: number): number {
  return (SEED_BASE + Math.imul(seedIndex, SEED_STEP)) >>> 0;
}

function assertSeedWindow(offset: number, count: number): void {
  if (offset < DEFAULT_SEED_OFFSET || offset + count > SEED_WINDOW_END) {
    throw new Error(
      `long-career seed window [${offset}, ${offset + count}) must stay within`
      + ` [${DEFAULT_SEED_OFFSET}, ${SEED_WINDOW_END})`,
    );
  }
}

function percentile(values: readonly number[], quantile: number): number {
  if (values.length === 0) throw new Error('cannot take a percentile of an empty cohort');
  const sorted = [...values].sort((left, right) => left - right);
  const rank = (sorted.length - 1) * quantile;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
}

function rate<T>(values: readonly T[], predicate: (value: T) => boolean): number {
  return values.filter(predicate).length / values.length;
}

function percent(value: number): string {
  return `${Math.round(value * 1_000) / 10}%`;
}

function positiveIntegerEnv(name: string, fallback: number, maximum: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum) {
    throw new Error(`${name} must be no greater than ${maximum}`);
  }
  return value;
}

function nonNegativeIntegerEnv(
  name: string,
  fallback: number,
  maximum: number,
): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a non-negative integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum) {
    throw new Error(`${name} must be no greater than ${maximum}`);
  }
  return value;
}

function optionalNonemptyEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (value.length === 0) throw new Error(`${name} must not be empty`);
  return value;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (raw === '1') return true;
  if (raw === '0') return false;
  throw new Error(`${name} must be 0 or 1`);
}

function longCareerDifficulties(raw: string | undefined): readonly DifficultyMode[] {
  if (raw === undefined || raw === 'ALL') return ['COZY', 'CHAIRMAN'];
  if (raw === 'COZY' || raw === 'CHAIRMAN') return [raw];
  throw new Error('CLUB_BUSINESS_LONG_CAREER_DIFFICULTY must be ALL, COZY, or CHAIRMAN');
}
