# Desktop Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing web export in an Electron shell that serves it with cross-origin isolation, so the game runs on Windows and macOS with working saves and no developer surfaces.

**Architecture:** A `desktop/` package with its own dependencies serves `dist/` through a custom `hfm://` scheme that adds the two isolation headers `expo-sqlite`'s `SharedArrayBuffer` channel needs. The game bundle detects the scheme and closes its web-only review surfaces. `electron-builder` packs unsigned `dir` targets, which is what Steam depots take.

**Tech Stack:** Electron 44.3.0, electron-builder 26.15.3, Node 22, existing Expo web export.

**Spec:** `docs/superpowers/specs/2026-09-13-desktop-shell-design.md`

## Global Constraints

- Work on branch `feat/desktop-shell`. Do not merge to `main` until iOS 1.0 is live.
- `src/sim/` and `src/game/` are untouched. `ENGINE_VERSION` does not change.
- Electron and electron-builder live only in `desktop/package.json`, never in the root `package.json`.
- The shell runs with `--mute-audio` and `show: false` in every automated check. Never open a visible window or play sound from a check.
- Windows target: `x64`, unsigned. macOS target: `universal`, unsigned, `identity: null`.
- Window: 1280×800 default, minimum 1100×700 (`TWO_COLUMN_MIN_WIDTH` is 1100).
- Isolation headers, exactly: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless`.
- Root `npm run format:check` covers `scripts/**/*.mjs` only; `desktop/*.mjs` is formatted with the same Prettier config by running `npx prettier --write desktop/*.mjs` from the root before each commit.

---

### Task 1: Production gate for the desktop shell

**Files:**
- Modify: `src/ui/release-surface.ts`
- Modify: `App.tsx:424` and `App.tsx:497-500`
- Test: `src/ui/__tests__/release-readiness.test.ts:60-90`

**Interfaces:**
- Produces: `insideDesktopShell(location?: { protocol?: string } | undefined): boolean`; `qaRootRoutesEnabled(isDev: boolean, platform: string, desktopShell?: boolean): boolean`; `developerModeAvailable(isDev: boolean, platform: string, desktopShell?: boolean): boolean`.

- [ ] **Step 1: Write the failing tests**

In `src/ui/__tests__/release-readiness.test.ts`, add `insideDesktopShell` to the import from `'../release-surface'`, then extend the two existing truth-table tests and add one new test:

```ts
  test('allows QA roots only in development or on the intentional web review surface', () => {
    expect(qaRootRoutesEnabled(true, 'ios')).toBe(true);
    expect(qaRootRoutesEnabled(true, 'android')).toBe(true);
    expect(qaRootRoutesEnabled(false, 'web')).toBe(true);
    expect(qaRootRoutesEnabled(false, 'ios')).toBe(false);
    expect(qaRootRoutesEnabled(false, 'android')).toBe(false);
    // The desktop shell serves the same web bundle but is a shipped product.
    expect(qaRootRoutesEnabled(false, 'web', true)).toBe(false);
    expect(qaRootRoutesEnabled(true, 'web', true)).toBe(true);
  });

  test('enables Developer Mode on Debug and web surfaces but not native Release', () => {
    expect(developerModeAvailable(true, 'ios')).toBe(true);
    expect(developerModeAvailable(true, 'android')).toBe(true);
    expect(developerModeAvailable(false, 'web')).toBe(true);
    expect(developerModeAvailable(false, 'ios')).toBe(false);
    expect(developerModeAvailable(false, 'android')).toBe(false);
    expect(developerModeAvailable(false, 'web', true)).toBe(false);

    const app = source('App.tsx');
    expect(app).toContainSource(
      'const developerModeAvailable = developerModeAvailableForSurface(__DEV__, Platform.OS, insideDesktopShell())',
    );
  });

  test('recognises the desktop shell by its URL scheme, never by an injected marker', () => {
    expect(insideDesktopShell({ protocol: 'hfm:' })).toBe(true);
    expect(insideDesktopShell({ protocol: 'http:' })).toBe(false);
    expect(insideDesktopShell({ protocol: 'file:' })).toBe(false);
    expect(insideDesktopShell(undefined)).toBe(false);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/ui/__tests__/release-readiness.test.ts`
Expected: FAIL — `insideDesktopShell` is not exported; the third-argument rows fail because the argument is ignored.

- [ ] **Step 3: Implement the gate**

Replace the two functions in `src/ui/release-surface.ts` and add the third:

```ts
/**
 * True when the web bundle is running inside the Electron desktop shell.
 *
 * Structural, not injected: the shell can only serve the game through its
 * `hfm://` scheme, so a page on that scheme is inside the shell by
 * definition. A browser loading `dist/` sees `http:` or `file:` and keeps the
 * review surface. A preload-injected marker was rejected because a missing
 * preload would fail open.
 */
export function insideDesktopShell(
  location: { protocol?: string } | undefined = globalThis.location,
): boolean {
  return location?.protocol === 'hfm:';
}

/**
 * Static web exports are an intentional review surface, while an App Store
 * archive or the desktop shell must always enter the real game even if a QA
 * environment variable is accidentally present when Metro bundles it.
 */
export function qaRootRoutesEnabled(
  isDev: boolean,
  platform: string,
  desktopShell = false,
): boolean {
  return isDev || (platform === 'web' && !desktopShell);
}

export function developerModeAvailable(
  isDev: boolean,
  platform: string,
  desktopShell = false,
): boolean {
  return (
    isDev || (platform === 'web' && !desktopShell) || DEVELOPER_MODE_AVAILABLE
  );
}
```

Keep the existing `DEVELOPER_MODE_AVAILABLE` constant and its doc comment exactly as they are; `release:check` greps that line.

In `App.tsx`, add `insideDesktopShell` to the import that already brings in `developerModeAvailable as developerModeAvailableForSurface` (around line 264), then:

Line 424:
```ts
  if (!qaRootRoutesEnabled(__DEV__, Platform.OS, insideDesktopShell())) return null;
```

Lines 497–500:
```ts
  const developerModeAvailable = developerModeAvailableForSurface(
    __DEV__,
    Platform.OS,
    insideDesktopShell(),
  );
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/ui/__tests__/release-readiness.test.ts && npx tsc --noEmit && npm run format:check`
Expected: PASS, tsc clean, Prettier clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/release-surface.ts App.tsx src/ui/__tests__/release-readiness.test.ts
git commit -m "feat(release-surface): close web review surfaces inside the desktop shell"
```

---

### Task 2: The shell — serve `dist/` over `hfm://`

**Files:**
- Create: `desktop/package.json`
- Create: `desktop/shell.mjs`
- Create: `desktop/main.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Produces from `shell.mjs`: `registerScheme(): void` (call before `app.whenReady`), `installHandler(root: string): void` (call after ready), `createWindow(options?: { show?: boolean }): BrowserWindow`, `exportRoot(): string`, `APP_URL = 'hfm://app/index.html'`.

- [ ] **Step 1: Create `desktop/package.json`**

```json
{
  "name": "hero-football-manager-desktop",
  "version": "1.0.0",
  "private": true,
  "description": "Electron shell that serves the Hero Football Manager web export for Steam.",
  "main": "main.mjs",
  "type": "module",
  "scripts": {
    "start": "electron .",
    "check": "electron check.mjs",
    "pack": "electron-builder --dir"
  },
  "devDependencies": {
    "electron": "44.3.0",
    "electron-builder": "26.15.3"
  },
  "build": {
    "appId": "com.tanglefast.herofootballmanager",
    "productName": "Hero Football Manager",
    "directories": { "output": "out" },
    "files": ["main.mjs", "shell.mjs"],
    "extraResources": [{ "from": "../dist", "to": "app" }],
    "icon": "../assets/icon.png",
    "mac": {
      "target": [{ "target": "dir", "arch": ["universal"] }],
      "identity": null,
      "category": "public.app-category.games"
    },
    "win": {
      "target": [{ "target": "dir", "arch": ["x64"] }]
    }
  }
}
```

`version` mirrors `expo.version` in `../app.json`. Keeping them equal is manual; Task 5 records that in AGENTS.md.

- [ ] **Step 2: Add ignores**

Append to `.gitignore`:

```
# Electron shell: dependencies, packed output, and the check's screenshot.
desktop/node_modules/
desktop/out/
desktop/check.png
```

- [ ] **Step 3: Install**

Run: `cd desktop && npm install && cd ..`
Expected: `electron` and `electron-builder` in `desktop/node_modules`; `desktop/package-lock.json` created. Electron downloads about 100 MB.

- [ ] **Step 4: Create `desktop/shell.mjs`**

```js
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

export function createWindow({ show = true } = {}) {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    show,
    autoHideMenuBar: true,
    backgroundColor: '#241f2e',
    title: 'Hero Football Manager',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
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
```

- [ ] **Step 5: Create `desktop/main.mjs`**

```js
import { app } from 'electron';
import { createWindow, exportRoot, installHandler, registerScheme } from './shell.mjs';

registerScheme();

app.whenReady().then(() => {
  installHandler(exportRoot());
  createWindow();
});

// A game with no window has nothing to do in the Dock.
app.on('window-all-closed', () => app.quit());
```

- [ ] **Step 6: Build the web export**

`dist/` currently holds an iOS export. Rebuild it:

Run: `npm run export:web`
Expected: `dist/index.html` and `dist/_expo/static/js/web/` exist. Task 3's check is the first run of the shell.

- [ ] **Step 7: Format and commit**

```bash
npx prettier --write desktop/*.mjs desktop/package.json
git add desktop/package.json desktop/package-lock.json desktop/shell.mjs desktop/main.mjs .gitignore
git commit -m "feat(desktop): Electron shell serving the web export over hfm://"
```

---

### Task 3: The runnable check — `desktop/check.mjs`

**Files:**
- Create: `desktop/check.mjs`

**Interfaces:**
- Consumes: `registerScheme`, `installHandler`, `exportRoot`, `createWindow` from `desktop/shell.mjs`.

- [ ] **Step 1: Write the check**

```js
/**
 * The smallest check that fails if the shell breaks: the scheme is live, the
 * isolation headers unlocked SharedArrayBuffer, and the bundle rendered.
 * Runs hidden and muted so it is safe on a developer's Mac.
 *
 * Run: npm run check   (from desktop/)
 */
import { app } from 'electron';
import { writeFile } from 'node:fs/promises';
import { createWindow, exportRoot, installHandler, registerScheme } from './shell.mjs';

const RENDER_TIMEOUT_MS = 30_000;

app.commandLine.appendSwitch('mute-audio');
registerScheme();

const result = await new Promise((resolveResult) => {
  app.whenReady().then(async () => {
    installHandler(exportRoot());
    const window = createWindow({ show: false });
    const contents = window.webContents;

    const waitForRender = contents.executeJavaScript(`
      new Promise((done) => {
        const started = Date.now();
        const tick = () => {
          const root = document.querySelector('#root');
          if (root && root.childElementCount > 0) return done(true);
          if (Date.now() - started > ${RENDER_TIMEOUT_MS}) return done(false);
          setTimeout(tick, 200);
        };
        tick();
      })
    `);

    const rendered = await waitForRender;
    const facts = await contents.executeJavaScript(`({
      protocol: location.protocol,
      isolated: crossOriginIsolated === true,
      sharedArrayBuffer: typeof SharedArrayBuffer === 'function',
    })`);
    const image = await contents.capturePage();
    await writeFile(new URL('./check.png', import.meta.url), image.toPNG());
    resolveResult({ ...facts, rendered });
  });
});

const ok =
  result.protocol === 'hfm:' &&
  result.isolated &&
  result.sharedArrayBuffer &&
  result.rendered;
console.log(JSON.stringify({ ...result, ok }));
app.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run the check and expect it to pass**

Run: `cd desktop && npm run check; cd ..`
Expected: `{"protocol":"hfm:","isolated":true,"sharedArrayBuffer":true,"rendered":true,"ok":true}` and exit 0. `desktop/check.png` shows the game's title screen at 1280×800.

If `isolated` is false: the headers did not apply. Confirm `registerScheme()` ran before `app.whenReady()` and that `ISOLATION_HEADERS` reach the `Response`.
If `rendered` is false: open `desktop/check.png`; a solid `#241f2e` means the bundle did not load — check that `dist/_expo/static/js/web/` exists.

- [ ] **Step 3: Prove the check can fail**

Temporarily delete the `'Cross-Origin-Embedder-Policy'` line from `ISOLATION_HEADERS` in `shell.mjs`, run `npm run check` again, and confirm `isolated:false` with exit 1. Restore the line. Do not commit the broken state.

- [ ] **Step 4: Format and commit**

```bash
npx prettier --write desktop/check.mjs
git add desktop/check.mjs
git commit -m "test(desktop): headless check for scheme, isolation, and render"
```

---

### Task 4: Packaging locally

**Files:**
- No new files; exercises `desktop/package.json` `build` config.

- [ ] **Step 1: Pack for macOS**

Run: `cd desktop && CSC_IDENTITY_AUTO_DISCOVERY=false npm run pack; cd ..`
Expected: `desktop/out/mac-universal/Hero Football Manager.app` exists. No signing prompt. Log shows `skipped macOS application code signing`.

- [ ] **Step 2: Verify the packed app serves from resources**

Run: `ls "desktop/out/mac-universal/Hero Football Manager.app/Contents/Resources/app/index.html"`
Expected: the file exists — `extraResources` copied `dist/` to `app/`.

- [ ] **Step 3: Verify the packed app boots hidden**

Run: `cd desktop && "out/mac-universal/Hero Football Manager.app/Contents/MacOS/Hero Football Manager" --mute-audio check.mjs; cd ..`

If the packed binary refuses to run a script argument (packaged Electron loads `main` from package.json and ignores it), this step is informational only; Task 3's check on the unpacked shell already proved `exportRoot()`'s development branch, and Step 2 proves the packaged branch's files exist.

- [ ] **Step 4: Nothing to commit**

`desktop/out/` is ignored. Confirm with `git status --short` → empty.

---

### Task 5: CI workflow and project notes

**Files:**
- Create: `.github/workflows/desktop.yml`
- Modify: `AGENTS.md` (new section after "Over-the-air updates")
- Modify: `docs/superpowers/specs/2026-09-13-desktop-shell-design.md` (one line: shell is three files, `shell.mjs` split out of `main.mjs` so `check.mjs` can import it without running the bootstrap)

- [ ] **Step 1: Create the workflow**

```yaml
name: Desktop

on:
  workflow_dispatch:

jobs:
  pack:
    name: ${{ matrix.os }}
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run export:web
      - run: npm ci
        working-directory: desktop
      - run: npm run check
        working-directory: desktop
      - run: npm run pack
        working-directory: desktop
        env:
          CSC_IDENTITY_AUTO_DISCOVERY: 'false'
      - uses: actions/upload-artifact@v4
        with:
          name: hfm-desktop-${{ matrix.os }}
          path: desktop/out/
          if-no-files-found: error
```

`workflow_dispatch` only. Building Electron on every push adds minutes and a 100 MB download for no benefit.

The `pack` script is plain `electron-builder --dir`; `CSC_IDENTITY_AUTO_DISCOVERY=false` is passed as an environment variable so the same script works in PowerShell on the Windows runner.

- [ ] **Step 2: Add the AGENTS.md section**

Insert after the "Over-the-air updates" section:

```markdown
## Desktop shell (Steam)

- `desktop/` is an Electron wrapper around `dist/`, the web export. It has its own `package.json`; Electron never enters the root install.
- Build: `npm run export:web`, then in `desktop/`: `npm ci`, `npm run check`, `CSC_IDENTITY_AUTO_DISCOVERY=false npm run pack`. Output lands in `desktop/out/`.
- `npm run check` is the shell's one test. It runs hidden and muted and asserts the `hfm://` scheme, cross-origin isolation, and a rendered root. Run it after any change to `desktop/shell.mjs` or to the web export.
- `desktop/package.json` `version` must equal `expo.version` in `app.json`. Bump both together.
- The game closes Developer Mode and QA roots when `location.protocol === 'hfm:'` (`insideDesktopShell` in `src/ui/release-surface.ts`). A browser loading `dist/` keeps the review surface.
- Packed apps are unsigned on both platforms on purpose; Steam launches them without notarization. Do not add signing without a store-side reason.
- Steam Cloud, achievements, and the Steamworks SDK are deliberately out of v1. The design is `docs/superpowers/specs/2026-09-13-desktop-shell-design.md`.
```

- [ ] **Step 3: Update the spec's file list**

In the spec, under "### 1. Shell", change "Two source files." to "Three source files: `shell.mjs` holds the scheme, handler, and window; `main.mjs` is the bootstrap; `check.mjs` imports `shell.mjs` so it can test without running the bootstrap."

- [ ] **Step 4: Commit and push the branch**

```bash
git add .github/workflows/desktop.yml AGENTS.md docs/superpowers/specs/2026-09-13-desktop-shell-design.md
git commit -m "ci(desktop): manual pack workflow for macOS and Windows; project notes"
git push -u origin feat/desktop-shell
```

- [ ] **Step 5: Trigger the workflow and read both jobs**

Run: `gh workflow run desktop.yml --ref feat/desktop-shell && sleep 30 && gh run list --workflow desktop.yml --limit 1`
Then watch: `gh run watch $(gh run list --workflow desktop.yml --limit 1 --json databaseId --jq '.[0].databaseId')`
Expected: both matrix jobs green; two artifacts uploaded. The Windows job is the first time the shell runs on Windows — if `check` fails there, read the printed JSON to see which of the three facts is false.
