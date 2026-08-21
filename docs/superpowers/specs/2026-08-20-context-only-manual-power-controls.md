# Context-only manual power controls

Date: 2026-08-20
Status: Council-reviewed

This spec replaces the risky early-press rules in the August 20 manual-power
spec. It also replaces the current body-centred hero marker and enlarged armed
sprite.

## Goal

Manual hero powers must be easy to read and impossible to waste by mistake.
The goalkeeper save powers keep one deliberate risk: the manager can start a
ten-second save window when an attack enters the danger zone.

## Player-facing rules

### Armed hero on the pitch

- Keep the hero at the normal player size.
- Slowly flash the armed hero's body. One full flash takes about two seconds at
  every match speed.
- Under Reduce Motion, use one steady armed tint.
- Draw one solid, flat oval around the hero's feet.
- Reuse the yellow possession ring's size, shape, position, and stroke width.
- Use the hero power's authored colour instead of yellow.
- Do not draw a dashed or body-centred circle.
- Put the hero's first name and power under the oval. The semantic label is
  `Bo (Gust)`.
- Use the translated power name. Keep the player's authored first name.
- Do not show the generic word `POWER`.

The on-pitch pixel font presents this as `BO (GUST)`. Add `(` and `)` to the
pitch alphabet. The label becomes per-hero; it is no longer one shared word for
all rings. When a translated power name is too wide, put `(POWER NAME)` on a
second centred line. Do not truncate the name.

The first name is the first whitespace-separated token of the authored player
name. A single-token name is used as-is. The corner button and pitch label use
the same rule. The last-name line below a single-token name repeats that token,
matching the existing player-name fallback.

The marker appears while the manager has a charged manual power. It remains
through a goalkeeper save window and disappears when the power fires, expires,
the hero leaves the pitch, or the match ends.

If the charged hero also carries the ball, draw only the power-coloured oval.
Do not stack the yellow possession oval underneath it. A downed charged hero
keeps the oval, label, and armed tint while the control stays disabled.

### Corner power button

- Replace the star with the hero's first name. For Bo Hedges, show `Bo`.
- Keep the last name below the button.
- A charged power outside its useful context shows `ARMED`.
- `ARMED` is faded and cannot be pressed.
- A charged power inside its useful context shows `FIRE!`.
- Only `FIRE!` can be pressed.
- Keep the slow flash on `FIRE!`. Do not flash `ARMED`.
- A downed or otherwise unavailable hero stays disabled.

An outfield tap is accepted only while its authored useful context is still
true. If the context ends between the displayed frame and the next simulation
tick, ignore the tap and keep the charge. Do not open the old two-second
outfield window. Do not spend a Zone.

The same no-op rule applies when the hero becomes downed, enters tackle
recovery, leaves the pitch, or otherwise becomes unavailable before the input
tick. The recorded input stays in the replay log. It does not change power
state, Heat, events, or RNG.

These rules also apply to a goalkeeper carrying an ordinary power such as
Gust. The goalkeeper exception below keys on the save power, not the player's
role.

### Desktop hero bar

- A charging hero shows the true Heat percentage.
- A charged hero shows a full bar at `100%` while waiting for `FIRE!`.
- A save goalkeeper keeps the bar full during the ten-second save window.
- Reset the bar only when the power fires or the goalkeeper window expires.
- After either outcome, new Heat starts from zero.

The bar must not empty when Heat changes into a banked Zone. That internal state
change is not a player-visible use.

The existing Rally Cry encore refill and interrupted-wind-up refund do not
change. They can refill the bar after a use or interruption.

## Goalkeeper save-power exception

This exception applies only to Elastic Keeper and Giant GK.

### Danger line

The screenshot's red line maps to the defending-third boundary:

- Team 0: the enemy carrier is at or beyond `2/3` of pitch height toward the
  Team 0 goal.
- Team 1: the enemy carrier is at or beyond `1/3` of pitch height toward the
  Team 1 goal.

This is a clear danger-zone cue. It is not the engine's exact shot decision.
The shot decision also uses distance, angle, lane quality, tactics, and expected
value.

### Button and window

- Before an enemy attack crosses the danger line, show faded `ARMED` and refuse
  the press.
- As soon as the enemy attack crosses the danger line, show `FIRE!` and accept
  the press.
- A press starts the existing ten-second save window at full strength.
- During the window, the first eligible enemy shot on target automatically
  triggers the save power.
- Draw a horizontal countdown bar above the goalkeeper's head.
- Start the bar full. Drain it smoothly to empty across ten seconds.
- Keep the corner button disabled while the window runs.
- A shot on the last valid simulation tick still triggers the power.
- If no eligible shot arrives, spend the Zone, reset Heat to zero, and show
  `WASTED POWER`.

The danger prompt reads the ball and the attacking side, not only a holder:

- Enemy-held ball in the defending third: `FIRE!`.
- Enemy pass in the defending third: keep `FIRE!`.
- Loose ball in the defending third after enemy possession: keep `FIRE!`.
- Enemy shot in flight: `FIRE!` wherever the shot started.
- Friendly-held ball or friendly pass: return to faded `ARMED`.
- Enemy attack leaving the defending third: return to faded `ARMED`.

This prevents the button flickering during one attack. A press shown as
`FIRE!` is still accepted if the carrier passes or shoots before the recorded
tap reaches the next simulation tick.

The simulation and dock use one pure danger-prompt predicate. Loose-ball
ownership comes from `ballHolderTeam`, the last observed possessing team. The
existing restart clears that value. Both boundary coordinates are inclusive. A
replayed keeper tap outside this predicate is a recorded no-op.

The ten seconds are simulation time. Pause freezes the bar and window. At 2x
and 3x, they complete in five and about 3.3 wall-clock seconds. The visual bar
is decorative. The disabled button's spoken seconds update only when the shown
whole second changes. If an incapacity countdown is also above the keeper, stack
the save bar below it with a clear gap.

A shot created on the transition to zero, or reaching the keeper plane on that
tick, resolves before expiry and can trigger the save power.

## Wasted-power announcement

- Reuse `matchScreen.bannerPowerWasted`. Its English value becomes
  `WASTED POWER`; all seven locale catalogs keep a translated value.
- Stop using `matchScreen.bannerNoShotOnNet` for keeper expiry. Both `no-shot`
  and `other` expiry reasons show the truthful generic wasted-power line.
- Use the same large red ticker treatment as a negative goal announcement.
- Enter from the left, cross the pitch, and leave on the right.
- Every new wasted-power event starts a new crossing, including repeated events.
- Follow the same pause and Reduce Motion rules as the goal ticker.
- Never cover, replace, or remove a goal, half-time, or full-time line.

Each wasted event gets a unique ticker animation key. If no two-lane space is
free because a goal, half-time, or full-time line is active, queue the wasted
line. Start it from the left when space becomes free. Preserve event order.

Full time does not discard this queue. Extend the full-time presentation hold
until every already-queued wasted line completes, then leave the match screen.

## Accessibility copy

Update all seven locale catalogs. The spoken states must say:

- Outfield `ARMED`: charged, waiting, and not pressable.
- Outfield `FIRE!`: fires the named power now.
- Save-keeper `FIRE!`: starts the named ten-second save window.
- Save-keeper `ARMED`: charged, waiting for an enemy attack in the danger zone,
  and not pressable.
- Window running: names the power and seconds remaining.
- Downed hero: unavailable without implying the charge was lost.

Stop using copy that says an early outfield press can lose the power. Stop using
the old goalkeeper `HOLD` explanation.

## Determinism and replays

These are deliberate engine changes:

- An outfield `POWER_TAP` processed outside useful context is a recorded no-op.
  The hero stays in the Zone and keeps the charge.
- A save-power `POWER_TAP` shown during the danger prompt still opens the
  ten-second window if the attack passes, shoots, or becomes loose before the
  input tick.
- A lapsed save-power window resets Heat to zero. Other interruption and stale
  activation refund paths keep their current refund.

Bump `ENGINE_VERSION` from m2.8 to m2.9. Rebaseline both runtime golden hashes
and the parity-replay snapshot as one reviewed change. Existing m2.8 replay
envelopes stop running; career saves remain valid. Same m2.9 seed and ordered
input log must still produce byte-identical results.

## Rules that do not change

- AUTO power use is unchanged.
- Quick Result remains AUTO.
- Power Heat thresholds and useful-context definitions remain unchanged.
- The goalkeeper window remains ten seconds and full strength.
- The first eligible shot wakes a pressed save keeper through the shared shot
  resolution path.
- Manual inputs remain recorded and deterministic under engine m2.9.
- Player-facing copy remains localized and truthful.

## Acceptance criteria

- Bo Hedges has a solid Gust-coloured possession-style oval at his feet.
- His semantic pitch label is `Bo (Gust)` and its pixel rendering is
  `BO (GUST)`.
- His corner button shows `Bo`, not a star, and keeps `HEDGES` below it.
- An armed hero is normal size and slowly flashes.
- Every non-useful outfield power is faded, disabled, and remains charged.
- Every useful outfield power says `FIRE!` and can be pressed.
- A stale outfield tap cannot spend the Zone.
- A charged desktop hero bar stays full until the power fires or the goalkeeper
  window expires.
- A save keeper changes from faded `ARMED` to `FIRE!` at the defensive-third
  line for an enemy attack.
- A pass, loose ball, or shot does not flicker a live keeper prompt off.
- An enemy shot from outside the third still wakes `FIRE!`.
- A keeper press draws a ten-second bar above the goalkeeper.
- A last-tick shot triggers the save power.
- A lapsed keeper window resets Heat and sends `WASTED POWER` across the pitch.
- Repeated wasted-power messages each start at the left edge.
- A queued wasted-power message completes before the full-time screen leaves.
- Focused simulation, render, replay, accessibility, and TypeScript checks pass.

## Required contract rewrites

Replace the old rules in these contracts. Do not delete assertions without a
new assertion for the replacement behavior.

- `docs/03-match-engine.md`, `docs/04-superpowers.md`, and `docs/08-ui-ux.md`.
- Root `AGENTS.md` and `CLAUDE.md` manual-power summaries.
- `hero-power-dock.test.ts`: disabled outfield `ARMED`, danger-third keeper
  `FIRE!`, pass/loose continuity, and in-flight-shot wake.
- `m2-8-armed-on-full-heat.test.ts` or its m2.9 replacement: recorded no-op
  outfield taps, keeper expiry at zero Heat, and last-tick keeper shots.
- Rail and charge-meter tests: full bar through Zone and keeper window.
- Ring and pixel-glyph tests: possession-style oval, per-hero label, and
  parentheses.
- Ticker tests: repeated and queued `WASTED POWER` crossings.
- Accessibility and i18n gates across all seven catalogs.
- Runtime goldens and parity replay for engine m2.9.

## Non-goals

- No new power art or audio assets.
- No change to automatic power timing or strength.
- No new danger-line graphic during normal play.
- No new setting or tutorial.
- No balance retune outside the deliberate removal of the keeper expiry refund.
