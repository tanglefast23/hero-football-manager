# Match button responsiveness — minimal fix plan

**Target:** local main at f37d1776 (clean at measurement time). At measurement
time, origin/main was two unrelated commits ahead; neither changed the
match-control files in this plan.

## Verified problem

The match actions are fast, but their acknowledgement is not.

- Desktop rail: 14 enabled controls took **51.5–68.3 ms** (median 56.1 ms,
  mean 59.0 ms) from pointer-down to the visible depressed state in the live
  MatchScreen QA fixture.
- Phone layout: speed, formation, playstyle, pause/resume, and all three energy
  choices showed **no press-down visual response within 220 ms**. After release,
  their state changes rendered in **6.8–11.6 ms** (mean 8.1 ms), which rules out
  slow match logic as the cause.
- Phone Settings, which already uses the shared wrapper, took **54.5 ms** to
  show its pressed state.

The same controlled press held each control for about 140 ms. Nested speed and
Settings controls did not also toggle pause.

## Exact causes

1. The phone controls in MatchScreen.tsx use raw Pressable and call
   playUiClickSfx() from onPress (release), so they have neither a pressed
   visual nor an audible acknowledgement while the pointer/finger is down.
2. React Native Web's Pressable uses a 50 ms default delayPressIn when the
   caller does not provide one. SfxPressable does not override it, so its
   pressed state and press-down cue begin only after that delay.

## Smallest safe change

1. Add an **opt-in** immediate-press flag to SfxPressable. On web, it passes
   delayPressIn={0}; native React Native already defaults press-in to zero, so
   do not add or change a native delay prop. Keep the wrapper default unchanged
   so no non-match surface changes.
2. Opt the match-only shared controls into that flag:
   MatchControlRail, the match variant of SettingsButton, and the visible
   SubstitutionBoard controls. Leave the full-screen dismissal scrim alone;
   it is not a visible button and scaling that surface would move the overlay.
3. Route the phone match controls through the same immediate shared wrapper and
   remove their direct release-time playUiClickSfx() calls. Preserve each
   gameplay action on onPress; only visual/audio acknowledgement moves to
   press-down. A dragged/cancelled gesture may acknowledge the finger-down, but
   it must not queue a formation, mentality, energy, pause, or substitution
   input.
4. Preserve the existing transform, copy, layout, disabled states, replay input
   timing, and one-cue ownership. Do not change match simulation, playback
   speed semantics, audio assets, or general management buttons.

## Focused verification

- Add source/contract coverage proving every match-control family opts into the
  zero-delay wrapper, actions remain on onPress, and direct duplicate click
  calls are gone.
- Add cancelled-drag cases for pause, speed, formation, playstyle, energy, and
  substitution controls: the press-down acknowledgement may occur, but no
  gameplay action or replay input may be queued.
- Add disabled cases for each match-control family: no pressed visual, no cue,
  and no action.
- Audio acceptance is one cue at press-down, zero release-time click cues, and
  no second cue from the matching onPress. This is true for both completed and
  cancelled presses; cancellation suppresses the gameplay action, not the
  acknowledgement already given.
- Run the focused press-cue, match-control, match-rail, substitution-board, and
  TypeScript checks.
- Repeat the same live browser probe on desktop and phone widths. Acceptance:
  every enabled match control shows press feedback by the next painted frame
  (target **<25 ms** on this rig), action changes remain correct, nested controls
  do not toggle pause, cancelled drags change no match choice, and disabled
  controls remain inert.
- Smoke the affected match controls in an iOS simulator if the current local
  build path is available. The measured before/after latency claim remains web
  only unless a native trace is actually captured.

## Non-goals

- No engine/replay/version change.
- No global button-motion redesign.
- No change to the deliberate press transform unless the zero-delay result
  still measures as unstable.
- No unrelated refactor, dependency, formatting sweep, commit, push, or deploy.
