# Onboarding — Create-a-Hero + First Awakening (Story Mode opening)

Status: **APPROVED for M1 implementation** (owner brainstorm 2026-07-18). This is the literal
first thing a new player does, so a minimal version ships **inside the M1 vertical slice**. Full
look-customization (paper-doll) stays deferred to M4.

## Why this exists

The team starts with **zero heroes** (owner decision, superseding the earlier "start with 2"
match-test arrangement — M0's 2-hero setup was a match-engine test scenario, never a campaign
start). Rather than fix the "hero-less opening feels empty" risk by *handing* the player a hero,
the opening is about **creation and ownership**: the player builds their own avatar player, plays
one normal match with him, then awakens him via a choice they make. The hero-less first match
becomes the "before" shot that makes the awakening land.

This is compatible with existing canon, not a re-litigation:
- **Pillar 3 "Heroes are precious"** — "A team of five heroes is an endgame achievement, not a
  mid-game default" ([docs/01-vision.md](../../01-vision.md)). Starting at 0 honors this harder than 2 did.
- **Vision fiction** already describes *earning* the first hero: "Your striker is decent. Then one
  day … someone gets bitten, and now he bursts into flame."
- **Balance rails already bless zero-hero starts**: "Div 5–4 are winnable with zero heroes; heroes
  accelerate, never gate," and the harness asserts "no-hero playthrough reaches Div 3 by season 4"
  ([docs/04-superpowers.md](../../04-superpowers.md)). Nothing in the economy/balance needs to change to allow a 0-hero start.
- License cap at Div 5 start is **2** (unchanged). You own 0 heroes to begin; the created player
  becomes hero #1; a later awakening gives hero #2 and fills the 2 slots.

## The opening sequence (the design)

1. **Create "YOU."**
   - Choose a **name** for the player.
   - Spend a **bounded pool of points** across the **6 visible stats** (doc 05). The player may
     specialize (min/max) or balance.
   - **Bound the pool so the result ≈ "a decent 5th-division player"** — never a min/maxed monster.
     Creation shapes *flavor, not power tier*. This is a hard constraint: the balance harness
     assertions (no-hero Div-3-by-S4, bankruptcy rate, etc.) must still pass with any legal
     allocation. Pick a pool + per-stat caps such that total starting quality lands inside the
     normal Div-5 outfielder distribution.
   - Body-type / look customization is **deferred** (M4 paper-doll). If a body-type pick is trivial
     to add it may be included as cosmetic flavor, but it MUST NOT affect the first awakening
     (see tutorial exception below).

2. **Match 1 — no powers.** Ordinary pixel soccer. The created player is a normal, decent player.
   This establishes the baseline. (May be presented as a short tutorial match; not required.)

3. **The collapse (live climax, final whistle of match 1).** The created player collapses on the
   pitch — staged to *look* like a horrible accident / medical emergency, delivered as a
   spectacle-camera cut-in.
   - **Tone guard (non-negotiable):** keep it a beat of panic that turns quickly to wonder/comedy.
     Cozy pillar + "never grimdark, never sarcastic at the player's expense" (doc 01). Do NOT linger
     on medical dread. The referee-with-a-fire-extinguisher register.

4. **The 3-choice event (the ownership beat).** The player is offered three ways to "help" the
   collapsed player. Each option secretly *is* the awakening trigger — the player thinks they are
   giving first aid; they are actually choosing an origin story. The reveal is the joke.
   - 💧 **Give him water** (something is floating in it) → **Chemical** origin
   - 🪲 **Put him on the stretcher** (a weird insect is on it) → **Creature-bite** origin (the "spider")
   - 💊 **Listen to the on-pitch doctor** (prescription bottle in hand) → **Serum** origin

5. **Awakening (guaranteed, 1 of 6).** The choice picks the origin's **themed power pair**; a
   **50/50 seeded coin flip** picks which of the pair's two powers the player gets. **Guaranteed to
   awaken** — there is no empty outcome (this is the tutorial; the normal risk/pity system does not
   apply here).
   - **TUTORIAL EXCEPTION (owner decision):** the awakened power is decided by the *choice + coin
     flip*, NOT by the player's stats/body-type. This is a deliberate, documented exception to
     doc 04's "which power a player awakens is weighted by their stats and body type." **Every
     subsequent awakening uses the normal stat-weighted 'fitting' rule** — only the first,
     scripted, tutorial awakening is choice-driven. Do not change the general awakening system.

6. **Match 2 onward — the real game.** First tap-a-power match. The created player is now hero #1,
   on a **locked rookie wage** (bargain hero) until contract renewal, at which point his agent
   demands the ×3–5 hero wage — this is exactly the **wage-cliff** M1 exists to test, now delivered
   by the player the user built. Normal loop proceeds; a later awakening produces hero #2.

## Starter power tier (content)

Introduce a **"starter" tier** tag on powers: "good but not the best," explicitly excluding
legendary (★, e.g. Time Skip). Six starter powers, grouped into the three origin pairs.

**Tentative mapping** (final launch set is an M4 playtest call per doc 04; this is a starting
point, not locked). Chosen to lean on the **three powers already implemented in M0** (⚙) so M1
writes minimal new power code:

| Origin (choice) | Power pair (50/50) |
|---|---|
| 💧 Chemical (water) | **Super Speed ⚙** / Ice Rink |
| 🪲 Creature (insect) | **Fire Torch ⚙** / Web Trap |
| 💊 Serum (doctor) | **Super Strength ⚙** / Thunder Strike |

The insect→Fire Torch line is vision-canon ("someone gets bitten … bursts into flame").

**M1 minimum viable content:** M1 MAY ship with only the three already-built ⚙ powers as the
starter set (one per origin, coin flip collapses to that one), and add the second-of-each-pair
(Ice Rink, Web Trap, Thunder Strike) later. If M1 ships the full 6, the 3 new powers must be
implemented + covered by the timing-value/balance harness like any power. **This is a scope lever
for the M1 orchestrator to decide** based on remaining budget.

## What M1 must build (minimal)

- **Character-creation screen**: name entry + bounded point-buy over the 6 stats. Persisted in the
  save (sqlite + migrations — already an M1 deliverable).
- **Scripted onboarding sequence** wiring: normal match 1 → collapse cut-in → 3-choice event →
  guaranteed awakening (choice + seeded coin flip, one of the available starter powers) →
  hero #1 exists → match 2.
- **Starter-tier tagging** in power content JSON (zod-validated, like all content).
- **Onboarding event content** (collapse text, 3 choices, per-origin awakening reveal text) in the
  punchy/silly tone. New content ships as data, not code.
- The created player enters the roster on a **locked rookie wage** so the wage-cliff renewal fires
  later (reuses existing awakened-wage-lock mechanic; no new economy rule).

## Constraints / must-not-break

- **Determinism:** the onboarding awakening's coin flip consumes the injected seeded PRNG
  (mulberry32) — no `Math.random`. Same seed + same choice ⇒ same power. If this touches
  `src/sim` RNG consumption, `ENGINE_VERSION` bumps and the golden replay regenerates in the same
  commit (project rule).
- **Balance harness stays green:** any legal point-buy allocation must keep all doc-09/doc-04
  assertions passing (no-hero Div-3-by-S4, bankruptcy rate, TP affordability, awakening cadence).
- **General awakening system unchanged** — only the first awakening is the documented tutorial
  exception. Stat/body-type weighting still governs all later awakenings.
- **Tone guard** on the collapse (above).

## Decision record (this brainstorm, 2026-07-18)

- Start with **0 heroes**, not 1 or 2. (2 was an M0 match-test setup, not a campaign decision.)
- Opening = **create-a-player avatar** (name + bounded point-buy) for ownership.
- First awakening = **collapse cut-in + 3-choice event**, hybrid of "live climax" and "player
  choice." Each choice hides a superhero-origin trigger.
- Awakening is **guaranteed**; **1 of 6** powers (3 origin pairs × 50/50). Randomness is *which
  power*, never *whether*.
- Power source for the first awakening = **choice + coin flip (tutorial exception)**; later
  awakenings keep the **stat-weighted "fitting"** rule.
- Starter tier favors the **3 M0-built powers** to minimize M1 build cost; full 6 vs. 3 at M1 is a
  scope lever.

## Deferred (YAGNI — not M1)

- Final locked 6-power starter list (M4 playtest decides launch set).
- Paper-doll look customization / body-type-at-creation as anything more than cosmetic (M4).
- Any change to the general (non-tutorial) awakening, wage, or license systems.
