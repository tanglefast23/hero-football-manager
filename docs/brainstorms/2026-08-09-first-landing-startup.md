---
date: 2026-08-09
topic: first-landing-startup
---

# First Landing Startup

## Decision

Use four low-risk startup changes:

1. Render a wordless HTML shell inside `#root` before application JavaScript is ready.
2. Preload the exact `/canvaskit.wasm` URL from HTML.
3. Cache the merged English copy table and one pure `CopyFn` per locale.
4. Make management and rival volume setters allocation-free. Keep web audio on demand. Prewarm the ordered management catalog on native only after a healthy title commit and paint.

Keep the development golden replay, save recovery, first-frame locale, title Skia scene, and persistence order unchanged.

## Evidence

- `index.web.ts` waits for CanvasKit before it imports and mounts `App`.
- The old HTML root was empty during that wait.
- CanvasKit is 8,076,553 bytes decoded and started only after entry JavaScript in the baseline trace.
- The first volume effect created 33 management players and five rival-laugh players before the web title.
- `copyFor()` rebuilt the same 3,663-entry English fallback table and returned a new closure for repeated first-render consumers.
- A measured cold baseline showed the real title at about 560 ms and 38 early audio requests totaling about 1.32 MB.

## Review Synthesis

- Grok 4.5 and Claude Opus 5 rejected moving the Debug golden replay behind an interactive title. It stays fail-closed.
- Both reviews required a language-neutral shell inside `#root` and a single-request CanvasKit proof.
- Opus asked whether first-use audio initialization already exists. Both play paths call their initializer, so lazy initialization is fail-soft.
- The final Grok audit required deferred players to inherit the stored volume and muted state. The implementation and tests enforce this.
- The final Grok audit also required the source test to compare the HTML preload href with the URL produced by `index.web.ts`.

## Non-Goals

- Do not mount React before CanvasKit or split the Skia title in this pass.
- Do not split persistence loading or show Story before save state is known.
- Do not change audio assets, cue order, simulation behavior, or `ENGINE_VERSION`.
