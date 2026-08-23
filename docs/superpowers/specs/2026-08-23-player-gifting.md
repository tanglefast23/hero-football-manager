---
date: 2026-08-23
topic: player-gifting
status: council-reviewed
---

# Player Gifting

## Goal

Give the manager one direct, paid way to improve a player's morale from the
Player File. The action must feel warm, quick, clear, and useful without making
morale problems disappear through unlimited spending.

## Player Contract

The Player File shows a **Gift** action for the selected first-team player.
Before the manager taps it, the action shows all three facts:

- the gift cost;
- the morale gain;
- whether this player has already received a gift this week;
- how many of the club's three gifts remain this week.

The proposed starting rule is:

- **Cost:** 100% of the player's current weekly wage, rounded up to a whole
  dollar, with a $50 minimum. Divisions 2 and 1 multiply that result by 3, the
  same late-game money rule used by player requests.
- **Reward:** +5 morale, capped at 100.
- **Limit:** one gift per player per management week and three gifts total for
  the club per management week.

The action is available in every division. Zero-wage legacy and emergency
players remain eligible at the minimum. That minimum becomes $150 in Divisions
2 and 1 after the multiplier. The late-game multiplier is based on the club's
current division, not the player's origin or contract division.

The 100% starting price is deliberate. A money-themed player request costs more
because granting it also buys loyalty and may buy another themed benefit. A
gift buys morale only, consumes one of three weekly club gifts, and cannot
restore loyalty lost by refusing a request. Start at 100% and measure it in a
full career before raising it.

The button is disabled when:

- the club cannot afford the shown cost;
- the player already received a gift this week;
- the club already gave three gifts this week;
- the player's morale is already 100;
- the player is no longer at the club.

At morale 96-99, the preview and result show the actual capped gain. For
example, a player at 98 morale shows `+2 morale`, not `+5 morale`.

## Complete Interaction

1. The manager opens a player in **Squad → Player File**.
2. A compact gift row shows `Gift`, the exact red cash cost, and the exact
   morale gain.
3. The manager taps Gift.
4. The game validates the player, weekly limit, cash, and morale again.
5. The game applies the result once: cash decreases, morale increases, and the
   immediate cash transaction is saved.
6. A short full-screen celebration opens above the Player File.
7. The player's live-match sprite appears. It uses the player's saved look and
   the club's current home kit, not the profile portrait.
8. A cute pixel gift box pops in above or just in front of the player.
9. The exact cost appears below the gift in red, for example `-$325`.
10. A large `+5 MORALE` result appears prominently beside the player. A capped
    result uses the actual amount, such as `+2 MORALE`.
11. The existing positive management sound plays once after the transaction
    succeeds.
12. The gift, result, and player leave quickly. The Player File returns with
    the new cash and morale already visible.

The default sequence should take about 1.6-2.0 seconds. It has four beats:

1. player enters;
2. gift pops and cost lands;
3. morale result lands;
4. scene exits.

The whole screen is a skip target. Each tap advances immediately to the next
beat. Repeated taps can finish the sequence quickly. A tap never repeats the
transaction, sound, or morale gain.

## Visual Direction

The scene is playful toy-like pixel art, consistent with the game's Player File
and match sprites.

- Use the existing `PlayerRunSprite` for the player.
- Draw one small pixel gift box from square UI shapes. Use red wrapping, a gold
  ribbon, a dark ink outline, and a short squash-and-pop motion.
- Keep the money loss red and the morale gain in the existing positive green.
- Use a tiny upward hop, two or three small sparkle squares, and a slight gift
  wobble. Do not add particle systems or a new animation library.
- Keep all text inside the safe area and readable on a phone at large text.

No information exists only in color or movement. The cost and gain are text.

## Motion, Sound, and Input

- Use the existing positive management sound. Do not add a new audio asset or
  change the indexed management sound catalog.
- Respect master audio and the existing fail-soft audio path.
- With Reduce Motion, show the player, gift, cost, and morale result together as
  one static result. A tap dismisses it.
- A screen reader gets one result announcement naming the player, cost, and
  morale gained.
- Treat the celebration as an accessibility modal. Move focus into it and keep
  the underlying Player File out of screen-reader traversal until it closes.
- Expose one labeled Continue action. Activating it advances the current beat,
  or dismisses the final beat. Tap-anywhere remains the fast pointer path.
- When a screen reader is active, do not auto-advance or auto-dismiss. Show the
  complete final beat and hold it until Continue is activated, matching the
  Reduce Motion path.
- While the result is open, the underlying Player File cannot receive taps.
- Back or Escape dismisses the presentation only. It cannot undo a completed
  gift.

## State and Economy Rules

The gift is a deterministic game transaction.

- Calculate cost with integer arithmetic from the current weekly wage.
- Reject stale taps if the player, cash, morale, or weekly limit changed.
- Charge before recording the immediate cash transaction, so `balanceAfter` is
  correct.
- Add `player-gift` to the cash-transaction kind union and persistence codec.
- Record the transaction with `referenceId` set to the player ID, plus the
  season, week, localized label key, negative amount, and resulting balance.
- Enforce both weekly limits from `player-gift` transactions for the current
  season and week. Do not add a second gift-history field to the player. Any
  future transaction pruning must keep current-week gift rows.
- Save the finished state before the celebration starts. Reloading during the
  animation keeps the money and morale result and never replays the charge.
- The Player File button reads from saved career state, so it updates after the
  gift without a separate UI counter.

A gift can help a player reach the existing transfer-request withdrawal line.
Clear the request only when `shouldWithdrawTransferRequest` returns true for
the post-gift morale. Do not change `consecutiveLowMoraleWeeks` mid-week. If the
canonical withdrawal rule passes, clear the request in the same transaction so
the Player File and desk do not show a stale request.

## Copy and Localization

Add every new string to all supported languages:

- Gift
- Give gift
- Gift cost
- Morale gain
- Already gifted this week
- Club gift limit reached this week
- Not enough money
- Morale is already full
- transaction label
- result announcement

The visible button must fit German and Vietnamese at the existing Player File
width and allowed text scale. Accessibility labels must use the live player,
cost, gain, and availability values.

## Council Balance Resolution

The two completed review lanes agreed that 25% was too cheap, +5 was the right
gain, and the action needed weekly limits and the existing late-game 3x money
rule. One recommended a 100% wage cost. One recommended 300%. The final product
choice is 100% because requests also buy loyalty and themed benefits, while a
gift buys morale only and consumes a scarce weekly club action.

The final answers are:

1. **100% wage, $50 minimum, 3x in Divisions 2 and 1.** Measure full-career use
   before changing it.
2. **One per player and three per club each week.**
3. **Flat +5 morale.** No personality multiplier.
4. **Clear a transfer request immediately only through the canonical withdrawal
   rule.**
5. **Keep zero-wage players eligible at the minimum.**

## Acceptance Criteria

- [ ] The Player File shows exact gift cost and exact morale gain before a tap.
- [ ] A successful tap subtracts the shown amount exactly once.
- [ ] A successful tap raises morale by the shown amount exactly once.
- [ ] The immediate transaction history records the spend and resulting balance.
- [ ] A player cannot receive two gifts in the same season and week.
- [ ] Three different players can each receive one gift in the same week.
- [ ] A fourth club gift in the same season and week is disabled and safely
      rejected without changing state.
- [ ] Insufficient cash, 100 morale, and a stale player disable or safely reject
      the action without changing state.
- [ ] The result uses the live-match player sprite and current home kit.
- [ ] The gift icon, red cost, and prominent morale gain all appear.
- [ ] The existing positive sound plays once only after success.
- [ ] Each screen tap advances one beat; repeated taps finish quickly.
- [ ] Reduced Motion shows one static, complete result.
- [ ] Screen-reader focus stays inside the result and a labeled action can
      advance or dismiss it.
- [ ] With a screen reader active, the complete result waits for Continue and
      never dismisses on a timer.
- [ ] Reloading after the tap preserves one charge and one morale gain.
- [ ] Crossing the canonical personality withdrawal line clears an active
      transfer request; staying below it leaves the request active.
- [ ] Gifting does not change `consecutiveLowMoraleWeeks`.
- [ ] New copy is present in all supported languages and passes copy budgets.
- [ ] The same state and action produce the same game result.

## Non-goals

- No gift inventory, gift types, rarity, shop, or random gift quality.
- No loyalty gain, condition gain, fame gain, or attribute gain.
- No bulk “gift whole squad” action.
- No new audio asset or third-party animation library.
- No change to weekly morale decay, match morale effects, or player-request
  balance.
