---
date: 2026-08-09
topic: first-landing-startup
---

# First Landing Startup

## What We Are Building

Make the first launch feel immediate on web and reduce the real wait in Debug builds without changing save recovery, first-frame language, the approved title-player scene, or release gameplay.

The first pass has four bounded changes:

1. Put a branded, non-interactive loading card in `public/index.html`. It is visible from the first HTML paint and React replaces it when the app mounts.
2. Preload `/canvaskit.wasm` from HTML so its 7.7 MB decoded payload starts in parallel with the entry JavaScript instead of after it.
3. Cache the immutable English string merge and one `CopyFn` per locale instead of rebuilding the same 3,663-entry fallback object and closure throughout the first render.
4. Make volume setters store/apply volume without creating audio players. Keep web audio fully on-demand; prewarm the existing ordered management-player catalog on native only, after the real title has painted. Rival laughs remain on-demand on every platform.

## Evidence

- `index.web.ts` waits for `LoadSkiaWeb`, then imports and mounts `App`. `public/index.html` currently gives it an empty `#root`.
- The current export contains 6.4 MB decoded shared JavaScript, 0.77 MB decoded entry JavaScript, 7.7 MB CanvasKit, and a 0.43 MB decoded App chunk on the critical path.
- A cold local headless Chromium run reached first contentful paint at 364 ms and the real title at 560 ms.
- The same run started 38 audio resource requests totaling 1,319,250 encoded bytes before the title was ready.
- `setManagementSfxMasterVolume` creates the full management player set. `setRivalHeroVoiceMasterVolume` creates five laugh players. Both setters run on the first `GameApp` effect.
- The 38 early audio requests are fully attributed: 27 management catalog players, six extra rapid-tap voices, and five rival laughs.
- `copyFor()` rebuilds the same merged English fallback object and returns a new closure on each call. The first landing subtree has several `useCopy()` consumers.
- The earlier full audit left web CanvasKit-gated startup open as FP-013.

## Why This Approach

This pass attacks three measured causes with small changes and keeps the title contract intact. It improves immediate feedback on web, reduces real Debug boot work, and stops non-title sound assets from competing with persistence startup.

The alternative is to mount a separate non-Skia title app, lazy-load `MatchScreen`, and split the 1.98 MB sprite catalog so the title carries only its 13 sprite keys. That can reduce the actual web bundle and CanvasKit dependency further, but the current title power effects use Skia and the approved player scene has stacking, visible-feet, and animation regression guards. That larger split should follow only if the measured first pass misses the target.

## Key Decisions

- The HTML card is wordless, language-neutral progress feedback inside `#root`, not a second interactive title. It must not show fake Story or Settings buttons. The existing CanvasKit failure handler replaces it because it already writes `root.textContent`.
- The real title still waits for fonts, preferences, and career persistence. This preserves the correct first-frame language, accurate Continue/New state, and save-recovery UI.
- CanvasKit still loads before the React app. The preload uses the exact `LoadSkiaWeb` URL and matching `as="fetch" type="application/wasm" crossorigin` attributes. This pass starts it earlier and removes the blank page; it does not bypass the supported Skia initialization contract.
- Audio remains fail-soft. The existing management and rival play paths initialize players on demand if needed. Native management warming happens only after the real title is ready; web waits for the first user gesture.
- The development golden-replay assertion stays on its current fail-closed path. Both Grok and Opus correctly rejected an actionable title appearing before this check completed.
- Production replay behavior and `ENGINE_VERSION` do not change.

## Acceptance Criteria

- A cold web load shows the wordless branded loading card before application JavaScript and CanvasKit finish.
- The loading card is inside `#root`, and a forced CanvasKit failure replaces it with the existing error text.
- The exported page has exactly one `canvaskit.wasm` resource entry, and it begins from the HTML preload.
- The real title remains interactive and visually unchanged after React replaces the loading card.
- Repeated `copyFor(locale)` calls return the same pure function for that locale and preserve all fallback/interpolation behavior.
- Setting the initial volume does not create management SFX or rival-laugh players.
- Management button sound and each rival laugh initialize and play on demand without a prior setter-side initialization.
- The web title becomes ready before management or rival audio asset requests begin.
- The development golden replay and its failure handling remain unchanged.
- TypeScript, focused startup/audio/title tests, web export, and a cold browser load pass.

## Open Questions

- None for this first pass. If cold-device evidence remains above the under-two-second target, plan the larger persistence split and Skia/title sprite-catalog split separately.

## Review Synthesis

- Grok 4.5 and Claude Opus 5 both rejected moving the golden replay behind an interactive title. That change is removed.
- Both reviewers required the HTML card to be language-neutral and live inside `#root`. Both requirements are now explicit.
- Both reviewers required an exact, single-request CanvasKit preload proof. The current loader URL is `/canvaskit.wasm`, the local server returns `application/wasm`, and browser verification will reject a double fetch.
- Grok asked for attribution of the 38 requests. Local tracing and player counts attribute all 38 to management SFX and rival voices.
- Opus questioned whether on-demand play initialization exists. Local verification confirmed `playManagementSfx()` and `playRivalHeroLaugh()` both call their initializer. Regression tests will exercise play without prior volume-side initialization.
- The orchestrated repository reviews identified repeated copy construction as a smaller, low-risk synchronous-render win. It replaces the rejected golden-replay move in this pass.
- The final Grok plan audit found that deferred player creation must explicitly inherit the stored volume and muted state. Both initializers and their tests now require that behavior.
- The final Grok plan audit also required the source test to compare the HTML preload href with the URL produced by `index.web.ts`, in addition to the browser single-request check.
