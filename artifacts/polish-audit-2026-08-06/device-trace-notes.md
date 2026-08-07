# Device tier — first Instruments capture (2026-08-07)

Device: Joe's iPhone 16 Pro Max, iOS 26.5.2, USB-attached.
Build: **Debug over Metro**, main @ d34af335 (the merged audit, passes 1-2).
Template: Animation Hitches. Two captures: 60s idle, 30s with the app foregrounded.

## What was measured

| | |
|---|---|
| Potential hangs (>33ms main-thread block), 60s | **0** |
| Frames sampled, 30s | 652 with durations (898 rows) |
| Mean frame duration | 20.51 ms |
| p50 / p95 / p99 | 17.16 / 25.03 / 25.03 ms |
| Worst frame | 33.34 ms |
| Frames > 33 ms | **1** |

## What these numbers do NOT establish

1. **This is not gameplay.** The app was sitting on a menu screen, not playing a watched
   match. Axis E's real question — frame pacing while the Skia canvas drives 22 sprites — is
   still unmeasured.
2. **ProMotion adaptive refresh confounds frame duration.** On a 16 Pro Max the display drops
   its refresh rate on a near-static screen, so "543 frames over 16.6ms" is expected
   power-saving behaviour here, NOT dropped frames. Frame duration is only a jank signal
   against a workload that is actually asking for every frame.
3. **Debug over Metro is pessimistic.** Unminified JS, dev-mode React, no bundle
   optimisation. A Release build would be faster; these numbers are a floor, not a verdict.

## What it does establish

The measurement rig works end to end (attach by PID, record, export, parse), and the app
holds a menu for 60 seconds without a single main-thread hang. The earlier 1-frame capture
was the app suspended behind a lock screen, not a stall.

## To finish axis E

Play into a watched match on the device and re-record for 60s. Re-parse with the same script.
The bar from docs/09 is 60fps on iPhone 12-class hardware with zero frames over 33ms during
gameplay; a 16 Pro Max is well above min-spec, so a clean result here is necessary, not
sufficient — min-device still needs its own look.

---

## Capture 3 — a live watched match, with a goal (2026-08-07)

Owner played into a watched match at 1x speed and left it running; a goal landed inside the
60-second window, which is the most expensive moment the renderer has — hitstop, shake and
celebration together.

| | |
|---|---|
| Main-thread hangs > 33 ms, 60 s of live match | **0** |
| Frame-lifetime table | **unavailable** — `xctrace export` segfaults (exit 139) on every display table of this trace (`hitches-frame-lifetimes`, `hitches-framewait`, `hitches-gpu`, `display-surface-queue`). The hangs table exported cleanly from the same trace. |

**What this establishes.** Across a full minute of the match actually rendering — 22 sprites on
the Skia canvas, a goal with its full celebration — the main thread never blocked for more than
33 ms. That is the canon bar for gameplay, and on this hardware, in a Debug build over Metro
(the pessimistic case), nothing crossed it. The rival-preload pump did not stall a frame either.

**What it still does not establish.** Hangs measure main-thread blocking, not dropped frames: a
GPU-side stall would not appear here, and the per-frame distribution could not be extracted
because of the exporter crash. And this is an iPhone 16 Pro Max — comfortably above the
iPhone 12-class min-spec the budget is written against, so min-device pacing remains unmeasured.

**If the frame distribution is wanted later:** re-record and export immediately (a fresh trace of
the idle app exported fine at 30 s), or use the Metal HUD via the scheme's
`MTL_HUD_ENABLED = 1` environment variable, which reads frame timing off the device without
going through xctrace's exporter at all.
