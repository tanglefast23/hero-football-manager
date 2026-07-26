# Full audit — findings for review (2026-07-26)

Seven parallel adversarial audits: bugs (sim/game), bugs (state/persistence), render/UI + the possession-duel question, efficiency (with real measurements), an antagonistic decision review, an overcomplication review, and game-feel research. Every finding was verified against code before being believed; claims that died in verification are recorded in §6.

**Status of the worktree, read this first.** The owner's instruction to "fix immediately" was amended to "findings only" mid-session, after a fix pass had already been implemented and typechecked. Nothing is committed. Every change sits uncommitted in the worktree `game-audit-polish-b5ac31` for review:

- Items marked **[IMPLEMENTED]** below are coded, typecheck-clean, and awaiting your accept/reject. Baseline suite was green (207 suites / 1626 tests); a post-change full-suite run was still in flight when this document was written — its result is recorded at the bottom of §7.
- Items marked **[PROPOSED]** were deliberately not coded.
- Items marked **[DECISION]** are yours to make.
- To **discard** the entire implemented pass: `git -C <worktree> checkout -- . && git clean -fd .github` (the findings file itself will survive a re-save). To **accept**: review the diff (`git diff`) and commit.

Engine note: nothing in the implemented pass touches replay behavior — `src/sim` received one comment fix and one test rename, so **ENGINE_VERSION correctly stays m1.29** and no snapshot regeneration is needed.

---

## 1. Bugs and edge cases

All verified end-to-end (code-path traces; the backup bug was additionally reproduced live by an executed test).

| # | Severity | Finding | Status |
|---|---|---|---|
| B1 | **P1** | **Career hard-brick**: buying a pyramid club's last positional cover (e.g. both its GKs) hollows its squad below the 1 GK / 4 DEF / 4 MID / 2 FWD template. Nothing ever refills pyramid squads, so when that division becomes active after promotion, `startingEleven` (full-career.ts) throws "generated opponent cannot form a starting eleven" — and `startNextSeason` throws forever. Permanent brick. | **[IMPLEMENTED]** `market-career.ts`: club refuses to sell its last cover; checked at talk-open and re-checked at completion. Regression test added |
| B2 | **P1** | **Backup resurrection**: the backup save slot is keyed on season number only (`career-repository.ts`). Start career A → start new career B (both season 1, so the backup write is skipped and A's backup survives) → B's live slot corrupts → "Restore backup" silently installs abandoned career A, whose replays were already deleted. Reproduced by an executed jest repro. | **[IMPLEMENTED]** DB migration v5 adds `career_seed`; a different career's first save replaces the backup immediately. Regression test added |
| B3 | P2 | Facilities grant their training multiplier **while still under construction** (`training.ts` counts buildings without `isFacilityOperational`). Same bug class as the already-fixed "unbuilt Medical Bay treated injuries" — training was the one lookup missed. | **[IMPLEMENTED]** operational filter added |
| B4 | P2 | **Banked milestones lose their recognition story at season rollover**: `pendingCareerMilestoneEventId` recomputes "earned" from live fixtures, which `startNextFullCareerSeason` replaces — so a milestone banked in week 28 whose story hadn't resolved by week 30 is never acknowledged. Also triggered by a negative-fans event dropping a banked crowd milestone. | **[IMPLEMENTED]** recognition reads banked `eventFlags` ∪ live recompute. Regression test added |
| B5 | P2 | **Transfer-talks retry exploit**: the negotiation id is week-stable, so closing and reopening talks re-deals the identical deterministic pitch-card deck at round 0 — the 3-round cap and walk-away penalty can be retried away. The in-code comment claims a guard exists; it only blocks *concurrent* talks. | **[IMPLEMENTED]** closing records the abandoned negotiation id in `CareerMarketState`; reopening that week is refused. Regression test added |
| B6 | P2 | **Two fit GK starting-promises freeze all lineup editing**: the settlement fail-soft deliberately leaves the second promise unhonoured (one GK slot), but `assertCareerLineupHonorsContractPromises` demands both — so every `setCareerLineup`/`swap` throws for the promise's whole duration. | **[IMPLEMENTED]** the assert now enforces only what the fail-soft can honour (1 GK, ≤10 outfield, same seniority order) |
| B7 | P3 | Promise hero-limit check uses the **live division** while `careerHeroLimit` ratchets on highest-reached — after relegation from D1 you can field 4 heroes but can't promise a 3rd/4th. | **[IMPLEMENTED]** `highestDivisionReached` in both |
| B8 | P2 | **AI-fixture quick results credit a substitute's goal to the player who was subbed off**: `scorerIdsFromEvents` resolves `event.by` against the original TeamDef (starters), but after auto-subs the slot's `def` is the replacement. Feeds season goal tallies. Goal→scorer extraction existed three times; the third was wrong. | **[IMPLEMENTED]** one shared extraction against the final match state; `quickResultForFixture` now delegates to `quickMatchForFixture` |
| B9 | P2 | **Watched-vs-quick awakening divergence**: a bench player who came on via auto-sub can awaken after a watched match but not after Quick Result of the same fixture (two different "who played" helpers) — quietly contradicting the quick-result parity promise. | **[IMPLEMENTED]** quick path returns the final `MatchState`; both paths share `userMatchParticipantIds` |
| B10 | P2 | **Boot fragility**: a failed reconciliation write-back (e.g. full disk) inside `initializePersistence`'s try turns a perfectly readable save into the "save could not be loaded" screen — whose options include deleting the career. | **[IMPLEMENTED]** career installs first; write-back rides the normal failure-counting queue |
| B11 | P2 | **Double-dispatch holes**: `quickResult` carries no fixture/screen token — on a shared league+cup week a double-tap silently quick-resolves the cup tie the player never saw. `advanceCareer` double-tap advances two weeks and destroys the first week's review. | **[IMPLEMENTED]** screen guards (`matchday`; `management`/`season-end`) |
| B12 | P3 | `saveBlocked` pauses only `advanceCareer` — matches and event continues keep generating memory-only progress after saving is known-broken. | **[IMPLEMENTED]** same guard on `quickResult`, `watchMatch`, `continueAfterEvent` |
| B13 | P2 | **Hero tile permanently displays "7s"**: m1.27 removed the Zone countdown from the sim (`remainingTicks` never decrements) but the HUD still renders it as a timer. | **[IMPLEMENTED]** tile shows ZONE; the stale plumbing is documented (full removal is C-list item S1) |
| B14 | P3 | First-cup-win recognition trails its milestone by 4+ weeks: event `minWeek: 10` predates the cup calendar moving to week 6. | **[IMPLEMENTED]** `minWeek: 7` in content/events.json |
| B15 | P3 | Post-match highlight minutes can disagree with the live clock by a minute (round vs ceil). | **[IMPLEMENTED]** unified on the live clock's formula |
| B16 | P3 | Money formatting: the market renders negatives as `$-1,000` (sign after symbol, divergent from the other three formatters), and the shared formatters use U+2212 — a glyph Silkscreen lacks, so every negative sign renders in the system fallback face mid-string. Reachable in normal play (fail-soft economy goes negative). | **[IMPLEMENTED]** ASCII hyphen, sign before symbol, everywhere; test updated |
| B17 | P3 | `repairCareerLineupForInjuries` throws when zero healthy GKs exist. Today reachable only as a blocked drill tap with a cryptic error; becomes an unrecoverable advance-week lock if injury-effect events ever ship (schema supports them; no shipped content uses them). | **[PROPOSED]** field the least-injured GK instead of throwing — do when next touching squad.ts |
| B18 | P3 | "First hero goal" fires retroactively: tallies persist across seasons and hero status is tested at recognition time, so a pre-awakening scorer earns it the week they awaken. | **[IMPLEMENTED]** accepted + documented in-code (a real fix needs a per-tally hero bit in the save — not worth it) |
| B19 | P3 | Old saves mid-season straddle the moved cup weeks: a round whose new settlement week already passed gets auto-resolved (player silently loses cup agency + home gate for that tie). Sanctioned by the dev-time save-breaking decision. | Recorded as a conscious cost; no action |
| B20 | P3 | `career.ts:722` cup-settlement `includes(settledWeek)` without matching the round's own index looked suspicious to two auditors; neither could construct a reachable failure. | Watch item only |

## 2. Hardening

| # | Finding | Status |
|---|---|---|
| H1 | **No CI exists** while CLAUDE.md, doc 09, and doc 10 all claim a CI gate ("balance harness in CI", "goldens on Node and Hermes in CI"). With many concurrent worktrees merging via PR, un-run suites slip through. | **[IMPLEMENTED]** `.github/workflows/ci.yml`: typecheck + full jest on PR/push to main. Unverifiable until pushed — watch the first run |
| H2 | **Save-failure warning is invisible exactly when it matters**: the banner is an absolute View — under any native Modal it cannot render, and drill taps inside the training modal are the highest-frequency save trigger. A player can train a career that exists only in memory and never see the alert. Banner also draws under the notch. | **[IMPLEMENTED]** banner padded by safe-area inset; save warning additionally surfaced *inside* the training drill modal |
| H3 | `importCareerSave` validates schema but skips the application-layer load path (`reconcileLoadedCareer` + `resumeScreen` + replay cleanup) — a loaded trap for whoever wires the UI: an import could install a save the ordinary load path would have repaired. Currently unreachable (feature unwired, zero callers). | **[IMPLEMENTED]** wiring contract documented at the function; the seed-keyed backup (B2) covers the backup half. See D-list W1 for wire-or-delete |
| H4 | A skipped/no-op save task could clear the save-failure streak (false "all clear"). | **[IMPLEMENTED]** only an actual write clears failures |
| H5 | `generate-acceptance-seeds.test.ts` runs in every plain `npx jest` and writes into **git-tracked files** — any engine/content change dirties the working tree, hostile to concurrent worktrees. | **[IMPLEMENTED]** env-gated behind `ACCEPTANCE_SEEDS=1` |
| H6 | The sim's default fire policy is the test-only value (`homePolicy ?? 'SAVE_FOR_TAP'`): a bare `runMatch(seed, home, away)` silently produces a home team whose heroes never fire. All four production callers remember to override. Flipping the default is an **ENGINE_VERSION judgment call**. | **[PROPOSED]** flip default to `FIRE_WHEN_READY` in a dedicated sim commit with the full 4-step version ceremony |
| H7 | Replay validators *accept* the test-only `blindAutoHome` flag that serialization deliberately drops — a hand-edited stored envelope passes validation and flips the test baseline. | **[PROPOSED]** reject the key in `validateOpts`/replay schema (safe: no legitimate envelope carries it), same dedicated sim commit as H6 |

## 3. Efficiency (measured, not guessed — Node numbers; ~×3 for Hermes per the repo's own calibration)

| # | Finding | Status |
|---|---|---|
| E1 | **Quick Result freezes the UI ~2–2.5s on device**: the tap handler synchronously runs the user's 2,000-tick sim **plus all four AI fixture sims** (677ms measured in Node), with no spinner — and the post-watched-match handoff pays the 4 AI sims too. AI fixtures are seed-deterministic and independent of user inputs, so they can be precomputed during the watched match / when the matchday screen opens. | **[PROPOSED — highest-value next engineering task.]** Not implemented: it's an async restructuring (store tests dispatch `quickResult` synchronously) that shouldn't ride a 40-file pass |
| E2 | **Every store action zod-validates the entire career state before saving** (18ms at season 1 → 29ms at season 20 in Node; ~95% of serialize cost; est. 50–90ms JS-thread block per instant-training tap on device), and the save queue chains every request with no coalescing — N rapid taps = N full serialize+write cycles of intermediate snapshots. | **[IMPLEMENTED]** production saves skip serialize-side validation (`__DEV__` keeps it; load-side validation + backup remain the net); queue coalesces latest-state-wins; new-career saves withdraw stale pending payloads |
| E3 | `loadLaunchContent()` re-parses 208KB of content JSON on every call (41–83ms cold in Node), three times before first paint. | **[IMPLEMENTED]** module-level cache |
| E4 | Per-tick HUD breadth: every advanced sim tick re-renders the whole 2,600-line MatchScreen (10Hz at 1×, ~40Hz at 4×). The worklet interpolation is correctly off-thread; the cheap wins are memoizing `Pitch` (17 Skia nodes re-reconciled for a scale that only changes on resize) and collapsing four `[...pendingInputs].reverse()` copies per render into one scan. Deeper memoization of the rail/dock needs an on-device React profile first. | **[IMPLEMENTED]** the two cheap wins. **[PROPOSED]** rail/dock memoization after profiling |
| E5 | Portrait blink remounts all ~50–150 Skia rects twice per blink (the run id doubles as the React key and its prefix flips). 10–20 portraits visible on the Market tab, each on its own 2.6–6s timer. | **[IMPLEMENTED]** stable keys; blinks now diff in place |
| E6 | `GameApp` subscribes to the whole store (only subscriber; ~2 extra full-tree renders per action). All view-models measured sub-ms at season-20 scale, so this is low urgency. | **[PROPOSED]** selector-based subscription, someday |
| E7 | `ledgers` grows ~20KB/season, never pruned (600 entries by season 20), directly scaling E2's per-action cost; `balance.ts` milestone math reduces over the full array, so pruning needs a design check. | **[DECISION]** cap ledger history (e.g. 2 seasons)? |
| **Cleared** | No leaked listeners/intervals; no list needs virtualization; watched matches never touch the store per tick; replay envelopes are small and pruned; the inline view-model pattern measured fine. The per-tick draw path itself was previously optimized and was not re-audited. | — |

## 4. Polish & accessibility

| # | Finding | Status |
|---|---|---|
| P1 | Bitmap-font smears (fontFamily paired with fontWeight): `FirstMatchCoachingModal` ×2, ManagementShell's $/TP chips (`font-mono font-bold` on ASCII glyphs), match HUD `swapCount` (the one system-font holdout in the Silkscreen HUD). | **[IMPLEMENTED]** all three |
| P2 | `TutorialTapCue` was the only perpetual animation Reduce Motion could not stop (6 render sites). | **[IMPLEMENTED]** honours the OS setting; optional app-preference prop |
| P3 | ConfirmationSheet is the only bottom sheet without a bottom SafeAreaView — Cancel/Confirm sits on the home indicator. | **[IMPLEMENTED]** |
| P4 | Signing overlay: a 24-char created-player name runs border-to-border of the gold band. | **[IMPLEMENTED]** padding + 2-line clamp |
| P5 | Match scorebar pause toggle has no accessibility role/label (rail and dock are fully labeled). | **[IMPLEMENTED]** button role + paused-aware label |
| P6 | FeedbackNotice symbol smears for 'i'/'!' (✓ is exempt — missing-glyph fallback); FacilityProjectNotice modal covers the 4s adjacency-discovery toast raised by the same action; SettingsOverlay panel border sits ~8pt under the Dynamic Island; FeedbackNotice hard-codes `top-16`; PaperPanel titles don't truncate against non-shrinking stamps (worst: SeasonEnd, both name-driven); several bench/hero rows can squeeze names at large text scale; AwakeningCutscene may clip a 24-char name (arithmetic estimate, unrendered). | **[PROPOSED]** batch these with a visual QA session — they need eyes on a screen, which this audit deliberately did not fake |
| P7 | Desktop `MatchControlRail` sets no fontFamily anywhere (system face) while the phone HUD is Silkscreen throughout. Rail had a design sign-off 2026-07-23 — deliberate or drift? | **[DECISION]** |

## 5. Overcomplication (question 13) — the honest list

Implemented removals: **dead modules deleted** (all verified zero references): `flames.ts` (+test — its header claimed MatchScreen uses it; false), `StressScreen.tsx`, `TrainingPromiseReaction.tsx`, `PlanLockedConfirmation.tsx`, 7 never-called content parsers + barrel entries. Also deduped: goal-scorer extraction (was ×3, one wrong — B8), quick-result runners (near-duplicates), participant helpers (B9).

Found but deliberately NOT done (each safe only as a byte-identical consolidation; a careless "improvement" to a hash would shift deterministic career content):

- **S1** — The Zone-countdown pipeline outlived the countdown: `remainingTicks` frozen in the sim, `zoneFraction` computed per frame and multiplied into ring opacity as a constant 1.0, worklet plumbing, `LATE_WINDOW_TICKS` consumers modeling a window that no longer closes. Tile display fixed (B13); remove the rest in one render-side pass.
- **S2** — Three view-model flags hard-wired to constants keep ~400 lines of unreachable UI compiled and prop-threaded (see D-list W2–W4 — these are wire-or-delete decisions, not mechanical cleanup).
- **S3** — The neutered attribute-cap subsystem: `playerAttributeCaps` validates seven attributes then returns a constant 999 record; identity adapters; a dead `potentialCeiling` reader while 8 sites still write the field. Decide whether `potentialCeiling` is a future feature or dead persisted data, then flatten.
- **S4** — One FNV-1a hash in 10+ files; ~22 private checked-arithmetic helpers; duplicated `opponentPotential`/`assertUniqueIds`/`clampRating`; 4 money formatters (divergence fixed in B16, consolidation not done); byte-identical easing/actor-math blocks in the power-effect files — including kit-color constants re-declared with **inverted names** (`HOME = away's blue`) waiting to bite someone.
- **S5** — Five copy-pasted audio-bank skeletons whose only variability is fake (three SFX keys map to one file); one `createSfxBank` factory would do. Medium risk: native audio init order.
- **S6** — Layered re-validation: schemaVersion checked 4× per load; replay envelopes validated by two parallel implementations on both read AND write; MAGNET_TOUCH retired by three different idioms in three files; `validateFacilityGrid` (full grid walk) runs on every read including each drill tap; coach level validated 3× per call chain.
- **S7** — Vestigial parameters/variants: `heroMultiplier` always 4; `targetCash` always 0 (rendered as the literal "Reach $0 cash"); `buildTrainingGround(cost)` charges `cost` but places with the constant; `'coach-hiring'` ledger kind has zero producers (and `hireCareerCoach` charges no fee — missing ledger entry or dead variant?); M/A badge permanently "A" (D-list W5); unreachable formations 3-5-2/4-5-1 (kept replay-compatible — confirm the tuning is actually in flight); `shouldShowFullPowerCutIn` voids its reduceMotion arg; stale defaults duplicating real config (`DEFAULT_EVENT_CLOCK_TUNING` says 8 vs shipped 6).
- **S8** — Content validated on boot for fields no code reads (`usefulContext`, `windupTicks`, `requiresTarget`, club colors); `training.json`'s `moneyCost` is 0 in all 21 rows yet flows through schema → save → a live affordability-check-and-deduct branch → UI.

## 6. Claims that did NOT survive verification (checked and rejected)

- "Add `__DEV__` to the power-QA routes (they ship in release bundles)" — the art-QA route deliberately supports static web export (documented in-code) and the `EXPO_PUBLIC_*` flag already gates activation at build time. A guard would break the documented QA workflow to remove only dead code weight.
- "Function-form Pressable styles in App.tsx / ChampionshipCelebrationScreen" (my own scare during verification) — both alias `SfxPressable as Pressable`, which resolves function styles safely. Repo-wide sweep: **zero live instances** of the iOS zero-height trap.
- The prior audit's warned-about false findings stayed false and were not re-implemented (border bevel "duplication", inline Canvas style "layout pass", blanket font-bold stripping).
- `m2-balance`'s promotion assertion: one auditor called it "certifying coin flips", another called it harmless. Adjudicated: it IS a legitimate distribution-drift guard, but its name invited misreading as a ramp gate. **[IMPLEMENTED]** renamed + documented (never deleted).

## 7. Test/instrument honesty & verification

- **[IMPLEMENTED]** GATE-1 renamed "attention floor" → "powers-matter floor" (attention hasn't been involved since the tap removal); `active-manager-balance` carries an in-file limitation banner (it feeds 3-0 wins); `m2-balance` rename above; `runtime-golden.ts` rebaseline comment updated to m1.29.
- **[IMPLEMENTED]** Docs de-staled to the locked auto-fire decision: vision one-liner + pillar 1, "three currencies" → two, doc 03's tap-era "attention is rewarded" sentence, roadmap's "11 ship" → the actual 17-power catalog, CLAUDE.md's power fact.
- Harness status (verified): `EVEN_DELTA` copy-drift **fixed** (one measured constant reproducing the documented 1.43 ppm baseline); `runHeadlessFullCareer` still seed-only but now honestly labeled; the vacuous-test sweep found no other always-pass patterns.
- New regression tests: backup identity (B2), pyramid-seller guard (B1), talks-lock (B5), milestone rollover (B4); migrations tests updated for ladder v5.
- Verification state at commit time: `npx tsc --noEmit` clean over the final tree. Baseline full suite green (207 suites / 1626 tests). Post-change, every suite covering changed code passes on the final tree: persistence (14 suites / 107 tests), market-career (incl. 2 new regression tests), career-milestones (incl. the rollover test), matchday (2 pre-existing tests rewritten — they mocked the old `runMatch` seam that the scorer-bug fix removed; the rewrite now actively asserts the fixed behavior), contract-promises, training, currency-format, migrations, career-repository, save-file. A mid-session full-suite run was discarded as inconclusive (it ran against mid-edit source, and its exit code belonged to `tail` — the exact instrument-trust trap this audit documents). The authoritative full-suite runs are the clean post-commit run and the new PR CI; their results are recorded on the PR.

## 8. Creative decisions — the owner's list

### Possession tie-ups (question 10)

The sim lever is exhausted: the m1.29 standoff ring keeps duelists at ≥120 units 91.5% of the time, but tackle range is 200 units ≈ **11.5 screen points** and a sprite is ~24 points wide — any separation that still allows tackling keeps bodies 65–78% overlapped, both slowed (carrier locked to 0.37× speed, presser holding station). The shipped failed-tackle visuals punctuate ~once a second; the sustained shielding window between beats is the uncovered gap (plus loose-ball scrums, where up to 4 sprites fully stack). Presentation-only options, no replay impact:

1. **Scuffle dust loop** (low risk) — recurring dust at the pair's midpoint while engaged, reusing the shipped duel-scuff geometry; also covers loose-ball scrums.
2. **"CONTESTED" chip on the carrier card** (low risk) — makes the blob legible as a contest.
3. **Render-only de-overlap** (medium) — push the sprites ~3–4px apart along their axis in the worklet, eased by proximity.
4. **Alternating micro-lean jostle** (medium) — opposite-phase lean; reads as bodies leaning on each other; fights the pixel grid, keep tiny.
5. Duel camera zoom — **recommend against**: integer-zoom constraint makes the smallest zoom a jarring 2×, and it collides with power-activation camera ownership.

Recommended combo: 1 + 2, then 3 if it still reads merged.

### Game-feel menu (question 9)

Research: New Star Soccer, Football Manager, Kairosoft, Inazuma Eleven, FIFA/EA FC, Vlambeer/Nijman juice literature. Core insight: **your existing juice is all payoff (slow-mo, callout, flash, shake); watched-match excitement lives in anticipation.** All items verified presentation-only. Top three:

1. **Crowd bed with danger-driven swell** (M) — continuous crowd loop whose intensity tracks a danger scalar derived per render tick; current one-shots become peaks on it. The single biggest gap — changes every second of the 3–4 minutes, not just event frames.
2. **Shot-lifecycle ramp + near-miss hit-stop** (M+S, one job) — ~0.5× ball-flight dilation with a micro-zoom on goal, resolve on save/miss/goal; 60–90ms freeze + shake + "ooh" on near-misses. Fixes "shots that don't score evaporate."
3. **Commentary ticker** (M) — authored one-liners from the event stream as zod-validated content in a broadcast marquee; optionally piped through Bert's bleep voice. Compounds with everything later (late-game drama, HT/FT cards, replays reuse its lines).

Full menu (each S–M, presentation-only): goal celebration beat (Kairosoft's own reviews credit celebrations for wins feeling "keenly felt"), goal instant replay (frame ring buffer, skippable), momentum worm under the score bug, speed-coded ball trails, net ripple + post CLANG, half/full-time broadcast card, soft attack-zoom (integer steps only), late-game tension dressing (clock pulse, nervous crowd layer), animated pixel crowd scaled to attendance (quietly visualizes your economy), cosmetic-only weather (last, if at all — must never imply a mechanical effect).

### Micro-animation menu (question 4)

Prerequisite: thread `reduceMotion` broadly (only 3 files call the hook). Highest leverage first: eased press feedback in `SfxPressable` (~90ms; upgrades every button in the app at once); match banner entrance/exit (most visible static surface in the match); HUD money/TP count-up + tone flash; Heat-fill easing on the charge meter (the 100% flip deserves a pop); SeasonEnd stamp slam + prize count-up (biggest unexploited celebration beat, same treatment fits PostMatchLedger); character-creation stat-bar fill. Then: scouting/construction progress bars (currently text-only), negotiation mood/counter-offer reveals + wage-stepper digit roll, TP tick-down, injury-card slam (the one un-animated result stage of three), league position-change row flash, inbox entrances, modal entrances reusing the existing scale-up pattern.

### Wire-or-delete decisions

- **W1 — Save export/import**: complete, tested persistence stack + Settings UI, zero production wiring (needs expo-document-picker/-sharing + a store action honoring the wiring contract now documented in `save-file.ts`). Wire it or delete it.
- **W2 — SeasonEnd renewal picker** (~40 lines + two orphaned store actions): dead because the view-model hardwires `requiresNegotiation: true`. Intended?
- **W3 — LeagueTableScreen** + view-model + three model types: unreachable (every career has m2). Delete?
- **W4 — Legacy training-ground section** in ClubFinances (~70 lines + 4 threaded props + an assistant objective targeting an element that cannot render): gated by a constant `false`. Delete?
- **W5 — M/A policy badge** on hero tiles: permanently "A" (nothing queues `SET_AUTO_POWERS`; the comment plans for a removed feature). Remove?
- **W6 — HirePitchScreen**: unwired but carries a tracked TODO(art) — pending or abandoned?

### Strategy/balance (question 12 — the antagonistic review)

Decisions that **survived attack** (evidence in repo): the determinism + ENGINE_VERSION ceremony (every major course-correction — GK 65× dominance, dead PAC, the tap's zero effect, the impossible ramp — traces to a deterministic measurement); Zone machinery under auto-fire (GATE-3 proves contextual beats blind over 400 seeds; the starve-the-glow counterplay is real); quick-result parity; the fail-soft *mechanism*.

Decisions the attack **wounded** — each needs your call:

- **The climb promise**: at this branch's base commit the central promise fails (D5 unwinnable, TP starvation — known), and your ordered gate ("best-play promotes out of D5 within 2 seasons") does not exist yet. NOTE: a concurrent session reports the TP fix landed 2026-07-26 on another branch (base TP 24 + training pitch 10→28; trains-and-builds promotes in season 2) — verify on merge, then the gate itself is still the missing piece.
- **Hero worth**: the acceptance band (+1..+6 pts) was widened after seeing a measurement made on a mis-calibrated instrument. A full 4-hero squad covers +4.6 pts of a ~19-pt division gap — the title system is a rounding error on progression, which contradicts pillar 3 and makes the ×3–5 wage cliff price the fantasy out of its own game (selling the hero at renewal is currently rational). Needed: state the minimum fraction of the D5→D4 gap a full hero complement must cover, then re-derive tiers on the corrected calibration.
- **Chairman mode**: its non-economic hardness axis (faster league growth) is the exact mechanism that made Cozy unwinnable, tuned on top of a broken baseline, and Chairman has no stated promise (e.g. "promotes in ≤3 seasons"). Re-measure both modes after the ramp fix.
- **$0.99**: zero supporting research in the repo; your own comparables (Kairosoft) charge $5–8; no analytics means launch produces no funnel data to learn from. Decide: launch-visibility price with a planned reprice, or re-anchor now.
- **"Powers are data"**: true for metadata only — every power effect is bespoke engine code, so "power expansion packs as content drops" actually means engine releases with replay-version bumps. Scope the claim honestly in docs 04/10.
- **Vision identity**: the tap removal is well-evidenced, but the no-tap build has never re-run the hand-the-phone fun gate that validated the tap-era game, and pillar 1's new wording (implemented in this pass) still needs your sign-off as the real fantasy statement.

## 9. What was NOT covered (honest gaps)

Per-power audit of the 17 implementations' effect branches; engine.ts's untouched bulk (passing/shooting trees, stamina edges); line-by-line MatchScreen; art tooling and scripts; web-specific renderers; on-device measurements (all perf numbers are Node ×3 estimate); any live visual verification (no simulator/browser was used — several polish items are computed from constants and flagged as such); the 20 new events got structural checks only, no balance review.
