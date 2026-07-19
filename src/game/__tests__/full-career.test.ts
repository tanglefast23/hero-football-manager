import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer, startNextSeason } from '../career';
import { enableFullCareer } from '../full-career';
import { runHeadlessFullCareer } from '../headless';
import { buildCareerTeamDef } from '../squad';

describe('full M2 career clock', () => {
  test('initializes all divisions, market, cup, and youth intake only when full mode is requested', () => {
    const m1 = createCareer(createLaunchCareerSetup(77));
    const full = createCareer({ ...createLaunchCareerSetup(77), careerMode: 'full' });

    expect(m1.m2).toBeUndefined();
    expect(full.careerMode).toBe('full');
    expect(full.m2?.pyramid.divisions.map(division => division.clubs.length))
      .toEqual([10, 10, 10, 10, 10]);
    expect(full.m2?.nationalCups[0].season).toBe(1);
    expect(full.market?.coachCandidates.length).toBeGreaterThanOrEqual(3);
    expect(m1.youthIntake).toBeUndefined();
    expect(full.youthIntake).toMatchObject({ season: 1, status: 'OPEN' });
    expect(full.youthIntake?.offers.length).toBeGreaterThanOrEqual(1);
  });

  test.each([
    { label: 'Week 5 management', week: 5, phase: 'manage' as const },
    { label: 'matchday', week: 3, phase: 'matchday' as const },
    { label: 'season end', week: 30, phase: 'season-end' as const },
  ])('upgrades a legacy M1 save during $label with an expired intake', ({ week, phase }) => {
    const m1 = createCareer(createLaunchCareerSetup(77_001));
    const upgraded = enableFullCareer({ ...m1, week, phase });

    expect(upgraded.careerMode).toBe('full');
    expect(upgraded.m2).toBeDefined();
    expect(upgraded.market).toBeDefined();
    expect(upgraded.youthIntake).toMatchObject({
      season: upgraded.season,
      status: 'CLOSED',
      offers: [],
    });
  });

  test('closes stale open offers when an already-upgraded save resumes after Week 4', () => {
    const full = createCareer({ ...createLaunchCareerSetup(77_002), careerMode: 'full' });
    const resumed = enableFullCareer({ ...full, week: 6, phase: 'manage' });

    expect(resumed.youthIntake).toMatchObject({ status: 'CLOSED', offers: [] });
  });

  test('starts an endless next season with an active ten-club division', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(78), careerMode: 'full' });
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
    expect(next.players.filter(player => player.clubId === next.userClubId).length)
      .toBeGreaterThanOrEqual(11);
    expect(next.players.filter(player => player.clubId !== next.userClubId)).toHaveLength(144);
    expect(next.fixtures).toHaveLength(90);
    expect(next.m2?.nationalCups.at(-1)?.season).toBe(2);
    expect(next.youthIntake).toMatchObject({ season: 2, status: 'OPEN' });
    expect(next.youthIntake?.offers.length).toBeGreaterThanOrEqual(1);
  });

  test('deterministically replenishes every position when a generation retires', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(79), careerMode: 'full' });
    const retiringPlayerIds = new Set(initial.players
      .filter(player => player.clubId === initial.userClubId)
      .map(player => player.id));
    const seasonEnd = {
      ...initial,
      season: 2,
      phase: 'season-end' as const,
      players: initial.players.map(player => retiringPlayerIds.has(player.id)
        ? {
            ...player,
            age: 80,
            retirementAge: 36,
            retirementAnnounced: true,
            retirementAnnouncementSeason: 1,
          }
        : player),
      fixtures: initial.fixtures.map((fixture, index) => ({
        ...fixture,
        status: 'played' as const,
        score: { homeGoals: index % 2, awayGoals: (index + 1) % 2 },
      })),
    };

    const first = startNextSeason(seasonEnd);
    const second = startNextSeason(seasonEnd);
    const userPlayers = first.players.filter(player => player.clubId === first.userClubId);

    expect(userPlayers).toHaveLength(16);
    expect(userPlayers.filter(player => player.role === 'GK')).toHaveLength(2);
    expect(userPlayers.filter(player => player.role === 'DEF')).toHaveLength(5);
    expect(userPlayers.filter(player => player.role === 'MID')).toHaveLength(5);
    expect(userPlayers.filter(player => player.role === 'FWD')).toHaveLength(4);
    expect(buildCareerTeamDef(first, first.userClubId).players).toHaveLength(11);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  test('runs four complete seasons through the endless management clock deterministically', () => {
    const setup = createLaunchCareerSetup(20260719, undefined, undefined, 'full');
    const first = runHeadlessFullCareer(setup, 4);
    const second = runHeadlessFullCareer(setup, 4);

    expect(first.phase).toBe('season-end');
    expect(first.season).toBe(4);
    expect(first.ledgers).toHaveLength(120);
    expect(first.m2?.pyramid.divisions.flatMap(division => division.clubs)).toHaveLength(50);
    expect(first.players.filter(player => player.clubId === first.userClubId).length)
      .toBeGreaterThanOrEqual(11);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
