import type { GameState } from '../../types';
import { completePostMatchAwakening, resolvePostMatchAwakening } from '../../post-match-awakening';
import { DEFAULT_CREATION_RATINGS } from '../player-creation';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
  completeFirstOnboardingMatch,
  createdPlayer,
  isFirstOnboardingFixture,
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
    clubs: [{
      id: 'rovers',
      name: 'Rovers',
      cash: 25000,
      fans: 500,
      ticketPrice: 4,
      sponsorMonthlyFee: 2000,
      weeklyWages: 400,
    }],
    fixtures: [{
      id: 's1-r1-rovers-v-united',
      season: 1,
      round: 1,
      week: 3,
      homeClubId: 'rovers',
      awayClubId: 'united',
      matchSeed: 7,
      status: 'scheduled',
    }],
    players: [
      {
        id: 'old-hero',
        clubId: 'rovers',
        name: 'Old Hero',
        role: 'FWD',
        attrs: { pac: 60, sho: 60, pas: 45, def: 30, tec: 55, sta: 55, ref: 10 },
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
        attrs: { pac: 58, sho: 57, pas: 44, def: 31, tec: 54, sta: 56, ref: 10 },
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
    expect(avatar.createdAppearance).toEqual({ skinTone: 0, hairstyle: 0, kitAccent: 0 });
    expect(created.difficulty).toBe('CHAIRMAN');
    expect(new Set(created.players.map(player => player.lookId)).size).toBe(created.players.length);
  });

  it('starts with zero user heroes, adds the created forward, and locks a rookie wage', () => {
    const begun = beginStoryOnboarding(state());
    expect(begun.players.filter(player => player.power)).toHaveLength(0);
    expect(begun.players.filter(player => player.licensed)).toHaveLength(0);

    const created = addCreatedPlayer(begun, {
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const avatar = createdPlayer(created);
    expect(avatar).toMatchObject({
      name: 'Jo Rook',
      role: 'FWD',
      weeklyWage: 180,
      contractSeasonsRemaining: 1,
      onHeroWage: false,
      licensed: false,
    });
    expect(avatar?.attrs.ref).toBe(10);
    expect(avatar?.lookId).toMatch(/^c\d{3}$/);
    expect(created.clubs[0].weeklyWages).toBe(580);
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
    expect(isFirstOnboardingFixture(created, 's1-r1-rovers-v-united')).toBe(true);
    const played = {
      ...created,
      fixtures: created.fixtures.map(fixture => ({
        ...fixture,
        status: 'played' as const,
        score: { homeGoals: 1, awayGoals: 0 },
      })),
    };
    const collapsed = completeFirstOnboardingMatch(played, 's1-r1-rovers-v-united');
    const revealed = resolvePostMatchAwakening(
      collapsed,
      's1-r1-rovers-v-united',
      collapsed.lineups[0].playerIds,
      ['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH'],
      ['glowing-caterpillar'],
      { chancePercent: 10, minimumMatchesBetween: 3 },
    ).state;
    const avatar = createdPlayer(revealed);
    expect(revealed.onboarding).toMatchObject({
      stage: 'reveal',
      awakenedPower: expect.stringMatching(/SUPER_SPEED|SUPER_STRENGTH|FIRE_TORCH/),
    });
    expect(avatar).toMatchObject({
      power: expect.stringMatching(/SUPER_SPEED|SUPER_STRENGTH|FIRE_TORCH/),
      licensed: true,
      weeklyWage: 180,
      onHeroWage: false,
    });
    expect(revealed.players.filter(player => player.power)).toHaveLength(1);
    expect(completePostMatchAwakening(revealed).onboarding?.stage).toBe('complete');
  });

  it('refuses to make the avatar hero #1 if another user hero still exists', () => {
    const created = addCreatedPlayer(beginStoryOnboarding(state()), {
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const avatarId = created.onboarding?.createdPlayerId;
    const invalid = {
      ...created,
      fixtures: created.fixtures.map(fixture => ({
        ...fixture,
        status: 'played' as const,
        score: { homeGoals: 0, awayGoals: 0 },
      })),
      players: created.players.map(player => player.id === 'old-hero'
        ? { ...player, power: 'SUPER_SPEED' as const }
        : player),
    };
    const collapsed = completeFirstOnboardingMatch(invalid, 's1-r1-rovers-v-united');
    expect(avatarId).toBeDefined();
    expect(() => resolvePostMatchAwakening(
      collapsed,
      's1-r1-rovers-v-united',
      collapsed.lineups[0].playerIds,
      ['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH'],
      ['glowing-caterpillar'],
      { chancePercent: 10, minimumMatchesBetween: 3 },
    ))
      .toThrow('first hero');
  });
});
