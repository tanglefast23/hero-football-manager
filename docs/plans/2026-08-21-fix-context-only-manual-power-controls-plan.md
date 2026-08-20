# Context-only manual power controls implementation plan

Date: 2026-08-21
Status: Council-reviewed
Spec: `docs/superpowers/specs/2026-08-20-context-only-manual-power-controls.md`

## Outcome

Manual power controls only accept useful presses. Charged heroes stay at normal
size, flash slowly, and use a solid power-coloured oval at their feet. The pitch
and corner controls name the hero. A save keeper can start one ten-second window
when an enemy attack reaches the defending third. An unused window ends at zero
Heat and sends a localized `WASTED POWER` ticker across the pitch.

## Guardrails

- Keep MANUAL watched-only. Quick Result and AUTO behavior do not change.
- Key the keeper exception on `ELASTIC_KEEPER` and `GIANT_GK`, not goalkeeper
  role. A goalkeeper with Gust follows the outfield contract.
- Keep every `POWER_TAP` in the ordered input log. A stale outfield tap becomes a
  deterministic no-op inside the simulation.
- Keep the existing ten-second save window and full-strength save resolution.
- Resolve a shot before expiring its keeper window. The last valid tick counts.
- Reset Heat only after a power fires or a keeper window expires. Keep Rally Cry
  encore and interrupted-wind-up refunds.
- Bump `ENGINE_VERSION` from `m2.8` to `m2.9`. Review every changed golden value.
- Reuse the Atlas tint path, possession-ring geometry, ticker system, and current
  dock ordering. Add no dependency, art, audio, setting, or danger-line graphic.

## Implementation map

### 1. Lock the new simulation contract with focused tests

Modify:

- `src/sim/__tests__/m2-8-armed-on-full-heat.test.ts` — rename to an m2.9 test
  and replace the old early-press assertions.
- `src/sim/__tests__/parity-replay.test.ts` — assert the m2.9 replay envelope and
  retain deterministic round-trip coverage.
- `src/persistence/__tests__/replay-repository.test.ts` — reject old m2.8
  envelopes while current m2.9 envelopes still load.
- `src/audit/__tests__/hero-value-tap-policy.test.ts` — keep the measurement tap
  policy on the same danger and context rules as production.
- `src/sim/__tests__/powers.test.ts` — replace the pinned downed, recovery,
  armed-countdown, expiry-event, and Heat-refund assertions.
- `src/sim/__tests__/m4-power-catalog.test.ts` — replace the catalog-wide
  out-of-context armed-window assertion with no-op and danger-prompt coverage.
- `src/sim/__tests__/gates-moments.test.ts` — keep both GATE-2 comparison taps
  inside useful context. Compare a burst with runway against one too close to
  goal, so the rail still measures better and worse timing instead of an
  accepted tap against a no-op.

Add or rewrite assertions for:

- An outfield tap outside useful context remains recorded, spends no Zone, and
  leaves the hero in `zone`.
- A later useful tap fires at full manual strength.
- A save-power tap opens the ten-second window even when a displayed enemy-held
  state becomes an enemy pass, shot, or loose ball before the input tick.
- A keeper tap outside the shared danger predicate is a recorded no-op.
- Context loss, knockdown, tackle recovery, or removal before an outfield input
  tick keeps the Zone and creates no two-second window.
- A shot on the final valid tick uses the save power before expiry.
- A save window that lapses emits one expiry event and resets Heat to zero.
- Interrupted wind-ups and Rally Cry keep their existing refunds.
- A goalkeeper carrying Gust follows the ordinary outfield rules.
- Both parity-replay tap paths wait for the first useful-context tick after
  `POWER_READY`, then record the tap there. The causal-divergence test and
  snapshot must keep proving that an accepted input changes deterministic
  output; never bless an inert taped envelope.

Run:

```bash
npx jest --runInBand --runTestsByPath \
  src/sim/__tests__/m2-9-context-only-manual-power.test.ts \
  src/sim/__tests__/powers.test.ts \
  src/sim/__tests__/m4-power-catalog.test.ts \
  src/sim/__tests__/gates-moments.test.ts \
  src/sim/__tests__/parity-replay.test.ts \
  src/persistence/__tests__/replay-repository.test.ts
```

Expected before implementation: the replacement assertions fail for the old
two-second outfield window, keeper expiry refund, and engine version.

### 2. Make stale outfield taps safe and move the engine to m2.9

Modify:

- `src/sim/powers.ts`
- `src/sim/types.ts`
- `src/sim/match.ts`
- `src/sim/runtime-golden.ts`
- `src/audit/hero-value-tap-policy.ts`
- `src/sim/__tests__/__snapshots__/parity-replay.test.ts.snap` only if the
  reviewed m2.9 replay output changes.

Changes:

- In the shared manual `POWER_TAP` path, keep save powers on the existing
  ten-second armed-window path.
- Put the defending-third danger prompt in one pure simulation helper. The dock,
  save `POWER_TAP` path, and audit tap policy all call it.
- Use holder team for `held`, passer team for `pass`, and `ballHolderTeam` for
  `loose`, with the inclusive third-line boundary. For `shot`, use shooter team
  alone: an enemy shot is dangerous from anywhere. Keep the existing restart
  reset for `ballHolderTeam`.
- For every other power, require its existing authored useful-context check at
  the processing tick. If false, return without state, event, Heat, or RNG
  changes. Do not create the old two-second armed window.
- Accept a save tap only when that shared predicate is true at the processing
  tick. Held-to-pass, held-to-shot, and enemy-origin loose transitions remain
  true, which preserves the displayed press without accepting pre-danger taps.
- On keeper-window expiry, set its gauge to zero. Do not change the refund path
  used by interrupted wind-ups or other stale activations.
- Preserve current tick order: shot resolution first, keeper expiry second.
- Set `ENGINE_VERSION` to `m2.9`.
- Update the `PowerState.armed` comment to describe the keeper window. Do not
  change the replay schema.
- Remove the audit policy's obsolete outfield late-window fallback.
- Run the runtime golden and parity tests. Update only values whose failure is
  explained by the versioned contract. Inspect score, event, and RNG changes
  before accepting a new value.

Run:

```bash
npx jest --runInBand --runTestsByPath \
  src/sim/__tests__/m2-9-context-only-manual-power.test.ts \
  src/sim/__tests__/runtime-golden.test.ts \
  src/sim/__tests__/parity-replay.test.ts \
  src/persistence/__tests__/replay-repository.test.ts \
  src/audit/__tests__/hero-value-tap-policy.test.ts
```

### 3. Use one truthful dock state for visibility, presses, and accessibility

Modify:

- `src/render/hero-power-dock.ts`
- `src/render/HeroPowerDock.tsx`
- `src/render/__tests__/hero-power-dock.test.ts`

Changes:

- Keep the existing fixed cell order.
- Replace the save-power half-pitch test with the shared simulation
  defending-third predicate.
- Return `FIRE!` for an enemy shot in flight from anywhere.
- Return `FIRE!` for an enemy-held, enemy-pass, or enemy-origin loose ball in the
  defending third. Return faded `ARMED` otherwise.
- Make `heroPowerPressable` true only for `fire`.
- Keep a running keeper window disabled and expose its remaining seconds.
- Replace the star with the authored first name. Keep the last name below it.
- Use the correct localized accessibility sentence for outfield ARMED,
  outfield FIRE, pre-danger keeper ARMED, keeper FIRE, running keeper window,
  and downed states. Announce remaining time only when the whole second changes.

Tests cover both team directions, the exact boundary, just outside the boundary,
held, pass, loose, shot, friendly possession, Gust on a goalkeeper, pressability,
and stable dock ordering.

Run:

```bash
npx jest --runInBand --runTestsByPath \
  src/render/__tests__/hero-power-dock.test.ts \
  src/render/__tests__/automatic-power-ui.test.ts
```

### 4. Keep every armed meter full until use

Modify:

- `src/render/match-rail.ts`
- `src/render/MatchScreen.tsx`
- `src/render/hero-charge-meter.ts`
- `src/render/__tests__/match-rail.test.ts`
- `src/render/__tests__/hero-charge-meter.test.ts`

Changes:

- Map `zone` and the keeper's `armed` window to display fraction `1`.
- Make `chargeMeter` return its ready state at full fill for the keeper's
  `armed` window, including when that keeper becomes the carrier.
- Keep charging heroes on their true gauge fraction.
- Show zero after firing, active use, or keeper-window expiry until Heat rebuilds.
- Do not change the underlying Heat thresholds or simulation gauge values.

Run:

```bash
npx jest --runInBand --runTestsByPath \
  src/render/__tests__/match-rail.test.ts \
  src/render/__tests__/hero-charge-meter.test.ts
```

### 5. Replace growth and the dotted body ring with the requested pitch marker

Modify:

- `src/render/zone-ready-look.ts`
- `src/render/worklet-atlas-frame.ts`
- `src/render/HeroPowerRings.tsx`
- `src/render/WorkletMatchOverlays.tsx`
- `src/render/pixel-glyphs.ts`
- `src/render/MatchScreen.tsx`
- `src/render/__tests__/zone-ready-look.test.ts`
- `src/render/__tests__/possession-ring.test.ts`
- `src/render/__tests__/pixel-glyphs.test.ts`
- Add a narrow `src/render/__tests__/hero-power-rings.test.ts` only if the current
  source-level ring coverage cannot assert the per-hero two-line layout.

Changes:

- Delete the armed-player scale increase. Atlas always draws the normal player
  size.
- Slow the existing tint cycle to about two wall-clock seconds. Keep its current
  speed compensation at 1x, 2x, and 3x. Reduce Motion uses one steady tint.
- Export and reuse the yellow possession oval's radius, drop, and stroke width.
  Draw one solid oval with the power's authored colour.
- Build one label for each visible hero: authored first name plus translated
  power name. Render `BO (GUST)` in the pitch font.
- Add `(` and `)` to the existing pixel alphabet.
- When the folded label is too wide, render the first name on line one and the
  complete parenthesized power name on line two. Center both lines. Do not
  truncate.
- Use the first whitespace-separated name token. Keep the existing last-name
  fallback for single-token names.
- When an armed hero carries the ball, suppress the yellow oval and show only
  the power-coloured oval. Keep the power marker and tint while a charged hero
  is down, but keep the button disabled.
- Draw the oval, label, and armed tint only for `zone` and a save keeper's
  `armed` window. Remove them as soon as the power enters `winding` or `active`,
  and assert that lifecycle at `POWER_FIRED`.
- During a keeper window, draw a horizontal bar above that keeper. Use the
  existing interpolated remaining fraction so it starts full, drains smoothly,
  and reaches empty at expiry. Pause freezes it; match speed changes wall-clock
  duration with simulation time. Stack it below any incapacity countdown.

Tests cover normal size, timing at each speed, Reduce Motion, exact oval geometry,
solid stroke, power colour, per-hero labels, parentheses, long translated names,
and the keeper countdown endpoints.

Run:

```bash
npx jest --runInBand --runTestsByPath \
  src/render/__tests__/zone-ready-look.test.ts \
  src/render/__tests__/possession-ring.test.ts \
  src/render/__tests__/pixel-glyphs.test.ts \
  src/render/__tests__/hero-power-dock.test.ts
```

### 6. Make every wasted event cross the screen without covering match lines

Modify:

- `src/render/match-banners.ts`
- `src/render/MatchScreen.tsx`
- `src/render/__tests__/match-banners.test.ts`
- `src/render/__tests__/match-ticker.test.ts`
- `src/render/__tests__/rival-victory.test.ts`
- `src/render/__tests__/worklet-atlas-retarget.test.ts`

Changes:

- Use `matchScreen.bannerPowerWasted` for every keeper expiry reason.
- Give each expiry its event-derived unique ticker ID and use `banner.id` as the
  animation key. Keep the `power-wasted` subject for clearing and lane identity,
  but exclude that subject from subject-based replacement and coalescing.
- Reuse the large red negative-goal presentation and left-to-right motion.
- Queue wasted lines in FIFO order while a goal, half-time, or full-time line
  owns the two-lane span. Start the next wasted line at the left edge when the
  span is free.
- If a priority match line arrives during a wasted crossing, preserve the
  wasted event and resume it from the left after the priority line.
- Keep existing pause, speed-change, and Reduce Motion behavior.
- Extend the full-time presentation hold until its queued wasted lines finish.
  Do not let screen teardown discard them.
- Advance and expire queued wasted lines from the RAF wall-clock path after the
  simulation freezes. Do not rely on the `if (advanced)` tick block. Keep the
  queue transition pure in `match-banners.ts` so full-time draining is covered
  headlessly.
- Under Reduce Motion, do not use the old zero-millisecond full-time deadline
  while a wasted line remains queued or visible. Derive the deadline from the
  remaining reduced-motion presentation and update both existing source-lock
  tests that pin the old expression.

Tests cover two repeated expiry events, unique animation restarts, FIFO order,
and blocking by goal, half-time, and full-time lines.

Run:

```bash
npx jest --runInBand --runTestsByPath \
  src/render/__tests__/match-banners.test.ts \
  src/render/__tests__/match-ticker.test.ts \
  src/render/__tests__/rival-victory.test.ts \
  src/render/__tests__/worklet-atlas-retarget.test.ts
```

### 7. Update localized copy and canonical documentation

Modify all seven catalogs:

- `content/i18n/en.json`
- `content/i18n/de.json`
- `content/i18n/es.json`
- `content/i18n/fr.json`
- `content/i18n/id.json`
- `content/i18n/pt-BR.json`
- `content/i18n/vi.json`

Modify contracts:

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/03-match-engine.md`
- `docs/04-superpowers.md`
- `docs/08-ui-ux.md`
- `docs/09-tech-stack.md` if its engine-version text or replay procedure is stale.
- `docs/superpowers/specs/2026-08-20-manual-hero-power-activation.md` — mark the
  replaced early-press and HOLD rules as superseded by the reviewed spec.

Copy changes:

- English `matchScreen.bannerPowerWasted` becomes `WASTED POWER`.
- Translate the same generic meaning in every catalog.
- Replace ARMED copy that says a power can be lost.
- Add or revise separate save-keeper FIRE copy for starting the ten-second
  window.
- Keep the running-window seconds copy.
- Remove the obsolete HOLD key from every catalog only after no source consumer
  remains. Treat `bannerNoShotOnNet` the same way if it has no other consumer.

Documentation changes record m2.9, context-only outfield presses, the
defending-third save exception, zero-Heat keeper expiry, the new pitch marker,
and the localized ticker. Search the full repository for stale `HOLD`,
two-second outfield windows, early-press loss, `NO SHOT ON NET`, goalkeeper
automatic-only claims, and current-engine `m2.8` statements.

Run:

```bash
npx jest --runInBand --runTestsByPath \
  src/i18n/__tests__/catalog.test.ts \
  src/i18n/__tests__/gates.test.ts \
  src/i18n/__tests__/glyph-coverage.test.ts \
  src/i18n/__tests__/voice.test.ts \
  src/ui/__tests__/acceptance-audit-regressions.test.ts
```

### 8. Verify the complete player-visible and deterministic contract

Run focused regression suites first:

```bash
npx jest --runInBand --runTestsByPath \
  src/sim/__tests__/m2-9-context-only-manual-power.test.ts \
  src/sim/__tests__/powers.test.ts \
  src/sim/__tests__/m4-power-catalog.test.ts \
  src/sim/__tests__/gates-moments.test.ts \
  src/sim/__tests__/runtime-golden.test.ts \
  src/sim/__tests__/parity-replay.test.ts \
  src/persistence/__tests__/replay-repository.test.ts \
  src/render/__tests__/hero-power-dock.test.ts \
  src/render/__tests__/hero-charge-meter.test.ts \
  src/render/__tests__/match-rail.test.ts \
  src/render/__tests__/zone-ready-look.test.ts \
  src/render/__tests__/possession-ring.test.ts \
  src/render/__tests__/pixel-glyphs.test.ts \
  src/render/__tests__/match-banners.test.ts \
  src/render/__tests__/match-ticker.test.ts \
  src/render/__tests__/rival-victory.test.ts \
  src/render/__tests__/worklet-atlas-retarget.test.ts \
  src/i18n/__tests__/catalog.test.ts \
  src/i18n/__tests__/gates.test.ts \
  src/i18n/__tests__/voice.test.ts \
  src/ui/__tests__/acceptance-audit-regressions.test.ts
```

Run the AUTO and balance rails because simulation behavior and the engine version
change, but do not run unrelated long-career or soak probes:

```bash
npx jest --runInBand --runTestsByPath \
  src/sim/__tests__/gates-auto.test.ts \
  src/sim/__tests__/power-cadence.test.ts \
  src/sim/__tests__/balance-rails.test.ts
```

Run the two thresholded manual-tap probes because the shared audit tap policy
changes. These are directly related measurement gates, not unrelated soak work:

```bash
npm run test:probe -- \
  src/audit/__tests__/power-firing-probe.test.ts \
  src/audit/__tests__/hero-value-probe.test.ts
```

Run static gates:

```bash
npx tsc --noEmit
npm run format:check
git diff --check
```

Use the quiet background browser pane only after headless checks pass. Mute it
immediately after navigation. Verify a manual match at phone and desktop widths:

- Bo's button shows `Bo`, `HEDGES`, ARMED, then FIRE only in context.
- Bo stays normal size, flashes slowly, and has the solid Gust oval.
- The pitch label reads `BO (GUST)` without clipping.
- The rail stays at 100% through Zone and a keeper window.
- Both defending-third directions produce the keeper FIRE prompt.
- A pressed keeper shows the ten-second overhead bar.
- Expiry sends `WASTED POWER` from left to right.
- A second expiry starts a separate crossing.
- Goal, half-time, and full-time lines are never covered.
- Reduce Motion uses a steady tint and the ticker's current reduced-motion rule.

Destroy the page, close the tab, stop only the server started for this check, and
audit listeners before handoff.

## Completion gate

The work is complete only when all focused tests, m2.9 replay checks, AUTO and
balance rails, both manual-tap probes, TypeScript, formatting, diff checks, and
silent phone/desktop visual checks pass. Report any byproduct such as the parity
snapshot or golden hash changes. Do not commit or merge unless the user asks.
