# Pixel button system — design

**Date:** 2026-07-22
**Status:** approved direction, spec under review
**Owner:** UI

## Problem

The art bible's Track A button recipe is defined and already implemented once, but most
tappable chrome never uses it.

[docs/11-art-style.md](../../11-art-style.md) specifies every interactive control as a
"fat pixel lozenge": 2px ink outline, 2–3px stepped corner radius, a bold gloss band over
the top ~40%, a 2–3px dark lip at the bottom, a Silkscreen label, and a 2px drop on press.
It states the rule twice: **"Never a flat tinted rectangle."**

`ActionButton` in [src/ui/components/Scorecard.tsx](../../../src/ui/components/Scorecard.tsx)
implements that recipe faithfully and is used at ~60 call sites. But ~90 further
`<Pressable>` elements across the app are hand-rolled flat rectangles. The difficulty
picker in
[src/ui/screens/CharacterCreationScreen.tsx](../../../src/ui/screens/CharacterCreationScreen.tsx)
is representative — `border-2 border-ink/30 bg-white`, with a `○`/`●` text character
standing in for the selected state.

(Plain-language: the game already has one button that looks right. Most of the other
things you can tap are plain boxes, because drawing the proper button by hand takes about
ten lines of fiddly code every single time.)

### Why the drift happened

React Native has no `::before`/`::after`, so the bevel needs an `overflow-hidden`
container plus two absolutely-positioned sibling `View`s — one for the gloss, one for the
lip. That is ~10 lines of JSX per control. Any screen that needed a *toggle* rather than a
*CTA* had no shared component to reach for, so it fell back to a one-line flat box.

This matters for the fix: unless the beveled version becomes the path of least resistance
for toggles, rows, and icon buttons too, the same drift recurs on the next screen.

## Goal

Every Track A chrome control in the app is drawn with the bible's bevel, via shared
components that make the correct thing the easy thing — without turning content lists into
a wall of shouting buttons.

## Scope

All `<Pressable>` usages were inventoried and sorted into three buckets. Every count in
this spec is **JSX call sites, not rendered instances** — one `.map()` over six stats
renders twelve stepper buttons from two sites.

| Bucket | Contents | Count | In scope |
|---|---|---|---|
| **A · Chrome controls** | toggles, radio/segmented pickers, steppers, icon buttons, match controls | ~55 | **Yes**, minus tabs |
| **B · Content cards** | squad rows, fixture rows, ledger lines, story-event choices, market listings, building tiles | ~25 | No |
| **C · Structural** | invisible scrims, text-links (`‹ Title`, `Accessibility & controls`) | ~10 | No |

### Carve-outs, and why

**Content cards (bucket B) stay flat.** The bible draws cards (Track B) and buttons
(Track A) with deliberately different recipes and says "Never mix the recipes." It also
states buttons are "exactly where the palette is allowed to shout" — which only works if a
20-row squad list stays quiet. Beveling list rows would also breach the 60-30-10 colour
ratio in [docs/08-ui-ux.md](../../08-ui-ux.md).

**Tab strips stay flat.** The 5 bottom-nav tabs in
[src/ui/ManagementShell.tsx](../../../src/ui/ManagementShell.tsx) sit directly beneath the
Advance Week button, which doc 08 calls "the Kairosoft heartbeat button" — the screen's
intended focal point. Five vibrant bevels immediately below it would steal that focus and
breach "one focal point per section". The 4 Market desk tabs in
[src/ui/screens/MarketScreen.tsx](../../../src/ui/screens/MarketScreen.tsx) are excluded
with them so the rule has no exception to remember: **tabs are never beveled.** Both keep
their current tint + glyph selection.

Net in scope: **~46 controls** — ~38 management, ~8 match-day.

## Design

### The selected state: recessed slot vs raised bevel

A selected option is a full raised bevel in its family colour. An unselected option sits
in a **recessed slot** — no gloss, no lip, a paper-dark face, and a hard 3px ink-tinted
band across the top.

This gives three redundant cues — depth, colour, and the `●`/`○` marker. Doc 08 requires
that an active mode be "unmistakably selected without relying on color alone", so a
colour-only difference is not sufficient.

Two alternatives were rejected:

- **Bright raised vs grey raised.** The bible assigns grey the meaning
  "Disabled / structure / metal", so a grey raised button reads as unavailable rather than
  merely unchosen.
- **Selected looks pushed in.** The bible already assigns "drops ~2px and the top
  highlight collapses" to the *transient pressed* state. Reusing it for selection gives one
  visual two meanings, and a tapped-but-unselected button would look identical to the
  selected one mid-press.

The recess is drawn as a **flat band, not an inset shadow.** React Native has no portable
inset shadow, and the bible independently requires "hard bands, no gradients, no
anti-aliasing" — so the flat band is both the portable choice and the correct one.

### Corner radius

`ActionButton` currently uses `rounded-lg` (8px). The bible specifies a 2–3px stepped
radius. **All beveled controls, new and existing, move to `rounded-[3px]`.** This visibly
changes every primary button in the app; that is intended, so the new controls match the
bible rather than matching the one place the old code drifted from it.

### Components

Four files, one new directory-level concept. `PixelBevel` is presentational only — it has
no press behaviour and no accessibility role; the wrappers own those.

**`src/ui/components/PixelBevel.tsx`**

```tsx
export type BevelRamp =
  | 'violet' | 'blue' | 'gold' | 'red' | 'grey' | 'paper' | 'ink';
export type BevelDepth = 'raised' | 'recessed';

interface PixelBevelProps {
  ramp: BevelRamp;
  depth?: BevelDepth;   // default 'raised'
  pressed?: boolean;    // collapses the gloss
  compact?: boolean;    // shorter gloss band
  className?: string;
  children: ReactNode;
}
```

`raised` renders the clip container, 2px ink border, face fill, a gloss `View`
(`absolute inset-x-0 top-0`, `h-5` or `h-4` when `compact`, family light) and a lip `View`
(`absolute inset-x-0 bottom-0 h-2`, family dark) — the same heights `ActionButton` uses
today. `recessed` renders neither overlay and instead a top band `View`
(`absolute inset-x-0 top-0 h-1.5 bg-ink/20`) over a `bg-paper-dark` face with an `ink/50`
border.

**`recessed` is ramp-independent**: it is always the paper-dark slot, whatever `ramp` is
passed, because an unselected option has no family meaning. Phase 3 defines its own dark
recessed for match chrome.

Ramp values come from the existing `BUTTON_RAMP` table in `Scorecard.tsx`, which is moved
into `PixelBevel.tsx` and re-exported. One ramp is added: **`ink`** — face `bg-ink-soft`,
light `bg-grey-dark`, lip `bg-ink`, cream text. It exists for controls that sit on dark
chrome rather than the cream canvas: `SettingsButton`'s `match` variant today, and all of
phase 3. Its three steps are existing palette neutrals, not new colours.

Class strings stay full literals so NativeWind can extract them — no runtime string
interpolation of class names.

**`src/ui/components/PixelChoice.tsx`** — radio / segmented option.

```tsx
interface PixelChoiceProps {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityRole?: 'radio' | 'checkbox';  // default 'radio'
  ramp?: BevelRamp;                          // default 'violet'
  disabled?: boolean;
}
```

Selected → raised `ramp` bevel, cream label, `●`. Unselected → recessed paper bevel, ink
label, `○`. The marker is a leading glyph on the same line as `label`. When `detail` is
given it renders on a second line beneath the label, one size down, at `text-ink/60` when
unselected and `text-paper/75` when selected.

**`src/ui/components/PixelOptionRow.tsx`** — label left, value right.

```tsx
interface PixelOptionRowProps {
  label: string;
  value: string;
  detail?: string;
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;   // omit for a cycler; boolean for a switch
  disabled?: boolean;
}
```

The `active` rule is: **omit it and the row is a cycler** — always raised, neutral paper
face, value rendered in violet-dark (e.g. `Text size · ROOMY`). **Pass a boolean and the
row is a switch** — raised violet when `true`, recessed when `false` (e.g.
`Reduce motion · ON`). `accessibilityRole` is derived: `switch` when `active` is defined,
`button` when it is not.

**`src/ui/components/PixelIconButton.tsx`** — square 44pt single-glyph control.

```tsx
interface PixelIconButtonProps {
  glyph: string;              // '×' '‹' '⚙' '−' '+'
  onPress: () => void;
  accessibilityLabel: string;
  ramp?: BevelRamp;           // default 'paper'
  disabled?: boolean;
  className?: string;         // for layout-only classes at call sites
}
```

Fixed `h-11 w-11` to preserve the 44-point touch target.

`ActionButton` keeps its exact current public API (`label`, `onPress`,
`accessibilityLabel`, `disabled`, `variant`, `compact`, `maxFontSizeMultiplier`) and is
re-implemented over `PixelBevel`. **No `ActionButton` call site changes.**

### Press, sound, and haptics

All wrappers copy `ActionButton`'s existing pattern exactly:

- `Pressable` imported from `react-native` — never `react-native-gesture-handler`, which
  silently drops every `className` (project CLAUDE.md).
- `playUiClickSfx()` called inline in `onPress`.
- Press feedback is `transform: [{ translateY: 2 }]` plus gloss collapse.

They deliberately do **not** wrap `SfxPressable`, whose `opacity: 0.7` pressed state would
stack on top of the bevel's own press animation and wash the button out. Call sites keep
their existing `playManagementHaptic('select')` calls inside the `onPress` they pass in;
no haptics move into the components.

`transform` and `textShadow*` remain inline `style` props, matching `ActionButton` today —
neither is expressible as a NativeWind class, and no visual property is set through both
`className` and `style` on the same element.

## Implementation phases

**Phase 1 — primitive + wrappers.** Add the four components with tests. Refactor
`ActionButton` onto `PixelBevel` and tighten its radius to 3px. No call sites change yet;
the whole app should look identical except for corner radius.

**Phase 2 — management call sites (~38).** Convert bucket A on management screens.

All counts in this spec are **JSX call sites, not rendered instances** — a single
`.map()` over six stats renders twelve stepper buttons from two sites.

| File | Sites |
|---|---|
| `src/ui/SettingsOverlay.tsx` | 8 switch/cycler rows, glossary row, `SettingsButton` |
| `src/ui/screens/TitleLandingScreen.tsx` | settings row, `ToggleRow`, `CycleRow`, reduce-motion, HUD side, formation picker, tap-to-change |
| `src/ui/screens/CharacterCreationScreen.tsx` | difficulty picker, `−`, `+`, `AppearanceChoice` |
| `src/ui/screens/MarketScreen.tsx` | wage `−`, wage `+`, term radio, perk radio, pitch-card radio, disabled action |
| `src/ui/screens/SeasonEndScreen.tsx` | contract-term radio |
| `src/ui/screens/ClubHomeScreen.tsx` | radio group |
| `src/ui/screens/SquadTrainingScreen.tsx` | 3 icon buttons |
| `src/ui/screens/ClubFinancesScreen.tsx` | close `×`, relocate, demolish, Cancel |
| `src/ui/screens/FixtureMatchDayScreen.tsx` | back `‹`, hero-licence checkbox |
| `src/ui/screens/M2LeagueScreen.tsx` | division picker, option picker |
| `src/ui/PostMatchSummaryModal.tsx`, `PostMatchDevelopmentOverlay.tsx` | close `×` |
| `src/ui/screens/ChampionshipCelebrationScreen.tsx`, `AwakeningCutsceneScreen.tsx` | Skip |
| `App.tsx`, `src/ui/ScreenErrorBoundary.tsx` | Retry, Cancel, Confirm, Back to title |

**Phase 3 — match-day controls (~8).**
[src/render/MatchScreen.tsx](../../../src/render/MatchScreen.tsx) styles its chrome with
`StyleSheet` objects, not NativeWind classes, on a dark ground rather than cream, in the
app's most performance-sensitive file. It gets a `StyleSheet` twin of the bevel rather
than the className components. Landing it separately keeps a regression isolatable and
avoids colliding with in-flight balance work on the match engine.

## Testing

New `src/ui/__tests__/pixel-bevel.test.ts`, following the existing shallow
prop-inspection style used by `settings-button.test.ts` (components called as plain
functions, tree walked by `accessibilityRole`):

- `raised` renders both a gloss and a lip child; `recessed` renders the top band and
  neither overlay.
- `disabled` resolves to the grey ramp regardless of the requested ramp.
- `PixelChoice` selected vs unselected differ in depth **and** marker, and set
  `accessibilityState.selected` correctly.
- `PixelOptionRow` derives `accessibilityRole` `switch` when `active` is defined and
  `button` when omitted.

Regression gates: `npm test` green, `npm run lint:fix` clean, and a manual read of the
converted screens on web (`npx expo start --web`) and in the iOS simulator, since
NativeWind renders differently on the two.

Two known constraints:

- `src/ui/__tests__/settings-button.test.ts` asserts `SettingsButton`'s **root**
  `className` contains `h-11`, `w-11`, and `bg-ink-soft`. `PixelIconButton` satisfies this
  by construction — it is fixed `h-11 w-11`, and the new `ink` ramp's face class is
  `bg-ink-soft` — provided those classes land on the root `Pressable` rather than an inner
  `View`. If that test needs changing, it must be changed deliberately, not incidentally.
- The `check-nativewind-style-collisions.mjs` script referenced in the user's global
  config **does not exist in this repository**. className/style separation is verified by
  reading, not by running that script.

## Non-goals

- Content cards, list rows, tab strips, scrims, and text-links keep their current styling.
- No change to any button's colour *meaning* — violet confirm, red destructive, blue
  neutral, gold hero-only, grey disabled all stay as assigned in doc 08.
- No copy changes. Labels are converted as-is.
- No new dependencies.
