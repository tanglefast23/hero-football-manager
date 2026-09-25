import { BrowserWindow, Menu, app, protocol, screen, shell } from 'electron';
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
    try {
      const target = resolveRequestPath(root, request.url);
      if (target === null) return new Response('Forbidden', { status: 403 });
      const info = await stat(target);
      if (!info.isFile()) return new Response('Not found', { status: 404 });
      const body = await readFile(target);
      const headers = {
        ...ISOLATION_HEADERS,
        'Content-Type':
          CONTENT_TYPES[extname(target)] ?? 'application/octet-stream',
        'Accept-Ranges': 'bytes',
      };
      const requestedRange = request.headers.get('range');
      if (requestedRange !== null) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(requestedRange);
        const first = match?.[1] ? Number(match[1]) : null;
        const last = match?.[2] ? Number(match[2]) : null;
        const start = first ?? Math.max(0, body.length - (last ?? 0));
        const end =
          first === null || last === null
            ? body.length - 1
            : Math.min(last, body.length - 1);
        if (
          !match ||
          (first === null && last === null) ||
          (first !== null && !Number.isSafeInteger(first)) ||
          (last !== null && !Number.isSafeInteger(last)) ||
          start >= body.length ||
          start > end
        ) {
          return new Response(null, {
            status: 416,
            headers: { ...headers, 'Content-Range': `bytes */${body.length}` },
          });
        }
        return new Response(body.subarray(start, end + 1), {
          status: 206,
          headers: {
            ...headers,
            'Content-Range': `bytes ${start}-${end}/${body.length}`,
            'Content-Length': String(end - start + 1),
          },
        });
      }
      return new Response(body, {
        headers: { ...headers, 'Content-Length': String(body.byteLength) },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

export function installMenu() {
  Menu.setApplicationMenu(
    process.platform === 'darwin'
      ? Menu.buildFromTemplate([
          { role: 'appMenu' },
          { role: 'editMenu' },
          { label: 'View', submenu: [{ role: 'togglefullscreen' }] },
        ])
      : null,
  );
}

export function createWindow({ show = true, offscreen = false } = {}) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const window = new BrowserWindow({
    width: Math.min(1280, width),
    height: Math.min(800, height),
    minWidth: Math.min(1100, width),
    minHeight: Math.min(700, height),
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
    try {
      if (['https:', 'mailto:'].includes(new URL(url).protocol)) {
        void shell.openExternal(url);
      }
    } catch {
      // A malformed URL stays inside the denied window request.
    }
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${SCHEME}://app/`)) event.preventDefault();
  });
  if (process.platform !== 'darwin') {
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || input.key !== 'F11') return;
      window.setFullScreen(!window.isFullScreen());
      event.preventDefault();
    });
  }
  void window.loadURL(APP_URL);
  return window;
}
