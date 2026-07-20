import { createCareer } from '../../../game/career';
import { createLaunchCareerSetup } from '../../../application/launch';
import { playerLookId } from '../player-look';

describe('career roster visual diversity', () => {
  it('gives the launch squads broad face coverage and a fully distinct user roster', () => {
    const career = createCareer(createLaunchCareerSetup(20260720, undefined, undefined, 'full'));
    const coverage = career.clubs.map(club => {
      const roster = career.players.filter(player => player.clubId === club.id);
      const looks = roster.map(player => playerLookId(player.id, player.role));
      return { clubId: club.id, players: roster.length, uniqueLooks: new Set(looks).size };
    });
    const userCoverage = coverage.find(club => club.clubId === career.userClubId)!;
    expect(userCoverage.uniqueLooks).toBe(userCoverage.players);
    expect(Math.min(...coverage.map(club => club.uniqueLooks))).toBeGreaterThanOrEqual(14);
  });
});
