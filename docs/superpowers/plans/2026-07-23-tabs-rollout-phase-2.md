# Remaining Tabs Two-Column Rollout (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the four remaining tab screens (League incl. M2, Squad, Club, Market) to the SectionFlow two-column desktop layout, matching the signed-off mockups, with phone rendering unchanged.

**Architecture:** Each screen follows the completed pilot `src/ui/screens/ClubHomeScreen.tsx` (READ IT FIRST — it is the canonical template): declare sections as `FlowSection { key, weight, node }`, strip inter-section margin wrappers (SectionFlow's `gap-6` owns spacing), pass the page header via `header`. New logic beyond relocation: a season-1 fixtures view-model field (League), window-measurement scroll retargeting (ClubFinances), and a desks-as-sections desktop mode (Market). All rollout rules in `docs/superpowers/plans/2026-07-23-desktop-two-column-layout.md` §"Rollout template rules" are binding.

**Tech Stack:** React Native + NativeWind (className only; imports from `react-native`, NEVER react-native-gesture-handler), Jest + ts-jest source-string/VM tests, existing layout primitives (`SectionFlow`, `useLayoutMode`, `balancedSplitIndex` — do not modify them except where a task says so).

**Binding constraints (from recon 2026-07-23):**
- Several tests pin literal className strings (`'relative mt-20 border-4 border-blue-dark bg-blue-light p-1'` etc. in acceptance-audit-regressions/first-training-guidance/facility-placement-guidance). Moved JSX must keep those literals byte-identical.
- `mt-20` appears INSIDE section content on Squad/Club — never write a `not.toContain('mt-20')` guard. Only LeagueTable and M2League have clean spacing tokens.
- SquadTraining's internal `wideColumns = width >= 600` roster-table breakpoint is independent of the 960 layout breakpoint — keep both.
- M2League's ScrollView uses `paddingBottom: 32` (others 28) — preserve per screen.
- Section weights: 1 unit ≈ one card row; derive from view-model counts; conditional when height varies (rule 2).

---

### Task 1: LeagueTableScreen conversion

**Files:**
- Modify: `src/ui/screens/LeagueTableScreen.tsx`
- Test: create `src/ui/__tests__/league-two-column.test.ts`

Sections (recon): header row (line ~14, becomes `header`), `PaperPanel kicker="Current standing" ... className="mt-5"` (~25), `<View className="mt-6">` table (~36, N = `viewModel.rows`), `<View className="mt-4 flex-row ...">` legend (~91). No guides, no state, no scroll.

- [ ] **Step 1: failing test**

```ts
// src/ui/__tests__/league-two-column.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('league table two-column layout', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/LeagueTableScreen.tsx'),
    'utf8',
  );

  it('flows sections through SectionFlow with the auto-detected mode', () => {
    expect(source).toContain('useLayoutMode');
    expect(source).toContain('<SectionFlow');
  });

  it('lets SectionFlow own inter-section spacing', () => {
    expect(source).not.toContain('mt-6');
    expect(source).not.toContain('"mt-5"');
  });

  it('derives the table weight from row count', () => {
    expect(source).toContain('viewModel.rows.length');
  });
});
```

- [ ] **Step 2:** `npx jest src/ui/__tests__/league-two-column.test.ts` → FAIL (first and third tests).

- [ ] **Step 3: convert.** Imports + `const layoutMode = useLayoutMode();` exactly as the pilot. Sections:

```ts
const sections: FlowSection[] = [
  { key: 'standing', weight: 5, node: (/* MOVE: the Current-standing PaperPanel, changing ONLY className="mt-5" to no className prop */) },
  { key: 'table', weight: 2 + viewModel.rows.length, node: (
      /* MOVE: the mt-6 table block (outer wrapper → <View>), AND move the mt-4 legend row
         INSIDE this node, directly after the table card, keeping the legend's own classes
         but changing its mt-4 to mt-4 (unchanged — it is intra-section spacing now). */
    ) },
];
```

Return: `ScrollView` (padding 16/28 unchanged) wrapping `<SectionFlow mode={layoutMode} header={/* MOVE: header row */} sections={sections} />`.

- [ ] **Step 4:** test green + `npx tsc --noEmit` clean.
- [ ] **Step 5:** `npx jest src/ui` all green.
- [ ] **Step 6:** commit `feat: flow league table into two columns on wide viewports`.

---

### Task 2: Season-1 "Fixtures & results" section (approved design addition)

**Files:**
- Create: `src/ui/components/LeagueFixtureRow.tsx` (extracted from M2LeagueScreen's local `LeagueFixtureRow`, ~line 295 — move verbatim, add `export`, import type `M2LeagueFixtureViewModel` from `../m2-league-models`)
- Modify: `src/ui/m2-league-models.ts` — no type changes needed (reuse `M2LeagueFixtureViewModel`)
- Modify: `src/ui/models.ts` — add to `LeagueTableViewModel`: `readonly leagueFixtures: readonly M2LeagueFixtureViewModel[];` (import the type)
- Modify: `src/application/view-models.ts` — in `leagueTableViewModel(state)` (~line 1057), the `seasonFixtures` array already computed there feeds a new `leagueFixtures` mapping. REUSE the mapping logic from `src/application/m2-league-view-model.ts:37` — extract its fixture→VM mapper into an exported helper `leagueFixtureViewModel(fixture, state)` in that file if not already reusable, and call it from both builders (DRY).
- Modify: `src/ui/screens/M2LeagueScreen.tsx` — delete the local `LeagueFixtureRow`, import the shared one.
- Modify: `src/ui/screens/LeagueTableScreen.tsx` — append a third section.
- Test: `src/application/__tests__/league-fixtures-vm.test.ts` (new) + extend `src/ui/__tests__/league-two-column.test.ts`.

- [ ] **Step 1: failing VM test**

```ts
// src/application/__tests__/league-fixtures-vm.test.ts
import { leagueTableViewModel } from '../view-models';
import { careerFixture } from './helpers'; // if no such helper exists, build state the same way league-truthfulness.test.ts does — copy its state-construction pattern exactly

describe('season-1 league fixtures view model', () => {
  it('exposes the season schedule with played results first-class', () => {
    // Build state exactly as src/ui/__tests__/league-truthfulness.test.ts builds it
    // (same fixtures, same helper calls), then:
    // const vm = leagueTableViewModel(state);
    // expect(vm.leagueFixtures.length).toBeGreaterThan(0);
    // expect(vm.leagueFixtures[0]).toEqual(expect.objectContaining({
    //   weekLabel: expect.any(String), scoreLabel: expect.any(String),
    //   status: expect.stringMatching(/SCHEDULED|PLAYED/),
    // }));
  });
});
```

(The implementer MUST open `league-truthfulness.test.ts` and `m2-league-view-model.test.ts` and mirror their real state builders — the commented sketch above shows the assertions, not the setup. Writing real setup is part of this step; if the builders prove unclear, report NEEDS_CONTEXT.)

- [ ] **Step 2:** run it → FAIL (`leagueFixtures` undefined).
- [ ] **Step 3:** implement the VM field via the shared mapper. `npx tsc --noEmit` clean; VM test green; `npx jest src/application src/ui` green (M2 VM tests must not regress).
- [ ] **Step 4:** extract `LeagueFixtureRow` to `src/ui/components/LeagueFixtureRow.tsx`; M2League imports it; append League section:

```ts
  { key: 'fixtures', weight: 2 + Math.min(viewModel.leagueFixtures.length, 10), node: (
      <View>
        <SectionLabel eyebrow={viewModel.divisionLabel} title="Fixtures & results"
          right={<StatusChip label={`${viewModel.leagueFixtures.length} matches`} />} />
        <View className="border-2 border-b-4 border-ink bg-white px-3">
          {viewModel.leagueFixtures.map(fixture => (
            <LeagueFixtureRow key={fixture.id} fixture={fixture} />
          ))}
        </View>
      </View>
    ) },
```

(Check `SectionLabel`/`StatusChip` props against Scorecard.tsx before writing; match M2's section markup where it differs from this sketch — M2's existing "Fixtures & results" section at M2LeagueScreen.tsx:172-190 is the styling authority, including its empty-state `PaperPanel title="Schedule pending"` which MUST be replicated for `length === 0`.)

- [ ] **Step 5:** extend league-two-column.test.ts: `expect(source).toContain('LeagueFixtureRow');` and `expect(source).toContain('viewModel.leagueFixtures.length');`. All green.
- [ ] **Step 6:** commit `feat: season-1 league fixtures section with shared fixture rows`.

---

### Task 3: M2LeagueScreen conversion

**Files:**
- Modify: `src/ui/screens/M2LeagueScreen.tsx`
- Test: create `src/ui/__tests__/m2-league-two-column.test.ts` (same 3-test shape as Task 1's, guards `not.toContain('mt-7')` and `not.toContain('"mt-5"')`, weight assertion `viewModel.activeTable.rows.length`)

Sections (recon): header (~48) → `header`; ladder `mt-5` (~59, N=5 divisions, weight 8); division summary PaperPanel `mt-4` (~86, weight 5) — fold INTO the ladder section node (they are one decision unit: pick a division, read its summary); standings `mt-6` (~115, weight `2 + viewModel.activeTable.rows.length`); fixtures `mt-7` (~172, weight `2 + Math.min(viewModel.leagueFixtures.length, 10)`); National Cup `mt-7` ternary (~193, weight `viewModel.cup.rounds.length > 0 ? 6 + 2 * viewModel.cup.rounds.length : 5`) — strip ` mt-7` from BOTH ternary branches, keep the guide classes byte-identical otherwise.

**Cup auto-scroll:** the existing `guideNationalCup` flow scrolls via `cupYRef` (y from section `onLayout` — WRONG inside a column). Gate it: only call `scrollRef.current?.scrollTo` when `layoutMode === 'single'`. In twoColumn the cup sits in a ~half-height column; the guide highlight + cue remain. Keep the `onLayout` handler itself (harmless).

ScrollView keeps `paddingBottom: 32`.

- [ ] Steps: failing test → convert → test+tsc green → `npx jest src/ui src/application` green → commit `feat: flow national league screen into two columns`.

---

### Task 4: SquadTrainingScreen conversion

**Files:**
- Modify: `src/ui/screens/SquadTrainingScreen.tsx`
- Test: create `src/ui/__tests__/squad-two-column.test.ts`

Sections (recon): header (~215) → `header`; roster `mt-6` (~220, weight `3 + viewModel.players.length`); player file PaperPanel `mt-5` conditional on `selectedPlayer` (~333, weight 9) — spread-conditional; drills `mt-6` (~429, weight `2 + viewModel.drills.length`); plan panel `mt-5` ternary on `lockedPlan` (~491/522, weight `viewModel.lockedPlan === undefined ? 6 : 4 + viewModel.lockedPlan.players.length`).

**Non-negotiables:**
- The `mt-20` guide-wrapper strings pinned by `acceptance-audit-regressions.test.ts` and `first-training-guidance.test.ts` are INSIDE section content — byte-identical moves. Run those two suites explicitly in the verify step.
- Test guard: use `not.toContain('"mt-6"')` scoped to the two double-quoted wrapper literals ONLY IF the converted file truly has none left; `mt-20` must remain. Do NOT guard `mt-5` (PaperPanel className prop may legitimately remain elsewhere — verify before writing the guard; if unclean, drop that assertion rather than force it).
- Keep `wideColumns` (600pt) logic untouched.
- The floating `TutorialTapCue label="Scroll down"` (~573) sits OUTSIDE the ScrollView and is driven by measured visibility of `drillListRef`/`lockPlanRef` — keep the mechanism. Change ONLY the label to be direction-neutral: `label="Find your drills"` — and update `first-training-guidance.test.ts` IF it pins the old string (check first; if it does, update the pinned string in the same commit and say so in the report).
- `drillListRef`/`lockPlanRef` measured visibility uses `measureInWindow`-style viewport math already (recon: measureTrainingGuideVisibility) — verify it still fires with sections nested in columns by reading the measurement code; if it measures via `onLayout` y-in-parent instead, report DONE_WITH_CONCERNS with specifics.

- [ ] Steps: failing test → convert → test+tsc green → `npx jest src/ui/__tests__/acceptance-audit-regressions.test.ts src/ui/__tests__/first-training-guidance.test.ts src/ui/__tests__/squad-potential-labels.test.ts src/ui/__tests__/training-progress-render.test.ts` green → `npx jest src/ui` green → commit `feat: flow squad training into two columns`.

---

### Task 5: ClubFinancesScreen conversion + window-measured scroll retargeting

**Files:**
- Modify: `src/ui/screens/ClubFinancesScreen.tsx`
- Test: create `src/ui/__tests__/finances-two-column.test.ts`

Sections (recon): header (~255) → `header`; cash position (guide-ternary `mt-20`/`mt-5` wrapper ~263, weight 6) — strip ONLY the ` mt-5` from the else branch and keep the guide branch string byte-identical (it is pinned by acceptance-audit-regressions.test.ts — VERIFY the pinned literal `'relative mt-20 border-2 border-blue-dark bg-blue-light p-1'` still appears after conversion); itemized `mt-6` (~294, weight `2 + viewModel.ledger.length`); transactions `mt-6` conditional (~345, weight `2 + viewModel.recentTransactions.length`) — spread-conditional; coaching staff `mt-6` (~369, weight `viewModel.coachingStaff.length === 0 ? 4 : 3 + 4 * viewModel.coachingStaff.length`); club grounds guide-ternary `mt-20`/`mt-6` (~451, weight `10 + viewModel.facilities.height * 2`) — strip ` mt-6` from else branch only; legacy training ground `mt-6` conditional (~1026, weight 5) — spread-conditional, KEEP its `onLayout={onTrainingGroundLayout}`.

**Scroll retargeting (the real work).** Current flows accumulate section y via `onLayout` (`facilityYRef`, `groundsYRef`, guide targets) and `scrollRef.scrollTo({ y })`. Inside a SectionFlow column, `onLayout` y is column-relative — wrong for the root ScrollView. Replace the y-source, keep the flows:

```ts
/** Scrolls the ScrollView so the given target (a rendered View) is margin px
 * below the viewport top. Works regardless of column nesting because both
 * measurements are in window coordinates. */
function scrollToTarget(
  scrollRef: RefObject<ScrollView | null>,
  viewportRef: RefObject<View | null>,
  targetRef: RefObject<View | null>,
  latestScrollOffset: number,
  margin = 12,
) {
  const viewport = viewportRef.current;
  const target = targetRef.current;
  if (viewport === null || target === null) return;
  viewport.measureInWindow((vx, vy) => {
    target.measureInWindow((tx, ty) => {
      const y = Math.max(0, latestScrollOffset + (ty - vy) - margin);
      scrollRef.current?.scrollTo({ y, animated: true });
    });
  });
}
```

Wire: give the grounds section wrapper and the training-ground wrapper `ref`s (`collapsable={false}` — see ManagementShell's anchor pattern), and convert `scrollToTrainingGround` + `scrollFacilityGuideTargetIntoView` to call `scrollToTarget` with the appropriate target ref and `latestScrollOffsetRef.current`. The old y-accumulation refs (`facilityYRef`, `groundsYRef`) become unused — REMOVE them and their `onLayout` writers (they are orphaned by this change; removing them is in-scope cleanup). Guide-phase TARGET refs (`facilityGuideBuildTargetRef`, `facilityGuideGridTargetRef`) already point at Views — reuse them as `targetRef`s directly.

**State note:** all placement/selection state is screen-level (survives breakpoint flips); the facilities grid re-measures via its own `onLayout` after any remount — no action needed, but the reviewer should confirm no state was accidentally moved into a section component.

- [ ] Steps: failing test (SectionFlow wiring + `not.toContain('facilityYRef')` proving the retarget landed) → convert → test+tsc green → `npx jest src/ui/__tests__/acceptance-audit-regressions.test.ts src/ui/__tests__/facility-placement-guidance.test.ts src/ui/__tests__/concierge-targets.test.ts src/ui/__tests__/first-training-guidance.test.ts` green → `npx jest src/ui` green → commit `feat: flow club finances into two columns with window-measured scroll targets`.

---

### Task 6: MarketScreen — desks become sections on desktop

Phone: UNCHANGED (tab bar + one active desk). Desktop: all available desks render as sections per the approved mockup; the tab bar is hidden.

**Files:**
- Modify: `src/ui/screens/MarketScreen.tsx`
- Test: create `src/ui/__tests__/market-two-column.test.ts`

- [ ] **Step 1: failing test**

```ts
// src/ui/__tests__/market-two-column.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('market two-column layout', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'),
    'utf8',
  );

  it('renders every desk as a section on wide viewports', () => {
    expect(source).toContain('useLayoutMode');
    expect(source).toContain('<SectionFlow');
    expect(source).toContain("layoutMode === 'single'");
  });

  it('keeps the phone tab docket for single-column mode', () => {
    expect(source).toContain('docket'); // the tab bar still exists for phones
  });
});
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: convert.** Structure:
  - Registration desk PaperPanel (`mt-5`, ~175) → section `{ key: 'registration', weight: 5 }` (strip className mt-5).
  - Negotiation (`viewModel.negotiation`, ~193) → spread-conditional section `{ key: 'negotiation', weight: 10 }`. NegotiationPanel's root `className="mt-6"` — pass a prop or strip? NegotiationPanel is reused by SeasonEndScreen with its own spacing expectations — do NOT edit NegotiationPanel; wrap it: `node: <View className="-mt-6"><NegotiationPanel .../></View>` is a hack — REJECTED. Instead give NegotiationPanel an optional `flush?: boolean` prop that omits the mt-6 (default false so SeasonEndScreen is untouched), and pass `flush` here.
  - Desks: build the desk elements once — `const youthDesk = viewModel.youth ? <YouthDesk .../> : null;` etc. (each desk root keeps its `mt-6`? NO — strip each desk component's root `mt-6` and add `className="mt-6"` at the CALL SITE in single mode instead: `<View className="mt-6">{activeDesk}</View>`. In sections, the node is the bare desk.)
  - Single mode: header + registration + negotiation + tab bar + `<View className="mt-6">{activeDesk}</View>` — visually identical to today.
  - TwoColumn mode: `<SectionFlow header={...} sections={[registration, negotiation?, ...deskSections]} />` where desk sections exist only when their VM slice does: youth (`weight 4 + 5 * intake.offers.length`), scout (`weight 8`), transfers (`weight 3 + 3 * viewModel.transfers.length`), coaches (`weight 3 + 4 * viewModel.coaches.length`). Keys: `'youth-desk'`, `'scout-desk'`, `'transfer-desk'`, `'coach-desk'`.
  - The scout-guide scroll-dismiss measuring (`southAmericaScoutActionRef`) is window-measure based — keep as is.
  - `requestedSection` prop (an external "open this desk" signal): in single mode it still switches the tab; in twoColumn it is a no-op (all desks visible) — guard the effect with `layoutMode === 'single'`.
- [ ] **Step 4:** tests green, tsc clean.
- [ ] **Step 5:** `npx jest src/ui/__tests__/coach-hiring-guidance.test.ts src/ui/__tests__/market-scroll-guidance.test.ts src/ui/__tests__/web-confirmation-and-guidance.test.ts src/ui/__tests__/staff-and-youth-screen-ownership.test.ts` green, then `npx jest src/ui` green. If a pinned string breaks because a desk root lost `mt-6`, update the pin in the same commit and report it.
- [ ] **Step 6:** commit `feat: market desks flow as sections on wide viewports`.

---

### Task 7: Full verification + visual QA

- [ ] `npm test` — entire suite green (1,335+ tests at last count).
- [ ] `npx tsc --noEmit` clean.
- [ ] Visual QA (controller): `npm run export:web`, copy `<main>/public/canvaskit.wasm` into `dist/`, serve `dist/`, Browser pane at 1280×800 — walk all five tabs in a real career; then 390×844 — confirm phone-identical, Market tabs still work. Screenshot each tab both shapes for user sign-off.
- [ ] Final whole-implementation review subagent across all Phase-2 commits (same brief as Phase 1's).

---

## Out of scope

- Match-screen desktop rail (Phase 3; design locked in the Phase-1 plan doc).
- `useLayoutMode` mode-flip-only subscription optimization (rollout rule 7 — only if resize jank appears in QA).
- Electron shell / Steam packaging.
