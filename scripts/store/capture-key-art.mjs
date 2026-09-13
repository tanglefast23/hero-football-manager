/**
 * Captures the text-free key-art scene for the Steam capsules, headless:
 * an offscreen Electron window, audio muted, nothing shown.
 *
 * Build the store-media export first (see capture-desktop.mjs), then:
 *   desktop/node_modules/.bin/electron scripts/store/capture-key-art.mjs
 *
 * Writes artifacts/store-capsules/raw/key-art.png at 3840x2160: the full
 * 2x supersample of a 1920x1080 layout, kept at full size because every
 * capsule is a crop of it and the library hero alone is 3840 wide.
 */
import { BrowserWindow, app } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadScene, serveExport } from './serve-export.mjs';

const WIDTH = 1920;
const HEIGHT = 1080;
const EXPORT_DIR = resolve('dist-store');
const OUT_DIR = resolve('artifacts/store-capsules/raw');
const SETTLE_MS = 2500;
const SCENE_TIMEOUT_MS = 30_000;

app.commandLine.appendSwitch('mute-audio');

setTimeout(() => {
  console.error('capture-key-art: hard timeout');
  app.exit(2);
}, SCENE_TIMEOUT_MS + 60_000);

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

  const rendered = await loadScene(
    contents,
    origin,
    'key-art',
    0,
    SCENE_TIMEOUT_MS,
  );
  await new Promise((settled) => setTimeout(settled, SETTLE_MS));
  const image = await contents.capturePage();
  const { width, height } = image.getSize();
  const file = join(OUT_DIR, 'key-art.png');
  await writeFile(file, image.toPNG());
  const ok = rendered && width === WIDTH * 2 && height === HEIGHT * 2;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} key-art ${width}x${height}${rendered ? '' : ' (did not render)'}`,
  );

  server.close();
  app.exit(ok ? 0 : 1);
});
