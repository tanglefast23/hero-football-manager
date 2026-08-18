/**
 * The 3x5 pixel alphabet drawn ON the pitch — incapacity countdowns and the
 * name that rides above a substituted player's head.
 *
 * Pure TS on purpose (no react-native/Skia imports), same reason as
 * `interpolate.ts`: Jest can exercise it headless while MatchScreen cannot be
 * imported under the test runner.
 *
 * Three source pixels wide is the whole design constraint. It is what makes a
 * digit stand 10px against a 30px body and still read at a glance, and it is
 * why M and N lean on one shared diagonal — at this size the alternative is a
 * wider cell, which would put a nameplate across half the pitch.
 */

export const GLYPH_WIDTH = 3;
export const GLYPH_HEIGHT = 5;
/** Blank column between characters, so "12" does not read as one blob. */
export const GLYPH_GAP = 1;

/** Row-major, one character per pixel. Keyed by the character it draws. */
const GLYPH_ROWS: Readonly<Record<string, string>> = {
  '0': '111101101101111',
  '1': '010010010010010',
  '2': '111001111100111',
  '3': '111001111001111',
  '4': '101101111001001',
  '5': '111100111001111',
  '6': '111100111101111',
  '7': '111001001001001',
  '8': '111101111101111',
  '9': '111101111001111',
  A: '111101111101101',
  B: '110101110101110',
  C: '111100100100111',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '111100101101111',
  H: '101101111101101',
  I: '111010010010111',
  J: '001001001101111',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '110111101101101',
  O: '111101101101111',
  P: '111101111100100',
  Q: '111101101111001',
  R: '111101111110101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  Z: '111001010100111',
  '!': '010010010000010',
  "'": '010010000000000',
  '-': '000000111000000',
  '.': '000000000000010',
  ' ': '000000000000000',
};

/**
 * Characters `DRAWABLE_NAME` allows that carry no glyph of their own and do
 * not decompose under NFD. Everything else accented — including every
 * Vietnamese vowel, whose horns and tone marks all land in U+0300..U+036F —
 * is handled by the strip below.
 */
const FOLD_PAIRS: readonly (readonly [string, string])[] = [
  ['Đ', 'D'],
  ['Ð', 'D'],
  ['Ø', 'O'],
  ['Œ', 'OE'],
  ['Æ', 'AE'],
  ['ß', 'SS'],
  ['Ł', 'L'],
];

const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Accented Latin down to the letters this alphabet has. `Nguyễn` becomes
 * `NGUYEN`, not `NGUYN`: dropping the letter would misspell a real player's
 * name, which is worse than dropping its tone mark.
 */
export function foldToDrawable(text: string): string {
  let folded = text.toUpperCase();
  for (const [from, to] of FOLD_PAIRS) folded = folded.split(from).join(to);
  // Hermes has shipped String.prototype.normalize for years, but a missing
  // implementation must degrade to "skip the letter", never to a crash.
  if (typeof folded.normalize === 'function')
    folded = folded.normalize('NFD').replace(COMBINING_MARKS, '');
  return folded;
}

export interface PixelGlyph {
  /** Lit cells, origin at the glyph's top-left. */
  pixels: readonly { x: number; y: number }[];
  width: number;
  height: number;
}

const EMPTY_GLYPH: PixelGlyph = { pixels: [], width: 0, height: 0 };

/** Lays out `text` as pixel cells. Unknown characters are dropped. */
export function pixelGlyph(text: string): PixelGlyph {
  const drawable = [...text].filter((character) => character in GLYPH_ROWS);
  if (drawable.length === 0) return EMPTY_GLYPH;
  const pixels: { x: number; y: number }[] = [];
  drawable.forEach((character, index) => {
    const rows = GLYPH_ROWS[character];
    const left = index * (GLYPH_WIDTH + GLYPH_GAP);
    for (let cell = 0; cell < rows.length; cell += 1) {
      if (rows[cell] !== '1') continue;
      pixels.push({
        x: left + (cell % GLYPH_WIDTH),
        y: Math.floor(cell / GLYPH_WIDTH),
      });
    }
  });
  return {
    pixels,
    width: drawable.length * GLYPH_WIDTH + (drawable.length - 1) * GLYPH_GAP,
    height: GLYPH_HEIGHT,
  };
}

/**
 * The longest name a pitch-side plate may draw. Names run to 24 characters,
 * and 24 of these cells is wider than a phone's whole pitch.
 */
export const MAX_NAME_CHARACTERS = 10;

/** The last whitespace-separated word of a name, folded and uppercased. */
export function lastName(name: string): string {
  const words = name.trim().split(/\s+/u);
  return foldToDrawable(words[words.length - 1] ?? '');
}

/**
 * The plate's own measurements, in SOURCE pixels — the sprite cell is 24x30, so
 * its top edge is 15 above the drawn centre and a name floats 3 clear of that.
 * Shared with `IncapacityCountdowns`, which floats its number the same way.
 */
export const SPRITE_HALF_HEIGHT_PX = 15;
export const HEAD_CLEARANCE_PX = 3;
/** Each glyph cell is two source pixels square: a 3x5 letter stands 10px tall. */
export const CELL_SOURCE_PX = 2;
export const PLATE_PADDING_PX = 2;

export interface NameplateBox {
  /** One glyph cell, in dp. */
  readonly cell: number;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * Where a name's plate sits relative to the player's DRAWN CENTRE, in dp.
 *
 * `pixel` is `scale * playerDrawScale` — dp per sprite source pixel. Sizes are
 * derived from it and never multiplied by the pitch `scale` a second time:
 * `scale` alone runs about 0.06, and a size put through it lands sub-pixel and
 * draws nothing at all. That bug shipped once already, as an invisible flame.
 */
export function nameplateBox(glyph: PixelGlyph, pixel: number): NameplateBox {
  const cell = CELL_SOURCE_PX * pixel;
  const bottom = -(SPRITE_HALF_HEIGHT_PX + HEAD_CLEARANCE_PX) * pixel;
  return {
    cell,
    left: -(glyph.width * cell) / 2,
    top: bottom - glyph.height * cell,
    right: (glyph.width * cell) / 2,
    bottom,
  };
}

/**
 * A player's last name as pixel cells. An empty result means "draw no plate" —
 * a name with nothing drawable in it must leave the pitch clean rather than
 * float an empty box over somebody's head.
 */
export function nameGlyph(name: string): PixelGlyph {
  return pixelGlyph(lastName(name).slice(0, MAX_NAME_CHARACTERS));
}
