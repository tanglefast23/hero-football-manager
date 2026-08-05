import {
  nextPendingClubLegend,
  reconcilePendingClubLegends,
  resolveNextClubLegendLegacy,
} from '../legacy-career';
import type { CoachCandidate } from '../market';
import type { CareerMarketState } from '../market-career';
import type { CareerPlayer, GameState } from '../types';
import { createClubBusinessState } from '../club-business';

const USER_CLUB_ID = 'user-club';

function player(id: string, overrides: Partial<CareerPlayer> = {}): CareerPlayer {
  return {
    id,
    clubId: USER_CLUB_ID,
    name: id === 'legend' ? 'Ari Flint' : id,
    role: 'FWD',
    attrs: { pac: 70, sho: 75, pas: 65, def: 40, tec: 70, sta: 68, ref: 20 },
    licensed: false,
    weeklyWage: 500,
    onHeroWage: false,
    contractSeasonsRemaining: 0,
    morale: 60,
    injuryWeeks: 0,
    age: 36,
    archetype: 'Sniper',
    potential: 4,
    consistency: 70,
    personality: 'Loyal',
    condition: 100,
    seasonsAtClub: 7,
    fame: 300,
    retirementAge: 36,
    retirementAnnounced: true,
    retirementAnnouncementSeason: 3,
    consecutiveLowMoraleWeeks: 0,
    ...overrides,
  };
}

function market(coachCandidates: readonly CoachCandidate[] = []): CareerMarketState {
  return {
    nextMissionNumber: 1,
    scoutReports: [],
    coachCandidates,
    unlockedCoachContentIds: [],
  };
}

function state(overrides: Partial<GameState> = {}): GameState {
  const legend = player('legend');
  return {
    schemaVersion: 1,
    careerMode: 'full',
    careerSeed: 4242,
    userClubId: USER_CLUB_ID,
    season: 4,
    week: 1,
    phase: 'manage',
    clubs: [{
      id: USER_CLUB_ID,
      name: 'Caped Ball FC',
      cash: 25_000,
      fans: 500,
      ticketPrice: 4,
      sponsorMonthlyFee: 2_000,
      weeklyWages: 4_000,
    }],
    fixtures: [],
    players: [],
    lineups: [{ clubId: USER_CLUB_ID, playerIds: [] }],
    facilities: { trainingGroundBuilt: false },
    eventClock: { weeksWithoutEvent: 0, riskyChoices: 0 },
    eventFlags: [],
    resolvedEventIds: [],
    awakening: { matchesSinceLastAwakening: 0, usedTriggerIds: [] },
    trainingPoints: 0,
    ledgers: [],
    market: market(),
    retiredPlayers: [legend],
    pendingLegacyPlayerIds: [legend.id],
    clubBusiness: createClubBusinessState({ season: 4 }),
    ...overrides,
  };
}

describe('career club-legend queue', () => {
  it('returns the next unique eligible user-club legend and skips stale queue entries', () => {
    const legend = player('legend');
    const second = player('second', { name: 'Milo Stone', fame: 400 });
    const input = state({
      retiredPlayers: [
        player('ineligible', { fame: 120 }),
        player('foreign', { clubId: 'other-club' }),
        legend,
        { ...legend, name: 'Duplicate record' },
        second,
      ],
      pendingLegacyPlayerIds: ['missing', 'ineligible', 'foreign', 'legend', 'legend', 'second'],
    });
    const next = nextPendingClubLegend(input);

    expect(next).toMatchObject({ id: 'legend', name: 'Ari Flint' });
    expect(next).not.toBe(input.retiredPlayers?.[2]);
    expect(reconcilePendingClubLegends(input).pendingLegacyPlayerIds).toEqual(['legend', 'second']);
    expect(nextPendingClubLegend(state({ pendingLegacyPlayerIds: ['missing'] }))).toBeUndefined();
    expect(reconcilePendingClubLegends(state({ pendingLegacyPlayerIds: ['missing'] })).pendingLegacyPlayerIds)
      .toEqual([]);
  });
});

describe('career club-legend transactions', () => {
  it('adds one deterministic market coach with converted specialty and personality casing', () => {
    const input = state();
    const before = JSON.stringify(input);
    const first = resolveNextClubLegendLegacy(input, 'coach-candidate');
    const second = resolveNextClubLegendLegacy(input, 'coach-candidate');
    const candidate = first.coachCandidate!;

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(input)).toBe(before);
    expect(first.state.pendingLegacyPlayerIds).toEqual([]);
    expect(first.state.players).toEqual([]);
    expect(candidate).toMatchObject({
      id: 'legacy-coach-legend',
      name: 'Ari Flint',
      specialties: ['ATTACK', 'TECHNIQUE'],
      level: 2,
      weeklyWage: 800,
      personality: 'LOYAL',
      requiredDivision: 4,
      requiredFame: 100,
      loyaltyDiscountPercent: 20,
      retiredLegendPlayerId: 'legend',
    });
    expect(first.state.market?.coachCandidates).toContainEqual(candidate);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it('does not duplicate a coach that was already added before its queue ID cleared', () => {
    const initial = state();
    const created = resolveNextClubLegendLegacy(initial, 'coach-candidate').coachCandidate!;
    const retried = resolveNextClubLegendLegacy(state({ market: market([created]) }), 'coach-candidate');

    expect(retried.state.market?.coachCandidates).toHaveLength(1);
    expect(retried.state.pendingLegacyPlayerIds).toEqual([]);
  });

  /**
   * Retargeted from the mentored-youth roster-cap test, which pinned the reason
   * that option was removed: it added a seventeenth player, the season
   * transition always refills the squad to the sixteen-player cap, so the
   * legacy screen only ever opened over a full roster and every offer of it
   * threw. The legacy the game kept touches the squad not at all, so a full
   * roster is no longer a reason a legend cannot be honoured.
   */
  it('resolves a legacy over a full 16-player roster', () => {
    const fullRoster = Array.from({ length: 16 }, (_, index) => player(`active-${index + 1}`, {
      age: 24,
      retirementAnnounced: false,
      contractSeasonsRemaining: 2,
    }));
    const resolved = resolveNextClubLegendLegacy(
      state({ players: fullRoster }),
      'coach-candidate',
    );

    expect(resolved.state.players).toHaveLength(16);
    expect(resolved.state.clubs[0].weeklyWages).toBe(4_000);
    expect(resolved.state.pendingLegacyPlayerIds).toEqual([]);
    expect(resolved.coachCandidate?.retiredLegendPlayerId).toBe('legend');
  });

  /**
   * The decline. It has to clear the legend exactly as thoroughly as the coach
   * path does — a farewell that left him in the queue would offer the same man
   * again next week — while touching nothing else the club owns.
   */
  it('resolves a farewell without creating a coach, a player or a cost', () => {
    const input = state();
    const before = JSON.stringify(input);
    const declined = resolveNextClubLegendLegacy(input, 'farewell');

    expect(declined.resolvedPlayerId).toBe('legend');
    expect(declined.choice).toBe('farewell');
    expect(declined.coachCandidate).toBeUndefined();
    expect(declined.state.pendingLegacyPlayerIds).toEqual([]);
    expect(declined.state.market?.coachCandidates).toEqual([]);
    expect(declined.state.players).toEqual(input.players);
    expect(declined.state.clubs).toEqual(input.clubs);
    // Still on the club's roll of former players: declined, not erased.
    expect(declined.state.retiredPlayers?.map(retired => retired.id)).toEqual(['legend']);
    expect(JSON.stringify(input)).toBe(before);
    expect(JSON.parse(JSON.stringify(declined))).toEqual(declined);
    // And he is gone from the queue for good, which is what the choice costs.
    expect(nextPendingClubLegend(declined.state)).toBeUndefined();
  });

  it('advances a queue of legends one farewell at a time', () => {
    const legend = player('legend');
    const second = player('second', { name: 'Milo Stone', fame: 400 });
    const queued = state({
      retiredPlayers: [legend, second],
      pendingLegacyPlayerIds: ['legend', 'second'],
    });

    const first = resolveNextClubLegendLegacy(queued, 'farewell');

    expect(first.state.pendingLegacyPlayerIds).toEqual(['second']);
    expect(nextPendingClubLegend(first.state)).toMatchObject({ id: 'second' });
    // The two choices are interchangeable as queue operations, so a mixed queue
    // resolves in one pass either way round.
    expect(resolveNextClubLegendLegacy(first.state, 'coach-candidate').state.pendingLegacyPlayerIds)
      .toEqual([]);
  });

  it('requires a market, an eligible pending legend, and a choice it knows', () => {
    for (const choice of ['coach-candidate', 'farewell'] as const) {
      expect(() => resolveNextClubLegendLegacy(state({ market: undefined }), choice))
        .toThrow('require a career market');
      expect(() => resolveNextClubLegendLegacy(state({ pendingLegacyPlayerIds: [] }), choice))
        .toThrow('no eligible pending');
    }
    expect(() => resolveNextClubLegendLegacy(
      state(),
      'mentor-youth' as unknown as 'coach-candidate',
    )).toThrow('unknown club-legend legacy choice mentor-youth');
  });
});
