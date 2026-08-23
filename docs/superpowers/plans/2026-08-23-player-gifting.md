---
title: "feat: Add player gifts"
type: feat
date: 2026-08-23
status: council-reviewed
spec: ../specs/2026-08-23-player-gifting.md
---

# Player Gifting Implementation Plan

## Outcome

Add one paid morale action to the Player File. It charges a wage-scaled amount,
adds +5 morale, enforces player and club weekly limits, saves one immediate cash
transaction, and plays a short skippable sprite celebration.

## Existing Patterns to Reuse

- `recordCashTransaction` owns immediate cash history and `balanceAfter`.
- `requestMoneyCost` owns the existing Division 2/1 3x money rule.
- `shouldWithdrawTransferRequest` owns the transfer-request withdrawal line.
- `SquadTrainingViewModel` owns Player File data.
- `lastDrillResult` shows how a saved store action can publish one transient UI
  result without putting animation state in the career save.
- `CrossPlatformModal`, `PlayerRunSprite`, `useScreenReaderEnabled`,
  `useReducedMotion`, and `playPositiveSfx` cover the presentation contract.

No external research or dependency is needed. The repository already contains
every required state, sound, sprite, modal, and animation primitive.

## Step 1: Add the pure gift transaction

Create `src/game/player-gifts.ts` and
`src/game/__tests__/player-gifts.test.ts`.

Export:

- `PLAYER_GIFT_MORALE_GAIN = 5`;
- `PLAYER_GIFT_WEEKLY_CLUB_LIMIT = 3`;
- `playerGiftQuote(state, playerId)`;
- `givePlayerGift(state, playerId)`.

`playerGiftQuote` must:

1. require a current user-club player;
2. calculate `max(50, weeklyWage)`, then apply the existing 3x Division 2/1
   multiplier;
3. calculate the actual capped morale gain;
4. count current season/week `player-gift` transactions;
5. return cost, gain, club gifts remaining, and one stable blocked-reason enum.

Extract the one-line division multiplier from `requestMoneyCost` as a small
exported helper in `src/game/player-requests.ts`. Use it in both request and
gift pricing so the two rules cannot drift.

`givePlayerGift` must re-read the quote, reject every blocked state, then:

1. subtract the quoted cost from user-club cash;
2. add the quoted morale gain, capped at 100;
3. normalize the post-gift player exactly like weekly wellbeing does —
   `personality ?? 'Professional'`, `condition ?? 100`, and
   `consecutiveLowMoraleWeeks ?? 0` — then clear `transferRequested` only when
   `shouldWithdrawTransferRequest` passes;
4. preserve `consecutiveLowMoraleWeeks`;
5. record one `player-gift` cash transaction with `referenceId = playerId`, the
   English fallback label, localized `labelKey`, and raw label parameters for
   player name and amount;
6. return the finished state and exact presentation result.

Tests cover normal cost, D2/D1 3x cost, $50 floor, capped gain, insufficient
cash, morale already at 100, a player outside the user club, one-player limit,
three-club limit, different-player gifts, complete transaction label fields,
transfer-request threshold, missing-personality normalization, streak
preservation, and deterministic repeat inputs. Every rejected transaction must
leave the input state unchanged.

## Step 2: Extend saved transaction validation

Update:

- `src/game/types.ts`;
- `src/persistence/game-state-codec.ts`;
- focused cash-transaction codec tests.

Add `player-gift` to `CashTransactionKind` and the codec enum. Do not add a
schema version or migration. Old saves do not contain the new value and remain
valid; new saves need only teach the existing enum the new member.

Round-trip a `player-gift` row with player `referenceId`, English label,
`labelKey`, raw `labelParams`, negative amount, and post-charge balance.

No match-engine version bump is needed. The feature changes management state,
not match simulation, input logs, or replay RNG.

## Step 3: Add Player File view data and store action

Update:

- `src/ui/models.ts`;
- `src/application/view-models.ts` and its focused tests;
- `src/application/store.ts` and `src/application/__tests__/store.test.ts`.

Add `selectedPlayerGift` to `SquadTrainingViewModel` with:

- exact cost;
- exact morale gain;
- club gifts remaining;
- localized blocked reason when unavailable.

Add transient store state `lastPlayerGiftResult`, plus `giftPlayer(playerId)`
and `clearPlayerGiftResult()`.

On success, `giftPlayer` saves the returned career and publishes a sequenced
result containing player ID, name, role, look ID, cost, and actual morale gain.
The result is not persisted. A reload keeps the saved transaction but does not
replay the celebration.

Use the store's existing guarded action pattern. Map stale gift refusals to the
same localized blocked reasons shown on the Player File.

## Step 4: Add complete localized Player File controls

Update all seven `content/i18n/*.json` catalogs and the affected i18n tests.

Add keys for:

- Gift / Give gift;
- exact cost and gain preview;
- gifts remaining;
- already gifted this player;
- club weekly gift limit reached;
- insufficient cash;
- morale already full;
- immediate transaction label;
- `playerGift.a11y.result` for the result announcement;
- `playerGift.a11y.giftAction` with player, cost, gain, club gifts remaining,
  and blocked reason;
- Continue.

Update `src/ui/screens/SquadTrainingScreen.tsx`:

1. pass `selectedPlayerGift` into `PlayerFileSection`;
2. add one compact gift row beside the existing Player File actions;
3. show cost in red, gain in green, and remaining club gifts in text;
4. disable the action with its visible reason;
5. pass a successful result to the celebration overlay.

Keep the existing Lay-off action separate. Do not reorder or redesign the rest
of the Player File.

## Step 5: Build the short gift celebration

Create `src/ui/PlayerGiftCelebration.tsx` and focused UI tests.

Use only existing primitives:

- `CrossPlatformModal` for interaction and accessibility isolation;
- `PlayerRunSprite` with the player's look and current home kit;
- nested square `View` shapes for a red pixel gift with a gold ribbon;
- React Native `Animated` for entrance, hop, wobble, result pop, and exit;
- `playPositiveSfx` once on successful mount;
- `useReducedMotion` and `useScreenReaderEnabled` for timing.

The normal phase machine is:

1. player enters;
2. gift and red cost pop in;
3. green `+N MORALE` lands beside the player;
4. scene exits.

Each full-screen press advances one phase. Timers advance phases only when
Reduce Motion is off and screen-reader state is known to be off. Reduce Motion,
screen-reader on, and unknown screen-reader state show the complete static
result and wait for Continue.

Keep the current phase in a ref beside React state, following
`CharacterSpeechOverlay`. Every press reads and writes the ref before setting
state, so two synchronous taps advance two separate beats instead of collapsing
inside one React batch. Test two synchronous presses explicitly.

The modal's full-screen Pressable is the one labeled Continue action. It is an
accessibility modal, blocks the Player File, handles Back/Escape by dismissing
the presentation, and never calls the transaction again.

On mount, the modal uses the localized result announcement with the live player
name, cost, and actual morale gain. Bind the same complete result to its modal
accessibility label or a polite live-region announcement, and cover that
consumer in the focused celebration test.

Keep the automatic path between 1.6 and 2.0 seconds. Do not add an image asset,
audio asset, particle engine, or animation dependency.

## Step 6: Wire the app shell

Update `App.tsx` to pass:

- `store.giftPlayer`;
- `store.lastPlayerGiftResult`;
- `store.clearPlayerGiftResult`.

Make `giftPlayer` asynchronous. It applies the state, queues the normal career
save, then awaits the existing `flushPendingCareerSave`. Publish
`lastPlayerGiftResult` only when `lastPersistedCareer` is the gift state. If no
repository exists, as in the dev harness, publish immediately because there is
no persistence surface. A failed save keeps the existing warning and does not
start the celebration.

The UI owns sound and animation only. App shutdown and screen recovery need no
new career cleanup because the result is transient and fail-soft.

## Step 7: Verify

Run focused checks only:

1. player gift game tests;
2. cash-transaction codec tests;
3. Squad view-model tests;
4. store tests for one charge and a persisted gift state before the result;
5. gift celebration source/component tests;
6. localization gates and copy budgets;
7. `npx tsc --noEmit`.

Use the background browser pane only for the final player-visible claim. Load
muted, open a Player File, verify the exact cost/gain preview, tap Gift, confirm
the live-match sprite, gift, red cost, morale result, tap skipping, and updated
cash/morale. Repeat with Reduce Motion. Then check the compact Player File row
in German and Vietnamese at the largest supported text scale. Clean up only the
page and server started for this verification.

Do not run soak, balance, or replay rails. The feature does not change the match
engine or RNG. Record the price as a full-career balance hypothesis for the next
career playtest instead.

## Risks and Guards

- **Double charge:** transaction lives only in `givePlayerGift`; the overlay has
  no game action callback.
- **Weekly-limit drift:** both limits query current-week `player-gift` rows by
  kind and player `referenceId`.
- **Stale UI:** the game transaction recalculates the quote before changing
  cash or morale.
- **Save failure:** existing non-dismissible save warning applies; the result
  describes the in-memory state truthfully.
- **Accessibility timeout:** unknown or enabled screen-reader state disables all
  auto timers.
- **Economy uncertainty:** start at the reviewed 100% price and measure usage in
  the next full-career playtest before changing it.

## Completion Criteria

- Every acceptance criterion in the reviewed spec passes.
- New transaction rows round-trip through persistence.
- The exact successful action changes cash and morale once.
- All seven locales pass their gates and copy budgets.
- Focused tests and TypeScript pass.
- Background browser verification confirms the visible flow without audio.
