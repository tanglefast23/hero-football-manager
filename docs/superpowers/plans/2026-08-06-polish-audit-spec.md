# Polish audit — adversarial 10/10 review — spec (tailored to this repo)

**Date:** 2026-08-06 (revised 2026-08-07 after review round 1)
**Build under test:** `96f45b1f` (origin/main tip = this worktree's HEAD after fast-forward =
what Vercel deploys). The worktree was cut at `aed2bc78`; main advanced two commits (i18n
phase-5 catalogs + a UI/report fix, zero `src/sim`/`src/game` changes), so the audit branch was
fast-forwarded to stay aligned. The shared main FOLDER may lag or lead this commit at any time —
it is read-only to this audit.
**Source:** owner-supplied "POLISH AUDIT — ADVERSARIAL 10/10 REVIEW" prompt, retargeted from its
generic template (Godot/Unity/SwiftUI assumptions) to what this project actually is. Where the
template and the codebase disagreed, the codebase won — per the template's own rule 7.
**Execution plan:** `2026-08-06-polish-audit-plan.md` (same directory).
**Report lands at:** `docs/superpowers/plans/2026-08-06-polish-audit-report.md`.

## What the template got wrong about this project (corrections applied)

| Template assumption | Reality here | Consequence for the audit |
|---|---|---|
| Godot/Unity/SpriteKit engine, GDScript/C#/Swift | Expo SDK 57 / React Native 0.86 / TypeScript; match canvas is react-native-skia 2.6.2 (Atlas batched API); animation driver is react-native-reanimated 4.5 + worklets; styling is NativeWind 4 | §6 grep list fully rewritten for this stack; engine-specific checks (filter modes, mipmaps, `_process` allocation) replaced by their RN/Skia equivalents |
| "320×180 virtual res, integer-scaled" | No virtual resolution exists. Contract = dp-space RN layout + Skia canvas; draw positions snapped to whole **device pixels** (`snapDevicePixels`, `src/render/pixel-grid.ts`); sprite magnification snapped to integer texels-per-device-pixel (`snapSpriteScale`, `src/render/interpolate.ts`); pixel fonts Silkscreen/Handjet | Axis C audits the snapping contract that actually ships, not a fictional canvas scale |
| `npm run dev` / `expo start --web` as the web surface | The Expo web dev server hangs in this repo (measured 2026-07). The working web surface is the **static export**: `npm run export:web` → serve `dist/` | Toolkit §7 uses the export recipe; no one waits on a dev server that never boots |
| Metro perf overlay as a free diagnosis surface | Port 8081 is reserved for Joe's physical phone (`scripts/phone-dev-server.sh`); Claude-session Metro servers get reaped; the sim build we can make cheaply is **Release** (no perf overlay) | JS-thread cost is measured on the headless Node surface instead (the sim/game rings are pure TS); Metro/Hermes profiling is an escalation, not a default |
| Steam build exists to test | No Steam/Electron build exists yet — decided direction, not built. Desktop today = the web build's two-column layout (shipped for all 5 tabs) | Axis I audits desktop-web as the Steam precursor; gamepad/rebinding marked NOT-BUILT, not scored 0 |
| `Animated.timing` + `useNativeDriver` as the animation smell | The codebase animates with Reanimated 4 worklets; legacy `Animated` may appear only incidentally | Grep list checks both, plus the project's own measured traps (function-style Pressable, `className` on Animated) |
| ProMotion 120fps target | Canon budget (docs/09) is **60fps match on iPhone 12-class, cold start < 2s, app < 60MB** | Axis E scores against canon; 120 on ProMotion noted as stretch, never as a failure |

---

## 0. Context (verified against the repo, not guessed)

```
GAME:            Hero Football Manager
GENRE:           Kairosoft-style pixel-art football (soccer) management sim with superpowered players
ENGINE:          Expo SDK 57 / React Native 0.86; match canvas @shopify/react-native-skia 2.6.2
                 (Atlas batched API — never per-sprite components); react-native-reanimated 4.5.0
                 + react-native-worklets 0.10; NativeWind 4; zustand; expo-sqlite persistence;
                 expo-audio + expo-haptics
LANGUAGE:        TypeScript (~6.0). src/sim + src/game are pure TS: no RN/Skia/Expo imports,
                 no Math.random/Date.now — seeded mulberry32 injected. ENGINE_VERSION 'm2.1'.
REPO ROOT:       /Users/joemacprom5/Documents/Vibecode/Hero_Football_Manager
                 (audit executes in worktree .claude/worktrees/contract-renewal-audit-1be55f,
                  branch claude/polish-audit-plan-d7cfff at 96f45b1f. Worktrees carry no ios/
                  project; the native sim build uses the worktree build recipe — ios/ and
                  node_modules are rsync'd OUT of the main folder (read-only extraction), and
                  the main folder itself is never modified, never built in, never
                  pod-installed in)
PRIMARY TARGET:  iOS (iPhone), portrait, paid ~$0.99; supportsTablet true
SECONDARY:       Web (Vercel; iPad home-screen PWA audited separately 2026-08-06);
                 Steam via Electron planned, NOT built
MIN DEVICE:      iPhone 12-class (docs/09 performance budget: 60fps match, cold start < 2s,
                 app < 60MB)
PIXEL CONTRACT:  no virtual res — device-pixel snapping (src/render/pixel-grid.ts) +
                 integer sprite magnification (snapSpriteScale); sim ticks TICK_MS=100
                 interpolated to 60fps; pixel fonts Silkscreen (Latin-1) + Handjet
BUILD UNDER TEST: 96f45b1f (feat(i18n): the long tail — Phase 5, #100)
SHIP DATE:       unset (pre-TestFlight polish window)

--- OBSERVATION SURFACES ---
WEB BUILD (VERCEL):  https://hero-football-manager.vercel.app  (auto-deploys main; same commit)
LOCAL WEB:           npm run export:web  →  npx serve dist -l 4173   (NEVER expo start --web)
METRO / BUNDLER:     port 8081 FORBIDDEN (Joe's phone). Any audit Metro uses 8082+; default is
                     none — the Release sim build embeds its bundle.
XCODE PROJECT:       <main folder>/ios/HeroFootballManager.xcworkspace
BUNDLE ID:           com.tanglefast.herofootballmanager
SIM DEVICES:         iPhone 17 Pro Max / iPhone 17 / iPhone 17e / iPad Pro 11-inch (M5), iOS 26.5
                     (no SE-class simulator installed; 17e is the smallest available)
PHYSICAL DEVICE:     Joe's iPhone, UDID 00008140-001C35291AE3001C — OFFLINE at audit start
                     (xctrace lists it under "Devices Offline"). Axis E device tier is blocked
                     until it is plugged in AND Joe approves an xctrace run.
COMPUTER USE:        authorized via the computer-use MCP (request_access per app). Off limits:
                     personal apps (Mail/Messages/etc.), anything involving money or credentials.
                     Browsers are read-tier — web driving goes through claude-in-chrome or
                     chrome-devtools instead.
DEEP LINKS / DEBUG:  web hash routes — #/dev (harness menu), #/dev/<entry>/<case> cold-loads an
                     exact authored state (awards-ceremony, fulltime-report, financial-report,
                     promotion-transition, endgame, board-ultimatum, cup-*, player-requests,
                     club-business, career-events, retirement-legacy, hall-of-fame, …).
                     GATED AT BUILD TIME (App.tsx:250–253, src/ui/release-surface.ts):
                     qaRootRoutesEnabled = isDev || platform === 'web', AND
                     process.env.EXPO_PUBLIC_DEV_HARNESS === '1' inlined at export. So:
                     · Vercel / a plain export: #/dev is DEAD — the audit builds a second,
                       harness-enabled export for state addressing and keeps the clean export
                       for perf + ship parity. The harness flag makes DevHarnessApp the ROOT
                       of that second build: authored stills only, NO playable game inside.
                     · Native Release: the harness NEVER mounts — sim states are reached by
                       playing (seeded career), and authored-state evidence is web-tier.
                     Sim/game rings accept fixed seeds headlessly. No query-param flags exist.
LOCALE UNDER TEST:   en (seven locales ship; localized-layout overflow is in scope as a spot
                     check, not a full re-audit per locale)
```

---

## 1. Your role

Three hostile reviewers at once:

1. **A game-feel director** who shipped an Apple Design Award winner and thinks this build is
   embarrassing.
2. **A pixel-art purist** who can spot a broken snap or a mixed density from across the room.
3. **A performance engineer** who treats a single 34ms frame as a shipped bug.

Not a collaborator — the person who tells the team the truth six weeks before launch, when it
still costs something to fix.

**Prior assumption: this game is a 6/10 that its creator believes is a 9/10.** Prove where the
missing points hide. If an axis is genuinely excellent, justify it with specific evidence against
a named exemplar — for this genre the bar is: Retro Bowl's touch immediacy, Kairosoft's pacing
density, Duolingo's button physics, Balatro's score choreography. Not vibes.

---

## 2. Hard rules

1. **Every finding cites evidence.** `file:line`, harness address (`#/dev/...`), or capture
   frame/timestamp. No evidence = mark `[UNVERIFIED]` with the exact command/capture needed.
   Never present a guess as a finding.
2. **Banned words in findings:** great, polished, solid, nice, clean, looks good, feels good,
   smooth (unless measured). Describe the mechanism instead.
3. **Quota:** minimum 5 severity-S2-or-worse findings per axis in §5. If an axis can't reach 5,
   write one paragraph proving why it is clean, with evidence.
4. **Player-felt phrasing.** Each finding states what the player feels, not just what the code
   does.
5. **No fix without a cost.** Every fix gets S/M/L effort and a delight-per-hour rank.
6. **No fixes during the audit.** Audit → complete report → wait for approval. Exception:
   throwaway measurement scripts and the committed QA harnesses named in the plan.
7. If the codebase contradicts this spec, trust the codebase and flag the contradiction.
8. **"I can't observe this" is not an excuse.** `[UNVERIFIED]` is only acceptable after actually
   trying the relevant surface — say which one, what ran, and what unblocks it.
9. **Canon fence.** These are owner-locked decisions, not defects: powers fire automatically
   (85% in-context; no manual hero tap, no M/A toggle); the Zone holds until context with no
   countdown/refund; the opener's +5 rigged difficulty; the crafted hero's 1-season contract;
   fail-soft economy (warnings → loan → forced sale, never game over); Money + TP only;
   "never show the player a penalty" copy rule; light-only UI (`userInterfaceStyle: light`);
   Quick Result resolves via the same engine. A finding that collides with canon goes in the
   report's **canon pushback** table — the feel cost may still be argued, but it must name the
   decision it pushes against. It does not count toward the §3 quota.
10. **Docs are canon; research/ is reference.** README decision log + docs/01–10 settle disputes.
11. **Known-and-deferred defects still count — but measure what ships NOW.** The recorded
    fulltime freeze ("fulltime sims 4 rival matches synchronously"; project record 2026-07-27:
    571ms Node / ~2s device) predates the rival-preload pump that ships today:
    `src/ui/use-rival-preload.ts` (live at App.tsx:1632) chunk-advances rival fixtures during
    the watched match via `createFixtureResolver` (`src/game/matchday.ts:135`), and
    `matchday.ts:334` falls back to synchronous `quickResultForFixture` ONLY for fixtures the
    pump didn't finish. This audit therefore measures: pump per-burst cost (8 ticks/burst),
    pump completion across a watched match vs an instant Quick Result, the residual
    synchronous settle with a partially-filled cache, and the 4× cold path — the last labeled
    COLD-WORST-CASE, never presented as the typical player experience. KNOWN-DEFERRED applies
    only if the residual is still player-felt. Same discipline for any other deferred item
    the audit re-encounters: re-verify the premise before re-reporting it.

---

## 3. Your eyes and ears

Use the cheapest surface that can answer the question; never claim a verdict a surface can't
support.

### 3.1 Surfaces available

**A. Static web export (local `dist/` + Vercel).** The workhorse. Faithful for: layout at any
viewport, easing shape/duration (CDP Animation domain + code), pixel snapping (PNG screenshots),
states via `#/dev/...` addresses, hover/keyboard/cursor for the desktop path. Not faithful for:
native frame rate, thermal, haptics, iOS gestures. **Measured traps that govern its use:**
- The in-app browser pane is 0-width and `document.hidden` between tool calls: it forces the
  phone layout, freezes RAF (animations park at an endpoint), and pauses audio. Frametime
  records must run the hidden-guard RAF recorder (plan, Task 3) — a record with
  `hiddenFrames > 0` is invalid. Desktop-layout and anything timing-visual runs in real Chrome
  (claude-in-chrome) or the chrome-devtools MCP with a real viewport.
- RNW Pressables ignore bare `click()`; drive them with full
  `pointerdown → pointerup → click` synthetic sequences (cheap, headless, proven 2026-08-06).
- Web careers are designed to persist (SQLite over OPFS, `src/persistence/persistent-storage.ts`,
  with `requestPersistentStorage()` at boot), and static exports ship a save/load slot rail
  (`DEVELOPER_MODE_AVAILABLE = true`, `src/ui/release-surface.ts:28`) for holding mid-career
  states. VERIFY empirically at Phase 0 (play → hard reload → survived?) before relying on
  it; only if persistence fails does a live career become expensive state to be batched.
- Mute on load, every time: `document.querySelectorAll('audio,video').forEach(el => el.muted = true)`.

**B. iOS Simulator (`xcrun simctl`).** Truth for layout across device sizes, safe areas, state
coverage, native transitions, screenshots at native res, choreography captures. **Never a perf
authority** — no FPS number from a simulator enters the report. Build = Release-iphonesimulator
via the worktree recipe in §7.2 (`ios/` rsync'd out of the read-only main folder, built from
the worktree at 96f45b1f, embeds its bundle, needs no Metro). PNG (`simctl io booted
screenshot --type=png`) for pixel judgments; HEVC recordVideo for choreography and dead-frame
counts only — compressed video never judges pixel color.

**C. Headless Node (jest probes).** `src/sim` + `src/game` are pure TS — deterministic,
seed-reproducible, and runnable at scale. AUTHORITATIVE for: JS cost of sim work the UI thread
must absorb (order-of-magnitude honest: 571ms Node was ~2s on device for the same path), save
integrity via scripted kill/reload, RNG reproducibility, balance/economy claims. The repo's
established probe pattern is `src/audit/__tests__/*-probe.test.ts` run via `npm run test:probe`.

**D. Physical device + Instruments (`xctrace`).** The only authority on frame pacing, hitches,
thermal, battery, memory-over-time, touch latency, haptic feel. **Offline at audit start.**
Everything device-only is pre-registered `[UNVERIFIED-DEVICE]` with the exact unblock: plug the
phone in, get approval, run the Animation Hitches template. No simulator or web number may be
dressed up as a device number.

**E. Real Chrome (claude-in-chrome / chrome-devtools MCP).** Desktop truth: two-column layout at
1280×800 and 1440p, hover states (a hover-gating bug class shipped and was fixed 2026-08-05 —
look for siblings), cursor, keyboard nav, focus rings, DevTools performance traces, console and
network. Mute on load; close tabs when done.

**F. Frame and asset forensics (`ffmpeg`, ImageMagick, `ffprobe`).** Any capture becomes data:
mpdecimate finds dead frames; tblend difference spikes mark the real visual response moment;
`magick -format %k` counts palette per sprite. **Audio truth is file-level:** astats
peak/RMS/clipping and spectrograms run directly on `assets/audio/**` (94 files) — no loopback
device exists on this Mac, so mix-under-load and duck-timing are code-read + single-listen
territory, labeled as such.

### 3.2 Authority matrix — which surface may decide what

| Question | Authoritative | Never accept from |
|---|---|---|
| FPS, p99 frame time, hitches, thermal, battery | Device + xctrace (OFFLINE → unscored, say so) | Simulator, web, "feels fine" |
| Touch-to-pixel latency (ms), haptic feel | Device + 240fps capture (OFFLINE → unscored) | Simulator, code read |
| JS cost of sim/game work (ms, relative) | Headless Node probes, fixed seed | Eyeballing, sim video |
| Web frame pacing, long tasks | chrome-devtools trace + hidden-guarded RAF recorder | Browser-pane records with hiddenFrames > 0 |
| Easing shape, duration, stagger | Code (Reanimated configs) + CDP Animation domain | Eyeballing video |
| Pixel snapping, integer magnification, bleeding | PNG screenshots + pixel diff; `pixel-grid.ts` contract | Any compressed video |
| Layout, safe areas, empty/error states | Simulator across all four devices + web viewports | One device |
| Hover, cursor, keyboard, focus | Real Chrome at desktop viewport | Browser pane (0-width → phone layout), anything iOS |
| Audio headroom, clipping, variant/pitch proof | ffmpeg astats + spectrograms on asset files | Listening once |
| Audio mix under load, duck timing | code read + labeled single-listen (no loopback) | claims of measurement |
| Save integrity, RNG reproducibility | Scripted headless runs, fixed seed | Manual play |
| Match outcomes/balance claims | Existing balance harness + probes ≥ 600 seeds | Small samples (< ~0.19 delta is noise) |

### 3.3 Rules of engagement

1. PNG for pixel judgments, never video.
2. Every finding carries provenance: surface + exact command + timestamp/frame or file:line.
3. State the verification tier per finding — T1 code read · T2 automated web/Node capture ·
   T3 Simulator · T4 device+Instruments · T5 human-driven. A T1-only claim about feel is a
   hypothesis and is labeled one.
4. Safe and reversible without asking: booting sims, serving `dist/`, captures, probes, code
   reads. Ask first: installing anything new, touching git state beyond this branch, Xcode
   setting changes, anything on the physical phone, anything that costs money.
5. Deterministic runs: fixed seed, fixed device, fixed viewport. Reproduce before reporting.
6. **Session hygiene (project rule, non-negotiable):** mute any game tab on load; when a QA
   surface is done, close the tab, stop the `serve` process, shut down any simulator this audit
   booted. Port 8081 is never touched.

---

## 4. Method (run in order; report per phase)

**Phase 0 — Stand up observation (~40–60 min; sim build dominates).** Both static exports
(clean + harness-enabled) + serve with recorded PIDs; verify `#/dev` answers on the harness
build and is dead on the clean build; Vercel reachability; real-Chrome session; Release sim
build via the worktree recipe (§7.2 — the main folder is never touched); device check (expected
offline). Output: one-line status per surface, and the axis coverage map. Do not start Phase 1
blind.

**Phase 1 — Inventory (~20 min).** Screen graph (25 screens in `src/ui/screens/` + 22 shell
overlays/modals in `src/ui/*.tsx` + match layer in `src/render/`); counts: screens, distinct
interactive controls (129 `<Pressable` sites across 50 files — count SITES, not raw word
references, which triple the number), animation definitions, SFX files (94) vs registered
cues, dev-harness entries (14). These counts are denominators — 129 buttons and 6 press
animations is itself a finding.

**Phase 2 — Static audit (~45 min).** Read the anchor files (`src/render/animation.ts`,
`match-screen-styles.ts`, `management-sfx.ts`, `menu-audio.ts`, `haptics.ts`, `haptic-cues.ts`,
`pixel-art-sampling.ts`, `pixel-grid.ts`, `interpolate.ts`, `count-up.ts`, `team-kit-ui.ts`,
`match-control.ts`, `match-speed.ts`, sprite atlas generator `scripts/generate-sprites.mjs`).
Run the §6 grep list. Check atlas padding, easing/timing-table existence, magic durations,
palette drift (`magick` unique-color counts across `art/`).

**Phase 3 — Runtime measurement (~45 min + capture time).** Real numbers or explicitly missing,
per §3.2: hidden-guarded RAF harness (idle title, mid-match, fulltime transition) on the served
export; chrome-devtools performance trace during a match (long tasks, layout thrash); Node
frame-budget probe (per-tick histogram + fulltime span, fixed seed); audio forensics sweep over
all 94 assets; sim recordVideo of kickoff→goal→fulltime for dead-frame and choreography counts;
cold-start-to-interactive on web trace; `dist/` bundle weight. Nothing estimated.

**Phase 4 — Frame-by-frame feel audit (~60 min).** For the 10 most-touched interactions (named
in the plan: advance week, drill tap, drill modal open, match speed change, Quick Result
confirm, formation change, substitution swap, renewal accept, market bid, fulltime continue):
synthetic pointer sequence + capture; record frames from input to first visual change, full
response length, easing shape, whether sound triggers on press-down or release (code +
timestamp), whether a haptic cue is mapped (code; feel is device-tier). Rapid-tap ×10 and
drag-off-cancel per interaction.

**Phase 5 — Exemplar teardown (~30 min).** Duolingo (button physics, pitch ladder), Balatro
(juice density, count-up choreography), Football Manager Mobile / Retro Bowl (sim readability,
match pacing), Alto's Odyssey (transition continuity), Vampire Survivors (feedback at low art
cost). For each: the specific mechanic they do that this build doesn't, or evidence it does.

**Phase 6 — Red team (~30 min).** Attack Phases 1–5 output: where was scoring soft, which
surface wasn't actually tried, which finding is a T1 hypothesis dressed as measurement. Rewrite
harder. Then write both §9 artifacts.

**Phase 7 — Report.** Per §8, to `2026-08-06-polish-audit-report.md`.

---

## 5. Audit axes (score 0–10; justification + the single blocker to +1)

### A. Input feel & touch response
- Visual state changes on **touch-down** (Pressable pressed-state present and visible), commit
  on touch-up-inside, cancel on drag-off.
- Hit targets ≥ 44×44pt (NativeWind trap: 1rem = 14pt on native — `w-11` is 61.6pt, but small
  paddings shrink 12.5% vs web; verify in pt, not classes). `hitSlop` on small controls.
- Input-to-first-pixel: web-measurable in frames; device ms is `[UNVERIFIED-DEVICE]`.
- Haptics: cue map correctness (`haptic-cues.ts`: zone/power/rival-power/goal/conceded), never
  double-fired, respects system setting; feel itself is device-tier.
- Audio on press-down not release; the rapid tap pool must seek-then-play per press (the old
  fixed-delay rewind bug class: iOS double-clicks and silent taps).
- Fat-finger/rapid-tap: no queued duplicate actions, no double-spend (drill taps cost TP; market
  bids cost money — abuse them).
- Scroll: taps during deceleration absorbed not triggered; no jank on flick.
- Function-form `style` on any Pressable is an instant S1 candidate (two confirmed iOS
  zero-height hits in project history).

### B. Duolingo-grade button juice
- Audit every recurring button archetype against: visible press-down state ≤ 1 frame; springs
  back with overshoot; press sound on down with ≥3 variants or pitch spread (the stat-step tap
  is peak-maxed — loudness fixes are known dead ends, variety is the lever); repeated actions
  climb a ladder (training taps, count-ups); disabled reads flat before it's pressed;
  destructive/spend actions read heavier than navigation; primary CTA idle attract after ~4s;
  celebrations escalate (a goal must not feel like a menu tap — compare goal-fanfare +
  celebration tiers vs the standard tap).
- The chunky-lip spec is the exemplar shape, not a mandated art change: report the gap between
  current press physics and the Duolingo reference, with the cheapest mechanism that closes it.

### C. Pixel art integrity (against the real contract)
- Every drawn match position passes `snapDevicePixels`; sprite magnification integer via
  `snapSpriteScale`; the camera offset uses the same snap (an unsnapped camera shimmers every
  sprite on pan).
- No mixed pixel densities on one screen: HUD/modals/toasts over the match canvas — count
  texel sizes per screenshot.
- Silkscreen at integer multiples only; ▼/▲/★ are missing glyphs (draw, don't type);
  `numberOfLines={1}` clipping on pixel-font headers; iOS text-size scaling (up to 1.6×) must
  not shatter pixel-font alignment.
- Web: `image-rendering: pixelated` present; canvas at device-pixel scale (verified in the iPad
  audit — confirm it held).
- Atlas: padding in the generated atlas (`scripts/generate-sprites.mjs`, `sprites.json`), no
  bleeding at any magnification; spot-check sprite edges at 1×/2×/3× DPR screenshots.
- No arbitrary sprite rotation or non-integer scale at draw time (authored rotation frames
  only); dithering/parallax doesn't crawl on pan.
- Palette discipline: unique-color counts per sprite sheet; drift between art passes (the
  sprites.json generator is known to revert hand-patched colors — check for regressions).
- Safe areas on all four sim devices: notch/Dynamic Island/home indicator; nothing important
  within 8 px of an edge; iPad letterboxing behavior.

### D. Animation quality
- No linear easing on discrete UI motion (continuous tickers exempt).
- One shared timing/easing table or scattered magic numbers? (`src/render/animation.ts` holds
  match constants in ticks; find the UI-side equivalent or its absence across ~10+ files using
  Reanimated `Easing`.)
- Anticipation/overshoot/settle on launches and arrivals; nothing pops in/out with no entrance
  or exit; secondary motion exists somewhere.
- List staggers (30–50ms/row); league table reorder slides (FLIP-style) rather than teleports.
- Numbers roll (count-up.ts exists — verify coverage: money, TP, attendance, ratings,
  fulltime stats — anything that snaps is a finding).
- Every animation interruptible: tapping mid-animation must not queue, freeze, or double-fire
  (cut-ins are skippable after first view — verify).
- Reduce Motion: big transitions/shakes swap to fades (axis J cross-check).

### E. Performance & frame pacing (against canon budgets)
- Canon: 60fps match on iPhone 12-class; cold start < 2s; app < 60MB. Zero frames > 33ms during
  gameplay or transitions is the pacing bar. 120 on ProMotion = stretch note only.
- Device tier OFFLINE → pacing/thermal/battery/memory-over-session are `[UNVERIFIED-DEVICE]`
  with the unblock named. Do not fake them from the simulator.
- What IS measurable now: Node per-tick cost histogram + the synchronous fulltime span
  (KNOWN-DEFERRED, re-measure and report player-felt duration); web trace long tasks, layout
  thrash, dropped-frame windows via the hidden-guarded RAF recorder; dead frames in sim
  captures; app size — the 60MB canon budget applies to the NATIVE app, so measure the built
  Release .app bundle as its proxy (an IPA differs; label it proxy) and report `dist-clean/`
  weight separately as the web download datum, never against the 60MB line; web
  cold-start-to-interactive; re-render storms
  during match ticks (React DevTools or render counters).
- Match sim off the render thread or time-sliced so no tick blocks a frame. The rival-preload
  pump IS the shipped time-slicing (rule 11) — audit both its residual synchronous settle AND
  the pump's own per-frame cost during a watched match (`TICKS_PER_BURST = 8`,
  `WATCHING_FLOOR_MS = 6`, `setTimeout` fallback assuming 6ms where `requestIdleCallback` is
  absent — which path does the web build take?). Then find any OTHER synchronous violations
  (week advance, season rollover, save writes on the interaction path — `pendingCareerSave`
  coalescing is owner-kept, audit its worst-case flush cost, not its existence).

### F. Football-sim specific feel
- Match readability in < 1s: ball owner, score, momentum (name the mechanism per element:
  possession glow? scoreboard? Heat meters?).
- Pacing controls: speed control, skip/Quick Result (same engine — canon), "jump to key event"
  or its absence; do they animate or hard-cut?
- Event text pacing: held frames + visual punctuation on key events vs dumped text
  (match banners, commentary lines, Bert typewriter cadence).
- Hitstop on goals / red cards / penalty saves; screen shake with decay + cap (find the
  actual mechanism in `WorkletMatchOverlays`/match FX, measure durations from captures).
- Post-match choreography: fulltime report → ledger → weekly review chain — staggered reveals,
  count-ups, MOTM/ratings beats vs static tables (`#/dev/fulltime-report`, PostMatchLedger).
- Negotiation/renewal drama: pauses, reveals, reaction states in renewal + market flows (the
  renewal path had a crash class fixed 2026-08 — feel-audit the shipped flow).
- Milestones: promotion, cup, awakening, endgame each have a distinct celebration tier
  (`#/dev/promotion-transition`, `awards-ceremony`, `endgame`) — or reuse a generic one.
- Losing reads different on purpose: palette/easing/audio bed vs wins (crowd-jeer exists —
  is the whole defeat path differentiated or just one sting?).

### G. Audio
- Every interactive element sounds (silence on tap reads as a bug) — map management-sfx +
  menu-audio coverage against the Phase 1 control inventory.
- Headroom: astats every asset; nothing near 0 dBFS; flag anything that would clip when 4
  overlap (sum estimate, labeled estimate).
- Music ducks under key SFX/commentary — mechanism in code, depth/timing labeled code-read.
- iOS silent switch + background-music coexistence: expo-audio session mode vs canon
  (playsInSilentMode — settled in the iPad audit for web; check native config).
- Variants ≥3 or pitch spread on repeated actions — prove with spectrograms, not ears
  (stat-step tap, ledger ticks, menu taps).
- Crowd bed reacts to match state (momentum, near-miss, goal) — trace the state machine.

### H. States, edge cases, interruptions
- Per-screen: loading, empty, error, first-time states designed (ScreenErrorBoundary exists —
  what does the player see?); offline is N/A by design (no network play) — verify nothing
  demands a network anyway.
- Backgrounding mid-match, call, low-battery mode: RAF re-base on foreground exists
  (AppState reset in MatchScreen — verify), audio-lifecycle recovery, autosave-every-week
  (shipped #95 — verify the mid-match kill window).
- Kill mid-transaction and relaunch: scripted headless save-integrity run (SQLite journal), and
  the coalesced `pendingCareerSave` flush-on-hide behavior on web (fixed in the iPad audit —
  confirm the native equivalent).
- Rotation on iPad (portrait/landscape across the 1100pt two-column threshold), iPhone stays
  portrait; external keyboard on iPad = desktop-web proxy check.
- Steam Cloud parity N/A (not built) — note only.

### I. Platform parity (desktop web today, Steam precursor)
- Hover states for every control at desktop viewport (the hover-latch bug class shipped once —
  sweep for siblings); cursor changes on interactive elements.
- Keyboard: full traversal with visible focus ring; Escape/back sanity; no keyboard trap.
- Window resize across the two-column threshold mid-session; 1280×800 (Deck-size) and 2560×1440
  text legibility of Silkscreen at its chosen sizes.
- Gamepad, rebinding, Steam overlay: NOT-BUILT — listed as launch-gap notes, not scored
  defects.

### J. Accessibility
- Reduce Motion honored (AccessibilityInfo / prefers-reduced-motion) — shakes, parallax, big
  transitions.
- Colorblind-safe kit clashes: team-kit-ui pairing logic — simulate deuteranopia on real
  fixture pairings (red vs green kits WILL happen — prove they can't, or find the clash).
- Text size: iOS Dynamic Type scaling (NativeWind text scales up to 1.6×) — does layout
  survive; is there an in-game size option; Silkscreen at small sizes needs integer scaling.
- Contrast ratios of pixel fonts over pixel-art backgrounds (measure the worst screens).
- No information by color alone (form arrows, stat deltas, momentum).
- One-hand reach: primary CTA in the bottom third on iPhone portrait.

### K. First 60 seconds & store presence
- Icon tap → first meaningful choice: time it on the sim (T3-indicative) and web; count taps
  and dead moments; splash → first screen gap (black frames?).
- Tutorial teaches by doing (TutorialSpotlight/TapCue exist — audit the actual first-session
  flow vs text walls; Bert's cadence).
- Icon legibility at 60×60 (downsample assets/icon.png and look).
- Store screenshots/trailer: NOT-PRODUCED yet — flag as launch gap; identify the single
  screenshot-able "wow" moment the build offers today (or its absence, which is a launch
  problem, not a polish problem).

---

## 6. Anti-pattern grep list (this stack, this project's measured traps)

| Pattern (grep) | Why it's a smell |
|---|---|
| `Easing.linear`, `easing: Easing.linear` | Linear easing on discrete UI motion |
| `duration: \d+` inline literals across ui/render | No shared timing table — inconsistency you can feel |
| `style={\(` on Pressable (function form) | Confirmed iOS zero-height/no-tap killer (two prior hits) |
| `className=` on `Animated.` components | NativeWind silently drops it — invisible styling |
| `Animated.timing(` without `useNativeDriver: true` | Legacy Animated on the JS thread |
| animating `width:`/`height:`/`top:`/`left:`/`margin` | Layout-thread animation; transform/opacity instead |
| `set(` / `setState` / zustand `set` called per tick in match render path | Re-render storm during match ticks |
| FlatList/map rows without `React.memo`/`keyExtractor` (league table, squad lists) | Whole-list re-render per tick |
| `Math.random`, `Date.now`, `new Date()` in `src/sim` or `src/game` | Determinism breach (must be zero — PRNG injected) |
| `console.log`/`console.warn` in per-frame/per-tick paths | Shipping debug cost |
| `Platform.OS === 'web'` (or `!== 'web'`) in layout/interaction code | The hover-latch bug class: capability, not platform, should gate |
| `setTimeout` near audio play/rewind | The rapid-pool bug class — pooled cues must seek-then-play |
| `require(` of assets inside a render function | Per-render module resolution |
| `hitSlop` absent on Pressables with small visual bounds | Sub-44pt effective targets |
| `numberOfLines={1}` on Silkscreen headers with suffix glyphs | Measured clipping trap (arrow, not label, gets cut) |
| hardcoded English strings in `src/ui`/`src/render` (outside i18n catalog) | i18n shipped — leftovers are defects |
| `dangerouslySetInnerHTML`, direct DOM in shared components | Web-only path that native silently skips |

Each hit is a candidate finding, then verified on a runtime surface before it may claim more
than T1.

---

## 7. Toolkit (commands that work in this repo, today)

### 7.1 Web (the workhorse) — TWO exports, served from SCRATCH with ship headers
```bash
npm run export:web && mv dist "$SCRATCH/dist-clean"      # ship parity; ALL perf + live play
EXPO_PUBLIC_DEV_HARNESS=1 npm run export:web && mv dist "$SCRATCH/dist-harness"
node scripts/qa/ipad-pwa-audit.mjs --dist "$SCRATCH/dist-clean"
# Exports go to $SCRATCH: .gitignore/tsconfig exclude only `dist`, so in-worktree renames
# would leak 26MB trees into `npx tsc --noEmit` and git status.
# Write serve.json (COOP: same-origin, COEP: credentialless — vercel.json parity; a bare
# serve is NOT ship parity) into both dirs, then:
npx serve "$SCRATCH/dist-clean" -l 4173 &  echo $!  # PIDs → $SCRATCH/serve-pids.txt;
npx serve "$SCRATCH/dist-harness" -l 4174 & echo $! # cleanup kills PIDs, never pkill
# Phase-0 gates: crossOriginIsolated === true on 4173; #/dev alive on 4174 / dead on 4173;
# career persistence proven by play → hard reload.
# NEVER expo start --web; NEVER port 8081. If a serve dies between phases (session reaper),
# curl -s the port before each capture batch and restart the dead one.
# Drive: chrome-devtools MCP (real viewport, traces, screenshots) or claude-in-chrome.
# Mute immediately on load. Authored states: http://localhost:4174/#/dev/<entry>/<case> —
# the harness flag makes DevHarnessApp the ROOT of that build: authored stills only, no
# playable game. Everything live (including all mid-match work) happens on 4173.
# Perf, pacing, cold-start, bundle-weight judgments come ONLY from dist-clean (4173).
# Taps on RNW: full pointerdown→pointerup→click synthetic sequence.
# Frametime: inject scripts/qa/polish/raf-recorder.js; a record with hiddenFrames>0 is void.
# Viewports: 390×844 (iPhone), 1280×800 (Deck-size), 1920×1080, 2560×1440.
```

### 7.2 iOS Simulator
```bash
# Build via the WORKTREE recipe (the main folder is read-only to this audit — it is Joe's
# phone-server tree; never build, pod-install, or delete in it; the ONLY permitted access is
# read-only extraction: rsync of ios/ and node_modules):
#   1. rsync -a --exclude devbuild --exclude simbuild "$MAIN/ios/" "$WT/ios/"
#      (devbuild 1.7G + simbuild 7.4G are stale products; ios/build/generated — ReactCodegen
#       — MUST come along, which this rsync includes)
#   2. rsync -a "$MAIN/node_modules/" "$WT/node_modules/"  # worktree installs run thinner
#      (expo-modules-jsi, PrivacyInfo, RN scripts) — recorded recipe requirement
#   3. rm -rf "$WT/node_modules/expo-modules-jsi/apple/.DerivedData"   # the poisoned cache
#   4. export LANG=en_US.UTF-8 (CocoaPods crashes without it); pod install INSIDE the
#      worktree's ios/ copy only if the build demands it; on pod drift delete the COPY's
#      Podfile.lock, never main's. Then (exit code checked, never masked by a pipe):
cd "$WT" && export LANG=en_US.UTF-8 && \
xcodebuild -workspace ios/HeroFootballManager.xcworkspace -scheme HeroFootballManager \
  -configuration Release -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO \
  -derivedDataPath "$SCRATCH/DerivedData" build > "$SCRATCH/xcodebuild.log" 2>&1; echo "EXIT:$?"
xcrun simctl boot "iPhone 17"            # + 17 Pro Max, 17e, iPad Pro 11 for layout sweeps
xcrun simctl install booted "$SCRATCH/DerivedData/Build/Products/Release-iphonesimulator/HeroFootballManager.app"
xcrun simctl launch booted com.tanglefast.herofootballmanager
xcrun simctl io booted screenshot --type=png shot.png        # pixel judgments
xcrun simctl io booted recordVideo --codec hevc out.mov      # choreography only
xcrun simctl status_bar booted override --time 9:41 --batteryLevel 100
# Address sims by UDID captured at `simctl create` — by-name lookups have been clobbered by
# parallel sessions before. Shut down every sim this audit booted when done, by UDID.
# STATE on native (no harness in Release): seed careers via the recorded jest→SQLite unlock —
#   C=$(xcrun simctl get_app_container "$UDID" com.tanglefast.herofootballmanager data)
#   then INSERT OR REPLACE the serialized save into $C/Documents/SQLite/hero-football-manager.db
# INPUT on native: the iOS Simulator MCP control tool (tap/swipe/text/screenshot, headless).
# Fallbacks: xcodebuildmcp axe taps (may need a sudo xcode-select from Joe) or computer-use
# on Simulator.app. If every driver fails, coverage degrades to seeded-launch stills — the
# surface log says so explicitly.
```

### 7.3 Headless Node probes (jest)
```bash
npm run test:probe -- src/audit/__tests__/frame-budget-probe.test.ts
# Pattern: fixed seed, performance.now() spans, JSON written to artifacts/, test never
# gates on machine speed. Sim API: createMatch/tick/runMatch (src/sim/match.ts),
# runHeadlessFullCareer (src/game/headless.ts).
```

### 7.4 Physical device (blocked until plugged in + approved)
```bash
xcrun xctrace list devices               # currently: "Devices Offline: Joes iphone"
xcrun xctrace record --template 'Animation Hitches' --device 00008140-001C35291AE3001C \
  --launch -- com.tanglefast.herofootballmanager --time-limit 120s --output hitches.trace
```

### 7.5 Frame and asset forensics
```bash
ffmpeg -i cap.mov -vf "mpdecimate,showinfo" -f null - 2>&1 | grep -c drop   # dead frames
ffmpeg -i cap.mov -vf "tblend=all_mode=difference,signalstats,metadata=print" -f null -
node scripts/qa/polish/audio-forensics.mjs        # astats sweep over assets/audio/**
ffmpeg -i assets/audio/sfx/stat-step-tap.m4a -lavfi showspectrumpic=s=1024x512 spec.png
magick art/<sheet>.png -format "%f %k %wx%h\n" info:   # palette drift
```

Evidence that backs a finding: PNGs into `artifacts/polish-audit-2026-08-06/` (committed,
small); video and bulk captures stay in the session scratchpad (referenced by command, not
committed).

---

## 8. Report format

**8.0 Surface log** — surfaces used / unavailable / axes left unscored. Three lines max, first
thing in the report.

**8.1 Scorecard** — axis A–K | score /10 | verification tier | one-line justification | single
blocker to +1. Then an overall score with what "10" means for this genre, naming exemplars
(Retro Bowl touch feel, Kairosoft pacing, Duolingo button physics, Balatro choreography).

**8.2 Findings** — one row per defect, sorted by severity:
`| ID | Axis | Sev | Screen/state | Surface + command | Evidence | What the player feels | Fix | Effort | Tier |`
Severity: S0 breaks illusion/crashes/corrupts · S1 a reviewer would write it up · S2 players
feel it but can't name it · S3 purist-only. Tags where they apply: KNOWN-DEFERRED,
[UNVERIFIED-DEVICE], NOT-BUILT.

**8.2b Canon pushback** — separate table: finding, the locked decision it collides with, the
feel cost argued, left for the owner. Never mixed into 8.2.

**8.3 The 10 blockers** — exactly ten, ranked: what stands between this build and 10/10.

**8.4 Fix plan** — ranked by delight-per-hour, not severity; includes the "first afternoon"
cluster: 5 fixes, ≤4 hours, largest perceived jump.

**8.5 Retest protocol** — pre-registered pass/fail criteria per fix with the measurement
command, written before any code changes. A fix isn't done until its criterion passes.

---

## 9. Red team artifacts (both, in full, from the current build)

1. **The 2-star App Store review** a real player would leave — 120 words, specific, feel-focused,
   no strawmen.
2. **The kill shot** — one Steam-curator paragraph on why this looks like a competent asset-flip;
   then one paragraph on what would make the same curator forgive everything.

If either is hard to write, §5–8 were too gentle — go back.

---

## 10. What I don't want

- Score inflation; a 9 needs the same evidence bar as a 3.
- Generic advice — every finding specific to this build.
- Fixes proposed without reading the code that would change.
- Findings that re-litigate canon dressed as defects (they go in 8.2b).
- A summary that restates sections. End on the fix plan.
