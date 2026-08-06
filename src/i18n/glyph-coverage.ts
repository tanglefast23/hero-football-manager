import fs from 'fs';
import path from 'path';

/**
 * Which codepoints a font file actually contains.
 *
 * This exists because the whole Vietnamese decision rests on a measurable fact —
 * Silkscreen has 226 glyphs and none of them are Vietnamese — and a fact that
 * load-bearing should be re-checked by CI rather than trusted from a design
 * document. It is also what catches a stray smart quote, a narrow space or a
 * Turkish dotless i that the shipped face cannot draw.
 *
 * Written from scratch: `league-table-columns.ts` records advance numbers that
 * were measured offline, but there is no font parser in this repository to
 * reuse.
 */

/**
 * Where a registered family name's TTF lives on disk.
 *
 * Resolved through `require.resolve` rather than a path built from
 * `process.cwd()`: this repo is developed in git worktrees that have no
 * `node_modules` of their own and resolve upward to the main checkout, so a
 * cwd-relative path finds nothing.
 */
export function faceFile(family: string): string {
  const [name, weight] = family.split('_');
  if (name === undefined || weight === undefined) {
    throw new Error(`Not a family_weight name: "${family}"`);
  }
  const pkg = `@expo-google-fonts/${name.toLowerCase()}`;
  const manifest = require.resolve(`${pkg}/package.json`);
  return path.join(path.dirname(manifest), weight, `${family}.ttf`);
}

interface TableRecord {
  offset: number;
  length: number;
}

function tables(buffer: Buffer): Map<string, TableRecord> {
  const found = new Map<string, TableRecord>();
  const count = buffer.readUInt16BE(4);
  for (let index = 0; index < count; index += 1) {
    const entry = 12 + index * 16;
    found.set(buffer.toString('ascii', entry, entry + 4), {
      offset: buffer.readUInt32BE(entry + 8),
      length: buffer.readUInt32BE(entry + 12),
    });
  }
  return found;
}

/** cmap format 4 — the segmented mapping every Latin face in this project uses. */
function readFormat4(buffer: Buffer, subtable: number, into: Set<number>): void {
  const segCountX2 = buffer.readUInt16BE(subtable + 6);
  const segCount = segCountX2 / 2;
  const endOffset = subtable + 14;
  const startOffset = endOffset + segCountX2 + 2;
  const deltaOffset = startOffset + segCountX2;
  const rangeOffset = deltaOffset + segCountX2;

  for (let segment = 0; segment < segCount; segment += 1) {
    const end = buffer.readUInt16BE(endOffset + segment * 2);
    const start = buffer.readUInt16BE(startOffset + segment * 2);
    if (start === 0xffff) continue;
    const delta = buffer.readInt16BE(deltaOffset + segment * 2);
    const range = buffer.readUInt16BE(rangeOffset + segment * 2);

    for (let code = start; code <= end && code !== 0x10000; code += 1) {
      let glyph: number;
      if (range === 0) {
        glyph = (code + delta) & 0xffff;
      } else {
        const at = rangeOffset + segment * 2 + range + (code - start) * 2;
        if (at + 1 >= buffer.length) continue;
        glyph = buffer.readUInt16BE(at);
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph !== 0) into.add(code);
    }
  }
}

/** cmap format 12 — needed by any face reaching beyond the BMP. */
function readFormat12(buffer: Buffer, subtable: number, into: Set<number>): void {
  const groups = buffer.readUInt32BE(subtable + 12);
  for (let group = 0; group < groups; group += 1) {
    const at = subtable + 16 + group * 12;
    const start = buffer.readUInt32BE(at);
    const end = buffer.readUInt32BE(at + 4);
    for (let code = start; code <= end; code += 1) into.add(code);
  }
}

/**
 * Every codepoint the face can draw.
 *
 * Both format 4 and format 12 are handled. Reading only format 4 would return
 * an empty set for a format-12 face, and an empty set makes the coverage gate
 * pass on everything — a silent hole exactly where a font gate is supposed to
 * be loudest. The non-empty assertion below is the backstop for that.
 */
export function glyphSet(ttfPath: string): ReadonlySet<number> {
  const buffer = fs.readFileSync(ttfPath);
  const cmap = tables(buffer).get('cmap');
  if (cmap === undefined) throw new Error(`No cmap table in ${ttfPath}`);

  const covered = new Set<number>();
  const subtables = buffer.readUInt16BE(cmap.offset + 2);
  for (let index = 0; index < subtables; index += 1) {
    const record = cmap.offset + 4 + index * 8;
    const subtable = cmap.offset + buffer.readUInt32BE(record + 4);
    const format = buffer.readUInt16BE(subtable);
    if (format === 4) readFormat4(buffer, subtable, covered);
    else if (format === 12) readFormat12(buffer, subtable, covered);
  }

  if (covered.size === 0) throw new Error(`Parsed no glyphs from ${ttfPath}`);
  return covered;
}

/** Which characters of `text` the face cannot draw. Empty means it is safe. */
export function missingGlyphs(text: string, covered: ReadonlySet<number>): string[] {
  return [...text].filter(character => !covered.has(character.codePointAt(0) ?? -1));
}
