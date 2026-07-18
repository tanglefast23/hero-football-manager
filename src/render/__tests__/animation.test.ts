import {
  KEEPER_READY_DISTANCE,
  RUN_PHASE_DISTANCE,
  SLIDE_TACKLE_TICKS,
  TACKLED_RECOVERY_TICKS,
  actionPose,
  isKeeperReady,
  keeperReadyFrame,
  runFrameForDistance,
  type PlayerActionAnimation,
} from '../animation';

describe('distance-driven locomotion', () => {
  it('changes feet after each fixed distance instead of a fixed tick count', () => {
    expect(runFrameForDistance(0, true)).toBe('run0');
    expect(runFrameForDistance(RUN_PHASE_DISTANCE - 1, true)).toBe('run0');
    expect(runFrameForDistance(RUN_PHASE_DISTANCE, true)).toBe('run1');
    expect(runFrameForDistance(RUN_PHASE_DISTANCE * 2, true)).toBe('run0');
  });

  it('uses the neutral pose whenever the player is stationary', () => {
    expect(runFrameForDistance(RUN_PHASE_DISTANCE * 9, false)).toBe('run0');
  });
});
describe('goalkeeper ready loop', () => {
  it('only activates once the ball is very far away', () => {
    expect(isKeeperReady((KEEPER_READY_DISTANCE - 1) ** 2)).toBe(false);
    expect(isKeeperReady(KEEPER_READY_DISTANCE ** 2)).toBe(true);
  });

  it('loops the two crouched poses', () => {
    expect(keeperReadyFrame(0)).toBe('ready0');
    expect(keeperReadyFrame(5)).toBe('ready1');
    expect(keeperReadyFrame(10)).toBe('ready0');
  });
});

describe('tackle action poses', () => {
  const slide: PlayerActionAnimation = {
    kind: 'slide',
    startTick: 10,
    direction: { x: 1, y: 0 },
    rotation: Math.PI / 2,
  };
  const fall: PlayerActionAnimation = {
    kind: 'fall',
    startTick: 10,
    anchor: { x: 100, y: 200 },
    rotation: -Math.PI / 2,
  };

  it('drops the tackler into a visible slide and returns upright', () => {
    expect(actionPose(slide, 10).active).toBe(true);
    expect(Math.abs(actionPose(slide, 12).rotation)).toBeGreaterThan(1);
    expect(actionPose(slide, 12).forwardOffset).toBeGreaterThan(0);
    expect(actionPose(slide, 10 + SLIDE_TACKLE_TICKS).active).toBe(false);
  });

  it('holds a dispossessed player down, then blends back during recovery', () => {
    expect(actionPose(fall, 12).anchorWeight).toBe(1);
    expect(Math.abs(actionPose(fall, 12).rotation)).toBeGreaterThan(1);
    expect(actionPose(fall, 18).anchorWeight).toBeGreaterThan(0);
    expect(actionPose(fall, 18).anchorWeight).toBeLessThan(1);
    expect(actionPose(fall, 10 + TACKLED_RECOVERY_TICKS).active).toBe(false);
  });
});

describe('knockdown action pose (Super Strength / Fire Torch)', () => {
  // Knocked out at tick 10, recovers at tick 150 (out for 140 ticks, like ignite).
  const kd: PlayerActionAnimation = {
    kind: 'knockdown',
    startTick: 10,
    anchor: { x: 50, y: 60 },
    rotation: Math.PI / 2,
    untilTick: 150,
  };

  it('drops the player prone and holds them flat through the middle of the out window', () => {
    // Just after the hit: already rotating toward the ground.
    expect(actionPose(kd, 12).active).toBe(true);
    expect(Math.abs(actionPose(kd, 12).rotation)).toBeGreaterThan(1);
    // Deep in the middle of a 140-tick knockout: still fully flat and anchored
    // at the spot they fell — NOT recovered (the bug: a burning player standing).
    const mid = actionPose(kd, 80);
    expect(mid.active).toBe(true);
    expect(Math.abs(mid.rotation)).toBeGreaterThan(1.5); // ~PI/2, lying flat
    expect(mid.anchorWeight).toBeGreaterThan(0.9);
  });

  it('rises back toward upright as it approaches the recovery tick', () => {
    const mid = Math.abs(actionPose(kd, 80).rotation);
    const late = Math.abs(actionPose(kd, 149).rotation);
    expect(late).toBeLessThan(mid);
    expect(actionPose(kd, 149).anchorWeight).toBeLessThan(0.9);
  });

  it('is inactive before the hit and once recovered', () => {
    expect(actionPose(kd, 9).active).toBe(false);
    expect(actionPose(kd, 150).active).toBe(false);
    expect(actionPose(kd, 400).active).toBe(false);
  });
});
