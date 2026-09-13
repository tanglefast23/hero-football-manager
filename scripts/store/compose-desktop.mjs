/**
 * Composes the ten desktop store screenshots from the raw 1920x1080 captures:
 * the same comic title cards as the iOS set, same titles, same line breaks,
 * same 25%-height placement. The card is 1100 px wide, which is the same
 * absolute size the iOS cards are on a 1320 px frame.
 *
 * No --coach-arrows on desktop: those arrows point at the phone HUD's
 * bottom controls, which sit in the left rail here.
 *
 * Run: node scripts/store/compose-desktop.mjs
 * Reads  artifacts/store-screenshots/desktop/raw/NN-<case>.png
 * Writes artifacts/store-screenshots/desktop/NN-<case>.png
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canvasKit, hexColor, PALETTE, writePng } from './title-card.mjs';

const RAW = resolve('artifacts/store-screenshots/desktop/raw');
const OUT = resolve('artifacts/store-screenshots/desktop');
const CARD_WIDTH = '1100';

/** Title lines per case, matching the iOS set's breaks. */
const TITLES = {
  'heroes-change-matches': ['HEROES CHANGE', 'MATCHES'],
  'contract-renewals': ['CONTRACT RENEWALS'],
  'coach-live': ['COACH LIVE'],
  'train-what-matters': ['TRAIN WHAT', 'MATTERS'],
  'facilities-pay-off': ['FACILITIES PAY OFF'],
  'story-every-week': ['STORIES WITH', 'CONSEQUENCES'],
  'player-requests': ['PLAYER REQUESTS'],
  'sponsors-want-more': ['SPONSORS WANT MORE'],
  'five-divisions-cup': ['5 DIVISIONS + CUP'],
  'financial-report': ['FINANCIAL REPORT'],
};

const files = (await readdir(RAW)).filter((name) =>
  /^\d\d-.*\.png$/.test(name),
);
if (files.length !== 10) {
  throw new Error(`Expected 10 raw captures in ${RAW}, found ${files.length}`);
}

for (const file of files.sort()) {
  const caseId = file.replace(/^\d\d-/, '').replace(/\.png$/, '');
  const lines = TITLES[caseId];
  if (!lines) throw new Error(`No title for ${caseId}`);
  execFileSync(
    'node',
    [
      'scripts/store/compose.mjs',
      join(RAW, file),
      join(OUT, file),
      '--width',
      CARD_WIDTH,
      ...lines.flatMap((line) => ['--line', line]),
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  console.log(`composed ${file}  "${lines.join(' / ')}"`);
}

// Contact sheet: two rows of five at one-fifth scale, for one-glance review.
const TILE_W = 384;
const TILE_H = 216;
const GUTTER = 8;
const ck = await canvasKit();
const sheetW = 5 * TILE_W + 6 * GUTTER;
const sheetH = 2 * TILE_H + 3 * GUTTER;
const surface = ck.MakeSurface(sheetW, sheetH);
const canvas = surface.getCanvas();
canvas.clear(hexColor(ck, PALETTE.ink));
const paint = new ck.Paint();
paint.setAntiAlias(true);
files.sort().forEach((file, index) => {
  const image = ck.MakeImageFromEncoded(readFileSync(join(OUT, file)));
  if (!image) throw new Error(`could not decode ${file}`);
  const x = GUTTER + (index % 5) * (TILE_W + GUTTER);
  const y = GUTTER + Math.floor(index / 5) * (TILE_H + GUTTER);
  canvas.drawImageRectOptions(
    image,
    ck.XYWHRect(0, 0, image.width(), image.height()),
    ck.XYWHRect(x, y, TILE_W, TILE_H),
    ck.FilterMode.Linear,
    ck.MipmapMode.Linear,
    paint,
  );
  image.delete();
});
writePng(ck, surface.makeImageSnapshot(), join(OUT, 'contact-sheet.png'));
console.log('composed contact-sheet.png');
