import { ballIsBehindAPlayer, type PitchFrame } from '../interpolate';

// One sprite source pixel is `drawScale` pitch units, so at drawScale 20 the
// sprite is 240 wide and reaches 300 above its centre.
const DRAW_SCALE = 20;

function frameWith(
  ball: { x: number; y: number },
  players: Array<{ x: number; y: number }>,
  visible?: boolean[],
): PitchFrame {
  return {
    players,
    ball,
    ballHeight: 0,
    carrier: -1,
    statuses: players.map(() => 'ok'),
    zoneFraction: players.map(() => 0),
    moved: players.map(() => false),
    travel: players.map(() => 0),
    visible: visible ?? players.map(() => true),
    ballShooting: false,
  };
}

describe('ballIsBehindAPlayer', () => {
  it('ghosts the ball when a body is between it and the camera', () => {
    // Player 200 below the ball (larger y = nearer the camera) and level in x.
    const frame = frameWith({ x: 3000, y: 5000 }, [{ x: 3000, y: 5200 }]);

    expect(ballIsBehindAPlayer(frame, DRAW_SCALE)).toBe(true);
  });

  it('leaves the ball solid when the player is behind it', () => {
    // Same gap, other side: he is further from the camera, so he cannot hide it.
    const frame = frameWith({ x: 3000, y: 5000 }, [{ x: 3000, y: 4800 }]);

    expect(ballIsBehindAPlayer(frame, DRAW_SCALE)).toBe(false);
  });

  it('leaves the ball solid when the player is too far below to reach it', () => {
    const frame = frameWith({ x: 3000, y: 5000 }, [{ x: 3000, y: 5400 }]);

    expect(ballIsBehindAPlayer(frame, DRAW_SCALE)).toBe(false);
  });

  it('leaves the ball solid when the player is beside it, not over it', () => {
    const frame = frameWith({ x: 3000, y: 5000 }, [{ x: 3260, y: 5200 }]);

    expect(ballIsBehindAPlayer(frame, DRAW_SCALE)).toBe(false);
  });

  it('never ghosts behind the carrier, whose ball shares his position', () => {
    const frame = frameWith({ x: 3000, y: 5000 }, [{ x: 3000, y: 5000 }]);

    expect(ballIsBehindAPlayer(frame, DRAW_SCALE)).toBe(false);
  });

  it('ignores hidden slots, so an unused Decoy cannot ghost the ball', () => {
    const frame = frameWith(
      { x: 3000, y: 5000 },
      [{ x: 3000, y: 5200 }],
      [false],
    );

    expect(ballIsBehindAPlayer(frame, DRAW_SCALE)).toBe(false);
  });
});

describe('ballIsBehindAPlayer lift', () => {
  // At drawScale 20 the sprite reaches 300 pitch units above its own centre.
  it('leaves a lofted ball solid when the body only covers its shadow', () => {
    // Ground positions say "occluded"; the arc has drawn the ball above him.
    const frame = frameWith({ x: 3000, y: 5000 }, [{ x: 3000, y: 5100 }]);

    expect(ballIsBehindAPlayer(frame, DRAW_SCALE)).toBe(true);
    expect(ballIsBehindAPlayer(frame, DRAW_SCALE, 300)).toBe(false);
  });

  it('still ghosts a low ball the body reaches even after the lift', () => {
    const frame = frameWith({ x: 3000, y: 5000 }, [{ x: 3000, y: 5100 }]);

    expect(ballIsBehindAPlayer(frame, DRAW_SCALE, 100)).toBe(true);
  });
});
