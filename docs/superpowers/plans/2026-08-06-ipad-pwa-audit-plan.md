# iPad / PWA audit — implementation plan

**Spec:** `2026-08-06-ipad-pwa-audit-spec.md` (approved by Grok, round 2).
**Branch:** `claude/ipad-pwa-hover-tooltips-fd7a27` (already carries the hover-capability fix).

Verdicts below come from the code inspection already done while writing the spec; the harness in
Phase 5 exists to make each one repeatable, not to discover them for the first time. Anything marked
MANUAL stays MANUAL — the plan may not convert it to a PASS.

## Verdict table (what this plan acts on)

| Item | Verdict | Action |
|---|---|---|
| R1.1 no save flush on hide (P0) | FAIL | FIX — fast-path write on hide + unit test |
| R1.2 OPFS init failure copy (P1) | PASS | FENCE — BootFailure already offers Retry / Start Fresh |
| R1.3 no `storage.persist()` (P2) | FAIL | FIX — Phase 2 step 1: request once on web, record the answer |
| R1.4 save failure visible (P1) | PASS | FENCE — `saveWarning` is platform-agnostic, rendered in App |
| R1.5 COEP `credentialless` (P3) | ACCEPTED | Document as a Safari no-op; headers untouched |
| R1.6 career survives force-quit | MANUAL | Owner check |
| R2.1 no `touch-action` (P1) | FAIL | FIX — `touch-action: manipulation` on `#root` |
| R2.2 no `-webkit-touch-callout` (P1) | FAIL | FIX — `none` on `#root` |
| R2.3 pinch zoom (P1) | ACCEPTED | iOS ignores `user-scalable=no`; pinch stays (accessibility). Documented |
| R2.4 sub-board drag vs scroll (P1) | CODE | Inspect; fix only if the responder does not claim the gesture |
| R2.5 system gesture edges (P1) | CODE + MANUAL | `viewport-fit=cover` only *enables* insets — it is not the fix; owner confirms all four edges |
| R3.1 no `apple-touch-icon` (P2) | FAIL | FIX — 180×180 in `public/`, linked |
| R3.2 no manifest (P2) | FAIL | FIX — `public/manifest.json` + icons, linked |
| R3.3 no `viewport-fit=cover` (P2) | FAIL | FIX — viewport meta + verify insets are consumed |
| R3.4 no `theme-color` / status-bar style (P2) | FAIL | FIX — both, plus the apple capability metas |
| R3.5 launch flash (P2) | FAIL | FIX — `global.css` loads after first paint, so the shell's own inline style must carry the colour |
| R3.6 standalone vs Safari (P2) | MANUAL | Owner matrix |
| R4.1 RAF re-base (P1) | PASS | FENCE — `AppState` reset in MatchScreen |
| R4.2 boot watchdog during suspend (P1) | FAIL | FIX — re-arm instead of failing while hidden |
| R4.3 audio after interruption (P1) | PASS | FENCE — `audio-lifecycle` + `tryRecoverMenuAudio` |
| R4.4 BFCache restore (P1) | CODE | The hide flush must not detach the queue; assert it |
| R5.1 autoplay unlock (P2) | PASS | FENCE — `pointerdown`/`keydown` unlock in `menu-audio.ts` |
| R5.2 iOS web volume levels (P3) | ACCEPTED | 0% works via `muted`; levels are a documented iOS no-op |
| R5.3 `playsInSilentMode` (P3) | PASS | No UI promises it |
| R6.1 44pt targets in two-column (P2) | CODE | Inspect the two-column controls; dev chrome exempt |
| R6.2 rotation across 1100pt (P2) | MANUAL | Owner check; fact 13 already fences the code side |
| R6.3 no `overscroll-behavior` (P3) | FAIL | FIX — `none` on `html, body` |
| R6.4 web orientation policy (P2) | FIX | Manifest declares `orientation: any`; both orientations MANUAL |
| R7.1 input zoom floor (P2) | PASS | FENCE — `text-xl` / `text-base` |
| R7.2 keyboard covering input (P2) | MANUAL | Browser scrolls focus into view; owner confirms |
| R7.3 autocapitalise (P2) | PASS | FENCE |
| R8.1 no service worker (P3) | ACCEPTED | Offline launch fails; a hand-rolled SW risks stale bundles |
| R8.2 live cache headers (P3) | PROBE | `--url` probe against the deployment; MANUAL without it |
| R8.3 partial asset load (P3) | CODE | Boot chain beyond the timeout |
| R9.1 `canvaskit.wasm` in `dist/` (P1) | PASS | Harness check |
| R9.2 GL context loss (P1) | CODE + MANUAL | Inspect; fix only if cheap, else MANUAL with the symptom |
| R9.3 HiDPI (P1) | PASS | `image-rendering: pixelated` + device-pixel canvas |
| R9.4 canvas touch hit-testing (P1) | MANUAL | Owner check on match day |
| R10 hover regression fences (P1) | PASS | FENCE — landed earlier today |

## Phase 1 — R1.1: the career write that iOS can kill (P0)

**Failure mode being fixed:** the player taps something; the coalesced career write sits in the
serial `saveQueue` behind a long task (fulltime enqueues a replay write, and fulltime itself was
measured at 571ms); iOS kills the hidden web app before the chain reaches it. The action is lost.

**Why the obvious flush does not work:** `queueCareerSave` sets `pendingCareerSave` *and* enqueues its
task in the same breath, so "pending" almost always implies "a task is queued". Waiting for the queue
(`await saveQueue`) observes durability but does not make anything happen sooner — the chain runs
either way. Only cutting ahead of the queue shortens the window.

**Why cutting ahead is safe here (measured):** an ordinary career save is a single
`database.runAsync(UPSERT_CAREER_SQL, …)`, and so is a replay save — single statements, no open
transaction, and expo-sqlite serialises statements per connection. The only multi-statement
transactions (`withTransactionAsync`) are in the career-replacement / hard-reset paths, and those
already withdraw `pendingCareerSave` and retire the lineage. So a cut-ahead write is safe as long as
it never overlaps one of those.

1. `src/application/store.ts`
   - Add an `exclusiveSaveDepth` counter incremented around the tasks that open a transaction
     (career replacement, hard reset). It answers exactly one question: "would a cut-ahead write
     collide with an open transaction right now?"
   - Export `flushPendingCareerSave(): Promise<void>`:
     - Snapshot `pendingCareerSave`. If there is a payload, `exclusiveSaveDepth === 0`, the lineage
       still matches, and there is no `persistenceLoadError`, then **write it now, ahead of the
       queue**: clear `pendingCareerSave` first so the already-queued task's own generation guard
       turns it into a no-op, then `await repository.save(state)`.
     - On success run the same bookkeeping as the queued task (`clearSaveFailures`, and
       `hasSavedCareer` / `lastPersistedCareer` when the live career is still that state) so the
       "league result is still saving" guard and the dirty-state checks stay correct.
     - On failure, restore the snapshot into `pendingCareerSave` if nothing newer has replaced it —
       the queued task or the next action can still write it — and call `recordSaveFailure`.
     - Then `await saveQueue` so the flush's promise means "everything queued has settled", which is
       what a caller awaiting on `pagehide` wants.
   - Best-effort by construction: iOS can still kill us mid-write, which is why R1.4's warning path
     stays the backstop. The point is to make the window one statement wide instead of one long task
     plus one statement.
2. `src/ui/use-suspend-flush.ts` (new) — a hook that, on web only, calls the flush on
   `visibilitychange`→hidden and on `pagehide`. It must **not** tear down or disable the queue or the
   store: a BFCache restore (`pageshow`) has to find everything live (R4.4).
3. `App.tsx` — mount the hook once, after persistence is initialised.
4. Tests (`src/application/__tests__/`) — the ones that would fail against the rejected design:
   - **Busy queue, career behind a long task:** a fake repository whose replay save never resolves
     until released; queue a career save behind it; call the flush; assert the career state reached
     the repository *before* the long task resolved. This is the named failure mode.
   - Idle queue: the flush writes the pending payload and clears it.
   - Nothing pending and career === `lastPersistedCareer`: the flush is a no-op.
   - A failing flush restores the pending payload and records a save failure.
   - An in-flight exclusive (transactional) task: the flush does not cut ahead, and still resolves.
   - Plus a source fence that the hook listens for both events and `App.tsx` mounts it — the fence is
     never the primary evidence, because a listener that calls a no-op flush would pass it.

## Phase 2 — Storage permission, boot and failure honesty (R1.3, R4.2, R8.3, R1.2, R1.4)

1. **R1.3** — `src/persistence/persistent-storage.ts` (new, web-only body): call
   `navigator.storage.persist()` once after the database opens, ignore rejections, and record the
   answer where the developer diagnostics can read it (the same place the boot chain already reports
   warnings). Native and jest are no-ops. This is a real step, not only a fence: without it the
   Phase 5 fence would be asserting nothing.
2. `App.tsx` — when the boot watchdog fires, if the app is hidden (`document.hidden` on web, or
   `AppState.currentState !== 'active'`), re-arm it for another `BOOT_TIMEOUT_MS` instead of routing to
   BootFailure. A suspended launch is not a failed launch. Test: a source fence plus a unit test of the
   predicate if it can be extracted cheaply.
3. Read the boot chain once for R8.3 (a stalled `canvaskit.wasm`, font, or JS chunk while nominally
   online) and record the verdict. Only fix if a stall lands somewhere with no message at all — the
   watchdog already covers the common case, and inventing asset-level retries is out of scope.
4. Record R1.2/R1.4 as PASS with the file:line evidence in the findings table (no code change).

## Phase 3 — Gestures and the CSS shell (R2.1, R2.2, R6.3)

`global.css` only — three rules, each with a comment naming the iPad symptom:

```css
#root { touch-action: manipulation; -webkit-touch-callout: none; }
html, body { overscroll-behavior: none; }
```

- `touch-action: manipulation` removes the double-tap-zoom delay and gesture (R2.1). It does **not**
  disable pinch; that stays deliberately (R2.3), so a player who pinches can pinch back out.
- `-webkit-touch-callout: none` stops the iPadOS "Look Up / Copy" callout from racing `InfoTip`'s
  500ms hold (R2.2).
- `overscroll-behavior: none` keeps the dark `#241f2e` body from flashing behind a rubber-banded list
  (R6.3).

Harness checks assert all three land in the built CSS.

## Phase 4 — The installed web app shell (R3.1–R3.4, R6.4)

Expo resolves `public/index.html` as the HTML template (verified in
`@expo/cli/build/src/start/server/webTemplate.js` → `getUserDefinedFile`), and copies `public/` into
the export. So:

1. `public/index.html` — Expo's own template verbatim (keeping `%LANG_ISO_CODE%` and `%WEB_TITLE%` and
   the `expo-reset` style block) plus:
   - `viewport` becomes `width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover`.
   - `<meta name="apple-mobile-web-app-capable" content="yes">` and the standard
     `<meta name="mobile-web-app-capable" content="yes">`.
   - `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` — the shell is
     dark `#241f2e`, so `default` (a light status bar) would read as a mismatched white strip.
   - `<meta name="theme-color" content="#241f2e">` (the body colour behind the UI).
   - `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`.
   - `<link rel="manifest" href="/manifest.json">`.
   - `body { background: #241f2e }` **inside the inline `<style id="expo-reset">` block** (R3.5):
     `global.css` arrives as a stylesheet link and therefore after first paint, so the dark shell has
     to be in the HTML itself or the launch can still flash white.
2. `public/manifest.json` — `name`, `short_name`, `start_url: "/"`, `display: "standalone"`,
   `orientation: "any"` (R6.4: the native portrait lock must not become a web lock — the game is
   played in landscape on the iPad), `background_color`/`theme_color` `#241f2e`, and 192/512 icons.
3. Icons — generate `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` from
   `assets/icon.png` with `sips` (already on macOS; no new dependency). Keep them in `public/`.
4. Verify the export still boots: the injected tags must not disturb Expo's script/style injection.
   Run `npm run export:web` and diff the generated `dist/index.html` head against expectation.
5. `ManagementShell` already consumes `useSafeAreaInsets`; confirm the inset padding actually applies
   on web once `viewport-fit=cover` is present (R3.3, R2.5) and record it.

## Phase 5 — The harness (spec deliverables 1 and 2)

1. `scripts/qa/ipad-pwa-audit.mjs`
   - Reads `dist/` (path overridable) and the repo, prints one line per check:
     `PASS|FAIL|MANUAL  <severity>  <id>  <what was checked>`.
   - Static checks: viewport `viewport-fit=cover`; both capability metas; status-bar style;
     `theme-color`; `apple-touch-icon` link **and** file; manifest link, file, and its
     `display`/`orientation`/colour values; `touch-action`, `-webkit-touch-callout`,
     `overscroll-behavior` in the built CSS; `canvaskit.wasm` present; no service worker (printed as
     the ACCEPTED limitation, not a FAIL).
   - `--url <origin>` (optional): probes the deployment's `index.html` response for a non-cacheable
     `cache-control` and a hashed asset for an immutable one (R8.2). Without the flag, R8.2 prints
     MANUAL — never PASS.
   - Exits 1 on any FAIL, 0 otherwise. MANUAL lines never fail the run but are summarised at the end.
   - Fails loudly if `dist/` is missing, telling the caller to run `npm run export:web` first — a
     missing build must not read as "all checks pass".
2. `src/ui/__tests__/ipad-pwa-guards.test.ts` — source fences that run in the normal suite:
   R10 (hover capability, cross-checked with the existing `hover-pointer-capability.test.ts` so the
   two do not duplicate), R1.1 (the hook listens for `visibilitychange` and `pagehide` and calls the
   flush; `App.tsx` mounts it), R1.3 (`storage.persist` requested on web), R4.1 (the `AppState`
   re-base), R4.2 (the hidden-app re-arm), R7.1/R7.3 (input classes and props), and the three CSS
   rules in `global.css`.
3. `package.json` — `"qa:ipad": "node scripts/qa/ipad-pwa-audit.mjs"`. Not wired into `npm test`
   (it needs a build); documented in the findings section instead.

## Phase 6 — Code-inspection items, then findings

Do these as reading passes and record verdicts; fix only what the pass proves broken:

- R2.4 substitution-board drag versus scroll.
- R6.1 44pt tap targets in the two-column layout (developer save-slot chrome is exempt and named).
- R9.2 GL context loss — fix only if a listener + remount is genuinely small; otherwise MANUAL with
  the exact symptom for the owner ("the pitch is blank after returning to a long-backgrounded match").
- R4.4 BFCache restore against the Phase 1 hook.

Then append the findings table to the spec: every R-id, verdict, file:line evidence or fix, and the
MANUAL list for the owner (spec open questions 1–4).

## Risks and how they are contained

- **Breaking the web export.** A malformed `public/index.html` breaks every web build. Mitigation:
  start from Expo's exact template, keep the placeholders, and verify a fresh `export:web` produces a
  head containing both our tags and Expo's injected script/style tags.
- **Breaking native.** Nothing in Phases 3–4 exists on native (`global.css` and `public/` are web-only).
  Phase 1's hook is web-guarded; Phase 2's re-arm must keep native behaviour identical.
- **Double writes / transaction interleaving.** Phase 1 cuts ahead whenever a payload is pending and
  `exclusiveSaveDepth === 0`, and clears `pendingCareerSave` so the already-queued task no-ops. Two
  single-statement UPSERTs are safe to overlap because expo-sqlite serialises statements per
  connection; the cut-ahead never runs while a multi-statement transaction is open. Every
  `withTransactionAsync` save path must be inside the depth counter — grep for it rather than assuming
  the two known call sites are all of them.
- **Desktop regressions.** No hover, cursor, or keyboard behaviour changes in this plan.
- **Sim drift.** No file under `src/sim/` or `src/game/` is touched; `ENGINE_VERSION` must not change.
- **Scope creep.** Service worker, offline play, and a volume-capability probe are explicitly out
  (R8.1, R5.2 ACCEPTED). If one turns out to matter, it gets its own branch.

## Definition of done

- Every verdict-table row has landed: fixes shipped, fences written, ACCEPTED items documented in the
  spec's findings section with a reason, MANUAL items collected for the owner.
- `npx tsc --noEmit` clean; full jest suite green; `npm run export:web` succeeds and
  `node scripts/qa/ipad-pwa-audit.mjs` exits 0 against that build.
- The Phase 1 tests fail if the flush is removed (verified by deleting it once, locally).
- Commit + PR describing each finding, its severity, and its fix, with the MANUAL list for the owner.
