---
title: "fix: Smooth high-speed match playback"
type: fix
date: 2026-07-28
status: revised-after-review
---

# Smooth high-speed match playback

## Decision

Treat the visible jump and the amount of React work as two related but unproven
problems:

1. **Motion continuity:** each Atlas publish resets interpolation to zero. At 3×,
   a new target may arrive before the prior animation finishes; a delayed RAF may
   also advance several simulation ticks but publish only the final pair.
2. **Main-thread cost:** the large `MatchScreen` function is still committed up
   to once per advanced batch and recomputes scene and HUD data.

Measure both. Fix motion continuity first because it is smaller and directly
targets the reported jump. Split and throttle React presentation only if the
profile shows React commits materially causing long frames.

This replaces the earlier broad seven-lane refactor with staged work and explicit
stop conditions.

## Why Vercel and a native iPhone app can differ

Vercel only serves the web build; it does not render match frames. On an iPhone,
that build runs through Safari's JavaScript, layout, canvas, and browser scheduling
path. A native app runs React Native, Skia, and Reanimated more directly, so it
may perform better. That difference is plausible, not guaranteed.

The web build remains the motivating target. A physical iPhone **Release** build
is the shipping gate and must be measured separately; Safari evidence cannot
stand in for it.

## Confirmed current behavior

- The deterministic engine advances at a fixed 10 Hz, producing 10/20/30
  simulation ticks per wall-clock second at 1×/2×/3×.
- The RAF loop may process several overdue ticks, capped at five, but publishes
  only the last adjacent frame pair.
- Every advanced batch calls `publishAtlasFrame`, `setFrame`, and `setHud`.
  Automatic React batching will normally make the two state updates one commit,
  not two; measure commits rather than counting setters.
- Atlas player and ball transforms already run on the UI runtime at display
  cadence.
- `publishAtlasFrame` replaces the endpoints, sets interpolation progress to
  zero, and starts a new timing animation.
- The render path still derives sprite cells, action poses, keeper animation,
  status tint, trails, and HUD data from React state and the mutable `match`.
- Several discrete visuals are tick-sensitive: keeper frames, slide poses,
  wind-up tint, web/trap state, and persistent power-effect membership.
- `heroTint` changes four times during a power flash and currently causes extra
  parent renders.

What is **not** yet proven is whether the reported jump is dominated by:

- unfinished interpolation being reset;
- multi-tick catch-up collapsing intermediate motion;
- long React/main-thread frames;
- or a combination.

## Invariants and non-goals

- Do not change simulation behavior, RNG consumption, event order, recorded
  inputs, match results, or replay bytes.
- Do not change selectable match speeds or intentionally slow 3× playback.
- Do not change `src/sim/`, and do not bump `ENGINE_VERSION` for a
  renderer-only fix. Stop for an explicit version/golden decision if this
  boundary is crossed.
- Preserve Atlas batching and one Canvas; never create one component per sprite.
- Preserve intentional restart/teleport snaps.
- Keep event audio and haptics ordered and exactly once, independent of React
  throttling.
- Do not globally reduce or remove power effects to hide the issue.
- Do not add a queued visual-tick player, a new debt scheduler, a second Canvas,
  or typed-array pooling without profile evidence.

## Success criteria

### Player-visible correctness

- Ordinary player and ball motion has no positional discontinuity when a new
  simulation frame is published.
- Kickoffs, restarts, and authored teleports still snap.
- Newly visible or substituted entities appear at their authoritative position
  rather than flying in from stale coordinates.
- Player positions, ball ground position, ball height, visibility, carrier
  identity, sprite/action state, and event presentation remain coherent.
- Score, goals, powers, substitutions, pause, halftime, fulltime, and coaching
  confirmations are visibly synchronized.
- The same seed and input recording produces the identical result and ordered
  event sequence.
- 3× match wall-clock duration does not materially drift from baseline.

### Frame pacing

Record the display refresh interval and normalize results to it.

- On a physical iPhone Release build: target p95 RAF/display-frame gap no worse
  than 1.25 display intervals and fewer than 1% of gaps over two intervals in
  both quiet and power-heavy 30-second samples.
- On the affected mobile Safari device: remove repeated visible jumps and reduce
  gaps over two display intervals by at least 40% from baseline, unless it
  already meets the native target.
- Do not regress 1× playback, Reduce Motion, pause/resume, or power-heavy play.

React commits per second and HUD commits per second are diagnostics, not success
by themselves. Smooth motion and frame-time evidence are the outcome.

## Phase 0 — Diagnose and establish the baseline

Add low-cost, development-only instrumentation. Do not log every frame to the
console.

Capture quiet-play and power-heavy 30-second samples at 3×, plus a shorter 1×
control sample, on:

1. the affected Vercel production build in mobile Safari;
2. a locally built Release app on a physical iPhone.

Record:

- RAF/display-frame gaps: p50, p95, maximum, and counts above two intervals;
- number of simulation ticks processed per callback and multi-tick batch count;
- interpolation state immediately before each publish;
- publishes that arrive before progress is effectively complete;
- React render/commit p50 and p95, plus whether long frames overlap commits;
- whole-screen, scene, and HUD commit counts where those boundaries exist;
- match wall-clock duration at 3×;
- whether a power effect was active;
- a screen recording suitable for frame-by-frame continuity review.

Measure unfinished interpolation on the UI runtime and aggregate counters there.
Do not synchronously read Reanimated shared values from the JavaScript thread;
that can itself block and contaminate the result.

### Phase 0 decision gates

- If jumps correlate with incomplete interpolation or multi-tick publishes,
  implement Phase 1.
- If long frames materially correlate with expensive React commits, plan to
  implement Phase 2 after Phase 1.
- If React commit p95 is below roughly 2 ms and commits do not correlate with
  long frames, do **not** build the snapshot/subtree refactor; investigate the
  measured Skia/effect/browser cost instead.
- If Phase 1 removes the jumps and frame pacing meets the targets, stop. Do not
  continue merely to lower a counter.

Likely files: `src/render/MatchScreen.tsx`,
`src/render/worklet-atlas-frame.ts`, and a focused renderer performance harness
or development-only instrumentation module.

## Phase 1 — Preserve motion continuity

Change only the renderer publish path.

### Preferred design: UI-runtime retargeting

When a non-snap frame arrives:

1. Atomically calculate the currently displayed **raw base** positions and ball
   height from the previous target, next target, and current progress on the UI
   runtime.
2. Use those displayed values as the new interpolation start.
3. Use the latest authoritative simulation frame as the target.
4. Animate linearly for the existing `TICK_MS / playbackRate` duration.
5. Update player positions, ball position/height, visibility, carrier, actions,
   statuses, zones, and tick as one coherent publish.

The retarget operation must be a UI-runtime worklet. Do not use
`visualPositions` as the new base: that derived buffer already includes
slide/stagger/fall pose offsets, which would be applied a second time. Do not
read shared values synchronously on the JS thread and copy them back.

For an explicit restart/teleport snap:

- hard-set start and target to the authoritative destination;
- clear trails as today;
- do not sample the old displayed position.

For a newly visible entity:

- start it at its authoritative new position;
- do not interpolate from its hidden/stale slot.

Keep the existing interpolation duration initially. Do **not** add the proposed
1.15× timing window: it intentionally adds lag and can create repeated velocity
changes. Reconsider only with measurements proving a remaining gap.

### Why the other continuity proposals are deferred

- **First previous frame to final next frame:** helps multi-tick batches only.
  It does not fix an ordinary one-tick publish that interrupts unfinished
  interpolation, and it can draw a shortcut across intermediate movement.
- **At most one sim tick per RAF with visual debt:** risks making 3× run slower
  whenever the browser cannot sustain 30 RAF callbacks per second. The existing
  five-tick accumulator cap already bounds pathological debt.
- **Queued tick playback:** adds clock, status, carrier, event, effect, audio,
  and pause synchronization complexity before evidence requires it.

### Focused Phase 1 verification

Add deterministic renderer/worklet tests or focused harness cases for:

- a normal publish after completed interpolation;
- a one-tick publish while interpolation is incomplete;
- two-tick and five-tick catch-up batches;
- restart/teleport snap;
- player substitution and decoy visibility changes;
- ball position and height continuity;
- speed changes, power dilation, pause/resume, and background/foreground;
- Reduce Motion;
- teardown with no late update after unmount.

Re-run both device samples. Stop if the visible and frame-pacing criteria pass.

Likely files: `src/render/worklet-atlas-frame.ts` and its focused test/harness
coverage. `MatchScreen.tsx` should only pass the coherent target, playback rate,
and explicit snap/visibility intent.

## Phase 2 — Reduce React work only when profiling justifies it

The goal is not to stop the simulation from advancing 30 times per second. It is
to prevent unchanged UI and unrelated subtrees from recomputing for every tick.

### 2A. Inventory before extracting

List every render-time read from the mutable `match`, `frame`, `hud`, refs, and
power-effect state. Classify each value:

- **motion:** UI-runtime position/height transform;
- **tick-sensitive scene:** sprite cell, action pose, tint, visibility,
  persistent effect membership;
- **important visible state:** score, phase, banner identity, substitution,
  carrier, pause, or user-control confirmation;
- **ordinary HUD:** displayed minute, rounded energy, and ordinary card values;
- **static:** field, layout, labels, and controls whose props did not change.

This inventory is the contract for the narrow snapshots below. A memoized child
must not read the live mutable `match` behind its props.

### 2B. Create only two useful boundaries

Extract or isolate:

- `MatchPitchScene`: Atlas, sprite keys/cells, status colors, action state,
  trails, and active pitch effects;
- `MatchHud`: score/clock, carrier card, hero tiles, banners, and related
  non-pitch display.

Keep static field/layout/controls outside their hot inputs or behind existing
memo boundaries. Localize `heroTint` to the scene/effect owner so its four flash
steps do not rerender the full match shell.

Use small immutable presentation snapshots with value-based equality. Do not
create a general pacing framework or broad hierarchy of view models.

The hot snapshots must be owned below `MatchScreen` or delivered through a
renderer-local subscription boundary. Merely wrapping a child in `memo` while
the parent still owns and updates its tick state will not prevent the large
parent function from running.

### 2C. Initial cadence policy

- Motion remains display-rate on the UI runtime.
- Tick-sensitive scene metadata publishes for every advanced simulation batch
  initially. Do not throttle it to 10–15 Hz while keeper, slide, wind-up, trap,
  and effect timing still depend on simulation ticks.
- Important visible state publishes on the next RAF when its displayed value
  changes.
- Ordinary HUD publishes only when a displayed value changes, with a 10 Hz
  maximum backstop for ambient values.
- Static UI publishes only when its own props change.
- Event audio/haptics continue directly from the ordered event stream.

Do not use “any event occurred” as an unconditional urgent flush. Passes and
tackles are frequent. Instead, build the candidate display snapshot after a
batch and commit only when a player-visible value changed.

Important immediate values include:

- score and match phase;
- banner identity;
- substitution/player identity;
- carrier identity;
- pause state;
- formation, playstyle, energy-use, and other user-control confirmations.

### 2D. Prevent stale mixed-time renders

- Snapshot consumers receive every value they display.
- They do not read the mutable live match as a fallback.
- Scene and HUD snapshots include the authoritative tick for diagnostics.
- When one event changes both scene and HUD, both candidates are derived from
  the same completed simulation batch.
- Event-driven visuals carry the identity, origin/target, and frame context they
  need; they do not look those details up later from a newer mutable match.
- Add a focused source-pattern or architecture test that prevents the extracted
  children from accepting/reading the mutable match object.

Re-profile after extraction. Keep it only if React commit cost or long-frame
correlation materially improves.

Likely files, only if the Phase 0 gate opens: `src/render/MatchScreen.tsx`, one
scene component/subscriber, one HUD component/subscriber, and focused snapshot
equality/architecture tests. Names should follow the renderer's existing style;
do not add a general pacing service.

## Phase 3 — Evidence-driven follow-ups only

Enter this phase only if Phase 1 and the justified parts of Phase 2 still miss
the acceptance criteria.

- If tick-sensitive scene work is hot, first move keeper/action/tint/effect
  phase calculation to a continuous presentation clock or UI worklet. Only then
  test a lower React scene cadence.
- If allocation profiles identify packed arrays or effect geometry, reuse those
  buffers without changing Atlas batching.
- If rare long stalls still create objectionable dashes, test bounded visual
  bridging with explicit event/identity synchronization.
- If power-heavy samples alone fail, profile individual effect families and
  optimize only the measured offender.

Each follow-up needs its own before/after sample and stop condition.

## Verification matrix

### Determinism and functional checks

- Existing sim, replay, renderer, and golden tests pass without snapshot changes.
- Same seed and inputs produce byte-identical result and ordered events.
- Watched and Quick Result parity remains unchanged.
- Audio/haptics remain ordered and exactly once through catch-up batches.
- Score, carrier, powers, substitutions, pause, halftime, and fulltime align
  with the displayed scene.
- The renderer change does not lose the final committed frame or regress the
  existing fulltime/background lifecycle.

If baseline testing exposes an already-existing lifecycle defect unrelated to
the renderer change (for example, power-flash elapsed time including background
time), record it separately rather than silently expanding this performance
change. Any lifecycle regression introduced by this work remains blocking.

### Visual scenarios

Test at 1×, 2×, and 3×:

- steady midfield play;
- repeated passes/tackles;
- shot, save, rebound, and goal/restart;
- substitution and visibility change;
- keeper-ready and slide animations;
- overlapping powers and a power-heavy showcase;
- speed change during motion;
- pause/resume and app background/foreground;
- Reduce Motion on and off.

### Build and device checks

- Typecheck and focused unit tests.
- Full relevant test suite and static web export.
- Vercel production mobile Safari measurement on the same device/browser used
  for baseline.
- Physical iPhone Release measurement on the same hardware used for baseline.

Record device model, OS/browser version, refresh rate, build SHA, build mode,
scenario seed, and sample duration. A dev build, simulator, or Safari preview is
not native Release evidence.

## Audit synthesis and ruling

| Advice | Ruling | Reason |
|---|---|---|
| Measure before refactoring | Accept from all three | Neither React cost nor interpolation reset is yet proven dominant. |
| Separate motion, scene, HUD, and static work | Accept conditionally | Useful only if React is measured hot; implement as two child boundaries, not seven infrastructure lanes. |
| Immutable snapshots and complete read inventory | Accept from audits 1 and 2 | Required once children update at different cadences; prevents stale mutable-match reads. |
| Throttle the whole scene to 10–15 Hz | Reject initially | Keeper, slide, wind-up, trap, tint, and FX presentation are tick-sensitive today. |
| HUD up to 10 Hz | Accept with equality first | Commit when displayed values change; 10 Hz is a ceiling/backstop, not the reason to show stale important state. |
| Flush React for every event | Reject | Passes and tackles are chatty and would often defeat throttling; visible-value changes are the contract. |
| Retarget from current displayed position | Accept audit 3's direction | It handles incomplete ordinary publishes and multi-tick batches while preserving wall-clock speed. Must be atomic on the UI runtime. |
| Use a 1.15× interpolation window | Reject initially | Adds intentional lag without evidence. Keep the exact tick window first. |
| First-old to final-new glide | Defer audit 2's proposal | Helps only multi-tick catch-up and may shortcut the real path. |
| One tick per RAF plus bounded debt | Defer audit 1's proposal | Can silently slow 3×; existing catch-up is already capped. |
| Queued visual tick playback | Reject initially | Highest synchronization and maintenance cost. |
| Allocation/buffer work | Defer | Profile first. |
| Commit-count targets as success | Reject | Frame pacing and visible continuity are the outcome; commit counts are diagnostics. |

## Implementation order and stopping rule

### Task checklist

- [x] Verify the current checkout, renderer architecture, relevant tests, and
  baseline typecheck.
- [x] Add focused continuity instrumentation/tests without JS-thread shared
  value reads.
- [x] Implement atomic UI-runtime retargeting from raw interpolated positions.
- [x] Preserve restart snaps, newly-visible entities, ball height, pause/resume,
  speed changes, and Reduce Motion behavior.
- [x] Re-run focused renderer tests and typecheck.
- [x] Measure the web result and decide whether React isolation is justified.
- [x] Implement only the measured React hot-path reduction, if required. (The
  gate did not open: 60.0 FPS, 16.8 ms p95, and no frames over 33.4 ms in the
  local production-web 3× sample.)
- [x] Run the broader relevant suite and export/browser smoke test.
- [x] Record what remains unverified on physical iPhone Release/mobile Safari.

1. Instrument and capture both baselines.
2. Implement UI-runtime motion retargeting if the continuity measurements
   support it.
3. Re-measure. **Stop here** if the player-visible and frame-pacing targets pass.
4. If React is demonstrably hot, extract the pitch scene and HUD with narrow,
   immutable snapshots; keep scene metadata per tick and cap ordinary HUD work.
5. Re-measure. **Stop here** if targets pass.
6. Perform only the specific Phase 3 optimization named by the remaining
   profile.

The preferred final result is the smallest stage that makes 3× visibly smooth
without changing deterministic match behavior.
