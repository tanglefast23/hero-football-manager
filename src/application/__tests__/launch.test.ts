import { loadLaunchContent } from '../../content';
import { buildCareerTeams, createCareer } from '../../game';
import { runHeadlessFullCareer } from '../../game/headless';
import { serializeGameState } from '../../persistence/game-state-codec';
import { playerLookId } from '../../render/sprites/player-look';
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
    expect(first.players.every(player =>
      player.age !== undefined
      && player.archetype !== undefined
      && player.potential !== undefined
      && player.personality !== undefined
      && player.condition === 100
      && player.retirementAge !== undefined,
    )).toBe(true);
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
    const { launchRosterVersion: _rosterVersion, ...withoutRosterVersion } = current;
    const legacy = {
      ...withoutRosterVersion,
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

  it('marks an established full career without restoring departed launch players', () => {
    const content = loadLaunchContent();
    const current = createCareer(createLaunchCareerSetup(
      7,
      DEFAULT_USER_CLUB_ID,
      content,
      'full',
    ));
    const established = {
      ...current,
      season: 2,
      launchRosterVersion: undefined,
      players: current.players.filter(player => player.id !== 'bramble-rovers-p14'),
    };

    const reconciled = reconcileLaunchRoster(established, content, true);

    expect(reconciled.launchRosterVersion).toBe(1);
    expect(reconciled.players.some(player => player.id === 'bramble-rovers-p14')).toBe(false);
    expect(reconciled.players.every(player =>
      reconciled.clubs.some(club => club.id === player.clubId),
    )).toBe(true);
  });

  it('expands a recognizable legacy roster without restoring an earlier departure', () => {
    const content = loadLaunchContent();
    const current = createCareer(createLaunchCareerSetup(7, DEFAULT_USER_CLUB_ID, content));
    const { launchRosterVersion: _version, ...preMarker } = current;
    const legacy = {
      ...preMarker,
      players: preMarker.players.filter(player => (
        !/-p1[456]$/.test(player.id) && player.id !== 'bramble-rovers-p13'
      )),
    };

    const reconciled = reconcileLaunchRoster(legacy, content);

    expect(reconciled.players.some(player => player.id === 'bramble-rovers-p13')).toBe(false);
    expect(reconciled.players.filter(player => /-p1[456]$/.test(player.id))).toHaveLength(30);
  });

  it('reconciles full careers saved before immediate cash history existed', () => {
    const current = createCareer(createLaunchCareerSetup(
      8,
      DEFAULT_USER_CLUB_ID,
      loadLaunchContent(),
      'full',
    ));
    const { cashTransactions: _history, ...legacy } = current;

    const reconciled = reconcileLaunchRoster(legacy as typeof current, loadLaunchContent(), true);

    expect(reconciled.cashTransactions).toEqual([]);
  });

  it('reloads a full career past season 1 without adding orphan launch players', () => {
    // Regression: the league reshuffles each season via promotion/relegation, so
    // launch-roster players for departed clubs must not be re-added on reload — doing
    // so referenced clubs absent from state.clubs and made the save unrecoverable.
    for (const seed of [8, 77, generateCareerSeed(1)]) {
      const past = runHeadlessFullCareer(
        createLaunchCareerSetup(seed, undefined, loadLaunchContent(), 'full'),
        2,
      );
      const reconciled = reconcileLaunchRoster(past, loadLaunchContent(), true);
      const clubIds = new Set(reconciled.clubs.map(club => club.id));
      expect(reconciled.players.every(player => clubIds.has(player.clubId))).toBe(true);
      // the app re-saves the reconciled state on load; this must not throw
      expect(() => serializeGameState(reconciled)).not.toThrow();
    }
  });

  it('backfills an old deep save while preserving non-colliding user faces', () => {
    const past = runHeadlessFullCareer(
      createLaunchCareerSetup(20260722, undefined, loadLaunchContent(), 'full'),
      7,
    );
    const oldSave = {
      ...past,
      players: past.players.map(({ lookId: _lookId, ...player }) => player),
    };
    const expectedUserLooks = new Map(oldSave.players
      .filter(player => player.clubId === oldSave.userClubId)
      .map(player => [player.id, playerLookId(player.id, player.role)]));
    const userIdsByOldLook = new Map<string, string[]>();
    for (const [playerId, lookId] of expectedUserLooks) {
      const playerIds = userIdsByOldLook.get(lookId) ?? [];
      playerIds.push(playerId);
      userIdsByOldLook.set(lookId, playerIds);
    }

    const reconciled = reconcileLaunchRoster(oldSave, loadLaunchContent(), true);
    const reconciledUserPlayers = reconciled.players
      .filter(player => player.clubId === reconciled.userClubId);
    const changedPlayers = reconciledUserPlayers.filter(player => (
      player.lookId !== expectedUserLooks.get(player.id)
    ));

    expect(new Set(reconciledUserPlayers.map(player => player.lookId)).size)
      .toBe(reconciledUserPlayers.length);
    for (const player of reconciledUserPlayers) {
      const oldLookId = expectedUserLooks.get(player.id);
      expect(oldLookId).toBeDefined();
      if ((userIdsByOldLook.get(oldLookId ?? '')?.length ?? 0) === 1) {
        expect(player.lookId).toBe(oldLookId);
      }
    }
    expect(changedPlayers).toHaveLength(1);
    expect(userIdsByOldLook.get(expectedUserLooks.get(changedPlayers[0].id) ?? ''))
      .toHaveLength(2);
    expect(reconcileLaunchRoster(reconciled, loadLaunchContent(), true))
      .toStrictEqual(reconciled);
  });
});
