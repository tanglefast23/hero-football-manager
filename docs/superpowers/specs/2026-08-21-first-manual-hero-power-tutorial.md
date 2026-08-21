# First manual hero-power tutorial

Date: 2026-08-21
Status: Grok-audited; confirmed findings applied

## Goal

Teach the difference between `ARMED` and `FIRE!` at the moment each state first
matters. The lesson pauses play twice, uses the real hero-power control, and is
completed at most once in a career. An interrupted attempt remains eligible.

## Scope

This tutorial applies only when all of these conditions are true:

- The player is watching a match.
- Hero powers are set to `MANUAL`.
- Bert is in Teacher mode.
- The career has not completed this tutorial.
- A controlled-team hero has a real, engine-derived `ARMED` state.

`AUTO`, Quick Match, rival powers, power showcase clips, and Advisor mode never
show or complete this tutorial.

## Player flow

### 1. First `ARMED`

On the first eligible `ARMED` state:

- Finish and publish the current simulation tick.
- Pause the match before another tick runs.
- Keep the hero-power dock visible.
- Dim the full screen except the actual `ARMED` button and the tutorial card.
- Block every match control outside the highlighted button and tutorial card.
- Keep the real `ARMED` button disabled.
- Put a tutorial-owned, dismiss-only hit target over its spotlight cutout. That
  target must never call `firePower` or queue a `POWER_TAP`.

English copy:

> **YOUR HERO POWER IS READY**
>
> ARMED means the power is charged. Wait for FIRE!

Tapping the card or the dismiss-only target over the highlighted `ARMED`
button closes this step. The match resumes through the shared pause-reason
system. A separate user pause, Settings pause, background pause, or other
automatic pause remains active.

### 2. First later `FIRE!`

After the `ARMED` step closes, wait for the same hero's button to enter the real
engine-derived `FIRE!` state. At least one simulation tick must complete between
the two pauses.

When `FIRE!` appears:

- Finish and publish that simulation tick.
- Pause before another tick runs.
- Keep the real `FIRE!` button fully lit and leave its cutout as a true
  passthrough to that button.
- Dim and block everything outside that button.
- Point an arrow at the button.
- Show `TAP NOW` on touch devices and `CLICK NOW` with a mouse.
- Do not provide a separate Continue or Skip action.

The highlighted `FIRE!` button is the only active control. Its press must use
the normal `firePower` path. An accepted press queues the existing replay-safe
`POWER_TAP`, completes the career tutorial, removes only the tutorial pause,
and lets the next simulation tick process the power.

For Elastic Keeper and Giant GK, this press starts the existing ten-second save
window. The tutorial does not promise that a shot will arrive during that
window. A goalkeeper carrying an ordinary power follows the normal power rule.

## Target and interruption rules

- Select the first eligible `ARMED` cell in stable hero slot order.
- Keep that hero as the target for both steps.
- Hold one in-memory lesson attempt from the first pause until completion or
  abort, including the unpaused wait for `FIRE!`. No other match tutorial may
  start while this attempt owns the lesson slot.
- Use the same dock cell state that controls the visible `ARMED` and `FIRE!`
  labels. Do not copy `inUsefulContext` or goalkeeper danger logic into the
  tutorial.
- A hero whose first charged frame already says `FIRE!` does not start the
  tutorial. Wait for a real `ARMED` state. Never display `ARMED` over a real
  `FIRE!` control.
- If the target leaves the pitch, is sent off, or the match ends before the
  guided `FIRE!` press, do not complete the tutorial. Start again from the
  `ARMED` step in a later eligible match.
- If another full-screen match lesson or blocking presentation is active,
  defer this tutorial without marking it complete.
- Keep the target's normal `FIRE!` control usable during that defer. If the
  manager fires it, abort this attempt and retry the lesson in a later match.
- Re-check every scope condition and the current dock cell state when a defer
  lifts and before either pause. Step 1 requires a current `ARMED` cell. Step 2
  requires the same hero's current `FIRE!` cell. If the match is no longer a
  watched `MANUAL` Teacher match, abort without writing the milestone.
- Multiple charged heroes do not change the target during either pause.

## Once-per-career persistence

Reuse the existing assistant-guide milestone and `GameState.eventFlags` path.
Add one idempotent milestone named `hero-power-tutorial-complete`.

Write the milestone only after the guided `FIRE!` press is accepted by
`recordCoachingInput`. Do not write it when:

- the `ARMED` card opens or closes;
- an `AUTO` or Quick Match power fires;
- an unrelated hero fires;
- the target disappears; or
- the app or match closes before the guided press.

If the app closes between the two steps, the full two-step lesson starts again
on the next eligible `ARMED` state. No partial-progress flag is needed.

## Layout and interaction

- Spotlight the real dock position. The default is the bottom-right corner,
  but a saved right-side Match Info setting moves the power dock left. The
  tutorial must not move the control.
- Reuse `TutorialSpotlight`, `TutorialTapCue`, and the existing guide-anchor
  measurement pattern.
- Add the smallest optional touch-blocking behavior to the spotlight panes.
- During `ARMED`, the cutout holds the tutorial's dismiss-only hit target.
- During `FIRE!`, the cutout passes input to the real power button.
- Keep the target at least 44 points wide and high.
- Re-measure the target after a window resize, orientation change, phone versus
  desktop layout change, or dock wrap.
- The overlay must not hide the power button, carrier card, or tutorial card.

## Accessibility and localization

- Add copy keys to all seven locale catalogs.
- Mark every non-target match control unavailable during both pauses.
- Announce the first card as a modal instruction with one accessible Continue
  action. The visual target overlay can also dismiss a touch, but it is hidden
  from the accessibility tree.
- During the second pause, move accessibility focus to the real `FIRE!` button
  when the platform supports it.
- Make the real `FIRE!` button the only focusable control during step 2.
- Keep `TAP NOW` and `CLICK NOW` as the visible cue. Give the `FIRE!` button a
  localized accessibility hint that also explains Enter or Space activation.
- Do not rely on dimming or colour alone. The words `ARMED`, `FIRE!`, and the
  arrow/cue provide the state change.
- Follow Reduce Motion. The cue stays still when motion is reduced.
- Preserve High Contrast colors and the existing power-button accessibility
  label.

## Architecture and determinism

- This is a render, application, localization, and career-persistence change.
- Do not change power timing, useful-context rules, input ordering, Heat, RNG,
  or match results.
- Do not add a new replay input.
- Do not bump `ENGINE_VERSION`.
- Use the existing `'tutorial'` automatic pause reason. The hero-power lesson
  and first-match coaching must use one mutually exclusive in-memory lesson
  slot because a Set reason has no owner count. The hero-power attempt keeps
  that slot while play runs between its two pauses.
- Pause after the completed tick is published, matching first-match coaching.

## Acceptance criteria

- The first real controlled-team `ARMED` state in an eligible career pauses the
  match once and spotlights its real button.
- The first card shows the approved `ARMED` copy.
- Tapping the card or highlighted `ARMED` target resumes play without recording
  a power input.
- A later real `FIRE!` state for that hero pauses play after at least one more
  simulation tick.
- Only the highlighted `FIRE!` button accepts input during the second pause.
- Pressing it records one `POWER_TAP`, resumes play, and saves the completion
  milestone.
- Other pause reasons remain in force after either tutorial action.
- Closing the app or losing the target before the guided press leaves the
  tutorial eligible for a later match.
- The tutorial never appears in `AUTO`, Quick Match, Advisor mode, rival play,
  or presentation-only clips.
- Phone, desktop, right-side Match Info, Reduce Motion, High Contrast, and
  screen-reader paths keep the target visible and usable.
- Focused render, career-flag, localization, and TypeScript checks pass.

## Non-goals

- No change to hero-power balance or simulation behavior.
- No tutorial for automatic powers.
- No extra warning about early presses or short outfield timing windows.
- No second tutorial for goalkeeper save-window expiry.
- No persisted half-step or tutorial history beyond one completion milestone.
- No new modal framework, animation system, art, audio, or dependency.

## Grok audit record

Grok 4.6 reviewed this file at `high` effort on 2026-08-21. Codex confirmed and
applied all five findings: opposite per-step hit testing, ownership of the
unpaused wait, completion-only persistence naming, keyboard/screen-reader
isolation, and eligibility re-checks after deferral.
