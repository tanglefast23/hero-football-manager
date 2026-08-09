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

  it('guarantees the Giant Spider story in its Season 1 window', () => {
    const initial = createCareer(createLaunchCareerSetup(3));
    const state = { ...initial, season: 1, week: 7, phase: 'manage' as const };

    expect(
      eventOfferForWeek(state, content, { deskClear: true }),
    ).toMatchObject({
      eventId: 'giant-spider-arrives',
      eventClock: { weeksWithoutEvent: 0 },
    });
  });

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
      resolvedEventIds: ['giant-spider-arrives', 'mysterious-energy-salesman'],
    };

    const first = eventOfferForWeek(state, content, { deskClear: true });
    const second = eventOfferForWeek(state, content, { deskClear: true });

    expect(second).toEqual(first);
    expect(first.eventId).toBeDefined();
    expect(first.eventId).not.toBe('giant-spider-arrives');
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

  it('keeps the random deck off a week that already has something to read', () => {
    const initial = createCareer(createLaunchCareerSetup(99));
    const state = {
      ...initial,
      season: 2,
      week: 12,
      phase: 'manage' as const,
      eventClock: { weeksWithoutEvent: 7, riskyChoices: 2 },
      resolvedEventIds: ['giant-spider-arrives'],
    };

    expect(
      eventOfferForWeek(state, content, { deskClear: true }).eventId,
    ).toBeDefined();
    expect(eventOfferForWeek(state, content, { deskClear: false })).toEqual({
      eventClock: state.eventClock,
    });
  });

  /**
   * The spider's window is Season 1 weeks 7-12, when Bert's tutorial queue keeps
   * the desk busy almost every week. Gating it would quietly retire it.
   */
  it('fires the authored spider inside its window even on a busy week', () => {
    const initial = createCareer(createLaunchCareerSetup(3));
    const state = { ...initial, season: 1, week: 7, phase: 'manage' as const };

    expect(
      eventOfferForWeek(state, content, { deskClear: false }).eventId,
    ).toBe('giant-spider-arrives');
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
      resolvedEventIds: ['giant-spider-arrives', repeatable.id],
    };

    expect(
      eventOfferForWeek(state, repeatableOnly, { deskClear: true }).eventId,
    ).toBe(repeatable.id);
  });
});
