---
title: 'perf: Make first landing appear sooner'
type: perf
date: 2026-08-09
---

# perf: Make first landing appear sooner

## Goal

Replace the blank first-load wait with immediate progress feedback and remove measured work that competes with the first title. Preserve save recovery, first-frame language, title art, replay checks, and audio semantics.

## Audited Implementation

1. `public/index.html`
   - Preload `/canvaskit.wasm` as `fetch`, with `application/wasm` and matching CORS mode.
   - Add a wordless, non-interactive pitch mark and progress shape inside `#root`.
   - Use only product name as the accessible label. React mount and the existing loader failure handler replace the shell.
2. `src/i18n/use-copy.ts`
   - Cache the read-only merged English table.
   - Cache one locale-marked `CopyFn` per supported locale.
   - Preserve locale to English to key fallback and interpolation.
3. Audio modules
   - Make management and rival master-volume setters store volume and update only existing players.
   - Apply stored volume and muted state when players are later created.
   - Keep first-use initialization in both play paths.
   - Add an explicit ordered management prewarm function.
4. `App.tsx`
   - On native only, schedule management prewarm after a healthy committed title using `requestAnimationFrame` followed by `setTimeout(0)`.
   - Cancel both handles on cleanup.
   - Do not prewarm management or rival audio on web.

## Verification

1. Focused i18n, audio, title, press timing, and startup-shell tests.
2. `npx tsc --noEmit`.
3. `npm run export:web`.
4. Fresh browser proof:
   - immediate shell;
   - one CanvasKit request initiated by the preload link;
   - zero management/rival audio requests before title;
   - Story and Settings work;
   - no page errors;
   - a forced CanvasKit failure replaces the shell with recovery text.

## Acceptance

- The shell paints before CanvasKit and application startup complete.
- The real title is not slower than the measured 560 ms comparison baseline.
- Saved mute and volume apply to lazily created players.
- Debug golden replay, save recovery, title FX, first-frame locale, and cue order remain unchanged.
