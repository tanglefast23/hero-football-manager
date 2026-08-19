import {
  livePowerEffectActors,
  superSpeedAfterimageActors,
} from '../live-power-effect-actors';
import { powerEffectDescriptor } from '../power-effect-descriptors';

const base = {
  id: 'effect',
  player: 7,
  width: 500,
  height: 800,
  origin: { x: 240, y: 600 },
  targets: [
    { x: 260, y: 420 },
    { x: 340, y: 360 },
  ],
  direction: -1 as const,
};

describe('live power effect actors', () => {
  it('uses the exact source player for phase afterimages without duplicating the real Decoy', () => {
    const phase = livePowerEffectActors({
      ...base,
      power: 'PHASE_RUN',
      elapsedMs: 2100,
    });
    expect(phase).toHaveLength(3);
    expect(phase.every((actor) => actor.player === 7)).toBe(true);

    const decoy = livePowerEffectActors({
      ...base,
      power: 'DECOY_DOUBLE',
      elapsedMs: 2100,
    });
    // Decoy is a genuine reserved player in the main Atlas. The effect layer
    // supplies comic FX only and must never draw a second fake player body.
    expect(decoy).toEqual([]);
  });

  it('uses the real hero for the Shadow Mark pop-up and giant goalkeeper', () => {
    const shadow = livePowerEffectActors({
      ...base,
      power: 'SHADOW_MARK',
      elapsedMs: powerEffectDescriptor('SHADOW_MARK').beats[2].startMs + 300,
    });
    expect(shadow).toHaveLength(1);
    expect(shadow[0].player).toBe(7);

    const giant = livePowerEffectActors({
      ...base,
      power: 'GIANT_GK',
      elapsedMs: 2000,
    });
    expect(giant).toHaveLength(1);
    expect(giant[0].player).toBe(7);
    expect(giant[0].scale).toBeGreaterThan(1.9);
  });

  it('leaves ordinary moving bodies to the main player atlas', () => {
    for (const power of [
      'BLINK_RUN',
      'FUTURE_SIGHT',
      'SUPER_STRENGTH',
      'ICE_RINK',
      'GRAVITY_WELL',
    ] as const) {
      expect(
        livePowerEffectActors({ ...base, power, elapsedMs: 2100 }),
      ).toEqual([]);
    }
  });

  it('builds speed afterimages from the real movement trail without duplicating the live player', () => {
    const actors = superSpeedAfterimageActors(4, [
      { x: 10, y: 10 },
      { x: 10, y: 20 },
      { x: 10, y: 30 },
      { x: 10, y: 40 },
    ]);
    expect(actors).toHaveLength(3);
    expect(actors[0]).toMatchObject({ player: 4, at: { x: 10, y: 20 } });
    expect(actors.some((actor) => actor.at.y === 10)).toBe(false);
  });

  it('emits the requested number of ghosts and defaults to six', () => {
    // slice(1, 1 + ghosts): index 0 is the live body, so N ghosts needs N + 1
    // stored points. A pass-combo member asks for 3; Super Speed keeps 6.
    const points = Array.from({ length: 7 }, (_, i) => ({ x: i, y: i }));
    expect(superSpeedAfterimageActors(4, points)).toHaveLength(6);
    expect(superSpeedAfterimageActors(4, points, 3)).toHaveLength(3);
    expect(superSpeedAfterimageActors(4, points, 3)[0].at).toEqual({
      x: 1,
      y: 1,
    });
  });
});
