import { currentUserDivision } from '../game/m2-career';
import { isFacilityOperational } from '../game/facilities';
import { isAvailableForSelection } from '../game/lineup';
import {
  careerTransferTarget,
  type CareerMarketState,
} from '../game/market-career';
import {
  CAREER_CLUB_FAME_CEILING,
  type CoachCandidate,
  type ScoutFocus,
  type ScoutMissionResult,
  type ScoutRegion,
  type ScoutReport,
  type ValuationPlayer,
} from '../game/market';
import type { CareerPlayer, GameState } from '../game/types';
import { maxSigningTermSeasons } from '../game/retirement';
import { careerRosterCapacity } from '../game/youth-intake';
import { highestDivisionReached } from '../game/promotion-progression';
import { careerContractPromiseHeroLimit } from '../game/contract-promises';
import {
  isStoryFeaturePacingActive,
  isStoryScoutingUnlocked,
  isStoryYouthUnlocked,
} from '../game/story-progression';
import { copyFor, type CopyFn } from '../i18n';
import { powerDisplayName } from './name-copy';
import type { MarketSectionId } from '../ui/market-models';
import type {
  MarketViewModelSource,
  ScoutMissionOptionSource,
  TransferListingSource,
} from './market-view-model';

const ROTATING_REGIONS: readonly ScoutRegion[] = [
  'EUROPE',
  'AFRICA',
  'ASIA',
];

/**
 * English copy, for every caller that has not threaded a locale through yet.
 * The same lazy shape `application/view-models.ts` uses.
 */
let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

/**
 * Plain adapter for the application boundary. It derives display inputs only;
 * the career and market save objects are never mutated or enriched with UI data.
 */
export function careerMarketViewModelSource(
  state: GameState,
  suppliedMarket?: CareerMarketState,
  t: CopyFn = englishCopy(),
): MarketViewModelSource {
  const market = suppliedMarket ?? state.market;
  if (market === undefined) throw new Error('the career market has not been initialized');
  const userClub = state.clubs.find(club => club.id === state.userClubId);
  if (userClub === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
  const storyPacing = isStoryFeaturePacingActive(state);
  const youthUnlocked = isStoryYouthUnlocked(state);
  const scoutingUnlocked = isStoryScoutingUnlocked(state)
    || market.activeScoutMission !== undefined
    || market.scoutReports.length > 0;
  const rosterCount = state.players.filter(player => player.clubId === state.userClubId).length;
  const rosterCapacity = careerRosterCapacity(state);
  const savedSellListings = new Map((market.transferListings ?? []).map(listing => [
    listing.playerId,
    listing,
  ]));
  const playerSalesUnlocked = !storyPacing
    || savedSellListings.size > 0
    || (scoutingUnlocked && rosterCount >= rosterCapacity);
  const transferDealsUnlocked = !storyPacing
    || market.scoutReports.length > 0
    || market.transferTalks !== undefined
    || playerSalesUnlocked;
  const unlockedSections: MarketSectionId[] = [
    ...(youthUnlocked ? ['YOUTH' as const] : []),
    ...(scoutingUnlocked ? ['SCOUT' as const] : []),
    ...(transferDealsUnlocked ? ['TRANSFERS' as const] : []),
    'COACHES',
  ];
  const reportByPlayerId = new Map(market.scoutReports.map(report => [report.playerId, report]));
  const playerById = new Map(state.players.map(player => [player.id, player]));
  for (const report of market.scoutReports) {
    const target = careerTransferTarget(state, report.playerId, division);
    if (target !== undefined) playerById.set(report.playerId, target.player);
  }
  if (market.transferTalks !== undefined && !playerById.has(market.transferTalks.playerId)) {
    const target = careerTransferTarget(state, market.transferTalks.playerId, division);
    if (target !== undefined) playerById.set(target.player.id, target.player);
  }
  const scoutResult = currentScoutResult(state, market);
  const buyListings = market.scoutReports
    .map(report => {
      const player = playerById.get(report.playerId);
      if (player === undefined || player.clubId === state.userClubId) {
        throw new Error(`scout report ${report.playerId} does not reference a transfer target`);
      }
      return transferListing(
        player,
        t,
        'BUY',
        divisionForClub(state, player.clubId, division),
        report.power !== undefined,
      );
    });
  const sellListings = state.players
    .filter(player => (
      playerSalesUnlocked
      &&
      player.clubId === state.userClubId
      && player.contractSeasonsRemaining > 0
    ))
    .map(player => {
      const saved = savedSellListings.get(player.id);
      const bestBid = saved === undefined
        ? undefined
        : [...saved.bids].sort((left, right) => (
          right.quote.fee - left.quote.fee || left.id.localeCompare(right.id)
        ))[0];
      return transferListing(
        player,
        t,
        'SELL',
        division,
        true,
        saved !== undefined,
        bestBid?.quote,
        saved?.bids.map(bid => ({
          id: bid.id,
          buyerName: state.clubs.find(club => club.id === bid.buyerClubId)?.name ?? bid.buyerClubId,
          quote: bid.quote,
        })),
        saleBlockedReason(state, player, t),
      );
    });
  const transferListings = [...buyListings, ...sellListings].sort((left, right) => {
    if (left.direction !== right.direction) return left.direction === 'BUY' ? -1 : 1;
    return stableTextCompare(left.player.id, right.player.id);
  });
  const identities = market.scoutReports.map(report => {
    const player = playerById.get(report.playerId)!;
    return {
      id: player.id,
      name: player.name,
      lookId: player.lookId,
      ...(report.power === undefined || player.power === undefined
        ? {}
        : {
          powerName: t('market.powerAndTier', {
            power: powerDisplayName(t, player.power),
            tier: player.powerTier ?? 1,
          }),
        }),
    };
  });
  const talks = market.transferTalks;
  const negotiation = talks === undefined
    ? undefined
    : (() => {
        const player = playerById.get(talks.playerId);
        if (player === undefined || player.clubId === state.userClubId) {
          throw new Error(`transfer talks ${talks.playerId} do not reference a transfer target`);
        }
        return {
          state: talks.negotiation,
          playerName: player.name,
          playerRole: player.role,
          lookId: player.lookId,
          openingWeeklyWage: player.weeklyWage,
          wageStep: wageStepFor(player.weeklyWage),
          // Signing, not renewal: the window is open mid-season, so week 30 will
          // still decrement this contract once before the season ends and the
          // term has to cover the season in progress too.
          maxTermSeasons: maxSigningTermSeasons(player, state.careerSeed),
          playerAge: player.age ?? 24,
          contractPromiseContext: {
            state,
            player,
            heroLimit: careerContractPromiseHeroLimit(state),
          },
        };
      })();

  return {
    careerSeed: state.careerSeed,
    season: state.season,
    week: state.week,
    currentCareerWeek: absoluteCareerWeek(state),
    division,
    highestDivisionReached: highestDivisionReached(state),
    fame: clubFame(state),
    cash: userClub.cash,
    unlockedSections,
    scoutOfficeLevel: scoutOfficeLevel(state),
    scoutOptions: scoutingUnlocked ? careerMarketScoutOptions(state, t) : [],
    firstScoutFavorAvailable: market.nextMissionNumber === 1,
    ...(market.activeScoutMission === undefined
      ? {}
      : { activeScoutMission: cloneScoutMission(market.activeScoutMission) }),
    ...(market.activeScoutMissionFeeWaived === true
      ? { activeScoutMissionFeeWaived: true }
      : {}),
    ...(scoutResult === undefined ? {} : { scoutResult }),
    ...(identities.length === 0 ? {} : { scoutedPlayerIdentities: identities }),
    transferListings,
    coachCandidates: market.coachCandidates.map(cloneCoachCandidate),
    ...(market.headCoach === undefined ? {} : { headCoach: cloneCoachCandidate(market.headCoach) }),
    assistantSlotUnlocked: state.facilities.grid?.buildings.some(building => (
      building.type === 'coaching-office'
      && isFacilityOperational(state.facilities.grid!, building.id)
    )) === true,
    ...(market.headCoach === undefined ? {} : { headCoachId: market.headCoach.id }),
    ...(market.assistantCoach === undefined ? {} : { assistantCoachId: market.assistantCoach.id }),
    ...(state.youthIntake === undefined || !youthUnlocked
      ? {}
      : {
          youthIntake: {
            status: state.youthIntake.status,
            declined: state.youthIntake.declined,
            rosterCount,
            rosterCapacity,
            offers: state.youthIntake.offers.map(offer => ({
              player: {
                id: offer.player.id,
                name: offer.player.name,
                role: offer.player.role,
                lookId: offer.player.lookId,
                age: offer.player.age ?? 16,
                potential: offer.player.potential ?? 1,
                archetype: offer.player.archetype ?? 'All-Rounder',
                weeklyWage: offer.player.weeklyWage,
                attrs: offer.player.attrs,
              },
              signingBonus: offer.signingBonus,
            })),
          },
        }),
    ...(negotiation === undefined ? {} : { negotiation }),
  };
}

/** Promotion adds briefs without replacing the familiar searches below them. */
export function careerMarketScoutOptions(
  state: Pick<GameState, 'careerSeed' | 'season' | 'week'> & Partial<Pick<GameState, 'm2'>>,
  t: CopyFn = englishCopy(),
): ScoutMissionOptionSource[] {
  if (!Number.isInteger(state.careerSeed) || state.careerSeed < 0 || state.careerSeed > 4294967295) {
    throw new Error('market option career seed must be a uint32');
  }
  if (!Number.isSafeInteger(state.season) || state.season < 1) {
    throw new Error('market option season must be a positive safe integer');
  }
  if (!Number.isSafeInteger(state.week) || state.week < 1 || state.week > 30) {
    throw new Error('market option week must be an integer from 1 to 30');
  }
  const cursor = marketCursor(state.careerSeed, state.season, state.week);
  const secondRegion = ROTATING_REGIONS[cursor % ROTATING_REGIONS.length];
  const heroRegion = ROTATING_REGIONS[(cursor + 1) % ROTATING_REGIONS.length];
  const eliteRegion = ROTATING_REGIONS[(cursor + 2) % ROTATING_REGIONS.length];
  const progressionDivision = state.m2 === undefined
    ? 5
    : Math.min(currentUserDivision(state.m2), state.m2.highestDivisionReached ?? 5);

  const options: ScoutMissionOptionSource[] = [
    {
      id: `scout-brief-s${state.season}-w${state.week}-local-youth`,
      region: 'LOCAL',
      focus: { kind: 'AGE', minimumAge: 16, maximumAge: 21 },
      regionLabel: t('market.scoutBrief.localCircuit'),
      detail: t('market.scoutBrief.localYouth'),
    },
    {
      id: `scout-brief-s${state.season}-w${state.week}-south_america-def`,
      region: 'SOUTH_AMERICA',
      focus: { kind: 'POSITION', role: 'DEF' },
      detail: t('market.scoutBrief.firstTeamDefender'),
    },
  ];
  if (progressionDivision <= 4) options.push(
    {
      id: `scout-brief-s${state.season}-w${state.week}-${secondRegion.toLowerCase()}-prime`,
      region: secondRegion,
      focus: { kind: 'AGE', minimumAge: 22, maximumAge: 29 },
      detail: t('market.scoutBrief.primeYears'),
    },
  );
  if (progressionDivision <= 3) options.push(
    {
      id: `scout-brief-s${state.season}-w${state.week}-${heroRegion.toLowerCase()}-hero`,
      region: heroRegion,
      focus: { kind: 'RUMORED_HERO' },
      detail: t('market.scoutBrief.powerRumor'),
    },
  );
  if (progressionDivision <= 2) options.push({
    id: `scout-brief-s${state.season}-w${state.week}-${eliteRegion.toLowerCase()}-elite`,
    region: eliteRegion,
    focus: { kind: 'ELITE_PROSPECT' },
    detail: t('market.scoutBrief.eliteProspect'),
  });
  return options;
}

function currentScoutResult(
  state: GameState,
  market: CareerMarketState,
): ScoutMissionResult | undefined {
  if (market.scoutReports.length === 0) return undefined;
  const completedMissionNumber = Math.max(1, market.nextMissionNumber - 1);
  return {
    missionId: `scout-${completedMissionNumber}`,
    completedWeek: absoluteCareerWeek(state),
    reports: market.scoutReports.map(cloneScoutReport),
  };
}

function transferListing(
  player: CareerPlayer,
  t: CopyFn,
  direction: 'BUY' | 'SELL',
  sellingClubDivision: number,
  revealPower: boolean,
  listed = false,
  savedQuote?: NonNullable<CareerMarketState['transferListings']>[number]['bids'][number]['quote'],
  bids?: TransferListingSource['bids'],
  saleBlockedReason?: string,
): TransferListingSource {
  return {
    player: {
      ...valuationPlayer(player),
      name: player.name,
      lookId: player.lookId,
      ...(revealPower && player.power !== undefined
        ? {
          powerName: t('market.powerAndTier', {
            power: powerDisplayName(t, player.power),
            tier: player.powerTier ?? 1,
          }),
        }
        : {}),
    },
    direction,
    sellingClubDivision,
    listed,
    ...(saleBlockedReason === undefined ? {} : { saleBlockedReason }),
    ...(savedQuote === undefined ? {} : { savedQuote }),
    ...(bids === undefined ? {} : { bids }),
  };
}

function valuationPlayer(player: CareerPlayer): ValuationPlayer {
  return {
    id: player.id,
    role: player.role,
    attrs: { ...player.attrs },
    age: player.age ?? 24,
    potential: player.potential ?? 3,
    ...(player.power === undefined
      ? {}
      : { power: player.power, powerTier: player.powerTier ?? 1 }),
    contractSeasonsRemaining: player.contractSeasonsRemaining,
  };
}

/**
 * Mirrors market-career's `isEligibleTransferReplacement`: fit, present (no
 * injury weeks AND no away weeks), and not a bench-locked unlicensed hero.
 */
function isEligibleCoverPlayer(candidate: CareerPlayer): boolean {
  return isAvailableForSelection(candidate)
    && !(candidate.power !== undefined && !candidate.licensed);
}

/**
 * Mirror of the sale path's cover rule (`assertUserSaleKeepsSquadCover` plus
 * `replaceTransferredStarter` in src/game/market-career.ts): after the sale —
 * and any starter replacement it triggers — one eligible spare goalkeeper and
 * one eligible outfield substitute must remain outside the eleven. The reason
 * is carried on the listing rather than used as a filter, so the sell action
 * renders disabled with copy instead of erroring on use or vanishing entirely.
 */
function saleBlockedReason(
  state: GameState,
  player: CareerPlayer,
  t: CopyFn,
): string | undefined {
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  if (lineup === undefined) return undefined;
  const eligibleSpares = (starters: ReadonlySet<string>) => state.players.filter(candidate => (
    candidate.clubId === state.userClubId
    && candidate.id !== player.id
    && !starters.has(candidate.id)
    && isEligibleCoverPlayer(candidate)
  ));
  let starters = new Set(lineup.playerIds);
  if (starters.has(player.id)) {
    const benchSpares = eligibleSpares(starters);
    const replacement = benchSpares.find(candidate => candidate.role === player.role)
      ?? (player.role === 'GK'
        ? undefined
        : benchSpares.find(candidate => candidate.role !== 'GK'));
    if (replacement === undefined) {
      return t('market.saleNeedsReplacement');
    }
    starters = new Set(lineup.playerIds.map(id => id === player.id ? replacement.id : id));
  }
  const spares = eligibleSpares(starters);
  const covered = spares.some(candidate => candidate.role === 'GK')
    && spares.some(candidate => candidate.role !== 'GK');
  if (!covered) {
    return t('market.saleNeedsCover');
  }
  return undefined;
}

function divisionForClub(state: GameState, clubId: string, fallback: number): number {
  if (state.m2 === undefined) return fallback;
  return state.m2.pyramid.divisions.find(division =>
    division.clubs.some(club => club.id === clubId),
  )?.level ?? fallback;
}

function clubFame(state: GameState): number {
  return Math.max(0, Math.min(CAREER_CLUB_FAME_CEILING, state.players
    .filter(player => player.clubId === state.userClubId)
    .reduce((total, player) => total + (player.fame ?? 0), state.market?.clubFameAdjustment ?? 0)));
}

/** 0 when the club owns no Scout Office; the best operational office wins. */
function scoutOfficeLevel(state: GameState): number {
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

function absoluteCareerWeek(state: Pick<GameState, 'season' | 'week'>): number {
  return (state.season - 1) * 30 + state.week;
}

function wageStepFor(weeklyWage: number): number {
  if (weeklyWage >= 2500) return 250;
  if (weeklyWage >= 1000) return 100;
  return 50;
}

function cloneScoutMission(mission: NonNullable<CareerMarketState['activeScoutMission']>) {
  return { ...mission, focus: { ...mission.focus } };
}

function cloneScoutReport(report: ScoutReport): ScoutReport {
  return {
    ...report,
    statRanges: {
      pac: { ...report.statRanges.pac },
      sho: { ...report.statRanges.sho },
      pas: { ...report.statRanges.pas },
      def: { ...report.statRanges.def },
      tec: { ...report.statRanges.tec },
      sta: { ...report.statRanges.sta },
      ref: { ...report.statRanges.ref },
    },
    potentialRange: { ...report.potentialRange },
  };
}

function cloneCoachCandidate(candidate: CoachCandidate): CoachCandidate {
  return {
    ...candidate,
    specialties: [candidate.specialties[0], candidate.specialties[1]],
  };
}

function marketCursor(careerSeed: number, season: number, week: number): number {
  let value = (
    careerSeed
    ^ Math.imul(season, 0x9e3779b1)
    ^ Math.imul(week, 0x85ebca6b)
  ) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function stableTextCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
