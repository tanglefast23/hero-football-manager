import {
  advanceM2NationalCup,
  applyM2PromotionAndRelegation,
  clubSquadStrength,
  currentUserDivision,
  deterministicCupTieWinner,
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
import { difficultyRules } from '../difficulty';
import type { NationalCupResult } from '../pyramid';
import { DIVISION_STRENGTH_BANDS } from '../pyramid';
import { roleOverall } from '../archetype-caps';

const USER_CLUB = { id: 'my-club', name: 'Caped Ball FC', squadStrength: 46 };

function careerPlayer(
  overrides: Partial<StructuralCareerPlayer> = {},
): StructuralCareerPlayer {
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

function homeWins(state: M2CareerState): NationalCupResult[] {
  const cup = state.nationalCups.at(-1)!;
  return cup.rounds.at(-1)!.fixtures.map((fixture) => ({
    fixtureId: fixture.id,
    homeGoals: 2,
    awayGoals: 0,
    winnerClubId: fixture.homeClubId,
  }));
}

describe('M2 career initialization', () => {
  it('uses the same six role-aware attributes as the player current rating', () => {
    expect(
      clubSquadStrength([
        {
          role: 'FWD',
          attrs: {
            pac: 60,
            sho: 60,
            pas: 60,
            def: 60,
            tec: 60,
            sta: 60,
            ref: 1,
          },
        },
        {
          role: 'GK',
          attrs: {
            pac: 90,
            sho: 1,
            pas: 60,
            def: 60,
            tec: 90,
            sta: 90,
            ref: 60,
          },
        },
      ]),
    ).toBe(68);
  });

  it('replaces one generated Division-5 slot with the real user identity and strength', () => {
    const first = initializeM2Career({ careerSeed: 9182, userClub: USER_CLUB });
    const second = initializeM2Career({
      careerSeed: 9182,
      userClub: { ...USER_CLUB },
    });
    const clubs = first.pyramid.divisions.flatMap((division) => division.clubs);
    const userClub = clubs.find((club) => club.id === USER_CLUB.id);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(
      first.pyramid.divisions.map((division) => division.clubs.length),
    ).toEqual([10, 10, 10, 10, 10]);
    expect(clubs).toHaveLength(50);
    expect(new Set(clubs.map((club) => club.id)).size).toBe(50);
    expect(userClub).toEqual({ ...USER_CLUB, division: 5, squad: [] });
    expect(currentUserDivision(first)).toBe(5);
    expect(clubs.some((club) => club.id === 'd5-club-01')).toBe(false);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it('replaces the generated active tier with the real ten-club match league', () => {
    const initial = initializeM2Career({
      careerSeed: 9182,
      userClub: USER_CLUB,
    });
    const clubs = Array.from({ length: 10 }, (_, index) => ({
      id: index === 0 ? USER_CLUB.id : `real-rival-${index}`,
      name: index === 0 ? USER_CLUB.name : `Real Rival ${index}`,
      cash: 20_000,
      fans: 500,
      ticketPrice: 4,
      sponsorMonthlyFee: 2_000,
      weeklyWages: 3_000,
    }));
    const players = clubs.flatMap((club) =>
      Array.from({ length: 11 }, (_, index) =>
        careerPlayer({
          id: `${club.id}-p${index}`,
          clubId: club.id,
        }),
      ),
    );
    const synced = synchronizeM2ActiveDivision(initial, { clubs, players });
    const divisionFive = synced.pyramid.divisions.find(
      (division) => division.level === 5,
    )!;

    expect(divisionFive.clubs.map((club) => club.id)).toEqual(
      clubs.map((club) => club.id),
    );
    expect(divisionFive.clubs.every((club) => club.squad.length === 11)).toBe(
      true,
    );
    expect(
      synced.pyramid.divisions.flatMap((division) => division.clubs),
    ).toHaveLength(50);
  });
});

describe('endless opponent growth', () => {
  it('applies one deterministic 3% step to all attributes exactly once per season', () => {
    const initial = initializeM2Career({
      careerSeed: 9182,
      userClub: USER_CLUB,
    });
    const divisionFive = initial.pyramid.divisions.find(
      (division) => division.level === 5,
    )!;
    const baselineClub = divisionFive.clubs.find(
      (club) => club.id !== USER_CLUB.id,
    )!;
    const baselinePlayer = baselineClub.squad[0];
    const seasonThree = planEndlessCareerSeasonTransition(initial, 2);
    const seasonFour = planEndlessCareerSeasonTransition(seasonThree.state, 3);
    const grownPlayer = seasonThree.state.pyramid.divisions[4].clubs.find(
      (club) => club.id === baselineClub.id,
    )!.squad[0];

    for (const attribute of [
      'pac',
      'sho',
      'pas',
      'def',
      'tec',
      'sta',
      'ref',
    ] as const) {
      const scaled = baselinePlayer.attrs[attribute] * 1.03;
      expect([Math.floor(scaled), Math.ceil(scaled)]).toContain(
        grownPlayer.attrs[attribute],
      );
    }
    expect(seasonThree.state.opponentGrowthThroughSeason).toBe(3);
    expect(seasonFour.state.opponentGrowthThroughSeason).toBe(4);
    expect(
      JSON.stringify(
        planEndlessCareerSeasonTransition(seasonThree.state, 2).state,
      ),
    ).toBe(JSON.stringify(seasonThree.state));
  });

  it('lets Chairman apply the faster percentage and higher ceiling', () => {
    const initial = initializeM2Career({
      careerSeed: 9182,
      userClub: USER_CLUB,
    });
    const cozy = planEndlessCareerSeasonTransition(
      initial,
      1,
      difficultyRules({ difficulty: 'COZY' }),
    );
    const chairman = planEndlessCareerSeasonTransition(
      initial,
      1,
      difficultyRules({ difficulty: 'CHAIRMAN' }),
    );
    const total = (plan: typeof cozy) =>
      plan.generatedOpponentPlayers.reduce(
        (sum, player) =>
          sum +
          Object.values(player.attrs).reduce(
            (inner, value) => inner + value,
            0,
          ),
        0,
      );
    expect(total(chairman)).toBeGreaterThan(total(cozy));
  });

  it('defaults to the Cozy curve when no difficulty is supplied', () => {
    const initial = initializeM2Career({
      careerSeed: 9182,
      userClub: USER_CLUB,
    });
    const implicit = planEndlessCareerSeasonTransition(initial, 2);
    const explicit = planEndlessCareerSeasonTransition(
      initial,
      2,
      difficultyRules({ difficulty: 'COZY' }),
    );
    expect(
      implicit.generatedOpponentClubs.map((club) => club.squadStrength),
    ).toEqual(
      explicit.generatedOpponentClubs.map((club) => club.squadStrength),
    );
  });

  it('keeps 15-season Cozy rivals below 999 with star/support ratio drift at or below 2%', () => {
    const initial = initializeM2Career({
      careerSeed: 9182,
      userClub: USER_CLUB,
    });
    let grown = initial;
    for (let completedSeason = 1; completedSeason <= 15; completedSeason += 1) {
      grown = planEndlessCareerSeasonTransition(grown, completedSeason).state;
    }
    const initialClubs = initial.pyramid.divisions
      .flatMap((division) => division.clubs)
      .filter((club) => club.id !== USER_CLUB.id);
    const grownById = new Map(
      grown.pyramid.divisions
        .flatMap((division) => division.clubs)
        .map((club) => [club.id, club]),
    );
    let maximumAttribute = 0;
    let maximumRatioDrift = 0;

    for (const club of initialClubs) {
      const advanced = grownById.get(club.id);
      expect(advanced).toBeDefined();
      const beforeRatio = generatedStarSupportRatio(club.squad);
      const afterRatio = generatedStarSupportRatio(advanced!.squad);
      maximumRatioDrift = Math.max(
        maximumRatioDrift,
        Math.abs(afterRatio / beforeRatio - 1),
      );
      maximumAttribute = Math.max(
        maximumAttribute,
        ...advanced!.squad.flatMap((player) => Object.values(player.attrs)),
      );
    }

    expect(maximumAttribute).toBeLessThanOrEqual(700);
    expect(maximumAttribute).toBeLessThan(999);
    expect(maximumRatioDrift).toBeLessThanOrEqual(0.02);
  });
});

function generatedStarSupportRatio(
  squad: M2CareerState['pyramid']['divisions'][number]['clubs'][number]['squad'],
): number {
  const starSlots = new Set([2, 7, 12]);
  const stars = squad
    .filter((_player, index) => starSlots.has(index))
    .map((player) => roleOverall(player.role, player.attrs));
  const support = squad
    .filter((_player, index) => !starSlots.has(index))
    .map((player) => roleOverall(player.role, player.attrs));
  return (
    stars.reduce((sum, value) => sum + value, 0) /
    stars.length /
    (support.reduce((sum, value) => sum + value, 0) / support.length)
  );
}

describe('M2 Hero Cup integration', () => {
  it('keeps same-division ties familiar while enabling rare giant-killings', () => {
    const club = (id: string, strength: number) => ({
      id,
      name: id,
      division: 5 as const,
      squadStrength: strength,
      squad: [],
    });
    const rate = (weakerStrength: number, strongerStrength: number) => {
      let weakerWins = 0;
      const samples = 20_000;
      for (let index = 0; index < samples; index += 1) {
        const weaker = club(`weaker-${index}`, weakerStrength);
        const stronger = club(`stronger-${index}`, strongerStrength);
        if (
          deterministicCupTieWinner(
            (4_000_000 + index * 7_919) >>> 0,
            1 + (index % 15),
            1 + (index % 6),
            weaker,
            stronger,
          ) === weaker.id
        ) {
          weakerWins += 1;
        }
      }
      return weakerWins / samples;
    };

    const sameDivision = rate(45, 46);
    const oneDivisionDown = rate(45, 96);
    const twoDivisionsDown = rate(45, 143);
    expect(Math.abs(sameDivision - 0.36)).toBeLessThanOrEqual(0.02);
    expect(oneDivisionDown).toBeGreaterThanOrEqual(0.05);
    expect(oneDivisionDown).toBeLessThanOrEqual(0.1);
    expect(twoDivisionsDown).toBeGreaterThanOrEqual(0.01);
    expect(twoDivisionsDown).toBeLessThanOrEqual(0.02);
  });

  it('starts with every pyramid club and advances immutably through the bracket', () => {
    const initial = initializeM2Career({ careerSeed: 31, userClub: USER_CLUB });
    const started = startM2NationalCup(initial, 1);
    const before = JSON.stringify(started);
    let advanced = advanceM2NationalCup(started, homeWins(started));

    expect(initial.nationalCups).toEqual([]);
    expect(started.nationalCups[0].rounds[0].entrantClubIds).toContain(
      USER_CLUB.id,
    );
    expect(started.nationalCups[0].rounds[0].entrantClubIds).toHaveLength(50);
    const seededCup = started.nationalCups[0];
    const divisionByClubId = seededCup.seedDivisionByClubId!;
    expect(
      seededCup.rounds[0].byeClubIds
        .map((clubId) => divisionByClubId[clubId])
        .sort(),
    ).toEqual([...Array(10).fill(1), ...Array(4).fill(2)]);
    expect(seededCup.rounds[0].byeClubIds).not.toContain(USER_CLUB.id);
    for (const fixture of seededCup.rounds[0].fixtures) {
      const divisions = [
        divisionByClubId[fixture.homeClubId],
        divisionByClubId[fixture.awayClubId],
      ];
      expect(
        Math.max(...divisions) - Math.min(...divisions),
      ).toBeLessThanOrEqual(1);
    }
    expect(advanced.nationalCups[0].rounds).toHaveLength(2);
    expect(JSON.stringify(started)).toBe(before);

    while (advanced.nationalCups[0].championClubId === undefined) {
      advanced = advanceM2NationalCup(advanced, homeWins(advanced));
    }
    expect(advanced.nationalCups[0].rounds).toHaveLength(6);
    expect(() => advanceM2NationalCup(advanced, [])).toThrow(
      'no active Hero Cup',
    );
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
    expect(
      first.nationalCups[0].rounds[0].fixtures.every(
        (fixture) => fixture.status === 'played',
      ),
    ).toBe(true);
    expect(
      first.nationalCups[0].rounds[1].fixtures.every(
        (fixture) => fixture.status === 'scheduled',
      ),
    ).toBe(true);
    expect(first.nationalCups[0].championClubId).toBeUndefined();

    const secondRound = resolveNextM2NationalCupRound(first);
    expect(secondRound.nationalCups[0].rounds).toHaveLength(3);
    expect(
      secondRound.nationalCups[0].rounds[1].fixtures.every(
        (fixture) => fixture.status === 'played',
      ),
    ).toBe(true);
    expect(
      secondRound.nationalCups[0].rounds[2].fixtures.every(
        (fixture) => fixture.status === 'scheduled',
      ),
    ).toBe(true);
  });

  it('matches the full quick resolver after six one-round weekly calls', () => {
    const started = startM2NationalCup(
      initializeM2Career({ careerSeed: 904, userClub: USER_CLUB }),
      4,
    );
    let weekly = started;
    for (let round = 1; round <= 6; round += 1) {
      weekly = resolveNextM2NationalCupRound(weekly);
      expect(weekly.nationalCups[0].rounds).toHaveLength(
        Math.min(6, round + 1),
      );
    }

    expect(weekly.nationalCups[0].championClubId).toBeDefined();
    expect(JSON.stringify(weekly)).toBe(
      JSON.stringify(quickResolveM2NationalCup(started)),
    );
    expect(() => resolveNextM2NationalCupRound(weekly)).toThrow(
      'no active Hero Cup',
    );
  });
});

describe('M2 promotion and endless season planning', () => {
  it('promotes the user and plans the next ten-club season with nine scaled generated opponents', () => {
    const initial = initializeM2Career({
      careerSeed: 808,
      userClub: USER_CLUB,
    });
    const divisionFive = initial.pyramid.divisions.find(
      (division) => division.level === 5,
    )!;
    const playedOrder = [
      USER_CLUB.id,
      ...divisionFive.clubs
        .map((club) => club.id)
        .filter((id) => id !== USER_CLUB.id),
    ];
    const orders = deterministicM2FinishOrders(initial, 2, 5, playedOrder);
    const frozen = JSON.stringify(initial);
    const promoted = applyM2PromotionAndRelegation(initial, orders);
    const plan = planEndlessCareerSeasonTransition(promoted.state, 1);

    expect(currentUserDivision(promoted.state)).toBe(4);
    expect(promoted.movements).toContainEqual({
      clubId: USER_CLUB.id,
      fromDivision: 5,
      toDivision: 4,
      kind: 'promoted',
    });
    expect(plan).toMatchObject({ nextSeason: 2, division: 4 });
    expect(plan.activeClubs).toHaveLength(10);
    expect(plan.activeClubIds[0]).toBe(USER_CLUB.id);
    expect(plan.generatedOpponentClubs).toHaveLength(9);
    expect(plan.generatedOpponentPlayers).toHaveLength(144);
    expect(
      plan.generatedOpponentClubs.every((club) => club.squad.length === 16),
    ).toBe(true);
    // Every D4 opponent is now an ordinary band club. The two-club relegation
    // pack was removed on 2026-07-31: it was sized for a band the promoted club
    // arrived 45 points below, and against the current one it was two free wins.
    for (const opponent of plan.generatedOpponentClubs) {
      const unscaled = promoted.state.pyramid.divisions[3].clubs.find(
        (club) => club.id === opponent.id,
      )!;
      expect(opponent.squadStrength).toBeGreaterThan(unscaled.squadStrength);
      expect(opponent.squad[0].attrs.pac).toBeGreaterThanOrEqual(
        Math.floor(unscaled.squad[0].attrs.pac * 1.03),
      );
    }
    // Derived from the band rather than pinned as literals, so rebalancing the
    // ladder cannot leave these silently describing a division that moved.
    const [d4Floor, d4Ceiling] = DIVISION_STRENGTH_BANDS[4];
    const ranked = plan.generatedOpponentClubs
      .map((club) => club.squadStrength)
      .sort((left, right) => left - right);
    // The weakest side is the club promoted alongside the user, which carries
    // its D5 strength up rather than being retuned, so read the median for the
    // division's own level and only require the floor to clear D5's.
    expect(ranked[Math.floor(ranked.length / 2)]).toBeGreaterThanOrEqual(
      d4Floor,
    );
    expect(ranked[0]).toBeGreaterThanOrEqual(DIVISION_STRENGTH_BANDS[5][0]);
    expect(
      Math.max(
        ...plan.generatedOpponentClubs.map((club) => club.squadStrength),
      ),
    ).toBeGreaterThanOrEqual(d4Ceiling - 2);
    expect(
      Math.max(
        ...plan.generatedOpponentClubs.map((club) => club.squadStrength),
      ),
    ).toBeLessThanOrEqual(Math.round(d4Ceiling * 1.52));
    const inactiveOpponent = promoted.state.pyramid.divisions[4].clubs.find(
      (club) => club.id !== USER_CLUB.id,
    )!;
    const advancedInactive = plan.state.pyramid.divisions[4].clubs.find(
      (club) => club.id === inactiveOpponent.id,
    )!;
    expect(advancedInactive.squadStrength).toBeGreaterThan(
      inactiveOpponent.squadStrength,
    );
    expect(advancedInactive.squad[0].attrs.pac).toBeGreaterThan(
      inactiveOpponent.squad[0].attrs.pac,
    );
    expect(JSON.stringify(initial)).toBe(frozen);
  });

  it('uses the played table for the active tier and deterministic strength order elsewhere', () => {
    const initial = initializeM2Career({
      careerSeed: 808,
      userClub: USER_CLUB,
    });
    const active = initial.pyramid.divisions.find(
      (division) => division.level === 5,
    )!;
    const playedOrder = [
      USER_CLUB.id,
      ...active.clubs
        .map((club) => club.id)
        .filter((id) => id !== USER_CLUB.id),
    ];
    const first = deterministicM2FinishOrders(initial, 1, 5, playedOrder);
    const second = deterministicM2FinishOrders(initial, 1, 5, [...playedOrder]);

    expect(first.find((order) => order.division === 5)?.orderedClubIds).toEqual(
      playedOrder,
    );
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
    expect(() =>
      initializeM2Career({
        careerSeed: 1,
        userClub: { ...USER_CLUB, id: 'd1-club-01' },
      }),
    ).toThrow('collides');
    expect(() =>
      initializeM2Career({
        careerSeed: 1,
        userClub: { ...USER_CLUB, squadStrength: 0 },
      }),
    ).toThrow('1 to 99');
    const started = startM2NationalCup(
      initializeM2Career({ careerSeed: 1, userClub: USER_CLUB }),
      1,
    );
    expect(() => startM2NationalCup(started, 2)).toThrow('must finish');
    expect(() =>
      currentUserDivision({ ...started, userClubId: 'missing' }),
    ).toThrow('exactly one');
  });
});
