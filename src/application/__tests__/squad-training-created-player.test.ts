import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game';
import { DEFAULT_CREATION_RATINGS } from '../../game/onboarding/player-creation';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
} from '../../game/onboarding/story-onboarding';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

describe('squad training tutorial targeting', () => {
  const content = loadLaunchContent();

  it('lists the user-created player first so the tutorial cue is visible at the top of the roster', () => {
    const fresh = createCareer(
      createLaunchCareerSetup(20260720, undefined, content),
    );
    const withHero = addCreatedPlayer(beginStoryOnboarding(fresh), {
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const createdPlayerId = withHero.onboarding?.createdPlayerId;

    const viewModel = squadTrainingViewModel(withHero, content, undefined);

    expect(createdPlayerId).toBeDefined();
    // `createdPlayerId` was removed from the view model; the tutorial cue now
    // shows up purely through roster ordering, checked below.
    expect(viewModel.players[0]?.id).toBe(createdPlayerId);
    expect(
      viewModel.players.some((player) => player.id === createdPlayerId),
    ).toBe(true);
  });
});
