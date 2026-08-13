import { createLaunchCareerSetup } from '../launch';
import { createCareer } from '../../game/career';
import {
  applyCareerEventOutcome,
  offerCareerEvent,
} from '../../game/career-events';
import { forcedLineupSwap } from '../store';
import type { GameState } from '../../game/types';

/**
 * The card that explains a story-forced substitution.
 *
 * The engine benches the injured starter on its own. Without this diff the
 * manager would meet a changed eleven with no explanation, which is how the
 * raw `unavailable player <id>` error read to them before: something happened,
 * no idea what.
 */

function launched(): GameState {
  return createCareer(createLaunchCareerSetup());
}

function starters(state: GameState): readonly string[] {
  return state.lineups.find((lineup) => lineup.clubId === state.userClubId)!
    .playerIds;
}

describe('forced lineup swap', () => {
  it('names who went out, who came in, and why', () => {
    const before = launched();
    const outId = starters(before)[7];
    const outName = before.players.find((player) => player.id === outId)!.name;

    const after = applyCareerEventOutcome(
      offerCareerEvent(before, 'test-event'),
      'a-choice',
      'He limped off in training.',
      { playerEffect: { playerId: outId, injuryWeeks: 2 } },
    );

    const swap = forcedLineupSwap(before, after, 'He limped off in training.');

    expect(swap).not.toBeNull();
    expect(swap!.outName).toBe(outName);
    expect(swap!.reason).toBe('He limped off in training.');
    expect(starters(after)).not.toContain(outId);
    // The replacement is a real player of this club, not a leftover id.
    expect(
      after.players.some(
        (player) =>
          player.name === swap!.inName && player.clubId === after.userClubId,
      ),
    ).toBe(true);
  });

  it('returns null when the eleven did not move', () => {
    const before = launched();
    expect(forcedLineupSwap(before, before, 'Nothing happened.')).toBeNull();
  });
});
