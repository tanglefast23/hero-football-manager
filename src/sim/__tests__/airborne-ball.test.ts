import {
  advanceFlightHeight,
  attemptShot,
  ballPos,
  BALL_CONTROL_HEIGHT,
  GOALKEEPER_CATCH_HOLD_TICKS,
  LIFTED_SHOT_CHANCE,
  possessionTick,
  shotFlightTick,
  verticalLaunchSpeed,
} from '../engine';
import { GOAL_CENTER_X } from '../geometry';
import { createMatch } from '../match';
import { ROVERS, UNITED } from '../teams';
import type { BallState } from '../types';

describe('deterministic 2.5D ball flight', () => {
  it('solves a goalkeeper clearance arc that lands after twelve ticks', () => {
    const ball = { z: 0, vz: verticalLaunchSpeed(12, 0) };
    let apex = 0;
    for (let tick = 0; tick < 12; tick++) {
      advanceFlightHeight(ball);
      apex = Math.max(apex, ball.z);
    }
    expect(apex).toBeGreaterThan(BALL_CONTROL_HEIGHT);
    expect(ball).toEqual({ z: 0, vz: 0 });
  });

  it('does not let a player control a pass until it descends to the control height', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const target = 2;
    m.ball = {
      kind: 'pass',
      pos: { ...m.players[target].pos },
      from: 1,
      to: target,
      willSucceed: true,
      interceptor: -1,
      z: 200,
      vz: 0,
      speed: 250,
    };

    possessionTick(m);
    expect(m.ball.kind).toBe('pass');
    if (m.ball.kind !== 'pass') throw new Error('airborne pass was controlled too early');
    expect(m.ball.z).toBeGreaterThan(BALL_CONTROL_HEIGHT);

    possessionTick(m);
    expect(m.ball.kind).toBe('pass');
    possessionTick(m);
    expect(m.ball).toEqual({ kind: 'held', by: target });
  });

  it('resolves a save at the keeper plane, holds for 0.6 seconds, then launches a high pass', () => {
    const m = createMatch(7, ROVERS, UNITED);
    const shooter = 9;
    const keeper = 11;
    m.tick = 100;
    m.players[keeper].pos = { x: GOAL_CENTER_X, y: 300 };
    m.players[keeper].def.power = 'ELASTIC_KEEPER';
    m.ball = {
      kind: 'shot',
      pos: { x: GOAL_CENTER_X, y: 600 },
      vel: { x: 0, y: -300 },
      by: shooter,
      shotStrengthD64: 0,
      power: 1,
      targetX: GOAL_CENTER_X,
      z: 0,
      vz: 0,
      trajectory: 'driven',
      keeperChecked: false,
    };
    m.rng = () => 0;

    shotFlightTick(m);
    expect(m.events.at(-1)).toMatchObject({ kind: 'SAVE', by: keeper });
    expect(m.ball).toMatchObject({
      kind: 'held',
      by: keeper,
      caught: true,
      releaseAfterTick: 100 + GOALKEEPER_CATCH_HOLD_TICKS,
    });
    expect(ballPos(m).y).toBe(300);
    expect(ballPos(m).y).toBeGreaterThan(0);
    expect(m.players[keeper].gauge).toBe(30);

    m.tick = 100 + GOALKEEPER_CATCH_HOLD_TICKS - 1;
    possessionTick(m);
    expect(m.ball.kind).toBe('held');

    m.tick++;
    possessionTick(m);
    expect(m.ball).toMatchObject({ kind: 'pass' });
    const distribution = m.ball as unknown as Extract<BallState, { kind: 'pass' }>;
    expect(distribution.vz).toBeGreaterThan(0);
    expect(distribution.speed).toBeGreaterThan(0);
    expect(m.players[keeper].gauge).toBe(35);
  });

  it('awards the defending hero goalkeeper Heat when a shot misses', () => {
    const m = createMatch(7, ROVERS, UNITED);
    const shooter = 9;
    const keeper = 11;
    m.players[keeper].def.power = 'ELASTIC_KEEPER';
    m.ball = {
      kind: 'shot',
      pos: { x: 0, y: 100 },
      vel: { x: 0, y: -300 },
      by: shooter,
      shotStrengthD64: 0,
      power: 1,
      targetX: 0,
      z: 0,
      vz: 0,
      trajectory: 'driven',
      keeperChecked: false,
    };

    shotFlightTick(m);

    expect(m.events).toContainEqual(expect.objectContaining({ kind: 'MISS', by: shooter }));
    expect(m.players[keeper].gauge).toBe(10);
  });

  it('uses the intended 70/30 driven-to-lifted shot mix over a large seeded sample', () => {
    const m = createMatch(99, ROVERS, UNITED);
    let lifted = 0;
    const samples = 1000;
    for (let i = 0; i < samples; i++) {
      attemptShot(m, 9, 2000);
      if (m.ball.kind !== 'shot') throw new Error('shot did not launch');
      if (m.ball.trajectory === 'lifted') lifted++;
    }
    const observed = lifted / samples;
    expect(observed).toBeGreaterThan(LIFTED_SHOT_CHANCE - 0.05);
    expect(observed).toBeLessThan(LIFTED_SHOT_CHANCE + 0.05);
  });
});
