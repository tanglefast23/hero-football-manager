import {
  generateSeasonFixtures,
  leagueWeekForRound,
  pinOpeningLeagueOpponents,
} from '../schedule';

const CLUB_IDS = Array.from({ length: 10 }, (_, index) => `club-${index + 1}`);

describe('generateSeasonFixtures', () => {
  test('creates a complete 10-team double round robin', () => {
    const fixtures = generateSeasonFixtures(CLUB_IDS, 1, 12345);

    expect(fixtures).toHaveLength(90);
    expect(new Set(fixtures.map(fixture => fixture.id)).size).toBe(90);

    for (let round = 1; round <= 18; round += 1) {
      const roundFixtures = fixtures.filter(fixture => fixture.round === round);
      expect(roundFixtures).toHaveLength(5);
      expect(new Set(roundFixtures.flatMap(fixture => [fixture.homeClubId, fixture.awayClubId])).size).toBe(10);
    }
  });

  test('plays every pairing twice with reversed venues', () => {
    const fixtures = generateSeasonFixtures(CLUB_IDS, 1, 12345);
    const meetings = new Map<string, Array<[string, string]>>();

    for (const fixture of fixtures) {
      const key = [fixture.homeClubId, fixture.awayClubId].sort().join('|');
      const pair = meetings.get(key) ?? [];
      pair.push([fixture.homeClubId, fixture.awayClubId]);
      meetings.set(key, pair);
    }

    expect(meetings.size).toBe(45);
    for (const pair of meetings.values()) {
      expect(pair).toHaveLength(2);
      expect(pair[1]).toEqual([pair[0][1], pair[0][0]]);
    }
  });

  test('gives every club nine home and nine away matches', () => {
    const fixtures = generateSeasonFixtures(CLUB_IDS, 1, 12345);

    for (const clubId of CLUB_IDS) {
      expect(fixtures.filter(fixture => fixture.homeClubId === clubId)).toHaveLength(9);
      expect(fixtures.filter(fixture => fixture.awayClubId === clubId)).toHaveLength(9);
    }
  });

  test('spreads league rounds deterministically across weeks 5 through 28', () => {
    const weeks = Array.from({ length: 18 }, (_, index) => leagueWeekForRound(index + 1));

    expect(weeks[0]).toBe(5);
    expect(weeks[17]).toBe(28);
    expect(new Set(weeks).size).toBe(18);
    expect(weeks.every((week, index) => index === 0 || week > weeks[index - 1])).toBe(true);

    const fixtures = generateSeasonFixtures(CLUB_IDS, 1, 12345);
    for (const fixture of fixtures) {
      expect(fixture.week).toBe(weeks[fixture.round - 1]);
    }
  });

  test('is byte-identical for the same inputs and emits uint32 match seeds', () => {
    const first = generateSeasonFixtures(CLUB_IDS, 2, 987654321);
    const second = generateSeasonFixtures(CLUB_IDS, 2, 987654321);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    for (const fixture of first) {
      expect(Number.isInteger(fixture.matchSeed)).toBe(true);
      expect(fixture.matchSeed).toBeGreaterThanOrEqual(0);
      expect(fixture.matchSeed).toBeLessThan(4294967296);
      expect(fixture.status).toBe('scheduled');
      expect(fixture.season).toBe(2);
    }
  });

  test('changes fixture seeds when the career seed or season changes', () => {
    const base = generateSeasonFixtures(CLUB_IDS, 1, 100).map(fixture => fixture.matchSeed);
    const otherCareer = generateSeasonFixtures(CLUB_IDS, 1, 101).map(fixture => fixture.matchSeed);
    const otherSeason = generateSeasonFixtures(CLUB_IDS, 2, 100).map(fixture => fixture.matchSeed);

    expect(otherCareer).not.toEqual(base);
    expect(otherSeason).not.toEqual(base);
  });

  test('pins a venue-aware first-five curve without the weak-then-hard rebound', () => {
    const strengths = new Map(CLUB_IDS.map((clubId, index) => [clubId, 40 + index]));
    const ordered = pinOpeningLeagueOpponents(CLUB_IDS, CLUB_IDS[0], strengths);
    const fixtures = generateSeasonFixtures(ordered, 1, 12345);
    const opening = [1, 2, 3, 4, 5].map(round => {
      const fixture = fixtures.find(candidate => candidate.round === round && (
        candidate.homeClubId === CLUB_IDS[0] || candidate.awayClubId === CLUB_IDS[0]
      ))!;
      const userIsHome = fixture.homeClubId === CLUB_IDS[0];
      const opponentId = userIsHome ? fixture.awayClubId : fixture.homeClubId;
      return { strength: strengths.get(opponentId), userIsHome };
    });

    expect(opening).toEqual([
      { strength: 49, userIsHome: true },
      { strength: 44, userIsHome: false },
      { strength: 45, userIsHome: true },
      { strength: 42, userIsHome: false },
      { strength: 41, userIsHome: true },
    ]);
  });

  test('rejects malformed schedule inputs', () => {
    expect(() => generateSeasonFixtures(CLUB_IDS.slice(0, 9), 1, 1)).toThrow('exactly 10 clubs');
    expect(() => generateSeasonFixtures([...CLUB_IDS.slice(0, 9), CLUB_IDS[0]], 1, 1)).toThrow('unique');
    expect(() => generateSeasonFixtures([...CLUB_IDS.slice(0, 9), '  '], 1, 1)).toThrow('non-empty');
    expect(() => generateSeasonFixtures(CLUB_IDS, 0, 1)).toThrow('positive integer');
    expect(() => generateSeasonFixtures(CLUB_IDS, 1.5, 1)).toThrow('positive integer');
    expect(() => generateSeasonFixtures(CLUB_IDS, 1, Number.NaN)).toThrow('safe integer');
    expect(() => leagueWeekForRound(0)).toThrow('1 to 18');
    expect(() => leagueWeekForRound(19)).toThrow('1 to 18');
    expect(() => leagueWeekForRound(1.5)).toThrow('1 to 18');
  });
});
