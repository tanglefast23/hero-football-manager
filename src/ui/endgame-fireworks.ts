/**
 * Fireworks over the true ending's ground, drawn as pixel art rather than
 * shipped as images.
 *
 * Same authoring rule as `event-pixel-art.ts`: a sprite is rows of palette
 * characters, flattened to horizontal same-colour runs for Skia rects. Runs
 * scale to any size without resampling, diff as text when somebody redraws a
 * burst, and cost nothing in the bundle.
 *
 * Three shells over a 16x16 grid, each authored once and recoloured per burst
 * — a firework is the same shape in gold as it is in red, and three copies of
 * every shape would be three places to fix a wonky spark.
 */

/** Grid size of one shell, in art pixels. */
export const FIREWORK_CELL = 16;

/**
 * `X` is the shell's colour, `x` its dimmer trailing spark, and `.` is sky.
 * Deliberately only two inks: a burst reads at a glance or it is decoration in
 * the way of the man who is talking.
 */
const FIREWORK_SHELLS: Readonly<Record<string, readonly string[]>> = {
  /** The classic radial burst: eight arms and a bright core. */
  'burst-star': [
    '.......xx.......',
    '.......XX.......',
    '..x....XX....x..',
    '...x...XX...x...',
    '....x..XX..x....',
    '.....x.XX.x.....',
    '......xXXx......',
    'xXXXXXXXXXXXXXXx',
    'xXXXXXXXXXXXXXXx',
    '......xXXx......',
    '.....x.XX.x.....',
    '....x..XX..x....',
    '...x...XX...x...',
    '..x....XX....x..',
    '.......XX.......',
    '.......xx.......',
  ],
  /** A ring shell, caught at the moment it opens. */
  'burst-ring': [
    '.....xXXXXx.....',
    '...xXX....XXx...',
    '..XX........XX..',
    '.XX..........XX.',
    '.X............X.',
    'XX............XX',
    'XX............XX',
    'X..............X',
    'X..............X',
    'XX............XX',
    'XX............XX',
    '.X............X.',
    '.XX..........XX.',
    '..XX........XX..',
    '...xXX....XXx...',
    '.....xXXXXx.....',
  ],
  /** A willow: arms that fall away rather than hold their shape. */
  'burst-willow': [
    '.......XX.......',
    '......XXXX......',
    '.....XX..XX.....',
    '....XX....XX....',
    '...XX......XX...',
    '..XX........XX..',
    '..X..........X..',
    '.XX..........XX.',
    '.X............X.',
    '.x............x.',
    'x..............x',
    'x..............x',
    '................',
    'x..............x',
    '................',
    'x..............x',
  ],
};

export const FIREWORK_SHELL_IDS: readonly string[] =
  Object.keys(FIREWORK_SHELLS);

export interface FireworkPixelRun {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  /** 1 for the shell's own colour, 0.55 for its trailing spark. */
  readonly opacity: number;
}

/**
 * Horizontal same-colour runs for one shell, ready for Skia rects.
 *
 * Colour is left to the caller and carried as an opacity instead, because the
 * same shell is drawn in three colours across one sky. Baking the colour in
 * would mean nine sprites where three will do.
 */
export function fireworkShellRuns(shellId: string): FireworkPixelRun[] {
  const rows = FIREWORK_SHELLS[shellId];
  if (rows === undefined) throw new Error(`unknown firework shell ${shellId}`);
  const runs: FireworkPixelRun[] = [];
  rows.forEach((row, y) => {
    let runStart = -1;
    let runOpacity = 0;
    const flush = (end: number) => {
      if (runStart >= 0) {
        runs.push({
          id: `${shellId}:${y}:${runStart}`,
          x: runStart,
          y,
          width: end - runStart,
          opacity: runOpacity,
        });
      }
      runStart = -1;
      runOpacity = 0;
    };
    for (let x = 0; x < row.length; x += 1) {
      const opacity = row[x] === 'X' ? 1 : row[x] === 'x' ? 0.55 : 0;
      if (opacity === 0) {
        flush(x);
        continue;
      }
      if (opacity !== runOpacity) {
        flush(x);
        runStart = x;
        runOpacity = opacity;
      }
    }
    flush(row.length);
  });
  return runs;
}

export interface FireworkBurst {
  readonly id: string;
  readonly shellId: string;
  /** Horizontal position as a percentage of the sky's width. */
  readonly leftPercent: number;
  /** Vertical position as a percentage of the sky's height. */
  readonly topPercent: number;
  /** Multiplier on the base shell size, so the sky has depth. */
  readonly scale: number;
  /** Where in the shared loop this shell fires, 0 to 1. */
  readonly phase: number;
  /** Index into the caller's palette. */
  readonly colorIndex: number;
}

/**
 * Where the shells sit in the sky, and when each one goes off.
 *
 * Deterministic from a key rather than rolled, exactly as `eventObjectLayout`
 * is: the true ending re-renders on every tap and every rotation, and a rolled
 * layout would rearrange the whole sky under the man who is mid-sentence.
 *
 * Staggered phases are the whole point of the display — five shells firing
 * together is one big flash, five spread across the loop is a sky that keeps
 * going while somebody talks over it.
 */
export function fireworkBursts(
  key: string,
  count: number,
  colorCount = 3,
): FireworkBurst[] {
  if (count <= 0) return [];
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  return Array.from({ length: count }, (_, index) => {
    const jitter = (offset: number, span: number) =>
      (unsigned >>> ((index * 7 + offset) % 27)) % span;
    return {
      id: `${key}:burst-${index}`,
      shellId: FIREWORK_SHELL_IDS[index % FIREWORK_SHELL_IDS.length],
      // Spread across the sky first, then nudged, so no two shells stack up
      // however the hash lands.
      leftPercent: 8 + (index * 84) / count + jitter(1, 9) - 4,
      topPercent: 6 + jitter(3, 26),
      scale: 0.75 + jitter(5, 7) / 10,
      phase: (index / count + jitter(2, 20) / 100) % 1,
      colorIndex: (index + jitter(4, colorCount)) % colorCount,
    };
  });
}
