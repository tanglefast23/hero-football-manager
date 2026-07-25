import { possessionTick } from '../engine';
import { createMatch } from '../match';
import { ROVERS, UNITED } from '../teams';

/**
 * Team 0 holds player indices 0-10 and team 1 holds 11-21, so scanning for the
 * first player inside the control radius silently favoured the home side. These
 * lock the recovery rule to distance.
 */
function parkEveryoneOffTheBall(match: ReturnType<typeof createMatch>): void {
  for (const player of match.players) player.pos = { x: 60000, y: 90000 };
}

describe('loose ball recovery', () => {
  it('awards the ball to the nearest player rather than the lowest index', () => {
    const match = createMatch(42, ROVERS, UNITED);
    parkEveryoneOffTheBall(match);
    match.ball = { kind: 'loose', pos: { x: 3000, y: 5000 }, vel: { x: 0, y: 0 }, z: 0, vz: 0 };
    match.players[15].pos = { x: 3000, y: 5000 };
    match.players[4].pos = { x: 3140, y: 5000 };

    possessionTick(match);

    expect(match.ball).toMatchObject({ kind: 'held', by: 15 });
  });

  it('still awards the ball when only a home player is in range', () => {
    const match = createMatch(42, ROVERS, UNITED);
    parkEveryoneOffTheBall(match);
    match.ball = { kind: 'loose', pos: { x: 3000, y: 5000 }, vel: { x: 0, y: 0 }, z: 0, vz: 0 };
    match.players[4].pos = { x: 3140, y: 5000 };

    possessionTick(match);

    expect(match.ball).toMatchObject({ kind: 'held', by: 4 });
  });

  it('leaves the ball loose when every player is outside the control radius', () => {
    const match = createMatch(42, ROVERS, UNITED);
    parkEveryoneOffTheBall(match);
    match.ball = { kind: 'loose', pos: { x: 3000, y: 5000 }, vel: { x: 0, y: 0 }, z: 0, vz: 0 };

    possessionTick(match);

    expect(match.ball.kind).toBe('loose');
  });

  it('breaks an exact tie toward the lower index so recovery stays deterministic', () => {
    const match = createMatch(42, ROVERS, UNITED);
    parkEveryoneOffTheBall(match);
    match.ball = { kind: 'loose', pos: { x: 3000, y: 5000 }, vel: { x: 0, y: 0 }, z: 0, vz: 0 };
    match.players[6].pos = { x: 3050, y: 5000 };
    match.players[17].pos = { x: 2950, y: 5000 };

    possessionTick(match);

    expect(match.ball).toMatchObject({ kind: 'held', by: 6 });
  });
});
