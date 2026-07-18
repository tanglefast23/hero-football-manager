import { loadLaunchContent, type LaunchContent } from '../content';
import type { CareerSetup } from '../game';

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
