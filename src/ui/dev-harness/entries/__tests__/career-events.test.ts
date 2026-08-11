import { loadLaunchContent } from '../../../../content';
import { storyEventViewModel } from '../../../../application/view-models';
import { eventChoiceUnavailableReason } from '../../../../application/event-selection';
import { careerEventTargetCandidates } from '../../../../application/career-event-targets';
import type { GameState } from '../../../../game/types';
import {
  careerEventCaseDefinitions,
  careerEventChanges,
  careerEventsCareer,
  continueStoryEvent,
  eventsForCase,
  offerStoryEvent,
  readyStoryEvent,
  resolveStoryEventChoice,
} from '../career-events-controller';

const CONTENT = loadLaunchContent();
const EVENTS = CONTENT.events.events;
let base: GameState;

beforeAll(() => {
  base = careerEventsCareer();
});

function offered(eventId: string): GameState {
  const event = EVENTS.find((candidate) => candidate.id === eventId);
  if (event === undefined) throw new Error(`unknown event ${eventId}`);
  return readyStoryEvent(offerStoryEvent(base, eventId), event);
}

describe('the career events Dev Harness controller', () => {
  test('preserves category cases and adds complete interaction lanes', () => {
    const cases = careerEventCaseDefinitions();
    const caseIds = cases.map((entry) => entry.id);
    expect(new Set(caseIds).size).toBe(caseIds.length);
    expect(caseIds).toEqual(
      expect.arrayContaining([
        'all',
        'target-player',
        'target-coach',
        'target-facility',
        'two-part',
        ...new Set(EVENTS.map((event) => event.category)),
      ]),
    );
    expect(eventsForCase('all')).toHaveLength(52);
    expect(eventsForCase('target-player')).toHaveLength(21);
    expect(eventsForCase('target-coach')).toHaveLength(9);
    expect(eventsForCase('target-facility')).toHaveLength(6);
    expect(eventsForCase('two-part')).toHaveLength(6);
    expect(cases.every((entry) => entry.note.length > 0)).toBe(true);
    expect(cases.some((entry) => entry.note.includes('fifty'))).toBe(false);
  });

  test('keeps every category deep link exhaustive without losing a story', () => {
    const categoryIds = [...new Set(EVENTS.map((event) => event.category))];
    expect(categoryIds.flatMap(eventsForCase)).toHaveLength(EVENTS.length);
  });

  test('builds both staff roles and an operational target for every event', () => {
    expect(base.market?.headCoach).toBeDefined();
    expect(base.market?.assistantCoach).toBeDefined();
    for (const event of EVENTS) {
      const candidates = careerEventTargetCandidates(base, event);
      if (event.trigger.requiresPlayer === true)
        expect(candidates.playerIds.length).toBeGreaterThan(0);
      if (event.trigger.requiresCoach === true)
        expect(candidates.coachRoles.length).toBeGreaterThan(0);
      if (event.trigger.requiresFacility !== undefined)
        expect(candidates.facilityIds.length).toBeGreaterThan(0);
    }
  });

  test('offers all 54 through the production builder and view model', () => {
    for (const event of EVENTS) {
      const state = offerStoryEvent(base, event.id);
      expect(state.pendingEvent?.eventId).toBe(event.id);
      expect(storyEventViewModel(state, CONTENT).title).toBe(event.title);
    }
  });

  test('resolves every available safe choice and both authored risky sides', () => {
    for (const event of EVENTS) {
      const ready = offered(event.id);
      const safe = event.choices.find(
        (choice) =>
          !choice.risky &&
          eventChoiceUnavailableReason(ready, choice) === undefined,
      );
      if (safe === undefined)
        throw new Error(`${event.id} has no available safe choice`);
      const safeResult = resolveStoryEventChoice(ready, event, safe.id, 'miss');
      expect(safeResult.state.pendingEvent).toMatchObject({
        resolvedChoiceId: safe.id,
        resolvedOutcomeIndex: 0,
        resolvedRisky: false,
      });

      const risky = event.choices.find(
        (choice) =>
          choice.risky &&
          eventChoiceUnavailableReason(ready, choice) === undefined,
      );
      if (risky === undefined)
        throw new Error(`${event.id} has no available risky choice`);
      for (const [side, index] of [
        ['success', 0],
        ['miss', 1],
      ] as const) {
        const result = resolveStoryEventChoice(ready, event, risky.id, side);
        expect(result.state.pendingEvent).toMatchObject({
          resolvedChoiceId: risky.id,
          resolvedOutcomeIndex: index,
          resolvedRisky: true,
          resolvedSuccess: index === 0,
        });
        expect(result.note).toContain('real roll');
      }
    }
  });

  test('keeps the exact target and lock across player, coach, and facility sequels', () => {
    const examples = [
      ['rival-bid-arrives', 'rival-bid-deadline-day', 'player'],
      ['the-ladder-fortnight', 'what-he-brought-back', 'coach'],
      ['volunteer-work-party', 'the-plaque', 'facility'],
    ] as const;
    for (const [openerId, followUpId, kind] of examples) {
      const event = EVENTS.find((candidate) => candidate.id === openerId)!;
      const ready = offered(openerId);
      const choice = event.choices.find((candidate) =>
        candidate.outcomes.some(
          (outcome) => outcome.nextEventId === followUpId,
        ),
      )!;
      const outcomeIndex = choice.outcomes.findIndex(
        (outcome) => outcome.nextEventId === followUpId,
      );
      const resolved = resolveStoryEventChoice(
        ready,
        event,
        choice.id,
        outcomeIndex === 0 ? 'success' : 'miss',
      ).state;
      const continued = continueStoryEvent(resolved);
      expect(continued.pendingEvent?.eventId).toBe(followUpId);
      if (kind === 'player')
        expect(continued.pendingEvent).toMatchObject({
          selectedPlayerId: ready.pendingEvent?.selectedPlayerId,
          playerLocked: true,
        });
      if (kind === 'coach')
        expect(continued.pendingEvent).toMatchObject({
          selectedCoachRole: ready.pendingEvent?.selectedCoachRole,
          coachLocked: true,
        });
      if (kind === 'facility')
        expect(continued.pendingEvent).toMatchObject({
          selectedFacilityId: ready.pendingEvent?.selectedFacilityId,
          facilityLocked: true,
        });
    }
  });

  test('the receipt includes coach and facility durable boost facets', () => {
    const coachEvent = EVENTS.find((event) => event.id === 'the-badge-course')!;
    const coachBefore = offered(coachEvent.id);
    const coachAfter = resolveStoryEventChoice(
      coachBefore,
      coachEvent,
      coachEvent.choices.find((choice) => choice.risky)!.id,
      'success',
    ).state;
    expect(
      careerEventChanges(coachBefore, coachAfter).some((line) =>
        line.includes('trainingPercent'),
      ),
    ).toBe(true);

    const facilityEvent = EVENTS.find((event) => event.id === 'the-grass-mix')!;
    const facilityBefore = offered(facilityEvent.id);
    const facilityAfter = resolveStoryEventChoice(
      facilityBefore,
      facilityEvent,
      facilityEvent.choices.find((choice) => choice.risky)!.id,
      'success',
    ).state;
    expect(
      careerEventChanges(facilityBefore, facilityAfter).some((line) =>
        line.includes('tpBonusPercent'),
      ),
    ).toBe(true);
  });

  test('the deadline receipt names the player who was sold', () => {
    const event = EVENTS.find(
      (candidate) => candidate.id === 'rival-bid-deadline-day',
    )!;
    const before = offered(event.id);
    const playerId = before.pendingEvent?.selectedPlayerId;
    const playerName = before.players.find(
      (player) => player.id === playerId,
    )?.name;
    if (playerName === undefined)
      throw new Error('deadline test has no player');
    const after = resolveStoryEventChoice(
      before,
      event,
      'take-the-deadline-fee',
      'miss',
    ).state;
    const receipt = careerEventChanges(before, after);

    expect(receipt.some((line) => line.includes(`${playerName} sold to`))).toBe(
      true,
    );
    expect(
      receipt.some((line) => line.includes('cash') && line.includes('+2600')),
    ).toBe(true);
  });

  test('says nothing changed rather than showing an empty receipt', () => {
    const state = offered('meteor-shard-center-circle');
    expect(careerEventChanges(state, state)).toEqual(['nothing changed']);
  });
});
