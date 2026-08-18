import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PITCH_H, PITCH_W, TICK_MS } from '../../sim/geometry';
import {
  BODY_UNITS,
  EXIT_CLEARANCE,
  MAX_WALK_TICKS,
  MIN_WALK_TICKS,
  WALKER_SLOTS,
  WALKER_STRIDE,
  WALK_ON,
  WALK_STATE,
  clampWalkY,
  distanceBetween,
  hiddenSlots,
  packWalks,
  sampleWalk,
  touchlineExitX,
  walkDurationTicks,
  walkEndpoints,
  walkIsActive,
  walkRunFrame,
  walkerSpriteKeys,
  type SubstitutionWalk,
} from '../substitution-walk';

function walk(
  overrides: Partial<SubstitutionWalk> & Pick<SubstitutionWalk, 'direction'>,
): SubstitutionWalk {
  return {
    id: `walk:${overrides.direction}`,
    slot: 3,
    visualId: 'r:field-1',
    name: 'Rossi',
    from: { x: 3000, y: 5000 },
    to: { x: 0, y: 5000 },
    startTick: 100,
    durationTicks: 10,
    ...overrides,
  };
}

describe('touchlineExitX', () => {
  it('picks the nearer touchline from either half', () => {
    expect(touchlineExitX(400)).toBe(-EXIT_CLEARANCE);
    expect(touchlineExitX(PITCH_W - 400)).toBe(PITCH_W + EXIT_CLEARANCE);
  });

  it('clears the canvas, so nobody is parked half on the line', () => {
    expect(touchlineExitX(400)).toBeLessThanOrEqual(-BODY_UNITS / 2);
    expect(touchlineExitX(PITCH_W - 400)).toBeGreaterThanOrEqual(
      PITCH_W + BODY_UNITS / 2,
    );
  });

  it('sends the exact centre to the right-hand line rather than nowhere', () => {
    expect(touchlineExitX(PITCH_W / 2)).toBe(PITCH_W + EXIT_CLEARANCE);
  });
});

describe('walkEndpoints', () => {
  it('stands the arriving player a whole body clear of the leaving one', () => {
    const { exit, entry } = walkEndpoints({ x: 500, y: 5000 });
    expect(exit).toEqual({ x: -EXIT_CLEARANCE, y: 5000 });
    expect(entry).toEqual({ x: -EXIT_CLEARANCE, y: 5000 + BODY_UNITS });
  });

  it('staggers a triple substitution so three pairs do not stack', () => {
    const ys = [0, 1, 2].map(
      (pairIndex) => walkEndpoints({ x: 500, y: 5000 }, pairIndex).entry.y,
    );
    expect(ys).toEqual([
      5000 + BODY_UNITS,
      5000 + BODY_UNITS * 2,
      5000 + BODY_UNITS * 3,
    ]);
  });

  it('keeps a whole body on the canvas at either end of the pitch', () => {
    expect(clampWalkY(50)).toBe(BODY_UNITS / 2);
    expect(clampWalkY(PITCH_H - 50)).toBe(PITCH_H - BODY_UNITS / 2);
    // A swap on the goal line: both bodies stay drawable.
    const { exit, entry } = walkEndpoints({ x: 500, y: PITCH_H - 20 }, 2);
    expect(exit.y).toBeLessThanOrEqual(PITCH_H - BODY_UNITS / 2);
    expect(entry.y).toBeLessThanOrEqual(PITCH_H - BODY_UNITS / 2);
  });
});

describe('walkDurationTicks', () => {
  it('is exactly half the single-speed walk', () => {
    // pac 60 -> 100 units a tick at normal speed, 200 while substituting.
    const singleSpeedTicks = 1700 / 100;
    expect(walkDurationTicks(1700, 60)).toBeCloseTo(singleSpeedTicks / 2, 10);
    expect(walkDurationTicks(1700, 60)).toBeCloseTo(8.5, 10);
  });

  it('is measured in sim ticks, so playback speed cannot enter into it', () => {
    // The walk rides `visualTick`, which already runs faster at 2x/3x. There is
    // no rate argument to pass, and there must never be one.
    expect(walkDurationTicks.length).toBe(2);
    const source = readFileSync(
      join(process.cwd(), 'src/render/substitution-walk.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/playbackRate|matchPlaybackRate/u);
  });

  it('clamps a step and a cross-pitch trudge into the visible band', () => {
    expect(walkDurationTicks(10, 99)).toBe(MIN_WALK_TICKS);
    expect(walkDurationTicks(PITCH_W, 1)).toBe(MAX_WALK_TICKS);
  });
});

describe('hiddenSlots', () => {
  it('hides the live sprite only while the incoming walk runs', () => {
    const off = walk({ direction: 'off', durationTicks: 18 });
    const on = walk({ direction: 'on', durationTicks: 6 });
    expect(hiddenSlots([off, on], 104)).toEqual([3]);
    // The faster substitute has arrived; the ghost is still leaving. He must be
    // visible again, or the ball he is carrying floats over empty grass.
    expect(walkIsActive(off, 108)).toBe(true);
    expect(hiddenSlots([off, on], 108)).toEqual([]);
  });

  it('unhides the slot the moment a carrier snap drops the incoming walk', () => {
    const off = walk({ direction: 'off', durationTicks: 18 });
    expect(hiddenSlots([off], 104)).toEqual([]);
  });
});

describe('sampleWalk', () => {
  const liveTarget = { x: 3400, y: 6000 };

  it('parks every unused row', () => {
    const packed = packWalks([]);
    expect(packed).toHaveLength(WALKER_SLOTS * WALKER_STRIDE);
    expect(sampleWalk(packed, 0, 100, 0, 0).active).toBe(false);
  });

  it('walks an outgoing player clean out of the canvas', () => {
    const packed = packWalks([
      walk({ direction: 'off', to: { x: -EXIT_CLEARANCE, y: 5000 } }),
    ]);
    const start = sampleWalk(packed, 0, 100, liveTarget.x, liveTarget.y);
    expect(start.x).toBeCloseTo(3000, 6);
    const nearlyOff = sampleWalk(packed, 0, 109.99, liveTarget.x, liveTarget.y);
    expect(nearlyOff.x).toBeLessThanOrEqual(-BODY_UNITS / 2);
    expect(sampleWalk(packed, 0, 110, liveTarget.x, liveTarget.y).active).toBe(
      false,
    );
  });

  it('homes an incoming player on his live position, not a stale point', () => {
    const packed = packWalks([
      walk({ direction: 'on', from: { x: 0, y: 5000 }, to: { x: 0, y: 0 } }),
    ]);
    const late = sampleWalk(packed, 0, 109.999, liveTarget.x, liveTarget.y);
    // The handover has to be pixel-exact: the real sprite reappears here.
    expect(late.x).toBeCloseTo(liveTarget.x, 1);
    expect(late.y).toBeCloseTo(liveTarget.y, 1);
  });

  it('fades the arriving name away as he takes the position', () => {
    const packed = packWalks([walk({ direction: 'on' })]);
    expect(sampleWalk(packed, 0, 105, 0, 0).nameOpacity).toBe(1);
    expect(sampleWalk(packed, 0, 109, 0, 0).nameOpacity).toBeCloseTo(0.5, 6);
  });

  it('branches on the packed state, so a row alone decides the maths', () => {
    const off = packWalks([walk({ direction: 'off' })]);
    const on = packWalks([walk({ direction: 'on' })]);
    expect(on[WALK_STATE]).toBe(WALK_ON);
    const halfway = 105;
    expect(
      sampleWalk(off, 0, halfway, liveTarget.x, liveTarget.y).x,
    ).toBeCloseTo(1500, 6);
    expect(
      sampleWalk(off, 0, halfway, liveTarget.x, liveTarget.y).nameOpacity,
    ).toBe(1);
    expect(
      sampleWalk(on, 0, halfway, liveTarget.x, liveTarget.y).x,
    ).toBeCloseTo(3300, 6);
  });

  it('drops walks beyond the fixed buffer instead of overrunning it', () => {
    const many = Array.from({ length: WALKER_SLOTS + 4 }, () =>
      walk({ direction: 'off' }),
    );
    expect(packWalks(many)).toHaveLength(WALKER_SLOTS * WALKER_STRIDE);
  });
});

describe('walkRunFrame', () => {
  it('alternates on the 130ms cadence of every other walking sprite', () => {
    expect(walkRunFrame(0, TICK_MS)).toBe(0);
    expect(walkRunFrame(2, TICK_MS)).toBe(1);
    expect(walkRunFrame(3, TICK_MS)).toBe(0);
  });
});

describe('module hygiene', () => {
  it('reads no clock and no randomness', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/render/substitution-walk.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/Math\.random|Date\b|performance\.now/u);
  });

  it('stays off interpolate.ts, which is only half worklet-safe', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/render/substitution-walk.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/from '\.\/interpolate'/u);
  });

  it('marks every function a worklet can reach', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/render/substitution-walk.ts'),
      'utf8',
    );
    for (const name of ['clamp01', 'easeOut', 'sampleWalk']) {
      const body = source.slice(source.indexOf(`function ${name}(`));
      expect(body.slice(0, body.indexOf('}'))).toContain("'worklet';");
    }
  });
});

describe('distanceBetween', () => {
  it('measures the real diagonal, not just the run to the line', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 300, y: 400 })).toBe(500);
  });
});

describe('walkerSpriteKeys', () => {
  it('asks the atlas for nothing at all when nobody is walking', () => {
    // A padded empty list asks for ":run0", which is not a key: `atlasLayout`
    // throws and the whole match screen falls into its error boundary on the
    // first render, long before any substitution. It shipped that way once.
    expect(walkerSpriteKeys([], 0)).toEqual([]);
    expect(walkerSpriteKeys([], 0).join('')).not.toContain(':run0');
  });

  it('fills every buffer row, borrowing the first walker for the parked ones', () => {
    const keys = walkerSpriteKeys([walk({ direction: 'off' })], 1);
    expect(keys).toHaveLength(WALKER_SLOTS);
    expect(keys[0]).toBe('r:field-1:run1');
    expect(new Set(keys).size).toBe(1);
  });

  it('gives each walker his own look', () => {
    const keys = walkerSpriteKeys(
      [
        walk({ direction: 'off', visualId: 'r:a' }),
        walk({ direction: 'on', visualId: 'u:b' }),
      ],
      0,
    );
    expect(keys.slice(0, 2)).toEqual(['r:a:run0', 'u:b:run0']);
  });
});
