# Endgame Celebrations — design

**Date:** 2026-08-02
**Status:** approved design, ready for planning

Three distinct moments that mark the end of the main climb, replacing a single
celebration that currently fires identically for every division.

---

## 1. The gap this closes

`docs/02-core-loop.md:26` states the game's own victory condition:

> **Career victory**: win D1 · Global League to complete the main climb. Endless
> play continues afterward, and a score recap (Kairosoft-style) shows after
> Season 10 regardless of progress; nothing ends.

The code does not implement it. `hasPendingChampionshipCelebration`
(`src/application/championship-celebration.ts:11`) never inspects which division
was won, so taking D1 · Global League — the documented climax of the entire
game — fires the same screen as taking D5 · District League in season two. The
promised season-10 recap does not exist at all.

The summit is unmarked. A player reaching it is shown the fanfare they already
saw years earlier, and then the ladder silently loops: `divisionAfterFinish`
(`src/game/pyramid.ts:360`) returns the same division when `division === 1`.

---

## 2. The three moments

The main climb now has **two** requirements — win D1, and win the National Cup —
and the order they arrive in is the player's own.

| State reached | What plays |
| --- | --- |
| D1 title, cup not yet won | **Global League Champions.** Distinct from an ordinary promotion. Tells the player the ladder is finished and the Cup is what remains. |
| Cup won, D1 not yet won | **Cup Winners.** Congratulates, and says plainly that the division is still the goal. |
| Both won, either order | **The true ending.** |

The Cup continues to run every season in all states. Nothing is gated off, and
nothing ends — endless play is preserved exactly as the core loop promises.

### Why both, rather than D1 alone

D1 alone is reachable by grinding a ladder whose outcome the player already
controls by that point. The Cup is a knockout: 50 clubs, single elimination, and
a D1 side must win five ties to lift it. Requiring both means the climb ends on
something that cannot be ground out, while D1 remains the thing the ladder was
built to deliver.

It also gives the D1 plateau a purpose. Today a player who wins D1 replays it
with nothing left to chase.

---

## 3. Career flags

Per-career, not per-season. The existing celebration flag
(`celebration:league-title:season-N`) stays exactly as it is for ordinary
division titles.

- `career:global-league-won` — set the first time the club finishes first in D1
- `career:national-cup-won` — set the first time the club lifts the Cup
- `career:true-ending-seen` — set when the true ending has played

The true ending fires when the second of the two flags is set and
`career:true-ending-seen` is not. Whichever completes the pair triggers it, so
the logic is symmetric and neither order is privileged.

**One celebration at a time.** When a D1 title completes the pair, the player
sees the true ending, not the Global League screen followed by it. The pair
completing supersedes the individual moment.

---

## 4. Global League Champions

Fires on a first D1 title while the Cup is unwon.

Shape follows `ChampionshipCelebrationScreen` — the whole squad walks out
together with Bert, jumping — but the staging is bigger than an ordinary title
and the copy says something different: the ladder is finished, there is nothing
above this division, and the Cup is the one thing left.

**The star is the highest-fame player, not the top scorer.** The ordinary
celebration parades whoever scored most this season
(`championship-celebration.ts:53`). At the summit the right player to single out
is the one the club has *made* — fame accumulates across a career from titles,
cup runs and awakenings, so it is the closest thing the save has to a measure of
who this journey belongs to. Ties break on the existing deterministic id order.

---

## 5. Cup Winners

Fires on a first Cup win while D1 is unwon.

Deliberately smaller than the D1 screen. It congratulates properly — the Cup is
hard and beating four higher-division sides to it is a real run — and then says
the division is still the goal. It must not read as a consolation prize; it
reads as an achievement out of sequence.

---

## 6. The true ending

Fires when the second flag lands.

**The highest-fame player walks out alone and talks to the manager**, across
several speech bubbles rather than one. What he says: thank you for making me
the player I am; I could not have done it without your guidance; the wins and
the fame were good, but it is the coaching and the memories of the journey I
will carry.

Warm, sincere, unironic. This is the one moment in a game full of jokes that is
allowed to be sentimental, and the writing should trust that rather than
undercut it.

**Background.** A pixel-art football ground, drawn in the game's established
style. Fireworks animate in the sky above it.

The repo already has a coded pixel-art system — `src/ui/event-pixel-art.ts`
declares sprites as runs (`eventSpriteRuns`, `EVENT_OBJECTS`) rather than
shipping image files. Fireworks should be authored the same way, so they stay
scalable, theme-aware and diffable.

**Music continues.** Whatever is playing carries straight through from the
preceding screen. `startTheme()` / `stopTheme()` (`src/render/audio.ts:468`)
already exist; the requirement is simply that nothing calls `stopTheme` across
this transition. The moment should not open with silence or a restart.

---

## 7. Constraints

- **Reduced motion** (`src/ui/use-reduced-motion.ts`): walk-ons, jumping and
  fireworks degrade to a static scene with all text shown immediately.
  Information must never live only in the animation.
- **Skippable**, consistent with the rule that cut-ins are skippable after first
  view — but the true ending should not be skippable on its first play.
- **No new audio cues.** Adding one breaks eight tests unless it is appended
  last, the hardcoded player count is bumped, and both rapid-pool index arrays
  are shifted. Any cue work is a separate deliberate step.
- **Nothing ends.** After any of the three, play continues. No terminal state,
  no locked save, consistent with the fail-soft principle that the game never
  presents a game over.

---

## 8. Out of scope

The Kairosoft-style season-10 score recap, which the core loop doc also promises
and which also does not exist. It is a separate feature with its own scoring
question, and bundling it here would delay the summit being marked at all.
