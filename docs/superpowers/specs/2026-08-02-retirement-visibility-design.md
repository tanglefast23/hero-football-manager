# Retirement Visibility — design

**Date:** 2026-08-02
**Status:** approved design, ready for planning
**Scope:** one cycle, self-contained

Retirement already works, but it is invisible until it is irreversible. The
player card never mentions it, the only inbox alert arrives at the start of the
final season, and a contract can outlive the man who signed it. This cycle makes
the end of a career legible one season earlier, and stops the club paying for
seasons that will never be played.

---

## 1. What exists today

`resolveSeasonEndLifecycle` in `src/game/pyramid.ts` retires on age alone:

- Each player has a stable retirement age of 33–38, from a personality-weighted
  pool in `retirementAnnouncementAge`, hashed from `(careerSeed, playerId)`.
- At each season transition every player ages by one. The first transition where
  the new age reaches the retirement age stamps `retirementAnnouncementSeason`.
- They then play exactly one more season and leave at the following transition.

Three gaps follow from that:

1. **The player card says nothing.** It shows `age` and `contractLabel` and
   stops there. `CareerPlayer.retirementAge` exists but never reaches the view
   model.
2. **The only warning arrives too late.** `retirement-announcement-*` fires at
   the start of the final season — a done deal, not a heads-up.
3. **Contracts outlive players.** Nothing anywhere reads
   `contractSeasonsRemaining` when retiring someone. A 35-year-old signed to a
   three-season deal who retires at 36 takes an unplayed season of wages with
   him.

The two systems meet in exactly one place, and it runs the other way:
`startNextSeason` in `src/game/career.ts` exempts a retiring player from the
"expired contracts must be resolved" gate, so the manager is never made to renew
someone who is already leaving.

---

## 2. The rule: cap the contract, never move the retirement

Retirement ages, announcement timing, and the 30+ decline curve are **untouched**.
Instead, an offer may not run past the player's last playable season.

The alternative — letting retirement wait for the contract to expire — was
rejected. It stretches careers by up to two seasons, lets a legend be farmed by
re-signing, and makes the personality-weighted pool stop being the real ceiling.

**The cap can never touch a player under 31.** Terms max out at three seasons and
retirement ages start at 33, so `seasonsLeft < 3` requires `age >= R - 2 >= 31`.
The rule self-limits to veterans without an age check anywhere.

### 2.1 Two formulas, because the decrement lands at different times

Contracts decrement at week 30 (`src/game/career.ts`), so a deal signed in a
transfer window also covers the season in progress, and a renewal signed at
season-end does not.

| Surface | Max term |
| --- | --- |
| Season-review renewal | `clamp(seasonsLeft, 1, 3)` |
| Market signing, in-season | `clamp(seasonsLeft + 1, 1, 3)` |

A 35-year-old retiring at 36 may sign a 2-year deal in the window but only a
1-year renewal. Both describe the same two seasons of football.

### 2.2 Seasons left

`seasonsLeft = 0` once announced, otherwise `max(1, retirementAge - age)`.

An announced player may not be **renewed** at any length — their cap is zero and
the term selector offers nothing. They may still be **signed** for one season,
because a transfer-window deal covers only the run-in of the season they are
already finishing. In practice the market never offers one: announcements are
stamped only on the user's own squad, and rival clubs are regenerated each
season. The rule is enforced anyway so the module cannot be wrong if that
changes.

The `max(1, …)` is not defensive padding. A player whose age already exceeds
their retirement age — a 38-year-old signed with a retirement age of 34 — has not
yet announced, so the next transition announces them and grants one final
season. One is the true answer, not a floor.

---

## 3. Visibility: only when it is close

The card and the inbox stay silent while retirement is far off. A manager should
not be able to read a 31-year-old's exact expiry date off the squad list.

| State | Card |
| --- | --- |
| `seasonsLeft >= 2` | nothing |
| `seasonsLeft === 1`, not announced | "Considering retirement in 1 year" |
| Announced | "Final season — retires in summer" |

`seasonsLeft === 1` is exactly the set of players who will announce at this
season's end, so the card and the inbox key off one predicate.

**Accepted asymmetry:** the negotiating table is more honest than the squad list.
A 33-year-old retiring at 34 is offered a one-year maximum, three seasons before
the card would say a word. This is deliberate — sitting down to sign is when a
player would be candid about his future, and it is the moment the explanatory
copy lands. "Only when it's close" governs the card and inbox, not the contract.

---

## 4. Copy

**Term selector**, rendered only when the cap is below 3:

> He'll only put his name to 2 years — at 35 he reckons that's about all he has
> left in him.

**Inbox**, new alert `retirement-considering-<season>-<playerId>`, tone `info`:

> **Sten Halvorsen is thinking about retirement** — Age 36 · one more season
> after this one. Plan the succession now.

---

## 5. The inbox has three slots

`view-models.ts` caps the desk at three items per week, urgent first. The
existing `retirement-announcement-*` alert is **not** one-shot, so it re-renders
every week of the final season. A second recurring retirement alert on an ageing
squad would start evicting injuries and board deadlines.

The new alert is therefore **one-shot** via the existing `isOneShotProductAlert`
facility: it lands once in the week it is discovered, then rests, and the card
carries the standing information.

The existing announcement alert is left exactly as it is. Bert's `retirement`
guide sequence anchors to it, and making it one-shot risks dropping that
tutorial.

---

## 6. Architecture

One new pure module, `src/game/retirement.ts`, following the `src/game/loyalty.ts`
precedent: a derived value with no stored state, so it works for every player in
every save without a migration.

It is the **single source of truth**. `personality` is optional on `CareerPlayer`
and the view model quietly defaults it to `'Professional'`; two call sites
defaulting differently would display one number and enforce another.

Enforcement is layered so no path bypasses the cap:

1. **View model** computes the allowed terms and the explanatory line.
2. **UI** renders from that list — `MarketScreen.tsx` currently hardcodes
   `[1, 2, 3]`, and `useContractDraft` defaults the term to 2, which must clamp.
3. **Engine** rejects an over-long offer in `market-career.ts`, on both the
   signing and renewal paths.

---

## 7. Out of scope

- No `ENGINE_VERSION` bump. This is `src/game/`, with no match-replay effect.
- No save migration. The figure is derived, and a save that already carries a
  three-season deal on a 37-year-old keeps it, lapsing with the player exactly as
  it does today. The cap governs new offers only.
- Retirement ages, the decline curve, and the legend legacy flow are unchanged.

---

## 8. Tests

- A property test across all six personalities and ages 30–38 asserting that a
  contract signed at exactly the capped term never outlives its player, driven
  through `resolveSeasonEndLifecycle` rather than asserted against the formula.
- Both offer paths rejected above the cap.
- The one-year-out alert firing exactly once, in the season before the
  announcement.
- The card label appearing only in the two close states.
