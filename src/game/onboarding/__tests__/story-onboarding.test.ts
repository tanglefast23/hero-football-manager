import type { GameState } from '../../types';
import { createClubBusinessState } from '../../club-business';
import { initializeM2Career } from '../../m2-career';
import {
  completePostMatchAwakening,
  resolvePostMatchAwakening,
} from '../../post-match-awakening';
import {
  CREATED_PLAYER_ROOKIE_WAGE,
  DEFAULT_CREATION_RATINGS,
} from '../player-creation';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
  completeFirstOnboardingMatch,
  createdPlayer,
  inheritedSquad,
  isFirstOnboardingFixture,
  userClubName,
} from '../story-onboarding';

function state(): GameState {
  return {
    schemaVersion: 1,
    careerMode: 'full',
    careerSeed: 42,
    userClubId: 'rovers',
    season: 1,
    week: 1,
    phase: 'manage',
    clubs: [
      {
        id: 'rovers',
        name: 'Rovers',
        cash: 25000,
        fans: 500,
        ticketPrice: 4,
        sponsorMonthlyFee: 2000,
        weeklyWages: 400,
      },
    ],
    fixtures: [
      {
        id: 's1-r1-rovers-v-united',
        season: 1,
        round: 1,
        week: 3,
        homeClubId: 'rovers',
        awayClubId: 'united',
        matchSeed: 7,
        status: 'scheduled',
      },
    ],
    players: [
      {
        id: 'old-hero',
        clubId: 'rovers',
        name: 'Old Hero',
        role: 'FWD',
        attrs: {
          pac: 60,
          sho: 60,
          pas: 45,
          def: 30,
          tec: 55,
          sta: 55,
          ref: 10,
        },
        power: 'FIRE_TORCH',
        licensed: true,
        weeklyWage: 220,
        onHeroWage: false,
        contractSeasonsRemaining: 2,
        morale: 50,
        injuryWeeks: 0,
      },
      {
        id: 'forward-two',
        clubId: 'rovers',
        name: 'Forward Two',
        role: 'FWD',
        attrs: {
          pac: 58,
          sho: 57,
          pas: 44,
          def: 31,
          tec: 54,
          sta: 56,
          ref: 10,
        },
        licensed: false,
        weeklyWage: 180,
        onHeroWage: false,
        contractSeasonsRemaining: 2,
        morale: 50,
        injuryWeeks: 0,
      },
    ],
    lineups: [{ clubId: 'rovers', playerIds: ['old-hero', 'forward-two'] }],
    facilities: { trainingGroundBuilt: false },
    eventClock: { weeksWithoutEvent: 0, riskyChoices: 0 },
    eventFlags: [],
    resolvedEventIds: [],
    awakening: { matchesSinceLastAwakening: 0, usedTriggerIds: [] },
    trainingPoints: 0,
    ledgers: [],
    clubBusiness: createClubBusinessState({ season: 1 }),
  };
}

describe('story onboarding state machine', () => {
  it('preserves the exact paper-doll look even when a generated player used that slot', () => {
    const initial = beginStoryOnboarding(state());
    const created = addCreatedPlayer(initial, {
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
      appearance: { skinTone: 0, hairstyle: 0, kitAccent: 0 },
      difficulty: 'CHAIRMAN',
    });
    const avatar = createdPlayer(created);
    if (avatar === undefined) throw new Error('expected the created player');

    expect(avatar.lookId).toBe('c000');
    expect(avatar.createdAppearance).toEqual({
      skinTone: 0,
      hairstyle: 0,
      kitAccent: 0,
    });
    expect(created.difficulty).toBe('CHAIRMAN');
    expect(new Set(created.players.map((player) => player.lookId)).size).toBe(
      created.players.length,
    );
  });

  it('starts with zero user heroes, adds the created forward, and locks a rookie wage', () => {
    const begun = beginStoryOnboarding(state());
    expect(begun.players.filter((player) => player.power)).toHaveLength(0);
    expect(begun.players.filter((player) => player.licensed)).toHaveLength(0);

    const created = addCreatedPlayer(begun, {
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const avatar = createdPlayer(created);
    expect(avatar).toMatchObject({
      name: 'Jo Rook',
      role: 'FWD',
      weeklyWage: CREATED_PLAYER_ROOKIE_WAGE,
      contractSeasonsRemaining: 1,
      onHeroWage: false,
      licensed: false,
    });
    expect(avatar?.attrs.ref).toBe(10);
    expect(avatar?.lookId).toMatch(/^c\d{3}$/);
    expect(created.clubs[0].weeklyWages).toBe(400 + CREATED_PLAYER_ROOKIE_WAGE);
    expect(created.lineups[0].playerIds).toContain(avatar?.id);
    expect(created.onboarding).toMatchObject({
      stage: 'first-match',
      createdPlayerId: avatar?.id,
      firstFixtureId: 's1-r1-rovers-v-united',
    });
  });

  it('turns the played first fixture into the guaranteed automatic first hero', () => {
    const created = addCreatedPlayer(beginStoryOnboarding(state()), {
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    expect(isFirstOnboardingFixture(created, 's1-r1-rovers-v-united')).toBe(
      true,
    );
    const played = {
      ...created,
      fixtures: created.fixtures.map((fixture) => ({
        ...fixture,
        status: 'played' as const,
        score: { homeGoals: 1, awayGoals: 0 },
      })),
    };
    const collapsed = completeFirstOnboardingMatch(
      played,
      's1-r1-rovers-v-united',
    );
    const revealed = resolvePostMatchAwakening(
      collapsed,
      's1-r1-rovers-v-united',
      collapsed.lineups[0].playerIds,
      ['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH'],
      ['glowing-caterpillar'],
      {
        chancePercent: 10,
        secondInSeasonChancePercent: 2,
        maxPerSeason: 2,
        minimumMatchesBetween: 3,
      },
    ).state;
    const avatar = createdPlayer(revealed);
    expect(revealed.onboarding).toMatchObject({
      stage: 'reveal',
      awakenedPower: expect.stringMatching(
        /SUPER_SPEED|SUPER_STRENGTH|FIRE_TORCH/,
      ),
    });
    expect(avatar).toMatchObject({
      power: expect.stringMatching(/SUPER_SPEED|SUPER_STRENGTH|FIRE_TORCH/),
      licensed: true,
      weeklyWage: CREATED_PLAYER_ROOKIE_WAGE,
      onHeroWage: false,
    });
    expect(revealed.players.filter((player) => player.power)).toHaveLength(1);
    expect(completePostMatchAwakening(revealed).onboarding?.stage).toBe(
      'complete',
    );
  });

  it('offers the club name and the inherited squad to the first-hire screen', () => {
    const begun = beginStoryOnboarding(state());
    expect(userClubName(begun)).toBe('Rovers');
    expect(inheritedSquad(begun)).toEqual([
      { id: 'forward-two', name: 'Forward Two', role: 'FWD' },
      { id: 'old-hero', name: 'Old Hero', role: 'FWD' },
    ]);
  });

  it('renames the club and the squad the manager typed over', () => {
    const begun = beginStoryOnboarding(state());
    const created = addCreatedPlayer(
      {
        ...begun,
        m2: initializeM2Career({
          careerSeed: begun.careerSeed,
          userClub: {
            id: begun.userClubId,
            name: 'Rovers',
            squadStrength: 50,
          },
        }),
      },
      {
        name: 'Jo Rook',
        ratings: DEFAULT_CREATION_RATINGS,
        // Untidy on purpose: the engine trims and collapses whatever a keyboard
        // produced, the same way it does for the rookie's own name.
        clubName: '  Thistle  Town ',
        rosterNames: { 'old-hero': 'Nia Bell', 'forward-two': '   ' },
      },
    );
    expect(created.clubs[0].name).toBe('Thistle Town');
    expect(
      created.m2?.pyramid.divisions
        .flatMap((division) => division.clubs)
        .find((club) => club.id === created.userClubId)?.name,
    ).toBe('Thistle Town');
    expect(
      created.players.find((player) => player.id === 'old-hero')?.name,
    ).toBe('Nia Bell');
    // A field left blank keeps the name it opened with.
    expect(
      created.players.find((player) => player.id === 'forward-two')?.name,
    ).toBe('Forward Two');
  });

  it('leaves the club alone when nothing was typed over it', () => {
    const created = addCreatedPlayer(beginStoryOnboarding(state()), {
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
      clubName: '',
      rosterNames: {},
    });
    expect(created.clubs[0].name).toBe('Rovers');
  });

  it('refuses a rename aimed at somebody outside the manager s own roster', () => {
    expect(() =>
      addCreatedPlayer(beginStoryOnboarding(state()), {
        name: 'Jo Rook',
        ratings: DEFAULT_CREATION_RATINGS,
        rosterNames: { 'rival-striker': 'Nia Bell' },
      }),
    ).toThrow('not on the manager');
  });

  it('refuses a club or squad name too short to print', () => {
    const begun = beginStoryOnboarding(state());
    expect(() =>
      addCreatedPlayer(begun, {
        name: 'Jo Rook',
        ratings: DEFAULT_CREATION_RATINGS,
        clubName: 'R',
      }),
    ).toThrow('Club name');
    expect(() =>
      addCreatedPlayer(begun, {
        name: 'Jo Rook',
        ratings: DEFAULT_CREATION_RATINGS,
        rosterNames: { 'old-hero': 'N' },
      }),
    ).toThrow('old-hero');
  });

  it('refuses to read a name off the prototype chain', () => {
    // Ids reach the engine from a draft, so `constructor` is a reachable key —
    // and a plain record lookup would have handed back a function to assign as
    // somebody's name.
    expect(() =>
      addCreatedPlayer(beginStoryOnboarding(state()), {
        name: 'Jo Rook',
        ratings: DEFAULT_CREATION_RATINGS,
        rosterNames: { constructor: 'Nia Bell' },
      }),
    ).toThrow('not on the manager');
  });

  it('refuses to make the avatar hero #1 if another user hero still exists', () => {
    const created = addCreatedPlayer(beginStoryOnboarding(state()), {
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const avatarId = created.onboarding?.createdPlayerId;
    const invalid = {
      ...created,
      fixtures: created.fixtures.map((fixture) => ({
        ...fixture,
        status: 'played' as const,
        score: { homeGoals: 0, awayGoals: 0 },
      })),
      players: created.players.map((player) =>
        player.id === 'old-hero'
          ? { ...player, power: 'SUPER_SPEED' as const }
          : player,
      ),
    };
    const collapsed = completeFirstOnboardingMatch(
      invalid,
      's1-r1-rovers-v-united',
    );
    expect(avatarId).toBeDefined();
    expect(() =>
      resolvePostMatchAwakening(
        collapsed,
        's1-r1-rovers-v-united',
        collapsed.lineups[0].playerIds,
        ['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH'],
        ['glowing-caterpillar'],
        {
          chancePercent: 10,
          secondInSeasonChancePercent: 2,
          maxPerSeason: 2,
          minimumMatchesBetween: 3,
        },
      ),
    ).toThrow('first hero');
  });
});
