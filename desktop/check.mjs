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
import { app } from 'electron';
import { writeFile } from 'node:fs/promises';
import {
  createWindow,
  exportRoot,
  installHandler,
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
    result.rendered === true;
  console.log(JSON.stringify({ ...result, ok }));
  app.exit(ok ? 0 : 1);
}

// Nothing below may hang the check.
setTimeout(() => finish({ reason: 'hard timeout' }), HARD_TIMEOUT_MS);

app.whenReady().then(async () => {
  installHandler(exportRoot());
  const window = createWindow({ show: false, offscreen: true });
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
  const image = await contents.capturePage();
  await writeFile(new URL('./check.png', import.meta.url), image.toPNG());
  finish({ ...facts, rendered });
});
