import { loadLaunchContent } from '../../../../content';
import { storyEventViewModel } from '../../../../application/view-models';
import { selectCareerEventPlayer } from '../../../../game/career-events';
import type { GameState } from '../../../../game/types';

/**
 * Jest runs with `testEnvironment: 'node'` and no react-native preset, so the
 * real `react-native` module throws on require. The reel's career driving is
 * plain TypeScript sitting in the same file as its component — these stubs are
 * what let it be run at all, and nothing here renders.
 */
jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../screens/StoryEventScreen', () => ({ StoryEventScreen: () => null }));
jest.mock('../../DevHarnessControls', () => ({
  DevHarnessButton: () => null,
  devHarnessControlStyles: { row: {}, rowLabel: {} },
}));

// The mocks above are hoisted over these imports by the ts-jest transformer.
import {
  careerEventChanges,
  careerEventsCareer,
  careerEventsEntry,
  careerEventsForCategory,
  offerStoryEvent,
  resolveStoryEventChoice,
} from '../career-events';

const CONTENT = loadLaunchContent();
const EVENTS = CONTENT.events.events;

let base: GameState;
beforeAll(() => {
  base = careerEventsCareer();
});

/** The story picker's own step: offer, then pick a player if the story needs one. */
function offered(eventId: string): GameState {
  const event = EVENTS.find(candidate => candidate.id === eventId);
  if (event === undefined) throw new Error(`unknown event ${eventId}`);
  const state = offerStoryEvent(base, eventId);
  if (event.trigger.requiresPlayer !== true) return state;
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  const starter = state.players.find(player => (
    player.clubId === state.userClubId && lineup?.playerIds.includes(player.id) === true
  ));
  if (starter === undefined) throw new Error('the reel career has no starting XI');
  return selectCareerEventPlayer(state, starter.id);
}

describe('the career events reel', () => {
  it('cuts the fifty into one case per category and leaves none unreachable', () => {
    const caseIds = careerEventsEntry.cases.map(entry => entry.id);
    expect(new Set(caseIds).size).toBe(caseIds.length);
    expect(new Set(EVENTS.map(event => event.category))).toEqual(new Set(caseIds));
    expect(caseIds.flatMap(id => careerEventsForCategory(id)).length).toBe(EVENTS.length);
    // Every case carries the line the menu row and the bar note are drawn from.
    expect(careerEventsEntry.cases.every(entry => (entry.note ?? '').length > 0)).toBe(true);
  });

  it('offers every one of the fifty to the seeded career', () => {
    for (const event of EVENTS) {
      const state = offerStoryEvent(base, event.id);
      expect(state.pendingEvent?.eventId).toBe(event.id);
      // The production builder has to accept it, or the reel shows nothing.
      expect(storyEventViewModel(state, CONTENT).title).toBe(event.title);
    }
  });

  it('reaches both sides of every risky choice, on the real roll', () => {
    for (const event of EVENTS) {
      const risky = event.choices.find(choice => choice.risky);
      if (risky === undefined) throw new Error(`${event.id} has no risky choice`);
      for (const [side, index] of [['success', 0], ['miss', 1]] as const) {
        const resolved = resolveStoryEventChoice(offered(event.id), event, risky.id, side);
        const pending = resolved.state.pendingEvent;
        expect(pending?.resolvedChoiceId).toBe(risky.id);
        expect(pending?.resolvedOutcomeIndex).toBe(index);
        expect(pending?.resolvedRisky).toBe(true);
        expect(pending?.resolvedSuccess).toBe(index === 0);
        expect(pending?.outcomeText).toBe(risky.outcomes[index].text);
        // The reel never invents a resolution: it only moves the manager's risky
        // call count, so the roll it shows is one this career genuinely produces.
        expect(resolved.note).toContain('real roll');
      }
    }
  });

  it('resolves the safe choice to its one authored outcome either way', () => {
    for (const event of EVENTS) {
      const safe = event.choices.find(choice => !choice.risky);
      if (safe === undefined) throw new Error(`${event.id} has no safe choice`);
      for (const side of ['success', 'miss'] as const) {
        const resolved = resolveStoryEventChoice(offered(event.id), event, safe.id, side);
        expect(resolved.state.pendingEvent?.resolvedOutcomeIndex).toBe(0);
        expect(resolved.state.pendingEvent?.resolvedRisky).toBe(false);
        expect(resolved.state.pendingEvent?.outcomeText).toBe(safe.outcomes[0].text);
      }
    }
  });

  it('settles the milestone backlog so a plain story does not chain into one', () => {
    // The seeded career has earned milestones nothing in the harness ever
    // acknowledges. Left alone, all fifty would chain into the same recognition
    // beat and no card would ever show the plain end of a story.
    const spider = EVENTS.find(event => event.id === 'giant-spider-arrives');
    if (spider === undefined) throw new Error('the spider story is missing');
    const resolved = resolveStoryEventChoice(
      offered(spider.id),
      spider,
      spider.choices[0].id,
      'success',
    );
    expect(resolved.state.pendingEvent?.resolvedNextEventId).toBeUndefined();
  });

  it('still follows an authored chain', () => {
    const roof = EVENTS.find(event => event.id === 'leaking-stand-roof');
    if (roof === undefined) throw new Error('the leaking roof story is missing');
    const chaining = roof.choices.find(
      choice => choice.outcomes.some(outcome => outcome.nextEventId !== undefined),
    );
    if (chaining === undefined) throw new Error('the leaking roof story chains nowhere');
    const index = chaining.outcomes.findIndex(outcome => outcome.nextEventId !== undefined);
    const resolved = resolveStoryEventChoice(
      offered(roof.id),
      roof,
      chaining.id,
      index === 0 ? 'success' : 'miss',
    );
    expect(resolved.state.pendingEvent?.resolvedNextEventId)
      .toBe(chaining.outcomes[index].nextEventId);
  });

  it('reports the effects that landed, including the ones the screen does not show', () => {
    const spider = EVENTS.find(event => event.id === 'giant-spider-arrives');
    if (spider === undefined) throw new Error('the spider story is missing');
    const before = offered(spider.id);
    const resolved = resolveStoryEventChoice(before, spider, 'adopt-spider', 'success');
    const changes = careerEventChanges(before, resolved.state);

    // The screen's chips carry the fans and the morale. Nothing on it names the
    // flag that outcome also sets, so the reel has to.
    expect(changes.some(line => line.startsWith('fans 506 → 606'))).toBe(true);
    expect(changes.some(line => line === 'flags +spider-adopted')).toBe(true);
    expect(storyEventViewModel(resolved.state, CONTENT).outcomeRewards)
      .not.toContainEqual(expect.objectContaining({ label: expect.stringContaining('spider') }));
  });

  it('names the player a story landed on, which the screen calls squad morale', () => {
    const slump = EVENTS.find(event => event.id === 'player-slump');
    if (slump === undefined) throw new Error('the slump story is missing');
    const before = offered(slump.id);
    const player = before.players.find(
      candidate => candidate.id === before.pendingEvent?.selectedPlayerId,
    );
    if (player === undefined) throw new Error('the slump story picked nobody');
    const resolved = resolveStoryEventChoice(before, slump, slump.choices[0].id, 'success');
    const changes = careerEventChanges(before, resolved.state);
    expect(changes.some(line => line.startsWith(player.name))).toBe(true);
  });

  it('says nothing changed rather than showing an empty receipt', () => {
    const state = offered('giant-spider-arrives');
    expect(careerEventChanges(state, state)).toEqual(['nothing changed']);
  });
});
