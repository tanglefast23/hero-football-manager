# Heat → ARMED → FIRE: simplifying hero power activation

**Date**: 2026-08-20
**Owner decision**: Joe, this session
**Engine**: m2.7 → **m2.8** (replay-affecting)
**Status**: revision 7, after Codex round 4. Fable APPROVED. Grok conditionally
approved. Codex's round-4 blockers are all applied below; the owner authorised
implementation to begin after this round.

---

## Why

A manager watched a hero's Heat bar reach 100% and nothing happened. No fire
button, no explanation, for minutes. The bar was not lying — the hero was
genuinely at full Heat. What was missing was the power's *authored setup*, a
second hidden gate the player cannot see, cannot influence, and was never told
about.

That gate is `zoneEntryContext` ([powers.ts:292](../../src/sim/powers.ts)).

The fix is to delete the hidden gate and make the visible bar mean what it looks
like it means: **full bar = armed = a button you can press.**

## What is NOT changing

- Heat sources and payouts (shot 20, save 30, tackle won 18, …).
- The 3-Zones-per-hero cap, and Rally Cry's encore fourth.
- Wind-up, active windows, interruption, every power's own effect.
- AUTO firing at 85% (`CONTEXT_AUTO_STRENGTH`) on `inUsefulContext`.
- The on-pitch power ring and the FIRE flash, both shipped earlier today.
- **Uncommitted work from this session is already in the tree.** Edit those
  hunks; never reset or overwrite them: `hero-power-dock.ts`,
  `HeroPowerRings.tsx`, `HeroPowerDock.tsx`, `MatchScreen.tsx`,
  `MatchControlRail.tsx`, `hero-power-dock.test.ts`, and all seven locale files.
  *(List completed by Codex, round 3.)*

## What the outfield Heat bar already does right

`heatFraction` is `gauge / 60` clamped to 1 ([match-rail.ts:49](../../src/render/match-rail.ts)).
For an outfield hero a full bar already reads 100%, and the raw `60` is never
shown. That half needs no change. **Keepers are a different story — see change 2.**

---

## Player-facing vocabulary

| Player sees | Engine state | Means |
|---|---|---|
| `(LOADING)` | `powerState.kind === 'idle'` | Heat building. Bar shows how far. |
| `(ARMED)` | `powerState.kind === 'zone'` | Bar full. Button up. Waits forever. |
| button `FIRE!` | `zone` + `inUsefulContext` | The moment is live. Press = 100%. |
| button `ARMED` | `zone`, no context | Pressable, risky. Press starts the drain. |
| button `HOLD` | `zone`, ball upfield (save powers) | Not pressable. Not a fault. |
| draining button | `powerState.kind === 'armed'` | Press committed. Window running. |

**Vocabulary collision, on purpose.** The engine's `armed` means "press
committed, window draining". The player's ARMED means "bar full, button up".
Renaming the engine state would touch replay codecs, snapshots and types for no
player benefit. This table is the mapping; every doc uses the player column.

---

## Changes

### 1. Full Heat arms the hero — delete the hidden setup gate

`powers.ts:751` — drop `zoneEntryContext(state, idx)` from the Zone entry
condition. Entry becomes: Zones remaining, and Heat at or above the role's
threshold.

**Conversion must move ABOVE the availability guard.** *(Codex)* Today a hero
who is knocked down, sliding, or in tackle recovery `continue`s out of the loop
at [powers.ts:700](../../src/sim/powers.ts) before the entry block runs. Leaving
that in place means a full bar still does not arm, which is the exact promise
being made.

**Name the skip predicate explicitly: `outReason === 'redcard'` (plus no
`def.power`).** *(Grok)* A red card also sets `outUntilTick > tick`, so moving
the conversion above that guard would arm a sent-off player without this.
Substituted-off needs no third check — the slot already holds a different
object.

**Moving the conversion must not also move the trickle.** *(Codex, round 3.)* A
hero who is down and still BELOW full Heat must keep earning nothing while
unavailable. Only the conversion check moves above the guard; `addGauge` stays
below it. A test pins both halves.

**Deletion carve-out.** *(Fable)* `dangerousKeeperPossession` dies with
`zoneEntryContext`. **`enemyOnTargetShot` must survive** — `inUsefulContext` and
`hasUsableTarget` both call it for the keeper powers.

**This is a test rewrite, not a one-line edit.** *(all three)*
`zoneEntryContext` is exported and asserted throughout
`m1-17-power-mechanics.test.ts` (lines 23, 82, 818, 839, 991, 1333, 1604, 1610).
Those assertions cover the behaviour being removed and must be rewritten first.

**Documented retreat.** *(Codex)* If the cadence measurement in *Balance* comes
back bad, the fallback is to gate the removal on MANUAL only:

```ts
p.gauge >= zoneThreshold &&
  (p.firePolicy === 'SAVE_FOR_TAP' || zoneEntryContext(state, idx))
```

That fixes the stall with zero effect on AI teams or Quick Result. The owner
has chosen the league-wide version; this stays on the record as the retreat.

### 2. Make the Heat bar role-aware — the keeper contradiction

*(All three reviewers, independently. This was the plan's worst defect.)*

`GK_ZONE_HEAT_THRESHOLD = 5` ([powers.ts:59](../../src/sim/powers.ts)), not 60.
Every bar divides by 60: `heatFraction`, the rail tiles
([MatchScreen.tsx:3909, :3944](../../src/render/MatchScreen.tsx)) and the phone
charge meter ([hero-charge-meter.ts:46](../../src/render/hero-charge-meter.ts)).

Once change 3 makes keepers first-class manual heroes, their tile would say
`(ARMED)` with the bar at about **8%** — the same confusion this plan exists to
kill, inverted.

**Decision: render keeper Heat against the keeper threshold.** Keep the
threshold at 5, so the first shot of a match can still be powered. Make the
divisor role-aware in one place and have every consumer read it:

```ts
export function zoneHeatThreshold(role: Role): number
export function heatFraction(gauge: number, role: Role): number
```

Both live in `src/sim/powers.ts`, beside the private GK constant. *(Fable)*

**A fourth site already duplicates the role ternary**: the encore refill at
[powers.ts:3026](../../src/sim/powers.ts) writes
`role === 'GK' ? GK_ZONE_HEAT_THRESHOLD : ZONE_HEAT_THRESHOLD` inline. Route it
through `zoneHeatThreshold(role)` too. *(Codex, round 3.)*

Callers: both rail tile builders ([MatchScreen.tsx:3909, :3944](../../src/render/MatchScreen.tsx))
**and the carrier card at [:4534](../../src/render/MatchScreen.tsx)** *(Grok — a
third caller revision 2 missed; `hero-charge-meter.test.ts:173` string-pins that
exact call, so a keeper on the ball would otherwise still read ~8%)*. A
Zone-state bar pins to full regardless, since entry zeroes the gauge.

**The expiry refund must scale too.** *(Grok, Codex)* `POWER_EXPIRED` sets
`p.gauge = 50` ([powers.ts:803](../../src/sim/powers.ts)). At a keeper threshold
of 5 that is ten times over the line, so the keeper re-arms on the very next
tick and a manager can burn all three Zones in about 30 seconds. Make the refund
a fraction of that role's threshold — `round(threshold * 5/6)` — which leaves
the outfield value at 50 exactly and puts a keeper just under their line.

**The refund is a helper used at THREE sites, not one.** *(Grok)* `p.gauge = 50`
also lives in `interruptWindup` ([powers.ts:125](../../src/sim/powers.ts)) and
the stale-activation abort ([:1325](../../src/sim/powers.ts)). GUST keepers do
wind up — `beginPower` skips the wind-up only for `ELASTIC_KEEPER` and
`GIANT_GK` — so an interrupted GUST keeper would land at 50 against a threshold
of 5 and re-arm next tick, the identical bug. `heatRefund(role)` at all three.

### 3. Keepers become hand-fireable — policy by ROLE, save rules by POWER ID

*(Grok and Codex both caught this. It would have shipped a broken button.)*

`ROLE_POOL.GK` is `['ELASTIC_KEEPER', 'GIANT_GK', 'GUST']`
([power-catalog.ts:30](../../src/game/power-catalog.ts)). **GUST is a keeper
power and is not about shots** — its useful context is simply the opponent
holding the ball ([powers.ts:423](../../src/sim/powers.ts)). A GUST keeper under
role-wide save rules would be greyed out during exactly the build-up the power
exists for, and told `NO SHOT ON NET` about a power that was never about a shot.

**Policy, by role:** the m2.7 keeper exemption is retired, which makes
`firePolicyForRole` ([match.ts:284](../../src/sim/match.ts)) an identity
function. **Delete it** and have its three real call sites take
`teamPolicy` directly: `createMatch` ([match.ts:178](../../src/sim/match.ts)),
`SET_AUTO_POWERS` (`:433`) and `validateEnvelope` (`:982`). *(Codex to delete
it; Grok to correct the list.)*

**`substitutions.ts` is NOT one of them and must not be retargeted.** *(Grok —
revision 4 named it wrongly.)* It copies `outgoing.firePolicy`
([substitutions.ts:59](../../src/sim/substitutions.ts)), which is deliberate: a
substitute arriving after a mid-match `SET_AUTO_POWERS` must inherit the **live**
policy, not `opts.homePolicy`, which is stale by then. Only the stale keeper
comment above it changes. A
named seam whose only job was the exemption outlives the exemption by exactly
nothing. The POWER_TAP validators at `:307` and `:982` already gate on
`SAVE_FOR_TAP`, so they need no edit — they stop rejecting keeper taps on their
own.

The audit probe at
[hero-value-tap-policy.ts:19](../../src/audit/hero-value-tap-policy.ts) hard
-excludes GK with a comment citing m2.7 and GUST. It and both probes that call it
must change, and they need stated acceptance bands for MANUAL keepers and for
GK-carried GUST. *(Codex)*

**Save-power rules, by power id — `ELASTIC_KEEPER` and `GIANT_GK` only:**

- Button greys to `HOLD` while the ball is in the opponent's half.
- A 100-tick (10s) press window instead of 20.
- No `FIRE!` state; the press always opens the window.
- A press that lands fires at **100%**, not the armed 90%.
- `NO SHOT ON NET` on lapse.

**A GUST keeper uses the ordinary outfield contract** — `FIRE!` / `ARMED`, a
2-second window, the 90% armed grade. Explicit test required.

**A MANUAL keeper does not save automatically.** Owner decision. Press or the
power goes unused, the same contract every outfield hero has.

### 3b. An armed keeper must not be bypassed by a same-tick shot

*(Codex, round 3 — verified. A pre-existing hole that MANUAL keepers turn from
invisible into infuriating.)*

`powerTick` runs before `movementTick` ([match.ts:579](../../src/sim/match.ts)),
and a shot is created and flies later in the same tick. A close-range shot can
therefore launch and reach the keeper plane
([engine.ts:2343](../../src/sim/engine.ts)) after the armed branch has already
run. The keeper's power never gets asked.

Today that only costs an automatic keeper a bonus nobody saw. Under this plan
the manager **pressed the button** and watched nothing happen — the worst
possible outcome for a control this plan exists to make trustworthy.

**Fix:** immediately before the keeper roll at `engine.ts:2343`, if that keeper
holds an armed save power and is available, activate it at its stored `strength`
and set `sawShotOnTarget`. One-tick shot test required.

**The LAST tick of the window has the same hole.** *(Codex, round 4.)* The armed
branch decrements to zero and expires the window
([powers.ts:788](../../src/sim/powers.ts)) while shot processing still happens
later in that same tick. So a shot launched on the final tick meets an
already-expired window. **Save-power expiry must be evaluated after shot
processing, not inside `powerTick`.**

**AUTO keepers need the same rescue, at 85%.** A `zone` keeper on
`FIRE_WHEN_READY` is bypassed by an identical same-tick shot today. Fix both in
the same place or the two paths drift apart again.

**One availability rule, not two.** *(Codex, round 4.)* The armed branch tests
`outUntilTick <= tick && !tacklingBusy` inline; the keeper roll uses
`isAvailable`, which also consults `powerInteractionBlocked`
([powers.ts:93](../../src/sim/powers.ts)). A keeper can therefore be "available"
to one path and not the other. Pick `powerInteractionBlocked` for both, and test
a blocked keeper.

### 4. Carry the window and the strength on the armed state

*(Grok's suggestion, and it fixes four separate findings at once.)*

Today `{ kind: 'armed', remainingTicks }` carries neither, so the 20-tick window
and the 90% grade are hardcoded in five places. Add both fields at the moment
the tap is placed:

```ts
{ kind: 'armed'; remainingTicks: number; windowTicks: number; strength: number }
```

This kills, in one change:

- The role checks that would otherwise be scattered across **both**
  `beginPower` sites in the armed branch — the in-window fire at
  [powers.ts:791](../../src/sim/powers.ts) and the lapse-edge settle at `:800`.
  *(Grok, Fable — a shot on the last tick currently settles at 90%.)*
- The dock's hardcoded divisor at
  [HeroPowerDock.tsx:449](../../src/render/HeroPowerDock.tsx), which would pin a
  keeper's bar full for 8 seconds then dump it. *(all three)*
- The same divisor in
  [interpolate.ts:331](../../src/render/interpolate.ts), which feeds the on-pitch
  ring. *(Codex — a second site the earlier plan missed.)*
- The window length itself, which the POWER_TAP handler sets at
  [powers.ts:696](../../src/sim/powers.ts) as `ARM_WINDOW_TICKS + 1`. *(Fable —
  the earlier plan named the wrong function.)*

**Same-tick behaviour, stated so tests do not encode a false delay.** *(Grok,
Codex)* The tap handler runs before the armed branch inside the same
`powerTick`. A keeper pressing while a shot is already on target therefore fires
in that same tick, not the next. The `+1` on `remainingTicks` exists to preserve
a full window of decision ticks and stays.

### 5. `NO SHOT ON NET` on the goal ticker

*(Owner decision, after Grok and Codex both objected to a second band.)*

The line uses the **existing top ticker**, at goal size and goal speed —
`size: 'big'`, `tone: 'red'`, the same `MatchTickerLine` path and the same
`goalTickerLifeTicks` stretch. No second banner stack, no new `band` flag, no
lane pool split.

**Eviction is only half the hazard — overlap is the other half.** *(Codex,
rounds 2 and 3.)* `pushMatchBanner` keeps only the newest four
([MatchScreen.tsx:469](../../src/render/MatchScreen.tsx)), and separately,
`tickerLane` falls back to `live[0].lane` when no free two-lane span exists
([match-ticker.ts:144](../../src/render/match-ticker.ts)). A big line can
therefore be drawn **on top of** a goal line without evicting it, which the
revision-4 eviction guard did nothing about.

Three guards:
- Skip a wasted-power line while another `big` line is live — **excluding an
  existing `power-wasted` line**, or the guard would skip the very replacement
  the `subject` coalescing exists to perform. *(Codex, round 4.)*
- Remove a live wasted-power line before pushing a goal, half-time or full-time
  line.
- Give it the banner `subject` `'power-wasted'`, so a second one replaces the
  first instead of stacking.

The earlier bottom-band design is dropped. It would have landed the line on the
fire button that just wasted the Zone, since the dock is already pinned to a
bottom corner.

**The copy must be true, and a reason code alone does not make it true.**
*(Codex, twice.)* A shot can pass while the keeper is knocked down, and the
keeper can recover before the window lapses. A reason derived only at
expiry would then assert "no shot on net" about a match in which a shot
happened.

Settle it with evidence rather than inference. The armed state already grows two
fields in change 4; give it a third:

```ts
{ kind: 'armed'; remainingTicks: number; windowTicks: number;
  strength: number; sawShotOnTarget: boolean }
```

Set on any on-target shot at this keeper's goal during the window, whatever the
keeper's own availability. `NO SHOT ON NET` fires only when it is still false at
lapse. Otherwise the generic wasted line. No history buffer, no inference.

```ts
{ kind: 'POWER_EXPIRED'; player: number; power: PowerId;
  reason: 'no-shot' | 'other' }
```

**Two reasons, not four.** *(Codex, round 3.)* An outfield ARM lapse is neither
"no shot" nor "unavailable", so a four-value enum had no honest slot for the
commonest case. There are exactly two messages, so there are exactly two
reasons: `no-shot` gates `NO SHOT ON NET`, everything else is the generic
wasted line.

**`power` on the event is load-bearing** *(Codex)*: rendering is batched, so by
the time a line is pushed the slot may already hold a substitute. Reading
`players[e.player].def.power` would name the wrong power.

**`POWER_READY` needs `power` for the same reason.** *(Codex, round 3.)* The
rival-banner suppression in the section below keys on `ELASTIC_KEEPER` /
`GIANT_GK`, and it must read that from the event, not from a slot that may have
changed by render time.

New copy keys, seven locales: `matchScreen.bannerNoShotOnNet`,
`matchScreen.bannerPowerWasted`.

### 6. The rail tile says LOADING and ARMED

The hero tile's name line becomes `BO HEDGES (LOADING)`. The status column keeps
the percentage while loading and blanks once armed, because the bracket already
says it. `LIVE` stays for a power playing out.

**`matchRail.statusLoaded` — added earlier today — is deleted**, along with
`matchRail.statusZone`. It existed only to describe the stall this plan removes.
*(Grok)* Both must come out of **all seven** catalogs or gate 1c fails.

New: `matchRail.statusLoading`, `matchRail.statusArmed`.

### 7. Button labels and the new HOLD state

`matchScreen.heroPowerArm` → `ARMED`. `matchScreen.heroPowerFire` → `FIRE!`.
Their two `a11y` counterparts change with them. *(Grok)*

**`down` must not be reused for "ball upfield".** *(Grok, Codex)* Its
screen-reader line reads "{player} is down. {power} cannot be fired." A healthy
keeper with the ball upfield is not down. New cell state `hold`.

**`hold` needs a VISIBLE label too, not only a screen-reader one.** *(Codex —
revision 3 specified only the a11y key.)* The button label branches on
`fire`/else at [HeroPowerDock.tsx:461](../../src/render/HeroPowerDock.tsx), so a
holding keeper would read `ARMED` and invite a press that does nothing. Add
`matchScreen.heroPowerHold` plus `matchScreen.a11y.heroPowerHold`, seven locales
each, and give the cell the existing inert style.

**The half-pitch rule is a UI affordance, not a game rule.** It lives in
`hero-power-dock.ts`, never in `src/sim/`. A replayed tap from any client must
still simulate. *(Grok's position; Codex raised the alternative of enforcing it
in the engine, and this plan declines — enforcing it would make old replays
unrunnable for a reason that is purely about what the button offers.)*

`ballInKeepersHalf` reads the **ball's** position, not a carrier's — and never
greys while `enemyOnTargetShot` is already true, or a long shot from just past
halfway would find the button dead for the only ticks it can matter. *(Grok)*
Team 0 defends the high-y goal.

Use `ballPos(state)` from [engine.ts:318](../../src/sim/engine.ts) rather than
enumerating ball kinds. *(Codex)* It already covers `held`, `loose`, `shot`
**and `pass`** — revision 3's hand-written list omitted airborne passes, so the
button would have flickered during every long ball.

### 8. The negative sound on a wasted power — narrow scope

**`negative` is not currently a match SFX key.** *(Grok, Codex)* The asset
exists at `assets/audio/sfx/negative.m4a`, but `SfxKey` and `SFX_SOURCES`
([audio.ts:26](../../src/render/audio.ts)) carry only `positive` and
`zone-expire`. Add `'negative'` to the union and the source table, return
`['zone-expire', 'negative']` for `POWER_EXPIRED`, and update
`audio-mapping.test.ts:288`. `filesForEvent` already plays every key in the array.

Owner decision: **narrow**. A power that fires then fizzles is out of scope.

---

## Balance

**The earlier mechanism paragraph was wrong and is corrected here.** *(Fable,
Codex)* `addGauge` no-ops unless `powerState.kind === 'idle'`
([powers.ts:78](../../src/sim/powers.ts)), so Heat never rebuilds inside a Zone,
and entry zeroed the gauge under both the old and new flow. Firing still gates
on the unchanged `inUsefulContext`. **AUTO fire cadence should therefore barely
move.** What moves earlier is Zone *entry*.

Do not tune `ZONE_HEAT_THRESHOLD` against a phantom overshoot.

**Measure entry and fire separately.** *(Codex)* `power-cadence.test.ts` counts
`POWER_FIRED` only. Add `POWER_READY` counts, split by AUTO / MANUAL / keeper,
and record both in `docs/04`.

**Revision 3 overstated the 3-Zone cap risk; corrected here.** *(Codex)* Zone
N+1 cannot open until Zone N closes by firing or expiring, so earlier entry
cannot multiply Zones on its own — it shifts *when* each one opens, not how many
there are. The honest residual risk is narrower: a hero who arms early and then
never finds context holds a spent Zone for longer, so the same three Zones are
distributed earlier in the match. Watch the `POWER_READY` timestamps, not just
the counts.

**Do not silently widen the keeper band.** *(Grok)*
`power-cadence.test.ts:140` requires `ELASTIC_KEEPER` and `GIANT_GK` to fire 2–3
times per match on AUTO. That harness cannot see MANUAL weakness. If AUTO
keepers now dump all three Zones on the first three shots and go quiet, that is
a design regression, not a re-baseline.

**GUST on a keeper** at threshold 5 with no setup gate will likely fire three
times as soon as the opponent first holds the ball. Its only floor is the **GK
trickle of 0.04** — revision 5 said 0.35, which is the MID rate. *(Codex.)*

**The balance gates need numbers and fixtures, not intentions.** *(Codex, twice
— and bands set after measuring are not a gate, they are a rubber stamp.)* The
current cadence harness puts GUST in DEF slot 2, not GK slot 0, so it cannot
measure this at all.

Written before any measurement, derived from the band `docs/04` already
defends:

| Fixture | Band |
|---|---|
| `ELASTIC_KEEPER` / `GIANT_GK`, AUTO | 2–3 fires per match (unchanged, do not widen) |
| `ELASTIC_KEEPER` / `GIANT_GK`, MANUAL, early-press policy | 2–3 fires per match |
| `GUST` on a **GK** slot | 2–3 fires per match |
| Third fire, any keeper fixture | not before the 60th match minute |

The early-press trigger is deterministic: press on the first tick the cell is
pressable. Fixed seeds, listed in the test. A fixture outside its band fails and
the retreat in change 1 is on the table — the numbers are not edited to match
whatever the run produced.

`balance-rails.test.ts` and `attacking-balance.test.ts` must stay green.

---

## Earlier Zone entry changes play, not only timing

*(Codex — verified at both sites. Nobody had spotted this.)*

Two systems read `powerState.kind === 'zone'` as an input to behaviour, so
arming earlier changes what happens, not just when a bar fills:

- **Super Strength victim tracking** ([engine.ts:597](../../src/sim/engine.ts)).
  A `zone` or `armed` Super Strength hero moves toward the enemy carrier. Under
  change 1 that tracking starts as soon as the bar fills instead of when the
  authored setup appears, so the hero commits to chasing earlier and for longer.
- **Rally Cry encore selection**
  ([powers.ts:1843](../../src/sim/powers.ts)). `bestEncoreCandidate` scores
  `zonesOpened * 1000 + 500 for zone/armed + gauge`. Arming earlier reorders who
  receives the encore.

**Decision: both are accepted, not accidents.** The whole point of change 1 is
that a full bar means the hero is ready, and both systems are asking exactly
that question. A Super Strength hero who is ready *should* be stalking. But they
are behaviour changes, so they get their own focused assertions rather than
riding on the cadence average — see Tests.

## The rival threat banner stays put — with a save-power guard

*(Fable found the original problem in round 1. Both reviewers proposed fixes in
round 2 and they conflict; this section takes Fable's, on mechanism evidence.)*

Three different cues sit on `POWER_READY`, and revision 2 wrongly treated them
as one *(Grok)*:

| Site | Fires for | Means |
|---|---|---|
| Rival banner ([MatchScreen.tsx:2734](../../src/render/MatchScreen.tsx)) | rivals only | "KEEP THE BALL AWAY" |
| `zone-enter` sound ([audio.ts:295](../../src/render/audio.ts)) | both teams | bar just filled |
| Haptic ([haptic-cues.ts:10](../../src/render/haptic-cues.ts)) | **controlled team only**; rivals return `null` | your hero just armed |

**Revision 2 proposed moving the banner onto "armed rival enters useful
context". That is wrong, and it is dropped.** Rival heroes are always
`FIRE_WHEN_READY`, and the zone branch calls `beginPower` on the *same*
powers-pass where `inUsefulContext` first turns true
([powers.ts:778](../../src/sim/powers.ts) — verified). So that render-side
condition is observable for exactly one published tick, 100ms at 1×, before the
wind-up begins. The banner would land a tenth of a second ahead of the power's
own activation sting: a double cue, not a warning. "Keep the ball away" is
unactionable at that point — Super Strength has already locked its victim.

It would also leave the moment that *does* matter — a rival armed and holding
indefinitely — with no cue at all, contradicting the counterplay paragraph in
`docs/04` that change 1 makes more true, not less.

**Decision: the trigger does not move; the copy gets honest.** After change 1,
`POWER_READY` means "this rival is armed and will hold indefinitely". Denying
context over the following minutes is real counterplay and is already canon in
`docs/04`. But the line must not imply a reaction window that does not exist —
AUTO fires in the same tick context turns true. *(Codex)* So the banner states
the durable fact and the standing advice, and promises no reflex.

**The live key is `matchScreen.bannerRivalZone`** ("{player} IS HOT, KEEP THE
BALL AWAY", [MatchScreen.tsx:2739](../../src/render/MatchScreen.tsx)). *(Grok —
revision 4 invented a `bannerRivalHot` that does not exist.)* **Reword it in
place** across all seven catalogs. Do not add a second key beside the old one,
and do not rename it — a rename means deleting the old key from every catalog or
gate 1c fails. Keep `filesForEvent`'s `POWER_READY → ['zone-enter']` and keep the
controlled-team `'zone'` haptic — those are the ARMED beat this plan is
building, and `haptic-cues.test.ts` already pins them.

**The one real fault gets a targeted guard.** A rival keeper arms at Heat 5 and
would trigger the banner ~12 seconds into every match. Suppress the banner —
and the rival-side `zone-enter` in the MatchScreen play path only, never
globally *(Grok)* — for the save powers `ELASTIC_KEEPER` and `GIANT_GK`, reusing
the same power-id split change 3 introduces.

**A GUST keeper keeps the banner, but not the old words.** *(Codex, round 4,
overruling Grok's round-2 reading — and Codex is right.)* GUST fires on **any**
enemy possession at any distance ([powers.ts:423](../../src/sim/powers.ts)).
From the manager's chair that means *their own team having the ball*, so "keep
the ball away from them" asks for something impossible. The reworded
`matchScreen.bannerRivalZone` must therefore be neutral and exact — a plain
`RIVAL POWER ARMED` statement — which also stops the line reading a player name
out of a slot that may already hold a substitute.

No per-slot latch, no per-tick `inUsefulContext` poll for rivals — which would
have run a full-pitch search every published tick for PORTAL_PASS and
GRAVITY_WELL ([powers.ts:748](../../src/sim/powers.ts)).

## Determinism and replays

- `ENGINE_VERSION` m2.7 → **m2.8**.
- **Both** runtime golden hashes (`EXPECTED_RUNTIME_GOLDEN` in
  `runtime-golden.ts`) and the parity replay snapshot re-baseline. A version
  bump alone is not enough — change 1 changes play. *(Grok)*
- Every new behaviour is driven by recorded `POWER_TAP` inputs or pure state, so
  same seed + same inputs still produce byte-identical results.
- **`validateEnvelope` must stop policy-checking `POWER_TAP` statically.**
  *(Codex, round 4.)* It reads the OPENING `opts.homePolicy` and the opening
  lineup ([match.ts:912](../../src/sim/match.ts)), so a legitimate
  AUTO → `SET_AUTO_POWERS` → keeper-tap sequence fails validation, as does a tap
  on a substitute. This is a **pre-existing** defect — it already rejects the
  same sequence for outfield heroes — that this plan would make easy to hit.
  Leave the dynamic check to `queueInput` and `runMatch`, which see live state.
  Round-trip test: record AUTO → flip to MANUAL → tap → serialize → replay.
- m2.7 replays refuse to run, which is the intended contract. **Career saves are
  not replay envelopes — no career data is lost.** Verify a stale replay fails
  without blocking career loading. *(Codex)*
- `ballInKeepersHalf` is presentation-only and consumes no RNG.

---

## Tests

Engine:
- `m1-17-power-mechanics.test.ts` — rewrite the seven `zoneEntryContext`
  assertions before deleting the export.
- `match.test.ts:278` — currently asserts SET_AUTO_POWERS leaves the GK slot
  `FIRE_WHEN_READY`. Invert it.
- New `m2-8-armed-on-full-heat.test.ts` — a hero at full Heat arms on the next
  tick with nothing happening on the pitch, **including while knocked down**.
- New keeper window test — a press with no shot inside 100 ticks emits
  `POWER_EXPIRED` with `reason: 'no-shot'` and spends the Zone; a shot on tick
  100 still fires at 100%; a press while a shot is already on target fires in
  the same tick.
- New — a keeper carrying **GUST** gets the outfield contract: `FIRE!`, a 2s
  window, 90% armed, no half-pitch greying, no `NO SHOT ON NET`.
- New — the expiry refund leaves a keeper below their own threshold, at **all
  three** refund sites including an interrupted GUST keeper wind-up.
- New — a full-Heat hero who is red-carded does NOT arm, while a knocked-down
  one does. *(Codex)*
- New — a hero crossing the threshold arms in that same tick, not the next.
  *(Codex)*
- New — the keeper button stays correct while the ball is an airborne **pass**
  crossing halfway, not only while held or loose. *(Codex)*
- New — a shot on target arriving while the keeper is knocked down sets
  `sawShotOnTarget`, so a later lapse does NOT claim `NO SHOT ON NET`. *(Codex)*
- New — Super Strength victim tracking and Rally Cry encore selection, both of
  which read `zone` state directly and therefore change behaviour under change 1
  (`engine.ts:597`, `powers.ts:1843`). Focused assertions, not cadence averages.
- New — `POWER_EXPIRED` carries `power`, so a line pushed after a substitution
  still names the right power.

Audit probes:
- `hero-value-tap-policy.test.ts:20` currently asserts a keeper is never tapped
  even during a live on-target shot, and pins `FIRE_WHEN_READY`. **It is the
  exact opposite of the new contract and must be inverted** *(Grok — the plan
  named the probes but not this file; it goes red in the same commit as
  `match.test.ts:278`)*: `ELASTIC_KEEPER`/`GIANT_GK` tap only while
  `enemyOnTargetShot`; a GK carrying GUST taps while the opponent holds the
  ball; no context, no tap.
- `power-cadence.test.ts` — add `POWER_READY` counts; re-baseline.

Render:
- `hero-power-dock.test.ts:31` ("leaves the goalkeeper out") and `:248` ("never
  rings the GK") — both invert.
- New — `hold` state while the ball is upfield; pressable in the keeper's own
  half; still pressable during an on-target shot from beyond halfway.
- New — the drain bar and the ring both read a 100-tick keeper window correctly.
- `match-rail.test.ts` — LOADING/ARMED, and the role-aware `heatFraction`.
- New — a rival save-power hero arming pushes NO banner and no rival
  `zone-enter`; a rival GUST keeper still does. Own-team `POWER_READY` still
  sounds and still rumbles (`haptic-cues.test.ts` already pins player 4 →
  `'zone'`, player 15 → `null`).
- `audio-mapping.test.ts:288` — `negative` in the `POWER_EXPIRED` array.

Visual, silently and at both widths *(Codex)*: phone and desktop, confirming the
`HOLD` label, the keeper drain bar over its full 10 seconds, and a wasted-power
line that neither covers nor evicts a goal line.

Gates: i18n 1 and 5, including the Vietnamese **uppercase** forms of LOADING,
ARMED, FIRE!, HOLD and NO SHOT ON NET. `npx tsc --noEmit`.
`npm run audio:levels:check`.

**Gate 5 pre-checked**: `!`, ARMED, LOADING and HOLD are all present in the
shipped `HFMSilkscreen_700Bold` cmap, so `FIRE!` needs no hand-built glyph.
*(Fable raised the risk; measured and clear.)*

**Compiler fallout to expect, not to forget** *(Grok)*: every armed-state
literal grows `windowTicks`, `strength` **and `sawShotOnTarget`** — `powers.test.ts`,
`hero-power-dock.test.ts`, `match-rail.test.ts`, `hero-charge-meter.test.ts`,
`m4-power-catalog.test.ts`. Every `POWER_EXPIRED` constructor grows `reason` —
those plus `audio-mapping.test.ts` and `power-match-showcase.test.ts`. Golden
re-baseline covers **both** `EXPECTED_RUNTIME_GOLDEN` and `EXPECTED_GOAL_GOLDEN`.

`heroPowerPressable` stays `fire | arm`; `hold` gets no dashed ring, and
`cellState` must not map HOLD onto `arm`. *(Grok)*

---

## Documentation

`docs/04-superpowers.md` — real rewrite of Heat & The Zone:
- "Heat banks until a real opportunity" is now wrong. Heat banks until FULL.
- The goalkeeper exemption paragraph retires.
- **Line 27 is already stale** and must go — it still claims "There is no manual
  hero tap", contradicting line 26 in the same file since #199.
- Re-baselined cadence numbers, entry and fire separately.
- The vocabulary table above.

Also: `docs/03-match-engine.md`, `docs/08-ui-ux.md`, `docs/09-tech-stack.md`,
the 2026-08-20 manual-activation spec, `README.md`'s decision log, and **both**
`CLAUDE.md` and `AGENTS.md` — they carry the same m2.7 keeper sentence. *(Grok)*

Stale in-code comments that become canon-wrong *(Fable, Grok)*:
`hero-power-dock.ts:71` and `:94`, `MatchScreen.tsx:3951`,
`HeroPowerDock.tsx:306`, `substitutions.ts:52`, `FixtureMatchDayScreen.tsx:57`,
and `hero-value-tap-policy.ts:16-19` — whose comment cites both m2.7 and the
GUST case this plan now handles properly. *(Codex)*

---

## Order of work

1. Rewrite the `zoneEntryContext` tests, then change 1. Accept a red golden
   snapshot from here on — **do not land change 1 on m2.7.** *(Grok)*
2. Change 2 (role-aware threshold and refund), with tests.
3. Changes 3 and 4 (keeper policy, power-id save rules, armed-state fields).
4. Render: changes 5, 6, 7 plus copy in seven locales, and the rival banner's
   copy rewrite plus save-power suppression. **The banner trigger does not
   move.** *(Grok — revision 4 still said "move" here.)*
5. Change 8 (audio).
6. Cadence re-baseline; read entry and fire numbers before accepting.
7. Docs.
8. `ENGINE_VERSION` bump and both snapshot re-baselines last, as one deliberate
   act.
