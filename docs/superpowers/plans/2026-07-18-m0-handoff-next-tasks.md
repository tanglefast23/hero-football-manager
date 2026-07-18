# M0 → Next Session Handoff — Complete Task List

Date: 2026-07-18. **The M0 fun gate is PASSED** — the user's on-device verdict after live play:
"I like the fun gate, it's passed." This document is the single entry point for the next
session: current state, how to run everything, and every remaining task in recommended order.

## Where things stand

- **Engine**: `ENGINE_VERSION m0.4` — deterministic tick sim (100 ms ticks, seeded mulberry32,
  integer-cm positions, no transcendentals), In-the-Zone activation model, 3 powers implemented
  (Super Speed, Super Strength, Fire Torch), ball-flight passing/shooting, GK Resolve, pressing,
  stoppage time, second-yellow send-offs.
- **Tests**: 112 tests / 17 suites green (~25 s warm). Type gate: `npx tsc --noEmit`. No lint
  script exists (that is expected — don't invent one).
- **Statistical gates** (all passing, mutation-tested): GATE-1 attention edge +0.16 goals
  (95% CI [+0.04, +0.28], 400 seeds, paired bootstrap); GATE-3 contextual-auto ≥ 0.95× blind
  (1.046); blowout rail 4.58 < 10.
- **App**: playable on Joe's iPhone (dev client `com.tanglefast.herofootballmanager`), JS served
  over Wi-Fi from Metro. Zone affordance (entry banner, TAP! card, early-tap hint, gold pitch
  marker), warmth-step hero cards (cold → warming → ember → zone), goal celebration all live.
- **Git**: everything merged to `main` at session end (final commit). Worktrees:
  `../HFM-art-worktree` (feature/m0-pixel-art — sprites + 3 original icon concepts),
  `../HFM-audio-worktree` (feature/m0-audio — 27 SFX + match theme).
- **Movement spec**: `docs/superpowers/specs/2026-07-18-positional-movement.md` — v2, externally
  reviewed, **APPROVED**. It is the flagship task below.

## How to run

- Metro: `nohup npx expo start` (port 8081). The phone's bundle location is set via shake menu →
  `192.168.1.13:8081` and **persists** (the `-RCT_jsLocation` launch arg does not).
- Tests: `npm test`. Types: `npx tsc --noEmit`.
- Native build: direct `xcodebuild` with cloud signing via the ASC API key (details in
  `~/.claude/CLAUDE.md`). `security find-identity` showing 0 local certs is NORMAL — signing is
  cloud-based; `expo run:ios` fails its local-cert pre-check, so don't use it. Set
  `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` for CocoaPods.
- Simulator verify loop: `xcodebuild -sdk iphonesimulator -derivedDataPath ios/simbuild` +
  `xcrun simctl` install/launch/screenshot.
- Device: "Joes iphone", UDID `00008140-001C35291AE3001C`, iOS 26.5.2. Wireless native installs
  need Xcode network pairing enabled once while cabled; otherwise TestFlight.

## Task list (recommended order)

Independent starters — T1–T4 touch disjoint files and can run as parallel agents
(worktree-isolate anything sharing `MatchScreen.tsx`):

### T1 — Positional-table movement rework (flagship, engine → m0.5)

Implement `docs/superpowers/specs/2026-07-18-positional-movement.md` **exactly as approved**:

- 10 outfield slots × 35 cells (7×5) × 2 phases (`inPossession`/`outOfPossession`), build-time
  generator + committed overrides file (never hand-edit emitted JSON), GK excluded this milestone.
- Cell-center bilinear sampling; team 1 mirrors continuous coordinates AND rotates targets 180°
  (property-tested); targets quantized to integer cm.
- Phase = holder's team; ~10-tick blend on turnover; presser lease ≥ 10 ticks; dedicated kickoff
  layout; delete `anchorFor` + `BALL_PULL_*`.
- Tests: table validity/coherence, role-band spacing + crowding metric, y-velocity correlation
  must DROP vs m0.4 (record before/after), asymmetry + phase-difference tests, determinism
  double-runs. Debug overlay (dev toggle: grid + per-player targets).
- `ENGINE_VERSION → m0.5`, goldens/fingerprints regenerate, ALL gates + rails re-run — if rails
  break, retune generator/overrides, **never** weaken gates.

### T2 — Side-split hero cards ("the enemy card thing", deferred by user)

`MatchScreen.tsx` only. Rival hero cards move to a slim strip at the top (under the scorebar):
red family, "RIVAL" tag, non-tappable, drop the "⚠ " prefix. Home hero cards stay at the bottom
in thumb reach as tap targets. Build both rows generically by scanning players for `def.power`
per team — no hardcoded indices (today: home heroes 9/10, rival hero 14 "Rex Bould").

### T3 — NES/SNES-authentic icon rework (user-confirmed)

Redo **all three** icon concepts in genuine NES/SNES pixel style, then pick a winner:

- Hand-authored pixel maps: 32×32 rows-of-chars grids in the generator script — **no drawing
  primitives** (no fillRect circles/gradients; that's what made round 1 look modern).
- ≤ 16 colors per icon, hard black outlines, discrete shading ramps (2–3 steps, no smooth
  gradients), chunky silhouettes readable at homescreen size.
- Concepts: A "Blazing Ball", B "Hero Face" (artist-ranked best of round 1), C (becomes fully
  colored this round). Present previews → user picks → export 1024×1024 PNG to
  `assets/icon.png` (app.json already points there). Ships in the T6 rebuild.

### T4 — Worklet stress screen rebuild (Task 15)

Prior draft was discarded when its agent was stopped — rebuild (~20 min): production render
path validation in `StressScreen.tsx` + App.tsx entry. Reanimated shared values (never mutate
useMemo state inside worklets), the real sprite atlas (`makeNonTextureImage` already handled in
buildAtlas), 2000 sprites, 1 Hz FPS readout via `runOnJS`, back affordance, simulator
screenshot as proof.

### T5 — Audio integration (after T2; shares MatchScreen.tsx)

- **Confirm the `expo-audio` dependency with the user first** (no-new-deps rule), then install.
- Assets live on `feature/m0-audio` / `../HFM-audio-worktree`: 27 SFX + match theme (wav/m4a),
  `scripts/audio/*`, `audio-preview.html`. Copy into `assets/audio/`.
- Wire to the sim event stream: kickoff/half/full whistles, kick/pass, tackle + grunt, post,
  goal + crowd, zone entry, tap-fire, per-power SFX, card, extinguisher. Match-theme loop.
  Respect the iOS mute switch. User audition verdicts still open on: grunt, extinguisher-spray,
  crowd-jeer (swap candidates exist in the worktree).

### T6 — Native rebuild bundling icon + audio (after T3 + T5)

New icon and audio assets are native resources — Metro can't hot-load them. One xcodebuild +
install cycle: try wireless (needs the one-time cabled network-pairing toggle) or fall back to
TestFlight (ASC upload pipeline in `~/.claude/CLAUDE.md`).

### T7 — GK angle-narrowing (after T1; isolated commit)

The movement spec deliberately excluded the keeper. Add GK positioning (narrowing the angle to
the ball) as its own commit with its own balance re-run — shot/save rates will shift.

### T8 — Held-ball foot-offset polish (tiny, anytime)

Draw the held ball at the carrier's leading foot instead of their center. Renderer-only.

### T9 — Task 16 wrap-up (last)

README run instructions; fun-gate protocol section updated to **PASSED** (user verdict,
2026-07-18); final Codex re-audit brief — scope: sim purity, determinism/replay envelope, zone
model + gates, renderer — filled with the real final `main` hash and sent for the outside
opinion.

### T10 — Logged P2/P3 backlog (fold into related tasks or batch)

- Atlas per-pixel Paint startup hitch (~200 ms) — precompute or move off first frame.
- `Pitch` should be `React.memo`; split MatchScreen per-frame `useMemo`s.
- `shooting.test` seed count trim (runtime); `validateOpts` null-guard;
  PARITY test rename (it proves determinism, not two-path equivalence); stale buildAtlas header
  comment.

## Then: M1 — the two-season hero vertical slice (docs/10)

Awakening chance-event chain + pity counter; license competition; the wage cliff (awakened wage
locked until renewal, then ×3–5); training v1 (focus drills + TP); money v1 (all 4 income
streams); one facility; save/load (expo-sqlite + replay envelope persistence); worklet renderer
migration; first real season UI; Hermes-in-CI goldens; fire-policy pre-match UI (the setting
exists in the engine, no UI yet); onboarding trialist hint; comic cut-ins (skippable after
first view); halftime interstitial; power catalog build-out toward the approved 20 (12 at
launch, doc 04).

## Rules that bind every task (recap)

- `src/sim/` + `src/game/` stay pure TS: no RN/Expo imports, no `Math.random`/`Date.now`, no
  transcendental Math — injected PRNG, contest table, sqrt-of-integers only.
- **Any replay-affecting sim change bumps `ENGINE_VERSION`** (`src/sim/match.ts`); golden
  updates force the decision — never update snapshots without one.
- Gates are design problems, never tests to weaken. Rails break → retune content, not asserts.
- No new dependencies without discussing alternatives with the user first (expo-audio pending).
- Content ships as typed JSON in `content/`; generated JSON is regenerated, never hand-edited.
- Rendering = Skia Atlas batched API; `makeNonTextureImage()` after any MakeOffscreen snapshot.
- Process: plans get an external (Codex) second opinion before execution; subagent-driven
  implementation with spec + quality reviews; plan amendments recorded in the plan doc ledger.
