import fs from 'fs';
import { faceFile } from './glyph-coverage';

/**
 * How wide a string is in a given face, in em.
 *
 * The existing column tables hold numbers that were measured offline and typed
 * in by hand. That was fine while English was the only language; it stops being
 * fine the moment a second locale wants a header, because nobody can eyeball
 * whether "PKT" fits a column sized for "PTS".
 *
 * So this reads the real `hmtx` table. It is a CI/test tool — `fs` means Metro
 * cannot bundle it, and it must never be imported by app code.
 */
interface Metrics {
  unitsPerEm: number;
  advances: Map<number, number>;
}

const cache = new Map<string, Metrics>();

function tables(buffer: Buffer): Map<string, number> {
  const found = new Map<string, number>();
  const count = buffer.readUInt16BE(4);
  for (let index = 0; index < count; index += 1) {
    const entry = 12 + index * 16;
    found.set(buffer.toString('ascii', entry, entry + 4), buffer.readUInt32BE(entry + 8));
  }
  return found;
}

/** cmap format 4 — every face this project ships. */
function codepointToGlyph(buffer: Buffer, cmap: number): Map<number, number> {
  const map = new Map<number, number>();
  const subtables = buffer.readUInt16BE(cmap + 2);
  let best: number | undefined;
  for (let index = 0; index < subtables; index += 1) {
    const record = cmap + 4 + index * 8;
    if (buffer.readUInt16BE(record) === 3 && buffer.readUInt16BE(record + 2) === 1) {
      best = cmap + buffer.readUInt32BE(record + 4);
    }
  }
  if (best === undefined) throw new Error('no unicode cmap subtable');

  const segCountX2 = buffer.readUInt16BE(best + 6);
  const segCount = segCountX2 / 2;
  const endOffset = best + 14;
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
      if (range === 0) glyph = (code + delta) & 0xffff;
      else {
        const at = rangeOffset + segment * 2 + range + (code - start) * 2;
        if (at + 1 >= buffer.length) continue;
        glyph = buffer.readUInt16BE(at);
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph !== 0) map.set(code, glyph);
    }
  }
  return map;
}

function metricsFor(family: string): Metrics {
  const cached = cache.get(family);
  if (cached !== undefined) return cached;

  const buffer = fs.readFileSync(faceFile(family));
  const offsets = tables(buffer);
  const head = offsets.get('head');
  const hhea = offsets.get('hhea');
  const hmtx = offsets.get('hmtx');
  const cmap = offsets.get('cmap');
  if (head === undefined || hhea === undefined || hmtx === undefined || cmap === undefined) {
    throw new Error(`${family} is missing a metric table`);
  }

  const unitsPerEm = buffer.readUInt16BE(head + 18);
  const longMetrics = buffer.readUInt16BE(hhea + 34);
  const glyphs = codepointToGlyph(buffer, cmap);
  const advances = new Map<number, number>();

  for (const [code, glyph] of glyphs) {
    // Glyphs past the long-metric run all share the last advance — that is the
    // format, not a shortcut.
    const index = Math.min(glyph, longMetrics - 1);
    advances.set(code, buffer.readUInt16BE(hmtx + index * 4));
  }

  const metrics = { unitsPerEm, advances };
  cache.set(family, metrics);
  return metrics;
}

/** Width of `text` in em. Throws on a character the face cannot draw. */
export function advanceEm(text: string, family: string): number {
  const { unitsPerEm, advances } = metricsFor(family);
  let total = 0;
  for (const character of text) {
    const units = advances.get(character.codePointAt(0) ?? -1);
    if (units === undefined) {
      throw new Error(`${family} cannot draw ${JSON.stringify(character)} in ${JSON.stringify(text)}`);
    }
    total += units;
  }
  return total / unitsPerEm;
}
