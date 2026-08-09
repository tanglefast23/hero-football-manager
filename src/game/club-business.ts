import type {
  AppliedSupporterImpactSummary,
  BuzzMatchSummary,
  BuzzSettlementSummary,
  BuzzState,
  ClubBusinessState,
  PendingUserMatchImpact,
  SponsorshipState,
  SupporterBusinessState,
  SupporterWeekSummary,
} from './club-business-types';

export const MAX_BUZZ = 100;
export const BUZZ_UNLOCK_SEASON = 3;
/** Win contribution calibrated against two disjoint 300-seed cohorts. */
export const BUZZ_WIN_POINTS = 4;

interface AppliedSupporterWeek {
  readonly supporters: SupporterBusinessState;
  readonly fanCount: number;
  /** Positive deltas still need to pass through `recordFanGain` at integration. */
  readonly positiveFanGain: number;
}

interface AppliedBuzzWeek {
  readonly buzz: BuzzState;
  readonly payout?: {
    readonly amount: number;
    readonly half: 1 | 2;
    readonly idempotencyKey: string;
    readonly label: string;
    readonly labelKey: string;
  };
}

function createEmptySponsorshipState(season: number): SponsorshipState {
  requirePositiveInteger(season, 'portfolio season');
  return {
    activeContracts: [],
    offers: [],
    portfolioSeason: season,
  };
}

export function createClubBusinessState(options: {
  readonly season: number;
  readonly week?: number;
  readonly phase?: 'manage' | 'matchday' | 'season-end' | 'complete';
  readonly settledLedgerWeeks?: readonly number[];
}): ClubBusinessState {
  requirePositiveInteger(options.season, 'season');
  const week = options.week ?? 1;
  requirePositiveInteger(week, 'week');
  return {
    supporters: { consecutiveLosses: 0 },
    pendingUserMatchImpacts: [],
    sponsorship: createEmptySponsorshipState(options.season),
    buzz: migratedEmptyBuzzState({
      season: options.season,
      week,
      phase: options.phase ?? 'manage',
      settledLedgerWeeks: options.settledLedgerWeeks ?? [],
    }),
  };
}

/**
 * Applies match effects in their persisted league-then-Cup order. Attendance
 * has already been calculated when this runs, so the returned count is only
 * for future weeks.
 */
export function applySupporterImpacts(
  state: SupporterBusinessState,
  currentFans: number,
  impacts: readonly PendingUserMatchImpact[],
  season: number,
  week: number,
): AppliedSupporterWeek {
  requireNonnegativeInteger(currentFans, 'supporter count');
  requirePositiveInteger(season, 'season');
  requirePositiveInteger(week, 'week');
  assertUniqueOrderedImpacts(impacts);

  let consecutiveLosses = state.consecutiveLosses;
  let fanCount = currentFans;
  let positiveFanGain = 0;
  const summaries: AppliedSupporterImpactSummary[] = [];

  for (const impact of impacts) {
    validateImpactComponents(impact);
    const heroDelta = impact.supporterHeroUnits;
    let resultDelta = 0;
    let realizedDelta = heroDelta;

    if (impact.outcome === 'LOSS') {
      consecutiveLosses += 1;
      if (consecutiveLosses >= 3) {
        const penaltyUnits =
          consecutiveLosses === 3 ? 3 : consecutiveLosses === 4 ? 4 : 5;
        resultDelta = -penaltyUnits * impact.divisionScale;
        // Even four heroes cannot make sustained losing look like growth.
        realizedDelta = Math.min(
          -impact.divisionScale,
          resultDelta + heroDelta,
        );
      }
    } else {
      consecutiveLosses = 0;
      if (impact.outcome === 'WIN') resultDelta = impact.supporterWinUnits;
      realizedDelta = resultDelta + heroDelta;
    }

    const before = fanCount;
    fanCount = Math.max(0, fanCount + realizedDelta);
    const boundedDelta = fanCount - before;
    if (boundedDelta > 0) positiveFanGain += boundedDelta;
    summaries.push({
      fixtureId: impact.fixtureId,
      outcome: impact.outcome,
      streakAfter: consecutiveLosses,
      resultDelta,
      heroDelta,
      realizedDelta: boundedDelta,
    });
  }

  const summary: SupporterWeekSummary | undefined =
    impacts.length === 0
      ? state.lastAppliedImpact
      : {
          season,
          week,
          before: currentFans,
          after: fanCount,
          totalDelta: fanCount - currentFans,
          impacts: summaries,
        };
  return {
    supporters: {
      consecutiveLosses,
      ...(summary === undefined ? {} : { lastAppliedImpact: summary }),
    },
    fanCount,
    positiveFanGain,
  };
}

/** Applies current matches before a Week 15/30 settlement, then resets on pay. */
export function applyBuzzImpacts(
  state: BuzzState,
  impacts: readonly PendingUserMatchImpact[],
  season: number,
  week: number,
  actualMonthlySponsorIncome: number,
): AppliedBuzzWeek {
  requirePositiveInteger(season, 'season');
  requirePositiveInteger(week, 'week');
  requireNonnegativeInteger(
    actualMonthlySponsorIncome,
    'actual monthly sponsor income',
  );
  requireNonnegativeInteger(state.value, 'Buzz');
  if (state.value > MAX_BUZZ) throw new Error(`Buzz cannot exceed ${MAX_BUZZ}`);
  assertUniqueOrderedImpacts(impacts);

  if (season < BUZZ_UNLOCK_SEASON) return { buzz: state };

  const summaries = impacts.map(buzzSummaryForImpact);
  const rawEarned = summaries.reduce(
    (sum, summary) => sum + summary.rawEarned,
    0,
  );
  const before = state.value;
  const prePayoutValue = Math.min(MAX_BUZZ, before + rawEarned);
  const realizedEarned = prePayoutValue - before;
  const half = week === 15 ? 1 : week === 30 ? 2 : undefined;

  if (half === undefined) {
    return { buzz: { ...state, value: prePayoutValue } };
  }
  if (state.lastSettledSeason === season && state.lastSettledHalf === half) {
    // The final settlement owns consumption. Seeing the same boundary again is
    // a retry of an already-consumed period, never a new payday.
    return { buzz: state };
  }

  const payout = Math.round(
    (actualMonthlySponsorIncome * prePayoutValue) / MAX_BUZZ,
  );
  const lastSettlementSummary: BuzzSettlementSummary = {
    season,
    half,
    before,
    rawEarned,
    realizedEarned,
    prePayoutValue,
    payout,
    resetValue: 0,
    impacts: summaries,
  };
  return {
    buzz: {
      value: 0,
      lastSettledSeason: season,
      lastSettledHalf: half,
      lastSettlementSummary,
    },
    payout: {
      amount: payout,
      half,
      idempotencyKey: `buzz/${season}/half-${half}`,
      // Dual-written like every other ledger line: the English is the save
      // fallback, the key is what a translated statement renders.
      label:
        half === 1 ? 'Buzz payout · First half' : 'Buzz payout · Season end',
      labelKey:
        half === 1
          ? 'ledger.buzzPayoutFirstHalf'
          : 'ledger.buzzPayoutSeasonEnd',
    },
  };
}

/**
 * Migration never invents historic Buzz. Ledger presence decides whether a
 * boundary has already been consumed; no cash or presentation summary is made.
 */
export function migratedEmptyBuzzState(options: {
  readonly season: number;
  readonly week: number;
  readonly phase: 'manage' | 'matchday' | 'season-end' | 'complete';
  readonly settledLedgerWeeks: readonly number[];
}): BuzzState {
  requirePositiveInteger(options.season, 'season');
  requirePositiveInteger(options.week, 'week');
  if (options.season < BUZZ_UNLOCK_SEASON) return { value: 0 };

  const settled = new Set(options.settledLedgerWeeks);
  if (options.week < 15 || (options.week === 15 && !settled.has(15))) {
    return {
      value: 0,
      lastSettledSeason: options.season - 1,
      lastSettledHalf: 2,
    };
  }
  if (
    options.week < 30 ||
    (options.week === 30 &&
      !settled.has(30) &&
      options.phase !== 'season-end' &&
      options.phase !== 'complete')
  ) {
    return { value: 0, lastSettledSeason: options.season, lastSettledHalf: 1 };
  }
  return { value: 0, lastSettledSeason: options.season, lastSettledHalf: 2 };
}

function buzzSummaryForImpact(
  impact: PendingUserMatchImpact,
): BuzzMatchSummary {
  validateImpactComponents(impact);
  const rawEarned = impact.buzzWin + impact.buzzGoals + impact.buzzHeroMoments;
  return {
    fixtureId: impact.fixtureId,
    win: impact.buzzWin,
    goals: impact.buzzGoals,
    heroMoments: impact.buzzHeroMoments,
    rawEarned,
  };
}

function validateImpactComponents(impact: PendingUserMatchImpact): void {
  requirePositiveInteger(
    impact.divisionScale,
    `${impact.fixtureId} division scale`,
  );
  requireNonnegativeInteger(
    impact.supporterWinUnits,
    `${impact.fixtureId} supporter win`,
  );
  requireNonnegativeInteger(
    impact.supporterHeroUnits,
    `${impact.fixtureId} supporter heroes`,
  );
  requireNonnegativeInteger(impact.buzzWin, `${impact.fixtureId} Buzz win`);
  requireNonnegativeInteger(impact.buzzGoals, `${impact.fixtureId} Buzz goals`);
  requireNonnegativeInteger(
    impact.buzzHeroMoments,
    `${impact.fixtureId} Buzz heroes`,
  );
}

function assertUniqueOrderedImpacts(
  impacts: readonly PendingUserMatchImpact[],
): void {
  const ids = new Set<string>();
  let previousOrder = -1;
  for (const impact of impacts) {
    if (ids.has(impact.fixtureId))
      throw new Error(`duplicate match impact ${impact.fixtureId}`);
    if (impact.settlementOrder < previousOrder) {
      throw new Error('match impacts must settle league before Cup');
    }
    ids.add(impact.fixtureId);
    previousOrder = impact.settlementOrder;
  }
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${label} must be a positive safe integer`);
}

function requireNonnegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${label} must be a nonnegative safe integer`);
}
