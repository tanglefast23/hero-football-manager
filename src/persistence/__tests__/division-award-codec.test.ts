import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game/career';
import type {
  DivisionAwardPlacement,
  GameState,
  SeasonRecap,
} from '../../game/types';
import { InvalidGameStateError } from '../errors';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

describe('division award snapshot persistence', () => {
  test('round-trips a full podium unchanged', () => {
    const career = baseCareer();
    const recap = recapWithGoals([placing('p_a', 22), placing('p_b', 19), placing('p_c', 19)]);

    const restored = parseStoredGameState(serializeGameState(withRecap(career, recap)));

    expect(restored.seasonRecaps?.[0].divisionAwards).toEqual(recap.divisionAwards);
  });

  test('refuses to save a fourth placing on a podium', () => {
    const career = baseCareer();
    const overfull = recapWithGoals([
      placing('p_a', 22), placing('p_b', 19), placing('p_c', 19), placing('p_d', 19),
    ]);

    expect(() => serializeGameState(withRecap(career, overfull)))
      .toThrow(InvalidGameStateError);
    expect(() => serializeGameState(withRecap(career, overfull)))
      .toThrow('divisionAwards');
  });

  test('refuses to save a placing the ceremony could not label', () => {
    const career = baseCareer();
    // A nameless or clubless placing renders as a raw player ID, which is the
    // exact failure the denormalised snapshot exists to prevent.
    const nameless = recapWithGoals([{ ...placing('p_a', 22), playerName: '' }]);

    expect(() => serializeGameState(withRecap(career, nameless)))
      .toThrow(InvalidGameStateError);
    expect(() => serializeGameState(withRecap(career, nameless)))
      .toThrow('divisionAwards');
  });
});

function baseCareer(): GameState {
  return createCareer(createLaunchCareerSetup(1234, undefined, loadLaunchContent()));
}

function placing(playerId: string, value: number): DivisionAwardPlacement {
  return { playerId, playerName: `${playerId} name`, clubId: 'bramble-rovers', value };
}

function recapWithGoals(goals: DivisionAwardPlacement[]): SeasonRecap {
  return {
    season: 1,
    division: 5,
    finalPosition: 8,
    played: 18,
    won: 4,
    drawn: 4,
    lost: 10,
    goalsFor: 12,
    goalsAgainst: 30,
    cashChange: -1_000,
    closingCash: 9_000,
    trainingCapsReached: 0,
    cupResult: 'Entered',
    divisionAwards: { goals, passesCompleted: [], tacklesWon: [], saves: [] },
  };
}

function withRecap(state: GameState, recap: SeasonRecap): GameState {
  return { ...state, seasonRecaps: [recap] };
}
