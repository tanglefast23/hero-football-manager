---
date: 2026-08-23
topic: low-morale-gift-tutorial
status: grok-reviewed
supersedes: 2026-08-23-player-gifting.md
---

# Low-Morale Gift Tutorial

## Goal

Warn the manager before low morale becomes a transfer request. Teach the
existing Gift action on the exact player who caused the warning.

The lesson appears once per career. It ends when the manager taps the guided
Gift button, even if the club cannot afford the gift.

## Gift Rule Change

All player gifts use these new rules:

- **Cost:** exactly four times the player's current weekly wage.
- **Morale:** +20, capped at 100.
- **Limits:** keep the existing limit of one gift per player each week and
  three gifts per club each week.

There is no $50 minimum and no division multiplier. A player with a $0 weekly
wage has a $0 gift. A successful free gift still records one `$0`
`player-gift`transaction, so the existing weekly limits continue to count it.
Other cash-transaction kinds remain non-zero. The preview and result show the
actual capped morale gain. For example, a player at 92 morale shows`+8 MORALE`.

## Trigger and Target

The canonical low-morale threshold is below 30. The lesson becomes due the
first time the career observes a user-club player with `morale < 30` who has
not already asked for a transfer. A transfer request uses the existing lesson;
this warning is the preventive step before it.

The game banks one player ID when the warning first becomes due. The current
banked ID supplies both the inbox name and the route target, so those two facts
cannot drift.

If several players cross the line before the warning is banked, choose the
lowest morale. Use roster order as the tie-break. This keeps the result
deterministic.

Before each inbox build, keep the target only if they are still at the user
club, still below 30 morale, and have no transfer request. Otherwise, replace
the saved ID with the lowest current eligible player and rebuild the inbox copy
from that replacement. If no such player exists, clear the saved ID and hide
the item without completing the lesson. Bank a new ID and show the item again
when a user-club player is next eligible.

The warning is a product tutorial, not a Bert briefing. It applies in both
Teacher and Advisor careers.

## Inbox Item

The once-per-career inbox item is urgent and uses the existing inbox scheduler.
It remains eligible while a target exists and the tutorial is incomplete.

English copy:

- **Title:** `A PLAYER IS UNHAPPY`
- **Detail:** `{player}'s morale is below 30. Raise it soon or they may ask for
a transfer.`

The item names the banked player. It is not a generic guide row.

Tapping the item does all of this in one route:

1. Open **Squad**.
2. Open the **Drills** sub-page.
3. Select the banked player.
4. Scroll the selected Player File until the Gift button is visible.
5. Start the blocking Gift tutorial.

No Bert walk-on appears between the inbox and the Gift button.

## Guided Gift Screen

The tutorial dims the complete screen except the real Gift button. The dimmed
area blocks pointer and touch input.

An arrow points at the Gift button with this label:

`BUY A GIFT`

The real button stays the only active control. The arrow does not take the tap.
Screen-reader focus moves to the Gift button. The button's accessibility label
includes the player, exact cost, exact gain, and current blocked reason.

Hardware Back or keyboard Escape is intercepted by the overlay and returns to
the inbox without completing the tutorial. No underlying on-screen control is
exempt from the dimmer. Opening the item again resumes the route with the
current banked target.

## Completion and Low Cash

The first tap on the guided Gift button completes the tutorial permanently.
Completion depends on the tap, not transaction success.

The tap still runs the normal gift transaction:

- If the gift succeeds, charge the exact cost, add the exact morale, save, and
  show the existing gift celebration.
- If cash is too low, do not change cash, morale, or gift counts. End the
  tutorial and show `The club cannot afford this gift.`
- If the player already received a gift this week, show `This player already
received a gift this week.`
- If the club used all three weekly gifts, show `The club has used all three
gifts this week.`
- If morale is now full, show `Morale is already full.`
- If the player left the club after the screen opened, show `This player is no
longer at the club.`

Every blocked tap changes only tutorial completion. It does not change cash,
morale, transfer-request state, transactions, or weekly gift limits. The pure
gift transaction revalidates every blocker on the tap; the enabled tutorial
button never bypasses game rules.

During this tutorial only, a blocked Gift button remains tappable. Outside the
tutorial, keep the current disabled-button behavior.

The inbox warning and spotlight never return after the guided tap. A failed
purchase does not grant a free gift and does not change weekly gift limits.

## Persistence

Persist the current banked player ID and tutorial completion in existing career
event flags. Do not add a new save field or schema version.

The target flag is added, replaced, or cleared as the target rules above
require. An incomplete tutorial with no target is the waiting state. It behaves
the same before the first trigger and after a departed target, so no separate
trigger flag is needed.

The guided tap creates one final career state before it saves:

- On success, that state contains tutorial completion plus the finished gift.
- On failure, that state contains tutorial completion only.

The store queues a career save in both cases. A failed gift does not use a
success-only save path and cannot roll back tutorial completion.

Reload behavior:

- Before the inbox item opens: keep the current valid target and pending item.
  Re-resolve it under the departed-target rules when needed.
- While the spotlight is open: return to the inbox after reload; the item can
  open the route again.
- After the guided tap: never show the inbox item or spotlight again, whether
  the gift succeeded or failed.

## Copy and Localization

Add the inbox title, inbox detail, and `BUY A GIFT` cue to all supported locale
files. Keep the player name as a replacement value.

The German and Vietnamese cue must fit the existing tutorial label at the
largest supported text scale. Accessibility copy must not rely on color,
movement, or the arrow alone.

## Acceptance Criteria

- [ ] A user-club player below 30 morale without a transfer request banks one
      tutorial target.
- [ ] A player at exactly 30 morale does not trigger the tutorial.
- [ ] Multiple low-morale players choose the lowest morale, then roster order.
- [ ] The warning survives inbox deferral and save/load with the same valid
      target.
- [ ] A stale departed target retargets another current low-morale player.
- [ ] A recovered target or one who already requested a transfer is retargeted
      or cleared before the inbox renders.
- [ ] With no valid replacement, the warning waits without completing.
- [ ] The inbox item names the target and warns about a transfer request.
- [ ] Tapping the item opens Squad, Drills, the selected player, and the Gift
      button in view.
- [ ] The complete screen is dimmed and blocked except the real Gift button.
- [ ] An arrow labeled `BUY A GIFT` points at the Gift button.
- [ ] Hardware Back or keyboard Escape returns to the inbox and keeps the
      tutorial pending.
- [ ] Tapping the guided Gift button completes the tutorial exactly once.
- [ ] A successful guided tap performs the existing gift transaction once.
- [ ] An unaffordable guided tap changes no money or morale, shows the normal
      error, and still completes the tutorial.
- [ ] Any other stale blocker changes only tutorial completion, shows its exact
      error, and leaves gift economy state unchanged.
- [ ] Outside the tutorial, blocked gift buttons remain disabled.
- [ ] Every gift costs exactly four current weekly wages.
- [ ] A $0 weekly wage produces a $0 gift cost.
- [ ] A successful $0 gift records one `$0` player-gift transaction and counts
      toward both weekly limits; other transaction kinds still reject zero.
- [ ] Every gift restores up to 20 morale, capped at 100.
- [ ] Existing weekly player and club gift limits remain unchanged.
- [ ] Teacher and Advisor careers both receive the one-shot warning.
- [ ] New copy exists in every supported locale and passes copy checks.
- [ ] Focused tests and `npx tsc --noEmit` pass.

## Non-goals

- No new gift types, inventory, shop, or random reward.
- No change to the low-morale threshold or transfer-request rules.
- No change to match simulation, RNG, replay data, or `ENGINE_VERSION`.
- No new Bert character sequence.
- No new audio, art asset, animation library, or save migration.
