/**
 * Composes an App Store screenshot: a captured 1320x2868 game frame with a
 * chunky pixel title card laid over a quiet part of the screen.
 *
 * The game frame is never scaled — a non-integer resample would destroy the
 * pixel grid this game is drawn on. The card is authored at 1/3 scale and
 * upscaled x3 with nearest-neighbour for the same reason.
 *
 * Output is flattened onto an opaque background: App Store screenshots must
 * carry no alpha channel (runbook Phase 9).
 *
 * Usage: node scripts/store/compose.mjs <frame.png> <out.png> [--y N]
 *        [--accent gold|blue|red|grey|pitch] [--line "TEXT"]... [--width N]
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  canvasKit,
  drawTitleCard,
  upscale,
  writePng,
  hexColor,
  PALETTE,
} from './title-card.mjs';

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const lines = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--line') lines.push(args[i + 1]);
}

const framePath = positional[0];
const outPath = positional[1];
if (!framePath || !outPath) {
  console.error(
    'usage: compose.mjs <frame.png> <out.png> [--y N] [--line TEXT]...',
  );
  process.exit(1);
}

const SCALE = 3; // device pixels per art pixel
const cardY = Number(flag('y', 330));
const accentName = flag('accent', 'gold');
const accent = PALETTE[accentName] ?? PALETTE.gold;
const artWidth = Number(flag('width', 440)); // 440 art px x3 = 1320 device px

const ck = await canvasKit();

const frameBytes = fs.readFileSync(framePath);
const frame = ck.MakeImageFromEncoded(frameBytes);
if (!frame) throw new Error(`could not decode ${framePath}`);
const W = frame.width();
const H = frame.height();

const card = drawTitleCard(ck, {
  lines: lines.length ? lines : ['HEROES CHANGE', 'MATCHES'],
  width: artWidth,
  accent,
});
const cardBig = upscale(ck, card.image, SCALE);

const surface = ck.MakeSurface(W, H);
const canvas = surface.getCanvas();
// Opaque ground first: guarantees a fully flattened, alpha-free result.
canvas.clear(hexColor(ck, PALETTE.ink));

const paint = new ck.Paint();
paint.setAntiAlias(false);
canvas.drawImage(frame, 0, 0, paint);
canvas.drawImage(
  cardBig.image,
  Math.round((W - cardBig.width) / 2),
  cardY,
  paint,
);

const out = surface.makeImageSnapshot();
writePng(ck, out, outPath);

// CanvasKit always encodes RGBA. App Store screenshots must have no alpha
// channel at all — an opaque alpha channel still counts as one and is
// rejected — so re-encode as 24-bit RGB.
execFileSync('ffmpeg', [
  '-y',
  '-loglevel',
  'error',
  '-i',
  outPath,
  '-pix_fmt',
  'rgb24',
  '-f',
  'image2',
  `${outPath}.rgb.png`,
]);
fs.renameSync(`${outPath}.rgb.png`, outPath);

console.log(
  JSON.stringify(
    {
      out: outPath,
      size: `${W}x${H}`,
      frame: framePath,
      card: `${cardBig.width}x${cardBig.height} @y=${cardY}`,
      fontSize: card.fontSize,
      accent: accentName,
      lines: lines.length ? lines : ['HEROES CHANGE', 'MATCHES'],
    },
    null,
    2,
  ),
);
