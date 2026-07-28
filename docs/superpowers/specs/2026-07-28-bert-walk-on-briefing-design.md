# Bert's briefings become walk-ons

**Date:** 2026-07-28
**Status:** Direction approved; contracts revised after review, implementing

Revised 2026-07-28 after two independent reviews. Every factual claim below was
re-checked against the code; the corrections are noted where they landed.

## Problem

Bert delivers all 24 of his briefings inside a framed dialogue window: a title
bar, a portrait boxed in a card, body copy, and a button to dismiss. The rookie
player's hello used to work the same way and no longer does — `PlayerWalkOnWelcome`
now walks the player's own sprite onto the screen they are already looking at,
says one line in a speech bubble, and leaves.

Bert never made that move. He is still in the box.

## Goals

- Every one of the 24 assistant-guide sequences is delivered as a walk-on.
- Bert enters once per sequence, not once per page.
- The money and navigation beats keep their spotlight and stay measured.
- Where a briefing's next move corresponds to an inbox alert, that alert glows
  once Bert has left.

## Non-goals

- No new sprite sheet. Bert's walk is built from the rectangles he already is.
- No change to `content/assistant-guide.json`'s *shape*. One copy edit is in
  scope (see "Content").
- No completion-tracking for objectives. Persistence is the inbox's job.
- Nothing in `src/sim/` or `src/game/` production code is touched, so
  `ENGINE_VERSION` is unaffected and no golden-replay decision arises.

## What exists today

`content/assistant-guide.json` holds 24 sequences. 23 are a single page;
`management-intro` has three. Each page carries `kicker`, `title`, `body`
(1–2 paragraphs), `buttonLabel`, an optional `objective`, and a `focus`.

`AssistantGuideFocusSchema` enumerates **26** values; content uses 24 (`desk`
and `training` are unused). Only two change what is drawn:

| `focus` | Behaviour today |
|---|---|
| `money` | Dims the screen, cuts a lit hole around the cash counter, hangs a `TutorialTapCue` |
| `navigation` | Separate render branch: rings the tab rail, floats a text card above it |
| all others | Full-screen dim, nothing else |

Separately, `src/application/assistant-guide.ts` exposes `AssistantObjective`
with six `target` values. Exactly one names an inbox row:
`training-ground-alert`. `ClubHomeScreen` then gets a `guideAlertId`, hangs a
`TutorialTapCue` on that row, and dims the others. That row does **not** glow.

Both things are called "objective" and are not the same. The content `objective`
is display copy; `AssistantObjective` is live state.

### The decision this reverses

`src/ui/__tests__/overlay-dismissal.test.ts:48` records, verbatim: *"Bert's
briefing advances only on its button: it is the game teaching, and an outside
tap would skip the instruction the next objective depends on."*

A walk-on is tap-anywhere by construction, so that rationale is being
overturned deliberately. The owner's call: one-shot rules are re-readable
**nowhere** by design, and a card remains acceptable for genuinely dense
teaching if one ever appears. Mitigations kept: no auto-advance, a
double-advance guard, and a visually distinct objective beat.

## Architecture

A wrapper component, matching the pattern `PlayerWalkOnWelcome` established.

| File | Change |
|---|---|
| `src/ui/BertBriefingWalkOn.tsx` | New. Owns spotlight, voice, focus lifting, modal semantics. |
| `src/ui/BertFullBody.tsx` | New. Moves out of the retiring file; gains `walking`. |
| `src/ui/bert-walk-frames.ts` | New. Two walk frames as pure integer deltas. |
| `src/ui/bert-briefing-beats.ts` | New. Pure sequence-to-beats flattening. |
| `src/ui/TutorialSpotlight.tsx` | New. `TutorialSpotlight` + the nav ring, moved out. |
| `src/ui/CharacterSpeechOverlay.tsx` | Three optional props. No behaviour change when omitted. |
| `src/ui/screens/ClubHomeScreen.tsx` | Glow on the guided alert row. |
| `App.tsx` | Sequence-level completion; active focus lifted into `guideFocus`. |
| `src/ui/AssistantGuideOverlay.tsx` | **Deleted.** Nothing of it survives in place. |

The old file is deleted rather than left as a husk. Review flagged that moving
`BertFullBody` out for naming hygiene while leaving `TutorialSpotlight` behind
applied the same rule two ways; both move, and the file goes.

## Data flow

A walk-on spans a sequence. `bert-briefing-beats.ts` flattens it into
**structured beats**, not parallel arrays — review was right that two arrays
kept in lockstep is a drift hazard:

```ts
export interface BriefingBeat {
  text: string;
  focus: AssistantGuideFocus;
  kind: 'body' | 'objective';
  pageIndex: number;
}
```

One beat per body paragraph, plus one per page `objective`. Schema bounds give
4 pages × (2 body + 1 objective) = **at most 12 beats**, not the 8 first
claimed. Real content maxes at 5 (`management-intro`); 22 sequences flatten to 2.

### New props on `CharacterSpeechOverlay`

```ts
/** Fires with the index of the beat now showing. */
onLineChange?: (index: number) => void;
/** The player sheet holds only a right-facing run, so the character is mirrored
 *  in every phase but `leaving`. A front-facing figure must opt out. Default true. */
mirrorSprite?: boolean;
/** Phase-aware character. `children` still works for callers that don't need it. */
renderCharacter?: (state: { phase: Phase; walking: boolean }) => React.ReactNode;
```

`renderCharacter` exists because the overlay keeps `arriving | speaking |
leaving` internal, and Bert must know when to run his legs. Without it he walks
off frozen in his talking pose.

## Completion contract

The single most consequential correction from review. `onDone` fires **once per
sequence**, but today's `advanceAssistantGuide` advances one *page* at a time.
Wire `onDone` to it naively and `management-intro` completes on page one.

`App.tsx` gains a sequence-level handler that performs only the last-page branch
of today's logic:

1. `store.completeAssistantGuide(assistantSequenceId)`
2. if this was the requested sequence: `setConciergeFocus(lastPage.focus)` and
   `setRequestedAssistantSequenceId(null)`

`assistantPageIndex` and the per-page loop retire with the window.

**Timing:** completion fires on `onDone`, i.e. *after* the exit walk. Completing
on the last tap would unmount Bert mid-stride, because `guideOverlayVisible`
derives from `assistantSequenceId` — the exit animation would never render.
The cost is that the screen stays tap-blocked for the exit (~0.8s); the
overlay's own `advance()` already ignores taps while leaving.

## Focus lifting

The second P1. `App.tsx` gates anchor measurement on the page focus:

```ts
guideFocus={assistantPage?.focus === 'money' || assistantPage?.focus === 'navigation' ? … }
```

If the wrapper owns the beat index, that prop stays on page 0 forever and the
money beat — the headline example — degrades to a plain dim with no cutout and
no `TutorialTapCue`.

So the active focus is lifted: `BertBriefingWalkOn` reports the current beat's
focus through `onFocusChange`, `App.tsx` holds it in state, and `guideFocus`
reads from that instead of `assistantPage`.

## Spotlight

`TutorialSpotlight` renders behind the walk-on as it does behind the window
today. The `money` beat keeps its `TutorialTapCue`. The `navigation` beat keeps
its ring and loses its floating card — Bert's bubble carries that line.

- During the entrance and exit walks there is no active beat: the spotlight
  holds the **first** beat's anchor on entry and the **last** on exit, so it
  never flashes to full-dim around a walk.
- Anchor changes mid-sequence **snap**. Nothing else in this UI eases a
  spotlight, and a sliding cutout would read as a different game.

`groundOffset` is one value for the whole walk-on, from the measured tab rail,
exactly as `PlayerWalkOnWelcome` takes it. Bert stands on the rail's top edge,
so the navigation ring is drawn below his feet.

## Objective and the inbox glow

1. The content `objective` becomes a beat with `kind: 'objective'`, styled
   distinctly from body beats so the one line that states the player's next move
   is not visually identical to flavour.
2. When `AssistantObjective.target` names an inbox row, that row glows —
   **after Bert has left**, per the owner's call, so the glow does not compete
   with the spotlight while he is still talking.

Only `training-ground-alert` names an inbox row today. The goal is written to
that reality rather than implying a general mechanism.

### Glow colour

The glow reuses the Train button's *geometry* but **not** its colour.
`docs/08-ui-ux.md:9` is explicit: hero gold is *"used only for hero/power
elements… nothing else may use it,"* and blue is the action and guidance
colour. The Train button's existing gold is out of scope to fix here; the new
glow is blue so it does not add a second violation.

```ts
boxShadow: '0 0 12px 4px rgba(63, 111, 181, 0.9)',
shadowColor: '#3f6fb5',
shadowOffset: { width: 0, height: 0 },
shadowOpacity: 1,
shadowRadius: 9,
elevation: 10,
```

Exported as a shared constant, not copy-pasted, so the two consumers cannot
drift.

**Note for the owner:** this is the one place the implementation departs from
the instruction. The ask was "similar to the facility button glow"; that glow is
gold, and gold is reserved. Geometry is identical, hue is not. Say the word and
it becomes gold.

## Bert's walk

Built from the thirty rectangles he already is. No sprite sheet, no atlas entry.

### Convention

Matching `PlayerRunSprite` exactly: **two frames at `STEP_MS = 130`**, a
`walking` prop that parks him on the standing frame. The caller animates
position and lean; the figure animates only itself.

### The cycle

Front-facing, in the Kairosoft manner — legs alternate under a bobbing body. A
side-on Bert would mean ~30 new rectangles and a second figure to keep in sync
forever.

**Integer deltas only.** Review correctly flagged that animating the ±5° arm
rotations would fight `docs/11-art-style.md`'s pixel grid — *"one logical pixel
= the unit; never half-pixels"* — and shimmer off-grid edges frame to frame.
Bert's authored pose already contains static rotations and those stay; the walk
adds none. Legs, shoes, arms and body all move by whole pixels.

| | Frame A (standing) | Frame B (step) |
|---|---|---|
| Legs | As authored | Vertical offsets swapped by whole pixels |
| Shoes | As authored | Follow their leg |
| Body | Baseline | Bobs 1px |
| Arms | As authored | Swapped by whole pixels; rotation untouched |

Deltas live in `bert-walk-frames.ts` as data.

### Pose and facing

Walking uses the arms-down variant; `pointing` is a talking pose and resumes
when he stops. `mirrorSprite={false}` — the mirror applies in every phase but
`leaving`, so it would flip his pointing arm for the whole time he talks.

### Reduced motion

Not merely "inherited". Reduced motion can be discovered *asynchronously* after
the overlay has begun arriving, which would stop the travel animation with Bert
still off screen. Turning it on must immediately park him on his mark, in the
standing frame, showing the current bubble.

## Content

**Unchanged.** Review proposed splitting `national-cup`'s 199-character
paragraph in two, and that was tried and reverted: `content.test.ts` locks
`body.length === 1` for every sequence after the opening, and its comment
records why the character cap was raised to 200 in the first place — *"the
Global Cup briefing, which is the owner's own words at 199 characters."*

The paragraph is deliberate, so the bubble wraps it instead. This is the one
review suggestion the codebase itself refused.

## Dropped fields

`title`, `kicker` and `buttonLabel` are no longer rendered.

`buttonLabel` is **26** replies, not 24 — it is per page, and `management-intro`
has three. They stay in the JSON; removing them from content and schema is a
follow-up scoped to 26.

Both reviews argued for relocating them as a closing `YOU: "…"` line under the
final bubble, on the grounds that they are the player character's only voice.
The owner's decision to drop stands and is implemented; the slot exists if it
is ever wanted back.

## Accessibility

- `BertBriefingWalkOn` **sets** `accessibilityViewIsModal` on its root.
  Correction from review: `CharacterSpeechOverlay` never had it, so this is new
  work, not something inherited.
- Each beat's text is the accessible label.
- Bert's name is dropped from the screen with `title`. The accessibility label
  is prefixed with the assistant's name so screen-reader users still hear who
  is speaking.
- The glowing inbox row keeps its existing label; the glow adds no announcement.
- Bubble width is `min(320, viewportWidth - 16)` so it cannot overflow a 320pt
  viewport once gutters are counted.

## Testing

`testEnvironment: 'node'`, no jsdom, and requiring `react-native` throws. These
components cannot be render-tested, which is why the fragile logic lives in pure
modules.

`bert-walk-frames.ts`:
- Both frames name the same rectangles, so neither can drift a part the other moves.
- Every offset is a whole number.
- Every frame-B rectangle stays inside the 104×180 box.

`bert-briefing-beats.ts`:
- Every real sequence flattens without throwing.
- `management-intro` yields its pages in order with focus `assistant` → `money`
  → `navigation`, and exactly one entrance worth of beats.
- Objectives emit as `kind: 'objective'`, last within their page.
- Beat count never exceeds 12 for any schema-valid sequence.

Sequence selection logic is untouched, so
`src/application/__tests__/assistant-guide.test.ts` and
`src/game/__tests__/assistant-guide.test.ts` must pass **unchanged**. If either
fails, the change has reached further than intended.

Presentation suites to update: `navigation-guide.test.ts`,
`overlay-dismissal.test.ts` (its recorded rationale is now stale).

## Verification

Static export (`export:web` + `canvaskit.wasm` into `dist` + serve); the dev
server does not boot here. Mute on load; close the tab and stop the server after.

The browser pane is `document.hidden` between tool calls, so an animation
sampled with `setTimeout` freezes at an endpoint and reports a still. Use a
`requestAnimationFrame` recorder with a forced paint, or the walk will look
broken when it is fine.

Acceptance gate: a first-season playthrough, per the owner.

## Risks

- **Reversing the button-only rule** is the real risk, not the animation. A
  stray tap now skips a rule stated once per career, with no re-read path. That
  is accepted deliberately.
- **The per-beat spotlight is exercised by exactly one sequence** in current
  content, so regressions there will not surface in the other 23.
- **Doubled taps per briefing** (one per paragraph plus objective, versus one
  button per page) is the recurring cost, more than the entrance itself.
- **The guided alert's `Pressable` already uses function-form style**, which
  this project has twice seen break layout on iOS only. The glow edit touches
  that expression and web verification would not catch it.

## Follow-ups

- Remove `buttonLabel`, `title`, `kicker` (26 replies) from content and schema.
- Remove `navItems` — five authored tab descriptions the schema *requires* on
  navigation pages, read by nothing but `content.test.ts`.
- Collapse the inert `focus` values, scoped against the schema's 26.
- Reconsider the Train button's gold glow against the colour rule.
