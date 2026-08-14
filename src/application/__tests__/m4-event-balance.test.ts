import { loadLaunchContent } from '../../content';
import {
  applyCareerEventOutcome,
  createCareer,
  offerCareerEvent,
} from '../../game';
import { eventOfferForWeek } from '../event-selection';
import { createLaunchCareerSetup } from '../launch';
import { storyEventViewModel } from '../view-models';

describe('M4 risky-success cutscene rewards', () => {
  it('names every kind of earned bonus, including squad development', () => {
    const content = loadLaunchContent();
    const meteor = content.events.events.find(
      (event) => event.id === 'meteor-shard-center-circle',
    )!;
    const withDevelopment = {
      ...content,
      events: {
        ...content.events,
        events: content.events.events.map((event) =>
          event.id !== meteor.id
            ? event
            : {
                ...event,
                choices: event.choices.map((choice) =>
                  choice.id !== 'display-meteor'
                    ? choice
                    : {
                        ...choice,
                        outcomes: choice.outcomes.map((outcome, index) =>
                          index !== 0
                            ? outcome
                            : {
                                ...outcome,
                                effects: [
                                  {
                                    type: 'squadMorale' as const,
                                    amount: 10,
                                  },
                                  { type: 'fans' as const, amount: 100 },
                                  {
                                    type: 'flag' as const,
                                    flag: 'test-success',
                                    value: true,
                                  },
                                  {
                                    type: 'statDelta' as const,
                                    attribute: 'tec' as const,
                                    amount: 2,
                                  },
                                  { type: 'injury' as const, weeks: 2 },
                                ],
                              },
                        ),
                      },
                ),
              },
        ),
      },
    };
    const initial = createCareer(createLaunchCareerSetup());
    const resolved = applyCareerEventOutcome(
      offerCareerEvent(initial, meteor.id),
      'display-meteor',
      'The shard draws a crowd.',
      { moraleDelta: 10, fanDelta: 100 } as never,
      { outcomeIndex: 0, risky: true, success: true },
    );

    const viewModel = storyEventViewModel(resolved, withDevelopment);
    expect(viewModel.successCutscene?.rewards).toEqual([
      '+10 squad morale',
      '+100 fans',
      '+2 TEC',
      '2 weeks out injured',
    ]);
    expect(viewModel).toMatchObject({
      resolvedRisky: true,
      resolvedSuccess: true,
      outcomeRewards: [
        { label: '+10 squad morale', kind: 'morale', positive: true },
        { label: '+100 fans', kind: 'fans', positive: true },
        { label: '+2 TEC', kind: 'stat', positive: true },
        { label: '2 weeks out injured', kind: 'injury', positive: false },
      ],
    });
  });
});

describe('M4 event balance rails', () => {
  const catalog = loadLaunchContent().events;

  it('keeps individual setbacks fail-soft and risky cash value bounded', () => {
    const moneyAmounts = catalog.events.flatMap((event) =>
      event.choices.flatMap((choice) =>
        choice.outcomes.flatMap((outcome) =>
          outcome.effects.flatMap((effect) =>
            effect.type === 'money' ? [effect.amount] : [],
          ),
        ),
      ),
    );
    const expectedRiskyCash = catalog.events.flatMap((event) =>
      event.choices
        .filter((choice) => choice.risky)
        .map((choice) =>
          choice.outcomes.reduce(
            (expected, outcome) =>
              expected +
              (outcome.weight / 100) *
                outcome.effects.reduce(
                  (sum, effect) =>
                    sum + (effect.type === 'money' ? effect.amount : 0),
                  0,
                ),
            0,
          ),
        ),
    );
    const percentageCashLosses = catalog.events.flatMap((event) =>
      event.choices.flatMap((choice) =>
        choice.outcomes.flatMap((outcome) =>
          outcome.effects.flatMap((effect) =>
            effect.type === 'cashLossPercent' ? [effect.percent] : [],
          ),
        ),
      ),
    );

    expect(Math.min(...moneyAmounts)).toBeGreaterThanOrEqual(-1_500);
    expect(Math.max(...moneyAmounts)).toBeLessThanOrEqual(5_000);
    expect(Math.min(...expectedRiskyCash)).toBeGreaterThanOrEqual(-750);
    expect(Math.max(...expectedRiskyCash)).toBeLessThanOrEqual(3_000);
    expect(Math.max(...percentageCashLosses)).toBeLessThanOrEqual(10);
  });

  /**
   * `deskClear: true` on every week makes this a CEILING, not the rate a career
   * actually sees: stories are only offered on weeks whose inbox is otherwise
   * empty, and a played career has far fewer of those than sixty. Re-derived
   * from 6/18/8-14 when the flat weekly chance became a ramp that eases up to
   * the guarantee — the same guarantee week, reached with rising odds instead
   * of a flat roll, so the drought ceiling is unchanged and the middle fills in.
   */
  it('lands a useful but non-flooding ceiling on stories across two seasons', () => {
    const counts = Array.from({ length: 50 }, (_, seed) => {
      let state = createCareer(createLaunchCareerSetup(seed));
      let count = 0;
      for (let season = 1; season <= 2; season += 1) {
        for (let week = 1; week <= 30; week += 1) {
          state = { ...state, season, week, phase: 'manage' };
          const offer = eventOfferForWeek(state, catalog, { deskClear: true });
          state = {
            ...state,
            eventClock: offer.eventClock,
            ...(offer.eventId === undefined
              ? {}
              : {
                  resolvedEventIds: state.resolvedEventIds.includes(
                    offer.eventId,
                  )
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

    expect(Math.min(...counts)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...counts)).toBeLessThanOrEqual(21);
    expect(mean).toBeGreaterThanOrEqual(14);
    expect(mean).toBeLessThanOrEqual(18);
  });
});
