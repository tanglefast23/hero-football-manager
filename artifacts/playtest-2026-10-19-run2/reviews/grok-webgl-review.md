# Grok web graphics hypothesis review

Reviewer 8a7119e9-aa5a-4098-be71-e3809ad0e329. Source-only, read-only. No browser, save, process, match, or source mutation.

Chrome's repeated warning says it evicts an older active WebGL context. It is not a normal disposal message. The live context count and identities were not captured.

Visible game paths should remain below the browser limit. Web portraits, player running sprites, and event scenes avoid one Canvas per item. A drill has one RecoverableSkiaCanvas, unmounted after the scene. A match has one and recovers once on context loss before offering a failure card. The temporary match-day banner has five canvases. The normal screen fade is about 150 ms, with a 100 ms backstop.

The strongest source suspect is buildSpriteAtlas -> Skia.Surface.MakeOffscreen. In the installed Skia 2.6.2 web implementation, each cache miss creates an OffscreenCanvas/WebGL context. The surface is disposed in a finally block, but the application never calls deleteContext or loseContext on that offscreen context. Cache misses can occur for new looks, eviction from the 12-image CPU cache, match visual keys, and graphics recovery. Whether deleting the CanvasKit surface releases the context was not proved from the wasm. Therefore a context leak remains a hypothesis.

The initial blank pitch and clock at zero are partly consistent with graphics pause, but the observed delay does not match the source's next-frame recovery. A 2 ms requestAnimationFrame probe showed the frame queue was alive. The match later progressed and completed without reload. No one-minute application timer was found. Do not attribute the delay to context eviction based on timing alone.

Suggested later check: use a fresh isolated page, train many distinct players, and record offscreen context allocation/disposal plus warnings before a second visible canvas exists. DOM canvas counts alone miss OffscreenCanvas. Do not instrument the current career.

Lead decision: unconfirmed web graphics concern in the final report. No renderer changes or strategy changes from this review.
