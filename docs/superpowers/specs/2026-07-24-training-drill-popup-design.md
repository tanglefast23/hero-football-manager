# Training Drill Popup

**Date:** 2026-07-24
**Status:** Design approved
**Author:** brainstormed with Claude

## Problem

Assigning a player to training and picking their drill are one decision, but the
UI splits them across the screen. Tapping "+" on a player in the roster assigns
them to a slot, then the drill choices live in the **Training Focus** section
further down the page — on a phone you must scroll to find it. The tutorial even
ships a "Scroll down · Pick a stat" cue plus per-frame visibility measurement
just to paper over the gap.

Separately, the drill cards describe a stat only by its remaining headroom
("16 to cap"), which hides where the player actually stands.

## Goals

- Picking a drill happens **in place**: the moment a player is assigned, the
  drill choices appear as a popup over the roster. No scrolling, two taps total.
- Drill cards show **current / cap** (e.g. `30/39 DEF` in monospace) instead of
  "N to cap", with the full stat name still spelled out on the right (`+3
  DEFENSE`).
- One consistent interaction: the roster's train button (the "+" / slot-number
  badge) is the single entry point for assign, change drill, and remove.
- Delete the Training Focus section and its scroll-cue machinery outright.

## Non-goals

- No engine or economy changes. `src/game/` training rules, TP costs, caps, and
  slot limits are untouched. No `ENGINE_VERSION` bump.
- No change to the store's training actions (`toggleTrainingPlayer`,
  `setTrainingSlotStat`) beyond how the screen calls them.
- No redesign of the player file card or the This Week training set panel.

## Interaction flow (identical on phone and desktop two-column)

1. **Assign:** tap "+" on an unassigned player → the store adds the slot and
   auto-selects the player (existing behavior, `store.ts` `toggleTrainingPlayer`)
   → the drill popup opens immediately.
2. **Pick:** tap a drill card → `setTrainingSlotStat` fires, popup closes, the
   badge shows the slot number.
3. **Manage:** tap the slot-number badge of an already-assigned player → the
   same popup reopens with the current drill highlighted and a **"Remove from
   training"** button at the bottom. (Behavior change: today the badge tap
   removes instantly.) Remove closes the popup.
4. **Dismiss:** ×, backdrop tap, or Android back closes the popup without
   picking. The player stays assigned with no drill — the same incomplete state
   reachable today, and the badge reopens the popup.
5. **Slot limit:** tapping "+" for a 4th player shows the existing toast and
   does **not** open the popup. The screen gates on
   `assignedCount >= viewModel.maxSlots` before opening.
6. **Locked players:** the badge stays disabled for `trainingLocked` players —
   no popup.

## The popup

New component `TrainingDrillModal` in `src/ui/`, following the
`PostMatchSummaryModal` house pattern: RN `Modal` (`transparent`,
`statusBarTranslucent`, fade unless reduce-motion), dimmed backdrop that
dismisses on press, bottom-anchored paper card (`border-2 border-b-4 border-ink
bg-paper`), header with kicker ("Weekly plan"), title ("Training focus ·
{player name}"), and an × close button.

Body: one card per drill option, same visual language as the old Training Focus
rows —

```
SPRINTS I                    +3 PACE
30/39 PAC
```

- Sub-line is `{current}/{cap} {shortCode}` in monospace.
- Right side keeps `+{gain} {full stat label}`.
- The player's current drill (if any) uses the violet selected style.
- At-cap drills stay visible but disabled (existing dimmed style); `39/39 PAC`
  explains itself, no "At cap" copy needed.
- **Role filter:** goalkeepers don't see the SHO path (Finishing); outfield
  players don't see the REF path (Keeper Drills). Mirrors the player file
  card's attribute filter. Six cards, not seven.
- Footer: full-width **"Remove from training"** button, stamp-red styling,
  calls the existing toggle action. Always shown — the popup only ever opens
  for an assigned player, and right after assigning it doubles as an undo for
  a mis-tap.

Accessibility: cards keep `accessibilityRole="radio"` with checked/disabled
state; the hint reads the new numbers (e.g. "Duels I. Gains 3 Defense.
Currently 30 of 39."). The remove button is a plain button with the player's
name in its label.

## View-model changes (`src/application/view-models.ts`)

`TrainingSlotStatOption` gains three fields; `room` stays for anything that
still wants it, `atCap` still drives disabling:

- `current: number` — the player's value in that attribute.
- `cap: number` — the personal cap (already computed via
  `playerAttributeCaps`).
- `shortCode: 'PAC' | 'SHO' | 'PAS' | 'DEF' | 'TEC' | 'STA' | 'REF'` — the
  attribute code for the `30/39 DEF` line.

`selectedPlayerStatOptions` is built from `TRAINING_PATHS` filtered by the
selected player's role (GK → drop SHO path, otherwise drop REF path). The
popup renders exactly what it's handed; all logic stays in the headless,
Jest-testable application layer.

## Deletions (`src/ui/screens/SquadTrainingScreen.tsx`)

- The whole `TrainingFocusSection` and its SectionFlow entry. The screen
  becomes: roster → player file (when selected) → training set.
- The stat-picker scroll-cue machinery: `statPickerRef`,
  `statPickerVisible`, `measureTrainingGuideVisibility`,
  `scheduleTrainingGuideVisibility`, the `onScroll`/`onLayout` wiring that
  exists only to feed it, and the "Scroll down · Pick a stat" `TutorialTapCue`.

The screen owns one new piece of local UI state: whether the popup is open. It
derives everything else from `selectedPlayerId` and the view model.

## Tutorial

- `guidePlayers` ("Tap in here · Add up to 3 players.") is untouched.
- The old `guideStat` scroll cue is replaced: the popup auto-opening **is** the
  pick-a-stat step. If the user dismisses the popup while `guideStat` is still
  true (assigned, no drill picked), a `TutorialTapCue` points at the assigned
  player's slot badge — "Tap the number · Pick a drill".

## Testing

- **View model** (`src/application/__tests__/`): new fields carry the right
  current/cap/shortCode values; role filter drops REF for outfielders and SHO
  for GKs; at-cap flag unchanged. Tests must run in `full` career mode with the
  real `squadTrainingViewModel` signature (known vacuous-pass trap).
- **Source-string tests**: update `first-training-guidance.test.ts` (scroll cue
  and `statPickerRef` literals go away; new badge-cue literals pinned) and
  `squad-two-column.test.ts` (training-focus section entry and its weight
  formula removed).
- **Popup trigger logic**: assign opens, badge-tap reopens with remove visible,
  slot-limit tap doesn't open, locked players don't open, drill pick closes.
  Extracted into a small pure helper so it's testable headless.
- **Visual QA**: web static export (`export:web` + canvaskit copy + serve —
  dev server can't boot in worktrees), phone and ≥960pt desktop widths, plus
  the first-training tutorial path.
