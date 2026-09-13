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
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

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

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
};

function serveExport(root) {
  const server = createServer(async (request, response) => {
    const { pathname } = new URL(request.url, 'http://127.0.0.1');
    const relative =
      pathname === '/' || extname(pathname) === '' ? '/index.html' : pathname;
    const target = resolve(root, `.${decodeURIComponent(relative)}`);
    if (!target.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      if (!(await stat(target)).isFile()) throw new Error('not a file');
      const body = await readFile(target);
      response.writeHead(200, {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Content-Type':
          CONTENT_TYPES[extname(target)] ?? 'application/octet-stream',
        'Content-Length': body.byteLength,
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((ready) =>
    server.listen(0, '127.0.0.1', () => ready(server)),
  );
}

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
    // The store-media root reads the hash once on mount, and a URL that
    // differs only in its hash is a same-document navigation with no remount.
    // The query string makes each scene a distinct URL and a real load.
    const url = `${origin}/index.html?scene=${index}#/dev/app-store-scenes/${caseId}`;
    await contents.loadURL(url);
    const rendered = await contents.executeJavaScript(`
      new Promise((done) => {
        const started = Date.now();
        const tick = () => {
          const shellGone = document.querySelector('.startup-shell') === null;
          const root = document.querySelector('#root');
          if (shellGone && root && root.childElementCount > 0) return done(true);
          if (Date.now() - started > ${SCENE_TIMEOUT_MS}) return done(false);
          setTimeout(tick, 200);
        };
        tick();
      })
    `);
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
