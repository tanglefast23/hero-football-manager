import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
} from '../../game/onboarding/story-onboarding';
import { DEFAULT_CREATION_RATINGS } from '../../game/onboarding/player-creation';
import { serializeGameState } from '../game-state-codec';

describe('completed onboarding history in persisted careers', () => {
  test('does not require the historical first fixture after onboarding is complete', () => {
    const begun = beginStoryOnboarding(createCareer(createLaunchCareerSetup(
      20260721,
      undefined,
      undefined,
    )));
    const story = addCreatedPlayer(begun, {
      name: 'History Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const completed = {
      ...story,
      players: story.players.map(player => player.id === story.onboarding?.createdPlayerId
        ? { ...player, power: 'SUPER_SPEED' as const, licensed: true }
        : player),
      onboarding: {
        ...story.onboarding!,
        stage: 'complete' as const,
        firstFixtureId: 'historical-season-one-fixture',
        awakenedPower: 'SUPER_SPEED' as const,
      },
    };

    expect(() => serializeGameState(completed)).not.toThrow();
  });

  test('still rejects a missing fixture while the first-match onboarding gate is live', () => {
    const begun = beginStoryOnboarding(createCareer(createLaunchCareerSetup(
      20260722,
      undefined,
      undefined,
    )));
    const story = addCreatedPlayer(begun, {
      name: 'Live Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });

    expect(() => serializeGameState({
      ...story,
      onboarding: {
        ...story.onboarding!,
        firstFixtureId: 'missing-live-fixture',
      },
    })).toThrow('first fixture does not exist');
  });
});
