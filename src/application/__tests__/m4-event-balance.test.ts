import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game';
import { eventOfferForWeek } from '../event-selection';
import { createLaunchCareerSetup } from '../launch';

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
