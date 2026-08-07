/**
 * A TrueType reader/writer small enough to be append-only.
 *
 * The Vietnamese derivative is built by *appending* glyphs to stock Silkscreen,
 * and the design spec
 * (`docs/superpowers/specs/2026-08-06-vietnamese-pixel-diacritics.md` §5) makes
 * `fpgm`, `prep`, `cvt `, `gasp`, `GPOS`, `GSUB` and `GDEF` opaque pass-through:
 * never decompiled, never rewritten. A general font library cannot promise that
 * — fonttools recompiles every table on save — so this module copies the bytes
 * of every table it is not explicitly asked to replace, and copies the `glyf`
 * records of the original glyphs (outlines *and* their hinting instructions)
 * byte for byte.
 *
 * Only what the spec's checklist names is rebuilt: `glyf`, `loca`, `hmtx`,
 * `hhea`, `maxp`, `cmap`, `OS/2`, `head`, `name` and `post`.
 */

const HEAD_CHECKSUM_MAGIC = 0xb1b0afba;

/** Table directory of an sfnt file, in the order the tags are listed. */
export function readTables(buffer) {
  const count = buffer.readUInt16BE(4);
  const tables = new Map();
  for (let index = 0; index < count; index += 1) {
    const entry = 12 + index * 16;
    const tag = buffer.toString('ascii', entry, entry + 4);
    const offset = buffer.readUInt32BE(entry + 8);
    const length = buffer.readUInt32BE(entry + 12);
    tables.set(tag, {
      offset,
      length,
      bytes: buffer.subarray(offset, offset + length),
    });
  }
  return tables;
}

function require_(tables, tag) {
  const found = tables.get(tag);
  if (found === undefined) throw new Error(`missing ${tag} table`);
  return found;
}

/** Everything the builder needs to know about the base face. */
export function readFace(buffer) {
  const tables = readTables(buffer);
  const head = require_(tables, 'head').bytes;
  const maxp = require_(tables, 'maxp').bytes;
  const hhea = require_(tables, 'hhea').bytes;
  const loca = require_(tables, 'loca').bytes;
  const glyf = require_(tables, 'glyf').bytes;
  const hmtx = require_(tables, 'hmtx').bytes;

  const unitsPerEm = head.readUInt16BE(18);
  const indexToLocFormat = head.readInt16BE(50);
  const numGlyphs = maxp.readUInt16BE(4);
  const numberOfHMetrics = hhea.readUInt16BE(34);

  const offsets = [];
  for (let index = 0; index <= numGlyphs; index += 1) {
    offsets.push(
      indexToLocFormat === 0
        ? loca.readUInt16BE(index * 2) * 2
        : loca.readUInt32BE(index * 4),
    );
  }

  const metrics = [];
  for (let glyph = 0; glyph < numGlyphs; glyph += 1) {
    const index = Math.min(glyph, numberOfHMetrics - 1);
    metrics.push({
      advance: hmtx.readUInt16BE(index * 4),
      lsb:
        glyph < numberOfHMetrics
          ? hmtx.readInt16BE(index * 4 + 2)
          : hmtx.readInt16BE(
              numberOfHMetrics * 4 + (glyph - numberOfHMetrics) * 2,
            ),
    });
  }

  return {
    buffer,
    tables,
    unitsPerEm,
    indexToLocFormat,
    numGlyphs,
    numberOfHMetrics,
    glyphOffsets: offsets,
    glyphBytes: (glyph) => glyf.subarray(offsets[glyph], offsets[glyph + 1]),
    metrics,
    cmap: readCmap(buffer, require_(tables, 'cmap')),
  };
}

/** Codepoint -> glyph id, from every format 4 subtable the face carries. */
export function readCmap(buffer, record) {
  const map = new Map();
  const base = record.offset;
  const subtables = buffer.readUInt16BE(base + 2);
  for (let index = 0; index < subtables; index += 1) {
    const entry = base + 4 + index * 8;
    const subtable = base + buffer.readUInt32BE(entry + 4);
    if (buffer.readUInt16BE(subtable) !== 4) continue;
    const segCountX2 = buffer.readUInt16BE(subtable + 6);
    const ends = subtable + 14;
    const starts = ends + segCountX2 + 2;
    const deltas = starts + segCountX2;
    const ranges = deltas + segCountX2;
    for (let segment = 0; segment < segCountX2 / 2; segment += 1) {
      const end = buffer.readUInt16BE(ends + segment * 2);
      const start = buffer.readUInt16BE(starts + segment * 2);
      if (start === 0xffff) continue;
      const delta = buffer.readInt16BE(deltas + segment * 2);
      const range = buffer.readUInt16BE(ranges + segment * 2);
      for (let code = start; code <= end; code += 1) {
        let glyph;
        if (range === 0) glyph = (code + delta) & 0xffff;
        else {
          const at = ranges + segment * 2 + range + (code - start) * 2;
          glyph = buffer.readUInt16BE(at);
          if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
        }
        if (glyph !== 0) map.set(code, glyph);
      }
    }
  }
  return map;
}

/**
 * Contours of one glyph, in font units, with composites flattened.
 *
 * Flattening matters twice over: 48 of Silkscreen Regular's 224 non-empty
 * glyphs are composites (45 in Bold), so a reader that only handles simple
 * glyphs silently skips a fifth of Latin-1 — and the Vietnamese bases are
 * copied out of the face as points, so they have to come back as points.
 */
export function glyphContours(face, glyph, depth = 0) {
  const bytes = face.glyphBytes(glyph);
  if (bytes.length === 0) return [];
  const numberOfContours = bytes.readInt16BE(0);
  if (numberOfContours < 0) return compositeContours(face, bytes, depth);

  const endPoints = [];
  for (let index = 0; index < numberOfContours; index += 1) {
    endPoints.push(bytes.readUInt16BE(10 + index * 2));
  }
  const pointCount =
    numberOfContours === 0 ? 0 : endPoints[endPoints.length - 1] + 1;
  let at = 10 + numberOfContours * 2;
  at += 2 + bytes.readUInt16BE(at); // skip the instruction stream

  const flags = [];
  while (flags.length < pointCount) {
    const flag = bytes[at];
    at += 1;
    flags.push(flag);
    if (flag & 8) {
      const repeat = bytes[at];
      at += 1;
      for (let index = 0; index < repeat; index += 1) flags.push(flag);
    }
  }
  flags.length = pointCount;

  const xs = [];
  let value = 0;
  for (const flag of flags) {
    if (flag & 2) {
      const delta = bytes[at];
      at += 1;
      value += flag & 16 ? delta : -delta;
    } else if (!(flag & 16)) {
      value += bytes.readInt16BE(at);
      at += 2;
    }
    xs.push(value);
  }
  const ys = [];
  value = 0;
  for (const flag of flags) {
    if (flag & 4) {
      const delta = bytes[at];
      at += 1;
      value += flag & 32 ? delta : -delta;
    } else if (!(flag & 32)) {
      value += bytes.readInt16BE(at);
      at += 2;
    }
    ys.push(value);
  }

  const contours = [];
  let start = 0;
  for (const end of endPoints) {
    const contour = [];
    for (let index = start; index <= end; index += 1) {
      contour.push({
        x: xs[index],
        y: ys[index],
        on: (flags[index] & 1) !== 0,
      });
    }
    contours.push(contour);
    start = end + 1;
  }
  return contours;
}

function compositeContours(face, bytes, depth) {
  if (depth > 4) throw new Error('composite nesting too deep');
  const out = [];
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
    } // point-matched, not offset — no Silkscreen glyph uses it
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
    for (const contour of glyphContours(face, glyph, depth + 1)) {
      out.push(
        contour.map((point) => ({
          x: Math.round(point.x * scaleX) + dx,
          y: Math.round(point.y * scaleY) + dy,
          on: point.on,
        })),
      );
    }
    if (!(flags & 0x20)) break;
  }
  return out;
}

/** A simple glyph record: all points on-curve, no instructions. */
export function encodeSimpleGlyph(contours) {
  const points = contours.flat();
  if (points.length === 0) return Buffer.alloc(0);

  const xMin = Math.min(...points.map((point) => point.x));
  const yMin = Math.min(...points.map((point) => point.y));
  const xMax = Math.max(...points.map((point) => point.x));
  const yMax = Math.max(...points.map((point) => point.y));

  const header = Buffer.alloc(10 + contours.length * 2 + 2);
  header.writeInt16BE(contours.length, 0);
  header.writeInt16BE(xMin, 2);
  header.writeInt16BE(yMin, 4);
  header.writeInt16BE(xMax, 6);
  header.writeInt16BE(yMax, 8);
  let end = -1;
  contours.forEach((contour, index) => {
    end += contour.length;
    header.writeUInt16BE(end, 10 + index * 2);
  });
  header.writeUInt16BE(0, 10 + contours.length * 2); // instructionLength

  // One flag byte per point, uncompressed. Repeat-packing would save a few
  // hundred bytes and buy nothing: these glyphs are read by the round-trip gate
  // far more often than they are downloaded.
  const flags = Buffer.alloc(points.length, 0x01);
  const coordinates = [];
  let previousX = 0;
  let previousY = 0;
  for (const point of points) {
    const dx = Buffer.alloc(2);
    dx.writeInt16BE(point.x - previousX);
    coordinates.push(dx);
    previousX = point.x;
  }
  for (const point of points) {
    const dy = Buffer.alloc(2);
    dy.writeInt16BE(point.y - previousY);
    coordinates.push(dy);
    previousY = point.y;
  }

  const glyph = Buffer.concat([header, flags, ...coordinates]);
  return glyph.length % 2 === 0
    ? glyph
    : Buffer.concat([glyph, Buffer.alloc(1)]);
}

function checksum(bytes) {
  let sum = 0;
  const padded =
    bytes.length % 4 === 0
      ? bytes
      : Buffer.concat([bytes, Buffer.alloc(4 - (bytes.length % 4))]);
  for (let at = 0; at < padded.length; at += 4) {
    sum = (sum + padded.readUInt32BE(at)) >>> 0;
  }
  return sum;
}

/**
 * Reassemble an sfnt from tag -> bytes.
 *
 * `order` is the physical order tables are written in; the directory itself is
 * always sorted by tag, which is what the format requires.
 */
export function writeFont(tableBytes, order) {
  const tags = [...tableBytes.keys()].sort();
  const directorySize = 12 + tags.length * 16;

  const placed = new Map();
  let cursor = directorySize;
  for (const tag of order) {
    const bytes = tableBytes.get(tag);
    if (bytes === undefined) continue;
    placed.set(tag, { offset: cursor, bytes });
    cursor += bytes.length + ((4 - (bytes.length % 4)) % 4);
  }
  for (const tag of tags) {
    if (placed.has(tag)) continue;
    const bytes = tableBytes.get(tag);
    placed.set(tag, { offset: cursor, bytes });
    cursor += bytes.length + ((4 - (bytes.length % 4)) % 4);
  }

  const head = tableBytes.get('head');
  if (head !== undefined) head.writeUInt32BE(0, 8); // checkSumAdjustment, computed below

  const file = Buffer.alloc(cursor);
  file.writeUInt32BE(0x00010000, 0);
  file.writeUInt16BE(tags.length, 4);
  const power = Math.floor(Math.log2(tags.length));
  file.writeUInt16BE(16 * 2 ** power, 6);
  file.writeUInt16BE(power, 8);
  file.writeUInt16BE(tags.length * 16 - 16 * 2 ** power, 10);

  tags.forEach((tag, index) => {
    const entry = 12 + index * 16;
    const { offset, bytes } = placed.get(tag);
    file.write(tag, entry, 4, 'ascii');
    file.writeUInt32BE(checksum(bytes), entry + 4);
    file.writeUInt32BE(offset, entry + 8);
    file.writeUInt32BE(bytes.length, entry + 12);
    bytes.copy(file, offset);
  });

  if (head !== undefined) {
    const headEntry = 12 + tags.indexOf('head') * 16;
    const at = file.readUInt32BE(headEntry + 8);
    file.writeUInt32BE((HEAD_CHECKSUM_MAGIC - checksum(file)) >>> 0, at + 8);
  }
  return file;
}

/** cmap format 4, as a single subtable shared by the (0,3) and (3,1) records. */
export function encodeCmap(mapping) {
  const codes = [...mapping.keys()]
    .filter((code) => code <= 0xffff)
    .sort((a, b) => a - b);
  const segments = [];
  for (const code of codes) {
    const last = segments[segments.length - 1];
    const glyph = mapping.get(code);
    if (
      last !== undefined &&
      code === last.end + 1 &&
      glyph === last.glyph + (code - last.start)
    ) {
      last.end = code;
    } else {
      segments.push({ start: code, end: code, glyph });
    }
  }
  segments.push({ start: 0xffff, end: 0xffff, glyph: 0 });

  const segCount = segments.length;
  const subtable = Buffer.alloc(16 + segCount * 8);
  subtable.writeUInt16BE(4, 0);
  subtable.writeUInt16BE(subtable.length, 2);
  subtable.writeUInt16BE(0, 4); // language
  subtable.writeUInt16BE(segCount * 2, 6);
  const power = Math.floor(Math.log2(segCount));
  subtable.writeUInt16BE(2 * 2 ** power, 8);
  subtable.writeUInt16BE(power, 10);
  subtable.writeUInt16BE(segCount * 2 - 2 * 2 ** power, 12);
  segments.forEach((segment, index) => {
    subtable.writeUInt16BE(segment.end, 14 + index * 2);
    subtable.writeUInt16BE(segment.start, 16 + segCount * 2 + index * 2);
    // idDelta only — every segment above is a contiguous glyph run by
    // construction, so no idRangeOffset array is needed.
    const delta =
      segment.start === 0xffff ? 1 : (segment.glyph - segment.start) & 0xffff;
    subtable.writeInt16BE(
      delta > 0x7fff ? delta - 0x10000 : delta,
      16 + segCount * 4 + index * 2,
    );
    subtable.writeUInt16BE(0, 16 + segCount * 6 + index * 2);
  });

  const header = Buffer.alloc(4 + 2 * 8);
  header.writeUInt16BE(0, 0);
  header.writeUInt16BE(2, 2);
  header.writeUInt16BE(0, 4); // platform 0 (Unicode)
  header.writeUInt16BE(3, 6); // encoding 3 (BMP)
  header.writeUInt32BE(header.length, 8);
  header.writeUInt16BE(3, 12); // platform 3 (Windows)
  header.writeUInt16BE(1, 14); // encoding 1 (UCS-2)
  header.writeUInt32BE(header.length, 16);
  return Buffer.concat([header, subtable]);
}

/** name records, as (platformID, encodingID, languageID, nameID, string). */
export function readNames(bytes) {
  const count = bytes.readUInt16BE(2);
  const storage = bytes.readUInt16BE(4);
  const records = [];
  for (let index = 0; index < count; index += 1) {
    const at = 6 + index * 12;
    const length = bytes.readUInt16BE(at + 8);
    const offset = bytes.readUInt16BE(at + 10);
    records.push({
      platformID: bytes.readUInt16BE(at),
      encodingID: bytes.readUInt16BE(at + 2),
      languageID: bytes.readUInt16BE(at + 4),
      nameID: bytes.readUInt16BE(at + 6),
      bytes: Buffer.from(
        bytes.subarray(storage + offset, storage + offset + length),
      ),
    });
  }
  return records;
}

export function encodeNames(records) {
  const sorted = [...records].sort(
    (a, b) =>
      a.platformID - b.platformID ||
      a.encodingID - b.encodingID ||
      a.languageID - b.languageID ||
      a.nameID - b.nameID,
  );
  const storage = [];
  let cursor = 0;
  const header = Buffer.alloc(6 + sorted.length * 12);
  header.writeUInt16BE(0, 0);
  header.writeUInt16BE(sorted.length, 2);
  header.writeUInt16BE(header.length, 4);
  sorted.forEach((record, index) => {
    const at = 6 + index * 12;
    header.writeUInt16BE(record.platformID, at);
    header.writeUInt16BE(record.encodingID, at + 2);
    header.writeUInt16BE(record.languageID, at + 4);
    header.writeUInt16BE(record.nameID, at + 6);
    header.writeUInt16BE(record.bytes.length, at + 8);
    header.writeUInt16BE(cursor, at + 10);
    storage.push(record.bytes);
    cursor += record.bytes.length;
  });
  return Buffer.concat([header, ...storage]);
}

/** post format 2.0 — the glyph-name table Silkscreen ships. */
export function readPost(bytes) {
  if (bytes.readUInt32BE(0) !== 0x00020000)
    throw new Error('post is not version 2.0');
  const numGlyphs = bytes.readUInt16BE(32);
  const indices = [];
  for (let index = 0; index < numGlyphs; index += 1)
    indices.push(bytes.readUInt16BE(34 + index * 2));
  const names = [];
  let at = 34 + numGlyphs * 2;
  while (at < bytes.length) {
    const length = bytes[at];
    names.push(bytes.toString('latin1', at + 1, at + 1 + length));
    at += 1 + length;
  }
  return { header: Buffer.from(bytes.subarray(0, 32)), indices, names };
}

export function encodePost(post) {
  const head = Buffer.alloc(34);
  post.header.copy(head, 0);
  head.writeUInt16BE(post.indices.length, 32);
  const indices = Buffer.alloc(post.indices.length * 2);
  post.indices.forEach((value, index) =>
    indices.writeUInt16BE(value, index * 2),
  );
  const names = post.names.map((name) => {
    const bytes = Buffer.from(name, 'latin1');
    return Buffer.concat([Buffer.from([bytes.length]), bytes]);
  });
  return Buffer.concat([head, indices, ...names]);
}
