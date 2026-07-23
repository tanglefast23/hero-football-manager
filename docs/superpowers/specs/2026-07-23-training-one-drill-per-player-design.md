# Training Redesign: One Drill Per Player

**Date:** 2026-07-23
**Status:** Design approved, pending spec review
**Author:** brainstormed with Claude

## Problem

Training is a weekly chore. Today you assign a *group* of players and up to **3
drills**, and every player in the group receives every drill. Because players
hit per-stat caps after only 2–3 weeks, you must repeatedly audit the whole
squad — who capped, on which stat, who still has room — and re-shuffle the group
and drills by hand. The group + multi-drill model is the source of the
combinatorial busywork. Worse, when a player caps on a drilled stat the engine
silently makes that player/drill pair *free* and stops helping them, so a
locked-in plan quietly rots and the only way to notice is the manual audit.

## Goals

- Kill the per-week bookkeeping. Training should be "set it and it keeps going,"
  interrupting you *only* when a real decision is required.
- Guarantee **zero silent waste**: TP is never spent on a capped player.
- Remove the "lock in" concept entirely (button, section, and the
  forgot-to-lock-in reminder).
- Keep money pressure intact (a core pillar) without adding busywork.

## Non-goals

- No change to how caps themselves are computed (archetype + potential ceiling).
- No change to the match engine (`src/sim/`). Training lives in `src/game/`; this
  change does **not** affect match replays, so **`ENGINE_VERSION` is not bumped**.
- No save migration — pre-launch, we replace the old training model outright.

## The model: one drill per player, up to three

The unit of training is a **slot** = one player + one drill. There are at most
**3 slots**. (Plain terms: you pick up to 3 players, and each of those players
trains one single thing.)

- Each slotted player trains **exactly one stat** per week and keeps training it
  **automatically every week** — no re-confirming.
- The free roster-wide **base conditioning** (+1 stamina to everyone, costs
  nothing) stays exactly as it is today: a silent passive, **not** one of the 3
  slots.
- Two slots **may** train the same stat (two players both on Shooting is fine).
  The old "no duplicate drill path per week" rule
  (`assertDistinctTrainingDrillPaths`) is removed.

### Drill selection: pick a stat, best tier auto-runs

A player picks a **stat**, not a specific drill. All **7 stats** are trainable:
Pace, Shooting, Passing, Defense, Technique, Stamina, Reflexes. (Reflexes is the
goalkeeper stat and is already one of the seven — there is no per-role swap; a
keeper's Shooting simply carries a low cap, so it greys out early via the
capped-stat rule below.)

- The game automatically runs the **strongest tier you have unlocked** for that
  stat. Tier unlocks by highest division reached (today's rule, unchanged): Tier
  I always, Tier II at D4, Tier III at D2.
- In a player's stat picker, each stat option shows the **drill title** and the
  **gain** of the best-tier drill that will run for it (e.g. "Duels III · +8 DEF"),
  plus the remaining room per stat (cap − current), so the choice is fully informed.
- Any stat that player is **already at cap on is disabled/greyed out**, so you
  can't create a doomed slot.
- **Auto-upgrade on promotion:** when a higher tier unlocks, running slots
  automatically use it (more stat gain, more TP). If that tips you over your TP
  budget, Interrupt #1 (below) handles it. No manual re-picking.

### Selection UX (replaces lock-in entirely)

- Tapping a player fills the next free slot. The player's box shows a **number
  1 / 2 / 3** (fill order) instead of a checkmark. The numbers are cosmetic
  fill-order labels — they do **not** set priority.
- Tapping a numbered box empties that slot; the remaining slots **renumber**
  (e.g. removing #1 leaves the others as 1 and 2).
- Attempting a **4th** selection is blocked with a popup: "Remove one first —
  max 3."
- A slot **commits the moment its drill is chosen.** There is no lock-in button,
  no separate "lock in" gate, and no "you forgot to lock in" reminder or
  advance-week interception. A small **active-slots summary** still lists the ≤3
  current slots (player · stat · effect, e.g. "+8 DEF") for at-a-glance review.

## The two interrupts (both HARD-BLOCKING at week-advance)

Autopilot is interrupted only in two situations, and in both you **cannot
advance the week until you resolve it.** They are evaluated *before* the upcoming
week's training is charged, so no TP is ever wasted.

**Interrupt #1 — can't afford the Training Points.**
If the repeating plan's weekly TP cost exceeds your available TP (current bank +
this week's TP income), you must drop players until the remaining plan is
affordable. The UI lists each trained player with their drill and its effect
("+3 DEF"); you tap players to remove until you're back in budget, then the week
proceeds.

**Interrupt #2 — a player capped the stat they're training.**
When a slotted player's trained stat reaches its cap, you must resolve that slot:
- **(a)** change that player's drill to a stat they still have room in, or
- **(b)** swap a different player into the slot (same stat), dropping the capped
  player.
- If the capped player has **no trainable stat left** (fully maxed), option (a)
  is unavailable — you may only swap a different player in, or free the slot.
Because training is charged weekly, resolving is free — you're just choosing what
next week's TP buys.

**Stacking order:** resolve caps (#2) first — that often frees a player and lowers
the bill — then re-check affordability (#1). So you're never asked to drop
someone for TP and *then* told they were capped anyway.

## Economy: Training Points only, no new sink

- Training costs **Training Points only.** Every focus drill's **money cost is 0.**
- TP is charged **every week** the slot runs (recurring), **once per slot**
  (each slot is one player, so per-slot = per-player).
- **Proposed TP costs** (≈ half today's, tuned so ~3 continuous drills is
  affordable-but-tight against realistic TP income; final values verified against
  the balance harness):

  | Tier (unlock) | TP / slot / week | (today) |
  |---|---|---|
  | I (from D5) | **6** | 9–15 |
  | II (from D4) | **10** | 18–25 |
  | III (from D2) | **15** | 28–38 |

- **No compensating money sink is added, and facility upkeep is NOT raised.**

### Why no new money sink (evidence)

Removing money from drills deletes a recurring ~4–9k/week outflow for active
trainers, which raised a fair worry: does an active manager now accumulate cash?
An active-manager simulation on the real engine (a manager who wins every match,
keeps their hero license full, and **buys a facility whenever affordable**) answers
no. Even with **hero wages set to zero**, season-ending cash goes:

```
season:  1      2      3      4      5      6      7      8
cash:  +56k   -6k   -44k  -82k  -124k -166k -210k -251k
```

It tips negative in season 2 and never recovers; the club can only afford to build
8–12 of 36 facility levels. **Facility capex + upkeep + wages already are the money
sink.** The apparent "build-up" in an earlier abstract sim was purely an artifact
of a manager who spent nothing on facilities or heroes — which doesn't exist.
Removing training money relieves the old brutal training-money drain without
creating any build-up. The residual risk is the *opposite* (a full hero roster on a
built-out club gets tight late-game), which is the intended "you can't keep
everything" tension and is already handled by fail-soft (loan → forced sale).

Coaches remain the optional TP enabler; their weekly wages are the natural,
self-scaling cost for anyone chasing Tier III on three players.

## Tutorial rewrite

The training tutorial changes to match the new flow:

1. "Select a player to train." After one player is selected, the **1/3** indicator
   appears.
2. "Now choose what they'll train." The user picks **one stat**. The slot commits
   immediately and appears in the active-slots summary.
3. The screen scrolls to the next player. "You can train up to 3 players — as long
   as your Training Points allow it."
4. The user is free to add a 2nd and 3rd player, each choosing one stat, each
   committing on selection.

The old lock-in tutorial step and the forgot-to-lock-in hardening are removed.

## Data model & code touch-points

**Training plan shape** (`state.trainingPlan`): from the group model
`{ assignedPlayerIds, drills[] }` to **slots**: `{ playerId, path }[]` (max 3),
where `path` is one of the 7 training paths (sprints→pac, finishing→sho,
rondo→pas, duels→def, first-touch→tec, circuit→sta, keeper-drills→ref). Storing
the *path* (not a specific drill id) is what makes best-tier auto-resolution and
auto-upgrade-on-promotion fall out naturally.

Primary files (from codebase exploration):

- `content/training.json` — set all focus-drill `moneyCost: 0`; set `tpCost` to
  6 / 10 / 15 by tier. Replace `maxFocusDrillsPerWeek` with `maxTrainingSlots: 3`.
- `src/game/training.ts` — rework `setCareerTrainingPlan` (slots, ≤3, allow
  duplicate paths, remove `assertDistinctTrainingDrillPaths`), path→best-tier
  resolution, `chargeableCareerTrainingPlan` (money always 0; TP = Σ resolved-tier
  costs), `resolveCareerTrainingWeek`, and the cap detection
  (`trainingPlanCapConflicts` / `findReachedTrainingCaps`) now feeding the blocking
  Interrupt #2 rather than passive notices.
- `src/game/progression.ts` — `FocusDrill` / `applyTrainingPlan` for per-slot
  application.
- `src/game/types.ts` — `trainingPlan` slot shape, `trainingRules`.
- `src/game/store.ts` — replace `toggleTrainingPlayer` / `toggleDrill` /
  `applyTraining` with slot mutations (fill next slot, renumber on removal, block
  4th).
- `src/application/view-models.ts` + `src/ui/models.ts` — `squadTrainingViewModel`
  exposes slots, per-player fill-order number, per-stat remaining room, and the
  active-slots summary; remove `lockedPlan` / `hasUnsavedChanges` / lock-in fields.
- `src/ui/screens/SquadTrainingScreen.tsx` — number badges, per-player one-stat
  picker with capped stats disabled, active-slots summary, the two interrupt
  modals; remove all lock-in UI.
- `App.tsx` — remove the lock-in-before-advance interception (~:896–917); add the
  blocking Interrupt #1 / #2 flows at week-advance.
- `src/game/career.ts` — weekly settlement wiring so caps/affordability are
  resolved (blocking) before the upcoming week's training is charged.
- Onboarding/tutorial (`src/game/onboarding/…` / story onboarding) — the tutorial
  steps above.

### Interrupt architecture

At each `advanceWeek`, before charging/running the repeating plan for the upcoming
week: (1) surface any slot that capped last settlement → block (Interrupt #2) until
resolved; (2) validate TP affordability of the resulting plan → block (Interrupt #1)
until affordable. Only once both clear does the week run. This keeps resolution
deterministic and pre-charge, guaranteeing no wasted TP.

## Testing & balance

**Exact-value tests to update (break on money→0):**
- `src/game/__tests__/balance.test.ts:50` — `meanSeasonOneDiscretionarySpend`
  drops from 20,000 (pitch + 30×400 training) to ~8,000 (pitch only). Update the
  expected value and its comment.
- `src/game/__tests__/facility-weekly-integration.test.ts:61-62` — the training
  ledger line `[-800,…]` becomes `0`. Update.
- Any test asserting a non-zero `'training'` money ledger line.

**Guardrails to re-verify (may need retuning):**
- `src/game/__tests__/m2-balance.test.ts` corridors (`minimumBalance ≥ -335k`,
  `maximumBalance ≤ 100k`, weekly-net bounds) and the `loanCount == 40` invariant.
  Removing training money slightly loosens the passive economy (the passive runner
  trains ≈1 drill), so confirm the one-loan-per-career invariant still holds; retune
  corridors only if required.
- `training-cap-feedback.test.ts`, `m2-training-growth.test.ts`,
  `archetype-caps.test.ts` — update for the slot model and new costs.

**New deliverable — active-manager economy rail.** The existing balance harness is
entirely *passive* (`runHeadlessFullCareer` never trains or hires), which is why the
build-up question was invisible. Add a headless test that simulates a winning
manager who trains three players (TP-only), reinvests in facilities, and carries a
hero-wage overlay, asserting the economy neither builds up (no runaway `maximumBalance`)
nor breaches fail-soft bounds. This guards the redesign going forward.

## Assumptions

- The two interrupts are the *only* automatic stoppers; everything else repeats
  silently.
- Number badges are cosmetic fill-order; slot order carries no gameplay priority.
- Base conditioning stays free, automatic, and roster-wide.
- Pre-launch: no migration of old saved training plans.
- TP costs 6 / 10 / 15 are a starting proposal; exact values are fixed during
  implementation against the balance harness (target: ~3 continuous drills
  affordable-but-tight; no passive-economy regression).
