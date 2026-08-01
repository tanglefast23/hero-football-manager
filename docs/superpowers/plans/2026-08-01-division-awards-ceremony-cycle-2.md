# Division Awards Ceremony (Cycle 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Present the four division awards at the end of each season — top three per category, the winner walking on to speak, and a Training Point prize counting up.

**Architecture:** The prize is a pure function of final standings and target division, applied in the season-transition fold in the game ring. The ceremony screen only presents. Quote selection is a keyed hash, never a roll, so a line cannot change under a speaking sprite mid-render.

**Tech Stack:** TypeScript, Jest (`testEnvironment: 'node'`, no DOM), zod-validated JSON content, React Native + NativeWind.

**Design spec:** [2026-08-01-division-awards-ceremony-design.md](../specs/2026-08-01-division-awards-ceremony-design.md)

**Base:** `09350c7` (Cycle 1 merged).

---

## What Cycle 1 already gives you

- `SeasonRecap.divisionAwards?: Record<AwardCategoryId, DivisionAwardPlacement[]>` — top three per category, denormalised at the season transition (`{playerId, playerName, clubId, value}`).
- `AwardCategoryId` = `'goals' | 'passesCompleted' | 'tacklesWon' | 'saves'`.
- `AWARD_CATEGORIES` (`src/game/division-leaders.ts`) carries `role`, `boardLabel`, `metricLabel` per category.
- `m2.pyramid` persists all fifty club names, so a stored `clubId` resolves forever.
- `countUpValue(target, progress)` (`src/ui/count-up.ts`) — cubic ease, clamped.
- `use-reduced-motion.ts`, `PlayerWalkOnWelcome`, `CharacterSpeechOverlay`, `ChampionshipCelebrationScreen` for staging precedent.

## File structure

| File | Responsibility | Change |
| --- | --- | --- |
| `src/game/division-award-prize.ts` | Pure prize function | **Create** |
| `src/game/full-career.ts` | Bank the prize in the transition fold | Modify |
| `src/game/types.ts` | Prize fields on `SeasonRecap` | Modify |
| `src/persistence/game-state-codec.ts` | Schema for the prize | Modify |
| `content/award-ceremony-lines.json` | 30 winner + 30 runner-up lines | **Create** |
| `src/content/schemas.ts` | Validate the line pools | Modify |
| `src/ui/award-ceremony-lines.ts` | Keyed selection with in-ceremony de-dup | **Create** |
| `src/application/award-ceremony-view-model.ts` | Recap → ordered beats | **Create** |
| `src/ui/screens/AwardsCeremonyScreen.tsx` | The screen | **Create** |
| `src/application/store.ts` | `awards-ceremony` screen between celebration and season-end | Modify |
| `src/application/view-models.ts` | Drop the recap's duplicate `topScorer` line | Modify |

---

## Task 1: The prize, banked in the game ring

**Files:** create `src/game/division-award-prize.ts`; modify `src/game/types.ts`, `src/game/full-career.ts`, `src/persistence/game-state-codec.ts`; test `src/game/__tests__/division-award-prize.test.ts`

### Why it is not on the prize screen

`awardNationalCupPrize` (`src/game/career.ts`) folds cup money into `GameState` when the result resolves; the celebration screen that follows decides nothing. Same shape here. Granting TP when a screen renders creates a class of bug no test closes — app killed mid-ceremony, re-entry, back navigation, a replayed ceremony paying twice. "Pays exactly once" must be a property of where the state lives.

**Sequencing.** The ceremony runs before `startNextSeason`, so it displays a **projection**, not a banked figure. The same pure function is called twice — once by the ceremony to display, once by the transition to grant. Do not write a comment claiming the money has already moved when the ceremony runs; it has not.

- [ ] **Step 1: Write the failing test**

Cover: a club winning nothing yields zero; one category win yields the per-category amount for the division being entered; winning all four yields four times that; the function is pure (same inputs, same output, no clock, no RNG); and promotion/relegation changes the figure because the target division differs.

- [ ] **Step 2: Implement**

`divisionAwardPrize(recap, targetDivision)` → `{ trainingPoints: number; categoriesWon: AwardCategoryId[] }`, counting categories whose first placing belongs to a player on the user's club.

**Currency is TP, not cash.** `docs/06-economy.md:10` splits them deliberately — money is lumpy and stressful, TP flows steadily, and that separation keeps a losing run from starving development. The award exists to close a strength gap, which is development. Cash would make this the one reward that also relieves the board ultimatum.

**Amount scales with the division being *entered*,** not the one just played, because the stated purpose is helping the club survive what comes next.

Starting proposal, to be validated in Step 4: **120 TP per category at D5, rising 20 per tier** (D4 140, D3 160, D2 180, D1 200). Weekly income is roughly 52 TP with a level-1 pitch and a focus drill costs 6–15, so one category is about two weeks of income or a dozen drills.

- [ ] **Step 3: Bank it in the transition**

Apply in `startNextFullCareerSeason`, adding to `trainingPoints`, alongside the existing prune. Record the granted figure on the recap so the ceremony and the grant cannot disagree.

- [ ] **Step 4: Validate against the balance harness**

Run the existing balance harness and confirm `MINI_BALANCE_RAILS` still passes. Then measure what a sweep is worth against a season's ordinary TP income and report the ratio. If four categories exceeds roughly a quarter of a season's income, say so — the numbers above are a starting point, not a decision.

- [ ] **Step 5: Commit**

---

## Task 2: The quote pools

**Files:** create `content/award-ceremony-lines.json`, `src/ui/award-ceremony-lines.ts`; modify `src/content/schemas.ts`; test `src/ui/__tests__/award-ceremony-lines.test.ts`

- [ ] **Step 1: Write the failing test**

Cover: both pools are exactly 30, unique, and within the character limit; selection is stable across repeated calls for the same `(playerId, season, category)`; a different season yields a different line; and **no two winners in one ceremony share a line**, including when the de-dup probe has to wrap.

- [ ] **Step 2: Write the content**

Thirty winner lines — happy, in the voice of a player who has just won something. Thirty runner-up lines, spoken only by your own players: working harder next season, or something funny about second place, never bitter about the winner.

Follow the tonal rule already set by `src/ui/player-arrival-lines.ts`: deliberately interleaved so a run does not land in a rut, and short enough to be a remark rather than a paragraph. `MAX_ARRIVAL_LINE_LENGTH` is 64 characters for a 320pt bubble; use the same ceiling.

- [ ] **Step 3: Implement selection — keyed, never rolled**

From `src/ui/player-arrival-lines.ts:52`:

> Keyed on the player rather than rolled: the overlay re-renders on every window resize, so a rolled line would change under the player mid-walk.

The ceremony is more exposed — it holds a speaking sprite across taps and orientation changes. So:

```
line = POOL[hash(`${playerId}:${season}:${category}`) % POOL.length]
```

**Plus in-ceremony de-dup.** Four independent draws from thirty collide more often than is comfortable: `29 × 28 × 27 / 30³` ≈ 81% all-distinct, so roughly **one ceremony in five** would have two winners deliver the identical line minutes apart. If a hashed index is already taken by an earlier category this ceremony, probe forward to the next free line. All four winners are known from the recap before the first card renders, so the whole set is computable up front — no state, no `Math.random`.

- [ ] **Step 4: Commit**

---

## Task 3: The ceremony view model

**Files:** create `src/application/award-ceremony-view-model.ts`; test `src/application/__tests__/award-ceremony-view-model.test.ts`

- [ ] **Step 1: Write the failing test**

Cover: four beats in reveal order **keepers → defenders → midfielders → strikers** (goals last, because the ceremony is *watched* and builds to a climax — the League board is *scanned* and leads with goals; the two orders are deliberately opposite); club names resolved from `m2.pyramid`; `isUserPlayer` set per placing; a rival winner still carries a line; a runner-up beat present only when a user player placed second; a category with fewer than three placings; and a season where the club won nothing producing a complete, coherent set of beats.

- [ ] **Step 2: Implement**

`awardCeremonyViewModel(source)` → ordered beats, each carrying the category labels, up to three placings, the winner's line, an optional runner-up placing and line, and the projected prize.

**One walk-on at a time.** If two of your players take first and second in the same category, the winner speaks and the runner-up does not — two sprites competing for one moment weakens both.

- [ ] **Step 3: Commit**

---

## Task 4: The screen

**Files:** create `src/ui/screens/AwardsCeremonyScreen.tsx`; test `src/ui/__tests__/awards-ceremony-screen.test.ts`

Jest has no DOM, so test the pure helpers and keep logic out of the component.

- [ ] **Step 1: Write the failing test** for the pure helpers — beat advancement, the accessibility sentence for a placing, and the count-up frame value at a given progress.

- [ ] **Step 2: Build the screen**

Per category: category card → third, second, first arriving in turn → winner walk-on, jump, speech → conditional runner-up walk-on → tap to continue. After all four, one prize screen counting the total up from zero over 2–3 seconds via `countUpValue`, driven by animation frames rather than a timer sampling the clock. A club that won nothing states that plainly instead of counting to zero.

**A rival winner gets the identical walk-on** — same entry, same jump, same line. Only the prize line and the runner-up beat differ. A rival who takes the Golden Boot off you should feel like he won it; that is what makes taking it back matter.

Reuse `PlayerWalkOnWelcome`, `CharacterSpeechOverlay` and the `ChampionshipCelebrationScreen` staging rather than inventing a second path. Rival players carry `lookId` and paper-doll data like anyone else, so no new art.

**Skippable at two levels:** skip the current walk-on to the podium result, or skip the rest of the ceremony to the prize total. Skipping never changes what was awarded — the transition grants it either way — which is what makes the full rival walk-on affordable.

**Reduced motion** (`use-reduced-motion.ts`): walk-on, jump and count-up degrade to static presentation with final values shown immediately. Information must never live only in the animation.

**SFX trap.** Adding audio cues here is not free: a new cue breaks eight tests unless it is appended **last**, the hardcoded player count is bumped, **and** both rapid-pool index arrays are shifted. Plan any cue work as one deliberate step.

- [ ] **Step 3: Commit**

---

## Task 5: Wiring, and removing the duplicate award

**Files:** modify `src/application/store.ts`, `src/application/view-models.ts`; test `src/application/__tests__/awards-ceremony-flow.test.ts`

- [ ] **Step 1: Write the failing test**

Cover: the ceremony is entered once after `championship-celebration` (or directly, when the club did not win the league), always terminates at `season-end`, and cannot be re-entered by navigating back. Assert the TP grant lands exactly once across a full transition — and prove it by driving the flow twice.

- [ ] **Step 2: Add the screen to the machine**

`'awards-ceremony'` joins the screen union (`store.ts:147`). `completeChampionshipCelebration` (`store.ts:945`) currently sets `screen: 'season-end'` — it now routes to the ceremony, and completing the ceremony routes to `season-end`. The path where the club did not win the league must also pass through it.

- [ ] **Step 3: Drop the duplicate Golden Boot**

`view-models.ts:607` renders `recap.topScorer` on the season-end screen. That award is **club-only and counts cup goals**; the ceremony's is division-wide, league-only and forwards-only, so the two can legitimately name different players. Without this, a player watches a Golden Boot ceremony and immediately sees a contradicting Golden Boot. Remove `topScorer` from that list and keep the other three.

- [ ] **Step 4: Commit**

---

## Self-Review

**Spec coverage.** Section 1 (placement, reconciliation) → Task 5. Section 2 (four categories, reveal order) → Task 3. Section 3 (beat structure, rival walk-on, one walk-on at a time) → Tasks 3–4. Section 4 (quote pools, keyed selection, de-dup) → Task 2. Section 5 (prize, banked in the game ring) → Task 1. Section 6 (reduced motion, skip, sprite reuse, SFX trap) → Task 4. Section 7 (data) → given by Cycle 1.

**Known risks for the implementer.**

- Task 4 has no renderable assertions — Jest is `testEnvironment: 'node'` with no DOM. Pure helpers are tested; the visual result needs a preview check.
- The prize amounts in Task 1 are a starting proposal. Step 4 validates them; report the ratio rather than assuming.
- `divisionAwards` is `Record<AwardCategoryId, ...>` — the key is `passesCompleted`, not `assists`. The Midfielders board changed metric late in Cycle 1 and any code written from memory will get this wrong.
