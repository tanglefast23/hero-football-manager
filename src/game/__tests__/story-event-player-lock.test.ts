import { createCareer, offerCareerEvent, selectCareerEventPlayer } from '..';
import { createLaunchCareerSetup } from '../../application/launch';

describe('the player a story is about', () => {
  function career() {
    return createCareer(createLaunchCareerSetup(20260806));
  }

  it('carries into the next chapter and refuses to be recast', () => {
    const state = career();
    const squad = state.players.filter(player => player.clubId === state.userClubId);
    const chosen = squad[0]!;
    const other = squad[1]!;

    // A rival bidding for one player on Monday cannot be answered on deadline
    // day about somebody else — the follow-up used to re-pick from scratch.
    const chapterTwo = offerCareerEvent(state, 'rival-bid-deadline-day', chosen.id);

    expect(chapterTwo.pendingEvent?.selectedPlayerId).toBe(chosen.id);
    expect(chapterTwo.pendingEvent?.playerLocked).toBe(true);
    expect(() => selectCareerEventPlayer(chapterTwo, other.id))
      .toThrow('this chapter is already about a player chosen earlier in the story');
  });

  it('chooses again rather than naming a stranger when the player has gone', () => {
    const state = career();
    const chapterTwo = offerCareerEvent(state, 'rival-bid-deadline-day', 'not-on-this-club');

    expect(chapterTwo.pendingEvent?.selectedPlayerId).toBeUndefined();
    expect(chapterTwo.pendingEvent?.playerLocked).toBeUndefined();
  });

  it('leaves an unchained chapter free to pick', () => {
    const state = career();
    const squad = state.players.filter(player => player.clubId === state.userClubId);
    const opened = offerCareerEvent(state, 'rival-bid-deadline-day');

    expect(opened.pendingEvent?.playerLocked).toBeUndefined();
    expect(selectCareerEventPlayer(opened, squad[2]!.id).pendingEvent?.selectedPlayerId)
      .toBe(squad[2]!.id);
  });
});
