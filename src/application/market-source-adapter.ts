import { currentUserDivision } from '../game/m2-career';
import type { CareerMarketState } from '../game/market-career';
import type {
  CoachCandidate,
  ScoutFocus,
  ScoutMissionResult,
  ScoutRegion,
  ScoutReport,
  ValuationPlayer,
} from '../game/market';
import type { CareerPlayer, GameState } from '../game/types';
import { careerRosterCapacity } from '../game/youth-intake';
import type {
  MarketViewModelSource,
  ScoutMissionOptionSource,
  TransferListingSource,
} from './market-view-model';

const ROTATING_REGIONS: readonly ScoutRegion[] = [
  'EUROPE',
  'SOUTH_AMERICA',
  'AFRICA',
  'ASIA',
];
const ROTATING_ROLES = ['GK', 'DEF', 'MID', 'FWD'] as const;

/**
 * Plain adapter for the application boundary. It derives display inputs only;
 * the career and market save objects are never mutated or enriched with UI data.
 */
export function careerMarketViewModelSource(
  state: GameState,
  suppliedMarket?: CareerMarketState,
): MarketViewModelSource {
  const market = suppliedMarket ?? state.market;
  if (market === undefined) throw new Error('the career market has not been initialized');
  const userClub = state.clubs.find(club => club.id === state.userClubId);
  if (userClub === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
  const reportByPlayerId = new Map(market.scoutReports.map(report => [report.playerId, report]));
  const playerById = new Map(state.players.map(player => [player.id, player]));
  const scoutResult = currentScoutResult(state, market);
  const buyListings = market.scoutReports
    .map(report => {
      const player = playerById.get(report.playerId);
      if (player === undefined || player.clubId === state.userClubId) {
        throw new Error(`scout report ${report.playerId} does not reference a transfer target`);
      }
      return transferListing(
        player,
        'BUY',
        divisionForClub(state, player.clubId, division),
        report.power !== undefined,
      );
    });
  const sellListings = state.players
    .filter(player => (
      player.clubId === state.userClubId
      && player.contractSeasonsRemaining > 0
      && hasTransferReplacement(state, player)
    ))
    .map(player => transferListing(player, 'SELL', division, true));
  const transferListings = [...buyListings, ...sellListings].sort((left, right) => {
    if (left.direction !== right.direction) return left.direction === 'BUY' ? -1 : 1;
    return stableTextCompare(left.player.id, right.player.id);
  });
  const identities = market.scoutReports.map(report => {
    const player = playerById.get(report.playerId)!;
    return {
      id: player.id,
      name: player.name,
      ...(report.power === undefined || player.power === undefined
        ? {}
        : { powerName: readableId(player.power) }),
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
          openingWeeklyWage: player.weeklyWage,
          wageStep: wageStepFor(player.weeklyWage),
        };
      })();

  return {
    careerSeed: state.careerSeed,
    season: state.season,
    week: state.week,
    currentCareerWeek: absoluteCareerWeek(state),
    division,
    fame: clubFame(state),
    cash: userClub.cash,
    scoutOfficeLevel: scoutOfficeLevel(state),
    scoutOptions: careerMarketScoutOptions(state),
    ...(market.activeScoutMission === undefined
      ? {}
      : { activeScoutMission: cloneScoutMission(market.activeScoutMission) }),
    ...(scoutResult === undefined ? {} : { scoutResult }),
    ...(identities.length === 0 ? {} : { scoutedPlayerIdentities: identities }),
    transferListings,
    coachCandidates: market.coachCandidates.map(cloneCoachCandidate),
    ...(state.youthIntake === undefined
      ? {}
      : {
          youthIntake: {
            status: state.youthIntake.status,
            declined: state.youthIntake.declined,
            rosterCount: state.players.filter(player => player.clubId === state.userClubId).length,
            rosterCapacity: careerRosterCapacity(state),
            offers: state.youthIntake.offers.map(offer => ({
              player: {
                id: offer.player.id,
                name: offer.player.name,
                role: offer.player.role,
                age: offer.player.age ?? 16,
                potential: offer.player.potential ?? 1,
                archetype: offer.player.archetype ?? 'All-Rounder',
                weeklyWage: offer.player.weeklyWage,
              },
              signingBonus: offer.signingBonus,
            })),
          },
        }),
    ...(negotiation === undefined ? {} : { negotiation }),
  };
}

/** Four compact briefs cover age, position, and rumored-hero scouting. */
export function careerMarketScoutOptions(state: Pick<GameState, 'careerSeed' | 'season' | 'week'>): ScoutMissionOptionSource[] {
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
  const firstRegion = ROTATING_REGIONS[cursor % ROTATING_REGIONS.length];
  const secondRegion = ROTATING_REGIONS[(cursor + 1) % ROTATING_REGIONS.length];
  const heroRegion = ROTATING_REGIONS[(cursor + 2) % ROTATING_REGIONS.length];
  const firstRole = ROTATING_ROLES[(cursor >>> 3) % ROTATING_ROLES.length];

  return [
    {
      id: `scout-brief-s${state.season}-w${state.week}-local-youth`,
      region: 'LOCAL',
      focus: { kind: 'AGE', minimumAge: 16, maximumAge: 21 },
      regionLabel: 'Local circuit',
      detail: 'A lower-cost sweep for young players with room to grow.',
    },
    {
      id: `scout-brief-s${state.season}-w${state.week}-${firstRegion.toLowerCase()}-${firstRole.toLowerCase()}`,
      region: firstRegion,
      focus: { kind: 'POSITION', role: firstRole },
      detail: `A focused search for a first-team ${firstRole}.`,
    },
    {
      id: `scout-brief-s${state.season}-w${state.week}-${secondRegion.toLowerCase()}-prime`,
      region: secondRegion,
      focus: { kind: 'AGE', minimumAge: 22, maximumAge: 29 },
      detail: 'Look for players already entering their best football years.',
    },
    {
      id: `scout-brief-s${state.season}-w${state.week}-${heroRegion.toLowerCase()}-hero`,
      region: heroRegion,
      focus: { kind: 'RUMORED_HERO' },
      detail: 'Follow the expensive power rumor. Most trails lead nowhere.',
    },
  ];
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
  direction: 'BUY' | 'SELL',
  sellingClubDivision: number,
  revealPower: boolean,
): TransferListingSource {
  return {
    player: {
      ...valuationPlayer(player),
      name: player.name,
      ...(revealPower && player.power !== undefined
        ? { powerName: readableId(player.power) }
        : {}),
    },
    direction,
    sellingClubDivision,
  };
}

function valuationPlayer(player: CareerPlayer): ValuationPlayer {
  return {
    id: player.id,
    role: player.role,
    attrs: { ...player.attrs },
    age: player.age ?? 24,
    potential: player.potential ?? 3,
    ...(player.power === undefined ? {} : { power: player.power, powerTier: 1 }),
    contractSeasonsRemaining: player.contractSeasonsRemaining,
  };
}

function hasTransferReplacement(state: GameState, player: CareerPlayer): boolean {
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  if (lineup === undefined || !lineup.playerIds.includes(player.id)) return true;
  const starters = new Set(lineup.playerIds);
  return state.players.some(candidate => (
    candidate.clubId === state.userClubId
    && candidate.id !== player.id
    && !starters.has(candidate.id)
    && candidate.injuryWeeks === 0
    && (
      candidate.role === player.role
      || (candidate.role !== 'GK' && player.role !== 'GK')
    )
  ));
}

function divisionForClub(state: GameState, clubId: string, fallback: number): number {
  if (state.m2 === undefined) return fallback;
  return state.m2.pyramid.divisions.find(division =>
    division.clubs.some(club => club.id === clubId),
  )?.level ?? fallback;
}

function clubFame(state: GameState): number {
  return Math.min(9999, state.players
    .filter(player => player.clubId === state.userClubId)
    .reduce((total, player) => total + (player.fame ?? 0), 0));
}

function scoutOfficeLevel(state: GameState): number {
  return state.facilities.grid?.buildings.find(building => building.type === 'scout-office')?.level ?? 1;
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

function readableId(value: string): string {
  return value.split('_').map(word => (
    `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`
  )).join(' ');
}

function stableTextCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
