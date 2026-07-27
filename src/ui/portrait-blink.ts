// Pure blink synthesis for the pixel portraits. The face is run-length rows of
// palette keys; eyes live in the upper-face band and the mouth (row ~12) is
// excluded so a blink never touches teeth. Cheek rows just below the eyes are
// pure skin, which lets us detect each face's own skin colour.
const EYE_BAND_TOP = 5;
const EYE_BAND_BOTTOM = 10;
const CHEEK_ROWS = [10, 11];

/**
 * Face-tone palette keys. Deliberately excludes the hair ramp (x/y/z, plus the
 * legacy 'h' looks draw their whole face in it, so it counts as a face tone)
 * and the ink outline 'K' — the dark-eye search below leans on this set to tell
 * "inside the face" from "hair or silhouette".
 */
const SKIN_KEYS = new Set(['d', 'm', 'n', 'S', 'L', 'h']);

/** Widest dark run we will accept as an eye. Anything broader is a brow or visor. */
const MAX_EYE_WIDTH = 3;

interface DarkEyePair {
  y: number;
  runs: Array<[number, number]>;
}

/**
 * Builds a closed-eye variant of a face by reading its own pixels.
 *
 * Faces drawn with eye whites ('W') close naturally: the upper eye row becomes
 * skin and the lower row becomes the dark outline colour ('K'). Roughly a
 * quarter of the cast has no whites at all — their eyes are dark dots or slits
 * in the outline colour — so those close by painting the dark eye pixels the
 * face's own skin, which reads as the eye vanishing for a frame.
 *
 * Returns null when the face has no open eyes to close: the joy/ko expressions
 * already squint, and some looks wear glasses or a hair curtain over the band.
 */
export function blinkRows(rows: string[]): string[] | null {
  return closeEyeWhites(rows) ?? closeDarkEyes(rows);
}

function closeEyeWhites(rows: string[]): string[] | null {
  const eyeRows: number[] = [];
  for (let y = EYE_BAND_TOP; y <= EYE_BAND_BOTTOM && y < rows.length; y += 1) {
    if (rows[y].includes('W')) eyeRows.push(y);
  }
  if (eyeRows.length === 0) return null;
  const skin = detectSkinChar(rows);
  const lower = eyeRows[eyeRows.length - 1];
  return rows.map((row, y) => {
    if (!eyeRows.includes(y)) return row;
    return y === lower ? row.replace(/W/g, 'K') : row.replace(/W/g, skin);
  });
}

function closeDarkEyes(rows: string[]): string[] | null {
  const skin = detectSkinChar(rows);
  // Cheeks that aren't skin mean the band is hair, a helmet or a mask — we have
  // no colour to close the eye with, so leave the face alone.
  if (!SKIN_KEYS.has(skin)) return null;
  const pair = findDarkEyePair(rows);
  if (pair === null) return null;
  return rows.map((row, y) => (y === pair.y ? fillRuns(row, pair.runs, skin) : row));
}

/**
 * Finds the one row of the eye band holding a mirrored pair of dark eyes.
 *
 * An eye is a short run of outline pixels ringed on all eight sides by the
 * face's own skin — that margin is what separates it from the silhouette, from
 * hair strands and sideburn lines (which run vertically into other dark
 * pixels), and from the joy chevron and ko cross (whose arms touch each other
 * diagonally). The pair must also mirror across the sprite, which rules out a
 * lone nose dot or an off-centre blemish.
 *
 * The scan runs upward from the bottom of the band because brows and the
 * hairline sit above the eyes: the lowest mirrored pair is the eyes.
 */
function findDarkEyePair(rows: string[]): DarkEyePair | null {
  for (let y = Math.min(EYE_BAND_BOTTOM, rows.length - 2); y >= EYE_BAND_TOP; y -= 1) {
    const row = rows[y];
    if (row === undefined) continue;
    const runs: Array<[number, number]> = [];
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] !== 'K') continue;
      let end = x;
      while (end + 1 < row.length && row[end + 1] === 'K') end += 1;
      if (end - x + 1 <= MAX_EYE_WIDTH && isRingedBySkin(rows, y, x, end)) runs.push([x, end]);
      x = end;
    }
    if (runs.length !== 2) continue;
    const [left, right] = runs;
    const mirror = row.length - 1;
    if (left[1] + 1 >= right[0]) continue;
    if (left[0] + right[1] !== mirror || left[1] + right[0] !== mirror) continue;
    return { y, runs };
  }
  return null;
}

/** True when every pixel bordering the run — sides, above, below, corners — is skin. */
function isRingedBySkin(rows: string[], y: number, start: number, end: number): boolean {
  for (let ry = y - 1; ry <= y + 1; ry += 1) {
    const row = rows[ry];
    if (row === undefined) return false;
    for (let x = start - 1; x <= end + 1; x += 1) {
      if (ry === y && x >= start && x <= end) continue;
      if (!SKIN_KEYS.has(row[x] ?? '.')) return false;
    }
  }
  return true;
}

function fillRuns(row: string, runs: Array<[number, number]>, skin: string): string {
  let filled = row;
  for (const [start, end] of runs) {
    filled = filled.slice(0, start) + skin.repeat(end - start + 1) + filled.slice(end + 1);
  }
  return filled;
}

function detectSkinChar(rows: string[]): string {
  const counts = new Map<string, number>();
  for (const y of CHEEK_ROWS) {
    const row = rows[y];
    if (row === undefined) continue;
    for (const char of row) {
      if (char === '.' || char === 'K') continue;
      counts.set(char, (counts.get(char) ?? 0) + 1);
    }
  }
  let best = 'S';
  let bestCount = -1;
  for (const [char, count] of counts) {
    if (count > bestCount) {
      best = char;
      bestCount = count;
    }
  }
  return best;
}
