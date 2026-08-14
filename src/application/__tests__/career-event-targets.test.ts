import { loadLaunchContent, type GameEvent } from '../../content';
import { createCareer, type GameState } from '../../game';
import type { PlacedFacility } from '../../game/facilities';
import type { CoachCandidate, CoachSpecialty } from '../../game/market';
import { createLaunchCareerSetup } from '../launch';
import {
  careerEventTargetCandidates,
  reconcilePendingCareerEvent,
  skipUnavailableCareerEvent,
} from '../career-event-targets';
import { eventIsEligible } from '../event-selection';

const catalog = loadLaunchContent().events;

function event(id: string): GameEvent {
  const found = catalog.events.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`missing test event ${id}`);
  return found;
}

function coach(
  id: string,
  specialties: [CoachSpecialty, CoachSpecialty],
): CoachCandidate {
  return {
    id,
    name: id,
    specialties,
    level: 2,
    weeklyWage: 100,
    personality: 'PROFESSIONAL',
    requiredDivision: 5,
    requiredFame: 0,
    loyaltyDiscountPercent: 0,
  };
}

function building(
  id: string,
  type: PlacedFacility['type'],
  x: number,
): PlacedFacility {
  return { id, type, level: 1, capitalInvested: 1_000, x, y: 0 };
}

function targetCareer(): GameState {
  const base = createCareer(createLaunchCareerSetup(20260808));
  return {
    ...base,
    phase: 'manage',
    onboarding: { stage: 'complete' },
    market: {
      ...base.market!,
      headCoach: coach('head', ['ATTACK', 'FITNESS']),
      assistantCoach: coach('assistant', ['DEFENSE', 'TECHNIQUE']),
    },
    facilities: {
      trainingGroundBuilt: true,
      grid: {
        width: 8,
        height: 6,
        nextBuildingId: 4,
        buildings: [
          building('gym', 'gym', 0),
          building('medical', 'medical-bay', 2),
          building('stand', 'stadium-stand', 4),
        ],
        discoveredAdjacencies: [],
      },
    },
  };
}

describe('career event target candidates', () => {
  test('the youth breakthrough offers only players with waiting youth offers', () => {
    const state = targetCareer();
    const youth = event('youth-coach-breakthrough');
    const offerIds = state.youthIntake?.offers.map((offer) => offer.player.id);
    expect(offerIds?.length).toBeGreaterThan(0);
    expect(careerEventTargetCandidates(state, youth).playerIds).toEqual(
      offerIds,
    );
    expect(
      careerEventTargetCandidates(
        { ...state, youthIntake: { ...state.youthIntake!, offers: [] } },
        youth,
      ).playerIds,
    ).toEqual([]);
    expect(eventIsEligible({ ...state, week: 1 }, youth)).toBe(true);
    expect(
      eventIsEligible(
        {
          ...state,
          week: 1,
          youthIntake: { ...state.youthIntake!, offers: [] },
        },
        youth,
      ),
    ).toBe(false);
  });

  test('the selling-club story offers only players visible from scout reports', () => {
    const state = targetCareer();
    const rival = state.players.find(
      (player) => player.clubId !== state.userClubId,
    )!;
    const report = {
      playerId: rival.id,
      role: rival.role,
      age: rival.age ?? 24,
      statRanges: Object.fromEntries(
        Object.entries(rival.attrs).map(([key, value]) => [
          key,
          { minimum: value, maximum: value },
        ]),
      ) as NonNullable<
        GameState['market']
      >['scoutReports'][number]['statRanges'],
      potentialRange: {
        minimum: rival.potential ?? 3,
        maximum: rival.potential ?? 3,
      },
    };
    const story = event('selling-club-needs-cash');
    const withReport: GameState = {
      ...state,
      market: { ...state.market!, scoutReports: [report] },
    };

    expect(careerEventTargetCandidates(state, story).playerIds).toEqual([]);
    expect(careerEventTargetCandidates(withReport, story).playerIds).toEqual([
      rival.id,
    ]);
    expect(eventIsEligible({ ...state, week: 17 }, story)).toBe(false);
    expect(eventIsEligible({ ...withReport, week: 17 }, story)).toBe(true);
  });

  test('the penalty gauntlet offers only user-club goalkeepers', () => {
    const state = targetCareer();
    const candidates = careerEventTargetCandidates(
      state,
      event('the-penalty-gauntlet'),
    );
    const roles = candidates.playerIds.map(
      (id) => state.players.find((player) => player.id === id)?.role,
    );
    expect(candidates.playerIds.length).toBeGreaterThan(0);
    expect(new Set(roles)).toEqual(new Set(['GK']));
  });

  test.each([
    ['sprint-the-postman', 'pace'],
    ['homesick-family-move', 'age'],
    ['the-cameras-want-him', 'fame'],
  ] as const)('%s automatically locks one tied %s leader', (eventId, field) => {
    const base = targetCareer();
    const squad = base.players.filter(
      (player) => player.clubId === base.userClubId,
    );
    const leaders = squad.slice(0, 2).map((player) => player.id);
    const state: GameState = {
      ...base,
      players: base.players.map((player) => {
        const leader = leaders.includes(player.id);
        if (field === 'pace')
          return { ...player, attrs: { ...player.attrs, pac: leader ? 99 : 1 } };
        if (field === 'age') return { ...player, age: leader ? 17 : 30 };
        return { ...player, fame: leader ? 50 : 0 };
      }),
      pendingEvent: { eventId },
    };
    const story = event(eventId);
    expect(careerEventTargetCandidates(state, story).playerIds).toEqual(
      leaders,
    );

    const first = reconcilePendingCareerEvent(state, catalog);
    const second = reconcilePendingCareerEvent(state, catalog);
    expect(leaders).toContain(first.pendingEvent?.selectedPlayerId);
    expect(first.pendingEvent?.selectedPlayerId).toBe(
      second.pendingEvent?.selectedPlayerId,
    );
    expect(first.pendingEvent?.playerLocked).toBe(true);
  });

  test('assistant-specific copy can target only the employed assistant', () => {
    expect(
      careerEventTargetCandidates(
        targetCareer(),
        event('assistant-takes-the-week'),
      ).coachRoles,
    ).toEqual(['ASSISTANT']);
  });

  test('a specialty swap excludes every coach who already holds that specialty', () => {
    const state = targetCareer();
    const withKeeperHead: GameState = {
      ...state,
      market: {
        ...state.market!,
        headCoach: coach('head', ['ATTACK', 'GOALKEEPING']),
      },
    };
    expect(
      careerEventTargetCandidates(withKeeperHead, event('the-keeper-week'))
        .coachRoles,
    ).toEqual(['ASSISTANT']);
  });

  test('a both-coach story has no candidate until both slots are staffed', () => {
    const state = targetCareer();
    const oneCoach: GameState = {
      ...state,
      market: { ...state.market!, assistantCoach: undefined },
    };
    expect(
      careerEventTargetCandidates(oneCoach, event('back-one-drill')).coachRoles,
    ).toEqual([]);
    expect(
      careerEventTargetCandidates(state, event('back-one-drill')).coachRoles,
    ).toEqual(['HEAD', 'ASSISTANT']);
  });

  test('facility candidates match the authored types and must be operational', () => {
    const state = targetCareer();
    expect(
      careerEventTargetCandidates(state, event('donated-equipment'))
        .facilityIds,
    ).toEqual(['gym']);
    const underConstruction: GameState = {
      ...state,
      facilities: {
        ...state.facilities,
        grid: {
          ...state.facilities.grid!,
          construction: {
            kind: 'BUILD',
            buildingId: 'gym',
            type: 'gym',
            targetLevel: 1,
            weeksRemaining: 1,
            totalWeeks: 2,
          },
        },
      },
    };
    expect(
      careerEventTargetCandidates(underConstruction, event('donated-equipment'))
        .facilityIds,
    ).toEqual([]);
  });
});

describe('pending target reconciliation', () => {
  test('clears an illegal unlocked selection when a legal re-pick exists', () => {
    const state = targetCareer();
    const nonKeeper = state.players.find(
      (player) => player.clubId === state.userClubId && player.role !== 'GK',
    )!;
    const repaired = reconcilePendingCareerEvent(
      {
        ...state,
        pendingEvent: {
          eventId: 'the-penalty-gauntlet',
          selectedPlayerId: nonKeeper.id,
        },
      },
      catalog,
    );
    expect(repaired.pendingEvent).toEqual({ eventId: 'the-penalty-gauntlet' });
  });

  test('re-derives the lock on a valid carried facility', () => {
    const repaired = reconcilePendingCareerEvent(
      {
        ...targetCareer(),
        pendingEvent: { eventId: 'the-plaque', selectedFacilityId: 'gym' },
      },
      catalog,
    );
    expect(repaired.pendingEvent).toMatchObject({
      eventId: 'the-plaque',
      selectedFacilityId: 'gym',
      facilityLocked: true,
    });
  });

  test('skips an illegal carried target even when another candidate is legal', () => {
    const repaired = reconcilePendingCareerEvent(
      {
        ...targetCareer(),
        pendingEvent: { eventId: 'the-plaque', selectedFacilityId: 'medical' },
      },
      catalog,
    );
    expect(repaired.pendingEvent).toBeUndefined();
  });

  test('skips a present-but-illegal locked target instead of recasting it', () => {
    const repaired = reconcilePendingCareerEvent(
      {
        ...targetCareer(),
        pendingEvent: {
          eventId: 'assistant-takes-the-week',
          selectedCoachRole: 'HEAD',
          coachLocked: true,
        },
      },
      catalog,
    );
    expect(repaired.pendingEvent).toBeUndefined();
  });

  test('the defensive skip refuses while a legal candidate remains', () => {
    const state: GameState = {
      ...targetCareer(),
      pendingEvent: { eventId: 'assistant-takes-the-week' },
    };
    expect(() => skipUnavailableCareerEvent(state, catalog)).toThrow(
      'still has an eligible target',
    );
  });
});
