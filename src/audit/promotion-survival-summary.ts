import type { DifficultyMode } from '../game';

export const PROMOTION_SURVIVAL_SUMMARY_VERSION = 1;
export const PROMOTION_SURVIVAL_SEED_BASE = 9_000_001;
export const PROMOTION_SURVIVAL_SEED_STEP = 104_729;

const UINT32_MAX = 0xffff_ffff;

export interface PromotionSurvivalOutcomeSummary {
  readonly completed: boolean;
  readonly played: number;
  readonly position: number;
  readonly points: number;
  readonly endingCash: number;
}

export interface PromotionSurvivalPreparedOutcomeSummary extends PromotionSurvivalOutcomeSummary {
  readonly recruitmentResolved: boolean;
  readonly signed: boolean;
}

export interface PromotionSurvivalRunSummary {
  /** Zero-based index in the one canonical deterministic seed stream. */
  readonly seedIndex: number;
  readonly seed: number;
  readonly promotedInSeason: number;
  readonly prepared: PromotionSurvivalPreparedOutcomeSummary;
  readonly control: PromotionSurvivalOutcomeSummary;
}

export interface PromotionSurvivalShardSummary {
  readonly kind: 'promotion-survival-shard';
  readonly schemaVersion: typeof PROMOTION_SURVIVAL_SUMMARY_VERSION;
  readonly difficulty: DifficultyMode;
  readonly seedOffset: number;
  readonly seedCount: number;
  readonly throughWeek: number;
  readonly runs: readonly PromotionSurvivalRunSummary[];
}

export interface PromotionSurvivalAggregateCell {
  readonly difficulty: DifficultyMode;
  readonly seedCount: number;
  readonly seedIndexStart: number;
  readonly seedIndexEnd: number;
  readonly promotedWithinTwo: number;
  readonly recruitmentResolved: number;
  readonly signed: number;
  readonly preparedSurvived: number;
  readonly controlSurvived: number;
  readonly preparedSurvivalRate: number;
  readonly controlSurvivalRate: number;
  readonly medianPreparedPosition: number;
  readonly preparedPositionHistogram: Readonly<Record<string, number>>;
  readonly preparedCash: {
    readonly p25: number;
    readonly median: number;
    readonly p75: number;
  };
  readonly controlCash: {
    readonly p25: number;
    readonly median: number;
    readonly p75: number;
  };
}

export interface PromotionSurvivalAggregateSummary {
  readonly kind: 'promotion-survival-aggregate';
  readonly schemaVersion: typeof PROMOTION_SURVIVAL_SUMMARY_VERSION;
  readonly throughWeek: number;
  readonly expectedSeedCount: number;
  readonly cells: readonly PromotionSurvivalAggregateCell[];
}

export function promotionSurvivalSeed(seedIndex: number): number {
  requireNonnegativeInteger(seedIndex, 'promotion survival seed index');
  const seed =
    PROMOTION_SURVIVAL_SEED_BASE + seedIndex * PROMOTION_SURVIVAL_SEED_STEP;
  if (!Number.isSafeInteger(seed) || seed > UINT32_MAX) {
    throw new Error(
      `promotion survival seed index ${seedIndex} exceeds the uint32 seed stream`,
    );
  }
  return seed;
}

export function assertPromotionSurvivalSeedWindow(
  seedOffset: number,
  seedCount: number,
): void {
  requireNonnegativeInteger(seedOffset, 'promotion survival seed offset');
  requirePositiveInteger(seedCount, 'promotion survival seed count');
  promotionSurvivalSeed(seedOffset);
  promotionSurvivalSeed(seedOffset + seedCount - 1);
}

export function parsePromotionSurvivalShardSummary(
  value: unknown,
): PromotionSurvivalShardSummary {
  if (
    !isRecord(value) ||
    value.kind !== 'promotion-survival-shard' ||
    value.schemaVersion !== PROMOTION_SURVIVAL_SUMMARY_VERSION
  ) {
    throw new Error(
      'promotion survival summary has an unsupported kind or schema version',
    );
  }
  const difficulty = parseDifficulty(value.difficulty);
  const seedOffset = value.seedOffset;
  const seedCount = value.seedCount;
  const throughWeek = value.throughWeek;
  requireNonnegativeInteger(
    seedOffset,
    'promotion survival summary seed offset',
  );
  requirePositiveInteger(seedCount, 'promotion survival summary seed count');
  requirePositiveInteger(throughWeek, 'promotion survival summary week');
  assertPromotionSurvivalSeedWindow(seedOffset, seedCount);
  if (!Array.isArray(value.runs) || value.runs.length !== seedCount) {
    throw new Error(
      'promotion survival summary run count does not match its seed count',
    );
  }
  const runs = value.runs.map((run, index) =>
    parseRun(run, seedOffset + index),
  );
  return {
    kind: 'promotion-survival-shard',
    schemaVersion: PROMOTION_SURVIVAL_SUMMARY_VERSION,
    difficulty,
    seedOffset,
    seedCount,
    throughWeek,
    runs,
  };
}

export function aggregatePromotionSurvivalShards(
  input: readonly PromotionSurvivalShardSummary[],
  options: {
    readonly expectedDifficulties: readonly DifficultyMode[];
    readonly expectedSeedCount: number;
    readonly expectedSeedOffset?: number;
    readonly throughWeek?: number;
  },
): PromotionSurvivalAggregateSummary {
  requirePositiveInteger(
    options.expectedSeedCount,
    'expected promotion survival seed count',
  );
  const expectedSeedOffset = options.expectedSeedOffset ?? 0;
  const throughWeek = options.throughWeek ?? 30;
  assertPromotionSurvivalSeedWindow(
    expectedSeedOffset,
    options.expectedSeedCount,
  );
  requirePositiveInteger(throughWeek, 'expected promotion survival week');
  const expectedDifficulties = uniqueDifficulties(options.expectedDifficulties);
  const unexpected = input.filter(
    (summary) => !expectedDifficulties.includes(summary.difficulty),
  );
  if (unexpected.length > 0) {
    throw new Error(
      `unexpected promotion survival difficulty ${unexpected[0].difficulty}`,
    );
  }

  const cells = expectedDifficulties.map((difficulty) =>
    aggregateDifficulty(
      input.filter((summary) => summary.difficulty === difficulty),
      difficulty,
      expectedSeedOffset,
      options.expectedSeedCount,
      throughWeek,
    ),
  );
  return {
    kind: 'promotion-survival-aggregate',
    schemaVersion: PROMOTION_SURVIVAL_SUMMARY_VERSION,
    throughWeek,
    expectedSeedCount: options.expectedSeedCount,
    cells,
  };
}

function aggregateDifficulty(
  summaries: readonly PromotionSurvivalShardSummary[],
  difficulty: DifficultyMode,
  expectedSeedOffset: number,
  expectedSeedCount: number,
  throughWeek: number,
): PromotionSurvivalAggregateCell {
  if (summaries.length === 0) {
    throw new Error(`missing promotion survival summaries for ${difficulty}`);
  }
  const runsByIndex = new Map<number, PromotionSurvivalRunSummary>();
  for (const raw of summaries) {
    const summary = parsePromotionSurvivalShardSummary(raw);
    if (summary.difficulty !== difficulty) {
      throw new Error(
        `promotion survival summary changed difficulty during validation`,
      );
    }
    if (summary.throughWeek !== throughWeek) {
      throw new Error(
        `${difficulty} promotion survival shard stopped at Week ${summary.throughWeek}; expected ${throughWeek}`,
      );
    }
    for (const run of summary.runs) {
      if (runsByIndex.has(run.seedIndex)) {
        throw new Error(
          `${difficulty} promotion survival seed index ${run.seedIndex} is duplicated`,
        );
      }
      runsByIndex.set(run.seedIndex, run);
    }
  }

  const expectedIndices = Array.from(
    { length: expectedSeedCount },
    (_, index) => expectedSeedOffset + index,
  );
  const missing = expectedIndices.filter(
    (seedIndex) => !runsByIndex.has(seedIndex),
  );
  const extra = [...runsByIndex.keys()].filter(
    (seedIndex) =>
      seedIndex < expectedSeedOffset ||
      seedIndex >= expectedSeedOffset + expectedSeedCount,
  );
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${difficulty} promotion survival seed coverage is not the exact contiguous range` +
        ` ${expectedSeedOffset}-${expectedSeedOffset + expectedSeedCount - 1}` +
        ` (missing ${missing.slice(0, 5).join(',') || 'none'}; extra ${extra.slice(0, 5).join(',') || 'none'})`,
    );
  }
  const runs = expectedIndices.map((seedIndex) => runsByIndex.get(seedIndex)!);
  const notPromoted = runs.filter((run) => run.promotedInSeason > 2);
  if (notPromoted.length > 0) {
    throw new Error(
      `${difficulty} has ${notPromoted.length} careers that did not promote within two seasons`,
    );
  }
  const incomplete = runs.filter(
    (run) =>
      !run.prepared.completed ||
      !run.control.completed ||
      run.prepared.played !== 18 ||
      run.control.played !== 18,
  );
  if (incomplete.length > 0) {
    throw new Error(
      `${difficulty} has ${incomplete.length} incomplete D4 paired careers`,
    );
  }
  const unresolved = runs.filter((run) => !run.prepared.recruitmentResolved);
  if (unresolved.length > 0) {
    throw new Error(
      `${difficulty} has ${unresolved.length} unresolved recruitment windows`,
    );
  }

  const signed = runs.filter((run) => run.prepared.signed).length;
  if (signed === 0)
    throw new Error(`${difficulty} completed no prepared signing`);
  const preparedSurvived = runs.filter(
    (run) => run.prepared.position <= 8,
  ).length;
  const controlSurvived = runs.filter(
    (run) => run.control.position <= 8,
  ).length;
  const positions = runs.map((run) => run.prepared.position);
  const medianPreparedPosition = median(positions);
  if (preparedSurvived / runs.length <= 0.5) {
    throw new Error(`${difficulty} prepared D4 survival is not above 50%`);
  }
  if (medianPreparedPosition > 8) {
    throw new Error(
      `${difficulty} prepared median D4 position ${medianPreparedPosition} is below the survival line`,
    );
  }

  return {
    difficulty,
    seedCount: runs.length,
    seedIndexStart: expectedSeedOffset,
    seedIndexEnd: expectedSeedOffset + expectedSeedCount - 1,
    promotedWithinTwo: runs.length - notPromoted.length,
    recruitmentResolved: runs.length - unresolved.length,
    signed,
    preparedSurvived,
    controlSurvived,
    preparedSurvivalRate: preparedSurvived / runs.length,
    controlSurvivalRate: controlSurvived / runs.length,
    medianPreparedPosition,
    preparedPositionHistogram: histogram(positions),
    preparedCash: distribution(runs.map((run) => run.prepared.endingCash)),
    controlCash: distribution(runs.map((run) => run.control.endingCash)),
  };
}

function parseRun(
  value: unknown,
  expectedSeedIndex: number,
): PromotionSurvivalRunSummary {
  if (!isRecord(value))
    throw new Error('promotion survival run must be an object');
  requireNonnegativeInteger(
    value.seedIndex,
    'promotion survival run seed index',
  );
  if (value.seedIndex !== expectedSeedIndex) {
    throw new Error(
      `promotion survival shard is not contiguous: expected seed index ${expectedSeedIndex}, received ${value.seedIndex}`,
    );
  }
  requireNonnegativeInteger(value.seed, 'promotion survival run seed');
  if (value.seed !== promotionSurvivalSeed(value.seedIndex)) {
    throw new Error(
      `promotion survival seed ${value.seed} does not match index ${value.seedIndex}`,
    );
  }
  requirePositiveInteger(
    value.promotedInSeason,
    'promotion survival promotion season',
  );
  return {
    seedIndex: value.seedIndex,
    seed: value.seed,
    promotedInSeason: value.promotedInSeason,
    prepared: parsePreparedOutcome(value.prepared),
    control: parseOutcome(value.control, 'control'),
  };
}

function parsePreparedOutcome(
  value: unknown,
): PromotionSurvivalPreparedOutcomeSummary {
  if (
    !isRecord(value) ||
    typeof value.recruitmentResolved !== 'boolean' ||
    typeof value.signed !== 'boolean'
  ) {
    throw new Error('prepared promotion survival outcome is malformed');
  }
  return {
    ...parseOutcome(value, 'prepared'),
    recruitmentResolved: value.recruitmentResolved,
    signed: value.signed,
  };
}

function parseOutcome(
  value: unknown,
  label: string,
): PromotionSurvivalOutcomeSummary {
  if (!isRecord(value) || typeof value.completed !== 'boolean') {
    throw new Error(`${label} promotion survival outcome is malformed`);
  }
  requireNonnegativeInteger(value.played, `${label} matches played`);
  requirePositiveInteger(value.position, `${label} league position`);
  requireNonnegativeInteger(value.points, `${label} league points`);
  requireSafeInteger(value.endingCash, `${label} ending cash`);
  return {
    completed: value.completed,
    played: value.played,
    position: value.position,
    points: value.points,
    endingCash: value.endingCash,
  };
}

function parseDifficulty(value: unknown): DifficultyMode {
  if (value !== 'COZY' && value !== 'CHAIRMAN') {
    throw new Error(`unknown promotion survival difficulty ${String(value)}`);
  }
  return value;
}

function uniqueDifficulties(
  values: readonly DifficultyMode[],
): DifficultyMode[] {
  if (values.length === 0)
    throw new Error(
      'expected promotion survival difficulties must not be empty',
    );
  const unique = [...new Set(values.map(parseDifficulty))];
  if (unique.length !== values.length) {
    throw new Error('expected promotion survival difficulties must be unique');
  }
  return unique;
}

function distribution(values: readonly number[]): {
  p25: number;
  median: number;
  p75: number;
} {
  return {
    p25: percentile(values, 0.25),
    median: median(values),
    p75: percentile(values, 0.75),
  };
}

function histogram(values: readonly number[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values)
    counts[String(value)] = (counts[String(value)] ?? 0) + 1;
  return Object.fromEntries(
    Object.entries(counts).sort(
      (left, right) => Number(left[0]) - Number(right[0]),
    ),
  );
}

function percentile(values: readonly number[], quantile: number): number {
  if (values.length === 0)
    throw new Error(
      'cannot calculate an empty promotion survival distribution',
    );
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor((ordered.length - 1) * quantile)];
}

function median(values: readonly number[]): number {
  if (values.length === 0)
    throw new Error('cannot calculate an empty promotion survival median');
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requirePositiveInteger(
  value: unknown,
  label: string,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function requireNonnegativeInteger(
  value: unknown,
  label: string,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a nonnegative safe integer`);
  }
}

function requireSafeInteger(
  value: unknown,
  label: string,
): asserts value is number {
  if (!Number.isSafeInteger(value))
    throw new Error(`${label} must be a safe integer`);
}
