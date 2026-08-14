import { loadLaunchContent } from '../../content';
import { createCareer, createFacilityGrid } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import {
  eventChoiceUnavailableReason,
  eventIsEligible,
  eventOfferForWeek,
} from '../event-selection';

describe('M4 event selection', () => {
  const content = loadLaunchContent().events;

  it('does not interrupt the first-hero onboarding journey', () => {
    const initial = createCareer(createLaunchCareerSetup(3));
    const state = {
      ...initial,
      season: 1,
      week: 7,
      phase: 'manage' as const,
      onboarding: { stage: 'first-match' as const },
      eventClock: { weeksWithoutEvent: 4, riskyChoices: 0 },
    };

    expect(eventOfferForWeek(state, content, { deskClear: true })).toEqual({
      eventClock: state.eventClock,
    });
  });

  it('is deterministic and never re-offers a resolved one-shot event', () => {
    const initial = createCareer(createLaunchCareerSetup(99));
    const state = {
      ...initial,
      season: 2,
      week: 12,
      phase: 'manage' as const,
      eventClock: { weeksWithoutEvent: 7, riskyChoices: 2 },
      resolvedEventIds: ['mysterious-energy-salesman'],
    };

    const first = eventOfferForWeek(state, content, { deskClear: true });
    const second = eventOfferForWeek(state, content, { deskClear: true });

    expect(second).toEqual(first);
    expect(first.eventId).toBeDefined();
    expect(first.eventId).not.toBe('mysterious-energy-salesman');
    expect(first.eventClock.weeksWithoutEvent).toBe(0);
  });

  it('increments the persisted dry-spell clock when no event is offered', () => {
    const initial = createCareer(createLaunchCareerSetup(1));
    const state = {
      ...initial,
      season: 1,
      week: 1,
      phase: 'manage' as const,
      eventClock: { weeksWithoutEvent: 0, riskyChoices: 0 },
    };

    const offer = eventOfferForWeek(state, content, { deskClear: true });

    expect(offer.eventId).toBeUndefined();
    expect(offer.eventClock.weeksWithoutEvent).toBe(1);
  });

  it('leaves a management week between resolved stories', () => {
    const initial = createCareer(createLaunchCareerSetup(1));
    const state = {
      ...initial,
      season: 1,
      week: 8,
      phase: 'manage' as const,
      eventClock: { weeksWithoutEvent: 0, riskyChoices: 0 },
      resolvedEventHistory: [
        { eventId: 'the-rondo-circle', season: 1, week: 7 },
      ],
    };

    expect(eventOfferForWeek(state, content, { deskClear: true })).toEqual({
      eventClock: { weeksWithoutEvent: 1, riskyChoices: 0 },
    });
  });

  it('offers a queued achievement story on the first desk after it is earned', () => {
    const initial = createCareer(createLaunchCareerSetup(1));
    const state = {
      ...initial,
      season: 1,
      week: 13,
      phase: 'manage' as const,
      eventClock: { weeksWithoutEvent: 3, riskyChoices: 0 },
      pendingMilestones: [{ eventId: 'milestone-first-cup-win' }],
      resolvedEventHistory: [
        { eventId: 'the-rondo-circle', season: 1, week: 12 },
      ],
    };

    expect(eventOfferForWeek(state, content, { deskClear: false })).toEqual({
      eventId: 'milestone-first-cup-win',
      eventClock: state.eventClock,
    });
  });

  it('schedules the one-time fire one to four weeks after the threshold', () => {
    const initial = createCareer(createLaunchCareerSetup(18));
    let userFixtures = 0;
    const fixtures = initial.fixtures.map((fixture) => {
      const userMatch =
        fixture.homeClubId === initial.userClubId ||
        fixture.awayClubId === initial.userClubId;
      if (!userMatch || userFixtures >= 8) return fixture;
      userFixtures += 1;
      const atHome = fixture.homeClubId === initial.userClubId;
      return {
        ...fixture,
        status: 'played' as const,
        score: atHome
          ? { homeGoals: 2, awayGoals: 0 }
          : { homeGoals: 0, awayGoals: 2 },
      };
    });
    const grid = {
      ...createFacilityGrid(),
      buildings: [
        {
          id: 'small-a',
          type: 'gym' as const,
          level: 1 as const,
          capitalInvested: 7_000,
          x: 0,
          y: 0,
        },
        {
          id: 'small-b',
          type: 'dorm' as const,
          level: 1 as const,
          capitalInvested: 6_000,
          x: 1,
          y: 0,
        },
      ],
    };
    const ready = {
      ...initial,
      phase: 'manage' as const,
      week: 30,
      fixtures,
      releasedPlayerIds: ['released-1', 'released-2', 'released-3'],
      cashTransactions: [1, 2, 3].map((number) => ({
        id: `sale-${number}`,
        season: 1,
        week: number,
        kind: 'transfer-sell' as const,
        label: 'Sold player',
        amount: 1_000,
        balanceAfter: 10_000,
        referenceId: `sold-${number}`,
      })),
      facilities: { ...initial.facilities, grid },
    };
    const scheduled = eventOfferForWeek(ready, content, { deskClear: true });
    expect(scheduled.eventId).not.toBe('retaliation-facility-fire');
    expect(scheduled.eventClock.scheduledEvent).toMatchObject({
      eventId: 'retaliation-facility-fire',
      season: 2,
    });
    expect(scheduled.eventClock.scheduledEvent?.week).toBeGreaterThanOrEqual(1);
    expect(scheduled.eventClock.scheduledEvent?.week).toBeLessThanOrEqual(4);
    const due = scheduled.eventClock.scheduledEvent!;
    expect(
      eventOfferForWeek(
        {
          ...ready,
          season: due.season,
          week: due.week,
          eventClock: scheduled.eventClock,
        },
        content,
        { deskClear: false },
      ).eventId,
    ).toBe('retaliation-facility-fire');
    const oneFirebreakLeft = {
      ...ready,
      season: due.season,
      week: due.week,
      eventClock: scheduled.eventClock,
      facilities: {
        ...ready.facilities,
        grid: { ...grid, buildings: grid.buildings.slice(0, 1) },
      },
    };
    expect(
      eventOfferForWeek(oneFirebreakLeft, content, { deskClear: false })
        .eventClock.scheduledEvent,
    ).toBeUndefined();
    expect(
      eventOfferForWeek(
        { ...ready, releasedPlayerIds: ['released-1', 'released-2'] },
        content,
        { deskClear: true },
      ).eventId,
    ).not.toBe('retaliation-facility-fire');
    expect(
      eventOfferForWeek(
        { ...ready, resolvedEventIds: ['retaliation-facility-fire'] },
        content,
        { deskClear: true },
      ).eventId,
    ).not.toBe('retaliation-facility-fire');
  });

  it('keeps the random deck off a week that already has something to read', () => {
    const initial = createCareer(createLaunchCareerSetup(99));
    const state = {
      ...initial,
      season: 2,
      week: 12,
      phase: 'manage' as const,
      eventClock: { weeksWithoutEvent: 7, riskyChoices: 2 },
    };

    expect(
      eventOfferForWeek(state, content, { deskClear: true }).eventId,
    ).toBeDefined();
    expect(eventOfferForWeek(state, content, { deskClear: false })).toEqual({
      eventClock: state.eventClock,
    });
  });

  it('does not count a busy week towards the dry spell', () => {
    const initial = createCareer(createLaunchCareerSetup(1));
    const state = {
      ...initial,
      season: 1,
      week: 1,
      phase: 'manage' as const,
      eventClock: { weeksWithoutEvent: 3, riskyChoices: 0 },
    };

    // Only quiet weeks that came up empty raise the odds of the next one.
    expect(
      eventOfferForWeek(state, content, { deskClear: false }).eventClock
        .weeksWithoutEvent,
    ).toBe(3);
    expect(
      eventOfferForWeek(state, content, { deskClear: true }).eventClock
        .weeksWithoutEvent,
    ).not.toBe(3);
  });

  it('enforces personality, facility, and money requirements from content', () => {
    const initial = createCareer(createLaunchCareerSetup(1));
    // A player who submits a written training schedule, with a second schedule
    // attached for the first one, is a Professional.
    const doubleSession = content.events.find(
      (event) => event.id === 'the-double-session',
    )!;
    // A story about the pitch needs a pitch that is actually finished.
    const grassMix = content.events.find(
      (event) => event.id === 'the-grass-mix',
    )!;
    const mountainCamp = content.events.find(
      (event) => event.id === 'the-specialist-camp',
    )!;
    const homesick = content.events.find(
      (event) => event.id === 'homesick-family-move',
    )!;
    const spendingChoice = mountainCamp.choices.find((choice) => choice.risky)!;

    const noProfessional = {
      ...initial,
      season: 2,
      week: 10,
      facilities: { trainingGroundBuilt: false, grid: createFacilityGrid() },
      players: initial.players.map((player) => ({
        ...player,
        personality: 'Joker' as const,
      })),
    };
    expect(eventIsEligible(noProfessional, doubleSession)).toBe(false);
    expect(
      eventIsEligible(
        {
          ...noProfessional,
          players: noProfessional.players.map((player, index) =>
            index === 0
              ? { ...player, personality: 'Professional' as const }
              : player,
          ),
        },
        doubleSession,
      ),
    ).toBe(true);

    // No operational training pitch, so the grass story is not in the deck.
    expect(eventIsEligible(noProfessional, grassMix)).toBe(false);

    expect(
      eventChoiceUnavailableReason(
        {
          ...noProfessional,
          clubs: noProfessional.clubs.map((club) =>
            club.id === noProfessional.userClubId
              ? { ...club, cash: 699 }
              : club,
          ),
        },
        spendingChoice,
      ),
    ).toBe('Requires $700 cash');

    const homesickWeek = {
      ...initial,
      season: 1,
      week: 10,
      clubs: initial.clubs.map((club) =>
        club.id === initial.userClubId ? { ...club, cash: 299 } : club,
      ),
    };
    expect(eventIsEligible(homesickWeek, homesick)).toBe(false);
    expect(
      eventIsEligible(
        {
          ...homesickWeek,
          clubs: homesickWeek.clubs.map((club) =>
            club.id === homesickWeek.userClubId ? { ...club, cash: 300 } : club,
          ),
        },
        homesick,
      ),
    ).toBe(true);
  });

  /**
   * Every branch this feature authored that spends money declares what it needs.
   * Without it a broke club is offered a choice it cannot pay for, and the
   * engine tolerates the negative balance rather than refusing.
   */
  it('never offers a new spending branch the club cannot cover', () => {
    const AUTHORED_SPENDERS = [
      'homesick-family-move',
      'the-specialist-camp',
      'sports-science-salesman',
      'volunteer-work-party',
      'floodlight-night',
      'milestone-merch-surge',
    ];
    for (const eventId of AUTHORED_SPENDERS) {
      const event = content.events.find(
        (candidate) => candidate.id === eventId,
      )!;
      for (const choice of event.choices) {
        const spend = Math.min(
          0,
          ...choice.outcomes.flatMap((outcome) =>
            outcome.effects.flatMap((effect) =>
              effect.type === 'money' ? [effect.amount] : [],
            ),
          ),
        );
        if (spend >= 0) continue;
        expect({
          eventId,
          choice: choice.id,
          minMoney: choice.requires?.minMoney,
        }).toMatchObject({ eventId, choice: choice.id, minMoney: -spend });
      }
    }
  });

  it('never draws an authored follow-up from the random deck', () => {
    const initial = createCareer(createLaunchCareerSetup(88));
    const opener = content.events.find(
      (event) => event.id === 'rival-bid-arrives',
    )!;
    const followUp = content.events.find(
      (event) => event.id === 'rival-bid-deadline-day',
    )!;
    const state = {
      ...initial,
      season: 1,
      week: 9,
      phase: 'manage' as const,
      eventFlags: ['rival-bid-rebuffed'],
      eventClock: { weeksWithoutEvent: 8, riskyChoices: 0 },
      resolvedEventIds: [opener.id],
    };

    expect(
      eventOfferForWeek(
        state,
        { ...content, events: [opener, followUp] },
        { deskClear: true },
      ),
    ).toEqual({
      eventClock: { weeksWithoutEvent: 9, riskyChoices: 0 },
    });
  });

  it('can re-offer an authored repeatable event after its dry-spell guarantee', () => {
    const initial = createCareer(createLaunchCareerSetup(88));
    const repeatable = content.events.find(
      (event) => event.id === 'the-double-session',
    )!;
    const repeatableOnly = { ...content, events: [repeatable] };
    const state = {
      ...initial,
      season: 2,
      week: 12,
      phase: 'manage' as const,
      eventClock: { weeksWithoutEvent: 8, riskyChoices: 0 },
      resolvedEventIds: [repeatable.id],
    };

    expect(
      eventOfferForWeek(state, repeatableOnly, { deskClear: true }).eventId,
    ).toBe(repeatable.id);
  });
  /**
   * The deck's order decides which story a seeded career fires, so the
   * comparator has to be one the language pins. `localeCompare` reads the JS
   * engine's own collation table — Hermes on device need not agree with V8
   * under Jest — which is the exact hazard `src/game/ordering.ts` documents and
   * forbids. Every shipped id happens to sort the same under both today; these
   * two do not, so the draw moves the moment the comparator does.
   */
  it('orders the deck by code unit, not by the host engine collation', () => {
    const initial = createCareer(createLaunchCareerSetup(4_242));
    const state = {
      ...initial,
      season: 2,
      week: 12,
      phase: 'manage' as const,
      eventClock: { weeksWithoutEvent: 8, riskyChoices: 0 },
    };
    const eligible = content.events
      .filter((event) => eventIsEligible(state, event))
      .slice(0, 2);
    expect(eligible).toHaveLength(2);
    // 'A-story' < 'a-story' by UTF-16 code unit; ICU collation puts the
    // lowercase first. Same rarity, so the two weights are equal, the draw
    // lands on a fixed slot, and the two orderings put a different id in it:
    // this seed reads slot 1, which is 'a-story' here and 'A-story' under
    // `localeCompare`.
    const [upper, lower] = eligible;
    const twoEvents = {
      ...content,
      events: [
        { ...lower, id: 'a-story', rarity: upper.rarity },
        { ...upper, id: 'A-story' },
      ],
    };

    expect(
      eventOfferForWeek(state, twoEvents, { deskClear: true }).eventId,
    ).toBe('a-story');
  });
});
