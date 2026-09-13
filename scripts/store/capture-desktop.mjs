/**
 * Captures the ten App Store scenes at Steam size from the store-media web
 * export, headless: an offscreen Electron window, audio muted, nothing shown.
 *
 * The export is served over plain http://127.0.0.1 on purpose. The desktop
 * shell's hfm:// scheme closes every QA root, and the store-media route is
 * one; http keeps the review surface open, and the same isolation headers
 * vercel.json sets keep expo-sqlite's worker happy.
 *
 * Build the export first:
 *   EXPO_PUBLIC_STORE_MEDIA=1 npx expo export --platform web --output-dir dist-store
 *   node scripts/web/fix-worker-bundles.mjs dist-store
 * Then, from the repo root:
 *   desktop/node_modules/.bin/electron scripts/store/capture-desktop.mjs
 *
 * Writes artifacts/store-screenshots/desktop/raw/NN-<case>.png at 1920x1080.
 */
import { BrowserWindow, app } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadScene, serveExport } from './serve-export.mjs';

const WIDTH = 1920;
const HEIGHT = 1080;
const EXPORT_DIR = resolve('dist-store');
const OUT_DIR = resolve('artifacts/store-screenshots/desktop/raw');
const SETTLE_MS = 2500;
const SCENE_TIMEOUT_MS = 30_000;

const CASES = [
  'heroes-change-matches',
  'contract-renewals',
  'coach-live',
  'train-what-matters',
  'facilities-pay-off',
  'story-every-week',
  'player-requests',
  'sponsors-want-more',
  'five-divisions-cup',
  'financial-report',
];

app.commandLine.appendSwitch('mute-audio');

setTimeout(
  () => {
    console.error('capture-desktop: hard timeout');
    app.exit(2);
  },
  CASES.length * SCENE_TIMEOUT_MS + 60_000,
);

app.whenReady().then(async () => {
  const server = await serveExport(EXPORT_DIR);
  const origin = `http://127.0.0.1:${server.address().port}`;
  await mkdir(OUT_DIR, { recursive: true });

  const window = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    backgroundColor: '#241f2e',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      offscreen: true,
    },
  });
  const contents = window.webContents;
  contents.setZoomFactor(1);

  let failures = 0;
  for (const [index, caseId] of CASES.entries()) {
    const rendered = await loadScene(
      contents,
      origin,
      caseId,
      index,
      SCENE_TIMEOUT_MS,
    );
    await new Promise((settled) => setTimeout(settled, SETTLE_MS));
    // Offscreen rendering paints at the host display's scale, so a Retina Mac
    // returns 3840x2160 for a 1920x1080 layout; force-device-scale-factor does
    // not reach the offscreen path. The capture is a true 2x supersample of the
    // same layout, so an exact 2:1 downscale is what a Retina player sees.
    const captured = await contents.capturePage();
    const image = captured.resize({
      width: WIDTH,
      height: HEIGHT,
      quality: 'best',
    });
    const { width, height } = image.getSize();
    const file = join(
      OUT_DIR,
      `${String(index + 1).padStart(2, '0')}-${caseId}.png`,
    );
    await writeFile(file, image.toPNG());
    const ok = rendered && width === WIDTH && height === HEIGHT;
    if (!ok) failures += 1;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${caseId} ${width}x${height}${rendered ? '' : ' (did not render)'}`,
    );
  }

  server.close();
  app.exit(failures === 0 ? 0 : 1);
});
