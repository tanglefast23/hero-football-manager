# Desktop Two-Column Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Management screens auto-detect wide viewports (desktop/web ≥ 960pt) and flow their sections into two reading-order columns of approximately equal height, without ever splitting a section — phones keep the existing single column untouched.

**Architecture:** Screens already render as an ordered list of self-contained section blocks. We introduce three small layout primitives — a `useLayoutMode()` breakpoint hook, a pure `balancedSplitIndex()` partition function, and a `SectionFlow` component — then convert screens to declare their sections as data (`{key, weight, node}`). Weights are estimated from view-model content counts (deterministic, no layout jump, Jest-testable) rather than measured with `onLayout`. This plan builds the primitives and converts **ClubHomeScreen as the pilot**; remaining screens roll out in a follow-up plan once the pilot look is approved.

**Tech Stack:** React Native + NativeWind (className only, imports from `react-native` never gesture-handler), Jest + ts-jest, pure-TS logic in plain `.ts` files per project convention.

**Layout rules encoded:**
- Sections are atomic — never chopped across columns (user rule).
- Reading order preserved: column 1 top→bottom, then column 2.
- Columns balanced by estimated weight; ties prefer a taller first column.
- Wide content capped at `max-w-5xl` (1024px) centered; column gap `gap-6` (24px — 8-point grid).
- Fewer than 2 sections ⇒ single column even on wide viewports.

---

### Task 1: Pure partition function (`balancedSplitIndex`)

**Files:**
- Create: `src/ui/layout/section-partition.ts`
- Test: `src/ui/__tests__/section-partition.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/ui/__tests__/section-partition.test.ts
import { balancedSplitIndex } from '../layout/section-partition';

describe('balancedSplitIndex', () => {
  it('returns 0 for no sections', () => {
    expect(balancedSplitIndex([])).toBe(0);
  });

  it('puts a lone section in the first column', () => {
    expect(balancedSplitIndex([5])).toBe(1);
  });

  it('splits an equal pair evenly', () => {
    expect(balancedSplitIndex([1, 1])).toBe(1);
  });

  it('prefers the taller first column on ties', () => {
    expect(balancedSplitIndex([1, 1, 1])).toBe(2);
  });

  it('keeps a heavy leading section alone in column one', () => {
    expect(balancedSplitIndex([5, 1, 1])).toBe(1);
  });

  it('never strands a heavy trailing section by overfilling column one', () => {
    expect(balancedSplitIndex([1, 1, 5])).toBe(2);
  });

  it('balances a realistic club-home mix', () => {
    // next match 7 · inbox 6 · board ultimatum 10 · table 12 → [7,6]=13 vs [10,12]=22
    // is the closest whole-section split (13 vs 22 beats 23 vs 12).
    expect(balancedSplitIndex([7, 6, 10, 12])).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/__tests__/section-partition.test.ts`
Expected: FAIL — `Cannot find module '../layout/section-partition'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ui/layout/section-partition.ts

/**
 * Splits an ordered list of section weights into two columns that read in
 * order (column 1 top-to-bottom, then column 2) while keeping the column
 * totals as close as possible. Returns the index of the first section that
 * belongs to column 2 (0 when there are no sections).
 *
 * Sections are atomic — only whole sections move — so a perfectly even
 * split is not always possible. Ties prefer the taller first column.
 */
export function balancedSplitIndex(weights: readonly number[]): number {
  if (weights.length === 0) return 0;
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let bestSplit = 1;
  let bestImbalance = Infinity;
  let leftSum = 0;
  for (let split = 1; split <= weights.length; split += 1) {
    leftSum += weights[split - 1];
    const imbalance = Math.abs(leftSum - (total - leftSum));
    // <= so equal-imbalance ties land on the later split: taller left column.
    if (imbalance <= bestImbalance) {
      bestImbalance = imbalance;
      bestSplit = split;
    }
  }
  return bestSplit;
}
```

Note the `<=` tie-break: for `[1,1,1]` splits 2 and 3 do NOT tie (imbalances 1 and 3); splits 1 and 2 tie at 1, and `<=` picks 2 — taller left column, matching the test.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/__tests__/section-partition.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/ui/layout/section-partition.ts src/ui/__tests__/section-partition.test.ts
git commit -m "feat: add reading-order column partition for wide layouts"
```

---

### Task 2: Breakpoint hook (`useLayoutMode`)

**Files:**
- Create: `src/ui/layout/layout-mode.ts` (pure — the file tests import)
- Create: `src/ui/layout/use-layout-mode.ts` (RN hook wrapper — never imported by tests)
- Test: `src/ui/__tests__/layout-mode.test.ts`

> **Why two files (discovered during execution):** this project's Jest setup is plain ts-jest with `testEnvironment: 'node'` — importing any module that imports `react-native` fails with "Cannot use import statement outside a module". Every tested module in `src/ui` is pure TS for exactly this reason. The pure rule lives in `layout-mode.ts`; the hook wraps it in `useLayoutMode.ts`.

- [ ] **Step 1: Write the failing test** (the width→mode rule is pure; the hook is a thin wrapper)

```ts
// src/ui/__tests__/layout-mode.test.ts
import { TWO_COLUMN_MIN_WIDTH, layoutModeForWidth } from '../layout/layout-mode';

describe('layoutModeForWidth', () => {
  it('keeps phones and portrait tablets single-column', () => {
    expect(layoutModeForWidth(390)).toBe('single');   // iPhone
    expect(layoutModeForWidth(834)).toBe('single');   // iPad portrait
    expect(layoutModeForWidth(956)).toBe('single');   // iPhone Pro Max landscape web
    expect(layoutModeForWidth(TWO_COLUMN_MIN_WIDTH - 1)).toBe('single');
  });

  it('flows desktop-width viewports into two columns', () => {
    expect(layoutModeForWidth(TWO_COLUMN_MIN_WIDTH)).toBe('twoColumn');
    expect(layoutModeForWidth(1024)).toBe('twoColumn'); // iPad landscape
    expect(layoutModeForWidth(1280)).toBe('twoColumn');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/__tests__/layout-mode.test.ts`
Expected: FAIL — `Cannot find module '../layout/use-layout-mode'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ui/layout/layout-mode.ts

export type LayoutMode = 'single' | 'twoColumn';

/**
 * Viewports at least this wide flow management sections into two columns.
 * 960 keeps every phone on the proven single column — including the largest
 * iPhone landscape web viewports (~956pt) — while landscape tablets and
 * desktop windows go wide.
 */
export const TWO_COLUMN_MIN_WIDTH = 960;

export function layoutModeForWidth(width: number): LayoutMode {
  return width >= TWO_COLUMN_MIN_WIDTH ? 'twoColumn' : 'single';
}
```

```ts
// src/ui/layout/use-layout-mode.ts
import { useWindowDimensions } from 'react-native';
import { layoutModeForWidth, type LayoutMode } from './layout-mode';

export type { LayoutMode } from './layout-mode';

/** Auto-detects the management layout and re-renders live on window resize. */
export function useLayoutMode(): LayoutMode {
  const { width } = useWindowDimensions();
  return layoutModeForWidth(width);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/__tests__/layout-mode.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/ui/layout/use-layout-mode.ts src/ui/__tests__/layout-mode.test.ts
git commit -m "feat: add auto-detected single/two-column layout mode"
```

---

### Task 3: `SectionFlow` component

**Files:**
- Create: `src/ui/layout/SectionFlow.tsx`

No new test file — the partition logic is covered by Task 1, the mode by Task 2, and the pilot conversion test in Task 4 asserts the wiring. (Project UI-component convention is source-string tests, not renderer tests.)

- [ ] **Step 1: Write the component**

```tsx
// src/ui/layout/SectionFlow.tsx
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { balancedSplitIndex } from './section-partition';
import type { LayoutMode } from './layout-mode';

export interface FlowSection {
  /** Stable identity for the section across renders. */
  key: string;
  /**
   * Estimated height in abstract units (≈ one card row each). Derive from
   * view-model content counts so the estimate tracks real content — e.g.
   * `2 + 2 * alerts.length`. Only relative sizes matter.
   */
  weight: number;
  node: ReactNode;
}

/**
 * Lays management-screen sections out as one column (phones — unchanged
 * look) or two reading-order columns (wide viewports). Sections are atomic:
 * one never splits across columns. Column 1 fills top-to-bottom, then
 * column 2, split where the estimated heights balance best.
 */
export function SectionFlow({ mode, header, sections }: {
  mode: LayoutMode;
  /** Optional full-width block (greeting, page title) rendered above the columns. */
  header?: ReactNode;
  sections: FlowSection[];
}) {
  if (mode === 'single' || sections.length < 2) {
    return (
      <View>
        {header}
        <View className="gap-6">
          {sections.map(section => (
            <View key={section.key}>{section.node}</View>
          ))}
        </View>
      </View>
    );
  }

  const split = balancedSplitIndex(sections.map(section => section.weight));
  return (
    <View className="w-full max-w-5xl self-center">
      {header}
      <View className="flex-row gap-6">
        <View className="flex-1 gap-6">
          {sections.slice(0, split).map(section => (
            <View key={section.key}>{section.node}</View>
          ))}
        </View>
        <View className="flex-1 gap-6">
          {sections.slice(split).map(section => (
            <View key={section.key}>{section.node}</View>
          ))}
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/ui/layout/SectionFlow.tsx
git commit -m "feat: add SectionFlow two-column section layout component"
```

---

### Task 4: Pilot conversion — ClubHomeScreen

**Files:**
- Modify: `src/ui/screens/ClubHomeScreen.tsx`
- Test: `src/ui/__tests__/club-home-two-column.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/ui/__tests__/club-home-two-column.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('club home two-column layout', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/ClubHomeScreen.tsx'),
    'utf8',
  );

  it('flows sections through SectionFlow with the auto-detected mode', () => {
    expect(source).toContain('useLayoutMode');
    expect(source).toContain('<SectionFlow');
  });

  it('lets SectionFlow own inter-section spacing', () => {
    expect(source).not.toContain('mt-6'); // section gaps now come from the flow
  });

  it('derives section weights from view-model content counts', () => {
    expect(source).toContain('viewModel.alerts.length');
    expect(source).toContain('viewModel.table.length');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/__tests__/club-home-two-column.test.ts`
Expected: FAIL on all three assertions

- [ ] **Step 3: Convert the screen**

In `src/ui/screens/ClubHomeScreen.tsx`:

**3a. Add imports** after the existing `SfxPressable` import:

```tsx
import { SectionFlow, type FlowSection } from '../layout/SectionFlow';
import { useLayoutMode } from '../layout/use-layout-mode';
```

**3b. At the top of the component body** (after `const fixtureIsThisWeek = ...`):

```tsx
const layoutMode = useLayoutMode();
```

**3c. Build the sections array** (immediately after), moving each existing JSX block into a `node` **verbatim except for the exact wrapper changes noted**. The five sections, in current file order:

```tsx
const sections: FlowSection[] = [
  {
    key: 'next-match',
    weight: 7,
    node: (
      // MOVE: the entire <PaperPanel kicker="Next match" ...> ... </PaperPanel>
      // block, unchanged.
    ),
  },
  {
    key: 'inbox',
    weight: 2 + 2 * Math.max(viewModel.alerts.length, 1),
    node: (
      // MOVE: the block that starts <View className="mt-6"> and contains
      // <SectionLabel eyebrow="Inbox" — change ONLY its outer wrapper from
      // <View className="mt-6"> to <View>.
    ),
  },
  ...(viewModel.boardResolution
    ? [{
        key: 'board-resolution',
        weight: 10,
        node: (
          // MOVE: the JSX inside {viewModel.boardResolution ? ( ... ) : null}
          // — change ONLY its outer wrapper from <View className="mt-6"> to
          // <View>. The surrounding ternary is replaced by this spread.
        ),
      }]
    : []),
  ...(viewModel.boardUltimatum
    ? [{
        key: 'board-ultimatum',
        weight: 8 + 2 * viewModel.boardUltimatum.candidates.length,
        node: (
          // MOVE: the JSX inside {viewModel.boardUltimatum ? ( ... ) : null}
          // — change ONLY the outer wrapper className ternary from
          //   guideBoard ? 'relative mt-6 border-2 border-blue-dark bg-blue-light p-1' : 'relative mt-6'
          // to
          //   guideBoard ? 'relative border-2 border-blue-dark bg-blue-light p-1' : 'relative'
        ),
      }]
    : []),
  {
    key: 'table',
    weight: 2 + viewModel.table.length,
    node: (
      // MOVE: the block that starts <View className="mt-6"> and contains
      // <SectionLabel eyebrow={viewModel.divisionLabel} — change ONLY its
      // outer wrapper from <View className="mt-6"> to <View>.
    ),
  },
];
```

**3d. Replace the return statement.** The greeting row and pixel divider become the `header`; everything else is the flow:

```tsx
return (
  <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
    <SectionFlow
      mode={layoutMode}
      header={
        <>
          {/* MOVE: the greeting <View className="flex-row items-end justify-between"> block, unchanged */}
          {/* MOVE: the pixel divider <View className="my-5 h-0.5 bg-ink/15" />, unchanged */}
        </>
      }
      sections={sections}
    />
  </ScrollView>
);
```

Weight rationale (1 unit ≈ one card row): next-match panel is a fixed-size card (7); inbox is a label (2) plus ~2 rows per alert card, minimum one row for the empty-desk card; board resolution is a fixed tall card (10); ultimatum is a tall card (8) plus 2 per candidate row; table is a header (2) plus one row per club.

- [ ] **Step 4: Run the test and typecheck**

Run: `npx jest src/ui/__tests__/club-home-two-column.test.ts && npx tsc --noEmit`
Expected: PASS, 3 tests; no type errors

- [ ] **Step 5: Run the full UI test suite for regressions**

Run: `npx jest src/ui`
Expected: all pass. Watch specifically `navigation-guide.test.ts` and `opening-brief.test.ts` (they exercise home-screen guidance anchors; tutorial cues position relative to their own section View, which moves as a unit, so they should pass unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/ClubHomeScreen.tsx src/ui/__tests__/club-home-two-column.test.ts
git commit -m "feat: flow club home sections into two columns on wide viewports"
```

---

### Task 5: Tutorial cue calibration for desktop viewports

**Why:** the guide system is measurement-driven (anchors report absolute window coords via `measureInWindow`; inline `TutorialTapCue`s position relative to their own section, which moves as a unit), so most cues survive the re-layout automatically. This task pins that with tests at desktop widths and verifies re-measurement fires when the layout mode flips.

**Files:**
- Modify (append tests only): `src/ui/__tests__/tutorial-cue-position.test.ts`

- [ ] **Step 1: Append a desktop describe block to the existing test file** (do not modify existing tests):

```ts
describe('desktop viewports', () => {
  it('centers a cue over an anchor in the right column without clamping', () => {
    // a column-2 card on a 1280pt-wide desktop window
    const anchor = { x: 700, y: 400, width: 200, height: 56 };
    expect(tutorialCuePosition(anchor, 1280)).toEqual({ left: 727, top: 462 });
  });

  it('clamps cues to the gutter on ultrawide viewports', () => {
    const anchor = { x: 2480, y: 300, width: 80, height: 44 };
    expect(tutorialCuePosition(anchor, 2560).left).toBe(2406); // 2560 - 146 - 8
  });

  it('keeps a column-2 target visible-check working with absolute coords', () => {
    const viewport = { x: 0, y: 0, width: 1280, height: 800 };
    expect(isTutorialTargetVisible({ x: 700, y: 750, width: 200, height: 56 }, viewport)).toBe(true);
    expect(isTutorialTargetVisible({ x: 700, y: 900, width: 200, height: 56 }, viewport)).toBe(false);
  });
});
```

(If the file's existing imports lack `isTutorialTargetVisible`, add it to the import list.)

- [ ] **Step 2: Run** `npx jest src/ui/__tests__/tutorial-cue-position.test.ts` — all pass, including pre-existing tests.

- [ ] **Step 3: Manual re-measurement check (part of visual QA):** with the web build at desktop width, trigger the money guide (`guideFocus="money"`) and resize the window across the 960 breakpoint — the cue must track the money chip. The HUD's `onLayout={moneyGuideAnchor.scheduleMeasurement}` fires on any HUD frame change, which a mode flip causes.

- [ ] **Step 4: Commit**

```bash
git add src/ui/__tests__/tutorial-cue-position.test.ts
git commit -m "test: pin tutorial cue positioning at desktop viewport widths"
```

**Rollout-phase note (phase 2 screens):** guided flows with scroll-dependent COPY — `market-scroll-guidance` ("scroll down") and ClubFinances' scroll-to-section anchors — need a desktop copy/behavior audit when those screens convert: on two columns the target may be beside you, already visible, making "scroll down" wrong. Their `isTutorialTargetVisible` logic adapts automatically; the words don't.

---

### Task 6: Full-suite verification + visual QA

- [ ] **Step 1: Full test run**

Run: `npm test`
Expected: entire suite green (see memory note: some pre-existing expected failures may exist on balance branches — anything already failing on this branch's base is out of scope; nothing NEW may fail).

- [ ] **Step 2: Visual QA on web (desktop shape)**

```bash
npm run export:web
npx serve dist -p 4173
```

Open the Browser pane at `http://localhost:4173`, resize to 1280×800: Home tab must show two balanced columns, sections whole, content capped at 1024px centered. Resize to 390×844: identical to today's phone layout.

**Known worktree hazard:** web boot can hang on the SQLite worker / missing `canvaskit.wasm` in worktrees. If the export won't boot here, defer visual QA to the main checkout after merge — the Jest suite is the merge gate; visual QA is the acceptance gate before converting more screens.

- [ ] **Step 3: Screenshot both shapes and share with the user for design sign-off before the rollout plan.**

---

## Rollout template rules (from the pilot's quality review, 2026-07-23)

1. **Sections array stays in the component body**, but screens past ~3 sections or with 50+ line nodes (ClubFinances, Market, SquadTraining) extract each `node` into a named section component (`<NextMatchSection …/>`) — scannable array, weight next to a named thing, per-section `React.memo` available if resize jank appears. Do NOT standardize a `buildSections(viewModel)` free helper (huge parameter lists for no gain).
2. **Weight scale is "1 unit ≈ one card row", and weights must be conditional when a section's height genuinely varies.** (Pilot fix: board-resolution is `soldPlayer && replacementPlayer ? 13 : 6`, not flat 10.) Fixed weights only for genuinely fixed-height cards.
3. **Re-derive the `not.toContain('mt-6')` test guard per screen** — it only works where `mt-6` was exclusively inter-section spacing. Verify before copying.
4. **Scroll-to-section anchors break in two columns** (y-offset is ambiguous across columns). ClubFinances `scrollRef`/`onLayout` and Market's scroll guidance must either convert to `measureInWindow`-based positioning (like tutorial cues) or gate scrolling behavior to single mode. Unvalidated until the first anchored screen converts.
5. **Audit guided copy per screen** — "scroll down"/"below" can be false when the target is in the adjacent column; overlays/modals are structurally unaffected.
6. **No local UI state inside a section** — breakpoint crossings remount sections (documented on SectionFlow). Lift state to the view-model (board-ultimatum's `protectedPlayerId` is the model).
7. **If resize jank ever appears**, fix it once in `useLayoutMode` (notify only on mode flips via `useSyncExternalStore`), not per screen — currently it re-renders on every resize frame, harmless at pilot scale.

## Out of scope (follow-up plan after pilot sign-off)

Rollout of the same conversion to the remaining management screens, in this order (simplest first, validating the pattern before the monsters):
1. `WeeklyReviewScreen`, `SeasonEndScreen`, `FixtureMatchDayScreen`, `HirePitchScreen`, `StoryEventScreen`, `NewGameWelcomeScreen`, `LeagueTableScreen`, `M2LeagueScreen`
2. `MarketScreen`, `SquadTrainingScreen` (dense; may want master/detail rather than plain two-column — design conversation first)
3. `ClubFinancesScreen` — extra care: it has `scrollRef` + `onLayout` scroll-to-section anchors (`ClubFinancesScreen.tsx:58,967`) that assume a single column; anchor targets must be looked up per-column after conversion.

Exempt (full-bleed, already scale-based): `MatchScreen`, `AwakeningCutsceneScreen`, `ChampionshipCelebrationScreen`, `TitleLandingScreen` (own layout), QA screens.

**Design sign-off (2026-07-23):** User approved the six-page desktop mockups (artifact `hfm-desktop-mockups`, claude.ai/code/artifact/968057f5-b334-4999-801b-a7805f2f4f0c). Approved decisions for the follow-up plans:
- All five management tabs use the two-column SectionFlow with the column assignments shown in the mockups.
- `MatchScreen` desktop layout is bespoke (NOT SectionFlow): fixed ~400px control rail LEFT, pitch fills the RIGHT pane. Rail order top→bottom: scoreboard + speed controls, Formation, Substitutions, **Team energy, then hero power tile(s) last** (user-requested swap).
- **Substitutions card (user decision 2026-07-23):** the rail's sub card shows the **three most tired on-pitch players** — ranked by `condition` ascending — each with an energy bar and percentage number (red < 40, gold 40–70, green above). Tapping Swap opens the existing bench-selection flow; fresh legs enter at 100 (engine facts: `condition` per player, `summarizeTeamEnergy`, `MAX_SUBSTITUTIONS = 3` in `src/sim/substitutions.ts` — presentation-only change, no sim work).
- **Team energy card (user decision 2026-07-23):** title reads "Team energy (<current mode>)"; below the team bar sit three direct-select chips — Save energy / Balanced / All out (`ENERGY_USE_LABELS` in `src/render/match-energy-ui.ts`) — with the active mode highlighted, same chip pattern as the formation card. Selecting a chip issues the existing recorded `SET_ENERGY_USE` input (replay-safe, no sim work). Caption shows average % plus tired count (`summarizeTeamEnergy`, tired ≤ 40). All energy bars in the rail use the engine's `energyBand` colors: red ≤ 30, amber ≤ 60, green above.
- **CORRECTED 2026-07-23 (was wrong in the first mockup):** there is NO fire button. Per `docs/03-match-engine.md`, firing is manual and happens **on the pitch — tap/click the glowing in-Zone hero** to fire at 100%; a missed ~7s window decays heat to half, no auto-fire. The rail's hero card is a STATUS tile only: power name, heat bar, zone countdown, and the live `M`/`A` policy toggle (85% context auto / 75% late-window). Powers stack — one tile per fielded hero, growing 1→4 with the Hero License cap. Electron phase open question: number keys 1–4 as click-equivalents for firing the corresponding in-Zone hero (mouse click on the pitch hero remains primary).
- League tab column 2 borrows the M2 "Fixtures & results" section into season 1 (new section for `LeagueTableScreen` — small view-model addition, flagged during mockup review).

Also out of scope: Electron shell, Steam SDK, desktop SQLite driver (separate plans per the platform roadmap discussion of 2026-07-22).
