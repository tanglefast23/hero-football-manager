import { loadLaunchContent } from '../../content';
import { buildCareerTeams, createCareer } from '../../game';
import { createLaunchCareerSetup, DEFAULT_USER_CLUB_ID } from '../launch';

describe('launch career adapter', () => {
  it('maps validated content into a complete deterministic career', () => {
    const first = createCareer(createLaunchCareerSetup());
    const second = createCareer(createLaunchCareerSetup());

    expect(first).toEqual(second);
    expect(first.clubs).toHaveLength(10);
    expect(first.players).toHaveLength(130);
    expect(first.players.filter(player => player.clubId === DEFAULT_USER_CLUB_ID)).toHaveLength(13);
    expect(first.lineups).toHaveLength(10);
    expect(Object.keys(buildCareerTeams(first))).toHaveLength(10);
    expect(first.players.filter(player =>
      player.clubId === DEFAULT_USER_CLUB_ID && player.power !== undefined,
    )).toHaveLength(0);
    expect(first.players.filter(player =>
      player.clubId === DEFAULT_USER_CLUB_ID && player.licensed,
    )).toHaveLength(0);
  });

  it('derives club wage totals from the content roster', () => {
    const content = loadLaunchContent();
    const setup = createLaunchCareerSetup(7, DEFAULT_USER_CLUB_ID, content);
    const bramble = content.clubs.clubs.find(club => club.id === DEFAULT_USER_CLUB_ID)!;
    const expected = bramble.players.reduce((sum, player) => sum + player.weeklyWage, 0);

    expect(setup.clubs.find(club => club.id === DEFAULT_USER_CLUB_ID)?.weeklyWages).toBe(expected);
  });
});
