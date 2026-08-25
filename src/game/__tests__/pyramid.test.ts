import type { Attrs } from '../../sim/types';
import {
  CLUB_LEGEND_MIN_FAME,
  advanceNationalCup,
  applyLowMoraleToStat,
  createLegendLegacy,
  createNationalCup,
  DIVISION_GOALKEEPER_REF_RATINGS,
  DIVISION_STAR_FOCUS_RATINGS,
  DIVISION_SUPPORT_STRENGTHS,
  DIVISION_STRENGTH_BANDS,
  DIVISION_TYPICAL_PACE,
  divisionStarFocusedAttribute,
  generateLeaguePyramid,
  divisionTierLabel,
  isClubLegend,
  lowMoraleStatModifier,
  resolvePromotionAndRelegation,
  resolveSeasonEndLifecycle,
  retirementAnnouncementAge,
  shouldRequestTransfer,
  shouldWithdrawTransferRequest,
  transferRequestWithdrawalMorale,
  TRANSFER_REQUEST_WITHDRAW_MARGIN,
  trainingMultiplierForAge,
  updatePlayerWellbeing,
  type DivisionFinishOrder,
  type NationalCup,
  type NationalCupResult,
  type PyramidPlayer,
  type PlayerPersonality,
} from '../pyramid';

const ATTRS: Attrs = {
  pac: 60,
  sho: 60,
  pas: 60,
  def: 60,
  tec: 60,
  sta: 60,
  ref: 60,
};

function lifecyclePlayer(
  overrides: Partial<PyramidPlayer> = {},
): PyramidPlayer {
  return {
    id: 'player-1',
    clubId: 'club-1',
    name: 'Ari Flint',
    role: 'MID',
    attrs: { ...ATTRS },
    archetype: 'Playmaker',
    personality: 'Professional',
    age: 25,
    fame: 50,
    seasonsAtClub: 2,
    morale: 50,
    condition: 80,
    consecutiveLowMoraleWeeks: 0,
    ...overrides,
  };
}

function winResults(cup: NationalCup): NationalCupResult[] {
  const round = cup.rounds.at(-1)!;
  return round.fixtures.map((fixture) => ({
    fixtureId: fixture.id,
    homeGoals: 1,
    awayGoals: 0,
    winnerClubId: fixture.homeClubId,
  }));
}

describe('five-division pyramid generation', () => {
  it('uses recognizable football tier names and a genuinely elite Global League', () => {
    expect(
      [5, 4, 3, 2, 1].map((level) =>
        divisionTierLabel(level as 1 | 2 | 3 | 4 | 5),
      ),
    ).toEqual([
      'D5 · District League',
      'D4 · County League',
      'D3 · Regional League',
      'D2 · National League',
      'D1 · Global League',
    ]);
    const globalLeagueStrengths = generateLeaguePyramid(
      88_421,
    ).divisions[0].clubs.map((club) => club.squadStrength);
    expect(Math.min(...globalLeagueStrengths)).toBe(
      DIVISION_STRENGTH_BANDS[1][0],
    );
    expect(Math.max(...globalLeagueStrengths)).toBe(
      DIVISION_STRENGTH_BANDS[1][1],
    );
  });

  it('generates 50 persistent clubs and correctly shaped 16-player squads deterministically', () => {
    const first = generateLeaguePyramid(88421);
    const second = generateLeaguePyramid(88421);
    const clubs = first.divisions.flatMap((division) => division.clubs);
    const players = clubs.flatMap((club) => club.squad);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.divisions.map((division) => division.clubs.length)).toEqual([
      10, 10, 10, 10, 10,
    ]);
    expect(new Set(clubs.map((club) => club.id)).size).toBe(50);
    expect(new Set(players.map((player) => player.id)).size).toBe(800);
    expect(new Set(clubs.map((club) => club.name)).size).toBe(50);
    // Not just whole names: ten different "Rovers" read as one club with
    // variations, so each half of a name is spent once across the pyramid.
    const halves = clubs.map((club) => club.name.split(' '));
    expect(new Set(halves.map(([first]) => first)).size).toBe(50);
    expect(new Set(halves.map(([, second]) => second)).size).toBe(50);
    expect(halves.every((parts) => parts.length === 2)).toBe(true);
    for (const club of clubs) {
      expect(club.squad).toHaveLength(16);
      expect(club.squad.filter((player) => player.role === 'GK')).toHaveLength(
        2,
      );
      expect(club.squad.filter((player) => player.role === 'DEF')).toHaveLength(
        5,
      );
      expect(club.squad.filter((player) => player.role === 'MID')).toHaveLength(
        5,
      );
      expect(club.squad.filter((player) => player.role === 'FWD')).toHaveLength(
        4,
      );
      expect(club.squad.every((player) => player.clubId === club.id)).toBe(
        true,
      );
    }
  });

  it('creates clearly stronger divisions without allowing a career seed to flatten the ladder', () => {
    for (const seed of [1, 42, 99_999]) {
      const averages = generateLeaguePyramid(seed).divisions.map(
        (division) =>
          division.clubs.reduce((sum, club) => sum + club.squadStrength, 0) /
          division.clubs.length,
      );
      expect(averages[0]).toBeGreaterThan(averages[1]);
      expect(averages[1]).toBeGreaterThan(averages[2]);
      expect(averages[2]).toBeGreaterThan(averages[3]);
      expect(averages[3]).toBeGreaterThan(averages[4]);
      expect(averages[0] - averages[4]).toBeGreaterThanOrEqual(25);
    }
  });

  it('fills each locked honest-attribute strength band exactly', () => {
    const pyramid = generateLeaguePyramid(20260722);
    for (const division of pyramid.divisions) {
      const strengths = division.clubs.map((club) => club.squadStrength);
      const [minimum, maximum] = DIVISION_STRENGTH_BANDS[division.level];
      expect(Math.min(...strengths)).toBe(minimum);
      expect(Math.max(...strengths)).toBe(maximum);
      expect(
        strengths.every(
          (strength) => strength >= minimum && strength <= maximum,
        ),
      ).toBe(true);
    }
  });

  it('concentrates later-division growth in three position specialists per club', () => {
    const pyramid = generateLeaguePyramid(20260722);
    const globalLeague = pyramid.divisions.find(
      (division) => division.level === 1,
    )!;
    const districtLeague = pyramid.divisions.find(
      (division) => division.level === 5,
    )!;

    // Rebalanced 2026-07-31: D4 -> D3 and D3 -> D2 are 1.20x, the widest step a
    // promoted club can consolidate in the one season promotion buys. D5 and D1
    // are the fixed endpoints. See DIVISION_STRENGTH_BANDS.
    expect(DIVISION_SUPPORT_STRENGTHS).toEqual({
      1: 103,
      2: 77,
      3: 65,
      4: 54,
      5: 40,
    });
    expect(DIVISION_TYPICAL_PACE).toEqual({
      1: 112,
      2: 102,
      3: 92,
      4: 83,
      5: 72,
    });
    expect(DIVISION_STAR_FOCUS_RATINGS).toEqual({
      1: 212,
      2: 159,
      3: 133,
      4: 111,
      5: 94,
    });
    expect(DIVISION_GOALKEEPER_REF_RATINGS).toEqual({
      1: 180,
      2: 135,
      3: 113,
      4: 94,
      5: 80,
    });
    expect(divisionStarFocusedAttribute(1, 85)).toBe(
      DIVISION_STAR_FOCUS_RATINGS[1],
    );
    // Derived from the star table, not a literal: three specialists carry each
    // club and the other thirteen sit at support level, whatever the ladder's
    // absolute scale happens to be.
    const starFloor = DIVISION_STAR_FOCUS_RATINGS[1] - 10;
    for (const club of globalLeague.clubs) {
      expect(
        club.squad.filter(
          (player) => Math.max(...Object.values(player.attrs)) > starFloor,
        ),
      ).toHaveLength(3);
      expect(
        club.squad.filter(
          (player) => Math.max(...Object.values(player.attrs)) <= starFloor,
        ),
      ).toHaveLength(13);
      expect(
        club.squad.some(
          (player) => player.role === 'FWD' && player.attrs.pac > 99,
        ),
      ).toBe(true);
    }
    const districtMaximum = Math.max(
      ...districtLeague.clubs.flatMap((club) =>
        club.squad.flatMap((player) => Object.values(player.attrs)),
      ),
    );
    const globalMaximum = Math.max(
      ...globalLeague.clubs.flatMap((club) =>
        club.squad.flatMap((player) => Object.values(player.attrs)),
      ),
    );
    expect(districtMaximum).toBeLessThan(DIVISION_STAR_FOCUS_RATINGS[5] + 66);
    expect(globalMaximum).toBeGreaterThan(DIVISION_STAR_FOCUS_RATINGS[1] - 10);
    const medianPace = (club: (typeof globalLeague.clubs)[number]) =>
      club.squad
        .map((player) => player.attrs.pac)
        .sort((left, right) => left - right)[8];
    const globalPace = DIVISION_TYPICAL_PACE[1];
    expect(
      globalLeague.clubs.every(
        (club) =>
          medianPace(club) >= globalPace - 2 &&
          medianPace(club) <= globalPace + 3,
      ),
    ).toBe(true);
    expect(
      districtLeague.clubs.every(
        (club) => medianPace(club) >= 65 && medianPace(club) <= 75,
      ),
    ).toBe(true);
  });
});

describe('promotion and relegation', () => {
  it('swaps top two and bottom two at each boundary while preserving club identity and strength', () => {
    const pyramid = generateLeaguePyramid(123);
    const finishOrders: DivisionFinishOrder[] = pyramid.divisions.map(
      (division) => ({
        division: division.level,
        orderedClubIds: division.clubs.map((club) => club.id),
      }),
    );
    const before = new Map(
      pyramid.divisions.flatMap((division) =>
        division.clubs.map((club) => [club.id, club.squadStrength] as const),
      ),
    );
    const resolved = resolvePromotionAndRelegation(pyramid, finishOrders);

    expect(
      resolved.movements.filter((movement) => movement.kind === 'promoted'),
    ).toHaveLength(8);
    expect(
      resolved.movements.filter((movement) => movement.kind === 'relegated'),
    ).toHaveLength(8);
    expect(
      resolved.pyramid.divisions.every(
        (division) => division.clubs.length === 10,
      ),
    ).toBe(true);
    expect(resolved.movements).toContainEqual({
      clubId: finishOrders[1].orderedClubIds[0],
      fromDivision: 2,
      toDivision: 1,
      kind: 'promoted',
    });
    expect(resolved.movements).toContainEqual({
      clubId: finishOrders[0].orderedClubIds[9],
      fromDivision: 1,
      toDivision: 2,
      kind: 'relegated',
    });
    for (const club of resolved.pyramid.divisions.flatMap(
      (division) => division.clubs,
    )) {
      expect(club.squadStrength).toBe(before.get(club.id));
    }
  });
});

describe('Hero Cup', () => {
  it('creates a deterministic 50-club play-in and advances to one champion with stable fixture IDs', () => {
    const clubIds = generateLeaguePyramid(77).divisions.flatMap((division) =>
      division.clubs.map((club) => club.id),
    );
    let cup = createNationalCup(clubIds, 3, 77);
    expect(JSON.stringify(cup)).toBe(
      JSON.stringify(createNationalCup([...clubIds].reverse(), 3, 77)),
    );
    expect(cup.rounds[0].byeClubIds).toHaveLength(14);
    expect(cup.rounds[0].fixtures).toHaveLength(18);
    expect(cup.rounds[0].fixtures[0].id).toBe('s3-cup-r1-m01');

    const fixtureCounts: number[] = [];
    while (cup.championClubId === undefined) {
      fixtureCounts.push(cup.rounds.at(-1)!.fixtures.length);
      cup = advanceNationalCup(cup, winResults(cup));
    }

    expect(fixtureCounts).toEqual([18, 16, 8, 4, 2, 1]);
    expect(cup.rounds).toHaveLength(6);
    expect(clubIds).toContain(cup.championClubId);
    expect(
      new Set(
        cup.rounds.flatMap((round) =>
          round.fixtures.map((fixture) => fixture.id),
        ),
      ).size,
    ).toBe(49);
  });

  it('caps a surviving D5 club at a D2 opponent in the Round of 32', () => {
    for (let careerSeed = 1; careerSeed <= 100; careerSeed += 1) {
      const pyramid = generateLeaguePyramid(careerSeed);
      const divisionByClubId = Object.fromEntries(
        pyramid.divisions.flatMap((division) =>
          division.clubs.map((club) => [club.id, division.level] as const),
        ),
      );
      const clubIds = Object.keys(divisionByClubId);
      const playIn = createNationalCup(
        clubIds,
        1,
        careerSeed,
        divisionByClubId,
      );
      const roundOf32 = advanceNationalCup(playIn, winResults(playIn))
        .rounds[1];

      const d5Opponents = roundOf32.fixtures.flatMap((fixture) => {
        const homeDivision = divisionByClubId[fixture.homeClubId];
        const awayDivision = divisionByClubId[fixture.awayClubId];
        if (homeDivision === 5) return [awayDivision];
        if (awayDivision === 5) return [homeDivision];
        return [];
      });
      expect(d5Opponents).toEqual(Array(5).fill(2));
    }
  });

  it('gives a D1 or D2 user a D1-D3 opponent through the Round of 16', () => {
    for (const protectedDivision of [1, 2] as const) {
      for (let careerSeed = 1; careerSeed <= 25; careerSeed += 1) {
        const pyramid = generateLeaguePyramid(careerSeed);
        const divisionByClubId = Object.fromEntries(
          pyramid.divisions.flatMap((division) =>
            division.clubs.map((club) => [club.id, division.level] as const),
          ),
        );
        const clubIds = Object.keys(divisionByClubId);
        let cup = createNationalCup(clubIds, 1, careerSeed, divisionByClubId);
        const protectedClubId = cup.rounds[0].byeClubIds.find(
          (clubId) => divisionByClubId[clubId] === protectedDivision,
        )!;
        cup = advanceNationalCup(cup, winResults(cup), protectedClubId);

        for (const roundNumber of [2, 3]) {
          const round = cup.rounds.at(-1)!;
          expect(round.number).toBe(roundNumber);
          expect(new Set(round.entrantClubIds).size).toBe(
            round.entrantClubIds.length,
          );
          expect(
            round.fixtures.every(
              (fixture) =>
                round.entrantClubIds.includes(fixture.homeClubId) &&
                round.entrantClubIds.includes(fixture.awayClubId) &&
                fixture.homeClubId !== fixture.awayClubId,
            ),
          ).toBe(true);

          const fixture = round.fixtures.find(
            (candidate) =>
              candidate.homeClubId === protectedClubId ||
              candidate.awayClubId === protectedClubId,
          )!;
          const opponentId =
            fixture.homeClubId === protectedClubId
              ? fixture.awayClubId
              : fixture.homeClubId;
          expect(divisionByClubId[opponentId]).toBeLessThanOrEqual(3);
          if (roundNumber === 2) {
            expect(
              round.fixtures.some((candidate) => {
                const divisions = [
                  divisionByClubId[candidate.homeClubId],
                  divisionByClubId[candidate.awayClubId],
                ];
                return divisions.includes(1) && divisions.includes(5);
              }),
            ).toBe(false);
          }

          if (roundNumber === 2) {
            const results = round.fixtures.map((candidate) => {
              const winnerClubId =
                candidate.homeClubId === protectedClubId ||
                candidate.awayClubId === protectedClubId
                  ? protectedClubId
                  : divisionByClubId[candidate.homeClubId] <=
                      divisionByClubId[candidate.awayClubId]
                    ? candidate.homeClubId
                    : candidate.awayClubId;
              return {
                fixtureId: candidate.id,
                homeGoals: winnerClubId === candidate.homeClubId ? 1 : 0,
                awayGoals: winnerClubId === candidate.awayClubId ? 1 : 0,
                winnerClubId,
              };
            });
            cup = advanceNationalCup(cup, results, protectedClubId);
          }
        }

        const roundOf16Results = winResults(cup);
        const quarterFinalWithProtection = advanceNationalCup(
          cup,
          roundOf16Results,
          protectedClubId,
        );
        expect(quarterFinalWithProtection).toEqual(
          advanceNationalCup(cup, roundOf16Results),
        );

        let laterCup = quarterFinalWithProtection;
        while (laterCup.rounds.at(-1)!.number < 6) {
          const results = winResults(laterCup);
          expect(
            advanceNationalCup(laterCup, results, protectedClubId),
          ).toEqual(advanceNationalCup(laterCup, results));
          laterCup = advanceNationalCup(laterCup, results, protectedClubId);
        }
      }
    }
  });

  it('does not protect a D3 club', () => {
    const pyramid = generateLeaguePyramid(77);
    const divisionByClubId = Object.fromEntries(
      pyramid.divisions.flatMap((division) =>
        division.clubs.map((club) => [club.id, division.level] as const),
      ),
    );
    const cup = createNationalCup(
      Object.keys(divisionByClubId),
      1,
      77,
      divisionByClubId,
    );
    const protectedClubId = cup.rounds[0].fixtures
      .flatMap((fixture) => [fixture.homeClubId, fixture.awayClubId])
      .find((clubId) => divisionByClubId[clubId] === 3)!;
    const results = winResults(cup).map((result) => {
      const fixture = cup.rounds[0].fixtures.find(
        (candidate) => candidate.id === result.fixtureId,
      )!;
      return fixture.homeClubId === protectedClubId ||
        fixture.awayClubId === protectedClubId
        ? {
            ...result,
            homeGoals: fixture.homeClubId === protectedClubId ? 1 : 0,
            awayGoals: fixture.awayClubId === protectedClubId ? 1 : 0,
            winnerClubId: protectedClubId,
          }
        : result;
    });

    expect(advanceNationalCup(cup, results, protectedClubId)).toEqual(
      advanceNationalCup(cup, results),
    );
  });

  it('accepts a named penalty winner after a draw and rejects contradictory results', () => {
    const clubIds = generateLeaguePyramid(4).divisions.flatMap((division) =>
      division.clubs.map((club) => club.id),
    );
    const cup = createNationalCup(clubIds, 1, 4);
    const results = winResults(cup);
    const drawnFixture = cup.rounds[0].fixtures[0];
    results[0] = {
      fixtureId: drawnFixture.id,
      homeGoals: 1,
      awayGoals: 1,
      winnerClubId: drawnFixture.awayClubId,
    };
    expect(
      advanceNationalCup(cup, results).rounds[0].fixtures[0].winnerClubId,
    ).toBe(drawnFixture.awayClubId);

    results[0] = { ...results[0], homeGoals: 2, awayGoals: 0 };
    expect(() => advanceNationalCup(cup, results)).toThrow('contradicts');
  });
});

describe('aging, retirement, and legacy', () => {
  it('uses the documented growth bands and declines only 30+ PAC/STA by one to three', () => {
    expect([16, 23, 24, 29, 30, 40].map(trainingMultiplierForAge)).toEqual([
      1.1, 1.1, 1, 1, 0.6, 0.6,
    ]);
    const young = lifecyclePlayer({ id: 'young', age: 23 });
    const prime = lifecyclePlayer({ id: 'prime', age: 29 });
    const veteran = lifecyclePlayer({ id: 'veteran', age: 30 });
    const before = JSON.stringify([young, prime, veteran]);
    const result = resolveSeasonEndLifecycle([young, prime, veteran], 2, 1234);

    expect(result.activePlayers.map((player) => player.age)).toEqual([
      24, 30, 31,
    ]);
    expect(result.activePlayers[0].attrs).toEqual(ATTRS);
    expect(result.activePlayers[1].attrs).toEqual(ATTRS);
    expect(
      ATTRS.pac - result.activePlayers[2].attrs.pac,
    ).toBeGreaterThanOrEqual(1);
    expect(ATTRS.pac - result.activePlayers[2].attrs.pac).toBeLessThanOrEqual(
      3,
    );
    expect(
      ATTRS.sta - result.activePlayers[2].attrs.sta,
    ).toBeGreaterThanOrEqual(1);
    expect(ATTRS.sta - result.activePlayers[2].attrs.sta).toBeLessThanOrEqual(
      3,
    );
    expect(JSON.stringify([young, prime, veteran])).toBe(before);
  });

  it('assigns stable personality-weighted announcement ages from 33 through 38', () => {
    const personalities: PlayerPersonality[] = [
      'Fiery',
      'Loyal',
      'Greedy',
      'Joker',
      'Professional',
      'Timid',
    ];
    for (const personality of personalities) {
      const player = lifecyclePlayer({
        id: `retire-${personality}`,
        personality,
      });
      const age = retirementAnnouncementAge(player, 456);
      expect(age).toBeGreaterThanOrEqual(33);
      expect(age).toBeLessThanOrEqual(38);
      expect(retirementAnnouncementAge(player, 456)).toBe(age);
    }
    const earlyAnnouncer = Array.from({ length: 100 }, (_, index) =>
      lifecyclePlayer({
        id: `candidate-${index}`,
        personality: 'Greedy' as const,
      }),
    ).find((player) => retirementAnnouncementAge(player, 456) === 33)!;
    const announcing = resolveSeasonEndLifecycle(
      [{ ...earlyAnnouncer, age: 32 }],
      5,
      456,
    );
    expect(announcing.announcements[0]).toMatchObject({
      playerId: earlyAnnouncer.id,
      announcedInSeason: 5,
      retirementAge: 33,
    });
    const retired = resolveSeasonEndLifecycle(announcing.activePlayers, 6, 456);
    expect(retired.activePlayers).toHaveLength(0);
    expect(retired.retiredPlayers).toHaveLength(1);
  });

  /**
   * One outcome. The mentored youth was removed once it was measured: it needs
   * a seventeenth roster place and the season transition always refills the
   * squad to the sixteen-player cap, so it could never actually be taken.
   */
  it('turns an eligible legend into a discounted coach, and refuses anyone else', () => {
    const legend = lifecyclePlayer({
      id: 'legend-flint',
      fame: 230,
      seasonsAtClub: 7,
      archetype: 'Sniper',
      role: 'FWD',
    });
    expect(isClubLegend(legend)).toBe(true);
    expect(
      isClubLegend({ fame: CLUB_LEGEND_MIN_FAME - 1, seasonsAtClub: 10 }),
    ).toBe(false);
    expect(createLegendLegacy(legend)).toEqual({
      choice: 'coach-candidate',
      coachCandidate: {
        id: 'legacy-coach-legend-flint',
        formerPlayerId: 'legend-flint',
        name: 'Ari Flint',
        specialties: ['Attack', 'Technique'],
        loyaltyDiscountPercent: 20,
      },
    });
    expect(() =>
      createLegendLegacy(
        lifecyclePlayer({ id: 'journeyman', fame: 12, seasonsAtClub: 1 }),
      ),
    ).toThrow('not eligible');
  });
});

describe('morale and condition', () => {
  it('clamps weekly changes, counts sustained low morale, and resets the count on recovery', () => {
    const player = lifecyclePlayer({ morale: 32, condition: 90 });
    const low = updatePlayerWellbeing(player, {
      moraleDelta: -10,
      conditionDelta: -100,
    });
    expect(low).toMatchObject({
      morale: 22,
      condition: 0,
      consecutiveLowMoraleWeeks: 1,
    });
    const recovered = updatePlayerWellbeing(low, {
      moraleDelta: 20,
      conditionDelta: 150,
    });
    expect(recovered).toMatchObject({
      morale: 42,
      condition: 100,
      consecutiveLowMoraleWeeks: 0,
    });
    expect(player).toMatchObject({
      morale: 32,
      condition: 90,
      consecutiveLowMoraleWeeks: 0,
    });
  });

  it('caps low-morale stat loss at 10% and makes transfer requests predictable by personality', () => {
    expect(lowMoraleStatModifier(0)).toBe(0.9);
    expect(lowMoraleStatModifier(30)).toBe(1);
    expect(applyLowMoraleToStat(80, 0)).toBe(72);
    expect(
      shouldRequestTransfer({
        morale: 28,
        condition: 100,
        personality: 'Greedy',
        consecutiveLowMoraleWeeks: 2,
      }),
    ).toBe(true);
    expect(
      shouldRequestTransfer({
        morale: 12,
        condition: 100,
        personality: 'Loyal',
        consecutiveLowMoraleWeeks: 4,
      }),
    ).toBe(false);
  });

  /**
   * Withdrawal must clear the trigger by a margin or the flag chatters: a
   * Greedy player asks at 30 and would take it back on the first win that
   * carried him to 31. The gap is what makes a withdrawal mean something.
   */
  it('withdraws a transfer request only well clear of the personality that raised it', () => {
    const greedy = {
      condition: 100,
      personality: 'Greedy' as const,
      consecutiveLowMoraleWeeks: 0,
    };
    expect(transferRequestWithdrawalMorale('Greedy')).toBe(50);
    expect(transferRequestWithdrawalMorale('Fiery')).toBe(45);
    expect(shouldWithdrawTransferRequest({ ...greedy, morale: 31 })).toBe(
      false,
    );
    expect(
      shouldWithdrawTransferRequest({
        ...greedy,
        morale: 30 + TRANSFER_REQUEST_WITHDRAW_MARGIN - 1,
      }),
    ).toBe(false);
    expect(
      shouldWithdrawTransferRequest({
        ...greedy,
        morale: 30 + TRANSFER_REQUEST_WITHDRAW_MARGIN,
      }),
    ).toBe(true);

    // The same margin off a lower patience line: a Loyal player asks at 12, so
    // he is won back at 32 where the Greedy one still wants out.
    const loyalMorale = 12 + TRANSFER_REQUEST_WITHDRAW_MARGIN;
    expect(
      shouldWithdrawTransferRequest({
        condition: 100,
        personality: 'Loyal',
        consecutiveLowMoraleWeeks: 0,
        morale: loyalMorale,
      }),
    ).toBe(true);
    expect(
      shouldWithdrawTransferRequest({ ...greedy, morale: loyalMorale }),
    ).toBe(false);

    // No streak term: `updatePlayerWellbeing` zeroes the low-morale counter as
    // soon as morale clears 30, so a contented player is judged on morale alone.
    expect(
      shouldWithdrawTransferRequest({
        ...greedy,
        morale: 100,
        consecutiveLowMoraleWeeks: 9,
      }),
    ).toBe(true);
  });
});
