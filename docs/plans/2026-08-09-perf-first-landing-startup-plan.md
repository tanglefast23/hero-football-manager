---
title: 'perf: Make first landing appear sooner'
type: perf
date: 2026-08-09
---

# perf: Make first landing appear sooner

## Overview

Reduce the blank and busy period before the first title screen without changing save recovery, first-frame language, title art, replay behavior, or audio cue order.

Measured cold local static-web baseline:

- First contentful paint: 364 ms.
- Real title ready: 560 ms.
- Pre-title audio requests: 38 files / 1,319,250 encoded bytes.
- Critical web assets include 7.7 MB decoded CanvasKit and 7.2 MB decoded entry/shared JavaScript before the App chunk.

The repository target remains a cold start below two seconds. Local timing is a comparison baseline, not device proof.

## Review Inputs

- Two read-only local analysis agents traced web, native, content, persistence, font, and audio startup.
- Grok 4.5 reviewed the proposal at high effort.
- Claude Opus 5 reviewed the same proposal in a bounded read-only run.
- Grok 4.5 then audited this implementation plan at high effort. Its required lazy-volume and preload-contract checks are included below.
- The synthesis is recorded in `docs/brainstorms/2026-08-09-first-landing-startup.md`.

## Proposed Solution

### 1. Give web an immediate wordless first paint

Edit `public/index.html`:

- Preload the exact CanvasKit URL with:

  ```html
  <link
    rel="preload"
    href="/canvaskit.wasm"
    as="fetch"
    type="application/wasm"
    crossorigin
  />
  ```

- Put a small wordless HFM mark and progress shape inside `#root`.
- Use only existing pitch/ink/paper colors and hard pixel geometry.
- Give the shell a language-neutral accessible name using the product name only.
- Do not add localized copy or fake controls.
- Keep the shell inside `#root`, so React mount and the existing CanvasKit error handler both replace it.

### 2. Cache pure translation resolution inputs

Edit `src/i18n/use-copy.ts`:

- Cache the merged English string table after its first construction.
- Cache one `CopyFn` per supported locale.
- Keep the cached structures internal and read-only; callers receive only the translation function.
- Preserve active-locale → English → key fallback and single-pass interpolation.

This avoids rebuilding the same 3,663-entry English fallback object and closure for every first-render `useCopy()` consumer.

### 3. Remove audio-player creation from the loading path

Edit `src/render/management-sfx.ts`:

- Make `setManagementSfxMasterVolume()` store the clamped value and update players that already exist.
- Export an explicit `prewarmManagementSfx()` that calls the existing ordered initializer.
- Keep `playManagementSfx()` initialization as the first-use fallback.
- When the initializer creates a player, apply the stored master volume and muted state immediately. This keeps mount-time mute and low-volume preferences effective when creation happens later.
- Do not change the catalog order, rapid-pool size, cue mappings, recovery cooldown, or teardown behavior.

Edit `src/render/rival-hero-voice.ts`:

- Make `setRivalHeroVoiceMasterVolume()` store/apply volume without calling the initializer.
- Keep `playRivalHeroLaugh()` initialization as the first-use path.
- Apply the stored master volume and muted state to every newly created laugh player.

Edit `App.tsx`:

- Keep volume propagation on mount; it becomes allocation-free for management and rival audio.
- After persistence is ready and the real title has committed, schedule `prewarmManagementSfx()` on native only.
- Require all title-safe conditions before scheduling: no boot error, no persistence-load error, the store is on `welcome`, and `landingView` is `title`.
- Schedule with `requestAnimationFrame(() => setTimeout(..., 0))`, and cancel both handles on cleanup. The timeout moves work after the frame that follows the title commit; a single animation-frame callback alone still runs before paint.
- Do not prewarm management SFX or rival voices on web. The first user gesture initializes the required audio path.
- Leave the development golden-replay assertion and all persistence ordering unchanged.

## Non-Goals

- Do not mount React or import Skia before `LoadSkiaWeb` resolves.
- Do not split `MatchScreen`, title power FX, the sprite catalog, or persistence loading in this pass.
- Do not show the title before preferences and save state are known.
- Do not change audio assets, cue semantics, volumes, player ordering, or tap timing.
- Do not change simulation code or `ENGINE_VERSION`.

## Tests and Verification

### Automated tests

1. Extend `src/i18n/__tests__/use-copy.test.ts`:
   - same locale returns the same function instance;
   - different locales remain distinct;
   - current translation, English fallback, missing-key, plural, and interpolation behavior still pass.
2. Update management SFX tests:
   - setting volume creates zero players;
   - first play without prewarm creates the existing ordered 33-player catalog and plays the correct cue;
   - explicit prewarm creates the same catalog once;
   - volume or mute set before initialization applies to every player created by prewarm or first play;
   - a later setter still updates all live players;
   - mute, rapid voices, recovery, teardown, and stable semantic mappings still pass.
3. Update rival voice tests:
   - setting volume creates zero players;
   - first laugh without setter-side initialization creates the five authored players and plays only the requested laugh;
   - volume or mute set before initialization applies to all five new players;
   - a later setter still updates all live players;
   - mute and teardown behavior still pass.
4. Add an App source test for the native prewarm gate:
   - web never schedules the prewarm;
   - boot and persistence errors block it;
   - only the committed title state schedules it;
   - cleanup cancels both scheduled handles.
5. Add a Node-source test for `public/index.html`:
   - exact CanvasKit preload attributes are present;
   - the preload href matches the URL produced by `index.web.ts` for `canvaskit.wasm`;
   - the wordless shell is a child of `#root`;
   - no Story, Settings, Continue, New, or Opening Club Files copy appears in the shell.

### Repository gates

Run:

```bash
npx jest --runInBand \
  src/i18n/__tests__/use-copy.test.ts \
  src/render/__tests__/management-sfx.test.ts \
  src/render/__tests__/management-sfx-voices.test.ts \
  src/render/__tests__/rival-hero-voice.test.ts \
  src/ui/__tests__/title-player-layering.test.ts \
  src/ui/__tests__/title-pop-scene-clock.test.ts \
  src/ui/__tests__/startup-shell.test.ts
npx tsc --noEmit
npm run export:web
```

### Browser proof

Serve the new `dist` and use a fresh headless browser session:

1. Confirm the wordless shell is present before the React title.
2. Poll for the real title and record `performance.now()`.
3. Confirm exactly one `canvaskit.wasm` resource entry and that it starts before the deferred entry scripts finish.
4. Confirm zero management/rival audio resource entries before the title is ready.
5. Confirm Story and Settings are interactive after replacement.
6. Confirm no page errors and no new console errors.
7. Force `/canvaskit.wasm` to fail and confirm the loading shell is replaced by the existing error text.
8. Close the browser and stop the server.

## Acceptance Criteria

- Web shows immediate, wordless HFM progress UI instead of an empty dark root.
- CanvasKit downloads once and starts from the HTML preload.
- The real title is no slower than the 560 ms local baseline and keeps its approved appearance and interactions.
- No management or rival audio assets compete with title readiness on web.
- Native management audio is ready after the title frame, while first use remains fail-soft if warming has not run.
- Copy lookup returns stable cached functions with unchanged output.
- First-frame locale, save recovery, Debug golden replay, and title player FX are unchanged.
- Focused tests, TypeScript, static export, and real browser checks pass.

## Risks and Mitigations

- Preload mismatch could double-download CanvasKit. Verify the exact URL, MIME type, CORS mode, and one resource entry.
- A shell outside `#root` could survive mount or failure. Keep it inside `#root` and test the forced failure path.
- Bulk audio warming can jank web. Do not warm on web; schedule native warming only after the title commit.
- Scheduling in a single animation-frame callback can still block the title paint. Cross the frame boundary, then use a zero-delay timer, and clean up both handles.
- Cached translation state could become mutable. Keep tables private and expose only pure functions.
- Source-indexed audio tests protect cue order. Do not refactor the ordered catalog in this pass.
