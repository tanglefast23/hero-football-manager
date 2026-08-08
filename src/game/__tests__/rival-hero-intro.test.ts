import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import { DEFAULT_CREATION_RATINGS } from '../onboarding/player-creation';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
} from '../onboarding/story-onboarding';
import {
  RIVAL_HERO_INTRO_HERO_IDS,
  completeRivalHeroIntro,
  pendingRivalHeroIntro,
  rivalHeroIntroFlag,
} from '../rival-hero-intro';
import type { CareerPlayer, GameState } from '../types';

function openingMatchday(): GameState {
  const begun = beginStoryOnboarding(
    createCareer(createLaunchCareerSetup(20260808)),
  );
  const career = addCreatedPlayer(begun, {
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
  const fixtureId = career.onboarding?.firstFixtureId;
  const fixture = career.fixtures.find(
    (candidate) => candidate.id === fixtureId,
  );
  if (fixture === undefined) throw new Error('opening fixture missing');
  return { ...career, week: fixture.week, phase: 'matchday' };
}

function cloneAsHero(
  player: CareerPlayer,
  id: (typeof RIVAL_HERO_INTRO_HERO_IDS)[number],
  clubId: string,
) {
  return { ...player, id, clubId };
}

describe('first-meeting rival hero intro', () => {
  it('finds Barry on the exact first opponent and uses stable character identity', () => {
    const state = openingMatchday();
    const pending = pendingRivalHeroIntro(state);

    expect(pending).toMatchObject({
      heroId: 'special-f171',
      fixtureId: state.onboarding?.firstFixtureId,
      competition: 'league',
    });
    expect(state.players).toContainEqual(
      expect.objectContaining({
        id: pending?.heroId,
        clubId: pending?.opponentClubId,
      }),
    );
  });

  it('writes one hero-specific flag only after explicit completion', () => {
    const state = openingMatchday();
    expect(state.eventFlags).not.toContain(rivalHeroIntroFlag('special-f171'));

    const completed = completeRivalHeroIntro(state, 'special-f171');
    expect(
      completed.eventFlags.filter(
        (flag) => flag === rivalHeroIntroFlag('special-f171'),
      ),
    ).toHaveLength(1);
    expect(pendingRivalHeroIntro(completed)).toBeUndefined();
    expect(completeRivalHeroIntro(completed, 'special-f171')).toBe(completed);
  });

  it('does not trigger when the hero is owned by the user or on another club', () => {
    const state = openingMatchday();
    const barry = state.players.find((player) => player.id === 'special-f171')!;
    const userOwned = {
      ...state,
      players: state.players.map((player) =>
        player.id === barry.id
          ? { ...player, clubId: state.userClubId }
          : player,
      ),
    };
    expect(pendingRivalHeroIntro(userOwned)).toBeUndefined();

    const unrelatedClub = state.clubs.find(
      (club) => club.id !== state.userClubId && club.id !== barry.clubId,
    )!.id;
    expect(
      pendingRivalHeroIntro({
        ...state,
        players: state.players.map((player) =>
          player.id === barry.id
            ? { ...player, clubId: unrelatedClub }
            : player,
        ),
      }),
    ).toBeUndefined();
  });

  it('follows a hero to a new host instead of keying the scene to a club', () => {
    const state = openingMatchday();
    const pending = pendingRivalHeroIntro(state)!;
    const moved = {
      ...state,
      players: state.players.map((player) =>
        player.id === pending.heroId
          ? { ...player, clubId: state.userClubId }
          : player,
      ),
    };
    const ordinaryOpponent = moved.players.find(
      (player) => player.clubId === pending.opponentClubId,
    )!;
    const bruce = cloneAsHero(
      ordinaryOpponent,
      'special-f168',
      pending.opponentClubId,
    );

    expect(
      pendingRivalHeroIntro({ ...moved, players: [...moved.players, bruce] }),
    ).toMatchObject({
      heroId: 'special-f168',
      opponentClubId: pending.opponentClubId,
    });
  });

  it('uses D5-to-D1 order and rejects a stale completion for the next hero', () => {
    const state = openingMatchday();
    const pending = pendingRivalHeroIntro(state)!;
    const ordinaryOpponent = state.players.find(
      (player) =>
        player.clubId === pending.opponentClubId &&
        player.id !== pending.heroId,
    )!;
    const bruce = cloneAsHero(
      ordinaryOpponent,
      'special-f168',
      pending.opponentClubId,
    );
    const malformed = { ...state, players: [...state.players, bruce] };

    expect(pendingRivalHeroIntro(malformed)?.heroId).toBe('special-f171');
    const afterBarry = completeRivalHeroIntro(malformed, 'special-f171');
    expect(pendingRivalHeroIntro(afterBarry)?.heroId).toBe('special-f168');
    expect(completeRivalHeroIntro(afterBarry, 'special-f171')).toBe(afterBarry);
    expect(afterBarry.eventFlags).not.toContain(
      rivalHeroIntroFlag('special-f168'),
    );
  });

  it('keeps league-first double headers separate, then discovers a Cup rival', () => {
    const opening = openingMatchday();
    const week = 6;
    const m2 = opening.m2!;
    const scheduledLeagueFixture = opening.fixtures.find(
      (fixture) =>
        fixture.status === 'scheduled' &&
        (fixture.homeClubId === opening.userClubId ||
          fixture.awayClubId === opening.userClubId),
    );
    const leagueFixture =
      scheduledLeagueFixture === undefined
        ? undefined
        : { ...scheduledLeagueFixture, week };
    const cupFixture = m2.nationalCups[0].rounds
      .at(-1)
      ?.fixtures.find(
        (fixture) =>
          fixture.status === 'scheduled' &&
          (fixture.homeClubId === opening.userClubId ||
            fixture.awayClubId === opening.userClubId),
      );
    if (leagueFixture === undefined || cupFixture === undefined) {
      throw new Error('test seed did not produce the expected double header');
    }
    const opponent = (fixture: { homeClubId: string; awayClubId: string }) =>
      fixture.homeClubId === opening.userClubId
        ? fixture.awayClubId
        : fixture.homeClubId;
    const leagueOpponent = opponent(leagueFixture);
    const cupOpponent = opponent(cupFixture);
    const ordinaryCupPlayer = opening.players.find(
      (player) => player.clubId === cupOpponent,
    )!;
    const state: GameState = {
      ...opening,
      m2,
      week,
      phase: 'matchday',
      fixtures: opening.fixtures.map((fixture) =>
        fixture.id === leagueFixture.id ? leagueFixture : fixture,
      ),
      players: [
        ...opening.players.map((player) =>
          player.id === 'special-f171'
            ? { ...player, clubId: leagueOpponent }
            : player,
        ),
        cloneAsHero(ordinaryCupPlayer, 'special-f168', cupOpponent),
      ],
    };

    expect(pendingRivalHeroIntro(state)).toMatchObject({
      heroId: 'special-f171',
      fixtureId: leagueFixture.id,
      competition: 'league',
    });

    const afterLeagueIntro = completeRivalHeroIntro(state, 'special-f171');
    const afterLeagueMatch: GameState = {
      ...afterLeagueIntro,
      fixtures: afterLeagueIntro.fixtures.map((fixture) =>
        fixture.id === leagueFixture.id
          ? { ...fixture, status: 'played' as const }
          : fixture,
      ),
    };
    expect(pendingRivalHeroIntro(afterLeagueMatch)).toMatchObject({
      heroId: 'special-f168',
      fixtureId: cupFixture.id,
      competition: 'national-cup',
    });
    expect(afterLeagueMatch.eventFlags).not.toContain(
      rivalHeroIntroFlag('special-f168'),
    );
  });

  it('ignores every other named special and remains absent off Match Day', () => {
    const state = openingMatchday();
    const pending = pendingRivalHeroIntro(state)!;
    const lowerOrder = state.players.find(
      (player) => player.clubId === pending.opponentClubId,
    )!;
    const onlyOtherSpecial = {
      ...state,
      players: state.players
        .filter((player) => player.id !== 'special-f171')
        .concat({ ...lowerOrder, id: 'special-f177' }),
    };
    expect(pendingRivalHeroIntro(onlyOtherSpecial)).toBeUndefined();
    expect(
      pendingRivalHeroIntro({ ...state, phase: 'manage' }),
    ).toBeUndefined();
  });
});
