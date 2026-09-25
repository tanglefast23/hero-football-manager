# Handoff: desktop (Steam) build loses menu music on the "Your First Hire" screen

Status 2026-09-24: **reproduced reliably, root cause NOT found.** Desktop/Electron only. iOS is unaffected.

Resolution 2026-09-25: `desktop/shell.mjs` now returns `206` and the requested
bytes for media range requests. The hidden, muted `hfm://` game reached "Your
First Hire" with the management track playing past 8 seconds and no media
error. `desktop/check.mjs` verifies a nonzero range request and its bytes.
The isolated-page result below did not reproduce the game's media request
sequence, so it did not rule out range handling in the full game.

## Symptom (Joe, Steam build 25508350, macOS)

On the create-player screen ("CLUB FILE 00 · YOUR FIRST HIRE") the music stops. Sound effects keep working. After that, no music plays anywhere.

`menuThemeForScreen` (src/render/menu-audio.ts) maps `welcome` → `opening` and `create-player`/`management` → `management`. So the failure point is the management-theme player.

## Reproduction (hidden, muted, fresh save, no focus stolen)

A dev Electron copy of the real shell (`desktop/shell.mjs`, `hfm://` scheme) runs offscreen and muted, with remote debugging on 9336 and a throwaway `userData`. Build `dist/` first with `npm run export:web`.

`repro-main.mjs` (run with `desktop/node_modules/.bin/electron repro-main.mjs`, from `desktop/`):

```js
import { app } from 'electron';
import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { createWindow, exportRoot, installHandler, installMenu, registerScheme } from '<repo>/desktop/shell.mjs';
app.commandLine.appendSwitch('mute-audio');
app.commandLine.appendSwitch('remote-debugging-port', '9336');
app.setPath('userData', mkdtempSync(join(tmpdir(), 'hfm-repro-')));
registerScheme();
setTimeout(() => app.exit(0), 15 * 60 * 1000);
app.whenReady().then(() => { installHandler(exportRoot()); installMenu(); createWindow({ show: false, offscreen: true }); });
```

Drive it over CDP from Node 22 (global `WebSocket`): get the `hfm://` page from `http://127.0.0.1:9336/json`, then call `Runtime.evaluate`. Synthetic DOM pointer events worked on the title button only. The welcome button needed trusted `Input.dispatchMouseEvent` (mouseMoved/mousePressed/mouseReleased) at the element centre, after `scrollIntoView`.

Steps:
1. Right after load, before any click, install an audio logger. Wrap `HTMLMediaElement.prototype.play`/`pause` and `window.Audio`, and listen for `ended`/`error`/`stalled`/`emptied`/`abort`. expo-audio web creates each player as `new Audio(uri)` in `AudioPlayer.web.js`; menu players init on the first `pointerdown` (web unlock).
2. Click "TAKE THE KEYS TO YOUR FIRST CLUB" (title), then "TAKE THE KEYS ▸" (welcome).

Observed log:

```
19.7s play()  opening-theme.m4a            (first pointerdown unlocks web audio)
118.3s pause() opening-theme.m4a t=8.7     (loops fine for ~100 s before this)
118.3s play()  management-theme.m4a t=0.0
120.5s EVENT:error management-theme.m4a t=2.1
```

The MediaError is code 3: `PIPELINE_ERROR_DECODE: Failed to send audio packet for decoding: {timestamp=2414875 duration=46440 size=365 is_key_frame=1}`. That matches `ffprobe` packet `pts_time=2.414875 size=365` in `assets/audio/music/management-theme.m4a`.

In the **same game page**, after the failure:
- A fresh `new Audio('/assets/assets/audio/music/management-theme.<hash>.m4a')` fails the same way at about 2.2 s.
- Fresh `new Audio(...)` for `opening-theme` and `celebration-anthem` reject `play()` with `NotSupportedError: Failed to load because no supported source was found`.
- A fresh `event-theme` plays fine.

## Ruled out, with evidence

1. **`hfm://` can't seek or loop.** In an isolated page, opening and management load with `seekable` 0 to duration. They seek to duration−1, loop back to 0 and keep playing.
2. **A broken file.** `ffmpeg -v error -i management-theme.m4a -f null -` reports 0 errors. In the game page, `OfflineAudioContext.decodeAudioData` decoded all 57 shipped `.m4a` files. Note: management-theme was encoded by ffmpeg's native AAC encoder (tag `Lavf62`, via `scripts/audio/gen-menu-music.mjs` `writeM4a`), and opening/event carry no encoder tag. That's a suspicious difference, but the whole-file decode passes.
3. **Isolated range probe.** The handler ignored `Range` and returned 200 with the full body. In an isolated page, management played 5 s past 2.41 s with one request, `Range: bytes=0-`. The same held after a 20 s idle preload before `play()`. This did not cover the full game's media request sequence.
4. **Too many media players.** With 20, 60 and 90 idle `<audio>` elements on the page, a new management player still played cleanly.
5. **A service worker.** There's none in `dist/`.

## Where to look next (untested)

- **The failures only happen after the game's audio has initialised, and only for URLs the game already loaded.** Test in the game page, after the failure: `new Audio(url + '?fresh=1')`. A different URL gets a different media cache entry. If it plays, suspect Chromium's shared media cache for that URL being poisoned by the first element's request pattern. Then log every `hfm://` request, with its `Range` header and the handler's response, during the real flow. The isolated probes only ever saw `bytes=0-`.
- **expo-audio web `preloadCache`** (`AudioModule.web.js`: `preloadAsync` fetches, makes a blob URL and creates a `new Audio(blobUrl)`). Check whether any game module calls `preload()`, or whether `clearPreloadCache`/`revokeObjectURL` runs. A revoked or truncated blob would explain both "no supported source" and a mid-file decode stop.
- **Concurrency with the SFX players** (`ui-tap.wav` plays on the same tap that starts the management theme), and anything else the game does at the first `pointerdown`.
- **Quick mitigation candidates, to verify, not assume:** add proper `206`/`Content-Range`/`Accept-Ranges` support to `installHandler`; or re-encode `management-theme.m4a` with a different encoder and retest.

Before any fix, add a failing check. Extend `desktop/check.mjs`, or add a probe like the ones above that plays management-theme past 3 s **after** the game's audio init.

## Release context

- Steam app 5323960: store page in review; build 25508350 live on `default`, but NOT yet submitted for build review. Hold it until this is fixed.
- A fix means re-packing: Windows via `desktop.yml` (workflow_dispatch), Mac via a signed and notarized local `npm run pack` (see AGENTS.md "Desktop shell (Steam)"). Zip both (`ditto -c -k --norsrc --noextattr --noqtn --noacl`, with `--keepParent` for the `.app`). Upload through Steamworks → SteamPipe → Upload Depots via HTTP, commit as a new build and set it live on `default`. The Steam-installed Mac app from build 25508350 verified intact: symlinks, signature and Gatekeeper all passed.
- Build review should be submitted by about 6 October for the 15 October release.
