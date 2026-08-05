# Club Business, Supporters, and Buzz — brainstorm

**Date:** 2026-08-04  
**Status:** approved for implementation; Quick/Watch policy B confirmed 2026-08-05  
**Companion spec:** `docs/superpowers/specs/2026-08-04-club-business-and-buzz-design.md`

## The player-facing promise

The club should begin as a tiny side with one quiet local sponsor, then visibly
grow into a known football brand:

- wins and heroes bring in supporters;
- a genuinely bad run slowly loses some of them;
- promotion to D4 brings sponsor choice, objectives, and up to three slots;
- Season 3 brings a social following and a Buzz payday twice each season;
- the extra cash creates decisions rather than removing the economy, because
  facility upgrades become more expensive at the same time.

This is one progression arc, not four unrelated meters. Supporters are the
long-term crowd, sponsors are the recurring business, and Buzz is a short
half-season burst of attention that sponsors convert into cash.

## Locked owner decisions

1. Managed sponsor offers unlock only after the club first reaches **D4**.
2. Bert introduces them as a consequence of moving up: bigger companies are
   now interested in the club.
3. Sponsor contracts have **1–3 slots, objectives, and monthly payments**.
4. **Sponsor signing/unlock perks are cut.** No cash advances, scout-region
   unlocks, drill unlocks, or other side benefits.
5. Buzz unlocks in **Season 3**, whether or not D4 has been reached.
6. Bert introduces Buzz by saying the team is now famous enough to have a real
   social-media following. Goals, wins, and hero moments build it.
7. Buzz pays out **twice per season**.
8. Existing saves must keep their current sponsor income.
9. New cash must be offset with more expensive **facility upgrades**, sized by
   balance measurement. Level-1 builds and the opening Training Pitch promise
   are not casually inflated.
10. The whole feature needs balance coverage and real 375pt UI/UX verification.

## Locked Quick/Watch policy

**B is confirmed:** Quick Result uses the same opening formation and saved Auto
Subs setting as watched play, applies no active manager tactical inputs, and
auto-coaches only the opponent. This preserves the existing player-facing Auto
Subs choice and prevents Quick/Watch audience rewards from diverging.

## Chosen shape

### Supporters

Every competitive match produces a small supporter impact. A win adds a base
gain. Each powered player who actually appeared adds a smaller hero attraction
gain. Consecutive losses do not hurt immediately; decline begins on the third
straight loss and grows gently, then a draw or win resets the streak.

The result is queued until weekly settlement. It never increases attendance for
the match that just produced it, and league/Cup double-headers use the same
pre-week crowd for both gates.

### Sponsors

D5 keeps today's passive sponsor payment. Reaching D4 permanently opens the
Sponsor Desk. Capacity grows with the best division reached: one slot at D4,
two at D3, three at D2, and three at D1.

The club is never forced into zero sponsor income. Each pre-season begins with
continuity contracts worth the same division baseline as today; the manager may
replace them with deterministic offers that trade reliable monthly money
against a larger, harder objective bonus.

### Buzz

From Season 3, goals, wins, and distinct heroes firing powers fill a 0–100
meter. It settles after Weeks 15 and 30, pays a percentage of the club's actual
monthly sponsor value, then resets. It is not spendable and is not a third
currency.

If the club is still in D5 in Season 3, its existing basic sponsor pays Buzz.
Managed offers remain locked until D4, so neither story promise blocks the
other.

### Facility prices

Build costs remain unchanged. The measured first pass is +25% for Level 2 and
+50% for Level 3, rounded to $500. The Coaching Office is excluded and its
meaningless upgrades are disabled until they gain an honest benefit. Historical
cost basis must be persisted so old buildings do not receive a larger refund
for money the player never paid.

## Alternatives rejected

- **Buzz as a currency:** rejected. Money and TP already have one job each;
  Buzz is a progress meter that resolves directly into Money.
- **All business systems at career start:** rejected. It overloads the opening
  and makes a tiny D5 club feel implausibly corporate.
- **Buzz gated behind D4:** rejected. The owner explicitly placed it in Season
  3, and a slower career must not lose that promised progression beat.
- **Sponsor perks:** explicitly cut to avoid economy exploits, hidden unlock
  dependencies, and extra regression surface.
- **Blank sponsor slots if the player ignores pre-season:** rejected. That turns
  a missed menu into an economy trap and breaks migrated income.
- **Immediate fan gains before the home gate:** rejected. The result cannot
  retroactively fill seats for a match that has already happened.
- **Blanket increase to facility builds, upkeep, and upgrades:** rejected. It
  breaks the opening cash contract and compounds emergency-loan risk. Only
  upgrade capital costs change in the first pass.

## Explicit non-goals

- settable ticket prices or attendance elasticity;
- Chemistry;
- sponsor negotiation mini-games;
- sponsor perks or sponsor-exclusive unlocks;
- a new currency;
- match-engine tuning or replay-format changes;
- new native dependencies;
- pricing Coaching Office upgrades before they do something real.
