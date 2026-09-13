/**
 * Composes the Steam store and library capsules from the key-art capture.
 *
 * Every capsule is a crop of artifacts/store-capsules/raw/key-art.png with
 * the comic wordmark from title-card.mjs drawn on, the same lettering the
 * twenty store screenshots use. Valve allows no text beyond the game's name
 * on a capsule, and the library hero allows none at all.
 *
 * Sizes are Valve's, from partner.steamgames.com/doc/store/assets/standard
 * and .../libraryassets on 2026-09-13.
 *
 * Run: node scripts/store/compose-capsules.mjs
 * Reads  artifacts/store-capsules/raw/key-art.png
 * Writes artifacts/store-capsules/<name>.png and contact-sheet.png
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  canvasKit,
  drawTitleCard,
  hexColor,
  PALETTE,
  writePng,
} from './title-card.mjs';

const RAW = resolve('artifacts/store-capsules/raw/key-art.png');
const OUT = resolve('artifacts/store-capsules');

const WIDE = ['HERO FOOTBALL', 'MANAGER!'];
const TALL = ['HERO', 'FOOTBALL', 'MANAGER!'];

/**
 * Each capsule: Valve's size, where the hero sits (fraction of the capsule),
 * how tall the hero is (fraction of the capsule height), and the logo's
 * centre and width (fractions). `logo: null` means text-free.
 */
const CAPSULES = [
  {
    name: 'header-capsule',
    width: 920,
    height: 430,
    hero: { x: 0.77, y: 0.52, height: 0.84 },
    logo: { lines: WIDE, x: 0.31, y: 0.5, width: 0.6 },
  },
  {
    name: 'library-header',
    width: 920,
    height: 430,
    hero: { x: 0.77, y: 0.52, height: 0.84 },
    logo: { lines: WIDE, x: 0.31, y: 0.5, width: 0.6 },
  },
  {
    // Valve: the logo should nearly fill the small capsule. Pitch only.
    name: 'small-capsule',
    width: 462,
    height: 174,
    hero: null,
    logo: { lines: WIDE, x: 0.5, y: 0.5, width: 0.94 },
  },
  {
    name: 'main-capsule',
    width: 1232,
    height: 706,
    hero: { x: 0.75, y: 0.52, height: 0.8 },
    logo: { lines: WIDE, x: 0.32, y: 0.5, width: 0.58 },
  },
  {
    name: 'vertical-capsule',
    width: 748,
    height: 896,
    hero: { x: 0.5, y: 0.68, height: 0.5 },
    logo: { lines: TALL, x: 0.5, y: 0.24, width: 0.9 },
  },
  {
    name: 'library-capsule',
    width: 600,
    height: 900,
    hero: { x: 0.5, y: 0.68, height: 0.46 },
    logo: { lines: TALL, x: 0.5, y: 0.23, width: 0.9 },
  },
  {
    // Valve draws the library logo over this; keep the hero in the 860x380
    // centre safe area and leave the left third clear for the logo.
    // 0.78 is the floor: the hero is 948 px tall in the capture, so any
    // smaller needs a source window wider than the capture itself.
    name: 'library-hero',
    width: 3840,
    height: 1240,
    hero: { x: 0.5, y: 0.5, height: 0.78 },
    logo: null,
  },
  {
    name: 'page-background',
    width: 1438,
    height: 810,
    hero: { x: 0.66, y: 0.52, height: 0.62 },
    logo: null,
    dim: 0.45,
  },
];

const ck = await canvasKit();
const source = ck.MakeImageFromEncoded(readFileSync(RAW));
if (!source) throw new Error(`could not decode ${RAW}`);
const SRC_W = source.width();
const SRC_H = source.height();

/**
 * Bounding box of everything that is not pitch or chalk. Pitch is green-
 * dominant and chalk is a pale green-white, so any pixel whose red or blue
 * channel rivals its green is sprite, kit, skin, or glow.
 */
function detectHero() {
  const pixels = source.readPixels(0, 0, {
    width: SRC_W,
    height: SRC_H,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  });
  let minX = SRC_W;
  let minY = SRC_H;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < SRC_H; y += 1) {
    for (let x = 0; x < SRC_W; x += 1) {
      const i = (y * SRC_W + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      if (r > g * 0.9 || b > g * 0.9) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('no hero pixels found in the key art');
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  };
}

const HERO = detectHero();
console.log(
  `hero bbox ${HERO.w}x${HERO.h} centred at (${Math.round(HERO.cx)}, ${Math.round(HERO.cy)})`,
);

function composeCapsule(spec) {
  const { width, height, hero, logo, dim } = spec;
  // Scale so the hero is `hero.height` of the capsule, then choose the source
  // window that puts the hero's centre at (hero.x, hero.y) of the capsule.
  // With no hero, take a half-scale window from the top-left of the capture,
  // which holds only pitch and a chalk arc.
  const scale = hero ? (height * hero.height) / HERO.h : 0.5;
  const srcW = width / scale;
  const srcH = height / scale;
  let sx = hero ? HERO.cx - hero.x * srcW : 0;
  let sy = hero ? HERO.cy - hero.y * srcH : SRC_H * 0.04;
  // Clamp inside the capture; the pitch is uniform so a shifted window only
  // moves the hero slightly, and the log line below says by how much.
  const clampedX = Math.min(Math.max(sx, 0), SRC_W - srcW);
  const clampedY = Math.min(Math.max(sy, 0), SRC_H - srcH);
  const shiftX = Math.round((clampedX - sx) * scale);
  const shiftY = Math.round((clampedY - sy) * scale);
  sx = clampedX;
  sy = clampedY;
  if (srcW > SRC_W || srcH > SRC_H) {
    throw new Error(
      `${spec.name}: needs a ${Math.ceil(srcW)}x${Math.ceil(srcH)} window; the capture is ${SRC_W}x${SRC_H}`,
    );
  }

  const surface = ck.MakeSurface(width, height);
  const canvas = surface.getCanvas();
  canvas.clear(hexColor(ck, '#265b30'));
  const paint = new ck.Paint();
  paint.setAntiAlias(true);
  canvas.drawImageRectOptions(
    source,
    ck.XYWHRect(sx, sy, srcW, srcH),
    ck.XYWHRect(0, 0, width, height),
    ck.FilterMode.Linear,
    ck.MipmapMode.Linear,
    paint,
  );

  if (dim) {
    const ink = new ck.Paint();
    ink.setColor(ck.Color(0x24, 0x1f, 0x2e, Math.round(dim * 255)));
    canvas.drawRect(ck.XYWHRect(0, 0, width, height), ink);
    ink.delete();
  }

  let logoNote = 'no logo';
  if (logo) {
    // The card keeps 16% of its width as transparent margin (16 + 20 art-px
    // each side of 440), so widen it so the lettering spans `logo.width`.
    const card = drawTitleCard(ck, {
      lines: logo.lines,
      width: Math.round((width * logo.width) / 0.836),
      maxSize: height,
    });
    const x = Math.round(width * logo.x - card.width / 2);
    const y = Math.round(height * logo.y - card.height / 2);
    canvas.drawImage(card.image, x, y, paint);
    logoNote = `logo ${card.width}x${card.height} at (${x}, ${y})`;
    card.image.delete();
    card.surface.delete();
  }
  paint.delete();

  const file = join(OUT, `${spec.name}.png`);
  writePng(ck, surface.makeImageSnapshot(), file);
  surface.delete();
  const shift =
    shiftX || shiftY
      ? `  (hero shifted ${shiftX},${shiftY} to stay in frame)`
      : '';
  console.log(`${spec.name}  ${width}x${height}  ${logoNote}${shift}`);
}

for (const spec of CAPSULES) composeCapsule(spec);

// Library logo: the wordmark alone on transparency. Valve: 1280 wide and/or
// 720 tall; the card's height falls out of the width and is checked.
{
  const card = drawTitleCard(ck, { lines: WIDE, width: 1280, maxSize: 400 });
  if (card.height > 720) {
    throw new Error(`library-logo is ${card.height}px tall; Valve caps 720`);
  }
  writePng(ck, card.image, join(OUT, 'library-logo.png'));
  console.log(`library-logo  ${card.width}x${card.height}  transparent`);
  card.image.delete();
  card.surface.delete();
}

// Contact sheet for one-glance review: every asset at a common height.
{
  const TILE_H = 220;
  const GUTTER = 12;
  const names = [...CAPSULES.map((c) => c.name), 'library-logo'];
  const images = names.map((name) => {
    const image = ck.MakeImageFromEncoded(
      readFileSync(join(OUT, `${name}.png`)),
    );
    if (!image) throw new Error(`could not decode ${name}`);
    return { name, image };
  });
  const tiles = images.map(({ image }) => ({
    w: Math.round((image.width() / image.height()) * TILE_H),
    h: TILE_H,
  }));
  // Two rows: wide assets first, then tall and the logo.
  const rowOf = (i) => (i < 4 ? 0 : 1);
  const rowWidths = [0, 0];
  tiles.forEach((t, i) => {
    rowWidths[rowOf(i)] += t.w + GUTTER;
  });
  const sheetW = Math.max(...rowWidths) + GUTTER;
  const sheetH = 2 * TILE_H + 3 * GUTTER;
  const surface = ck.MakeSurface(sheetW, sheetH);
  const canvas = surface.getCanvas();
  canvas.clear(hexColor(ck, PALETTE.ink));
  const paint = new ck.Paint();
  paint.setAntiAlias(true);
  const cursor = [GUTTER, GUTTER];
  images.forEach(({ image }, i) => {
    const row = rowOf(i);
    const t = tiles[i];
    const x = cursor[row];
    const y = GUTTER + row * (TILE_H + GUTTER);
    canvas.drawImageRectOptions(
      image,
      ck.XYWHRect(0, 0, image.width(), image.height()),
      ck.XYWHRect(x, y, t.w, t.h),
      ck.FilterMode.Linear,
      ck.MipmapMode.Linear,
      paint,
    );
    cursor[row] += t.w + GUTTER;
    image.delete();
  });
  paint.delete();
  writePng(ck, surface.makeImageSnapshot(), join(OUT, 'contact-sheet.png'));
  surface.delete();
  console.log('contact-sheet.png');
}
source.delete();
