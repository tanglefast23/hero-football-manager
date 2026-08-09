/**
 * The football ground the three endgame celebrations stand on, seen side-on at
 * night.
 *
 * It replaces a stack of three unrelated layers — sky, an empty purple band,
 * and the match's top-down pitch texture — with one place. The old scene put a
 * side-on player on a floor plan: a centre circle behind his knees, a halfway
 * line at his feet. Those markings only exist from directly overhead, so from
 * the touchline they are gone, and what is left is the thing you actually see
 * from down there: sky, then a stand on the far side, then grass running away
 * under your feet.
 *
 * Authored the same way as `event-pixel-art.ts` and `endgame-fireworks.ts` —
 * palette-character rows flattened to horizontal same-ink runs. No image
 * assets: the ground has to fit a phone, a tablet and a desktop window without
 * resampling, and a stand that diffs as text is a stand somebody can fix.
 *
 * The whole scene is a pure function of the window size. Nothing here imports
 * React or Skia, so the composition — every band, and the promise that they
 * leave no gap between them — is checkable headlessly.
 */

/**
 * Bible palette (docs/11-art-style.md), stepped down for night. The grey ramp
 * is the stand's steel and concrete, ink is everything the floodlights miss.
 */
export const GROUND_PALETTE: Readonly<Record<string, string>> = {
  K: '#241f2e', // ink — the dark under the roof, and the wall at the front
  k: '#3a3350', // ink-soft — the terrace itself
  n: '#6b6675', // grey-dark — steelwork away from the lamps
  N: '#9a95a4', // grey — steelwork catching them
  M: '#c9c5d0', // grey-light — the lit rim of the roof and the lamp housings
  P: '#f4f1ea', // cream — glare off a lamp bank
  G: '#edb54a', // gold — the lamps
  L: '#f7d894', // gold-light — the hot centre of a lamp
};

/** Where the sky hands over to the stand, as a percentage of window height. */
export const HORIZON_PERCENT = 46;
/** Where the stand hands over to the grass. */
export const GRASS_PERCENT = 63;

/**
 * The night sky, in three flat bands rather than a gradient — hard value steps
 * are the house rule, and the lightest band is the ground's own light bouncing
 * off the cloud above it.
 *
 * `end` is a fraction of the sky's own height, so the ramp holds at any size.
 */
export const SKY_BANDS: readonly {
  readonly end: number;
  readonly color: string;
}[] = Object.freeze([
  { end: 0.42, color: '#19142a' },
  { end: 0.74, color: '#241f2e' },
  { end: 1, color: '#35234f' },
]);

/**
 * The turf, in mown stripes that grow toward the viewer.
 *
 * That growth is the whole perspective trick: identical stripes read as a
 * texture, stripes that widen as they come forward read as a plane going away.
 * The first band is the stand's shadow across the far turf, the second is the
 * far touchline — the one pitch marking that survives being looked at from the
 * side — and the last is the near grass under the lamps, where the player who
 * is talking actually stands.
 *
 * Colours are the pitch ramp (`#3f8a4a` base) darkened for night; the game
 * never shows floodlit turf at the daytime `#5cb85c`.
 */
export const GRASS_BANDS: readonly {
  readonly end: number;
  readonly color: string;
}[] = Object.freeze([
  { end: 0.04, color: '#26512f' },
  { end: 0.056, color: '#c9c5d0' },
  { end: 0.14, color: '#31703f' },
  { end: 0.25, color: '#3f8a4a' },
  { end: 0.39, color: '#31703f' },
  { end: 0.565, color: '#3f8a4a' },
  { end: 0.78, color: '#31703f' },
  { end: 1, color: '#529f5b' },
]);

/** Art-pixel width of one bay of the stand. */
export const STAND_TILE_WIDTH = 16;

/**
 * One bay: roof, the dark under it, four terrace steps, and the front wall.
 *
 * Tiled across the window rather than drawn once, because a stand is a row of
 * identical bays and a 16-wide unit stays legible from a 320pt phone to a
 * desktop window. The bays are stitched into full-width rows *before* the runs
 * are flattened, so a row of uniform ink costs one rect across the whole
 * screen instead of one per bay.
 */
const STAND_TILE: readonly string[] = Object.freeze([
  'MMMMMMMMMMMMMMMM', //  0 roof rim, lit from the lamps behind
  'NNNNNNNNNNNNNNNN', //  1 roof
  'nnnnnnnnnnnnnnnn', //  2 fascia
  'nKKKKKKKKKKKKKKn', //  3 the dark under the roof, between the columns
  'nKKKKKKKKKKKKKKn', //  4
  'nKKKKKKKKKKKKKKn', //  5
  'nkkkkkkkkkkkkkkn', //  6 terrace
  'nkkkkkkkkkkkkkkn', //  7
  'nKKKKKKKKKKKKKKn', //  8 step
  'nkkkkkkkkkkkkkkn', //  9
  'nkkkkkkkkkkkkkkn', // 10
  'nKKKKKKKKKKKKKKn', // 11 step
  'nkkkkkkkkkkkkkkn', // 12
  'nkkkkkkkkkkkkkkn', // 13
  'nKKKKKKKKKKKKKKn', // 14 step
  'nkkkkkkkkkkkkkkn', // 15
  'nkkkkkkkkkkkkkkn', // 16
  'nnnnnnnnnnnnnnnn', // 17 front rail
  'KKKKKKKKKKKKKKKK', // 18 wall
  'KKKKKKKKKKKKKKKK', // 19 hoardings are painted over these two rows
  'KKKKKKKKKKKKKKKK', // 20
  'KKKKKKKKKKKKKKKK', // 21 the stand's own shadow, where it meets the grass
]);

/** Art-pixel height of one bay, and so the height of the whole stand. */
export const STAND_TILE_HEIGHT = STAND_TILE.length;

/** The rows a supporter can be standing on. */
const TERRACE_ROWS: readonly number[] = Object.freeze([
  6, 7, 9, 10, 12, 13, 15, 16,
]);
/** The two rows the advertising boards cover. */
const HOARDING_ROWS: readonly number[] = Object.freeze([19, 20]);

/** Art-pixel width of one floodlight pylon. */
export const FLOODLIGHT_WIDTH = 10;

/**
 * A floodlight, which is the shape that says "football ground at night" before
 * anything else in the frame does. Lamp bank on top, lattice mast widening
 * below it; the bottom rows are drawn behind the stand's roof, so the pylon
 * reads as standing further back than the terrace.
 */
const FLOODLIGHT: readonly string[] = Object.freeze([
  '.MMMMMMMM.',
  'MPLLLLLLPM',
  'MLGGGGGGLM',
  '.nMMMMMMn.',
  '....nn....',
  '....NN....',
  '...N..N...',
  '...NnnN...',
  '...N..N...',
  '...N..N...',
  '..N....N..',
  '..NnnnnN..',
  '..N....N..',
  '..N....N..',
  '..N....N..',
  '.N......N.',
  '.NnnnnnnN.',
  '.N......N.',
  '.N......N.',
  'N........N',
  'NnnnnnnnnN',
  'N........N',
]);

export const FLOODLIGHT_HEIGHT = FLOODLIGHT.length;

/** Where the two pylons stand, as fractions of the window width. */
const FLOODLIGHT_CENTRES: readonly number[] = Object.freeze([0.14, 0.83]);

/** The haze around a lamp bank, in rings from the outside in. */
const GLOW_RINGS: readonly {
  readonly radius: number;
  readonly opacity: number;
  readonly color: string;
}[] = Object.freeze([
  { radius: 1.7, opacity: 0.035, color: '#edb54a' },
  { radius: 1.15, opacity: 0.045, color: '#edb54a' },
  { radius: 0.7, opacity: 0.07, color: '#f7d894' },
]);

/**
 * The advertising boards at the foot of the stand, cycling so no two
 * neighbours match. Club red and blue with a cream board between them: at this
 * size a hoarding is a colour, not a word.
 */
const HOARDING_COLORS: readonly string[] = Object.freeze([
  '#d94f52',
  '#5a8fd6',
  '#f4f1ea',
  '#c8862a',
]);
/** Art-pixel width of one board. */
const HOARDING_BOARD_WIDTH = 8;

/**
 * The crowd, as speckle. Mostly the grey ramp, because a night crowd is coats;
 * the gold and red are the few scarves close enough to the lamps to read. No
 * faces — at one art pixel a head there is nothing to draw a face on, and
 * trying is how a stand starts looking like a rash.
 */
const CROWD_COLORS: readonly string[] = Object.freeze([
  '#9a95a4',
  '#9a95a4',
  '#c9c5d0',
  '#6b6675',
  '#9a95a4',
  '#6b6675',
  '#c9c5d0',
  '#9a95a4',
  '#edb54a',
  '#6b6675',
  '#d94f52',
  '#c9c5d0',
]);
/** How much of the terrace is people rather than concrete. */
const CROWD_DENSITY = 0.32;

export interface GroundRect {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly opacity?: number;
}

export interface GroundGlow {
  readonly id: string;
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly color: string;
  readonly opacity: number;
}

export interface GroundScene {
  /** Painted first: the night behind everything else. */
  readonly sky: readonly GroundRect[];
  /**
   * The lamps' haloes, painted over the sky and under the steel — so a pylon
   * stays a hard silhouette standing inside its own light.
   */
  readonly glows: readonly GroundGlow[];
  /** Painted last, in order: pylons, stand, crowd, hoardings, grass. */
  readonly rects: readonly GroundRect[];
  /** Top of the stand — the horizon the sky sits above. */
  readonly horizonY: number;
  /** Top of the grass — the line the celebration's feet belong below. */
  readonly grassTopY: number;
}

interface ArtRun {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly color: string;
}

/** Horizontal same-ink runs of one character row. */
function rowRuns(row: string, y: number): ArtRun[] {
  const runs: ArtRun[] = [];
  let start = -1;
  let color: string | undefined;
  const flush = (end: number) => {
    if (start >= 0 && color !== undefined)
      runs.push({ x: start, y, width: end - start, color });
    start = -1;
    color = undefined;
  };
  for (let x = 0; x < row.length; x += 1) {
    const ink = GROUND_PALETTE[row[x]];
    if (ink === undefined) {
      flush(x);
      continue;
    }
    if (ink !== color) {
      flush(x);
      start = x;
      color = ink;
    }
  }
  flush(row.length);
  return runs;
}

/**
 * The stand, `columns` art pixels wide.
 *
 * Bays are stitched into one row of characters before flattening, so the roof
 * — identical across every bay — comes back as a single run rather than one
 * per bay. On a 375pt phone that is the difference between about a hundred
 * rects and four hundred.
 */
export function standRuns(columns: number): ArtRun[] {
  if (columns <= 0) return [];
  return STAND_TILE.flatMap((tileRow, y) => {
    let row = '';
    while (row.length < columns) row += tileRow;
    return rowRuns(row.slice(0, columns), y);
  });
}

/** One floodlight pylon's runs, in its own art-pixel space. */
export function floodlightRuns(): ArtRun[] {
  return FLOODLIGHT.flatMap((row, y) => rowRuns(row, y));
}

/** The scene's only source of randomness, and it is not random. */
function fnv1a(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Where the supporters are, in art-pixel coordinates over the whole stand.
 *
 * Deterministic from a fixed key, for the same reason the firework layout is:
 * the true ending re-renders on every tap, and a crowd that re-rolled itself
 * would shuffle the entire stand under a man who is mid-sentence.
 */
export function crowdSpeckle(columns: number): ReadonlyArray<{
  readonly x: number;
  readonly y: number;
  readonly color: string;
}> {
  if (columns <= 0) return [];
  const count = Math.round(columns * TERRACE_ROWS.length * CROWD_DENSITY);
  const seed = fnv1a('endgame-ground-crowd');
  return Array.from({ length: count }, (_, index) => {
    const jitter = (offset: number, span: number) =>
      (seed >>> ((index * 5 + offset) % 27)) % span;
    return {
      // Strided rather than rolled: a hash alone clumps, and a clumped crowd
      // reads as damage to the stand rather than as people in it.
      x: (index * 7 + jitter(1, 5)) % columns,
      y: TERRACE_ROWS[(index * 3 + jitter(2, 3)) % TERRACE_ROWS.length],
      color:
        CROWD_COLORS[
          (index + jitter(3, CROWD_COLORS.length)) % CROWD_COLORS.length
        ],
    };
  });
}

/**
 * Where the grass starts, without building the scene to find out. Callers that
 * only need to stand somebody on the turf ask this.
 */
export function grassTopFor(height: number): number {
  return (height * GRASS_PERCENT) / 100;
}

/**
 * The whole ground, sized to a window.
 *
 * Every horizontal slice of the result belongs to sky, stand or grass — the
 * bands are laid end to end from the same two boundaries, so there is nowhere
 * for the empty strip this replaced to come back.
 */
export function groundScene(width: number, height: number): GroundScene {
  const horizonY = (height * HORIZON_PERCENT) / 100;
  const grassTopY = (height * GRASS_PERCENT) / 100;
  const standHeight = grassTopY - horizonY;
  const pixel = standHeight / STAND_TILE_HEIGHT;
  const columns = Math.ceil(width / pixel);
  const sky: GroundRect[] = [];
  const rects: GroundRect[] = [];
  const glows: GroundGlow[] = [];

  let bandTop = 0;
  SKY_BANDS.forEach((band, index) => {
    const bandBottom = horizonY * band.end;
    sky.push({
      id: `sky-${index}`,
      x: 0,
      y: bandTop,
      width,
      height: bandBottom - bandTop,
      color: band.color,
    });
    bandTop = bandBottom;
  });

  // The pylons stand behind the stand: their last rows are drawn first and
  // then painted over by the roof, which is what puts them further away.
  const pylonRuns = floodlightRuns();
  const pylonBottom = horizonY + pixel * 3;
  FLOODLIGHT_CENTRES.forEach((centre, index) => {
    const left = width * centre - (FLOODLIGHT_WIDTH * pixel) / 2;
    const top = pylonBottom - FLOODLIGHT_HEIGHT * pixel;
    const lampCx = left + (FLOODLIGHT_WIDTH * pixel) / 2;
    const lampCy = top + pixel * 1.5;
    // Three faint rings rather than one bright halo: a single disc over a flat
    // night sky shows its own edge and reads as a hole cut in the sky, where a
    // stepped falloff reads as haze around a lamp.
    GLOW_RINGS.forEach((ring, ringIndex) => {
      glows.push({
        id: `glow-${index}-${ringIndex}`,
        cx: lampCx,
        cy: lampCy,
        radius: FLOODLIGHT_WIDTH * pixel * ring.radius,
        color: ring.color,
        opacity: ring.opacity,
      });
    });
    pylonRuns.forEach((run) => {
      rects.push({
        id: `pylon-${index}-${run.y}-${run.x}`,
        x: left + run.x * pixel,
        y: top + run.y * pixel,
        width: run.width * pixel,
        height: pixel,
        color: run.color,
      });
    });
  });

  standRuns(columns).forEach((run) => {
    rects.push({
      id: `stand-${run.y}-${run.x}`,
      x: run.x * pixel,
      y: horizonY + run.y * pixel,
      width: run.width * pixel,
      height: pixel,
      color: run.color,
    });
  });

  crowdSpeckle(columns).forEach((speck, index) => {
    rects.push({
      id: `fan-${index}`,
      x: speck.x * pixel,
      y: horizonY + speck.y * pixel,
      width: pixel,
      height: pixel,
      color: speck.color,
    });
  });

  const hoardingTop = horizonY + HOARDING_ROWS[0] * pixel;
  const hoardingHeight = HOARDING_ROWS.length * pixel;
  const boards = Math.ceil(columns / HOARDING_BOARD_WIDTH);
  for (let index = 0; index < boards; index += 1) {
    rects.push({
      id: `hoarding-${index}`,
      x: index * HOARDING_BOARD_WIDTH * pixel,
      y: hoardingTop,
      width: HOARDING_BOARD_WIDTH * pixel,
      height: hoardingHeight,
      color: HOARDING_COLORS[index % HOARDING_COLORS.length],
      // Dimmed: boards this bright unlit would out-shout the man in front of
      // them, and they are only there to seat the stand on the grass.
      opacity: 0.62,
    });
  }

  const grassHeight = height - grassTopY;
  bandTop = grassTopY;
  GRASS_BANDS.forEach((band, index) => {
    const bandBottom = grassTopY + grassHeight * band.end;
    rects.push({
      id: `grass-${index}`,
      x: 0,
      y: bandTop,
      width,
      height: bandBottom - bandTop,
      color: band.color,
    });
    bandTop = bandBottom;
  });

  return { sky, glows, rects, horizonY, grassTopY };
}
