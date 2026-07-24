# Instant Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Training resolves instantly on tap in the drill popup (TP + condition gated, SUPER 1.5× sessions from potential grade, injury gamble at tap time); the weekly plan/slots/interrupts system is deleted end to end.

**Architecture:** One new pure engine action `trainPlayerInstantly` in `src/game/training.ts` (which loses all weekly-resolution code), a per-tap store action, a rewritten drill popup that stays open and animates results, and removal of every weekly-training consumer (career settle, wellbeing focus cost, interrupts, review development section, transition overlay, contract-promise bump flow).

**Tech Stack:** Pure TS engine (seeded mulberry32, no Date/Math.random), Zustand store, React Native + NativeWind UI, Jest.

**Spec:** `docs/superpowers/specs/2026-07-24-instant-training-design.md`

**Decisions locked during planning** (within spec's delegated tuning):
- SUPER chance = `5 + 2 × gradeIndex` percent (E− = 5% … A+ = 33%). Pity: forced SUPER on the 12th drill since the last SUPER (per player, persisted).
- SUPER gain = `Math.round(baseDrillGain × 1.5)` applied to the drill's base gain before growth modifiers (T1 +3→+5, T2 +5→+8, T3 +8→+12).
- RNG seeding: `careerSeed ^ imul(totalInstantDrills+1, 0x9e3779b1) ^ imul(hash(playerId), stream+1)`, with a persisted state-level `totalInstantDrills` counter so back-to-back taps roll differently. Streams: 0 = SUPER, 1 = injury, 2 = injury duration.
- TRAINING_PRIORITY contract perk: with unlimited training the "guaranteed slot" promise is trivially honored. The bump flow (`resolveTrainingPromiseBump`), the slot assert, and the auto-slot-on-agree behavior are deleted; the perk remains signable/renewable (wage-discount math untouched) and old saves keep it. Flag to user as a candidate for a real replacement effect later.
- M1 (non-full) careers keep plain drill gains (no growth modifiers), matching today's branch.

---

### Task 1: Engine — SUPER chance helper + types

**Files:**
- Modify: `src/game/archetype-caps.ts` (add `superTrainingChancePercent`, delete `potentialTrainingBonusPercent`/`playerPotentialTrainingBonusPercent` — grep consumers first; view-models use `playerPotentialTrainingBonusPercent` and will be updated in Task 7)
- Modify: `src/game/types.ts` (add `drillsSinceSuper?: number` to `CareerPlayer`, `totalInstantDrills?: number` to `GameState`)
- Test: `src/game/__tests__/instant-training.test.ts` (new)

- [ ] **Step 1: Write failing tests** for the chance curve:

```ts
import { superTrainingChancePercent } from '../archetype-caps';

describe('superTrainingChancePercent', () => {
  it('is 5% at E- and 33% at A+', () => {
    expect(superTrainingChancePercent('E-')).toBe(5);
    expect(superTrainingChancePercent('A+')).toBe(33);
  });
  it('adds exactly 2 points per grade step', () => {
    expect(superTrainingChancePercent('E')).toBe(7);
    expect(superTrainingChancePercent('B-')).toBe(23);
  });
});
```

- [ ] **Step 2: Run** `npx jest src/game/__tests__/instant-training.test.ts` — expect FAIL (export missing).
- [ ] **Step 3: Implement** in `archetype-caps.ts`, replacing the two potential-bonus functions:

```ts
/** E− is 5%; every grade step adds two percentage points, so A+ is 33%. */
export function superTrainingChancePercent(grade: PotentialGrade): number {
  return 5 + POTENTIAL_GRADES.indexOf(grade) * 2;
}
```

Add the two type fields with doc comments (`drillsSinceSuper` = drills since last SUPER for the pity timer; `totalInstantDrills` = lifetime drill counter used as the RNG nonce).

- [ ] **Step 4: Run test** — expect PASS. Commit: `feat: potential grade maps to SUPER training chance`.

### Task 2: Engine — `trainPlayerInstantly`

**Files:**
- Modify: `src/game/training.ts` — add the new action; keep (for now) the weekly code so the tree stays green until Task 3.
- Test: `src/game/__tests__/instant-training.test.ts`

- [ ] **Step 1: Write failing tests** (build a minimal full-career state via the same helpers `training-settlement.test.ts` uses — copy its state builder). Cover:
  - deducts drill TP cost and 8 condition (floor 0), increments `totalInstantDrills`
  - applies the drill gain to the path's attribute (full career: with age/facility/percent modifiers; assert exact value for a known fixture)
  - throws for: unknown player, opponent player, injured player, TP < cost
  - SUPER: with a state fixture where the roll hits (probe by iterating `totalInstantDrills` seeds to find a hitting nonce, or set `drillsSinceSuper: 11` to force pity), gain uses `round(base × 1.5)` and `drillsSinceSuper` resets to 0; non-SUPER increments it
  - pity: 12th drill since last SUPER is always SUPER
  - injury: with condition < 30, `injuryChancePercent` equals `overtrainingInjuryChancePercent(preDrillCondition, facilityReduction)`; find a seed where the roll hits and assert `injuryWeeks` set AND gains still applied; condition ≥ 30 never rolls injury
  - determinism: same state → identical resolution twice
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement** in `training.ts`:

```ts
export const INSTANT_DRILL_CONDITION_COST = 8;
export const SUPER_TRAINING_PITY_DRILLS = 12;

export interface InstantDrillResolution {
  state: GameState;
  playerId: string;
  pathId: string;
  drillId: string;
  attribute: keyof CareerPlayer['attrs'];
  tpSpent: number;
  isSuper: boolean;
  before: number;
  after: number;
  conditionAfter: number;
  injury?: { chancePercent: number; recoveryWeeks: number };
}

export function trainPlayerInstantly(
  state: GameState,
  playerId: string,
  pathId: string,
): InstantDrillResolution {
  const player = state.players.find(p => p.id === playerId);
  if (player === undefined || player.clubId !== state.userClubId) {
    throw new Error(`player ${playerId} is not on the user club`);
  }
  if (player.injuryWeeks > 0) throw new Error(`${player.name} is injured and cannot train`);
  const drill = resolveTrainingDrillForPath(state, pathId);
  if (drill.tpCost > state.trainingPoints) {
    throw new Error(`training needs ${drill.tpCost} TP but only ${state.trainingPoints} are available`);
  }

  const nonce = state.totalInstantDrills ?? 0;
  const superChance = superTrainingChancePercent(playerPotentialGrade(player));
  const pityReached = (player.drillsSinceSuper ?? 0) + 1 >= SUPER_TRAINING_PITY_DRILLS;
  const isSuper = pityReached
    || instantDrillRoll(state.careerSeed, nonce, playerId, 0, 100) < superChance;

  const attribute = trainingPathAttribute(pathId);
  const baseGain = drill.gains[attribute] ?? 0;
  const rolledGain = isSuper ? Math.round(baseGain * 1.5) : baseGain;
  const trained = state.careerMode === 'full'
    ? applyInstantGrowthModifiers(state, player, attribute, rolledGain)
    : { value: capPlayerTrainingGain(player, attribute, player.attrs[attribute], player.attrs[attribute] + rolledGain), remainders: undefined };

  const conditionBefore = player.condition ?? 100;
  const riskReduction = state.facilities.grid === undefined
    ? 0
    : facilityEffects(state.facilities.grid).injuryRiskReductionPercent;
  const injuryChancePercent = conditionBefore >= OVERTRAINING_CONDITION_THRESHOLD
    ? 0
    : overtrainingInjuryChancePercent(conditionBefore, riskReduction);
  const injured = injuryChancePercent > 0
    && instantDrillRoll(state.careerSeed, nonce, playerId, 1, 100) < injuryChancePercent;
  const recoveryWeeks = injured
    ? medicalBayRecoveryWeeks(
        2 + instantDrillRoll(state.careerSeed, nonce, playerId, 2, 5),
        gridMedicalBayLevel(state.facilities.grid),
      )
    : undefined;
  ...build next player (attrs, remainders, condition, drillsSinceSuper, injuryWeeks)
  ...return { state: nextState, ... };
}
```

`applyInstantGrowthModifiers` is a single-player, single-attribute refactor of the existing `applyM2TrainingGrowthModifiers` (same structural multiplier, same percent-bonus remainder banking, **without** `playerPotentialTrainingBonusPercent` in the sum) plus the facility stamina bonus remainder when `attribute === 'sta'`. `instantDrillRoll` reuses the mulberry32 + FNV-hash pattern from `player-wellbeing.ts` with the seed formula from the header. `gridMedicalBayLevel` is copied from `player-wellbeing.ts` (or exported from there).

- [ ] **Step 4: Run tests** — expect PASS. Commit: `feat: instant per-drill training engine action`.

### Task 3: Engine — delete the weekly training system

**Files:**
- Modify: `src/game/training.ts` (delete `resolveCareerTrainingWeek`, `pendingTrainingInterrupts`, `slotTrainingPointCost`, `slotIsAtCap`, `setCareerTrainingPlan`, `applyM2TrainingGrowthModifiers`, `applyFacilityStaminaBonus`, cap-notice helpers, related types)
- Delete: `src/game/training-plan.ts`
- Modify: `src/game/career.ts` (advanceWeek: drop interrupt guard; settleCurrentWeek: drop `resolveCareerTrainingWeek` call + cap notices — TP becomes `state.trainingPoints + ambient`; wellbeing gets `trainedPlayers: state.players`; startNextSeason: drop `trainingCapNotices: []`)
- Modify: `src/game/player-wellbeing.ts` (drop `focusApplied`/focus condition cost/overtraining roll from `resolveWeeklyPlayerWellbeing`; keep + export `overtrainingInjuryChancePercent`, `medicalBayRecoveryWeeks`, `OVERTRAINING_CONDITION_THRESHOLD`; delete `FOCUS_DRILL_CONDITION_COST`)
- Modify: `src/game/contract-promises.ts` (TRAINING_PRIORITY: delete `resolveTrainingPromiseBump`, `assertCareerTrainingHonorsContractPromises`, the auto-slot logic in `agreeCareerContractPromise`)
- Modify: `src/game/types.ts` (delete `CareerTrainingSlot`, `trainingPlan`, `trainingCapNotices`, `pendingTrainingPromiseBump` if present)
- Modify: `src/game/full-career.ts`, `src/game/market-career.ts` (drop slot-pruning on roster changes)

- [ ] **Step 1:** Make the deletions; chase compile errors with `npx tsc --noEmit` restricted attention to `src/game` until clean (app layer will still be red — that's Tasks 6–9).
- [ ] **Step 2:** Delete obsolete engine test suites: `training-settlement`, `training-slots`, `training-interrupts`, `training-interrupt-enforcement`, `training-advance-guard`, `training-cost` (keep any TP-cost assertions worth porting into `instant-training.test.ts`), plus weekly-training cases inside `player-wellbeing.test.ts`, `m2-training-growth.test.ts` (port modifier-math cases to instant tests), contract-promise bump tests.
- [ ] **Step 3:** Run `npx jest src/game` — expect PASS. Commit: `refactor: remove weekly training resolution, slots, and interrupts`.

### Task 4: Content schema + codec

**Files:**
- Modify: `src/content/schemas.ts` (drop `maxFocusDrillsPerWeek` from `TrainingCatalogSchema`), `content/training.json` (remove the field), `src/content/__tests__/content.test.ts`, `src/application/launch.ts` (drop any re-export of the cap)
- Modify: `src/persistence/game-state-codec.ts`:
  - stop encoding `trainingPlan` / `trainingCapNotices`; **parse them tolerantly** (accept-and-discard via `.optional()` passthrough) so old saves load
  - encode/parse `drillsSinceSuper` (player, optional 0–large int) and `totalInstantDrills` (state, optional)
  - delete the plan cross-validation block (`:1425-1448`)
- Test: `src/persistence/__tests__/` round-trip case: a state with `drillsSinceSuper`/`totalInstantDrills` survives encode→parse; a legacy payload containing `trainingPlan` parses without it.

- [ ] **Step 1:** Write the failing codec tests. **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** `npx jest src/persistence src/content` — PASS. Commit: `feat: persist SUPER pity counters, drop weekly plan from saves`.

### Task 5: Docs snapshot commit checkpoint

- [ ] Run `npx jest src/game src/persistence src/content` + `npx tsc --noEmit 2>&1 | grep -v 'src/(application|ui|render)'` — engine rings fully green. Commit if any stragglers.

### Task 6: Store — per-tap action

**Files:**
- Modify: `src/application/store.ts`, `src/application/store-types.ts` (or wherever the actions interface lives)

- [ ] **Step 1:** Delete `trainingSlots` state, `toggleTrainingPlayer`, `setTrainingSlotStat`, `clearTrainingSlotLimit`, `trainingSlotLimitHit`, `resolveTrainingPromiseBump` action, `commitTrainingSlots`, and every `trainingSlots: (next.trainingPlan…)` resync line. Add:

```ts
trainPlayer(playerId, pathId) {
  guarded(set, () => {
    const career = requireCareer(get());
    const resolution = trainPlayerInstantly(career, playerId, pathId);
    const next = hasAssistantGuideMilestone(resolution.state, 'first-training-complete')
      ? resolution.state
      : completeAssistantGuideMilestone(resolution.state, 'first-training-complete');
    const { state: _state, ...result } = resolution;
    set({ career: next, lastDrillResult: { ...result, sequence: (get().lastDrillResult?.sequence ?? 0) + 1 }, error: null });
    queueCareerSave(get, set, next);
  });
},
clearDrillResult() { set({ lastDrillResult: null }); },
```

`lastDrillResult` (new store field, `InstantDrillResolution` minus `state`, plus a monotonically increasing `sequence` so the popup can animate repeat results for the same stat). Opening the popup = existing `selectPlayer`.

- [ ] **Step 2:** `advanceWeek` action: keep the `first-training-complete` → `first-week-advanced` gating as-is.
- [ ] **Step 3:** Commit once view-models (Task 7) restore compilation.

### Task 7: View-models

**Files:**
- Modify: `src/application/view-models.ts`, `src/ui/models.ts`

- [ ] **Step 1:** `squadTrainingViewModel(state, content, selectedPlayerId)` (drop the `trainingSlots` param — update the 5-arg callers/tests per the known test trap):
  - drop `slots`, `maxSlots`, `weeklyTrainingPointCost`, `interrupts`, `slotNumber`, `trainingLocked`, `potentialBonusPercent`
  - per player add `superChancePercent: superTrainingChancePercent(potentialGrade)` and `injuryRiskPercent` (0 when condition ≥ 30, else `overtrainingInjuryChancePercent(condition, facilityReduction)`)
  - `selectedPlayerStatOptions` gains `affordable: drill.tpCost <= state.trainingPoints`; keep `atSafetyCeiling`
- [ ] **Step 2:** `weeklyReviewViewModel` / `postMatchViewModel`: delete the `development` field and `playerDevelopmentViewModel` + `skippedTrainingWarning`; injuries/contracts/facility `updates` stay.
- [ ] **Step 3:** Update `src/ui/models.ts` types to match (add `superChancePercent`, `injuryRiskPercent`, `affordable`, `sequence`d drill result type; remove slot/interrupt/development types).
- [ ] **Step 4:** Update `src/application/__tests__`: rewrite `training-stat-options`, `squad-training-created-player` (created player still floats first), `weekly-review` (no development), delete `training-cap-feedback`, `weekly-plan-summary`, `training-transition`. Run `npx jest src/application` — PASS. Commit: `feat: instant-training store action and view-models`.

### Task 8: Drill popup — instant results, SUPER, chain taps

**Files:**
- Modify: `src/ui/TrainingDrillModal.tsx`
- Create: `src/ui/components/SuperTrainingCelebration.tsx` (confetti + fireworks + big words, adapted from `ChampionshipCelebrationScreen`'s `makeConfetti`/`Firework`; ~2s, absolute-fill inside the popup)
- Modify: `src/ui/screens/SquadTrainingScreen.tsx` (wiring)

- [ ] **Step 1:** Popup header adds live TP counter and the player's condition bar + SUPER chance line (`SUPER CHANCE: 21%` from `superChancePercent`). Each stat row: keep drill name/cost/current value; button disabled when `!affordable || atSafetyCeiling`; when `injuryRiskPercent > 0` show a risk pill on every row (`⚠ 14% INJURY RISK`) tinted amber <25% / red ≥25% (full-tint, no left stripes per user rules).
- [ ] **Step 2:** `onPickDrill` → store `trainPlayer`. On new `lastDrillResult.sequence`: run the result beat (~1s): row highlights, `CountedStat`-style count-up `before→after` with spring pop, `+N` flyout, TP header ticks down (reuse the rAF count-up pattern from `PlayerDevelopmentSpotlight`; respect `reduceMotion`).
- [ ] **Step 3:** `isSuper` → mount `SuperTrainingCelebration` over the popup content: confetti + two fireworks + "SUPER TRAINING SESSION" / "1.5×" pixel-font words scaling in with spring; `Vibration.vibrate()` (guard web); screen-shake = quick translateX oscillation on the popup card. Auto-dismiss after ~2s, tap-to-dismiss sooner.
- [ ] **Step 4:** `injury` on result → interrupt beat: red-tinted card "OUT {recoveryWeeks} WEEKS" + sad SFX; then rows re-render with the player untrainable (all rows disabled with "INJURED" label). Keep popup open.
- [ ] **Step 5:** Escalating pitch: track consecutive drills for the open player in component state; play the result SFX via `management-sfx` with `rate = 1 + 0.06 × min(streak, 8)` if the SFX API allows a rate param — if not, pick from a small pitch-step sample set; reset on player change/close.
- [ ] **Step 6:** Remove the "Remove from training" footer button (no slots to leave). SquadTrainingScreen: `+` → `selectPlayer(playerId)` + open popup; remove `0/3` counter, slot number badges, interrupt banners/modals, `trainingSlotLimitHit` toast.
- [ ] **Step 7:** Update/rewrite `src/ui/__tests__`: `training-badge-action`, `first-training-guidance` (fires on first `trainPlayer`), delete `training-cap-deeplink`, `training-progress-render` slot cases; add popup result-beat render test (mock store, assert count-up target and SUPER overlay presence). Run `npx jest src/ui` — PASS. Commit: `feat: drill popup trains instantly with SUPER celebrations`.

### Task 9: Advance-week UI cleanup

**Files:**
- Modify: `src/ui/App.tsx` (or wherever `TrainingTransitionOverlay` mounts), delete `src/render/TrainingTransitionOverlay.tsx` + `src/application/training-transition.ts`
- Modify: `src/ui/screens/WeeklyReviewScreen.tsx` (remove `PlayerDevelopmentSpotlight` section + skipped-training warning render; keep money/TP/ledger/updates/fixture/facility), `src/ui/components/PlayerDevelopmentSpotlight.tsx` (delete if now unreferenced — check `PostMatchDevelopmentOverlay` first; if post-match still renders development from match XP keep the component, else delete both)
- Modify: `src/ui/ManagementShell.tsx` + `src/application/assistant-guide.ts` (hint copy: "PICK A PLAYER AND TRAIN A STAT — IT HAPPENS RIGHT AWAY"; targets unchanged)

- [ ] **Step 1:** Make removals, chase `npx tsc --noEmit` to zero errors repo-wide.
- [ ] **Step 2:** `npx jest` full suite — PASS. Commit: `feat: advance week sheds training resolution UI`.

### Task 10: Balance probes + full verification

- [ ] **Step 1:** Run `npx jest src/audit src/game/balance*` — update exact-value assertions that encoded weekly training (`balance.test.ts:50`, `facility-weekly-integration.test.ts:61-62`, `training-trace-probe`, `long-career-development-probe`, `headroom-probe`). Where a probe simulated weekly plans, port it to call `trainPlayerInstantly` in a loop with the same TP budget so the development-rate assertions stay meaningful.
- [ ] **Step 2:** Full `npx jest` + `npx tsc --noEmit` + `npm run lint:fix` — all green. Commit: `test: balance probes exercise instant training`.

### Task 11: Docs + visual QA

- [ ] **Step 1:** Update `docs/05-players-training-coaches.md` (instant training, potential = SUPER chance, injury gamble) and add a decision-log line to `README.md` if the log lists training decisions.
- [ ] **Step 2:** Static-export visual QA per the known-good path (export:web + copy canvaskit.wasm + serve), muted on load: verify tap→result beat, SUPER (force via a high-grade player or temporary pity=1 in dev), injury badge coloring, weekly review without development, no 0/3 counter. Close tab, kill server.
- [ ] **Step 3:** Commit docs: `docs: training goes instant`.

## Execution notes

- Tasks 1→2→3 are strictly serial (same files). 4 can interleave after 3. 6–8 serial (store → view-models → UI). 9–11 serial after 8. No worktree parallelism needed — nearly every task touches shared types.
- The tree is intentionally red between Tasks 3 and 9 in the app layer; engine rings must be green from Task 5 onward.
