// Pure pixel-grid derivation for the match slide-tackle animation. Every pose
// is built from a player's existing run0/run1 sprite, so present and future
// visual slots inherit their own head, hair, skin tone, kit, and outline.
// No RN/Skia imports, interpolation, gradients, or fractional pixels.

export const SLIDE_TACKLE_FRAME_COUNT = 10;
export const SLIDE_TACKLE_CELL = { w: 34, h: 30 } as const;
export const SLIDE_TACKLE_HEAD_ANGLES = [
  6, 16, 26, 50, 72, 78, 44, 32, 22, 6,
] as const;

export type SlideTackleFrameIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type SlideTackleSpriteFrame = `slide${SlideTackleFrameIndex}`;

interface DerivableSpriteSheet {
  cell: { w: number; h: number };
  palette: Record<string, string | null>;
  sprites: Record<string, string[]>;
}

type Grid = string[][];
type Point = readonly [number, number];

const TRANSPARENT = '.';
const HEAD_ROWS = 15;
const SKIN_RAMP = ['d', 'm', 'n', 'S', 'L'] as const;

function emptyGrid(
  width: number = SLIDE_TACKLE_CELL.w,
  height: number = SLIDE_TACKLE_CELL.h,
): Grid {
  return Array.from({ length: height }, () =>
    Array<string>(width).fill(TRANSPARENT),
  );
}

function rowsToGrid(rows: readonly string[]): Grid {
  return rows.map((row) => [...row]);
}

function gridToRows(grid: Grid): string[] {
  return grid.map((row) => row.join(''));
}

function setPixel(grid: Grid, x: number, y: number, token: string): void {
  if (y < 0 || y >= grid.length || x < 0 || x >= grid[y].length) return;
  grid[y][x] = token;
}

function drawRect(
  grid: Grid,
  left: number,
  top: number,
  right: number,
  bottom: number,
  token: string,
): void {
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) setPixel(grid, x, y, token);
  }
}

function pointOnSegment(x: number, y: number, a: Point, b: Point): boolean {
  const cross = (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0]);
  if (Math.abs(cross) > 1e-9) return false;
  return (
    x >= Math.min(a[0], b[0]) &&
    x <= Math.max(a[0], b[0]) &&
    y >= Math.min(a[1], b[1]) &&
    y <= Math.max(a[1], b[1])
  );
}

function pointInPolygon(
  x: number,
  y: number,
  points: readonly Point[],
): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    if (pointOnSegment(x, y, points[j], points[i])) return true;
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const crosses =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function drawPolygon(
  grid: Grid,
  points: readonly Point[],
  token: string,
): void {
  const minX = Math.floor(Math.min(...points.map((point) => point[0])));
  const maxX = Math.ceil(Math.max(...points.map((point) => point[0])));
  const minY = Math.floor(Math.min(...points.map((point) => point[1])));
  const maxY = Math.ceil(Math.max(...points.map((point) => point[1])));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (
        pointInPolygon(x + 0.5, y + 0.5, points) ||
        pointInPolygon(x, y, points)
      ) {
        setPixel(grid, x, y, token);
      }
    }
  }
}

function paste(
  target: Grid,
  source: Grid,
  offsetX: number,
  offsetY: number,
): void {
  for (let y = 0; y < source.length; y += 1) {
    for (let x = 0; x < source[y].length; x += 1) {
      const token = source[y][x];
      if (token !== TRANSPARENT)
        setPixel(target, x + offsetX, y + offsetY, token);
    }
  }
}

function paintedBounds(
  grid: Grid,
): { left: number; top: number; right: number; bottom: number } | null {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      if (grid[y][x] === TRANSPARENT) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return Number.isFinite(left) ? { left, top, right, bottom } : null;
}

function cropPainted(grid: Grid): Grid {
  const bounds = paintedBounds(grid);
  if (!bounds) return [[TRANSPARENT]];
  const result: Grid = [];
  for (let y = bounds.top; y <= bounds.bottom; y += 1) {
    result.push(grid[y].slice(bounds.left, bounds.right + 1));
  }
  return result;
}

/** Positive angles turn counter-clockwise on the screen, using nearest-neighbour sampling. */
function rotateNearest(source: Grid, angleDegrees: number): Grid {
  // Sprite coordinates use a downward-positive Y axis. Negate the authored
  // angle so positive values keep their conventional counter-clockwise meaning
  // after the pixels are mapped back onto the screen grid.
  const angle = (-angleDegrees * Math.PI) / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const sourceWidth = source[0].length;
  const sourceHeight = source.length;
  const outputWidth = Math.ceil(
    Math.abs(sourceWidth * cosine) + Math.abs(sourceHeight * sine),
  );
  const outputHeight = Math.ceil(
    Math.abs(sourceWidth * sine) + Math.abs(sourceHeight * cosine),
  );
  const result = emptyGrid(outputWidth, outputHeight);
  const sourceCenterX = (sourceWidth - 1) / 2;
  const sourceCenterY = (sourceHeight - 1) / 2;
  const outputCenterX = (outputWidth - 1) / 2;
  const outputCenterY = (outputHeight - 1) / 2;

  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const dx = x - outputCenterX;
      const dy = y - outputCenterY;
      const sourceX = Math.round(cosine * dx + sine * dy + sourceCenterX);
      const sourceY = Math.round(-sine * dx + cosine * dy + sourceCenterY);
      if (
        sourceY < 0 ||
        sourceY >= sourceHeight ||
        sourceX < 0 ||
        sourceX >= sourceWidth
      )
        continue;
      result[y][x] = source[sourceY][sourceX];
    }
  }
  return cropPainted(result);
}

function placeHead(
  body: Grid,
  head: Grid,
  angle: number,
  centerX: number,
  centerY: number,
): Grid {
  const result = body.map((row) => [...row]);
  const rotated = rotateNearest(head, angle);
  paste(
    result,
    rotated,
    Math.round(centerX - rotated[0].length / 2),
    Math.round(centerY - rotated.length / 2),
  );
  return result;
}

function sourceHead(source: Grid): Grid {
  return cropPainted(source.slice(0, HEAD_ROWS));
}

function sourceTorso(source: Grid): Grid {
  return source.slice(16, 26).map((row) => [...row]);
}

function mostCommonToken(source: Grid, candidates: readonly string[]): string {
  const counts = new Map(candidates.map((token) => [token, 0]));
  for (const row of source) {
    for (const token of row) {
      if (counts.has(token)) counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? candidates[0]
  );
}

function skinTokens(source: Grid): { base: string; shadow: string } {
  const base = mostCommonToken(source, SKIN_RAMP);
  const index = SKIN_RAMP.indexOf(base as (typeof SKIN_RAMP)[number]);
  return { base, shadow: SKIN_RAMP[Math.max(0, index - 1)] };
}

function kitTokens(source: Grid): {
  base: string;
  shadow: string;
  light: string;
} {
  const redCount = source
    .flat()
    .filter((token) => token === 'R' || token === 'r' || token === 'E').length;
  const blueCount = source
    .flat()
    .filter((token) => token === 'B' || token === 'b' || token === 'C').length;
  return redCount >= blueCount
    ? { base: 'R', shadow: 'r', light: 'E' }
    : { base: 'B', shadow: 'b', light: 'C' };
}

function uprightBody(source: Grid): Grid {
  const result = emptyGrid();
  paste(
    result,
    source.slice(15, 30).map((row) => [...row]),
    5,
    15,
  );
  return result;
}

function kneelBody(source: Grid, high: boolean): Grid {
  const result = emptyGrid();
  const kit = kitTokens(source);
  const skin = skinTokens(source);
  const torsoY = high ? 10 : 12;
  const hipY = torsoY + 9;
  const reach = high ? 27 : 30;

  paste(result, sourceTorso(source), 5, torsoY);
  drawRect(result, 13, torsoY - 2, 15, torsoY + 1, skin.base);
  setPixel(result, 13, torsoY + 1, skin.shadow);

  drawPolygon(
    result,
    [
      [11, hipY],
      [17, hipY],
      [18, 26],
      [16, 28],
      [11, 27],
      [10, 23],
    ],
    'K',
  );
  drawRect(result, 12, hipY + 1, 16, 25, kit.shadow);
  drawRect(result, 12, 25, 16, 27, skin.base);
  drawPolygon(
    result,
    [
      [10, 27],
      [18, 27],
      [19, 30],
      [10, 30],
    ],
    'K',
  );
  drawRect(result, 12, 28, 17, 29, 'W');

  drawPolygon(
    result,
    [
      [16, hipY],
      [23, hipY + 1],
      [25, 23],
      [reach, 23],
      [reach + 1, 27],
      [22, 27],
      [17, 24],
    ],
    'K',
  );
  drawPolygon(
    result,
    [
      [17, hipY + 1],
      [22, hipY + 2],
      [23, 24],
      [18, 23],
    ],
    kit.shadow,
  );
  drawRect(result, 24, 24, reach - 1, 25, 'W');
  setPixel(result, 24, 26, 'w');
  return result;
}

function slideBody(source: Grid): Grid {
  const result = emptyGrid();
  const kit = kitTokens(source);
  const skin = skinTokens(source);

  paste(result, sourceTorso(source), 5, 12);
  drawRect(result, 12, 10, 14, 12, skin.base);
  setPixel(result, 12, 12, skin.shadow);

  drawPolygon(
    result,
    [
      [20, 18],
      [28, 18],
      [29, 21],
      [24, 23],
      [19, 21],
    ],
    'K',
  );
  drawPolygon(
    result,
    [
      [21, 18],
      [27, 19],
      [23, 21],
      [20, 20],
    ],
    kit.shadow,
  );
  drawPolygon(
    result,
    [
      [26, 20],
      [33, 20],
      [33, 24],
      [27, 24],
      [24, 22],
    ],
    'K',
  );
  drawRect(result, 28, 21, 32, 22, 'W');
  setPixel(result, 28, 23, 'w');

  drawPolygon(
    result,
    [
      [17, 20],
      [25, 22],
      [24, 25],
      [16, 23],
    ],
    'K',
  );
  drawPolygon(
    result,
    [
      [18, 21],
      [24, 23],
      [20, 24],
      [17, 22],
    ],
    kit.base,
  );
  drawPolygon(
    result,
    [
      [23, 24],
      [30, 24],
      [31, 27],
      [23, 27],
    ],
    'K',
  );
  drawRect(result, 25, 25, 29, 26, 'W');

  drawPolygon(
    result,
    [
      [9, 16],
      [6, 20],
      [5, 24],
      [8, 25],
      [10, 20],
      [12, 18],
    ],
    'K',
  );
  drawPolygon(
    result,
    [
      [9, 17],
      [7, 20],
      [7, 23],
      [8, 23],
      [10, 19],
      [12, 18],
    ],
    kit.light,
  );
  drawRect(result, 5, 23, 8, 25, 'K');
  drawRect(result, 6, 23, 7, 24, skin.base);
  return result;
}

function deriveFrames(sourceRows: string[]): string[][] {
  const source = rowsToGrid(sourceRows);
  const head = sourceHead(source);
  const bodies = [
    uprightBody(source),
    kneelBody(source, false),
    slideBody(source),
    slideBody(source),
    slideBody(source),
    slideBody(source),
    slideBody(source),
    kneelBody(source, false),
    kneelBody(source, true),
    uprightBody(source),
  ];
  const centers: readonly Point[] = [
    [17, 8],
    [14, 9],
    [11, 10],
    [11, 11],
    [11, 13],
    [11, 13],
    [11, 11],
    [14, 9],
    [15, 9],
    [17, 8],
  ];
  return bodies.map((body, index) =>
    gridToRows(
      placeHead(
        body,
        head,
        SLIDE_TACKLE_HEAD_ANGLES[index],
        centers[index][0],
        centers[index][1],
      ),
    ),
  );
}

export function slideTackleSpriteFrame(index: number): SlideTackleSpriteFrame {
  const clamped = Math.max(
    0,
    Math.min(SLIDE_TACKLE_FRAME_COUNT - 1, Math.floor(index)),
  ) as SlideTackleFrameIndex;
  return `slide${clamped}`;
}

/**
 * Adds derived action frames for every visual ID with a run0/run1 pair. IDs
 * are discovered from the sheet instead of a fixed list, so a future sprite
 * slot receives the animation automatically.
 */
export function withSlideTackleSprites<T extends DerivableSpriteSheet>(
  sheet: T,
): T {
  const sprites = { ...sheet.sprites };
  const ids = Object.keys(sheet.sprites)
    .filter((key) => key.endsWith(':run0'))
    .map((key) => key.slice(0, -':run0'.length))
    .filter((id) => `${id}:run1` in sheet.sprites);

  for (const id of ids) {
    const frames = deriveFrames(sheet.sprites[`${id}:run0`]);
    frames.forEach((rows, index) => {
      sprites[`${id}:${slideTackleSpriteFrame(index)}`] = rows;
    });
  }
  return { ...sheet, sprites };
}
