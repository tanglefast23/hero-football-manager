import {
  createLaunchCareerSetup,
  reconcileLaunchRoster,
} from '../../application/launch';
import { createCareer, startNextSeason } from '../career';
import { enableFullCareer } from '../full-career';
import { clubSquadStrength, currentUserDivision } from '../m2-career';
import { DIVISION_STRENGTH_BANDS, tuneSquadToStrength } from '../pyramid';
import { runHeadlessFullCareer } from '../headless';
import { isSpecialHeroId } from '../special-heroes';
import { buildCareerTeamDef } from '../squad';
import type { GameState } from '../types';
import {
  parseStoredGameState,
  serializeGameState,
} from '../../persistence/game-state-codec';
import { matchAttribute, matchPaceAttribute } from '../../sim/attributes';

describe('full M2 career clock', () => {
  test('initializes all divisions, market, cup, and youth intake for every new career', () => {
    const full = createCareer(createLaunchCareerSetup(77));

    expect(full.careerMode).toBe('full');
    expect(
      full.m2?.pyramid.divisions.map((division) => division.clubs.length),
    ).toEqual([10, 10, 10, 10, 10]);
    expect(full.m2?.nationalCups[0].season).toBe(1);
    expect(full.market?.coachCandidates.length).toBeGreaterThanOrEqual(3);
    expect(full.youthIntake).toMatchObject({ season: 1, status: 'OPEN' });
    expect(full.youthIntake?.offers.length).toBeGreaterThanOrEqual(1);
  });

  test('starts the user at the bottom of D5 with a venue-aware first-five curve', () => {
    const full = createCareer({ ...createLaunchCareerSetup(77_003) });
    const strengths = new Map(
      full.clubs.map(
        (club) =>
          [
            club.id,
            clubSquadStrength(
              full.players.filter((player) => player.clubId === club.id),
            ),
          ] as const,
      ),
    );
    const openingOpponents = [1, 2, 3, 4, 5].map((round) => {
      const fixture = full.fixtures.find(
        (candidate) =>
          candidate.round === round &&
          (candidate.homeClubId === full.userClubId ||
            candidate.awayClubId === full.userClubId),
      )!;
      const userIsHome = fixture.homeClubId === full.userClubId;
      return {
        strength: strengths.get(
          userIsHome ? fixture.awayClubId : fixture.homeClubId,
        ),
        userIsHome,
      };
    });

    expect(strengths.get(full.userClubId)).toBe(40);
    expect(Math.min(...strengths.values())).toBe(40);
    // 52, not the 50 the pinning tuned it to. Two sharpenings land on the same
    // club, and it was already the hardest of the five, so both raise the peak
    // rather than reshaping the curve: the opening fixture gets +5 on each of
    // that club's position attributes, worth about a point of squad strength,
    // and the strongest rival in the division now fields Larry Alan, worth
    // another.
    expect(Math.max(...strengths.values())).toBe(52);
    expect(openingOpponents).toEqual([
      { strength: 52, userIsHome: true },
      { strength: 45, userIsHome: false },
      { strength: 46, userIsHome: true },
      { strength: 43, userIsHome: false },
      { strength: 42, userIsHome: true },
    ]);
    // Rewritten deliberately, 2026-08-08. This used to assert zero, encoding
    // the rule that D5 has no opponent heroes at all so the player's first
    // awakening is the only power on the pitch.
    //
    // Half of that still holds and is asserted below: `generatedClubHeroCount`
    // is still 0 for D5, so no *generated* rival awakens. What changed is that
    // the division's strongest club now fields its named character. One power,
    // owned by one man with a name, is a different thing from a league of
    // anonymous heroes — which is why the second assertion checks he is a
    // special rather than just counting to one.
    const poweredRivals = full.players.filter(
      (player) =>
        player.clubId !== full.userClubId && player.power !== undefined,
    );
    expect(poweredRivals.map((player) => player.name)).toEqual(['Larry Alan']);
    expect(poweredRivals.every((player) => isSpecialHeroId(player.id))).toBe(
      true,
    );
  });

  test.each([
    { label: 'Week 5 management', week: 5, phase: 'manage' as const },
    { label: 'matchday', week: 3, phase: 'matchday' as const },
    { label: 'season end', week: 30, phase: 'season-end' as const },
  ])(
    're-provisions a resumed save during $label with an expired intake',
    ({ week, phase }) => {
      const resumedFrom = createCareer(createLaunchCareerSetup(77_001));
      const upgraded = enableFullCareer({ ...resumedFrom, week, phase });

      expect(upgraded.careerMode).toBe('full');
      expect(upgraded.m2).toBeDefined();
      expect(upgraded.market).toBeDefined();
      expect(upgraded.youthIntake).toMatchObject({
        season: upgraded.season,
        status: 'CLOSED',
        offers: [],
      });
    },
  );

  test('closes stale open offers when an already-upgraded save resumes after Week 4', () => {
    const full = createCareer({ ...createLaunchCareerSetup(77_002) });
    const resumed = enableFullCareer({ ...full, week: 6, phase: 'manage' });

    expect(resumed.youthIntake).toMatchObject({ status: 'CLOSED', offers: [] });
  });

  test('carries the request clock across the break but drops leave and effects', () => {
    // The cadence floor is a cooldown between requests, not a barrier at the
    // start of a season. Resetting this to 0 made it bite twice and silenced
    // the whole pre-season, which is shorter than the floor. Effects and leave
    // still go: both are measured in weeks against a season that has ended.
    const initial = createCareer({ ...createLaunchCareerSetup(78) });
    const seasonEnd = {
      ...initial,
      phase: 'season-end' as const,
      playerRequests: {
        weeksSinceRequest: 9,
        effects: [
          {
            kind: 'DRILL_SQUAD' as const,
            weeksRemaining: 3,
            multiplierPercent: 50,
          },
        ],
        history: [],
      },
      fixtures: initial.fixtures.map((fixture) => ({
        ...fixture,
        status: 'played' as const,
        score: { homeGoals: 1, awayGoals: 1 },
      })),
    };
    const next = startNextSeason(seasonEnd);

    expect(next.playerRequests!.weeksSinceRequest).toBe(9);
    expect(next.playerRequests!.effects).toEqual([]);
  });

  test('starts an endless next season with an active ten-club division', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(78) });
    const seasonEnd = {
      ...initial,
      phase: 'season-end' as const,
      fixtures: initial.fixtures.map((fixture, index) => ({
        ...fixture,
        status: 'played' as const,
        score: { homeGoals: index % 3, awayGoals: (index + 1) % 2 },
      })),
    };
    const next = startNextSeason(seasonEnd);

    expect(next.season).toBe(2);
    expect(next.phase).toBe('manage');
    expect(next.clubs).toHaveLength(10);
    expect(
      next.players.filter((player) => player.clubId === next.userClubId).length,
    ).toBeGreaterThanOrEqual(11);
    // 145: nine generated clubs of sixteen, plus the division's named hero on
    // whichever of them is strongest.
    expect(
      next.players.filter((player) => player.clubId !== next.userClubId),
    ).toHaveLength(145);
    expect(next.fixtures).toHaveLength(90);
    expect(next.m2?.nationalCups.at(-1)?.season).toBe(2);
    expect(next.youthIntake).toMatchObject({ season: 2, status: 'OPEN' });
    expect(next.youthIntake?.offers.length).toBeGreaterThanOrEqual(1);
  });

  test('records a promotion permanently after a later relegation', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(78_001) });
    const promoted = startNextSeason(completeSeasonForUser(initial, 'win'));

    expect(currentUserDivision(promoted.m2!)).toBe(4);
    expect(promoted.m2?.highestDivisionReached).toBe(4);

    const contractsReady = {
      ...promoted,
      players: promoted.players.map((player) =>
        player.clubId === promoted.userClubId
          ? {
              ...player,
              contractSeasonsRemaining: Math.max(
                1,
                player.contractSeasonsRemaining,
              ),
            }
          : player,
      ),
    };
    const relegated = startNextSeason(
      completeSeasonForUser(contractsReady, 'loss'),
    );

    expect(currentUserDivision(relegated.m2!)).toBe(5);
    expect(relegated.m2?.highestDivisionReached).toBe(4);
  });

  test('adds the first-reach division fan step to the supporters already earned', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(78_011) });
    const supportersBeforePromotion = 637;
    const withEarnedSupporters = {
      ...initial,
      clubs: initial.clubs.map((club) =>
        club.id === initial.userClubId
          ? { ...club, fans: supportersBeforePromotion }
          : club,
      ),
    };

    const promoted = startNextSeason(
      completeSeasonForUser(withEarnedSupporters, 'win'),
    );
    const promotedClub = promoted.clubs.find(
      (club) => club.id === promoted.userClubId,
    )!;

    expect(currentUserDivision(promoted.m2!)).toBe(4);
    expect(promotedClub.fans).toBe(supportersBeforePromotion + 500);
    expect(promotedClub.fans).not.toBe(1_000);
  });

  test('promotion exposes a deterministically stronger pool of player ceilings', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(78_002) });
    const promoted = startNextSeason(completeSeasonForUser(initial, 'win'));
    const startingOpponents = initial.players.filter(
      (player) => player.clubId !== initial.userClubId,
    );
    const promotedOpponents = promoted.players.filter(
      (player) => player.clubId !== promoted.userClubId,
    );
    const averageCeiling = (players: typeof promotedOpponents) =>
      players.reduce((sum, player) => sum + (player.potentialCeiling ?? 0), 0) /
      players.length;

    expect(currentUserDivision(promoted.m2!)).toBe(4);
    expect(
      promotedOpponents.every(
        (player) => player.potentialCeiling !== undefined,
      ),
    ).toBe(true);
    expect(averageCeiling(promotedOpponents)).toBeGreaterThan(
      averageCeiling(startingOpponents),
    );
    for (const club of promoted.clubs) {
      if (club.id === promoted.userClubId) continue;
      // The generic ramp is unchanged — still at most one generated hero per
      // club at this tier. Named specials sit on top of it rather than inside
      // it, which is what "additive" means, so they are counted separately.
      expect(
        promoted.players.filter(
          (player) =>
            player.clubId === club.id &&
            player.power !== undefined &&
            !isSpecialHeroId(player.id),
        ).length,
      ).toBeLessThanOrEqual(1);
      expect(() => buildCareerTeamDef(promoted, club.id)).not.toThrow();
    }
  });

  test.each([78_003, 78_004, 78_005])(
    'lands a sensibly prepared promoted club just behind a coherent D4 field (seed %i)',
    (careerSeed) => {
      const initial = createCareer({ ...createLaunchCareerSetup(careerSeed) });
      const userPlayers = initial.players.filter(
        (player) => player.clubId === initial.userClubId,
      );
      const tunedUserPlayers = new Map(
        tuneSquadToStrength(userPlayers, 46).map(
          (player) => [player.id, player] as const,
        ),
      );
      const prepared = {
        ...initial,
        players: initial.players.map(
          (player) => tunedUserPlayers.get(player.id) ?? player,
        ),
      };

      const promoted = startNextSeason(completeSeasonForUser(prepared, 'win'));
      const userStrength = effectiveStartingElevenStrength(
        promoted,
        promoted.userClubId,
      );
      const opponentStrengths = promoted.clubs
        .filter((club) => club.id !== promoted.userClubId)
        .map((club) => ({
          clubId: club.id,
          strength: effectiveStartingElevenStrength(promoted, club.id),
        }));
      const ranked = opponentStrengths
        .map((club) => club.strength)
        .sort((left, right) => left - right);
      const weakestOpponent = ranked[0];
      const medianOpponent = ranked[Math.floor(ranked.length / 2)];

      expect(currentUserDivision(promoted.m2!)).toBe(4);
      expect(userStrength).toBeGreaterThanOrEqual(45);
      expect(userStrength).toBeLessThanOrEqual(48);
      // This test used to assert two relegation minnows and a 35-point gulf up
      // to the rest. That gulf WAS the defect: a promoted club could beat the
      // pack home and away for twelve points and nothing else all season. The
      // pack was removed on 2026-07-31, so D4 is now one continuum — the club
      // promoted alongside the user, six band clubs, and two relegated D3 sides.
      //
      // Nothing is manufactured below the newcomer. The weakest side is the
      // fellow promoted club, a genuine peer rather than a gift.
      expect(weakestOpponent).toBeGreaterThan(userStrength - 5);
      // The user still arrives behind the field. The band is a whole-squad
      // value and a selected XI can sit four points under it.
      expect(userStrength).toBeLessThan(medianOpponent);
      expect(medianOpponent).toBeGreaterThanOrEqual(
        DIVISION_STRENGTH_BANDS[4][0] - 4,
      );
      // The strongest club's XI clears its band because selection takes the best
      // eleven of sixteen and three of those are position specialists. The old
      // rail of band-top + 1 only held because `matchAttribute` compresses
      // everything above 99, and D4's old top of 102 sat just inside that
      // squeeze; below 99 the premium shows undisguised. Pin it as a bounded
      // percentage so it stays honest wherever the band sits.
      expect(
        Math.max(...opponentStrengths.map((club) => club.strength)),
      ).toBeGreaterThanOrEqual(DIVISION_STRENGTH_BANDS[4][1] - 3);
      expect(
        Math.max(...opponentStrengths.map((club) => club.strength)),
      ).toBeLessThanOrEqual(Math.round(DIVISION_STRENGTH_BANDS[4][1] * 1.2));
    },
  );

  test('deterministically replenishes every position when a generation retires', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(79) });
    const retiringPlayerIds = new Set(
      initial.players
        .filter((player) => player.clubId === initial.userClubId)
        .map((player) => player.id),
    );
    const seasonEnd = {
      ...initial,
      season: 2,
      phase: 'season-end' as const,
      players: initial.players.map((player) =>
        retiringPlayerIds.has(player.id)
          ? {
              ...player,
              age: 80,
              retirementAge: 36,
              retirementAnnounced: true,
              retirementAnnouncementSeason: 1,
            }
          : player,
      ),
      fixtures: initial.fixtures.map((fixture, index) => ({
        ...fixture,
        status: 'played' as const,
        score: { homeGoals: index % 2, awayGoals: (index + 1) % 2 },
      })),
    };

    const first = startNextSeason(seasonEnd);
    const second = startNextSeason(seasonEnd);
    const userPlayers = first.players.filter(
      (player) => player.clubId === first.userClubId,
    );

    expect(userPlayers).toHaveLength(16);
    expect(userPlayers.filter((player) => player.role === 'GK')).toHaveLength(
      2,
    );
    expect(userPlayers.filter((player) => player.role === 'DEF')).toHaveLength(
      5,
    );
    expect(userPlayers.filter((player) => player.role === 'MID')).toHaveLength(
      5,
    );
    expect(userPlayers.filter((player) => player.role === 'FWD')).toHaveLength(
      4,
    );
    expect(buildCareerTeamDef(first, first.userClubId).players).toHaveLength(
      11,
    );
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  test('cold-relaunches multiple season transitions without restoring launch rosters', () => {
    const current = createCareer({ ...createLaunchCareerSetup(80) });
    const { launchRosterVersion: _version, ...preMarker } = current;
    let relaunched: GameState = preMarker;

    for (let expectedSeason = 2; expectedSeason <= 5; expectedSeason += 1) {
      const next = startNextSeason(completeSeason(relaunched));
      const loaded = parseStoredGameState(serializeGameState(next));
      relaunched = reconcileLaunchRoster(loaded);

      expect(relaunched.season).toBe(expectedSeason);
      expect(relaunched.players).toHaveLength(next.players.length);
      expect(relaunched.players.map((player) => player.id)).toEqual(
        next.players.map((player) => player.id),
      );
      expect(
        relaunched.players.every((player) =>
          relaunched.clubs.some((club) => club.id === player.clubId),
        ),
      ).toBe(true);
      expect(relaunched.launchRosterVersion).toBe(4);
      expect(parseStoredGameState(serializeGameState(relaunched))).toEqual(
        relaunched,
      );
    }
  });

  test('retires an expired-contract legend without requiring a pointless renewal', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(81) });
    const firstSeasonEnd = completeSeason(initial);
    const seasonTwo = startNextSeason(firstSeasonEnd);
    const legendId = seasonTwo.players.find(
      (player) => player.clubId === seasonTwo.userClubId,
    )!.id;
    const seasonTwoEnd = {
      ...completeSeason(seasonTwo),
      players: seasonTwo.players.map((player) =>
        player.id === legendId
          ? {
              ...player,
              contractSeasonsRemaining: 0,
              retirementAnnounced: true,
              retirementAnnouncementSeason: 1,
              seasonsAtClub: 6,
              fame: 300,
            }
          : player,
      ),
    };

    const seasonThree = startNextSeason(seasonTwoEnd);

    expect(seasonThree.players.some((player) => player.id === legendId)).toBe(
      false,
    );
    expect(
      seasonThree.retiredPlayers?.find((player) => player.id === legendId),
    ).toBeDefined();
    expect(seasonThree.pendingLegacyPlayerIds).toContain(legendId);
    expect(parseStoredGameState(serializeGameState(seasonThree))).toEqual(
      seasonThree,
    );
  });

  test('persists deterministic retirement announcements for presentation after transition', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(82) });
    const playerId = initial.players.find(
      (player) => player.clubId === initial.userClubId,
    )!.id;
    const announcing = {
      ...completeSeason(initial),
      players: initial.players.map((player) =>
        player.id === playerId
          ? {
              ...player,
              age: 80,
              retirementAnnounced: false,
              retirementAnnouncementSeason: undefined,
            }
          : player,
      ),
    };

    const first = startNextSeason(announcing);
    const second = startNextSeason(announcing);

    expect(first.retirementAnnouncements).toContainEqual(
      expect.objectContaining({
        playerId,
        announcedInSeason: 1,
      }),
    );
    expect(
      first.players.find((player) => player.id === playerId),
    ).toMatchObject({
      retirementAnnounced: true,
      retirementAnnouncementSeason: 1,
    });
    expect(first.retirementAnnouncements).toEqual(
      second.retirementAnnouncements,
    );
  });

  test('runs four complete seasons through the endless management clock deterministically', () => {
    const setup = createLaunchCareerSetup(20260719);
    const first = runHeadlessFullCareer(setup, 4);
    const second = runHeadlessFullCareer(setup, 4);

    expect(first.phase).toBe('season-end');
    expect(first.season).toBe(4);
    expect(first.ledgers).toHaveLength(120);
    expect(
      first.m2?.pyramid.divisions.flatMap((division) => division.clubs),
    ).toHaveLength(50);
    expect(
      first.players.filter((player) => player.clubId === first.userClubId)
        .length,
    ).toBeGreaterThanOrEqual(11);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

function completeSeason<T extends ReturnType<typeof createCareer>>(
  state: T,
): T {
  return {
    ...state,
    phase: 'season-end' as const,
    fixtures: state.fixtures.map((fixture, index) =>
      fixture.season === state.season
        ? {
            ...fixture,
            status: 'played' as const,
            score: { homeGoals: index % 3, awayGoals: (index + 1) % 2 },
          }
        : fixture,
    ),
  } as T;
}

function completeSeasonForUser<T extends ReturnType<typeof createCareer>>(
  state: T,
  result: 'win' | 'loss',
): T {
  return {
    ...state,
    phase: 'season-end' as const,
    fixtures: state.fixtures.map((fixture) =>
      fixture.season === state.season
        ? {
            ...fixture,
            status: 'played' as const,
            score:
              fixture.homeClubId === state.userClubId
                ? result === 'win'
                  ? { homeGoals: 3, awayGoals: 0 }
                  : { homeGoals: 0, awayGoals: 3 }
                : fixture.awayClubId === state.userClubId
                  ? result === 'win'
                    ? { homeGoals: 0, awayGoals: 3 }
                    : { homeGoals: 3, awayGoals: 0 }
                  : { homeGoals: 0, awayGoals: 0 },
          }
        : fixture,
    ),
  } as T;
}

const EFFECTIVE_STRENGTH_ATTRIBUTES = [
  'pac',
  'sho',
  'pas',
  'def',
  'tec',
  'sta',
] as const;

function effectiveStartingElevenStrength(
  state: GameState,
  clubId: string,
): number {
  const team = buildCareerTeamDef(state, clubId);
  const total = team.players.reduce(
    (teamTotal, player) =>
      teamTotal +
      EFFECTIVE_STRENGTH_ATTRIBUTES.reduce(
        (playerTotal, attribute) =>
          playerTotal +
          (attribute === 'pac'
            ? matchPaceAttribute(player.attrs.pac)
            : matchAttribute(player.attrs[attribute])),
        0,
      ),
    0,
  );
  return (
    Math.round(
      (total / (team.players.length * EFFECTIVE_STRENGTH_ATTRIBUTES.length)) *
        10,
    ) / 10
  );
}
