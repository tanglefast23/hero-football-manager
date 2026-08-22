/**
 * App Store title-card renderer.
 *
 * Draws comic-book lettering for App Store marketing images. It has no panel
 * or button silhouette, so players can tell it from captured game UI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CanvasKitInit from 'canvaskit-wasm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '../..');

/** Master palette — docs/11-art-style.md. Never invent a one-off colour. */
export const PALETTE = {
  ink: '#241f2e',
  inkSoft: '#3a3350',
  cream: '#f4f1ea',
  white: '#ffffff',
  red: { dark: '#a83440', base: '#d94f52', light: '#f2938c' },
  blue: { dark: '#3f6fb5', base: '#5a8fd6', light: '#a3c8f0' },
  gold: { dark: '#c8862a', base: '#edb54a', light: '#f7d894' },
  grey: { dark: '#6b6675', base: '#9a95a4', light: '#c9c5d0' },
  pitch: { dark: '#3f8a4a', base: '#5cb85c', light: '#8fd98f' },
  violet: { dark: '#5b3a91', base: '#9a63d6', light: '#c9a6ec' },
};

let ckPromise;
export function canvasKit() {
  return (ckPromise ??= CanvasKitInit());
}

export function hexColor(ck, hex) {
  const n = hex.replace('#', '');
  const v = parseInt(n, 16);
  return ck.Color((v >> 16) & 255, (v >> 8) & 255, v & 255, 255);
}

function loadTypeface(ck, weight) {
  const file =
    weight === 'regular'
      ? 'HFMSilkscreen_400Regular.ttf'
      : 'HFMSilkscreen_700Bold.ttf';
  const buf = fs.readFileSync(path.join(REPO, 'assets/fonts', file));
  const tf = ck.Typeface.MakeTypefaceFromData(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
  if (!tf) throw new Error(`typeface failed to load: ${file}`);
  return tf;
}

function loadMarketingTypeface(ck) {
  const systemFont =
    '/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf';
  if (!fs.existsSync(systemFont)) return loadTypeface(ck, 'bold');
  const buf = fs.readFileSync(systemFont);
  const typeface = ck.Typeface.MakeTypefaceFromData(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
  if (!typeface) throw new Error(`typeface failed to load: ${systemFont}`);
  return typeface;
}

/** Width of `text` in art pixels at `size`, using the real font advances. */
function measure(ck, typeface, size, text) {
  const font = new ck.Font(typeface, size);
  const ids = font.getGlyphIDs(text);
  const widths = font.getGlyphWidths(ids);
  let total = 0;
  for (const w of widths) total += w;
  font.delete();
  return total;
}

/**
 * Largest stepped size at which every line fits `maxWidth`.
 */
function fitSize(
  ck,
  typeface,
  lines,
  maxWidth,
  { min = 8, max = 96, step = 4 },
) {
  let best = min;
  for (let size = min; size <= max; size += step) {
    const widest = Math.max(
      ...lines.map((l) => measure(ck, typeface, size, l)),
    );
    if (widest <= maxWidth) best = size;
    else break;
  }
  return best;
}

/**
 * Renders smooth, full-resolution comic lettering. `accent` is the fill family.
 */
export function drawTitleCard(ck, { lines, width, accent = PALETTE.blue }) {
  const unit = width / 440;
  const px = (value) => Math.round(value * unit);
  const margin = px(16);
  const padX = px(20);
  const padY = px(14);
  const lineGap = px(1);
  const typeface = loadMarketingTypeface(ck);
  const innerMax = width - (margin + padX) * 2;
  const size = fitSize(ck, typeface, lines, innerMax, {
    min: px(20),
    max: px(48),
    step: Math.max(1, px(2)),
  });

  const capH = Math.round(size * 0.72);
  const textBlockH = lines.length * capH + (lines.length - 1) * lineGap;
  const height = textBlockH + padY * 2 + margin * 2 + px(12);

  const surface = ck.MakeSurface(width, height);
  const canvas = surface.getCanvas();
  canvas.clear(ck.TRANSPARENT);

  const paint = new ck.Paint();
  paint.setAntiAlias(true);
  const font = new ck.Font(typeface, size);
  font.setSubpixel(true);
  font.setEdging(ck.FontEdging.AntiAlias);

  // Blue face, warm inner keyline, red drop face, and ink outline match the
  // supplied comic-wordmark direction without adding a surrounding box.
  lines.forEach((line, i) => {
    const w = measure(ck, typeface, size, line);
    const textX = Math.round((width - w) / 2);
    const textY = Math.round(margin + padY + capH + i * (capH + lineGap));
    const blob = ck.TextBlob.MakeFromText(line, font);

    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setStrokeWidth(px(6));
    paint.setColor(hexColor(ck, PALETTE.ink));
    canvas.drawTextBlob(blob, textX + px(3), textY + px(7), paint);
    paint.setStyle(ck.PaintStyle.Fill);
    paint.setColor(hexColor(ck, PALETTE.red.dark));
    canvas.drawTextBlob(blob, textX + px(3), textY + px(7), paint);

    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setStrokeWidth(px(6));
    paint.setColor(hexColor(ck, PALETTE.ink));
    canvas.drawTextBlob(blob, textX, textY, paint);
    paint.setStrokeWidth(px(2));
    paint.setColor(hexColor(ck, PALETTE.gold.base));
    canvas.drawTextBlob(blob, textX, textY, paint);
    paint.setStyle(ck.PaintStyle.Fill);
    paint.setColor(hexColor(ck, accent.base));
    canvas.drawTextBlob(blob, textX, textY, paint);
    blob.delete();
  });
  font.delete();
  paint.delete();

  const image = surface.makeImageSnapshot();
  return { image, width, height, surface, fontSize: size };
}

export function writePng(ck, image, outPath) {
  const bytes = image.encodeToBytes(ck.ImageFormat.PNG, 100);
  if (!bytes) throw new Error(`PNG encode failed for ${outPath}`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(bytes));
  return outPath;
}
