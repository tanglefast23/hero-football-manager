import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const DIST = path.resolve('dist');
// Ratcheted from the measured English title load. Both allowances are 5 KB
// above the accepted artifact, so ordinary feature growth eventually needs a
// deliberate re-ratchet and a one-off leak still trips the gate.
//
// Re-ratcheted 2026-08-13 off PR #158's merge artifact (audit2 + main), CI-
// measured at 5_917_682 raw / 874_253 gzip. Growth since the 2026-08-12 mark
// (5_896_612 raw / 868_302 gzip) is +21_070 raw / +5_951 gzip, spread across
// four merges: win bonus + story rewards (78c35279), the audit2 hardening
// sweep, substitution entry energy (#157), and the audit3 adversarial fixes
// (59175c5b: error-boundary reload path, seven-locale catalog additions).
// Checked before moving the number, same as last time: the QA and Skia marker
// assertions below both stayed clean, so this is distributed feature growth,
// not a renderer or dev-harness leak.
//
// Merge note, same day: #159 independently re-ratcheted main to 5_908_835 /
// 875_599 off a main-only artifact (5_903_715 / 870_479, its own branch adding
// ten raw bytes). The audit2 merge artifact above is the larger superset, so
// its marks win this conflict; #159's growth attribution for main agrees with
// the four-merge account above.
//
// Re-ratcheted 2026-08-15 off this branch's artifact, measured by this script
// at 5_972_355 raw / 888_727 gzip. The raw figure matches CI's to the byte.
//
// The overrun is not this branch's. `origin/main` at 2388ec6d was measured the
// same way, from its own clean export: 5_972_170 raw / 888_693 gzip — already
// 49_368 raw past the old mark. This branch adds 185 raw and 34 gzip, which is
// the seven-locale `clubHome.managerNameDefault` key and nothing else.
//
// Nobody saw the breach because `format:check` runs first and has been failing
// on main since at least b9c6d7a5, so the budget check has not been reached on
// main for five commits: b9c6d7a5, bf473af5, bf3bbe93, 440a8fdb, 2388ec6d.
// Growth since the #158 mark is +54_488 raw / +14_440 gzip across those five.
// Checked before moving the number, same as last time: the QA and Skia marker
// assertions below both stayed clean, so this is distributed feature growth,
// not a renderer or dev-harness leak.
//
// Re-ratcheted again, same day, after merging main's 24a5d08e and 5e069a30.
// The mark above was measured before those landed, and they brought the new
// career-event stories, the deepened scouting copy and their seven-locale
// catalog keys with them: +21_520 raw locally, 5_972_355 -> 5_993_875.
//
// The number below is set from CI's own figure for the merge commit,
// 5_994_912, which runs about a thousand bytes above a local export of the same
// tree. CI is the measurement that has to pass, so CI is the one ratcheted
// against. Markers clean again — no QA bodies, no Skia in the title load.
//
// Re-ratcheted 2026-08-16 off CI's figure for 6a2c27e2 on
// fix/honest-first-season-market: 6_000_786 raw / 896_680 gzip. Raw ate the old
// 5 KB headroom and 874 bytes past it; gzip is still 2_900 under its old mark.
//
// The growth is English catalog keys, and the first-load set is why. Locale
// bundles ship as their own chunks (de-*.js and friends) and are not in
// `firstLoadFiles`, so only the English strings land in `index-*.js`. This
// branch adds ten: six for the `scout-report-unaffordable` sequence, and four
// for the Coaching Office levels, the scout range note and the storage warning.
// The rest is the branch's game code — match-day form, Coaching Office levels,
// the save reconnect.
//
// Checked before moving the number, same as every time: CI reported
// `qaBodyMarkers: []` and `skiaBodyMarkers: []` on the failing run. That matters
// here because 6a2c27e2 touches the dev-harness reel — the markers prove none of
// it reached the title load.
//
// Nobody saw this breach until now for the usual reason: `format:check` is the
// first gate in the same job and had been failing, so the budget check was never
// reached. Fixing the formatting is what exposed it.
//
// Re-ratcheted 2026-08-16 off CI's figure for 33bbf4b0 on
// feat/hero-license-purchase: 6_007_581 raw / 898_981 gzip. Local export of the
// same tree read 6_006_479, so CI still runs about 1_100 bytes high, and CI is
// what has to pass.
//
// This one IS the branch's, unlike the last several. `origin/main` at 3a93760b
// was exported and measured the same way: 5_999_703 raw / 896_385 gzip, which
// is 6_083 UNDER the old mark. So the +6_776 raw is this branch and nothing
// inherited. It is spread across fourteen English catalog keys for the permit
// office, the glossary's extended Hero License entry plus its new Permit office
// entry, the match-day panel itself, and the club name pools going from fifteen
// words to a hundred.
//
// Gzip is deliberately NOT moved. It reads 898_981 against a 901_680 mark, so
// it never breached; raising a budget nothing has hit is loosening for free.
//
// Markers checked before moving the number, and harder than usual, because this
// branch adds a dev-harness entry. `qaBodyMarkers` and `skiaBodyMarkers` were
// both empty on CI's failing run, and three strings unique to the new entry —
// "Hero License permit office", "Third permit at",
// "hero-license-shop:first-matchday" — return zero hits in both `index-*.js`
// and `__common-*.js`. The entry is lazy and stayed lazy.
//
// Worth knowing for the next person: `"Cup mismatch warning"` DOES appear in
// `index-*.js` on main, and no marker in QA_BODY_MARKERS catches it. The marker
// list proves the absence of the three strings it names, not the absence of the
// harness. Widening it is a separate job from this branch.
//
// Re-ratcheted 2026-08-16 off CI's figure for e052a5c1 on
// claude/coach-motivational-speech-0bbc30: 6_018_860 raw / 902_095 gzip. A
// local export of the same tree read 6_017_823 / 901_868, so CI still runs
// about 1_000 bytes high, and CI is what has to pass.
//
// Split, because this one is BOTH the branch's and inherited. `origin/main` at
// 84a30233 was exported and measured the same way: 6_011_010 raw / 900_102
// gzip — already 3_429 raw past the old mark on its own. The mark was set from
// CI's figure for 33bbf4b0 (#166's branch), and #168 landed after it. So of the
// 10_242 raw this branch reports over the old mark, 3_429 arrived with main and
// 6_813 is this branch: sixteen English catalog keys for the speech button,
// its confirmation sheet and the half-time sheet, Bert's two-page briefing in
// `assistant-guide.json`, the pure `coach-speech.ts` module, and the Staff
// board button with its view model. Gzip splits the same way — main is 1_578
// UNDER its old mark, this branch adds 1_766, so the 415-byte CI breach is the
// branch's and the number moves.
//
// The locale bundles are again not the story: `de-*.js` and friends are their
// own chunks and not in `firstLoadFiles`, so only the English half of the
// seven-language copy lands in `index-*.js`.
//
// Markers checked before moving the number, as every time, and with the same
// care #166 needed, because this branch also touches the dev-harness reel —
// `assistant-beats.tsx` gains the new sequence id, its `SPEECH` chip label and
// a group entry. CI reported `qaBodyMarkers: []` and `skiaBodyMarkers: []` on
// the failing run, and three strings that exist only in that harness entry —
// "Requests, injuries, the loan", "AUTHORED_EXPRESSION_RUNS", "Bert beats" —
// return zero hits in `index-*.js`. The entry is lazy and stayed lazy.
//
// Worth knowing for the next person: do NOT grep the title bundle for the chip
// label `SPEECH` to check that. It hits seven times on a clean build, every one
// of them inside `MOTIVATIONAL_SPEECH`, the sim's own input kind, which belongs
// in the first load. A substring of app code is not a harness marker.
//
// Previous marks: 6_007_581 / 901_680 at 33bbf4b0 (#166), 6_005_786 / 901_680
// at 6a2c27e2, 5_994_912 / 894_580 at the 2026-08-15 merge, 5_977_355 /
// 893_727 earlier that day, 5_922_802 / 879_373 at #158, 5_908_835 / 875_599 at
// b26e1399 (#159), 5_896_612 on the stat-tip branch, 5_891_821 at 0128bcc4,
// 5_861_753 at 0b2fc042.
// Re-ratcheted 2026-08-16 (shot-danger branch), on top of the entry above after
// merging #170. All of this one is the branch's, and it is small: a local export
// of this tree reads 6_018_178 raw / 901_962 gzip against #170's own local
// figures of 6_017_823 / 901_868, so the branch is **+355 raw / +94 gzip**.
//
// That +355 has now been measured against three separate main baselines
// (5c4d7303, 84a30233, e052a5c1) and come out identical every time, which is
// what makes it trustworthy rather than a sampling artifact. It is
// `shot-danger.ts`, the `shot-scorch` cue entry in `audio.ts`, and the
// shot-tier branch in the MatchScreen tick loop. `ball-flame.ts` does not
// appear: it lands in `SkiaSurfaceImplementations-*.js`, which is not a
// first-load file.
//
// Both marks move this time. Local passes both, but CI is what has to pass and
// CI runs high by a per-stream offset. Raw was predicted from the measured
// +1_037 (CI reported 6_008_191 for a tree this repo read at 6_007_154), and
// CI then reported exactly 6_019_215 — the prediction to the byte.
//
// Gzip took two goes, and the correction is the useful part. Deriving its
// offset from #170 (901_868 local -> 902_095 CI) gave +227, so the mark was
// first set to 902_189. CI reported 902_225: the real offset for this tree is
// **+263**. So the raw offset transfers between branches and the gzip offset
// does not — compression ratio depends on content, so a byte count borrowed
// from someone else's tree is a guess. Both numbers below are now CI's own
// figures for THIS tree, which is what the entries above meant by ratcheting
// against CI.
//
// Gzip is NOT being loosened for free here — unlike the last two entries it
// genuinely breaches, by about 94 bytes locally.
//
// Markers checked before moving the numbers, and this branch does touch the dev
// harness: it renames the Match VFX shot case. `qaBodyMarkers` and
// `skiaBodyMarkers` were both empty, and three strings unique to the renamed
// case — "Top-tier shot danger", "Dangerous Shot", "dangerous-shot" — return
// zero hits in `index-*.js` and `__common-*.js`. The entry is lazy and stayed
// lazy. Heeding the warning above, none of those three is a substring of app
// code: the sim's shot grading uses no such string.
// Re-ratcheted 2026-08-16 (speech-cutscene branch), on top of the entry above
// after merging main at a7d2c6bb. All of this one is the branch's.
//
// The delta was measured against TWO different main baselines and came out
// byte-identical, which is the agreement the entry above calls trustworthy:
// against e7851793 (#170's tree, local 6_017_823 / 901_868) and against this
// merge (main local 6_018_178 / 901_962), the branch adds **+5_508 raw** both
// times. Gzip reads +1_483 and +1_518 across the two — close, but not identical,
// which is the compression-ratio point the entry above makes.
//
// Merged tree, measured locally by this script: 6_023_686 raw / 903_480 gzip.
//
// What the +5_508 is: the twenty English speech lines in
// `coach-speech-lines.json`, `MotivationalSpeechCutscene.tsx` and
// `coach-speech-audio.ts` — both reached eagerly from `MatchScreen`, which is
// deliberate, because the cutscene has to appear on the frame the sheet is
// confirmed and a lazy chunk fetch is the wrong thing to put there — plus the
// `coach-portrait.ts` resolver and three English chrome keys. The six locale
// catalogs are again not the story: a Spanish line returns 0 hits in
// `index-*.js` and 1 in `es-*.js`.
//
// Offsets, heeding the correction above rather than repeating it. Raw uses the
// +1_037 that has now transferred between branches unchanged three times:
// 6_023_686 -> 6_024_723. Gzip does NOT transfer, and the entry above measured
// +263 for its own tree; that is the nearest available estimate and it is used
// here as an estimate, not a fact: 903_480 -> 903_743. If CI reports a
// different gzip figure, take CI's and say so, exactly as the last entry did.
// If CI comes in under either mark, ratchet DOWN rather than banking the slack.
//
// Markers checked before moving the numbers, and this branch does add a
// dev-harness entry. The script reported `qaBodyMarkers: []` and
// `skiaBodyMarkers: []`, and three strings unique to that entry —
// "Motivational speech cutscene", "Half-time team talk", "Reduced motion ON" —
// return zero hits in all three first-load files. The entry compiles into
// `SkiaSurfaceImplementations-*.js`, which is not a first-load file. It is lazy
// and stayed lazy. None of the three is a substring of app code.
//
// Worth the next person's time: this number keeps going one way, and the reason
// is now measured. ~3.6 MB of the ~6.0 MB first load is sprite JSON imported as
// modules (`sprites.json` 1.98 MB, `portraits.json` 1.36 MB,
// `management-sprites.json` 269 KB). A brief for getting the number DOWN is in
// docs/plans/2026-08-16-first-load-budget-investigation-handoff.md.
// Re-ratcheted 2026-08-16 (desktop possession card + swap-board dimming), on
// top of the entry above. All 31 bytes of it are this branch's, and the
// arithmetic is the cleanest this file has recorded.
//
// `origin/main` at 4dd164cb was exported and measured by this script:
// 6_023_686 raw / 903_480 gzip — the exact local figure the entry above wrote
// down for the merged tree, so main has not drifted a byte since. This branch's
// own export reads 6_023_717 / 903_492, which is **+31 raw / +12 gzip**. CI
// reported 6_024_754 raw for the same tree: local + the same +1_037 offset,
// transferring unchanged for the fourth branch running.
//
// What the +31 is: three desktop style entries on the possession card, the
// optional `height` prop on `HeroChargeMeter`, and the `blocked` prop that
// fades an unavailable card on the substitution board. No new copy in any
// locale, and no new module.
//
// Raw takes CI's own figure for this tree, 6_024_754, per the rule the entries
// above settled on. Gzip is NOT moved: CI read 903_676 against a 903_743 mark,
// so it never breached, and raising a budget nothing has hit is loosening for
// free. It is not ratcheted DOWN either — the mark was set one entry ago from a
// +263 estimate that CI has yet to test, so tightening onto this branch's
// figure would bank an offset nobody has measured.
//
// Markers checked before moving the number, as every time: CI reported
// `qaBodyMarkers: []` and `skiaBodyMarkers: []` on the failing run. This branch
// adds no dev-harness entry, so there is no third-string check to run.
// Ratcheted DOWN 2026-08-16 — the first time this number has gone down. The
// two big pixel sheets left the first load. This tree, merged with main at
// 97b9116c, reads **3_403_068 raw / 829_704 gzip** against the 6_023_717 /
// 903_492 the entry above measured for main itself: **-2_620_649 raw (-43.5%)
// / -73_788 gzip**.
//
// The attribution is exact rather than approximate, which is worth recording
// because the entries above kept having to split growth between a branch and
// what it inherited. This branch measured 3_397_529 / 828_115 before merging
// anything. Adding the two deltas the entries above measured for themselves —
// +5_508 raw for the speech cutscene, +31 for the possession card — gives
// 3_403_068, the merged figure to the byte, across two separate merges.
// Nothing in this change moved with either of them.
//
// What moved, and why it was in there at all:
//
// - `sprites.json` (1_563_286 raw / ~43_760 gzip in the bundle) reached the
//   first load twice over. `src/ui/title-match-sprite-model.ts` imported the
//   whole 1893-sprite pool so the title pop scene could draw 13 of them, and
//   `src/render/PlayerRunSprite.web.tsx` imported the same module for the
//   walk-ons, podium, ledger and awards screens that `App.tsx` imports
//   eagerly. The title now imports `title-sprites.json`, a 14 KB subset
//   EXTRACTED from the checked-in sheet by `scripts/generate-title-sprites.mjs`
//   — extracted, not regenerated: `scripts/generate-sprites.mjs` has drifted
//   from what ships (the hair ramp, see `hair-skin-separation.test.ts`), so a
//   regenerated subset would quietly change title pixels.
// - `portraits.json` (1_069_840 raw / ~28_276 gzip) reached it through
//   `pixel-portrait-model.ts` -> `PixelPortrait`, used by the squad, market,
//   club-home and character-creation screens, all eagerly imported.
//
// Both are now fetched as their own chunks (`sprites-*.js`, `portraits-*.js`)
// by `src/render/sprites/pixel-sheets.web.ts`, warmed by `prefetchPixelSheets()`
// at `App.tsx` module eval while the title draws its own subset. Native keeps
// the static imports — `pixel-sheets.ts` is the non-web half of the pair — so
// iOS behaviour is unchanged.
//
// The trap this cost an export to find, for whoever tries the same thing on
// another asset: **`import()` alone does not get a module out of the first
// load.** The first attempt left `loader.ts` importing `sprites.json`
// statically inside the lazy match chunk, so the sheet was shared between the
// main graph and an async graph, and Metro answered by hoisting all 1.5 MB
// into `__common-*.js` — which is itself a first-load file. Measured result of
// that version: 6_029_873 raw, i.e. 11 KB WORSE. The saving only appears when
// exactly ONE module imports the JSON. `pixel-sheets.ts` is that module and
// must stay that module; `loader.ts` now calls `requirePixelSheets()`.
//
// `management-sprites.json` (215_425 raw but only ~10_063 gzip) was left
// eager on purpose. `ManagementSprite` takes its height from the sprite rows,
// so a late arrival would reflow the finances and staff rows — the worst
// bytes-per-risk of the three sheets, and the only one that can shift a
// layout.
//
// Raw below is this tree's local figure plus exactly the +1_037 CI offset,
// which the entries above have now seen transfer between branches unchanged
// four times: 3_403_068 -> 3_404_105. Gzip does NOT transfer, so its +400 is a
// rounded-up guess off the +263 the shot-danger entry measured for its own
// tree — an estimate, said out loud, not a fact: 829_704 -> 830_104. Per the
// convention here: if CI reports lower, ratchet down to CI's own figure rather
// than banking the slack.
//
// Markers checked, as every time: `qaBodyMarkers: []` and `skiaBodyMarkers: []`
// on the local export. Verified in the browser pane as well as by byte count —
// the title pop scene draws its two SVG sprites from the subset, and the
// character-creation portrait draws from the fetched `portraits-*.js`.
// 2026-08-17, the in-app privacy link. Apple requires the submitted privacy
// policy to be reachable from inside the app, so Settings -> Privacy & Support
// gained a Read privacy policy action: a `Linking.openURL` callback in
// `App.tsx`, the `PRIVACY_POLICY_URL` constant, one `ActionButton`, the
// `onOpenPrivacyPolicy` prop threaded through `SettingsOverlay` and
// `TitleLandingScreen`, and three new English catalog strings. Only `en.json`
// is in the startup graph — the other six locales are dynamic imports — so this
// is the English strings plus the code.
//
// Measured, not estimated: +955 raw local (3_403_068 -> 3_404_023) and +231
// gzip (829_704 -> 829_935). CI first reported 3_405_060 against the old
// 3_404_105 budget, which is the local figure plus exactly the +1_037 offset
// the entries above have now seen transfer unchanged five times. A local run
// passed this by 82 bytes before CI failed it by 955 — the offset is the whole
// reason, so **do not trust a local pass inside 1 KB of the budget.**
//
// Raw is therefore local + 1_037: 3_404_023 -> 3_405_060, which is CI's own
// reported figure rather than banked slack. Gzip keeps the same +400 rounding
// as the entry above: 829_935 -> 830_335. Per the convention here, if CI
// reports lower than either, ratchet down to CI's figure.
//
// 2026-08-18, the match-day formation picker. The Team Sheet chip cycled
// blind, so the manager saw 3-4-3 and never learned it was all-out attack. It
// now opens `FormationPickerModal`: every coachable shape with its diagram,
// its number and its name. All copy is existing catalog keys, so this is the
// component and nothing else — `FixtureMatchDayScreen` is already in the
// startup graph, and so is every part the modal draws (`FormationDiagram`,
// `ActionButton`, `PixelText`, `CrossPlatformModal`).
//
// Measured, not estimated: +2_887 raw local (3_404_023 -> 3_406_910) and +562
// gzip (829_935 -> 830_497). NOT lazily loaded, deliberately: 562 gzip bytes
// is what a player actually downloads for it, and a chunk fetched on the tap
// that opens the modal would buy that back at the price of a round trip under
// a blank sheet, on the one screen the manager visits before every match.
//
// Raw takes CI's own reported 3_408_012 rather than local + 1_037 (3_407_947).
// The extra 65 bytes are the three Expo patch bumps in the same branch —
// expo 57.0.14, expo-asset 57.0.12, expo-splash-screen 57.0.7 — which a local
// export cannot see, because a worktree resolves node_modules up-tree from the
// main checkout and that tree is still on 57.0.13. Gzip keeps the same +400
// rounding: 830_497 -> 830_897, and CI has not reported its own gzip figure
// for this tree because raw failed first. Per the convention here, if CI
// reports lower than either, ratchet down to CI's figure.
// 2026-08-18, the scout cue, the hidden slips and the turned carrier. Three
// small edits, all in files the startup graph already pulls in: an optional
// `pressSfx` on `SmallAction` plus one `pressSfx="positive"` in
// `MarketScreen`, a `scoutOut` guard that hides the mission-slip picker while
// a scout is in the field, and a `carryingUpScreen` argument threaded from
// `MatchScreen` into `runFrameFacingBall`. No new module, no new asset, no new
// catalog string.
//
// Measured by CI, not estimated and not measured locally: +2_083 raw
// (3_408_012 -> 3_410_095) and +578 gzip (830_897 -> 831_475). This is the
// first entry here that takes BOTH figures straight from a CI run, because CI
// reported gzip alongside raw this time instead of failing on raw first.
//
// Larger than the diff looks — roughly 30 lines of code, where the entries
// above spent about 1 KB for comparable work. Unexplained, and said so rather
// than dressed up: nothing was measured locally, since a worktree resolves
// node_modules up-tree and cannot reproduce CI's tree. Per the convention
// here, if a later CI run reports lower, ratchet down to that figure.
// 2026-08-18, five merges that were never weighed. This entry is not one
// feature's spend; it is the arrears of a gate that stopped running. CI's
// `typecheck + fast tests` job runs `npm run format:check` FIRST, and eight
// files had drifted from Prettier, so the job died at step one and this check
// never executed. Five feature merges landed on main behind that failure:
// f5d0058d the banked-power hero look, e8784659 the hit-stop and the two match
// numbers, 1933b056 the pass combo cue, faace1e1 the substitution walks, and
// cc328004 the goal ticker. Between them they spent 499 raw and 136 gzip.
//
// Measured by CI, both figures, on the run that first got past format:check:
// +499 raw (3_410_095 -> 3_410_594) and +136 gzip (831_475 -> 831_611).
//
// 0.015% for five features is cheap, and the markers below both came back
// empty, so nothing was dragged into the first load by accident — this is
// drift, not a mistake. What it cost was the visibility: had the gate been
// running, each of those five would have written its own line here. The five
// are recorded together because that is what actually happened, not split
// into five invented attributions. Per the convention here, if a later CI run
// reports lower, ratchet down to that figure.
// 2026-08-18, the SHOT! call beside the shot power number. `ShotPowerPop`
// now draws two texts instead of one — a localised word and the number — so
// it gained a second set of paths, a pair of x offsets and a second entrance,
// plus `shotPowerCellPx` in `shot-power-pop.ts`, one `!` row in the pixel
// face, and the `matchScreen.shotPop` string. Only `en.json` is in the
// startup graph, so the other six locales cost nothing here.
//
// Measured by CI, not locally: 3_410_624 raw and 831_622 gzip, on a tree that
// already carried all five merges the entry above settles. Against that
// entry's figures the pop itself is +30 raw and +11 gzip — small because the
// second text reuses `buildLocalPaths` and the 3x5 face rather than adding a
// module. Both numbers are CI's own, not local + offset: a worktree resolves
// node_modules up-tree and cannot reproduce CI's tree. Per the convention
// here, if a later CI run reports lower, ratchet down to that figure.
//
// 2026-08-18, the live-match efficiency pass. No new module, no new asset, no
// new catalog string — the bytes are the guards the perf fixes added to files
// already in the startup graph: the empty-emitter fast path and its lazy
// shared paths in `ProceduralMatchEffects`, the `[rotation, usesActionCell]`
// pose tail written and read in `worklet-atlas-frame`, the `railLayout` /
// `swapOpen` view-model gates and the `IncapacityCountdowns` mount gate in
// `MatchScreen`, the render-time web strip in `HeroChargeMeter`, the `memo`
// wrapper on `MatchTickerLine`, and the substitution pre-scan plus the shot
// early-return in the sim. Bytes spent at load to stop per-tick and per-frame
// churn for the whole match — the trade this ledger exists to make visible.
//
// Measured by CI, both figures, on a merge tree already carrying all of the
// entry above: +184 raw (3_410_624 -> 3_410_808) and +42 gzip
// (831_622 -> 831_664). Both numbers are CI's own, not local + offset. Per
// the convention here, if a later CI run reports lower, ratchet down to that
// figure.
//
// 2026-08-18, the formation role labels. DEF/MID/FWD plates under the
// controlled team's outfield after a formation change. This branch earlier
// re-ratcheted gzip by nine bytes (831_611 -> 831_620) against a pre-SHOT!
// mark. That raise is superseded: the labels live behind LazyMatchScreen, so
// none of the feature reaches the first load. The nine gzip bytes were
// content-hash compression noise, not feature code. Main's later marks
// already cover them. No new raise.
const RAW_BUDGET = 3_410_808;
const GZIP_BUDGET = 831_664;
const QA_BODY_MARKERS = [
  'DEV HARNESS',
  'Development builds only. Deep link',
  'Show the ceremony case',
];
const SKIA_BODY_MARKERS = ['SkiaViewApi', 'JsiSkCanvas'];

const html = readFileSync(path.join(DIST, 'index.html'), 'utf8');
const browserEntryPaths = [
  ...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g),
].map((match) => match[1]);
if (browserEntryPaths.length === 0) {
  throw new Error('dist/index.html has no JavaScript entry');
}

const indexPath = browserEntryPaths.find((file) =>
  /\/index-[^/]+\.js$/.test(file),
);
if (indexPath === undefined) {
  throw new Error('dist/index.html does not load an index bundle');
}
const indexSource = readFileSync(resolveDistPath(indexPath), 'utf8');
const appMatch = indexSource.match(
  /"(\/_expo\/static\/js\/web\/App-[^"]+\.js)"/,
);

// App can be in the index entry or in an immediate child chunk. Match and QA
// renderers are lazy and are not part of the title's first load.
const firstLoadPaths = [
  ...new Set([
    ...browserEntryPaths,
    ...(appMatch === null ? [] : [appMatch[1]]),
  ]),
];
const files = firstLoadPaths.map((file) => ({
  file,
  source: readFileSync(resolveDistPath(file)),
}));
const rawBytes = files.reduce((total, file) => total + file.source.length, 0);
const gzipBytes = files.reduce(
  (total, file) => total + gzipSync(file.source, { level: 9 }).length,
  0,
);
const combined = Buffer.concat(files.map((file) => file.source)).toString(
  'utf8',
);
const qaMarkers = QA_BODY_MARKERS.filter((marker) => combined.includes(marker));
const skiaMarkers = SKIA_BODY_MARKERS.filter((marker) =>
  combined.includes(marker),
);

console.info(
  JSON.stringify(
    {
      firstLoadFiles: firstLoadPaths,
      rawBytes,
      rawBudget: RAW_BUDGET,
      gzipBytes,
      gzipBudget: GZIP_BUDGET,
      qaBodyMarkers: qaMarkers,
      skiaBodyMarkers: skiaMarkers,
    },
    null,
    2,
  ),
);

if (rawBytes > RAW_BUDGET) {
  throw new Error(
    `first-load JavaScript is ${rawBytes} bytes; budget is ${RAW_BUDGET}`,
  );
}
if (gzipBytes > GZIP_BUDGET) {
  throw new Error(
    `first-load JavaScript gzip is ${gzipBytes} bytes; budget is ${GZIP_BUDGET}`,
  );
}
if (qaMarkers.length > 0) {
  throw new Error(`QA bodies leaked into first load: ${qaMarkers.join(', ')}`);
}
if (skiaMarkers.length > 0) {
  throw new Error(
    `Skia renderer leaked into title first load: ${skiaMarkers.join(', ')}`,
  );
}

function resolveDistPath(urlPath) {
  return path.join(DIST, urlPath.replace(/^\//, ''));
}
