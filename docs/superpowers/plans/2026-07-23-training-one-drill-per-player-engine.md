# One-Drill-Per-Player Training — Engine Plan (1 of 2)

> **2026-07-24 decision update:** automatic base conditioning was removed.
> Historical steps below that preserve or apply `baseConditioning` are superseded;
> Circuit remains the dedicated Stamina training path.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the group/multi-drill training engine with a slot model — up to 3 slots, each one player training one auto-tier drill, TP-only, with cap-reached and TP-affordability surfaced as blocking interrupts.

**Architecture:** Pure `src/game/` engine (no React/Expo, deterministic, Jest-headless). A training **slot** stores `{ playerId, pathId }`; the best unlocked drill tier for that path is resolved at settlement from a drill catalog baked into `state.trainingRules.focusDrills`. Money cost is removed from drills entirely; Training Points are the only cost, charged per slot per week. Cap and affordability blocks are exposed as a pure `pendingTrainingInterrupts(state, availableTP)` function the UI (Plan 2) gates on.

**Tech Stack:** TypeScript (strict), Jest + ts-jest, zod (state codec), mulberry32 seeded PRNG.

**Scope:** This is Plan 1 of 2. It delivers the engine + content + headless tests (fully testable on its own). Plan 2 covers the store, view-model, `SquadTrainingScreen`, `App.tsx` interrupt flows, and the tutorial.

**Non-goal:** No match-engine change → **`ENGINE_VERSION` is NOT bumped**.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `content/training.json` | Drill catalog | Money → 0; TP → 6/10/15 by tier |
| `src/game/training-paths.ts` | **New.** The 7 stat paths, labels, and path→best-tier resolver | Create |
| `src/game/types.ts` | State types | `CareerTrainingSlot`, `CareerTrainingPlan.slots`, `TrainingRules.focusDrills` |
| `src/game/promotion-progression.ts` | Tier unlock helpers | (read-only; reuse `trainingDrillTier`, `trainingDrillBlockedReason`) |
| `src/game/training.ts` | Training settlement + costs + interrupts | Rework `chargeable*`, `resolveCareerTrainingWeek`, `setCareerTrainingPlan`; add `pendingTrainingInterrupts`; drop distinct-path rule |
| `src/game/career.ts` | Weekly settlement + advance guard | Populate `focusDrills`; guard advance on interrupts |
| `src/application/launch.ts` | Career setup (application layer) | Populate `trainingRules.focusDrills` from content (2 sites) |
| `src/persistence/game-state-codec.ts` | Save/load zod schema | Slot schema + `focusDrills` |
| `src/game/__tests__/*` | Tests | Update broken exact-value tests; add active-manager rail |

---

## Task 1: Rebalance the drill catalog to TP-only

**Files:**
- Modify: `content/training.json`
- Test: `src/game/__tests__/training-catalog.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/game/__tests__/training-catalog.test.ts
import catalog from '../../../content/training.json';
import { trainingDrillTier } from '../promotion-progression';

describe('training catalog is TP-only with rebalanced costs', () => {
  test('every focus drill costs no money', () => {
    for (const drill of catalog.focusDrills) {
      expect(drill.moneyCost).toBe(0);
    }
  });

  test('TP cost is 6/10/15 by tier', () => {
    const byTier: Record<number, number> = { 1: 6, 2: 10, 3: 15 };
    for (const drill of catalog.focusDrills) {
      expect(drill.tpCost).toBe(byTier[trainingDrillTier(drill.id)]);
    }
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `npx jest training-catalog -v`
Expected: FAIL (moneyCost is 400, tpCost is 10, etc.)

- [ ] **Step 3: Edit `content/training.json`** — set every focus drill's `moneyCost` to `0`, and `tpCost` to `6` (tier I ids with no suffix), `10` (`-ii`), `15` (`-iii`). Leave `id`, `name`, `gains`, and `baseConditioning` unchanged. Example first three rows:

```json
    { "id": "sprints", "name": "Sprints I", "moneyCost": 0, "tpCost": 6, "gains": { "pac": 3 } },
    { "id": "sprints-ii", "name": "Sprints II", "moneyCost": 0, "tpCost": 10, "gains": { "pac": 5 } },
    { "id": "sprints-iii", "name": "Sprints III", "moneyCost": 0, "tpCost": 15, "gains": { "pac": 8 } },
```

Apply the same `moneyCost: 0` and tier-based `tpCost` to all 21 drills (sprints, finishing, rondo, duels, first-touch, circuit, keeper-drills × I/II/III).

- [ ] **Step 4: Run it, expect PASS**

Run: `npx jest training-catalog -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add content/training.json src/game/__tests__/training-catalog.test.ts
git commit -m "balance: make training TP-only, rebalance TP costs to 6/10/15"
```

---

## Task 2: Add training-path helpers and the tier resolver

The slot stores a **path id** (the tier-1 drill id, e.g. `sprints`). We need: the 7 paths with labels, and a resolver that returns the best *unlocked* drill for a path given `state`.

**Files:**
- Create: `src/game/training-paths.ts`
- Test: `src/game/__tests__/training-paths.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/game/__tests__/training-paths.test.ts
import { createLaunchCareerSetup } from '../../application/launch';
import { runHeadlessFullCareer } from '../headless';
import { TRAINING_PATHS, trainingPathLabel, resolveTrainingDrillForPath } from '../training-paths';

describe('training paths', () => {
  test('there are 7 paths, one per stat, with labels', () => {
    expect(TRAINING_PATHS.map(p => p.pathId).sort()).toEqual(
      ['circuit', 'duels', 'finishing', 'first-touch', 'keeper-drills', 'rondo', 'sprints'],
    );
    expect(trainingPathLabel('duels')).toBe('Defense');
    expect(TRAINING_PATHS.find(p => p.pathId === 'duels')?.attribute).toBe('def');
  });

  test('resolves the best unlocked tier for a path (tier I at D5 start)', () => {
    const state = runHeadlessFullCareer(createLaunchCareerSetup(0, undefined, undefined, 'full'), 1);
    const drill = resolveTrainingDrillForPath(state, 'sprints');
    // A brand-new full career starts in D5, so only tier I is unlocked.
    expect(drill.id).toBe('sprints');
    expect(drill.gains.pac).toBe(3);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `npx jest training-paths -v`
Expected: FAIL ("Cannot find module '../training-paths'")

- [ ] **Step 3: Create `src/game/training-paths.ts`**

```ts
import type { Attrs } from '../sim/types';
import { trainingDrillTier, trainingDrillBlockedReason } from './promotion-progression';
import type { CareerTrainingDrill, GameState } from './types';

export interface TrainingPath {
  /** The tier-1 drill id, used as the stable path identifier. */
  readonly pathId: string;
  readonly attribute: keyof Attrs;
  readonly label: string;
}

export const TRAINING_PATHS: readonly TrainingPath[] = [
  { pathId: 'sprints', attribute: 'pac', label: 'Pace' },
  { pathId: 'finishing', attribute: 'sho', label: 'Shooting' },
  { pathId: 'rondo', attribute: 'pas', label: 'Passing' },
  { pathId: 'duels', attribute: 'def', label: 'Defense' },
  { pathId: 'first-touch', attribute: 'tec', label: 'Technique' },
  { pathId: 'circuit', attribute: 'sta', label: 'Stamina' },
  { pathId: 'keeper-drills', attribute: 'ref', label: 'Reflexes' },
];

const PATH_BY_ID = new Map(TRAINING_PATHS.map(path => [path.pathId, path]));

export function trainingPathLabel(pathId: string): string {
  const path = PATH_BY_ID.get(pathId);
  if (path === undefined) throw new Error(`unknown training path ${pathId}`);
  return path.label;
}

export function trainingPathAttribute(pathId: string): keyof Attrs {
  const path = PATH_BY_ID.get(pathId);
  if (path === undefined) throw new Error(`unknown training path ${pathId}`);
  return path.attribute;
}

/** Strips the tier suffix so any tier's drill id maps back to its path. */
export function trainingDrillPathId(drillId: string): string {
  return drillId.replace(/-(ii|iii)$/, '');
}

/**
 * Returns the highest-tier drill for a path that the club has unlocked. Tier I
 * is always unlocked, so this never fails for a valid path.
 */
export function resolveTrainingDrillForPath(state: GameState, pathId: string): CareerTrainingDrill {
  if (!PATH_BY_ID.has(pathId)) throw new Error(`unknown training path ${pathId}`);
  const catalog = state.trainingRules?.focusDrills ?? [];
  const best = catalog
    .filter(drill => trainingDrillPathId(drill.id) === pathId)
    .sort((a, b) => trainingDrillTier(b.id) - trainingDrillTier(a.id))
    .find(drill => trainingDrillBlockedReason(state, drill.id) === undefined);
  if (best === undefined) throw new Error(`no unlocked drill for path ${pathId}`);
  return best;
}
```

Note: this replaces the old `trainingDrillPathId` in `training.ts` (Task 5 removes that copy). Keep the regex identical.

- [ ] **Step 4: Run it, expect FAIL still** (needs `focusDrills` in state — added in Task 3)

Run: `npx jest training-paths -v`
Expected: the first test PASSES; the resolver test FAILS (catalog is empty). This is expected — Task 3 populates the catalog. Proceed.

- [ ] **Step 5: Commit**

```bash
git add src/game/training-paths.ts src/game/__tests__/training-paths.test.ts
git commit -m "feat: training-path helpers and best-tier resolver"
```

---

## Task 3: Bake the focus-drill catalog into state

`resolveCareerTrainingWeek(state)` only receives `state`, so the catalog must live in `state.trainingRules.focusDrills`.

**Files:**
- Modify: `src/game/types.ts:71-74` (add `focusDrills`)
- Modify: `src/game/career.ts:99` (trainingRules construction — M1 slice)
- Modify: `src/application/launch.ts:55` and `:299` (trainingRules construction — full/other)
- Test: `src/game/__tests__/training-paths.test.ts` (the resolver test from Task 2 now passes)

- [ ] **Step 1: Extend the type**

In `src/game/types.ts`, change `TrainingRules`:

```ts
export interface TrainingRules {
  baseConditioning: CareerTrainingDrill;
  maxFocusDrillsPerWeek: number;
  /** Full focus-drill catalog, baked in so the pure engine can resolve tiers. */
  focusDrills: CareerTrainingDrill[];
}
```

- [ ] **Step 2: Populate at each construction site**

Read `src/game/career.ts` around line 99 and `src/application/launch.ts` around lines 55 and 299. Each builds a `trainingRules: { baseConditioning, maxFocusDrillsPerWeek }` object from the same content source that supplies `baseConditioning`. Add `focusDrills` alongside, from that same content's `focusDrills` array (mapped to `CareerTrainingDrill`: `{ id, moneyCost, tpCost, gains: { ...gains } }`). For example, if the site reads `content.training`, add:

```ts
      trainingRules: {
        baseConditioning: /* unchanged */,
        maxFocusDrillsPerWeek: content.training.maxFocusDrillsPerWeek,
        focusDrills: content.training.focusDrills.map(drill => ({
          id: drill.id,
          moneyCost: drill.moneyCost,
          tpCost: drill.tpCost,
          gains: { ...drill.gains },
        })),
      },
```

Use whatever local content variable each site already uses for `baseConditioning`. Do not import launch content into `src/game/` — `career.ts` must receive it via the setup/content it already uses.

- [ ] **Step 3: Run the resolver test, expect PASS**

Run: `npx jest training-paths -v`
Expected: PASS (both tests)

- [ ] **Step 4: Add the codec field**

Read `src/persistence/game-state-codec.ts` around line 727 (`trainingRulesSchema`). Add `focusDrills` to that schema mirroring the existing drill schema used for `baseConditioning` (an array of `{ id, moneyCost, tpCost, gains }`). Make it `.optional()` only if the rest of `trainingRulesSchema` is optional; otherwise required.

- [ ] **Step 5: Run codec + full-career tests, expect PASS**

Run: `npx jest game-state-codec training-paths -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/game/types.ts src/game/career.ts src/application/launch.ts src/persistence/game-state-codec.ts
git commit -m "feat: bake focus-drill catalog into training rules state"
```

---

## Task 4: Slot data model

**Files:**
- Modify: `src/game/types.ts:53-56`
- Modify: `src/persistence/game-state-codec.ts` (trainingPlan schema)
- Test: `src/game/__tests__/training-slots.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/game/__tests__/training-slots.test.ts
import type { CareerTrainingPlan } from '../types';

test('a training plan is a list of player+path slots', () => {
  const plan: CareerTrainingPlan = {
    slots: [
      { playerId: 'p1', pathId: 'duels' },
      { playerId: 'p2', pathId: 'sprints' },
    ],
  };
  expect(plan.slots).toHaveLength(2);
  expect(plan.slots[0].pathId).toBe('duels');
});
```

- [ ] **Step 2: Run it, expect FAIL** (compile error: `slots` not on `CareerTrainingPlan`)

Run: `npx jest training-slots -v`
Expected: FAIL

- [ ] **Step 3: Change the types** in `src/game/types.ts`:

```ts
export interface CareerTrainingSlot {
  playerId: string;
  /** Tier-1 drill id identifying the path; best unlocked tier resolves at settlement. */
  pathId: string;
}

export interface CareerTrainingPlan {
  slots: CareerTrainingSlot[];
}
```

- [ ] **Step 4: Update the codec** — in `src/persistence/game-state-codec.ts`, replace the `trainingPlan` schema's `{ assignedPlayerIds, drills }` shape with `{ slots: z.array(z.object({ playerId: z.string(), pathId: z.string() })) }`.

- [ ] **Step 5: Run it, expect PASS**

Run: `npx jest training-slots game-state-codec -v`
Expected: PASS (other files still reference the old shape and will fail to compile — fixed in Tasks 5–6; run only these two test files for now)

- [ ] **Step 6: Commit**

```bash
git add src/game/types.ts src/persistence/game-state-codec.ts src/game/__tests__/training-slots.test.ts
git commit -m "feat: slot-based training plan data model"
```

---

## Task 5: Slot-based cost + plan setter (TP-only, allow duplicate paths)

Rework `training.ts` to consume slots. Money is always 0; TP = sum of each non-capped slot's resolved-tier `tpCost`. Two slots may share a path. Remove `assertDistinctTrainingDrillPaths` and the old `trainingDrillPathId` copy (now in `training-paths.ts`).

**Files:**
- Modify: `src/game/training.ts`
- Test: `src/game/__tests__/training-cost.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/game/__tests__/training-cost.test.ts
import { createLaunchCareerSetup } from '../../application/launch';
import { runHeadlessFullCareer } from '../headless';
import { slotTrainingPointCost } from '../training';

test('TP cost sums per-slot best-tier costs; money is never charged', () => {
  const state = runHeadlessFullCareer(createLaunchCareerSetup(0, undefined, undefined, 'full'), 1);
  const userIds = state.players.filter(p => p.clubId === state.userClubId).map(p => p.id);
  const cost = slotTrainingPointCost(state, [
    { playerId: userIds[0], pathId: 'sprints' },   // tier I -> 6
    { playerId: userIds[1], pathId: 'duels' },     // tier I -> 6
  ]);
  expect(cost).toBe(12);
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `npx jest training-cost -v`
Expected: FAIL (`slotTrainingPointCost` not exported)

- [ ] **Step 3: Implement `slotTrainingPointCost` and rework `chargeableCareerTrainingPlan`.** In `src/game/training.ts`:

  1. Add import: `import { resolveTrainingDrillForPath, trainingPathAttribute, trainingDrillPathId } from './training-paths';` and remove the local `trainingDrillPathId` function (lines 555–557) and `assertDistinctTrainingDrillPaths` (lines 559–564).
  2. Add a pure helper that skips capped slots (a capped slot is a blocking interrupt, handled in Task 8; it must not be charged):

```ts
/** Sums the best-tier TP cost of every slot whose stat still has room. */
export function slotTrainingPointCost(
  state: GameState,
  slots: readonly CareerTrainingSlot[],
): number {
  let tp = 0;
  for (const slot of slots) {
    if (slotIsAtCap(state, slot)) continue;
    tp = checkedAdd(tp, resolveTrainingDrillForPath(state, slot.pathId).tpCost, 'weekly training point cost');
  }
  return tp;
}

/** True when the slot's player has already reached the cap for the slot's stat. */
export function slotIsAtCap(state: GameState, slot: CareerTrainingSlot): boolean {
  const player = userRoster(state).find(candidate => candidate.id === slot.playerId);
  if (player === undefined) return false;
  const attribute = trainingPathAttribute(slot.pathId);
  return player.attrs[attribute] >= playerAttributeCaps(player)[attribute];
}
```

  3. Import `CareerTrainingSlot` in the `types` import block.

- [ ] **Step 4: Run it, expect PASS**

Run: `npx jest training-cost -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/training.ts src/game/__tests__/training-cost.test.ts
git commit -m "feat: slot-based TP-only training cost, drop distinct-path rule"
```

---

## Task 6: Slot-based weekly settlement

Rework `resolveCareerTrainingWeek` and `setCareerTrainingPlan` to consume slots. Each slot resolves its path→best-tier drill and applies it to that one player. No money charge.

**Files:**
- Modify: `src/game/training.ts`
- Test: `src/game/__tests__/training-settlement.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/game/__tests__/training-settlement.test.ts
import { createLaunchCareerSetup } from '../../application/launch';
import { runHeadlessFullCareer } from '../headless';
import { setCareerTrainingPlan, resolveCareerTrainingWeek } from '../training';
import { trainingPathAttribute } from '../training-paths';

test('each slot trains only its own player on its own stat', () => {
  let state = runHeadlessFullCareer(createLaunchCareerSetup(0, undefined, undefined, 'full'), 1);
  // Force manage phase for a plan edit if needed by advancing to the next season start.
  const roster = state.players.filter(p => p.clubId === state.userClubId);
  const target = roster.find(p => p.attrs.pac < 90)!;
  state = { ...state, phase: 'manage', trainingPoints: 100 };
  state = setCareerTrainingPlan(state, [{ playerId: target.id, pathId: 'sprints' }]);

  const before = target.attrs.pac;
  const res = resolveCareerTrainingWeek(state);
  const after = res.players.find(p => p.id === target.id)!.attrs.pac;
  expect(after).toBeGreaterThan(before);      // trained
  expect(res.moneyCost).toBe(0);              // TP-only
  // a different, unslotted player only gets free conditioning (sta), not pac
  const other = res.players.find(p => p.clubId === state.userClubId && p.id !== target.id)!;
  const untouched = roster.find(p => p.id === other.id)!;
  expect(other.attrs.pac).toBe(untouched.attrs.pac);
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `npx jest training-settlement -v`
Expected: FAIL (signature mismatch / old group behavior)

- [ ] **Step 3: Rework the two functions in `src/game/training.ts`.**

Replace `setCareerTrainingPlan` (lines 74–131) with a slot version:

```ts
export function setCareerTrainingPlan(
  state: GameState,
  slots: readonly CareerTrainingSlot[],
): GameState {
  if (state.phase !== 'manage') {
    throw new Error('training plans can only change during the manage phase');
  }
  const maxSlots = state.trainingRules?.maxFocusDrillsPerWeek ?? 3;
  if (slots.length > maxSlots) {
    throw new Error(`a training plan allows at most ${maxSlots} players`);
  }
  if (new Set(slots.map(slot => slot.playerId)).size !== slots.length) {
    throw new Error('a player can occupy only one training slot');
  }
  const roster = new Set(userRoster(state).map(player => player.id));
  for (const slot of slots) {
    if (!roster.has(slot.playerId)) throw new Error(`unknown trainee ${slot.playerId}`);
    const drill = resolveTrainingDrillForPath(state, slot.pathId); // throws on bad path / locked tier
    void drill;
  }
  assertCareerTrainingHonorsContractPromises(state, slots.map(slot => slot.playerId));
  return { ...state, trainingPlan: { slots: slots.map(slot => ({ ...slot })) } };
}
```

Replace the body of `resolveCareerTrainingWeek` (lines 134–254) so it: (a) applies free base conditioning to the whole roster (unchanged), then (b) for each slot whose stat is not at cap, applies that slot's resolved drill to just that player, charging TP once per slot, (c) applies the existing M2 growth modifiers and facility stamina bonus, (d) returns `moneyCost: 0`. Keep the `reachedCaps` computation via `findReachedTrainingCaps`, but feed it the per-slot drills. Concretely:

```ts
export function resolveCareerTrainingWeek(state: GameState): WeeklyTrainingResolution {
  const roster = userRoster(state);
  const base = state.trainingRules?.baseConditioning;
  const coachModifiers = state.market === undefined ? undefined : careerCoachTrainingModifiers(state.market);
  const conditioned = base === undefined
    ? roster
    : applyTrainingPlan(roster, roster.map(p => p.id), [base], { money: 0, tp: 0 }).players as CareerPlayer[];

  const slots = state.trainingPlan?.slots ?? [];
  const executable = slots
    .filter(slot => !slotIsAtCap(state, slot))
    .map(slot => ({ slot, drill: resolveTrainingDrillForPath(state, slot.pathId) }));
  const tpCost = executable.reduce((sum, e) => checkedAdd(sum, e.drill.tpCost, 'weekly training point cost'), 0);
  const canAfford = executable.length > 0 && tpCost <= state.trainingPoints;

  let players = conditioned as CareerPlayer[];
  let tp = state.trainingPoints;
  if (canAfford) {
    for (const { slot, drill } of executable) {
      const applied = applyTrainingPlan(
        players,
        [slot.playerId],
        [{ id: drill.id, moneyCost: 0, tpCost: drill.tpCost, gains: { ...drill.gains } }],
        { money: Number.MAX_SAFE_INTEGER, tp },
      );
      players = applied.players as CareerPlayer[];
      tp = applied.resources.tp;
    }
  }

  const growthAdjusted = state.careerMode === 'full'
    ? applyM2TrainingGrowthModifiers(state, roster, players, coachModifiers)
    : players;
  const staminaBonusPercent = state.facilities.grid === undefined
    ? 0
    : facilityEffects(state.facilities.grid).staminaTrainingBonusPercent;
  const facilityBoosted = applyFacilityStaminaBonus(roster, growthAdjusted, staminaBonusPercent);

  const trainedById = new Map(facilityBoosted.map(p => [p.id, p]));
  const reachedCaps = findReachedTrainingCaps(
    state, roster, facilityBoosted,
    executable.map(e => e.slot.playerId),
    executable.map(e => ({ id: e.drill.id, moneyCost: 0, tpCost: e.drill.tpCost, gains: e.drill.gains })),
    canAfford,
  );

  return {
    players: state.players.map(p => {
      const trained = trainedById.get(p.id);
      return trained === undefined ? p : { ...p, ...trained, attrs: { ...trained.attrs } };
    }),
    trainingPoints: tp,
    moneyCost: 0,
    focusApplied: canAfford,
    reachedCaps,
    skippedCaps: [],
  };
}
```

Delete the now-unused `chargeableCareerTrainingPlan`, `trainingPlanCapConflicts`, `capConflictsAsSkippedCaps`, `trainingCapNotice`, `trainingSelectionMatchesSavedPlan`, and `TrainingPlanCapConflict`/`ChargeableCareerTrainingPlan` interfaces **only if** no remaining file imports them (grep first — Plan 2's store/VM may still reference some; if so, defer their deletion to Plan 2 and leave them compiling). Keep `findReachedTrainingCaps`, `trainingAttributes`, `applyM2TrainingGrowthModifiers`, `applyFacilityStaminaBonus`, `userRoster`, `cloneDrill`, `checkedAdd`, `checkedMultiply`.

- [ ] **Step 4: Run it, expect PASS**

Run: `npx jest training-settlement -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/training.ts src/game/__tests__/training-settlement.test.ts
git commit -m "feat: slot-based weekly training settlement, TP-only"
```

---

## Task 7: Blocking interrupts (pure detection)

Expose a pure function the UI (Plan 2) and the advance guard use: which slots are capped (must be changed), and whether the plan is affordable.

**Files:**
- Modify: `src/game/training.ts`
- Test: `src/game/__tests__/training-interrupts.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/game/__tests__/training-interrupts.test.ts
import { createLaunchCareerSetup } from '../../application/launch';
import { runHeadlessFullCareer } from '../headless';
import { setCareerTrainingPlan, pendingTrainingInterrupts } from '../training';
import { playerAttributeCaps } from '../archetype-caps';

test('a capped slot is reported; a fresh slot is not', () => {
  let state = runHeadlessFullCareer(createLaunchCareerSetup(0, undefined, undefined, 'full'), 1);
  state = { ...state, phase: 'manage', trainingPoints: 100 };
  const roster = state.players.filter(p => p.clubId === state.userClubId);
  const fresh = roster.find(p => p.attrs.pac < 80)!;
  // Force a player to be at cap on def by writing the cap value.
  const capped = roster.find(p => p.id !== fresh.id)!;
  const defCap = playerAttributeCaps(capped).def;
  state = {
    ...state,
    players: state.players.map(p => p.id === capped.id ? { ...p, attrs: { ...p.attrs, def: defCap } } : p),
  };
  state = setCareerTrainingPlan(state, [
    { playerId: fresh.id, pathId: 'sprints' },
    { playerId: capped.id, pathId: 'duels' },
  ]);

  const interrupts = pendingTrainingInterrupts(state, state.trainingPoints);
  expect(interrupts.cappedSlots.map(s => s.playerId)).toEqual([capped.id]);
  expect(interrupts.cappedSlots[0].attribute).toBe('def');
  expect(interrupts.tpShortfall).toBe(0);
});

test('reports a TP shortfall when the plan costs more than available', () => {
  let state = runHeadlessFullCareer(createLaunchCareerSetup(0, undefined, undefined, 'full'), 1);
  state = { ...state, phase: 'manage', trainingPoints: 100 };
  const ids = state.players.filter(p => p.clubId === state.userClubId).map(p => p.id);
  state = setCareerTrainingPlan(state, [{ playerId: ids[0], pathId: 'sprints' }]); // 6 TP
  const interrupts = pendingTrainingInterrupts(state, 4); // only 4 available
  expect(interrupts.weeklyTrainingPointCost).toBe(6);
  expect(interrupts.tpShortfall).toBe(2);
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `npx jest training-interrupts -v`
Expected: FAIL (`pendingTrainingInterrupts` not exported)

- [ ] **Step 3: Add the interface and function to `src/game/training.ts`**

```ts
export interface TrainingCappedSlot {
  playerId: string;
  playerName: string;
  pathId: string;
  attribute: keyof CareerPlayer['attrs'];
  cap: number;
}

export interface TrainingInterrupts {
  cappedSlots: TrainingCappedSlot[];
  weeklyTrainingPointCost: number;
  tpShortfall: number;
}

/**
 * Pure blocking-interrupt state. `availableTrainingPoints` is what the caller
 * will have this settlement (bank + this week's income); the UI passes the
 * projected value, headless callers pass the current bank.
 */
export function pendingTrainingInterrupts(
  state: GameState,
  availableTrainingPoints: number,
): TrainingInterrupts {
  const slots = state.trainingPlan?.slots ?? [];
  const roster = new Map(userRoster(state).map(player => [player.id, player]));
  const cappedSlots: TrainingCappedSlot[] = [];
  for (const slot of slots) {
    const player = roster.get(slot.playerId);
    if (player === undefined) continue;
    const attribute = trainingPathAttribute(slot.pathId);
    const cap = playerAttributeCaps(player)[attribute];
    if (player.attrs[attribute] >= cap) {
      cappedSlots.push({ playerId: player.id, playerName: player.name, pathId: slot.pathId, attribute, cap });
    }
  }
  const weeklyTrainingPointCost = slotTrainingPointCost(state, slots);
  return {
    cappedSlots,
    weeklyTrainingPointCost,
    tpShortfall: Math.max(0, weeklyTrainingPointCost - availableTrainingPoints),
  };
}
```

- [ ] **Step 4: Run it, expect PASS**

Run: `npx jest training-interrupts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/training.ts src/game/__tests__/training-interrupts.test.ts
git commit -m "feat: pure training interrupt detection (capped slots + TP shortfall)"
```

---

## Task 8: Guard advance-week on unresolved interrupts

The engine must never silently waste TP on a capped slot or overspend TP. `advanceWeek` throws if interrupts are pending; the UI (Plan 2) resolves them before calling it.

**Files:**
- Modify: `src/game/career.ts` (the `advanceWeek` function; find via `export function advanceWeek`)
- Test: `src/game/__tests__/training-advance-guard.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/game/__tests__/training-advance-guard.test.ts
import { createLaunchCareerSetup } from '../../application/launch';
import { runHeadlessFullCareer } from '../headless';
import { advanceWeek } from '../career';
import { setCareerTrainingPlan } from '../training';
import { playerAttributeCaps } from '../archetype-caps';

test('advanceWeek refuses to run while a slot is capped', () => {
  let state = runHeadlessFullCareer(createLaunchCareerSetup(0, undefined, undefined, 'full'), 1);
  // put state into a manage week with a capped slot
  state = { ...state, phase: 'manage', trainingPoints: 100 };
  const capped = state.players.find(p => p.clubId === state.userClubId)!;
  const defCap = playerAttributeCaps(capped).def;
  state = { ...state, players: state.players.map(p => p.id === capped.id ? { ...p, attrs: { ...p.attrs, def: defCap } } : p) };
  state = setCareerTrainingPlan(state, [{ playerId: capped.id, pathId: 'duels' }]);
  expect(() => advanceWeek(state)).toThrow(/training/i);
});
```

- [ ] **Step 2: Run it, expect FAIL** (advance currently succeeds and silently skips)

Run: `npx jest training-advance-guard -v`
Expected: FAIL

- [ ] **Step 3: Add the guard.** Read `advanceWeek` in `src/game/career.ts`. At the very top of the manage→settlement path (before any TP income/training resolves), add:

```ts
  // Blocking training interrupts must be resolved in the UI before advancing.
  const projectedTrainingPoints = state.trainingPoints + weeklyAmbientTrainingPoints(state);
  const interrupts = pendingTrainingInterrupts(state, projectedTrainingPoints);
  if (interrupts.cappedSlots.length > 0 || interrupts.tpShortfall > 0) {
    throw new Error('unresolved training interrupts must be cleared before advancing the week');
  }
```

Add imports at the top of `career.ts`: `pendingTrainingInterrupts` from `./training` and confirm `weeklyAmbientTrainingPoints` is in scope (it is defined in `career.ts`). If `advanceWeek` is also used for non-`full` careers (M1 slice), gate this block behind `if (state.careerMode === 'full')` since interrupts only apply to full careers.

- [ ] **Step 4: Run it, expect PASS**

Run: `npx jest training-advance-guard -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/career.ts src/game/__tests__/training-advance-guard.test.ts
git commit -m "feat: block week-advance on unresolved training interrupts"
```

---

## Task 9: Fix the exact-value balance tests broken by money→0

**Files:**
- Modify: `src/game/__tests__/balance.test.ts:50`
- Modify: `src/game/__tests__/facility-weekly-integration.test.ts:61-62`
- (Grep for any other test asserting a non-zero `'training'` ledger line.)

- [ ] **Step 1: Run the full suite to see the breakage**

Run: `npx jest balance facility-weekly-integration -v`
Expected: FAILs on the discretionary-spend and training-line assertions.

- [ ] **Step 2: Update the assertions to the new reality.** These tests likely set the *old* group plan API — first migrate their plan setup to the slot API (`setCareerTrainingPlan(state, [{ playerId, pathId }])`). Then:
  - `balance.test.ts:50` — `meanSeasonOneDiscretionarySpend` no longer includes per-week training money. If the scenario trained 1 drill on 1 player, the training money component (30 × 400) drops to 0, so the expected value becomes just the pitch component (`8000`). Update the number and its comment.
  - `facility-weekly-integration.test.ts:61-62` — the `'training'` ledger line becomes `0`; update `[-800, -800, -800, -800]` to `[0, 0, 0, 0]` (or assert no training money line is emitted, matching how settlement now records it).

- [ ] **Step 3: Run, expect PASS**

Run: `npx jest balance facility-weekly-integration -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/game/__tests__/balance.test.ts src/game/__tests__/facility-weekly-integration.test.ts
git commit -m "test: update exact-value economy tests for TP-only training"
```

---

## Task 10: Update remaining training tests + verify balance corridors

**Files:**
- Modify: `src/game/__tests__/m2-training-growth.test.ts`, `training-cap-feedback.test.ts`, `archetype-caps.test.ts` (whichever set the old group plan API)
- Verify (do not weaken casually): `src/game/__tests__/m2-balance.test.ts`

- [ ] **Step 1: Migrate any test using the old `setCareerTrainingPlan(state, ids, drills)` signature** to slots: `setCareerTrainingPlan(state, [{ playerId, pathId }, ...])`. Replace drill objects with the path id (e.g. drill `sprints-ii` → `pathId: 'sprints'`; the resolver picks the tier for the club's division).

- [ ] **Step 2: Run the whole game suite**

Run: `npx jest src/game -v`
Expected: All pass. If `m2-balance.test.ts` corridors shift because the passive runner's ~1-drill training no longer costs money, confirm the `loanCount === 40` invariant still holds. If a corridor bound is now violated by a *smaller* deficit (less debt), tighten the bound to the new value and note it in the test comment — do **not** loosen an upper cash bound without checking Task 11 first.

- [ ] **Step 3: Commit**

```bash
git add src/game/__tests__
git commit -m "test: migrate training tests to the slot API"
```

---

## Task 11: New active-manager economy rail

The existing harness is passive and never trains. Add a rail that simulates a *winning, actively-training* manager (TP-only) and asserts the economy neither builds up nor breaks — guarding the whole redesign.

**Files:**
- Create: `src/game/__tests__/active-manager-balance.test.ts`

- [ ] **Step 1: Write the test** (drives the real engine; each week trains the 3 highest-headroom, non-injured user players to avoid capped slots and TP shortfalls)

```ts
// src/game/__tests__/active-manager-balance.test.ts
import { createLaunchCareerSetup } from '../../application/launch';
import {
  activeCareerMatchday, advanceWeek, completeMatchday, createCareer, startNextSeason,
} from '../career';
import { renewCareerPlayer } from '../squad';
import { setCareerTrainingPlan } from '../training';
import { playerAttributeCaps } from '../archetype-caps';
import { TRAINING_PATHS } from '../training-paths';
import type { GameState, LeagueFixture } from '../types';

const SEEDS = [0, 77, 20_260_719];
const SEASONS = 6;

function winnerScore(f: LeagueFixture, user: string) {
  if (f.homeClubId === user) return { fixtureId: f.id, homeGoals: 3, awayGoals: 0 };
  if (f.awayClubId === user) return { fixtureId: f.id, homeGoals: 0, awayGoals: 3 };
  return { fixtureId: f.id, homeGoals: 1, awayGoals: 1 };
}

// Pick up to 3 non-injured players with the most total headroom, each on the
// path where they have the most room — so no slot is capped and the plan is cheap.
function bestSlots(state: GameState) {
  const roster = state.players.filter(p => p.clubId === state.userClubId && (p.injuryWeeks ?? 0) === 0);
  const scored = roster.map(p => {
    const caps = playerAttributeCaps(p);
    const best = TRAINING_PATHS
      .map(path => ({ pathId: path.pathId, room: caps[path.attribute] - p.attrs[path.attribute] }))
      .sort((a, b) => b.room - a.room)[0];
    return { playerId: p.id, pathId: best.pathId, room: best.room };
  }).filter(s => s.room > 0).sort((a, b) => b.room - a.room);
  return scored.slice(0, 3).map(s => ({ playerId: s.playerId, pathId: s.pathId }));
}

describe('active-manager economy rail', () => {
  test.each(SEEDS)('a winning, actively-training manager stays bounded (seed %i)', seed => {
    let state = createCareer({ ...createLaunchCareerSetup(seed, undefined, undefined, 'full'), careerMode: 'full' });
    let guard = 0;
    while (!(state.phase === 'season-end' && state.season === SEASONS)) {
      if (guard++ > SEASONS * 64 + 1) throw new Error('overran');
      if (state.phase === 'manage') {
        const slots = bestSlots(state);
        if (slots.length > 0) state = setCareerTrainingPlan(state, slots);
        state = advanceWeek(state);
      } else if (state.phase === 'matchday') {
        const md = activeCareerMatchday(state)!;
        state = completeMatchday(state, md.fixtures.map(f => winnerScore(f, state.userClubId)));
      } else if (state.phase === 'season-end') {
        for (const p of state.players.filter(p => p.clubId === state.userClubId && p.contractSeasonsRemaining === 0)) {
          state = renewCareerPlayer(state, p.id, 4, 1);
        }
        state = startNextSeason(state);
      }
    }
    const balances = state.ledgers.map(l => l.balanceAfter);
    // No runaway build-up: even a flawless winner who trains for free every week
    // must not accumulate cash beyond a sane ceiling (facility/wage economy absorbs it).
    expect(Math.max(...balances)).toBeLessThanOrEqual(150_000);
    // Determinism + no NaN money.
    expect(balances.every(b => Number.isSafeInteger(b))).toBe(true);
    expect(state.trainingPoints).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx jest active-manager-balance -v`
Expected: PASS. If `advanceWeek` throws an interrupt, `bestSlots` is choosing a capped/over-budget slot — confirm it filters `room > 0` and that per-slot TP cost (≤3 × 15 = 45) is within a winning club's income; if a very early week is TP-short, guard `setCareerTrainingPlan` with a slot count that fits `state.trainingPoints` (train fewer players that week).

- [ ] **Step 3: Tune the ceiling** to the observed max plus headroom (the design sim peaked ~120k on the no-cost path; 150k leaves margin). Set the assertion to a value that passes today and would catch a real loosening.

- [ ] **Step 4: Commit**

```bash
git add src/game/__tests__/active-manager-balance.test.ts
git commit -m "test: active-manager economy rail guards the TP-only redesign"
```

---

## Task 12: Full green + typecheck

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Fix any lingering references to the removed group-plan shape **inside `src/game/` and `src/persistence/` only** (Plan 2 owns `src/application/view-models.ts`, `src/game/store.ts`, `src/ui/**`, `App.tsx`; if those break compilation, that is expected — this plan's green bar is the `src/game` + `src/persistence` test suites, not the app build).

- [ ] **Step 2: Run the game + persistence suites**

Run: `npx jest src/game src/persistence -v`
Expected: PASS.

- [ ] **Step 3: Final commit if anything changed**

```bash
git add -A src/game src/persistence content
git commit -m "chore: engine training redesign green (game + persistence suites)"
```

---

## Self-review notes (for the executor)

- **Old→new API:** `setCareerTrainingPlan(state, ids, drills)` → `setCareerTrainingPlan(state, slots)`. `chargeableCareerTrainingPlan` is gone; cost is `slotTrainingPointCost(state, slots)`. Cap detection is `pendingTrainingInterrupts(state, availableTP).cappedSlots` (replaces `trainingPlanCapConflicts` + `trainingCapNotices` for the blocking flow).
- **Naming consistency:** `pathId` everywhere (never `drillPathId` on a slot); `slotIsAtCap`, `slotTrainingPointCost`, `pendingTrainingInterrupts`, `resolveTrainingDrillForPath`, `trainingPathAttribute`, `trainingPathLabel` — use these exact names in Plan 2.
- **Deferred deletions:** Some old exports (`trainingSelectionMatchesSavedPlan`, `trainingCapNotices` plumbing) may still be imported by the store/VM; leave them compiling and let Plan 2 delete them when it removes the lock-in UI.
- **`ENGINE_VERSION` is not bumped** — training is game-layer, not match-sim; no golden-replay impact.
```
