import { readFileSync } from 'fs';
import { join } from 'path';
import {
  faceFile,
  glyphSet,
  missingGlyphs,
  readFace,
  type Face,
  type Glyph,
  type GlyphPoint,
} from '../glyph-coverage';
import { loadCatalog, localeMeta } from '../index';

/**
 * The gates in §6 of
 * `docs/superpowers/specs/2026-08-06-vietnamese-pixel-diacritics.md`.
 *
 * `HFMSilkscreen` is stock Silkscreen with 102 Vietnamese letters appended. It
 * now draws every language in the game, so a mistake in the merge would not
 * quietly cost Vietnamese a diacritic — it would change what English, Spanish,
 * Portuguese, French, German and Indonesian look like on screen. That is what
 * makes the non-regression gate load-bearing rather than ceremonial.
 *
 * Not covered here, and deliberately: §6.5 (a Vietnamese reader naming tones off
 * a 1:1 device screenshot, both densities, both voices) and §6.7 (the mockup
 * gate, already run). Neither is a thing a Jest process can do.
 */

const CUTS = ['400Regular', '700Bold'] as const;
const stock = (cut: string) => faceFile(`Silkscreen_${cut}`);
const derived = (cut: string) => faceFile(`HFMSilkscreen_${cut}`);

/** Every letter Vietnamese needs — the base alphabet plus all five tones. */
const VIETNAMESE_LETTERS = (() => {
  const bases = ['a', 'ă', 'â', 'e', 'ê', 'i', 'o', 'ô', 'ơ', 'u', 'ư', 'y'];
  const tones = ['́', '̀', '̉', '̃', '̣'];
  const letters = new Set<string>(['ă', 'â', 'đ', 'ê', 'ô', 'ơ', 'ư']);
  for (const base of bases) {
    for (const tone of tones) letters.add((base + tone).normalize('NFC'));
  }
  return [...letters].flatMap(letter => [letter, letter.toUpperCase()]);
})();

interface MarkTable {
  cuts: Record<string, {
    codepoint: string;
    char: string;
    base: string;
    advance: number;
    inkWidth: number;
    compose: { baseMark: string | null; tone: string | null; horn: boolean; dotBelow: boolean; stacked: boolean };
    added: [number, number, number, number][];
  }[]>;
}
const markTable = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', 'content', 'fonts', 'vi-marks.json'), 'utf8'),
) as MarkTable;

// ---------------------------------------------------------------------------

describe('gate 6.1 — the face covers Vietnamese', () => {
  test('134 letters, in both cuts', () => {
    expect(VIETNAMESE_LETTERS).toHaveLength(134);
    for (const cut of CUTS) {
      const covered = glyphSet(derived(cut));
      expect({ cut, missing: missingGlyphs(VIETNAMESE_LETTERS.join(''), covered) })
        .toEqual({ cut, missing: [] });
    }
  });

  test('stock Silkscreen still cannot — so the gate is not vacuous', () => {
    expect(missingGlyphs(VIETNAMESE_LETTERS.join(''), glyphSet(stock('400Regular'))).length)
      .toBe(102);
  });

  test('both cuts cover exactly the same codepoints', () => {
    const [regular, bold] = CUTS.map(cut => [...glyphSet(derived(cut))].sort((a, b) => a - b).join(','));
    expect(regular).toBe(bold);
  });
});

// ---------------------------------------------------------------------------

/** Composites have no contour points, so compare whichever form the glyph is. */
function shapeOf(glyph: Glyph): unknown {
  return glyph.components === null
    ? { kind: 'simple', contours: glyph.contours.map(points => points.map(round)) }
    : { kind: 'composite', components: glyph.components };
}
const round = (point: GlyphPoint) => [point.x, point.y, point.onCurve];

describe('gate 6.2 — the original face is untouched', () => {
  /**
   * The tables the merge must never rewrite. `fpgm`/`prep`/`cvt `/`gasp` are
   * hinting, which really does execute on the Electron/Windows target;
   * `GPOS`/`GSUB`/`GDEF` address glyphs by ID, which is why new glyphs may only
   * ever be appended. Byte identity is the right assertion here precisely
   * because these are copied opaquely rather than recompiled.
   */
  const PASS_THROUGH = ['fpgm', 'prep', 'cvt ', 'gasp', 'GPOS', 'GSUB', 'GDEF'] as const;

  test.each(CUTS)('%s — every pass-through table is present and byte-identical', cut => {
    const before = readFace(stock(cut));
    const after = readFace(derived(cut));
    for (const tag of PASS_THROUGH) {
      const original = before.tables.get(tag);
      const copied = after.tables.get(tag);
      // "Present" is not pedantry: a lenient "if both have it, compare it"
      // passes the dropped-table case, which is the case this exists to catch.
      expect({ cut, tag, present: original !== undefined && copied !== undefined })
        .toEqual({ cut, tag, present: true });
      expect({ cut, tag, equal: original!.equals(copied!) })
        .toEqual({ cut, tag, equal: true });
    }
  });

  test.each(CUTS)('%s — glyph IDs 0..226 keep their geometry, metrics and hinting', cut => {
    const before = readFace(stock(cut));
    const after = readFace(derived(cut));
    expect(before.numGlyphs).toBe(227);
    expect(after.numGlyphs).toBe(227 + 102);

    // Walked by ID, not by codepoint: the face has 227 glyphs and 226 mapped
    // codepoints, so a codepoint walk cannot see the unmapped one — and a
    // composite could reference it.
    const differences: string[] = [];
    let composites = 0;
    for (let id = 0; id < before.numGlyphs; id += 1) {
      const original = before.glyph(id);
      const copied = after.glyph(id);
      if (original.components !== null) composites += 1;
      if (JSON.stringify(shapeOf(original)) !== JSON.stringify(shapeOf(copied))) {
        differences.push(`glyph ${id}: geometry`);
      }
      if (original.instructions !== copied.instructions) differences.push(`glyph ${id}: instructions`);
      if (before.metrics[id]!.advance !== after.metrics[id]!.advance) differences.push(`glyph ${id}: advance`);
      if (before.metrics[id]!.lsb !== after.metrics[id]!.lsb) differences.push(`glyph ${id}: lsb`);
    }
    expect({ cut, differences }).toEqual({ cut, differences: [] });
    // The composite count is the measured reason this gate flattens rather than
    // reading contour points: if it ever drops to zero, the reader broke.
    expect(composites).toBe(cut === '400Regular' ? 48 : 45);
  });

  test.each(CUTS)('%s — every original codepoint keeps its glyph, advance and sidebearing', cut => {
    const before = readFace(stock(cut));
    const after = readFace(derived(cut));
    const differences: string[] = [];
    for (const [code, glyph] of before.cmap) {
      const moved = after.cmap.get(code);
      if (moved !== glyph) differences.push(`U+${code.toString(16)}: glyph ${glyph} -> ${String(moved)}`);
      else if (before.metrics[glyph]!.advance !== after.metrics[glyph]!.advance
        || before.metrics[glyph]!.lsb !== after.metrics[glyph]!.lsb) {
        differences.push(`U+${code.toString(16)}: metrics`);
      }
    }
    expect({ cut, count: before.cmap.size, differences }).toEqual({ cut, count: 226, differences: [] });
  });

  test.each(CUTS)('%s — new glyphs are appended, never inserted', cut => {
    const before = readFace(stock(cut));
    const after = readFace(derived(cut));
    const appended = [...after.cmap.entries()].filter(([code]) => !before.cmap.has(code));
    expect(appended).toHaveLength(102);
    for (const [code, glyph] of appended) {
      expect({ code, appended: glyph >= before.numGlyphs }).toEqual({ code, appended: true });
    }
  });
});

// ---------------------------------------------------------------------------

describe('gate 6.3 — declared metrics are unchanged and no ink escapes the box', () => {
  test.each(CUTS)('%s — the vertical metrics every layout constant rests on', cut => {
    const face = readFace(derived(cut));
    expect({
      ascender: face.hhea.ascender,
      descender: face.hhea.descender,
      lineGap: face.hhea.lineGap,
      usWinAscent: face.os2.usWinAscent,
      usWinDescent: face.os2.usWinDescent,
      sTypoAscender: face.os2.sTypoAscender,
      sTypoDescender: face.os2.sTypoDescender,
      sTypoLineGap: face.os2.sTypoLineGap,
      unitsPerEm: face.unitsPerEm,
    }).toEqual({
      ascender: 1030,
      descender: -250,
      lineGap: 0,
      usWinAscent: 1000,
      usWinDescent: 250,
      sTypoAscender: 1030,
      sTypoDescender: -250,
      sTypoLineGap: 0,
      unitsPerEm: 1000,
    });

    const before = readFace(stock(cut));
    expect(face.hhea).toEqual(before.hhea);
    expect(face.os2.usWinAscent).toBe(before.os2.usWinAscent);
    expect(face.os2.usWinDescent).toBe(before.os2.usWinDescent);
  });

  test.each(CUTS)('%s — every new glyph fits inside [-250, 1000]', cut => {
    // y = 1000 is usWinAscent, above which Windows-family rasterisers clip, and
    // the Steam build is Electron. The floor is as load-bearing as the ceiling:
    // `Ç ç` already sit on it and dot-below is drawn into that band.
    const face = readFace(derived(cut));
    const offenders: string[] = [];
    for (let id = 227; id < face.numGlyphs; id += 1) {
      for (const contour of face.glyph(id).outline) {
        for (const point of contour) {
          if (point.y < -250 || point.y > 1000) offenders.push(`glyph ${id}: y=${point.y}`);
        }
      }
    }
    expect({ cut, offenders }).toEqual({ cut, offenders: [] });
  });

  test.each(CUTS)('%s — the append checklist landed', cut => {
    const face = readFace(derived(cut));
    expect(face.numberOfHMetrics).toBe(face.numGlyphs);
    // Latin Extended Additional (U+1E00–U+1EFF), where most of Vietnamese lives.
    expect((face.os2.ulUnicodeRange[0]! >>> 29) & 1).toBe(1);
    // xAvgCharWidth is an average over the whole face, so 102 new glyphs move it.
    expect(face.os2.xAvgCharWidth).not.toBe(readFace(stock(cut)).os2.xAvgCharWidth);
  });
});

// ---------------------------------------------------------------------------

describe('gate 6.4 — advances', () => {
  test.each(CUTS)('%s — an accented form keeps its base advance', cut => {
    const face = readFace(derived(cut));
    const advance = (character: string) => face.metrics[face.cmap.get(character.codePointAt(0)!)!]!.advance;
    const offenders: string[] = [];
    for (const entry of markTable.cuts[cut]!) {
      if (entry.char === 'đ' || entry.char === 'Đ') continue; // a new base letter, not an accent
      if (advance(entry.char) !== advance(entry.base)) {
        offenders.push(`${entry.char}: ${advance(entry.char)} vs ${entry.base} ${advance(entry.base)}`);
      }
    }
    expect({ cut, offenders }).toEqual({ cut, offenders: [] });
  });

  test.each(CUTS)('%s — the horn costs nothing, or one pixel, and nothing else', cut => {
    // §3's outcome recorded rather than assumed: the horn ships in the existing
    // right sidebearing, so option (a') means the first branch below.
    const face = readFace(derived(cut));
    const advance = (character: string) => face.metrics[face.cmap.get(character.codePointAt(0)!)!]!.advance;
    for (const [horned, base] of [['ơ', 'o'], ['ư', 'u'], ['Ơ', 'O'], ['Ư', 'U'],
      ['ớ', 'o'], ['ờ', 'o'], ['ở', 'o'], ['ỡ', 'o'], ['ợ', 'o'],
      ['ứ', 'u'], ['ừ', 'u'], ['ử', 'u'], ['ữ', 'u'], ['ự', 'u']] as const) {
      expect({ cut, horned, advance: advance(horned) })
        .toEqual({ cut, horned, advance: advance(base) });
    }
  });

  test('the measured column tables still fit, in the face they will be drawn in', () => {
    // Belt and braces for gates 8/8b, which measure `advanceEm` against the
    // registered family: if the derivative had moved a Latin advance, this is
    // where a column-width regression would surface first.
    const face = readFace(derived('700Bold'));
    const before = readFace(stock('700Bold'));
    for (const character of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-$') {
      const code = character.codePointAt(0)!;
      expect({ character, advance: face.metrics[face.cmap.get(code)!]!.advance })
        .toEqual({ character, advance: before.metrics[before.cmap.get(code)!]!.advance });
    }
  });
});

// ---------------------------------------------------------------------------

describe('gate 6.6 — the sub-pixel rows survive the smallest shipped type', () => {
  /**
   * A Scheme A sub-row is half a design pixel, so the quantum is em/16, not
   * em/8. The smallest shipped prose is 8 pt (`text-[8px]`, `fontSize: 8`), and
   * the marginal density is @2x — an iPhone SE class device, not Joe's @3x
   * phone, which is the easy case.
   */
  const SMALLEST_SHIPPED_POINTS = 8;
  const LOWEST_DENSITY = 2;

  test('em/16 is at least one device pixel at 8 pt @2x', () => {
    const devicePixelsPerEm = SMALLEST_SHIPPED_POINTS * LOWEST_DENSITY;
    expect(devicePixelsPerEm / 16).toBeGreaterThanOrEqual(1);
  });

  test('the sub-row heights are the integer table the spec fixed', () => {
    // 62.5 cannot be stored in a glyf coordinate. The rows alternate 63 and 62,
    // both marks get two sub-rows of solid ink, and both gaps survive.
    const bands = (markTable as unknown as { bands: Record<string, [number, number]> }).bands;
    expect(bands).toMatchObject({
      TONE_HI: [938, 1000],
      TONE_LO: [875, 938],
      GAP_HI: [813, 875],
      BASE_HI: [750, 813],
      BASE_LO: [688, 750],
      GAP_LO: [625, 688],
    });
    for (const [name, [low, high]] of Object.entries(bands)) {
      expect({ name, integral: Number.isInteger(low) && Number.isInteger(high) })
        .toEqual({ name, integral: true });
    }
  });
});

// ---------------------------------------------------------------------------

describe('gate 6.8 — Vietnamese copy is NFC and drawable', () => {
  test('every string in the vi catalog, plus the endonym, is NFC', () => {
    // A decomposed `e + U+0302 + U+0301` misses the precomposed glyph but still
    // renders *something*, through mark-attachment anchors this project has
    // never verified — silent wrongness, not a visible tofu box. And because
    // U+0300–U+0304 are in the cmap, only the NFC assertion catches it.
    const offenders: string[] = [];
    for (const [key, value] of Object.entries(loadCatalog('vi').strings)) {
      if (value.normalize('NFC') !== value) offenders.push(key);
    }
    expect(offenders).toEqual([]);
    expect(localeMeta('vi').endonym.normalize('NFC')).toBe(localeMeta('vi').endonym);
  });

  test('every character of the vi catalog is in the face', () => {
    const covered = glyphSet(derived('700Bold'));
    const text = [localeMeta('vi').endonym, ...Object.values(loadCatalog('vi').strings)].join('');
    expect(missingGlyphs(text, covered)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('gate 6.9 — every new glyph round-trips against its coordinate table', () => {
  /**
   * The only gate that covers most of the new glyphs.
   *
   * §6.1 checks a glyph *exists*, §6.2 checks only the original 226, and §6.5's
   * human reader sees about fifteen lowercase letters across three word sets.
   * For the other ~87 — including every uppercase toned form — nothing else in
   * this file ever looks at the shape. A generator handing `Ẩ` the tilde that
   * belongs to `Ẫ` would pass every other check and first appear on a screen.
   */

  /** Which whole design cells a glyph fills, from the built outline. */
  function cellsOf(face: Face, id: number): Set<string> {
    const contours = face.glyph(id).outline.map(points => points.map(point => [point.x, point.y] as const));
    const filled = new Set<string>();
    for (let column = -2; column <= 10; column += 1) {
      for (let row = -3; row <= 8; row += 1) {
        for (const [y0, y1] of [[0, 62], [63, 124]]) {
          const x = column * 125 + 62;
          const y = row * 125 + (y0 + y1) / 2;
          if (winding(contours, x, y)) filled.add(`${column},${row},${y0}`);
        }
      }
    }
    return filled;
  }

  function winding(contours: readonly (readonly (readonly [number, number])[])[], x: number, y: number): boolean {
    let count = 0;
    for (const contour of contours) {
      for (let index = 0; index < contour.length; index += 1) {
        const [x0, y0] = contour[index]!;
        const [x1, y1] = contour[(index + 1) % contour.length]!;
        if (y0 <= y && y1 > y) {
          if ((x1 - x0) * (y - y0) - (x - x0) * (y1 - y0) > 0) count += 1;
        } else if (y1 <= y && y0 > y) {
          if ((x1 - x0) * (y - y0) - (x - x0) * (y1 - y0) < 0) count -= 1;
        }
      }
    }
    return count !== 0;
  }

  function expectedCells(base: Set<string>, added: readonly [number, number, number, number][]): Set<string> {
    const filled = new Set(base);
    for (const [x0, y0, x1, y1] of added) {
      for (let column = -2; column <= 10; column += 1) {
        for (let row = -3; row <= 8; row += 1) {
          for (const [lo, hi] of [[0, 62], [63, 124]]) {
            const x = column * 125 + 62;
            const y = row * 125 + (lo + hi) / 2;
            if (x > x0 && x < x1 && y > y0 && y < y1) filled.add(`${column},${row},${lo}`);
          }
        }
      }
    }
    return filled;
  }

  test.each(CUTS)('%s — 102 glyphs equal base outline plus their listed rectangles', cut => {
    const face = readFace(derived(cut));
    const entries = markTable.cuts[cut]!;
    expect(entries).toHaveLength(102);

    const offenders: string[] = [];
    for (const entry of entries) {
      const id = face.cmap.get(entry.char.codePointAt(0)!);
      if (id === undefined) {
        offenders.push(`${entry.char}: not in the cmap`);
        continue;
      }
      const baseId = face.cmap.get(entry.base.codePointAt(0)!)!;
      const expected = expectedCells(cellsOf(face, baseId), entry.added);
      const actual = cellsOf(face, id);
      const missing = [...expected].filter(cell => !actual.has(cell));
      const extra = [...actual].filter(cell => !expected.has(cell));
      if (missing.length > 0 || extra.length > 0) {
        offenders.push(`${entry.char} (${entry.codepoint}): missing ${missing.join(' ')} extra ${extra.join(' ')}`);
      }
      if (face.metrics[id]!.advance !== entry.advance) {
        offenders.push(`${entry.char}: advance ${face.metrics[id]!.advance} vs table ${entry.advance}`);
      }
    }
    expect({ cut, offenders }).toEqual({ cut, offenders: [] });
  });

  test.each(CUTS)('%s — no two letters share a tone, and no tone is the wrong one', cut => {
    // The named failure mode: `Ẩ` handed the tilde that belongs to `Ẫ`. The
    // round trip above proves the font matches the table; this proves the table
    // is internally consistent, so a swap in the generator cannot hide in it.
    const entries = markTable.cuts[cut]!;
    const canonical = new Map<string, string>();
    const offenders: string[] = [];
    for (const entry of entries) {
      const bands = entry.compose.stacked ? [938, 875] : [875, 750];
      const tone = entry.added
        .filter(([, y0]) => bands.includes(y0))
        .map(([x0, y0]) => `${x0 / 125}@${y0 === bands[0] ? 'hi' : 'lo'}`)
        .sort()
        .join(' ');
      if (entry.compose.tone === null) continue;
      const key = `${entry.compose.tone}/${entry.inkWidth}`;
      const seen = canonical.get(key);
      if (seen === undefined) canonical.set(key, tone);
      else if (seen !== tone) offenders.push(`${entry.char}: ${key} drawn as "${tone}", elsewhere "${seen}"`);
    }
    expect({ cut, offenders }).toEqual({ cut, offenders: [] });
    // Five tones over four ink widths, minus the combinations Vietnamese never
    // uses — enough distinct shapes that the check above is not vacuous.
    expect(canonical.size).toBeGreaterThanOrEqual(8);
  });
});

// ---------------------------------------------------------------------------

describe('licence and naming', () => {
  test('the OFL text ships beside the TTFs', () => {
    const licence = readFileSync(join(__dirname, '..', '..', '..', 'assets', 'fonts', 'OFL.txt'), 'utf8');
    expect(licence).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(licence).toContain('Copyright 2001 The Silkscreen Project Authors');
  });

  test.each(CUTS)('%s — name IDs 1/3/4/6 are distinct and 13/14 are the original OFL records', cut => {
    const names = readNameTable(derived(cut));
    const original = readNameTable(stock(cut));
    for (const nameID of [1, 3, 4, 6]) {
      expect({ nameID, name: names.get(nameID) }).not.toEqual({ nameID, name: original.get(nameID) });
      expect(names.get(nameID)).toContain('HFM');
    }
    // Silkscreen declares no Reserved Font Name, so the renaming is unrestricted
    // — but the licence records themselves must travel with the derivative.
    expect(names.get(13)).toBe(original.get(13));
    expect(names.get(14)).toBe(original.get(14));
    expect(names.get(0)).toContain('Copyright 2001 The Silkscreen Project Authors');
    expect(names.get(0)).toContain('Derived from');
  });
});

function readNameTable(path: string): Map<number, string> {
  const bytes = readFace(path).tables.get('name')!;
  const count = bytes.readUInt16BE(2);
  const storage = bytes.readUInt16BE(4);
  const found = new Map<number, string>();
  for (let index = 0; index < count; index += 1) {
    const at = 6 + index * 12;
    if (bytes.readUInt16BE(at) !== 3) continue; // Windows platform records only
    const length = bytes.readUInt16BE(at + 8);
    const offset = bytes.readUInt16BE(at + 10);
    found.set(
      bytes.readUInt16BE(at + 6),
      Buffer.from(bytes.subarray(storage + offset, storage + offset + length)).swap16().toString('utf16le'),
    );
  }
  return found;
}
