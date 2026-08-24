---
title: "iPhone 3x live-match performance council sources"
type: council-source
date: 2026-08-24
authors:
  - Claude Opus 5 (xhigh)
  - Grok 4.6 (high)
---

# Independent Council Spec sources

These are the complete source specs. They are preserved verbatim between the markers.

<!-- BEGIN CLAUDE OPUS 5 SPEC -->

---
title: "perf: Smooth 3× live-match playback on a physical iPhone"
type: perf
status: proposed
scope: renderer only (`src/render/`), no `src/sim/` or `src/game/` changes
---

# 1. Problem and premise

3× watched playback is reported as not smooth on a physical iPhone. It has never been measured there in a Release build. The only prior device evidence in this repository is a **Debug-over-Metro** capture on an iPhone 16 Pro Max, iOS 26.5.2, at **1×**, whose only usable table was "main-thread hangs > 33 ms = 0" — the per-frame distribution could not be exported because `xctrace` segfaults on every display table of that trace (`artifacts/polish-audit-2026-08-06/device-trace-notes.md:54`). The 2026-07-28 renderer plan closed with 3× measured only on **local production web** (60.0 FPS, 16.8 ms p95) and explicitly recorded that physical iPhone Release remained unverified (`docs/plans/2026-07-28-fix-high-speed-match-rendering-plan.md:404-409`).

So the first deliverable is not a fix. It is a number.

## 1.1 Current renderer (verified against source)

| Fact | Evidence |
|---|---|
| Fixed 100 ms deterministic ticks | `TICK_MS = 100`, `HALF_TICKS = 1000` → 2000 ticks = 200 s of sim per match (`src/sim/geometry.ts:6-7`) |
| 10/20/30 sim ticks per wall-clock second at 1×/2×/3× | `matchPlaybackRate(speed) === speed` (`src/render/match-speed.ts:32`); `acc += (now - last) * rate` (`MatchScreen.tsx:1937`) |
| Catch-up capped at 5 ticks per RAF | `MAX_CATCHUP_TICKS = 5` (`MatchScreen.tsx:348`, clamp at `:1937-1940`) |
| One publish per advanced batch, of the **last adjacent pair only** | `prevRef.current = before` per loop iteration (`:1958`), single `publishAtlasFrame` after the loop (`:3120`) |
| Skia **Atlas** batching, one Canvas, 25 slots | `<Atlas … transforms={workletTransforms}>` (`:4602-4609`); `ATLAS_SLOT_COUNT = RENDER_PLAYER_COUNT + 1` (`worklet-atlas-frame.ts:29`) |
| Reanimated UI-runtime interpolation + **atomic retargeting** | `retargetAtlasFrameOnUI` samples the in-flight raw pair and reinstalls endpoints in one worklet (`worklet-atlas-frame.ts:349-423`) |
| Interpolation window is exactly one sim tick of wall clock | `TICK_MS / max(MIN_MATCH_PLAYBACK_RATE, speed)` (`worklet-atlas-frame.ts:744`) |
| React `setFrame` + `setHud` after each advanced batch | `MatchScreen.tsx:3127-3134`; banner-only path at `:3137-3142` |
| Adaptive path: `reducedEffects` first, then a persisted 2× cap | `performanceAdaptationDecision` (`match-performance.ts:34-46`), wired at `MatchScreen.tsx:1902-1929` |
| Bad-window rule | 300 RAF gaps; bad if p95 > `max(interval × 1.25, 24 ms)` or > 1 % of gaps > `max(interval × 2, 34 ms)` (`match-performance.ts:68-103`) |
| The 2× cap persists 30 days and is user-clearable | `PERFORMANCE_LIMIT_TTL_MS` (`match-performance.ts:4`); "TRY 3× AGAIN" (`SettingsOverlay.tsx:445-459`) |
| 3× is selectable from Season 1 — the veteran unlock is gone | `App.tsx` passes no `maximumSpeed`; `maximumSpeed = 3` default asserted by `src/ui/__tests__/player-feedback-contracts.test.ts:215-222`. **The prop doc comment at `MatchScreen.tsx:778` is stale.** |
| The app is capped at 60 Hz on device | `app.json` has **no** `CADisableMinimumFrameDurationOnPhone` in `ios.infoPlist` — ProMotion is not opted into |
| Budget of record | "60fps match on iPhone 12 / mid-range Android" (`docs/09-tech-stack.md:114`); gameplay bar of zero frames over 33 ms (`device-trace-notes.md:38-41`) |

## 1.2 Why 3× is structurally the hardest case

At 3× the renderer does the same per-tick React work **three times as often in wall clock**: 30 `MatchScreen` commits per second instead of 10. Every tick-quantised presentation channel — sprite cell selection, the 25-entry Atlas tint table, power-effect scene sampling, procedural VFX ageing, HUD text — is rebuilt at that rate inside one very large component function (`MatchScreen.tsx` is 5381 lines; the render body from `:3199` onward rebuilds `playerSpriteKeys`, `colors`, `drawablePowerEffects`, `heroPowerRingHeroes`, `activeWebTraps`, `railHeroTiles`, `encoreMarkers`, energy summaries and the pending-input scan on every commit). Motion itself is already off the JS thread and is not the suspect.

---

# 2. Goals

1. 3× watched playback on a **physical iPhone, Release configuration** meets the frame-pacing acceptance in §10, in both quiet and power-heavy play, without the adaptive ladder firing.
2. The **display frame rate** decision is made explicitly and recorded (§4).
3. Every change is chosen from measurement, is the smallest user-visible concession that clears the measured gap, and is individually reversible behind a named constant.
4. 1× and 2× are unchanged in behaviour and identical in presentation cadence.
5. Match readability at 3× is preserved: the ball, who has it, who is charged, what just happened, and the score remain as legible as at 1×.

# 3. Non-goals

- No change to `src/sim/` or `src/game/`, to RNG consumption, event order, recorded inputs, match results, replay bytes, or `ENGINE_VERSION`. The golden-replay snapshot must not change.
- No slowing of 3× wall-clock playback, and no dropping of deterministic ticks. Every tick the accumulator earns is still simulated.
- No new match speeds, and no changes to the speed chips, scorebar cycle, pause, coaching dock, substitution board, or any other control.
- No second Canvas, no per-sprite components, no general pacing framework, no view-model hierarchy, no queued visual-tick player, no new native module (`CLAUDE.md` architecture rules; the 2026-07-28 plan's rejected list).
- No global reduction of power effects at 1×/2× to hide the problem. Suppression is authorised **at 3× only**, and only for the named secondary layers in §7.1.
- No new player-facing copy. New copy would have to ship in all seven languages in the same commit (`CLAUDE.md`); the existing `matchScreen.performance.limited` and `settings.performance.try3x` strings already cover the fallback and stay as they are.
- No changes to the persisted `MatchPerformanceLimit` shape, its 30-day TTL, or the "TRY 3× AGAIN" recovery.

# 4. Explicit decision: display frame rate

**Decision: do not lower the display frame rate. Rejected.**

1. **There is nothing to give back.** `app.json` does not set `CADisableMinimumFrameDurationOnPhone`, so the app is already limited to 60 Hz on every ProMotion iPhone, including the 16 Pro Max used for measurement. The usual "drop 120 → 60" saving does not exist here.
2. **No supported lever below 60 Hz.** Reanimated 4.5.1 / react-native-worklets 0.10.1 / react-native-skia 2.6.2 / RN 0.86.2 expose no JS API to set a `CADisplayLink` `preferredFrameRateRange` for the Skia surface or the RAF driver. Implementing one is a native module — precisely the broad rendering infrastructure this work excludes.
3. **It would damage the speeds that are fine.** A 30 Hz cap halves interpolation sampling at every speed, trading a measured 3× problem for an unmeasured 1×/2× regression, violating goal 4.
4. **A cheap imitation is worse than the disease.** "Skip every second RAF callback" would leave `last`/`acc` bookkeeping, pacing sampling and the fire-loop reconcile on a 30 Hz cadence, and the pacing monitor would then classify a healthy device as bad — `match-performance.test.ts:26-31` pins exactly that (a stable 30 fps result is `bad`, not a 30 Hz panel).

What **is** accepted instead is lowering the **presentation publish cadence** — the rate at which React re-commits derived presentation — while the display keeps running at 60 Hz and Atlas motion keeps being published every tick (§7.2). That is a different thing and must be described as such in the commit message and any report, because conflating the two is how this decision gets silently reversed later.

---

# 5. Invariants (must hold after every phase)

- Same seed + same ordered input log ⇒ byte-identical result and event sequence. Watched and Quick Result parity unchanged.
- `playForEvent` / `playHapticForEvent` continue to run once per event, in `s.events` order, from the post-loop drain (`MatchScreen.tsx:2330-2346`), independent of any presentation gate.
- Immediate critical match state stays immediate: score, half/phase, banner identity, substitution, carrier identity, pause state, and every coaching confirmation (§7.2.2 lists the forced-commit set).
- One Canvas, one Atlas draw call for the 25 match slots, plus the existing conditional power-actor Atlas. No component per sprite.
- Restart/teleport snaps still snap (`SNAP_DIST2`, `MatchScreen.tsx:2068-2079`); newly visible entities still start at their authoritative position (`sampleRawRetargetPositions`, `worklet-atlas-frame.ts:203-212`).
- Reduce Motion behaviour is unchanged and remains a strict superset of any 3× suppression.
- 3× wall-clock match duration does not drift: ≈ 66.7 s per match at 30 ticks/s.

---

# 6. Phase 0 — Measure the same fixed match at 1×, 2×, 3× (blocking)

Nothing in §7 may be implemented before Phase 0 reports.

## 6.1 The build

- **Configuration: Release**, built locally to the plugged-in device (`npx expo run:ios --configuration Release --device`, or the `xcodebuild` recipe in `docs/release/current-release-risks.md:93-104`). Debug-over-Metro is not acceptable evidence for this decision; it is pessimistic and unminified.
- Record build SHA, configuration, expo/RN/Skia/Reanimated versions, device model, iOS version, thermal state at start and end, battery ≥ 50 %, **Low Power Mode off**, Reduce Motion **off**, text scale 1, haptics on, normal volume, no debugger attached.
- QA roots and Developer Mode are unavailable in native Release by design (`src/ui/release-surface.ts:6-8`, `release-readiness.test.ts:14-52`). Do **not** loosen that; use the protocol below instead.

## 6.2 The fixed match

3× is selectable from the first watched match (§1.1), so the protocol needs no harness route:

1. Start a fresh career with a fixed, written-down creation input set (same club, manager name, difficulty, starting choices), so the schedule PRNG produces the same `matchSeed` every time (`src/game/pyramid.ts:1383`, `src/game/schedule.ts:100`).
2. Play fixture 1 as a **watched** match with: powers policy fixed and recorded, Auto Subs **off**, no coaching input, no pause, no substitutions, no Hero Cup title card.
3. Because no input is issued, the same seed yields an identical tick and event stream at all three speeds. Speed changes wall clock only; it does not touch `tick(s)`.
4. Before each run, clear any persisted cap via Settings → "TRY 3× AGAIN", so a stale `performanceLimit` cannot silently force 2×.

**Runs:** three per speed (nine total), plus one repeat of the 3× run after a 10-minute cool-down to expose thermal drift.

**Sample windows are tick ranges, not wall-clock windows**, so the three speeds compare identical simulated content:
- `W-quiet` = ticks 200–800 (settled first-half play).
- `W-power` = the 200-tick window containing the most `POWER_FIRED` events for this seed (identify once from a headless run and fix it for all speeds).
- `W-all` = ticks 0–2000 (whole match).

## 6.3 Instrumentation (measurement build only, never shipped)

A bounded, pure, headless-testable accumulator — not a general telemetry system:

- `src/render/match-frame-report.ts`: a plain object accumulating RAF gaps into a fixed-width histogram plus counters; `summarizeMatchFrameReport()` returns p50/p95/p99/max, counts over 20.8 ms / 33.4 ms / 50 ms, and the counters below. No per-frame console output.
- Availability gated the way Developer Mode is: a typed `export const MATCH_FRAME_REPORT_AVAILABLE: boolean = false;` in `src/ui/release-surface.ts`, read by `scripts/release/check-config.mjs` so `npm run release:check` **fails while it is true**. The measurement build flips it; the shipped archive cannot.
- Surface: one summary block rendered over the full-time hold, plus a single `console.log` of the JSON at full time. No file writes, no network.

Counters per window:

| Metric | Why |
|---|---|
| RAF gap p50 / p95 / p99 / max; counts > 20.8 ms, > 33.4 ms, > 50 ms | The acceptance signal |
| RAF callbacks per second | Confirms the 60 Hz driver is being served |
| Ticks advanced per callback, histogram 0/1/2/3/4/5 | Distinguishes ordinary pacing from catch-up |
| Accumulator clamps at `MAX_CATCHUP_TICKS` | Whether the sim is falling behind wall clock |
| Sim ticks per wall-clock second | Must read 30.0 at 3× or the sim is being starved |
| React commits per second (`setFrame`/`setHud` batches, and other setState calls made from the loop) | Diagnostic only |
| Publishes arriving with `progress < 1`, aggregated **on the UI runtime** | Never read a shared value synchronously from JS — that itself blocks |
| Long-frame correlation: fraction of gaps > 33.4 ms whose preceding callback committed React | The only on-device proxy for "React commits cause long frames" available in Release |
| Adaptation events: wall-clock time of `reduce-effects` and `limit-to-2x`, if any | A run that adapted mid-sample is contaminated and must be reported as such |
| Wall-clock duration of `W-all` | Drift check |

**Corroboration, not substitution:** one Instruments *Animation Hitches* capture on the same 3× run (the hangs table exports cleanly; display tables segfault — `device-trace-notes.md:54`), one run with `MTL_HUD_ENABLED=1` in the scheme for an independent GPU-side read, and a 60 fps screen recording of `W-power` at 3× for frame-by-frame review.

## 6.4 Phase 0 decision gates

Let `I` = 16.67 ms (60 Hz); thresholds are the repo's own.

- **G0 — Is there a problem at all?** If 3× already meets §10 acceptance in all windows, **stop**. Publish the report, correct the stale `maximumSpeed` doc comment at `MatchScreen.tsx:778`, ship nothing else.
- **G1 — Is the sim starved?** If sim ticks/s at 3× < 29.5, or accumulator clamps > 1 % of callbacks, the JS thread cannot keep up at all; Phases 1–2 are mandatory and Phase 3 is likely.
- **G2 — Is React the hot path?** If p95 at 3× exceeds `1.25 × I` **and** > 60 % of gaps over `2 × I` follow a committing callback, open Phase 2 (cadence coalescing).
- **G3 — Is it power/effect cost?** If `W-power` fails while `W-quiet` passes, open Phase 1 (3× effects profile) first and re-measure before opening Phase 2.
- **G4 — Is it neither?** If p95 fails with commits uncorrelated (< 30 %) and `W-quiet` ≈ `W-power`, the cost is in the Atlas publish path or Skia itself. Do **not** build Phases 1–3; go to §7.4 option C with its own before/after, and report honestly that the concessions were not the fix.
- **G5 — Stop rule.** Re-measure after every phase. The first phase that clears §10 ends the work. Do not continue to lower a counter.

---

# 7. Phases and exact concessions

Ordered by ascending user-visible cost. Each phase sits behind a named constant and can be disabled independently.

## 7.1 Phase 1 — A 3×-only secondary-effects profile

**Concession:** at 3× only, the renderer draws the same *reduced* secondary-effect set the adaptive path already uses. Nothing that carries match information is touched.

| Layer | Effect at 3× | Site |
|---|---|---|
| Slide-tackle dust + grass | 4 trail samples instead of the full set; two secondary layers skipped | `WorkletMatchOverlays.tsx:224,250,296` |
| Procedural match VFX | `secondary` marks dropped from contact / standing / dangerous-shot / save / interruption bursts; primary marks stay | `match-vfx.ts:270-296` |
| Ticker line | cheap outline ring, one decorative layer dropped | `MatchTickerLine.tsx:110,127,137` |
| Tier-2 scorching-ball flame | tier-2 shot renders the tier-1 burst; both audio cues and the shot-power number are unchanged | `MatchScreen.tsx:2130-2131` |

All four sites already accept the existing `reducedEffects` boolean, so this is a wiring change, not new art.

**Optional Tier-1b, only if G3 still fails after the above** — additionally at 3×:
- Ball-flight trail circles capped at the tier-0 length (8 instead of 10/12): `BALL_TRAIL_LEN_BY_TIER`, drawn at `MatchScreen.tsx:4484-4501`.
- Kick dust puff rings 3 → 1 (`PUFF_RINGS`, `:4504-4533`); Super Strength impact keeps its ring, drops its core circle (`:4536-4564`).
- Super-Speed / pass-combo afterimage ghosts 6/3 → 3/2 (`trailGhostsFor`, `:395-406`).

**Never suppressed at any speed:** ball, ball shadow, ball height arc, x-ray ghost, possession ring, hero power rings and plates, zone-ready tint, every status tint, shot-power number, pass-combo and tackle pops, speed-boost labels, formation role labels, incapacity countdowns, banners/ticker text, score, HUD text, the power takeover card, and each power's **primary** effect scene.

**Two implementation constraints — both are real defects if missed:**

1. **Do not restart the RAF loop on a speed change.** `suppressCosmeticEffects` is currently a dependency of the loop effect (`MatchScreen.tsx:3195`). Making it speed-dependent would tear down and restart the loop on every speed tap (resetting `last`/`acc`, calling `resetJuice`). Introduce `suppressCosmeticEffectsRef`, written at render time next to `speedRef` (`:1212`) and read inside the loop (`startSubstitutionWalk` `:1685`, `startJuice` `:1781`, trail write `:2087`, effect recording `:2377`, `:2530`), and remove `suppressCosmeticEffects` from the dependency array. The render body keeps the state-derived boolean.
2. **Re-stage the adaptive ladder, or 3× loses itself faster than today.** `performanceAdaptationDecision(consecutive, reducedEffects, bad)` picks the rung from the `reducedEffects` flag (`match-performance.ts:44`). Once 3× implies reduced effects at mount, the first pair of bad windows would jump straight to `limit-to-2x` and persist a 30-day cap. Replace the boolean argument with an explicit stage:

   ```
   type PerformanceAdaptationStage = 'none' | 'reduced-effects' | 'coalesced';
   performanceAdaptationDecision(consecutiveBadWindows, stage, badWindow)
   ```

   Rungs, two confirmed bad windows each:
   - `none` → `reduce-effects` (a no-op at 3× where it is already on; still meaningful at 2×)
   - `reduced-effects` → `coalesce-presentation` (Phase 2's lever, if not already on at this speed)
   - `coalesced` → `limit-to-2x` (the existing persisted cap, unchanged)

   Net effect: reaching the 2× cap requires **at least as many** bad windows as today, never fewer.

**Expected win:** removes per-tick path building and per-frame flame work in busy play only. If `W-quiet` was already failing, this phase will not fix it — that is what G3 is for.

## 7.2 Phase 2 — Coalesce React presentation commits at 3×, tick every sim tick

**Concession:** at 3× only, `MatchScreen` re-commits presentation every **second** sim tick (15 commits/s) instead of every tick (30/s), unless a forced-commit reason applies. The deterministic sim still advances every tick, and **`publishAtlasFrame` still runs on every advanced batch**, so all motion, ball height, statuses, zone fractions, carrier and the UI-runtime visual clock are exactly as they are today.

### 7.2.1 Why this is the smallest honest concession

Every channel this touches is already quantised to **sim ticks**, so at 1× it runs at 10 presentation steps per wall-clock second and looks correct. At 3× with a coalescing factor of 2 it runs at **15 steps per wall-clock second** — still 1.5× the presentation rate of 1×. Nothing gets a worse *wall-clock* refresh than the speed everyone accepts as the reference.

What halves is *sim-time* resolution: 5 samples per simulated second instead of 10. Channels checked against their actual periods:

| Channel | Period | Behaviour when sampled every 2 ticks |
|---|---|---|
| Keeper ready loop | flips every 5 ticks (`animation.ts:134-138`) | unaffected (period 10) |
| Wind-up tint flash | `hud.tick % 4 < 2` (`MatchScreen.tsx:3362`) | still alternates (period 4, sampled at 2) |
| Zone-ready flash | period `20 × rate` = 60 ticks at 3× (`zone-ready-look.ts:38`) | 30 samples/cycle — smooth |
| Web-trap circle blink | `hud.tick % 20 < 10` (`:4458`) | unaffected |
| Substitution walker legs | `floor(tick × 100 / 130) % 2` (`substitution-walk.ts:263`) | parity still varies; no lock-up |
| Run cadence | distance-derived (`runFrameForDistance`) | 15 fps at 3× vs 10 fps at 1× — better than 1× |
| Procedural VFX | 4 age steps × 167 ms over 6.7 ticks (`match-vfx.ts:9-11,138-143`) | 3–4 samples instead of 7; the fade still reads |
| Power-effect scenes | `elapsedMs` from `hud.tick` (`MatchScreen.tsx:3569-3572`) | 15 samples/s at 3× vs 10/s at 1× — better than 1× |
| **Slide-tackle sprite cells** | **10 authored poses over ≥10 ticks** (`animation.ts:149-165`) | **5 of 10 poses — the one genuine loss** |

### 7.2.2 The commit gate

New pure module `src/render/match-presentation-cadence.ts` (headless, no RN/Skia imports):

```
export const PRESENTATION_COALESCE_TICKS: Readonly<Record<MatchSpeed, number>> =
  { 1: 1, 2: 1, 3: 2 };

export function shouldCommitPresentation(input: {
  ticksSinceCommit: number;
  coalesceTicks: number;
  forced: boolean;
}): boolean;
```

`coalesceTicks === 1` for 1× and 2× makes those speeds identical to today's control flow.

**Forced commit is unconditional when any of these hold** — each is either immediately player-visible, or required to keep React's view single-tick-coherent:

1. `snap` — restart, kickoff, authored teleport.
2. `pauseAfterPublish` — half-time speech offer, showcase freeze, first-match coaching prompt, hero-power tutorial (`MatchScreen.tsx:2015, 2038, 2063, 2998`).
3. `s.phase === 'fulltime'`.
4. Score changed vs last commit; `s.half` or `s.phase` changed.
5. Carrier identity changed (`nextRef.current.carrier`).
6. Visibility vector changed (substitution, Decoy clone appear/disappear).
7. `bannersChanged`, including the wasted-power queue drain (`:3076-3081`); the existing non-advanced banner path (`:3137-3142`) stays.
8. **Any other React state was set during this RAF callback.** The drain calls `setShotPowerPop`, `setPassComboPop`, `setTacklePop`, `setNewestPop`, `setGoalConfettiBurst`, `setPowerCutIns`, `setHeroTint`, `setPowerShowcaseFrozenAt`, `setSpeechPromptOpen`, `setFirstMatchTutorialStep` and others. React re-renders anyway; committing `frame`/`hud` in the same batch is what prevents a **stale mixed-time render**, where the JSX reads the live mutable `match` at tick N while `frame`/`hud` still describe tick N−1. Implement as a single `let reactStateTouched = false;` set by a small local wrapper at each of those call sites inside the loop closure.

Explicitly **not** a forced reason: "an event occurred". Passes and tackles are chatty; the 2026-07-28 plan rejected that and this spec keeps the rejection.

### 7.2.3 What must change alongside the gate

- `publishAtlasFrame` keeps its current cadence and its current one-tick window (`TICK_MS / rate`). Do not lengthen it, do not skip it. Motion is not part of this concession.
- The UI-runtime `visualTick` keeps interpolating continuously (`worklet-atlas-frame.ts:493-497`); the React `hud.visualTick` simply arrives less often. Every consumer already tolerates a monotonic step greater than 1 (catch-up batches produce that today).
- `setFrame` and `setHud` remain a single batch derived from the **same completed tick**. Never commit one without the other.

### 7.2.4 Named concession and its bounded mitigation

> **Concession C2:** at 3×, a slide tackle plays 5 of its 10 authored poses.

Mitigation, only if the §10.3 video review rejects it: force a per-tick commit while any entry in `actionRef.current` is an active `slide`. Slides are short (≥10 ticks) and infrequent relative to the ~100 staggers per match (`animation.ts:24`), and staggers do not use the action cell, so this restores full pose resolution at a small, bounded cost. Ship it only with a before/after measurement.

## 7.3 Phase 3 — Ordinary-HUD cadence, only if Phases 1–2 miss

Two independent options; pick the one the profile names, not both.

**Option A — cadence.** Raise `PRESENTATION_COALESCE_TICKS[3]` from 2 to 3 (10 commits/s at 3×, exactly the 1× rate). Cheapest possible change; costs slide poses (3–4 of 10) and one more step of VFX coarseness. Requires re-running the §10.3 readability review in full.

**Option B — boundary.** Put *ordinary HUD* — displayed minute, rounded energy percentages, substitution tally, team-energy band, `railClockLine` — behind one memoised child fed by a small immutable snapshot with value equality, so unchanged text does not re-render. This is the bounded version of the 2026-07-28 plan's Phase 2B restricted to the HUD half, and it is a **non-visible** change (no cadence loss). The child must receive every value it displays and must not read the mutable `match`; add the architecture test in §9.4.

Prefer **B** if the profile shows HUD text subtree cost; prefer **A** only if the cost is spread across the whole commit.

## 7.4 Phase 4 — Fall back from 3× only when needed

The existing ladder stays as the last rung, re-staged per §7.1:

- Two confirmed bad windows per rung; `limit-to-2x` remains terminal, still writes `createMatchPerformanceLimit(Date.now())`, still shows `matchScreen.performance.limited`, still expires after 30 days, still clearable from Settings. No copy or schema changes.
- The cap must remain reachable — a device that genuinely cannot hold 3× must degrade gracefully rather than stutter forever.

**Option C (only under gate G4):** reuse the publish typed-array buffers instead of allocating six per tick (`worklet-atlas-frame.ts:734-739`). This needs a ring of at least three buffers, because `previousPositions` and `nextPositions` both hold live references and `sampleRawRetargetPositions` mints a third. High risk of a subtle one-frame corruption; only with a measured allocation profile naming it, and with the retarget tests extended to cover buffer reuse.

---

# 8. Affected code areas

| File | Change |
|---|---|
| `src/render/match-presentation-cadence.ts` | **new**, pure: `PRESENTATION_COALESCE_TICKS`, `shouldCommitPresentation` |
| `src/render/match-performance.ts` | `PerformanceAdaptationStage` replaces the `reducedEffects` boolean argument; new `coalesce-presentation` action; `secondaryEffectsSuppressed(speed, adaptiveReduced)` helper |
| `src/render/MatchScreen.tsx` | `suppressCosmeticEffectsRef` + removal of `suppressCosmeticEffects` from loop deps (`:3181-3197`); effects profile derived from speed; commit gate around `setFrame`/`setHud` (`:3120-3142`); `reactStateTouched` flag; ladder call site (`:1902-1929`); stale doc comment at `:778` |
| `src/render/worklet-atlas-frame.ts` | **unchanged** in Phases 1–3 (touched only under §7.4 option C) |
| `WorkletMatchOverlays.tsx`, `ProceduralMatchEffects.tsx`, `MatchTickerLine.tsx`, `match-vfx.ts` | **unchanged** — they already accept `reducedEffects`; only what MatchScreen passes changes |
| `src/render/match-frame-report.ts` | **new, measurement build only**; deleted or permanently disabled before release |
| `src/ui/release-surface.ts`, `scripts/release/check-config.mjs` | `MATCH_FRAME_REPORT_AVAILABLE` guard, mirroring `DEVELOPER_MODE_AVAILABLE` |
| `src/render/__tests__/*` | see §9; three existing source-assertion tests must be updated in the same commit |

**No changes** to `src/sim/`, `src/game/`, `src/persistence/` (the `MatchPerformanceLimit` shape is untouched), `content/`, or any i18n catalog.

---

# 9. Focused tests (headless; `npx jest <paths>` + `npx tsc --noEmit`)

Do **not** run the balance rails or `m2-managed-recovery-soak` — this is renderer-only work (`AGENTS.md:16`).

## 9.1 New — `src/render/__tests__/match-presentation-cadence.test.ts`
- 1× and 2× return `coalesceTicks === 1` and therefore commit on every advanced tick.
- 3× commits on ticks 2, 4, 6 … when nothing is forced.
- Any forced reason commits immediately and resets `ticksSinceCommit`.
- A 5-tick catch-up batch commits once, not five times, and resets the counter.
- `ticksSinceCommit` never exceeds `coalesceTicks` across a randomised schedule of advances.

## 9.2 Extended — `src/render/__tests__/match-performance.test.ts`
- The staged ladder needs two bad windows per rung and reaches `limit-to-2x` no sooner than today — assert the exact required count (6, not 4).
- A good window resets the counter at every stage.
- `secondaryEffectsSuppressed(3, false) === true`; `(2, false) === false`; `(2, true) === true`.
- Existing assertions (60 Hz window accepted, stable 30 fps rejected, > 1 % over two intervals rejected, lifecycle-gap reset, TTL) still pass unchanged.

## 9.3 New source-assertion — `src/render/__tests__/match-presentation-gate.test.ts`
MatchScreen is unimportable under Jest (Skia/Reanimated/expo-audio), so follow the house pattern of `match-render-hot-path.test.ts`:
- `publishAtlasFrame(` appears **before** the commit gate and is **not** inside it — motion publishes every advanced batch.
- The forced-commit expression contains `snap`, `pauseAfterPublish`, `'fulltime'`, the score comparison, the carrier comparison, `bannersChanged`, and `reactStateTouched`.
- The loop effect dependency array no longer contains `suppressCosmeticEffects`, and `suppressCosmeticEffectsRef` exists.
- `setFrame(` and `setHud({` remain adjacent inside one branch (no path can commit one alone).
- The `else if (bannersChanged)` path is preserved.

## 9.4 Phase 3 option B only — architecture test
The extracted HUD child does not accept or read the mutable `match` object; its props are primitives or frozen snapshots.

## 9.5 Existing tests that will break and must be updated in the same commit
- `src/render/__tests__/power-juice.test.ts:258-263` — pins the literal `const suppressCosmeticEffects = reduceMotion || reducedEffects;` and `startJuice`'s first line. Update to the new expression and the ref read; the intent (Reduce Motion gets none of the juice) must still be asserted.
- `src/render/__tests__/slide-tackle-effects.test.ts:107-139` — pins `reducedEffects` wiring; still valid, re-check the prop source.
- `src/render/__tests__/substitution-walk-wiring.test.ts:32` — asserts `suppressCosmeticEffects` appears in the first 200 chars of `startSubstitutionWalk`; keep the substring by naming the ref `suppressCosmeticEffectsRef`.

## 9.6 Regression suites
All of `src/render/__tests__/` (headless), plus `src/ui/__tests__/player-feedback-contracts.test.ts` and `src/ui/__tests__/release-readiness.test.ts`, plus the golden-replay/determinism suites **to prove they are unchanged** — no snapshot may be updated. `npm run release:check` must pass with the measurement flag false.

---

# 10. Physical-device acceptance

Same device, same fixed match, same protocol as §6, Release configuration, same hardware as the baseline. A simulator, a Debug build, a web export or a Safari preview is **not** acceptance evidence.

## 10.1 Frame pacing — 3× (both `W-quiet` and `W-power`)

| Metric | Target |
|---|---|
| p95 RAF gap | ≤ 20.8 ms (1.25 × 16.67) |
| Gaps ≤ 33.4 ms | ≥ 99.0 % |
| Gaps > 50 ms, excluding lifecycle events | 0 |
| RAF callbacks per second | ≥ 57 |
| Windows classified `bad` by `recordFrameGap` over a whole match | 0 — the adaptive ladder never fires |
| Sim ticks per wall-clock second | 30.0 ± 0.3 |
| Accumulator clamps at `MAX_CATCHUP_TICKS` | < 0.5 % of callbacks |
| `W-all` wall-clock duration | 66.7 s ± 2 % |

## 10.2 No regression — 1× and 2×

| Metric | Target |
|---|---|
| p95 RAF gap | ≤ 20.8 ms, and no worse than baseline by more than 1 ms |
| Gaps ≤ 33.4 ms | ≥ 99.5 % |
| Commits per second | 10.0 ± 0.2 at 1×, 20.0 ± 0.4 at 2× — proof the gate did not touch them |
| Presentation | pixel-comparable to baseline on the same tick range |

## 10.3 Readability review (60 fps recording of `W-power` at 3×, frame by frame)

Every item must pass, or the phase that caused the failure is reverted:
- The ball is continuously trackable; no positional discontinuity in ordinary play.
- The carrier is identifiable at all times; the possession ring transfers within one tick of the sim handover.
- A slide tackle still reads as plant → slide → recover (the specific check for concession C2).
- A goal reads: shot → save/goal → banner → restart, with score and banner arriving on the same frame as the event's audio.
- Substitutions: both walkers appear; neither player flickers nor double-draws.
- Charged heroes read as charged (zone tint flashing, rings and plates present); a firing power reads as firing.
- Wasted-power lines and the full-time line still cross fully.
- Kickoffs and restarts snap; nothing streaks across the pitch.
- Reduce Motion at 3× behaves as at 1× with no additional suppression artefacts.

## 10.4 Functional

- Same seed and inputs → identical result and ordered events (headless, plus one on-device Quick Result parity check).
- Audio and haptics ordered and exactly once through 5-tick catch-up batches; the fire crackle starts and stops correctly around a tier-2 shot and a paused match.
- Pause/resume, background/foreground, half-time speech, first-match coaching prompt, hero-power tutorial, showcase freeze, and the full-time hold + handoff all behave as before.
- Speed changes mid-tick still resume with only the unfinished fraction of the interpolation window (`resumeAtlasFrameOnUI`).

---

# 11. Edge cases

1. **Speed change mid-tick.** `applySpeed` resets the pacing monitor and calls `resumeAtlasFrame` (`MatchScreen.tsx:4058-4067`). It must also reset `ticksSinceCommit` and force the next commit, so a 3×→1× tap does not leave the HUD stale for up to 100 ms.
2. **Speed change must not restart the RAF loop** (§7.1 constraint 1).
3. **Pause.** The paused branch returns before the tick loop (`:1880-1900`). Reset `ticksSinceCommit` on pause; force a commit on the resume frame.
4. **Background/foreground.** `AppState` handling already resets `last`, `acc` and the pacing monitor (`:1650-1659`); add the commit counter to that reset.
5. **Catch-up batch of 2–5 ticks.** One commit opportunity; `ticksSinceCommit` advances by the number of ticks actually simulated, so a 5-tick batch at 3× always commits.
6. **`pauseAfterPublish` paths.** Half-time speech, showcase freeze, VFX-harness freeze and the tutorial prompt all break the tick loop and need publish-then-freeze ordering; they are forced commits, and the assertion in `worklet-atlas-retarget.test.ts:370-385` (publish before `syncPauseReasons`) must still hold.
7. **Full time.** Forced commit; `FULLTIME_HOLD_MS`, the wasted-power drain and the single `onDone` handoff are untouched. The final frame must be committed, not coalesced away.
8. **Snap frames.** Forced commit, and `trailRef` clearing at `:3041-3047` still happens on the same frame.
9. **Substitution hidden slots.** `hiddenSlots(...)` writes `visible[slot] = false` onto the frame about to be published (`:3113-3114`); that frame is still published to the Atlas every tick, so hide/unhide stays correct. Forced reason 6 prevents the React-side visibility read from lagging.
10. **Decoy clone appear/disappear.** Visibility change ⇒ forced commit; the newly-visible rule keeps the clone from flying in from its hidden slot.
11. **Banner expiry with no advanced tick.** Preserved by the existing `else if (bannersChanged)` branch.
12. **Wasted-power queue at full time.** Uses `expiresAtMs` wall clock after ticks stop; unaffected, because full time forces commits.
13. **`heroTint` flash.** Four `setHeroTint` calls per activation, wall-clock driven in `advanceJuice` (`:1871-1875`), each already forcing a React render. Under forced reason 8 they also commit `frame`/`hud`, so during an activation the effective cadence briefly returns to per-tick. That is correct, and it is why suppressing the flash is a Phase 3-adjacent option, not a default.
14. **Adaptive ladder mid-match at 3×.** With the new staging, `reduce-effects` is a no-op at 3× and the next rung is `coalesce-presentation` (also already on at 3×), so a genuinely struggling device reaches `limit-to-2x` after three rungs. Verify the ladder cannot skip a rung and cannot reach the cap in fewer than six bad windows.
15. **Persisted cap already active.** `effectiveMaximumSpeed` clamps to 2 (`:806-809`); the 3× profile and gate are unreachable, and 2× must behave exactly as today.
16. **Reduce Motion on at 3×.** `suppressCosmeticEffects` is already true; the 3× profile must be a superset with no double-suppression bug (the tier-2 flame is frozen by Reduce Motion in the worklet, not removed — `:2132-2136`).
17. **Graphics context loss / recovery.** `RecoverableSkiaCanvas` remounts on `graphicsGeneration`; the commit counter must reset with it so the first frame after recovery is committed.
18. **Thermal throttling.** A hot device fails acceptance even with a correct fix. Report thermal state with every run and re-run after cool-down before declaring a regression.
19. **Teardown.** No commit may be scheduled after unmount; the existing `cancelAnimationFrame` + `resetJuice` cleanup covers it, but the gate must not introduce a `setTimeout`/microtask path that outlives the effect.

---

# 12. Rollout

1. **Phase 0 report first**, as a markdown artifact under `artifacts/` (device, build SHA, configuration, every metric in §6.3 for all nine runs), plus the written gate decision (G0–G5). If G0 passes, the report *is* the deliverable.
2. Implement one phase per commit, each with its focused tests, `npx tsc --noEmit`, and `npm run format:check`.
3. Verify on the phone's Debug-over-Metro build for correctness only (merge to main → `git pull` in the MAIN folder → reload). Debug is not the acceptance surface.
4. Build Release to the device, run §10 acceptance, and append the after-numbers to the same artifact.
5. Stop at the first phase that passes (§6.4 G5). Record explicitly which phases were not needed.
6. Before any archive: `npm run release:check` must pass with `MATCH_FRAME_REPORT_AVAILABLE === false`, and `npm run release:inspect` on the built app. Delete or permanently disable the measurement module.
7. Update `docs/release/current-release-risks.md` — the "live iPad transition performance remain measured follow-up items" line should gain the 3× iPhone result, pass or fail.

# 13. Rollback

- Each concession is one named constant. `PRESENTATION_COALESCE_TICKS[3] = 1` restores today's per-tick commit behaviour with no other edit. `secondaryEffectsSuppressed` returning `adaptiveReduced` alone restores today's effects at 3×.
- The adaptive-ladder restaging is the one change that is not a constant flip; keep it in its own commit so it can be reverted independently, and keep `match-performance.test.ts` asserting the exact bad-window count so a revert is caught by CI rather than by a player losing 3×.
- No persisted data changes, so a rollback needs no migration. A player who already earned a `performanceLimit` under any version can clear it from Settings.
- If a defect appears post-merge and pre-archive: revert the phase commit, re-run §9.6, re-measure. If it appears after the archive is cut, the archive is rebuilt from the reverted commit — there is no server-side switch, and none should be added.

---

# 14. Risks

- **The concessions may not be the fix.** If gate G4 opens, the cost is in Skia or the Atlas publish path and Phases 1–3 will move the number very little. The honest outcome then is a report saying so, not a shipped concession that buys nothing.
- **Measurement contamination.** A run where the adaptive ladder fires mid-sample measures a different renderer than the one being evaluated. Every run must report adaptation events; contaminated runs are discarded, not averaged.
- **Source-assertion tests are brittle by design.** Three of them pin exact strings this work changes (§9.5). Updating them is part of the change, and the intent each one protects must survive the edit.
- **A stale doc comment already misleads.** `MatchScreen.tsx:778` says 3× unlocks in Season 3; the shipped behaviour and its own test say otherwise. Fix it in the Phase 0 commit so the measurement protocol is not doubted later.


<!-- END CLAUDE OPUS 5 SPEC -->

<!-- BEGIN GROK 4.6 SPEC -->

# 3x live-match smoothness on a physical iPhone

## 1. Purpose

Make **3x watched-match playback** feel smooth on a **physical iPhone Release build** without changing what the match *is*. The sim stays a fixed 100 ms tick. 3x still means 30 deterministic ticks per wall-clock second. The picture stays Atlas-batched, Reanimated-interpolated, and atomically retargeted. The existing adaptive path still exists, but it must not be the first or only answer.

This is a renderer/presentation change. It is not a match-engine change.

## 2. Current system (evidence, not a redesign)

These facts are in the tree today and are the ground this spec stands on.

### 2.1 Simulation and wall clock

- Logical tick is `TICK_MS = 100` (`src/sim/geometry.ts`). A half is `HALF_TICKS = 1000`; a match is 2000 play ticks plus stoppage.
- Watched playback rate is the selected speed itself: `matchPlaybackRate(1|2|3) => 1|2|3` (`src/render/match-speed.ts`). At 3x the interpolation window is `TICK_MS / 3 ≈ 33.3 ms`.
- The RAF loop adds `(now - last) * playbackRate` into an accumulator and drains it in 100 ms steps (`src/render/MatchScreen.tsx`). Catch-up is capped at `MAX_CATCHUP_TICKS = 5`.
- One RAF may therefore run several `tick(s)` calls, but it publishes **only the last adjacent frame pair**.
- 3x is selectable from the first watched match. `App.tsx` does not pass `maximumSpeed`. `MatchScreen` defaults to `maximumSpeed = 3`. The Season 3 unlock described in `docs/08-ui-ux.md` is stale; tests in `src/ui/__tests__/player-feedback-contracts.test.ts` lock the current contract. The `availableMatchSpeeds(2)` helper remains for the performance cap and the 1x power-demo clip.

### 2.2 Picture path

- Player and ball motion live on the UI runtime: Skia `Atlas` plus Reanimated interpolation (`src/render/worklet-atlas-frame.ts`).
- `retargetAtlasFrameOnUI` is one worklet. It samples the in-flight **raw** (unposed) positions and ball height, installs the new target, and restarts `withTiming` for `TICK_MS / rate`. Pose offsets are not baked into the next base. Restarts snap. Newly visible slots start at the authoritative position.
- After an advanced batch the JS thread currently always calls `publishAtlasFrame`, `setFrame`, and `setHud`. Sprite keys, status tints, procedural VFX (`ProceduralMatchEffects` reads `hud.visualTick`), power-effect membership, carrier card, clock, and hero dock then recompute in the large `MatchScreen` render.
- Several overlays already follow worklet time (`WorkletSlideTackleEffects`, hero rings). Procedural VFX and React sprite cells still follow the React tick.

### 2.3 Existing adaptive path

`src/render/match-performance.ts` plus the RAF loop:

1. Sampling starts only at speed ≥ 2, after a 2 s warm-up on native (`hasWeakDeviceHardwareHint()` is **false** on native; web-only 1 s / 2-core hint never disables 3x by itself).
2. A window is 300 RAF gaps. Lifecycle gaps `< 4 ms` or `> 250 ms` reset the window.
3. Display interval is inferred from the fastest fifth of samples. A steady 30 fps delivery is classified as a **bad 60 Hz result**, not a 30 Hz panel (`rejects a stable 30fps result` in `match-performance.test.ts`).
4. A window is bad when p95 gap > `max(1.25 × displayInterval, 24 ms)` **or** more than 1% of gaps exceed `max(2 × displayInterval, 34 ms)`.
5. Two consecutive bad windows → `reducedEffects = true` (in-match, not persisted).
6. Two further consecutive bad windows → persist `MatchPerformanceLimit { maxMatchSpeed: 2, reason: 'frame-pacing', 30-day TTL }` and drop live speed 3 → 2. Notice: `matchScreen.performance.limited`. Settings can clear it (`PROBAR 3× OTRA VEZ` / `settings.performance.try3x`).
7. Pause, speed change, and background reset the monitor.

`reducedEffects` already folds into `suppressCosmeticEffects = reduceMotion || reducedEffects` and drops secondary cosmetics listed in §7.2. Primary power art, on-target shot numbers, and event audio/haptics stay.

### 2.4 What is already done, and what is not measured

Atomic UI-runtime retargeting shipped (`docs/plans/2026-07-28-fix-high-speed-match-rendering-plan.md`, `worklet-atlas-retarget.test.ts`). A **local production-web** 3x sample was used to skip a React split. That web sample is **not** iPhone evidence.

Known iPhone data is insufficient:

- `artifacts/polish-audit-2026-08-06/device-trace-notes.md` is Debug-over-Metro on an iPhone 16 Pro Max, mostly 1x, and the live-match frame-lifetime table failed to export.
- Canon budget in `docs/09-tech-stack.md` is **60 fps on iPhone 12-class hardware**.
- A 16 Pro Max result is necessary, not sufficient, for a min-spec claim.

## 3. Goals

1. Measure the **same fixed watched match** on a **physical iPhone Release build** at 1x, 2x, and 3x **before** choosing a fix.
2. If 3x is the only failing speed, make 3x meet the pacing bar in §11 with the **smallest user-visible concession** that still keeps the match readable.
3. Keep 3x as a real 3x: wall-clock duration ≈ `simMs / 3`, not a silently slower clock.
4. Keep 1x and 2x at current visual quality unless Reduce Motion or the existing adaptive path is already on.
5. Fall back from 3x to a persisted 2x cap **only after** in-match work reduction has been given a fair window, using the existing two-plus-two bad-window machine.

## 4. Non-goals

- No `src/sim/` behavior, RNG, event order, recorded inputs, match results, or replay-byte changes. **Do not bump `ENGINE_VERSION`** (`m2.9`). Stop for an explicit version decision if that boundary is crossed.
- No Quick Result changes. Quick Result is not a watched-speed problem.
- No new selectable speeds, no 4x, no slider, no quality toggle, no control-layout change.
- Do not restore the removed Season 3 / Bert 3x unlock.
- Do not lower the **display** frame rate to 30 fps, and do not teach the pacing monitor that a steady 30 fps result is a native 30 Hz panel.
- Do not add a queued visual-tick player, a debt scheduler, a second Canvas, typed-array pooling, a general pacing service, or a seven-lane view-model tree.
- Do not globally strip **primary** power effects, cut-ins, or shot/save/goal readability to hide jank.
- Do not run balance, soak, or seed-rail suites for this renderer-only work.
- Do not treat Safari, Simulator, Debug/Metro, or the 2026-07-28 web sample as the shipping gate.
- No new player-facing copy unless the existing 2x-cap notice is reused. Silent quality drops need no string.

## 5. Explicit decision: display frame rate

**Lowering display frame rate is not an acceptable 3x smoothness strategy.**

Reasons, all from the current renderer and docs:

1. The interpolation window at 3x is already ≈ 33 ms. At 60 Hz that is about two display frames of motion. At 30 Hz it is one frame: retargeting has nothing to interpolate and locomotion reads as a tick-to-tick snap. That harms match readability, which this spec is required to protect.
2. The shipping monitor already rejects a stable 30 fps window (`match-performance.test.ts`). Accepting 30 fps as success would invert a tested contract.
3. The performance budget is 60 fps on iPhone 12-class (`docs/09-tech-stack.md`).
4. ProMotion dropping on a static menu is power-saving, not a gameplay target (`device-trace-notes.md`). A live Atlas match is asking for every frame.

**Also rejected as a first-line fix:** locking ProMotion devices to 60 Hz via a new preferred-frame-rate native path. That is new display infrastructure, 60 fps is already the budget rather than a concession, and 120 Hz is the one place 3x still gets four interpolation samples per tick. Reconsider only if Phase 0 shows GPU/compositor time dominating **and** a 60 Hz cap is the smallest measured win — that reconsideration is a new spec, not this one.

Work reduction happens by doing less per frame, not by asking the panel for fewer frames.

## 6. User flow (unchanged controls)

1. A watched match opens with 1x / 2x / 3x available (phone scorebar cycle; desktop chips). The power-acquisition clip stays capped at 1x.
2. The manager may change speed at any time. Changing speed resets the pacing monitor and retargets the unfinished interpolation window (`resumeAtlasFrame`).
3. Pause still freezes sim and Atlas and skips `setFrame` / `setHud`. Full time still publishes the last frame and holds for the existing deadline.
4. If this work later applies a 3x-only cosmetic budget, switching 3 → 2 or 1 restores full 2x/1x cosmetics unless adaptive `reducedEffects` or Reduce Motion is already on.
5. If two confirmed bad windows remain after in-match reduction, the live speed drops 3 → 2, the 30-day cap persists, the existing banner shows, and Settings still offers **Try 3× again**.
6. MANUAL `ARMED` / `FIRE!`, save-power windows, formation, playstyle, swap, energy use, and Auto Subs stay on the current rules. Quick Result remains automatic and uncapped by match-speed presentation.

No new tutorial, no new settings row for quality.

## 7. Concession policy (smallest visible change first)

Apply **one stage**, re-measure, **stop** at the first stage that meets §11. Do not stack later stages “for hygiene.”

### 7.1 Stage A — Coalesce React presentation; never skip sim ticks

**Do this only if Phase 0 shows React commits or post-tick JS correlating with long frames.**

Keep:

- Every overdue sim tick, in order, still capped at five per RAF.
- Event audio and haptics in emission order, exactly once, from the ordered event stream (`playForEvent` / `playHapticForEvent` after the catch-up loop, as today).
- One Atlas publish per advanced batch, still atomic UI-runtime retargeting, still `TICK_MS / rate`.
- Immediate flush of **critical match state** on the RAF that first contains it (see §7.4).

Change:

- Do not call `setHud` when the **displayed** HUD snapshot is equal and no critical field changed. Equality is on visible values (score, phase, banner ids, carrier id, hero-dock pressability, pause), not on “any event occurred.” Passes and tackles are too chatty to flush React.
- Ordinary HUD values (displayed minute, rounded energy) may wait for a **10 Hz backstop** (`TICK_MS` at 1x; 100 ms wall). The minute already changes only about every 22 sim ticks, so this is a ceiling, not a reason to show a stale score.
- `setFrame` stays coupled to tick-sensitive scene identity (sprite cell, slide/keeper pose, status tint, visibility, live power-effect membership, incapacity countdown identity). Do **not** throttle that to 10–15 Hz while those still live in React.
- If, and only if, skipping `setHud` still leaves the whole `MatchScreen` function on the hot path, extract **at most two** children already named in the 2026-07-28 plan: a pitch scene and a HUD, fed by immutable snapshots that do not read the live mutable `match`. That is the maximum structural change this spec allows. No general subscription framework.

Procedural VFX currently sample `hud.visualTick`. If HUD cadence lags, either keep VFX on the critical flush or point them at the existing worklet `visualTick`. Do not let a cheaper HUD freeze a live burst’s phase.

### 7.2 Stage B — Secondary cosmetics at 3x only

**Do this only if Stage A is skipped (React not hot) or still fails, and Phase 0 / A implicates overlay, particle, trail, juice, or extra React from those layers.**

Use a **separate 3x cosmetic budget**, not the adaptive `reducedEffects` flag. Reusing `reducedEffects` would mark the 2x-cap stage as already satisfied and make 3x fall back **faster**. That is forbidden.

Suggested implementation: `suppressCosmeticEffects = reduceMotion || reducedEffects || threeTimesCosmeticBudget`, with `threeTimesCosmeticBudget` true only while live speed is 3 and Stage B is enabled.

**Drop at 3x (secondary):**

| Layer | Current hook |
|---|---|
| Super Speed / pass-combo ghost trails | `trailGhostsFor` already zeroed by `suppressCosmeticEffects` |
| Ordinary shot puffs | already gated |
| Substitution walk-on/off | already gated |
| Activation juice (camera punch, flash, speed lines, four-step `heroTint`) | `startJuice` already returns |
| Goal confetti and goal shake | already gated |
| VFX secondary gold marks | `sampleMatchVfxGeometry(..., reducedEffects)` `secondary` flag |
| Slide-tackle traveling dust/grass phases; trail samples 4 vs full | `WorkletSlideTackleEffects` |
| Extra ticker outline rings / held ticker motion | `MatchTickerLine` |
| Scorching per-frame flame (tier 2 → still play the launch burst and audio) | `scorchingShot` already drops when `reducedEffectsRef` |
| Ball-behind-player x-ray | `ballOccluded` already gated |

**Keep at 3x (readability / spectacle):**

- Authored power effect art and cut-ins (Track-B catalog; skippable-after-first-view policy unchanged).
- On-target shot power number.
- Dangerous-shot / save-impact / interruption **primary** marks.
- Airborne ball flight trail (already Reduce Motion only, not adaptive).
- Score, clock, carrier identity, heat / Zone / `ARMED` / `FIRE!` / save-window drain / `WASTED POWER`.
- Goal / save / miss banners and audio/haptics.
- Kickoff and restart snaps.

1x and 2x do not use `threeTimesCosmeticBudget`. Reduce Motion remains the accessibility override and may drop more than this list.

### 7.3 Stage C — Fall back from 3x only when needed

Keep the existing machine:

- Still two consecutive bad windows to set adaptive `reducedEffects` (idempotent if Stage B already dropped the same secondaries).
- Still two **further** consecutive bad windows to persist the 2x cap.
- Do **not** shorten those counts because Stage B is on.
- Do **not** change the 30-day TTL, retry button, or notice copy in this work unless Phase 0 shows the cap firing on a cooled device that later holds 3x. That would be a separate product change.
- Measurement runs in §8 must **record** these decisions without applying them, or the 3x sample will contaminate itself.

### 7.4 Critical vs ordinary presentation

**Critical — next RAF, no 10 Hz wait:**

- Score and match phase (including half-time and full-time).
- Pause / resume, including automatic pause reasons (speech, tutorial, showcase, background).
- New banner **identity** (goal, power, wasted power, formation/playstyle/energy confirmation).
- Substitution player identity (the swap itself, not the walk decoration).
- Carrier identity on the name/energy card.
- Hero dock pressability: `ARMED` → `FIRE!`, save-window arming and remaining drain, `WASTED POWER`.
- Cut-in queue and first-match / hero-power tutorial prompts.
- Graphics-loss recovery status.

**Ordinary — equality first, 10 Hz backstop:**

- Displayed minute / stoppage mark when the band has not changed.
- Rounded energy figures.
- Score-flash boolean after the goal identity is already up.
- Ambient ticker animation chrome.

**Motion — UI runtime, display cadence:**

- Atlas transforms, ball height, possession ring, worklet tackle debris, hero rings already on shared values.

## 8. Phase 0 — Measure before choosing a fix

This phase is mandatory. No Stage A/B/C product code without a written Phase 0 log.

### 8.1 Build and device

- Physical iPhone, **Release** (not Debug/Metro, not Simulator).
- Record model, iOS, peak refresh rate, build SHA, `ENGINE_VERSION`, Reduce Motion off, `performanceLimit` cleared, cut-in mode, AUTO vs MANUAL, haptics as shipped.
- Cool the device between speeds. Do not compare a hot 3x run to a cold 1x run.
- Canon claim needs iPhone 12-class. A 16 Pro Max log is required if that is the available phone, and must be labelled **above min-spec**.

### 8.2 The same fixed match

Native Release ignores QA-root flags, so the fixture is a **real watched career match**, not the power-match reel.

Pin and record:

- Career seed, season, week, home/away names, formation, Auto Subs, AUTO/MANUAL.
- No live coaching inputs during the sample (no pause, speed change, swap, or power tap). AUTO powers only, so the event stream is seed-identical across the three speeds.
- Start each speed from kickoff of **that same fixture** (reload the save; do not continue a half-used match).
- Two windows per speed, 30 s each after the existing 2 s warm-up: (1) quiet midfield, (2) the first power-heavy stretch the seed actually produces. If the seed has no power in 30 s, note that and still keep the quiet window comparable.

Do not invent a seed in this spec. The implementation log names the save slot and seed after the first run.

### 8.3 What to record

Reuse `recordFrameGap` math so the shipping monitor and the log speak the same thresholds. Aggregate; do not `console.log` every frame. Do not synchronously read Reanimated shared values from JS.

Per speed:

- RAF gap p50 / p95 / max; count over two display intervals; inferred `displayIntervalMs`.
- Sim ticks processed per RAF: mean, p95, count of multi-tick batches, count hitting the five-tick cap.
- Time in the `while (acc >= TICK_MS)` body vs time in Atlas publish vs time in React `setState` vs remainder (event/audio/juice). p50/p95.
- React `setFrame` / `setHud` counts (diagnostic only).
- Whether a window **would** have been bad; whether Stage 5/6 **would** have fired. **Do not apply** `reducedEffects` or the 2x cap during these three runs.
- Match wall-clock vs expected `processedTicks * TICK_MS / speed` (drift).
- A screen recording for continuity review (ordinary motion, a restart snap, one power if present).

A Release-safe, non-shipping probe is allowed for this phase (same class of guard as `DEVELOPER_MODE_AVAILABLE` / `release:check`). Metal HUD may supplement. `xctrace` frame-lifetime export is known-fragile on this project; do not block Phase 0 on it.

### 8.4 Decision gates (choose exactly one path)

| Measurement | Path |
|---|---|
| 3x already meets §11 in quiet and power-heavy windows | **Stop. Ship nothing.** |
| 1x and 2x meet §11; 3x fails; long frames correlate with React `setState` / parent render | Stage A, then re-measure |
| 1x and 2x meet §11; 3x fails; cost is overlays / juice / trails / VFX | Stage B, then re-measure |
| Both A and B implicated | A then B, re-measuring after each |
| 3x JS `tick` + `snapshotFrame` alone cannot hold 30 ticks/s (multi-tick cap saturating while publish/React are cheap) | Skip A/B. Stage C is the correct product answer: this device cannot present 3x |
| 1x or 2x also fail the bar | Out of scope of a 3x-only concession. File separately; do not strip 3x cosmetics to hide a 1x bug |
| Jumps with smooth RAF gaps | Continuity/retarget bug, not a concession problem. Fix retargeting; do not drop FX |

After each implemented stage, re-run the **same** fixture at all three speeds. Stop at the first pass.

## 9. Architecture

```
RAF (JS)
  drain accumulator at TICK_MS, ≤5 ticks
    tick(state)                 // every overdue tick; seeded; no Date.now / Math.random
    snapshotFrame               // renderer-only
    per-tick render refs (trails, shot tier, combo counts)
  ordered events → audio + haptics + effect records   // always, even if React is skipped
  publishAtlasFrame → retargetAtlasFrameOnUI          // one coherent UI-runtime job
  maybe setFrame (scene identity)
  maybe setHud (critical change or 10 Hz ordinary backstop)
UI runtime
  interpolate raw positions / ball height / visualTick
  Atlas + worklet overlays at display cadence
```

Invariants:

- Sim ring stays pure TypeScript. No React Native / Skia / Expo / `Math.random` / `Date.now` in `src/sim` or `src/game`.
- Atlas remains one batched draw. Never one component per sprite.
- Interpolation duration stays `TICK_MS / max(MIN_MATCH_PLAYBACK_RATE, speed)`. No 1.15× lag window.
- Do not switch to “at most one sim tick per RAF + visual debt.” That silently slows 3x when RAF cannot hit 30 callbacks/s. The five-tick cap already bounds stalls.
- Do not publish first-old to final-new shortcuts across skipped ticks. Intermediate sim ticks still run; the picture interpolates from the displayed raw pose to the latest snapshot, as today.

### 9.1 Affected code (expected)

| Area | Role |
|---|---|
| `src/render/MatchScreen.tsx` | RAF loop, publish vs React commit, 3x cosmetic flag, measurement probe hook, keep event/audio path |
| `src/render/match-performance.ts` | Unchanged thresholds; optional record-only export for Phase 0; do not accept 30 fps as good |
| `src/render/match-speed.ts` | Unchanged 1/2/3 rates |
| `src/render/worklet-atlas-frame.ts` | Preserve atomic retarget; no duration change |
| `src/render/match-vfx.ts`, `ProceduralMatchEffects.tsx`, `WorkletMatchOverlays.tsx`, `MatchTickerLine.tsx` | Stage B only, existing `reducedEffects` / secondary gates |
| `src/persistence/preferences-repository.ts` | `MatchPerformanceLimit` already `{ maxMatchSpeed: 2, 30-day TTL }`; no schema change unless a later spec revisits TTL |
| `App.tsx`, `SettingsOverlay.tsx` | Existing retry-3x path only |
| `src/sim/**` | Untouched |

## 10. Data

No new career fields. No replay envelope fields. No `ENGINE_VERSION` bump.

Persisted performance cap remains:

```ts
interface MatchPerformanceLimit {
  maxMatchSpeed: 2;
  reason: 'frame-pacing';
  setAt: number;
  expiresAt: number; // setAt + 30 days
}
```

`threeTimesCosmeticBudget` is live-speed presentation state, not preferences.

Phase 0 probe data is development/Release-check gated and must not ship in an App Store archive (`release:check` fails if left on, same idea as developer mode).

## 11. Physical-device acceptance

Normalize every gap to the inferred display interval from §2.3.

**Pass (Release, physical iPhone, same fixture):**

- 3x quiet and power-heavy 30 s windows: p95 RAF gap ≤ 1.25 display intervals **and** < 1% of gaps over two intervals. Same bar the shipping monitor uses.
- 1x and 2x still meet that bar (no regression).
- Ordinary locomotion has no positional pop on a frame-by-frame recording except authored snaps (kickoff, teleport, newly visible substitute/decoy).
- 3x wall-clock duration within a small catch-up bound of `simMs / 3` (the five-tick cap may absorb a stall; it must not become a permanent slower clock).
- Score, goals, powers, `FIRE!` / save window, pause, half-time speech, full-time handoff remain synchronized with the picture.
- Audio/haptics remain ordered and exactly-once through multi-tick batches.
- Reduce Motion still opts out of juice; it is not broken by the 3x budget.
- If Stage B shipped: 1x/2x still show the dropped secondaries; 3x does not drop primary power art or shot numbers.
- If Stage C fired: live speed is 2, notice shown, Settings retry clears the cap, and 3x can be attempted again.

**Not success by themselves:** React commit/s, HUD commit/s, or a web/Simulator FPS number.

## 12. Edge cases

- **Speed change mid-tick:** keep current `resumeAtlasFrame` unfinished-window behavior; reset pacing monitor; toggle Stage B with the new speed.
- **Pause / settings overlay / background:** skip presentation work as today; reset monitor; do not count lifecycle gaps.
- **Multi-tick catch-up:** process every tick; play every event in order in that JS turn (existing bunching is accepted); one Atlas publish; critical HUD flush if any critical field changed inside the batch.
- **Restart snap vs retarget:** snaps still hard-set; trails still clear; no sampling of the old pose.
- **MANUAL at 3x:** a dock that is late to `FIRE!` is a blocker even if RAF p95 passes.
- **Save-power window:** drain remains sim-time; presentation of the remaining bar is critical state.
- **Overlapping powers / four hero tiles:** Stage B may drop juice and secondary VFX; it may not drop the tiles or the authored effect.
- **Reduce Motion already on:** Stage B is a subset; do not double-disable into a blank pitch.
- **Adaptive cap already persisted:** 3x is hidden; this work must not re-offer 3x until retry or TTL.
- **Title card / half-time speech / cut-in pause:** clock held, not skipped.
- **Full time:** last frame must commit before unmount; existing hold and wasted-power drain unchanged.
- **Graphics restart path:** unchanged; not a 3x concession.
- **Thermal:** a hot 3x that trips Stage C on a phone that later holds 3x when cool is a known risk of the 30-day TTL; this spec does not silently shorten TTL.
- **Web / iPad / Android:** do not regress; native iPhone Release is the gate. Native weak-hardware hint stays false.

## 13. Tests (focused, headless)

Do **not** run the balance harness, managed-recovery soak, or large seed rails.

Must stay green without golden updates:

- `src/sim/__tests__/parity-replay.test.ts` (no snapshot update, no version bump).
- Existing `src/render/__tests__/worklet-atlas-retarget.test.ts`.
- `src/render/__tests__/match-performance.test.ts` (30 fps still **bad**; two+two window machine).
- `src/render/__tests__/match-speed.test.ts` and the “all three speeds from the first match” contract test.
- `src/render/__tests__/power-juice.test.ts` playback-rate and `suppressCosmeticEffects` wiring.
- Slide-tackle / VFX tests that name `reducedEffects`.

Add or extend (no device required):

1. **Pacing monitor:** still rejects 30 fps; still does not treat it as a 30 Hz panel.
2. **Stage A:** HUD snapshot equality skips `setHud` when only ordinary fields are unchanged; a score/goal/banner/`FIRE!` change still flushes; audio helpers are still invoked per event in a 2- and 5-tick catch-up fixture (source or unit, matching existing MatchScreen contract tests).
3. **Stage B:** 3x sets the cosmetic budget; 1x/2x do not; toggling 3 → 2 clears it unless adaptive `reducedEffects` or Reduce Motion is on; the 2x-cap decision still requires two bad windows **after** adaptive `reducedEffects`, even if the 3x budget is already on.
4. **Architecture:** extracted children (if Stage A opens the split) must not accept the mutable `match` object.
5. `npx tsc --noEmit` on the affected render files.

If Stage A/B never open because Phase 0 passes, do not add dead concession tests. Keep the measurement probe behind the release guard and a test that the guard defaults off.

## 14. Rollout

1. **PR 0 — Measure.** Probe + Phase 0 log on the physical Release iPhone. No product concession. `release:check` still fails if the probe is left enabled.
2. **PR 1 — Only the gated stage.** A or B or C as Phase 0 named. One concern per PR.
3. **PR 2 — Only if re-measure failed.** The next named stage.
4. Merge order is the stage order. Do not land B “while we wait” for A numbers.

Feature exposure is the existing speed control. No flag for players. Stage B is automatic at live 3x. Stage C is the existing persisted cap.

## 15. Rollback

- Revert the renderer PR. Retargeting and the pre-existing adaptive path stay.
- Clearing `performanceLimit` (Settings retry or TTL) restores 3x even if a build with Stage C shipped.
- Stage B has no persisted bit; revert restores 3x cosmetics immediately.
- Because `ENGINE_VERSION` and replays are untouched, old saves and old replays do not need migration.

## 16. Implementation order

1. Phase 0 on device (record-only).
2. Write the gate outcome into the PR description (table in §8.4).
3. Implement only that stage.
4. Focused tests + `tsc`.
5. Re-measure the same fixture at 1x/2x/3x on the same phone.
6. Stop or continue exactly as the table says.

The preferred shipped result is **no code** if 3x already passes, then Stage A, then Stage B, then the existing 2x cap. Not a new renderer.


<!-- END GROK 4.6 SPEC -->
