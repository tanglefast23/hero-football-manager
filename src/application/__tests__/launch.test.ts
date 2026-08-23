import { loadLaunchContent } from '../../content';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
  buildCareerTeams,
  createCareer,
  CUP_SETTLEMENT_WEEKS,
  enableFullCareer,
  playerAttributeCaps,
  playerPotentialGrade,
} from '../../game';
import { runHeadlessFullCareer } from '../../game/headless';
import { reducedPlayerWeeklyWage } from '../../game/market';
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
    // 161, not 160: the strongest D5 rival fields Larry Alan on top of its
    // sixteen. See src/game/special-heroes.ts.
    expect(first.players).toHaveLength(161);
    expect(
      first.players.filter((player) => player.clubId === DEFAULT_USER_CLUB_ID),
    ).toHaveLength(16);
    expect(first.lineups).toHaveLength(10);
    expect(Object.keys(buildCareerTeams(first))).toHaveLength(10);
    expect(
      first.players.filter(
        (player) =>
          player.clubId === DEFAULT_USER_CLUB_ID && player.power !== undefined,
      ),
    ).toHaveLength(0);
    expect(
      first.players.filter(
        (player) => player.clubId === DEFAULT_USER_CLUB_ID && player.licensed,
      ),
    ).toHaveLength(0);
    expect(
      first.players.every(
        (player) =>
          player.age !== undefined &&
          player.archetype !== undefined &&
          player.potential !== undefined &&
          player.potentialCeiling !== undefined &&
          player.potentialCeiling >= 46 &&
          player.potentialCeiling <= 99 &&
          player.personality !== undefined &&
          player.condition === 100 &&
          player.retirementAge !== undefined,
      ),
    ).toBe(true);
  });

  it('updates a saved special hero to the current canonical name and head', () => {
    const current = createCareer(createLaunchCareerSetup());
    const stale = {
      ...current,
      players: current.players.map((player) =>
        player.id === 'special-f171'
          ? { ...player, name: 'Barry Allan', lookId: 'f01' }
          : player,
      ),
    };

    const reconciled = reconcileLaunchRoster(stale);

    expect(
      reconciled.players.find((player) => player.id === 'special-f171'),
    ).toMatchObject({ name: 'Larry Alan', lookId: 'f171' });
  });

  it('moves an old saved league schedule off future Cup weeks without rewriting results', () => {
    const current = createCareer(createLaunchCareerSetup(2_608_140));
    const oldWeek = (round: number) =>
      round === 18 ? 30 : 5 + Math.floor(((round - 1) * 23) / 17);
    const stale = {
      ...current,
      season: 2,
      week: 10,
      fixtures: current.fixtures.map((fixture) => ({
        ...fixture,
        season: 2,
        week: oldWeek(fixture.round),
        ...(fixture.round < 5
          ? { status: 'played' as const, score: { homeGoals: 1, awayGoals: 0 } }
          : { status: 'scheduled' as const, score: undefined }),
      })),
    };
    const playedBefore = stale.fixtures
      .filter((fixture) => fixture.status === 'played')
      .map((fixture) => ({
        id: fixture.id,
        week: fixture.week,
        score: fixture.score,
      }));

    const migrated = reconcileLaunchRoster(stale);
    const scheduled = migrated.fixtures.filter(
      (fixture) => fixture.season === 2 && fixture.status === 'scheduled',
    );

    expect(
      migrated.fixtures
        .filter((fixture) => fixture.status === 'played')
        .map((fixture) => ({
          id: fixture.id,
          week: fixture.week,
          score: fixture.score,
        })),
    ).toEqual(playedBefore);
    expect(scheduled.every((fixture) => fixture.week >= stale.week)).toBe(true);
    expect(
      scheduled.some((fixture) =>
        CUP_SETTLEMENT_WEEKS.includes(
          fixture.week as (typeof CUP_SETTLEMENT_WEEKS)[number],
        ),
      ),
    ).toBe(false);
    expect(reconcileLaunchRoster(migrated)).toEqual(migrated);
  });

  it('repairs the old default club name in the saved pyramid', () => {
    const current = createCareer(createLaunchCareerSetup());
    const renamed = {
      ...current,
      clubs: current.clubs.map((club) =>
        club.id === current.userClubId
          ? { ...club, name: 'Thistle Town' }
          : club,
      ),
    };

    const reconciled = reconcileLaunchRoster(renamed);
    const pyramidClub = reconciled.m2?.pyramid.divisions
      .flatMap((division) => division.clubs)
      .find((club) => club.id === reconciled.userClubId);

    expect(pyramidClub?.name).toBe('Thistle Town');
    expect(reconcileLaunchRoster(reconciled)).toStrictEqual(reconciled);
  });

  it('derives club wage totals from the content roster', () => {
    const content = loadLaunchContent();
    const setup = createLaunchCareerSetup(7, DEFAULT_USER_CLUB_ID, content);
    const bramble = content.clubs.clubs.find(
      (club) => club.id === DEFAULT_USER_CLUB_ID,
    )!;
    const expected = bramble.players.reduce(
      (sum, player) => sum + reducedPlayerWeeklyWage(player.weeklyWage),
      0,
    );

    expect(
      setup.clubs.find((club) => club.id === DEFAULT_USER_CLUB_ID)?.weeklyWages,
    ).toBe(expected);
  });

  it('starts the Division 5 user squad with only early E/D-range potential grades', () => {
    const career = createCareer(createLaunchCareerSetup(20260718));
    const grades = career.players
      .filter((player) => player.clubId === career.userClubId)
      .map(playerPotentialGrade);

    expect(grades).toHaveLength(16);
    expect(
      grades.every((grade) => grade.startsWith('E') || grade.startsWith('D')),
    ).toBe(true);
  });

  it('gives every starting player open room to the universal safety ceiling', () => {
    const career = createCareer(createLaunchCareerSetup(20260718));
    const players = career.players.filter(
      (player) => player.clubId === career.userClubId,
    );

    for (const player of players) {
      const caps = playerAttributeCaps(player);
      const relevant =
        player.role === 'GK'
          ? (['pac', 'pas', 'def', 'tec', 'sta', 'ref'] as const)
          : (['pac', 'sho', 'pas', 'def', 'tec', 'sta'] as const);
      const trainableAttributes = relevant.filter(
        (attribute) => caps[attribute] > player.attrs[attribute],
      );

      expect(Object.values(caps).every((cap) => cap === 999)).toBe(true);
      expect(trainableAttributes).toHaveLength(relevant.length);
    }
  });

  it('repairs old Division 5 launch-player potential without changing the hired main player', () => {
    const content = loadLaunchContent();
    const initial = beginStoryOnboarding(
      createCareer(
        createLaunchCareerSetup(20260718, DEFAULT_USER_CLUB_ID, content),
      ),
    );
    const withHero = addCreatedPlayer(initial, {
      name: 'Jo Rook',
      ratings: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50 },
    });
    const heroBefore = withHero.players.find(
      (player) => player.id === withHero.onboarding?.createdPlayerId,
    )!;
    const stale = {
      ...withHero,
      players: withHero.players.map((player) =>
        player.id === 'bramble-rovers-p08'
          ? { ...player, potential: 4 as const, potentialCeiling: 93 }
          : player,
      ),
    };

    const repaired = reconcileLaunchRoster(stale, content);
    const ordinaryPlayer = repaired.players.find(
      (player) => player.id === 'bramble-rovers-p08',
    )!;
    const heroAfter = repaired.players.find(
      (player) => player.id === heroBefore.id,
    )!;

    expect(ordinaryPlayer.potential).toBe(1);
    expect(playerPotentialGrade(ordinaryPlayer)).toMatch(/^E/);
    expect(heroAfter.potential).toBe(heroBefore.potential);
    expect(heroAfter.potentialCeiling).toBe(heroBefore.potentialCeiling);
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
    const current = createCareer(
      createLaunchCareerSetup(7, DEFAULT_USER_CLUB_ID, content),
    );
    const clubIndex = new Map(
      content.clubs.clubs.map((club, index) => [club.id, index]),
    );
    const legacyPlayers = current.players
      .filter((player) => !/-p1[456]$/.test(player.id))
      .map((player) => {
        const index = clubIndex.get(player.clubId)!;
        if (player.id.endsWith('-p12'))
          return { ...player, weeklyWage: 282 + index * 8 };
        if (player.id.endsWith('-p13'))
          return { ...player, weeklyWage: 304 + index * 8 };
        return player;
      });
    const { launchRosterVersion: _rosterVersion, ...withoutRosterVersion } =
      current;
    const legacy = {
      ...withoutRosterVersion,
      players: legacyPlayers,
      clubs: current.clubs.map((club) => ({
        ...club,
        weeklyWages: legacyPlayers
          .filter((player) => player.clubId === club.id)
          .reduce((sum, player) => sum + player.weeklyWage, 0),
      })),
    };

    const migrated = reconcileLaunchRoster(legacy, content);
    expect(migrated.players).toHaveLength(161);
    expect(
      migrated.players.filter(
        (player) => player.clubId === DEFAULT_USER_CLUB_ID,
      ),
    ).toHaveLength(16);
    // The point is that migration restores the AUTHORED wage rather than the
    // inflated one the legacy save carried, so read it from content instead of
    // pinning a number that moves whenever wages are rebalanced.
    const authoredP12Wage = content.clubs.clubs
      .find((club) => club.id === DEFAULT_USER_CLUB_ID)!
      .players.find((player) => player.id === 'bramble-rovers-p12')!.weeklyWage;
    expect(
      migrated.players.find((player) => player.id === 'bramble-rovers-p12')
        ?.weeklyWage,
    ).toBe(reducedPlayerWeeklyWage(authoredP12Wage));
    const bramblePayroll = migrated.players
      .filter((player) => player.clubId === DEFAULT_USER_CLUB_ID)
      .reduce((sum, player) => sum + player.weeklyWage, 0);
    expect(
      migrated.clubs.find((club) => club.id === DEFAULT_USER_CLUB_ID)
        ?.weeklyWages,
    ).toBe(bramblePayroll);
    // Reconciling rebuilds the career sidecars, so idempotence is by value.
    expect(reconcileLaunchRoster(migrated, content)).toStrictEqual(migrated);
  });

  it('rebases a drill catalog left behind by a balance retune', () => {
    // `trainingRules.focusDrills` is baked into the save, so a gains retune that
    // only reached New Game would never be felt in the career actually being
    // played. Tier II here carries the pre-retune +7.
    const content = loadLaunchContent();
    const current = createCareer(
      createLaunchCareerSetup(20260806, undefined, content),
    );
    const stale = {
      ...current,
      trainingRules: {
        focusDrills: current.trainingRules!.focusDrills.map((drill) =>
          drill.id === 'sprints-ii' ? { ...drill, gains: { pac: 7 } } : drill,
        ),
      },
    };

    const rebased = reconcileLaunchRoster(stale, content);

    const shipped = content.training.focusDrills.find(
      (drill) => drill.id === 'sprints-ii',
    )!;
    expect(
      rebased.trainingRules!.focusDrills.find(
        (drill) => drill.id === 'sprints-ii',
      )?.gains,
    ).toEqual(shipped.gains);
    // And a catalog that already matches is left alone, so resuming a current
    // save is not a write every time.
    expect(reconcileLaunchRoster(rebased, content)).toStrictEqual(rebased);
  });

  it('rebases settled player requests but leaves an open decision unchanged', () => {
    const content = loadLaunchContent();
    const current = createCareer(
      createLaunchCareerSetup(20260814, undefined, content),
    );
    const legacyRules = {
      ...content.playerRequests,
      requests: content.playerRequests.requests.map((request) =>
        request.id === 'gold-boots'
          ? {
              ...request,
              cost: { kind: 'MONEY_PLAYER' as const, wageMultiple: 4 },
            }
          : request,
      ),
    };
    const stale = { ...current, playerRequestRules: legacyRules };

    const rebased = reconcileLaunchRoster(stale, content);
    expect(
      rebased.playerRequestRules?.requests.find(
        (request) => request.id === 'gold-boots',
      )?.cost,
    ).toEqual({ kind: 'MONEY_PLAYER', wageMultiple: 6 });

    const open = {
      ...stale,
      playerRequests: {
        weeksSinceRequest: 0,
        effects: [],
        history: [],
        pending: {
          requestId: 'gold-boots',
          playerId: stale.players.find(
            (player) => player.clubId === stale.userClubId,
          )!.id,
          askedSeason: stale.season,
          askedWeek: stale.week,
          costAmount: 1_000,
          warned: false,
        },
      },
    };
    expect(reconcileLaunchRoster(open, content).playerRequestRules).toEqual(
      legacyRules,
    );
  });

  it('rebases future sponsor rules without rewriting signed terms', () => {
    const content = loadLaunchContent();
    const current = enableFullCareer(
      createCareer(createLaunchCareerSetup(20260814, undefined, content)),
    );
    const legacyRules = {
      ...current.sponsorRules!,
      objectives: [
        {
          id: 'league-wins',
          kind: 'LEAGUE_WINS' as const,
          labelTemplate: 'Win {target} league matches',
          targets: { EASY: 5, NORMAL: 8, HARD: 12 },
          chairmanDelta: 2,
        },
        ...current.sponsorRules!.objectives.slice(1),
      ],
    };
    const signed = current.clubBusiness.sponsorship.activeContracts[0];
    const stale = { ...current, sponsorRules: legacyRules };

    const rebased = reconcileLaunchRoster(stale, content);

    expect(rebased.sponsorRules?.objectives.map((rule) => rule.kind)).toEqual([
      'LEAGUE_CLEAN_SHEETS',
      'LEAGUE_THREE_GOAL_GAMES',
      'LEAGUE_AWAY_POINTS',
    ]);
    expect(rebased.clubBusiness.sponsorship.activeContracts[0]).toEqual(signed);
  });

  it('marks an established full career without restoring departed launch players', () => {
    const content = loadLaunchContent();
    const current = createCareer(
      createLaunchCareerSetup(7, DEFAULT_USER_CLUB_ID, content),
    );
    const established = {
      ...current,
      season: 2,
      launchRosterVersion: undefined,
      players: current.players.filter(
        (player) => player.id !== 'bramble-rovers-p14',
      ),
    };

    const reconciled = reconcileLaunchRoster(established, content);

    expect(reconciled.launchRosterVersion).toBe(5);
    expect(
      reconciled.players.some((player) => player.id === 'bramble-rovers-p14'),
    ).toBe(false);
    expect(
      reconciled.players.every((player) =>
        reconciled.clubs.some((club) => club.id === player.clubId),
      ),
    ).toBe(true);
  });

  it('expands a recognizable legacy roster without restoring an earlier departure', () => {
    const content = loadLaunchContent();
    const current = createCareer(
      createLaunchCareerSetup(7, DEFAULT_USER_CLUB_ID, content),
    );
    const { launchRosterVersion: _version, ...preMarker } = current;
    const legacy = {
      ...preMarker,
      players: preMarker.players.filter(
        (player) =>
          !/-p1[456]$/.test(player.id) && player.id !== 'bramble-rovers-p13',
      ),
    };

    const reconciled = reconcileLaunchRoster(legacy, content);

    expect(
      reconciled.players.some((player) => player.id === 'bramble-rovers-p13'),
    ).toBe(false);
    expect(
      reconciled.players.filter((player) => /-p1[456]$/.test(player.id)),
    ).toHaveLength(30);
  });

  it('reconciles full careers saved before immediate cash history existed', () => {
    const current = createCareer(
      createLaunchCareerSetup(8, DEFAULT_USER_CLUB_ID, loadLaunchContent()),
    );
    const { cashTransactions: _history, ...legacy } = current;

    const reconciled = reconcileLaunchRoster(
      legacy as typeof current,
      loadLaunchContent(),
    );

    expect(reconciled.cashTransactions).toEqual([]);
  });

  it('cuts pre-reduction saved player wages by 15% once and leaves current coach contracts alone', () => {
    const current = enableFullCareer(
      createCareer(createLaunchCareerSetup(20260810, DEFAULT_USER_CLUB_ID)),
    );
    const market = current.market!;
    const saved = {
      ...current,
      launchRosterVersion: 3,
      players: current.players.map((player) => ({
        ...player,
        weeklyWage: 1_000,
      })),
      clubs: current.clubs.map((club) => ({
        ...club,
        weeklyWages:
          current.players.filter((player) => player.clubId === club.id).length *
          1_000,
      })),
      market,
    };

    const migrated = reconcileLaunchRoster(saved);

    expect(migrated.launchRosterVersion).toBe(5);
    expect(migrated.players.every((player) => player.weeklyWage === 850)).toBe(
      true,
    );
    expect(migrated.market).toStrictEqual(market);
    for (const club of migrated.clubs) {
      expect(club.weeklyWages).toBe(
        migrated.players
          .filter((player) => player.clubId === club.id)
          .reduce((sum, player) => sum + player.weeklyWage, 0),
      );
    }
    expect(reconcileLaunchRoster(migrated)).toStrictEqual(migrated);
  });

  it('cuts version-4 saved player wages by one additional 5% once', () => {
    const current = enableFullCareer(
      createCareer(createLaunchCareerSetup(20260811, DEFAULT_USER_CLUB_ID)),
    );
    const saved = {
      ...current,
      launchRosterVersion: 4,
      players: current.players.map((player) => ({
        ...player,
        weeklyWage: 900,
      })),
      clubs: current.clubs.map((club) => ({
        ...club,
        weeklyWages:
          current.players.filter((player) => player.clubId === club.id).length *
          900,
      })),
    };

    const migrated = reconcileLaunchRoster(saved);

    expect(migrated.launchRosterVersion).toBe(5);
    expect(migrated.players.every((player) => player.weeklyWage === 855)).toBe(
      true,
    );
    expect(reconcileLaunchRoster(migrated)).toStrictEqual(migrated);
  });

  it('reprices every saved coach once', () => {
    const current = createCareer(
      createLaunchCareerSetup(20260810, DEFAULT_USER_CLUB_ID),
    );
    const headCoach = current.market!.coachCandidates[0]!;
    const assistantCoach = current.market!.coachCandidates[1]!;
    const saved = {
      ...current,
      launchRosterVersion: 3,
      players: current.players.map((player) => ({
        ...player,
        weeklyWage: 900,
      })),
      clubs: current.clubs.map((club) => ({
        ...club,
        weeklyWages:
          current.players.filter((player) => player.clubId === club.id).length *
          900,
      })),
      market: {
        ...current.market!,
        coachCandidates: current
          .market!.coachCandidates.slice(2)
          .map((coach) => ({
            ...coach,
            weeklyWage: 400 * coach.level,
          })),
        headCoach: { ...headCoach, weeklyWage: 400 * headCoach.level },
        assistantCoach: {
          ...assistantCoach,
          weeklyWage: 200 * assistantCoach.level,
        },
      },
    };

    const migrated = reconcileLaunchRoster(saved);

    expect(migrated.launchRosterVersion).toBe(5);
    expect(migrated.market?.headCoach?.weeklyWage).toBe(300 * headCoach.level);
    expect(migrated.market?.assistantCoach?.weeklyWage).toBe(
      150 * assistantCoach.level,
    );
    expect(
      migrated.market?.coachCandidates.every(
        (coach) => coach.weeklyWage === 300 * coach.level,
      ),
    ).toBe(true);
    expect(migrated.players.every((player) => player.weeklyWage === 855)).toBe(
      true,
    );
    expect(reconcileLaunchRoster(migrated)).toStrictEqual(migrated);
  });

  it('reloads a full career past season 1 without adding orphan launch players', () => {
    // Regression: the league reshuffles each season via promotion/relegation, so
    // launch-roster players for departed clubs must not be re-added on reload — doing
    // so referenced clubs absent from state.clubs and made the save unrecoverable.
    for (const seed of [8, 77, generateCareerSeed(1)]) {
      const past = runHeadlessFullCareer(
        createLaunchCareerSetup(seed, undefined, loadLaunchContent()),
        2,
      );
      const reconciled = reconcileLaunchRoster(past, loadLaunchContent());
      const clubIds = new Set(reconciled.clubs.map((club) => club.id));
      expect(
        reconciled.players.every((player) => clubIds.has(player.clubId)),
      ).toBe(true);
      // the app re-saves the reconciled state on load; this must not throw
      expect(() => serializeGameState(reconciled)).not.toThrow();
    }
  });

  it('backfills an old deep save while preserving non-colliding user faces', () => {
    const past = runHeadlessFullCareer(
      createLaunchCareerSetup(20260722, undefined, loadLaunchContent()),
      7,
    );
    const oldSave = {
      ...past,
      players: past.players.map(({ lookId: _lookId, ...player }) => player),
    };
    const expectedUserLooks = new Map(
      oldSave.players
        .filter((player) => player.clubId === oldSave.userClubId)
        .map((player) => [player.id, playerLookId(player.id, player.role)]),
    );
    const userIdsByOldLook = new Map<string, string[]>();
    for (const [playerId, lookId] of expectedUserLooks) {
      const playerIds = userIdsByOldLook.get(lookId) ?? [];
      playerIds.push(playerId);
      userIdsByOldLook.set(lookId, playerIds);
    }

    const reconciled = reconcileLaunchRoster(oldSave, loadLaunchContent());
    const reconciledUserPlayers = reconciled.players.filter(
      (player) => player.clubId === reconciled.userClubId,
    );
    const changedPlayers = reconciledUserPlayers.filter(
      (player) => player.lookId !== expectedUserLooks.get(player.id),
    );

    expect(
      new Set(reconciledUserPlayers.map((player) => player.lookId)).size,
    ).toBe(reconciledUserPlayers.length);
    for (const player of reconciledUserPlayers) {
      const oldLookId = expectedUserLooks.get(player.id);
      expect(oldLookId).toBeDefined();
      if ((userIdsByOldLook.get(oldLookId ?? '')?.length ?? 0) === 1) {
        expect(player.lookId).toBe(oldLookId);
      }
    }
    const duplicateOverflow = [...userIdsByOldLook.values()].reduce(
      (count, playerIds) => count + Math.max(0, playerIds.length - 1),
      0,
    );
    expect(changedPlayers).toHaveLength(duplicateOverflow);
    expect(
      changedPlayers.every(
        (player) =>
          (userIdsByOldLook.get(expectedUserLooks.get(player.id) ?? '')
            ?.length ?? 0) > 1,
      ),
    ).toBe(true);
    expect(
      reconcileLaunchRoster(reconciled, loadLaunchContent()),
    ).toStrictEqual(reconciled);
  });
});
