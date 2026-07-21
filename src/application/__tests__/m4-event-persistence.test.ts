import { loadLaunchContent } from '../../content';
import { offerCareerEvent, type GameState } from '../../game';
import { parseStoredGameState, serializeGameState } from '../../persistence/game-state-codec';
import { useM1Store } from '../store';
import { storyEventViewModel } from '../view-models';

const content = loadLaunchContent();

function awakenedCareerAtEvent(seed: number, eventId: string): GameState {
  useM1Store.setState(useM1Store.getInitialState(), true);
  useM1Store.getState().startNewCareer(seed);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: { pac: 55, sho: 55, pas: 55, def: 45, tec: 55, sta: 55 },
  });
  for (let week = 1; week < 5; week += 1) useM1Store.getState().advanceCareer();
  useM1Store.getState().advanceCareer();
  useM1Store.getState().quickResult();
  useM1Store.getState().continueAfterAwakening();
  const career = useM1Store.getState().career!;
  return offerCareerEvent(
    { ...career, week: 7, phase: 'manage', pendingEvent: undefined },
    eventId,
  );
}

function clubCash(state: GameState): number {
  return state.clubs.find(club => club.id === state.userClubId)!.cash;
}

function clubFans(state: GameState): number {
  return state.clubs.find(club => club.id === state.userClubId)!.fans;
}

describe('M4 resolved events survive a reload without rerolling or double-paying', () => {
  it('keeps the same outcome, rewards, and balances after a save/load round trip', () => {
    useM1Store.setState({ career: awakenedCareerAtEvent(456, 'giant-spider-arrives'), screen: 'event' });
    useM1Store.getState().chooseEvent('adopt-spider');

    const resolved = useM1Store.getState().career!;
    expect(useM1Store.getState().error).toBeNull();
    const reloaded = parseStoredGameState(serializeGameState(resolved));

    expect(reloaded.pendingEvent).toEqual(resolved.pendingEvent);
    expect(clubCash(reloaded)).toBe(clubCash(resolved));
    expect(clubFans(reloaded)).toBe(clubFans(resolved));
    expect(reloaded.trainingPoints).toBe(resolved.trainingPoints);
    expect(reloaded.eventFlags).toEqual(resolved.eventFlags);
    expect(storyEventViewModel(reloaded, content))
      .toEqual(storyEventViewModel(resolved, content));
  });

  it('refuses a second resolution of the same pending event', () => {
    useM1Store.setState({ career: awakenedCareerAtEvent(456, 'giant-spider-arrives'), screen: 'event' });
    useM1Store.getState().chooseEvent('adopt-spider');
    const afterFirst = useM1Store.getState().career!;

    useM1Store.setState({ career: parseStoredGameState(serializeGameState(afterFirst)) });
    useM1Store.getState().chooseEvent('adopt-spider');

    expect(useM1Store.getState().error).not.toBeNull();
    expect(clubFans(useM1Store.getState().career!)).toBe(clubFans(afterFirst));
    expect(useM1Store.getState().career!.trainingPoints).toBe(afterFirst.trainingPoints);
  });

  it('cannot offer a resolved one-shot story again after a reload', () => {
    useM1Store.setState({ career: awakenedCareerAtEvent(456, 'giant-spider-arrives'), screen: 'event' });
    useM1Store.getState().chooseEvent('adopt-spider');
    useM1Store.getState().continueAfterEvent();

    const reloaded = parseStoredGameState(serializeGameState(useM1Store.getState().career!));
    expect(reloaded.resolvedEventIds).toContain('giant-spider-arrives');
    expect(() => offerCareerEvent(
      { ...reloaded, phase: 'manage', pendingEvent: undefined },
      'giant-spider-arrives',
    )).toThrow('already resolved');
  });

  it('resolves every risky choice to the identical authored outcome on reload', () => {
    const checked: string[] = [];
    const blocked: string[] = [];

    for (const event of content.events.events) {
      const risky = event.choices.find(choice => choice.risky)!;
      const staged = awakenedCareerAtEvent(456, event.id);
      useM1Store.setState({ career: staged, screen: 'event' });
      if (event.trigger.requiresPlayer === true) useM1Store.getState().selectEventPlayer();
      useM1Store.getState().chooseEvent(risky.id);
      if (useM1Store.getState().error !== null) {
        blocked.push(event.id); // requirement-gated choice this career cannot take
        continue;
      }

      const resolved = useM1Store.getState().career!;
      const reloaded = parseStoredGameState(serializeGameState(resolved));
      expect(reloaded.pendingEvent?.resolvedOutcomeIndex)
        .toBe(resolved.pendingEvent?.resolvedOutcomeIndex);
      expect(reloaded.pendingEvent?.outcomeText).toBe(resolved.pendingEvent?.outcomeText);
      expect(reloaded.pendingEvent?.resolvedSuccess).toBe(resolved.pendingEvent?.resolvedSuccess);
      expect(clubCash(reloaded)).toBe(clubCash(resolved));
      expect(clubFans(reloaded)).toBe(clubFans(resolved));
      // A reload must never turn a setback into the authored success.
      expect(storyEventViewModel(reloaded, content).successCutscene)
        .toEqual(storyEventViewModel(resolved, content).successCutscene);
      checked.push(event.id);
    }

    // Guards against the loop silently skipping everything and passing vacuously.
    expect(checked.length + blocked.length).toBe(30);
    expect(checked.length).toBeGreaterThanOrEqual(25);
  });
});
