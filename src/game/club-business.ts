import type {
  AppliedSupporterImpactSummary,
  ClubBusinessState,
  PendingUserMatchImpact,
  SponsorshipState,
  SupporterBusinessState,
  SupporterWeekSummary,
} from './club-business-types';

interface AppliedSupporterWeek {
  readonly supporters: SupporterBusinessState;
  readonly fanCount: number;
  /** Positive deltas still need to pass through `recordFanGain` at integration. */
  readonly positiveFanGain: number;
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
}): ClubBusinessState {
  requirePositiveInteger(options.season, 'season');
  return {
    supporters: { consecutiveLosses: 0 },
    pendingUserMatchImpacts: [],
    sponsorship: createEmptySponsorshipState(options.season),
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
