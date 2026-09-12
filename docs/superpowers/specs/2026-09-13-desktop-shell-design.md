# Desktop shell (phase 4) — design

Date: 2026-09-13. Status: approved in conversation; implementation on
`feat/desktop-shell`, not merged to `main` until iOS 1.0 is live.

## Goal

Ship Hero Football Manager on Steam for Windows and macOS by wrapping the
existing web export in Electron. No new game code. No new persistence driver.
No Steamworks SDK.

## Decisions taken (owner, 2026-09-13)

- Platforms: Windows x64 and macOS universal.
- Saves: local only, no Steam Cloud. Saves stay in Chromium's OPFS under
  Electron's userData directory.
- No Steamworks SDK in v1. No achievements. Steam distributes a plain
  executable; the overlay and playtime tracking need no integration.
- Electron over Tauri. The web build is tested in Chromium; Tauri would run it
  in WebKit on macOS and WebView2 on Windows, and the three things most likely
  to differ between engines (`SharedArrayBuffer`, OPFS, CanvasKit) are exactly
  what the game depends on.

## What the web build already provides (verified in source)

- Two-column desktop layout, `TWO_COLUMN_MIN_WIDTH = 1100`
  (`src/ui/layout/layout-mode.ts`).
- Desktop match control rail (`src/render/MatchControlRail.tsx`, tested).
- Keyboard bindings (`src/ui/use-key-bindings.ts`) and pointer detection
  (`src/ui/pointer-capability.ts`).
- SQLite persistence through `expo-sqlite`'s web worker.
- Skia rendering through `canvaskit.wasm`.
- No fullscreen or window-size assumptions.

## What the web build does not provide

1. **Cross-origin isolation.** `expo-sqlite`'s worker channel uses
   `SharedArrayBuffer` (`node_modules/expo-sqlite/web/WorkerChannel.ts`).
   That needs `Cross-Origin-Opener-Policy: same-origin` and
   `Cross-Origin-Embedder-Policy: credentialless`, which `vercel.json` sets in
   production. `file://` sets no headers.
2. **Absolute asset paths.** `dist/index.html` references `/manifest.json`
   and `/_expo/...`. These do not resolve under `file://`.
3. **A production gate for web.** `src/ui/release-surface.ts` treats every
   web bundle as a review surface: Developer Mode and QA roots are on.
4. **External links.** The Settings privacy link would open a second Electron
   window instead of the system browser.

## Design

### 1. Shell — `desktop/`

Own `package.json` so Electron (about 100 MB) never enters the root
`npm ci` that every iOS CI job runs. Three source files: `shell.mjs` holds
the scheme, handler, and window; `main.mjs` is the bootstrap; `check.mjs`
imports `shell.mjs` so it can test without running the bootstrap.

`desktop/main.mjs`

- Registers `hfm` as a privileged scheme before `app.ready`:
  `standard`, `secure`, `supportFetchAPI`, `corsEnabled`, `stream`.
- After ready, `protocol.handle('hfm', …)` serves files from the export
  directory: `../dist` in development, `process.resourcesPath/app` when
  packaged. Every response carries the two isolation headers above and a
  `Content-Type` from the file extension. A path that escapes the root or
  does not exist returns 404.
- One `BrowserWindow`: 1280×800, minimum 1100×700 so the layout can never
  fall below `TWO_COLUMN_MIN_WIDTH`, `autoHideMenuBar: true` (no effect on
  macOS, hides the bar on Windows), `contextIsolation: true`,
  `nodeIntegration: false`, no preload.
- `setWindowOpenHandler` denies every new window and passes the URL to
  `shell.openExternal`.
- Loads `hfm://app/index.html`.
- Quits when all windows close, including on macOS. A game with no window
  has nothing to do in the Dock.

`desktop/check.mjs` — the one runnable check (see Testing).

`desktop/package.json` — `electron` 44.3.0, `electron-builder` 26.15.3,
`"main": "main.mjs"`, scripts `start`, `check`, `pack`. The `version` field
mirrors `expo.version` in `app.json`; keeping them equal is a manual step
recorded in AGENTS.md.

### 2. Production gate — `src/ui/release-surface.ts`

```ts
export function insideDesktopShell(location = globalThis.location): boolean {
  return location?.protocol === 'hfm:';
}
export function qaRootRoutesEnabled(isDev, platform, desktopShell = false) {
  return isDev || (platform === 'web' && !desktopShell);
}
export function developerModeAvailable(isDev, platform, desktopShell = false) {
  return isDev || (platform === 'web' && !desktopShell) || DEVELOPER_MODE_AVAILABLE;
}
```

`App.tsx` lines 424 and 497 pass `insideDesktopShell()` as the third
argument. Nothing else in the app changes.

This is structural, not injected. The shell can only serve the game through
`hfm://`, so a page on that scheme is inside the shell by definition. A
browser loading `dist/` sees `http:` or `file:` and keeps today's review
surface. There is no marker to forget. An earlier draft used a preload
marker; it was dropped because a missing preload would fail open.

### 3. Packaging

`electron-builder` configuration in `desktop/package.json`:

- `appId` `com.tanglefast.herofootballmanager`, `productName`
  `Hero Football Manager`.
- `extraResources`: `../dist` → `app`.
- `mac`: target `dir`, `universal`, `identity: null` (unsigned; Steam
  launches unsigned macOS apps and needs no notarization).
- `win`: target `dir`, `x64`, unsigned.
- `icon`: `../assets/icon.png`; electron-builder derives `.icns` and `.ico`.

Steam depots are directories, so `dir` is the right target: no installer, no
DMG, no NSIS. The macOS output is the `.app` bundle; the Windows output is
the unpacked folder with the `.exe`.

`.github/workflows/desktop.yml`, `workflow_dispatch` only:

- matrix `macos-latest`, `windows-latest`
- `npm ci` (root) → `npm run export:web` → `npm ci` in `desktop/` →
  `npm run check` → `npm run pack` → upload the output directory as an
  artifact.

Manual trigger only. Building Electron on every push would add minutes and a
100 MB download to CI for no benefit.

### 4. Testing

Headless, in the existing suite:

- `release-readiness.test.ts` truth tables gain a row per gate:
  `(false, 'web', true)` → `false`. The `toContainSource` assertion on the
  App.tsx call site updates to the three-argument form.
- `insideDesktopShell` gets three cases with fake locations: `hfm:` → true,
  `http:` → false, `undefined` → false.

In the shell, `desktop/check.mjs`:

- Starts Electron with `--mute-audio` and a hidden window (`show: false`), so
  it can run on a developer's Mac without sound or focus.
- Loads `hfm://app/index.html`, then evaluates in the page:
  `crossOriginIsolated && typeof SharedArrayBuffer === 'function' && location.protocol === 'hfm:'`.
- Waits for the app root to render, captures the page to
  `desktop/check.png`, prints the three booleans, exits 0 only if all are
  true.

This is the smallest check that fails if any of the three shell
responsibilities breaks: isolation headers, the scheme, or serving the
bundle at all. A successful save round-trip is not asserted in v1; without
`SharedArrayBuffer` the database cannot open, so the isolation check is the
proxy.

`npm run release:check` is unchanged. Adding a desktop preflight is a
follow-up once the first depot upload exists.

## Out of scope

Steam Cloud, achievements, Steamworks SDK, code signing, notarization,
auto-update, window-bounds persistence, Linux and Steam Deck, and the Steam
store page. The Steam Direct fee, App ID, and depot configuration are owner
actions on partner.steamgames.com.

## Determinism

The shell runs the same JavaScript bundle as the web export in the same
engine family. `src/sim/` and `src/game/` are untouched. `ENGINE_VERSION`
does not change.
