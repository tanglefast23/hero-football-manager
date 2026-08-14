import { loadLaunchContent, type LaunchContent } from '../content';
import type { CareerSetup, GameState } from '../game';
import type { PlayerPersonality } from '../game';
import {
  buildFacility as placeFacility,
  createFacilityGrid,
  developmentPotentialCeiling,
  enableFullCareer,
  currentUserDivision,
  expireSponsorOfferWindow,
  generateSponsorOffers,
  CUP_SETTLEMENT_WEEKS,
  leagueWeekForRound,
  potentialTierForDivision,
  scaledTrainingPoints,
  SEASON_WEEKS,
} from '../game';
import {
  assignDistinctPlayerLooks,
  isPlayerLookIdForRole,
  nextDistinctPlayerLook,
} from '../game/player-appearance';
import {
  COACH_WAGE_PER_LEVEL,
  furtherReducedPlayerWeeklyWage,
  reducedPlayerWeeklyWage,
  type CoachCandidate,
} from '../game/market';
import {
  coachWeeklyWageForRole,
  type CareerMarketState,
} from '../game/market-career';
import { SPECIAL_HERO_ROSTER } from '../game/special-heroes';
import { playerLookId } from '../render/sprites/player-look';

export const DEFAULT_CAREER_SEED = 20260718;
export const DEFAULT_USER_CLUB_ID = 'bramble-rovers';
export const LAUNCH_ROSTER_VERSION = 5;
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

const SPECIAL_HERO_BY_ID = new Map(
  SPECIAL_HERO_ROSTER.map((hero) => [hero.id, hero] as const),
);

const CUP_CALENDAR_MIGRATION_FLAG =
  'migration:cup-calendar:10-14-18-22-26-29';

/**
 * Moves only unplayed league rounds around the new Cup calendar.
 *
 * Played fixtures keep their historical week and result. Remaining rounds use
 * the closest legal future week while preserving their order, so a save opened
 * on an old double-header never strands an unplayed fixture in the past.
 */
function reconcileCupCalendar(state: GameState): GameState {
  if (
    state.m2 === undefined ||
    state.eventFlags.includes(CUP_CALENDAR_MIGRATION_FLAG)
  ) {
    return state;
  }
  const currentFixtures = state.fixtures.filter(
    (fixture) => fixture.season === state.season,
  );
  const stale = currentFixtures.some(
    (fixture) =>
      fixture.week !== leagueWeekForRound(fixture.round, fixture.season),
  );
  if (!stale) {
    return {
      ...state,
      eventFlags: [...state.eventFlags, CUP_CALENDAR_MIGRATION_FLAG],
    };
  }

  const scheduledRounds = [
    ...new Set(
      currentFixtures
        .filter((fixture) => fixture.status === 'scheduled')
        .map((fixture) => fixture.round),
    ),
  ].sort((left, right) => left - right);
  const occupiedWeeks = new Set(
    currentFixtures
      .filter((fixture) => fixture.status === 'played')
      .map((fixture) => fixture.week),
  );
  const availableWeeks = Array.from(
    { length: SEASON_WEEKS - state.week + 1 },
    (_, index) => state.week + index,
  ).filter(
    (week) =>
      !occupiedWeeks.has(week) &&
      !CUP_SETTLEMENT_WEEKS.includes(
        week as (typeof CUP_SETTLEMENT_WEEKS)[number],
      ),
  );
  if (availableWeeks.length < scheduledRounds.length) return state;

  const weekByRound = new Map<number, number>();
  let minimumIndex = 0;
  for (let index = 0; index < scheduledRounds.length; index += 1) {
    const round = scheduledRounds[index];
    const desired = leagueWeekForRound(round, state.season);
    const maximumIndex =
      availableWeeks.length - (scheduledRounds.length - index);
    let selectedIndex = minimumIndex;
    for (
      let candidate = minimumIndex;
      candidate <= maximumIndex;
      candidate += 1
    ) {
      if (
        Math.abs(availableWeeks[candidate] - desired) <
        Math.abs(availableWeeks[selectedIndex] - desired)
      ) {
        selectedIndex = candidate;
      }
    }
    weekByRound.set(round, availableWeeks[selectedIndex]);
    minimumIndex = selectedIndex + 1;
  }

  return {
    ...state,
    fixtures: state.fixtures.map((fixture) => {
      if (fixture.season !== state.season || fixture.status === 'played')
        return fixture;
      const week = weekByRound.get(fixture.round);
      return week === undefined || week === fixture.week
        ? fixture
        : { ...fixture, week };
    }),
    eventFlags: [...state.eventFlags, CUP_CALENDAR_MIGRATION_FLAG],
  };
}

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
  difficulty?: CareerSetup['difficulty'],
): CareerSetup {
  return {
    seed,
    userClubId,
    launchRosterVersion: LAUNCH_ROSTER_VERSION,
    // The launch grant rides the same 80% scale as every other TP source, so a
    // fresh career opens with 24 rather than 30 — see `training-point-income.ts`.
    startingTrainingPoints: scaledTrainingPoints(30),
    trainingRules: {
      focusDrills: content.training.focusDrills.map((drill) => ({
        id: drill.id,
        moneyCost: drill.moneyCost,
        tpCost: drill.tpCost,
        gains: { ...drill.gains },
      })),
    },
    sponsorRules: {
      brands: content.sponsors.brands.map((brand) => ({ ...brand })),
      profiles: {
        STEADY: { ...content.sponsors.profiles.STEADY },
        BALANCED: { ...content.sponsors.profiles.BALANCED },
        BOLD: { ...content.sponsors.profiles.BOLD },
      },
      objectives: content.sponsors.objectives.map((objective) => ({
        ...objective,
        targets: { ...objective.targets },
      })),
    },
    clubs: content.clubs.clubs.map((club) => ({
      id: club.id,
      name: club.name,
      cash: club.startingCash,
      fans: club.fans,
      ticketPrice: club.ticketPrice,
      sponsorMonthlyFee: club.sponsorMonthlyFee,
      weeklyWages: club.players.reduce(
        (sum, player) => sum + reducedPlayerWeeklyWage(player.weeklyWage),
        0,
      ),
    })),
    players: content.clubs.clubs.flatMap((club, clubIndex) =>
      club.players.map((player, playerIndex) => ({
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
        weeklyWage: reducedPlayerWeeklyWage(player.weeklyWage),
        onHeroWage: club.id === userClubId ? false : player.onHeroWage,
        // M1 intentionally contains one renewal: the created hero's wage cliff.
        // Keep ordinary user-club contracts alive through Season 1 so they do not
        // become unresolved transfer-market work before M2 exists.
        contractSeasonsRemaining:
          club.id === userClubId
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
        consistency:
          55 + (deterministicPlayerValue(seed, clubIndex, playerIndex, 1) % 31),
        personality:
          PLAYER_PERSONALITIES[
            deterministicPlayerValue(seed, clubIndex, playerIndex, 2) %
              PLAYER_PERSONALITIES.length
          ],
        condition: 100,
        seasonsAtClub: 0,
        fame: player.powerId === null ? 0 : 12,
        retirementAge:
          33 + (deterministicPlayerValue(seed, clubIndex, playerIndex, 3) % 6),
        retirementAnnounced: false,
        signingStatTotal: Object.values(player.ratings).reduce(
          (sum, value) => sum + value,
          0,
        ),
      })),
    ),
    lineups: content.clubs.clubs.map((club) => ({
      clubId: club.id,
      playerIds: [...club.startingLineup],
    })),
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
/**
 * Whether a save's baked drill catalog still matches the shipped one.
 *
 * Compared field by field rather than by JSON string: key order in a persisted
 * object is whatever the codec happened to write, and a reordered but identical
 * catalog would otherwise be rebased on every single load — which would set
 * `changed` forever and cost a write every resume.
 */
function sameFocusDrills(
  saved: CareerSetup['trainingRules'] extends infer Rules
    ? Rules extends { focusDrills: infer Drills }
      ? Drills
      : never
    : never,
  shipped: typeof saved,
): boolean {
  if (saved.length !== shipped.length) return false;
  return shipped.every((drill, index) => {
    const current = saved[index];
    if (current === undefined) return false;
    if (current.id !== drill.id) return false;
    if (
      current.tpCost !== drill.tpCost ||
      current.moneyCost !== drill.moneyCost
    )
      return false;
    const keys = Object.keys(drill.gains) as Array<keyof typeof drill.gains>;
    if (keys.length !== Object.keys(current.gains).length) return false;
    return keys.every((key) => current.gains[key] === drill.gains[key]);
  });
}

function repriceCoachMarket(market: CareerMarketState): CareerMarketState {
  return {
    ...market,
    coachCandidates: market.coachCandidates.map((coach) =>
      repriceCoach(coach, 'HEAD'),
    ),
    ...(market.headCoach === undefined
      ? {}
      : { headCoach: repriceCoach(market.headCoach, 'HEAD') }),
    ...(market.assistantCoach === undefined
      ? {}
      : { assistantCoach: repriceCoach(market.assistantCoach, 'ASSISTANT') }),
  };
}

function repriceCoach(
  coach: CoachCandidate,
  role: 'HEAD' | 'ASSISTANT',
): CoachCandidate {
  const headWeeklyWage = Math.round(
    (COACH_WAGE_PER_LEVEL *
      coach.level *
      (100 - coach.loyaltyDiscountPercent)) /
      100,
  );
  return {
    ...coach,
    weeklyWage: coachWeeklyWageForRole({ weeklyWage: headWeeklyWage }, role),
  };
}

function coachMarketNeedsRepricing(market: CareerMarketState): boolean {
  return (
    market.coachCandidates.some(
      (coach) => coach.weeklyWage !== repriceCoach(coach, 'HEAD').weeklyWage,
    ) ||
    (market.headCoach !== undefined &&
      market.headCoach.weeklyWage !==
        repriceCoach(market.headCoach, 'HEAD').weeklyWage) ||
    (market.assistantCoach !== undefined &&
      market.assistantCoach.weeklyWage !==
        repriceCoach(market.assistantCoach, 'ASSISTANT').weeklyWage)
  );
}

export function reconcileLaunchRoster(
  state: GameState,
  content: LaunchContent = loadLaunchContent(),
): GameState {
  state = reconcileCupCalendar(state);
  const savedAwakening = (
    state as Omit<GameState, 'awakening'> & {
      awakening?: Omit<GameState['awakening'], 'usedTriggerIds'> & {
        usedTriggerIds?: string[];
      };
    }
  ).awakening;
  const launch = createLaunchCareerSetup(
    state.careerSeed,
    state.userClubId,
    content,
  );
  const launchPlayers = launch.players ?? [];
  const existingIds = new Set(state.players.map((player) => player.id));
  const clubIds = new Set(state.clubs.map((club) => club.id));
  const needsLegacyRosterExpansion =
    state.launchRosterVersion === undefined &&
    isLegacyThirteenPlayerLaunchRoster(state, launchPlayers);
  const needsDevelopmentHeadroomUpgrade = (state.launchRosterVersion ?? 0) < 2;
  const savedLaunchRosterVersion = state.launchRosterVersion ?? 0;
  // Two preview branches briefly used version 3 for different wage migrations.
  // Current coach pricing identifies which migration a version-3 save received.
  const versionThreeNeedsCoachMigration =
    savedLaunchRosterVersion === 3 &&
    state.market !== undefined &&
    coachMarketNeedsRepricing(state.market);
  const needsFullPlayerWageReduction =
    savedLaunchRosterVersion < 3 ||
    (savedLaunchRosterVersion === 3 && !versionThreeNeedsCoachMigration);
  const needsAdditionalPlayerWageReduction =
    savedLaunchRosterVersion === 4 ||
    (savedLaunchRosterVersion === 3 && versionThreeNeedsCoachMigration);
  const needsPlayerWageReduction =
    needsFullPlayerWageReduction || needsAdditionalPlayerWageReduction;
  const needsCoachWageReduction =
    savedLaunchRosterVersion < 3 || versionThreeNeedsCoachMigration;
  const missing = needsLegacyRosterExpansion
    ? launchPlayers.filter(
        (player) =>
          isExpansionReserve(player.id) &&
          !existingIds.has(player.id) &&
          clubIds.has(player.clubId),
      )
    : [];

  const launchById = new Map(
    launchPlayers.map((player) => [player.id, player]),
  );
  const legacyReserveWages = new Map<string, number>();
  content.clubs.clubs.forEach((club, index) => {
    // Before the roster expansion, p12/p13 carried the full reserve payroll.
    // Only untouched legacy contracts are redistributed; awakened/renewed
    // contracts retain their saved wage promise.
    legacyReserveWages.set(`${club.id}-p12`, 282 + index * 8);
    legacyReserveWages.set(`${club.id}-p13`, 304 + index * 8);
  });

  /**
   * A retuned drill ladder has to reach the career already in progress.
   *
   * `trainingRules.focusDrills` is baked into the save, so a balance change to
   * the gains would otherwise only ever be felt on a New Game — the one save the
   * owner is actually playing would keep the old numbers for the rest of its
   * life. Compared here, BEFORE the early return below, because that return
   * fires whenever nothing else changed and a comparison made after it would
   * never rebase a save that already carries a `trainingRules` field.
   */
  const staleTrainingRules =
    state.trainingRules !== undefined &&
    launch.trainingRules !== undefined &&
    !sameFocusDrills(
      state.trainingRules.focusDrills,
      launch.trainingRules.focusDrills,
    );
  const stalePlayerRequestRules =
    state.playerRequestRules !== undefined &&
    state.playerRequests?.pending === undefined &&
    JSON.stringify(state.playerRequestRules) !==
      JSON.stringify(content.playerRequests);
  const staleSponsorRules =
    state.sponsorRules !== undefined &&
    launch.sponsorRules !== undefined &&
    JSON.stringify(state.sponsorRules) !== JSON.stringify(launch.sponsorRules);
  let changed =
    state.launchRosterVersion !== LAUNCH_ROSTER_VERSION ||
    missing.length > 0 ||
    state.trainingRules === undefined ||
    staleTrainingRules ||
    needsPlayerWageReduction ||
    needsCoachWageReduction ||
    state.playerRequestRules === undefined ||
    stalePlayerRequestRules ||
    state.sponsorRules === undefined ||
    staleSponsorRules ||
    savedAwakening === undefined ||
    savedAwakening.usedTriggerIds === undefined ||
    state.facilities.grid === undefined;
  const players = [
    ...state.players.map((player) => {
      const migratedPlayer = needsPlayerWageReduction
        ? {
            ...player,
            weeklyWage: needsFullPlayerWageReduction
              ? reducedPlayerWeeklyWage(player.weeklyWage)
              : furtherReducedPlayerWeeklyWage(player.weeklyWage),
          }
        : player;
      const current = launchById.get(player.id);
      const legacyWage = legacyReserveWages.get(player.id);
      const correctsLaunchPotential =
        state.season === 1 &&
        current !== undefined &&
        (player.potential !== current.potential ||
          player.potentialCeiling !== current.potentialCeiling);
      const potentialPatch =
        correctsLaunchPotential && current !== undefined
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
        return {
          ...migratedPlayer,
          ...potentialPatch,
          weeklyWage: current.weeklyWage,
        };
      }
      if (
        state.season === 1 &&
        player.clubId === state.userClubId &&
        player.power === undefined &&
        current !== undefined &&
        player.contractSeasonsRemaining <
          Math.max(
            1,
            current.contractSeasonsRemaining -
              (state.phase === 'season-end' ? 1 : 0),
          )
      ) {
        changed = true;
        return {
          ...migratedPlayer,
          ...potentialPatch,
          contractSeasonsRemaining: Math.max(
            1,
            current.contractSeasonsRemaining -
              (state.phase === 'season-end' ? 1 : 0),
          ),
        };
      }
      return correctsLaunchPotential
        ? { ...migratedPlayer, ...potentialPatch }
        : migratedPlayer;
    }),
    ...missing.map((player) => ({ ...player, attrs: { ...player.attrs } })),
  ];
  const wageByClub = new Map<string, number>();
  for (const player of players) {
    wageByClub.set(
      player.clubId,
      (wageByClub.get(player.clubId) ?? 0) + player.weeklyWage,
    );
  }

  if (!changed) {
    return reconcileSponsorBusiness(
      reconcileCareerPlayerLooks(enableFullCareer(state)),
    );
  }

  const reconciled: GameState = {
    ...state,
    launchRosterVersion: LAUNCH_ROSTER_VERSION,
    awakening:
      savedAwakening === undefined
        ? { matchesSinceLastAwakening: 0, usedTriggerIds: [] }
        : {
            ...savedAwakening,
            usedTriggerIds: savedAwakening.usedTriggerIds ?? [],
          },
    facilities:
      state.facilities.grid === undefined
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
    ...(needsCoachWageReduction && state.market !== undefined
      ? { market: repriceCoachMarket(state.market) }
      : {}),
    players,
    ...((state.trainingRules === undefined || staleTrainingRules) &&
    launch.trainingRules !== undefined
      ? {
          trainingRules: {
            focusDrills: launch.trainingRules.focusDrills.map((drill) => ({
              ...drill,
              gains: { ...drill.gains },
            })),
          },
        }
      : {}),
    // Careers saved before requests existed have no baked catalog, and without
    // one the tab would stay empty forever. Reconciliation supplies it the same
    // way it supplies training rules.
    ...(state.playerRequestRules === undefined || stalePlayerRequestRules
      ? {
          playerRequestRules: JSON.parse(
            JSON.stringify(content.playerRequests),
          ),
        }
      : {}),
    ...((state.sponsorRules === undefined || staleSponsorRules) &&
    launch.sponsorRules !== undefined
      ? { sponsorRules: launch.sponsorRules }
      : {}),
    clubs: state.clubs.map((club) => ({
      ...club,
      weeklyWages: wageByClub.get(club.id) ?? club.weeklyWages,
    })),
  };
  return reconcileSponsorBusiness(
    reconcileCareerPlayerLooks(enableFullCareer(reconciled)),
  );
}

function reconcileSponsorBusiness(state: GameState): GameState {
  const rules = state.sponsorRules;
  if (rules === undefined || state.m2 === undefined) return state;
  const sponsorship = state.clubBusiness.sponsorship;
  if (
    sponsorship.portfolioSeason !== state.season ||
    sponsorship.activeContracts.length === 0
  ) {
    return state;
  }
  if (sponsorship.offerSeason === state.season) return state;

  if (state.week >= 5) {
    return {
      ...state,
      clubBusiness: {
        ...state.clubBusiness,
        sponsorship: {
          ...expireSponsorOfferWindow(sponsorship, state.season, state.week),
          offerSeason: state.season,
        },
      },
    };
  }

  const offers = generateSponsorOffers({
    rules,
    careerSeed: state.careerSeed,
    season: state.season,
    division: currentUserDivision(state.m2),
    difficulty: state.difficulty ?? 'COZY',
    activeContracts: sponsorship.activeContracts,
  });
  return {
    ...state,
    clubBusiness: {
      ...state.clubBusiness,
      sponsorship: {
        ...sponsorship,
        offers,
        offerSeason: state.season,
      },
    },
  };
}

function reconcileCareerPlayerLooks(state: GameState): GameState {
  const appearanceCandidates = state.players.map((player) => {
    const specialHero = SPECIAL_HERO_BY_ID.get(player.id);
    if (specialHero !== undefined) {
      return {
        ...player,
        name: specialHero.name,
        lookId: specialHero.lookId,
      };
    }
    return player.clubId === state.userClubId && player.lookId === undefined
      ? { ...player, lookId: playerLookId(player.id, player.role) }
      : player;
  });
  const players = assignDistinctPlayerLooks(appearanceCandidates, (player) =>
    playerLookId(player.id, player.role),
  );
  const playersChanged = players.some(
    (player, index) =>
      player.lookId !== state.players[index].lookId ||
      player.name !== state.players[index].name,
  );
  const activeLookById = new Map(
    players.map((player) => [player.id, player.lookId]),
  );
  const userClubName = state.clubs.find(
    (club) => club.id === state.userClubId,
  )?.name;
  const retiredPlayers =
    state.retiredPlayers === undefined
      ? undefined
      : state.retiredPlayers.map((player) => ({
          ...player,
          lookId:
            player.lookId !== undefined &&
            isPlayerLookIdForRole(player.lookId, player.role)
              ? player.lookId
              : playerLookId(player.id, player.role),
        }));
  const retiredPlayersChanged =
    retiredPlayers?.some(
      (player, index) =>
        player.lookId !== state.retiredPlayers?.[index]?.lookId,
    ) ?? false;

  const appearancePool = [...players];
  const offers = state.youthIntake?.offers.map((offer) => {
    const preservesAssignedLook =
      offer.player.lookId !== undefined &&
      isPlayerLookIdForRole(offer.player.lookId, offer.player.role) &&
      !appearancePool.some((player) => player.lookId === offer.player.lookId);
    const lookId = preservesAssignedLook
      ? offer.player.lookId!
      : nextDistinctPlayerLook(offer.player, appearancePool);
    const player = { ...offer.player, lookId };
    appearancePool.push(player);
    return { ...offer, player };
  });
  const offersChanged =
    offers?.some(
      (offer, index) =>
        offer.player.lookId !== state.youthIntake?.offers[index]?.player.lookId,
    ) ?? false;

  let pyramidChanged = false;
  const divisions = state.m2?.pyramid.divisions.map((division) => ({
    ...division,
    clubs: division.clubs.map((club) => {
      const name = club.id === state.userClubId ? userClubName : undefined;
      if (name !== undefined && name !== club.name) pyramidChanged = true;
      return {
        ...club,
        ...(name === undefined ? {} : { name }),
        squad: club.squad.map((player) => {
          const lookId = activeLookById.get(player.id) ?? player.lookId;
          if (lookId === undefined || lookId === player.lookId) return player;
          pyramidChanged = true;
          return { ...player, lookId };
        }),
      };
    }),
  }));

  if (
    !playersChanged &&
    !retiredPlayersChanged &&
    !offersChanged &&
    !pyramidChanged
  ) {
    return state;
  }

  return {
    ...state,
    players: playersChanged ? players : state.players,
    ...(retiredPlayers === undefined || !retiredPlayersChanged
      ? {}
      : { retiredPlayers }),
    ...(offers === undefined ||
    state.youthIntake === undefined ||
    !offersChanged
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
  const activeClubIds = new Set(state.clubs.map((club) => club.id));
  const launchClubIds = new Set(launchPlayers.map((player) => player.clubId));
  if (
    activeClubIds.size !== launchClubIds.size ||
    [...activeClubIds].some((clubId) => !launchClubIds.has(clubId))
  ) {
    return false;
  }

  const savedIds = new Set(state.players.map((player) => player.id));
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
  return [...activeClubIds].every(
    (clubId) => (savedBasePlayerCountByClub.get(clubId) ?? 0) >= 11,
  );
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
