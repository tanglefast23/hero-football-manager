---
title: 'feat: Teach low-morale gifts'
type: feat
date: 2026-08-23
status: grok-reviewed
spec: ../specs/2026-08-23-low-morale-gift-tutorial.md
---

# Low-Morale Gift Tutorial Implementation Plan

## Outcome

The first eligible player below 30 morale creates one persistent urgent inbox
warning. Opening it selects that player on Squad → Drills and shows one blocking
`BUY A GIFT` spotlight. The guided Gift tap ends the tutorial whether the
transaction succeeds or fails.

All gifts change to four weekly wages and up to +20 morale. Existing weekly
limits remain.

## Existing Code to Reuse

- `playerGiftQuote()` and `givePlayerGift()` remain the only gift validation and
  transaction path.
- `reconcileHomeAssistantInbox()` remains the persistence seam for inbox state.
- `scheduleAssistantInboxWeek()` remains unchanged.
- `ClubAlertViewModel.playerId`, `store.selectPlayer()`, and `openHomeAlert()`
  provide the player deep link.
- `scrollGuideTargetIntoView()`, `useGuideAnchor()`, `TutorialSpotlight`, and
  `TutorialTapCue` provide scrolling, measurement, dimming, and the arrow.
- The app-level blocking-overlay pattern makes the full Management shell inert
  while one transparent press target sits over the visible Gift button.

No dependency, Bert sequence, save field, schema version, art, audio, or match
engine change is needed.

## Step 1: Change Gift Math and Preserve Free-Gift History

Update:

- `src/game/player-gifts.ts`
- `src/game/cash-transactions.ts`
- `src/persistence/game-state-codec.ts`
- `src/game/__tests__/player-gifts.test.ts`
- focused cash-transaction codec tests
- `src/application/__tests__/club-finances-transactions.test.ts`

Make these exact changes:

1. Set `PLAYER_GIFT_MORALE_GAIN` to `20`.
2. Make `playerGiftCost()` return `weeklyWage * 4` with safe-integer checks.
3. Remove the $50 minimum and division multiplier from Gift pricing only.
4. Keep actual gain capped at 100.
5. Allow an amount of zero only when the transaction kind is `player-gift`.
6. Keep every other cash-transaction kind non-zero in both the game validator
   and save codec.
7. Record a `$0` Gift transaction normally, so player and club weekly limits
   still count it.

Update existing cost, gain, cap, insufficient-cash, withdrawal, and deterministic
tests. Add tests that a free gift records once, counts toward both limits, and
round-trips while a zero facility or transfer transaction still fails. Confirm
the saved `$0` Gift row appears in `recentTransactions`; the current finance
view does not filter zero values, and this test keeps it that way.

## Step 2: Add the Replaceable Tutorial Target

Update:

- `src/game/pyramid.ts`
- `src/game/player-gifts.ts`
- focused player-gift tests

Export the existing `LOW_MORALE_THRESHOLD` instead of copying `30`.

Add one completion milestone and one target-flag prefix. Add pure helpers to:

- read the saved target player ID;
- complete the tutorial and remove every target flag;
- reconcile the target before inbox scheduling.

Target eligibility is:

- player belongs to the user club;
- morale is below `LOW_MORALE_THRESHOLD`;
- `transferRequested !== true`.

Keep a valid saved target. Otherwise choose the eligible player with the lowest
morale. Preserve `state.players` order as the tie-break. Remove every prior
target flag before adding the replacement. If no player is eligible, leave the
tutorial incomplete with no target.

Do not add a separate trigger flag. “Incomplete with no target” covers both the
initial and waiting states.

## Step 3: Add the Mode-Neutral Inbox Alert

Update:

- `src/application/view-models.ts`
- `src/application/__tests__/assistant-guide.test.ts` or one focused sibling
  test
- all seven `content/i18n/*.json` files

At the start of `homeAssistantInboxPlan()`, call the new target reconcile
helper. Pass that returned state to `homeProductAlerts()` and
`scheduleAssistantInboxWeek()`. The existing
`reconcileHomeAssistantInbox()` → `store.reconcileAssistantInbox()` path then
queues the returned flag changes through the normal save queue. This is the
write path that makes the target stable across reload.

When a target exists and completion is absent, create one urgent product alert
with:

- fixed ID `low-morale-gift-tutorial`;
- localized title and detail;
- `playerId` from the saved target.

Do not mark it as scheduler `oneShot`. Scheduler one-shots are acknowledged on
delivery. This tutorial completes only on the guided Gift tap. A live urgent
product alert stays eligible across deferral and disappears when target
reconciliation clears it or completion hides it.

Rebuild this product alert on every inbox reconcile while target exists and
completion is absent. `openHomeAlert()` must not call either inbox-product
dismiss function for this ID. Back, Escape, and reload therefore return to the
same urgent row.

Because this is a product alert, it appears in both Teacher and Advisor mode.

Add localized keys for the inbox title, inbox detail with `{player}`, and
`BUY A GIFT`. Keep all current blocker copy.

Put boundary, eligibility, deterministic tie, recovery, departure, retarget,
and waiting tests on the pure reconcile helper. Add store/inbox-reconcile tests
that prove target flags save/load, urgent delivery survives deferral, the row
appears in Teacher and Advisor mode, Back does not dismiss it, and a guided Gift
save is the only completion path.

## Step 4: Route to the Selected Player and Measure Gift

Update:

- `App.tsx`
- `src/ui/screens/SquadTrainingScreen.tsx`
- focused navigation and Squad UI tests

Add transient app state with two phases: `routing` for the selected player while
the screen scrolls and measures, then `blocking` once the matching Gift anchor
exists.

For `low-morale-gift-tutorial`, `openHomeAlert()` must:

1. re-read the alert's current `playerId`;
2. select that player;
3. open Squad;
4. request the Drills sub-page;
5. start transient tutorial mode.

In `SquadTrainingScreen`, explicitly switch to Drills for this deep link. Add a
wrapper ref around the selected player's Gift button. Reuse
`scrollGuideTargetIntoView()` and `useGuideAnchor()` to scroll, then report the
settled window anchor to App.

Revalidate that the selected player still matches the saved target before
routing and again before accepting an anchor. If the player is missing, the
Gift control does not appear, or measurement does not settle after the bounded
existing two-frame attempts, cancel transient routing, return Home, and let the
next inbox reconciliation retarget or clear the alert.

Do not change normal Squad opening. Forced selection and scrolling apply only
to this explicit inbox route.

## Step 5: Show One Blocking Gift Target

Render the tutorial overlay at App level, above the full Management shell.
Enter the blocking phase only after the Gift anchor exists for the current
guided player. Android Back, web Escape, and accessibility escape are active in
both routing and blocking phases, so the manager is never trapped on an
unmeasured Squad route.

While it is visible:

- make the routed background inert for pointer, keyboard, and accessibility
  traversal;
- render `TutorialSpotlight` around the Gift anchor;
- render a transparent accessible press target exactly over the visible Gift
  button;
- render `TutorialTapCue` with localized `BUY A GIFT` and no pointer handling;
- expose the target as enabled even when the quote has a blocker;
- include player, exact cost, exact gain, and blocker in its accessibility
  label;
- move accessibility focus to the target.

The transparent target calls the same guided Gift handler as the visible
button. It exists because hiding the full background from screen readers would
also hide the underlying button. It adds no second game action.

Intercept Android Back, web Escape, and accessibility escape. Each exit clears
only transient tutorial state, returns Home, and keeps the saved target pending.
Reload also returns Home because overlay state is not persisted.

## Step 6: Save Completion on Success and Failure

Update `src/application/store.ts` and
`src/application/__tests__/player-gift-store.test.ts`.

Extend `giftPlayer()` with a guided input. The guided path must:

1. build a career with tutorial completion first;
2. run the unchanged `givePlayerGift()` against that career;
3. on success, save one final state with completion plus the Gift;
4. on failure, save the completion-only state and show existing blocker copy;
5. publish the existing celebration only after a successful saved Gift.

Queue a career save in both outcomes. A blocked tap changes no cash, morale,
transfer request, cash transaction, or weekly Gift count.

Keep `playerGiftQuote()` revalidation. Do not turn a visual blocker into a rule
bypass. Clear transient tutorial UI on the first press. The current tap guard,
synchronous career update, and per-player weekly limit must make double taps
produce at most one Gift transaction and one completion flag.

Test success, insufficient cash, already gifted, club limit, full morale,
departed player, double tap, save ordering, post-failure reload, and no
celebration on failure.

## Step 7: Verify the Player-Visible Flow

Run focused checks:

1. Gift game and cash-transaction tests.
2. Assistant-guide and home-view-model tests.
3. Gift store tests.
4. Navigation, spotlight, accessibility, and Squad screen tests.
5. i18n gates and copy budgets.
6. `npx tsc --noEmit`.

The Gift price and reward are an economy change. Run the repository's relevant
balance contract tests required by CI, but do not run unrelated match soaks or
replay rails.

For the visual claim, use the muted background browser pane. Verify phone width
and largest text scale, including German and Vietnamese. Check:

- alert copy and target name;
- Drills route and selected player;
- automatic scroll;
- full-shell dim and blocked controls;
- visible Gift cutout and cue;
- success celebration;
- unaffordable tap completion and error;
- Back/Escape resume behavior.

Destroy the page, close the tab, stop only the server started for this check,
and audit listeners before finishing.

## Review Resolutions

The Grok spec audit found four valid flow gaps. The spec now has replaceable
target rules, live inbox copy, completion saves on failed Gifts, and explicit
Back/blocker behavior. Its proposed new save field was rejected because saved
event flags already support the state safely.

The Grok plan audit clarified the exact target-flag write seam, persistent
re-emission after Back, and routing-to-blocking fallback. Its claims that the
current alert route auto-dismisses products and that finance history filters
zero amounts were rejected after local source checks; focused tests still lock
both behaviors down.

Local and SpecFlow review added the free-gift transaction rule, active
transfer-request exclusion, app-level focus isolation, double-tap coverage, and
phone-width locale verification.

## Completion Criteria

- Every acceptance criterion in the reviewed spec passes.
- The tutorial appears once per career in both assistant modes.
- Success and every blocker save tutorial completion exactly once.
- Gift math is exactly four wages and up to +20 morale.
- `$0` Gifts remain visible in transaction history and weekly limits.
- Focused tests, required balance contracts, i18n checks, and TypeScript pass.
- Muted background-browser evidence confirms the complete player flow.
