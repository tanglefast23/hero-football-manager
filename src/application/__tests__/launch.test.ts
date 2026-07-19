import { loadLaunchContent } from '../../content';
import { buildCareerTeams, createCareer } from '../../game';
import {
  createLaunchCareerSetup,
  DEFAULT_USER_CLUB_ID,
  generateCareerSeed,
  reconcileLaunchRoster,
} from '../launch';

describe('launch career adapter', () => {
  it('maps validated content into a complete deterministic career', () => {
    const first = createCareer(createLaunchCareerSetup());
    const second = createCareer(createLaunchCareerSetup());

    expect(first).toEqual(second);
    expect(first.clubs).toHaveLength(10);
    expect(first.players).toHaveLength(160);
    expect(first.players.filter(player => player.clubId === DEFAULT_USER_CLUB_ID)).toHaveLength(16);
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

  it('generates distinct valid seeds even within one clock millisecond', () => {
    const first = generateCareerSeed(123456789);
    const second = generateCareerSeed(123456789);

    expect(first).not.toBe(second);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(4294967295);
    expect(second).toBeGreaterThanOrEqual(0);
    expect(second).toBeLessThanOrEqual(4294967295);
  });

  it('upgrades legacy 13-player saves to 16-player clubs without inflating payroll', () => {
    const content = loadLaunchContent();
    const current = createCareer(createLaunchCareerSetup(7, DEFAULT_USER_CLUB_ID, content));
    const clubIndex = new Map(content.clubs.clubs.map((club, index) => [club.id, index]));
    const legacyPlayers = current.players
      .filter(player => !/-p1[456]$/.test(player.id))
      .map(player => {
        const index = clubIndex.get(player.clubId)!;
        if (player.id.endsWith('-p12')) return { ...player, weeklyWage: 282 + index * 8 };
        if (player.id.endsWith('-p13')) return { ...player, weeklyWage: 304 + index * 8 };
        return player;
      });
    const legacy = {
      ...current,
      players: legacyPlayers,
      clubs: current.clubs.map(club => ({
        ...club,
        weeklyWages: legacyPlayers
          .filter(player => player.clubId === club.id)
          .reduce((sum, player) => sum + player.weeklyWage, 0),
      })),
    };

    const migrated = reconcileLaunchRoster(legacy, content);
    expect(migrated.players).toHaveLength(160);
    expect(migrated.players.filter(player => player.clubId === DEFAULT_USER_CLUB_ID)).toHaveLength(16);
    expect(migrated.players.find(player => player.id === 'bramble-rovers-p12')?.weeklyWage).toBe(110);
    const bramblePayroll = migrated.players
      .filter(player => player.clubId === DEFAULT_USER_CLUB_ID)
      .reduce((sum, player) => sum + player.weeklyWage, 0);
    expect(migrated.clubs.find(club => club.id === DEFAULT_USER_CLUB_ID)?.weeklyWages).toBe(bramblePayroll);
    expect(reconcileLaunchRoster(migrated, content)).toBe(migrated);
  });
});
