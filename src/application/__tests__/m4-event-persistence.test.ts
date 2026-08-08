import { loadLaunchContent } from '../../content';
import { offerCareerEvent, type GameState } from '../../game';
import { parseStoredGameState, serializeGameState } from '../../persistence/game-state-codec';
import { reconcilePendingStoryEvent } from '../event-selection';
import { careerEventTargetCandidates } from '../career-event-targets';
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
  for (let week = 1; week < 3; week += 1) useM1Store.getState().advanceCareer();
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
  it('round-trips typed coach and facility targets and fails soft on malformed optional fields', () => {
    const staged = awakenedCareerAtEvent(456, 'giant-spider-arrives');
    const targeted: GameState = {
      ...staged,
      pendingEvent: {
        eventId: 'the-plaque',
        selectedCoachRole: 'ASSISTANT',
        coachLocked: true,
        selectedFacilityId: 'facility-1',
        facilityLocked: true,
      },
    };
    expect(
      parseStoredGameState(serializeGameState(targeted)).pendingEvent,
    ).toMatchObject({
      selectedCoachRole: 'ASSISTANT',
      coachLocked: true,
      selectedFacilityId: 'facility-1',
      facilityLocked: true,
    });

    const malformed = JSON.parse(serializeGameState(targeted)) as {
      pendingEvent: Record<string, unknown>;
    };
    malformed.pendingEvent.selectedCoachRole = 'MANAGER';
    malformed.pendingEvent.coachLocked = false;
    malformed.pendingEvent.selectedFacilityId = '';
    malformed.pendingEvent.facilityLocked = 'yes';
    expect(
      parseStoredGameState(JSON.stringify(malformed)).pendingEvent,
    ).toEqual({
      eventId: 'the-plaque',
    });
  });

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

  it('drops a pending story the shipped catalog no longer contains', () => {
    const staged = awakenedCareerAtEvent(456, 'giant-spider-arrives');
    // A content update that renames or retires an event must not brick the save
    // of a player who had it on screen when they updated.
    const orphaned: GameState = {
      ...staged,
      pendingEvent: { eventId: 'retired-in-a-later-content-drop' },
    };

    const recovered = reconcilePendingStoryEvent(orphaned, content.events);

    expect(recovered.pendingEvent).toBeUndefined();
    expect(() => storyEventViewModel(recovered, content)).toThrow('no pending story event');
  });

  it('keeps a pending story the catalog still contains', () => {
    const staged = awakenedCareerAtEvent(456, 'giant-spider-arrives');

    const recovered = reconcilePendingStoryEvent(staged, content.events);

    expect(recovered).toBe(staged);
    expect(recovered.pendingEvent?.eventId).toBe('giant-spider-arrives');
  });

  it('resolves every risky choice to the identical authored outcome on reload', () => {
    const checked: string[] = [];
    const blocked: string[] = [];

    for (const event of content.events.events) {
      const risky = event.choices.find(choice => choice.risky)!;
      const staged = awakenedCareerAtEvent(456, event.id);
      useM1Store.setState({ career: staged, screen: 'event' });
      if (event.trigger.requiresPlayer === true) {
        const candidate = careerEventTargetCandidates(staged, event).playerIds[0];
        if (candidate !== undefined) useM1Store.getState().selectEventPlayer(candidate);
      }
      useM1Store.getState().chooseEvent(risky.id);
      if (useM1Store.getState().error !== null
        || useM1Store.getState().career?.pendingEvent?.resolvedChoiceId === undefined) {
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
    expect(checked.length + blocked.length).toBe(54);
    expect(checked.length).toBeGreaterThanOrEqual(25);
  });
});
