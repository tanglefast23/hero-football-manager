import { loadSpriteSheet } from '../loader';
import {
  SLIDE_TACKLE_CELL,
  SLIDE_TACKLE_FRAME_COUNT,
  SLIDE_TACKLE_HEAD_ANGLES,
  slideTackleSpriteFrame,
  withSlideTackleSprites,
} from '../slide-tackle';

const CURRENT_IDS = [
  'r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10',
  'u0', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10',
] as const;

function paintedBounds(rows: readonly string[]) {
  const points = rows.flatMap((row, y) => [...row].flatMap((token, x) => (
    token === '.' ? [] : [{ x, y }]
  )));
  return {
    width: Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x)) + 1,
    height: Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y)) + 1,
  };
}

function paintedComponentSizes(rows: readonly string[]): number[] {
  const painted = new Set<string>();
  rows.forEach((row, y) => [...row].forEach((token, x) => {
    if (token !== '.') painted.add(`${x},${y}`);
  }));
  const componentSizes: number[] = [];
  while (painted.size > 0) {
    let size = 0;
    const first = painted.values().next().value as string;
    const queue = [first];
    painted.delete(first);
    while (queue.length > 0) {
      size += 1;
      const [x, y] = queue.pop()!.split(',').map(Number);
      for (const [nextX, nextY] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        const key = `${nextX},${nextY}`;
        if (!painted.delete(key)) continue;
        queue.push(key);
      }
    }
    componentSizes.push(size);
  }
  return componentSizes.sort((a, b) => b - a);
}

describe('derived slide-tackle sprites', () => {
  it('keeps every approved pose on the hard pixel grid and within the intended scale', () => {
    const sheet = loadSpriteSheet();
    for (const id of CURRENT_IDS) {
      for (let frame = 0; frame < SLIDE_TACKLE_FRAME_COUNT; frame += 1) {
        const rows = sheet.sprites[`${id}:${slideTackleSpriteFrame(frame)}`];
        expect(rows).toHaveLength(SLIDE_TACKLE_CELL.h);
        expect(rows.every(row => row.length === SLIDE_TACKLE_CELL.w)).toBe(true);
        for (const row of rows) {
          for (const token of row) expect(token in sheet.palette).toBe(true);
        }
        const bounds = paintedBounds(rows);
        expect(bounds.width).toBeLessThanOrEqual(33);
        expect(bounds.height).toBeLessThanOrEqual(30);
      }
    }
    expect(paintedBounds(sheet.sprites['r1:slide5']).width).toBeGreaterThanOrEqual(30);
  });

  it('keeps plant, crouch, knee-plant, rise, and stand silhouettes connected', () => {
    const sheet = loadSpriteSheet();
    for (const id of CURRENT_IDS) {
      for (const frame of [0, 1, 7, 8, 9]) {
        const components = paintedComponentSizes(sheet.sprites[`${id}:${slideTackleSpriteFrame(frame)}`]);
        const paintedPixels = components.reduce((sum, size) => sum + size, 0);
        // A one-pixel hair accent may remain detached after nearest-neighbour
        // rotation; a head, torso, or limb never may.
        expect(components[0] / paintedPixels).toBeGreaterThan(0.98);
        expect(components[1] ?? 0).toBeLessThanOrEqual(2);
      }
    }
  });

  it('preserves identity and kit palette tokens in the generated art', () => {
    const sheet = loadSpriteSheet();
    expect(sheet.sprites['r1:slide5'].join('')).toContain('R');
    expect(sheet.sprites['u1:slide5'].join('')).toContain('B');
    expect(sheet.sprites['r9:slide5'].join('')).toContain('F');
  });

  it('uses positive head motion and reaches an almost-horizontal deepest slide', () => {
    expect(SLIDE_TACKLE_HEAD_ANGLES.every(angle => angle > 0)).toBe(true);
    expect(Math.max(...SLIDE_TACKLE_HEAD_ANGLES)).toBe(78);
  });

  it('does not recreate the removed solid black neck bridge', () => {
    const sheet = loadSpriteSheet();
    for (const frame of [2, 3, 4, 5, 6]) {
      const rows = sheet.sprites[`r1:${slideTackleSpriteFrame(frame)}`];
      const neckTokens = rows.slice(10, 13).flatMap(row => [...row.slice(12, 15)]);
      expect(neckTokens.filter(token => token === 'K').length).toBeLessThan(5);
    }
  });

  it('automatically derives the same animation for a future sprite slot', () => {
    const current = loadSpriteSheet();
    const future = withSlideTackleSprites({
      cell: current.cell,
      palette: current.palette,
      sprites: {
        'r11:run0': current.sprites['r1:run0'],
        'r11:run1': current.sprites['r1:run1'],
      },
    });
    for (let frame = 0; frame < SLIDE_TACKLE_FRAME_COUNT; frame += 1) {
      expect(future.sprites).toHaveProperty(`r11:${slideTackleSpriteFrame(frame)}`);
    }
  });
});
