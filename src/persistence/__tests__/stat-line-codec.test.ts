import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game/career';
import type { GameState, PlayerSeasonStatLine } from '../../game/types';
import { InvalidGameStateError } from '../errors';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

describe('season stat line persistence', () => {
  test('round-trips a stat line unchanged', () => {
    const career = baseCareer();
    const line = statLine(career);

    const restored = parseStoredGameState(serializeGameState(withStatLines(career, [line])));

    expect(restored.seasonStatLines).toEqual([line]);
  });

  test('refuses to save a negative count', () => {
    const career = baseCareer();
    const negative = { ...statLine(career), tacklesWon: -1 };

    expect(() => serializeGameState(withStatLines(career, [negative])))
      .toThrow(InvalidGameStateError);
    expect(() => serializeGameState(withStatLines(career, [negative])))
      .toThrow('seasonStatLines');
  });

  test('refuses to save an unknown competition', () => {
    const career = baseCareer();
    // A board reading only 'league' rows would silently drop whatever this is.
    const friendly = {
      ...statLine(career),
      competition: 'friendly' as PlayerSeasonStatLine['competition'],
    };

    expect(() => serializeGameState(withStatLines(career, [friendly])))
      .toThrow(InvalidGameStateError);
    expect(() => serializeGameState(withStatLines(career, [friendly])))
      .toThrow('seasonStatLines');
  });
});

function baseCareer(): GameState {
  return createCareer(createLaunchCareerSetup(1234, undefined, loadLaunchContent()));
}

function statLine(state: GameState): PlayerSeasonStatLine {
  const player = state.players.find(candidate => candidate.clubId === state.userClubId)!;
  return {
    season: state.season,
    playerId: player.id,
    clubId: player.clubId,
    competition: 'league',
    goals: 3,
    assists: 2,
    tacklesWon: 5,
    saves: 0,
    passesCompleted: 41,
  };
}

function withStatLines(state: GameState, lines: PlayerSeasonStatLine[]): GameState {
  return { ...state, seasonStatLines: lines };
}
