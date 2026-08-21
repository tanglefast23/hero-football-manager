# First manual hero-power tutorial implementation plan

Date: 2026-08-21
Status: Council-audited; confirmed findings applied

## Goal

Add the approved two-pause lesson for the first manual hero power. The first
real `ARMED` state explains that the manager must wait. The same hero's first
later `FIRE!` state pauses again and requires the real power press. Completion
is saved once per career.

## Governing spec

`docs/superpowers/specs/2026-08-21-first-manual-hero-power-tutorial.md`

## Existing seams to reuse

- `heroPowerDockCells()` is the only tutorial readiness source. It already
  covers outfield context, save-power danger, downed heroes, MANUAL, and AUTO.
- `MatchScreen` already pauses after publishing a completed tick for first-match
  coaching.
- `TutorialSpotlight`, `TutorialTapCue`, and `useGuideAnchor` already provide
  the dim panes, arrow card, and window-relative target measurement.
- `AssistantGuideMilestone` and `completeGuideMilestone()` already provide an
  idempotent career flag and queued save.
- `firePower()` already queues the replay-safe `POWER_TAP`.

No external research is needed. These local contracts cover the feature.
There is no `docs/solutions/` knowledge base in this repository.

## Constraints

- No simulation behavior, RNG, replay format, Heat, or power-context change.
- No `ENGINE_VERSION` bump or golden replay update.
- No balance, soak, or large seed-rail run.
- No new dependency, modal framework, art, or audio.
- Keep all seven locale catalogs in parity.
- Preserve every unrelated file and change in the main worktree. Implement in
  the isolated `codex/hero-power-tutorial` worktree.

## Task 1: Persist completion through the existing guide milestone

**Files**

- Modify `src/game/assistant-guide.ts`.
- Modify `src/game/__tests__/assistant-guide.test.ts`.
- Modify `App.tsx`.

**Changes**

- [ ] Add `hero-power-tutorial-complete` to `AssistantGuideMilestone`.
- [ ] Map it to `guide:bert:hero-power-tutorial-complete`.
- [ ] Add an idempotence test that preserves unrelated event flags.
- [ ] In the watched `MatchScreen` call, pass tutorial eligibility only when:
  Bert teaches, `autoPowers` is false, and the milestone is incomplete.
- [ ] Pass a completion callback that calls
  `store.completeGuideMilestone('hero-power-tutorial-complete')`.
- [ ] Do not add a preference or save-schema field. `eventFlags` already accepts
  and persists namespaced strings.

## Task 2: Add stable target identity to the dock model

**Files**

- Modify `src/render/hero-power-dock.ts`.
- Modify `src/render/__tests__/hero-power-dock.test.ts`.

**Changes**

- [ ] Add `playerId` to `HeroPowerCell` from `player.def.id`.
- [ ] Add one small identity lookup that finds the same
  `{ slot, playerId, power }` cell regardless of its current state.
- [ ] Start only from the first stable cell whose state is `arm`.
- [ ] During the wait, keep the attempt through `arm`, `down`, or `null`.
  Advance only when that same cell becomes `fire`. Abort only when the identity
  disappears or another explicit scope/end condition fails.
- [ ] Prove stable multi-hero order.
- [ ] Prove substitution slot reuse cannot become the old tutorial target.
- [ ] Prove a save keeper and a goalkeeper carrying Gust use their existing
  cell states without tutorial-specific role logic.

## Task 3: Make the shared spotlight support the two hit-test modes

**Files**

- Modify `src/ui/TutorialSpotlight.tsx`.
- Modify `src/ui/__tests__/navigation-guide.test.ts`.

**Changes**

- [ ] Add optional blocking panes. Keep the current visual-only behavior as the
  default for every existing caller.
- [ ] Change the root from `none` to `box-none`, so children can block the dim
  panes while an empty spotlight cutout can reach its real target.
- [ ] Keep every dim pane `pointerEvents="none"` by default. Use `auto` only in
  blocking mode. Update the source-contract test that pins the old root value.
- [ ] Support an optional dismiss-only target over the cutout for `ARMED`.
  Hide this touch proxy from the accessibility tree and never call
  `firePower()` from it.
- [ ] Leave the `FIRE!` cutout empty. Physical and keyboard input must reach the
  real power button.
- [ ] Test the default, blocked outside panes, dismiss-only `ARMED` target, and
  `FIRE!` passthrough contracts.

## Task 4: Measure and isolate the real power button

**Files**

- Modify `src/ui/components/SfxPressable.tsx` only if its native host ref is
  required for measurement and focus.
- Modify `src/render/HeroPowerDock.tsx`.
- Modify `src/render/__tests__/hero-power-dock.test.ts`.

**Changes**

- [ ] Give `HeroPowerDock` the current guide target and an anchor callback.
- [ ] Use `useGuideAnchor` on only the matching real button. Re-measure after
  layout, wrap, resize, orientation, and desktop/phone changes.
- [ ] If needed, forward the existing `SfxPressable` ref to its native
  `Pressable`; do not change its press behavior or styling.
- [ ] During `FIRE!`, move accessibility focus to the real target where React
  Native supports it. Add a localized hint for Enter or Space. On web, rely on
  the restricted tab order rather than claiming native focus APIs work there.
- [ ] Hide every non-target dock cell from accessibility while either tutorial
  pause is active. Also disable its keyboard focus with `focusable={false}` and
  web `tabIndex={-1}`. Keep the real `ARMED` action disabled.
- [ ] Preserve the existing target label, 44-point minimum, animation, power
  color, and normal `onFire` callback.

## Task 5: Add the two-step match lesson state machine

**Files**

- Modify `src/render/MatchScreen.tsx`.
- Modify `src/render/match-screen-styles.ts` only for overlay placement.
- Add `src/render/hero-power-tutorial.ts`.
- Add `src/render/__tests__/hero-power-tutorial.test.ts`.

**State**

Put the transition rules in one small pure module. `MatchScreen` remains the
thin owner of pause reasons, refs, rendering, and accepted input.

Use one union for the full attempt:

- `armed`: first pause is open.
- `waiting-fire`: play is running, but this lesson still owns the match tutorial
  slot.
- `fire`: second pause is open.
- `null`: no attempt or completed/aborted attempt.

Store `{ slot, playerId, power }` in every non-null state. Store the tick that
closed `armed`, so `fire` cannot pause until a later tick.

**Changes**

- [ ] Add eligibility and completion callback props.
- [ ] After each individual `tick(s)` inside the catch-up loop, re-read
  `heroPowerDockCells(s, controlledTeam)`.
- [ ] On the first eligible `arm`, publish that tick, set `armed`, add only the
  `'tutorial'` pause reason, clear catch-up time, and stop the catch-up loop.
- [ ] Dismissing `armed` records no match input. Set `waiting-fire`, remove only
  `'tutorial'`, and sync all pause reasons.
- [ ] While `waiting-fire`, keep first-match coaching blocked. Re-check Teacher,
  MANUAL, watched-match eligibility, target identity, target state, and all
  blocking presentation reasons after each completed tick.
- [ ] On the same target's later `fire`, publish that tick, set `fire`, add
  `'tutorial'`, clear catch-up time, and stop the catch-up loop.
- [ ] Abort without persistence when the target identity changes, leaves, gets
  a red card, the scope fails, or full time arrives.
- [ ] Make first-match coaching and this attempt mutually exclusive for the
  whole `armed` → `waiting-fire` → `fire` lifetime.
- [ ] Change `firePower()` to keep `recordCoachingInput()`'s boolean result.
  During `fire`, reject every slot except the guided target.
- [ ] Only after the guided target queues one accepted `POWER_TAP`: call the
  completion callback once, clear the attempt, remove only `'tutorial'`, and
  sync pause reasons.
- [ ] Reuse `TutorialTapCue` with `onDismiss` for the step-1 card. Do not add a
  new `<Pressable>` opening to `MatchScreen`; its button-response test pins the
  current count at nine.
- [ ] Measure the target throughout the attempt. In `ARMED`, show a centered
  Continue card immediately if the anchor is unavailable, so the pause cannot
  deadlock. In `waiting-fire`, do not take the second pause until a valid target
  anchor exists.
- [ ] Put the hero tutorial in its own `pointerEvents="box-none"` overlay above
  the match. Blocking panes use `auto`; the `FIRE!` cutout stays childless and
  passes input to the real dock button.
- [ ] Disable the scorebar, Settings, desktop rail, phone coaching dock, and all
  other match controls during both pauses. Set non-target controls to
  `focusable={false}` and web `tabIndex={-1}` where disabled alone does not
  remove them from keyboard order. Hide them from accessibility too. The
  spotlight panes block their physical input.

**Focused flow tests**

- [ ] Catch-up cannot skip `ARMED` or the target `FIRE!` in one slow frame.
- [ ] At least one completed tick separates the pauses.
- [ ] The `ARMED` dismiss path records no `POWER_TAP`.
- [ ] A refused or wrong-slot `FIRE!` press does not complete or unpause.
- [ ] One accepted guided press queues one input and completes once.
- [ ] User, Settings, and background pauses remain after tutorial release.
- [ ] First-match coaching cannot start during `waiting-fire`.
- [ ] `arm`, `down`, and `null` do not discard the target while waiting; only
  the same identity in `fire` advances.
- [ ] Target substitution, red card, AUTO/Advisor loss, full time, and unmount
  leave the career flag incomplete.
- [ ] On web, Tab cannot reach scorebar, Settings, rail, coaching, or non-target
  hero controls during either pause.
- [ ] Missing anchor data cannot leave the match paused without an available
  action.

## Task 6: Add copy and update canonical behavior docs

**Files**

- Modify all files in `content/i18n/{en,es,id,vi,pt-BR,fr,de}.json`.
- Modify `docs/04-superpowers.md`.
- Modify `docs/08-ui-ux.md`.

**Copy**

- [ ] Add localized keys for:
  - `YOUR HERO POWER IS READY`
  - `ARMED means the power is charged. Wait for FIRE!`
  - `TAP NOW`
  - `CLICK NOW`
  - the `FIRE!` keyboard/accessibility hint.
- [ ] Keep `ARMED` and `FIRE!` consistent with their existing translated labels.
- [ ] Add the two-pause, watched-MANUAL, Teacher-only, once-per-career contract
  to docs 04 and 08.

## Task 7: Verify the smallest complete change

- [ ] Add one dev-harness case in
  `src/ui/dev-harness/entries/live-match-controls.tsx` only if browser storage
  prevents an ordinary career check. It must use production `MatchScreen` and
  a real manual power context, with no production-only QA branch.
- [ ] Run the focused tutorial, dock, spotlight, pause, assistant-guide, and App
  wiring tests.
- [ ] Run `src/render/__tests__/match-button-response.test.ts` to prove the
  tutorial did not change the pinned MatchScreen Pressable count.
- [ ] Run the i18n catalog, gate, glyph, and hardcoded-prose tests required by
  the new copy.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `git diff --check`.
- [ ] Use the silent background browser pane for one phone-width and one
  desktop-width MANUAL match. Prove the two pauses, opposite hit testing,
  exact copy, target side, and accepted `FIRE!` press. Do not play audio.
- [ ] Destroy the page, close the test tab, stop only the server started for
  this check, and run the required listener audit.

## Expected file scope

The implementation should touch only the files named above. Test tooling may
update no snapshots, generated files, lockfiles, or balance baselines.

## Council Audit record

Fable 5, Opus 5, and Grok 4.6 reviewed the same plan and repository evidence
on 2026-08-21. Codex confirmed the following findings in local code and applied
them above:

- Fable and Opus: physical blocking was incomplete without keyboard focus
  isolation, and `TutorialSpotlight` still pinned a non-interactive root.
- Opus: the proposed existing-target selector would abort before `FIRE!`; the
  transition rules need one pure runnable test; missing anchor data needed a
  non-deadlocking fallback.
- Fable: `MatchScreen` has a pinned nine-Pressable source contract, so the
  step-1 action must reuse `TutorialTapCue` rather than add another button.
- Grok reported no additional findings.
