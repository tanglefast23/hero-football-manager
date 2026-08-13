# Adversarial audit — 2026-08-13 (audit3)

Four adversarial agents attacked the build from different directions, each
trying to break the game the way a real player might. Everything below was
verified against real execution; fixes landed on this branch with regression
tests. Baseline before fixes: full jest suite green (4,183 passed; 4
`store.test.ts` failures were cross-process contention from concurrent runs and
passed in isolation), `tsc --noEmit` clean, tree clean at cbef10c9.

## Attack surfaces

1. **Match engine fuzzer** (headless): determinism sweeps, replay round-trips,
   extreme rosters (all-1s to 999-everything), input-log abuse, tampered
   envelopes, quick-vs-watched parity, NaN hunting.
2. **Season/economy fuzzer** (headless): 30-season soaks, adversarial policies
   (sell everything, never renew, burn TP), 3-season deficit crises, save-field
   deletion fuzz, all 53 events at worst-case state, reload at every phase
   transition.
3. **Web chaos user** (live Vercel build, browser pane, muted): double-submit
   spam, hostile reloads, XSS/emoji/RTL names, save truncation in OPFS, locale
   walks, a real mid-session redeploy.
4. **iOS simulator user** (headless simctl + AXe taps, Release build of Aug 9
   main): onboarding spam, backgrounding/killing mid-match, language switches,
   crash-log sweep. Build was ~3 days stale, so every finding was re-verified
   against current code before acting.

## Fixed on this branch

### 1. Save bricked by quitting twice during a season-1 week 3–4 matchday (HIGH)
Quitting mid-matchday persists phase `matchday`. On reload,
`reconcileStoryYouthIntake` misread that phase as "pre-season window over": the
first reload silently deleted the open academy offers, and the second hit
`createPreseasonYouthIntake`'s manage-phase assert — every later load threw,
an unrecoverable "save could not be loaded" screen. Fix: expiry is now
week-based (`isWithinPreseasonWeeks`), and recreation requires the manage
phase. `src/game/youth-intake.ts`; regression:
`src/game/__tests__/youth-intake-reload.test.ts`.

### 2. Corrupt save: "Delete save · start fresh" loops forever (HIGH, web-verified live)
A truncated SQLite file (browser storage eviction) fails to load; the
repository-level delete then fails on the same broken connection ("cannot
start a transaction within a transaction"), and the player loops on the error
screen — only a manual page reload escaped. Fix: `discardUnreadableSave` now
reports `'deleted' | 'blocked' | 'failed'`, and on `'failed'` the app falls
back to the file-level `resetCareerDatabase` escape hatch the boot branch
already had, then reloads the document on web. The fallback is guarded: a
failed delete rolls back, so a readable backup may still be on disk with a
working Restore button — the wipe (which drops the backup table too) only
runs when `backupSummary` is null, i.e. when there is nothing left to
restore. `src/application/store.ts`, `App.tsx`; store tests assert all three
outcomes plus backup-survives-failed-discard, and a source gate pins the
App-side guard.

### 3. Stale web bundle after a redeploy strands the session (HIGH, web only)
A deploy replaces hashed chunks; a pre-deploy document 404s lazy screens
(`AsyncRequireError`). The error boundary caught it, but "Back to title" left
Continue silently dead — the rejected import stays rejected for the document's
lifetime. Fix: the boundary classifies chunk-load failures
(`src/ui/stale-bundle.ts`) and its button becomes "Reload the game" (new copy
in all 7 locales), reloading the document. `src/ui/ScreenErrorBoundary.tsx`;
regression: `screen-error-boundary-stale-bundle.test.ts`.

### 4. Goal credited to a substitute who entered while the shot was in flight (MEDIUM)
GOAL events named a lineup slot; a substitution landing during the ball's
flight (the emergency auto-sub path runs every tick) handed the goal to the
incoming player in the match report, season stats, contributions (which feed
awards), and the live banner. Fix: the shooter's stable id is stamped on the
ball at launch and emitted as `scoredById`, mirroring the existing
`assistedById` pattern; all three consumers use it. **ENGINE_VERSION m2.1 →
m2.2** (event shape change, no RNG or behavior change); both golden
fingerprints rebaselined under that decision — the goal golden (a scoring
match) carries the real `scoredById` payload change, while the runtime
golden's hash moves mainly because the fingerprint includes the version
string (its seed produces no goals). The parity-replay jest snapshot needed
no update. `src/sim/engine.ts`,
`src/sim/types.ts`, `src/game/matchday.ts`, `src/game/match-contributions.ts`,
`src/render/MatchScreen.tsx`; regression:
`src/game/__tests__/goal-scorer-substitution.test.ts`.

### 5. Hardcoded English shipped to six locales (MEDIUM)
- Character creation: `StickerWord text="hire"`, literal `left`, and the raw
  difficulty enum shown as `CHAIRMAN (…)` (display + a11y + panel stamp). Now
  catalog-driven; the difficulty name reuses the `settings.difficulty.*` keys
  so the two surfaces cannot drift. Locale `yourFirst` values recomposed so
  the masthead phrase stays grammatical per language.
- Continue label: `Season X · Week Y` was interpolated English —
  now `newGameWelcome.seasonWeek` in all 7 locales.
- Next-match venue chip: `Home`/`Away`/`Boardroom` were English literals in
  the view model — now `m2League.venueHome/venueAway` (reused) and a new
  `clubHome.venueBoardroom` in all 7 locales.
All 18 i18n gate suites green, including vi glyph coverage.

### 6. Settings rows collide label into value in es/fr/de (LOW-MED)
"PRESIÓN DE LA CARRERAPRESIDE…" — the label/value row gave neither Text a flex
constraint, so long locale labels overlapped the value. All 15 row labels in
`SettingsOverlay.tsx` are now `flex-1` (wrap instead of collide).

### 7. Mid-word wraps: "POTENTI AL", "FORMATIO N" (LOW)
Pixel-font labels in narrow containers broke mid-word. The three
`market.potentialValue` labels and the match-HUD FORMATION label now use
`numberOfLines={1}` + `adjustsFontSizeToFit`.

### 8. Uncaught AbortError rejections from audio `play()` (LOW, web)
expo-audio's web player calls `HTMLMediaElement.play()` without a catch, so
backgrounded tabs spam uncaught rejections unreachable from any app call site.
A narrowly-scoped `unhandledrejection` filter in `index.web.ts` swallows
exactly that error shape.

## Investigated, no change

- **iOS "tap again to delete never deletes"**: the agent had tapped "Export raw
  save" first; a requested export that never finishes blocks deletion *by
  design* ("Raw save export was requested but did not finish. The save has not
  been deleted."). The confirm window is already 5s. Working as intended.
- **Training modal tap-through**: a 350ms post-presentation deafness guard
  already exists (`PRESENTATION_SETTLE_MS`); the agent's remote taps were
  ≥350ms apart. Skippable presentations are by design; nothing double-spends
  (the confirm still gates TP). The constant is the tuning knob if it ever
  feels too short on-device.
- **Conflicting tutorial cues** (stale RETURN HOME pointer + coach banner):
  observed on the Aug 9 build; PR #151 (merged Aug 12) reworked exactly this
  guard/focus coupling. Not reproduced on current code; re-check on the next
  device build.
- **Sim hardening notes** (recorder emits an envelope its own replayer refuses
  under test-only manual-tap instrumentation; cross-team player-id uniqueness
  unenforced): both unreachable in the shipped game; documented for whenever
  manual taps return.
- **Defensive observation**: `synchronizeM2ActiveDivision` sub-11 roster
  softlock is not reachable (bench-only special heroes keep the floor at 12).

## What held under attack (evidence, not absence)

Determinism: 50-seed byte-identical reruns, 20-seed envelope round-trips,
8-seed randomized fuzz with sub-of-a-sub scripts — all byte-identical replays;
no `Math.random`/`Date.now` in the pure rings. Quick Result vs watched:
byte-identical events and reveal ledgers. Economy: 30-season soaks and
sustained-deficit crises never produced NaN, negative-beyond-floor cash, wage
drift, or an unstageable match; exactly one emergency loan fires. Save fuzz:
every deleted field either loads or raises a clean `CorruptCareerSaveError`.
Web double-submit spam: every spend/hire/sign/advance landed exactly once;
XSS/emoji/RTL names render as literal text; hostile reloads always resumed
sane state; the pending match cannot be reload-skipped. iOS: backgrounding and
killing mid-match reconciles cleanly; zero crash reports; all 7 languages
live-switch with Vietnamese diacritics intact.

## Known limits of this audit

The browser pane ran occluded (0×0, no rAF), so mid-match web interactions and
visual checks were not exercised there; the iOS pass covered match flow
instead, on a 3-day-stale build. The same rAF freeze affects real users who
background the tab on an animation-gated splash (state survives; resumes on
return). Not fixed here: skew protection at the platform level (Vercel) would
remove class 3 entirely and is worth a look.
