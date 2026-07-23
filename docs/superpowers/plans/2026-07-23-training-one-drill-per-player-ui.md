# One-Drill-Per-Player Training — UI/Application Plan (2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Wire the slot-based engine (Plan 1) through the store, view-model, training screen, App advance-flow, cutscene, and tutorial — replacing group-training + lock-in with the number-badge slot UX and the two blocking interrupt modals — then add the contract-promise "bump" flow with its split-screen reaction.

**Architecture:** The engine (`src/game/`) is done and stable. This plan touches only `src/game/index.ts` (barrel), `src/application/`, `src/ui/`, `App.tsx`, and the affected tests. Training now commits on selection (no lock-in). The editor holds `trainingSlots: { playerId, pathId: string | null }[]` (≤3); complete slots (pathId set) sync straight to `career.trainingPlan` via `setCareerTrainingPlan`. Blocking interrupts come from `pendingTrainingInterrupts(state, projectedTP)`.

**Tech Stack:** TypeScript strict, React Native + NativeWind, Zustand-style store, Jest. **Note:** the RN app cannot boot in this worktree (known: web dev server hangs on the sqlite worker / canvaskit.wasm 404), so verification is via Jest unit tests + `tsc`, not browser. Screen JSX is verified by tests on the store/VM it renders and by typecheck.

**Baseline:** `npx jest src/game src/persistence` is green (461 tests). `tsc` currently fails across `src/application`, `src/ui`, `App.tsx`, `src/audit` (expected — this plan fixes them).

**Sequencing:** Tasks 1–8 deliver the core slot UI + interrupts + tutorial. Task 9 (promise bump + split-screen) builds on them. Task 10 is final verification.

---

## Task 1: Export training-paths from the barrel

**Files:** Modify `src/game/index.ts`

- [ ] **Step 1:** Confirm the gap: `grep -n "training-paths" src/game/index.ts` → no match.
- [ ] **Step 2:** Add after the existing `export * from './training';` line:
```ts
export * from './training-paths';
```
- [ ] **Step 3:** Verify: `npx tsc --noEmit 2>&1 | grep "store.ts:61"` → gone (the `trainingDrillPathId` import at `store.ts:61` now resolves). No new duplicate-export errors: `npx tsc --noEmit 2>&1 | grep -i "training-paths\|duplicate"` → empty.
- [ ] **Step 4:** Commit: `git add src/game/index.ts && git commit -m "fix: export training-paths from the game barrel"`

---

## Task 2: Store — slot editing model

Replace the `assignedPlayerIds`/`selectedDrillIds` editor with a slot model that commits on change.

**Files:** Modify `src/application/store.ts` (state `:148-149,:225-226,:253-254,:292-293`; actions `toggleTrainingPlayer :854-862`, `toggleDrill :864-911`, `applyTraining :913-939`; imports `:20,:61`). Test: `src/application/__tests__/store.test.ts` (`:249,:304,:310`) + new cases.

- [ ] **Step 1: Write failing store tests** (append to `store.test.ts`) covering: tapping a player adds a slot with `pathId: null`; tapping a 4th sets a "limit hit" signal and does NOT add; tapping a slotted player removes it (and the array reindexes → renumber); setting a stat writes `pathId` and syncs `career.trainingPlan.slots` to the complete slots. Example:
```ts
test('training slots fill, block the 4th, and remove+reindex', () => {
  const store = createTestStore(); // however the suite builds one; mirror existing store.test.ts setup
  const ids = store.getState().career!.players.filter(p => p.clubId === store.getState().career!.userClubId).map(p => p.id);
  store.getState().toggleTrainingPlayer(ids[0]);
  store.getState().toggleTrainingPlayer(ids[1]);
  store.getState().toggleTrainingPlayer(ids[2]);
  expect(store.getState().trainingSlots.map(s => s.playerId)).toEqual([ids[0], ids[1], ids[2]]);
  store.getState().toggleTrainingPlayer(ids[3]);
  expect(store.getState().trainingSlots).toHaveLength(3);           // 4th blocked
  expect(store.getState().trainingSlotLimitHit).toBe(true);
  store.getState().toggleTrainingPlayer(ids[0]);                    // remove #1
  expect(store.getState().trainingSlots.map(s => s.playerId)).toEqual([ids[1], ids[2]]);
});

test('choosing a stat commits the slot to the career plan', () => {
  const store = createTestStore();
  const ids = /* ... */;
  store.getState().toggleTrainingPlayer(ids[0]);
  store.getState().setTrainingSlotStat(ids[0], 'sprints');
  expect(store.getState().career!.trainingPlan?.slots).toEqual([{ playerId: ids[0], pathId: 'sprints' }]);
});
```
(Match the actual `store.test.ts` construction helpers; read `:1-40,:240-320` first.)

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3: Implement.**
  - Imports: remove `chargeableCareerTrainingPlan` (`:20`); keep `trainingDrillBlockedReason`; `trainingDrillPathId` now resolves via the barrel (Task 1). Add `setCareerTrainingPlan`, `applyCareerTraining`, `slotIsAtCap`, `resolveTrainingDrillForPath`, `trainingPathAttribute`, `TRAINING_PATHS` as needed from `'../game'`.
  - State: replace `assignedPlayerIds: string[]` / `selectedDrillIds: string[]` with `trainingSlots: { playerId: string; pathId: string | null }[]` and `trainingSlotLimitHit: boolean`. Init `:225-226` → `trainingSlots: [], trainingSlotLimitHit: false`. Reset `:292-293` likewise.
  - Hydration `:253-254`: `trainingSlots: (career?.trainingPlan?.slots ?? []).map(s => ({ ...s }))`.
  - `toggleTrainingPlayer(playerId)` `:854-862`:
    ```ts
    toggleTrainingPlayer: (playerId) => set(state => {
      const existing = state.trainingSlots.findIndex(s => s.playerId === playerId);
      if (existing >= 0) {
        const trainingSlots = state.trainingSlots.filter((_, i) => i !== existing);
        return { trainingSlots, trainingSlotLimitHit: false, ...commitSlots(state, trainingSlots) };
      }
      const max = state.career?.trainingRules?.maxFocusDrillsPerWeek ?? 3;
      if (state.trainingSlots.length >= max) return { trainingSlotLimitHit: true };
      const trainingSlots = [...state.trainingSlots, { playerId, pathId: null }];
      return { trainingSlots, trainingSlotLimitHit: false, selectedPlayerId: playerId };
    }),
    ```
  - Add `setTrainingSlotStat(playerId, pathId)`:
    ```ts
    setTrainingSlotStat: (playerId, pathId) => set(state => {
      const trainingSlots = state.trainingSlots.map(s => s.playerId === playerId ? { ...s, pathId } : s);
      return { trainingSlots, ...commitSlots(state, trainingSlots) };
    }),
    ```
  - Add a private helper `commitSlots(state, slots)` that pushes complete slots to the engine and persists:
    ```ts
    function commitSlots(state, slots) {
      if (state.career === undefined) return {};
      const complete = slots.filter((s): s is { playerId: string; pathId: string } => s.pathId !== null);
      const career = applyCareerTraining(state.career, complete); // 2-arg, engine setCareerTrainingPlan
      // persist as the existing applyTraining did (mirror :931-937) + grant the
      // first-training milestone once at least one complete slot exists:
      const withMilestone = complete.length > 0
        ? completeAssistantGuideMilestone(career, 'first-training-complete') // adapt to actual signature
        : career;
      persistCareer(withMilestone); // mirror existing persistence call
      return { career: withMilestone };
    }
    ```
    (Read `applyTraining :913-939` to copy the exact persistence + milestone calls.)
  - `toggleDrill` `:864-911` and `applyTraining` `:913-939`: **remove** both (the drill-toggle/lock-in flow is gone). Grep for their callers and update (screen wires to `setTrainingSlotStat` / `toggleTrainingPlayer` instead — Task 5; App's `onApplyTraining` removed — Task 6).
  - Remove the `M1Store` interface declarations for `toggleDrill`/`applyTraining` (`:188-189`); add `setTrainingSlotStat` and `trainingSlots`/`trainingSlotLimitHit`.

- [ ] **Step 4:** Run store tests → PASS. `npx tsc --noEmit 2>&1 | grep "store.ts"` → empty.
- [ ] **Step 5:** Commit: `git add src/application/store.ts src/application/__tests__/store.test.ts && git commit -m "feat: slot-based training store, commit-on-select"`

---

## Task 3: View-model + UI types — slots, picker data, interrupts; drop lock-in

**Files:** Modify `src/application/view-models.ts` (`squadTrainingViewModel :1167-1280`, `lockedPlanViewModel :1290-1326`, `lockedTrainingProgress :1709-1735`, `drillViewModel :1737-1763`, and broken consumers `:171,:1465,:1516-1521`), `src/ui/models.ts` (`SquadTrainingViewModel :331-353`, `LockedTrainingProgressViewModel :320-329`). Test: `src/application/__tests__/training-cap-feedback.test.ts`, `weekly-plan-summary.test.ts`, `training-tier-unlocks.test.ts`, `training-unsaved-changes.test.ts`.

- [ ] **Step 1: Redefine the VM type** (`src/ui/models.ts :331-353`). Remove `hasUnsavedChanges`, `lockedPlan`, `assignedPlayerIds`, `selectedDrillCount`. Add:
```ts
export interface TrainingSlotStatOption {
  pathId: string;
  label: string;        // e.g. "Defense"
  drillName: string;    // best-tier drill title, e.g. "Duels III"
  gain: number;         // best-tier gain, e.g. 8
  room: number;         // cap - current for the slot player
  atCap: boolean;       // room <= 0 -> greyed/disabled
}
export interface SquadTrainingViewModel {
  resources: { money: number; trainingPoints: number };
  players: SquadTrainingPlayerViewModel[]; // each gains `slotNumber?: 1|2|3`
  // the up-to-3 committed slots, in order, for the "training set" summary:
  slots: { playerId: string; playerName: string; pathId: string; drillName: string; gainLabel: string }[];
  maxSlots: number;
  // stat picker for the currently selected player (undefined if none selected):
  selectedPlayerStatOptions?: TrainingSlotStatOption[];
  weeklyTrainingPointCost: number;
  interrupts: { cappedSlots: { playerId: string; playerName: string; pathId: string; attribute: string; cap: number }[]; tpShortfall: number };
}
```
Add `slotNumber?: number` to the per-player VM (`SquadTrainingPlayerViewModel`). Keep `attributes: {label,value,cap}[]` (used by the picker).

- [ ] **Step 2: Rewrite `squadTrainingViewModel`.** New signature: `(state, content, selectedPlayerId, trainingSlots: readonly { playerId: string; pathId: string | null }[])`. Body:
  - `slotNumber` per player = index+1 in `trainingSlots` (or undefined).
  - `slots` (committed) from `trainingSlots.filter(s => s.pathId)`; for each, `resolveTrainingDrillForPath(state, pathId)` gives `drillName`/gain; `gainLabel` = `+${gain} ${attr.toUpperCase()}`.
  - `selectedPlayerStatOptions`: if `selectedPlayerId` set, for each of `TRAINING_PATHS`, resolve the best-tier drill (`resolveTrainingDrillForPath`), compute `room = caps[attr] - player.attrs[attr]`, `atCap = room <= 0`, `gain` from the drill. (Reuse `playerAttributeCaps`.)
  - `weeklyTrainingPointCost` = `slotTrainingPointCost(state, complete)`.
  - `interrupts` = `pendingTrainingInterrupts(state, state.trainingPoints + weeklyAmbientTrainingPoints(state))` — import `weeklyAmbientTrainingPoints` from `'../game'` (barrel-export it if needed).
  - Remove all `chargeableCareerTrainingPlan`/`trainingSelectionMatchesSavedPlan`/`hasUnsavedChanges`/`lockedPlan` code.
- [ ] **Step 3: Delete `lockedPlanViewModel` (`:1290-1326`) and `lockedTrainingProgress` (`:1709-1735`)** and their `LockedTrainingProgressViewModel` type (`ui/models.ts :320-329`) unless still referenced elsewhere (grep first). The committed `slots` list replaces the "locked in" panel.
- [ ] **Step 4: Fix broken consumers:**
  - `clubFinancesViewModel :171-181` (planned focus training money line): training money is now always 0 → remove this ledger line (or set to 0). Read the block and drop the `trainingPlan?.drills.reduce` line.
  - `playerDevelopmentViewModel :1465`: `plan.assignedPlayerIds.flatMap` → `plan.slots.map(s => s.playerId)`.
  - `skippedTrainingWarning :1516-1521`: replace the `chargeableCareerTrainingPlan(...).capConflicts` read with `pendingTrainingInterrupts(before, before.trainingPoints).cappedSlots` (same shape: playerId/attribute). Adjust copy if needed.
  - `drillViewModel :1737-1763`: no longer used for a selectable drill list; if only the picker uses gains now, delete it, else repoint its affordability off `chargeableCareerTrainingPlan`. Grep callers first.
- [ ] **Step 5:** Migrate the four listed test files to the new VM shape (assert `slots`, `slotNumber`, `selectedPlayerStatOptions`, `interrupts` instead of `lockedPlan`/`hasUnsavedChanges`/`assignedPlayerIds`). Delete `training-unsaved-changes.test.ts` (the unsaved/dirty concept is gone) — note it in the commit.
- [ ] **Step 6:** `npx jest src/application/__tests__/training-cap-feedback src/application/__tests__/weekly-plan-summary src/application/__tests__/training-tier-unlocks --silent` → green. `npx tsc --noEmit 2>&1 | grep "view-models.ts\|ui/models.ts"` → empty.
- [ ] **Step 7:** Commit.

---

## Task 4: Training cutscene from slots

**Files:** Modify `src/application/training-transition.ts` (`:2,:41-89,:108-114`). Test: `src/application/__tests__/training-transition.test.ts`.

- [ ] **Step 1:** Migrate the test to the slot API (`setCareerTrainingPlan(state, [{playerId, pathId}])`).
- [ ] **Step 2:** Rewrite `trainingTransitionScene`: drop the `chargeableCareerTrainingPlan` import; build the scene from `state.trainingPlan.slots`. For each slot: player = roster lookup; `drill = resolveTrainingDrillForPath(state, slot.pathId)`; activity id = `slot.pathId` directly (delete `activityIdFor`'s suffix-strip, use pathId). "planIsActive" = `slots.length > 0 && affordable` — use `pendingTrainingInterrupts(state, state.trainingPoints).tpShortfall === 0`. Keep the overlay scene type (`src/render/TrainingTransitionOverlay.tsx`) shape; adjust only its inputs.
- [ ] **Step 3:** `npx jest training-transition --silent` → green; `tsc` clean for this file.
- [ ] **Step 4:** Commit.

---

## Task 5: Training screen — number badges, per-player stat picker, drop lock-in

**Files:** Modify `src/ui/screens/SquadTrainingScreen.tsx`. Update the source-snapshot test `src/ui/__tests__/first-training-guidance.test.ts:10`.

- [ ] **Step 1: Selection control → number badge** (`:306-326`). Replace the `{isAssigned ? '✓' : '+'}` render with the player's `slotNumber` (`{player.slotNumber ?? '+'}`), keep `onPress={() => onTogglePlayerAssignment(player.id)}`. Style the numbered state distinctly. Wire the 4th-tap block: when `viewModel` signals limit (store `trainingSlotLimitHit`), show a short popup "Remove a player first — 3 max." (Pass a handler/flag from App; see Task 6.)
- [ ] **Step 2: Per-player stat picker** (rework `:429-489`). For the selected player, render `viewModel.selectedPlayerStatOptions`: one row per stat showing `drillName` + `+{gain} {STAT}` + `{room} to cap`; disabled/greyed when `atCap`. `onPress={() => onSelectTrainingStat(player.id, option.pathId)}` (new handler → store `setTrainingSlotStat`). Highlight the currently chosen stat for that slot.
- [ ] **Step 3: Committed "training set" summary.** Replace the entire lock-in block (`:491-571`) with a simple read-only list of `viewModel.slots` (player · drillName · gainLabel). NO "Save"/"lock in" button, NO unsaved stamp.
- [ ] **Step 4: Remove lock-in coach marks** (`:504-512`, `:573-579`); keep/retarget the "add up to 3 players" (`:229-235`) and "choose a stat" (repurpose `:445-451`) cues for the new flow (Task 7 finalizes tutorial copy).
- [ ] **Step 5: Props.** Replace `onToggleDrill`/`onApplyTraining` with `onSelectTrainingStat(playerId, pathId)`; keep `onSelectPlayer`, `onTogglePlayerAssignment`. Update `first-training-guidance.test.ts:10` to the new source line (or convert it to a behavioral assertion).
- [ ] **Step 6:** `npx jest src/ui --silent` → green; `tsc` clean for the screen.
- [ ] **Step 7:** Commit.

---

## Task 6: App.tsx — interrupt modals replace lock-in guard

**Files:** Modify `App.tsx` (VM memo `:879-890`, `handleAdvanceWeek :896-904`, `lockInTrainingAndAdvance/advanceWeekWithoutSaving/dismiss :906-921`, `AdvanceTrainingGuard :1759-1819` + render `:1495-1500`, `lockTrainingPlanWithFeedback :689-711` + render `:1552-1558`, wiring `:1241-1268`).

- [ ] **Step 1: VM memo** `:879-890`: call `squadTrainingViewModel(store.career, content, store.selectedPlayerId, store.trainingSlots)` (new 4-arg). Update deps.
- [ ] **Step 2: Advance interception** `handleAdvanceWeek :896-904`: replace the `lockedPlan/canApply/hasUnsavedChanges` condition with:
```ts
const interrupts = squadTrainingVm.interrupts;
if (interrupts.cappedSlots.length > 0) { setTrainingCapInterrupt(interrupts.cappedSlots); return; }
if (interrupts.tpShortfall > 0) { setTrainingTpInterrupt({ shortfall: interrupts.tpShortfall, cost: squadTrainingVm.weeklyTrainingPointCost }); return; }
advanceCareerWithSfx();
```
- [ ] **Step 3: Two interrupt modals** (replace `AdvanceTrainingGuard`):
  - **TP shortfall modal:** lists the current trained players + their drill + effect; each has a "Stop training" button → `store.toggleTrainingPlayer(id)` (drops the slot). Re-reads `interrupts` live; when `tpShortfall === 0`, enables "Advance week". Short copy: "Not enough Training Points. Drop a player to continue."
  - **Capped-slot modal:** for each `cappedSlots` entry, offer "Change [Player]'s stat" (opens their picker via `setSelectedPlayer` + scroll) or "Swap player" (drop the slot). When `cappedSlots` empties, allow advance. Short copy: "[Player] maxed [STAT]. Pick a new focus or swap them out."
  These reuse the engine truth each render; do not duplicate interrupt logic.
- [ ] **Step 4: Remove the lock-in flow:** delete `lockInTrainingAndAdvance`, `advanceWeekWithoutSaving`, `advanceTrainingGuard` state, `AdvanceTrainingGuard` component, `lockTrainingPlanWithFeedback` (`:689-711`) and the `PlanLockedConfirmation` cutscene (`:1552-1558`, `src/ui/PlanLockedConfirmation.tsx`) — the plan commits on selection now, so the "plan locked" confirmation is obsolete (confirm no other consumer). Remove `onApplyTraining` wiring `:1267`; add `onSelectTrainingStat={(pid,path) => store.setTrainingSlotStat(pid,path)}`.
- [ ] **Step 5:** `npx tsc --noEmit 2>&1 | grep "App.tsx"` → empty. `npx jest src/application src/ui --silent` → green.
- [ ] **Step 6:** Commit.

---

## Task 7: Tutorial + glossary copy

**Files:** `src/application/assistant-guide.ts` (`:209-238`), `content/glossary.json` (`:68-69`), the retained coach-mark cues in `SquadTrainingScreen.tsx`.

- [ ] **Step 1:** Objective copy `:215-219`: change `'SAVE YOUR FIRST WEEKLY PLAN.'` → e.g. `'PICK A PLAYER AND A STAT TO TRAIN.'` (target stays `'training-plan'`). The `first-training-complete` milestone now fires from `commitSlots` (Task 2) when the first complete slot exists.
- [ ] **Step 2:** Coach-mark sequence: "Tap a player to train" → "Pick one stat for them" → "Add up to 3 players." (Reuse the retained cues from Task 5.4; the lock-in "Save the plan" cues are gone.)
- [ ] **Step 3:** `content/glossary.json :68-69`: rewrite "Weekly plan" and "Focus drill" entries for the new model (one stat per player, Training Points only, capped players must be swapped). Keep them short.
- [ ] **Step 4:** `npx jest --silent` for any assistant-guide/glossary tests → green.
- [ ] **Step 5:** Commit.

---

## Task 8: Migrate remaining application + audit tests

**Files:** `src/application/__tests__/{default-career-journey,weekly-review,training-plan-reconciliation}.test.ts`, `src/audit/__tests__/{adaptive-training-economy-probe,opening-matches-probe,promotion-survival-probe,training-trace-probe}.test.ts`.

- [ ] **Step 1:** Migrate each to the slot API: `setCareerTrainingPlan(state, [{playerId, pathId}])`; `trainingPlan: { slots: [...] }` literals; drop `chargeableCareerTrainingPlan` imports (use `slotTrainingPointCost` where a cost was asserted, now money 0). Delete assertions of removed features (unsaved/lockedPlan). Preserve real intent (don't weaken).
- [ ] **Step 2:** `npx jest src/application src/audit --silent` → green. Report any file deleted/case removed.
- [ ] **Step 3:** Commit.

---

## Task 9: Contract-promise "bump" flow + split-screen reaction

The `TRAINING_PRIORITY` promise, when all 3 slots are full, must prompt the user to choose who to bump, then show a split-screen reaction. (User decision 2026-07-23.)

**Files:** `src/game/contract-promises.ts` (engine signal), the contract/promise acceptance UI (grep `acceptCareerContractPromise` / where promises are accepted in `App.tsx`/`src/ui/`), a new split-screen reaction component, `content/` copy.

- [ ] **Step 1: Find the promise-acceptance UI.** `grep -rn "acceptCareerContractPromise\|TRAINING_PRIORITY\|ContractPromise" src/ui App.tsx src/application`. Report where promises are offered/accepted (the screen + handler).
- [ ] **Step 2: Engine signal.** Change `acceptCareerContractPromise` (contract-promises.ts): when the promise is `TRAINING_PRIORITY` and slots are full, do NOT silently skip — instead return state carrying a pending signal, e.g. `state.pendingTrainingPromiseBump = { promisedPlayerId }`. Add a resolver `resolveTrainingPromiseBump(state, bumpedPlayerId): GameState` that removes the bumped player's slot, adds the promised player on their biggest-room path, and clears the signal. Add a helper `biggestRoomTrainingPath(player)`. Unit-test both in `src/game/__tests__/contract-promises.test.ts` (slots full → signal set; resolve → promised player slotted on biggest-room stat, bumped removed).
- [ ] **Step 3: Bump prompt UI.** When `career.pendingTrainingPromiseBump` is set, render a modal listing the 3 current trainees ("Who stops training?") → on tap, `store` calls `resolveTrainingPromiseBump(career, id)` and persists.
- [ ] **Step 4: Split-screen reaction.** After resolving, show a brief split-screen: left = bumped player with a short funny-grumpy line; right = promised player with a short thank-you. Draft copy (2–3 variants each, keep < 8 words), e.g. bumped: "Benched already? I was just getting warm 😤"; promised: "Cheers boss — I won't waste it 🙏". Use the existing chibi sprite/portrait components (grep for how player portraits render elsewhere). Dismissable.
- [ ] **Step 5:** `npx jest contract-promises --silent` → green; `tsc` clean.
- [ ] **Step 6:** Commit.

---

## Task 10: Final verification

- [ ] **Step 1:** `npx tsc --noEmit` → ZERO errors project-wide.
- [ ] **Step 2:** `npx jest` (full suite) → all green. Report suite/test totals.
- [ ] **Step 3:** `node scripts/check-nativewind-style-collisions.mjs` (per project rule) → clean, if the script exists.
- [ ] **Step 4:** Final commit; report done.

---

## Self-review notes
- **New store API:** `trainingSlots: {playerId, pathId|null}[]`, `trainingSlotLimitHit`, `toggleTrainingPlayer`, `setTrainingSlotStat` (removed: `assignedPlayerIds`, `selectedDrillIds`, `toggleDrill`, `applyTraining`).
- **New VM fields:** `slots`, per-player `slotNumber`, `selectedPlayerStatOptions`, `interrupts`, `weeklyTrainingPointCost` (removed: `lockedPlan`, `hasUnsavedChanges`, `assignedPlayerIds`, `selectedDrillCount`).
- **Commit-on-select:** no lock-in button; `first-training-complete` milestone fires from `commitSlots`.
- **Interrupts** are read from the engine (`pendingTrainingInterrupts`) every render — never reimplemented in the UI.
- The RN app can't be browser-verified here; green Jest + clean `tsc` is the bar.
