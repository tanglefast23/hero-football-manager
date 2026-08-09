/**
 * The desk's recent-form strip: how wide one result is, how many fit, and the
 * trophy a win is drawn with.
 *
 * A win used to be the letter W in a coloured box, which is the same amount of
 * ink as a loss and reads as bookkeeping. It is now a pixel trophy, so a good
 * run is a shelf of cups you can see from across the room. Losses keep their
 * letter on purpose — a defeat should be legible, not decorated.
 *
 * Pure module: the maths is unit-tested and the component only measures.
 */

/**
 * One result cell, in points, including its 2pt border. 28 is the existing
 * StatusChip height, so the strip sits on the same rail as every other chip on
 * the desk, and its 24pt interior takes the 12x12 trophy at a whole 2x scale.
 * Bitmap art on a fractional scale grows hairline seams.
 */
export const FORM_CELL_SIZE = 28;
export const FORM_CELL_BORDER = 2;
/** Interior of a cell — exactly the trophy's drawn size. */
export const FORM_ART_SIZE = FORM_CELL_SIZE - FORM_CELL_BORDER * 2;
export const FORM_CELL_GAP = 4;

/**
 * A season is 18 league rounds plus up to 6 cup ties, so 24 cells is every
 * match a manager can have played this year. Past that the strip would be
 * showing last season's results under a heading that says "recent", and a wide
 * monitor has the room to do it — the cap is the meaning, not the space.
 */
export const FORM_STRIP_MAX = 24;

/**
 * How many results fit in `width` points, right-aligned with `FORM_CELL_GAP`
 * between them. The last cell carries no trailing gap, hence the `+ gap`.
 *
 * Returns 0 only for a width too small for a single cell, so the strip is never
 * asked to draw a clipped one.
 */
export function formStripCapacity(width: number): number {
  if (!Number.isFinite(width) || width < FORM_CELL_SIZE) return 0;
  const fit = Math.floor(
    (width + FORM_CELL_GAP) / (FORM_CELL_SIZE + FORM_CELL_GAP),
  );
  return Math.min(fit, FORM_STRIP_MAX);
}

/** The desk's ScrollView padding, both sides. */
const DESK_PADDING = 32;
/**
 * `SectionFlow`'s `max-w-5xl`, in points. A rem is 14pt on native and 16px on
 * web, so the native measure is the smaller of the two and the safe one to
 * guess with.
 */
const FLOW_MAX_WIDTH = 64 * 14;

/**
 * What the strip is worth before it has measured itself.
 *
 * The measurement is the truth, but it arrives a frame late — and on a hidden
 * or throttled document it may not arrive at all, because the layout callback
 * rides an animation frame. Seeding from the window means the worst case is a
 * strip one cell short for a frame, not a header with a heading and nothing
 * under it. Deliberately conservative: guessing narrow can only under-fill.
 */
export function formStripWidthEstimate(windowWidth: number): number {
  if (!Number.isFinite(windowWidth)) return 0;
  return Math.min(windowWidth, FLOW_MAX_WIDTH) - DESK_PADDING;
}

/** The most recent `capacity` results, newest last — the order the strip reads. */
export function visibleForm<T>(
  form: readonly T[],
  capacity: number,
): readonly T[] {
  if (capacity <= 0) return [];
  return form.length <= capacity ? form : form.slice(form.length - capacity);
}

/** How long a cell takes to pop in, and how long the whole cascade may run. */
export const FORM_CELL_ENTER_MS = 180;
export const FORM_STRIP_CASCADE_MS = 360;

/**
 * Cells deal left to right so the cascade lands on the newest result, but the
 * total is fixed: a 24-cell desktop strip must not take three times as long to
 * settle as a 9-cell phone one.
 */
export function formCellEnterDelay(index: number, count: number): number {
  if (count <= 1) return 0;
  return Math.round((index / (count - 1)) * FORM_STRIP_CASCADE_MS);
}

const TROPHY_PALETTE: Readonly<Record<string, string>> = {
  K: '#241f2e', // ink outline
  G: '#edb54a', // gold
  g: '#c8862a', // gold-dark, the shadow under the stem
  L: '#f7d894', // gold-light, the shine across the bowl
};

/**
 * 12x12 so it lands on a whole 2x inside a 28pt cell. Drawn chunkier than the
 * 16x16 event trophy on purpose: at this size detail turns to mush, and a fat
 * silhouette is what carries across a strip of ten.
 *
 * Handles were drawn and then cut. A handle needs an outline, a gold body and
 * a gap, which is three columns a side out of twelve — and at 2x the gold
 * sliver disappeared between two ink columns, so both ears read as black
 * blobs. A wide-rimmed cup on a stem and plinth is unmistakable without them.
 */
const TROPHY_ROWS: readonly string[] = [
  '............',
  '.KKKKKKKKKK.',
  '.KLLLLLLLLK.',
  '.KGLLLLLLGK.',
  '..KGLLLLGK..',
  '..KGGLLGGK..',
  '...KGGGGK...',
  '....KGGK....',
  '....KGGK....',
  '....KggK....',
  '..KKGGGGKK..',
  '..KKKKKKKK..',
];

export const TROPHY_GRID = TROPHY_ROWS.length;

export interface TrophyRun {
  id: string;
  x: number;
  y: number;
  width: number;
  color: string;
}

/** Row-run-length encoding of the opaque cells, like `financeSpriteRuns`. */
function encodeTrophy(): TrophyRun[] {
  const runs: TrophyRun[] = [];
  TROPHY_ROWS.forEach((row, y) => {
    let start = -1;
    let color: string | undefined;
    const flush = (end: number) => {
      if (start >= 0 && color !== undefined) {
        runs.push({
          id: `trophy:${y}:${start}`,
          x: start,
          y,
          width: end - start,
          color,
        });
      }
      start = -1;
      color = undefined;
    };
    for (let x = 0; x < row.length; x += 1) {
      const next = TROPHY_PALETTE[row[x]];
      if (next === undefined) {
        flush(x);
        continue;
      }
      if (next !== color) {
        flush(x);
        start = x;
        color = next;
      }
    }
    flush(row.length);
  });
  return runs;
}

/**
 * Encoded once at module load. Every win on the strip draws the same rectangles,
 * and this rides in a header that remounts on every visit to the desk.
 */
export const TROPHY_RUNS: readonly TrophyRun[] = encodeTrophy();
