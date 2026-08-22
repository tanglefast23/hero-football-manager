/**
 * Composes an App Store screenshot: a captured 1320x2868 game frame with a
 * distinct comic title laid over a quiet part of the screen.
 *
 * The game frame is never scaled. The title is drawn at output resolution.
 *
 * Output is flattened onto an opaque background: App Store screenshots must
 * carry no alpha channel (runbook Phase 9).
 *
 * Usage: node scripts/store/compose.mjs <frame.png> <out.png> [--y N]
 *        [--accent gold|blue|red|grey|pitch] [--line "TEXT"]... [--width N]
 *        [--coach-arrows]
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  canvasKit,
  drawTitleCard,
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

const requestedY = flag('y');
const accentName = flag('accent', 'blue');
const accent = PALETTE[accentName] ?? PALETTE.gold;
const coachArrows = args.includes('--coach-arrows');

const ck = await canvasKit();

const frameBytes = fs.readFileSync(framePath);
const frame = ck.MakeImageFromEncoded(frameBytes);
if (!frame) throw new Error(`could not decode ${framePath}`);
const W = frame.width();
const H = frame.height();

const card = drawTitleCard(ck, {
  lines: lines.length ? lines : ['HEROES CHANGE', 'MATCHES'],
  width: Number(flag('width', W)),
  accent,
});
const dockTop = Math.round(H * (W / H < 0.6 ? 0.765 : 0.875));
const cardY =
  requestedY !== undefined
    ? Number(requestedY)
    : coachArrows
      ? dockTop - card.height - Math.round((W / 440) * 56)
      : Math.round(H * 0.25 - card.height / 2);

const surface = ck.MakeSurface(W, H);
const canvas = surface.getCanvas();
// Opaque ground first: guarantees a fully flattened, alpha-free result.
canvas.clear(hexColor(ck, PALETTE.ink));

const paint = new ck.Paint();
paint.setAntiAlias(false);
canvas.drawImage(frame, 0, 0, paint);
canvas.drawImage(card.image, Math.round((W - card.width) / 2), cardY, paint);

if (coachArrows) {
  const unit = W / 440;
  const arrowPaint = new ck.Paint();
  arrowPaint.setAntiAlias(true);
  arrowPaint.setStyle(ck.PaintStyle.Stroke);
  arrowPaint.setStrokeCap(ck.StrokeCap.Round);

  const drawArrow = (startX, targetX, targetY) => {
    const startY = cardY + card.height - Math.round(8 * unit);
    const dx = targetX - startX;
    const dy = targetY - startY;
    const length = Math.hypot(dx, dy);
    const ux = dx / length;
    const uy = dy / length;
    const px = -uy;
    const py = ux;
    const headLength = 18 * unit;
    const headWidth = 10 * unit;
    const baseX = targetX - ux * headLength;
    const baseY = targetY - uy * headLength;
    const shadow = 3 * unit;

    arrowPaint.setStrokeWidth(9 * unit);
    arrowPaint.setColor(hexColor(ck, PALETTE.ink));
    canvas.drawLine(
      startX + shadow,
      startY + shadow,
      baseX + shadow,
      baseY + shadow,
      arrowPaint,
    );
    arrowPaint.setStrokeWidth(5 * unit);
    arrowPaint.setColor(hexColor(ck, PALETTE.gold.base));
    canvas.drawLine(startX, startY, baseX, baseY, arrowPaint);

    const head = ck.Path.MakeFromCmds([
      ck.MOVE_VERB,
      targetX,
      targetY,
      ck.LINE_VERB,
      baseX + px * headWidth,
      baseY + py * headWidth,
      ck.LINE_VERB,
      baseX - px * headWidth,
      baseY - py * headWidth,
      ck.CLOSE_VERB,
    ]);
    if (!head) throw new Error('could not draw coach arrowhead');
    arrowPaint.setStyle(ck.PaintStyle.Stroke);
    arrowPaint.setStrokeJoin(ck.StrokeJoin.Round);
    arrowPaint.setStrokeWidth(5 * unit);
    arrowPaint.setColor(hexColor(ck, PALETTE.ink));
    canvas.drawPath(head, arrowPaint);
    arrowPaint.setStyle(ck.PaintStyle.Fill);
    arrowPaint.setColor(hexColor(ck, PALETTE.gold.base));
    canvas.drawPath(head, arrowPaint);
    head.delete();
  };

  const dockTargetY = dockTop + Math.round(5 * unit);
  drawArrow(W * 0.3, W * 0.18, dockTargetY);
  drawArrow(W * 0.43, W * 0.5, dockTargetY);
  drawArrow(W * 0.58, W * 0.82, dockTargetY);
  drawArrow(W * 0.72, W * 0.84, H * (W / H < 0.6 ? 0.925 : 0.95));
  arrowPaint.delete();
}

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
      card: `${card.width}x${card.height} @y=${cardY}`,
      fontSize: card.fontSize,
      accent: accentName,
      coachArrows,
      lines: lines.length ? lines : ['HEROES CHANGE', 'MATCHES'],
    },
    null,
    2,
  ),
);
