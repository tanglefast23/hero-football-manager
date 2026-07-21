import { loadLaunchContent } from '../../content';
import { applyCareerEventOutcome, createCareer, offerCareerEvent } from '../../game';
import { eventOfferForWeek } from '../event-selection';
import { createLaunchCareerSetup } from '../launch';
import { storyEventViewModel } from '../view-models';

describe('M4 risky-success cutscene rewards', () => {
  it('names every kind of earned bonus, including squad development', () => {
    const content = loadLaunchContent();
    const spider = content.events.events.find(event => event.id === 'giant-spider-arrives')!;
    const withDevelopment = {
      ...content,
      events: {
        ...content.events,
        events: content.events.events.map(event => event.id !== spider.id ? event : {
          ...event,
          choices: event.choices.map(choice => choice.id !== 'adopt-spider' ? choice : {
            ...choice,
            outcomes: choice.outcomes.map((outcome, index) => index !== 0 ? outcome : {
              ...outcome,
              effects: [
                ...outcome.effects,
                { type: 'statDelta' as const, attribute: 'tec' as const, amount: 2 },
                { type: 'injury' as const, weeks: 2 },
              ],
            }),
          }),
        }),
      },
    };
    const initial = createCareer(createLaunchCareerSetup());
    const resolved = applyCareerEventOutcome(
      offerCareerEvent(initial, spider.id),
      'adopt-spider',
      'The spider becomes the mascot.',
      { moraleDelta: 10, fanDelta: 100 } as never,
      { outcomeIndex: 0, risky: true, success: true },
    );

    expect(storyEventViewModel(resolved, withDevelopment).successCutscene?.rewards)
      .toEqual(['+10 squad morale', '+100 fans', '+2 TEC', '2 weeks out injured']);
  });
});

describe('M4 event balance rails', () => {
  const catalog = loadLaunchContent().events;

  it('keeps individual setbacks fail-soft and risky cash value bounded', () => {
    const moneyAmounts = catalog.events.flatMap(event => event.choices.flatMap(choice => (
      choice.outcomes.flatMap(outcome => outcome.effects.flatMap(effect => effect.type === 'money' ? [effect.amount] : []))
    )));
    const expectedRiskyCash = catalog.events.flatMap(event => event.choices
      .filter(choice => choice.risky)
      .map(choice => choice.outcomes.reduce((expected, outcome) => (
        expected + outcome.weight / 100 * outcome.effects.reduce(
          (sum, effect) => sum + (effect.type === 'money' ? effect.amount : 0),
          0,
        )
      ), 0)));

    expect(Math.min(...moneyAmounts)).toBeGreaterThanOrEqual(-1_500);
    expect(Math.max(...moneyAmounts)).toBeLessThanOrEqual(5_000);
    expect(Math.min(...expectedRiskyCash)).toBeGreaterThanOrEqual(-750);
    expect(Math.max(...expectedRiskyCash)).toBeLessThanOrEqual(3_000);
  });

  it('lands a useful but non-flooding number of stories across two seasons', () => {
    const counts = Array.from({ length: 50 }, (_, seed) => {
      let state = createCareer(createLaunchCareerSetup(seed, undefined, undefined, 'full'));
      let count = 0;
      for (let season = 1; season <= 2; season += 1) {
        for (let week = 1; week <= 30; week += 1) {
          state = { ...state, season, week, phase: 'manage' };
          const offer = eventOfferForWeek(state, catalog);
          state = {
            ...state,
            eventClock: offer.eventClock,
            ...(offer.eventId === undefined ? {} : {
              resolvedEventIds: state.resolvedEventIds.includes(offer.eventId)
                ? state.resolvedEventIds
                : [...state.resolvedEventIds, offer.eventId],
              resolvedEventHistory: [
                ...(state.resolvedEventHistory ?? []),
                { eventId: offer.eventId, season, week },
              ],
            }),
          };
          if (offer.eventId !== undefined) count += 1;
        }
      }
      return count;
    });
    const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;

    expect(Math.min(...counts)).toBeGreaterThanOrEqual(6);
    expect(Math.max(...counts)).toBeLessThanOrEqual(18);
    expect(mean).toBeGreaterThanOrEqual(8);
    expect(mean).toBeLessThanOrEqual(14);
  });
});
