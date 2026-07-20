import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game';
import { DEFAULT_CREATION_RATINGS } from '../../game/onboarding/player-creation';
import { addCreatedPlayer, beginStoryOnboarding } from '../../game/onboarding/story-onboarding';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

describe('squad training tutorial targeting', () => {
  const content = loadLaunchContent();

  it('exposes the user-created player id so the tutorial can point at the created hero, not the first roster player', () => {
    const fresh = createCareer(createLaunchCareerSetup(20260720, undefined, content));
    const withHero = addCreatedPlayer(beginStoryOnboarding(fresh), {
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const createdPlayerId = withHero.onboarding?.createdPlayerId;

    const viewModel = squadTrainingViewModel(withHero, content, undefined, [], []);

    expect(createdPlayerId).toBeDefined();
    expect(viewModel.createdPlayerId).toBe(createdPlayerId);
    // The created hero is appended to the end of the roster, so the old
    // "point at the first row" cue would have highlighted the wrong player.
    expect(viewModel.players[0]?.id).not.toBe(createdPlayerId);
    expect(viewModel.players.some(player => player.id === createdPlayerId)).toBe(true);
  });
});
