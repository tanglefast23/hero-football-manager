import { loadLaunchContent, type LaunchContent } from '../content';
import type { CareerSetup, GameState } from '../game';
import type { PlayerPersonality } from '../game';
import {
  buildFacility as placeFacility,
  createFacilityGrid,
  enableFullCareer,
} from '../game';

export const DEFAULT_CAREER_SEED = 20260718;
export const DEFAULT_USER_CLUB_ID = 'bramble-rovers';
export const LAUNCH_ROSTER_VERSION = 1;
let careerSeedNonce = 0;
let lastGeneratedCareerSeed: number | undefined;

const PLAYER_PERSONALITIES: readonly PlayerPersonality[] = [
  'Fiery',
  'Loyal',
  'Greedy',
  'Joker',
  'Professional',
  'Timid',
];

/** Produces a fresh uint32 seed without importing nondeterminism into the sim. */
export function generateCareerSeed(now = Date.now()): number {
  careerSeedNonce = (careerSeedNonce + 0x9e3779b9) >>> 0;
  let seed = ((Math.trunc(now) >>> 0) ^ careerSeedNonce) >>> 0;
  if (seed === lastGeneratedCareerSeed) seed = (seed + 1) >>> 0;
  lastGeneratedCareerSeed = seed;
  return seed;
}

export function createLaunchCareerSetup(
  seed = DEFAULT_CAREER_SEED,
  userClubId = DEFAULT_USER_CLUB_ID,
  content: LaunchContent = loadLaunchContent(),
  careerMode?: CareerSetup['careerMode'],
): CareerSetup {
  return {
    seed,
    userClubId,
    launchRosterVersion: LAUNCH_ROSTER_VERSION,
    startingTrainingPoints: 30,
    trainingRules: {
      maxFocusDrillsPerWeek: content.training.maxFocusDrillsPerWeek,
      baseConditioning: {
        id: content.training.baseConditioning.id,
        moneyCost: content.training.baseConditioning.moneyCost,
        tpCost: content.training.baseConditioning.tpCost,
        gains: { ...content.training.baseConditioning.gains },
      },
    },
    clubs: content.clubs.clubs.map(club => ({
      id: club.id,
      name: club.name,
      cash: club.startingCash,
      fans: club.fans,
      ticketPrice: club.ticketPrice,
      sponsorMonthlyFee: club.sponsorMonthlyFee,
      weeklyWages: club.players.reduce((sum, player) => sum + player.weeklyWage, 0),
    })),
    players: content.clubs.clubs.flatMap((club, clubIndex) => club.players.map((player, playerIndex) => ({
      id: player.id,
      clubId: club.id,
      name: player.name,
      role: player.role,
      attrs: { ...player.ratings },
      ...(club.id === userClubId || player.powerId === null
        ? {}
        : { power: player.powerId, powerTier: 1 as const }),
      licensed: club.id === userClubId ? false : player.licensed,
      weeklyWage: player.weeklyWage,
      onHeroWage: club.id === userClubId ? false : player.onHeroWage,
      // M1 intentionally contains one renewal: the created hero's wage cliff.
      // Keep ordinary user-club contracts alive through Season 1 so they do not
      // become unresolved transfer-market work before M2 exists.
      contractSeasonsRemaining: club.id === userClubId
        ? Math.max(2, player.contractSeasonsRemaining)
        : player.contractSeasonsRemaining,
      morale: 50,
      injuryWeeks: 0,
      age: player.age,
      archetype: player.archetype,
      potential: deterministicPotential(seed, clubIndex, playerIndex),
      consistency: 55 + deterministicPlayerValue(seed, clubIndex, playerIndex, 1) % 31,
      personality: PLAYER_PERSONALITIES[
        deterministicPlayerValue(seed, clubIndex, playerIndex, 2) % PLAYER_PERSONALITIES.length
      ],
      condition: 100,
      seasonsAtClub: 0,
      fame: player.powerId === null ? 0 : 12,
      retirementAge: 33 + deterministicPlayerValue(seed, clubIndex, playerIndex, 3) % 6,
      retirementAnnounced: false,
      signingStatTotal: Object.values(player.ratings).reduce((sum, value) => sum + value, 0),
    }))),
    lineups: content.clubs.clubs.map(club => ({
      clubId: club.id,
      playerIds: [...club.startingLineup],
    })),
    ...(careerMode === undefined ? {} : { careerMode }),
  };
}

function deterministicPlayerValue(
  seed: number,
  clubIndex: number,
  playerIndex: number,
  channel: number,
): number {
  let value = (seed ^ ((clubIndex + 1) * 0x9e3779b1)) >>> 0;
  value = (value ^ ((playerIndex + 1) * 0x85ebca6b)) >>> 0;
  value = (value ^ ((channel + 1) * 0xc2b2ae35)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function deterministicPotential(
  seed: number,
  clubIndex: number,
  playerIndex: number,
): 1 | 2 | 3 | 4 | 5 {
  return (1 + deterministicPlayerValue(seed, clubIndex, playerIndex, 0) % 5) as 1 | 2 | 3 | 4 | 5;
}

/** Adds content-pack reserve players to careers created before 16-player clubs. */
export function reconcileLaunchRoster(
  state: GameState,
  content: LaunchContent = loadLaunchContent(),
  enableM2 = false,
): GameState {
  const savedAwakening = (state as Omit<GameState, 'awakening'> & {
    awakening?: Omit<GameState['awakening'], 'usedTriggerIds'> & { usedTriggerIds?: string[] };
  }).awakening;
  const launch = createLaunchCareerSetup(state.careerSeed, state.userClubId, content);
  const launchPlayers = launch.players ?? [];
  const existingIds = new Set(state.players.map(player => player.id));
  const clubIds = new Set(state.clubs.map(club => club.id));
  const needsLegacyRosterExpansion = state.launchRosterVersion === undefined
    && isLegacyThirteenPlayerLaunchRoster(state, launchPlayers);
  const missing = needsLegacyRosterExpansion
    ? launchPlayers.filter(player => (
        isExpansionReserve(player.id)
        && !existingIds.has(player.id)
        && clubIds.has(player.clubId)
      ))
    : [];

  const launchById = new Map(launchPlayers.map(player => [player.id, player]));
  const legacyReserveWages = new Map<string, number>();
  content.clubs.clubs.forEach((club, index) => {
    // Before the roster expansion, p12/p13 carried the full reserve payroll.
    // Only untouched legacy contracts are redistributed; awakened/renewed
    // contracts retain their saved wage promise.
    legacyReserveWages.set(`${club.id}-p12`, 282 + index * 8);
    legacyReserveWages.set(`${club.id}-p13`, 304 + index * 8);
  });

  let changed = state.launchRosterVersion !== LAUNCH_ROSTER_VERSION
    || missing.length > 0
    || state.trainingRules === undefined
    || savedAwakening === undefined
    || savedAwakening.usedTriggerIds === undefined
    || state.facilities.grid === undefined;
  const players = [
    ...state.players.map(player => {
      const current = launchById.get(player.id);
      const legacyWage = legacyReserveWages.get(player.id);
      if (
        needsLegacyRosterExpansion &&
        current !== undefined &&
        legacyWage !== undefined &&
        player.weeklyWage === legacyWage &&
        player.power === undefined &&
        !player.onHeroWage
      ) {
        changed = true;
        return { ...player, weeklyWage: current.weeklyWage };
      }
      if (
        state.season === 1
        && player.clubId === state.userClubId
        && player.power === undefined
        && current !== undefined
        && player.contractSeasonsRemaining < Math.max(
          1,
          current.contractSeasonsRemaining - (state.phase === 'season-end' ? 1 : 0),
        )
      ) {
        changed = true;
        return {
          ...player,
          contractSeasonsRemaining: Math.max(
            1,
            current.contractSeasonsRemaining - (state.phase === 'season-end' ? 1 : 0),
          ),
        };
      }
      return player;
    }),
    ...missing.map(player => ({ ...player, attrs: { ...player.attrs } })),
  ];
  const wageByClub = new Map<string, number>();
  for (const player of players) {
    wageByClub.set(player.clubId, (wageByClub.get(player.clubId) ?? 0) + player.weeklyWage);
  }

  if (!changed) return enableM2 || state.careerMode === 'full'
    ? enableFullCareer(state)
    : state;

  const reconciled: GameState = {
    ...state,
    launchRosterVersion: LAUNCH_ROSTER_VERSION,
    awakening: savedAwakening === undefined
      ? { matchesSinceLastAwakening: 0, usedTriggerIds: [] }
      : {
          ...savedAwakening,
          usedTriggerIds: savedAwakening.usedTriggerIds ?? [],
        },
    facilities: state.facilities.grid === undefined
      ? {
          ...state.facilities,
          grid: state.facilities.trainingGroundBuilt
            ? placeFacility(
                createFacilityGrid(),
                'training-pitch',
                { x: 0, y: 0 },
                8_000,
              ).grid
            : createFacilityGrid(),
        }
      : state.facilities,
    players,
    ...(state.trainingRules === undefined && launch.trainingRules !== undefined
      ? {
          trainingRules: {
            maxFocusDrillsPerWeek: launch.trainingRules.maxFocusDrillsPerWeek,
            baseConditioning: {
              ...launch.trainingRules.baseConditioning,
              gains: { ...launch.trainingRules.baseConditioning.gains },
            },
          },
        }
      : {}),
    clubs: state.clubs.map(club => ({
      ...club,
      weeklyWages: wageByClub.get(club.id) ?? club.weeklyWages,
    })),
  };
  return enableM2 || state.careerMode === 'full'
    ? enableFullCareer(reconciled)
    : reconciled;
}

function isLegacyThirteenPlayerLaunchRoster(
  state: GameState,
  launchPlayers: readonly NonNullable<CareerSetup['players']>[number][],
): boolean {
  const activeClubIds = new Set(state.clubs.map(club => club.id));
  const launchClubIds = new Set(launchPlayers.map(player => player.clubId));
  if (activeClubIds.size !== launchClubIds.size
    || [...activeClubIds].some(clubId => !launchClubIds.has(clubId))) {
    return false;
  }

  const savedIds = new Set(state.players.map(player => player.id));
  const savedBasePlayerCountByClub = new Map<string, number>();
  for (const player of launchPlayers) {
    const reserveNumber = launchReserveNumber(player.id);
    if (reserveNumber === undefined) return false;
    if (reserveNumber <= 13 && savedIds.has(player.id)) {
      savedBasePlayerCountByClub.set(
        player.clubId,
        (savedBasePlayerCountByClub.get(player.clubId) ?? 0) + 1,
      );
    }
    if (reserveNumber >= 14 && savedIds.has(player.id)) return false;
  }
  return [...activeClubIds].every(clubId => (
    (savedBasePlayerCountByClub.get(clubId) ?? 0) >= 11
  ));
}

function isExpansionReserve(playerId: string): boolean {
  const reserveNumber = launchReserveNumber(playerId);
  return reserveNumber !== undefined && reserveNumber >= 14;
}

function launchReserveNumber(playerId: string): number | undefined {
  const match = /-p(\d+)$/.exec(playerId);
  if (match === null) return undefined;
  return Number(match[1]);
}
