# True-ending crash plan

Status: Synthesized plan ready for Grok audit.

## Problem

The true-ending fireworks can build an unsorted React Native animation
`inputRange`. A shell near the end of the shared loop wraps its peak back to the
start, but the current array places that wrapped peak after the shell's opening
phase. React Native rejects the range before the ending can render.

The recovery screen also sits above the active locale provider. It therefore
falls back to English when a localized career screen throws.

## Codex plan

1. Move the firework keyframe calculation into `src/ui/endgame-fireworks.ts`.
   Return one sorted input range plus matching opacity and scale ranges.
2. Make `FireworkShell` use that single helper for both wrapped and ordinary
   shell phases.
3. Add a focused test which checks every generated ending shell. Every input
   range must be monotonically non-decreasing, and every output range must have
   the same length.
4. Add a localized screen error boundary inside the existing `LocaleProvider`.
   Keep the outer boundary as the English boot-failure fallback.
5. Add a focused localization test proving that career-screen failures render
   through the localized boundary.
6. Run the firework, ending-flow, localization, and TypeScript checks.
7. Open the true-ending QA route in the quiet browser pane and confirm the final
   scene renders without an error screen.

## Non-goals

- Do not change when the Week 30 result saves. Saving the result before a visual
  celebration is correct.
- Do not mark the true ending as watched when a screen crashes. That would hide
  the ending instead of fixing it.
- Do not change unrelated screen transitions. The failing range is owned by the
  firework shell animation.

## Grok independent solution

Grok independently found the same two root causes.

1. `FireworkShell` has three timing cases, not two. The current `wraps` branch
   only handles `gone` wrapping. At phase `0.88`, both `peak` and `gone` wrap,
   so the code creates `[0, 0.22, 0.88, 0.04, 1]`.
2. Sorting that array is not safe. It would detach opacity and scale values from
   the moments they describe.
3. The keyframe helper must handle these cases separately:
   - neither `peak` nor `gone` wraps;
   - only `gone` wraps;
   - both `peak` and `gone` wrap.
4. Tests must cover phases `0.50`, `0.70`, `0.84`, `0.88`, and `0.99`, plus
   every generated shell in all three ending scenes.
5. The error boundary is English because it renders above `LocaleProvider`.
   Grok proposed moving the provider above the boundary or passing localized
   copy into the boundary.
6. The saved result and ending flags must remain unchanged.

## Synthesized plan

1. Add one pure `fireworkShellKeyframes(phase)` helper beside
   `fireworkBursts`. It will return matching `inputRange`, `opacityRange`, and
   `scaleRange` arrays for the three timing cases above.
2. Make `FireworkShell` consume those arrays. Do not sort or clamp the existing
   values.
3. Test the five boundary phases and all generated shells. Assert monotonic
   input, equal range lengths, and values inside valid animation bounds.
4. Put a second `ScreenErrorBoundary` inside the existing `LocaleProvider`.
   This boundary catches career-screen failures in the selected language. Keep
   the current outer boundary as an English fallback for failures that happen
   before preferences load.
5. Keep `recoverFromScreenCrash`, `completeEndgameCelebration`, saved results,
   and ending flags unchanged.
6. Run the firework, endgame-flow, recovery-localization, and TypeScript checks.
7. Use the quiet browser QA route to render the true ending and verify that no
   error screen appears.

### Reconciliation

- Accepted from Grok: the explicit three timing cases and boundary phase tests.
- Rejected: merely sorting the old keyframes. Both reviews agree this is wrong.
- Adjusted from Grok: do not hoist preference ownership through the whole app.
  The existing provider can own a localized inner boundary with a smaller diff.
- Accepted from both: do not rewrite, skip, or mark the persisted ending as
  watched during recovery.

## Grok audit of synthesized plan

Grok found four useful gaps.

1. Accepted: name the exact time-ordered knot tables. For phase `0.88`, the
   both-wrap input must be `[0, 0.04, 0.22, 0.88, 1]` with opacity and scale
   values attached to those moments.
2. Accepted: pin the boundary order as outer English boundary → locale provider
   → inner localized boundary → every locale-backed route, including the true
   ending.
3. Accepted: add a non-English test which throws below the inner boundary and
   checks translated recovery copy.
4. Verified as already covered: `ScreenErrorBoundaryCatcher` clears its own
   error state before it calls `recoverFromScreenCrash`. No new reset mechanism
   is needed.

The implementation will use these exact input tables:

- No wrap: `[0, open, peak, gone, 1]`.
- Only `gone` wraps: `[0, gone - 1, open, peak, 1]`.
- Both wrap: `[0, peak - 1, gone - 1, open, 1]`.

Each table keeps its opacity and scale values beside the correct chronological
moment. Tests reject the original failing order explicitly.
