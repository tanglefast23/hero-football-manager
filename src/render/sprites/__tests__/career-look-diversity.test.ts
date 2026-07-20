import { createCareer } from '../../../game/career';
import { createLaunchCareerSetup } from '../../../application/launch';
import { runHeadlessFullCareer } from '../../../game/headless';
import { playerLookId } from '../player-look';

describe('career roster visual diversity', () => {
  it('gives all 160 launch players a distinct look', () => {
    const career = createCareer(createLaunchCareerSetup(20260720, undefined, undefined, 'full'));
    const coverage = career.clubs.map(club => {
      const roster = career.players.filter(player => player.clubId === club.id);
      const looks = roster.map(player => playerLookId(player.id, player.role));
      return { clubId: club.id, players: roster.length, uniqueLooks: new Set(looks).size };
    });
    const userCoverage = coverage.find(club => club.clubId === career.userClubId)!;
    expect(userCoverage.uniqueLooks).toBe(userCoverage.players);
    expect(Math.min(...coverage.map(club => club.uniqueLooks))).toBe(16);
    expect(new Set(career.players.map(player => playerLookId(player.id, player.role))).size).toBe(160);
  });

  it('keeps every club distinct and avoids obvious opponent repeats deep into an endless career', () => {
    const career = runHeadlessFullCareer(
      createLaunchCareerSetup(20260720, undefined, undefined, 'full'),
      7,
    );
    const userRoster = career.players.filter(player => player.clubId === career.userClubId);
    const userLooks = userRoster.map(player => playerLookId(player.id, player.role));
    expect(new Set(userLooks).size).toBe(userRoster.length);

    for (const club of career.clubs.filter(club => club.id !== career.userClubId)) {
      const opponent = career.players.filter(player => player.clubId === club.id);
      const opponentLooks = opponent.map(player => playerLookId(player.id, player.role));
      expect(new Set(opponentLooks).size).toBe(opponent.length);
      expect(new Set([...userLooks, ...opponentLooks]).size).toBeGreaterThanOrEqual(30);
    }
  });
});
