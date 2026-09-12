import { BrowserWindow, app, protocol, shell } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEME = 'hfm';
export const APP_URL = `${SCHEME}://app/index.html`;

/** The two headers vercel.json sets; they unlock SharedArrayBuffer. */
const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.map': 'application/json',
};

/** Where the web export lives: beside the repo in development, inside resources when packed. */
export function exportRoot() {
  if (app.isPackaged) return join(process.resourcesPath, 'app');
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
}

/** Must run before app.whenReady(). */
export function registerScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

/** Maps a request URL to a file under root, or null if it escapes root. */
function resolveRequestPath(root, requestUrl) {
  const { pathname } = new URL(requestUrl);
  // The export is a single page; any extension-less path is the app.
  const relative =
    pathname === '/' || extname(pathname) === '' ? '/index.html' : pathname;
  const target = resolve(root, `.${decodeURIComponent(relative)}`);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  return target.startsWith(rootWithSep) ? target : null;
}

/** Must run after app.whenReady(). */
export function installHandler(root) {
  protocol.handle(SCHEME, async (request) => {
    const target = resolveRequestPath(root, request.url);
    if (target === null) return new Response('Forbidden', { status: 403 });
    try {
      const info = await stat(target);
      if (!info.isFile()) return new Response('Not found', { status: 404 });
      const body = await readFile(target);
      return new Response(body, {
        headers: {
          ...ISOLATION_HEADERS,
          'Content-Type':
            CONTENT_TYPES[extname(target)] ?? 'application/octet-stream',
          'Content-Length': String(body.byteLength),
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

export function createWindow({ show = true, offscreen = false } = {}) {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    show,
    autoHideMenuBar: true,
    backgroundColor: '#241f2e',
    title: 'Hero Football Manager',
    // `offscreen` is for check.mjs only: a hidden window never paints, so a
    // capture of one is blank; offscreen rendering paints to a bitmap.
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      offscreen,
    },
  });
  // Privacy-policy and support links go to the system browser, never a
  // second game window.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  void window.loadURL(APP_URL);
  return window;
}
