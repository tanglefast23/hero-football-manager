F01, F03, and F04 are still open in the current tree. F02 and F05 should wait. I re-ran the captured career check. It still exits 1 with `Hero bramble-rovers-p15 must be licensed or benched`.

The dirty audio, preferences, dependency, modal, and transfer-formation edits are still in the tree. Keep them. `App.tsx`, `src/game/market-career.ts`, and `src/game/__tests__/market-career.test.ts` are dirty, so any fix there has to sit on top of those edits.

## Fix now

**F01 is confirmed.** Selling Sol Reed sets `licensed: false` in `acceptCareerTransferBid`. He is not in Dunwich's saved XI. `fresherOpponentLineupIds` still picks him, because its filter allows every unlicensed player. `buildTeamDef` then throws.

The throw happens in `GameApp`'s render, inside the matchday preload `useMemo`. That `useMemo` runs whenever the career phase is `matchday`. It does not care which screen is open. The outer error boundary remounts `GameApp`, the career stays in memory, and the same `useMemo` throws again. Back to Title and a reload both hit that loop. The existing bench repairs cover the user's own XI only. They do not cover this AI picker.

1. In `fresherOpponentLineupIds`, skip any player with a power and `licensed: false`. Use the same test as `isEligibleTransferReplacement`. Keep the licensed-hero cap.
2. In the matchday preload `useMemo`, catch a build failure and return `null`. A render must not trap the title. Keep the dirty preferences edit in `App.tsx`.
3. No save migration. The bad XI is computed at match build time.

Add a small case beside the computer-club freshness test in `src/game/__tests__/squad.test.ts`. Put a strong unlicensed hero on an AI roster, outside the saved XI. `buildCareerTeamDef` must not throw, and it must not select him. Then rerun `node artifacts/playtest-2026-10-18/reproduce-career-blocker.cjs`. Exit 0 means this save builds.

**F03 is confirmed for Mei Chen.** The evidence quote says $600 a week. The hired record is level 3 at $900, with no loyalty discount. That is the level-2 office bonus in `hireCareerCoach`. The card, the confirm dialog, and the cash check all use the pre-bonus level and wage. The hire celebration then shows the new wage with the old level and old effects. Rafael's $150 to $300 jump is the same function for an assistant. I did not find a separate captured assistant record.

Add one hire-offer helper beside `coachHireLevelBonus`. Use its level and wage in `hireCareerCoach` and in the coach card in `market-view-model.ts`. Pass that arrival level into `coachRoleEffectLabels`. Do not change the $300 wage ladder or the office bonus. The confirm dialog and celebration already read the view model, so they follow that helper. Add a test in the dirty `market-career.test.ts` without removing the formation test: an office at level 2 hires a level-2 head coach at level 3 and $900, and the card wage equals the saved wage.

**F04 is confirmed.** `one-big-night-out` is a squad request. On Chairman, `resolutionDeltas` gives the asker −5 loyalty and −8 morale, then adds −2 and −3 to every player, including the asker. Ken Ash lost 7 and 11. Everyone else lost 2 and 3. The evidence matches. The Refuse label and the lapse inbox line both print the asker-only numbers, −5 and −8. A player-only request such as the Bahamas trip is already correct.

Use one formatter in `playerRequestViewModel` and in the `stillWaitingDetail` inbox line. For a squad request, show the asker's total and the other players' change. Keep the current sentence for a player-only request. Read the numbers from `resolutionDeltas`, because Cozy uses different values. Update all seven language catalogs. Extend `player-request-view-model.test.ts` with Chairman plus `one-big-night-out`, and keep the Bahamas test. Leave grant-reward copy alone.

**F06 is a real copy bug.** `CREATED_PLAYER_ROOKIE_WAGE` is `reducedPlayerWeeklyWage(180)`, which is $153. All seven catalogs still say $180. `character-creation-copy.test.ts` locks the English string. Format the wage from the constant. The player is not overcharged.

**F08 is a real copy bug.** A mission lasts 2 weeks, plus 0 or 1, plus 1 more when the brief names a role. The generic lines say two or three weeks. The mission slip already shows its own duration. Change `market.scoutDuration` and `market.scoutIdleDetail` to two to four weeks in every catalog. Do not add a new deadline display in this pass.

## Leave for a design decision

**Defer F02.** The reversal is real. Jae Gray shows REF 210 and stores 102. Leo Knox shows 201 and stores 145. `refDisplayBonus` is intentional, and the 2026-08-24 spec says to keep it. Showing stored REF would undo that decision. Do not change the card in this pass.

**Defer F05.** The $500 fee is the level-0 youth bonus. The $5,776 sale uses ordinary `playerValuation`. The $5,276 profit happened once. No rule forbids an immediate academy sale. Do not add a resale lock or a discount from this sample.

**Defer F07's ladder change.** Shipped Tier 5 is +18 outfield and +10 keeper, at 39 TP. `docs/05-players-training-coaches.md` still says +20 and +11, and it says efficiency rises. The in-game text does not repeat +20. Do not edit `content/training.json`. A doc correction can wait. A new upgrade warning is a separate design choice.

## Do not turn the play notes into balance changes

The stand math is real: a new stand adds 100 percentage points for $10,000, and the first upgrade adds 50 for $25,000. That is an explanation, not a change to make.

The D3–D1 notes match the code. The hero cap becomes 3 at D3 and 4 at D1. Tier 3 unlocks at D3. Green Bull starts at $50,000, then rises by $25,000 and later $50,000. Its gain is +2. Those facts do not prove the plan wins.

Save Energy scoring 1.89 points and All-out scoring 1.38 points comes from one home squad against three opponents. The best single cell, 4-4-2 Attack Balanced, is still one cell. Quick Match does not keep a watched energy choice. Auto-coaching picks energy during the match. Do not change tactics or energy from this sample.

Commercial income, the relegated-club feeling, and the WebGL warnings are one career or unproved. The report already says so. Leave them.
