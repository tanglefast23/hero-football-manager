/**
 * Finds the FIRE_TORCH frames in a captured match.
 *
 * Two signals, both required, because a gold takeover panel alone cannot tell
 * the flame apart from any other power — the panel takes the CLUB colour, not
 * the power's:
 *   1. a takeover panel present in the control area (bright club gold), and
 *   2. FIRE_TORCH's own red ignition (#d94f52) burning on the PITCH, which no
 *      other shipped power draws.
 *
 * Surfaces and paints are allocated ONCE and reused: CanvasKit objects are
 * manually managed, and allocating per frame exhausts the wasm heap a few
 * hundred frames in, after which MakeSurface silently returns null.
 */
import fs from 'node:fs';
import path from 'node:path';
import CanvasKitInit from 'canvaskit-wasm';

const dir = process.argv[2] || '/tmp/hfm-frames3';
const BAND_H = 500;
const PITCH = { x: 0, y: 300, w: 1320, h: 2050 };
const PANEL = { x: 0, y: 2380, w: 1320, h: 480 };
const FIRE = [0xd9, 0x4f, 0x52]; // FIRE_TORCH primary (power-effect-descriptors)

const ck = await CanvasKitInit();
const paint = new ck.Paint();
const panelSurface = ck.MakeSurface(PANEL.w, PANEL.h);
const bandSurface = ck.MakeSurface(PITCH.w, BAND_H);
if (!panelSurface || !bandSurface)
  throw new Error('could not allocate surfaces');

const info = (w, h) => ({
  width: w,
  height: h,
  colorType: ck.ColorType.RGBA_8888,
  alphaType: ck.AlphaType.Unpremul,
  colorSpace: ck.ColorSpace.SRGB,
});

function read(surface, img, r, w, h) {
  const canvas = surface.getCanvas();
  canvas.drawImageRect(
    img,
    ck.XYWHRect(r.x, r.y, r.w, r.h),
    ck.XYWHRect(0, 0, w, h),
    paint,
  );
  return canvas.readPixels(0, 0, info(w, h));
}

const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.png'))
  .sort();
const rows = [];

for (const f of files) {
  const img = ck.MakeImageFromEncoded(fs.readFileSync(path.join(dir, f)));
  if (!img) continue;

  const panel = read(panelSurface, img, PANEL, PANEL.w, PANEL.h);
  let pr = 0,
    pg = 0,
    pb = 0,
    pn = 0;
  for (let i = 0; panel && i < panel.length; i += 4 * 37) {
    pr += panel[i];
    pg += panel[i + 1];
    pb += panel[i + 2];
    pn += 1;
  }
  const gold = pn > 0 && pr / pn > 150 && pg / pn > 110 && pb / pn < 120;

  let fire = 0;
  for (let top = PITCH.y; top < PITCH.y + PITCH.h; top += BAND_H) {
    const h = Math.min(BAND_H, PITCH.y + PITCH.h - top);
    const band = read(
      bandSurface,
      img,
      { x: PITCH.x, y: top, w: PITCH.w, h },
      PITCH.w,
      h,
    );
    if (!band) continue;
    for (let i = 0; i < band.length; i += 4 * 7) {
      if (
        Math.abs(band[i] - FIRE[0]) < 26 &&
        Math.abs(band[i + 1] - FIRE[1]) < 26 &&
        Math.abs(band[i + 2] - FIRE[2]) < 26
      )
        fire += 1;
    }
  }

  rows.push({ f, gold, fire });
  img.delete();
}

const withFire = rows.filter((r) => r.fire > 0).sort((a, b) => b.fire - a.fire);
console.log(
  `frames: ${rows.length}, gold-panel frames: ${rows.filter((r) => r.gold).length}`,
);
console.log('\ntop pitch-flame frames:');
for (const r of withFire.slice(0, 20)) {
  console.log(`  ${r.f}  firePx=${r.fire}  goldPanel=${r.gold}`);
}
const both = withFire.filter((r) => r.gold);
console.log(
  `\nBOTH takeover panel AND pitch flame: ${both.map((r) => `${r.f}(${r.fire})`).join(', ') || '(none)'}`,
);
