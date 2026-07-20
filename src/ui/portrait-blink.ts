// Pure blink synthesis for the pixel portraits. The face is run-length rows of
// palette keys; eyes live in the upper-face band and the mouth (row ~12) is
// excluded so a blink never touches teeth. Cheek rows just below the eyes are
// pure skin, which lets us detect each face's own skin colour.
const EYE_BAND_TOP = 5;
const EYE_BAND_BOTTOM = 10;
const CHEEK_ROWS = [10, 11];

/**
 * Builds a closed-eye variant of a face by reading its own pixels: eye whites
 * ('W') on the upper eye row become skin, and on the lower eye row become the
 * dark outline colour ('K') — a natural blink. Returns null when the face has
 * no open eyes to close (e.g. the joy/ko expressions already squint).
 */
export function blinkRows(rows: string[]): string[] | null {
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
