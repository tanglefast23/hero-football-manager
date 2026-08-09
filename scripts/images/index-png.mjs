import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { PNG } from 'pngjs';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_PIXEL_ART_COLOURS = 16;

const files = process.argv.slice(2);
if (files.length === 0) {
  throw new Error('usage: node scripts/images/index-png.mjs <png> [...png]');
}

for (const file of files) {
  const source = PNG.sync.read(readFileSync(file));
  const palette = collectPalette(source, file);
  const indexed = encodeIndexedPng(source, palette);
  const decoded = PNG.sync.read(indexed);
  assertSamePixels(source, decoded, file);
  writeFileSync(file, indexed);
  console.log(
    `${file}: ${palette.length} colours, indexed PNG, pixels unchanged`,
  );
}

function collectPalette(image, file) {
  const colours = new Map();
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (image.data[offset + 3] !== 255) {
      throw new Error(
        `${file}: transparent pixels need an indexed transparency table`,
      );
    }
    const rgb = image.data.subarray(offset, offset + 3);
    const key = rgb[0] * 65_536 + rgb[1] * 256 + rgb[2];
    if (!colours.has(key)) colours.set(key, Buffer.from(rgb));
  }
  if (colours.size > MAX_PIXEL_ART_COLOURS) {
    throw new Error(
      `${file}: ${colours.size} colours exceeds the ${MAX_PIXEL_ART_COLOURS}-colour art budget`,
    );
  }
  return [...colours.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, rgb]) => rgb);
}

function encodeIndexedPng(image, palette) {
  const paletteIndex = new Map(
    palette.map((rgb, index) => [
      rgb[0] * 65_536 + rgb[1] * 256 + rgb[2],
      index,
    ]),
  );
  const scanlines = Buffer.alloc(image.height * (image.width + 1));
  for (let y = 0; y < image.height; y += 1) {
    const row = y * (image.width + 1);
    scanlines[row] = 0;
    for (let x = 0; x < image.width; x += 1) {
      const sourceOffset = (y * image.width + x) * 4;
      const key =
        image.data[sourceOffset] * 65_536 +
        image.data[sourceOffset + 1] * 256 +
        image.data[sourceOffset + 2];
      scanlines[row + x + 1] = paletteIndex.get(key);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0);
  header.writeUInt32BE(image.height, 4);
  header[8] = 8;
  header[9] = 3;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('PLTE', Buffer.concat(palette)),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const body = Buffer.concat([name, data]);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function assertSamePixels(before, after, file) {
  if (
    before.width !== after.width ||
    before.height !== after.height ||
    !before.data.equals(after.data)
  ) {
    throw new Error(`${file}: indexed conversion changed decoded pixels`);
  }
}
