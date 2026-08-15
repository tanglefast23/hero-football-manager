import { loadLaunchContent } from '../index';
import { GameEventSchema } from '../schemas';

/**
 * The gates that keep the event catalog honest about who an effect lands on.
 *
 * Each of these was a silent failure before: an effect the engine read with
 * `.find` and quietly dropped, or a `morale` that meant "the squad" only
 * because nothing said otherwise. They fail the build now, so the catalog can
 * never drift back.
 */

const BASE_EVENT = {
  id: 'gate-fixture',
  category: 'club' as const,
  rarity: 'common' as const,
  art: 'event-team-bbq',
  title: 'A Fixture',
  body: 'Something happens at the club.',
  trigger: { season: 1, minWeek: 1, maxWeek: 30 },
  choices: [
    {
      id: 'safe-one',
      label: 'Do the safe thing',
      risky: false,
      outcomes: [
        {
          id: 'done',
          weight: 100,
          text: 'It goes fine.',
          effects: [] as unknown[],
        },
      ],
    },
    {
      id: 'safe-two',
      label: 'Do the other safe thing',
      risky: false,
      outcomes: [
        {
          id: 'done',
          weight: 100,
          text: 'It also goes fine.',
          effects: [] as unknown[],
        },
      ],
    },
  ],
};

function eventWithEffects(effects: unknown[], requiresPlayer = false) {
  return {
    ...BASE_EVENT,
    trigger: {
      ...BASE_EVENT.trigger,
      ...(requiresPlayer ? { requiresPlayer: true } : {}),
    },
    choices: [
      {
        ...BASE_EVENT.choices[0],
        outcomes: [{ ...BASE_EVENT.choices[0].outcomes[0], effects }],
      },
      BASE_EVENT.choices[1],
    ],
  };
}

describe('event effect gates', () => {
  it('accepts the shape the fixtures are built from', () => {
    expect(GameEventSchema.safeParse(eventWithEffects([])).success).toBe(true);
  });

  it('rejects two effects of a type the engine reads with find()', () => {
    // `money`, `tp` and `fans` are summed; these are not, so a second one would
    // be dropped on the floor without the gate.
    for (const pair of [
      [
        { type: 'morale', amount: 4 },
        { type: 'morale', amount: 5 },
      ],
      [
        { type: 'squadMorale', amount: 4 },
        { type: 'squadMorale', amount: 5 },
      ],
      [
        { type: 'injury', weeks: 2 },
        { type: 'injury', weeks: 3 },
      ],
      [
        { type: 'statDelta', attribute: 'sho', amount: 2 },
        { type: 'statDelta', attribute: 'pac', amount: 2 },
      ],
    ]) {
      const requiresPlayer = pair[0].type !== 'squadMorale';
      expect(
        GameEventSchema.safeParse(eventWithEffects(pair, requiresPlayer))
          .success,
      ).toBe(false);
    }
  });

  it('still sums the effects that are meant to be summed', () => {
    const money = [
      { type: 'money', amount: 100 },
      { type: 'money', amount: 200 },
    ];
    expect(GameEventSchema.safeParse(eventWithEffects(money)).success).toBe(
      true,
    );
  });

  it('caps percentage cash setbacks at the approved ten percent', () => {
    expect(
      GameEventSchema.safeParse(
        eventWithEffects([{ type: 'cashLossPercent', percent: 10 }]),
      ).success,
    ).toBe(true);
    expect(
      GameEventSchema.safeParse(
        eventWithEffects([{ type: 'cashLossPercent', percent: 11 }]),
      ).success,
    ).toBe(false);
  });

  it('keeps rare and legendary stories to one appearance per career', () => {
    expect(
      GameEventSchema.safeParse({
        ...BASE_EVENT,
        rarity: 'rare',
        trigger: { ...BASE_EVENT.trigger, repeatable: true },
      }).success,
    ).toBe(false);
    expect(
      GameEventSchema.safeParse({
        ...BASE_EVENT,
        rarity: 'legendary',
        trigger: { ...BASE_EVENT.trigger, repeatable: true },
      }).success,
    ).toBe(false);
  });

  it('rejects a player effect on an event that never asks for a player', () => {
    for (const effect of [
      { type: 'morale', amount: 5 },
      { type: 'injury', weeks: 2 },
      { type: 'injuryDelta', weeks: -1 },
      { type: 'statDelta', attribute: 'sho', amount: 2 },
    ]) {
      expect(
        GameEventSchema.safeParse(eventWithEffects([effect])).success,
      ).toBe(false);
      expect(
        GameEventSchema.safeParse(eventWithEffects([effect], true)).success,
      ).toBe(true);
    }
  });

  it('lets squadMorale say "the room" without a selected player', () => {
    expect(
      GameEventSchema.safeParse(
        eventWithEffects([{ type: 'squadMorale', amount: -6 }]),
      ).success,
    ).toBe(true);
  });

  it('will not let an injury heal be spelled as a setback', () => {
    expect(
      GameEventSchema.safeParse(
        eventWithEffects([{ type: 'injury', weeks: -1 }], true),
      ).success,
    ).toBe(false);
    expect(
      GameEventSchema.safeParse(
        eventWithEffects([{ type: 'injuryDelta', weeks: 1 }], true),
      ).success,
    ).toBe(false);
  });

  /**
   * The catalog-wide half of the migration. A partial pass would leave events
   * whose morale silently applies to nobody, and no other test would notice.
   */
  it('carries no morale effect that the shipped catalog cannot target', () => {
    const offenders = loadLaunchContent()
      .events.events.filter((event) => event.trigger.requiresPlayer !== true)
      .filter((event) =>
        event.choices.some((choice) =>
          choice.outcomes.some((outcome) =>
            outcome.effects.some((effect) => effect.type === 'morale'),
          ),
        ),
      )
      .map((event) => event.id);

    expect(offenders).toEqual([]);
  });

  it('kept the squad-wide mood the migration moved, rather than dropping it', () => {
    const squadMoraleEffects = loadLaunchContent().events.events.flatMap(
      (event) =>
        event.choices.flatMap((choice) =>
          choice.outcomes.flatMap((outcome) =>
            outcome.effects.filter((effect) => effect.type === 'squadMorale'),
          ),
        ),
    );

    // The remaining 17 are attached to real targeted or lasting choices. The
    // shallow mood-only stories were removed or given sporting consequences.
    expect(squadMoraleEffects).toHaveLength(17);
  });
});
