import { loadLaunchContent, type LaunchContent } from '../content';
import type { CareerSetup, GameState } from '../game';

export const DEFAULT_CAREER_SEED = 20260718;
export const DEFAULT_USER_CLUB_ID = 'bramble-rovers';

export function createLaunchCareerSetup(
  seed = DEFAULT_CAREER_SEED,
  userClubId = DEFAULT_USER_CLUB_ID,
  content: LaunchContent = loadLaunchContent(),
): CareerSetup {
  return {
    seed,
    userClubId,
    startingTrainingPoints: 30,
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
      contractSeasonsRemaining: player.contractSeasonsRemaining,
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
  const launch = createLaunchCareerSetup(state.careerSeed, state.userClubId, content);
  const launchPlayers = launch.players ?? [];
  const existingIds = new Set(state.players.map(player => player.id));
  const missing = launchPlayers.filter(player => !existingIds.has(player.id));
  if (missing.length === 0) return state;

  const launchById = new Map(launchPlayers.map(player => [player.id, player]));
  const legacyReserveWages = new Map<string, number>();
  content.clubs.clubs.forEach((club, index) => {
    // Before the roster expansion, p12/p13 carried the full reserve payroll.
    // Only untouched legacy contracts are redistributed; awakened/renewed
    // contracts retain their saved wage promise.
    legacyReserveWages.set(`${club.id}-p12`, 282 + index * 8);
    legacyReserveWages.set(`${club.id}-p13`, 304 + index * 8);
  });

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
        return { ...player, weeklyWage: current.weeklyWage };
      }
      return player;
    }),
    ...missing.map(player => ({ ...player, attrs: { ...player.attrs } })),
  ];
  const wageByClub = new Map<string, number>();
  for (const player of players) {
    wageByClub.set(player.clubId, (wageByClub.get(player.clubId) ?? 0) + player.weeklyWage);
  }

  return {
    ...state,
    players,
    clubs: state.clubs.map(club => ({
      ...club,
      weeklyWages: wageByClub.get(club.id) ?? club.weeklyWages,
    })),
  };
}
