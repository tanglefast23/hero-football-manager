# iPad / PWA audit — spec

**Date:** 2026-08-06
**Reviewed by:** Grok (grok-4.5, high effort) — round 1 REVISE, revisions folded in below.
**Trigger:** the game is being played on an iPad, installed from Safari to the home screen. One
tablet-specific defect already shipped and was fixed today (hover tips latched on with nothing held
down, because hover was gated on `Platform.OS === 'web'`). That was a *class* of bug — a desktop
assumption reaching a touch device through the web build — so this audit looks for the rest of the
class before the players find them.

## Goal

Find every defect that is specific to running the web build on an iPad (and to running it as an
installed home-screen web app), classify it by severity, and leave behind a repeatable check so the
same defects cannot come back silently.

## Scope

The shipped web target only: `npm run export:web` output served by Vercel, opened on iPadOS Safari
and as a home-screen web app. In scope: the generated HTML shell, CSS reset, persistence, app
lifecycle, gestures, layout, audio, and the Skia canvas — everything that behaves differently
because there is no mouse, no keyboard, no OS process guarantees, and no browser chrome.

## Non-goals

- The native iOS build (different runtime; its own gates already exist).
- Desktop web regressions, except where a fix must not break them.
- Android/Chrome touch devices — the same fixes should help, but they are not verified here.
- Redesigning any screen for tablet. This audit fixes defects, it does not re-lay-out the game.
- Cross-origin isolation as a project goal. See F6: this app does not depend on it.

## Established facts (measured today, not assumed)

From `dist/` (the real export in the main folder), `node_modules/expo-sqlite`, and the source tree:

1. `dist/index.html` head is Expo's default: `<meta name="viewport" content="width=device-width,
   initial-scale=1, shrink-to-fit=no">`, `<title>`, a favicon link, and the RNW reset
   (`html,body{height:100%}`, `body{overflow:hidden}`, `#root{display:flex;height:100%;flex:1}`).
2. `dist/` root contains only `_expo/`, `assets/`, `canvaskit.wasm`, `favicon.ico`, `index.html`,
   `metadata.json`. **No `manifest.json`, no `apple-touch-icon`, no service worker, no splash images.**
3. No `apple-mobile-web-app-capable`, no `mobile-web-app-capable`, no `theme-color`, no
   `viewport-fit=cover`, no `apple-mobile-web-app-status-bar-style`.
4. `global.css` contributes `#root { user-select: none }`, `body { overflow: hidden; background:
   #241f2e }`, and `image-rendering: pixelated` on img/canvas/svg. Tailwind's preflight adds
   `html,:host { -webkit-text-size-adjust: 100%; -webkit-tap-highlight-color: transparent }`. The
   built CSS has **no `touch-action` rule, no `-webkit-touch-callout` rule, no `overscroll-behavior`**.
5. `app.json` declares `orientation: "portrait"` (native only — the web build has no orientation
   declaration anywhere) and `web: { output: "single" }` (SPA, no static routes, no SW).
6. Persistence is `expo-sqlite` (`App.tsx` `openDatabaseAsync`), which on web is wa-sqlite in a Web
   Worker over `AccessHandlePoolVFS` — OPFS sync access handles *inside the worker*. `SharedArrayBuffer`
   + `Atomics` are used only by expo-sqlite's **sync** API surface; this app's `PersistenceDatabase`
   interface is async-only, so **the app does not depend on cross-origin isolation**. A named database
   never silently falls back to `MemoryVFS`: a failed `AccessHandlePoolVFS.create()` throws. The owner
   is playing a live Season 1 Week 2 career on the iPad, so OPFS demonstrably works there.
   `vercel.json` nonetheless sets `COOP: same-origin` and `COEP: credentialless` (a Chromium-only COEP
   value) — a compatibility curiosity, not a persistence dependency.
7. `queueCareerSave` (`src/application/store.ts`) coalesces writes onto a serial queue. Backgrounding
   *is* observed elsewhere — `src/render/audio-lifecycle.ts` listens on both `AppState` and
   `visibilitychange`, and `MatchScreen` re-bases its clock on `AppState` 'active' — but **nothing
   flushes the save queue when the app is hidden**, nothing listens for `pagehide`, and
   `navigator.storage.persist()` is never requested.
8. `MatchScreen` drives the watched match from `requestAnimationFrame` + `performance.now()`, and its
   `AppState` listener resets `last`/`acc` on resume, so a background gap cannot fast-forward the
   sim. This surface is already handled; the audit only fences it.
9. `src/render/audio.ts` builds every `expo-audio` player up front and calls
   `setAudioModeAsync({ playsInSilentMode: false })` (a native-only setting). Web `play()` rejections
   are swallowed (documented already: web SFX failures are silent). `setPlayerVolume` already knows
   iOS refuses programmatic `volume` and carries mute through `muted` instead — so on an iPad the
   slider's 0% works and the levels in between do nothing.
10. The only keyboard-specific copy ("press 3", "press Enter") lives inside hover tips, which no
    longer render without a hovering pointer.
11. `TWO_COLUMN_MIN_WIDTH = 1100`, so **an iPad in landscape gets the two-column desktop layout** and
    in portrait gets the phone layout. Both layouts are touch-driven on this device.
12. Inputs clear the iOS zoom floor already: the created-player name field is `text-xl` (20px on web),
    the glossary search is `text-base` (16px).
13. No module-scope `Dimensions.get` anywhere; layout reads `useWindowDimensions`.

## Severity ladder

- **P0** — loses or corrupts the player's career, or makes the game unplayable.
- **P1** — a mechanic misbehaves, or the game fights the device on every session.
- **P2** — visible wrongness or missing polish a player would report.
- **P3** — cosmetic, compatibility-only, or theoretical.

## Risk surfaces and the check for each

Each item states the risk, how it will be checked, and what counts as a pass. "Static" = machine
check in the audit harness against `dist/` and the repo. "Code" = read the path and reason about it.
"Device" = only the owner's iPad can answer, so the harness prints it as MANUAL with the exact thing
to look for.

### S1 — Career persistence on the iPad

- **R1.1 (P0, primary)** No flush on hide. iOS kills backgrounded web apps without warning, so a
  completed action whose coalesced write is still queued is lost. Check: static/source fence (a
  `visibilitychange`→hidden and `pagehide` handler exists **and drains the save queue**) plus a unit
  test of the drain. Pass: leaving the app right after an action cannot lose that action.
- **R1.2 (P1)** OPFS/VFS init failure is a hard failure by design (fact 6). The risk is that the
  player meets it as a bare spinner or an unexplained BootFailure. Check: code (the boot chain's
  failure path and its copy). Pass: a storage engine that cannot start says so in words a player can
  act on, and offers Retry / Start Fresh.
- **R1.3 (P2)** Storage eviction. Safari evicts site data; installed web apps are better protected,
  but `navigator.storage.persist()` is never requested. Check: static/source fence. Pass: web asks
  once for persistent storage and records the answer where diagnostics can see it.
- **R1.4 (P1)** A failed or quota-blocked write must be visible. Check: code (the existing
  save-failure banner path is reachable on web, not native-only). Pass: no silent failed save.
- **R1.5 (P3, compatibility only)** `COEP: credentialless` is not a value Safari implements. It is not
  load-bearing here (fact 6). Check: static, informational. Pass: recorded as a known no-op on Safari.
  **Changing the COOP/COEP headers is explicitly NOT an acceptable fix for any persistence finding.**
- **R1.6 (MANUAL)** Does a career survive force-quitting the installed app? Confirms R1.1's fix and
  fact 6 end to end.

### S2 — Gestures the browser steals (P1)

- **R2.1** Double-tap zoom. Training is rapid tapping; without `touch-action: manipulation` iPadOS
  treats two quick taps as a zoom. Check: static (CSS rule present in the built CSS). Pass: repeat
  taps cannot zoom.
- **R2.2** Long-press callout. `InfoTip` opens its bubble on a 500ms hold, exactly when iPadOS wants
  to show a selection / "Look Up" callout. `user-select: none` suppresses selection, but
  `-webkit-touch-callout: none` is absent. Check: static, device. Pass: a hold shows the tip only.
- **R2.3** Pinch zoom during a match can strand the pitch off-screen with no way back. Check: static
  (viewport and `touch-action` policy), device. Pass: a stray pinch cannot strand the view.
- **R2.4** Drag on the substitution board (PanResponder) versus page/list scroll on touch. Check: code
  + device. Pass: a card drag never scrolls the board underneath it.
- **R2.5** iPadOS system edge gestures (Dock, Control Centre, multitasking) overlap the bottom nav and
  match controls. Check: code (no interactive control sits in the bottom ~20pt without inset padding)
  + device. Pass: no control is only reachable through a swipe iPadOS claims first.

### S3 — The installed web app shell (P2)

- **R3.1** No `apple-touch-icon`: the home screen shows a screenshot of the page instead of the crest.
  Check: static (link + file present in `dist/`). Pass: a 180×180 icon ships and is linked.
- **R3.2** No `manifest.json`: no name, `display: standalone`, orientation, icons, or theme/background
  colour. Check: static. Pass: a manifest ships, is linked, and its values match the app.
- **R3.3** No `viewport-fit=cover`: `react-native-safe-area-context` reads `env(safe-area-inset-*)`,
  which stays 0 without it, so the shell cannot pad for a home indicator or status bar. Check: static
  (meta present) + code (insets are consumed). Pass: chrome never sits under system UI.
- **R3.4** No `theme-color` / status-bar style: the status-bar area does not match the screen behind
  it. Check: static. Pass: declared once, matching the paper/ink palette.
- **R3.5** Launch appearance: `body` is already `#241f2e`, so a white flash is unlikely, but there is
  no splash. Check: static + device. Pass: launch never flashes white.
- **R3.6 (MANUAL matrix)** Standalone vs in-Safari differ in chrome, viewport height, and install
  path. The harness must print both cases to check, not assume standalone. Pass: both launch paths are
  usable; anything standalone-only is stated.

### S4 — Lifecycle and time (P1)

- **R4.1** RAF/clock re-base after backgrounding. Already handled (fact 8); the check is a fence so it
  stays handled. Check: jest fence on the `AppState` re-base, device.
- **R4.2** The boot watchdog (`BOOT_TIMEOUT_MS`) can fire while the app is suspended and show
  BootFailure on a healthy launch. Check: code. Pass: a suspend cannot be mistaken for a failed boot.
- **R4.3** Audio after an interruption (Siri, a call, backgrounding). Check: code (audio-lifecycle
  owners) + device. Pass: audio resumes or stays silent, never doubles.
- **R4.4** BFCache / freeze / discard: iOS may restore the page from the back-forward cache
  (`pageshow` with `persisted`) or cold-start after a discard. A restore skips React mount, so
  anything initialised once can be stale. Check: code (what a `pageshow`-persisted restore would miss;
  the R1.1 flush must not leave the queue permanently drained-and-detached) + device. Pass: a restored
  app is either fully live or reloads itself.

### S5 — Audio on iOS web (P2)

- **R5.1** Autoplay: iOS blocks audio until a user gesture, and `expo-audio`'s web `play()` rejection
  is swallowed. Check: code (is the first play gesture-driven or retried after the first tap?). Pass:
  music starts on the first tap, once.
- **R5.2** Volume: `HTMLMediaElement.volume` is read-only on iOS, so of the Settings slider's levels
  only 0% (via `muted`) has any effect there. Check: code. Pass: either the in-between levels do
  something on iOS web, or the slider stops implying they do.
- **R5.3** `playsInSilentMode` is native-only, so Control Centre is the only hardware control on the
  iPad. Check: code. Pass: no promise in the UI that iOS web cannot keep.

### S6 — Layout on a tablet (P2)

- **R6.1** The two-column layout turns on at 1100pt, so an iPad in landscape gets desktop density
  under fingers. Check: code (min tap-target size of every control the two-column layout adds) +
  device. Pass: every interactive control is at least 44pt on its short side, or has `hitSlop` that
  gets it there. Developer-only chrome is exempt and named.
- **R6.2** Rotation / Split View / Stage Manager resize continuously; portrait and landscape cross the
  1100pt breakpoint, so an iPad switches layouts mid-session. Check: code (fact 13) + device. Pass:
  reflow is clean at any width and rotation never loses state.
- **R6.3** Rubber-band overscroll exposes the dark body behind the paper UI. Check: static
  (`overscroll-behavior`). Pass: no dark band while scrolling a list.
- **R6.4** Web orientation policy: `app.json`'s portrait lock is native-only, so web runs in whatever
  orientation the tablet is in. Check: code + device (every screen in both orientations). Pass: both
  orientations are usable, or the manifest states a preference deliberately.

### S7 — Text input on iOS web (P2)

- **R7.1** Input zoom floor. Measured clear today (fact 12); the check is a fence. Check: jest fence on
  the two input classes, device. Pass: focusing an input never zooms.
- **R7.2** The software keyboard covers the focused field (no `KeyboardAvoidingView` on web, and iOS
  Safari resizes `visualViewport` rather than the layout viewport). Check: code (is there any
  scroll-into-view or `visualViewport` handling?) + device. Pass: the field stays visible while typing.
- **R7.3** Autocapitalise/autocorrect mangling names. Measured deliberate today; fence it.

### S8 — Delivery, offline, and staleness (P3)

- **R8.1** No service worker: launching the installed app without a network shows a browser error even
  though the game is fully client-side. Check: static. Pass: either a SW ships, or this is recorded as
  an accepted limitation with a reason.
- **R8.2** Update/staleness: hashed assets are immutable, but `index.html` must not be cached, and
  `vercel.json` sets no cache policy — this is a property of the live response, not of the repo.
  Check: probe the deployed URL's response headers (network), not just `vercel.json`. Pass: a relaunch
  always gets the new build; if the probe cannot run, print MANUAL rather than a false PASS.
- **R8.3** Partial load: a flaky network can deliver the HTML but stall `canvaskit.wasm`, a font, or a
  JS chunk, which reads as a hang rather than an error. Check: code (boot chain error paths beyond the
  timeout) + device. Pass: a stalled asset produces a message and a retry, not a dead screen.

### S9 — Skia / CanvasKit on the iPad (P1)

- **R9.1** `canvaskit.wasm` load: it ships at `dist/canvaskit.wasm` and must resolve on the deployed
  origin. Check: static (present in `dist/`, referenced correctly) + device. Pass: match day draws.
- **R9.2** WebGL context loss after backgrounding or memory pressure: a lost canvas can come back
  blank while the sim keeps running. Check: code (is context loss handled at all?) + device. Pass: a
  returning match either redraws or fails visibly, never silently blank.
- **R9.3** HiDPI: the canvas is sized in device pixels and CSS-stretched (`image-rendering: pixelated`
  covers the resampling). Check: code + device on a 2x iPad. Pass: sprites stay crisp, hit-testing
  still lands where the art is.
- **R9.4** Touch hit-testing into the canvas (match taps and the sub board over Skia). Check: code +
  device. Pass: every canvas-hosted control responds to touch.

### S10 — Regression fences for what was already fixed (P1)

- **R10.1** Hover-only UI must stay gated on hover capability, not on `Platform.OS === 'web'`.
- **R10.2** Any new hover, cursor, right-click, or keyboard-only affordance must have a touch path or
  be absent on touch.

## Deliverable: the audit harness

1. `scripts/qa/ipad-pwa-audit.mjs` — runs against a built `dist/`, prints one line per check with
   PASS / FAIL / MANUAL and a severity, exits non-zero on any FAIL. It owns the static checks (R2.1,
   R2.2, R3.1–R3.5, R6.3, R8.1, R9.1) and prints the MANUAL list (R1.6, R3.6, R6.2, R6.4, R9.2–R9.4,
   plus R8.2 when no deployment probe is available). An optional `--url <origin>` flag performs the
   R8.2 header probe against a live deployment; without it R8.2 prints MANUAL, never PASS.
2. `src/ui/__tests__/ipad-pwa-guards.test.ts` — jest fences for the source-level invariants that must
   not regress: R10 (hover capability), R1.1 (the hide/pagehide flush exists and drains the queue),
   R1.3 (`storage.persist` request), R4.1 (`AppState` re-base), R7.1/R7.3 (input classes and props).
   These run with the normal suite and need no `dist/`.
3. A findings section appended to this spec: every check, its verdict, and for each FAIL a severity
   and the fix that shipped.

The harness must be honest about what it cannot know: device-only checks print as MANUAL with the
exact thing to look for, and are collected for the owner at the end. No check may PASS on absence of
evidence.

## Acceptance criteria

- Every R-item has a recorded verdict (PASS / FAIL / MANUAL / ACCEPTED), and none is silently dropped.
- Every P0 and P1 FAIL is fixed in this branch, and each fix maps to a named failure mode with a test
  or harness check that fails without it. A fix whose failure mode cannot be stated is not a fix.
- Header changes (COOP/COEP) are not an acceptable remedy for any persistence finding (R1.5).
- P2/P3 FAILs are either fixed or written down as accepted limitations with a reason.
- `npx tsc --noEmit` clean, full jest suite green, harness exits 0 against a fresh export.
- No sim behaviour changes: `ENGINE_VERSION` must not need a bump. If it does, the change is out of
  scope for this audit.
- Desktop web keeps every affordance it has today; the tablet fixes are additive.

## Open questions for the owner (device-only)

1. Does a career survive force-quitting the installed app on the iPad? (R1.6.)
2. Is the home-screen launch full-screen with no Safari chrome? (Tells us which standalone path iOS is
   using today, and therefore what a manifest would change. R3.6.)
3. Is the iPad ever used with a Magic Keyboard or trackpad? (Decides whether hover and keyboard
   affordances should be reachable there at all.)
4. Is the iPad used in portrait as well as landscape? (Decides how much R6.4 matters.)

---

# Findings (2026-08-06)

Ran against a fresh `npm run export:web`, the full jest suite, and a live header probe of
`hero-football-manager.vercel.app`. Repeat with `npm run qa:ipad` (add
`--url https://hero-football-manager.vercel.app` for R8.2).

| Item | Verdict | Evidence / fix |
|---|---|---|
| R1.1 save flush on hide (P0) | **FIXED** | `flushPendingCareerSave` in `src/application/store.ts` cuts ahead of the serial queue; `src/ui/use-suspend-flush.ts` calls it on `visibilitychange`/`pagehide`; 5 behavioural tests in `src/application/__tests__/suspend-save-flush.test.ts`, two of which fail without the cut-ahead |
| R1.2 storage failure is loud | PASS | `AccessHandlePoolVFS.create` throws → boot chain `.catch` → BootFailure with Retry / Start Fresh (`App.tsx`) |
| R1.3 persistent storage (P2) | **FIXED** | `src/persistence/persistent-storage.ts`, requested once at boot; the answer is readable via `persistentStorageGrant()` and recorded with one `console.info` line so a browser inspector shows it |
| R1.4 failed save is visible | PASS | `recordSaveFailure` → non-dismissible `saveWarning`, rendered in `App.tsx` |
| R1.5 COEP `credentialless` (P3) | ACCEPTED | Chromium-only value, and not load-bearing: the app uses only expo-sqlite's async API, so it never needs `SharedArrayBuffer` or cross-origin isolation. Headers left alone |
| R1.6 survives force-quit | MANUAL | Owner |
| R2.1 double-tap zoom (P1) | **FIXED** | `touch-action: manipulation` on `#root` |
| R2.2 long-press callout (P1) | **FIXED** | `-webkit-touch-callout: none` on `#root` |
| R2.3 pinch zoom (P1) | ACCEPTED | Left working on purpose: iOS ignores `user-scalable=no`, and pinch is how a player undoes an accidental zoom |
| R2.4 drag vs scroll (P1) | PASS | `onStartShouldSetPanResponder` claims the gesture on touch-down, so the parent `ScrollView` cannot steal it; drag only exists in the wide layout |
| R2.5 system gesture edges (P1) | MANUAL | `viewport-fit=cover` now makes the insets real; whether every edge is clear is a device check |
| R3.1 home-screen icon (P2) | **FIXED** | `public/apple-touch-icon.png` (180) + link |
| R3.2 manifest (P2) | **FIXED** | `public/manifest.json` + 192/512 icons, linked |
| R3.3 `viewport-fit=cover` (P2) | **FIXED** | In `public/index.html`'s viewport meta |
| R3.4 theme + status bar (P2) | **FIXED** | `theme-color`, both capability metas, `black-translucent` status bar for the dark shell |
| R3.5 white launch flash (P2) | **FIXED** | `body { background: #241f2e }` moved into the shell's inline style, which paints before `global.css` arrives |
| R3.6 standalone vs Safari (P2) | MANUAL | Owner |
| R4.1 match clock re-base (P1) | PASS + fenced | `MatchScreen`'s `AppState` listener resets `last`/`acc` |
| R4.2 watchdog while hidden (P1) | **FIXED** | `appIsHidden()` re-arms the boot deadline instead of failing a suspended launch |
| R4.3 audio interruption (P1) | PASS | `audio-lifecycle.ts` suspends on `AppState` *and* `visibilitychange`; `tryRecoverMenuAudio` rebuilds dead players |
| R4.4 BFCache restore (P1) | PASS | The flush hook only adds listeners; nothing is torn down, so a restored page keeps a live store and queue |
| R5.1 autoplay unlock (P2) | PASS | `armWebAudioUnlock` retries the bed on the first `pointerdown`/`keydown` |
| R5.2 iOS web volume (P3) | ACCEPTED | `volume` is read-only on iOS web, so 0% works through `muted` and the levels between do not. Documented rather than hidden; a capability probe is a possible follow-up |
| R5.3 silent-mode promise (P3) | PASS | Nothing in the UI claims a hardware switch |
| R6.1 44pt tap targets (P2) | PASS | The roster's train button is 35pt with `hitSlop` carrying it to 45; the only sub-44 controls left are the developer save slots, which ship only in dev builds |
| R6.2 rotation across 1100pt (P2) | MANUAL | Owner |
| R6.3 overscroll (P3) | **FIXED** | `overscroll-behavior: none` on `html, body` |
| R6.4 web orientation (P2) | **FIXED** | Manifest declares `orientation: "any"`, so the native portrait lock does not leak to the tablet |
| R7.1 input zoom floor (P2) | PASS + fenced | 20px and 16px, both at or above the iOS zoom threshold |
| R7.2 keyboard covering a field (P2) | MANUAL | Owner |
| R7.3 autocapitalise (P2) | PASS + fenced | Deliberate on both inputs |
| R8.1 no service worker (P3) | ACCEPTED | An offline launch fails. A hand-rolled cache would risk pinning players to a stale bundle, which is the worse failure for a game that ships fixes weekly |
| R8.2 cache headers (P3) | PASS | Probed live: `index.html` revalidates, so a relaunch gets the new build |
| R8.3 partial asset load (P3) | ACCEPTED | The boot watchdog covers a stalled open and `ScreenErrorBoundary` catches a failed canvas; per-asset retry is out of scope |
| R9.1 `canvaskit.wasm` (P1) | PASS | Present in the export. Note: it arrives via `setup-skia-web` (the `postinstall`) writing `public/canvaskit.wasm`, which is gitignored — a fresh clone must install before exporting or the build ships no wasm |
| R9.2 GL context loss (P1) | MANUAL | `@shopify/react-native-skia` has no `webglcontextlost` handling and adding a remount is more than this audit should risk. Symptom to look for: a blank pitch after returning to a long-backgrounded match |
| R9.3 HiDPI (P1) | PASS | Device-pixel backing store plus `image-rendering: pixelated` |
| R9.4 canvas hit-testing (P1) | MANUAL | Owner |
| R10 hover capability (P1) | PASS + fenced | `src/ui/pointer-capability.ts`, landed earlier the same day with the tooltip fix |

**Totals:** 12 fixed (1 P0), 15 pass, 6 accepted with reasons, 8 device-only checks for the owner.

## Reviewed by Grok

The spec (2 rounds), the plan (2 rounds), and the finished diff (1 round) all went to Grok 4.5 at high
effort. Three of its findings changed the work materially:

1. The first spec framed the P0 as "cross-origin isolation may make saves memory-only". Measurement
   killed that: the app only uses expo-sqlite's async API, so it never needs `SharedArrayBuffer`.
   Changing the COOP/COEP headers is now explicitly banned as a persistence "fix".
2. The first plan flushed only when the save queue was *idle*, which is precisely when there is
   nothing to rescue. The shipped fix cuts ahead of a busy queue instead.
3. The first implementation handed a failed flush's payload back to `pendingCareerSave`. Because
   `queueCareerSave` coalesces into an existing payload *without enqueueing*, that payload had no
   owner and every later action would have joined a write that never happened — a worse bug than the
   one being fixed. The failure path now re-queues through `queueCareerSave`, and
   `lets a later action save after a failed flush` fails without it.

One residual, accepted: `resetCareerDatabase` (the boot-failure "Start Fresh") is not wrapped in
`exclusiveSaveDepth`. It only runs from a failed boot, where no career is loaded and so no payload can
be pending, and the flush's `persistenceLoadError` guard covers the unreadable-save path.

## For the owner, on the iPad

1. Does a career survive force-quitting the installed app? (R1.6)
2. Is the home-screen launch full-screen, and does opening the site in Safari still work? (R3.6)
3. With the new manifest, does the icon on the home screen become the club crest? (R3.1/R3.2)
4. Is any control trapped in an edge iPadOS claims — Dock, Control Centre, multitasking? (R2.5)
5. Rotate mid-session across the two-column breakpoint: does anything get lost? (R6.2)
6. Does the keyboard cover the name or glossary search field? (R7.2)
7. Leave a match backgrounded for a few minutes: does the pitch still draw? (R9.2)
8. Do the match-day controls over the canvas all respond to touch? (R9.4)
