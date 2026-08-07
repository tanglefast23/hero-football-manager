/**
 * Build `assets/fonts/HFMSilkscreen_{400Regular,700Bold}.ttf`.
 *
 * Stock Silkscreen with 102 Vietnamese letters appended, per
 * `docs/superpowers/specs/2026-08-06-vietnamese-pixel-diacritics.md`. The rules
 * that make this safe for the other six languages, all enforced here and
 * re-checked by `src/i18n/__tests__/vietnamese-face.test.ts`:
 *
 * - **Append only.** The original `glyf` records — outlines *and* their hinting
 *   instructions — are copied as bytes, at the same glyph IDs. `fpgm`, `prep`,
 *   `cvt `, `gasp`, `GPOS`, `GSUB` and `GDEF` are copied whole and never parsed.
 *   `ttfautohint` is never re-run.
 * - **New glyphs go at the END of glyph order.** `GPOS`/`GSUB`/`GDEF` address
 *   glyphs by ID and are preserved byte-for-byte, so an insertion anywhere else
 *   would silently repoint their coverage tables.
 * - **New glyphs ship unhinted**, and inside the [−250, 1000] envelope the face
 *   already occupies — y = 1000 is `OS/2.usWinAscent`, a hard clip bound on the
 *   Electron/Windows target rather than a stylistic one.
 *
 * Usage: `npm run build:fonts` (regenerates the coordinate table first).
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  encodeCmap,
  encodeNames,
  encodePost,
  encodeSimpleGlyph,
  glyphContours,
  readFace,
  readNames,
  readPost,
  writeFont,
} from './lib/sfnt.mjs';
import { rectsToContours } from './lib/outline.mjs';
import { stockFace } from './generate-vi-marks.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CUTS = {
  '400Regular': { subfamily: 'Regular', postScript: 'HFMSilkscreen-Regular' },
  '700Bold': { subfamily: 'Bold', postScript: 'HFMSilkscreen-Bold' },
};
const FAMILY = 'HFM Silkscreen';
const DERIVATION =
  'Vietnamese letters added for Hero Football Manager. Derived from ' +
  'Silkscreen by Jason Kottke; the original outlines, hinting instructions and ' +
  'metrics are unmodified.';

/** Tables copied through untouched, in the order they sit in the stock file. */
const PHYSICAL_ORDER = [
  'gasp',
  'maxp',
  'hhea',
  'head',
  'cvt ',
  'OS/2',
  'GDEF',
  'prep',
  'GSUB',
  'loca',
  'post',
  'cmap',
  'GPOS',
  'hmtx',
  'name',
  'fpgm',
  'glyf',
];

function utf16(text) {
  return Buffer.from(text, 'utf16le').swap16();
}

function buildCut(cut, table) {
  const stock = readFileSync(stockFace(cut));
  const face = readFace(stock);
  const glyphs = table.cuts[cut];

  // --- new glyph outlines --------------------------------------------------
  const appended = glyphs.map((entry) => {
    const baseGlyph = face.cmap.get(entry.base.codePointAt(0));
    if (baseGlyph === undefined)
      throw new Error(`${cut}: stock has no base ${entry.base}`);
    const contours = [
      ...glyphContours(face, baseGlyph).map((contour) =>
        contour.map((p) => ({ x: p.x, y: p.y, on: true })),
      ),
      ...rectsToContours(entry.added).map((contour) =>
        contour.map((p) => ({ x: p.x, y: p.y, on: true })),
      ),
    ];
    const points = contours.flat();
    if (points.some((point) => point.y < -250 || point.y > 1000)) {
      throw new Error(
        `${cut} ${entry.char}: ink outside the [-250, 1000] envelope`,
      );
    }
    return {
      entry,
      contours,
      bytes: encodeSimpleGlyph(contours),
      advance: entry.advance,
      xMin: Math.min(...points.map((point) => point.x)),
      xMax: Math.max(...points.map((point) => point.x)),
      yMin: Math.min(...points.map((point) => point.y)),
      yMax: Math.max(...points.map((point) => point.y)),
    };
  });

  const numGlyphs = face.numGlyphs + appended.length;

  // --- glyf + loca ---------------------------------------------------------
  // The original records keep their bytes AND their offsets: everything below
  // glyph 227 is the stock file, untouched.
  const originalGlyf = face.tables.get('glyf').bytes;
  const offsets = [...face.glyphOffsets];
  const originalEnd = offsets[face.numGlyphs];
  const parts = [originalGlyf.subarray(0, originalEnd)];
  let cursor = originalEnd;
  for (const glyph of appended) {
    parts.push(glyph.bytes);
    cursor += glyph.bytes.length;
    offsets.push(cursor);
  }
  const glyf = Buffer.concat(parts);

  const longLoca =
    glyf.length > 0x1fffe || offsets.some((offset) => offset % 2 !== 0);
  const loca = Buffer.alloc(
    longLoca ? (numGlyphs + 1) * 4 : (numGlyphs + 1) * 2,
  );
  offsets.forEach((offset, index) => {
    if (longLoca) loca.writeUInt32BE(offset, index * 4);
    else loca.writeUInt16BE(offset / 2, index * 2);
  });

  // --- hmtx + hhea ---------------------------------------------------------
  const hmtx = Buffer.concat([
    face.tables.get('hmtx').bytes.subarray(0, face.numberOfHMetrics * 4),
    ...appended.map((glyph) => {
      const record = Buffer.alloc(4);
      record.writeUInt16BE(glyph.advance, 0);
      record.writeInt16BE(glyph.xMin, 2);
      return record;
    }),
  ]);
  if (face.numberOfHMetrics !== face.numGlyphs) {
    throw new Error(
      'stock hmtx is not one long metric per glyph — the append path assumes it is',
    );
  }
  const hhea = Buffer.from(face.tables.get('hhea').bytes);
  hhea.writeUInt16BE(numGlyphs, 34);
  hhea.writeUInt16BE(
    Math.max(hhea.readUInt16BE(10), ...appended.map((g) => g.advance)),
    10,
  );
  hhea.writeInt16BE(
    Math.min(hhea.readInt16BE(12), ...appended.map((g) => g.xMin)),
    12,
  );
  hhea.writeInt16BE(
    Math.min(hhea.readInt16BE(14), ...appended.map((g) => g.advance - g.xMax)),
    14,
  );
  hhea.writeInt16BE(
    Math.max(hhea.readInt16BE(16), ...appended.map((g) => g.xMax)),
    16,
  );

  // --- maxp ----------------------------------------------------------------
  const maxp = Buffer.from(face.tables.get('maxp').bytes);
  maxp.writeUInt16BE(numGlyphs, 4);
  maxp.writeUInt16BE(
    Math.max(
      maxp.readUInt16BE(6),
      ...appended.map((g) => g.contours.flat().length),
    ),
    6,
  );
  maxp.writeUInt16BE(
    Math.max(maxp.readUInt16BE(8), ...appended.map((g) => g.contours.length)),
    8,
  );

  // --- cmap ----------------------------------------------------------------
  const mapping = new Map(face.cmap);
  appended.forEach((glyph, index) => {
    const code = glyph.entry.char.codePointAt(0);
    if (mapping.has(code))
      throw new Error(`${cut}: ${glyph.entry.char} is already in the face`);
    mapping.set(code, face.numGlyphs + index);
  });
  const cmap = encodeCmap(mapping);

  // --- OS/2 ----------------------------------------------------------------
  const os2 = Buffer.from(face.tables.get('OS/2').bytes);
  const advances = [
    ...face.metrics.map((metric) => metric.advance),
    ...appended.map((g) => g.advance),
  ].filter((advance) => advance > 0);
  os2.writeInt16BE(
    Math.trunc(advances.reduce((sum, a) => sum + a, 0) / advances.length),
    2,
  );
  // Latin Extended Additional (U+1E00–U+1EFF) — where most of Vietnamese lives.
  os2.writeUInt32BE((os2.readUInt32BE(42) | (1 << 29)) >>> 0, 42);
  const codes = [...mapping.keys()];
  os2.writeUInt16BE(Math.min(os2.readUInt16BE(64), ...codes), 64);
  os2.writeUInt16BE(
    Math.min(0xffff, Math.max(os2.readUInt16BE(66), ...codes)),
    66,
  );

  // --- head ----------------------------------------------------------------
  const head = Buffer.from(face.tables.get('head').bytes);
  head.writeInt16BE(
    Math.min(head.readInt16BE(36), ...appended.map((g) => g.xMin)),
    36,
  );
  head.writeInt16BE(
    Math.min(head.readInt16BE(38), ...appended.map((g) => g.yMin)),
    38,
  );
  head.writeInt16BE(
    Math.max(head.readInt16BE(40), ...appended.map((g) => g.xMax)),
    40,
  );
  head.writeInt16BE(
    Math.max(head.readInt16BE(42), ...appended.map((g) => g.yMax)),
    42,
  );
  head.writeInt16BE(longLoca ? 1 : 0, 50);

  // --- name ----------------------------------------------------------------
  const { subfamily, postScript } = CUTS[cut];
  const replacements = {
    0: `Copyright 2001 The Silkscreen Project Authors (https://github.com/googlefonts/silkscreen). ${DERIVATION}`,
    1: FAMILY,
    3: `1.001;HFMS;${postScript}`,
    4: `${FAMILY} ${subfamily}`,
    6: postScript,
    10: DERIVATION,
  };
  const names = readNames(face.tables.get('name').bytes).map((record) =>
    replacements[record.nameID] === undefined
      ? record
      : { ...record, bytes: utf16(replacements[record.nameID]) },
  );
  const template = names[0];
  for (const nameID of Object.keys(replacements).map(Number)) {
    if (names.some((record) => record.nameID === nameID)) continue;
    names.push({ ...template, nameID, bytes: utf16(replacements[nameID]) });
  }
  const name = encodeNames(names);

  // --- post ----------------------------------------------------------------
  const post = readPost(face.tables.get('post').bytes);
  for (const glyph of appended) {
    post.indices.push(258 + post.names.length);
    post.names.push(
      `uni${glyph.entry.char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`,
    );
  }

  const tables = new Map();
  for (const [tag, record] of face.tables)
    tables.set(tag, Buffer.from(record.bytes));
  tables.set('glyf', glyf);
  tables.set('loca', loca);
  tables.set('hmtx', hmtx);
  tables.set('hhea', hhea);
  tables.set('maxp', maxp);
  tables.set('cmap', cmap);
  tables.set('OS/2', os2);
  tables.set('head', head);
  tables.set('name', name);
  tables.set('post', encodePost(post));

  return { bytes: writeFont(tables, PHYSICAL_ORDER), appended, numGlyphs };
}

function main() {
  const table = JSON.parse(
    readFileSync(join(ROOT, 'content', 'fonts', 'vi-marks.json'), 'utf8'),
  );
  mkdirSync(join(ROOT, 'assets', 'fonts'), { recursive: true });

  for (const cut of Object.keys(CUTS)) {
    const { bytes, appended, numGlyphs } = buildCut(cut, table);
    const target = join(ROOT, 'assets', 'fonts', `HFMSilkscreen_${cut}.ttf`);
    writeFileSync(target, bytes);
    process.stdout.write(
      `HFMSilkscreen_${cut}.ttf: ${numGlyphs} glyphs (+${appended.length}), ${bytes.length} bytes\n`,
    );
  }

  copyFileSync(
    join(
      ROOT,
      'node_modules',
      '@expo-google-fonts',
      'silkscreen',
      'LICENSE_FONT',
    ),
    join(ROOT, 'assets', 'fonts', 'OFL.txt'),
  );
  process.stdout.write(
    'assets/fonts/OFL.txt: copied from the Silkscreen package\n',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
