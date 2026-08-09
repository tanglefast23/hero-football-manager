import { loadSpriteSheet } from '../loader';
import {
  SLIDE_TACKLE_CELL,
  SLIDE_TACKLE_FRAME_COUNT,
  SLIDE_TACKLE_HEAD_ANGLES,
  slideTackleSpriteFrame,
  withSlideTackleSprites,
} from '../slide-tackle';

const CURRENT_IDS = [
  'r:g00',
  'r:f00',
  'r:f01',
  'r:f02',
  'r:f03',
  'r:f04',
  'r:f05',
  'r:f06',
  'r:f07',
  'r:f08',
  'r:f09',
  'u:g01',
  'u:f10',
  'u:f11',
  'u:f12',
  'u:f13',
  'u:f14',
  'u:f15',
  'u:f16',
  'u:f17',
  'u:f18',
  'u:f19',
] as const;

function paintedBounds(rows: readonly string[]) {
  const points = rows.flatMap((row, y) =>
    [...row].flatMap((token, x) => (token === '.' ? [] : [{ x, y }])),
  );
  return {
    width:
      Math.max(...points.map((point) => point.x)) -
      Math.min(...points.map((point) => point.x)) +
      1,
    height:
      Math.max(...points.map((point) => point.y)) -
      Math.min(...points.map((point) => point.y)) +
      1,
  };
}

function paintedComponentSizes(rows: readonly string[]): number[] {
  const painted = new Set<string>();
  rows.forEach((row, y) =>
    [...row].forEach((token, x) => {
      if (token !== '.') painted.add(`${x},${y}`);
    }),
  );
  const componentSizes: number[] = [];
  while (painted.size > 0) {
    let size = 0;
    const first = painted.values().next().value as string;
    const queue = [first];
    painted.delete(first);
    while (queue.length > 0) {
      size += 1;
      const [x, y] = queue.pop()!.split(',').map(Number);
      for (const [nextX, nextY] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const key = `${nextX},${nextY}`;
        if (!painted.delete(key)) continue;
        queue.push(key);
      }
    }
    componentSizes.push(size);
  }
  return componentSizes.sort((a, b) => b - a);
}

function averageTokenX(rows: readonly string[], tokens: ReadonlySet<string>) {
  const columns = rows.flatMap((row) =>
    [...row].flatMap((token, x) => (tokens.has(token) ? [x] : [])),
  );
  return columns.reduce((sum, column) => sum + column, 0) / columns.length;
}

describe('derived slide-tackle sprites', () => {
  it('keeps every approved pose on the hard pixel grid and within the intended scale', () => {
    const sheet = loadSpriteSheet();
    for (const id of CURRENT_IDS) {
      for (let frame = 0; frame < SLIDE_TACKLE_FRAME_COUNT; frame += 1) {
        const rows = sheet.sprites[`${id}:${slideTackleSpriteFrame(frame)}`];
        expect(rows).toHaveLength(SLIDE_TACKLE_CELL.h);
        expect(rows.every((row) => row.length === SLIDE_TACKLE_CELL.w)).toBe(
          true,
        );
        for (const row of rows) {
          for (const token of row) expect(token in sheet.palette).toBe(true);
        }
        const bounds = paintedBounds(rows);
        expect(bounds.width).toBeLessThanOrEqual(33);
        expect(bounds.height).toBeLessThanOrEqual(30);
      }
    }
    expect(
      paintedBounds(sheet.sprites['r:f00:slide5']).width,
    ).toBeGreaterThanOrEqual(30);
  });

  it('keeps plant, crouch, knee-plant, rise, and stand silhouettes connected', () => {
    const sheet = loadSpriteSheet();
    for (const id of CURRENT_IDS) {
      for (const frame of [0, 1, 7, 8, 9]) {
        const components = paintedComponentSizes(
          sheet.sprites[`${id}:${slideTackleSpriteFrame(frame)}`],
        );
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
    expect(sheet.sprites['r:f00:slide5'].join('')).toContain('R');
    expect(sheet.sprites['u:f10:slide5'].join('')).toContain('B');
    expect(sheet.sprites['r:f08:slide5'].join('')).toContain('F');
  });

  it('uses positive head motion and reaches an almost-horizontal deepest slide', () => {
    expect(SLIDE_TACKLE_HEAD_ANGLES.every((angle) => angle > 0)).toBe(true);
    expect(Math.max(...SLIDE_TACKLE_HEAD_ANGLES)).toBe(78);
  });

  it('renders frames 3 through 7 with counter-clockwise head rotation', () => {
    const sheet = loadSpriteSheet();
    const hairTokens = new Set(['x', 'y']);
    const skinTokens = new Set(['d', 'm', 'n', 'S', 'L']);
    for (const frame of [3, 4, 5, 6, 7]) {
      const rows = sheet.sprites[`r:f00:${slideTackleSpriteFrame(frame)}`];
      // At the low point of a left-facing tackle, counter-clockwise rotation
      // puts the top/back of this asymmetric head to the left of its face.
      // The old screen-space sign placed it to the right in every frame here.
      expect(averageTokenX(rows, hairTokens)).toBeLessThan(
        averageTokenX(rows, skinTokens),
      );
    }
  });

  it('does not recreate the removed solid black neck bridge', () => {
    const sheet = loadSpriteSheet();
    for (const frame of [2, 3, 4, 5, 6]) {
      const rows = sheet.sprites[`r:f00:${slideTackleSpriteFrame(frame)}`];
      const neckTokens = rows
        .slice(10, 13)
        .flatMap((row) => [...row.slice(12, 15)]);
      expect(neckTokens.filter((token) => token === 'K').length).toBeLessThan(
        5,
      );
    }
  });

  it('automatically derives the same animation for a future sprite slot', () => {
    const current = loadSpriteSheet();
    const future = withSlideTackleSprites({
      cell: current.cell,
      palette: current.palette,
      sprites: {
        'r:future:run0': current.sprites['r:f00:run0'],
        'r:future:run1': current.sprites['r:f00:run1'],
      },
    });
    for (let frame = 0; frame < SLIDE_TACKLE_FRAME_COUNT; frame += 1) {
      expect(future.sprites).toHaveProperty(
        `r:future:${slideTackleSpriteFrame(frame)}`,
      );
    }
  });
});
