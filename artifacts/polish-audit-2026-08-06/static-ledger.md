# Static audit ledger — commit 96f45b1f (Explore-agent sweep, 2026-08-07)

Full provenance in scratchpad/static-ledger-raw.jsonl. Every claim carries file:line from the sweep.

## PART A — Inventory

**Tabs (ManagementShell.tsx:20-28, all available):** home→ClubHomeScreen (App.tsx:2337), squad→SquadTrainingScreen (:2090), club→ClubFinancesScreen (:2136, inner clubOfficeTab :2138), market→MarketScreen (:2229, gated on career.market), league→M2LeagueScreen (:2306) else LeagueTableScreen (:2335).

**Routing is M1Screen, not a navigator** — 17-member union (store.ts:275-297): welcome, create-player, management, awakening, event, matchday, watched, faceoff, postmatch, week-review, legacy, championship-celebration, endgame-celebration, awards-ceremony, season-end. App.tsx if/else chain (1761-2350) — full replace, no stack, no transition.

**Overlays:** 12 RN `<Modal>` files (PostMatchSummaryModal, FacilityPlacementConfirmation, CoachStaffOverlay, TrainingDrillModal, FacilityProjectNotice, SettingsOverlay, PlayerSigningOverlay, PowerAcquiredDemoModal, PlayerRequestDecisionCard, LanguageButton, ConfirmationSheet, FirstMatchCoachingModal) + 10 inline absolute overlays (CharacterSpeechOverlay, TutorialSpotlight, TutorialTapCue, BertBriefingWalkOn, PlayerWalkOnWelcome, PlayerRequestWalkOn, GlossaryPanel, PrivacySupportPanel, MatchdayConditionWarning, speech-bubble).

**Screens:** 25 in src/ui/screens (3 QA-only: AwakeningArtQa, AwardsCeremonyQa, PowerArtQa; SquadRequestsPanel is a panel). 22 top-level src/ui/*.tsx. **+33 in src/ui/components/** (SfxPressable, ScreenTabs, Scorecard, FinancialStatement, SlotAmount, PixelText…) — the real interaction primitives.

**Mid-match only (mounted by MatchScreen.tsx):** Pitch (:2288), WorkletMatchOverlays (:2440), PowerEffectScene (:2415), HeroChargeMeter (:2502), PowerTitleTakeover (:2537), MatchControlRail (:2238), SubstitutionBoard (:2700), FirstMatchCoachingModal (:2714), CupTitleCard (:2733).

**Counts:** 129 `<Pressable` sites (src/ui+src/render, non-test) — 106 via `SfxPressable as Pressable` alias (29 files), 23 raw RN Pressable (17 files). Pressed-state usage: `({ pressed }` 44, `pressed &&` 12, `pressed ?` 45. withTiming 24, withSpring 0, withSequence 4, withRepeat 1, withDelay 5, legacy Animated.timing **50**. Reanimated importers 8; Easing-from-reanimated 6 files; Easing-from-react-native 11+ files. Audio: management-sfx has 35 registry keys / 26 exported fns over ~25 distinct assets (aliases deliberate); menu-audio 3 themes + 3 SFX; audio.ts 46 require sites; 72 distinct assets referenced from src/render. Dev-harness: 14 entries (case counts: club-business 15, financial-report 11, fulltime-report 8, retirement-legacy ~9, assistant-beats 6, board-ultimatum 5, player-requests ~6, promotion-transition ~6, endgame 3, hall-of-fame 3, cup-mismatch 3, cup-giant-killing 3, awards/career-events dynamic).

**Durations:** 37 inline `duration:` literal sites, 26 distinct values (430×3, 90×3, 620/420/520/2200/160/75/150 ×2 each, rest ×1); PLUS 38 named-constant duration sites and 31 scattered `export const *_MS`. **No shared motion/timing table module exists** (no src/ui/*motion*/timing*; match-screen-styles.ts is geometry/colour only, sole export CARRIER_CARD_CONTENT_WIDTH:14).

## PART B — Anti-pattern sweep

- **B1 Easing.linear: 19 hits.** Legit (loops/lerp): worklet-atlas-frame.ts:385,400 etc. Outliers: ChampionshipCelebrationScreen.tsx:147-148 (3.2s linear ramp), CharacterSpeechOverlay.tsx:287; also AwakeningCutscene:266,317,319, FinancialStatement:410, SlotAmount:147, SuperTrainingCelebration:69, HeroChargeMeter:38, CupTitleCard:65, DrillSceneOverlay:118, MatchScreen:928,929.
- **B2 No shared timing table** (see above).
- **B3 Function-form style on Pressable: 44 hits, but the killer is ABSENT.** SfxPressable.tsx:104 resolves function style to a plain array before NativePressable (doc :40-47) → all 106 aliased sites safe; Scorecard ActionButton same. Raw sites (ScreenErrorBoundary.tsx:60, ChampionshipCelebration:315, SubstitutionBoard:663, QA screens) are StyleSheet-based, no className+function combo.
- **B4 className on Animated.*: 1 hit — FacilityCompletionCard.tsx:38** (NativeWind silently drops it).
- **B5 useNativeDriver false: 1 hit — DrillSceneOverlay.tsx:119**, forced by **B6 width '0%'→'100%' progress bar (DrillSceneOverlay.tsx:205)** — the only layout-prop animation; all reanimated styles are transform/opacity only.
- **B7 Per-tick store writes: ZERO.** MatchScreen never imports the store; RAF loop writes local state only inside `if (advanced)` (once per sim tick) — setFrame :1520, setHud :1521-1527; paused frames early-return :995-1002; atlas via publishAtlasFrame :1515-1519.
- **B8 Lists: systemic.** Zero FlatList/keyExtractor repo-wide; every table is ScrollView+map. React.memo total 4, none a list row. LeagueTableScreen.tsx:129 & M2LeagueScreen.tsx:234 unmemoized rows; LeagueFixtureRow.tsx:5 plain fn.
- **B9 Determinism: ZERO hits** of Math.random/Date.now/new Date in src/sim+src/game (non-test). ✅
- **B10 console.*: 12 hits, all console.warn, all fail-soft** (6 warnOnce-guarded). No console.log in shipped code. src/sim+src/game: 0.
- **B11 Platform.OS==='web': 18 hits/8 files — ALL a11y-focused** (focus traps, ARIA, inert). Hover-latch class CLOSED by design: pointer-capability.ts:11,30-31 gates on matchMedia('(hover: hover)'); SfxPressable:71,76 leaves onHoverIn/Out undefined without hover.
- **B12 Audio rewind bug: ZERO.** seekTo(0).then(play) at all 13 sites; the fixed-delay bug documented+rejected at management-sfx.ts:417-424; 4-voice round-robin pool for ui-click/stat-step (:107-110,431-438). 4 setTimeout-near-audio sites are all benign (harp offset, resume-verify, voice stop, loop watchdog).
- **B13 require() in render bodies: ZERO** (all module-scope; 10 lazy require('expo-audio') init guards).
- **B14 hitSlop: 5 real uses.** Repo pattern is explicit minWidth/minHeight 44 overrides (TrainingDrillModal:429-432, PostMatchSummaryModal:95-98, ClubFinances:1918-1921, CharacterCreation:281-286,300-303, Scorecard ActionButton). Note: NativeWind h-11/w-11 = 38.5pt on native. Dev-only save slots (ManagementShell:128,149) hitSlop=3.
- **B15 numberOfLines={1}: 96 total, 42 near pixel-font, only 21 with adjustsFontSizeToFit.** Unmitigated header-position: **ManagementShell.tsx:480,488 (tab glyph+label, 5 tabs, 7 locales)**, TrainingDrillModal.tsx:416,574, FixtureMatchDayScreen.tsx:281, ChampionshipCelebration:374.
- **B16 dangerouslySetInnerHTML: 0.** Unguarded document/window in shared hooks: **use-key-bindings.ts:92,126-127 and use-suspend-flush.ts:31-38** (no typeof guard); CharacterCreationScreen.tsx:94 optional-chain only. Others Platform/typeof-gated; audio-lifecycle.ts:58 exemplary.

## PART C — Anchor mechanisms

- **animation.ts:** all constants in sim ticks (SLIDE_TACKLE_TICKS 10, KNOCKDOWN_DROP 1.6/RISE 4, STAGGER_TICKS 3 = 300ms); run cadence distance-driven (RUN_PHASE_DISTANCE 110); stagger recoil 5 source px, lean 0.22rad; smoothstep duplicated deliberately for worklet (:90-108); pure, never writes sim state.
- **management-sfx/menu-audio:** pooling only for ui-click+stat-step (pool of 4); **pitch variation exists ONLY on playDrillResultSfx (rate = 1+0.06×streak, max +48%)** — ui taps byte-identical every press. **All cues fire on press-UP** (SfxPressable.tsx:93-102, deliberate: RNW keyboard has no press-in; visual pressed state DOES fire on press-in :79). Recovery cooldown 5000ms rebuilds 29 players.
- **haptics/haptic-cues:** zone→selection, power→impact Heavy, rival-power→Medium, goal→notification Success, conceded→Warning; management: tap→Light, hero/commit→Heavy, select→selection, fallthrough Medium. **Risk: POWER_FIRED and GUST_* both map to power → possible double Heavy in one tick** (haptic-cues.ts:11,14). Fail-soft, single hapticsEnabled flag.
- **Snapping contract: HONORED on 9/9 Atlas sites** (PIXEL_ART_SAMPLING = Nearest/None on all; every placement through snapDevicePixels: worklet-atlas-frame:547-569, WorkletMatchOverlays:171-230,675-691, interpolate:208-209 camera, QuickResultFaceOff:163-164, DrillSceneOverlay:242-256; snapSpriteScale guarantees integer device px per texel; PLAYER_DRAW_SCALE 17, BALL_DRAW_SCALE 34).
- **count-up.ts: only 3 importers** (awards-ceremony-stage, WeeklyReviewScreen, FinancialReportBody). **Numbers snap in:** ManagementShell HUD chips (:89), PostMatchLedger, ClubFinances totals, SeasonEnd tables. SlotAmount has its own slot-reel. WeeklyReview has a 2800ms RAF backstop (:50-53).
- **match-speed:** speeds 1|2|3 cycling, 2→1 fallback when max<3 (correct edge); playbackRate=speed; **no mid-match skip mechanism** (Quick Result is pre-match only); catch-up capped MAX_CATCHUP_TICKS (MatchScreen:1017-1020); fulltime hold →0ms under reduce-motion (:1550).
- **team-kit-ui: NO clash detection.** Fixed pair: home #d94f52 red vs away #5a8fd6 blue (deuteranopia-adjacent) by DEFAULT; amber #edb54a only via color-safe toggle (SettingsOverlay:387). Panel text ink contrast documented (8.6:1 / 4.8:1).
- **generate-sprites.mjs: no padding/extrusion anywhere** — atlas packed at runtime in src/render/sprites/buildAtlas.ts (follow-up read needed); mitigation today is Nearest sampling; palette ≤24, strict row validation, GK poses provably distinct.
- **power-cut-in.ts:** shouldPause always false; group skippable only if ALL skippable; juice beat sheet 65/130/220/240/260/360/560ms; POST_POWER 1500ms linger; frozen-clip outro deadlock handled. **`void reduceMotion;` at :45 — the accessibility flag is accepted and DISCARDED on the flash/shake/punch path.** Cap 4 concurrent.
- **Reduce Motion: well-plumbed (67 files)** — use-reduced-motion.ts (preference OR system, live subscription); modals animationType 'none'; timings halve (awards :87, cup-title 2600→2000, fulltime hold→0, score flash suppressed, PowerEffectScene pulse→1). **Gaps: SubstitutionBoard.tsx (animates, never reads flag), CupTitleCard.tsx component (duration aware, animation not), power-cut-in.ts:45 (discarded).**
- **Idle/attract: exactly one** — AwakeningCutsceneScreen CTA breathe (1.07 scale, 620ms×2 loop, reduce-motion correct). No inactivity timer anywhere; Advance Week static; guidance glow is static blue halo (guidance-glow.ts:16-23; gold reserved per docs/08); TutorialTapCue 430ms×2 only during tutorial.
- **League table reorder: NONE.** Static re-render, rows teleport (LeagueTableScreen:129-141, M2League:234); LayoutAnimation 0, reanimated layout/entering/exiting 0 repo-wide; only static styling (user club bg, promotion bg, ↑ arrow). Rows min-h-11 (38.5pt) but non-interactive.

## Top-10 for severity scoring

1. power-cut-in.ts:45 — `void reduceMotion;` discards the a11y flag on flash/shake/punch.
2. FacilityCompletionCard.tsx:38 — className on Animated.* (silently dropped).
3. DrillSceneOverlay.tsx:119,205 — the one useNativeDriver:false, width % progress bar on JS thread.
4. Zero FlatList/memoized rows — every table ScrollView+map.
5. No shared motion table — 37 inline literals / 26 distinct values + 31 scattered *_MS.
6. ManagementShell.tsx:480,488 — tab labels numberOfLines={1} no adjustsFontSizeToFit, Silkscreen, 7 locales.
7. haptic-cues.ts:11,14 — POWER_FIRED + GUST_* → possible double Heavy impact.
8. team-kit-ui.ts:11,13 — red-vs-blue default kit pair; safety behind a toggle.
9. No pitch/rate variation on ui-click/stat-step — every tap identical (only drill-result varies).
10. use-key-bindings.ts:92,126 + use-suspend-flush.ts:31-38 — document/window without typeof guard.

**Explicit cleans:** determinism 0 hits · no require-in-render · no dangerouslySetInnerHTML · audio rewind bug 0 (correct seekTo→play everywhere, bug documented+rejected) · no per-frame store writes · hover-latch closed by design · pixel snapping 9/9 paths honored.
