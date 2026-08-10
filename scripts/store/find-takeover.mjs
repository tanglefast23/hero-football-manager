/**
 * Scores each captured match frame by how much its CONTROL AREA differs from
 * the frame-set median. The power takeover replaces the control row with a
 * club-colour panel, so it shows up as a large, brief colour excursion.
 */
import fs from 'node:fs';
import path from 'node:path';
import CanvasKitInit from 'canvaskit-wasm';

const dir = process.argv[2] || '/tmp/hfm-frames';
// Control area in device pixels: below the pitch, above the tab/home bar.
const REGION = { x: 0, y: 2380, w: 1320, h: 480 };

const ck = await CanvasKitInit();
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.png'))
  .sort();
const rows = [];

for (const f of files) {
  const bytes = fs.readFileSync(path.join(dir, f));
  const img = ck.MakeImageFromEncoded(bytes);
  if (!img) continue;
  const surface = ck.MakeSurface(REGION.w, REGION.h);
  const canvas = surface.getCanvas();
  canvas.drawImageRect(
    img,
    ck.XYWHRect(REGION.x, REGION.y, REGION.w, REGION.h),
    ck.XYWHRect(0, 0, REGION.w, REGION.h),
    new ck.Paint(),
  );
  const px = canvas.readPixels(0, 0, {
    width: REGION.w,
    height: REGION.h,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  });
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let i = 0; i < px.length; i += 4 * 37) {
    // stride-sample, plenty stable
    r += px[i];
    g += px[i + 1];
    b += px[i + 2];
    n += 1;
  }
  rows.push({ f, r: r / n, g: g / n, b: b / n });
  img.delete();
  surface.delete();
}

const med = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const mr = med(rows.map((x) => x.r));
const mg = med(rows.map((x) => x.g));
const mb = med(rows.map((x) => x.b));

for (const row of rows) {
  row.d = Math.hypot(row.r - mr, row.g - mg, row.b - mb);
}
rows.sort((a, b) => b.d - a.d);
console.log(
  `median control colour rgb(${mr.toFixed(0)},${mg.toFixed(0)},${mb.toFixed(0)})`,
);
console.log('most-different frames:');
for (const row of rows.slice(0, 18)) {
  console.log(
    `  ${row.f}  d=${row.d.toFixed(1)}  rgb(${row.r.toFixed(0)},${row.g.toFixed(0)},${row.b.toFixed(0)})`,
  );
}
