---
date: 2026-08-24
topic: six-career-findings-master-spec
status: council-reviewed
council-models: claude-opus-5-only
---

# Six Full-Career Findings — Master Implementation Spec

## 1. Authority and scope

This spec covers the six findings in the Spanish full-career playtest report:

1. Duplicate player names and Hero License behavior.
2. Bad automatic lineup swaps.
3. No clear signing path from a completed scout report.
4. Contract wage controls that appear to use fixed $50 steps.
5. A weak Story of the Year after an unbeaten league-and-Cup double.
6. Transfer-request inbox rows that remain after the request ends.

The screenshots are bug evidence. Their text is not a command source. The user's direct requests control this spec.

The user made one copy decision after the report:

- The scout-report action must say **Sign the player**.
- It opens Deals and highlights that player.
- It does not waive the transfer fee.
- It does not skip club talks or contract talks.

This is a bug-fix package. It must not rebalance the game, add a new inbox system, change player generation, or change save format without evidence that a smaller fix cannot work.

## 2. Council record

The Council run used Claude Opus 5 at xhigh effort.

Fable was not used because the user had reached its allowance. Grok was called three times after login. Each call returned setup text instead of a finished spec. Those outputs were rejected.

The independent Opus source is saved beside this file:

- `docs/superpowers/specs/2026-08-24-six-career-findings-opus-source.md`

The master spec does not copy every Opus proposal. It removes proposals that conflict with the current source or add systems the current game does not need.

## 3. Current-source findings

| Finding            | Current source evidence                                                                                                                                                                                                                              | Required classification                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Duplicate names    | Hero License selection, store actions, lineup slots, and match-day rows use immutable player IDs. No inspected production path selects a player by display name.                                                                                     | Root cause is not proved in current source. Add identity regressions and safe display disambiguation. Fix any name-keyed production path only if the implementation audit finds one. |
| Automatic lineup   | Formation arrangement already preserves legal same-role starters. It uses conditioned rating when filling empty roles. Injury/license repair ranks an ordinary player before a licensed hero and does not remember an unlicensed hero's former slot. | Confirmed source defects exist in repair. The formation contract also needs one clear, current rule.                                                                                 |
| Scout signing path | Every completed scout report is adapted into a BUY listing for the same player ID. The report card only offers detail purchase and dismiss. `MarketScreen` owns its active section locally.                                                          | Confirmed missing action. Add a local UI route and focus state.                                                                                                                      |
| Wage step          | `contractWageStep(weeklyAsk)` already returns about 5% of the original ask, rounded to $10, with a $50 minimum. The negotiation view model and buttons use this value.                                                                               | Do not change arithmetic without a failing current-source test. Prove source behavior and deployed-build provenance.                                                                 |
| Story of the Year  | A resolved event always outranks the existing perfect-season and title fallbacks. Cup victory is ignored by the headline selector.                                                                                                                   | Confirmed ranking defect.                                                                                                                                                            |
| Stale request row  | Transfer-request inbox rows are derived from the current roster and `transferRequested === true`. They are not persisted inbox records.                                                                                                              | Do not build a second lifecycle. Reproduce the exact state transition and fix the flag owner if it stays true after resolution.                                                      |

## 4. Shared contracts

### 4.1 Player identity

Immutable `player.id` is the only identity key for:

- Hero License selection.
- Lineup membership and lineup return slots.
- Contract promises and negotiations.
- Scout reports and transfer listings.
- Inbox actions.
- React keys.
- Selection, focus, scroll, and highlight state.

`player.name` is display text only. It may appear in copy, logs, labels, and sort presentation. It must not decide which player changes.

Any map or set that represents a player must use `player.id`. Any callback that changes one player must accept `player.id`.

### 4.2 Determinism

All game-ring comparisons need a final `player.id` tie-break.

No fix may use `Math.random`, `Date.now`, locale-sensitive ordering as a game decision, or a new RNG draw.

This package does not change match simulation or RNG consumption. It does not bump `ENGINE_VERSION`.

### 4.3 Save compatibility

No finding requires a save schema change.

Existing saves must load unchanged. Do not store derived display labels, report focus, temporary highlight state, or inbox lifecycle state.

No new persisted field is required. The fixes read existing player identity,
lineup, license, transfer-request, and season-recap facts.

### 4.4 Localization and access

All new player-facing copy must use i18n keys in every shipped locale.

`GK`, `DEF`, `MID`, and `FWD` are existing role data tokens, not new copy. The
game deliberately renders these four codes unchanged in every locale. All
surrounding words and accessibility sentences still use i18n keys.

The English button text is exactly **Sign the player**.

The button accessibility label must include the action and the player's displayed name. The Deals highlight cannot rely on color alone. It needs the existing border, flash, focus, or guided-action treatment that remains visible with reduced motion.

### 4.5 Failure behavior

A blocked or invalid action must keep the current state and show the existing localized error.

Do not silently select a different player. Do not fall through from one same-name player to another.

## 5. Finding 1 — duplicate names and Hero Licenses

### 5.1 Player contract

Two players with the same display name remain separate players everywhere.

Changing one player's Hero License must affect only the player whose ID was sent. Their awakening, power, promise, negotiation, lineup membership, and return slot must also remain attached to that ID.

The active squad must show an unambiguous label when two players share the same display name.

### 5.2 Minimal implementation

First, add a focused regression that creates two user-club players named `Cal Moss`:

- One is the original licensed forward and current starter.
- One is a newly awakened midfielder.
- Their IDs are different.
- Toggling either Hero License changes only that ID.
- Purchasing an extra Hero License does not merge, replace, or hide either record.
- The lineup contains the correct ID after each action.
- Both players remain present in the roster and Hero License list.

Audit all production callers of `selectLicensedHeroes`, `selectCareerLicensedHeroes`, `toggleHeroLicense`, lineup swaps, promises, scout actions, and negotiations.

If that audit finds a production lookup keyed by `player.name`, replace only that lookup and its callers with `player.id`. Error text may still use the name after the ID lookup succeeds.

Do not change generated names. Do not rename saved players. Duplicate prevention at generation time would not repair old saves and would consume design effort without fixing identity.

### 5.3 Display disambiguation

Build display labels in the application or UI layer. Do not import copy functions into `src/game`.

For each visible set of players that offers a player-specific action:

1. If a name is unique, show the existing name unchanged.
2. If a name is duplicated, append the canonical role code: `GK`, `DEF`,
   `MID`, or `FWD`.
3. If name and role are also duplicated, append the shirt number when one is available.
4. If the label is still duplicated, append the shortest player-ID prefix of
   at least four characters that is unique within that visible set. Extend the
   prefix until it is unique; full player IDs are already unique.

The suffix is presentation only. It must never be written back to `player.name`.

Use one small label helper only if at least two affected action surfaces need identical output. Otherwise keep the derivation in the existing view-model builder.

Apply the same helper to all controls where ambiguity can change a player:

- Match-day Starting XI and bench controls.
- Hero License controls, including the contract-license reclaim choice.
- Contract-promise or renewal choices that show two active-squad candidates.
- Scout-report actions and Deals listings when visible targets share a name.
- Any player picker used by these six fixes.

Long-form story text may keep the normal name unless it also presents an action between duplicate players.

Before closing Finding 1, reproduce the reported Cal Moss sequence against the
reported save or an equivalent fixture. Classify the symptom as a stale-build
issue only if the ID regression passes and the reported sequence does not fail
on the tested SHA. If it still fails, fix the reproduced path. The release
cannot close with the symptom unexplained.

### 5.4 Tests

Add focused tests for:

- Duplicate names with distinct IDs.
- Duplicate name and different role.
- Duplicate name and same role with shirt-number fallback.
- Final stable ID suffix fallback.
- A save round-trip that keeps both IDs and both license values.
- No name change in persisted player data.

### 5.5 Acceptance

- Both Cal Moss records appear.
- The original forward keeps his license unless his ID is toggled.
- The midfielder can receive the added license by ID.
- No license, power, promise, or lineup slot moves because names match.
- Every action surface makes the two players distinguishable.

## 6. Finding 2 — automatic lineup behavior

### 6.1 Canonical rule

This section supersedes the selection behavior in `2026-08-22-automatic-lineup-selection.md` where it conflicts.

When the manager selects a formation, automatic arrangement must preserve each current starter if:

- The player is available.
- If the player is powered, they currently hold a Hero License.
- The new formation still has an unused slot for the player's natural role.
- Keeping the player does not violate a required contract promise.

If the formation has fewer slots for a role, keep the strongest legal current starters for that role. Rank them by:

1. Active Starter or Captaincy promise.
2. Conditioned natural-role rating, descending.
3. Licensed hero on an exact rating tie.
4. Existing lineup order.
5. Player ID ascending.

Then fill empty slots with the best available unselected natural-role player:

1. Conditioned rating for that natural role, descending.
2. Licensed hero on an exact tie.
3. Player ID ascending.

Only after the natural-role pool for that slot's required role is exhausted may
an empty outfield slot use an out-of-role outfielder. A goalkeeper is not a
fallback candidate. Rank fallback players by conditioned rating for the vacant
slot's role, then licensed hero, then player ID.

The natural-role and fallback pools contain only currently unused, eligible
players. Formation arrangement may prioritize a promised current starter to
avoid churn, but the existing `restoreCareerContractPromiseLineup` pass remains
the policy owner and runs after arrangement. Validate the final restored lineup
with the existing promise assertion and `buildCareerTeamDef`.

Never place an outfielder in goal.

### 6.2 Narrow repair rule

Injury, leave, sale, awakening, and Hero License changes use narrow repair. They replace only illegal or unavailable starters.

For a vacated slot, choose:

1. A natural-role player before an out-of-role player.
2. Highest conditioned rating for the slot's required role.
3. Licensed hero on an exact tie.
4. Player ID ascending.

After this choice, the existing `restoreCareerContractPromiseLineup` pass owns
Starter and Captaincy promise restoration. Do not duplicate that policy inside
the replacement comparator. A focused test must prove the post-repair lineup
still honors every active required promise.

The current comparator places licensed heroes before the rating comparison and
sorts them last. Replace it with the exact order above: natural role first,
conditioned rating for the required slot descending, licensed hero on an exact
rating tie only, then player ID ascending.

### 6.3 Hero License return

When a starting hero loses a Hero License through manual Hero License selection
or a new awakening, record that starter's existing slot index in the existing
`returnLineupSlot` field before benching them. Do not overwrite an existing
claim.

`CareerPlayer.returnLineupSlot` already exists in `src/game/types.ts` and is an
optional persisted slot index in `src/persistence/game-state-codec.ts`. Existing
saves already use it for injury and granted-leave returns. Treat it as one
home-slot claim for every temporary selection absence, including a missing Hero
License. This change adds no field and does not reinterpret old values.

When that same hero becomes licensed, the existing repair pass must try to
restore the player if the stored slot still matches the hero's natural role and
the return is otherwise legal.

A stored claim is consumed only when the player is currently available and,
when powered, licensed. An unlicensed hero recovering from injury is not
returned and keeps the claim until relicensing. Any refused return keeps a
still-valid claim.

This is one explicit exception to narrow repair. On a Hero License grant, a
stored return may displace only the unprotected occupant of that exact slot.
Every other legal starter and slot stays unchanged.

A negotiated contract promise that reclaims a Hero License is different. It is
an explicit signed exchange: the chosen hero gives up the license and the new
promise holder takes the intended slot. That route must not create a return
claim for the displaced hero.

On a license grant, first complete ordinary repair and
`restoreCareerContractPromiseLineup`. Then attempt the stored return against
that promise-restored lineup. Validate the candidate with the existing contract
promise assertion. If it fails, keep the promise-restored lineup and treat the
return as refused.

The slot is valid only while the active formation still maps that index to the
hero's natural role. A formation change clears only a claim whose slot is
missing or no longer matches that natural role.

Restoration must not:

- Exceed the Hero License cap.
- Break a stronger required contract promise.
- Put a goalkeeper outfield or an outfielder in goal.
- Displace a player who has since gained a protected Starter or Captaincy promise.

Do not write, overwrite, or clear the claim for a Hero License action while the
player is injured or on granted leave. Clear `returnLineupSlot` after a
successful return, when its slot becomes invalid, or when the player leaves the
roster. A return refused by a protected promise leaves both the current lineup
and the valid claim unchanged.

This changes the current test that expects relicensing to leave the repaired lineup untouched. The new expected result is automatic return when the stored slot is still legal.

### 6.4 Thin squads and errors

Keep the current guarded store action and localized `formationCannotBeFilled` error path.

Do not add a new `tryArrange...` API unless a focused test proves a caller mutates state before the existing throw. The current arranger builds a candidate after all slots are filled, so a throw should leave the prior lineup unchanged.

Keep the existing emergency-youth behavior where narrow repair already owns it. Formation selection itself does not mint new players.

### 6.5 Tests

Extend `src/game/__tests__/squad.test.ts` and the focused store tests:

- Legal same-role starters remain after formation change.
- Surplus same-role starters remove the lowest conditioned, unprotected player first.
- A stronger benched player fills an empty natural-role slot.
- A forward does not start in defence while a legal defender is available.
- A licensed hero wins only an exact conditioned-rating tie.
- Injury/license repair uses conditioned slot rating.
- An unlicensed starting hero gets `returnLineupSlot`.
- Relicensing restores that hero without a manual swap.
- A later protected promise can block the automatic return.
- A blocked return preserves a valid stored slot without displacing the promise holder.
- A formation change clears only an invalid return slot.
- Injury and leave claims survive Hero License toggles.
- A later awakening benches an unlicensed starter through the same comparator
  and records the same valid return claim.
- Required contract promises remain honored after narrow repair.
- Required contract promises remain honored after a formation change.
- An unlicensed hero recovering from injury stays benched and keeps the valid
  claim until relicensed.
- When more promised players share a role than there are slots, restoration
  honors the earliest `agreedSeason`, then the lowest player ID.
- A negotiated Hero License reclaim performs the signed slot exchange and does
  not create a return claim.
- A thin squad keeps the old lineup and shows the localized error.
- Repeating from the same state produces the same ID order.

### 6.6 Acceptance

- Formation changes do not churn legal starters without reason.
- Weak players do not beat stronger natural-role players because of comparator order.
- No automatic forward-in-defence result occurs while a defender is available.
- A newly relicensed former starter returns automatically when legal.
- Manual swaps still work and remain untouched by later ordinary weekly settlement.

## 7. Finding 3 — Sign the player from a scout report

### 7.1 Player flow

Every completed scout report card has a clear action:

**Sign the player**

Pressing it:

1. Does not dismiss the report.
2. Changes the Market section to Deals.
3. Finds the BUY listing with the same immutable `playerId`.
4. Scrolls that listing into view once.
5. Gives that listing a visible, accessible highlight.
6. Leaves the player to press the existing fee or talks action.

The action does not start transfer talks itself. It does not pay money. It does not sign a contract.

### 7.2 Minimal UI design

Keep the route inside `MarketScreen` because that component already owns the active `section`.

Add one local optional `focusedScoutedPlayerId` state value.

Pass an internal `onSignPlayer(playerId)` callback to `ScoutingDesk`. Do not add it to the store-facing `MarketScreenProps`.

The `ScoutingDesk` button press handler must call `event.stopPropagation()`
before it invokes `onSignPlayer(playerId)`. The `MarketScreen` handler then:

- Confirms the current view model still has the BUY listing for that exact ID.
- If it does not, keeps the Scout section and announces
  `market.scoutedPlayerUnavailable`.
- Otherwise stores the report's player ID and sets `section` to `TRANSFERS`.

Pass the focus ID to `TransferDesk`.

Each transfer row already has a stable player ID. The matching BUY row records its layout position or ref through the smallest pattern already used in this screen. After the Deals section mounts, scroll the parent market view on that row's first layout pass.

After the scroll completes, move accessibility focus to the matching row or
announce its disambiguated label with React Native's accessibility API. A
selected state alone is not enough because it does not tell a screen-reader
user that navigation completed.

Do not add `signAvailable` or blocked-reason fields to the scout-report view model. The current market adapter already requires every report to map to a BUY listing and throws if it does not. Reuse that invariant.

### 7.3 Focus lifetime

Keep `focusedScoutedPlayerId` after the one-time scroll so the row remains
highlighted. Clear it when:

- The player starts or completes a transfer action.
- The report/listing disappears.
- After Deals has mounted the focus row, the user manually selects another Market section.
- The user leaves the Market screen.

The section change performed by `onSignPlayer` is the focus operation. It must
not run the manual-section clear path.

Do not persist focus in game state.

If reduced motion is enabled, show the static highlight without animation.
When motion is allowed, keep any highlight animation bounded and use the
existing reduced-motion value rather than adding another preference.

### 7.4 Layout

Put **Sign the player** before **Dismiss report** in the report action row.

The action must be available for exact and ranged reports. Buying a detailed report remains optional.

When the transfer window is closed, the action still opens Deals, scrolls to
the exact BUY row, and highlights its disabled transfer action. It does not
start talks or bypass the existing closed-window rule.

On narrow screens, actions may wrap. Each target keeps the existing minimum touch size. The button must not be clipped in Spanish, German, French, Portuguese, Indonesian, or Vietnamese.

### 7.5 Copy

Add these keys in every locale:

- `market.signThePlayer`
- `market.a11y.signPlayerFromReport`
- `market.scoutedPlayerUnavailable`

English values:

- `market.signThePlayer` = `Sign the player`
- The accessibility value uses the disambiguated visible label, for example
  `Sign Cal Moss (MID) from this scouting report` when another visible Cal Moss
  exists.

Other locales use a natural direct-action translation. Do not use `Go to Deals`.

### 7.6 Tests

Add focused UI/source tests for:

- Every completed report renders **Sign the player**.
- The button stops card propagation.
- Pressing it switches to `TRANSFERS`.
- The matching BUY listing is selected by `playerId` when two listings share a name.
- The matching row receives scroll and highlight behavior.
- The matching row receives accessibility focus or an announcement after the
  scroll.
- The internal switch to Deals keeps focus; a later manual section change clears it.
- The action does not call `onTransferAction`.
- A missing BUY listing keeps Scout open and announces the localized unavailable message.
- A closed transfer window still focuses the exact disabled BUY row without
  opening talks.
- Reduced-motion mode still shows a non-motion highlight.
- Long locale labels wrap without hiding the action.

### 7.7 Acceptance

From any completed scout report, one press on **Sign the player** opens Deals with that exact player highlighted. The normal transfer fee and contract flow remains unchanged.

## 8. Finding 4 — percentage contract controls

### 8.1 Contract

Each wage increase or decrease is based on the original agent asking wage:

`step = max($50, Math.round((original_weekly_ask × 5%) / $10) × $10)`

The step stays constant for the whole negotiation. Asking wages are positive
integers, so JavaScript `Math.round` defines the half-step behavior.

Examples:

| Original weekly ask |   Step |
| ------------------: | -----: |
|              $1,000 |    $50 |
|              $1,250 |    $60 |
|             $10,000 |   $500 |
|             $63,631 | $3,180 |
|            $176,472 | $8,820 |

The $50 result for a $1,000 ask is correct because the percentage and the floor are equal. A visual $50 step is not by itself proof of the old fixed-step bug.

### 8.2 Implementation gate

The current source already implements this formula in `contractWageStep`.
`negotiation.weeklyAsk` is set when talks open and is immutable for the life of
that negotiation; counter rounds record `effectiveAsk` without replacing it.
The negotiation view model computes `wageStep` from that immutable value, and
the panel uses the result.

Therefore:

1. Add or keep helper tests for representative low, normal, and high asks.
2. Add a focused negotiation-panel test that presses plus and minus from an ask above $1,000.
3. Confirm the displayed offer changes by the view-model `wageStep`.
4. Confirm the step does not change after an offer round.
5. Record the tested commit SHA and build surface during runtime QA.

The accepted recovery plan in commit `2fcaecbb0` explicitly changed the wage
step from 1% to 5%, and that commit changed `contractWageStep` plus its focused
tests. `docs/06-economy.md` still says 1% because that same commit did not update
the design line. The accepted plan and shipped tested behavior make 5%
authoritative; correct the stale document without changing balance.

If all checks pass, make no production arithmetic change. Classify the playtest result as either:

- A stale deployed build, or
- A low asking wage whose 5% step hit the $50 floor.

Only change production code if a current-source test fails and identifies a different live calculation.

### 8.3 Non-goals

- No new wage-step caption.
- No balance change.
- No cents.
- No recalculation from the manager's current offer.
- No new build-stamp UI.

### 8.4 Acceptance

For a $10,000 original ask, one press changes the offer by $500 throughout that negotiation. For a $1,000 ask, one press changes it by $50. Both are the same rule.

## 9. Finding 5 — Story of the Year ranking

### 9.1 Problem

`buildSeasonRecap` records the latest resolved event. `seasonEndViewModel` then uses that event whenever present. This lets routine copy outrank a major football achievement.

The headline is a ranked season summary, not a log of the last event.

### 9.2 Ranking

Choose the first true result:

1. Unbeaten league-and-Cup double.
2. League-and-Cup double.
3. Perfect league season.
4. Unbeaten league title.
5. League title.
6. Cup win.
7. Promotion without a title.
8. Latest resolved authored event.
9. No Story of the Year.

Definitions:

- League title: `finalPosition === 1`.
- Cup win: `cupResultKey === 'recap.cupWinners'`.
- Perfect league: `played > 0 && won === played && drawn === 0 && lost === 0`.
- Unbeaten league: `played > 0 && lost === 0`. Draws are allowed.
- Unbeaten double: unbeaten league, league title, and Cup win are all true.
- Double: league title and Cup win are both true.
- Promotion: use the existing final-position and division rules already used by the season outcome. Do not infer it from copy text.

For the reported D1 season with no league loss and a Cup win, the result is **Unbeaten league and Cup double**.

### 9.3 Minimal implementation

Keep `memorableEventId` in `SeasonRecap` for history and old saves.

Add one pure application-layer selector near `seasonEndViewModel`. It accepts the recap facts and returns a small story key or `undefined`. It does not change persisted recap data.

For an old recap with no `cupResultKey`, accept the authored English fallback
`cupResult === 'Winners'`. This is an approved compatibility path for recaps
saved before `cupResultKey`; never parse translated display text.

The view model resolves the selected key through i18n. Only when no ranked football achievement applies may it load `memorableEventId` and use the authored event title.

Do not add a new persisted `SeasonStory` union. The story is derived from facts already stored in `SeasonRecap`.

### 9.4 Copy

Add localized keys for:

- `seasonEnd.unbeatenDouble`
- `seasonEnd.double`
- `seasonEnd.unbeatenLeagueTitle`
- `seasonEnd.cupWinners`
- `seasonEnd.promoted` if no suitable existing promotion headline can be reused.

Keep existing `seasonEnd.perfectLeagueSeason` and `seasonEnd.leagueTitle`.

English should be short enough for the existing card. The reported result uses `Unbeaten league and Cup double`.

### 9.5 Tests

Add a table-driven test for the complete ranking order.

It must include:

- Unbeaten double beats routine event.
- An unbeaten non-champion Cup winner is never called a double.
- Double with one league loss beats routine event.
- Perfect title without Cup beats ordinary unbeaten title.
- Drawn-but-unbeaten title is not perfect.
- Title beats Cup-only.
- Cup-only beats routine event.
- Promotion beats routine event.
- A routine event appears when no football achievement applies.
- No event and no achievement returns no story.
- Old recap data without a Cup key still renders safely.

### 9.6 Acceptance

The reported D1 champion and Cup champion season cannot show `Lo ha pedido por escrito` as Story of the Year. It shows the unbeaten double headline.

## 10. Finding 6 — stale transfer-request messages

### 10.1 Ownership

A transfer-request row is a live projection of a player on the user's current roster whose `transferRequested` value is true.

The row ID remains `transfer-request-<playerId>`.

The row must disappear as soon as either condition is false:

- The player is no longer on the user's roster.
- `transferRequested !== true`.

Dismissal is not resolution. Dismissing the row for the current week may hide it temporarily, but it must return in a later week while the request is still active.

### 10.2 Reproduction before code

Build one focused regression around the exact public view-model path:

1. Start with Ty Brooks on the user's roster and `transferRequested: true`.
2. Build `homeViewModel` and prove the row is visible and actionable.
3. Resolve the request through each real supported route.
4. Build `homeViewModel` again from the returned state.
5. Prove the row is absent.

Audit the real resolution routes, including:

- Successful renewal.
- Morale recovery through the existing gift path.
- Sale or other roster departure.
- Any explicit withdrawal or season transition that the current rules call a resolution.

Do not clear a request merely because an unrelated player request ended. The finding is about a transfer request, not the separate `playerRequests.pending` feature.

### 10.3 Fix location

If `homeViewModel` still shows a row when the player is absent or the flag is false, fix the derived filter or weekly scheduler selection by player ID.

If a resolution route returns the player with `transferRequested: true`, fix that route at the point where the request becomes resolved.

Use the existing state field. Do not add OPEN, RESOLVED, or ARCHIVED inbox records. Do not add a cleanup sweep unless more than one proven writer leaves the same stale flag and no shared existing function owns those writers.

### 10.4 Actionability

While the request is active, its row must route to a useful existing screen for that player. It must not open a completed or missing negotiation.

After resolution, no old delivered flag may recreate the row. The scheduler may remember weekly delivery, but it must intersect that record with current `homeProductAlerts`.

### 10.5 Tests

Add focused tests for:

- Active flag creates one row for the exact player ID.
- `transferRequested: false` removes it in the same week.
- Removing the player removes it in the same week.
- Successful renewal clears the flag and removes the row.
- A qualifying morale gift clears the flag and removes the row.
- A non-qualifying gift keeps the active row.
- Weekly delivery flags cannot recreate a resolved row.
- Two same-name players do not share or clear each other's row.
- Dismissal does not mutate `transferRequested`.
- A dismissed active row returns in the next week, while a resolved row does
  not return even when an old weekly delivery flag remains.

### 10.6 Acceptance

After Ty Brooks' transfer request has genuinely ended, no Ty Brooks transfer-request row remains or acts as if talks are open. An unresolved request remains visible and useful.

## 11. Implementation order

Implement in six narrow changes. Each change should stay reviewable on its own.

1. Identity regression and duplicate display labels.
2. Automatic arrangement and narrow repair.
3. Scout-report **Sign the player** route.
4. Contract-step proof and only the production fix a failing test requires.
5. Story ranking.
6. Transfer-request lifecycle regression and the proven flag-owner fix.

The order prevents the duplicate-name scenario from making later UI tests ambiguous.

Do not combine these changes with balance work, art work, audio work, or unrelated copy.

## 12. Verification matrix

### 12.1 Focused automated checks

Run the smallest affected tests after each change.

Expected target areas:

- `src/game/__tests__/progression.test.ts`
- `src/game/__tests__/squad.test.ts`
- `src/application/__tests__/store.test.ts`
- New or existing focused Market screen contract tests.
- `src/game/__tests__/market.test.ts`
- `src/application/__tests__/market-source-adapter.test.ts`
- `src/application/__tests__/default-career-journey.test.ts` or a new focused story-ranking test.
- Focused assistant inbox and renewal/gift tests.

Then run:

```sh
npx tsc --noEmit
```

Do not run balance, soak, or large seed-rail tests. These fixes do not change simulation, economy tuning, progression balance, or RNG consumption.

### 12.2 Runtime QA

Use a controlled career or dev harness with explicit player IDs.

Verify:

- Two same-name heroes can be licensed independently.
- Formation selection preserves legal starters.
- A relicensed former starter returns when legal.
- **Sign the player** opens Deals and highlights the correct same-name listing.
- A $10,000 ask moves in $500 steps.
- The unbeaten double headline appears.
- A resolved transfer-request row disappears without advancing a week.

Record:

- Commit SHA.
- Save or harness scenario.
- Platform and build command.
- Whether the build was rebuilt after the SHA.
- Screenshots for the duplicate label, Deals highlight, story headline, and cleared inbox.

Use the background browser pane first and keep it muted. Clean up only the server, page, or simulator started for this QA.

## 13. Release gates

The package is ready only when all are true:

- [ ] Player identity actions use immutable IDs.
- [ ] Duplicate labels are unambiguous on every player-specific action surface in scope.
- [ ] The reported duplicate-name symptom has a reproduced fix or a recorded stale-build disposition.
- [ ] Automatic lineup tests cover preservation, surplus removal, natural-role fill, and fallback.
- [ ] Relicensing restores a legal former starter without a manual swap.
- [ ] The scout report says **Sign the player**.
- [ ] That action focuses the exact BUY listing and does not spend money.
- [ ] Wage steps pass helper and UI tests using the original ask.
- [ ] The story ranking puts an unbeaten double above any routine event.
- [ ] Resolved transfer requests do not appear in the current inbox.
- [ ] Existing saves load without migration.
- [ ] All new copy exists in every locale.
- [ ] TypeScript and focused tests pass.
- [ ] Runtime QA records the tested SHA and build provenance.

## 14. Explicit non-goals

Do not add:

- A name uniqueness rule.
- A player-name migration.
- A new ID type or identity service.
- A new lineup engine or `tryArrange` wrapper without a failing caller test.
- Tactical chemistry or power-value scoring.
- Direct signing from a scout card.
- New scout-report availability fields already guaranteed by the adapter.
- A wage-step explainer or global build-stamp UI.
- A persisted season-story type.
- A persisted inbox lifecycle.
- New currencies, balance changes, RNG draws, or engine-version changes.

## 15. Open implementation questions

These are evidence checks, not product decisions:

1. Which active-squad view-model is the narrowest shared place for duplicate display labels?
2. Which existing Market scroll/ref pattern best fits the Deals focus row?
3. Which exact transition produced Ty Brooks' stale flag in the reported save?
4. Was the Season 9 negotiation ask low enough for the correct 5% rule to equal $50?
5. Which deployed commit produced the screenshots?

Answer these during implementation. None changes the player contract above.
