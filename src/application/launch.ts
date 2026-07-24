import { loadLaunchContent, type LaunchContent } from '../content';
import type { CareerSetup, GameState } from '../game';
import type { PlayerPersonality } from '../game';
import {
  buildFacility as placeFacility,
  createFacilityGrid,
  developmentPotentialCeiling,
  enableFullCareer,
  potentialTierForDivision,
} from '../game';
import {
  assignDistinctPlayerLooks,
  isPlayerLookIdForRole,
  nextDistinctPlayerLook,
} from '../game/player-appearance';
import { playerLookId } from '../render/sprites/player-look';

export const DEFAULT_CAREER_SEED = 20260718;
export const DEFAULT_USER_CLUB_ID = 'bramble-rovers';
export const LAUNCH_ROSTER_VERSION = 2;
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
  difficulty?: CareerSetup['difficulty'],
): CareerSetup {
  return {
    seed,
    userClubId,
    launchRosterVersion: LAUNCH_ROSTER_VERSION,
    startingTrainingPoints: 30,
    trainingRules: {
      focusDrills: content.training.focusDrills.map(drill => ({
        id: drill.id, moneyCost: drill.moneyCost, tpCost: drill.tpCost, gains: { ...drill.gains },
      })),
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
      lookId: playerLookId(player.id, player.role),
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
      potentialCeiling: developmentPotentialCeiling({
        id: player.id,
        role: player.role,
        attrs: player.ratings,
        age: player.age,
        potential: deterministicPotential(seed, clubIndex, playerIndex),
      }),
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
    ...(difficulty === undefined ? {} : { difficulty }),
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
  return potentialTierForDivision(
    5,
    deterministicPlayerValue(seed, clubIndex, playerIndex, 0) % 100,
  );
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
  const needsDevelopmentHeadroomUpgrade = (state.launchRosterVersion ?? 0) < 2;
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
      const correctsLaunchPotential = (
        state.season === 1
        && current !== undefined
        && (
          player.potential !== current.potential
          || player.potentialCeiling !== current.potentialCeiling
        )
      );
      const potentialPatch = correctsLaunchPotential && current !== undefined
        ? {
            potential: current.potential,
            potentialCeiling: current.potentialCeiling,
          }
        : needsDevelopmentHeadroomUpgrade
          ? (() => {
              const potentialCeiling = Math.max(
                player.potentialCeiling ?? 0,
                developmentPotentialCeiling(player),
              );
              if (potentialCeiling === player.potentialCeiling) return {};
              changed = true;
              return { potentialCeiling };
            })()
          : {};
      if (correctsLaunchPotential) {
        // Correct launch-player potential saved before the D5 curve and
        // development-headroom floor were aligned. Non-launch players use the
        // one-time headroom migration above without changing their talent tier.
        changed = true;
      }
      if (
        needsLegacyRosterExpansion &&
        current !== undefined &&
        legacyWage !== undefined &&
        player.weeklyWage === legacyWage &&
        player.power === undefined &&
        !player.onHeroWage
      ) {
        changed = true;
        return { ...player, ...potentialPatch, weeklyWage: current.weeklyWage };
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
          ...potentialPatch,
          contractSeasonsRemaining: Math.max(
            1,
            current.contractSeasonsRemaining - (state.phase === 'season-end' ? 1 : 0),
          ),
        };
      }
      return correctsLaunchPotential ? { ...player, ...potentialPatch } : player;
    }),
    ...missing.map(player => ({ ...player, attrs: { ...player.attrs } })),
  ];
  const wageByClub = new Map<string, number>();
  for (const player of players) {
    wageByClub.set(player.clubId, (wageByClub.get(player.clubId) ?? 0) + player.weeklyWage);
  }

  if (!changed) {
    const enabled = enableM2 || state.careerMode === 'full'
      ? enableFullCareer(state)
      : state;
    return reconcileCareerPlayerLooks(enabled);
  }

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
            focusDrills: launch.trainingRules.focusDrills.map(drill => ({
              ...drill,
              gains: { ...drill.gains },
            })),
          },
        }
      : {}),
    clubs: state.clubs.map(club => ({
      ...club,
      weeklyWages: wageByClub.get(club.id) ?? club.weeklyWages,
    })),
  };
  const enabled = enableM2 || state.careerMode === 'full'
    ? enableFullCareer(reconciled)
    : reconciled;
  return reconcileCareerPlayerLooks(enabled);
}

function reconcileCareerPlayerLooks(state: GameState): GameState {
  const appearanceCandidates = state.players.map(player => (
    player.clubId === state.userClubId && player.lookId === undefined
      ? { ...player, lookId: playerLookId(player.id, player.role) }
      : player
  ));
  const players = assignDistinctPlayerLooks(
    appearanceCandidates,
    player => playerLookId(player.id, player.role),
  );
  const playersChanged = players.some((player, index) => (
    player.lookId !== state.players[index].lookId
  ));
  const activeLookById = new Map(players.map(player => [player.id, player.lookId]));
  const retiredPlayers = state.retiredPlayers === undefined
    ? undefined
    : state.retiredPlayers.map(player => ({
        ...player,
        lookId: player.lookId !== undefined
          && isPlayerLookIdForRole(player.lookId, player.role)
          ? player.lookId
          : playerLookId(player.id, player.role),
      }));
  const retiredPlayersChanged = retiredPlayers?.some((player, index) => (
    player.lookId !== state.retiredPlayers?.[index]?.lookId
  )) ?? false;

  const appearancePool = [...players];
  const offers = state.youthIntake?.offers.map(offer => {
    const preservesAssignedLook = offer.player.lookId !== undefined
      && isPlayerLookIdForRole(offer.player.lookId, offer.player.role)
      && !appearancePool.some(player => player.lookId === offer.player.lookId);
    const lookId = preservesAssignedLook
      ? offer.player.lookId!
      : nextDistinctPlayerLook(offer.player, appearancePool);
    const player = { ...offer.player, lookId };
    appearancePool.push(player);
    return { ...offer, player };
  });
  const offersChanged = offers?.some((offer, index) => (
    offer.player.lookId !== state.youthIntake?.offers[index]?.player.lookId
  )) ?? false;

  let pyramidChanged = false;
  const divisions = state.m2?.pyramid.divisions.map(division => ({
    ...division,
    clubs: division.clubs.map(club => ({
      ...club,
      squad: club.squad.map(player => {
        const lookId = activeLookById.get(player.id) ?? player.lookId;
        if (lookId === undefined || lookId === player.lookId) return player;
        pyramidChanged = true;
        return { ...player, lookId };
      }),
    })),
  }));

  if (!playersChanged && !retiredPlayersChanged && !offersChanged && !pyramidChanged) {
    return state;
  }

  return {
    ...state,
    players: playersChanged ? players : state.players,
    ...(retiredPlayers === undefined || !retiredPlayersChanged ? {} : { retiredPlayers }),
    ...(offers === undefined || state.youthIntake === undefined || !offersChanged
      ? {}
      : { youthIntake: { ...state.youthIntake, offers } }),
    ...(state.m2 === undefined || divisions === undefined || !pyramidChanged
      ? {}
      : {
          m2: {
            ...state.m2,
            pyramid: {
              ...state.m2.pyramid,
              divisions,
            },
          },
        }),
  };
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
