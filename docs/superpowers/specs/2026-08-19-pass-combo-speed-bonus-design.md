# Pass Combo Speed Bonus — design

Date: 2026-08-19
Status: awaiting owner review (revised after Grok review rounds 1–3)
Branch: `claude/pass-combo-speed-bonus-2e11d4`

## Problem

The pass combo counter already pops "x2", "x3", "x4" over the receiver's head.
It is pure decoration. It counts something the player is doing well and gives
nothing back for it.

Make a passing move *feel* like momentum: while a team is stringing passes
together, the players building that move run faster.

## The one fact that shapes everything

**The pass chain does not exist in the sim today.** It lives entirely in the
render ring — `src/render/pass-combo.ts` counts ball-state transitions per tick
inside `MatchScreen` and writes nothing back to `MatchState`.

A speed bonus is not decoration. It changes movement, so it changes results.
That forces four things:

1. The chain becomes authoritative sim state on `MatchState`.
2. `ENGINE_VERSION` bumps (`m2.4` → `m2.5`).
3. Both runtime golden fingerprints **and** the parity-replay snapshot are
   regenerated as a deliberate act.
4. The balance rails in `src/sim/__tests__/balance-rails.test.ts` must stay green.

The render ring stops deriving the chain and starts reading it. That is a net
deletion of render logic, not an addition.

## Behaviour

### Who gets the bonus

**Only the players who touched the ball in the current chain.** Both ends of
every completed pass join: the passer and the receiver. A player who joined
earlier in the chain stays in for the rest of it.

Not the whole team. An off-ball runner who never receives the ball gets
nothing. This is the owner's call (2026-08-19) and it is the better one — the
buff is legible, the trail can tell the exact truth about who is fast, and the
balance blast radius shrinks — a typical chain buffs four or five players rather
than all eleven.

The keeper joins like anyone else, by touching the ball. The opposing team never
joins.

**A live Decoy clone is a first-class member.** Clones are real entities at
indices 22 and 23 (`HOME_DECOY_INDEX` / `AWAY_DECOY_INDEX`), they can be passed
to and pass onward, and `speedFor128` already accepts them. They are **not** in
`state.players[0..21]`, which is what killed the slot-mask design in the first
draft — see the membership section below.

A chain can involve up to eleven players plus a clone: five passes to five new
teammates is six people, and a long chain can reach the whole side. Membership is
never capped.

### Tier ladder

Each completed pass in a chain snaps every member's bonus **up** to the tier
value for the new chain length. It never snaps down.

| Chain length | Bonus | `tierD` |
|---|---|---|
| x2 | +2% | 200 |
| x3 | +4% | 400 |
| x4 | +10% | 1000 |
| x5 | +15% | 1500 |
| x6 and above | +20% | 2000 |

x7, x8, x9 all re-snap to +20%. The ladder holds flat above 6.

A chain at x1 grants nothing. The pop already starts at x2
(`PASS_COMBO_FLOOR`), and the bonus starts where the pop starts.

### Decay

Each member's bonus falls **linearly to zero over exactly 3 seconds** — 30 ticks
at `TICK_MS = 100`.

The bonus is not stored. It is **derived from a countdown**:

```
bonus (ten-thousandths) = floor(tierD * comboTicks / 30)
```

`comboTicks` starts at 30 on a snap and drops by 1 per tick. At `comboTicks = 0`
the bonus is exactly 0, for every tier, with no rounding remainder.

This replaces the `ceil(tier / 30)` shed rate from the first draft, which Grok
correctly showed expires x2 and x3 at 29 ticks rather than 30.

### Snap-up, including across a break

`snapUp(p, tier)`:

```
if (tier > comboBonus(p)) { p.comboTierD = tier; p.comboTicks = 30; }
```

**Nothing happens when the new tier is lower than the member's live bonus.**
This is the rule that makes leftovers behave. A member decaying at +18% from a
broken x6 chain, caught by a fresh x2, keeps +18% *and* keeps the x6 countdown.
The alternatives are both wrong: overwriting `tierD` down to 200 either snaps
the speed down visibly, or stretches an 18% bonus across the x2 decay rate and
leaves a ~25s ghost.

Within a chain the tier only rises, so this is a plain assignment in the common
case.

### Breaks

Two different endings, on purpose.

**In-play break** — failed pass at launch, loose arrival, interception, won
tackle, save. Both chains end: `count` goes to zero and the chain id advances,
which drops every member at once. Each ex-member's countdown keeps running. An
instant drop would be a visible speed snap mid-play, and taking the surge away
in the same instant as the ball is a double punishment the player never asked
for.

**Dead-ball reset** — kickoff, goal, **miss**, half time, match start. All five
route through `restartKickoff`, which already teleports every player and clears
possession bookkeeping. It also zeroes count, advances both chain ids, and
zeroes `comboTierD`/`comboTicks` on every entity outright. Play has stopped;
carrying a surge across a teleport would read as a kickoff bug.

A miss is a dead-ball reset, not an in-play break: `shotFlightTick` calls
`restartKickoff` on it (`engine.ts` ~2325).

**A completion by one team ends the other team's chain.** There is one ball, so
two live chains are nonsense — and today's render chain already behaves this way
(`passComboAfter` resets to 1 when the team changes). Without this, team A could
hold count 4 through a loose-ball turnover with no break event, then jump to x5
on one more pass.

## Sim implementation

### State

Three integers per player, in `SimPlayer` (`src/sim/types.ts`):

```ts
/** Tier of the live pass-combo speed bonus, in ten-thousandths (2000 = +20%). */
comboTierD: number;
/** Ticks left on that bonus, counting 30 down to 0. Bonus is derived, not stored. */
comboTicks: number;
/** Id of the last pass chain this entity touched the ball in. 0 = never. */
comboChainId: number;
```

with one helper in `engine.ts`:

```ts
export function comboBonusD(p: SimPlayer): number {
  return Math.floor((p.comboTierD * p.comboTicks) / PASS_COMBO_DECAY_TICKS);
}
```

**Integer fixed-point.** Ten-thousandths give +0.01% resolution, far finer than
the 1% steps the ladder uses, and the countdown keeps every intermediate value
an exact integer. This is not because floats are absent from the movement path —
`speedMultiplier` already returns floats such as `2.3` for Super Speed. It is
because a *derived, decaying* value is exactly the kind of accumulator that
drifts, and this one is read every tick by every mover.

One field per team, in `MatchState`:

```ts
/**
 * Live pass chain per team. `count` is the run length; `chainId` names the
 * current chain so entities can record which one they touched the ball in.
 * Sim-authoritative — the render ring reads this instead of counting events.
 */
passCombo: [PassComboChain, PassComboChain];
```

```ts
export interface PassComboChain {
  count: number;
  /** Monotonic, starts at 1. Advancing it ends the chain and drops every member. */
  chainId: number;
}
```

### Membership: a chain id, not a mask

An entity is a member of team T's live chain when
`p.comboChainId === state.passCombo[T].chainId`. Joining is one assignment.

**Every path that ends a chain goes through one function**, and the increment is
the load-bearing half:

```ts
function endChain(state: MatchState, team: 0 | 1): void {
  state.passCombo[team].count = 0;
  state.passCombo[team].chainId += 1; // monotonic — never reset, never reused
}
```

Every member is dropped at once, without touching them, so their countdowns keep
running.

**`chainId` is an epoch, and a live entity may still hold an old one.** This is
the trap. Substitutes and fresh clones are new objects starting at 0, but
`restartKickoff` teleports *the same 22 `SimPlayer`s* — their `comboChainId`
survives the restart. If half time only zeroed `count` and the bonuses and left
`chainId` at 1, every member of the first chain of the first half would still
match, and the first two completions after the restart would lift all of them
without a touch. That is the stale-member bug coming back through the front
door.

So: chain ids only ever go **up**. Never assign 0 to a live chain, never set one
back to 1, and never "reset" one — increment it.

`endChain` is called on:

- an in-play break — **both** teams
- a completion by one team — the **other** team (the easy place to write
  `count = 0` and forget the increment)
- `restartKickoff` — **both** teams, alongside the walk that zeroes
  `comboTierD`/`comboTicks` on all 22 players and both clone slots

Calling `endChain` on an already-idle team is cheap and safe. A double break — a
failed pass at launch, then its arrival — increments twice and is harmless.

**The first draft used an 11-bit slot mask and that was a correctness bug.**
Decoy clones are entities 22 and 23, outside `state.players[0..21]`; eleven bits
cannot name them. The obvious patch, `1 << (idx % 11)`, marks the *keeper*
(`22 % 11 = 0`), and going through `formationSlotForEntity` marks the *copied
forward* — both players who never touched the ball, while the clone that did
gets nothing.

A chain id has none of that. It is entity-agnostic, so it works for slots 0–21
and clones alike.

It also deletes two clearing hooks the mask design needed. Chain ids start at 1
and every `SimPlayer` literal starts `comboChainId` at 0, so a fresh entity can
never match a live chain:

- `performSubstitution` needs no bit-clearing line — the substitute is a new
  object at 0.
- `dismissDecoyClone` needs none either. A popped clone taking its bit to the
  grave, and a later clone on the same team inheriting it, is a bug that cannot
  be written here.

**Why not "everyone with a live bonus"?** Reusing `comboTicks > 0` as the member
set is tempting and wrong: a player still decaying from a *previous* chain would
be swept into the new one and lifted when it reached x5, without ever touching
the ball. The chain id is what separates them.

**Enumeration is already written.** `activeTeamPlayerIndices(state, team)` in
`src/sim/entities.ts` yields that team's eleven slots plus its clone when one is
live. Export it (it is currently module-private) and filter on `comboChainId`.
Do not hand-roll an entity loop.

### The three construction sites

`tsc` forces the three new fields into every `SimPlayer` literal. There are
**three**, not two:

1. `makePlayers` (`src/sim/match.ts`)
2. `performSubstitution` (`src/sim/substitutions.ts` ~43)
3. **the Decoy clone literal** (`src/sim/powers.ts` ~1612) — the one the first
   draft missed

All three initialise to `comboTierD: 0, comboTicks: 0, comboChainId: 0`.

### Where the hooks go

The tick order is in `src/sim/match.ts` (**not** `engine.ts`), currently:

```
powerTick → movementTick → possessionTick → tackleTick → shotFlightTick → observePossession → half-time
```

Decay becomes an explicit line in `tick()`, between `movementTick` and
`possessionTick`:

```ts
movementTick(state);
decayPassCombo(state);   // new
possessionTick(state);
```

Placing it *after* movement is deliberate. A snap in `possessionTick` on tick T
sets `comboTicks = 30`; movement on tick T+1 then runs at the full tier before
the decrement. Putting decay first would mean the full tier value never moved
anybody. A visible line in `tick()` beats burying it inside `movementTick`,
because `movementTick` is called directly by tests.

The seven hooks, in full:

| # | Site | Action |
|---|---|---|
| 1 | `createMatch` (`match.ts`) | init `passCombo` to `[{count:0,chainId:1},{count:0,chainId:1}]`, before `restartKickoff` runs |
| 2 | `tick()` (`match.ts`) | call `decayPassCombo` after `movementTick` |
| 3 | `possessionTick` pass arrival (`engine.ts` ~1546) | **extend** on a clean catch; **break** on anything else |
| 4 | `launchPass` when `ok === false` (`engine.ts`, includes Gust) | break at the kick, not the catch |
| 5 | won `TACKLE` (`engine.ts`) | break |
| 6 | `SAVE` (`engine.ts`) | break |
| 7 | `restartKickoff` (`engine.ts`) | break both chains, and zero `comboTierD`/`comboTicks` on all 22 players **and both clone slots** |

Hook 7 covers goal, miss, half time and match start — every one of them routes
through `restartKickoff`, including the half-time path in `match.ts:551`.

`decayPassCombo` must visit clones too. A loop over `state.players` never sees
entity 22 or 23:

```ts
const PASS_COMBO_DECAY_TICKS = 30;

export function decayPassCombo(state: MatchState): void {
  for (const p of [...state.players, ...state.decoyClones]) {
    if (p === null || p.comboTicks === 0) continue;
    p.comboTicks -= 1;
    if (p.comboTicks === 0) p.comboTierD = 0;
  }
}
```

### Chain extension

At the pass-arrival branch where `state.ball = { kind: 'held', by: targetIdx }`
and `intercepted` is computed:

**Clean catch** is this predicate, and nothing looser:

```ts
!b.looseOnArrival &&
  !b.gustRedirect &&
  !intercepted &&
  isAvailable(state, targetIdx) &&
  requirePlayerAt(state, targetIdx).team === requirePlayerAt(state, b.from).team
```

On a clean catch: end the other team's chain, `count += 1`, set
`comboChainId` on `b.from` and `targetIdx`, then — **only if `count >= 2`** —
`snapUp` every member to `TIER_D[Math.min(count, 6)]`.

Anything else breaks both chains.

Three traps here, all of which the earlier drafts fell into:

- **`b.gustRedirect` must be read explicitly.** Gust sets `ok: false` (so hook 4
  breaks the chain at the kick) but leaves `willSucceed: true` with `b.to`
  rewritten to a keeper. When that keeper is on the passer's own side, a
  same-team-intended-man test re-extends the chain that was just zeroed.
  Inferring "redirect" from a team mismatch does not catch it.
- **No `snapUp` at `count === 1`.** `TIER_D` starts at x2; indexing it at 1 is
  `undefined`. A first pass records membership and grants nothing.
- **`intercepted` alone is not enough.** `looseOnArrival` and a receiver knocked
  out between kick and catch both land the ball somewhere other than the
  intended man, and both are completions under the first draft's test.

`b.from` is on the in-flight `pass` ball state, so the passer is in hand at the
completion point with no extra bookkeeping. Both ends of the pass join, which is
why a chain's first passer is a member rather than only its receivers.

### Speed application

`speedFor128` in `engine.ts` is the single funnel every movement consumer routes
through:

```ts
function speedFor128(state: MatchState, idx: number): number {
  const p = requirePlayerAt(state, idx);
  return Math.round(
    (conditionedPaceSpeed128(state, idx) *
      speedMultiplier(state, idx) *
      (10000 + comboBonusD(p))) /
      10000,
  );
}
```

One multiplication covers carrier, off-ball, presser and chaser without touching
any call site.

**On composition, precisely.** `conditionedPaceSpeed128` folds in condition, and
`speedMultiplier` folds in power effects — both inside `speedFor128`. Energy use
is **not** in here: `movementTick` applies `energyMovementMultiplier` at its own
call site, and only to off-ball players, while the carrier gets
`speedFor128 * CARRIER_SPEED_SCALE`. Putting the combo bonus inside
`speedFor128` therefore reaches both, and energy still stacks on top for
off-ball movers. (The first draft described this as "the same composition rule
condition and energy already use" — that was wrong about energy.)

The bonus multiplies with power multipliers rather than adding. A Super Speed
hero at +20% runs at `2.3 × 1.20 = 2.76×` — that is the *floor* grade;
`anchoredEffect(grade, 2.3, 2.65, 3)` goes higher.

The ball carrier is a member, so the bonus lands on top of `CARRIER_SPEED_SCALE`
(0.37): a pace-90 carrier's dribble goes from 48 to 58 units/tick at +20%.

Slide tackles (`SLIDE_TACKLE_SPEED_MULTIPLIER`) and pressing inherit it through
`speedFor`. See the fallback lever in Balance below — this is the first thing to
cut if the rails move.

Explicitly **not** applied to: pass speed (`PASS_SPEED`), shot flight, or ball
physics. This is a player-movement bonus.

## Render implementation

### Chain readout

Delete the chain derivation from `MatchScreen.tsx` (~1940–1998). Replace it with
a per-tick read of `s.passCombo[team].count`, **inside the catch-up
`while (acc >= TICK_MS)` loop**. One frame can advance several ticks, and a
post-loop drain would let an earlier break undo a later extend — which is the
defect the existing wiring tests were written to catch. Fire the pop on the tick
the count reaches `PASS_COMBO_FLOOR` or above.

**Which team's count to read:** the one that *increased* this tick. Compare both
teams' `count` against the previous tick's values; at most one can rise, because
only one completion happens per tick. That side owns the pop, the SFX crossings
and the trail.

`src/render/pass-combo.ts` keeps its glyph, scale, opacity and rise functions.
`passComboAfter`, `PassComboChain`, `PassComboInput` and `PASS_COMBO_IDLE` are
deleted. (The sim's own `PassComboChain` is a different shape in
`src/sim/types.ts`; the render type is removed, not moved, so there is no name
clash.)

`src/render/__tests__/pass-combo.test.ts` is rewritten, not trimmed. It has
**source-grep wiring assertions** — `expect(tickLoop).toContain('passComboAfter')`
at line 116, plus `toContainSource("if (s.ball.kind === 'pass') {")` — that go
red the moment the derivation is deleted. Replace them with greps for the new
sim read.

### Audio

Two new keys in `SFX_SOURCES` (`src/render/audio.ts`), each fired **once per
chain** at its own threshold:

| Key | Source | Fires |
|---|---|---|
| `pass-combo-epic` | `epic_dramatic_movie__#1.wav`, 2.00s, 48kHz stereo | on the 4th completed pass, once |
| `pass-combo-surge` | `cuban.webm`, 3.03s, Opus 48kHz stereo | on the 5th completed pass, once |

x6 and above keep the existing pitched `pass-combo` pip alone. One hit per
threshold keeps each one dramatic, and it stops a 3s file overlapping itself.
"Once per chain" is tracked off the sim count crossing 4 and 5 — the same
crossing test the pop uses, in the same catch-up loop.

**Conversion follows the SFX convention, not the music one.** `audio.ts`'s
header states supplied effects are **24 kHz mono AAC-LC `.m4a` with silent tails
trimmed**. Do **not** use the `/convert_music` skill — that produces 40s /
64 kbps stereo music. After the files land in `assets/audio/sfx/`, run
`npm run audio:levels` to write their entries into `scripts/audio/levels.json`,
then `npm run audio:levels:check` to verify. No `scripts/audio/catalog.mjs`
entry: that catalog drives the procedural `gen-sfx.mjs` fixtures, and today's
`pass-combo` is not in it either.

The `full` audio profile picks both keys up automatically —
`audioKeysForProfile('full')` returns every key in `SFX_SOURCES`. No
showcase-profile entry.

### x5 afterimage trail

At x5 and above, every **chain member** draws the Super Speed afterimage trail.

Gate: `comboTierD >= 1500 && comboTicks > 0`. Reading the tier is what keeps the
trail on through the decay after a break, and it needs no extra field: a tier of
1500 or 2000 can only have come from x5 or above. Gating on the bonus being
non-zero would light the trail on x2, and gating on `count >= 5` would kill it
the instant the chain broke.

**Ghost count drops from 6 to 3 per member** (owner call, 2026-08-19). Worst
case is a chain that has touched the whole side: 11 members × 3 = **33 extra
atlas sprites**, plus a clone. Typical is four or five members, so 12–15.
Against 66 for a team-wide 6-ghost trail, that is the cost the owner asked for.
No ring buffer and no adaptive shortening — the boring implementation wins.

**Ghosts and stored points are not the same number.**
`superSpeedAfterimageActors` does `trail.slice(1, 1 + ghosts)`, so *n* ghosts
needs *n + 1* stored points. Store **7 points per entity** — today's length, and
cheap — and vary only the emitted count. Storing 3 would give 2 ghosts and would
silently shrink the hero power.

Four concrete changes, all of which the earlier drafts missed:

1. **`trailRef` has two consumers, not one.** `MatchScreen.tsx:3344` feeds the
   atlas actors, and `MatchScreen.tsx:3966` draws a separate `<Circle>` overlay
   off the same array. Both must be rewritten for per-entity trails, or the
   Circle path silently draws a second set.
2. **`superSpeedAfterimageActors` hardcodes `trail.slice(1, 7)`.** Give it a
   `ghosts` parameter defaulting to 6, so the hero power is unchanged when
   nothing passes one.
3. **Length depends on why the trail is drawn.** Combo member → 3 ghosts. Live
   Super Speed hero → 6. An entity that is both → **6**, and one trail, not two.
   The power outranks the combo; it is the bigger effect.
4. **Size the store for 24 entities, not 22.** `RENDER_PLAYER_COUNT` is
   `BASE_PLAYER_COUNT + 2`, and a clone can be a member.

`trailRef` changes from one shared 7-point history to
`Array(RENDER_PLAYER_COUNT)` of 7-point histories, written in place each tick —
168 points total, cheap enough not to optimise. Restarts already clear
`trailRef` on the snap path (~2713–2716); keep that.

Gate on `suppressCosmeticEffects` (which is `reduceMotion || reducedEffects`),
not `reduceMotion` alone — that is what already governs the hero trail.

### Portal Pass is deliberately neutral

`portalPass` moves the ball to a teammate without going through `launchPass`.
It neither counts as a completed pass nor breaks the chain: the count is
preserved across the hop, and the receiver joins only when they complete their
next pass. A portal is not a pass and not a turnover, so neither treatment fits,
and preserving the count keeps the move alive — which is what it looks like on
screen. (Raised by the Fable audit, 2026-08-19.)

## What does not change

- **No new copy, in any language.** The pop draws "x4" from the existing 3×5
  pixel face. No `content/` prose, no `content/i18n` keys, no coverage floors
  move. The seven-locale rule has nothing to bite on here.
- **No new match events.** The chain is state, not an event stream.
- **No save migration.** `MatchState` is never persisted — replays store a
  `ReplayEnvelope` of seed plus inputs and rebuild state by re-running the
  engine. No codec change.
- **Quick Result** resolves identically to a watched match: it is `runMatch`
  over the same `tick()`, and the bonus has no input dependency.

## Testing

### Sim, headless and deterministic

`src/sim/__tests__/pass-combo-speed.test.ts` (new):

1. **Tier ladder** — chain lengths 2..7 snap members to 200, 400, 1000, 1500,
   2000, 2000.
2. **Membership** — after `A → B`, only A and B carry a bonus; a teammate who
   never touched the ball is at 0.
3. **Decay is exactly 30 ticks to zero from every tier**, including 200 and 400.
4. **Full tier moves somebody** — the movement step on the tick after a snap
   runs at the undecayed tier. After that whole `tick()` completes,
   `comboTicks === 29`; assert the movement, not the post-tick counter.
5. **In-play break** (won tackle) zeroes `count` and advances both chain ids,
   and leaves the countdown running.
6. **Loose arrival and knocked-out receiver break the count** — not treated as
   completions.
7. **Failed pass at launch** (`PASS ok:false`) breaks at the kick.
8. **Same-team Gust arrival leaves `count === 0`** — the redirect must not
   re-extend the chain hook 4 just broke.
9. **`SAVE` breaks the count.**
10. **`restartKickoff` breaks both chains and zeroes tier and ticks on every
    entity including clones** — checked for a goal, a miss, and half time.
11. **Other-team completion ends the previous team's chain**, and does not start
    the new team at 1 from stale membership.
12. **Leftover after a break does not snap down** — x6, break, then a fresh x2:
    the member keeps the higher bonus *and* the x6 countdown.
13. **Stale decayer is not lifted** by the next chain reaching x5.
14. **Clone membership** — `A → clone → B` puts a bonus on exactly those three
    entities. Not on the keeper (the `22 % 11` trap), not on the copied source
    forward (the `formationSlotForEntity` trap), not on the Decoy owner unless
    they touched the ball.
15. **`count === 1` grants nothing** and does not index `TIER_D` out of range.
16. **Speed** — `speedFor128` for a +20% member is exactly `round(base * 1.20)`;
    a non-member teammate and every opponent are unchanged. Assert through
    `speedFor128` (exported for this) rather than `speedFor`, whose second
    `Math.round` makes a `× 1.20` comparison flake by ±1.
17. **Substitute** entering mid-decay reads 0 and is not a member.
18. **Half-time id reuse** — build a chain in the first half, let
    `restartKickoff` run, then complete two passes in the second half between
    two *different* players. Nobody from the first-half chain is snapped. This
    is the epoch test: it fails the moment `endChain` zeroes a count without
    incrementing the id.
19. **Other-team completion increments** — team A at x4, team B completes one
    pass. A's `chainId` has gone up and A's old members are no longer members;
    B's count is 1 with exactly the two players from that pass.
20. **Determinism** — two full matches from the same seed and input log produce
    byte-identical event streams. This assertion goes in the new file.
    **Do not touch `determinism-guard.test.ts`** — that file is a static regex
    ban on `Math.sin`, `Date.now` and friends, not a two-run identity check.

### Balance

`npx jest src/sim/__tests__/balance-rails.test.ts` must stay green on both
rails: normal goals/match `[1.5, 4.0]`, shots/match `[8, 40]`, saveRate
`[0.55, 0.90]`; blowout strong goals/match `< 9`, p95 margin `≤ 9`, p99 `≤ 11`.

This is the real risk, and the loop is wider than "faster → more passes":

- Pressers and sliders get it through `speedFor`, so the side that just lost the
  ball still closes faster while its bonus decays.
- `carryExpectedValue` (~1280) reads `speedFor`, so combo members will choose to
  dribble more.
- Faster steps trip the `dist2 > 6400` `movedFar` test more often, raising
  stamina drain. That is a natural limiter — measure whether it is enough.

Record before/after goals/match, shots/match, saveRate, **and** mean chain
length plus time spent at each tier, in the PR body.

**Fallback levers, in order.** First: stop applying the bonus to the presser and
to slide tackles. That keeps "a passing move feels like momentum" intact and
cuts the recovery loop directly. Only if that is not enough, halve the ladder
(1/2/5/7.5/10%). Shortening the decay window is the *last* resort — a 2s window
makes x2 and x3 invisible before it makes anything safe.

### Golden replays and parity

Three baselines move, not two. All three must be regenerated in the same commit
as the `ENGINE_VERSION` bump to `m2.5`:

1. `EXPECTED_RUNTIME_GOLDEN` (seed 42) in `src/sim/runtime-golden.ts`
2. `EXPECTED_GOAL_GOLDEN` (seed 81) in the same file
3. The `src/sim/__tests__/parity-replay.test.ts` snapshot — full events plus
   position fingerprints at ticks 500/1000/1500/2000. A movement change moves
   every one of them.

**The goal golden carries a second contract** the fingerprint does not: the test
asserts seed 81 still produces at least one assisted *and* one unassisted goal,
and stamps `scoredById` on every goal. If the bonus pushes seed 81 to
all-assisted goals, rebaseline onto a seed that keeps both kinds rather than
weakening the test.

### Render

- `pass-combo.test.ts` — rewrite the source-grep wiring cases; keep the glyph and
  animation cases.
- `audio-profile.test.ts` — add `pass-combo-epic` and `pass-combo-surge`.
- `live-power-effect-actors.test.ts` — cover the new length parameter, including
  that the default still yields today's 6 ghosts.
- `npx tsc --noEmit` covers the three new `SimPlayer` fields reaching all three
  construction sites: `makePlayers`, `performSubstitution`, and the Decoy clone
  literal in `powers.ts` ~1612.

## Build order

1. `comboTierD` / `comboTicks` / `comboChainId` on `SimPlayer`, `passCombo` on
   `MatchState`, initialised in `createMatch` and all **three** `SimPlayer`
   literals — `makePlayers`, `performSubstitution`, and the Decoy clone in
   `powers.ts`. Export `activeTeamPlayerIndices`. Type-only, no behaviour.
   `tsc` green.
2. The seven hooks, `endChain`, and `decayPassCombo`. Tests 1–3, 5–15, 17–19.
3. The multiply in `speedFor128`. Tests 4, 16, then the balance rails, then
   `ENGINE_VERSION` + both goldens + the parity snapshot. Test 20.
4. `MatchScreen` reads sim state; delete `passComboAfter`; rewrite the wiring
   tests.
5. `pass-combo-epic` and `pass-combo-surge` assets, 24 kHz mono AAC-LC
   conversion, `audio:levels`, and the two once-per-chain triggers.
6. Member afterimage trail at 3 points: parameterize
   `superSpeedAfterimageActors`, rewrite both `trailRef` consumers, dedup the
   hero.

Steps 1–3 are the feature. Steps 4–6 can each ship separately if a rail forces a
retune.

## Open risk

The compounding loop in Balance is the one thing that could sink this. The
fallback ladder above is the plan; the ordering matters more than which lever
gets pulled.

## Review record

Grok round 1 (grok-4.6, high effort) returned REVISE against the first draft.
Seven findings accepted and folded in: the `ceil` decay error, the undefined
snap-up rule after a break, the trail gate, the missing hook list and other-team
count, the parity-replay snapshot, the `speedFor128` composition wording, and
putting pop/SFX detection inside the catch-up loop. Its four checkable claims
about this repo — tick order in `match.ts`, the second `<Circle>` consumer of
`trailRef`, the source-grep wiring tests, and the 24 kHz mono SFX convention —
were each verified in the code before acceptance.

Grok round 2 returned REVISE against the per-player draft and found a real
correctness bug: **an 11-bit slot mask cannot name a Decoy clone**, which lives
at entity 22/23 outside `state.players`. The obvious `idx % 11` patch marks the
keeper and the copied forward instead. Also accepted: the same-team Gust
re-extend, `TIER_D` indexed at `count === 1`, the third `SimPlayer` literal in
`powers.ts`, `decayPassCombo` skipping clones, storing 3 trail points while
emitting 6 ghosts, miss being a dead-ball reset rather than an in-play break,
and test 18 naming the wrong file. Its claims about entity 22/23, the clone
literal, `determinism-guard.test.ts` being a static regex ban, the Gust
`willSucceed` path, and miss calling `restartKickoff` were each verified in the
code before acceptance.

Grok offered a 12-bit mask or an entity-index list as the membership fix. This
plan takes neither: a **chain id** is entity-agnostic and additionally deletes
the substitution and `dismissDecoyClone` clearing hooks that both of Grok's
options require.

One Grok round-1 suggestion was **not** taken: it proposed team-level combo
state. The owner narrowed the bonus to chain members after that review was
requested, so the state is per-player.
