import {
  advanceM2NationalCup,
  applyM2PromotionAndRelegation,
  currentUserDivision,
  deterministicM2FinishOrders,
  initializeM2Career,
  planEndlessCareerSeasonTransition,
  quickResolveM2NationalCup,
  resolveNextM2NationalCupRound,
  resolveM2CareerPlayerLifecycle,
  startM2NationalCup,
  synchronizeM2ActiveDivision,
  type M2CareerState,
  type StructuralCareerPlayer,
} from '../m2-career';
import type { DivisionFinishOrder, NationalCupResult } from '../pyramid';

const USER_CLUB = { id: 'my-club', name: 'Caped Ball FC', squadStrength: 46 };

function careerPlayer(overrides: Partial<StructuralCareerPlayer> = {}): StructuralCareerPlayer {
  return {
    id: 'career-player-1',
    clubId: USER_CLUB.id,
    name: 'Bert Rudge',
    role: 'MID',
    attrs: { pac: 60, sho: 60, pas: 60, def: 60, tec: 60, sta: 60, ref: 60 },
    licensed: true,
    weeklyWage: 900,
    onHeroWage: false,
    contractSeasonsRemaining: 2,
    morale: 55,
    injuryWeeks: 1,
    ...overrides,
  };
}

function finishOrders(state: M2CareerState): DivisionFinishOrder[] {
  return state.pyramid.divisions.map(division => ({
    division: division.level,
    orderedClubIds: division.clubs.map(club => club.id),
  }));
}

function homeWins(state: M2CareerState): NationalCupResult[] {
  const cup = state.nationalCups.at(-1)!;
  return cup.rounds.at(-1)!.fixtures.map(fixture => ({
    fixtureId: fixture.id,
    homeGoals: 2,
    awayGoals: 0,
    winnerClubId: fixture.homeClubId,
  }));
}

describe('M2 career initialization', () => {
  it('replaces one generated Division-5 slot with the real user identity and strength', () => {
    const first = initializeM2Career({ careerSeed: 9182, userClub: USER_CLUB });
    const second = initializeM2Career({ careerSeed: 9182, userClub: { ...USER_CLUB } });
    const clubs = first.pyramid.divisions.flatMap(division => division.clubs);
    const userClub = clubs.find(club => club.id === USER_CLUB.id);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.pyramid.divisions.map(division => division.clubs.length)).toEqual([10, 10, 10, 10, 10]);
    expect(clubs).toHaveLength(50);
    expect(new Set(clubs.map(club => club.id)).size).toBe(50);
    expect(userClub).toEqual({ ...USER_CLUB, division: 5, squad: [] });
    expect(currentUserDivision(first)).toBe(5);
    expect(clubs.some(club => club.id === 'd5-club-01')).toBe(false);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it('replaces the generated active tier with the real ten-club match league', () => {
    const initial = initializeM2Career({ careerSeed: 9182, userClub: USER_CLUB });
    const clubs = Array.from({ length: 10 }, (_, index) => ({
      id: index === 0 ? USER_CLUB.id : `real-rival-${index}`,
      name: index === 0 ? USER_CLUB.name : `Real Rival ${index}`,
      cash: 20_000,
      fans: 500,
      ticketPrice: 4,
      sponsorMonthlyFee: 2_000,
      weeklyWages: 3_000,
    }));
    const players = clubs.flatMap(club => Array.from({ length: 11 }, (_, index) => careerPlayer({
      id: `${club.id}-p${index}`,
      clubId: club.id,
    })));
    const synced = synchronizeM2ActiveDivision(initial, { clubs, players });
    const divisionFive = synced.pyramid.divisions.find(division => division.level === 5)!;

    expect(divisionFive.clubs.map(club => club.id)).toEqual(clubs.map(club => club.id));
    expect(divisionFive.clubs.every(club => club.squad.length === 11)).toBe(true);
    expect(synced.pyramid.divisions.flatMap(division => division.clubs)).toHaveLength(50);
  });
});

describe('endless opponent growth', () => {
  it('applies each step once instead of recompounding the full season bonus', () => {
    const initial = initializeM2Career({ careerSeed: 9182, userClub: USER_CLUB });
    const divisionFive = initial.pyramid.divisions.find(division => division.level === 5)!;
    const baseline = new Map(divisionFive.clubs.map(club => [club.id, club.squadStrength]));

    const seasonThree = planEndlessCareerSeasonTransition(initial, 2);
    const afterSeasonThree: M2CareerState = {
      ...initial,
      pyramid: {
        ...initial.pyramid,
        divisions: initial.pyramid.divisions.map(division => division.level === 5
          ? {
              ...division,
              clubs: division.clubs.map(club => (
                seasonThree.generatedOpponentClubs.find(candidate => candidate.id === club.id)
                ?? club
              )),
            }
          : division),
      },
    };
    const seasonFour = planEndlessCareerSeasonTransition(afterSeasonThree, 3);
    const afterSeasonFour: M2CareerState = {
      ...afterSeasonThree,
      pyramid: {
        ...afterSeasonThree.pyramid,
        divisions: afterSeasonThree.pyramid.divisions.map(division => division.level === 5
          ? {
              ...division,
              clubs: division.clubs.map(club => (
                seasonFour.generatedOpponentClubs.find(candidate => candidate.id === club.id)
                ?? club
              )),
            }
          : division),
      },
    };
    const seasonFive = planEndlessCareerSeasonTransition(afterSeasonFour, 4);

    for (const club of seasonThree.generatedOpponentClubs) {
      expect(club.squadStrength).toBe(baseline.get(club.id)! + 1);
    }
    for (const club of seasonFour.generatedOpponentClubs) {
      expect(club.squadStrength).toBe(baseline.get(club.id)! + 1);
    }
    for (const club of seasonFive.generatedOpponentClubs) {
      expect(club.squadStrength).toBe(baseline.get(club.id)! + 2);
    }
  });
});

describe('M2 National Cup integration', () => {
  it('starts with every pyramid club and advances immutably through the bracket', () => {
    const initial = initializeM2Career({ careerSeed: 31, userClub: USER_CLUB });
    const started = startM2NationalCup(initial, 1);
    const before = JSON.stringify(started);
    let advanced = advanceM2NationalCup(started, homeWins(started));

    expect(initial.nationalCups).toEqual([]);
    expect(started.nationalCups[0].rounds[0].entrantClubIds).toContain(USER_CLUB.id);
    expect(started.nationalCups[0].rounds[0].entrantClubIds).toHaveLength(50);
    expect(advanced.nationalCups[0].rounds).toHaveLength(2);
    expect(JSON.stringify(started)).toBe(before);

    while (advanced.nationalCups[0].championClubId === undefined) {
      advanced = advanceM2NationalCup(advanced, homeWins(advanced));
    }
    expect(advanced.nationalCups[0].rounds).toHaveLength(6);
    expect(() => advanceM2NationalCup(advanced, [])).toThrow('no active National Cup');
    expect(startM2NationalCup(advanced, 2).nationalCups).toHaveLength(2);
  });

  it('can deterministically settle the remaining cup from season-level squad strength', () => {
    const started = startM2NationalCup(
      initializeM2Career({ careerSeed: 31, userClub: USER_CLUB }),
      1,
    );
    const first = quickResolveM2NationalCup(started);
    const second = quickResolveM2NationalCup(started);

    expect(first.nationalCups[0].championClubId).toBeDefined();
    expect(first.nationalCups[0].rounds).toHaveLength(6);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('deterministically resolves exactly one current round for weekly progression', () => {
    const started = startM2NationalCup(
      initializeM2Career({ careerSeed: 7631, userClub: USER_CLUB }),
      2,
    );
    const before = JSON.stringify(started);
    const first = resolveNextM2NationalCupRound(started);
    const second = resolveNextM2NationalCupRound(started);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(started)).toBe(before);
    expect(first.nationalCups[0].rounds).toHaveLength(2);
    expect(first.nationalCups[0].rounds[0].fixtures.every(fixture => fixture.status === 'played'))
      .toBe(true);
    expect(first.nationalCups[0].rounds[1].fixtures.every(fixture => fixture.status === 'scheduled'))
      .toBe(true);
    expect(first.nationalCups[0].championClubId).toBeUndefined();

    const secondRound = resolveNextM2NationalCupRound(first);
    expect(secondRound.nationalCups[0].rounds).toHaveLength(3);
    expect(secondRound.nationalCups[0].rounds[1].fixtures.every(fixture => fixture.status === 'played'))
      .toBe(true);
    expect(secondRound.nationalCups[0].rounds[2].fixtures.every(fixture => fixture.status === 'scheduled'))
      .toBe(true);
  });

  it('matches the full quick resolver after six one-round weekly calls', () => {
    const started = startM2NationalCup(
      initializeM2Career({ careerSeed: 904, userClub: USER_CLUB }),
      4,
    );
    let weekly = started;
    for (let round = 1; round <= 6; round += 1) {
      weekly = resolveNextM2NationalCupRound(weekly);
      expect(weekly.nationalCups[0].rounds).toHaveLength(Math.min(6, round + 1));
    }

    expect(weekly.nationalCups[0].championClubId).toBeDefined();
    expect(JSON.stringify(weekly)).toBe(JSON.stringify(quickResolveM2NationalCup(started)));
    expect(() => resolveNextM2NationalCupRound(weekly)).toThrow('no active National Cup');
  });
});

describe('M2 promotion and endless season planning', () => {
  it('promotes the user and plans the next ten-club season with nine scaled generated opponents', () => {
    const initial = initializeM2Career({ careerSeed: 808, userClub: USER_CLUB });
    const orders = finishOrders(initial);
    const divisionFive = orders.find(order => order.division === 5)!;
    divisionFive.orderedClubIds = [
      USER_CLUB.id,
      ...divisionFive.orderedClubIds.filter(id => id !== USER_CLUB.id),
    ];
    const frozen = JSON.stringify(initial);
    const promoted = applyM2PromotionAndRelegation(initial, orders);
    const plan = planEndlessCareerSeasonTransition(promoted.state, 2);

    expect(currentUserDivision(promoted.state)).toBe(4);
    expect(promoted.movements).toContainEqual({
      clubId: USER_CLUB.id,
      fromDivision: 5,
      toDivision: 4,
      kind: 'promoted',
    });
    expect(plan).toMatchObject({ nextSeason: 3, division: 4 });
    expect(plan.activeClubs).toHaveLength(10);
    expect(plan.activeClubIds[0]).toBe(USER_CLUB.id);
    expect(plan.generatedOpponentClubs).toHaveLength(9);
    expect(plan.generatedOpponentPlayers).toHaveLength(144);
    expect(plan.generatedOpponentClubs.every(club => club.squad.length === 16)).toBe(true);
    for (const opponent of plan.generatedOpponentClubs) {
      const unscaled = promoted.state.pyramid.divisions[3].clubs.find(club => club.id === opponent.id)!;
      expect(opponent.squadStrength).toBe(unscaled.squadStrength + 1);
      expect(opponent.squad[0].attrs.pac).toBe(Math.min(99, unscaled.squad[0].attrs.pac + 1));
    }
    const inactiveOpponent = promoted.state.pyramid.divisions[4].clubs
      .find(club => club.id !== USER_CLUB.id)!;
    const advancedInactive = plan.state.pyramid.divisions[4].clubs
      .find(club => club.id === inactiveOpponent.id)!;
    expect(advancedInactive.squadStrength).toBe(inactiveOpponent.squadStrength + 1);
    expect(advancedInactive.squad[0].attrs.pac)
      .toBe(Math.min(99, inactiveOpponent.squad[0].attrs.pac + 1));
    expect(JSON.stringify(initial)).toBe(frozen);
  });

  it('uses the played table for the active tier and deterministic strength order elsewhere', () => {
    const initial = initializeM2Career({ careerSeed: 808, userClub: USER_CLUB });
    const active = initial.pyramid.divisions.find(division => division.level === 5)!;
    const playedOrder = [USER_CLUB.id, ...active.clubs.map(club => club.id).filter(id => id !== USER_CLUB.id)];
    const first = deterministicM2FinishOrders(initial, 1, 5, playedOrder);
    const second = deterministicM2FinishOrders(initial, 1, 5, [...playedOrder]);

    expect(first.find(order => order.division === 5)?.orderedClubIds).toEqual(playedOrder);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe('CareerPlayer lifecycle adapter', () => {
  it('preserves career contracts and hero state while applying deterministic M2 aging', () => {
    const veteran = careerPlayer({
      id: 'veteran',
      age: 30,
      archetype: 'Engine',
      personality: 'Loyal',
      condition: 72,
      seasonsAtClub: 6,
      fame: 78,
      power: 'SUPER_SPEED',
    });
    const schemaOnePlayer = careerPlayer({ id: 'schema-one' });
    const input = [veteran, schemaOnePlayer];
    const before = JSON.stringify(input);
    const first = resolveM2CareerPlayerLifecycle(input, 4, 909);
    const second = resolveM2CareerPlayerLifecycle(input, 4, 909);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(input)).toBe(before);
    expect(first.activePlayers[0]).toMatchObject({
      id: 'veteran',
      age: 31,
      archetype: 'Engine',
      personality: 'Loyal',
      condition: 72,
      seasonsAtClub: 7,
      fame: 78,
      power: 'SUPER_SPEED',
      licensed: true,
      weeklyWage: 900,
      injuryWeeks: 1,
    });
    expect(first.activePlayers[0].attrs.pac).toBeLessThan(veteran.attrs.pac);
    expect(first.activePlayers[0].attrs.sta).toBeLessThan(veteran.attrs.sta);
    expect(first.activePlayers[1]).toMatchObject({
      id: 'schema-one',
      age: 25,
      archetype: 'All-Rounder',
      personality: 'Professional',
      condition: 100,
      seasonsAtClub: 1,
      fame: 0,
    });
  });

  it('carries an announced structural player into retirement after their final season', () => {
    const announced = careerPlayer({
      id: 'announced',
      age: 36,
      retirementAge: 36,
      retirementAnnounced: true,
    }) as StructuralCareerPlayer & { retirementAnnouncementSeason: number };
    announced.retirementAnnouncementSeason = 7;
    const result = resolveM2CareerPlayerLifecycle([announced], 8, 44);

    expect(result.activePlayers).toEqual([]);
    expect(result.retiredPlayers).toHaveLength(1);
    expect(result.retiredPlayers[0]).toMatchObject({
      id: 'announced',
      retirementAnnounced: true,
      retirementAnnouncementSeason: 7,
    });
  });
});

describe('M2 career boundary validation', () => {
  it('rejects invalid user identities, cup overlap, and malformed sidecar identity', () => {
    expect(() => initializeM2Career({
      careerSeed: 1,
      userClub: { ...USER_CLUB, id: 'd1-club-01' },
    })).toThrow('collides');
    expect(() => initializeM2Career({
      careerSeed: 1,
      userClub: { ...USER_CLUB, squadStrength: 0 },
    })).toThrow('1 to 99');
    const started = startM2NationalCup(
      initializeM2Career({ careerSeed: 1, userClub: USER_CLUB }),
      1,
    );
    expect(() => startM2NationalCup(started, 2)).toThrow('must finish');
    expect(() => currentUserDivision({ ...started, userClubId: 'missing' })).toThrow('exactly one');
  });
});
