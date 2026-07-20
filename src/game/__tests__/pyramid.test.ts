import type { Attrs } from '../../sim/types';
import {
  advanceNationalCup,
  applyLowMoraleToStat,
  boostLegacyYouthAttributes,
  createLegendLegacy,
  createNationalCup,
  generateLeaguePyramid,
  divisionTierLabel,
  isClubLegend,
  lowMoraleStatModifier,
  opponentStrengthForSeason,
  resolvePromotionAndRelegation,
  resolveSeasonEndLifecycle,
  retirementAnnouncementAge,
  shouldRequestTransfer,
  trainingMultiplierForAge,
  updatePlayerWellbeing,
  type DivisionFinishOrder,
  type NationalCup,
  type NationalCupResult,
  type PyramidPlayer,
  type PlayerPersonality,
} from '../pyramid';

const ATTRS: Attrs = { pac: 60, sho: 60, pas: 60, def: 60, tec: 60, sta: 60, ref: 60 };

function lifecyclePlayer(overrides: Partial<PyramidPlayer> = {}): PyramidPlayer {
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
  return round.fixtures.map(fixture => ({
    fixtureId: fixture.id,
    homeGoals: 1,
    awayGoals: 0,
    winnerClubId: fixture.homeClubId,
  }));
}

describe('five-division pyramid generation', () => {
  it('uses recognizable football tier names and a genuinely elite Global League', () => {
    expect([5, 4, 3, 2, 1].map(level => divisionTierLabel(level as 1 | 2 | 3 | 4 | 5))).toEqual([
      'D5 · District League',
      'D4 · County League',
      'D3 · Regional League',
      'D2 · National Championship',
      'D1 · Global League',
    ]);
    const globalLeagueStrengths = generateLeaguePyramid(88_421).divisions[0].clubs
      .map(club => club.squadStrength);
    expect(Math.min(...globalLeagueStrengths)).toBeGreaterThanOrEqual(84);
    expect(Math.max(...globalLeagueStrengths)).toBeLessThanOrEqual(94);
  });

  it('generates 50 persistent clubs and correctly shaped 16-player squads deterministically', () => {
    const first = generateLeaguePyramid(88421);
    const second = generateLeaguePyramid(88421);
    const clubs = first.divisions.flatMap(division => division.clubs);
    const players = clubs.flatMap(club => club.squad);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.divisions.map(division => division.clubs.length)).toEqual([10, 10, 10, 10, 10]);
    expect(new Set(clubs.map(club => club.id)).size).toBe(50);
    expect(new Set(players.map(player => player.id)).size).toBe(800);
    expect(new Set(clubs.map(club => club.name)).size).toBe(50);
    for (const club of clubs) {
      expect(club.squad).toHaveLength(16);
      expect(club.squad.filter(player => player.role === 'GK')).toHaveLength(2);
      expect(club.squad.filter(player => player.role === 'DEF')).toHaveLength(5);
      expect(club.squad.filter(player => player.role === 'MID')).toHaveLength(5);
      expect(club.squad.filter(player => player.role === 'FWD')).toHaveLength(4);
      expect(club.squad.every(player => player.clubId === club.id)).toBe(true);
    }
  });

  it('creates clearly stronger divisions without allowing a career seed to flatten the ladder', () => {
    for (const seed of [1, 42, 99_999]) {
      const averages = generateLeaguePyramid(seed).divisions.map(division =>
        division.clubs.reduce((sum, club) => sum + club.squadStrength, 0) / division.clubs.length,
      );
      expect(averages[0]).toBeGreaterThan(averages[1]);
      expect(averages[1]).toBeGreaterThan(averages[2]);
      expect(averages[2]).toBeGreaterThan(averages[3]);
      expect(averages[3]).toBeGreaterThan(averages[4]);
      expect(averages[0] - averages[4]).toBeGreaterThanOrEqual(25);
    }
  });
});

describe('promotion and relegation', () => {
  it('swaps top two and bottom two at each boundary while preserving club identity and strength', () => {
    const pyramid = generateLeaguePyramid(123);
    const finishOrders: DivisionFinishOrder[] = pyramid.divisions.map(division => ({
      division: division.level,
      orderedClubIds: division.clubs.map(club => club.id),
    }));
    const before = new Map(pyramid.divisions.flatMap(division =>
      division.clubs.map(club => [club.id, club.squadStrength] as const),
    ));
    const resolved = resolvePromotionAndRelegation(pyramid, finishOrders);

    expect(resolved.movements.filter(movement => movement.kind === 'promoted')).toHaveLength(8);
    expect(resolved.movements.filter(movement => movement.kind === 'relegated')).toHaveLength(8);
    expect(resolved.pyramid.divisions.every(division => division.clubs.length === 10)).toBe(true);
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
    for (const club of resolved.pyramid.divisions.flatMap(division => division.clubs)) {
      expect(club.squadStrength).toBe(before.get(club.id));
    }
  });
});

describe('National Cup', () => {
  it('creates a deterministic 50-club play-in and advances to one champion with stable fixture IDs', () => {
    const clubIds = generateLeaguePyramid(77).divisions.flatMap(division =>
      division.clubs.map(club => club.id),
    );
    let cup = createNationalCup(clubIds, 3, 77);
    expect(JSON.stringify(cup)).toBe(JSON.stringify(createNationalCup([...clubIds].reverse(), 3, 77)));
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
    expect(new Set(cup.rounds.flatMap(round => round.fixtures.map(fixture => fixture.id))).size).toBe(49);
  });

  it('accepts a named penalty winner after a draw and rejects contradictory results', () => {
    const clubIds = generateLeaguePyramid(4).divisions.flatMap(division =>
      division.clubs.map(club => club.id),
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
    expect(advanceNationalCup(cup, results).rounds[0].fixtures[0].winnerClubId)
      .toBe(drawnFixture.awayClubId);

    results[0] = { ...results[0], homeGoals: 2, awayGoals: 0 };
    expect(() => advanceNationalCup(cup, results)).toThrow('contradicts');
  });
});

describe('opponent season scaling', () => {
  it('grows only from division strength and the season clock, gently and with a fixed cap', () => {
    expect([1, 2, 3, 4, 5, 10, 100].map(season => opponentStrengthForSeason(50, season)))
      .toEqual([50, 50, 51, 51, 52, 54, 58]);
  });
});

describe('aging, retirement, and legacy', () => {
  it('uses the documented growth bands and declines only 30+ PAC/STA by one to three', () => {
    expect([16, 23, 24, 29, 30, 40].map(trainingMultiplierForAge))
      .toEqual([1.5, 1.5, 1, 1, 0.6, 0.6]);
    const young = lifecyclePlayer({ id: 'young', age: 23 });
    const prime = lifecyclePlayer({ id: 'prime', age: 29 });
    const veteran = lifecyclePlayer({ id: 'veteran', age: 30 });
    const before = JSON.stringify([young, prime, veteran]);
    const result = resolveSeasonEndLifecycle([young, prime, veteran], 2, 1234);

    expect(result.activePlayers.map(player => player.age)).toEqual([24, 30, 31]);
    expect(result.activePlayers[0].attrs).toEqual(ATTRS);
    expect(result.activePlayers[1].attrs).toEqual(ATTRS);
    expect(ATTRS.pac - result.activePlayers[2].attrs.pac).toBeGreaterThanOrEqual(1);
    expect(ATTRS.pac - result.activePlayers[2].attrs.pac).toBeLessThanOrEqual(3);
    expect(ATTRS.sta - result.activePlayers[2].attrs.sta).toBeGreaterThanOrEqual(1);
    expect(ATTRS.sta - result.activePlayers[2].attrs.sta).toBeLessThanOrEqual(3);
    expect(JSON.stringify([young, prime, veteran])).toBe(before);
  });

  it('assigns stable personality-weighted announcement ages from 33 through 38', () => {
    const personalities: PlayerPersonality[] = [
      'Fiery', 'Loyal', 'Greedy', 'Joker', 'Professional', 'Timid',
    ];
    for (const personality of personalities) {
      const player = lifecyclePlayer({ id: `retire-${personality}`, personality });
      const age = retirementAnnouncementAge(player, 456);
      expect(age).toBeGreaterThanOrEqual(33);
      expect(age).toBeLessThanOrEqual(38);
      expect(retirementAnnouncementAge(player, 456)).toBe(age);
    }
    const earlyAnnouncer = Array.from({ length: 100 }, (_, index) =>
      lifecyclePlayer({ id: `candidate-${index}`, personality: 'Greedy' as const }),
    ).find(player => retirementAnnouncementAge(player, 456) === 33)!;
    const announcing = resolveSeasonEndLifecycle([{ ...earlyAnnouncer, age: 32 }], 5, 456);
    expect(announcing.announcements[0]).toMatchObject({
      playerId: earlyAnnouncer.id,
      announcedInSeason: 5,
      retirementAge: 33,
    });
    const retired = resolveSeasonEndLifecycle(announcing.activePlayers, 6, 456);
    expect(retired.activePlayers).toHaveLength(0);
    expect(retired.retiredPlayers).toHaveLength(1);
  });

  it('offers eligible legends either a discounted coach or a boosted same-archetype youth', () => {
    const legend = lifecyclePlayer({
      id: 'legend-flint',
      fame: 80,
      seasonsAtClub: 7,
      archetype: 'Sniper',
      role: 'FWD',
    });
    expect(isClubLegend(legend)).toBe(true);
    expect(isClubLegend({ fame: 69, seasonsAtClub: 10 })).toBe(false);
    expect(createLegendLegacy(legend, 'coach-candidate', 8, 9)).toEqual({
      choice: 'coach-candidate',
      coachCandidate: {
        id: 'legacy-coach-legend-flint',
        formerPlayerId: 'legend-flint',
        name: 'Ari Flint',
        specialties: ['Attack', 'Technique'],
        loyaltyDiscountPercent: 20,
      },
    });
    const youth = createLegendLegacy(legend, 'mentor-youth', 8, 9);
    expect(youth.choice).toBe('mentor-youth');
    if (youth.choice !== 'mentor-youth') throw new Error('expected youth legacy');
    expect(youth.youth.archetype).toBe(legend.archetype);
    expect(youth.youth.name.endsWith(' Flint')).toBe(true);
    expect(youth.startingStatBoostPercent).toBe(15);
    expect(boostLegacyYouthAttributes({ ...ATTRS, ref: 90 })).toEqual({
      pac: 69, sho: 69, pas: 69, def: 69, tec: 69, sta: 69, ref: 99,
    });
  });
});

describe('morale and condition', () => {
  it('clamps weekly changes, counts sustained low morale, and resets the count on recovery', () => {
    const player = lifecyclePlayer({ morale: 32, condition: 90 });
    const low = updatePlayerWellbeing(player, { moraleDelta: -10, conditionDelta: -100 });
    expect(low).toMatchObject({ morale: 22, condition: 0, consecutiveLowMoraleWeeks: 1 });
    const recovered = updatePlayerWellbeing(low, { moraleDelta: 20, conditionDelta: 150 });
    expect(recovered).toMatchObject({ morale: 42, condition: 100, consecutiveLowMoraleWeeks: 0 });
    expect(player).toMatchObject({ morale: 32, condition: 90, consecutiveLowMoraleWeeks: 0 });
  });

  it('caps low-morale stat loss at 10% and makes transfer requests predictable by personality', () => {
    expect(lowMoraleStatModifier(0)).toBe(0.9);
    expect(lowMoraleStatModifier(30)).toBe(1);
    expect(applyLowMoraleToStat(80, 0)).toBe(72);
    expect(shouldRequestTransfer({
      morale: 28,
      condition: 100,
      personality: 'Greedy',
      consecutiveLowMoraleWeeks: 2,
    })).toBe(true);
    expect(shouldRequestTransfer({
      morale: 12,
      condition: 100,
      personality: 'Loyal',
      consecutiveLowMoraleWeeks: 4,
    })).toBe(false);
  });
});
