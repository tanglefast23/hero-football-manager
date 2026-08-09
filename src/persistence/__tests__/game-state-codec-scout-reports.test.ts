import { createLaunchCareerSetup } from '../../application/launch';
import { careerMarketViewModelSource } from '../../application/market-source-adapter';
import { createCareer } from '../../game/career';
import type { GameState } from '../../game/types';
import type { ScoutReport } from '../../game/market';
import { InvalidGameStateError } from '../errors';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

describe('scout report referential integrity', () => {
  test('round-trips a report that resolves to a pyramid transfer target', () => {
    const state = withScoutReport(
      baseCareer(),
      scoutedPyramidPlayerId(baseCareer()),
    );

    const restored = parseStoredGameState(serializeGameState(state));

    expect(restored.market?.scoutReports).toHaveLength(1);
    expect(restored.market?.scoutReports[0].playerId).toBe(
      state.market?.scoutReports[0].playerId,
    );
  });

  test('refuses to save a report whose scouted player is gone', () => {
    const state = withScoutReport(baseCareer(), 'retired-hero-nobody-has');

    expect(() => serializeGameState(state)).toThrow(InvalidGameStateError);
    expect(() => serializeGameState(state)).toThrow('scoutReports');
  });

  test('refuses to save a report that points at the user club', () => {
    const career = baseCareer();
    const ownPlayer = career.players.find(
      (player) => player.clubId === career.userClubId,
    )!;

    expect(() =>
      serializeGameState(withScoutReport(career, ownPlayer.id)),
    ).toThrow(InvalidGameStateError);
  });

  test('loads a save that already contains a dangling report by dropping it', () => {
    // The shape a save written before the schema required the reference has:
    // legal JSON, unreadable market. Dropping the note keeps the career.
    const state = withScoutReport(
      baseCareer(),
      scoutedPyramidPlayerId(baseCareer()),
    );
    const stored = JSON.parse(JSON.stringify(state)) as {
      market: { scoutReports: ScoutReport[] };
    };
    stored.market.scoutReports[0] = {
      ...stored.market.scoutReports[0],
      playerId: 'retired-hero-nobody-has',
    };

    const restored = parseStoredGameState(JSON.stringify(stored));

    expect(restored.market?.scoutReports).toEqual([]);
    // The Market tab is what used to throw on the dangling reference.
    expect(() => careerMarketViewModelSource(restored)).not.toThrow();
  });

  test('keeps the resolvable reports in a save that mixes both', () => {
    const career = baseCareer();
    const goodId = scoutedPyramidPlayerId(career);
    const state = withScoutReport(career, goodId);
    const stored = JSON.parse(JSON.stringify(state)) as {
      market: { scoutReports: ScoutReport[] };
    };
    stored.market.scoutReports = [
      { ...stored.market.scoutReports[0], playerId: 'retired-hero-nobody-has' },
      stored.market.scoutReports[0],
    ];

    const restored = parseStoredGameState(JSON.stringify(stored));

    expect(
      restored.market?.scoutReports.map((report) => report.playerId),
    ).toEqual([goodId]);
  });
});

function baseCareer(): GameState {
  return createCareer(createLaunchCareerSetup(31415));
}

/** A player from another club in the pyramid, i.e. a legitimate scout target. */
function scoutedPyramidPlayerId(state: GameState): string {
  for (const division of state.m2?.pyramid.divisions ?? []) {
    for (const club of division.clubs) {
      if (club.id === state.userClubId) continue;
      const player = club.squad[0];
      if (player !== undefined) return player.id;
    }
  }
  throw new Error('the test career has no pyramid transfer target');
}

function withScoutReport(state: GameState, playerId: string): GameState {
  const range = { minimum: 40, maximum: 60 };
  const report: ScoutReport = {
    playerId,
    role: 'MID',
    age: 24,
    statRanges: {
      pac: range,
      sho: range,
      pas: range,
      def: range,
      tec: range,
      sta: range,
      ref: range,
    },
    potentialRange: { minimum: 3, maximum: 4 },
  };
  return { ...state, market: { ...state.market!, scoutReports: [report] } };
}
