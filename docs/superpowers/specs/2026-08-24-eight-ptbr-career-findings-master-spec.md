---
date: 2026-08-24
topic: eight-ptbr-career-findings
status: council-round-2-revised
source-base: origin/main@ef59a615b99650ff9451f2455b404034772733d1
---

# Eight PT-BR Full-Career Findings — Master Implementation Spec

## 1. Authority and baseline

This spec covers the eight findings shown in the Portuguese full-career report at
`docs/superpowers/reports/2026-08-24-ptbr-full-career-playtest.html`:

1. A maxed stat still accepts a paid drill.
2. Early Hero Cup rounds are not competitive.
3. A transfer request can appear stale after morale recovers.
4. Hero License changes can leave the wrong lineup replacement.
5. Two starters can show the same shirt number.
6. The same repeatable story can return too often.
7. Potential grades can disagree between Scout Reports, Deals, and Squad.
8. A Starter promise can appear to block an otherwise valid contract offer.

The screenshots and report are evidence. Their suggested fixes are proposals,
not instructions. This spec resolves them against the current source.

The inspected source base is `origin/main` at
`ef59a615b99650ff9451f2455b404034772733d1`. The local `main` checkout was behind
that base and contained unrelated work. Implementation must start from the latest
`origin/main` in a clean branch or worktree. Do not copy older local versions of
`src/game/squad.ts`, `src/application/view-models.ts`, or
`src/application/market-view-model.ts` over the remote fixes.

This document specifies work only. It does not authorize product-code changes,
commits, pushes, or release work.

## 2. Current-source verdict

| Finding | Current status | Required work |
| --- | --- | --- |
| 1. Paid `+0` drill | Confirmed contract conflict | Make visible 999 the training ceiling, align the preview, and retire hidden post-999 keeper growth explicitly. |
| 2. Easy early Cup rounds | Partial fix | Extend the current D1/D2 opponent floor from the Round of 32 through the Round of 16. |
| 3. Stale transfer request | State fix exists; feedback is incomplete | Keep the personality withdrawal rule. State whether the request ended or remains active after a gift. |
| 4. Weak license replacement | Fixed on `origin/main` by `f5739e3c` | Preserve and prove the shipped narrow-repair and return-slot behavior. |
| 5. Duplicate shirt number | Confirmed display defect | Derive one unique active-squad number map while preserving promised number 10. |
| 6. Repeated exact story | Confirmed selection defect | Give the only repeatable event one full intervening season and prefer unseen stories. |
| 7. Conflicting potential grade | Confirmed presentation defect | Use `playerGrowthGrade` for every exact grade shown for the same player. |
| 8. Starter promise block | Fixed in current source | Preserve pre-submit validation, legal license reclaim, and exact localized blockers. |

Only Findings 1, 2, 3, 5, 6, and 7 need production changes. Findings 4 and 8
are proof-only unless their focused tests fail on the implementation base.

## 3. Goals

- Never charge TP for a drill that cannot raise the number the manager sees.
- Keep the first two proper Cup rounds relevant for a D1 or D2 club.
- Make a gift's transfer-request result explicit.
- Keep Hero License repair narrow, strong, deterministic, and role-correct.
- Show unique shirt numbers across the active squad.
- Stop one repeatable story from crowding out the event catalog.
- Give one exact potential grade for one player on every screen.
- Reject an illegal contract promise before submission and explain why.

## 4. Non-goals

- Do not change drill costs or rescale the keeper Reflexes axis. Keep the display
  ladder below 999; retire only paid hidden growth after the visible ceiling.
- Do not scale Cup opponents to the user's rating or fabricate eliminated clubs.
- Do not weaken personality-specific transfer-request thresholds.
- Do not rebuild a legal manager-picked lineup.
- Do not add a shirt-number editor or persist derived squad numbers.
- Do not add new career events or a configurable cooldown system.
- Do not change the potential, SUPER, age, archetype, or valuation formulas.
- Do not make every contract promise legal. Some promises must remain blocked.
- Do not change match simulation or `ENGINE_VERSION`.

## 5. Shared contracts

### 5.1 Determinism

- No new `Math.random`, `Date.now`, locale-sensitive ordering, or RNG draw.
- Every new ordering ends in `compareIds` or an existing stable roster position.
- Cup pairing may reorder surviving club IDs. It must not add or remove a draw.
- Event selection keeps its existing two deterministic rolls and changes only the
  candidate set and integer weights.

### 5.2 Save compatibility

No save migration is required.

- Use existing `resolvedEventHistory` for event cooldowns.
- Keep `returnLineupSlot` behavior from `origin/main`.
- Keep `shirtNumber` as the persisted field for explicit promises only.
- Do not persist gift-result copy, derived shirt numbers, or potential labels.
- A save without `resolvedEventHistory` cannot prove which repeatable stories it
  has seen. Treat repeatable candidates as seen for weighting, with no cooldown,
  until the first post-update resolution creates history.

### 5.3 Localization and accessibility

All new copy ships in English, Spanish, Portuguese (Brazil), French, German,
Indonesian, and Vietnamese.

- Disabled drills expose the maximum-state reason to VoiceOver.
- Gift feedback is included in visible copy and the accessibility announcement.
- Shirt numbers remain text, not color-only identity.
- Contract blockers keep typed translation keys and raw interpolation values.

### 5.4 Error boundaries

The UI is not the only guard.

- `trainPlayerInstantly` refuses a display-maxed drill before TP or RNG changes.
- Cup creation validates the entrant count and never duplicates a club.
- Contract submission keeps its typed promise backstop.
- Missing optional presentation data falls back safely without mutating a save.

## 6. Finding 1 — paid drill at the visible ceiling

### 6.1 Current cause

`trainPlayerInstantly` rejects a drill only when the stored attribute is 999.
`selectedPlayerStatOptions` also sets `atSafetyCeiling` from the stored value.

Goalkeeper Reflexes can display 999 before the stored value reaches 999 because
`refDisplayBonus` is presentation-only. The current flow can therefore:

1. Show 999 REF.
2. Offer a nominal `+20` Keeper Drill.
3. Charge TP.
4. Improve a hidden stored value.
5. Show a `+0` result because the visible value stays capped at 999.

That violates the paid-training contract even when the hidden value improved.

### 6.2 Decision

The player-visible ceiling owns trainability. This intentionally replaces the
old keeper contract that allowed stored Reflexes to keep rising after the card
had stalled at 999.

- A drill is unavailable when `displayedValue(player, attribute) >= 999`.
- The engine backstop checks that condition before resolving the drill, spending
  TP, incrementing `totalInstantDrills`, or deriving SUPER/injury outcomes.
- The picker uses the same condition for `atSafetyCeiling`.
- The drill-row and confirmation headline use the clamped base visible delta:
  `preview.baseAfter - currentValue`.
- Keep the existing signed `trainingAdjustment` separate. The exact ordinary
  visible result is `preview.adjustedAfter - currentValue`; the confirmation
  total and accessibility hint state that result before payment.
- A SUPER result can exceed the ordinary preview, but cannot exceed visible 999.
- Keep `refDisplayBonus` and the current display ladder below 999. Once the
  visible value reaches 999, paid drills no longer raise the hidden stored value.

The base and exact ordinary gains may be smaller than the authored drill gain.
That is expected near 999. The confirmation must state the exact ordinary result
before payment without folding the signed adjustment into the base headline.

### 6.3 Source changes

- `src/game/training.ts`
  - Reuse `displayedValue` for the tap-time maximum guard.
  - Keep the existing stored-value cap inside growth as a second safety layer.
  - Update the old hidden-growth comments to name visible 999 as the paid-drill
    boundary.
- `src/application/store.ts`
  - End a requested drill batch after the resolution that reaches visible 999.
    Do not call the guarded engine again. Commit every completed drill.
- `src/application/view-models.ts`
  - Set `atSafetyCeiling` from `displayedAttributeValue`.
  - Set `gain` from `preview.baseAfter - currentValue`. Do not use
    `preview.adjustedAfter - currentValue` as the base headline.
- `src/ui/TrainingDrillModal.tsx`
  - Reuse the existing disabled treatment.
  - Give a maxed row an explicit localized maximum-state accessibility hint.
  - Show `MAX` instead of `+0` on that disabled row.
  - Keep the base line and signed adjustment, and make their ordinary total
    explicit before the user confirms.
  - Limit the repeat picker to the number of ordinary drills that can fit in the
    remaining visible headroom. Clamp its ordinary estimate to that headroom.
  - Quote the TP for that limited count; a SUPER or injury may still stop early,
    and only completed drills spend TP.
  - End both the watched repeat loop and the dismiss-to-skip handoff after a
    result reaches visible 999.
- `src/application/displayed-attributes.ts`
  - Replace the comment that promises hidden growth after visible 999.
- `src/audit/__tests__/keeper-display-drift-rail.test.ts`
  - Stop the long-career tap loop when the visible value reaches 999.
  - Keep the existing drift bound. Do not raise it to hide a failure.

Do not add a second preview function.

### 6.4 Edge cases

- Stored 999 and displayed 999: disabled.
- Stored 990 plus a display bonus of 9 or more: disabled at displayed 999.
- Displayed 998 with an ordinary visible gain of 1: enabled and promises `+1`.
- A SUPER result cannot bypass the visible 999 ceiling.
- A multi-drill batch stops after the drill that reaches 999 and keeps every
  completed drill in that batch.
- A near-cap repeat confirmation never quotes more visible gain or ordinary
  runs than can fit before 999.
- A blocked tap leaves TP, condition, nonce, promise debt, and RNG-derived state
  unchanged.

### 6.5 Tests and acceptance

Add focused tests for:

- A normal outfielder at stored 999.
- A keeper below stored 999 but at displayed 999.
- A keeper at displayed 998 whose authored gain is larger than the remaining room.
- The engine backstop proving no TP, condition, nonce, or promise-debt change.
- The row headline equals the clamped base line; the base plus signed adjustment
  equals the exact ordinary preview and ordinary resolution.
- The old `keeper-display-parity` stored-ceiling assertion is deliberately
  inverted, and the maxed accessibility hint names the reason.
- The always-on keeper drift rail stops cleanly at the visible ceiling.

Acceptance:

- Sam Mitts at displayed 999 REF cannot start the paid drill.
- A near-cap drill states the exact visible gain before payment.
- Existing non-cap drill outcomes remain byte-identical for the same state and tap.

## 7. Finding 2 — noncompetitive early Hero Cup rounds

### 7.1 Current cause

`roundOf32PairingOrder` already protects a D1 or D2 user club from a D4/D5
opponent in the Round of 32 when a D1-D3 survivor is available.

The Round of 16 returns to `highLowPairingOrder`. A strong user club can then be
paired with the weakest surviving club. This preserves the reported 16-0 path.

### 7.2 Decision

For a user club currently in D1 or D2:

- Apply the D3-or-stronger opponent floor in both the Round of 32 and Round of 16.
- If the user's initial pairing fails the floor, swap only the opponent slot with
  a D1-D3 survivor from another fixture.
- Prefer the weakest eligible D1-D3 opponent. This keeps early ties relevant
  without forcing the hardest possible draw.
- If no safe D1-D3 swap exists, keep the base pairing.
- Do not revive, fabricate, or duplicate a club.
- Quarter-finals onward keep the existing high/low draw.
- D3-D5 user clubs keep the existing draw and giant-killing path.

### 7.3 Source changes

- `src/game/pyramid.ts`
  - Keep the existing Round-of-32 D1-vs-D5 avoidance pass unchanged.
  - Extract only the protected-club opponent-floor swap from
    `roundOf32PairingOrder`.
  - Apply that swap after the Round-of-32 order and after the Round-of-16
    `highLowPairingOrder`.
  - Call it only from the explicit `round === 2` and `round === 3` branches.
    Quarter-finals onward stay on plain `highLowPairingOrder`.
  - Run the protected-floor swap only for a D1 or D2 user club.
  - Prefer the weakest eligible D1-D3 opponent, then existing paired position.
  - Reject a candidate swap if it would create a D1-vs-D5 fixture elsewhere.
    If no safe candidate exists, leave the base order unchanged.
  - Perform at most one opponent-slot swap for the protected club. Do not run
    the D1-vs-D5 avoidance pass in the Round of 16.
- `docs/02-core-loop.md`
  - State the D1/D2 opponent floor for the Round of 32 and Round of 16.

No match-engine tuning belongs in this fix.

### 7.4 Edge cases

- The user receives a bye: no pairing change is needed.
- Only one legal opponent exists: use it.
- Every D1-D3 club except the user is eliminated: keep the base pairing.
- The protected club is at either side of a fixture pair.
- The swap must leave every surviving club in exactly one fixture.
- Save/reload before the next round creates the same fixtures.

### 7.5 Tests and acceptance

Use deterministic seed rails for D1 and D2 user clubs.

Assert for the Round of 32 and Round of 16:

- The opponent is D1-D3 whenever such a survivor exists.
- Every entrant appears once.
- Home/away fields remain valid.
- Identical career state creates byte-identical rounds.
- D3-D5 user pairing snapshots remain unchanged.
- Quarter-final, semi-final, and final rules remain unchanged.
- The Round-of-32 D5 ceiling remains green with a protected D1 and D2 user.

Record before-and-after opponent divisions and goal margins for a representative
D1 career. This is a report, not a new hard balance rail. If extreme margins
remain common against D1-D3 clubs, handle match balance in a separate spec.

## 8. Finding 3 — transfer request after a morale gift

### 8.1 Current cause

`givePlayerGift` already calls `shouldWithdrawTransferRequest` after applying the
morale gain. The saved request flag clears when the player's personality-specific
withdrawal threshold is reached.

The result view model and `PlayerGiftCelebration` show only money and morale.
They do not say whether the request ended. A valid active request therefore looks
like stale state.

### 8.2 Decision

Keep the existing withdrawal rule and its 20-point margin.

When the player had an active transfer request before the gift, return one result:

- `WITHDRAWN`: the gift crossed the player's withdrawal threshold.
- `STILL_ACTIVE`: the player improved but remains below that threshold.

For `STILL_ACTIVE`, show the exact morale target. Example:

> Transfer request remains active. Morale must reach 50.

For `WITHDRAWN`, show:

> Transfer request withdrawn.

Do not create a second request lifecycle or dismiss a valid request early.

### 8.3 Source changes

- `src/game/pyramid.ts`
  - Export a pure `transferRequestWithdrawalMorale(personality)` helper.
  - Make `shouldWithdrawTransferRequest` use it.
- `src/game/player-gifts.ts`
  - Extend `PlayerGiftResult` with the optional outcome and remaining target.
  - Populate it only when the player had an active request before the gift.
- `src/application/store.ts` and `src/ui/models.ts`
  - Carry the result into the existing celebration view model.
- `src/ui/PlayerGiftCelebration.tsx`
  - Show and announce the localized outcome on the final beat.
- `src/ui/dev-harness/entries/player-gift.tsx`
  - Add withdrawn and still-active review cases using production logic.

### 8.4 Edge cases

- No request before the gift: show no request-status line.
- The gift lands exactly on the threshold: withdraw.
- A Greedy player moving from 25 to 45 remains active because the target is 50.
- A Fiery player reaching 45 withdraws because the target is 45.
- Weekly wellbeing can still withdraw a request later.
- Reload uses the saved player flag. Celebration state remains ephemeral.

### 8.5 Tests and acceptance

Add tests for no request, exact threshold, below threshold, and above threshold.
Pin both Greedy and Fiery examples so the personality rule stays visible.

Acceptance:

- The request flag is re-evaluated immediately after the gift.
- The celebration says whether it ended.
- A remaining request states the exact morale target.
- VoiceOver announces the same result.

## 9. Finding 4 — Hero License lineup repair

### 9.1 Current status

This is already fixed on `origin/main` by the six-career-findings work.

Current source:

- Records `returnLineupSlot` for a fit starter who loses a Hero License.
- Replaces only illegal or unavailable starters.
- Prefers the natural role.
- Ranks by conditioned rating before a licensed-hero tie-break.
- Restores the original player after recovery or relicensing when the slot remains
  legal.
- Preserves contract promises and validates the final lineup.

### 9.2 Required action

Do not rewrite this flow.

Run the focused `src/game/__tests__/squad.test.ts` cases from `origin/main`.
Add one regression using the reported shape only if no existing case covers it:

- Milo Dunn starts in his natural role.
- Awakening makes him powered and unlicensed.
- The best eligible natural-role player replaces him.
- Other legal starters remain unchanged.
- Relicensing Milo returns him to the stored slot when still legal.

If these assertions pass, Finding 4 needs no production diff.

## 10. Finding 5 — duplicate active-squad shirt numbers

### 10.1 Current cause

`matchDayViewModel` uses `player.shirtNumber ?? index + 1` for starters and a
roster-index fallback for the bench.

A player with a persisted number-10 promise can therefore share 10 with the
unassigned player whose fallback index is 10. The promise logic is correct; the
derived fallback is not aware of reserved numbers.

### 10.2 Decision

Derive one active-squad number map. Do not persist ordinary shirt numbers.

Number assignment, within states accepted by the save codec:

1. Order players by Starting XI slot, then existing roster order for the bench.
2. Reserve valid explicit `shirtNumber` values first.
3. For an unassigned starter, try `slot + 1` when unused.
4. For an unassigned bench player, try their ordered-squad position plus 1.
5. If the preferred number is used, assign the lowest unused positive number.

`game-state-codec.ts` already rejects duplicate explicit numbers within a club.
Do not add an unreachable duplicate-explicit tie-break. A `JERSEY_10` promise
already persists 10 and clears the previous wearer, so reserving explicit values
makes the promise holder win before any fallback is assigned.

The result is keyed by immutable `player.id`.

### 10.3 Source changes

- `src/application/view-models.ts`
  - Add one local pure helper and build the map once per view model.
  - Use it for starters, bench players, and Squad player rows.
- `src/ui/screens/SquadTrainingScreen.tsx`
  - Render a derived shirt number even when the player is neither captain nor
    carrying a visible contract-promise label.
- Keep `src/game/contract-promises.ts` unchanged unless a failing test proves a
  separate persisted-promise defect.

Do not add a shirt-number editor, save migration, or formatter class.

### 10.4 Edge cases

- The promised number-10 holder starts outside slot 10.
- The promised holder is on the bench.
- An unassigned player whose fallback would be 10 receives another number.
- A lineup swap recalculates a unique map without changing saved players.
- A signing or sale recalculates the map on the next view-model build.
- Duplicate player names do not affect number identity.

### 10.5 Tests and acceptance

Test through the public match-day and Squad view models. Do not export the local
helper only for a test.

Acceptance:

- Gio Gray and Léo Costa cannot display number 10 together.
- Every active-squad player has one number.
- Every displayed active-squad number is unique.
- A valid number-10 promise always keeps 10.
- Building the view model does not mutate `GameState`.

## 11. Finding 6 — repeatable story frequency

### 11.1 Current cause

`the-double-session` is the only event with `trigger.repeatable: true`.
`eventOfferForWeek` gives it normal common-event weight whenever its content
requirements are met. The only spacing rule is the global one-week story gap.

`resolvedEventHistory` already records event ID, season, and week, so no new save
field is needed.

### 11.2 Decision

One full season must intervene before the same repeatable event can return.

If it resolves in Season 8, it is ineligible for the rest of Season 8 and all of
Season 9. It becomes eligible in Season 10.

For the weighted random deck:

- Keep rarity weights `common: 6`, `rare: 3`, and `legendary: 1`.
- Multiply the weight of an event with no history entry by 2.
- A previously seen repeatable event uses its normal rarity weight after cooldown.
- When the optional history field is absent, a repeatable event receives normal
  weight. It does not receive the unseen bonus.
- Guaranteed, milestone, and authored follow-up lanes do not change.

### 11.3 Source changes

- `src/application/event-selection.ts`
  - Filter repeatable candidates using the most recent matching history entry.
  - Derive unseen weight from `resolvedEventHistory`.
  - Keep the existing deterministic event roll streams.
- `docs/07-events.md`
  - Record the repeatable cooldown and unseen weighting.

Do not add `cooldownSeasons` to content. There is one repeatable event, and the
shared rule is sufficient.

### 11.4 Edge cases

- Missing history on an old save: the repeatable event is eligible at normal
  weight because no safe cooldown date exists.
- Multiple old history rows: the latest season controls eligibility.
- No eligible candidates: keep the existing drought behavior.
- The event becomes eligible in Season 10 regardless of its Season 8 week.
- A follow-up chapter ignores this random-deck cooldown.
- Save/reload in the cooldown produces the same offer result.

### 11.5 Tests and acceptance

Add deterministic tests for:

- Same-season exclusion.
- Next-season exclusion.
- Eligibility two seasons later.
- Latest-history selection.
- Old saves without history.
- Production-shaped repeatable history with no `resolvedEventIds` entry.
- Unseen common weight 12 versus seen common weight 6.
- No added RNG calls or changed roll stream names.

Acceptance:

- `the-double-session` cannot appear in consecutive seasons.
- An unseen legal story is twice as likely as a seen eligible story of the same
  rarity.
- Event selection remains deterministic across reload and JavaScript engines.

## 12. Finding 7 — potential-grade disagreement

### 12.1 Current cause

The game has two valid but different calculations:

- `playerPotentialGrade`: raw persisted talent tier and deterministic variant.
- `playerGrowthGrade`: current growth pace after age, role, archetype, and SUPER
  chance are combined.

The Squad screen and exact Deals listings use `playerGrowthGrade`. Exact Scout
Reports can still call `playerPotentialGrade` through `scoutPotentialLabel`.
That lets one player show C- before signing and B- immediately after signing.

### 12.2 Decision

Every exact grade shown for a known player is `playerGrowthGrade(player)`.

- Squad keeps its current grade.
- Deals keeps its current exact grade.
- An exact Scout Report uses the same grade from the same player record.
- A non-exact Scout Report keeps a range. It must not reveal an exact hidden tier.
- SUPER chance remains based on raw potential, as it is today.
- Copy continues to explain that the grade is current growth speed while the
  percentage is the per-drill SUPER chance.

### 12.3 Source changes

- `src/application/market-source-adapter.ts`
  - Add the known player's `playerGrowthGrade` to the scout identity source.
  - Keep that grade on a scouted BUY listing even when `potentialRange` exists.
- `src/application/market-view-model.ts`
  - Let `scoutPotentialLabel` accept an optional exact growth grade.
  - Use it only when the report's potential range is exact.
  - Pass the identity grade to the report and the listing grade to the linked
    Deals card. Route both exact ranges through the same label helper.
  - A known exact report or listing must not reach the raw-grade fallback. Keep
    that fallback only for a genuinely missing identity or legacy caller.
- Reuse `playerGrowthGrade`; do not create a third grade formula.

### 12.4 Edge cases

- Broad report: remains a range.
- Detailed exact report: matches Deals and Squad after signing.
- The player ages between report and signing: each screen reflects current state;
  screens built from the same state must agree.
- A target disappears: use the existing safe report fallback.
- SUPER percentage does not change when only the displayed growth grade changes.

### 12.5 Tests and acceptance

Use a Milo-like player whose raw and growth grades differ.

Acceptance:

- Exact Scout Report grade equals the linked Deals grade.
- The equality holds before signing, while the player is still a BUY listing.
- After signing without a week advancing, the Squad grade is identical.
- Broad reports remain ranges.
- Existing potential sort order uses the explicit grade map, never lexical order.
- Valuation, SUPER chance, and training outcomes are unchanged.

## 13. Finding 8 — Starter promise contract flow

### 13.1 Current status

Current source already:

- Builds each perk with `available` and `blockedReason`.
- Disables blocked perks before submission.
- Chooses the first legal draft perk.
- Offers a Hero License reclaim picker when a legal handoff exists.
- Throws `ContractPromiseBlockedError` with translation keys and parameters as a
  submit-time backstop.
- Keeps direct full-ask renewals safe because they carry no promise.

The Starter promise is not always valid. A true conflict must remain blocked.

### 13.2 Required action

Do not loosen promise rules.

Preserve focused tests for:

- Starter available with a free Hero License.
- Starter available with a manager-selected reclaimable license holder.
- Starter blocked when every license is protected by an active promise.
- Goalkeeper and outfield promise-cap conflicts.
- The exact localized reason shown beside the disabled perk.
- Captaincy succeeding only when its own independent rules allow it.
- Direct full-ask renewal requiring no promise.

If these tests pass, Finding 8 needs no production diff. A generic “not possible”
message in a deployed build is a provenance failure, not permission to bypass a
valid promise conflict.

## 14. Implementation order

1. Start from the latest `origin/main` and confirm Findings 4 and 8 stay green.
2. Fix the paid `+0` drill and its exact preview.
3. Extend the D1/D2 Cup floor through the Round of 16.
4. Add transfer-request outcome feedback to the gift result.
5. Derive unique active-squad shirt numbers.
6. Add repeatable-event cooldown and unseen weighting.
7. Thread the canonical exact growth grade into Scout Reports.
8. Update only the canon docs and locale keys touched by these decisions.

Keep each finding reviewable. Do not combine them through a new service, manager,
or general policy framework.

## 15. Verification

Run focused checks first:

```bash
npx jest src/game/__tests__/instant-training.test.ts src/game/__tests__/keeper-display-bonus.test.ts src/application/__tests__/keeper-display-parity.test.ts src/application/__tests__/training-stat-options.test.ts src/ui/__tests__/training-progress-render.test.ts src/audit/__tests__/keeper-display-drift-rail.test.ts
npx jest src/game/__tests__/pyramid.test.ts src/game/__tests__/cup-match-flow.test.ts src/game/__tests__/cup-giant-killing.test.ts
npx jest src/game/__tests__/player-gifts.test.ts src/application/__tests__/player-gift-store.test.ts src/ui/__tests__/player-gift-celebration.test.ts
npx jest src/game/__tests__/squad.test.ts src/game/__tests__/contract-promises.test.ts
npx jest src/application/__tests__/event-selection.test.ts
npx jest src/application/__tests__/market-source-adapter.test.ts src/application/__tests__/market-view-model.test.ts src/application/__tests__/archetype-cap-view-model.test.ts src/ui/__tests__/squad-potential-labels.test.ts
npx jest src/application/__tests__/name-copy-translates.test.ts src/application/__tests__/training-copy-translates.test.ts
npx jest src/audit/__tests__/training-leverage-rails.test.ts
npx tsc --noEmit
npm run format:check
```

Do not run the large soak suites unless a focused balance rail fails or the
implementation changes more progression behavior than this spec permits.

Runtime review needs only the affected management surfaces:

- Training card at displayed 998 and 999.
- Gift result with withdrawn and active transfer requests.
- Match-day lineup with a promised number 10 outside slot 10.
- Exact Scout Report, linked Deals card, and owned Squad file for one player.

Use the background browser pane, mute immediately after load, and clean up only
the server or page started for this review. No audio check is required.

## 16. Final acceptance checklist

- [ ] No paid drill can display `+0`.
- [ ] Near-cap drills state the exact visible gain before payment.
- [ ] D1/D2 users face D1-D3 opponents in R32 and R16 when one survives.
- [ ] Gift feedback says whether a transfer request ended.
- [ ] Hero License repair tests from `origin/main` remain green.
- [ ] Active-squad shirt numbers are unique and number 10 promises win.
- [ ] The repeatable story has one full intervening season.
- [ ] Unseen random-deck stories receive double weight.
- [ ] Exact Scout, Deals, and Squad grades agree for the same state.
- [ ] Illegal Starter promises are disabled with the exact reason.
- [ ] No save migration or `ENGINE_VERSION` bump exists.
- [ ] All seven locales and accessibility output are complete.
- [ ] Focused tests, training balance rail, TypeScript, and format checks pass.

## 17. Audit focus

The later audit should challenge these decisions, not reopen unrelated systems:

- Does the training test set explicitly replace the old hidden post-999 keeper
  contract and keep the always-on drift rail meaningful?
- Can the Round-of-16 swap ever duplicate or omit a surviving club?
- Does gift feedback expose the correct personality threshold in every path?
- Does the shirt-number map preserve promised 10 across loadable saves and lineup edits?
- Does the event cooldown use the latest history row without extra RNG?
- Can an exact Scout Report or linked BUY listing still reach the raw-grade
  fallback for a known player?
