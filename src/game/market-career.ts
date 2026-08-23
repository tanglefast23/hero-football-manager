import { compareIds } from './ordering';
import { PROMOTION_WAGE_CLAUSE_PERCENT } from './contract-wages';

// The window rule is career-facing: the UI has to explain a shut desk, not just
// be refused by it. Re-exported here so the game barrel carries it alongside
// the transfer calls it gates.
export { isTransferWindowOpen } from './market';

import {
  buyingTransferQuote,
  CAREER_CLUB_FAME_CEILING,
  COACH_WAGE_PER_LEVEL,
  generatedPlayerWeeklyWage,
  generateCoachMarket,
  isCoachCandidateEligible,
  isTransferWindowOpen,
  MAX_RENEWAL_ASK_MULTIPLE,
  renewalContractAsk,
  renewalFamePercent,
  resolveScoutMission,
  scoutMissionFeeWaived,
  sellingTransferQuote,
  startContractNegotiation,
  startScoutMission,
  submitContractOffer,
  type CoachCandidate,
  type ContractNegotiation,
  type ContractOffer,
  type PitchCard,
  type PlayerPersonality as MarketPersonality,
  type ScoutFocus,
  type ScoutMission,
  type ScoutRegion,
  type ScoutReport,
  type ScoutablePlayer,
  type TransferQuote,
} from './market';
import type { CareerPlayer, GameState, PlayerPersonality } from './types';
import {
  developmentPotentialCeiling,
  potentialTierForDivision,
  roleOverall,
} from './archetype-caps';
import { recordCashTransaction } from './cash-transactions';
import {
  LOYALTY_NO_RENEWAL_THRESHOLD,
  loyaltyRenewalPercent,
  playerLoyalty,
  willRenegotiate,
} from './loyalty';
import { isFacilityOperational } from './facilities';
import { isAvailableForSelection } from './lineup';
import { cancelPendingPlayerRequestIfInvalid } from './player-requests';
import {
  clubSquadStrength,
  currentUserDivision,
  synchronizeM2ActiveDivision,
} from './m2-career';
import { generatedClubHeroCount, generatedClubPower } from './power-catalog';
import {
  SPECIAL_UNATTACHED_CLUB_ID,
  isSpecialHeroId,
  scoutOnlySpecialHeroes,
  specialHeroAttrs,
  specialHeroTargetOverall,
  type SpecialHero,
} from './special-heroes';
import {
  DIVISION_STRENGTH_BANDS,
  type DivisionLevel,
  type PyramidClub,
  type PyramidPlayer,
} from './pyramid';
import { assertContractTermFitsCareer } from './retirement';
import { assertUserCareerRosterSpace } from './youth-intake';
import { isStoryScoutingUnlocked } from './story-progression';
import {
  applyCareerContractPromise,
  ContractPromiseBlockedError,
  careerContractPromiseBlockedReason,
  careerContractPromiseHeroLimit,
  clearCareerContractPromise,
  heroLicenseReclaimRequired,
  reclaimableHeroLicenseHolders,
} from './contract-promises';
import {
  clearMetBoardUltimatum,
  reconcileBoardUltimatumCandidates,
} from './board-ultimatum';
import { highestDivisionReached } from './promotion-progression';

const DEFAULT_COACH_CONTENT_UNLOCK_IDS = ['formation:4-3-3'] as const;

export type CareerCoachRole = 'HEAD' | 'ASSISTANT';

const ASSISTANT_COACH_WAGE_PERCENT = 50;

/** The candidate quote is the head-coach wage; assistants are half price. */
export function coachWeeklyWageForRole(
  coach: Pick<CoachCandidate, 'weeklyWage'>,
  role: CareerCoachRole,
): number {
  if (!Number.isSafeInteger(coach.weeklyWage) || coach.weeklyWage < 0) {
    throw new Error('coach weekly wage must be a nonnegative safe integer');
  }
  return role === 'HEAD'
    ? coach.weeklyWage
    : Math.round((coach.weeklyWage * ASSISTANT_COACH_WAGE_PERCENT) / 100);
}

interface CareerTransferBid {
  readonly id: string;
  readonly playerId: string;
  readonly buyerClubId: string;
  readonly quote: TransferQuote;
  readonly madeSeason: number;
  readonly madeWeek: number;
}

interface CareerTransferListing {
  readonly playerId: string;
  readonly listedSeason: number;
  readonly listedWeek: number;
  readonly bids: readonly CareerTransferBid[];
}

interface CareerTransferTalks {
  readonly playerId: string;
  readonly transferQuote: TransferQuote;
  readonly negotiation: ContractNegotiation;
  readonly consequenceApplied?: boolean;
}

interface CareerRenewalTalks {
  readonly playerId: string;
  readonly negotiation: ContractNegotiation;
  readonly consequenceApplied?: boolean;
}

export interface DetailedScoutReportMission {
  readonly playerId: string;
  readonly dueWeek: number;
  readonly cost: number;
}

/** Plain M2 market state designed to live inside a schema-versioned career save. */
export interface CareerMarketState {
  readonly nextMissionNumber: number;
  readonly activeScoutMission?: ScoutMission;
  /** The active first mission was covered by the scout's one-time favor. */
  readonly activeScoutMissionFeeWaived?: boolean;
  readonly scoutReports: readonly ScoutReport[];
  readonly detailedScoutReport?: DetailedScoutReportMission;
  readonly coachCandidates: readonly CoachCandidate[];
  readonly headCoach?: CoachCandidate;
  readonly headCoachSeasonsEmployed?: number;
  readonly assistantCoach?: CoachCandidate;
  readonly assistantCoachSeasonsEmployed?: number;
  readonly unlockedCoachContentIds?: readonly string[];
  readonly transferListings?: readonly CareerTransferListing[];
  /** Story adjustments to the selling club's asking fee for scouted targets. */
  readonly transferFeeAdjustments?: readonly {
    readonly playerId: string;
    readonly percent: number;
  }[];
  /** Persistent reputation changes that are not owned by any one player. */
  readonly clubFameAdjustment?: number;
  readonly transferTalks?: CareerTransferTalks;
  readonly renewalTalks?: CareerRenewalTalks;
  /**
   * Negotiation ids closed without a signing this week. The pitch-card deck is
   * dealt from the week-stable negotiation id, so without this record closing
   * and reopening talks replayed the same deck at round 0 — retrying away the
   * three-round cap. Ids embed season+week, so stale entries never match.
   */
  readonly abandonedTransferNegotiationIds?: readonly string[];
  /**
   * The same record for renewals, which need it more: a renewal id is stable
   * for the whole season, so reopening replayed one deterministic deck until it
   * yielded the cheapest accepted wage — the hero wage cliff, negotiated away.
   */
  readonly abandonedRenewalNegotiationIds?: readonly string[];
}

interface CareerMarketTransaction {
  readonly state: GameState;
  readonly market: CareerMarketState;
}

interface CareerTransferTarget {
  readonly player: CareerPlayer;
  readonly sellingClubDivision: number;
  readonly active: boolean;
}

export function applyCareerNegotiationConsequence(
  state: GameState,
  market: CareerMarketState,
  kind: 'transfer' | 'renewal',
): CareerMarketTransaction {
  const talks =
    kind === 'transfer' ? market.transferTalks : market.renewalTalks;
  const consequence = talks?.negotiation.consequence;
  if (
    talks === undefined ||
    consequence === undefined ||
    talks.consequenceApplied === true
  ) {
    return { state, market };
  }
  // A renewal is talks with the club's OWN player, and `careerTransferTarget`
  // deliberately skips the user's club — it exists to find someone to buy. Used
  // for both kinds it threw `unknown negotiation player <yourPlayer>` the moment
  // a renewal produced a consequence, which is exactly when an insulting offer
  // had just been made and the morale hit was owed. The transfer path shares
  // this function and was always correct, which is why no test caught it.
  const target =
    kind === 'renewal'
      ? careerSquadNegotiationTarget(state, talks.playerId)
      : careerTransferTarget(state, talks.playerId);
  if (target === undefined)
    throw new Error(`unknown negotiation player ${talks.playerId}`);
  const nextMorale = Math.max(
    0,
    Math.min(100, target.player.morale + consequence.moraleDelta),
  );
  const nextState = target.active
    ? {
        ...state,
        players: state.players.map((candidate) =>
          candidate.id === target.player.id
            ? { ...candidate, morale: nextMorale }
            : candidate,
        ),
      }
    : updatePyramidPlayerMorale(state, target.player.id, nextMorale);
  const nextTalks = { ...talks, consequenceApplied: true };
  return {
    state: nextState,
    market: {
      ...market,
      clubFameAdjustment: checkedAdd(
        market.clubFameAdjustment ?? 0,
        consequence.clubFameDelta,
        'club fame adjustment',
      ),
      ...(kind === 'transfer'
        ? { transferTalks: nextTalks as CareerTransferTalks }
        : { renewalTalks: nextTalks as CareerRenewalTalks }),
    },
  };
}

export function createCareerMarketState(
  state: GameState,
  division = 5,
  clubFame = 0,
  excludedPortraitIds: readonly string[] = [],
  coachUnlockIds: readonly string[] = DEFAULT_COACH_CONTENT_UNLOCK_IDS,
): CareerMarketState {
  return {
    nextMissionNumber: 1,
    scoutReports: [],
    unlockedCoachContentIds: [],
    coachCandidates: generateCoachMarket({
      careerSeed: state.careerSeed,
      season: state.season,
      division,
      fame: clubFame,
      excludedPortraitIds,
      unlockIds: coachUnlockIds,
    }),
  };
}

export function startCareerScoutMission(
  state: GameState,
  market: CareerMarketState,
  region: ScoutRegion,
  focus: ScoutFocus,
  division = 5,
  unlockedDivision = division,
): CareerMarketTransaction {
  assertManagePhase(state);
  if (!isStoryScoutingUnlocked(state)) {
    throw new Error('Scouting unlocks in Week 15 of the first season');
  }
  if (market.activeScoutMission !== undefined) {
    throw new Error('only one scouting mission may run at a time');
  }
  const mission = startScoutMission({
    careerSeed: state.careerSeed,
    missionId: `scout-${market.nextMissionNumber}`,
    startWeek: absoluteCareerWeek(state),
    region,
    focus,
    scoutOfficeLevel: scoutOfficeLevel(state),
    division,
    unlockedDivision,
    starterScores: Object.fromEntries(
      (['GK', 'DEF', 'MID', 'FWD'] as const).map((role) => [
        role,
        Math.max(
          0,
          ...state.players
            .filter(
              (player) =>
                player.clubId === state.userClubId && player.role === role,
            )
            .map((player) => roleOverall(role, player.attrs)),
        ),
      ]),
    ),
  });
  const club = userClub(state);
  const feeWaived = scoutMissionFeeWaived(
    region,
    club.cash,
    market.nextMissionNumber === 1,
  );
  if (club.cash < mission.cost && !feeWaived) {
    throw new Error('the scouting mission is not affordable');
  }
  const chargedState: GameState = feeWaived
    ? state
    : {
        ...state,
        clubs: state.clubs.map((candidate) =>
          candidate.id === state.userClubId
            ? { ...candidate, cash: candidate.cash - mission.cost }
            : candidate,
        ),
      };
  const transactionState = feeWaived
    ? chargedState
    : recordCashTransaction(chargedState, {
        kind: 'scouting',
        label: `Scouting mission · ${readableRegion(region)}`,
        labelKey: 'cashTransaction.scoutingMission',
        labelParams: {
          region: readableRegion(region),
          regionKey: REGION_NAME_KEYS[region],
        },
        amount: -mission.cost,
        referenceId: mission.id,
      });
  return {
    state: transactionState,
    market: {
      ...market,
      nextMissionNumber: market.nextMissionNumber + 1,
      activeScoutMission: mission,
      activeScoutMissionFeeWaived: feeWaived || undefined,
    },
  };
}

export function resolveCareerScoutClock(
  state: GameState,
  market: CareerMarketState,
): CareerMarketState {
  let currentMarket = expireCareerScoutReports(
    state,
    expireCareerTransferTalks(
      state,
      expireCareerTransferListings(state, market),
    ),
  );
  // New missions return full details immediately. Upgrade old fuzzy reports
  // on load too, so an existing career never sees the retired second step.
  if (
    currentMarket.detailedScoutReport !== undefined ||
    currentMarket.scoutReports.some(
      (report) =>
        report.potentialRange.minimum !== report.potentialRange.maximum ||
        Object.values(report.statRanges).some(
          (range) => range.minimum !== range.maximum,
        ),
    )
  ) {
    currentMarket = {
      ...currentMarket,
      detailedScoutReport: undefined,
      scoutReports: currentMarket.scoutReports.map((report) => {
        const target = careerTransferTarget(state, report.playerId);
        if (target === undefined) return report;
        return {
          ...report,
          statRanges: Object.fromEntries(
            Object.entries(target.player.attrs).map(([attribute, value]) => [
              attribute,
              { minimum: value, maximum: value },
            ]),
          ) as ScoutReport['statRanges'],
          potentialRange: {
            minimum: target.player.potential ?? 3,
            maximum: target.player.potential ?? 3,
          },
        };
      }),
    };
  }
  const mission = currentMarket.activeScoutMission;
  if (mission === undefined || absoluteCareerWeek(state) < mission.dueWeek)
    return currentMarket;
  const candidates = scoutableCareerPlayers(state);
  const shortlistSize = scoutShortlistSize(mission.scoutOfficeLevel);
  // Quotes are memoised because `withAffordableSlot` reads every eligible
  // candidate's fee, and a quote walks the pyramid to find the selling club.
  const quoted = new Map<string, number>();
  const result = resolveScoutMission(
    mission,
    absoluteCareerWeek(state),
    candidates,
    shortlistSize,
    {
      budget: userClub(state).cash,
      feeOf: (playerId) => {
        const cached = quoted.get(playerId);
        if (cached !== undefined) return cached;
        const fee = careerBuyingTransferQuote(
          state,
          currentMarket,
          playerId,
        ).fee;
        quoted.set(playerId, fee);
        return fee;
      },
    },
  );
  const completed = result.reports.map((report) => ({
    ...report,
    completedSeason: state.season,
    completedWeek: state.week,
  }));
  const newIds = new Set(completed.map((report) => report.playerId));
  return {
    ...currentMarket,
    activeScoutMission: undefined,
    activeScoutMissionFeeWaived: undefined,
    scoutReports: [
      ...currentMarket.scoutReports.filter(
        (report) => !newIds.has(report.playerId),
      ),
      ...completed,
    ],
  };
}

export function expireCareerScoutReports(
  state: Pick<GameState, 'season' | 'week' | 'phase'>,
  market: CareerMarketState,
): CareerMarketState {
  const reports = market.scoutReports.filter((report) => {
    if (
      report.completedSeason === undefined ||
      report.completedWeek === undefined
    )
      return false;
    if (report.completedSeason !== state.season) return false;
    if (report.completedWeek <= 4) return state.week < 5;
    if (report.completedWeek <= 18) return state.week < 19;
    return state.phase !== 'season-end' && state.phase !== 'complete';
  });
  const reportIds = new Set(reports.map((report) => report.playerId));
  const detail = market.detailedScoutReport;
  if (
    reports.length === market.scoutReports.length &&
    (detail === undefined || reportIds.has(detail.playerId))
  ) {
    return market;
  }
  return {
    ...market,
    scoutReports: reports,
    ...(detail === undefined || reportIds.has(detail.playerId)
      ? {}
      : { detailedScoutReport: undefined }),
  };
}

export function dismissCareerScoutReport(
  market: CareerMarketState,
  playerId: string,
): CareerMarketState {
  if (market.transferTalks?.playerId === playerId)
    throw new Error('close transfer talks before dismissing this report');
  if (!market.scoutReports.some((report) => report.playerId === playerId))
    throw new Error('the scouting report is no longer available');
  return {
    ...market,
    scoutReports: market.scoutReports.filter(
      (report) => report.playerId !== playerId,
    ),
    ...(market.detailedScoutReport?.playerId === playerId
      ? { detailedScoutReport: undefined }
      : {}),
  };
}

export function detailedScoutReportCost(division: number): number {
  if (![1, 2, 3, 4, 5].includes(division)) throw new Error('unknown division');
  return ({ 5: 2500, 4: 4000, 3: 6000, 2: 8000, 1: 10000 } as const)[
    division as 1 | 2 | 3 | 4 | 5
  ];
}

export function startDetailedScoutReport(
  state: GameState,
  market: CareerMarketState,
  playerId: string,
  division = 5,
): CareerMarketTransaction {
  assertManagePhase(state);
  if (market.detailedScoutReport !== undefined)
    throw new Error('only one detailed report may run at a time');
  const report = market.scoutReports.find(
    (candidate) => candidate.playerId === playerId,
  );
  if (report === undefined)
    throw new Error('the scouting report is unavailable');
  const reportIsExact =
    report.potentialRange.minimum === report.potentialRange.maximum &&
    Object.values(report.statRanges).every(
      (range) => range.minimum === range.maximum,
    );
  if (reportIsExact)
    throw new Error('this report already confirms exact player details');
  const officeLevel = scoutOfficeLevel(state);
  const duration = officeLevel >= 2 ? 1 : 2;
  if (!reportSurvivesUntil(state, report, duration))
    throw new Error('the transfer window closes before this report can finish');
  const cost = detailedScoutReportCost(division);
  const club = userClub(state);
  if (club.cash < cost)
    throw new Error('the detailed report is not affordable');
  const charged = recordCashTransaction(
    {
      ...state,
      clubs: state.clubs.map((candidate) =>
        candidate.id === state.userClubId
          ? { ...candidate, cash: candidate.cash - cost }
          : candidate,
      ),
    },
    {
      kind: 'scouting',
      label: 'Detailed scouting report',
      labelKey: 'cashTransaction.detailedScoutReport',
      amount: -cost,
      referenceId: `scout-detail-${playerId}-s${state.season}-w${state.week}`,
    },
  );
  return {
    state: charged,
    market: {
      ...market,
      detailedScoutReport: {
        playerId,
        dueWeek: absoluteCareerWeek(state) + duration,
        cost,
      },
    },
  };
}

export function reportSurvivesUntil(
  state: Pick<GameState, 'season' | 'week'>,
  report: ScoutReport,
  durationWeeks: number,
): boolean {
  if (
    report.completedSeason !== state.season ||
    report.completedWeek === undefined
  )
    return false;
  const expiryWeek =
    report.completedWeek <= 4 ? 5 : report.completedWeek <= 18 ? 19 : 30;
  return state.week + durationWeeks < expiryWeek;
}

/** Removes saved bids once they are too old or the buying club can no longer honour them. */
export function expireCareerTransferListings(
  state: Pick<GameState, 'season' | 'week' | 'clubs'>,
  market: CareerMarketState,
): CareerMarketState {
  const listings = market.transferListings ?? [];
  const cashByClub = new Map(state.clubs.map((club) => [club.id, club.cash]));
  const active = listings
    .filter((listing) => listingIsCurrent(state, listing))
    .map((listing) => ({
      ...listing,
      bids: listing.bids.filter(
        (bid) => (cashByClub.get(bid.buyerClubId) ?? 0) >= bid.quote.fee,
      ),
    }));
  if (
    active.length === listings.length &&
    active.every(
      (listing, index) => listing.bids.length === listings[index].bids.length,
    )
  )
    return market;
  return { ...market, transferListings: active };
}

/**
 * Drops transfer talks whose registration window has closed, exactly as
 * `expireCareerTransferListings` drops saved bids. The quote and the negotiated
 * wage were both rolled from the week talks opened, so window-1 talks completing
 * in the mid-season window would sign at pre-season prices.
 */
function expireCareerTransferTalks(
  state: Pick<GameState, 'season' | 'week'>,
  market: CareerMarketState,
): CareerMarketState {
  const talks = market.transferTalks;
  if (talks === undefined || talksBelongToCurrentWindow(state, talks))
    return market;
  return { ...market, transferTalks: undefined };
}

/** The opening week is embedded in the negotiation id, so the quote's window is recoverable. */
function talksBelongToCurrentWindow(
  state: Pick<GameState, 'season' | 'week'>,
  talks: CareerTransferTalks,
): boolean {
  const opened = /^transfer-s(\d+)-w(\d+)-/.exec(talks.negotiation.id);
  if (opened === null) return false;
  if (state.season !== Number(opened[1])) return false;
  const window = transferWindowNumber(state.week);
  return (
    window !== undefined && window === transferWindowNumber(Number(opened[2]))
  );
}

function transferNegotiationId(state: GameState, playerId: string): string {
  return `transfer-s${state.season}-w${state.week}-${playerId}`;
}

/** Season-stable: one renewal conversation per player per season. */
function renewalNegotiationId(state: GameState, playerId: string): string {
  return `renewal-s${state.season}-${playerId}`;
}

/**
 * Closes talks and records the abandoned negotiation id. The single-active
 * guard in `beginCareerTransferTalks` only blocks concurrent talks; without
 * this record, closing and reopening the same week re-dealt the identical
 * deterministic deck at round 0, retrying away the three-round cap and the
 * walk-away penalty.
 */
export function closeCareerTransferTalks(
  state: GameState,
  market: CareerMarketState,
): CareerMarketState {
  const talks = market.transferTalks;
  if (talks === undefined) return market;
  const weekPrefix = `transfer-s${state.season}-w${state.week}-`;
  return {
    ...market,
    transferTalks: undefined,
    abandonedTransferNegotiationIds: [
      ...(market.abandonedTransferNegotiationIds ?? []).filter((id) =>
        id.startsWith(weekPrefix),
      ),
      talks.negotiation.id,
    ],
  };
}

export function beginCareerTransferTalks(
  state: GameState,
  market: CareerMarketState,
  playerId: string,
  division = 5,
): CareerMarketState {
  assertManagePhase(state);
  if (!isTransferWindowOpen(state.week))
    throw new Error('the transfer window is closed');
  // Matches the renewal guard. Without it, closing a rejected negotiation and
  // reopening it dealt the same deterministic pitch cards at round 0, so the
  // three-round cap and the walk-away penalty could both be retried away.
  if (market.transferTalks !== undefined)
    throw new Error('another transfer is already being negotiated');
  if (
    (market.abandonedTransferNegotiationIds ?? []).includes(
      transferNegotiationId(state, playerId),
    )
  ) {
    throw new Error(
      'That agent has ended talks for this week. Try again next week.',
    );
  }
  if (!market.scoutReports.some((report) => report.playerId === playerId)) {
    throw new Error('a player must be scouted before transfer talks');
  }
  const target = careerTransferTarget(state, playerId, division);
  if (target === undefined) {
    throw new Error(`unknown transfer target ${playerId}`);
  }
  const player = target.player;
  if (!sellerCanSpare(state, playerId)) {
    throw new Error(
      `${player.name}'s club has no other cover for that position and will not sell.`,
    );
  }
  const quote = careerBuyingTransferQuote(state, market, playerId, division);
  const weeklyAsk = Math.max(
    1,
    Math.round(player.weeklyWage * (player.power ? 3.5 : 1.2)),
  );
  return {
    ...market,
    transferTalks: {
      playerId,
      transferQuote: quote,
      negotiation: startContractNegotiation({
        careerSeed: state.careerSeed,
        negotiationId: transferNegotiationId(state, playerId),
        playerId,
        personality: marketPersonality(player.personality),
        weeklyAsk,
      }),
    },
  };
}

export function submitCareerTransferOffer(
  state: GameState,
  market: CareerMarketState,
  offer: ContractOffer,
  pitchCard?: PitchCard,
  heroLimit?: number,
): CareerMarketState {
  if (market.transferTalks === undefined)
    throw new Error('there are no active transfer talks');
  // The same guard the renewal path runs, for the same reason: without it
  // `applyCareerContractPromise` is the first thing to notice an impossible
  // promise, and by then the agent has accepted -- so `guarded()` discards a
  // signed deal and the panel reads "Round 1 of 3" as though nothing happened.
  // Reachable on the normal path, because the draft's default perk is
  // GUARANTEED_STARTER: buying any hero with the Hero Licence cap full does it.
  const target = careerTransferTarget(state, market.transferTalks.playerId);
  if (target !== undefined) {
    const cap = heroLimit ?? careerContractPromiseHeroLimit(state);
    const blocked = careerContractPromiseBlockedReason(
      state,
      target.player,
      offer.perk,
      cap,
    );
    if (blocked !== undefined) throw new ContractPromiseBlockedError(blocked);
    assertHeroLicenseReclaimChoice(state, target.player, offer, cap);
  }
  return {
    ...market,
    transferTalks: {
      ...market.transferTalks,
      negotiation: submitContractOffer(
        market.transferTalks.negotiation,
        offer,
        pitchCard,
      ),
    },
  };
}

export function completeCareerTransfer(
  state: GameState,
  market: CareerMarketState,
): CareerMarketTransaction {
  assertManagePhase(state);
  if (!isTransferWindowOpen(state.week))
    throw new Error('the transfer window is closed');
  const talks = market.transferTalks;
  if (
    talks?.negotiation.status !== 'ACCEPTED' ||
    talks.negotiation.acceptedOffer === undefined
  ) {
    throw new Error('a transfer requires an accepted player contract');
  }
  // Belt over the weekly expiry clock: a stale save could still hand this a
  // deal priced in an earlier window.
  if (!talksBelongToCurrentWindow(state, talks)) {
    throw new Error(
      'these talks expired with their transfer window; reopen them at the current price',
    );
  }
  const target = careerTransferTarget(state, talks.playerId);
  if (target === undefined) {
    throw new Error(`unknown transfer target ${talks.playerId}`);
  }
  const player = target.player;
  // Re-checked at completion: another purchase between opening talks and
  // signing can take the club's remaining cover for this position.
  if (!sellerCanSpare(state, player.id)) {
    throw new Error(
      `${player.name}'s club has no other cover for that position and will not sell.`,
    );
  }
  assertUserCareerRosterSpace(state);
  const buyer = userClub(state);
  if (buyer.cash < talks.transferQuote.fee)
    throw new Error('the transfer fee is not affordable');
  const offer = talks.negotiation.acceptedOffer;
  const sellerClubId = player.clubId;
  const lineups = target.active
    ? replaceTransferredStarter(state, player)
    : state.lineups;
  assertContractTermFitsCareer(
    player,
    offer.termSeasons,
    state.careerSeed,
    'signing',
  );
  const transferred: CareerPlayer = {
    ...player,
    clubId: state.userClubId,
    weeklyWage: offer.weeklyWage,
    promotionWagePercent: PROMOTION_WAGE_CLAUSE_PERCENT,
    contractSeasonsRemaining: offer.termSeasons,
    licensed: false,
    onHeroWage: player.power !== undefined,
    morale: Math.max(55, player.morale),
    signingStatTotal: playerStatTotal(player),
    // Loyalty does not transfer. Inheriting the selling club's tenure let a
    // one-season signing retire as a club legend, which is meant to take five.
    seasonsAtClub: 0,
  };
  const transferredState: GameState = {
    ...state,
    clubs: state.clubs.map((club) => {
      if (club.id === state.userClubId) {
        return {
          ...club,
          cash: club.cash - talks.transferQuote.fee,
          weeklyWages: checkedAdd(
            club.weeklyWages,
            offer.weeklyWage,
            'buyer weekly wages',
          ),
        };
      }
      if (club.id === sellerClubId) {
        return {
          ...club,
          cash: checkedAdd(club.cash, talks.transferQuote.fee, 'seller cash'),
          weeklyWages: checkedSubtract(
            club.weeklyWages,
            player.weeklyWage,
            'seller weekly wages',
          ),
        };
      }
      return club;
    }),
    players: target.active
      ? state.players.map((candidate) =>
          candidate.id === player.id ? transferred : candidate,
        )
      : [...state.players, transferred],
    lineups,
  };
  const persistedState = persistCareerTransferInPyramid(
    transferredState,
    player,
  );
  const recordedState = recordCashTransaction(persistedState, {
    kind: 'transfer-buy',
    label: `Signed ${player.name}`,
    labelKey: 'cashTransaction.signedPlayer',
    labelParams: { player: player.name },
    amount: -talks.transferQuote.fee,
    referenceId: player.id,
  });
  return {
    state: applyCareerContractPromise(
      recordedState,
      player.id,
      offer.perk,
      undefined,
      offer.reclaimHeroLicenseFromPlayerId,
    ),
    market: {
      ...market,
      scoutReports: market.scoutReports.filter(
        (report) => report.playerId !== player.id,
      ),
      ...(market.detailedScoutReport?.playerId === player.id
        ? { detailedScoutReport: undefined }
        : {}),
      transferFeeAdjustments: (market.transferFeeAdjustments ?? []).filter(
        (adjustment) => adjustment.playerId !== player.id,
      ),
      transferTalks: undefined,
    },
  };
}

/**
 * Refuses an offer whose Hero License arrangement cannot be carried out.
 *
 * Both negotiation paths check it here, at submit, for the same reason the
 * promise itself is checked here: an offer the agent accepts must always be
 * completable, or `guarded()` throws away a signed deal and the panel resets as
 * though the manager never spoke.
 */
function assertHeroLicenseReclaimChoice(
  state: GameState,
  player: CareerPlayer,
  offer: ContractOffer,
  heroLimit: number,
): void {
  const required = heroLicenseReclaimRequired(
    state,
    player,
    offer.perk,
    heroLimit,
  );
  if (!required) return;
  const holders = reclaimableHeroLicenseHolders(state, player);
  const chosen = holders.find(
    (candidate) => candidate.id === offer.reclaimHeroLicenseFromPlayerId,
  );
  if (chosen !== undefined) return;
  throw new ContractPromiseBlockedError({
    text: `No Hero License is free. Choose the hero who gives one up for ${player.name}.`,
    key: 'market.promiseNeedsHeroLicenseChoice',
    params: { player: player.name },
  });
}

/** The hero premium a renewal prices at. Doc 06 allows 3-5; renewals use the midpoint. */
export const RENEWAL_HERO_MULTIPLIER = 4;

const RENEWAL_DIVISION_PREMIUM_PERCENT: Readonly<
  Record<DivisionLevel, number>
> = {
  1: 145,
  2: 130,
  3: 115,
  4: 100,
  5: 100,
};

/**
 * The agent's opening weekly ask for an expired contract.
 *
 * Extracted from `beginCareerRenewalTalks` so the season-end card can state the
 * real number *before* talks open. It used to show `renewalQuote(player, 4)` —
 * the wage times four and nothing else — which measured 13-24% under the true
 * ask on ordinary squads and 61% under on a grown hero. That is the one number
 * the manager reads to decide renew-versus-release, and it changed the moment
 * they tapped the button.
 *
 * One function, two call sites: the quote on the card and the ask the agent
 * actually opens with can no longer drift apart.
 *
 * The base the multipliers price off is the greater of the player's last wage
 * and what he would cost on the open market TODAY.
 *
 * `renewalContractAsk` is a pure product of multipliers on the player's OWN
 * last wage — growth, fame, loyalty, personality — with a ceiling and no
 * floor. For anyone under about 100 fame that product is below 1, so every
 * renewal is a pay cut, and the next one is a multiple of the cut. Measured on
 * the negotiation the panel itself teaches: a launch reserve on 129 a week
 * walks 129 -> 75 -> 44 -> 26 -> 15 -> 9 -> 5 -> 3 -> 2 -> 1 in ten renewals,
 * and the wage bill is the economy's main sink.
 *
 * Anchoring the BASE rather than clamping the ask is what keeps the rest of
 * the design intact: every multiplier still applies, so loyalty and
 * personality still move the price the way the player card promises, and the
 * `MAX_RENEWAL_ASK_MULTIPLE` ceiling still governs the top. `state.m2` is
 * absent only on pre-M2 saves, which are all in the bottom division.
 */
export function careerRenewalWeeklyAsk(
  state: GameState,
  player: CareerPlayer,
): number {
  const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
  const marketWage = generatedPlayerWeeklyWage(player.attrs, division);
  const ask = renewalContractAsk(
    {
      weeklyWage: Math.max(player.weeklyWage, marketWage),
      personality: marketPersonality(player.personality),
      ...(player.power === undefined ? {} : { power: player.power }),
      onHeroWage: player.onHeroWage,
    },
    {
      growthSinceSigningPercent: growthSinceSigningPercent(player),
      famePercent: renewalFamePercent(player.fame ?? 0),
      heroMultiplier: RENEWAL_HERO_MULTIPLIER,
      loyaltyPercent: loyaltyRenewalPercent(
        playerLoyalty(player, state.careerSeed),
      ),
    },
  );
  const divisionAsk = Math.round(
    (ask * RENEWAL_DIVISION_PREMIUM_PERCENT[division]) / 100,
  );
  const marketCeiling = marketWage * (player.power === undefined ? 3 : 6);
  return Math.min(
    divisionAsk,
    Math.max(player.weeklyWage, marketWage) * MAX_RENEWAL_ASK_MULTIPLE,
    marketCeiling,
  );
}

/**
 * One refusal in both halves: the English this ring writes, and the catalog key
 * the season-end screen renders instead. `src/game` may not import `src/i18n`,
 * so copy leaves the ring as data and the English stays as the fallback.
 */
export interface RenewalBlockedCopy {
  readonly text: string;
  readonly textKey: string;
  /** Raw values for the key's placeholders. Never pre-formatted text. */
  readonly textParams: Readonly<Record<string, string | number>>;
}

/**
 * Why this player cannot be re-signed at all this season, or undefined when they
 * can.
 *
 * The same two gates `beginCareerRenewalTalks` enforces, readable without
 * throwing. The season-end screen used to render an always-enabled "Meet the
 * agent" button over both of them, so the only way to discover either was to tap
 * it and read a raw engine string in an error toast.
 */
export function careerRenewalBlockedReasonCopy(
  state: GameState,
  market: CareerMarketState,
  playerId: string,
): RenewalBlockedCopy | undefined {
  const player = state.players.find(
    (candidate) =>
      candidate.id === playerId && candidate.clubId === state.userClubId,
  );
  if (player === undefined) return undefined;
  if (
    (market.abandonedRenewalNegotiationIds ?? []).includes(
      renewalNegotiationId(state, playerId),
    )
  ) {
    return {
      text: `${player.name}'s agent has ended talks for this season. He can only leave now.`,
      textKey: 'market.renewalAgentEndedTalks',
      textParams: { player: player.name },
    };
  }
  if (!willRenegotiate(playerLoyalty(player, state.careerSeed))) {
    return {
      text: `${player.name} has decided to move on and will not re-sign at any wage.`,
      textKey: 'market.renewalWillNotResign',
      textParams: { player: player.name },
    };
  }
  return undefined;
}

/** Opens deterministic player-facing talks for an expired M2 contract. */
export function beginCareerRenewalTalks(
  state: GameState,
  market: CareerMarketState,
  playerId: string,
): CareerMarketState {
  assertSeasonEndPhase(state);
  if (market.renewalTalks !== undefined)
    throw new Error('another renewal is already being negotiated');
  const player = expiredUserPlayer(state, playerId);
  assertCareerRenewalAllowed(state, market, playerId, player.name);
  return {
    ...market,
    renewalTalks: {
      playerId,
      negotiation: startContractNegotiation({
        careerSeed: state.careerSeed,
        negotiationId: renewalNegotiationId(state, playerId),
        playerId,
        personality: marketPersonality(player.personality),
        weeklyAsk: careerRenewalWeeklyAsk(state, player),
      }),
    },
  };
}

/**
 * The abandoned-agent and loyalty gates, as an assertion.
 *
 * Shared so the one-tap signing path cannot skip them. Sign-now is a renewal,
 * not a bypass: a player who will not re-sign at any price must not become
 * signable simply because the manager took the button that avoids the haggle.
 */
function assertCareerRenewalAllowed(
  state: GameState,
  market: CareerMarketState,
  playerId: string,
  playerName: string,
): void {
  if (
    (market.abandonedRenewalNegotiationIds ?? []).includes(
      renewalNegotiationId(state, playerId),
    )
  ) {
    throw new Error(
      `${playerName}'s agent has ended talks for this season. He can only leave now.`,
    );
  }
  // Below the threshold there is no number that buys them. The manager has
  // watched this fall on the player card all season and Bert said it would land
  // here, so it is a consequence rather than an ambush.
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (
    player !== undefined &&
    !willRenegotiate(playerLoyalty(player, state.careerSeed))
  ) {
    throw new Error(
      `${playerName} will not re-sign. Loyalty below ${LOYALTY_NO_RENEWAL_THRESHOLD} ends talks before they start.`,
    );
  }
}

export function submitCareerRenewalOffer(
  state: GameState,
  market: CareerMarketState,
  offer: ContractOffer,
  pitchCard?: PitchCard,
  heroLimit?: number,
): CareerMarketState {
  if (market.renewalTalks === undefined)
    throw new Error('there are no active renewal talks');
  // Validated here rather than at completion. `applyCareerContractPromise` used
  // to be the first thing that noticed an impossible promise, and by then the
  // agent had already accepted — so `guarded()` discarded the agreed deal and
  // the panel silently reset to "Round 1 of 3". An offer that cannot be honoured
  // must be refused before it can be accepted.
  const player = expiredUserPlayer(state, market.renewalTalks.playerId);
  const blocked = careerContractPromiseBlockedReason(
    state,
    player,
    offer.perk,
    heroLimit ?? careerContractPromiseHeroLimit(state),
  );
  if (blocked !== undefined) throw new ContractPromiseBlockedError(blocked);
  assertHeroLicenseReclaimChoice(
    state,
    player,
    offer,
    heroLimit ?? careerContractPromiseHeroLimit(state),
  );
  return {
    ...market,
    renewalTalks: {
      ...market.renewalTalks,
      negotiation: submitContractOffer(
        market.renewalTalks.negotiation,
        offer,
        pitchCard,
      ),
    },
  };
}

/**
 * Writes a renewal's agreed terms. One core, two entry points.
 *
 * The negotiated path passes the promise it agreed; the one-tap path passes
 * none. Sharing this is the point: a second transaction written alongside
 * `completeCareerRenewal` would drift on payroll, `onHeroWage`, the growth
 * baseline, or the term assertion the first time any of them changed.
 */
function applyCareerRenewalTerms(
  state: GameState,
  player: CareerPlayer,
  weeklyWage: number,
  termSeasons: number,
  perk: ContractOffer['perk'] | undefined,
  heroLimit?: number,
  reclaimHeroLicenseFromPlayerId?: string,
): GameState {
  assertContractTermFitsCareer(
    player,
    termSeasons,
    state.careerSeed,
    'renewal',
  );
  const wageDelta = weeklyWage - player.weeklyWage;
  // Season end only decrements the term; it never clears `contractPromise`, so
  // an expired player still carries the previous contract's promise, inert only
  // because `hasActiveCareerContractPromise` requires a positive term. Restoring
  // the term without dropping it would REVIVE that old promise -- its Hero
  // License claim, its lineup lock, its unfinished training debt. The negotiated
  // path never noticed because `applyCareerContractPromise` overwrites the field.
  //
  // Dropped by omission rather than through `clearCareerContractPromise`, which
  // also strips `isCaptain` and `shirtNumber`: only the binding promise ends
  // here, so re-signing your captain must not quietly demote him, and `licensed`
  // is a squad assignment that must survive untouched.
  const { contractPromise: _expiredPromise, ...carried } = player;
  const renewed: CareerPlayer = {
    ...carried,
    weeklyWage,
    promotionWagePercent: PROMOTION_WAGE_CLAUSE_PERCENT,
    promotionWageStartsAfterSeason: state.season,
    contractSeasonsRemaining: termSeasons,
    onHeroWage: player.power !== undefined || player.onHeroWage,
    signingStatTotal: playerStatTotal(player),
    transferRequested: false,
    priorityDrillsRemaining: 0,
  };
  const renewedState: GameState = {
    ...state,
    clubs: state.clubs.map((club) =>
      club.id === state.userClubId
        ? {
            ...club,
            weeklyWages: checkedAdd(
              club.weeklyWages,
              wageDelta,
              'renewal payroll',
            ),
          }
        : club,
    ),
    players: state.players.map((candidate) =>
      candidate.id === player.id ? renewed : candidate,
    ),
  };
  return perk === undefined
    ? renewedState
    : applyCareerContractPromise(
        renewedState,
        player.id,
        perk,
        heroLimit,
        reclaimHeroLicenseFromPlayerId,
      );
}

/** Applies the accepted wage/term and clears talks so the next expired deal can be resolved. */
export function completeCareerRenewal(
  state: GameState,
  market: CareerMarketState,
  heroLimit?: number,
): CareerMarketTransaction {
  assertSeasonEndPhase(state);
  const talks = market.renewalTalks;
  const accepted = talks?.negotiation.acceptedOffer;
  if (talks?.negotiation.status !== 'ACCEPTED' || accepted === undefined) {
    throw new Error('a renewal requires an accepted player contract');
  }
  const player = expiredUserPlayer(state, talks.playerId);
  return {
    state: applyCareerRenewalTerms(
      state,
      player,
      accepted.weeklyWage,
      accepted.termSeasons,
      accepted.perk,
      heroLimit,
      accepted.reclaimHeroLicenseFromPlayerId,
    ),
    market: { ...market, renewalTalks: undefined },
  };
}

/**
 * Re-signs an expired player at the agent's asking price, with no promise.
 *
 * The convenience path, and deliberately the expensive one: it pays 100% of the
 * ask, where a negotiated deal lands at 86-92% without pitch cards and around
 * 69% with them. Forgoing that discount IS the premium, which is why there is no
 * cap and no surcharge on top.
 *
 * No promise is attached. The old dead `renewPlayer` hard-coded `JERSEY_10`
 * under a comment claiming it had "no squad management consequence", but that
 * promise takes the number 10 off whoever wears it -- so several quick renewals
 * in one season-end left a trail of players holding an active #10 promise while
 * only the last actually wore the shirt. Promises are a negotiating chip; they
 * belong in the conversation where their cost can be read.
 *
 * Runs the same gates as `beginCareerRenewalTalks`. Signing at the ask is a
 * renewal, not a way around a player who has decided to leave.
 */
export function signCareerRenewalAtAsk(
  state: GameState,
  market: CareerMarketState,
  playerId: string,
  termSeasons: 1 | 2 | 3,
): CareerMarketTransaction {
  assertSeasonEndPhase(state);
  // Talks open for somebody else are a different conversation and must not be
  // discarded. The player's own open talks are superseded: signing at the ask is
  // a deliberate end to that haggle.
  if (
    market.renewalTalks !== undefined &&
    market.renewalTalks.playerId !== playerId
  ) {
    throw new Error('another renewal is already being negotiated');
  }
  const player = expiredUserPlayer(state, playerId);
  assertCareerRenewalAllowed(state, market, playerId, player.name);
  return {
    state: applyCareerRenewalTerms(
      state,
      player,
      careerRenewalWeeklyAsk(state, player),
      termSeasons,
      undefined,
    ),
    market: { ...market, renewalTalks: undefined },
  };
}

/**
 * Closes renewal talks and records the abandoned negotiation id, exactly as the
 * transfer path does. The season prefix keeps the record from outliving the
 * season it belongs to, so next season's renewal is a fresh conversation.
 */
export function closeCareerRenewalTalks(
  state: GameState,
  market: CareerMarketState,
): CareerMarketState {
  const talks = market.renewalTalks;
  if (talks === undefined) return market;
  const seasonPrefix = `renewal-s${state.season}-`;
  return {
    ...market,
    renewalTalks: undefined,
    abandonedRenewalNegotiationIds: [
      ...(market.abandonedRenewalNegotiationIds ?? []).filter((id) =>
        id.startsWith(seasonPrefix),
      ),
      talks.negotiation.id,
    ],
  };
}

/** Lists a player and creates deterministic, club-specific AI bids. */
export function listCareerPlayer(
  state: GameState,
  market: CareerMarketState,
  playerId: string,
  division = 5,
): CareerMarketState {
  assertManagePhase(state);
  const currentMarket = expireCareerTransferListings(state, market);
  const player = userCareerPlayer(state, playerId);
  if (player.contractSeasonsRemaining < 1) {
    throw new Error('an expired player cannot be transfer-listed');
  }
  if (
    (currentMarket.transferListings ?? []).some(
      (listing) => listing.playerId === playerId,
    )
  ) {
    throw new Error(`${player.name} is already transfer-listed`);
  }
  // Validate that accepting a future bid cannot strand the starting eleven.
  replaceTransferredStarter(state, player);
  assertUserSaleKeepsSquadCover(state, player);
  const bids = state.clubs
    .filter((club) => club.id !== state.userClubId)
    .map((club) => ({
      club,
      quote: sellingQuoteForBuyer(state, player, club.id, division),
    }))
    .filter((candidate) => candidate.club.cash >= candidate.quote.fee)
    .sort(
      (left, right) =>
        right.quote.fee - left.quote.fee ||
        compareIds(left.club.id, right.club.id),
    )
    .slice(0, player.transferRequested === true ? 4 : 3)
    .map(({ club, quote }) => ({
      club,
      quote: varyListedBidQuote(
        state,
        player,
        club.id,
        club.cash,
        quote,
        division,
      ),
    }))
    .sort(
      (left, right) =>
        right.quote.fee - left.quote.fee ||
        compareIds(left.club.id, right.club.id),
    )
    .map(({ club, quote }) => ({
      id: `bid-s${state.season}-w${state.week}-${player.id}-${club.id}`,
      playerId: player.id,
      buyerClubId: club.id,
      quote,
      madeSeason: state.season,
      madeWeek: state.week,
    }));
  if (bids.length === 0)
    throw new Error('no club can afford to bid for this player');
  return {
    ...currentMarket,
    transferListings: [
      ...(currentMarket.transferListings ?? []),
      {
        playerId,
        listedSeason: state.season,
        listedWeek: state.week,
        bids,
      },
    ],
  };
}

/** Accepts the exact saved bid; callers cannot choose or manufacture a buyer. */
export function acceptCareerTransferBid(
  state: GameState,
  market: CareerMarketState,
  bidId: string,
): CareerMarketTransaction {
  assertManagePhase(state);
  const listing = (market.transferListings ?? []).find((candidate) =>
    candidate.bids.some((bid) => bid.id === bidId),
  );
  const bid = listing?.bids.find((candidate) => candidate.id === bidId);
  if (listing === undefined || bid === undefined)
    throw new Error(`unknown transfer bid ${bidId}`);
  if (!listingIsCurrent(state, listing)) {
    throw new Error('the transfer bid has expired');
  }
  const result = completeCareerPlayerSale(
    state,
    market,
    listing.playerId,
    bid.buyerClubId,
    bid.quote,
  );
  return {
    state: result.state,
    market: {
      ...result.market,
      transferListings: (result.market.transferListings ?? []).filter(
        (candidate) => candidate.playerId !== listing.playerId,
      ),
    },
  };
}

/** @deprecated Prefer listCareerPlayer followed by acceptCareerTransferBid. */
export function sellCareerPlayer(
  state: GameState,
  market: CareerMarketState,
  playerId: string,
  buyerClubId: string,
  division = 5,
): CareerMarketTransaction {
  assertManagePhase(state);
  const player = state.players.find(
    (candidate) =>
      candidate.id === playerId && candidate.clubId === state.userClubId,
  );
  if (player === undefined)
    throw new Error(`unknown user-club player ${playerId}`);
  const buyer = state.clubs.find(
    (club) => club.id === buyerClubId && club.id !== state.userClubId,
  );
  if (buyer === undefined)
    throw new Error(`unknown buying club ${buyerClubId}`);
  const quote = sellingQuoteForBuyer(state, player, buyerClubId, division);
  return completeCareerPlayerSale(state, market, playerId, buyerClubId, quote);
}

export type CareerEventPlayerSaleBlocker =
  'market-unavailable' | 'player-unavailable' | 'squad-cover' | 'no-buyer';

/**
 * Explains whether an authored story sale can complete before its button is
 * pressed. The story itself is the offer, so this deliberately ignores the
 * ordinary transfer-window gate while retaining every roster and cash guard.
 */
export function careerEventPlayerSaleBlocker(
  state: GameState,
  playerId: string,
  fee: number,
): CareerEventPlayerSaleBlocker | undefined {
  if (state.market === undefined) return 'market-unavailable';
  const player = state.players.find(
    (candidate) =>
      candidate.id === playerId && candidate.clubId === state.userClubId,
  );
  if (player === undefined) return 'player-unavailable';
  try {
    assertUserSaleKeepsSquadCover(state, player);
  } catch {
    return 'squad-cover';
  }
  return careerEventSaleBuyer(state, fee) === undefined
    ? 'no-buyer'
    : undefined;
}

/**
 * Completes the fixed-fee transfer promised by a career event. This reuses the
 * market's one sale transaction instead of maintaining a second roster-removal
 * path, and writes the returned market sidecar back into the career state.
 */
export function completeCareerEventPlayerSale(
  state: GameState,
  playerId: string,
  fee: number,
): GameState {
  const blocker = careerEventPlayerSaleBlocker(state, playerId, fee);
  if (blocker !== undefined) {
    throw new Error(`career event player sale is blocked: ${blocker}`);
  }
  const buyer = careerEventSaleBuyer(state, fee)!;
  const result = completeCareerPlayerSale(
    state,
    state.market!,
    playerId,
    buyer.id,
    { playerId, valuation: fee, fee, bandPercent: 100 },
  );
  return { ...result.state, market: result.market };
}

function careerEventSaleBuyer(state: GameState, fee: number) {
  return state.clubs
    .filter((club) => club.id !== state.userClubId && club.cash >= fee)
    .sort((left, right) => compareIds(left.id, right.id))[0];
}

function completeCareerPlayerSale(
  state: GameState,
  market: CareerMarketState,
  playerId: string,
  buyerClubId: string,
  quote: TransferQuote,
): CareerMarketTransaction {
  const player = userCareerPlayer(state, playerId);
  const buyer = state.clubs.find(
    (club) => club.id === buyerClubId && club.id !== state.userClubId,
  );
  if (buyer === undefined)
    throw new Error(`unknown buying club ${buyerClubId}`);
  if (quote.playerId !== playerId)
    throw new Error('the transfer bid does not match the listed player');
  if (buyer.cash < quote.fee)
    throw new Error('the buying club cannot afford the transfer fee');
  assertUserSaleKeepsSquadCover(state, player);
  const lineups = replaceTransferredStarter(state, player);
  const transferredState: GameState = {
    ...state,
    clubs: state.clubs.map((club) => {
      if (club.id === state.userClubId) {
        return {
          ...club,
          cash: checkedAdd(club.cash, quote.fee, 'transfer sale cash'),
          weeklyWages: checkedSubtract(
            club.weeklyWages,
            player.weeklyWage,
            'seller weekly wages',
          ),
        };
      }
      if (club.id === buyerClubId) {
        return {
          ...club,
          cash: checkedSubtract(club.cash, quote.fee, 'buyer transfer cash'),
          weeklyWages: checkedAdd(
            club.weeklyWages,
            player.weeklyWage,
            'buyer weekly wages',
          ),
        };
      }
      return club;
    }),
    players: state.players.map((candidate) =>
      candidate.id === player.id
        ? {
            ...clearCareerContractPromise(candidate),
            clubId: buyerClubId,
            licensed: false,
          }
        : candidate,
    ),
    lineups,
  };
  const recordedState = recordCashTransaction(transferredState, {
    kind: 'transfer-sell',
    label: `Sold ${player.name}`,
    labelKey: 'cashTransaction.soldPlayer',
    labelParams: { player: player.name },
    amount: quote.fee,
    referenceId: player.id,
  });
  return {
    // Cancels a pending request from the player who just left. Waiting for
    // settlement would leave the Requests tab offering Grant on someone who is
    // no longer at the club.
    state: cancelPendingPlayerRequestIfInvalid(
      clearMetBoardUltimatum(reconcileBoardUltimatumCandidates(recordedState)),
    ),
    market: {
      ...market,
      transferListings: (market.transferListings ?? []).filter(
        (listing) => listing.playerId !== playerId,
      ),
    },
  };
}

/**
 * Selling is open every week, so a saved bid can no longer expire with a
 * registration window. It ages instead: the week it was made plus the two
 * advances after it, and never across a season boundary. Rival clubs quoting
 * week-2 money in week 25 is the failure this prevents.
 */
const TRANSFER_BID_WEEKS = 2;

function listingIsCurrent(
  state: Pick<GameState, 'season' | 'week'>,
  listing: Pick<CareerTransferListing, 'listedSeason' | 'listedWeek'>,
): boolean {
  if (state.season !== listing.listedSeason) return false;
  const age = state.week - listing.listedWeek;
  return age >= 0 && age <= TRANSFER_BID_WEEKS;
}

function transferWindowNumber(week: number): 1 | 2 | undefined {
  if (week >= 1 && week <= 4) return 1;
  if (week >= 17 && week <= 18) return 2;
  return undefined;
}

export function hireCareerCoach(
  state: GameState,
  market: CareerMarketState,
  coachId: string,
  role: CareerCoachRole = 'HEAD',
): CareerMarketState {
  assertManagePhase(state);
  const candidate = market.coachCandidates.find(
    (coach) => coach.id === coachId,
  );
  if (candidate === undefined)
    throw new Error(`unknown coach candidate ${coachId}`);
  const currentCoach =
    role === 'HEAD' ? market.headCoach : market.assistantCoach;
  if (currentCoach !== undefined && currentCoach.id !== candidate.id) {
    throw new Error(
      `dismiss the current ${role === 'HEAD' ? 'head' : 'assistant'} coach before hiring another`,
    );
  }
  if (currentCoach?.id === candidate.id) {
    throw new Error(`${candidate.name} already fills that coaching role`);
  }
  const division = highestDivisionReached(state);
  const fame = careerClubFame(state, market);
  if (!isCoachCandidateEligible(candidate, division, fame)) {
    throw new Error(`${candidate.name} is not eligible for this club`);
  }
  const weeklyWage = coachWeeklyWageForRole(candidate, role);
  if (userClub(state).cash < weeklyWage) {
    throw new Error('the club cannot cover the coach weekly wage');
  }
  if (role === 'ASSISTANT' && !hasCoachingOffice(state)) {
    throw new Error('an assistant coach requires the Coaching Office');
  }
  const otherCoach = role === 'HEAD' ? market.assistantCoach : market.headCoach;
  if (otherCoach?.id === candidate.id) {
    throw new Error('the same coach cannot fill both staff roles');
  }
  const unlocks =
    candidate.unlockId === undefined
      ? [...(market.unlockedCoachContentIds ?? [])]
      : Array.from(
          new Set([
            ...(market.unlockedCoachContentIds ?? []),
            candidate.unlockId,
          ]),
        );
  // A level-2 office hires better: the coach arrives already developed, and is
  // paid for the level he actually works at rather than the one he applied at.
  const hiredLevel = Math.min(
    5,
    candidate.level + coachHireLevelBonus(coachingOfficeLevel(state)),
  );
  const employed =
    hiredLevel === candidate.level
      ? { ...candidate, weeklyWage }
      : {
          ...candidate,
          level: hiredLevel,
          weeklyWage: coachWeeklyWageForRole(
            {
              weeklyWage: Math.round(
                (checkedMultiply(
                  COACH_WAGE_PER_LEVEL,
                  hiredLevel,
                  'hired coach base wage',
                ) *
                  (100 - candidate.loyaltyDiscountPercent)) /
                  100,
              ),
            },
            role,
          ),
        };
  return {
    ...market,
    coachCandidates: market.coachCandidates.filter(
      (coach) => coach.id !== coachId,
    ),
    ...(role === 'HEAD'
      ? { headCoach: employed, headCoachSeasonsEmployed: 0 }
      : { assistantCoach: employed, assistantCoachSeasonsEmployed: 0 }),
    unlockedCoachContentIds: unlocks,
  };
}

/** Dismisses one employed coach and charges the agreed one-week severance. */
export function dismissCareerCoach(
  state: GameState,
  market: CareerMarketState,
  role: CareerCoachRole = 'HEAD',
): CareerMarketTransaction {
  assertManagePhase(state);
  const coach = role === 'HEAD' ? market.headCoach : market.assistantCoach;
  const roleLabel = role === 'HEAD' ? 'head' : 'assistant';
  if (coach === undefined)
    throw new Error(`there is no ${roleLabel} coach to dismiss`);
  const club = userClub(state);
  const severance = coach.weeklyWage;
  if (club.cash < severance)
    throw new Error('the club cannot afford the coach severance');
  const dismissedState: GameState = {
    ...state,
    clubs: state.clubs.map((candidate) =>
      candidate.id === state.userClubId
        ? {
            ...candidate,
            cash: checkedSubtract(candidate.cash, severance, 'coach severance'),
          }
        : candidate,
    ),
  };
  return {
    state: recordCashTransaction(dismissedState, {
      kind: 'coach-dismissal',
      label: `Severance · ${coach.name}`,
      labelKey: 'cashTransaction.coachSeverance',
      labelParams: { coach: coach.name },
      amount: -severance,
      referenceId: coach.id,
    }),
    market: {
      ...market,
      ...(role === 'HEAD'
        ? { headCoach: undefined, headCoachSeasonsEmployed: undefined }
        : {
            assistantCoach: undefined,
            assistantCoachSeasonsEmployed: undefined,
          }),
    },
  };
}

function careerCoachHasUnlockedContent(
  market: CareerMarketState,
  contentId: string,
): boolean {
  if (typeof contentId !== 'string' || contentId.length === 0) {
    throw new Error('coach content ID must be a non-empty string');
  }
  return (market.unlockedCoachContentIds ?? []).includes(contentId);
}

export function careerCoachUnlockedFormationIds(
  market: CareerMarketState,
): string[] {
  return (market.unlockedCoachContentIds ?? [])
    .filter((id) => id.startsWith('formation:'))
    .map((id) => id.slice('formation:'.length));
}

/** Refreshes candidates while retaining and progressing the employed head coach. */
export function refreshCareerMarketForNewSeason(
  state: GameState,
  previous: CareerMarketState,
  division = 5,
  clubFame = 0,
): CareerMarketState {
  const unlockedContent = new Set(previous.unlockedCoachContentIds ?? []);
  const employedPortraitIds = [
    previous.headCoach?.portraitId,
    previous.assistantCoach?.portraitId,
  ].filter((portraitId): portraitId is string => portraitId !== undefined);
  const refreshed = createCareerMarketState(
    state,
    division,
    clubFame,
    employedPortraitIds,
    DEFAULT_COACH_CONTENT_UNLOCK_IDS.filter((id) => !unlockedContent.has(id)),
  );
  const officeLevel = coachingOfficeLevel(state);
  const head = progressEmployedCoach(
    previous.headCoach,
    previous.headCoachSeasonsEmployed,
    'HEAD',
    officeLevel,
  );
  const assistant = progressEmployedCoach(
    previous.assistantCoach,
    previous.assistantCoachSeasonsEmployed,
    'ASSISTANT',
    officeLevel,
  );
  return {
    ...refreshed,
    nextMissionNumber: previous.nextMissionNumber,
    activeScoutMission: previous.activeScoutMission,
    activeScoutMissionFeeWaived: previous.activeScoutMissionFeeWaived,
    scoutReports: [],
    transferFeeAdjustments: [],
    ...(head === undefined
      ? {}
      : {
          headCoach: head.coach,
          headCoachSeasonsEmployed: head.seasonsEmployed,
        }),
    ...(assistant === undefined
      ? {}
      : {
          assistantCoach: assistant.coach,
          assistantCoachSeasonsEmployed: assistant.seasonsEmployed,
        }),
    unlockedCoachContentIds: [...(previous.unlockedCoachContentIds ?? [])],
    clubFameAdjustment: previous.clubFameAdjustment ?? 0,
  };
}

/**
 * @i18n-fallback — `readableRegion` below is the English half the save holds;
 * this table names the translated half `translatedParams` substitutes via the
 * `regionKey` pair (the `DIVISION_NAME_KEYS` pattern).
 */
const REGION_NAME_KEYS: Readonly<Record<ScoutRegion, string>> = {
  LOCAL: 'scoutRegion.local.name',
  EUROPE: 'scoutRegion.europe.name',
  SOUTH_AMERICA: 'scoutRegion.southAmerica.name',
  AFRICA: 'scoutRegion.africa.name',
  ASIA: 'scoutRegion.asia.name',
};

function readableRegion(region: ScoutRegion): string {
  return region
    .toLowerCase()
    .split('_')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

export function careerCoachWeeklyWage(market: CareerMarketState): number {
  return checkedAdd(
    market.headCoach?.weeklyWage ?? 0,
    market.assistantCoach?.weeklyWage ?? 0,
    'coaching staff weekly wage',
  );
}

/**
 * The four heroes who are on no club at all.
 *
 * They exist only as scouting leads, so they are materialised on demand rather
 * than stored: once one is signed they live in `state.players` like anyone else
 * and drop out of this list for good.
 */
function unattachedSpecialHeroes(state: GameState): CareerPlayer[] {
  if (state.m2 === undefined) return [];
  // The same gate rumoured-hero missions already carry, so a lead can never be
  // offered for a division that cannot run the mission that finds it.
  if (currentUserDivision(state.m2) > 3) return [];
  const owned = new Set(state.players.map((player) => player.id));
  return scoutOnlySpecialHeroes()
    .filter((hero) => !owned.has(hero.id))
    .map((hero) => buildUnattachedSpecialHero(hero));
}

function scoutableCareerPlayers(state: GameState): ScoutablePlayer[] {
  const unattached: CareerTransferTarget[] = unattachedSpecialHeroes(state).map(
    (player) => ({
      player,
      sellingClubDivision: 1,
      active: false,
    }),
  );
  return [
    ...allCareerTransferTargets(state).filter(({ player }) =>
      sellerCanSpare(state, player.id),
    ),
    ...unattached,
  ].map(({ player, sellingClubDivision }) => ({
    id: player.id,
    region: scoutRegion(player.id),
    role: player.role,
    age: player.age ?? 24,
    attrs: { ...player.attrs },
    potential: player.potential ?? 3,
    personality: marketPersonality(player.personality),
    ...(player.power === undefined
      ? {}
      : { power: player.power, powerTier: player.powerTier ?? 1 }),
    contractSeasonsRemaining: player.contractSeasonsRemaining,
    sellingClubDivision,
  }));
}

/** Resolves a scouted target from either the active division or the persistent pyramid. */
export function careerTransferTarget(
  state: GameState,
  playerId: string,
  fallbackDivision = 5,
): CareerTransferTarget | undefined {
  const active = state.players.find(
    (candidate) =>
      candidate.id === playerId && candidate.clubId !== state.userClubId,
  );
  if (active !== undefined) {
    return {
      player: active,
      sellingClubDivision:
        pyramidDivisionForClub(state, active.clubId) ?? fallbackDivision,
      active: true,
    };
  }
  if (state.m2 === undefined) return undefined;
  const unattached = unattachedSpecialHeroes(state).find(
    (candidate) => candidate.id === playerId,
  );
  if (unattached !== undefined) {
    // Priced at the top of the market: these are marquee signings, and there is
    // no selling club to take the fee. The money leaving the user's account is
    // the point.
    return { player: unattached, sellingClubDivision: 1, active: false };
  }
  for (const division of state.m2.pyramid.divisions) {
    for (const club of division.clubs) {
      if (club.id === state.userClubId) continue;
      const player = club.squad.find((candidate) => candidate.id === playerId);
      if (player !== undefined) {
        return {
          player: pyramidCareerPlayer(club, player, division.level),
          sellingClubDivision: division.level,
          active: false,
        };
      }
    }
  }
  return undefined;
}

/** The exact quote shown on Deals and frozen when transfer talks open. */
export function careerBuyingTransferQuote(
  state: GameState,
  market: CareerMarketState,
  playerId: string,
  fallbackDivision = 5,
): TransferQuote {
  const target = careerTransferTarget(state, playerId, fallbackDivision);
  if (target === undefined)
    throw new Error(`unknown transfer target ${playerId}`);
  const quote = buyingTransferQuote(valuationPlayer(target.player), {
    careerSeed: state.careerSeed,
    season: state.season,
    week: state.week,
    sellingClubDivision: target.sellingClubDivision,
  });
  const percent =
    market.transferFeeAdjustments?.find(
      (adjustment) => adjustment.playerId === playerId,
    )?.percent ?? 0;
  return {
    ...quote,
    fee: Math.max(1, Math.round((quote.fee * (100 + percent)) / 100)),
  };
}

/** Applies one story result to one player who is still visible on Deals. */
export function applyCareerTransferFeeAdjustment(
  state: GameState,
  playerId: string,
  percentDelta: number,
): GameState {
  const market = state.market;
  if (market === undefined)
    throw new Error('the career market is not initialized');
  if (!Number.isSafeInteger(percentDelta)) {
    throw new Error('transfer fee adjustment must be a safe integer');
  }
  if (!market.scoutReports.some((report) => report.playerId === playerId)) {
    throw new Error(`transfer target ${playerId} is no longer on Deals`);
  }
  const current =
    market.transferFeeAdjustments?.find(
      (adjustment) => adjustment.playerId === playerId,
    )?.percent ?? 0;
  const percent = Math.max(-50, Math.min(50, current + percentDelta));
  return {
    ...state,
    market: {
      ...market,
      transferFeeAdjustments: [
        ...(market.transferFeeAdjustments ?? []).filter(
          (adjustment) => adjustment.playerId !== playerId,
        ),
        { playerId, percent },
      ],
    },
  };
}

/**
 * The club's own player, for renewal talks. Always active — a player being
 * renewed is on the roster by definition, so there is no pyramid squad to
 * search and no selling division to report.
 */
function careerSquadNegotiationTarget(
  state: GameState,
  playerId: string,
): CareerTransferTarget | undefined {
  const player = state.players.find(
    (candidate) =>
      candidate.id === playerId && candidate.clubId === state.userClubId,
  );
  return player === undefined
    ? undefined
    : { player, sellingClubDivision: 5, active: true };
}

function allCareerTransferTargets(state: GameState): CareerTransferTarget[] {
  const targets: CareerTransferTarget[] = [];
  const seen = new Set<string>();
  for (const player of state.players) {
    if (player.clubId === state.userClubId) continue;
    seen.add(player.id);
    targets.push({
      player,
      sellingClubDivision: pyramidDivisionForClub(state, player.clubId) ?? 5,
      active: true,
    });
  }
  if (state.m2 === undefined) return targets;
  for (const division of state.m2.pyramid.divisions) {
    for (const club of division.clubs) {
      if (club.id === state.userClubId) continue;
      for (const player of club.squad) {
        if (seen.has(player.id)) continue;
        // Belt over the brace in synchronizeM2ActiveDivision: a named hero is
        // only ever buyable as a live active-division player or as one of the
        // four unattached scout targets. Rebuilt from pyramid data they would
        // arrive powerless, from the wrong club, at the wrong fee.
        if (isSpecialHeroId(player.id)) continue;
        seen.add(player.id);
        targets.push({
          player: pyramidCareerPlayer(club, player, division.level),
          sellingClubDivision: division.level,
          active: false,
        });
      }
    }
  }
  return targets;
}

function pyramidCareerPlayer(
  club: PyramidClub,
  player: PyramidPlayer,
  division: DivisionLevel,
): CareerPlayer {
  let nextEligibleIndex = 0;
  let eligibleIndex = -1;
  for (const candidate of club.squad) {
    if (candidate.role !== 'MID' && candidate.role !== 'FWD') continue;
    if (candidate.id === player.id) eligibleIndex = nextEligibleIndex;
    nextEligibleIndex += 1;
  }
  const heroCount = generatedClubHeroCount(club.id, division);
  const power =
    eligibleIndex >= 0 && eligibleIndex < heroCount
      ? generatedClubPower(club.id, eligibleIndex, player.role)
      : undefined;
  const potential = opponentPotential(player.id, division);
  return {
    id: player.id,
    clubId: player.clubId,
    name: player.name,
    role: player.role,
    ...(player.lookId === undefined ? {} : { lookId: player.lookId }),
    attrs: { ...player.attrs },
    ...(power === undefined
      ? {}
      : {
          power,
          powerTier: (division === 1 ? 3 : division <= 3 ? 2 : 1) as 1 | 2 | 3,
        }),
    licensed: power !== undefined,
    weeklyWage: generatedPlayerWeeklyWage(player.attrs, division),
    onHeroWage: power !== undefined,
    contractSeasonsRemaining: 2,
    morale: player.morale,
    injuryWeeks: 0,
    age: player.age,
    archetype: player.archetype,
    potential,
    potentialCeiling: developmentPotentialCeiling({
      id: player.id,
      role: player.role,
      attrs: player.attrs,
      age: player.age,
      potential,
    }),
    consistency: 70,
    personality: player.personality,
    condition: player.condition,
    seasonsAtClub: player.seasonsAtClub,
    fame: player.fame,
    retirementAge: 36,
    retirementAnnounced: player.retirementAnnouncementSeason !== undefined,
    consecutiveLowMoraleWeeks: player.consecutiveLowMoraleWeeks,
    ...(player.retirementAnnouncementSeason === undefined
      ? {}
      : { retirementAnnouncementSeason: player.retirementAnnouncementSeason }),
    signingStatTotal: Object.values(player.attrs).reduce(
      (sum, value) => sum + value,
      0,
    ),
  };
}

function opponentPotential(
  playerId: string,
  division: DivisionLevel,
): 1 | 2 | 3 | 4 | 5 {
  let value = 2166136261;
  for (let index = 0; index < playerId.length; index += 1) {
    value = Math.imul(value ^ playerId.charCodeAt(index), 16777619) >>> 0;
  }
  return potentialTierForDivision(division, value % 100);
}

function pyramidDivisionForClub(
  state: GameState,
  clubId: string,
): DivisionLevel | undefined {
  return state.m2?.pyramid.divisions.find((division) =>
    division.clubs.some((club) => club.id === clubId),
  )?.level;
}

function updatePyramidPlayerMorale(
  state: GameState,
  playerId: string,
  morale: number,
): GameState {
  if (state.m2 === undefined)
    throw new Error(`unknown negotiation player ${playerId}`);
  return {
    ...state,
    m2: {
      ...state.m2,
      pyramid: {
        ...state.m2.pyramid,
        divisions: state.m2.pyramid.divisions.map((division) => ({
          ...division,
          clubs: division.clubs.map((club) => ({
            ...club,
            squad: club.squad.map((player) =>
              player.id === playerId ? { ...player, morale } : player,
            ),
          })),
        })),
      },
    },
  };
}

/**
 * Nothing refills a selling club's squad mid-career, and `startingEleven` in
 * full-career.ts must assemble 1 GK / 4 DEF / 4 MID / 2 FWD from whatever
 * remains every time that club's division is built as the active one. Buying a
 * club below this template therefore bricks the career at a later season
 * transition — so the club refuses to sell its last cover for a position.
 */
const SELLER_LINEUP_TEMPLATE = [
  ['GK', 1],
  ['DEF', 4],
  ['MID', 4],
  ['FWD', 2],
] as const;

/**
 * Both kinds of seller are checked. A pyramid club's squad is read from the
 * stored pyramid; an active-division club's is the live roster, which
 * `synchronizeM2ActiveDivision` writes back into the pyramid on the way into
 * the next season — its only check there is a squad count, so a roster that is
 * eleven-strong but two defenders short passes it and throws later. Active
 * clubs are the likelier brick of the two: they are the league the player
 * scouts and buys from all season.
 */
function sellerCanSpare(state: GameState, playerId: string): boolean {
  // No selling club, so no squad to leave without cover. Stated rather than
  // left to the fall-through below, which returns true for any unknown ID.
  if (
    isSpecialHeroId(playerId) &&
    !state.players.some((p) => p.id === playerId)
  )
    return true;
  const activeSellerId = state.players.find(
    (candidate) =>
      candidate.id === playerId && candidate.clubId !== state.userClubId,
  )?.clubId;
  if (activeSellerId !== undefined) {
    return coversLineupTemplate(
      state.players.filter(
        (candidate) =>
          candidate.clubId === activeSellerId && candidate.id !== playerId,
      ),
    );
  }
  if (state.m2 === undefined) return true;
  for (const division of state.m2.pyramid.divisions) {
    for (const club of division.clubs) {
      if (!club.squad.some((candidate) => candidate.id === playerId)) continue;
      return coversLineupTemplate(
        club.squad.filter((candidate) => candidate.id !== playerId),
      );
    }
  }
  return true;
}

function coversLineupTemplate(
  squad: ReadonlyArray<{ readonly role: CareerPlayer['role'] }>,
): boolean {
  return SELLER_LINEUP_TEMPLATE.every(
    ([role, needed]) =>
      squad.filter((candidate) => candidate.role === role).length >= needed,
  );
}

function persistCareerTransferInPyramid(
  state: GameState,
  sourcePlayer: CareerPlayer,
): GameState {
  if (state.m2 === undefined) return state;
  const sourceIsActive = state.clubs.some(
    (club) => club.id === sourcePlayer.clubId,
  );
  let m2 = state.m2;
  if (!sourceIsActive) {
    m2 = {
      ...m2,
      pyramid: {
        ...m2.pyramid,
        divisions: m2.pyramid.divisions.map((division) => ({
          ...division,
          clubs: division.clubs.map((club) => {
            if (club.id !== sourcePlayer.clubId) return club;
            const squad = club.squad.filter(
              (player) => player.id !== sourcePlayer.id,
            );
            if (squad.length === club.squad.length) {
              throw new Error(
                `transfer source ${sourcePlayer.id} is missing from the pyramid`,
              );
            }
            return { ...club, squad, squadStrength: clubSquadStrength(squad) };
          }),
        })),
      },
    };
  }
  m2 = synchronizeM2ActiveDivision(
    m2,
    { clubs: state.clubs, players: state.players },
    currentUserDivision(m2),
  );
  return { ...state, m2 };
}

function valuationPlayer(player: CareerPlayer) {
  return {
    id: player.id,
    role: player.role,
    attrs: player.attrs,
    age: player.age ?? 24,
    potential: player.potential ?? 3,
    ...(player.power === undefined
      ? {}
      : { power: player.power, powerTier: player.powerTier ?? 1 }),
    contractSeasonsRemaining: player.contractSeasonsRemaining,
  };
}

export function growthSinceSigningPercent(player: CareerPlayer): number {
  const currentTotal = playerStatTotal(player);
  const baseline = player.signingStatTotal ?? currentTotal;
  if (!Number.isSafeInteger(baseline) || baseline < 1) {
    throw new Error('signing stat total must be a positive safe integer');
  }
  return Math.min(
    300,
    Math.max(0, Math.floor(((currentTotal - baseline) * 100) / baseline)),
  );
}

function playerStatTotal(player: CareerPlayer): number {
  const total = Object.values(player.attrs).reduce(
    (sum, value) => checkedAdd(sum, value, 'player attribute total'),
    0,
  );
  if (total < 1) throw new Error('player attribute total must be positive');
  return total;
}

/**
 * An unlicensed hero is bench-only: buildTeamDef refuses a lineup containing
 * one, so promoting him here saved a career that could not start its next
 * match. Same rule as the board-ultimatum replacement.
 */
function isEligibleTransferReplacement(candidate: CareerPlayer): boolean {
  return (
    isAvailableForSelection(candidate) &&
    !(candidate.power !== undefined && !candidate.licensed)
  );
}

/**
 * A user sale must leave the eleven coverable, or the career dead-ends later:
 * an expired starting keeper with no spare cannot be released at season end,
 * and an injured starter on a bare eleven has no legal lineup repair. The rule
 * mirrors what lineup repair actually needs — after the sale (and any starter
 * replacement it triggers), one eligible spare goalkeeper and one eligible
 * outfield substitute must remain outside the eleven. The seller-side template
 * check (`sellerCanSpare`) is deliberately weaker; AI clubs never repair
 * injuries or resolve expired contracts, the user club does.
 */
function assertUserSaleKeepsSquadCover(
  state: GameState,
  player: CareerPlayer,
): void {
  const postSaleLineup = replaceTransferredStarter(state, player).find(
    (lineup) => lineup.clubId === state.userClubId,
  );
  if (postSaleLineup === undefined) return;
  const starters = new Set(postSaleLineup.playerIds);
  const spares = state.players.filter(
    (candidate) =>
      candidate.clubId === state.userClubId &&
      candidate.id !== player.id &&
      !starters.has(candidate.id) &&
      isEligibleTransferReplacement(candidate),
  );
  const covered =
    spares.some((candidate) => candidate.role === 'GK') &&
    spares.some((candidate) => candidate.role !== 'GK');
  if (!covered) {
    throw new Error(
      `Selling ${player.name} would leave the eleven without matchday cover. Keep a spare goalkeeper and an outfield substitute.`,
    );
  }
}

function replaceTransferredStarter(state: GameState, player: CareerPlayer) {
  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === player.clubId,
  );
  if (lineup === undefined || !lineup.playerIds.includes(player.id))
    return state.lineups;
  const lineupSlot = lineup.playerIds.indexOf(player.id);
  const slotRole =
    lineupSlot === 0
      ? 'GK'
      : lineupSlot <= 4
        ? 'DEF'
        : lineupSlot <= 8
          ? 'MID'
          : 'FWD';
  const starters = new Set(lineup.playerIds);
  const replacement =
    state.players.find(
      (candidate) =>
        candidate.clubId === player.clubId &&
        candidate.id !== player.id &&
        !starters.has(candidate.id) &&
        isEligibleTransferReplacement(candidate) &&
        candidate.role === slotRole,
    ) ??
    state.players.find(
      (candidate) =>
        candidate.clubId === player.clubId &&
        candidate.id !== player.id &&
        !starters.has(candidate.id) &&
        isEligibleTransferReplacement(candidate) &&
        candidate.role !== 'GK' &&
        player.role !== 'GK',
    );
  if (replacement === undefined)
    throw new Error('the selling club has no eligible lineup replacement');
  return state.lineups.map((candidate) =>
    candidate.clubId === player.clubId
      ? {
          ...candidate,
          playerIds: candidate.playerIds.map((id) =>
            id === player.id ? replacement.id : id,
          ),
        }
      : candidate,
  );
}

/**
 * 0 when the club owns no Scout Office. The best operational office wins —
 * `.find()` used to take whichever office was built first, so a second office
 * upgraded to level 3 was money for nothing.
 */
export function scoutOfficeLevel(state: GameState): number {
  const grid = state.facilities.grid;
  if (grid === undefined) return 0;
  let level = 0;
  for (const building of grid.buildings) {
    if (building.type !== 'scout-office') continue;
    if (!isFacilityOperational(grid, building.id)) continue;
    level = Math.max(level, building.level);
  }
  return level;
}

/**
 * Candidates a finished mission brings back. Without an office the club is
 * borrowing an agency scout and gets one fewer name than a level-1 office —
 * previously level 1 was indistinguishable from owning nothing, because the
 * lookup defaulted to 1, so the first $6,000 bought literally no change.
 */
export function scoutShortlistSize(officeLevel: number): number {
  if (
    !Number.isSafeInteger(officeLevel) ||
    officeLevel < 0 ||
    officeLevel > 3
  ) {
    throw new Error('Scout Office level must be an integer from 0 to 3');
  }
  return 2 + officeLevel;
}

function absoluteCareerWeek(state: Pick<GameState, 'season' | 'week'>): number {
  return (state.season - 1) * 30 + state.week;
}

function marketPersonality(personality?: PlayerPersonality): MarketPersonality {
  return (personality ?? 'Professional')
    .toUpperCase()
    .replace('-', '_') as MarketPersonality;
}

function scoutRegion(playerId: string): ScoutRegion {
  const regions: readonly ScoutRegion[] = [
    'LOCAL',
    'EUROPE',
    'SOUTH_AMERICA',
    'AFRICA',
    'ASIA',
  ];
  let hash = 0x811c9dc5;
  for (let index = 0; index < playerId.length; index += 1) {
    hash = Math.imul(hash ^ playerId.charCodeAt(index), 0x01000193);
  }
  return regions[(hash >>> 0) % regions.length];
}

function userClub(state: GameState) {
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined)
    throw new Error(`unknown user club ${state.userClubId}`);
  return club;
}

function userCareerPlayer(state: GameState, playerId: string): CareerPlayer {
  const player = state.players.find(
    (candidate) =>
      candidate.id === playerId && candidate.clubId === state.userClubId,
  );
  if (player === undefined)
    throw new Error(`unknown user-club player ${playerId}`);
  return player;
}

function sellingQuoteForBuyer(
  state: GameState,
  player: CareerPlayer,
  buyerClubId: string,
  division: number,
): TransferQuote {
  const quote = sellingTransferQuote(
    { ...valuationPlayer(player), id: `${player.id}@${buyerClubId}` },
    {
      careerSeed: state.careerSeed,
      season: state.season,
      week: state.week,
      sellingClubDivision: division,
    },
  );
  return { ...quote, playerId: player.id };
}

function varyListedBidQuote(
  state: GameState,
  player: CareerPlayer,
  buyerClubId: string,
  buyerCash: number,
  quote: TransferQuote,
  division: number,
): TransferQuote {
  const variationRoll = sellingTransferQuote(
    { ...valuationPlayer(player), id: `${player.id}@${buyerClubId}:variation` },
    {
      careerSeed: state.careerSeed,
      season: state.season,
      week: state.week,
      sellingClubDivision: division,
    },
  ).bandPercent;
  const variationPercent = ((variationRoll - 80) % 11) - 5;
  const fee = Math.min(
    buyerCash,
    Math.round(
      checkedMultiply(quote.fee, 100 + variationPercent, 'transfer bid') / 100,
    ),
  );
  return {
    ...quote,
    fee,
    bandPercent: Math.round(
      checkedMultiply(fee, 100, 'transfer bid percentage') / quote.valuation,
    ),
  };
}

function hasCoachingOffice(state: GameState): boolean {
  return coachingOfficeLevel(state) > 0;
}

/**
 * The operational Coaching Office's level, or 0 when the club has none.
 *
 * A site under construction is not operational, so a club that has just
 * ordered the upgrade keeps the old level until the works finish — the same
 * rule every other facility benefit follows.
 */
export function coachingOfficeLevel(state: GameState): number {
  const grid = state.facilities.grid;
  const office = grid?.buildings.find(
    (building) =>
      building.type === 'coaching-office' &&
      isFacilityOperational(grid, building.id),
  );
  return office?.level ?? 0;
}

/**
 * Seasons a coach must serve for his next level, by office level.
 *
 * The office is what the building does for BOTH coaches: at level 2 it hires
 * better, at level 3 it develops twice as fast. It is deliberately not another
 * training-point tap — the club already has three of those, and the weekly
 * income was cut on purpose.
 */
export function coachSeasonsPerLevel(officeLevel: number): number {
  return officeLevel >= 3 ? 1 : 2;
}

/** Levels a newly hired coach gains from the office he walks into. */
export function coachHireLevelBonus(officeLevel: number): number {
  return officeLevel >= 2 ? 1 : 0;
}

function careerClubFame(state: GameState, market: CareerMarketState): number {
  return Math.max(
    0,
    Math.min(
      CAREER_CLUB_FAME_CEILING,
      state.players
        .filter((player) => player.clubId === state.userClubId)
        .reduce(
          (sum, player) => checkedAdd(sum, player.fame ?? 0, 'club fame'),
          market.clubFameAdjustment ?? 0,
        ),
    ),
  );
}

/** @i18n-fallback Role labels below are developer-only overflow-check names. */
function progressEmployedCoach(
  coach: CoachCandidate | undefined,
  previousSeasonsEmployed: number | undefined,
  role: CareerCoachRole,
  officeLevel: number,
): { coach: CoachCandidate; seasonsEmployed: number } | undefined {
  if (coach === undefined) return undefined;
  const label = role === 'HEAD' ? 'head coach' : 'assistant coach';
  const seasonsEmployed = checkedAdd(
    previousSeasonsEmployed ?? 0,
    1,
    `${label} seasons employed`,
  );
  const level =
    seasonsEmployed % coachSeasonsPerLevel(officeLevel) === 0
      ? Math.min(5, coach.level + 1)
      : coach.level;
  const loyaltyPercent = 100 - coach.loyaltyDiscountPercent;
  const headCoachWage = Math.round(
    (checkedMultiply(COACH_WAGE_PER_LEVEL, level, `${label} base wage`) *
      loyaltyPercent) /
      100,
  );
  const weeklyWage = coachWeeklyWageForRole(
    { weeklyWage: headCoachWage },
    role,
  );
  return { coach: { ...coach, level, weeklyWage }, seasonsEmployed };
}

function assertManagePhase(state: GameState): void {
  if (state.phase !== 'manage')
    throw new Error('market decisions require the manage phase');
}

function assertSeasonEndPhase(state: GameState): void {
  if (state.phase !== 'season-end')
    throw new Error('renewal talks require the season-end phase');
}

function expiredUserPlayer(state: GameState, playerId: string): CareerPlayer {
  const player = state.players.find(
    (candidate) =>
      candidate.id === playerId && candidate.clubId === state.userClubId,
  );
  if (player === undefined)
    throw new Error(`unknown user-club player ${playerId}`);
  if (player.contractSeasonsRemaining !== 0)
    throw new Error('only an expired contract may be negotiated');
  return player;
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result))
    throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

function checkedSubtract(left: number, right: number, label: string): number {
  const result = left - right;
  if (!Number.isSafeInteger(result) || result < 0)
    throw new Error(`${label} is invalid`);
  return result;
}

function checkedMultiply(left: number, right: number, label: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result))
    throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

/**
 * A scout-only hero, built at D1 marquee level.
 *
 * `count: 1, order: 1` because these four are never teammates — there is no club
 * ranking for them to sit inside, so each is simply the top of the market.
 */
function buildUnattachedSpecialHero(hero: SpecialHero): CareerPlayer {
  const base = DIVISION_STRENGTH_BANDS[1][1];
  const attrs = specialHeroAttrs(
    hero.role,
    specialHeroTargetOverall(base, 1, 1),
  );
  const potential = 5;
  return {
    id: hero.id,
    clubId: SPECIAL_UNATTACHED_CLUB_ID,
    name: hero.name,
    role: hero.role,
    lookId: hero.lookId,
    attrs,
    power: hero.power,
    powerTier: 3,
    licensed: false,
    weeklyWage: generatedPlayerWeeklyWage(attrs, 1),
    onHeroWage: true,
    contractSeasonsRemaining: 0,
    morale: 70,
    injuryWeeks: 0,
    age: 26,
    archetype: 'All-Rounder',
    potential,
    potentialCeiling: developmentPotentialCeiling({
      id: hero.id,
      role: hero.role,
      attrs,
      age: 26,
      potential,
    }),
    consistency: 90,
    personality: 'Professional',
    condition: 100,
    seasonsAtClub: 0,
    fame: 0,
    retirementAge: 36,
    retirementAnnounced: false,
    consecutiveLowMoraleWeeks: 0,
    signingStatTotal: Object.values(attrs).reduce(
      (sum, value) => sum + value,
      0,
    ),
  };
}
