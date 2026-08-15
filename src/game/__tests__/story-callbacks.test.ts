import { createLaunchCareerSetup } from '../../application/launch';
import {
  parseStoredGameState,
  serializeGameState,
} from '../../persistence/game-state-codec';
import { createCareer } from '../career';
import {
  dismissStoryCallback,
  nextDueStoryCallback,
  scheduleStoryCallback,
} from '../story-callbacks';

describe('delayed story callbacks', () => {
  test('survives a season boundary and save before appearing once', () => {
    const initial = { ...createCareer(createLaunchCareerSetup(91)), week: 29 };
    const player = initial.players.find(
      (candidate) => candidate.clubId === initial.userClubId,
    )!;
    const scheduled = scheduleStoryCallback(initial, {
      sourceId: 'youngster-trial',
      delayWeeks: 3,
      speaker: 'PLAYER',
      playerId: player.id,
      text: 'I am back.',
      textKey: 'storyCallback.youngsterTrialReturn',
    });
    const restored = parseStoredGameState(serializeGameState(scheduled));

    expect(restored.storyCallbacks).toHaveLength(1);
    expect(
      nextDueStoryCallback({ ...restored, season: 2, week: 1 }),
    ).toBeUndefined();
    const dueState = { ...restored, season: 2, week: 2 };
    const due = nextDueStoryCallback(dueState);
    expect(due).toMatchObject({
      dueSeason: 2,
      dueWeek: 2,
      playerId: player.id,
    });
    expect(dismissStoryCallback(dueState, due!.id).storyCallbacks).toEqual([]);
  });
});
