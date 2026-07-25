import {
  nextPendingClubLegend,
  reconcilePendingClubLegends,
  resolveNextClubLegendLegacy,
} from '../legacy-career';
import type { CoachCandidate } from '../market';
import type { CareerMarketState } from '../market-career';
import type { CareerPlayer, GameState } from '../types';

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
    fame: 82,
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
    ...overrides,
  };
}

describe('career club-legend queue', () => {
  it('returns the next unique eligible user-club legend and skips stale queue entries', () => {
    const legend = player('legend');
    const second = player('second', { name: 'Milo Stone', fame: 90 });
    const input = state({
      retiredPlayers: [
        player('ineligible', { fame: 40 }),
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

  it('adds one deterministic boosted youth CareerPlayer, payroll, and preserves the next legend', () => {
    const second = player('second', { name: 'Milo Stone', fame: 90 });
    const input = state({
      retiredPlayers: [player('legend'), second],
      pendingLegacyPlayerIds: ['legend', 'legend', 'second'],
    });
    const beforePayroll = input.clubs[0].weeklyWages;
    const first = resolveNextClubLegendLegacy(input, 'mentor-youth');
    const repeated = resolveNextClubLegendLegacy(input, 'mentor-youth');
    const youth = first.youthPlayer!;

    expect(JSON.stringify(first)).toBe(JSON.stringify(repeated));
    expect(first.state.pendingLegacyPlayerIds).toEqual(['second']);
    expect(first.state.players).toContainEqual(youth);
    expect(first.state.clubs[0].weeklyWages).toBe(beforePayroll + youth.weeklyWage);
    expect(youth).toMatchObject({
      id: 'legacy-youth-s4-legend',
      clubId: USER_CLUB_ID,
      role: 'FWD',
      archetype: 'Sniper',
      licensed: false,
      weeklyWage: 240,
      onHeroWage: false,
      contractSeasonsRemaining: 3,
      potential: 4,
      consistency: 65,
      condition: 100,
      seasonsAtClub: 0,
      fame: 5,
      retirementAnnounced: false,
    });
    expect(youth.age).toBeGreaterThanOrEqual(16);
    expect(youth.age).toBeLessThanOrEqual(17);
    expect(youth.name.endsWith(' Flint')).toBe(true);
    expect(youth.lookId).toMatch(/^f\d+$/);
  });

  it('does not duplicate a youth or charge payroll twice after a partially applied save', () => {
    const initial = state();
    const first = resolveNextClubLegendLegacy(initial, 'mentor-youth');
    const youth = first.youthPlayer!;
    const partial = state({
      players: [youth],
      clubs: first.state.clubs,
      pendingLegacyPlayerIds: ['legend'],
    });
    const retried = resolveNextClubLegendLegacy(partial, 'mentor-youth');

    expect(retried.state.players).toHaveLength(1);
    expect(retried.youthPlayer?.lookId).toBe(youth.lookId);
    expect(retried.state.clubs[0].weeklyWages).toBe(first.state.clubs[0].weeklyWages);
    expect(retried.state.pendingLegacyPlayerIds).toEqual([]);
  });

  it('does not let a mentored legacy youth bypass the user roster cap', () => {
    const fullRoster = Array.from({ length: 16 }, (_, index) => player(`active-${index + 1}`, {
      age: 24,
      retirementAnnounced: false,
      contractSeasonsRemaining: 2,
    }));

    expect(() => resolveNextClubLegendLegacy(
      state({ players: fullRoster }),
      'mentor-youth',
    )).toThrow('16-player roster is full');
  });

  it('requires both a market and an eligible pending legend', () => {
    expect(() => resolveNextClubLegendLegacy(state({ market: undefined }), 'coach-candidate'))
      .toThrow('require a career market');
    expect(() => resolveNextClubLegendLegacy(state({ pendingLegacyPlayerIds: [] }), 'mentor-youth'))
      .toThrow('no eligible pending');
  });
});
