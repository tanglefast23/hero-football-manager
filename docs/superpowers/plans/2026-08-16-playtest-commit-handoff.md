# Hero Football Manager commit handoff

## Scope

This handoff covers the recent playtest, balance, localization, scouting, and
robustness work merged into `main` from 10 August through 16 August 2026.

Several commits came from parallel worktrees and were merged into `main`. This
file records the behavior now present in `main`; it does not claim that every
line was authored by one agent.

Merge commits are integration records. Formatting-only and CI-only commits are
listed separately because they do not change game behavior.

## Repository state

- Branch: `main`
- Head: `a662dc6e`
- Remote: `origin/main`
- Local and remote were synchronized when this handoff was written.
- No uncommitted changes were present.

## Mission and current limitation

The intended playtest remains a full English career using the optimal strategy.
It must continue through a Hero Cup win and a D1 league win.

That result is not proven yet. The latest fresh English save stopped at D5 Week
26 after a session interruption. A scout report in that save also exposed an
unresolved candidate-stat range bug with values above 100.

Do not describe the career as complete until the save reaches both requested
wins and the final result is visible in the browser.

## Commit ledger

### 16 August

- `a662dc6e` `fix: keep board relief players viable`
  - Raised emergency academy replacements from a target strength of 27 to 37.
  - Added a regression test for the replacement floor.
- `3a455b2d` `docs: speed up watched playtests`
  - Added 3x watched-match guidance to the playtest handoff.
- `f9eb4d6b` `fix: stop decoy clones crashing the match view`
  - Hardened entity lookup in the match renderer.
  - Added clone-lookup regression coverage.
- `f8c720db` `fix(market): make first-season recruitment honest`
  - Made the first academy intake clearly one-choice.
  - Made the first scout lesson actionable when the cheapest target was too
    expensive.
  - Prevented a negotiation button from being used after talks ended.

### 15 August

- `64120f96` `fix(i18n): repair the German locale, and six English leaks that hit every language`
  - Repaired German terminology and layout-sensitive strings.
  - Fixed shared English leaks across every supported locale.
  - Added translated tutorial, records, form, story, market, power, and cup
    surfaces.
- `2cae7e42` `docs: record the unaffordable first scout report`
  - Recorded the scouting balance finding for follow-up.
- `75f691fa` `fix: close the seven code findings from the 44-hour red audit`
  - Hardened market, career events, wellbeing, callbacks, and view models.
- `3b8ece4e` `fix: stop two guides fighting over the management tab`
  - Made guide ownership and navigation guards deterministic.
- `04ca38e4` `fix: repair the ten tests main left red`
  - Restored focused test coverage after integration changes.
- `c6251ada` `Merge origin/main and fix three more tests it left red`
  - Integration follow-up for the merged test suite.
- `5e069a30` `fix: close Portuguese career playtest findings`
  - Fixed Portuguese career flow, story eligibility, request lifecycle, market
    dismissal, save handling, and locale copy.
  - Added the Portuguese playtest report and updated the main handoff.
- `24a5d08e` `fix: address Opus career audit findings`
  - Applied the accepted historical audit fixes to events, market pacing, and
    career-flow tests.
  - No new Opus audit is part of the current test plan.
- `3c225593` `feat: deepen scouting and career events`
  - Added scouting filters for region, position, and prospect type.
  - Added starter, youngster, specialist, and bargain result pools.
  - Preserved uncertainty between scouting and the Deals page.
  - Added lasting stories, eligibility rules, callbacks, and event persistence.
  - Added request and market view-model coverage.
- `2388ec6d` `Balance late divisions and refresh scouting`
  - Retuned late-division bands and scouting availability.
  - Improved market pacing and two-column market presentation.
- `9666a3da` `fix: stop two guides fighting over the management tab`
  - Earlier follow-up for the same guide-claim conflict.

### 14 August

- `440a8fdb` `fix: prevent pre-Green Bull drill exploit`
  - Made an individual drill grey out Green Bull until the next week.
  - Added the used-state copy and sequence tests.
- `bf3bbe93` `feat: explain Green Bull and scale renewal wages`
  - Added Bert's Green Bull explanation.
  - Added D3, D2, and D1 renewal-demand scaling.
- `bf473af5` `feat: deepen season events and condition strategy`
  - Added lasting events, targeted choices, callbacks, story persistence, and
    condition-aware career flow.
  - Added player-request and sponsor coverage.
- `b9c6d7a5` `fix: strengthen late-career money sinks`
  - Raised later facility pressure and improved commercial/facility pacing.
- `9447b01c` `feat: rebalance career progression and spending`
  - Rebalanced progression, rewards, facility costs, event effects, and career
    economy.
  - Added full-career and event-balance coverage.
- `02ebc3cd` `fix: auto-target specific story players`
  - Auto-selected fastest, youngest, and other hard-claim targets.
  - Added deterministic tie handling and eligibility tests.
- `10e864e6` `feat: improve facility construction readability`
  - Improved facility sprites and construction-card readability.
- `6c438367` `docs: track post-season economy levers`
  - Recorded post-season economy decisions for future playtests.
- `968f14e8` `fix: neutralize transfer negotiation copy`
  - Removed repeated or gendered transfer wording.
  - Added a pending internal pronoun follow-up.
- `1323cc18` `balance: raise drill upgrade prices`
  - Raised later drill-tier costs and updated progression assertions.
- `2f0abdac` `fix: neutralize coach story pronouns`
  - Replaced gendered coach wording with neutral copy.
- `5f042ae1` `fix: keep player requests in home inbox`
  - Kept unresolved requests visible after opening them.
- `99764821` `fix: neutralize player story pronouns`
  - Replaced gendered player story wording with neutral copy.
- `11e808de` `fix: simplify starter promise label`
  - Standardized the label to `(Promise) Starter`.
- `bfe5da69` `fix: remove duplicate captain promise label`
  - Removed repeated captain wording from player rows.
- `38f676d8` `fix: rebalance training and harden career playtest`
  - Updated training priorities, condition rules, player selection, and career
    playtest safeguards.
- `d8baf14a` `fix: improve squad readability and cup seeding`
  - Improved squad register presentation and Cup opponent seeding.
- `a586174d` `fix: resolve season two playtest findings`
  - Added midseason sponsor pressure, richer requests, story guidance, and
    season-two economy fixes.
- `e95616d7` `fix: resolve season two playtest findings`
  - Earlier equivalent integration of the Season 2 findings.
- `43025a5f` `Tune commercial growth and fix playtest issues`
  - Tuned commercial growth, finance reports, sponsor guidance, and career
    flow.
- `d198517c` `Document Season 2 optimal playtest`
  - Added the Season 2 playtest report.
- `79be0f47` `feat: show Hero Cup penalty shootouts`
  - Added deterministic penalty-shootout state, rendering, persistence, and
    localized copy.

### 13 August

- `dfc69823` `Fix management copy and Hero Cup pacing`
  - Improved Cup scheduling, management copy, and season-flow pacing.
- `1fdf88ec` `fix: sync club names and guard Bert translations`
  - Kept club names synchronized and prevented missing Bert translations.
- `a9b6d8f4` `fix: dismissable notice, desktop player file, story benching, no raw engine text`
  - Added dismissible notices, better desktop player files, forced story
    benching, and player-facing text instead of raw engine labels.
- `84dd066c` `fix: dismissable notice, desktop player file, story benching, no raw engine text`
  - Earlier integration of the same audit fixes.
- `af2ad57b` `Harden the game against the adversarial audit2 sweep`
  - Hardened save flushing, event persistence, Cup flow, training, balance
    guards, and ledger retention.
- `b26e1399` `Open Season 1 mid-table instead of against the division's best`
  - Changed the opening opponent to a reachable mid-table club.
- `e0cbb15b` `fix: open Season 1 mid-table instead of against the division's best`
  - Earlier integration of the Season 1 opener change.
- `bfb944d3` `fix: harden the game against the adversarial audit2 sweep`
  - Earlier integration of the same audit hardening.
- `a80b8ffa` `fix: adversarial audit3 — save brick, delete loop, stale bundle, scorer attribution, i18n gaps`
  - Fixed save recovery, delete loops, stale bundles, scorer attribution, and
    translation gaps.
- `f6767010` `fix: show a substitute's real entry energy on the substitution board`
  - Corrected substitute energy display.
- `a0f44d5c` `fix: harden adversarial gameplay edges`
  - Hardened mobile navigation, character creation, management layout, and
    Cup-flow edge cases.
- `2319f381` `fix: level the Week 19 footsteps loop to the sfx target`
  - Corrected the Week 19 sound loop level.
- `78c35279` `feat: win bonus, richer story rewards, fireworks audio and roster clarity`
  - Added win bonuses, richer story rewards, award/fireworks audio, and clearer
    roster presentation.

### 12 August

- `cbef10c9` `fix: bound the season academy refill to the roster capacity`
  - Prevented academy refill from exceeding roster capacity.
- `4c4c70d5` `Draw stat tips on a top layer, drop the opener buff, shorten match FX`
  - Improved stat-tip layering, removed the opener buff, and shortened match
    effects.
- `7249ef40` `feat: add club crests across team-name surfaces`
  - Added club crests to team names, tables, fixtures, brackets, finance, and
    award surfaces.
- `158776fa` `Stop the opening desk jobs trapping the manager`
  - Prevented onboarding desk jobs from blocking progression.
- `0128bcc4` `feat: improve management info and onboarding`
  - Improved management guidance and onboarding information.
- `0fcbb696` `fix(ui): restore celebration surface contracts`
  - Restored celebration-screen UI contracts.
- `fc861723` `fix(application): keep assistant inbox reconciliation idempotent`
  - Prevented repeated inbox reconciliation from duplicating work.
- `26790101` `feat(render): add procedural match visual effects`
  - Added procedural match effects.
- `cdaf9b8d` `fix: harden iPad onboarding interactions`
  - Fixed iPad onboarding interaction edges.
- `e8022d05` `feat: polish Week 19 training celebration`
  - Polished the Week 19 training celebration.
- `ed842713` `feat: add midseason team training and finance safeguards`
  - Added team training and finance safety checks.
- `281cbd8f` `feat: refine club economy and transfer guidance`
  - Improved economy guidance and transfer guidance.
- `0b2fc042` `fix high-impact audit findings`
  - Closed the high-impact findings identified during the audit.
- `3f729360` `add drill and aerial ball sound cues`
  - Added drill and aerial-ball audio cues.

### 10 August

- `85c6e124` `fix mobile match flow and modal layering`
  - Fixed mobile match transitions and modal layering.
- `626ce770` `feat: rebalance club systems and polish management guidance`
  - Rebalanced club systems and improved guidance.
- `7c24c4a7` `Add facility-first board intervention`
  - Added the board's facility-first intervention path.
- `69178609` `Polish recovery, facility combos, market guidance, and result audio`
  - Improved recovery, facility combinations, market guidance, and result audio.
- `53275406` `Polish coach pricing and facility cards`
  - Improved coach pricing and facility cards.
- `97c536d5` `feat: polish player recovery and market guidance`
  - Improved player recovery and market guidance.
- `c0e2e6a6` `Restore Developer Mode on QA surfaces and soften negative cue`
  - Restored safe developer-mode surfaces and softened negative feedback.
- `f39279fc` `Rebalance drills and fix management UI stalls`
  - Rebalanced drills and fixed management-screen stalls.
- `d5dd0f80` `fix: keep transfer cash guard at app boundary`
  - Added a transfer cash guard at the application boundary.
- `25fe2076` `fix: clarify market onboarding and feedback`
  - Clarified market onboarding and feedback.
- `cf751b7c` `feat: rebalance drills and improve management UX`
  - Improved drill balance and management UX.
- `ca1ccd3a` `perf: lazy-load the training drill modal`
  - Lazy-loaded the training modal.
- `c5a4aade` `fix(ui): polish week-one guidance and training feedback`
  - Improved Week 1 guidance and training feedback.
- `7206fc1d` `fix: finish delayed loading and loan guidance`
  - Improved delayed loading and loan guidance.
- `45409226` `Polish rival heroes, management guidance, and training progression`
  - Improved rival heroes, guidance, and training progression.
- `b7edb32d` `Show achievement stories immediately`
  - Made achievement stories appear immediately.
- `4d2a9344` `balance: slow player training progression`
  - Slowed training progression to preserve longer-term choices.

## Integration-only commits

These commits joined branches or adjusted generated/quality gates. They are
important for history, but they do not add a separate player-facing feature:

- `4e061a0e`, `600452ea`, `6d89a6d6`, `706013a2`, `e6154384`, `43f2407f`,
  `10f48323`, `b863d255`, `521d700f`, `56a54392`, `62ad8b6f`, `59175c5b`,
  `599e3169`, `010dd9f4`, `9c89e54f`, `6db6d8d9`, and related merge commits.
- `99d13be4`, `14018760`, `204a13b1`, `f1c9beaa`, and `85115d38` adjusted
  measured first-load or CI budgets.
- `bcb2f257`, `e6154384`, `5174bb40`, `d2f7ba80`, `34685e39`, and `04a74b3f`
  applied project formatting.
- `a990aeff` updated Expo packages after Expo Doctor requested it.

## Verification already recorded

- The latest emergency-replacement fix has focused Jest coverage.
- The latest emergency-replacement fix passed TypeScript checking.
- Scouting, event eligibility, request persistence, Green Bull sequencing,
  penalty shootouts, saves, localization, and market flows each gained focused
  regression tests in their feature commits.
- `main` and `origin/main` match at `a662dc6e`.

## Next session instructions

1. Use the built-in browser and start a new English career.
2. Follow the existing optimal-playtest handoff.
3. Use Quick Result for routine fixtures and 3x for watched matches.
4. Open Scouting and Deals every transfer-window week.
5. Verify the scout-stat range bug before trusting scouting balance results.
6. Continue without silently resetting the save.
7. Record each blocker with its last trustworthy week.
8. Finish the Hero Cup and D1 league before writing the final review.

## Update, 2026-08-16, at commit time

This handoff was written against `a662dc6e` and is accurate for that head. Two
of its statements were overtaken before it was committed.

- `main` is now `a87af1b1`. PR #164 squashed in match-day form, Coaching Office
  upgrades, the save reconnect and the honest first-season scouting work.
- The scout-report range above 100 is no longer open. Attributes have been
  cap-free since personal caps were removed, so `88-118` is correct. Reports
  that show one now carry a line saying the scale has no ceiling of 100, in all
  seven languages.

Left otherwise as authored. The ledger below is a record of what its author saw.
