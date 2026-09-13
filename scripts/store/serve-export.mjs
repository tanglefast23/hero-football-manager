/**
 * Serves a web export over plain http://127.0.0.1 for the store captures.
 *
 * Plain http on purpose: the desktop shell's hfm:// scheme closes every QA
 * root, and the store-media route is one. The same two isolation headers
 * vercel.json sets keep expo-sqlite's SharedArrayBuffer worker happy.
 */
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

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

/** Resolves to a listening http.Server; read its port from `address()`. */
export function serveExport(root) {
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

/**
 * Loads one store-media scene in an offscreen Electron page and resolves
 * once the app root has rendered, or false after `timeoutMs`.
 */
export async function loadScene(contents, origin, caseId, index, timeoutMs) {
  // The store-media root reads the hash once on mount, and a URL that
  // differs only in its hash is a same-document navigation with no remount.
  // The query string makes each scene a distinct URL and a real load.
  const url = `${origin}/index.html?scene=${index}#/dev/app-store-scenes/${caseId}`;
  await contents.loadURL(url);
  return contents.executeJavaScript(`
    new Promise((done) => {
      const started = Date.now();
      const tick = () => {
        const shellGone = document.querySelector('.startup-shell') === null;
        const root = document.querySelector('#root');
        if (shellGone && root && root.childElementCount > 0) return done(true);
        if (Date.now() - started > ${timeoutMs}) return done(false);
        setTimeout(tick, 200);
      };
      tick();
    })
  `);
}
