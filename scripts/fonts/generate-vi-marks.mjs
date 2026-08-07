/**
 * Write `content/fonts/vi-marks.json` — the coordinate table the font is built
 * from, and the table the round-trip gate (§6.9) checks the built font against.
 *
 * The table is deliberately literal: one entry per new codepoint, per cut, with
 * the *added* rectangles spelled out in font units. Only the new ink is listed —
 * the base letter's outline is copied through from stock Silkscreen unmodified,
 * which is the append-only rule (§5) working at glyph level.
 *
 * Run through `npm run build:fonts`, which regenerates the table and then builds
 * the TTFs from it.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readFace, glyphContours } from './lib/sfnt.mjs';
import {
  BANDS,
  CELL,
  DOT_BELOW,
  FULL,
  HORN_ROWS,
  Y_SHIFT_FROM,
  Y_WIDTH,
  cellRects,
  shiftColumns,
} from './lib/marks.mjs';

const require_ = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CUTS = ['400Regular', '700Bold'];

export function stockFace(cut) {
  const manifest = require_.resolve(
    '@expo-google-fonts/silkscreen/package.json',
  );
  return join(dirname(manifest), cut, `Silkscreen_${cut}.ttf`);
}

/**
 * Which design cells a stock glyph fills, sampled at cell centres.
 *
 * Silkscreen's letters are not perfectly on the 125 lattice — its counters are
 * inset a few units — but its *marks* are exact, which is why a mark can be
 * rebuilt from cells and a letter cannot. Letters are copied as points.
 */
export function cellsOf(face, character) {
  const glyph = face.cmap.get(character.codePointAt(0));
  if (glyph === undefined) return null;
  const contours = glyphContours(face, glyph).map((contour) =>
    contour.map((point) => [point.x, point.y]),
  );
  const advance = face.metrics[glyph].advance;
  const filled = [];
  for (let column = -1; column <= advance / CELL + 1; column += 1) {
    for (let row = -3; row <= 8; row += 1) {
      if (inside(contours, column * CELL + CELL / 2, row * CELL + CELL / 2))
        filled.push([column, row]);
    }
  }
  return { advance, filled };
}

function inside(contours, x, y) {
  let winding = 0;
  for (const contour of contours) {
    for (let index = 0; index < contour.length; index += 1) {
      const [x0, y0] = contour[index];
      const [x1, y1] = contour[(index + 1) % contour.length];
      if (y0 <= y && y1 > y) {
        if ((x1 - x0) * (y - y0) - (x - x0) * (y1 - y0) > 0) winding += 1;
      } else if (y1 <= y && y0 > y) {
        if ((x1 - x0) * (y - y0) - (x - x0) * (y1 - y0) < 0) winding -= 1;
      }
    }
  }
  return winding !== 0;
}

/** The ink columns of a base letter, which is what selects a mark table. */
function inkWidth(face, character) {
  const { filled } = cellsOf(face, character);
  const body = filled.filter(([, row]) => row >= 0 && row <= 4);
  return (
    Math.max(...body.map(([column]) => column)) -
    Math.min(...body.map(([column]) => column)) +
    1
  );
}

const COMBINING = {
  acute: '́',
  grave: '̀',
  tilde: '̃',
  hook: '̉',
  circ: '̂',
  breve: '̆',
  dot: '̣',
};

/** The precomposed character for base + mark, if Unicode has one. */
function precomposed(base, mark) {
  const composed = (base + COMBINING[mark]).normalize('NFC');
  return [...composed].length === 1 ? composed : null;
}

/**
 * The cells a mark occupies over a given base, in a given cut.
 *
 * Stock wins when stock has an opinion. Silkscreen draws Regular `Ô` with the
 * narrow circumflex it gives `ê` rather than the wide one it gives `ô` — an
 * inconsistency in the shipped face, but `Ô` is on screen today and `Ố Ồ Ổ Ỗ Ộ`
 * have to look like the same letter, so the new glyphs follow it.
 */
function markCells(face, cut, base, mark, table) {
  const stock = precomposed(base, mark);
  if (stock !== null && face.cmap.has(stock.codePointAt(0))) {
    const rows = {};
    for (const [column, row] of cellsOf(face, stock).filled) {
      if (row < 5) continue;
      (rows[row] ??= []).push(column);
    }
    for (const row of Object.keys(rows)) rows[row].sort((a, b) => a - b);
    if (Object.keys(rows).length > 0)
      return { cells: rows, from: `stock ${stock}` };
  }
  return { cells: table[mark], from: 'approved mockup table' };
}

/** base letter, base mark (drawn above), tone, horn, dot below. */
const LETTERS = [
  ['ả', 'a', null, 'hook', false, false],
  ['ạ', 'a', null, null, false, true],
  ['ă', 'a', 'breve', null, false, false],
  ['ắ', 'a', 'breve', 'acute', false, false],
  ['ằ', 'a', 'breve', 'grave', false, false],
  ['ẳ', 'a', 'breve', 'hook', false, false],
  ['ẵ', 'a', 'breve', 'tilde', false, false],
  ['ặ', 'a', 'breve', null, false, true],
  ['ấ', 'a', 'circ', 'acute', false, false],
  ['ầ', 'a', 'circ', 'grave', false, false],
  ['ẩ', 'a', 'circ', 'hook', false, false],
  ['ẫ', 'a', 'circ', 'tilde', false, false],
  ['ậ', 'a', 'circ', null, false, true],
  ['ẻ', 'e', null, 'hook', false, false],
  ['ẽ', 'e', null, 'tilde', false, false],
  ['ẹ', 'e', null, null, false, true],
  ['ế', 'e', 'circ', 'acute', false, false],
  ['ề', 'e', 'circ', 'grave', false, false],
  ['ể', 'e', 'circ', 'hook', false, false],
  ['ễ', 'e', 'circ', 'tilde', false, false],
  ['ệ', 'e', 'circ', null, false, true],
  ['ỉ', 'i', null, 'hook', false, false],
  ['ĩ', 'i', null, 'tilde', false, false],
  ['ị', 'i', null, null, false, true],
  ['ỏ', 'o', null, 'hook', false, false],
  ['ọ', 'o', null, null, false, true],
  ['ố', 'o', 'circ', 'acute', false, false],
  ['ồ', 'o', 'circ', 'grave', false, false],
  ['ổ', 'o', 'circ', 'hook', false, false],
  ['ỗ', 'o', 'circ', 'tilde', false, false],
  ['ộ', 'o', 'circ', null, false, true],
  ['ơ', 'o', null, null, true, false],
  ['ớ', 'o', null, 'acute', true, false],
  ['ờ', 'o', null, 'grave', true, false],
  ['ở', 'o', null, 'hook', true, false],
  ['ỡ', 'o', null, 'tilde', true, false],
  ['ợ', 'o', null, null, true, true],
  ['ủ', 'u', null, 'hook', false, false],
  ['ũ', 'u', null, 'tilde', false, false],
  ['ụ', 'u', null, null, false, true],
  ['ư', 'u', null, null, true, false],
  ['ứ', 'u', null, 'acute', true, false],
  ['ừ', 'u', null, 'grave', true, false],
  ['ử', 'u', null, 'hook', true, false],
  ['ữ', 'u', null, 'tilde', true, false],
  ['ự', 'u', null, null, true, true],
  ['ỳ', 'y', null, 'grave', false, false],
  ['ỷ', 'y', null, 'hook', false, false],
  ['ỹ', 'y', null, 'tilde', false, false],
  ['ỵ', 'y', null, null, false, true],
  // Silkscreen already draws U+00F0 as a stroked D — which is exactly the shape
  // of Vietnamese `đ`, in a face whose lowercase and uppercase are the same
  // letterform. So `đ` is that glyph, copied, rather than a new stroke design.
  ['đ', 'ð', null, null, false, false],
];

/** The uppercase half is the same construction against the same ink widths. */
const UPPERCASE_BASE = {
  a: 'A',
  e: 'E',
  i: 'I',
  o: 'O',
  u: 'U',
  y: 'Y',
  ð: 'Ð',
};

function allLetters() {
  const rows = [];
  for (const [character, base, baseMark, tone, horn, dotBelow] of LETTERS) {
    rows.push({ character, base, baseMark, tone, horn, dotBelow });
    const upper = character.toUpperCase();
    if ([...upper].length !== 1 || upper === character) {
      throw new Error(`no single-character uppercase for ${character}`);
    }
    rows.push({
      character: upper,
      base: UPPERCASE_BASE[base],
      baseMark,
      tone,
      horn,
      dotBelow,
    });
  }
  return rows;
}

function markTable(face, cut, width) {
  if (width === Y_WIDTH[cut]) {
    return shiftColumns(
      FULL[cut][Y_SHIFT_FROM[cut]],
      width - Y_SHIFT_FROM[cut],
    );
  }
  const table = FULL[cut][width];
  if (table === undefined)
    throw new Error(`no mark table for ${cut} width ${width}`);
  return table;
}

function dotColumns(cut, width) {
  if (width === Y_WIDTH[cut]) {
    return DOT_BELOW[cut][Y_SHIFT_FROM[cut]].map(
      (column) => column + (width - Y_SHIFT_FROM[cut]),
    );
  }
  const columns = DOT_BELOW[cut][width];
  if (columns === undefined)
    throw new Error(`no dot-below for ${cut} width ${width}`);
  return columns;
}

function build(cut) {
  const face = readFace(readFileSync(stockFace(cut)));
  const provenance = [];
  const glyphs = allLetters().map((letter) => {
    const { character, base, baseMark, tone, horn, dotBelow } = letter;
    const glyph = face.cmap.get(base.codePointAt(0));
    if (glyph === undefined) throw new Error(`stock Silkscreen has no ${base}`);
    const advance = face.metrics[glyph].advance;
    const width = inkWidth(face, base);
    const table = markTable(face, cut, width);
    const stacked = baseMark !== null && tone !== null;
    const added = [];

    if (horn) {
      // The existing right sidebearing, not an extra column: the advance is
      // untouched and the next letter still contributes its own left sidebearing.
      const column = advance / CELL - 1;
      for (const row of HORN_ROWS)
        added.push(...cellRects([column], [row * CELL, (row + 1) * CELL]));
    }
    if (dotBelow) added.push(...cellRects(dotColumns(cut, width), BANDS.BELOW));

    if (baseMark !== null) {
      const { cells, from } = markCells(face, cut, base, baseMark, table);
      const [hi, lo] = stacked
        ? [BANDS.BASE_HI, BANDS.BASE_LO]
        : [BANDS.FULL_HI, BANDS.FULL_LO];
      added.push(
        ...cellRects(cells[7] ?? [], hi),
        ...cellRects(cells[6] ?? [], lo),
      );
      provenance.push(`${character} ${baseMark}: ${from}`);
    }
    if (tone !== null) {
      const { cells, from } = markCells(face, cut, base, tone, table);
      const [hi, lo] = stacked
        ? [BANDS.TONE_HI, BANDS.TONE_LO]
        : [BANDS.FULL_HI, BANDS.FULL_LO];
      added.push(
        ...cellRects(cells[7] ?? [], hi),
        ...cellRects(cells[6] ?? [], lo),
      );
      provenance.push(`${character} ${tone}: ${from}`);
    }

    added.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return {
      codepoint: `U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`,
      char: character,
      base,
      advance,
      inkWidth: width,
      compose: { baseMark, tone, horn, dotBelow, stacked },
      added,
    };
  });
  return { face, glyphs, provenance };
}

function main() {
  const cuts = {};
  let count = 0;
  for (const cut of CUTS) {
    const { glyphs } = build(cut);
    cuts[cut] = glyphs;
    count = glyphs.length;

    const codepoints = new Set(glyphs.map((glyph) => glyph.codepoint));
    if (codepoints.size !== glyphs.length)
      throw new Error(`${cut}: duplicate codepoint`);
    for (const glyph of glyphs) {
      for (const [, y0, , y1] of glyph.added) {
        if (y0 < -250 || y1 > 1000) {
          throw new Error(
            `${cut} ${glyph.char}: ink outside [-250, 1000] — ${y0}..${y1}`,
          );
        }
      }
    }
  }

  // The two cuts must describe the same repertoire or one weight of the UI
  // would silently lose letters.
  const [regular, bold] = CUTS.map((cut) =>
    cuts[cut].map((glyph) => glyph.codepoint).join(','),
  );
  if (regular !== bold)
    throw new Error('the two cuts do not cover the same codepoints');

  const table = {
    _note:
      'Generated by scripts/fonts/generate-vi-marks.mjs. Source of truth for ' +
      'the Vietnamese glyphs in assets/fonts/HFMSilkscreen_*.ttf; see ' +
      'docs/superpowers/specs/2026-08-06-vietnamese-pixel-diacritics.md. ' +
      '`added` is the NEW ink only, in font units — the base letter is copied ' +
      'through from stock Silkscreen unmodified.',
    unitsPerEm: 1000,
    cell: CELL,
    bands: BANDS,
    hornRows: HORN_ROWS,
    derivedFrom: 'Silkscreen (@expo-google-fonts/silkscreen)',
    cuts,
  };
  mkdirSync(join(ROOT, 'content', 'fonts'), { recursive: true });
  writeFileSync(
    join(ROOT, 'content', 'fonts', 'vi-marks.json'),
    `${JSON.stringify(table, null, 1)}\n`,
  );
  process.stdout.write(
    `vi-marks.json: ${count} glyphs x ${CUTS.length} cuts\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
