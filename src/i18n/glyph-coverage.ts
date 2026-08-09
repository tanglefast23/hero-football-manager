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
 * Families this repo builds rather than installs.
 *
 * `HFMSilkscreen` is the Vietnamese derivative of Silkscreen — stock Silkscreen
 * with 102 Vietnamese letters appended, produced by `npm run build:fonts` into
 * `assets/fonts/`. It has no npm package to resolve, so it is found relative to
 * this file. Relative to *this file*, not to `process.cwd()`: a worktree run and
 * a main-checkout run must find the same TTF, and the cwd differs between them.
 */
const VENDORED_FAMILIES: ReadonlySet<string> = new Set(['HFMSilkscreen']);

/**
 * Where a registered family name's TTF lives on disk.
 *
 * Packaged faces resolve through `require.resolve` rather than a path built from
 * `process.cwd()`: this repo is developed in git worktrees that have no
 * `node_modules` of their own and resolve upward to the main checkout, so a
 * cwd-relative path finds nothing.
 */
export function faceFile(family: string): string {
  const [name, weight] = family.split('_');
  if (name === undefined || weight === undefined) {
    throw new Error(`Not a family_weight name: "${family}"`);
  }
  if (VENDORED_FAMILIES.has(name)) {
    return path.join(__dirname, '..', '..', 'assets', 'fonts', `${family}.ttf`);
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
function readFormat4(
  buffer: Buffer,
  subtable: number,
  into: Set<number>,
): void {
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
function readFormat12(
  buffer: Buffer,
  subtable: number,
  into: Set<number>,
): void {
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
export function missingGlyphs(
  text: string,
  covered: ReadonlySet<number>,
): string[] {
  return [...text].filter(
    (character) => !covered.has(character.codePointAt(0) ?? -1),
  );
}

/* ------------------------------------------------------------------------- *
 * Outlines and metrics.
 *
 * The Vietnamese derivative is stock Silkscreen with 102 glyphs appended, and
 * the gate protecting the other six languages has to prove the original 227 came
 * through untouched — geometry, advances, sidebearings, hinting instructions and
 * the opaque tables. That is more than a cmap reader can answer, so the parser
 * above grows a `glyf` reader rather than a second parser appearing elsewhere.
 * ------------------------------------------------------------------------- */

export interface GlyphPoint {
  readonly x: number;
  readonly y: number;
  readonly onCurve: boolean;
}

/**
 * One component of a composite glyph.
 *
 * 48 of Silkscreen Regular's 224 non-empty glyphs are composites (45 in Bold),
 * including much of Latin-1 — `Á á ç ý` and friends. They have no contour points
 * at all, so a comparison that only reads contours would skip a fifth of the
 * alphabet in silence.
 */
export interface GlyphComponent {
  readonly glyph: number;
  readonly flags: number;
  readonly dx: number;
  readonly dy: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

export interface Glyph {
  /** Contours as authored — empty for a composite. */
  readonly contours: readonly (readonly GlyphPoint[])[];
  /** Component records — `null` for a simple glyph. */
  readonly components: readonly GlyphComponent[] | null;
  /** The glyph's own hinting program, hex-encoded. */
  readonly instructions: string;
  /** Contours with composites resolved, which is what the eye actually sees. */
  readonly outline: readonly (readonly GlyphPoint[])[];
}

export interface GlyphMetric {
  readonly advance: number;
  readonly lsb: number;
}

export interface Face {
  readonly path: string;
  readonly tables: ReadonlyMap<string, Buffer>;
  readonly unitsPerEm: number;
  readonly numGlyphs: number;
  readonly numberOfHMetrics: number;
  readonly indexToLocFormat: number;
  readonly cmap: ReadonlyMap<number, number>;
  readonly metrics: readonly GlyphMetric[];
  readonly hhea: {
    readonly ascender: number;
    readonly descender: number;
    readonly lineGap: number;
  };
  readonly os2: {
    readonly xAvgCharWidth: number;
    readonly sTypoAscender: number;
    readonly sTypoDescender: number;
    readonly sTypoLineGap: number;
    readonly usWinAscent: number;
    readonly usWinDescent: number;
    readonly ulUnicodeRange: readonly number[];
  };
  glyph(id: number): Glyph;
}

function tableMap(buffer: Buffer): Map<string, Buffer> {
  const found = new Map<string, Buffer>();
  for (const [tag, record] of tables(buffer)) {
    found.set(
      tag,
      buffer.subarray(record.offset, record.offset + record.length),
    );
  }
  return found;
}

/** Everything a font gate needs, parsed once per file. */
export function readFace(ttfPath: string): Face {
  const buffer = fs.readFileSync(ttfPath);
  const found = tableMap(buffer);
  const need = (tag: string): Buffer => {
    const bytes = found.get(tag);
    if (bytes === undefined) throw new Error(`${ttfPath} has no ${tag} table`);
    return bytes;
  };

  const head = need('head');
  const maxp = need('maxp');
  const hhea = need('hhea');
  const os2 = need('OS/2');
  const loca = need('loca');
  const glyf = need('glyf');
  const hmtx = need('hmtx');

  const unitsPerEm = head.readUInt16BE(18);
  const indexToLocFormat = head.readInt16BE(50);
  const numGlyphs = maxp.readUInt16BE(4);
  const numberOfHMetrics = hhea.readUInt16BE(34);

  const offsets: number[] = [];
  for (let index = 0; index <= numGlyphs; index += 1) {
    offsets.push(
      indexToLocFormat === 0
        ? loca.readUInt16BE(index * 2) * 2
        : loca.readUInt32BE(index * 4),
    );
  }

  const metrics: GlyphMetric[] = [];
  for (let id = 0; id < numGlyphs; id += 1) {
    const index = Math.min(id, numberOfHMetrics - 1);
    metrics.push({
      advance: hmtx.readUInt16BE(index * 4),
      lsb:
        id < numberOfHMetrics
          ? hmtx.readInt16BE(index * 4 + 2)
          : hmtx.readInt16BE(
              numberOfHMetrics * 4 + (id - numberOfHMetrics) * 2,
            ),
    });
  }

  const cache = new Map<number, Glyph>();
  const glyph = (id: number): Glyph => {
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    const parsed = readGlyph(glyf.subarray(offsets[id], offsets[id + 1]));
    const resolved: Glyph = {
      ...parsed,
      outline:
        parsed.components === null
          ? parsed.contours
          : parsed.components.flatMap((component) =>
              glyph(component.glyph).outline.map((contour) =>
                contour.map((point) => ({
                  x: Math.round(point.x * component.scaleX) + component.dx,
                  y: Math.round(point.y * component.scaleY) + component.dy,
                  onCurve: point.onCurve,
                })),
              ),
            ),
    };
    cache.set(id, resolved);
    return resolved;
  };

  const cmapRecord = tables(buffer).get('cmap');
  if (cmapRecord === undefined) throw new Error(`No cmap table in ${ttfPath}`);
  const mapping = new Map<number, number>();
  readCmapGlyphs(buffer, cmapRecord.offset, mapping);

  return {
    path: ttfPath,
    tables: found,
    unitsPerEm,
    numGlyphs,
    numberOfHMetrics,
    indexToLocFormat,
    cmap: mapping,
    metrics,
    hhea: {
      ascender: hhea.readInt16BE(4),
      descender: hhea.readInt16BE(6),
      lineGap: hhea.readInt16BE(8),
    },
    os2: {
      xAvgCharWidth: os2.readInt16BE(2),
      sTypoAscender: os2.readInt16BE(68),
      sTypoDescender: os2.readInt16BE(70),
      sTypoLineGap: os2.readInt16BE(72),
      usWinAscent: os2.readUInt16BE(74),
      usWinDescent: os2.readUInt16BE(76),
      ulUnicodeRange: [42, 46, 50, 54].map((at) => os2.readUInt32BE(at)),
    },
    glyph,
  };
}

function readGlyph(bytes: Buffer): Omit<Glyph, 'outline'> {
  if (bytes.length === 0)
    return { contours: [], components: null, instructions: '' };
  const numberOfContours = bytes.readInt16BE(0);
  if (numberOfContours < 0)
    return {
      contours: [],
      components: readComponents(bytes),
      instructions: '',
    };

  const endPoints: number[] = [];
  for (let index = 0; index < numberOfContours; index += 1)
    endPoints.push(bytes.readUInt16BE(10 + index * 2));
  const pointCount =
    numberOfContours === 0 ? 0 : endPoints[endPoints.length - 1]! + 1;

  let at = 10 + numberOfContours * 2;
  const instructionLength = bytes.readUInt16BE(at);
  const instructions = bytes.toString(
    'hex',
    at + 2,
    at + 2 + instructionLength,
  );
  at += 2 + instructionLength;

  const flags: number[] = [];
  while (flags.length < pointCount) {
    const flag = bytes[at]!;
    at += 1;
    flags.push(flag);
    if (flag & 8) {
      const repeat = bytes[at]!;
      at += 1;
      for (let index = 0; index < repeat; index += 1) flags.push(flag);
    }
  }
  flags.length = pointCount;

  const read = (shortBit: number, sameBit: number): number[] => {
    const values: number[] = [];
    let value = 0;
    for (const flag of flags) {
      if (flag & shortBit) {
        const delta = bytes[at]!;
        at += 1;
        value += flag & sameBit ? delta : -delta;
      } else if (!(flag & sameBit)) {
        value += bytes.readInt16BE(at);
        at += 2;
      }
      values.push(value);
    }
    return values;
  };
  const xs = read(2, 16);
  const ys = read(4, 32);

  const contours: GlyphPoint[][] = [];
  let start = 0;
  for (const end of endPoints) {
    const contour: GlyphPoint[] = [];
    for (let index = start; index <= end; index += 1) {
      contour.push({
        x: xs[index]!,
        y: ys[index]!,
        onCurve: (flags[index]! & 1) !== 0,
      });
    }
    contours.push(contour);
    start = end + 1;
  }
  return { contours, components: null, instructions };
}

function readComponents(bytes: Buffer): GlyphComponent[] {
  const components: GlyphComponent[] = [];
  let at = 10;
  for (;;) {
    const flags = bytes.readUInt16BE(at);
    const glyph = bytes.readUInt16BE(at + 2);
    at += 4;
    let dx = 0;
    let dy = 0;
    if (flags & 1) {
      dx = bytes.readInt16BE(at);
      dy = bytes.readInt16BE(at + 2);
      at += 4;
    } else {
      dx = bytes.readInt8(at);
      dy = bytes.readInt8(at + 1);
      at += 2;
    }
    if (!(flags & 2)) {
      dx = 0;
      dy = 0;
    } // point matching, not an offset
    let scaleX = 1;
    let scaleY = 1;
    if (flags & 8) {
      scaleX = bytes.readInt16BE(at) / 16384;
      scaleY = scaleX;
      at += 2;
    } else if (flags & 0x40) {
      scaleX = bytes.readInt16BE(at) / 16384;
      scaleY = bytes.readInt16BE(at + 2) / 16384;
      at += 4;
    } else if (flags & 0x80) {
      at += 8;
    }
    components.push({ glyph, flags, dx, dy, scaleX, scaleY });
    if (!(flags & 0x20)) return components;
  }
}

/** cmap format 4 and 12, keeping the glyph ids rather than only the codepoints. */
function readCmapGlyphs(
  buffer: Buffer,
  cmap: number,
  into: Map<number, number>,
): void {
  const subtables = buffer.readUInt16BE(cmap + 2);
  for (let index = 0; index < subtables; index += 1) {
    const record = cmap + 4 + index * 8;
    const subtable = cmap + buffer.readUInt32BE(record + 4);
    const format = buffer.readUInt16BE(subtable);
    if (format !== 4) continue;
    const segCountX2 = buffer.readUInt16BE(subtable + 6);
    const endOffset = subtable + 14;
    const startOffset = endOffset + segCountX2 + 2;
    const deltaOffset = startOffset + segCountX2;
    const rangeOffset = deltaOffset + segCountX2;
    for (let segment = 0; segment < segCountX2 / 2; segment += 1) {
      const end = buffer.readUInt16BE(endOffset + segment * 2);
      const start = buffer.readUInt16BE(startOffset + segment * 2);
      if (start === 0xffff) continue;
      const delta = buffer.readInt16BE(deltaOffset + segment * 2);
      const range = buffer.readUInt16BE(rangeOffset + segment * 2);
      for (let code = start; code <= end; code += 1) {
        let glyph: number;
        if (range === 0) glyph = (code + delta) & 0xffff;
        else {
          const at = rangeOffset + segment * 2 + range + (code - start) * 2;
          if (at + 1 >= buffer.length) continue;
          glyph = buffer.readUInt16BE(at);
          if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
        }
        if (glyph !== 0) into.set(code, glyph);
      }
    }
  }
}
