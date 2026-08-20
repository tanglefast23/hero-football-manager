# Manual hero power activation — spec

Date: 2026-08-20
Branch: `feat/sell-anytime-lay-off`
Status: reviewed over three rounds by Codex (gpt-5.6-sol, max) and Fable 5
(xhigh). Fable approved; every Codex round-3 item is applied below but was not
re-reviewed, because the review cap was reached.

## 0. This reverses a locked decision

The manual hero tap was removed on 2026-07-25 and the removal was written into
canon and locked by tests. Re-adding it is a product reversal, not a feature.
Everything below assumes the owner has decided to reverse it.

Documents that state the opposite and must change in the same commit:

| File | What it says now |
|---|---|
| `README.md:116` | powers always fire automatically |
| `docs/04-superpowers.md:26` | `POWER_TAP` is test instrumentation only |
| `docs/03-match-engine.md:14` | Quick Result resolves identically to an unattended watch |
| `docs/08-ui-ux.md:62` | powers fire automatically |
| `docs/08-ui-ux.md:55` | match 1 has no powers (constrains §6.3, not a reversal) |
| `docs/01-vision.md:15` | automatic firing as a pillar |
| `README.md:159` | automatic firing |
| `AGENTS.md` | same summary as CLAUDE.md |
| `CLAUDE.md` "Key design facts" | no manual hero tap, no M/A toggle; also the stale "cap grows to 4" |

Plus the automatic-only comments in the sim and renderer: `src/sim/match.ts:55`,
`src/sim/match.ts:162`, `src/sim/powers.ts:786`, `src/render/match-control.ts:12`,
`src/render/MatchScreen.tsx:3468`, `src/render/audio.ts:318`.

Tests that currently forbid this and must be rewritten, not deleted:

- `src/render/__tests__/automatic-power-ui.test.ts` — asserts no `SAVE_FOR_TAP`
  in `match-control.ts`/`match-policy.ts`, no `kind: 'POWER_TAP', player: index`
  in `MatchScreen.tsx`, and that `assets/audio/sfx/tap-fire.wav` does not exist.
- `src/render/__tests__/audio-mapping.test.ts:282` — asserts `POWER_EXPIRED`
  maps to no sound AND that `audio.ts` does not contain `'zone-expire'`.
- `src/render/__tests__/match-rail.test.ts:299` — asserts the rail source never
  mentions `autoPowers`.

Each replacement must assert the NEW rule, so the next person cannot delete the
guard by accident.

## 1. Scope, and what is not yet built

The `HERO POWER MANUAL/AUTO` row on the match-day screen exists **only as
uncommitted work in this checkout**. It writes `preferences.autoPowers` and
`MatchScreen` never receives that value — `App.tsx` passes it to
`FixtureMatchDayScreen` alone. Nothing downstream reads it.

In scope:

1. Carry `preferences.autoPowers` into the watched match's fire policy.
2. A hero power dock at the bottom corner of the pitch that the possession card
   is not using, one button per hero holding a Zone.
3. Tapping a button records a `POWER_TAP`.
4. Make the tap's risk legible before and during the press.

Out of scope: changing MANUAL/AUTO mid-match; manual control of rival heroes.

## 2. What already exists in the engine

The manual path was built and shipped once, then hidden. Every engine piece
survives and was re-verified line by line during review. It was calibrated for
**skilled, context-gated** tapping; naive tapping is unmeasured (§6.7):

| Piece | Where | State |
|---|---|---|
| `POWER_TAP` input + validation | `src/sim/match.ts:279` | live |
| `SET_AUTO_POWERS` input | `src/sim/match.ts:398` | live |
| `SAVE_FOR_TAP` fire policy | `src/sim/match.ts:106` | live |
| Substitute inherits team policy | `src/sim/substitutions.ts:53` | live |
| Tap → armed → fire/expire | `src/sim/powers.ts:682-806` | live |
| Replay codec policies | `src/persistence/replay-codec.ts:192` | live |
| `zone-expire.wav` | `assets/audio/sfx/` | shipped, disconnected |
| Balance anchors for manual grade | `src/sim/powers.ts:1029` | live |

**No `ENGINE_VERSION` bump is needed for §1 items 1-4 as specified**, because
passing `SAVE_FOR_TAP` through `MatchOpts` and reading state from the render
ring changes no engine rule. Exporting an existing pure predicate (§5.4) is also
behaviour-neutral. Every option below that DOES require a bump is labelled.

## 3. How the power cycle actually works

Two of the owner's assumptions are wrong. This is the most important section.

```
idle ──(gauge >= threshold, authored context)──> zone ──(context)──> winding ──> active ──> idle
                                                   │
                                             POWER_TAP
                                                   │
                                 ┌─────────────────┴─────────────────┐
                          in context now                     not in context
                                 │                                   │
                         fire at 1.00 strength              armed, 20 ticks (2.0s)
                                                                     │
                                                 ┌───────────────────┴──────────────┐
                                         context appears                     window runs out
                                                 │                                   │
                                         fire at 0.90               usable target? 0.90 : EXPIRE
                                                                                     │
                                                             POWER_EXPIRED, gauge = 50, idle
```

- **Heat empties at Zone entry, not at fire.** `powers.ts:764` sets `gauge = 0`
  the tick the Zone opens. The HUD hides this — `chargeMeter()` pins the bar
  full while `powerState.kind === 'zone'`. "The bar doesn't refill until it's
  used" is true as displayed; the underlying gauge is already zero.
- **An untapped Zone never expires.** m1.27 removed the countdown. Assumption
  "no time limit" is **correct, for an untapped Zone only**.
- **A tap starts a 2-second clock.** Tapping outside a useful context converts
  the open-ended Zone into a 20-tick armed window (`ARM_WINDOW_TICKS = 20`,
  `TICK_MS = 100`). If nothing usable appears, the power is **lost**:
  `POWER_EXPIRED`, gauge refunded to 50 of the 60 needed.
- **Zones are capped at 3 per hero per match** (4 with a banked encore).
  `addGauge` stops entirely at the cap. A wasted tap burns one of three
  chances, not 10 heat.
- **Auto fires at 0.85; a well-timed tap at 1.00**, with a hidden gameplay
  multiplier of 1.15 vs 1.00 (`manualTimingScale`). The balance anchors are
  named `AUTO_ACTIVATION_GRADE = 0.85` and `MANUAL_ACTIVATION_GRADE = 1.15`.

**A tap at the wrong moment is not free.** It is a gamble: a higher activation
grade if timed well, total loss of one of three Zones if not. The size of that
upside in match outcomes is **not yet measured** — see §6.7. Do not quote the
grade ratio as an outcome.

## 4. Decisions the owner must make

### D0 — Default MANUAL or AUTO? — CLOSED: MANUAL, by owner decision

The owner asked for MANUAL as the default. **Both reviewers independently
recommended defaulting to AUTO.** Their reasoning, which this spec finds
sound: a first-time player who never taps loses every power they paid a Hero
License for, silently, with no feedback explaining why (§6.2).

This spec keeps **MANUAL as the default because the owner asked for it**, and
makes the onboarding beat in §6.3 a hard requirement rather than an option.

Two things to know if the owner picks AUTO instead:

- Changing `DEFAULT_APP_PREFERENCES.autoPowers` does not touch already-persisted
  rows on existing devices. Pre-release that is only Joe's own devices, but it
  must be named.
- The uncommitted `App.tsx:1780` runs
  `if (preferencesRef.current.autoPowers) saveAutoPowers(false)` on every new
  career, forcing MANUAL whatever the stored preference says. Under AUTO that
  line would silently revert each new career to MANUAL — recreating the exact
  §6.2 silent failure this decision exists to avoid. It must be deleted or
  inverted alongside the default.

### D1 — Does a tap that finds no context lose the Zone?

- **(a) Keep it (recommended).** The armed window is the authored risk that
  makes MANUAL worth choosing. No bump. Note the risk is authored, **not
  measured for a naive tapper** — see §6.7.
- **(b) On expiry return to `zone` instead of `idle`.** Matches the owner's
  stated intent. Removes all downside from spamming, so MANUAL becomes
  strictly better than AUTO and the AUTO option becomes pointless.
  **Requires an `ENGINE_VERSION` bump.**

Assumes **(a)**, and makes the risk legible in the UI (§5.4) rather than
removing it.

### D2 — Goalkeeper heroes (found by Fable; no good no-bump answer)

`GK_ZONE_HEAT_THRESHOLD` is **5**, not 60 (`powers.ts:59`). A keeper hero
enters the Zone in the opening minutes and holds it all match. For
`ELASTIC_KEEPER` and `GIANT_GK` the useful context is `enemyOnTargetShot`
(`powers.ts:422, 426`) — true only while an unsaved on-target shot is in
flight, a few ticks. `hasUsableTarget` is the same check, so the armed fallback
does not rescue it either.

So in MANUAL a keeper hero with a keeper power is either never fired, or tapped
and wasted. The dock would show a permanent star button that is almost always a
trap.

**A goalkeeper is not the same thing as a keeper power.** `ROLE_POOL.GK` in
`src/game/power-catalog.ts:29` is `['ELASTIC_KEEPER', 'GIANT_GK', 'GUST']`. A
keeper carrying `GUST` has an ordinary, frequently-true context and is
genuinely tappable. Any exemption must filter on `player.def.role === 'GK'`,
not on the power id — filtering on the power would leave a GUST keeper with a
team policy their slot does not match, which is exactly the state
`validateEnvelope` refuses.

- **(a) Goalkeepers stay `FIRE_WHEN_READY` even in MANUAL (recommended).** No
  keeper button. Cost, in full — price this before choosing it:
  - a per-role policy field in `MatchOpts`, because a post-`createMatch`
    mutation desyncs replay reconstruction;
  - the same field in the envelope schema at
    `src/persistence/replay-codec.ts:190`. Note `matchOptionsSchema` ends in
    `.passthrough()`, so an unknown field is **preserved but unvalidated** —
    not dropped. That is worse than dropping: a corrupt value reaches the
    engine unchecked. Name the field and its default explicitly;
  - `validateEnvelope` (`match.ts:951`) must check a tap against the **slot's**
    policy, not the team's, or a forged keeper tap passes a team-level MANUAL
    check;
  - **`src/sim/substitutions.ts:23` copies `state.players[first].firePolicy`,
    and `first = team * 11` — slot 0, the goalkeeper.** Leave this alone and
    every substitute inherits the keeper's Auto policy and silently stops being
    tappable. This is the single easiest way to get D2(a) wrong;
  - `processCoachingInput`'s `SET_AUTO_POWERS` branch (`match.ts:400-403`)
    loops all 11 slots and would stomp the exemption. Unreachable today, since
    mid-match toggling is out of scope, but §6.9's follow-up walks straight
    into it — make the loop respect the exemption, or assert the input is never
    recorded;
  - an `ENGINE_VERSION` bump and a golden-replay decision;
  - accepting that a GUST keeper loses manual control they could have used.
- **(b) Show the keeper button only while `enemyOnTargetShot` is true.** No
  bump. But the window is under a second at 1x and unhittable at 3x, so it is a
  reflex minigame, not a decision.
- **(c) Ship the trap and document it.** Rejected.

Recommend **(a)**, with every bullet above in the same commit.

### D3 — Quick Result parity is revoked, not preserved

`src/game/matchday.ts:78` and `src/game/match-policy.ts:21` hardcode
`FIRE_WHEN_READY`. If MANUAL reached Quick Result, `SAVE_FOR_TAP` heroes would
never fire and nobody would be there to tap: **zero power effects for the whole
match, silently.**

**Rule: MANUAL applies to watched matches only. Quick Result always runs
`FIRE_WHEN_READY`.**

Be honest about the cost: this does not preserve the parity claim in
`docs/03-match-engine.md:14`, it **narrows it**. Under MANUAL an unattended
watch fires nothing while Quick Result fires everything. The parity contract
holds for AUTO only, and docs/03 must say so.

Mechanism matters. `controlledMatchOptions` is deliberately shared by watched
play (`src/render/match-control.ts:13`) and Quick Result
(`matchday.ts:87`), with a comment saying the sharing exists to stop the two
paths drifting apart. **Do not fork it.** Add a parameter:

```ts
export function controlledMatchOptions(
  controlledTeam: 0 | 1,
  initialFormation: FormationId = '4-4-2',
  heroPowers: 'auto' | 'manual' = 'auto',   // Quick Result never passes 'manual'
): MatchOpts
```

Stale comments to update alongside: `match-control.ts:12` and
`MatchScreen.tsx:3468` ("Nothing in the HUD reads a firing policy now").

## 5. UI spec

### 5.1 Placement

A `heroPowerDock` view, sibling of `carrierCard` in the pitch overlay
(`MatchScreen.tsx` ~4388):

```
bottom: 8 (12 on desktop)
right: 8   when hudSide === 'left'
left: 8    when hudSide === 'right'
```

**It always takes the corner the possession card is not using.** The possession
card flips with `hudSide` (`carrierCardLeft`/`carrierCardRight`). Pinning the
dock to the right unconditionally would stack it on the possession card for
every manager who set Match Info to the right.

### 5.2 How many buttons — up to eleven, never hidden

**The Hero License cap is not 4.** `heroLicenseCap` returns
`Math.max(earned, purchasedHeroLicenseCap)` and `heroLicensePurchaseCost`
prices permits 5, 6, 7… at `300_000 + 50_000 * (n - 5)`, indefinitely
(`src/game/promotion-progression.ts:64`, `src/game/squad.ts`). A Global League
club can field more than four heroes, up to all eleven.

The desktop rail caps its tiles at `RAIL_HERO_TILE_CAP = 4` and silently drops
the rest. That is acceptable for a **display**. It is not acceptable for a
**control**: a hidden button is an unusable hero.

Rules:

- The dock holds every eligible hero, up to 11.
- Single row; wrap upward into additional rows when the row would exceed 45%
  of pitch width. Never scroll — a scrollable control over a live match is a
  mis-tap generator.
- **One cell per on-field slot that currently holds an eligible hero, in slot
  order.** Not eleven always-reserved cells — with one hero that is a mostly
  empty floating grid, and five heroes is already an endgame achievement. Not a
  filtered list either: within a match the set of cells is fixed, so when a
  button disappears its cell stays empty rather than letting every later button
  slide under the manager's thumb. The set is recomputed **only at a
  substitution**, which is also what lets a bench hero entering a previously
  hero-less slot get a cell. Never order by Zone-open time.
- Shrink the button to a 44pt floor before wrapping; below that, wrap.
- Test at 1, 4, 5 and 11 heroes, on phone and desktop, both `hudSide` values,
  and with `controlledTeam` 0 and 1.

### 5.3 The button

- 44x44 minimum touch target (48 desktop), square, ink border, matching
  `ChunkyControl`'s face/highlight/lip recipe.
- A star drawn as a Skia path or pixel sprite. **Not a font glyph** — Silkscreen
  has no U+2605 and gate 5 reads the shipped face's cmap.
- **No shirt number.** `PlayerDef` (`src/sim/types.ts:45`) has no shirt number
  and `lineup.ts:171` drops the career value. Adding one to sim data would need
  replay-compatibility work for no gain. Use `player.def.name` truncated to one
  line under the star instead.
- Colour: `powerCutInPresentation(power).color` — the power's authored primary,
  matching the cut-in the tap produces. **Same power, same colour**, even for
  two heroes. `CHARGE_RAINBOW_BANDS` holds only six colours
  (`hero-charge-meter.ts:62`) and cannot cover eleven buttons, and a colour that
  moves between heroes is worse than a repeated one. The name under the star and
  the FIRE/ARM text carry identity.
- Honour `highContrast`, `colorSafeKits` and `reduceMotion`.

### 5.4 FIRE versus ARM — make the gamble visible before the press

Both reviewers raised this. §4 D1 keeps the loss; that is only defensible if the
manager can see it coming.

`inUsefulContext` is **already exported** (`src/sim/powers.ts:393`), and it
consumes no RNG, so the render ring can read it per eligible hero at HUD render
as a pure read. No sim change, no bump:

| Hero state | Button reads | Colour | Meaning |
|---|---|---|---|
| `zone`, in useful context | `FIRE` | power colour, full | fires now at 1.00 |
| `zone`, not in context | `ARM` | power colour, dimmed + amber edge | 2s gamble |
| `armed` | `ARM` + draining ring | amber | 20 ticks counting down |
| hero down / tackling | disabled | grey | see §6.5 |

The armed state **keeps the button on screen with a draining ring** for its
full 20 ticks. The round-1 spec hid the button one tick after the tap, so the
entire 2-second gamble was invisible and the loss arrived as an after-the-fact
banner.

Cost note: `inUsefulContext` is a pitch search for `PORTAL_PASS` and
`GRAVITY_WELL`. It already runs once per zone-hero per tick inside `powerTick`.
Calling it again per HUD render for at most 11 heroes is acceptable; measure if
the frame budget moves.

### 5.5 When a button is shown

Show for player index `i` when ALL of:

- `players[i].team === controlledTeam`
- `players[i].outReason !== 'redcard'`
- `players[i].def.power !== undefined`
- `players[i].firePolicy === 'SAVE_FOR_TAP'`
- `players[i].powerState.kind` is `zone` or `armed`
- the match is live: not `fulltime`, no title card, no half-time speech

**The tutorial does not hide the dock.** §6.3 pauses and points AT this button,
so hiding it during a tutorial step would hide the tutorial's own target.
During the beat the dock stays on screen and the tutorial owns the press.

Hide when `powerState.kind` becomes `winding`, `active` or `idle`. Enter/leave
is a short scale+fade, suppressed under `reduceMotion`.

### 5.6 Press behaviour

```ts
const firePower = (index: number) => {
  // A press on an ARM-state button is a no-op. Without this, every press during
  // the 20-tick armed window appends an input the sim silently skips
  // (powers.ts:685 acts only on `zone`) but the replay still records — and at
  // MAX_REPLAY_INPUTS `queueInput` starts throwing, which would then refuse
  // real coaching inputs for the rest of the match.
  if (match.players[index].powerState.kind !== 'zone') return;
  // Debounce off the engine's own queue, not a second piece of React state.
  const conflicted = match.pendingInputs.some(
    (i) =>
      (i.kind === 'POWER_TAP' && i.player === index) ||
      (i.kind === 'SUBSTITUTE' && i.player === index),
  );
  if (conflicted) return;
  recordCoachingInput({ tick: match.tick + 1, kind: 'POWER_TAP', player: index });
};
```

`recordCoachingInput` already swallows engine refusals without taking the screen
down. Reading `pendingInputs` removes the round-1 `pressedRef`, which was a
second source of truth that could drift from the engine — but `pendingInputs`
alone is not enough, because it clears one tick after the tap. **While
`powerState.kind === 'armed'` the button is status-only: it displays the
draining ring and accepts no press at all.** Without the `kind !== 'zone'`
guard, every press during those 20 ticks appends a replay input the sim skips,
and at `MAX_REPLAY_INPUTS` `queueInput` starts throwing — which would then
refuse real coaching inputs for the rest of the match.

### 5.7 Feedback

- Press: the existing `SfxPressable` tap sound. The hero's power SFX still
  arrives from `POWER_FIRED` as it does today. Do **not** re-add
  `assets/audio/sfx/tap-fire.wav`; `automatic-power-ui.test.ts` asserts its
  absence and there is no reason to bring it back.
- Reconnect `POWER_EXPIRED` to `zone-expire.wav` and flash a banner naming the
  hero. Today it is deliberately silent because it was unreachable. It becomes
  reachable on the first shipped tap, and a Zone vanishing with no sound and no
  line is the worst possible outcome for player trust.

## 6. Bugs and gaps

### 6.1 Quick Result would fire nothing — BLOCKER, resolved

See D3.

### 6.2 A manager who never taps loses every power — HIGH

The Zone has no expiry. In MANUAL a hero who reaches the Zone and is never
tapped holds it to the whistle and fires nothing.

- **(a) Late auto-fallback.** Auto-fire a Zone held past 85' at
  `CONTEXT_AUTO_STRENGTH`. **Requires an `ENGINE_VERSION` bump.**
- **(b) UI-only nag (recommended for this change).** After a Zone has been held
  ~30s, pulse the button and push a one-time banner. No engine change.
- **(c) Do nothing.** Rejected — it is a silent failure.

### 6.3 Onboarding must trigger in match 2, not match 1 — HIGH

`docs/08-ui-ux.md:55`: **match 1 has no powers.** A tutorial beat keyed to "the
first match" would therefore never fire, and one keyed to "when MANUAL is first
switched on" never fires either while MANUAL is the default (D0).

Requirement: on the **first Zone of the first watched MANUAL match in which the
manager has a licensed hero**, pause once, point at the button, and explain
FIRE vs ARM. Gated by a new persisted one-shot flag.

Gating rules, each of which is a way to burn the one-shot flag on nothing:

- Only in a watched match with `firePolicy === 'SAVE_FOR_TAP'`. Never mark the
  flag seen during an AUTO match or a Quick Result — there is no button to
  point at.
- Above 1x, **pause the match and teach anyway**, or defer without marking the
  flag seen. Never skip-and-mark.
- The dock stays visible for the beat (§5.5).

**The new preference must be added with a schema default**, following the
pattern at `preferences-repository.ts:189`. A new required field with no
default makes every older settings row fail to parse, which silently resets
every other preference on the device — and the existing tests stay green while
it happens. Prove it with a **raw legacy-preferences fixture**: a stored row
from before this change, parsed after it, asserting every pre-existing setting
survives. A round-trip test written against the new schema cannot catch this.

### 6.4 Double-tap and the tap/substitution race — MEDIUM

`tick()` runs `processCoachingInput` for every due input **before**
`powerTick` (`src/sim/match.ts:536-546`). So a `SUBSTITUTE` landing on the same
tick replaces the player object first; `powerTick` then reads a fresh
substitute whose `powerState` is `idle`, and the tap is silently swallowed. The
manager loses the Zone and the tap with no feedback.

This is deterministic and safe for replay, but it must be defined, not
discovered. §5.6 blocks a `POWER_TAP` for any index with a pending
`SUBSTITUTE`; the substitution board must equally refuse to stage a swap for a
player with a pending `POWER_TAP`.

**A later substitution may take a banked Zone, and that is accepted.** A hero
can be substituted at any tick while holding a Zone or an armed window; the
replacement arrives `powerState: { kind: 'idle' }` (`substitutions.ts:50`) and
the charge is gone with no event and no sound. Both reviewers asked for a
warning on the board, and for an announcement on the Auto Subs path that
bypasses it.

**Owner decision, 2026-08-20: no warning, no announcement. Losing the banked
power to a substitution is fine.** A held Zone must never argue with a swap —
the manager is taking that player off for a reason, usually an exhausted one.
This closes the item; do not reopen it with a "helpful" confirm.

### 6.5 Tapping a downed hero wastes the Zone — MEDIUM

`powers.ts:685` — if the hero is out, slide-tackling, or in tackle recovery,
`available` is false, so the tap falls through to the armed branch. The armed
window then counts down **while he is still down**. A tap on a hero flattened a
tick earlier is very likely a dead Zone.

The button is **disabled** — greyed, not pressable — while
`outUntilTick > tick || slideTackle !== undefined || tackleRecoveryUntil > tick`.
A one-time banner explains why the first time it happens. (Round 1 said
"visually disabled, still pressable to explain", which is contradictory; this
picks one.)

### 6.6 Dock and possession card fight for the pitch — MEDIUM

Handled by §5.1 and §5.2. Both are pinned to opposite bottom corners and each is
capped at a share of pitch width (card 32%, dock 45%), so they cannot meet.

### 6.7 Balance — NOT MEASURED, by owner decision — CLOSED

`MANUAL_ACTIVATION_GRADE / AUTO_ACTIVATION_GRADE = 1.15 / 0.85 = 1.35`. That is
a **strength-grade** ratio, not a match-outcome ratio, and it must not be quoted
as "35% stronger" anywhere.

Both reviewers asked for a measured gate before shipping. Round 3 proposed one:
a +1 squad-point ceiling in the currency `docs/09-tech-stack.md:69` makes
canonical, plus an armed-expiry rate for a naive tapper — which would have
needed a new naive-tapper mode in `power-firing-probe.test.ts`, since the
existing probes model skilled, context-gated tapping only.

**Owner decision, 2026-08-20: not measuring it.** The judgement is that manual
timing will not move outcomes enough to matter. No probe mode, no gate, no
numbers. This closes the item — do not reopen it with a "quick sanity probe".

What that buys and what it costs, stated once so the decision stays informed:
manual play is ungated, so if it does turn out to be strong, the first signal
will be play feel rather than a red rail. That is an acceptable trade for a
setting that defaults to the manager's own choice and can be turned off.

### 6.8 3x speed leaves under a second to react — MEDIUM

At 3x the 20-tick armed window is ~0.67 real seconds. Manual at 3x is close to
random. No engine change: the FIRE/ARM label (§5.4) tells the manager when a
press is safe. The tutorial beat **pauses the match and teaches anyway** above
1x — it must never skip-and-mark the one-shot flag (§6.3).

### 6.9 Mid-match MANUAL/AUTO toggling would corrupt replays — LOW, out of scope

Round 1 claimed `SET_AUTO_POWERS` "would work from the in-match settings sheet".
**That is wrong.** `validateEnvelope` (`src/sim/match.ts:951-959`) checks every
`POWER_TAP` against the envelope's **initial** `homePolicy`/`awayPolicy`, not
the policy after a mid-match flip. A match that starts AUTO, switches to
MANUAL, and records a tap produces an envelope that fails its own validation —
the persisted replay is rejected.

Mid-match toggling is out of scope. If it is ever added, `validateEnvelope`
must replay the `SET_AUTO_POWERS` inputs first.

### 6.10 Rival heroes must never get a button — LOW

`activeOnFieldIndices` is already scoped to `controlledTeam`
(`MatchScreen.tsx:3448`). Keep the dock on those indices only.

### 6.11 i18n — LOW but mandatory

New strings: `FIRE`, `ARM`, the button accessibility label (hero name + power
name + action), the armed-state status announcement, the held-Zone nag, the
expiry banner, the §6.4 substitution warning (manual and Auto Subs), §6.5's
one-time downed-hero banner, and the tutorial beat. Seven
locales in the same commit. `FIRE`/`ARM` render in the pixel display font, so
check every locale's translation against the shipped face before writing it.

### 6.12 Accessibility — LOW

`accessibilityRole="button"` with a label naming the hero, the power and
whether the press will FIRE or ARM — **but only in the `zone` state**. In the
`armed` state the control takes no press (§5.6), so it must render as a
disabled control or an accessible status, announcing the time remaining without
implying another press will do anything. `accessibilityState={{ disabled }}`
also applies under §6.5.
Buttons appear and disappear mid-match, so a hero becoming tappable must be
announced. **There is no existing live region to lean on** —
`MatchTickerLine.tsx:112` draws ordinary text with no screen-reader
announcement. Add an explicit announcement rather than assuming the banner
carries one.

## 7. Work plan

1. **Decisions first.** D0 is closed (MANUAL). Get **D1 and D2** from the
   owner — both are still open. D1(b) and D2(a) each force an
   `ENGINE_VERSION` bump and a golden-replay decision; nothing else here does.
1b. **If D2(a) wins, do it as its own step**, before any UI work: name the new
   `MatchOpts` field and its default, add it to `matchOptionsSchema`
   (`replay-codec.ts:190`), make `validateEnvelope` check a tap against the
   slot's policy, fix `substitutions.ts:23` so a substitute no longer copies
   slot 0, bump `ENGINE_VERSION`, and take the golden-replay decision.
2. Add the `heroPowers` parameter to `controlledMatchOptions` (D3) and carry
   `preferences.autoPowers` from `App.tsx` into `MatchScreen`. Quick Result
   never passes `'manual'`.
3. (Nothing to do — `inUsefulContext` is already exported at
   `src/sim/powers.ts:393`. Import it; do not re-export it.)
4. New pure module `src/render/hero-power-dock.ts` for layout and the
   visibility predicate — testable without react-native, mirroring how
   `match-carrier-card.ts` is split out. Then the `MatchScreen` view.
5. Press handler with `pendingInputs` debounce (§5.6), disabled state (§6.5),
   substitution-board mutual block (§6.4).
6. Audio: add a `zone-expire` key to the `SfxKey` union and `SFX_SOURCES`, add
   the `require`, change the `POWER_EXPIRED` case, rewrite
   `audio-mapping.test.ts:282`, then run `npm run audio:levels:check`. Note the
   known blast radius — `audio-profile`'s `full` list is
   `Object.keys(SFX_SOURCES)`, so adjacent tests will move.
7. Held-Zone nag (§6.2b) and the match-2 tutorial beat (§6.3), including the
   new preference **with a schema default**.
8. Seven-locale copy (§6.11).
9. Rewrite the three locking tests (§0) to assert the new rule.
10. Update **every document listed in §0** — `README.md` (both places),
    `docs/01-vision.md`, `docs/03`, `docs/04`, `docs/08`, `CLAUDE.md`,
    `AGENTS.md` and the six source comments — **plus `docs/09-tech-stack.md`**,
    whose tap text becomes player-facing again.
11. Tests: dock layout at 1/4/5/11 heroes, both `hudSide` values, both
    `controlledTeam` values, phone and desktop, high contrast, reduced motion,
    downed hero, substitution race, Quick Result stays auto, and the raw
    legacy-preferences fixture (§6.3). Plus **one real rendered `MatchScreen`
    check at eleven buttons** — pure layout tests cannot prove eleven controls
    stay readable over a live pitch.
12. ~~Balance measurement.~~ Cut by owner decision (§6.7). No naive-tapper
    probe mode, no squad-point gate.
