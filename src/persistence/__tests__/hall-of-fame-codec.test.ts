import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game/career';
import type { GameState, HallOfFameRecord } from '../../game/types';
import { InvalidGameStateError } from '../errors';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

/**
 * The record is written once and can never be rebuilt, so a malformed one is
 * not a display bug: it is a career record that is permanently wrong. The codec
 * is where that is caught, and these are the ways it can be wrong.
 */
describe('Hall of Fame persistence', () => {
  test('round-trips a full record unchanged', () => {
    const record = fullRecord();

    const restored = parseStoredGameState(
      serializeGameState(withRecord(baseCareer(), record)),
    );

    expect(restored.hallOfFame).toEqual(record);
  });

  test('round-trips the leanest legal record', () => {
    const record: HallOfFameRecord = {
      season: 1,
      clubName: 'Bramble Rovers',
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      divisionTitles: [],
      cupWinSeasons: [],
      tiers: [],
    };

    const restored = parseStoredGameState(
      serializeGameState(withRecord(baseCareer(), record)),
    );

    expect(restored.hallOfFame).toEqual(record);
    expect(restored.hallOfFame?.topScorer).toBeUndefined();
  });

  test('a career with no record still saves', () => {
    const restored = parseStoredGameState(serializeGameState(baseCareer()));

    expect(restored.hallOfFame).toBeUndefined();
  });

  test('refuses a results line that does not add up', () => {
    const wrong = { ...fullRecord(), won: 30 };

    expect(() => serializeGameState(withRecord(baseCareer(), wrong))).toThrow(
      InvalidGameStateError,
    );
    expect(() => serializeGameState(withRecord(baseCareer(), wrong))).toThrow(
      'hallOfFame',
    );
  });

  test('refuses a negative total', () => {
    const wrong = { ...fullRecord(), goalsAgainst: -1, played: 41, lost: 21 };

    expect(() => serializeGameState(withRecord(baseCareer(), wrong))).toThrow(
      InvalidGameStateError,
    );
  });

  test('refuses a fractional total', () => {
    const wrong = { ...fullRecord(), goalsFor: 12.5 };

    expect(() => serializeGameState(withRecord(baseCareer(), wrong))).toThrow(
      InvalidGameStateError,
    );
  });

  /**
   * A nameless player renders as a raw ID, which is the exact failure a
   * denormalised snapshot exists to prevent.
   */
  test('refuses a top scorer the page could not name', () => {
    const wrong = {
      ...fullRecord(),
      topScorer: { playerId: 'p_a', playerName: '', goals: 40, goldenBoots: 2 },
    };

    expect(() => serializeGameState(withRecord(baseCareer(), wrong))).toThrow(
      InvalidGameStateError,
    );
    expect(() => serializeGameState(withRecord(baseCareer(), wrong))).toThrow(
      'hallOfFame',
    );
  });

  test('refuses a top scorer who never won a Golden Boot', () => {
    const wrong = {
      ...fullRecord(),
      topScorer: {
        playerId: 'p_a',
        playerName: 'Alma Roe',
        goals: 40,
        goldenBoots: 0,
      },
    };

    expect(() => serializeGameState(withRecord(baseCareer(), wrong))).toThrow(
      InvalidGameStateError,
    );
  });

  test('refuses a division outside the pyramid', () => {
    const wrong = {
      ...fullRecord(),
      divisionTitles: [{ season: 2, division: 6 }],
    };

    expect(() => serializeGameState(withRecord(baseCareer(), wrong))).toThrow(
      InvalidGameStateError,
    );
  });

  test('refuses a tier listed twice', () => {
    const wrong = {
      ...fullRecord(),
      tiers: [
        { division: 5, firstSeason: 1, seasons: 2, bestPosition: 3 },
        { division: 5, firstSeason: 3, seasons: 1, bestPosition: 1 },
      ],
    };

    expect(() => serializeGameState(withRecord(baseCareer(), wrong))).toThrow(
      InvalidGameStateError,
    );
    expect(() => serializeGameState(withRecord(baseCareer(), wrong))).toThrow(
      'hallOfFame',
    );
  });

  test('refuses two titles in one season', () => {
    const wrong = {
      ...fullRecord(),
      divisionTitles: [
        { season: 2, division: 5 },
        { season: 2, division: 4 },
      ],
    };

    expect(() => serializeGameState(withRecord(baseCareer(), wrong))).toThrow(
      InvalidGameStateError,
    );
  });

  test('refuses the same Cup won twice', () => {
    const wrong = { ...fullRecord(), cupWinSeasons: [3, 3] };

    expect(() => serializeGameState(withRecord(baseCareer(), wrong))).toThrow(
      InvalidGameStateError,
    );
  });

  /**
   * Cheap proof that a record belongs to the career carrying it: nothing in a
   * snapshot of seasons already played may postdate the save.
   */
  test('refuses a season the career has not played', () => {
    const career = baseCareer();
    const wrong = { ...fullRecord(), cupWinSeasons: [career.season + 1] };

    expect(() => serializeGameState(withRecord(career, wrong))).toThrow(
      InvalidGameStateError,
    );
    expect(() => serializeGameState(withRecord(career, wrong))).toThrow(
      'hallOfFame',
    );
  });
});

/**
 * Season 4, so a record naming several seasons is not in the future. The youth
 * intake is moved with it: the codec requires the open intake to belong to the
 * active season, and a fresh career carries season 1's.
 */
function baseCareer(): GameState {
  const created = createCareer(
    createLaunchCareerSetup(1234, undefined, loadLaunchContent()),
  );
  return {
    ...created,
    season: 4,
    ...(created.youthIntake === undefined
      ? {}
      : { youthIntake: { ...created.youthIntake, season: 4 } }),
  };
}

function fullRecord(): HallOfFameRecord {
  return {
    season: 4,
    clubName: 'Bramble Rovers',
    played: 40,
    won: 22,
    drawn: 8,
    lost: 10,
    goalsFor: 71,
    goalsAgainst: 44,
    divisionTitles: [
      { season: 2, division: 5 },
      { season: 4, division: 4 },
    ],
    cupWinSeasons: [3],
    tiers: [
      { division: 5, firstSeason: 1, seasons: 2, bestPosition: 1 },
      { division: 4, firstSeason: 3, seasons: 2, bestPosition: 1 },
    ],
    topScorer: {
      playerId: 'p_a',
      playerName: 'Alma Roe',
      goals: 40,
      goldenBoots: 2,
    },
    star: {
      playerId: 'p_b',
      playerName: 'Bruno Kell',
      fame: 99,
      seasonsAtClub: 4,
    },
  };
}

function withRecord(state: GameState, hallOfFame: HallOfFameRecord): GameState {
  return { ...state, hallOfFame };
}
