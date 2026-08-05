import { compareIds } from './ordering';

import {
  buyingTransferQuote,
  CAREER_CLUB_FAME_CEILING,
  generatedPlayerWeeklyWage,
  generateCoachMarket,
  isCoachCandidateEligible,
  isTransferWindowOpen,
  renewalContractAsk,
  renewalFamePercent,
  resolveScoutMission,
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
import { developmentPotentialCeiling, potentialTierForDivision } from './archetype-caps';
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
import type { DivisionLevel, PyramidClub, PyramidPlayer } from './pyramid';
import { assertContractTermFitsCareer } from './retirement';
import { assertUserCareerRosterSpace } from './youth-intake';
import { isStoryScoutingUnlocked } from './story-progression';
import {
  applyCareerContractPromise,
  clearCareerContractPromise,
} from './contract-promises';
import {
  clearMetBoardUltimatum,
  reconcileBoardUltimatumCandidates,
} from './board-ultimatum';
import { highestDivisionReached } from './promotion-progression';

const DEFAULT_COACH_CONTENT_UNLOCK_IDS = [
  'formation:4-3-3',
] as const;

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
    : Math.round(coach.weeklyWage * ASSISTANT_COACH_WAGE_PERCENT / 100);
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

/** Plain M2 market state designed to live inside a schema-versioned career save. */
export interface CareerMarketState {
  readonly nextMissionNumber: number;
  readonly activeScoutMission?: ScoutMission;
  readonly scoutReports: readonly ScoutReport[];
  readonly coachCandidates: readonly CoachCandidate[];
  readonly headCoach?: CoachCandidate;
  readonly headCoachSeasonsEmployed?: number;
  readonly assistantCoach?: CoachCandidate;
  readonly assistantCoachSeasonsEmployed?: number;
  readonly unlockedCoachContentIds?: readonly string[];
  readonly transferListings?: readonly CareerTransferListing[];
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
  const talks = kind === 'transfer' ? market.transferTalks : market.renewalTalks;
  const consequence = talks?.negotiation.consequence;
  if (talks === undefined || consequence === undefined || talks.consequenceApplied === true) {
    return { state, market };
  }
  const target = careerTransferTarget(state, talks.playerId);
  if (target === undefined) throw new Error(`unknown negotiation player ${talks.playerId}`);
  const nextMorale = Math.max(0, Math.min(100, target.player.morale + consequence.moraleDelta));
  const nextState = target.active
    ? {
        ...state,
        players: state.players.map(candidate => candidate.id === target.player.id
          ? { ...candidate, morale: nextMorale }
          : candidate),
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
    scoutOfficeLevel: scoutReportLevel(state),
    division,
  });
  const club = userClub(state);
  if (club.cash < mission.cost) throw new Error('the scouting mission is not affordable');
  const chargedState: GameState = {
    ...state,
    clubs: state.clubs.map(candidate => candidate.id === state.userClubId
      ? { ...candidate, cash: candidate.cash - mission.cost }
      : candidate),
  };
  return {
    state: recordCashTransaction(chargedState, {
      kind: 'scouting',
      label: `Scouting mission · ${readableRegion(region)}`,
      amount: -mission.cost,
      referenceId: mission.id,
    }),
    market: {
      ...market,
      nextMissionNumber: market.nextMissionNumber + 1,
      activeScoutMission: mission,
    },
  };
}

export function resolveCareerScoutClock(
  state: GameState,
  market: CareerMarketState,
): CareerMarketState {
  const currentMarket = expireCareerTransferTalks(state, expireCareerTransferListings(state, market));
  const mission = currentMarket.activeScoutMission;
  if (mission === undefined || absoluteCareerWeek(state) < mission.dueWeek) return currentMarket;
  const result = resolveScoutMission(
    mission,
    absoluteCareerWeek(state),
    scoutableCareerPlayers(state),
    scoutShortlistSize(scoutOfficeLevel(state)),
  );
  return {
    ...currentMarket,
    activeScoutMission: undefined,
    scoutReports: result.reports,
  };
}

/** Removes saved bids as soon as their exact registration window ends. */
export function expireCareerTransferListings(
  state: Pick<GameState, 'season' | 'week'>,
  market: CareerMarketState,
): CareerMarketState {
  const listings = market.transferListings ?? [];
  const active = listings.filter(listing => listingBelongsToCurrentWindow(state, listing));
  if (active.length === listings.length) return market;
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
  if (talks === undefined || talksBelongToCurrentWindow(state, talks)) return market;
  return { ...market, transferTalks: undefined };
}

/** The opening week is embedded in the negotiation id, so the quote's window is recoverable. */
function talksBelongToCurrentWindow(
  state: Pick<GameState, 'season' | 'week'>,
  talks: CareerTransferTalks,
): boolean {
  const opened = /^transfer-s(\d+)-w(\d+)-/.exec(talks.negotiation.id);
  if (opened === null) return false;
  return listingBelongsToCurrentWindow(state, {
    listedSeason: Number(opened[1]),
    listedWeek: Number(opened[2]),
  });
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
      ...(market.abandonedTransferNegotiationIds ?? []).filter(id => id.startsWith(weekPrefix)),
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
  if (!isTransferWindowOpen(state.week)) throw new Error('the transfer window is closed');
  // Matches the renewal guard. Without it, closing a rejected negotiation and
  // reopening it dealt the same deterministic pitch cards at round 0, so the
  // three-round cap and the walk-away penalty could both be retried away.
  if (market.transferTalks !== undefined) throw new Error('another transfer is already being negotiated');
  if ((market.abandonedTransferNegotiationIds ?? []).includes(transferNegotiationId(state, playerId))) {
    throw new Error('That agent has ended talks for this week. Try again next week.');
  }
  if (!market.scoutReports.some(report => report.playerId === playerId)) {
    throw new Error('a player must be scouted before transfer talks');
  }
  const target = careerTransferTarget(state, playerId, division);
  if (target === undefined) {
    throw new Error(`unknown transfer target ${playerId}`);
  }
  const player = target.player;
  if (!sellerCanSpare(state, playerId)) {
    throw new Error(`${player.name}'s club has no other cover for that position and will not sell.`);
  }
  const quote = buyingTransferQuote(valuationPlayer(player), {
    careerSeed: state.careerSeed,
    season: state.season,
    week: state.week,
    sellingClubDivision: target.sellingClubDivision,
  });
  const weeklyAsk = Math.max(1, Math.round(player.weeklyWage * (player.power ? 3.5 : 1.2)));
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
  market: CareerMarketState,
  offer: ContractOffer,
  pitchCard?: PitchCard,
): CareerMarketState {
  if (market.transferTalks === undefined) throw new Error('there are no active transfer talks');
  return {
    ...market,
    transferTalks: {
      ...market.transferTalks,
      negotiation: submitContractOffer(market.transferTalks.negotiation, offer, pitchCard),
    },
  };
}

export function completeCareerTransfer(
  state: GameState,
  market: CareerMarketState,
): CareerMarketTransaction {
  assertManagePhase(state);
  if (!isTransferWindowOpen(state.week)) throw new Error('the transfer window is closed');
  const talks = market.transferTalks;
  if (talks?.negotiation.status !== 'ACCEPTED' || talks.negotiation.acceptedOffer === undefined) {
    throw new Error('a transfer requires an accepted player contract');
  }
  // Belt over the weekly expiry clock: a stale save could still hand this a
  // deal priced in an earlier window.
  if (!talksBelongToCurrentWindow(state, talks)) {
    throw new Error('these talks expired with their transfer window; reopen them at the current price');
  }
  const target = careerTransferTarget(state, talks.playerId);
  if (target === undefined) {
    throw new Error(`unknown transfer target ${talks.playerId}`);
  }
  const player = target.player;
  // Re-checked at completion: another purchase between opening talks and
  // signing can take the club's remaining cover for this position.
  if (!sellerCanSpare(state, player.id)) {
    throw new Error(`${player.name}'s club has no other cover for that position and will not sell.`);
  }
  assertUserCareerRosterSpace(state);
  const buyer = userClub(state);
  if (buyer.cash < talks.transferQuote.fee) throw new Error('the transfer fee is not affordable');
  const offer = talks.negotiation.acceptedOffer;
  const sellerClubId = player.clubId;
  const lineups = target.active ? replaceTransferredStarter(state, player) : state.lineups;
  assertContractTermFitsCareer(player, offer.termSeasons, state.careerSeed, 'signing');
  const transferred: CareerPlayer = {
    ...player,
    clubId: state.userClubId,
    weeklyWage: offer.weeklyWage,
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
      clubs: state.clubs.map(club => {
        if (club.id === state.userClubId) {
          return {
            ...club,
            cash: club.cash - talks.transferQuote.fee,
            weeklyWages: checkedAdd(club.weeklyWages, offer.weeklyWage, 'buyer weekly wages'),
          };
        }
        if (club.id === sellerClubId) {
          return {
            ...club,
            cash: checkedAdd(club.cash, talks.transferQuote.fee, 'seller cash'),
            weeklyWages: checkedSubtract(club.weeklyWages, player.weeklyWage, 'seller weekly wages'),
          };
        }
        return club;
      }),
      players: target.active
        ? state.players.map(candidate => candidate.id === player.id ? transferred : candidate)
        : [...state.players, transferred],
      lineups,
    };
  const persistedState = persistCareerTransferInPyramid(transferredState, player);
  const recordedState = recordCashTransaction(persistedState, {
      kind: 'transfer-buy',
      label: `Signed ${player.name}`,
      amount: -talks.transferQuote.fee,
      referenceId: player.id,
    });
  return {
    state: applyCareerContractPromise(recordedState, player.id, offer.perk),
    market: {
      ...market,
      scoutReports: market.scoutReports.filter(report => report.playerId !== player.id),
      transferTalks: undefined,
    },
  };
}

/** Opens deterministic player-facing talks for an expired M2 contract. */
export function beginCareerRenewalTalks(
  state: GameState,
  market: CareerMarketState,
  playerId: string,
): CareerMarketState {
  assertSeasonEndPhase(state);
  if (market.renewalTalks !== undefined) throw new Error('another renewal is already being negotiated');
  if ((market.abandonedRenewalNegotiationIds ?? []).includes(renewalNegotiationId(state, playerId))) {
    throw new Error('That agent has ended talks for this season. Renew or release at the next contract.');
  }
  const player = expiredUserPlayer(state, playerId);
  const loyalty = playerLoyalty(player, state.careerSeed);
  // Below the threshold there is no number that buys them. The manager has
  // watched this fall on the player card all season and Bert said it would land
  // here, so it is a consequence rather than an ambush.
  if (!willRenegotiate(loyalty)) {
    throw new Error(
      `${player.name} will not re-sign. Loyalty below ${LOYALTY_NO_RENEWAL_THRESHOLD} ends talks before they start.`,
    );
  }
  const weeklyAsk = renewalContractAsk({
    weeklyWage: player.weeklyWage,
    personality: marketPersonality(player.personality),
    ...(player.power === undefined ? {} : { power: player.power }),
    onHeroWage: player.onHeroWage,
  }, {
    growthSinceSigningPercent: growthSinceSigningPercent(player),
    famePercent: renewalFamePercent(player.fame ?? 0),
    heroMultiplier: 4,
    loyaltyPercent: loyaltyRenewalPercent(loyalty),
  });
  return {
    ...market,
    renewalTalks: {
      playerId,
      negotiation: startContractNegotiation({
        careerSeed: state.careerSeed,
        negotiationId: renewalNegotiationId(state, playerId),
        playerId,
        personality: marketPersonality(player.personality),
        weeklyAsk,
      }),
    },
  };
}

export function submitCareerRenewalOffer(
  market: CareerMarketState,
  offer: ContractOffer,
  pitchCard?: PitchCard,
): CareerMarketState {
  if (market.renewalTalks === undefined) throw new Error('there are no active renewal talks');
  return {
    ...market,
    renewalTalks: {
      ...market.renewalTalks,
      negotiation: submitContractOffer(market.renewalTalks.negotiation, offer, pitchCard),
    },
  };
}

/** Applies the accepted wage/term and clears talks so the next expired deal can be resolved. */
export function completeCareerRenewal(
  state: GameState,
  market: CareerMarketState,
): CareerMarketTransaction {
  assertSeasonEndPhase(state);
  const talks = market.renewalTalks;
  const accepted = talks?.negotiation.acceptedOffer;
  if (talks?.negotiation.status !== 'ACCEPTED' || accepted === undefined) {
    throw new Error('a renewal requires an accepted player contract');
  }
  const player = expiredUserPlayer(state, talks.playerId);
  const wageDelta = accepted.weeklyWage - player.weeklyWage;
  assertContractTermFitsCareer(player, accepted.termSeasons, state.careerSeed, 'renewal');
  const renewed: CareerPlayer = {
    ...player,
    weeklyWage: accepted.weeklyWage,
    contractSeasonsRemaining: accepted.termSeasons,
    onHeroWage: player.power !== undefined || player.onHeroWage,
    signingStatTotal: playerStatTotal(player),
    transferRequested: false,
  };
  const renewedState: GameState = {
    ...state,
    clubs: state.clubs.map(club => club.id === state.userClubId
      ? { ...club, weeklyWages: checkedAdd(club.weeklyWages, wageDelta, 'renewal payroll') }
      : club),
    players: state.players.map(candidate => candidate.id === player.id ? renewed : candidate),
  };
  return {
    state: applyCareerContractPromise(renewedState, player.id, accepted.perk),
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
      ...(market.abandonedRenewalNegotiationIds ?? []).filter(id => id.startsWith(seasonPrefix)),
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
  if (!isTransferWindowOpen(state.week)) throw new Error('the transfer window is closed');
  const currentMarket = expireCareerTransferListings(state, market);
  const player = userCareerPlayer(state, playerId);
  if (player.contractSeasonsRemaining < 1) {
    throw new Error('an expired player cannot be transfer-listed');
  }
  if ((currentMarket.transferListings ?? []).some(listing => listing.playerId === playerId)) {
    throw new Error(`${player.name} is already transfer-listed`);
  }
  // Validate that accepting a future bid cannot strand the starting eleven.
  replaceTransferredStarter(state, player);
  assertUserSaleKeepsSquadCover(state, player);
  const bids = state.clubs
    .filter(club => club.id !== state.userClubId)
    .map(club => ({ club, quote: sellingQuoteForBuyer(state, player, club.id, division) }))
    .filter(candidate => candidate.club.cash >= candidate.quote.fee)
    .sort((left, right) => (
      right.quote.fee - left.quote.fee || compareIds(left.club.id, right.club.id)
    ))
    .slice(0, 3)
    .map(({ club, quote }) => ({
      id: `bid-s${state.season}-w${state.week}-${player.id}-${club.id}`,
      playerId: player.id,
      buyerClubId: club.id,
      quote,
      madeSeason: state.season,
      madeWeek: state.week,
    }));
  if (bids.length === 0) throw new Error('no club can afford to bid for this player');
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
  if (!isTransferWindowOpen(state.week)) throw new Error('the transfer window is closed');
  const listing = (market.transferListings ?? []).find(candidate => (
    candidate.bids.some(bid => bid.id === bidId)
  ));
  const bid = listing?.bids.find(candidate => candidate.id === bidId);
  if (listing === undefined || bid === undefined) throw new Error(`unknown transfer bid ${bidId}`);
  if (!listingBelongsToCurrentWindow(state, listing)) {
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
      transferListings: (result.market.transferListings ?? [])
        .filter(candidate => candidate.playerId !== listing.playerId),
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
  if (!isTransferWindowOpen(state.week)) throw new Error('the transfer window is closed');
  const player = state.players.find(candidate => (
    candidate.id === playerId && candidate.clubId === state.userClubId
  ));
  if (player === undefined) throw new Error(`unknown user-club player ${playerId}`);
  const buyer = state.clubs.find(club => club.id === buyerClubId && club.id !== state.userClubId);
  if (buyer === undefined) throw new Error(`unknown buying club ${buyerClubId}`);
  const quote = sellingQuoteForBuyer(state, player, buyerClubId, division);
  return completeCareerPlayerSale(state, market, playerId, buyerClubId, quote);
}

function completeCareerPlayerSale(
  state: GameState,
  market: CareerMarketState,
  playerId: string,
  buyerClubId: string,
  quote: TransferQuote,
): CareerMarketTransaction {
  const player = userCareerPlayer(state, playerId);
  const buyer = state.clubs.find(club => club.id === buyerClubId && club.id !== state.userClubId);
  if (buyer === undefined) throw new Error(`unknown buying club ${buyerClubId}`);
  if (quote.playerId !== playerId) throw new Error('the transfer bid does not match the listed player');
  if (buyer.cash < quote.fee) throw new Error('the buying club cannot afford the transfer fee');
  assertUserSaleKeepsSquadCover(state, player);
  const lineups = replaceTransferredStarter(state, player);
  const transferredState: GameState = {
      ...state,
      clubs: state.clubs.map(club => {
        if (club.id === state.userClubId) {
          return {
            ...club,
            cash: checkedAdd(club.cash, quote.fee, 'transfer sale cash'),
            weeklyWages: checkedSubtract(club.weeklyWages, player.weeklyWage, 'seller weekly wages'),
          };
        }
        if (club.id === buyerClubId) {
          return {
            ...club,
            cash: checkedSubtract(club.cash, quote.fee, 'buyer transfer cash'),
            weeklyWages: checkedAdd(club.weeklyWages, player.weeklyWage, 'buyer weekly wages'),
          };
        }
        return club;
      }),
      players: state.players.map(candidate => candidate.id === player.id
        ? { ...clearCareerContractPromise(candidate), clubId: buyerClubId, licensed: false }
        : candidate),
      lineups,
    };
  const recordedState = recordCashTransaction(transferredState, {
      kind: 'transfer-sell',
      label: `Sold ${player.name}`,
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
      transferListings: (market.transferListings ?? [])
        .filter(listing => listing.playerId !== playerId),
    },
  };
}

function listingBelongsToCurrentWindow(
  state: Pick<GameState, 'season' | 'week'>,
  listing: Pick<CareerTransferListing, 'listedSeason' | 'listedWeek'>,
): boolean {
  if (state.season !== listing.listedSeason) return false;
  return transferWindowNumber(state.week) !== undefined
    && transferWindowNumber(state.week) === transferWindowNumber(listing.listedWeek);
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
  const candidate = market.coachCandidates.find(coach => coach.id === coachId);
  if (candidate === undefined) throw new Error(`unknown coach candidate ${coachId}`);
  const currentCoach = role === 'HEAD' ? market.headCoach : market.assistantCoach;
  if (currentCoach !== undefined && currentCoach.id !== candidate.id) {
    throw new Error(`dismiss the current ${role === 'HEAD' ? 'head' : 'assistant'} coach before hiring another`);
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
  const unlocks = candidate.unlockId === undefined
    ? [...(market.unlockedCoachContentIds ?? [])]
    : Array.from(new Set([...(market.unlockedCoachContentIds ?? []), candidate.unlockId]));
  const employed = { ...candidate, weeklyWage };
  return {
    ...market,
    coachCandidates: market.coachCandidates.filter(coach => coach.id !== coachId),
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
  if (coach === undefined) throw new Error(`there is no ${roleLabel} coach to dismiss`);
  const club = userClub(state);
  const severance = coach.weeklyWage;
  if (club.cash < severance) throw new Error('the club cannot afford the coach severance');
  const dismissedState: GameState = {
    ...state,
    clubs: state.clubs.map(candidate => candidate.id === state.userClubId
      ? { ...candidate, cash: checkedSubtract(candidate.cash, severance, 'coach severance') }
      : candidate),
  };
  return {
    state: recordCashTransaction(dismissedState, {
      kind: 'coach-dismissal',
      label: `Severance · ${coach.name}`,
      amount: -severance,
      referenceId: coach.id,
    }),
    market: {
      ...market,
      ...(role === 'HEAD'
        ? { headCoach: undefined, headCoachSeasonsEmployed: undefined }
        : { assistantCoach: undefined, assistantCoachSeasonsEmployed: undefined }),
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

export function careerCoachUnlockedFormationIds(market: CareerMarketState): string[] {
  return (market.unlockedCoachContentIds ?? [])
    .filter(id => id.startsWith('formation:'))
    .map(id => id.slice('formation:'.length));
}

/** Refreshes candidates while retaining and progressing the employed head coach. */
export function refreshCareerMarketForNewSeason(
  state: GameState,
  previous: CareerMarketState,
  division = 5,
  clubFame = 0,
): CareerMarketState {
  const unlockedContent = new Set(previous.unlockedCoachContentIds ?? []);
  const employedPortraitIds = [previous.headCoach?.portraitId, previous.assistantCoach?.portraitId]
    .filter((portraitId): portraitId is string => portraitId !== undefined);
  const refreshed = createCareerMarketState(
    state,
    division,
    clubFame,
    employedPortraitIds,
    DEFAULT_COACH_CONTENT_UNLOCK_IDS.filter(id => !unlockedContent.has(id)),
  );
  const currentTransferTargetIds = new Set(
    allCareerTransferTargets(state).map(target => target.player.id),
  );
  const scoutReports = previous.scoutReports.filter(report => (
    currentTransferTargetIds.has(report.playerId)
  ));
  const head = progressEmployedCoach(
    previous.headCoach,
    previous.headCoachSeasonsEmployed,
    'HEAD',
  );
  const assistant = progressEmployedCoach(
    previous.assistantCoach,
    previous.assistantCoachSeasonsEmployed,
    'ASSISTANT',
  );
  return {
    ...refreshed,
    nextMissionNumber: previous.nextMissionNumber,
    activeScoutMission: previous.activeScoutMission,
    scoutReports,
    ...(head === undefined
      ? {}
      : { headCoach: head.coach, headCoachSeasonsEmployed: head.seasonsEmployed }),
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

function readableRegion(region: ScoutRegion): string {
  return region.toLowerCase().split('_').map(word => (
    `${word.charAt(0).toUpperCase()}${word.slice(1)}`
  )).join(' ');
}

export function careerCoachWeeklyWage(market: CareerMarketState): number {
  return checkedAdd(
    market.headCoach?.weeklyWage ?? 0,
    market.assistantCoach?.weeklyWage ?? 0,
    'coaching staff weekly wage',
  );
}

function scoutableCareerPlayers(state: GameState): ScoutablePlayer[] {
  return allCareerTransferTargets(state).map(({ player }) => ({
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
    }));
}

/** Resolves a scouted target from either the active division or the persistent pyramid. */
export function careerTransferTarget(
  state: GameState,
  playerId: string,
  fallbackDivision = 5,
): CareerTransferTarget | undefined {
  const active = state.players.find(candidate => (
    candidate.id === playerId && candidate.clubId !== state.userClubId
  ));
  if (active !== undefined) {
    return {
      player: active,
      sellingClubDivision: pyramidDivisionForClub(state, active.clubId) ?? fallbackDivision,
      active: true,
    };
  }
  if (state.m2 === undefined) return undefined;
  for (const division of state.m2.pyramid.divisions) {
    for (const club of division.clubs) {
      if (club.id === state.userClubId) continue;
      const player = club.squad.find(candidate => candidate.id === playerId);
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
  const power = eligibleIndex >= 0 && eligibleIndex < heroCount
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
      : { power, powerTier: (division === 1 ? 3 : division <= 3 ? 2 : 1) as 1 | 2 | 3 }),
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
    signingStatTotal: Object.values(player.attrs).reduce((sum, value) => sum + value, 0),
  };
}

function opponentPotential(playerId: string, division: DivisionLevel): 1 | 2 | 3 | 4 | 5 {
  let value = 2166136261;
  for (let index = 0; index < playerId.length; index += 1) {
    value = Math.imul(value ^ playerId.charCodeAt(index), 16777619) >>> 0;
  }
  return potentialTierForDivision(division, value % 100);
}

function pyramidDivisionForClub(state: GameState, clubId: string): DivisionLevel | undefined {
  return state.m2?.pyramid.divisions.find(division => (
    division.clubs.some(club => club.id === clubId)
  ))?.level;
}

function updatePyramidPlayerMorale(
  state: GameState,
  playerId: string,
  morale: number,
): GameState {
  if (state.m2 === undefined) throw new Error(`unknown negotiation player ${playerId}`);
  return {
    ...state,
    m2: {
      ...state.m2,
      pyramid: {
        ...state.m2.pyramid,
        divisions: state.m2.pyramid.divisions.map(division => ({
          ...division,
          clubs: division.clubs.map(club => ({
            ...club,
            squad: club.squad.map(player => player.id === playerId ? { ...player, morale } : player),
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
  const activeSellerId = state.players
    .find(candidate => candidate.id === playerId && candidate.clubId !== state.userClubId)
    ?.clubId;
  if (activeSellerId !== undefined) {
    return coversLineupTemplate(state.players.filter(candidate => (
      candidate.clubId === activeSellerId && candidate.id !== playerId
    )));
  }
  if (state.m2 === undefined) return true;
  for (const division of state.m2.pyramid.divisions) {
    for (const club of division.clubs) {
      if (!club.squad.some(candidate => candidate.id === playerId)) continue;
      return coversLineupTemplate(club.squad.filter(candidate => candidate.id !== playerId));
    }
  }
  return true;
}

function coversLineupTemplate(
  squad: ReadonlyArray<{ readonly role: CareerPlayer['role'] }>,
): boolean {
  return SELLER_LINEUP_TEMPLATE.every(([role, needed]) => (
    squad.filter(candidate => candidate.role === role).length >= needed
  ));
}

function persistCareerTransferInPyramid(
  state: GameState,
  sourcePlayer: CareerPlayer,
): GameState {
  if (state.m2 === undefined) return state;
  const sourceIsActive = state.clubs.some(club => club.id === sourcePlayer.clubId);
  let m2 = state.m2;
  if (!sourceIsActive) {
    m2 = {
      ...m2,
      pyramid: {
        ...m2.pyramid,
        divisions: m2.pyramid.divisions.map(division => ({
          ...division,
          clubs: division.clubs.map(club => {
            if (club.id !== sourcePlayer.clubId) return club;
            const squad = club.squad.filter(player => player.id !== sourcePlayer.id);
            if (squad.length === club.squad.length) {
              throw new Error(`transfer source ${sourcePlayer.id} is missing from the pyramid`);
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
  return Math.min(300, Math.max(0, Math.floor(((currentTotal - baseline) * 100) / baseline)));
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
  return isAvailableForSelection(candidate)
    && !(candidate.power !== undefined && !candidate.licensed);
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
function assertUserSaleKeepsSquadCover(state: GameState, player: CareerPlayer): void {
  const postSaleLineup = replaceTransferredStarter(state, player)
    .find(lineup => lineup.clubId === state.userClubId);
  if (postSaleLineup === undefined) return;
  const starters = new Set(postSaleLineup.playerIds);
  const spares = state.players.filter(candidate => (
    candidate.clubId === state.userClubId
    && candidate.id !== player.id
    && !starters.has(candidate.id)
    && isEligibleTransferReplacement(candidate)
  ));
  const covered = spares.some(candidate => candidate.role === 'GK')
    && spares.some(candidate => candidate.role !== 'GK');
  if (!covered) {
    throw new Error(
      `Selling ${player.name} would leave the eleven without matchday cover. Keep a spare goalkeeper and an outfield substitute.`,
    );
  }
}

function replaceTransferredStarter(state: GameState, player: CareerPlayer) {
  const lineup = state.lineups.find(candidate => candidate.clubId === player.clubId);
  if (lineup === undefined || !lineup.playerIds.includes(player.id)) return state.lineups;
  const starters = new Set(lineup.playerIds);
  const replacement = state.players.find(candidate => (
    candidate.clubId === player.clubId
    && candidate.id !== player.id
    && !starters.has(candidate.id)
    && isEligibleTransferReplacement(candidate)
    && candidate.role === player.role
  )) ?? state.players.find(candidate => (
    candidate.clubId === player.clubId
    && candidate.id !== player.id
    && !starters.has(candidate.id)
    && isEligibleTransferReplacement(candidate)
    && candidate.role !== 'GK'
    && player.role !== 'GK'
  ));
  if (replacement === undefined) throw new Error('the selling club has no eligible lineup replacement');
  return state.lineups.map(candidate => candidate.clubId === player.clubId
    ? { ...candidate, playerIds: candidate.playerIds.map(id => id === player.id ? replacement.id : id) }
    : candidate);
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
  if (!Number.isSafeInteger(officeLevel) || officeLevel < 0 || officeLevel > 3) {
    throw new Error('Scout Office level must be an integer from 0 to 3');
  }
  return 2 + officeLevel;
}

/**
 * Report precision is stored on the mission when it starts and the save schema
 * accepts 1-3 only, so an office-less club still reads at level-1 precision.
 * Its penalty is the shorter shortlist above, not a vaguer report.
 */
function scoutReportLevel(state: GameState): number {
  return Math.max(1, scoutOfficeLevel(state));
}

function absoluteCareerWeek(state: Pick<GameState, 'season' | 'week'>): number {
  return (state.season - 1) * 30 + state.week;
}

function marketPersonality(personality?: PlayerPersonality): MarketPersonality {
  return (personality ?? 'Professional').toUpperCase().replace('-', '_') as MarketPersonality;
}

function scoutRegion(playerId: string): ScoutRegion {
  const regions: readonly ScoutRegion[] = ['LOCAL', 'EUROPE', 'SOUTH_AMERICA', 'AFRICA', 'ASIA'];
  let hash = 0x811c9dc5;
  for (let index = 0; index < playerId.length; index += 1) {
    hash = Math.imul(hash ^ playerId.charCodeAt(index), 0x01000193);
  }
  return regions[(hash >>> 0) % regions.length];
}

function userClub(state: GameState) {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  return club;
}

function userCareerPlayer(state: GameState, playerId: string): CareerPlayer {
  const player = state.players.find(candidate => (
    candidate.id === playerId && candidate.clubId === state.userClubId
  ));
  if (player === undefined) throw new Error(`unknown user-club player ${playerId}`);
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

function hasCoachingOffice(state: GameState): boolean {
  const grid = state.facilities.grid;
  return grid?.buildings.some(building => (
    building.type === 'coaching-office' && isFacilityOperational(grid, building.id)
  )) === true;
}

function careerClubFame(state: GameState, market: CareerMarketState): number {
  return Math.max(0, Math.min(CAREER_CLUB_FAME_CEILING, state.players
    .filter(player => player.clubId === state.userClubId)
    .reduce((sum, player) => checkedAdd(sum, player.fame ?? 0, 'club fame'), market.clubFameAdjustment ?? 0)));
}

function progressEmployedCoach(
  coach: CoachCandidate | undefined,
  previousSeasonsEmployed: number | undefined,
  role: CareerCoachRole,
): { coach: CoachCandidate; seasonsEmployed: number } | undefined {
  if (coach === undefined) return undefined;
  const label = role === 'HEAD' ? 'head coach' : 'assistant coach';
  const seasonsEmployed = checkedAdd(
    previousSeasonsEmployed ?? 0,
    1,
    `${label} seasons employed`,
  );
  const level = seasonsEmployed % 2 === 0
    ? Math.min(5, coach.level + 1)
    : coach.level;
  const loyaltyPercent = 100 - coach.loyaltyDiscountPercent;
  const headCoachWage = Math.round(
    (checkedMultiply(500, level, `${label} base wage`) * loyaltyPercent) / 100,
  );
  const weeklyWage = coachWeeklyWageForRole({ weeklyWage: headCoachWage }, role);
  return { coach: { ...coach, level, weeklyWage }, seasonsEmployed };
}

function assertManagePhase(state: GameState): void {
  if (state.phase !== 'manage') throw new Error('market decisions require the manage phase');
}

function assertSeasonEndPhase(state: GameState): void {
  if (state.phase !== 'season-end') throw new Error('renewal talks require the season-end phase');
}

function expiredUserPlayer(state: GameState, playerId: string): CareerPlayer {
  const player = state.players.find(candidate => (
    candidate.id === playerId && candidate.clubId === state.userClubId
  ));
  if (player === undefined) throw new Error(`unknown user-club player ${playerId}`);
  if (player.contractSeasonsRemaining !== 0) throw new Error('only an expired contract may be negotiated');
  return player;
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

function checkedSubtract(left: number, right: number, label: string): number {
  const result = left - right;
  if (!Number.isSafeInteger(result) || result < 0) throw new Error(`${label} is invalid`);
  return result;
}

function checkedMultiply(left: number, right: number, label: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result)) throw new Error(`${label} exceeds the safe integer range`);
  return result;
}
