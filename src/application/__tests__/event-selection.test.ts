import { loadLaunchContent } from '../../content';
import { createCareer, createFacilityGrid } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { eventChoiceUnavailableReason, eventIsEligible, eventOfferForWeek } from '../event-selection';

describe('M4 event selection', () => {
  const content = loadLaunchContent().events;

  it('guarantees the Giant Spider story in its Season 1 window', () => {
    const initial = createCareer(createLaunchCareerSetup(3, undefined, undefined, 'full'));
    const state = { ...initial, season: 1, week: 7, phase: 'manage' as const };

    expect(eventOfferForWeek(state, content)).toMatchObject({
      eventId: 'giant-spider-arrives',
      eventClock: { weeksWithoutEvent: 0 },
    });
  });

  it('does not interrupt the first-hero onboarding journey', () => {
    const initial = createCareer(createLaunchCareerSetup(3, undefined, undefined, 'full'));
    const state = {
      ...initial,
      season: 1,
      week: 7,
      phase: 'manage' as const,
      onboarding: { stage: 'first-match' as const },
      eventClock: { weeksWithoutEvent: 4, riskyChoices: 0 },
    };

    expect(eventOfferForWeek(state, content)).toEqual({ eventClock: state.eventClock });
  });

  it('is deterministic and never re-offers a resolved one-shot event', () => {
    const initial = createCareer(createLaunchCareerSetup(99, undefined, undefined, 'full'));
    const state = {
      ...initial,
      season: 2,
      week: 12,
      phase: 'manage' as const,
      eventClock: { weeksWithoutEvent: 7, riskyChoices: 2 },
      resolvedEventIds: ['giant-spider-arrives', 'mysterious-energy-salesman'],
    };

    const first = eventOfferForWeek(state, content);
    const second = eventOfferForWeek(state, content);

    expect(second).toEqual(first);
    expect(first.eventId).toBeDefined();
    expect(first.eventId).not.toBe('giant-spider-arrives');
    expect(first.eventId).not.toBe('mysterious-energy-salesman');
    expect(first.eventClock.weeksWithoutEvent).toBe(0);
  });

  it('increments the persisted dry-spell clock when no event is offered', () => {
    const initial = createCareer(createLaunchCareerSetup(1, undefined, undefined, 'full'));
    const state = {
      ...initial,
      season: 1,
      week: 1,
      phase: 'manage' as const,
      eventClock: { weeksWithoutEvent: 0, riskyChoices: 0 },
    };

    const offer = eventOfferForWeek(state, content);

    expect(offer.eventId).toBeUndefined();
    expect(offer.eventClock.weeksWithoutEvent).toBe(1);
  });

  it('leaves a management week between resolved stories', () => {
    const initial = createCareer(createLaunchCareerSetup(1, undefined, undefined, 'full'));
    const state = {
      ...initial,
      season: 1,
      week: 8,
      phase: 'manage' as const,
      eventClock: { weeksWithoutEvent: 0, riskyChoices: 0 },
      resolvedEventHistory: [{ eventId: 'team-bbq', season: 1, week: 7 }],
    };

    expect(eventOfferForWeek(state, content)).toEqual({
      eventClock: { weeksWithoutEvent: 1, riskyChoices: 0 },
    });
  });

  it('enforces personality, facility, and money requirements from content', () => {
    const initial = createCareer(createLaunchCareerSetup(1, undefined, undefined, 'full'));
    const prank = content.events.find(event => event.id === 'prank-war')!;
    const drone = content.events.find(event => event.id === 'training-drone')!;
    const clinic = content.events.find(event => event.id === 'miracle-physio')!.choices[0];
    const noJoker = {
      ...initial,
      season: 2,
      week: 10,
      facilities: { trainingGroundBuilt: false, grid: createFacilityGrid() },
      players: initial.players.map(player => ({ ...player, personality: 'Professional' as const })),
    };
    expect(eventIsEligible(noJoker, prank)).toBe(false);
    expect(eventIsEligible({
      ...noJoker,
      players: noJoker.players.map((player, index) => index === 0 ? { ...player, personality: 'Joker' as const } : player),
    }, prank)).toBe(true);
    expect(eventIsEligible(noJoker, drone)).toBe(false);
    expect(eventIsEligible({ ...noJoker, facilities: { ...noJoker.facilities, trainingGroundBuilt: true } }, drone)).toBe(true);
    expect(eventChoiceUnavailableReason({
      ...noJoker,
      clubs: noJoker.clubs.map(club => club.id === noJoker.userClubId ? { ...club, cash: 699 } : club),
    }, clinic)).toBe('Requires $700 cash');
  });

  it('can re-offer an authored repeatable event after its dry-spell guarantee', () => {
    const initial = createCareer(createLaunchCareerSetup(88, undefined, undefined, 'full'));
    const barbecue = content.events.find(event => event.id === 'team-bbq')!;
    const repeatableOnly = { ...content, events: [barbecue] };
    const state = {
      ...initial,
      season: 2,
      week: 12,
      phase: 'manage' as const,
      eventClock: { weeksWithoutEvent: 8, riskyChoices: 0 },
      resolvedEventIds: ['giant-spider-arrives', barbecue.id],
    };

    expect(eventOfferForWeek(state, repeatableOnly).eventId).toBe(barbecue.id);
  });
});
