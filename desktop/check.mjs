/**
 * The smallest check that fails if the shell breaks: the scheme is live, the
 * isolation headers unlocked SharedArrayBuffer, and the bundle rendered.
 * Runs hidden and muted so it is safe on a developer's Mac.
 *
 * Run: npm run check   (from desktop/)
 *
 * No top-level await: Electron withholds `ready` until the main module has
 * finished evaluating, so awaiting `ready` at top level deadlocks.
 */
import { Menu, app, screen } from 'electron';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createWindow,
  exportRoot,
  installHandler,
  installMenu,
  registerScheme,
} from './shell.mjs';

const RENDER_TIMEOUT_MS = 30_000;
const HARD_TIMEOUT_MS = 60_000;

app.commandLine.appendSwitch('mute-audio');
registerScheme();

function finish(result) {
  const ok =
    result.protocol === 'hfm:' &&
    result.isolated === true &&
    result.sharedArrayBuffer === true &&
    result.rendered === true &&
    result.menuSafe === true &&
    result.windowFits === true &&
    result.musicRangeSafe === true;
  console.log(JSON.stringify({ ...result, ok }));
  app.exit(ok ? 0 : 1);
}

// Nothing below may hang the check.
setTimeout(() => finish({ reason: 'hard timeout' }), HARD_TIMEOUT_MS);

app.whenReady().then(async () => {
  installHandler(exportRoot());
  installMenu();
  const window = createWindow({ show: false, offscreen: true });
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const bounds = window.getBounds();
  const windowFits =
    bounds.width <= workArea.width && bounds.height <= workArea.height;
  const menuSafe =
    process.platform === 'darwin'
      ? Menu.getApplicationMenu()?.items.length === 3
      : Menu.getApplicationMenu() === null;
  const contents = window.webContents;

  await new Promise((loaded) => contents.once('did-finish-load', loaded));

  // Rendered means the game's own title copy is on screen and the startup
  // shell from index.html is gone, not merely that #root has a child.
  const rendered = await contents.executeJavaScript(`
    new Promise((done) => {
      const started = Date.now();
      const tick = () => {
        const shellGone = document.querySelector('.startup-shell') === null;
        const copy = (document.body.innerText || '').replace(/\\s+/g, ' ');
        const titleUp = /HERO FOOTBALL MANAGER/.test(copy);
        if (shellGone && titleUp) return done(true);
        if (Date.now() - started > ${RENDER_TIMEOUT_MS}) return done(false);
        setTimeout(tick, 200);
      };
      tick();
    })
  `);
  // Give the compositor a couple of frames after the DOM settles.
  await new Promise((settled) => setTimeout(settled, 1500));

  const facts = await contents.executeJavaScript(`({
    protocol: location.protocol,
    isolated: crossOriginIsolated === true,
    sharedArrayBuffer: typeof SharedArrayBuffer === 'function',
  })`);
  const musicDir = join(exportRoot(), 'assets/assets/audio/music');
  const musicFile = (await readdir(musicDir)).find((name) =>
    /^management-theme\..+\.m4a$/.test(name),
  );
  if (!musicFile) throw new Error('Management theme missing from web export');
  const music = await readFile(join(musicDir, musicFile));
  const range = await contents.executeJavaScript(`(async () => {
    const response = await fetch('/assets/assets/audio/music/${musicFile}', {
      headers: { Range: 'bytes=32768-' },
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      status: response.status,
      contentRange: response.headers.get('content-range'),
      length: bytes.length,
      firstBytes: Array.from(bytes.slice(0, 16)),
    };
  })()`);
  const musicRangeSafe =
    range.status === 206 &&
    range.contentRange === `bytes 32768-${music.length - 1}/${music.length}` &&
    range.length === music.length - 32768 &&
    JSON.stringify(range.firstBytes) ===
      JSON.stringify(Array.from(music.subarray(32768, 32784)));
  const image = await contents.capturePage();
  await writeFile(new URL('./check.png', import.meta.url), image.toPNG());
  finish({ ...facts, rendered, menuSafe, windowFits, musicRangeSafe });
});
