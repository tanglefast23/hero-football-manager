# Division Awards Ceremony — design

**Date:** 2026-08-01
**Status:** built; §2–§4, §6 and §8 amended 2026-08-02 after the owner watched it
run — the rival walk-on was removed, leaving one walk-on a board and only ever
one of your own players
**Scope:** Cycle 2 of 2
**Depends on:** [2026-08-01-division-leaders-design.md](2026-08-01-division-leaders-design.md)

The end-of-season presentation of the four division awards. Cycle 1 records the
statistics and shows them live; this is the payoff.

---

## 1. Where it sits

The career phase machine already runs `championship-celebration` → `season-end`
(`src/application/store.ts:920`). The ceremony becomes a screen between them:

```
championship-celebration (only if you won the league)
  → awards-ceremony
    → season-end
```

The championship celebration is about the club. The awards are about the
players. Putting the awards after it means the sequence moves from the team's
result to the individuals who produced it, and it satisfies the requirement that
the league winner is shown first.

The ceremony runs **every season**, including seasons where the club wins
nothing.

**Reconciliation required.** `SeasonRecap` already carries `topScorer`,
`playerOfSeason`, `youngPlayer` and `heroOfSeason`, and the season-end screen
renders them (`src/application/view-models.ts:599`). Without a change, a player
would watch a Golden Boot ceremony and then immediately see a second, differently
scoped Golden Boot on the next screen — the recap's version is club-only and
counts cup goals, so the two can legitimately name different players. The
season-end screen drops the `topScorer` line and keeps the three awards the
ceremony does not cover.

---

## 2. What it presents

All four categories, every season, whoever won — including rivals. A division
where you never see the other clubs' best players is a division that does not
feel populated, and losing the Golden Boot to a striker you have watched all
season is what makes taking it off him next year mean anything.

A rival winner is therefore **named and placed on the podium, but never walks
on**. The board reads out third, second and first exactly as it would for your
own players; what a rival does not get is the sprite entry and the line. See §3
for the rule and for why the original one was reversed.

**Reveal order** is fixed and ascending in prestige, so the sequence builds:

1. Keepers — saves
2. Defenders — tackles won
3. Midfielders — passes
4. Strikers — goals

Goals last. It is the award a football audience understands most immediately,
and the one most likely to be contested.

---

## 3. The beat for one category

Each category is one screen state, advanced by tap.

1. **Category card.** The position and metric, briefly.
2. **Top three.** Third, then second, then first — each arriving in turn rather
   than as a static list, so the order of reveal carries the tension.
3. **One walk-on, conditional.** The highest-placed player on that podium who
   belongs to **your** club walks on, jumps, and speaks:
   - He finished first → a **winner** line, and the prize line appears.
   - He finished second or third → a **runner-up** line.
   - **No player of yours on the podium at all → nobody walks on.** The board
     shows its three placings and the ceremony moves on.
4. **Tap to continue** to the next category.

**Exactly one walk-on a board, and only ever yours.** A rival never walks on,
whatever he won. Your club taking first and second still produces one walk-on,
and it is the winner's.

### The rival walk-on was reversed

This document originally specified the opposite — a rival winner got the
identical entry, jump and line, on the argument that "a rival who wins the
Golden Boot off you should feel like he won it", with your runner-up walking on
after him. That shipped, the owner watched it, and reversed it: two walk-ons a
board is too many, and the one the manager cares about is the second of them,
arriving after a stranger has already had the moment. The rival's presence on
the podium carries the rivalry; his sprite was spending the board's attention
without adding to it.

The old "one walk-on at a time" tie-breaker existed to stop two of your own
players both walking on. It is now subsumed: there is only ever one walk-on, and
it is your highest-placed man.

---

## 4. Quote pools

Two pools of thirty lines each, shipped as content:

- **Winner lines** — happy, in the voice of a player who has just won something.
- **Runner-up lines** — beaten to it, and coming back for it next season. Never
  bitter about the winner.

Both pools are now spoken only by your own players, since nobody else walks on.

Both follow the tonal rule already established for arrival lines: deliberately
interleaved so a run of them does not land in a rut, and short enough to be a
remark rather than a paragraph. `MAX_ARRIVAL_LINE_LENGTH` is 64 characters for a
320pt speech bubble; the ceremony bubble uses the same constraint.

### Selection must be keyed, not rolled

This is the part most likely to be got wrong, and the codebase already learned
it the hard way. From `src/ui/player-arrival-lines.ts:52`:

> Keyed on the player rather than rolled: the overlay re-renders on every window
> resize, so a rolled line would change under the player mid-walk.

The ceremony has the same exposure and worse — it holds a speaking sprite on
screen across taps and orientation changes. So the line is a pure function of
stable inputs:

```
line = POOL[hashString(`${playerId}:${season}:${category}`) % POOL.length]
```

Same player, same award, same season always says the same thing; winning the
same award in a later season draws a different line. No `Math.random`, no state.

### De-duplicate within the ceremony

Four speakers — one a board, at most — drawing independently from thirty lines
collide more often than is comfortable: `29 × 28 × 27 / 30³` ≈ 81% all-distinct,
so roughly **one ceremony in five** has two of them deliver the identical line
minutes apart, in the flagship moment of the season.

The arrival-line pool tolerates repeats because signings are spread across
weeks. The ceremony compresses four draws into a single sitting, so it needs a
de-dup: if a hashed index is already taken by an earlier category this ceremony,
probe forward to the next free line.

This stays a pure function. All four speakers are known from the recap before
the first card renders, so the whole set is computable up front — no state, no
`Math.random`, and the same season always produces the same lines. The two pools
claim indices separately, so a winner and a beaten player never displace each
other.

Across seasons, thirty lines means a repeat is noticeable only after many wins
in the same category — acceptable, and far cheaper than threading "what was said
last time" through the save.

---

## 5. Prize

After all four categories, a single prize screen totals what the club earned.

### The ceremony does not grant it

The prize is computed as a pure function of the final standings and the division
being entered. The ceremony never grants it; it only displays the result of that
function.

**When it is banked.** The season transition (`startNextSeason`) runs when the
player *leaves* season-end — which is after the ceremony, not before it. So the
ceremony is showing a **projection**, not a banked figure, and the spec must say
so plainly: an implementer who reads "already banked" and finds it isn't will
reasonably conclude the grant belongs on the prize screen, which reintroduces
exactly the double-pay problem this section exists to prevent.

The rule is therefore:

- The same pure function is called twice — once by the ceremony to display, once
  by the transition to grant. It takes the final standings and the target
  division and returns a figure. It has no side effects and reads no clock.
- Skipping is safe because the ceremony never grants, not because the money has
  already moved.
- Nothing about the grant depends on the ceremony having been seen.

This follows the pattern the codebase already uses: `awardNationalCupPrize`
(`src/game/career.ts:959`) folds cup prize money into `GameState` at the moment
the result resolves — the celebration screen that follows decides nothing.
`hasPendingChampionshipCelebration` is the same shape.

The alternative — granting TP when the prize screen renders — creates a whole
class of bug that no test closes: the app killed mid-ceremony, re-entry, back
navigation, a replayed ceremony paying twice. "Pays exactly once" should be a
property of where the state lives, not an assertion someone remembered to write.

Sequencing note: promotion and relegation have not been *applied* when the
ceremony runs, but they are fully determined by the final standings. The same
pure function therefore serves both the ceremony's display and the transition's
grant, with no duplicated rule.

- The value counts up from zero over 2–3 seconds, easing out.
  `countUpValue(target, progress)` (`src/ui/count-up.ts`) already implements
  exactly this with a cubic ease and clamping.
- The count is driven by animation frames, not a timer sampling the clock.
- If the club won nothing, the screen states that plainly and moves on rather
  than counting to zero.

**Currency is Training Points.** `docs/06-economy.md:10` splits the two
deliberately — money is lumpy and stressful, TP flows steadily, and that
separation keeps a losing run from starving player development. The award exists
to close a strength gap, which is development. Cash would make this the one
reward in the game that also relieves the board ultimatum.

**Amount scales with the division being entered, not the one just played.** The
stated purpose is helping the club beat the division it lost or survive the one
it is promoted into, so the prize is sized against next season's opposition.

**Amounts are not fixed in this document.** They come from the balance harness
once Cycle 1 has produced real season data. For scale: weekly income is roughly
52 TP with a level-1 Training Pitch, and a focus drill costs 6–15 TP, so a
category win in the low hundreds is the plausible neighbourhood. Balance rails
must still pass.

---

## 6. Presentation constraints

**Reduced motion.** `use-reduced-motion.ts` exists and must be honoured: the
walk-on, jump and count-up degrade to static presentation with the final values
shown immediately. The information must never live only in the animation.

**Skippable, at two levels.** Consistent with the established rule that cut-ins
are skippable after first view:

- Skip the current walk-on and jump straight to the podium result.
- Skip the remainder of the ceremony and go to the prize total.

Skipping never changes what was awarded, because the ceremony does not award
anything — the season transition does, from the same pure function, whether or
not a single frame was watched. A player who skips every ceremony for ten
seasons ends up in exactly the same state as one who watches them all.

"Skip this walk-on" now skips the board's only walk-on, so it can never leave a
second sprite waiting behind the one just dismissed.

**Sprite reuse.** The walk-on reuses the existing overlay machinery rather than
inventing a second one — `PlayerWalkOnWelcome`, `CharacterSpeechOverlay` and
`ChampionshipCelebrationScreen` already solve sprite entry, speech bubbles and
celebration staging.

**Rival sprites.** Not needed: no rival walks on. A rival winner is a name, a
club and a figure on the podium. Rival players do carry `lookId` and paper-doll
data like anyone else, so reinstating a rival walk-on would need no new art —
but nothing renders one today.

### SFX trap

Adding audio cues to this screen is not free. Per the recorded lesson: a new cue
breaks eight tests unless it is **appended last**, the hardcoded player count is
bumped, **and** both rapid-pool index arrays are shifted. Any cue work should be
planned as one deliberate step, not sprinkled through the build.

---

## 7. Data

The ceremony reads the four denormalised winners that Cycle 1 stamps into
`SeasonRecap` at the season transition, plus the second and third places for
each category.

Each placing is a `DivisionAwardPlacement` — `{playerId, playerName, clubId,
value}`. The name is denormalised so it survives the rival roster being wiped on
a division change; the club id resolves to a name through `m2.pyramid`, which
keeps all fifty clubs; and `value` is a number so the ceremony can render "27
saves" without a display string being the only place the figure exists.

---

## 8. Testing

- **Line selection is stable**: same player, season and category yields the same
  line across repeated calls and re-renders.
- **No two speakers share a line** in the same ceremony, including when the
  de-dup probe has to wrap.
- **Line pools** are the stated length, unique, and within the character limit.
- **Beat sequencing**, one walk-on a board at most: a rival winner with nobody
  of yours on the podium produces **no** walk-on; your winner speaks a winner
  line; your second-placed man behind a rival speaks a runner-up line; your
  first *and* second produces one walk-on, the winner's; and a category with
  fewer than three qualifying players still stages correctly.
- **A season winning nothing** produces a complete, coherent ceremony.
- **Count-up** reaches exactly the target and never overshoots.
- **Reduced motion** shows final values with no animation.
- **Phase machine**: the ceremony is entered once, cannot be re-entered by
  navigating back, and always terminates at `season-end`.
- **Prize function** is pure and total: same standings and target division
  always yield the same figure, and a club that won nothing yields zero.
  Whether the grant can happen twice is not tested here — the season-transition
  fold makes double payment unrepresentable.

---

## 9. Open

Prize amounts per category and per division, to be derived from the balance
harness after Cycle 1 ships.
