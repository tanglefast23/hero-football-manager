---
title: "perf: Smooth 3x live matches on iPhone"
type: perf
date: 2026-08-24
status: proposed
scope: renderer and measurement only
source_specs: ./2026-08-24-iphone-3x-live-match-performance-council-sources.md
---

# Smooth 3x live matches on iPhone

## Decision

Do not lower the display frame rate.

Keep the screen at 60 Hz or better. Reduce the work done for each frame.

At 3x, one 100 ms simulation tick lasts about 33 ms of wall time. A 60 Hz
screen can show about two motion samples per tick. A 30 Hz screen can show only
one. A 30 Hz cap would make movement look more stepped, not less.

The current iOS config does not opt into 120 Hz ProMotion. It is already likely
limited to 60 Hz. Verify this in the Release baseline. Do not add a native
frame-rate module for this work.

The preferred fix order is measured, not fixed:

1. Measure the same match at 1x, 2x, and 3x on the affected iPhone.
2. On a bad 3x window, enter a measured 3x Lite effects mode.
3. Keep UI-runtime interpolation at display rate and simulate every tick.
4. If 3x Lite is still bad, fall back to 2x.
5. Stop after the first mode that passes the device targets.

## Council synthesis

Opus and Grok agreed on these points:

- Physical iPhone Release data must come before product changes.
- A 30 Hz display cap is the wrong concession.
- Every deterministic simulation tick must still run.
- 1x and 2x must keep their current quality.
- Secondary effects are the safest first concession.
- The existing 2x cap remains the final fallback.

They differed on which concession should come first. This spec uses device
evidence. It starts with the existing effects gates because they are small and
already tested.

The current adaptive ladder waits for two 300-frame bad windows before cutting
effects, then two more before the 2x cap. That can leave a player watching a
choppy match for about 20 seconds. This spec shortens the measured 3x path to one
bad window for 3x Lite, then one more bad window for the 2x fallback.

This spec rejects a 15 Hz React or Atlas gate. `MatchScreen` renders from a live
mutable match and many RAF-owned refs. A safe gate would first need a large
frozen presentation snapshot. That is not a small performance fix. If the trace
proves React is the main cost after 3x Lite, write a separate measured spec.

## Current facts

- The match engine uses fixed 100 ms simulation ticks.
- 1x, 2x, and 3x run about 10, 20, and 30 ticks each wall-clock second.
- `MAX_CATCHUP_TICKS` limits one display callback to five simulation ticks.
- A catch-up batch publishes only its final adjacent frame pair.
- `retargetAtlasFrameOnUI` preserves in-flight motion on the UI runtime.
- Skia draws the player and ball slots through one batched Atlas.
- `MatchScreen` calls `publishAtlasFrame`, `setFrame`, and `setHud` after an
  advanced batch.
- `reducedEffects` already cuts several secondary layers.
- Two bad pacing windows enable `reducedEffects`.
- Two more bad windows save a 30-day 2x performance limit.
- Settings already lets the player try 3x again.
- Prior 3x proof was local production web. It did not prove native iPhone
  performance.

## Goals

- Make 3x feel smooth on the affected physical iPhone in a Release build.
- Keep 3x at its real wall-clock speed.
- Keep the result, RNG use, event order, inputs, and replay bytes unchanged.
- Keep the score, ball, carrier, powers, controls, audio, and haptics readable.
- Keep normal 1x and 2x presentation unchanged. A match that falls from 3x to
  2x may keep Lite effects until that match ends.
- Make the smallest measured change.

## Non-goals

- No changes in `src/sim/` or `src/game/`.
- No `ENGINE_VERSION` bump or golden replay update.
- No new speed, quality setting, native frame-rate module, or player-facing copy.
- No second Canvas or component-per-sprite rendering.
- No queued visual-tick player, debt scheduler, buffer pool, or general pacing
  framework.
- No Quick Result changes.
- No global effect cut at 1x or 2x.
- No balance, soak, or large seed-rail tests.

## Invariants

- Same seed and ordered inputs produce the same result and event stream.
- Every earned simulation tick runs in order.
- Audio and haptics run once per event, in event order.
- Atlas receives one coherent publish after each advanced batch.
- Atlas interpolation stays on the UI runtime.
- Kickoffs, restarts, teleports, and newly visible players keep their snap rules.
- Score, phase, banners, controls, and user actions never wait for an ambient
  presentation gate.
- A 3x quality cut never changes the normal 1x or 2x path. An automatic 3x to
  2x fallback may keep Lite effects for the rest of that match.
- Reduce Motion remains the stronger accessibility rule.

## Phase 0: measure first

Phase 0 is blocking. Do not implement a concession before its report exists.

### Build and device

Use the affected physical iPhone with a Release-optimized build.

For a repeatable Release-like QA build, use the existing
`DEVELOPER_MODE_AVAILABLE` switch. Its current release check already prevents
an App Store archive while the switch is true. Do not weaken that check.

Record:

- device model and iOS version;
- peak display refresh rate;
- build SHA and build configuration;
- Expo, React Native, Skia, Reanimated, and engine versions;
- Low Power Mode, Reduce Motion, haptics, cut-in mode, and power policy;
- battery level and thermal state before and after each run;
- the saved career slot, fixture ID, match seed, teams, and formation.

Use a saved pre-match state. Reload that state before every run. Use AUTO powers,
Auto Subs off, and no live coaching input. This keeps all three runs on the same
ordered event stream.

Run at least three full samples at each speed. Alternate the speed order between
sets. Cool the device between sets when thermal state changes.

Measure two fixed tick windows from the same match:

- a quiet midfield window;
- the most power-heavy window in that seed.

Use tick ranges, not only wall-clock ranges. This compares the same match events
at every speed.

### Measurement probe

Reuse `recordFrameGap` thresholds for the shipping comparison. Also record raw
gaps before its 250 ms clamp. Add only a bounded in-memory report if Instruments
cannot export the needed frame table.

The report must not log every frame. It must not write to the network. It must
be reachable only in the Release-like Developer Mode build. The release check
must fail while the QA switch is enabled.

Record:

- raw JavaScript callback gap p50, p95, p99, and true maximum;
- count and percent over the monitor's two-interval threshold;
- count over 50 ms and count over 250 ms;
- count of monitor windows reset by the 250 ms clamp;
- callbacks per second;
- simulation ticks per callback;
- multi-tick batches and five-tick accumulator clamps;
- simulation ticks per wall-clock second;
- time in simulation, snapshot/publish, React commit work, and effects work;
- React commits per second;
- whether long gaps follow a React commit;
- whether a power effect was active;
- time of any adaptive effects or 2x-cap decision;
- full match wall-clock duration.

Do not read Reanimated shared values synchronously from JavaScript. If unfinished
interpolation must be counted, aggregate it on the UI runtime.

Do not treat a large gap as a lifecycle event only because it exceeds 250 ms.
Exclude a gap only when it crosses a recorded pause, non-active AppState,
graphics recovery, resize, or debugger boundary. An active-match gap stays in
the raw report.

Presented-frame evidence is primary. Use Instruments Animation Hitches or Core
Animation, plus the Metal HUD. A measurement-only Reanimated frame callback may
aggregate UI-runtime gaps when the Instruments table cannot export.

The existing JavaScript `requestAnimationFrame` gap is diagnostic only. It can
show JS delay and commit correlation. It cannot prove that Skia and the GPU
presented a smooth frame. Do not declare a pass from JavaScript gaps alone.

The Phase 0 probe must record all three speeds independently of the shipping
`speed >= 2` branch and its warm-up resets. Reuse only the threshold formulas.
For baseline runs, record the actions the ladder would take but do not apply
them. This keeps each full-effects speed sample comparable.

### Baseline decision gates

Use the current monitor's normalized limits.

| Evidence | Action |
|---|---|
| 3x passes in quiet and power-heavy windows | Stop. Ship no performance change. |
| 3x fails only when effects are active | Implement 3x Lite. |
| Long gaps strongly follow React commits | Stop. Write a separate frozen-snapshot spec. |
| Effects and React are both hot | Implement 3x Lite, then re-measure. Do not add a partial React gate. |
| Simulation alone cannot sustain 30 ticks/s | Keep the existing 2x fallback. Visual cuts cannot fix it. |
| Active play has repeated gaps over 250 ms | Fix the monitor so severe active hitches count as bad instead of resetting the window. |
| Smooth frame gaps but visible jumps remain | Fix a continuity defect. Do not cut quality. |
| 1x or 2x also fails | Open a separate base-renderer task. Do not hide it with a 3x cut. |

When more than one row matches, take the smallest effects action first. Use the
React stop row only when React is the dominant measured cost and effects are
measurably cold.

If the trace does not isolate the cause, let the device enter 3x Lite after its
first confirmed bad window. A capable device keeps full effects.

## Concession A: measured 3x Lite effects

3x starts with full effects. One completed bad window enables the existing
in-match `reducedEffects` state. This is 3x Lite. It is not persisted.

After the one-second settling delay, one more completed bad window falls back to
2x and saves the existing performance limit. A good window resets the bad-window
count.

The faster count is 3x-only. Pass the current speed or required-window count
into the decision helper. Keep 2x on its current two-bad-window effects step and
two-more-window cap. Keep 1x unmonitored as today.

The 3x decision must use a signal proven against presented-frame evidence on the
affected phone. The current JavaScript RAF gap is not enough by itself. If it
does not correlate, add a fixed-size UI-runtime frame monitor using the existing
Reanimated frame callback. Bridge only a completed window summary to JavaScript.
Validate that signal against Instruments and the Metal HUD before it can trigger
Lite or the cap. Severe active-play gaps must count as bad; recorded lifecycle
boundaries reset the window.

Keep the draw-time name `reducedEffects`. Use it for every named reduction. This
includes component props, procedural VFX, ticker art, slide debris, and the
scorching-shot ref.

Remove the existing `suppressCosmeticEffects` entry from the RAF effect
dependency list. Convert its in-loop reads in substitution walks, power juice,
trails, ordinary shot puffs, and goal confetti to a render-time ref. Changing
quality or speed must not tear down the RAF loop, discard the sub-tick
accumulator, or reset active power juice.

Reuse the existing gates. At 3x they may cut:

- pass-combo and Super Speed ghost trails;
- substitution walk decoration, while keeping the substitution itself;
- activation camera punch, speed lines, and the four-step body flash;
- ordinary shot puffs;
- goal confetti and goal shake;
- the ball-behind-player x-ray decoration;
- extra slide-tackle dust, grass, and trail samples;
- secondary procedural VFX marks;
- ticker extrusion and held motion;
- the continuous tier-two scorching flame.

Keep:

- player and ball Atlas motion;
- carrier ring and carrier card;
- score, clock, banners, and coaching confirmations;
- primary shot, save, tackle, interruption, goal, and power marks;
- authored power art and power title treatment;
- shot power numbers;
- Heat, Zone, `ARMED`, `FIRE!`, save-window drain, and `WASTED POWER`;
- all audio and haptics.

Switching from 3x to 2x keeps the current match's reduced state. The next match
starts with full effects unless Reduce Motion is on.

Re-measure the same fixture. Stop if it passes.

## Deferred: React presentation cadence

Do not add a 15 Hz `setFrame`/`setHud` gate in this task. It would leave live
match refs, Atlas sprite inputs, power art, and timer-driven renders on different
ticks.

If 3x Lite still fails and Instruments proves React is the main cost, stop and
write a separate spec. That spec must inventory every render-time read from the
mutable match and RAF refs. It must define one frozen presentation snapshot
before any cadence gate is implemented.

## Concession B: 2x fallback

Keep the current persisted result, with a faster measured trigger at 3x:

- one bad 3x window enables reduced effects;
- one more bad 3x window saves the 30-day 2x cap;
- 2x keeps its current two-plus-two adaptive count;
- a live 3x match drops to 2x;
- the current notice appears;
- Settings can clear the cap and try 3x again.

Do not change the TTL or persisted data shape. Keep the current one-second
settling delay after a quality change.

## Edge cases

- A speed change resets the pacing monitor and preserves unfinished Atlas interpolation.
- Pause and resume preserve the sub-tick clock and Atlas interpolation.
- Background and foreground reset pacing samples.
- A two-to-five-tick catch-up batch processes all events in order.
- A five-tick batch still publishes one coherent final frame pair.
- Restart and teleport frames still snap and clear trails.
- Substitution hide and unhide state stays on the current immediate publish path.
- A newly visible decoy or substitute appears at its authoritative position.
- Full time forces the final frame before handoff.
- Banner expiry without a new simulation tick keeps its current wall-clock path.
- A MANUAL `FIRE!` state stays on the current immediate publish path.
- A goalkeeper save window remains simulation-timed and visually current.
- Reduce Motion stays stronger than the 3x effects budget.
- A persisted 2x cap makes the 3x flags unreachable.
- Graphics recovery forces the first restored frame.
- No new timer or microtask may survive `MatchScreen` unmount.

## Focused tests

Do not run balance or soak suites.

Keep these green:

- `src/render/__tests__/match-performance.test.ts`;
- `src/render/__tests__/match-speed.test.ts`;
- `src/render/__tests__/worklet-atlas-retarget.test.ts`;
- renderer tests for power juice, slide effects, VFX, substitution walks, and
  hot-path source contracts;
- replay parity and golden replay without a snapshot update;
- `npx tsc --noEmit`.

For Concession A, test:

- one bad 3x window enables Lite;
- a smooth 3x window keeps full effects;
- 1x remains unmonitored as today;
- 2x still enables its existing reduced effects only after two bad windows;
- an automatic 3x to 2x fallback may keep Lite until full time;
- Reduce Motion and adaptive reduction remain active;
- one bad 3x window enables Lite and one more triggers the cap;
- a good window resets the sequence;
- primary power, shot, save, score, and control information remains;
- draw-time `reducedEffects` reaches every named effect path;
- the RAF loop reads quality gates through refs;
- the existing `suppressCosmeticEffects` RAF dependency is removed;
- changing quality or speed does not restart the loop or reset active juice;
- the protected `reducedEffects={reducedEffects}` wiring remains valid.

If active-match gaps over 250 ms open the monitor-hardening gate, test that they
count as bad while recorded pause, background, resize, debugger, and graphics
recovery boundaries reset the monitor.

Update exact-string source tests only when their protected behavior remains.

## Physical iPhone acceptance

Use the same device, Release build type, saved fixture, settings, and tick
windows as the baseline.

3x passes when both quiet and power-heavy windows meet all of these:

- presented-frame p95 is at most
  `max(1.25 x display interval, 24 ms)`;
- fewer than 1% of presented frames exceed
  `max(2 x display interval, 34 ms)`;
- gaps over 50 ms are reported as diagnostics;
- no repeated gap over 250 ms occurs during active play;
- full-effects 3x does not enter Lite, or steady-state 3x Lite does not advance
  to the 2x cap during its measured window;
- simulation rate is 30.0 ticks/s within 1%;
- the five-tick clamp affects fewer than 0.5% of callbacks;
- full match wall-clock time is within 2% of
  `(simulated ticks x 100 ms) / 3` and is not longer than the baseline 3x run.

Measure active play from the first simulated tick to the tick that enters
`fulltime`. Exclude the title card, recorded automatic pauses, half-time speech,
`FULLTIME_HOLD_MS`, and full-time ticker drain. Use a fixture with no banked
motivational speech.

1x and 2x must meet the same normalized p95 and two-interval limits. Their
presentation must remain visually unchanged.

Before the faster 3x trigger ships, repeat the same fixture on a second
known-good iPhone. It must record zero Lite or cap decisions. If no second device
is available, keep the current two-plus-two trigger and ship only the measured
effect-path and monitor fixes.

The 3x screen recording must show:

- trackable ball and carrier;
- continuous ordinary movement;
- correct restart snaps;
- readable tackle, shot, save, and goal order;
- no substitute flicker or duplicate player;
- readable hero charge and power fire;
- score and banner aligned with event audio;
- current `FIRE!` and goalkeeper save-window state;
- correct pause, background return, and full-time handoff.

Commit counts are diagnostic. They are not acceptance by themselves. Web,
Simulator, and Debug FPS are not native Release acceptance.

There are two valid final statuses:

- **3x smooth:** full effects or 3x Lite meets the 3x targets.
- **Smooth fallback:** the device reaches the measured 2x cap within the
  validated window count and 2x meets the targets. Report plainly that 3x is
  unsupported on that device.

## Expected code areas

| File | Expected change |
|---|---|
| `src/render/match-performance.ts` | 3x one-window Lite and next-window cap only after the reference-device gate. Otherwise keep two-plus-two. Count severe active gaps only if Phase 0 opens that gate. |
| `src/render/match-ui-frame-monitor.ts` | Only if the JavaScript signal does not correlate: fixed-size UI-runtime gap aggregation and one completed-window bridge. |
| `src/render/MatchScreen.tsx` | Keep the RAF loop alive across quality changes. Route in-loop cosmetic checks through refs. Apply Lite to existing effect paths. |
| `src/render/__tests__/match-performance.test.ts` | New one-window/next-window ladder and good-window reset. |
| Existing renderer source-contract tests | Preserve their protected behavior while updating only required wiring assertions. |

No files under `src/sim/`, `src/game/`, `src/persistence/`, or `content/` change.

## Rollout

1. Land or record the Phase 0 measurement separately from product changes.
2. Name the decision gate that opened.
3. Implement one concession only.
4. Run focused tests and TypeScript.
5. Re-run the same device samples.
6. Stop when the targets pass.
7. Keep `DEVELOPER_MODE_AVAILABLE` false for the App Store build.
8. Run `npm run release:check` before any archive.

No server flag, new setting, or migration is needed.

## Rollback

- 3x Lite is live state only. Reverting restores the old effects.
- Restore the old 3x two-plus-two adaptive count to remove the faster trigger.
- Keep each concession in a separate commit.
- The performance limit has no new data shape.
- Saves and replays need no migration.

## Implementation stop rule

The correct final result is the first measured rung that works:

`no change -> measured 3x Lite -> 2x fallback`

Do not build the next rung after the device passes.
