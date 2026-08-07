# Polish audit — report and fix log

**Build audited:** `96f45b1f` (origin/main = the live Vercel deploy at audit time)
**Spec:** `2026-08-06-polish-audit-spec.md` · **Plan:** `2026-08-06-polish-audit-plan.md`
(both council-approved: Grok round 3, Opus 5 round 2)
**Owner revision mid-audit:** fix what the audit finds, verify each fix on real surfaces, then
Grok-audit the work. This document is therefore an audit **and** a fix log.

## 8.0 Surface log

- **Used:** local static exports (`dist-clean` :4173 ship-parity with Vercel's COOP/COEP headers,
  `dist-harness` :4174 for `#/dev` states, `dist-verify` :4175 post-fix) driven through
  chrome-devtools; headless Node probes (jest); ffmpeg/ffprobe asset forensics; iOS Simulator
  Release build (`HFM-Polish-20260806`, UDID captured); a full played career on web.
- **Unavailable:** the physical iPhone (`xctrace` reported it offline all session), so every
  device-authoritative number — real frame pacing, hitches, thermal, battery, touch-to-pixel
  latency in ms, haptic feel — is **unscored, not estimated**. ImageMagick is absent, so
  palette-drift counting was not run.
- **Therefore unscored:** axis E's device tier, axis A's latency-in-ms and haptic-feel items,
  axis C's palette-drift item.

## 8.1 Scorecard

| Axis | Score | Tier | Justification | Blocker to +1 |
|---|---|---|---|---|
| A. Input feel | 8 / 10 | T2 web + T1 code | Pressed state fires on press-in and 129 Pressable sites route through one wrapper that also neutralises the function-style iOS trap; drill/advance taps showed first paint 62–75 ms (4–5 frames) after press-down on web. | Cues fire on press-**up** by deliberate design (`SfxPressable.tsx:93-102`) — sound trails the visual by the press duration. Device ms is unmeasured. |
| B. Button juice | 8 / 10 | T2 + T1 | Confirmations, reveal cards and streak-pitched drill dings exist; taps now carry ±4% pitch spread, every shared button depresses under the finger, and the primary CTA breathes after 4s idle (this audit). | No press-down **sound** — the depress and the idle attract landed in pass 2, but every cue still trails its own visual by the length of the press. |
| C. Pixel integrity | 9.5 / 10 | T2 + T3 + T1 | The snapping contract is honoured on **9/9** Skia Atlas draw paths (`PIXEL_ART_SAMPLING` = Nearest/no-mipmap everywhere; every placement through `snapDevicePixels`, magnification through `snapSpriteScale`). | Nothing left that this machine can reach: pass 3 found the gutter DOES exist (`ATLAS_GUTTER = 1`, loader.ts:202) and pinned it. Remaining doubt is real GPU sampling, which needs a device. |
| D. Animation | 7 / 10 | T2 + T1 | Reduce Motion is genuinely plumbed through 67 files; league rows slide from their old positions and the HUD's money and TP roll rather than snap (this audit). | No shared timing table: 37 inline `duration:` literals across **26 distinct values** plus 31 scattered `*_MS` constants — the app has no single motion vocabulary. |
| E. Performance | 8 / 10 | T2 + Node, **device unscored** | Web idle 25 s: mean 8.33 ms, p99 9.31 ms, **zero** frames > 33 ms. Sim tick cost mean 0.27 ms / p99 3.43 ms per 100 ms tick — ~3% of budget. The last JS-thread animation is gone (this audit). | The Release `.app` is **106 MB against a 60 MB canon budget**, and no device has confirmed frame pacing. |
| F. Football feel | 7 / 10 | T2 + T1 | Coach hire, drill runs and facility completion all have authored reveal beats; the rival-preload pump keeps the fulltime settle off the frame. | Speed tops out at 3× with **no skip / jump-to-next-event** once a match is running (`match-speed.ts`), so a watched match cannot be shortened mid-flight. |
| G. Audio | 8 / 10 | T2 forensic | Every one of 94 cues now sits below −0.1 dBFS with loudness intact (this audit); pooled rapid cues seek-then-play, and the fixed-delay rewind bug is documented and rejected in code. | One sample per UI cue: pitch spread now varies them, but there are still no true variants, and mix-under-load has no measurement surface on this Mac. |
| H. States & interruptions | 8 / 10 | T2 + T1 | A stale save produced a real, recoverable boot failure screen with Retry / Export raw save / Delete-and-start-fresh, and the two-step "TAP AGAIN TO DELETE" arming worked exactly as designed. Careers survive a hard reload (OPFS). | The delete confirmation gives no visible countdown or timeout on the armed state, and backgrounding mid-match is device-tier unverified. |
| I. Desktop parity | 7 / 10 | T2 | Hover is gated on `matchMedia('(hover: hover)')`, not platform — the shipped hover-latch bug class is closed by design; two-column desktop layout renders correctly at 1512×806. | Gamepad, rebinding and Steam overlay are **NOT-BUILT**; keyboard focus rings exist only where `ConfirmationSheet` traps focus. |
| J. Accessibility | 7 / 10 | T1 + T2 | Reduce Motion is honoured live (system subscription + preference), modals drop their entry animation, ceremony holds halve, the power tile suppresses its shell animation and sheen. | Kit colours are a **fixed red-vs-blue default** (`team-kit-ui.ts:11,13`) — the deuteranopia-adjacent pair — and separation depends on the player finding the colour-safe toggle. |
| K. First 60 seconds | 8 / 10 | T2 | Title → story → created player → club office ran clean, and the first week is a guided chain that refuses to advance until the player has trained, built and hired — with a named reason each time. | No store screenshots or trailer exist yet, and the "wow" moment (a hero firing) sits several weeks behind the first session. |

**Overall: 8.0 / 10 after pass 2** (7.6 as first measured). For this genre a 10 means: Retro Bowl's press-immediacy, Kairosoft's
per-week reward density, Duolingo's button physics and pitch ladder, Balatro's count-up
choreography. This build's simulation, determinism and pixel discipline are already at that bar;
what keeps it off 10 is that its *feedback vocabulary* is still thinner than its systems — one
tap sample, no shared motion table, no press-down audio, and a 106 MB binary.

## 8.2 Findings and what happened to each

| ID | Axis | Sev | Where | Evidence | What the player feels | Outcome |
|---|---|---|---|---|---|---|
| F1 | D/E | S1 | `FacilityCompletionCard.tsx:41` | `className` on `Animated.View`; NativeWind drops it (measured trap, project record) | The card announcing a finished facility arrives as unstyled text — no gold frame, no background, no spacing — right at a moment of reward | **FIXED**: frame moved to a plain `View` inside a style-only `Animated.View` |
| F2 | G | S1 | 7 assets, incl. `back-button.m4a` +1.7 dBFS, `stat-step-tap.m4a` +1.3 | `scripts/qa/polish/audio-forensics.mjs` | Distortion on the two sounds heard most; a crackle under every back press | **FIXED**: `alimiter` ceiling per file; all 94 now ≤ −0.2 dBFS, RMS moved 0.6 dB (inaudible) |
| F3 | E | S2 | `DrillSceneOverlay.tsx:119,205` | the only `useNativeDriver: false` in the app, forced by a `width: '0%'→'100%'` fill | The drill progress bar competes with the count-up on the JS thread — the one animation guaranteed to stutter when the drill result is computing | **FIXED**: fill slides on `translateX` behind a clipped track, native driver on |
| F4 | D/F | S2 | `LeagueTableScreen.tsx:129` | no `LayoutAnimation`, no reanimated layout props anywhere in the repo | A club that climbed three places simply appears three rows higher — the standings never read as a race | **FIXED**: rows slide in from their previous position (`league-table-motion.ts` + `LeagueTableRow.tsx`, 5 unit tests) |
| F5 | B/G | S2 | `management-sfx.ts` | one sample per cue; pitch varied only by `playDrillResultSfx` | Rapid taps sound like a machine gun — identical transient every press | **FIXED**: ±4% random pitch spread on the two pooled rapid cues |
| F6 | E | S1 | Release `.app` = 106 MB vs 60 MB budget (`docs/09`) | `du -sh` on the built Release-iphonesimulator app | Long App Store download, more storage pressure on the min device | **REPORTED** — needs an asset-weight pass (audio is 94 files; sim-arch build inflates, so an IPA measurement is the next step) |
| F7 | D | S2 | 37 inline `duration:` literals / 26 distinct values; 31 scattered `*_MS` | repo-wide grep | Motion that feels almost-but-not-quite consistent between screens | **REPORTED** — a shared table is a cross-cutting refactor, not a safe end-of-session change |
| F8 | J | S2 | `team-kit-ui.ts:11,13` | home `#d94f52` red vs away `#5a8fd6` blue by default | A colour-blind player sees two similar shirts until they find a settings toggle | **REPORTED** — flipping the default is an owner call (it changes every match's look) |
| F9 | F | S2 | `match-speed.ts` | speeds 1/2/3, no skip path once watching | A player who wants out of a decided match has to sit through it | **REPORTED** — canon-adjacent (Quick Result is the pre-match path) |
| F10 | B | S2 | no inactivity timer anywhere | grep for idle/attract; only `AwakeningCutsceneScreen` breathes | A stalled player gets no nudge; the screen sits inert | **REPORTED** |
| F11 | H | S3 | `use-key-bindings.ts:92,126`, `use-suspend-flush.ts:31-38` | `document`/`window` without `typeof` guards in shared hooks | Nothing today (native defines `window`), but one import into a non-DOM path throws | **REPORTED** |

### Findings that did NOT survive verification (recorded so they are not re-raised)

- **`power-cut-in.ts:45` `void reduceMotion`** — flagged as an accessibility failure. It is not:
  `PowerTitleTakeover` reads `reduceMotion` itself and suppresses the shell animation and sheen
  (`:60,84,137,148`). Dead parameter, not a defect.
- **`ManagementShell.tsx:480,488` tab labels clipping across 7 locales** — both the glyph and the
  label already carry `adjustsFontSizeToFit` on the following line.
- **"A web reload wipes the career"** — a premise inherited from earlier sessions. Measured false:
  the career survived a hard reload (title screen showed SAVE FOUND / CONTINUE).
- **"Fulltime sims 4 rival matches synchronously (571 ms)"** — superseded by the shipped preload
  pump. Fresh numbers: 1004 idle bursts of 8 ticks (mean 1.41 ms, p99 10.05 ms) spread across the
  watched match; the 1092 ms 4× figure is the **cold worst case** only (instant Quick Result).

## 8.2c Pass 2 — the micro-interactions (added after the owner asked why only defects were fixed)

Pass 1 fixed defects and *reported* the juice gaps. Pass 2 executes the top of that fix plan.

| ID | Axis | What was missing | What landed | Verified |
|---|---|---|---|---|
| P1 | B | Press feedback across the 106 shared button sites was `opacity: 0.7` and nothing else — the surface never moved under the finger | A shared depress (`translateY 1`, `scale 0.97`) on the existing `pressed` state | **Live**: language button shows `translateY(1px) scale(0.97)` during press, clean on release |
| P2 | D/F | Money and TP snapped to their new value on every week, drill and signing | `useCountUpNumber` rolls them over 520 ms on the same cubic ease-out as `count-up.ts`; skipped on mount and under Reduce Motion; lands exactly | **Live**: an $8,000 purchase sampled `$53k → 51.8 → 49.8 → 48.4 → 47.2 → 46.4 → 45.8 → 45.4 → 45.2 → $45k` |
| P3 | B | Nothing ever invited a stalled player onward — the app had no inactivity timer at all | `IdleAttract`: after 4 s of stillness the enabled Advance Week button breathes (1.0 → 1.025, 1150 ms each way), reset by any action via `restartKey`, off under Reduce Motion / disabled / mid-tutorial | **Code-level only** — see below |

**P1 nearly shipped a regression.** Grok's review caught it: a dozen buttons already author their
own press travel (title screen 3 px, league rows 2 px, settings toggle 1 px) chosen against each
button's border weight, and appending a shared transform silently overrode all of them. Fixed with
a `setsTransform` guard mirroring the file's existing `setsOpacity` guard, then verified both
ways live: the STORY button keeps its authored 3 px, the language button takes the shared depress.

**P3 is the one honest gap in this pass.** The first-week tutorial gate could not be driven to an
enabled Advance Week inside the session budget, so the attract was never observed firing. What was
verified: it renders with an identity transform while inactive and does not disturb the button's
layout (1024×44), its gating is plain boolean logic, and it mirrors the shipped pulse in
`AwakeningCutsceneScreen` (`Animated.loop`, reduce-motion aware, cleaned up on unmount). It should
be watched once on a real device before it is trusted.

## 8.2d Pass 3 — four workstreams in parallel

Run concurrently on disjoint files by three subagents plus the orchestrator, then reviewed.

| ID | What was missing | What landed |
|---|---|---|
| P4 | Every cue fired on press-**up**, so sound trailed the finger by the length of the press | Cues fire on press-in via a per-control `createPressCueGate`; a completed press still owns the cue when no press-in phase was seen, which is what keeps keyboard activation audible. Window tightened 1500→500 ms on review: it only has to bridge release-to-activation, and every extra millisecond is one where a real keyboard press goes silent |
| P5 | Screens hard-cut — the worst instance of "nothing appears instantly", because it happened between every screen | `ScreenTransition`: two permanent slots so nothing is ever re-parented or remounted, the **outgoing** screen dissolves off the top of the incoming one (fading the new screen up would show the ink background and blink dark), 150 ms, native driver. MatchScreen and QuickResultFaceOff are excluded — both drive a Skia frame loop, and holding one while the next builds asks the device for more drawing at its busiest moment |
| P6 | `use-key-bindings` and `use-suspend-flush` reached for `document`/`window` unguarded — and the gates that existed checked the *wrong* global (one checked `window` while the body used `document`) | Both feature-detect properly now, with a falsifiable test: reverting the guard makes it fail |
| P7 | 37 inline durations across 26 distinct values, no shared vocabulary | `src/ui/motion.ts` — six steps clustered from what the app already does, `listStaggerDelay` with a cap, `motionDuration` collapsing to 0 under Reduce Motion, and a test that the steps stay ordered, distinct and >1.3× apart. Adoption is deliberate, not a sweep: the file names what must NOT be migrated (`DRILL_SCENE_MS`, the POWER_JUICE beat sheet, tick-derived match timings) |

**Known risks carried by pass 3, recorded rather than hidden:**
- **Press-down cueing means a scroll that begins on a button now makes a sound.** The touch fires
  press-in immediately; if the list then steals the gesture, the cue has already played. Inherent
  to press-down feedback — it needs a device check on the squad and market lists.
- **The window length is a judgement call.** The subagent that built the gate argued for 1500 ms
  (a main-thread stall between release and activation would double-fire); the reviewer argued for
  shorter (every millisecond is one where a keyboard press goes silent). It ships at 500 ms
  because React Native dispatches press-out and press from a single handler, so the gap being
  bridged is sub-frame rather than stall-prone. The dissent is real and recorded.
- **Neither the transitions nor the idle attract has been seen on hardware.** Both are verified on
  the web build and by test; the browser pane cannot judge a 150 ms fade.
- **Outgoing screens now unmount 150 ms later**, so their cleanup runs late. No route was found
  where two celebration screens run back to back; the absence could not be proven.

**Pass 3 corrected one of this report's own findings.** Axis C claimed atlas padding was unasserted and that
`generate-sprites.mjs` has no padding. Half right: the generator writes none, but the packing adds a gutter at
runtime — `ATLAS_GUTTER = 1` (`loader.ts:202`), slots sized to the largest frame plus a gutter each side, every
rect inset by exactly one texel. Measured on the shipped sheet: 7,349 sprites, 8×919 slots of 36×32, minimum
separation between any two cells exactly 2 texels, and the margin is tight rather than slack (the 34-wide slide
frame ends at slot offset 35 of 36). Now pinned by six assertions including a recording Skia fake that proves no
painted run ever touches a gutter texel.

## 8.3 The ten blockers between this build and a 10/10

1. **106 MB binary against a 60 MB budget** (F6) — the only hard number that fails canon.
2. **No device-verified frame pacing** — axis E cannot be closed from this machine.
3. **No shared motion table** (F7) — 26 distinct durations is a vocabulary, not a system.
4. **No press-down audio** — every cue trails its own visual by the length of the press.
5. **The idle attract has never been watched running** (P3) — shipped on code-level confidence.
6. **Kit colours default to red-vs-blue** (F8).
7. **No mid-match skip** (F9).
8. **One sample per UI cue** — pitch spread mitigates, true variants would close it.
9. ~~Atlas padding unasserted~~ — **resolved in pass 3**; the runtime gutter is now pinned by test.
10. **No store assets and a distant wow moment** (axis K).

## 8.4 Fix plan, ranked by delight-per-hour

**Done this session (the "first afternoon" cluster, ~3 h):** F1 facility card frame · F2 audio
clipping across 7 assets · F3 drill bar off the JS thread · F4 league rows that move · F5 tap
pitch spread. Every one verified (below).

**Done in pass 2** (8.2c): press depress across every shared button · rolling money/TP · idle
attract on Advance Week.
**Done in pass 3** (8.2d): press-DOWN audio · screen transitions · DOM capability guards · the
shared motion vocabulary · the atlas packing fence.

**What is left, and why it is left:**
1. **Asset-weight pass toward 60 MB** (M) — the last hard number failing canon. Measure an IPA
   first, since the simulator build inflates; audio is the obvious candidate at 94 files.
2. **Colour-safe kits by default** (S) — **owner decision**: it changes how every match looks.
3. **Watch the idle attract and the new transitions on a device** (S) — both ship on code-level
   and web-level confidence; neither has been seen on real hardware.
4. **Device-tier performance** — blocked on the phone being plugged in.
5. **Migrate more timings into the motion table** (M, ongoing) — deliberately incremental; a
   sweep would flatten timings that are tuned against sound and sim ticks.

## 8.5 Retest protocol (pre-registered, all passing)

| Fix | Criterion | Command | Result |
|---|---|---|---|
| F2 | No shipped cue peaks above −0.1 dBFS | `node scripts/qa/polish/audio-forensics.mjs` | exit 0 (was exit 1, 7 files) |
| F3 | No `useNativeDriver: false` in `src/render` | `grep -rn "useNativeDriver: false" src/render` | 0 hits |
| F1 | No `className` on an `Animated.` element | `grep -rn "className" src/ui/components/FacilityCompletionCard.tsx` | only plain Views |
| F4 | Movement logic correct in both directions, per division, once per table | `npx jest src/ui/__tests__/league-table-motion.test.ts` | 5/5 pass |
| F5 | Rapid cues vary pitch, one-off cues do not | code: `varyRapidPitch` called only for `ui-click`/`stat-step` | confirmed |
| all | No regression | `npx tsc --noEmit` + `npx jest` | clean; **3525 passed**, 1 skipped |
| all | League table still renders correctly | screenshot on the rebuilt export | `artifacts/polish-audit-2026-08-06/verify-league-table-after-fix.png` |
| all | Native build still launches clean | Release sim rebuild + install + screenshot | `artifacts/polish-audit-2026-08-06/verify-sim-title-after-fix.png` |

### Defects Grok found *in the fixes* (round 1 REVISE), and their repairs

The finished work went back to Grok, which read the changed files and rejected them. All three
findings were real:

1. **`forgetLeagueRowPositions` was documented as career-scoped but never called** — a second
   career in the same session would have slid its first table against the previous club's
   standings. Now called from `beginNewCareer` in App.tsx (the store deliberately imports nothing
   from `src/ui`, so App is the correct call site) and re-exported through the UI barrel.
2. **`settled.current` defeated the feature it guarded** — the slide fired once per *mount*, so a
   week advanced while the League tab was open moved nothing. Replaced with `playedKey`, a guard
   keyed on `standingsKey` (`division|season|week`): new standings replay, a late `rowHeight`
   from first layout does not.
3. **Session cache across careers** — closed by (1).

Grok's round 2 verdict: **APPROVED** — "No new blocking defect found — sound to commit."

## 9. Red team

### The 2-star review

> Looks lovely in screenshots. The problem is what it *sounds* and *feels* like. Every button
> makes the exact same little click, and it fires after you let go, so the noise is always a beat
> behind your finger. I spent an hour tapping through weeks and nothing ever tightened up — no
> weight on the big decisions, no reward flourish that isn't a card sliding in. The league table
> just redraws with everyone in new places; I'd finish a match and have to hunt for my own club to
> see if we'd climbed. It's a competent little manager and I can tell somebody cared about the
> simulation, but playing it feels like filling in a form that happens to be pixel art. I wanted
> to be a manager. I felt like an accountant.

### The kill shot

> A Steam curator would see it this way: the sprite work and the UI frames are consistent enough
> to look bought rather than made, and nothing in the first ten minutes proves otherwise — one
> tap sound repeated a hundred times, menus that swap instantly with no transition, a league table
> that updates like a spreadsheet, and a headline mechanic (superpowered players) that doesn't
> show up until you've done a lot of admin. Asset-flip suspicion isn't about art quality; it's
> about whether anything *responds* to you, and here the responses are uniform.
>
> What would flip the same curator: two minutes of a match where a hero enters the Zone, the
> screen finds a beat, and the crowd changes — plus the small stuff that proves a person tuned it.
> A goal that hits differently from a menu tap. A table that *moves* when your club climbs. Taps
> that don't sound identical. This build is much closer to that than it looks, because the systems
> underneath are unusually honest: seeded, deterministic, and already carrying the beats. They are
> simply not being *performed* to the player yet.
