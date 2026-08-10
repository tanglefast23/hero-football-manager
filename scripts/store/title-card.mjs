/**
 * App Store title-card renderer.
 *
 * Draws the chunky pixel-bevel card from docs/11-art-style.md Track A: thick
 * ink outline, rounded chunky corners, a bold two-tone face (bright top band,
 * dark bottom lip) and a pixel-font label. Everything is authored in ART
 * PIXELS and upscaled with nearest-neighbour sampling, so the output has real
 * chunky pixels instead of a resampled blur.
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
 * Largest multiple-of-`step` size at which every line fits `maxWidth`.
 * Silkscreen is an 8px-grid pixel face, so only whole steps stay crisp.
 */
function fitSize(ck, typeface, lines, maxWidth, { min = 8, max = 96, step = 4 }) {
  let best = min;
  for (let size = min; size <= max; size += step) {
    const widest = Math.max(...lines.map((l) => measure(ck, typeface, size, l)));
    if (widest <= maxWidth) best = size;
    else break;
  }
  return best;
}

/**
 * Renders the card at art scale and returns { image, width, height } in art
 * pixels. Caller upscales. `accent` is a {dark, base, light} palette family.
 */
export function drawTitleCard(
  ck,
  {
    lines,
    width,
    accent = PALETTE.gold,
    textColor = PALETTE.ink,
    outline = PALETTE.ink,
    margin = 14,
    padX = 18,
    lineGap = 8,
    border = 3,
    radius = 7,
    maxFont = 96,
    band = 9, // bright top highlight, art pixels
    lip = 7, // dark bottom lip, art pixels
    clearance = 11, // gap between a bevel band and the nearest cap
  },
) {
  // Enough padding that the caps never touch the highlight or the lip.
  const padY = Math.max(band, lip) + clearance;
  const typeface = loadTypeface(ck, 'bold');
  const cardW = width - margin * 2;
  const innerMax = cardW - (padX + border) * 2;
  const size = fitSize(ck, typeface, lines, innerMax, { max: maxFont });

  // Silkscreen's cap height is 5/8 of its em; using it (not the full line
  // height) keeps the optical padding even above and below the caps.
  const capH = Math.round(size * 0.625);
  const textBlockH = lines.length * capH + (lines.length - 1) * lineGap;
  const cardH = textBlockH + (padY + border) * 2;
  const height = cardH + margin * 2;

  const surface = ck.MakeSurface(width, height);
  const canvas = surface.getCanvas();
  canvas.clear(ck.TRANSPARENT);

  const paint = new ck.Paint();
  paint.setAntiAlias(false); // hard pixel edges — never a soft ramp
  paint.setStyle(ck.PaintStyle.Fill);

  const rrect = (x, y, w, h, r) => ck.RRectXY(ck.XYWHRect(x, y, w, h), r, r);

  // 1. ink outline (the whole card silhouette)
  paint.setColor(hexColor(ck, outline));
  canvas.drawRRect(rrect(margin, margin, cardW, cardH, radius), paint);

  // 2. base face
  const fx = margin + border;
  const fy = margin + border;
  const fw = cardW - border * 2;
  const fh = cardH - border * 2;
  paint.setColor(hexColor(ck, accent.base));
  canvas.drawRRect(rrect(fx, fy, fw, fh, radius - border), paint);

  // 3. bright top band + dark bottom lip (the two-tone bevel). Absolute art
  // pixels, not a fraction of the face: the label must sit wholly on the flat
  // base colour, and a proportional band creeps into the caps as text grows.
  const lipH = lip;
  const bandH = band;
  canvas.save();
  canvas.clipRRect(rrect(fx, fy, fw, fh, radius - border), ck.ClipOp.Intersect, false);
  paint.setColor(hexColor(ck, accent.light));
  canvas.drawRect(ck.XYWHRect(fx, fy, fw, bandH), paint);
  paint.setColor(hexColor(ck, accent.dark));
  canvas.drawRect(ck.XYWHRect(fx, fy + fh - lipH, fw, lipH), paint);
  canvas.restore();

  // 4. label
  const font = new ck.Font(typeface, size);
  font.setSubpixel(false);
  font.setHinting(ck.FontHinting.None);
  // No anti-aliasing — a pixel face must stay pixels. This CanvasKit build
  // only names AntiAlias/SubpixelAntiAlias, so pass SkFontEdging::kAlias (0)
  // as a raw embind enum value.
  font.setEdging(ck.FontEdging.Alias ?? { value: 0 });
  paint.setColor(hexColor(ck, textColor));
  lines.forEach((line, i) => {
    const w = measure(ck, typeface, size, line);
    const x = Math.round(margin + (cardW - w) / 2);
    const y = Math.round(margin + border + padY + capH + i * (capH + lineGap));
    const blob = ck.TextBlob.MakeFromText(line, font);
    canvas.drawTextBlob(blob, x, y, paint);
    blob.delete();
  });
  font.delete();
  paint.delete();

  const image = surface.makeImageSnapshot();
  return { image, width, height, surface, fontSize: size };
}

/** Nearest-neighbour upscale so art pixels stay square and hard-edged. */
export function upscale(ck, image, factor) {
  const w = image.width() * factor;
  const h = image.height() * factor;
  const surface = ck.MakeSurface(w, h);
  const canvas = surface.getCanvas();
  canvas.clear(ck.TRANSPARENT);
  const paint = new ck.Paint();
  paint.setAntiAlias(false);
  canvas.drawImageRectOptions(
    image,
    ck.XYWHRect(0, 0, image.width(), image.height()),
    ck.XYWHRect(0, 0, w, h),
    ck.FilterMode.Nearest,
    ck.MipmapMode.None,
    paint,
  );
  paint.delete();
  return { image: surface.makeImageSnapshot(), surface, width: w, height: h };
}

export function writePng(ck, image, outPath) {
  const bytes = image.encodeToBytes(ck.ImageFormat.PNG, 100);
  if (!bytes) throw new Error(`PNG encode failed for ${outPath}`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(bytes));
  return outPath;
}
