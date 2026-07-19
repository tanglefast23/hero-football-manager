import { loadLaunchContent, type LaunchContent } from '../content';
import type { CareerSetup, GameState } from '../game';

export const DEFAULT_CAREER_SEED = 20260718;
export const DEFAULT_USER_CLUB_ID = 'bramble-rovers';
let careerSeedNonce = 0;
let lastGeneratedCareerSeed: number | undefined;

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
): CareerSetup {
  return {
    seed,
    userClubId,
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
    players: content.clubs.clubs.flatMap(club => club.players.map(player => ({
      id: player.id,
      clubId: club.id,
      name: player.name,
      role: player.role,
      attrs: { ...player.ratings },
      ...(club.id === userClubId || player.powerId === null ? {} : { power: player.powerId }),
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
    }))),
    lineups: content.clubs.clubs.map(club => ({
      clubId: club.id,
      playerIds: [...club.startingLineup],
    })),
  };
}

/** Adds content-pack reserve players to careers created before 16-player clubs. */
export function reconcileLaunchRoster(
  state: GameState,
  content: LaunchContent = loadLaunchContent(),
): GameState {
  const savedAwakening = (state as Omit<GameState, 'awakening'> & {
    awakening?: Omit<GameState['awakening'], 'usedTriggerIds'> & { usedTriggerIds?: string[] };
  }).awakening;
  const launch = createLaunchCareerSetup(state.careerSeed, state.userClubId, content);
  const launchPlayers = launch.players ?? [];
  const existingIds = new Set(state.players.map(player => player.id));
  const missing = launchPlayers.filter(player => !existingIds.has(player.id));

  const launchById = new Map(launchPlayers.map(player => [player.id, player]));
  const legacyReserveWages = new Map<string, number>();
  content.clubs.clubs.forEach((club, index) => {
    // Before the roster expansion, p12/p13 carried the full reserve payroll.
    // Only untouched legacy contracts are redistributed; awakened/renewed
    // contracts retain their saved wage promise.
    legacyReserveWages.set(`${club.id}-p12`, 282 + index * 8);
    legacyReserveWages.set(`${club.id}-p13`, 304 + index * 8);
  });

  let changed = missing.length > 0
    || state.trainingRules === undefined
    || savedAwakening === undefined
    || savedAwakening.usedTriggerIds === undefined;
  const players = [
    ...state.players.map(player => {
      const current = launchById.get(player.id);
      const legacyWage = legacyReserveWages.get(player.id);
      if (
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

  if (!changed) return state;

  return {
    ...state,
    awakening: savedAwakening === undefined
      ? { matchesSinceLastAwakening: 0, usedTriggerIds: [] }
      : {
          ...savedAwakening,
          usedTriggerIds: savedAwakening.usedTriggerIds ?? [],
        },
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
}
