# Pass Combo Speed Bonus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While a team strings passes together, every player who has touched the ball in that chain runs faster, with the bonus decaying over 3 seconds.

**Architecture:** The pass chain moves from the render ring (where it is decoration) into `MatchState` (where it is authoritative). Membership is a monotonic chain id stamped on each entity; the bonus is a tier plus a 30-tick countdown, applied as one multiplication inside `speedFor128`. The render ring stops counting and starts reading.

**Tech Stack:** TypeScript, Jest, Expo/React Native, react-native-skia (Atlas batched API), `ffmpeg` for audio conversion.

**Spec:** `docs/superpowers/specs/2026-08-19-pass-combo-speed-bonus-design.md`

## Global Constraints

- `src/sim/` and `src/game/` are **pure TypeScript**. No React Native, Skia, or Expo imports. No `Math.random`, no `Date.now`. `determinism-guard.test.ts` enforces this with a static regex ban.
- Any replay-affecting sim change **must** bump `ENGINE_VERSION` in `src/sim/match.ts`. Current value: `'m2.4'`. Target: `'m2.5'`.
- Never update a golden snapshot without a version decision. Three baselines move here: `EXPECTED_RUNTIME_GOLDEN`, `EXPECTED_GOAL_GOLDEN` (both in `src/sim/runtime-golden.ts`), and the `src/sim/__tests__/parity-replay.test.ts` snapshot.
- Balance rails must stay green: normal goals/match `[1.5, 4.0]`, shots/match `[8, 40]`, saveRate `[0.55, 0.90]`; blowout strong goals/match `< 9`, p95 margin `≤ 9`, p99 `≤ 11`.
- **No new player-facing copy in this feature.** The pop draws digits from an existing 3×5 pixel face. If you find yourself adding an English string, stop — it would need all seven locales in the same commit.
- Sim ring may not import `src/i18n`. Render ring may not be imported by sim.
- Match rendering uses the Atlas batched API. Never one component per sprite.
- Tier constants, in ten-thousandths: `TIER_D = [0, 0, 200, 400, 1000, 1500, 2000]`, indexed by chain length, clamped at 6. `PASS_COMBO_DECAY_TICKS = 30`.
- Chain ids are **monotonic**. Start at 1, only ever increment, never reset to 1, never assign 0 to a live chain.

## File Structure

**Sim (pure TS):**
- `src/sim/types.ts` — `SimPlayer` gains 3 fields; `MatchState` gains `passCombo`; new `PassComboChain` interface.
- `src/sim/pass-combo.ts` *(new)* — tier table, `comboBonusD`, `snapUp`, `endChain`, `decayPassCombo`, `extendChain`. All chain arithmetic in one file so `engine.ts` (2346 lines) does not grow another subsystem.
- `src/sim/engine.ts` — call the new module from the pass-arrival branch, the break sites, `restartKickoff`, and `speedFor128`. Export `speedFor128`.
- `src/sim/entities.ts` — export `activeTeamPlayerIndices` (currently module-private).
- `src/sim/match.ts` — `makePlayers` init, `createMatch` init, `decayPassCombo` call in `tick()`, `ENGINE_VERSION` bump.
- `src/sim/substitutions.ts` — init the 3 fields in the substitute literal.
- `src/sim/powers.ts` — init the 3 fields in the Decoy clone literal (~1612).

**Render:**
- `src/render/pass-combo.ts` — delete `passComboAfter`, `PassComboChain`, `PassComboInput`, `PASS_COMBO_IDLE`. Keep glyph/scale/opacity/rise.
- `src/render/MatchScreen.tsx` — read `s.passCombo`; per-entity trails; two new SFX triggers.
- `src/render/audio.ts` — 2 new `SfxKey`s and sources.
- `src/render/live-power-effect-actors.ts` — `ghosts` parameter on `superSpeedAfterimageActors`.
- `assets/audio/sfx/` — 2 new `.m4a` files.

**Tests:**
- `src/sim/__tests__/pass-combo-speed.test.ts` *(new)* — 20 cases.
- `src/render/__tests__/pass-combo.test.ts` — rewrite the source-grep wiring cases.
- `src/render/__tests__/audio-profile.test.ts` — add 2 keys.
- `src/render/__tests__/live-power-effect-actors.test.ts` — cover `ghosts`.

---

### Task 1: State fields and initialisation

Type-only. No behaviour changes, no test output changes. The deliverable is a green `tsc` with the new fields threaded through every construction site.

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/match.ts` (`makePlayers` ~143, `createMatch` ~181)
- Modify: `src/sim/substitutions.ts:43-58`
- Modify: `src/sim/powers.ts:1611-1638`
- Modify: `src/sim/entities.ts:52`

**Interfaces:**
- Consumes: nothing.
- Produces: `SimPlayer.comboTierD: number`, `SimPlayer.comboTicks: number`, `SimPlayer.comboChainId: number`, `MatchState.passCombo: [PassComboChain, PassComboChain]`, `export interface PassComboChain { count: number; chainId: number }`, `export function activeTeamPlayerIndices(state: MatchState, team: 0 | 1): number[]`.

- [ ] **Step 1: Add the fields to `SimPlayer` in `src/sim/types.ts`**

Insert after the `cards: 0 | 1 | 2;` line, inside `interface SimPlayer`:

```ts
  /**
   * Pass-combo speed bonus tier in ten-thousandths (2000 = +20%). The live
   * bonus is derived from this and `comboTicks`, never stored, so it cannot
   * drift.
   */
  comboTierD: number;
  /** Ticks left on that bonus, 30 down to 0. At 0 the tier is cleared too. */
  comboTicks: number;
  /**
   * Id of the last pass chain this entity touched the ball in. 0 means never.
   * Live chain ids start at 1, so a freshly built entity can never match one.
   */
  comboChainId: number;
```

- [ ] **Step 2: Add `PassComboChain` and the `MatchState` field in `src/sim/types.ts`**

Add above `export interface MatchState`:

```ts
/**
 * One team's live pass chain. `chainId` is an epoch: ending a chain increments
 * it, which drops every member at once without touching them. It is never
 * reset and never reused, because `restartKickoff` reuses the same SimPlayer
 * objects and a recycled id would silently re-enrol last half's members.
 */
export interface PassComboChain {
  count: number;
  chainId: number;
}
```

Add inside `MatchState`, after `resolve: [number, number];`:

```ts
  /** Live pass chain per team. The render ring reads this instead of counting events. */
  passCombo: [PassComboChain, PassComboChain];
```

- [ ] **Step 3: Initialise in `makePlayers` (`src/sim/match.ts` ~161)**

Add to the object literal returned by `mk`, after `tackleCooldownUntil: 0,`:

```ts
      comboTierD: 0,
      comboTicks: 0,
      comboChainId: 0,
```

- [ ] **Step 4: Initialise in `createMatch` (`src/sim/match.ts` ~218)**

Add to the `MatchState` literal, after `resolve: [100, 100],`:

```ts
    passCombo: [
      { count: 0, chainId: 1 },
      { count: 0, chainId: 1 },
    ],
```

This must sit above the `restartKickoff(state, 0)` call at ~228, which will read it once Task 3 lands.

- [ ] **Step 5: Initialise in `performSubstitution` (`src/sim/substitutions.ts` ~57)**

Add to the `state.players[playerIndex] = { ... }` literal, after `cards: 0,`:

```ts
    comboTierD: 0,
    comboTicks: 0,
    comboChainId: 0,
```

A substitute is a new object, so it starts outside every live chain by construction. There is deliberately no bit-clearing line to write.

- [ ] **Step 6: Initialise in the Decoy clone literal (`src/sim/powers.ts` ~1630)**

Add after `cards: 0,`:

```ts
    comboTierD: 0,
    comboTicks: 0,
    comboChainId: 0,
```

This is the **third** `SimPlayer` literal and the one most easily missed. Clones are entities 22/23 and are first-class chain members.

- [ ] **Step 7: Export `activeTeamPlayerIndices` in `src/sim/entities.ts:52`**

Change `function activeTeamPlayerIndices(` to `export function activeTeamPlayerIndices(`.

It already returns the team's 11 slots and appends the live clone. That is exactly the member enumeration Task 3 needs.

- [ ] **Step 8: Run the type check**

Run: `npx tsc --noEmit`
Expected: PASS. If it fails naming a `SimPlayer` literal you have not touched, that is a fourth construction site — add the three fields there too and note it.

- [ ] **Step 9: Run the sim suite to prove nothing moved**

Run: `npx jest src/sim/__tests__/runtime-golden.test.ts src/sim/__tests__/parity-replay.test.ts`
Expected: PASS, unchanged. This task adds unread fields only. **If a golden moves here, stop** — something is being read that should not be.

- [ ] **Step 10: Commit**

```bash
git add src/sim/types.ts src/sim/match.ts src/sim/substitutions.ts src/sim/powers.ts src/sim/entities.ts
git commit -m "feat(sim): add pass-combo state fields to SimPlayer and MatchState"
```

---

### Task 2: Chain arithmetic module and decay

The pure functions, with no engine wiring yet. Everything is unit-testable without a running match.

**Files:**
- Create: `src/sim/pass-combo.ts`
- Create: `src/sim/__tests__/pass-combo-speed.test.ts`
- Modify: `src/sim/match.ts` (`tick()` ~532)

**Interfaces:**
- Consumes: Task 1's `SimPlayer` fields, `MatchState.passCombo`, `activeTeamPlayerIndices`.
- Produces:
  - `export const PASS_COMBO_DECAY_TICKS = 30`
  - `export const PASS_COMBO_TIER_D: readonly number[]`
  - `export function comboBonusD(p: SimPlayer): number`
  - `export function endChain(state: MatchState, team: 0 | 1): void`
  - `export function decayPassCombo(state: MatchState): void`

- [ ] **Step 1: Write the failing tests**

Create `src/sim/__tests__/pass-combo-speed.test.ts`:

```ts
import { createMatch } from '../match';
import {
  PASS_COMBO_DECAY_TICKS,
  PASS_COMBO_TIER_D,
  comboBonusD,
  decayPassCombo,
  endChain,
} from '../pass-combo';
import { ROVERS, UNITED } from '../teams';
import type { MatchState } from '../types';

const POLICIES = {
  homePolicy: 'FIRE_WHEN_READY' as const,
  awayPolicy: 'FIRE_WHEN_READY' as const,
};

function freshMatch(seed = 7): MatchState {
  return createMatch(seed, ROVERS, UNITED, POLICIES);
}

describe('pass combo bonus arithmetic', () => {
  it('derives the bonus from tier and remaining ticks', () => {
    const p = freshMatch().players[3];
    p.comboTierD = 2000;
    p.comboTicks = 30;
    expect(comboBonusD(p)).toBe(2000);
    p.comboTicks = 15;
    expect(comboBonusD(p)).toBe(1000);
    p.comboTicks = 0;
    expect(comboBonusD(p)).toBe(0);
  });

  it('reaches exactly zero after 30 decay ticks from every tier', () => {
    for (const tier of [200, 400, 1000, 1500, 2000]) {
      const state = freshMatch();
      const p = state.players[3];
      p.comboTierD = tier;
      p.comboTicks = PASS_COMBO_DECAY_TICKS;
      for (let i = 0; i < PASS_COMBO_DECAY_TICKS - 1; i += 1) {
        decayPassCombo(state);
        expect(comboBonusD(p)).toBeGreaterThan(0);
      }
      decayPassCombo(state);
      expect(comboBonusD(p)).toBe(0);
      expect(p.comboTierD).toBe(0);
    }
  });

  it('decays a live Decoy clone, not just state.players', () => {
    const state = freshMatch();
    const clone = { ...state.players[9], comboTierD: 2000, comboTicks: 30 };
    state.decoyClones[0] = clone as (typeof state.decoyClones)[0];
    decayPassCombo(state);
    expect(state.decoyClones[0]!.comboTicks).toBe(29);
  });

  it('endChain zeroes the count and always increments the id', () => {
    const state = freshMatch();
    state.passCombo[0] = { count: 4, chainId: 1 };
    endChain(state, 0);
    expect(state.passCombo[0]).toEqual({ count: 0, chainId: 2 });
    endChain(state, 0);
    expect(state.passCombo[0]).toEqual({ count: 0, chainId: 3 });
  });

  it('never produces a chain id of 0 or a reset to 1', () => {
    // Read the starting id rather than hardcoding 1. `createMatch` calls
    // `restartKickoff`, and once Task 3 hooks that, a fresh match already
    // starts at chainId 2.
    const state = freshMatch();
    const start = state.passCombo[1].chainId;
    expect(start).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 50; i += 1) endChain(state, 1);
    expect(state.passCombo[1].chainId).toBe(start + 50);
  });

  it('has a tier table indexed by chain length', () => {
    expect(PASS_COMBO_TIER_D[2]).toBe(200);
    expect(PASS_COMBO_TIER_D[3]).toBe(400);
    expect(PASS_COMBO_TIER_D[4]).toBe(1000);
    expect(PASS_COMBO_TIER_D[5]).toBe(1500);
    expect(PASS_COMBO_TIER_D[6]).toBe(2000);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/sim/__tests__/pass-combo-speed.test.ts`
Expected: FAIL — `Cannot find module '../pass-combo'`.

- [ ] **Step 3: Create `src/sim/pass-combo.ts`**

```ts
/**
 * Pass-chain state: who is in the current chain, how fast it makes them, and
 * how that fades. Pure TS, zero rng draws — the sim ring's rules apply.
 *
 * The chain used to live in the render ring as decoration (`src/render/
 * pass-combo.ts`). It moved here the moment it started changing movement,
 * because anything that changes movement changes results and must be part of
 * the replayable state.
 */
import { activeTeamPlayerIndices, requirePlayerAt } from './entities';
import type { MatchState, SimPlayer } from './types';

/** A bonus falls to zero over 3 seconds at TICK_MS = 100. */
export const PASS_COMBO_DECAY_TICKS = 30;

/**
 * Speed bonus by chain length, in ten-thousandths (2000 = +20%). Index 0 and 1
 * are zero on purpose: a single completed pass is not a combo, and the pop
 * already starts at x2. Chain lengths above 6 clamp to the last entry.
 */
export const PASS_COMBO_TIER_D: readonly number[] = [
  0, 0, 200, 400, 1000, 1500, 2000,
];

export function tierForCount(count: number): number {
  if (count < 2) return 0;
  return PASS_COMBO_TIER_D[Math.min(count, PASS_COMBO_TIER_D.length - 1)];
}

/**
 * The live bonus, derived rather than stored. Storing it and shedding a fixed
 * amount per tick cannot land on exactly zero for every tier; a countdown can.
 */
export function comboBonusD(p: SimPlayer): number {
  return Math.floor((p.comboTierD * p.comboTicks) / PASS_COMBO_DECAY_TICKS);
}

/**
 * Raise a member to a tier. Never lowers: a player still decaying from a big
 * broken chain, caught by a fresh small one, keeps both the larger bonus and
 * its original countdown.
 */
export function snapUp(p: SimPlayer, tierD: number): void {
  if (tierD <= comboBonusD(p)) return;
  p.comboTierD = tierD;
  p.comboTicks = PASS_COMBO_DECAY_TICKS;
}

/**
 * End one team's chain. The increment is the load-bearing half: it drops every
 * member at once without touching them, so their countdowns keep running.
 *
 * Ids are monotonic and never recycled. `restartKickoff` reuses the same
 * SimPlayer objects, so a chain id handed back out would silently re-enrol
 * players who touched the ball in a previous chain — the exact bug the chain
 * id exists to prevent.
 */
export function endChain(state: MatchState, team: 0 | 1): void {
  state.passCombo[team].count = 0;
  state.passCombo[team].chainId += 1;
}

/** End both chains. The in-play break case: bonuses keep decaying. */
export function breakPassCombo(state: MatchState): void {
  endChain(state, 0);
  endChain(state, 1);
}

/**
 * A dead-ball restart. Play has stopped, so the surge stops with it — carrying
 * a bonus across a teleport would read as a kickoff bug.
 */
export function resetPassComboForRestart(state: MatchState): void {
  breakPassCombo(state);
  for (const p of state.players) {
    p.comboTierD = 0;
    p.comboTicks = 0;
  }
  for (const clone of state.decoyClones) {
    if (clone === null) continue;
    clone.comboTierD = 0;
    clone.comboTicks = 0;
  }
}

/** One tick of fade, for every entity that has one. Clones included. */
export function decayPassCombo(state: MatchState): void {
  for (const p of state.players) decayOne(p);
  for (const clone of state.decoyClones) {
    if (clone !== null) decayOne(clone);
  }
}

function decayOne(p: SimPlayer): void {
  if (p.comboTicks === 0) return;
  p.comboTicks -= 1;
  if (p.comboTicks === 0) p.comboTierD = 0;
}

/** Members of a team's live chain, clone included when one is on the pitch. */
export function chainMembers(state: MatchState, team: 0 | 1): number[] {
  const { chainId } = state.passCombo[team];
  return activeTeamPlayerIndices(state, team).filter(
    (idx) => requirePlayerAt(state, idx).comboChainId === chainId,
  );
}

/**
 * A completed pass between two players on the same side. Both ends join: the
 * player who made the pass is as much a part of the move as the one who
 * received it.
 */
export function extendPassCombo(
  state: MatchState,
  team: 0 | 1,
  fromIdx: number,
  toIdx: number,
): void {
  endChain(state, team === 0 ? 1 : 0); // one ball, so one live chain
  const chain = state.passCombo[team];
  chain.count += 1;
  requirePlayerAt(state, fromIdx).comboChainId = chain.chainId;
  requirePlayerAt(state, toIdx).comboChainId = chain.chainId;
  const tierD = tierForCount(chain.count);
  if (tierD === 0) return; // x1 records membership and grants nothing
  for (const idx of chainMembers(state, team)) {
    snapUp(requirePlayerAt(state, idx), tierD);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/sim/__tests__/pass-combo-speed.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Register the new module in the import-layer map**

`src/sim/__tests__/import-layers.test.ts` fails **any** new `src/sim/*.ts` that
is not in its `ALLOWED` map, and any import not on that module's own list. A new
sim file is a deliberate act there, not an automatic one.

In `ALLOWED`, add the new module beside `'entities.ts'`:

```ts
  'pass-combo.ts': ['entities', 'types'],
```

and add `'pass-combo'` to the `'match.ts'` list (Task 2 imports it from
`match.ts`; Task 3 will add it to `'engine.ts'`).

- [ ] **Step 6: Verify the layer gate**

Run: `npx jest src/sim/__tests__/import-layers.test.ts`
Expected: PASS. A failure naming `pass-combo.ts: not in the layer map` means
Step 5 was skipped.

- [ ] **Step 7: Call `decayPassCombo` from the tick loop**

In `src/sim/match.ts`, add the import and insert one line in `tick()` between `movementTick(state);` (~532) and `possessionTick(state);`:

```ts
  movementTick(state);
  // After movement, before the pass arrival that may snap a new tier. A snap in
  // possessionTick sets 30 ticks; movement on the NEXT tick then runs at the
  // full tier before this decrement. Decaying first would mean the full tier
  // never moved anybody.
  decayPassCombo(state);
  possessionTick(state);
```

- [ ] **Step 8: Verify the goldens still have not moved**

Run: `npx jest src/sim/__tests__/runtime-golden.test.ts src/sim/__tests__/parity-replay.test.ts`
Expected: PASS. Nothing sets `comboTicks` above zero yet, so decay is a no-op on every entity.

- [ ] **Step 9: Commit**

```bash
git add src/sim/pass-combo.ts src/sim/__tests__/pass-combo-speed.test.ts src/sim/match.ts src/sim/__tests__/import-layers.test.ts
git commit -m "feat(sim): add pass-combo chain arithmetic and per-tick decay"
```

---

### Task 3: Engine hooks — extend and break

Wire the chain to real match events. Still no speed change, so the goldens must stay put.

**Files:**
- Modify: `src/sim/engine.ts` (pass arrival ~1546, `launchPass` ~1759, slide `TACKLE` ~1885, standing `TACKLE` ~2113, `SAVE` ~2294, `restartKickoff` ~336)
- Modify: `src/sim/__tests__/pass-combo-speed.test.ts`

**Interfaces:**
- Consumes: `extendPassCombo`, `breakPassCombo`, `resetPassComboForRestart`, `chainMembers`, `comboBonusD` from `src/sim/pass-combo.ts`.
- Produces: no new exports. `state.passCombo` now moves during a real match.

- [ ] **Step 1: Write the failing tests**

Append to `src/sim/__tests__/pass-combo-speed.test.ts`:

```ts
import { launchPass, possessionTick, restartKickoff } from '../engine';
import { chainMembers, comboBonusD, extendPassCombo } from '../pass-combo';

/**
 * Runs a pass from `from` to `to` all the way to its arrival, through the real
 * engine. `launchPass(state, from, to, lofted, guaranteed)` — the 4th argument
 * is required and the 5th forces the contest to succeed, so this helper always
 * produces a clean catch and exercises the arrival predicate.
 */
function completePass(state: MatchState, from: number, to: number): void {
  state.ball = { kind: 'held', by: from };
  launchPass(state, from, to, false, true);
  for (let i = 0; i < 40 && state.ball.kind === 'pass'; i += 1) {
    possessionTick(state);
  }
}

describe('pass combo chain membership', () => {
  it('enrols both ends of a completed pass and nobody else', () => {
    const state = freshMatch();
    extendPassCombo(state, 0, 4, 7);
    expect(chainMembers(state, 0).sort()).toEqual([4, 7]);
    expect(comboBonusD(state.players[5])).toBe(0);
  });

  it('grants nothing at x1 and 200 at x2', () => {
    const state = freshMatch();
    extendPassCombo(state, 0, 4, 7);
    expect(comboBonusD(state.players[4])).toBe(0);
    extendPassCombo(state, 0, 7, 5);
    expect(comboBonusD(state.players[4])).toBe(200);
    expect(comboBonusD(state.players[5])).toBe(200);
  });

  it('climbs the ladder and holds at 2000 above x6', () => {
    const state = freshMatch();
    const order = [4, 7, 5, 6, 8, 3, 2, 1];
    for (let i = 0; i + 1 < order.length; i += 1) {
      extendPassCombo(state, 0, order[i], order[i + 1]);
    }
    expect(state.passCombo[0].count).toBe(7);
    expect(comboBonusD(state.players[1])).toBe(2000);
  });

  it('enrols a Decoy clone and not the keeper or the copied forward', () => {
    const state = freshMatch();
    state.decoyClones[0] = {
      ...state.players[9],
      comboTierD: 0,
      comboTicks: 0,
      comboChainId: 0,
      ownerIdx: 9,
      ownerPlayerId: state.players[9].def.id,
      sourceIdx: 9,
      sourcePlayerId: state.players[9].def.id,
      formationSlot: 9,
      untilTick: 9999,
    } as (typeof state.decoyClones)[0];
    extendPassCombo(state, 0, 6, 22);
    extendPassCombo(state, 0, 22, 9);
    const members = chainMembers(state, 0).sort((a, b) => a - b);
    expect(members).toEqual([6, 9, 22]);
    expect(comboBonusD(state.players[0])).toBe(0); // keeper untouched
  });

  it('does not lift a stale decayer from a previous chain', () => {
    const state = freshMatch();
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5); // 4, 7, 5 at 200
    breakPassCombo(state);
    extendPassCombo(state, 0, 8, 6);
    extendPassCombo(state, 0, 6, 3);
    extendPassCombo(state, 0, 3, 2);
    extendPassCombo(state, 0, 2, 1);
    extendPassCombo(state, 0, 1, 10); // five extends = x5
    expect(state.passCombo[0].count).toBe(5);
    expect(comboBonusD(state.players[8])).toBe(1500);
    expect(comboBonusD(state.players[4])).toBe(200); // still the old tier
  });

  it('keeps the higher bonus and the old countdown across a break', () => {
    const state = freshMatch();
    const order = [4, 7, 5, 6, 8, 3, 2];
    for (let i = 0; i + 1 < order.length; i += 1) {
      extendPassCombo(state, 0, order[i], order[i + 1]);
    }
    expect(comboBonusD(state.players[4])).toBe(2000);
    breakPassCombo(state);
    for (let i = 0; i < 3; i += 1) decayPassCombo(state);
    const beforeSnap = comboBonusD(state.players[4]);
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5); // a fresh x2 = 200
    expect(comboBonusD(state.players[4])).toBe(beforeSnap);
    expect(state.players[4].comboTierD).toBe(2000);
  });

  it('ends the other team chain on a completion', () => {
    const state = freshMatch();
    const order = [4, 7, 5, 6, 8];
    for (let i = 0; i + 1 < order.length; i += 1) {
      extendPassCombo(state, 0, order[i], order[i + 1]);
    }
    const idBefore = state.passCombo[0].chainId;
    expect(state.passCombo[0].count).toBe(4); // four extends, not three
    extendPassCombo(state, 1, 15, 17);
    expect(state.passCombo[0].count).toBe(0);
    expect(state.passCombo[0].chainId).toBeGreaterThan(idBefore);
    expect(chainMembers(state, 0)).toEqual([]);
    expect(chainMembers(state, 1).sort()).toEqual([15, 17]);
  });

  it('does not re-enrol first-half members after a restart', () => {
    const state = freshMatch();
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5);
    restartKickoff(state, 0);
    expect(state.passCombo[0].count).toBe(0);
    expect(comboBonusD(state.players[4])).toBe(0);
    extendPassCombo(state, 0, 8, 6);
    extendPassCombo(state, 0, 6, 3);
    expect(comboBonusD(state.players[4])).toBe(0);
    expect(comboBonusD(state.players[8])).toBe(200);
  });

  it('extends through a real engine arrival, not just the helper', () => {
    // Every other membership case calls extendPassCombo directly. Without this
    // one, the clean-catch predicate at engine.ts ~1546 has NO test and an
    // implementer could skip Task 3 Step 3 with a green suite.
    const state = freshMatch();
    completePass(state, 4, 7);
    completePass(state, 7, 5);
    expect(state.passCombo[0].count).toBe(2);
    expect(chainMembers(state, 0).sort((a, b) => a - b)).toEqual([4, 5, 7]);
    expect(comboBonusD(state.players[4])).toBe(200);
  });

  it('breaks the chain when a pass fails at launch', () => {
    const state = freshMatch();
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5);
    state.ball = { kind: 'held', by: 5 };
    // `ok` comes from a contest roll, NOT from distance — a far-away target
    // still succeeds when the roll wins. Force the roll to lose instead:
    // contest is `rng() < p`, and 1 never wins.
    state.rng = () => 1;
    launchPass(state, 5, 7, false);
    expect(state.passCombo[0].count).toBe(0);
  });

  it('does not re-extend on a same-team Gust redirect', () => {
    // Gust marks the pass ok:false (so the launch hook breaks the chain) but
    // leaves willSucceed true with b.to rewritten to a keeper. When that keeper
    // is on the passer's own side, a plain same-team test would restart the
    // chain that was just killed. This is the whole reason the predicate reads
    // b.gustRedirect explicitly.
    const state = freshMatch();
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5);
    breakPassCombo(state);
    state.ball = {
      kind: 'pass',
      pos: { ...state.players[5].pos },
      from: 5,
      to: 0,
      willSucceed: true,
      interceptor: -1,
      z: 0,
      vz: 0,
      speed: 250,
      gustRedirect: true,
    };
    for (let i = 0; i < 40 && state.ball.kind === 'pass'; i += 1) {
      possessionTick(state);
    }
    expect(state.passCombo[0].count).toBe(0);
  });

  it('breaks on a won tackle and on a save', () => {
    // The hook sites are specified in Steps 5; without these the wiring can be
    // omitted and every other case still passes.
    const state = freshMatch();
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5);
    const idBefore = state.passCombo[0].chainId;
    breakPassCombo(state);
    expect(state.passCombo[0].count).toBe(0);
    expect(state.passCombo[0].chainId).toBe(idBefore + 1);
    // The bonus survives an in-play break and keeps fading.
    expect(comboBonusD(state.players[4])).toBe(200);
  });

  it('gives a substitute no membership', () => {
    const state = freshMatch();
    extendPassCombo(state, 0, 4, 7);
    extendPassCombo(state, 0, 7, 5);
    const sub = state.bench[0][0];
    if (sub !== undefined) {
      performSubstitution(state, 0, 5, sub.id);
      expect(state.players[5].comboChainId).toBe(0);
      expect(comboBonusD(state.players[5])).toBe(0);
      expect(chainMembers(state, 0)).not.toContain(5);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/sim/__tests__/pass-combo-speed.test.ts`
Expected: FAIL on the `restartKickoff` and `launchPass` cases — the engine does not call the new module yet.

- [ ] **Step 3: Hook the pass arrival in `src/sim/engine.ts`**

Find the branch at ~1546 that sets `state.ball = { kind: 'held', by: targetIdx }` and computes `const intercepted = ...` just below it. After the `addGauge` call in that block, add:

```ts
        // Clean catch: the ball reached its intended man on the passing side.
        // Every clause matters. `b.gustRedirect` is the subtle one — Gust marks
        // the pass `ok: false` (so the launch hook already broke the chain) but
        // leaves `willSucceed` true with `b.to` rewritten to a keeper. When
        // that keeper is on the passer's own side, a plain same-team test
        // re-extends the chain that was just killed.
        const passerTeam = playerAt(state, b.from)?.team;
        const receiverTeam = requirePlayerAt(state, targetIdx).team;
        if (
          !intercepted &&
          b.looseOnArrival !== true &&
          b.gustRedirect !== true &&
          passerTeam !== undefined &&
          passerTeam === receiverTeam
        ) {
          extendPassCombo(state, receiverTeam, b.from, targetIdx);
        } else {
          breakPassCombo(state);
        }
```

Every other exit from the pass-arrival code — the loose-ball branch above it, and the knocked-out-receiver path — needs `breakPassCombo(state);` too. Search the enclosing `if (state.ball.kind === 'pass')` block for each `state.ball = { kind: 'loose', ... }` assignment and add the call.

- [ ] **Step 4: Hook the launch failure in `launchPass` (~1759)**

Immediately after the `emit(state, { t: state.tick, kind: 'PASS', from, to, ok: ok && gustRedirect === null });` call:

```ts
  // A pass that will not arrive ends the run at the boot, not at the landing.
  // `ok && gustRedirect === null` is the same expression the event carries, so
  // the chain and the emitted event can never disagree.
  if (!(ok && gustRedirect === null)) breakPassCombo(state);
```

- [ ] **Step 5: Hook the won tackles and the save**

After the slide `TACKLE` emit (~1885) and the standing `TACKLE` emit (~2113), add:

```ts
  if (won) breakPassCombo(state);
```

After the `SAVE` emit (~2294), add:

```ts
        breakPassCombo(state);
```

- [ ] **Step 6: Hook `restartKickoff` (~336)**

Add as the first line of the function body, before `clearRestartPowerState(state);`:

```ts
  resetPassComboForRestart(state);
```

This one call covers kickoff, goal, miss, half time and match start — every one of them routes through here.

- [ ] **Step 7: Add `pass-combo` to `engine.ts` in the import-layer map**

In `src/sim/__tests__/import-layers.test.ts`, add `'pass-combo'` to the
`'engine.ts'` list. Without it the layer gate goes red as soon as `engine.ts`
imports the module.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx jest src/sim/__tests__/pass-combo-speed.test.ts src/sim/__tests__/import-layers.test.ts`
Expected: PASS.

- [ ] **Step 9: Verify the goldens STILL have not moved**

Run: `npx jest src/sim/__tests__/runtime-golden.test.ts src/sim/__tests__/parity-replay.test.ts`
Expected: PASS. The chain now moves, but nothing reads it for movement yet. **A failure here means something is reading `comboBonusD` early** — find it before continuing, because Task 4 is where a golden change becomes legitimate and you will not be able to tell the two apart.

- [ ] **Step 10: Commit**

```bash
git add src/sim/engine.ts src/sim/__tests__/pass-combo-speed.test.ts src/sim/__tests__/import-layers.test.ts
git commit -m "feat(sim): track the pass chain through arrivals, tackles, saves and restarts"
```

---

### Task 4: Apply the bonus to movement

The task that changes results. `ENGINE_VERSION`, both goldens, and the parity snapshot all move here, deliberately and together.

**Files:**
- Modify: `src/sim/engine.ts` (`speedFor128` ~284)
- Modify: `src/sim/match.ts` (`ENGINE_VERSION` line 60)
- Modify: `src/sim/runtime-golden.ts` (lines 26, 35)
- Modify: `src/sim/__tests__/__snapshots__/parity-replay.test.ts.snap`
- Modify: `src/sim/__tests__/pass-combo-speed.test.ts`

**Interfaces:**
- Consumes: `comboBonusD`.
- Produces: `export function speedFor128(state: MatchState, idx: number): number` — exported so tests can assert the exact integer without the second `Math.round` in `speedFor`.

- [ ] **Step 1: Write the failing tests**

Append to `src/sim/__tests__/pass-combo-speed.test.ts`:

```ts
import { movementTick, speedFor128 } from '../engine';
import { tick } from '../match';

describe('pass combo speed', () => {
  it('multiplies a member speed by the tier and leaves everyone else alone', () => {
    const state = freshMatch();
    const baseline = speedFor128(state, 4);
    const nonMemberBaseline = speedFor128(state, 10);
    const opponentBaseline = speedFor128(state, 15);
    const order = [4, 7, 5, 6, 8, 3, 2];
    for (let i = 0; i + 1 < order.length; i += 1) {
      extendPassCombo(state, 0, order[i], order[i + 1]);
    }
    expect(comboBonusD(state.players[4])).toBe(2000);
    expect(speedFor128(state, 4)).toBe(Math.round((baseline * 12000) / 10000));
    // A teammate who never touched the ball, and an opponent, are both untouched.
    expect(speedFor128(state, 10)).toBe(nonMemberBaseline);
    expect(speedFor128(state, 15)).toBe(opponentBaseline);
  });

  it('moves a member further in one tick than an identical non-member', () => {
    // Assert the STEP, not the counter. Two matches from the same seed, one
    // with a chain and one without: the member must cover more ground.
    const withChain = freshMatch();
    const without = freshMatch();
    for (const s of [withChain, without]) {
      s.ball = { kind: 'loose', pos: { x: 100, y: 100 }, vel: { x: 0, y: 0 }, z: 0, vz: 0 };
    }
    const order = [4, 7, 5, 6, 8, 3, 2];
    for (let i = 0; i + 1 < order.length; i += 1) {
      extendPassCombo(withChain, 0, order[i], order[i + 1]);
    }
    expect(comboBonusD(withChain.players[4])).toBe(2000);
    const startA = { ...withChain.players[4].pos };
    const startB = { ...without.players[4].pos };
    expect(startA).toEqual(startB);
    movementTick(withChain);
    movementTick(without);
    const movedA =
      Math.abs(withChain.players[4].pos.x - startA.x) +
      Math.abs(withChain.players[4].pos.y - startA.y);
    const movedB =
      Math.abs(without.players[4].pos.x - startB.x) +
      Math.abs(without.players[4].pos.y - startB.y);
    expect(movedA).toBeGreaterThan(movedB);
  });

  it('is deterministic across two identical runs', () => {
    // runMatch(seed, home, away, inputs[], opts) — the 4th argument is the
    // input log, NOT the options object.
    const a = runMatch(12345, ROVERS, UNITED, [], POLICIES);
    const b = runMatch(12345, ROVERS, UNITED, [], POLICIES);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.score).toEqual(b.score);
  });
});
```

Add `runMatch` to the `../match` import, and `performSubstitution` from `../substitutions`. Remove the unused `tick` import if you added it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/sim/__tests__/pass-combo-speed.test.ts -t "pass combo speed"`
Expected: FAIL — `speedFor128` is not exported, and the multiply does not exist.

- [ ] **Step 3: Apply the bonus in `speedFor128` (`src/sim/engine.ts` ~284)**

Replace the function with:

```ts
/**
 * Authoritative 1/128-unit speed. Folds in condition (via
 * `conditionedPaceSpeed128`), power effects (via `speedMultiplier`) and the
 * pass-combo bonus. Energy use is NOT here — `movementTick` applies
 * `energyMovementMultiplier` at its own call site, and only to off-ball
 * players, while a carrier gets `speedFor128 * CARRIER_SPEED_SCALE`. Putting
 * the combo bonus here therefore reaches both.
 *
 * Exported so tests can assert the exact integer; `speedFor` rounds a second
 * time and makes a `x 1.20` comparison flake by 1.
 */
export function speedFor128(state: MatchState, idx: number): number {
  const p = requirePlayerAt(state, idx);
  return Math.round(
    (conditionedPaceSpeed128(state, idx) *
      speedMultiplier(state, idx) *
      (10000 + comboBonusD(p))) /
      10000,
  );
}
```

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `npx jest src/sim/__tests__/pass-combo-speed.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 5: Run the balance rails and RECORD the numbers**

Run: `npx jest src/sim/__tests__/balance-rails.test.ts`

The suite prints a `BALANCE RAILS normal:` line with goals/match, shots/match and saveRate. **Copy that line into the commit message.** You need the before/after pair for the PR body.

Expected: PASS. If a rail is out of bounds, apply the fallback levers from the spec **in this order**, re-measuring after each:

1. Do not apply the bonus to a presser or to a slide tackle. This keeps the passing-move feel and cuts the ball-recovery loop directly.
2. Halve the whole ladder: `[0, 0, 100, 200, 500, 750, 1000]`.
3. Only then shorten `PASS_COMBO_DECAY_TICKS` to 20. Last resort — a 2s window makes x2 and x3 invisible before it makes anything safe.

Never change the rail bounds.

- [ ] **Step 6: Bump `ENGINE_VERSION`**

In `src/sim/match.ts:60`, change `'m2.4'` to `'m2.5'`.

- [ ] **Step 7: Regenerate the two runtime golden fingerprints**

Run: `npx jest src/sim/__tests__/runtime-golden.test.ts`
Expected: FAIL with `runtime golden replay mismatch for m2.5: <actual> != 53c44ee0`.

Copy the actual hash into `EXPECTED_RUNTIME_GOLDEN` (`src/sim/runtime-golden.ts:26`). Re-run, and copy the second actual into `EXPECTED_GOAL_GOLDEN` (line 35). Re-run.
Expected: PASS.

**Check the second contract before you accept it.** The same file asserts seed 81 still produces at least one assisted *and* one unassisted goal, and stamps `scoredById` on every goal. If those cases now fail, rebaseline `GOAL_GOLDEN_SEED` onto a seed that keeps both kinds of goal. Do not weaken the assertions.

- [ ] **Step 8: Regenerate the parity-replay snapshot**

Run: `npx jest src/sim/__tests__/parity-replay.test.ts -u`
Expected: PASS with the snapshot rewritten.

Inspect the diff. Position fingerprints at ticks 500/1000/1500/2000 should all differ; that is the movement change. If they are identical, the bonus is not reaching movement and something is wrong.

- [ ] **Step 9: Run the whole sim suite**

Run: `npx jest src/sim`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/sim/engine.ts src/sim/match.ts src/sim/runtime-golden.ts src/sim/__tests__/
git commit -m "feat(sim): apply the pass-combo speed bonus to movement

Engine m2.4 -> m2.5. Both runtime goldens and the parity-replay snapshot
rebaselined for the movement change.

BALANCE RAILS normal (before): <paste the pre-change line>
BALANCE RAILS normal (after):  <paste the post-change line>"
```

---

### Task 5: Render reads the sim chain

Net deletion. The render ring stops counting and starts reading.

**Files:**
- Modify: `src/render/pass-combo.ts`
- Modify: `src/render/MatchScreen.tsx:1940-1998`
- Modify: `src/render/__tests__/pass-combo.test.ts`

**Interfaces:**
- Consumes: `state.passCombo[team].count` from Task 3.
- Produces: nothing new. `passComboAfter`, `PassComboChain`, `PassComboInput`, `PASS_COMBO_IDLE` are gone from the render ring.

- [ ] **Step 1: Replace the derivation in `MatchScreen.tsx`**

Delete the whole block from the `// Pass chain, counted at the CATCH` comment through the closing brace of the `else if (passInFlightRef.current !== null)` branch (~1940-1998). In its place, still **inside** the `while (acc >= TICK_MS)` catch-up loop:

```ts
        // The sim owns the chain now. Read it per tick rather than after the
        // catch-up loop: one frame can advance several ticks, and a post-loop
        // read would miss a chain that rose and broke inside the same frame.
        //
        // Only one completion can happen per tick, so at most one side's count
        // rises. That side owns the pop, the SFX and the trail.
        const prevCounts = passComboCountsRef.current;
        const nextCounts: [number, number] = [
          s.passCombo[0].count,
          s.passCombo[1].count,
        ];
        const risenTeam =
          nextCounts[0] > prevCounts[0]
            ? 0
            : nextCounts[1] > prevCounts[1]
              ? 1
              : null;
        passComboCountsRef.current = nextCounts;
        if (risenTeam !== null) {
          const count = nextCounts[risenTeam];
          if (count >= PASS_COMBO_FLOOR && s.ball.kind === 'held') {
            const receiver = nextRef.current!.players[s.ball.by];
            setPassComboPop({ count, x: receiver.x, y: receiver.y });
            setNewestPop('combo');
            playPassCombo(count);
            passComboLife.value = 0;
            passComboLife.value = withTiming(PASS_COMBO_POP_MS, {
              duration: PASS_COMBO_POP_MS,
              easing: ReanimatedEasing.linear,
            });
          }
        }
```

Declare the ref beside the others near line 786:

```ts
  const passComboCountsRef = useRef<[number, number]>([0, 0]);
```

and delete the now-unused `passComboChainRef` and `passInFlightRef`.

- [ ] **Step 2: Delete the dead exports from `src/render/pass-combo.ts`**

Remove `PassComboChain`, `PASS_COMBO_IDLE`, `PassComboInput` and `passComboAfter`. Keep `PASS_COMBO_FLOOR`, `PASS_COMBO_POP_MS`, `passComboCellPx`, `passComboGlyph`, `passComboScale`, `passComboOpacity`, `passComboRise`.

Update the module doc comment: it currently says "It counts events the sim already emits and writes nothing back". Replace with a line saying the sim owns the chain and this module only draws it.

- [ ] **Step 3: Rewrite the wiring tests in `src/render/__tests__/pass-combo.test.ts`**

Delete the `passComboAfter` unit cases (~lines 7-40) and the source-grep assertions that name the old derivation — `expect(tickLoop).toContain('passComboAfter')` at line 116 and `expect(screen).toContainSource("if (s.ball.kind === 'pass') {")` at line 99.

Replace the wiring block with greps for the new read:

```ts
  it('reads the chain from sim state inside the catch-up loop', () => {
    const screen = source();
    const tickLoop = screen.slice(
      screen.indexOf('while (acc >= TICK_MS'),
      screen.indexOf('const newEvents = s.events.slice(eventsBefore);'),
    );
    expect(tickLoop.length).toBeGreaterThan(0);
    expect(tickLoop).toContain('s.passCombo[0].count');
    expect(tickLoop).toContain('passComboCountsRef');
    expect(tickLoop).not.toContain('passComboAfter');
  });
```

`tickLoop` is a local, not a shared fixture — the existing test builds it the
same way inside its own `it`. Keep the `source()` helper the file already
defines at the top of the `describe`.

Keep every glyph, scale, opacity and rise case unchanged.

- [ ] **Step 4: Run the render tests**

Run: `npx jest src/render/__tests__/pass-combo.test.ts`
Expected: PASS.

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: PASS. A failure naming `PASS_COMBO_IDLE` or `passComboAfter` means another consumer exists — find and update it.

- [ ] **Step 6: Commit**

```bash
git add src/render/pass-combo.ts src/render/MatchScreen.tsx src/render/__tests__/pass-combo.test.ts
git commit -m "refactor(render): read the pass chain from sim state instead of counting events"
```

---

### Task 6: The x4 and x5 sound cues

**Files:**
- Create: `assets/audio/sfx/pass-combo-epic.m4a`
- Create: `assets/audio/sfx/pass-combo-surge.m4a`
- Modify: `src/render/audio.ts`
- Modify: `src/render/MatchScreen.tsx`
- Modify: `scripts/audio/levels.json` (generated — do not hand-edit)
- Modify: `src/render/__tests__/audio-profile.test.ts`

**Interfaces:**
- Consumes: the count-crossing detection from Task 5.
- Produces: `SfxKey` gains `'pass-combo-epic'` and `'pass-combo-surge'`.

- [ ] **Step 1: Convert both source files**

The project's SFX convention is **24 kHz mono AAC-LC `.m4a` with silent tails trimmed** — see the asset-table comment at the top of `src/render/audio.ts`. Do **not** use the `/convert_music` skill; that produces 40s stereo music at 64 kbps.

```bash
ffmpeg -y -i "/Users/joemacprom5/Downloads/epic_dramatic_movie__#1-1787109676882.wav" \
  -ac 1 -ar 24000 -c:a aac -profile:a aac_low -b:a 64k \
  -af "silenceremove=stop_periods=-1:stop_duration=0.1:stop_threshold=-50dB" \
  assets/audio/sfx/pass-combo-epic.m4a
```

```bash
ffmpeg -y -i "/Users/joemacprom5/Library/Mobile Documents/com~apple~CloudDocs/sounds/cuban.webm" \
  -ac 1 -ar 24000 -c:a aac -profile:a aac_low -b:a 64k \
  -af "silenceremove=stop_periods=-1:stop_duration=0.1:stop_threshold=-50dB" \
  assets/audio/sfx/pass-combo-surge.m4a
```

- [ ] **Step 2: Verify both files**

Run: `ffprobe -v error -show_entries stream=codec_name,sample_rate,channels -show_entries format=duration -of default=nw=1 assets/audio/sfx/pass-combo-epic.m4a`
Expected: `codec_name=aac`, `sample_rate=24000`, `channels=1`, duration at or below the 2.00s source.

Repeat for `pass-combo-surge.m4a` (source is 3.03s).

- [ ] **Step 3: Register the keys in `src/render/audio.ts`**

Add to the `SfxKey` union, next to `'pass-combo'`:

```ts
  | 'pass-combo-epic'
  | 'pass-combo-surge'
```

Add to `SFX_SOURCES`, next to the existing `'pass-combo'` entry:

```ts
  'pass-combo-epic': require('../../assets/audio/sfx/pass-combo-epic.m4a'),
  'pass-combo-surge': require('../../assets/audio/sfx/pass-combo-surge.m4a'),
```

No `scripts/audio/catalog.mjs` entry: that catalog drives the procedural `gen-sfx.mjs` fixtures, and today's `pass-combo` is not in it either.

- [ ] **Step 4: Add the trigger next to the existing `playPassCombo`**

In `src/render/audio.ts`, below `playPassCombo`:

```ts
/**
 * The two escalation cues. Each fires once per chain, at its own threshold —
 * x6 and beyond keep the pitched `pass-combo` pip alone. One hit per threshold
 * keeps each one dramatic, and stops a 3s file overlapping itself on a quick
 * chain.
 */
export function playPassComboMilestone(count: number): void {
  if (count === 4) playSfxKey('pass-combo-epic', false);
  else if (count === 5) playSfxKey('pass-combo-surge', false);
}
```

- [ ] **Step 5: Call it from the crossing detection in `MatchScreen.tsx`**

Inside the `if (count >= PASS_COMBO_FLOOR && s.ball.kind === 'held')` block from Task 5, directly after `playPassCombo(count);`:

```ts
            playPassComboMilestone(count);
```

Add `playPassComboMilestone` to the existing audio import in `MatchScreen.tsx`
(~line 288, where `playPassCombo` already sits). Without it this is a
`ReferenceError` at runtime and a `tsc` failure at build.

Because the block runs on a *rise*, the count passes through 4 and 5 exactly once per chain. No extra "already fired" flag is needed.

- [ ] **Step 6: Write the levels entries**

Run: `npm run audio:levels`

This writes `scripts/audio/levels.json`. It is generated — never hand-edit it.

- [ ] **Step 7: Verify the levels**

Run: `npm run audio:levels:check`
Expected: PASS.

- [ ] **Step 8: Add the keys to the audio profile test**

In `src/render/__tests__/audio-profile.test.ts`, add both keys to the `audioKeysForProfile('full')` assertion list, and add existence checks beside the `pass-combo.m4a` one:

```ts
    expect(
      existsSync(join(process.cwd(), 'assets/audio/sfx/pass-combo-epic.m4a')),
    ).toBe(true);
    expect(
      existsSync(join(process.cwd(), 'assets/audio/sfx/pass-combo-surge.m4a')),
    ).toBe(true);
```

- [ ] **Step 9: Run the audio tests**

Run: `npx jest src/render/__tests__/audio-profile.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add assets/audio/sfx/pass-combo-epic.m4a assets/audio/sfx/pass-combo-surge.m4a src/render/audio.ts src/render/MatchScreen.tsx scripts/audio/levels.json src/render/__tests__/audio-profile.test.ts
git commit -m "feat(audio): dramatic cue at x4 and surge cue at x5 pass combos"
```

---

### Task 7: The x5 afterimage trail

**Files:**
- Modify: `src/render/live-power-effect-actors.ts:129-140`
- Modify: `src/render/MatchScreen.tsx` (trail ref ~746, writer ~1849-1857, atlas consumer ~3344, Circle consumer ~3966)
- Modify: `src/render/__tests__/live-power-effect-actors.test.ts`

**Interfaces:**
- Consumes: `SimPlayer.comboTierD` and `comboTicks` from Task 1.
- Produces: `superSpeedAfterimageActors(player: number, trail: readonly LivePowerEffectPoint[], ghosts?: number)`.

- [ ] **Step 1: Write the failing test**

In `src/render/__tests__/live-power-effect-actors.test.ts`, beside the existing case:

```ts
  it('emits the requested number of ghosts and defaults to six', () => {
    const points = Array.from({ length: 7 }, (_, i) => ({ x: i, y: i }));
    expect(superSpeedAfterimageActors(4, points)).toHaveLength(6);
    expect(superSpeedAfterimageActors(4, points, 3)).toHaveLength(3);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/render/__tests__/live-power-effect-actors.test.ts`
Expected: FAIL — the third argument is ignored, so both assertions return 6.

- [ ] **Step 3: Add the parameter**

Replace `superSpeedAfterimageActors` in `src/render/live-power-effect-actors.ts`:

```ts
/**
 * Ghost sprites behind a moving player. `ghosts` defaults to 6, the Super Speed
 * power's own length; a pass-combo member gets 3.
 *
 * `trail` needs `ghosts + 1` stored points, because index 0 is the live body
 * position and only the tail becomes ghosts.
 */
export function superSpeedAfterimageActors(
  player: number,
  trail: readonly LivePowerEffectPoint[],
  ghosts = 6,
): LivePowerEffectActor[] {
  return trail.slice(1, 1 + ghosts).map((at, index) => ({
    id: `super-speed:${player}:${index}`,
    player,
    at,
    opacity: Math.max(0.12, 0.58 * (1 - index / ghosts)),
    scale: 1,
  }));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest src/render/__tests__/live-power-effect-actors.test.ts`
Expected: PASS.

- [ ] **Step 5: Widen `trailRef` to one history per entity**

At `MatchScreen.tsx:746`, replace the single array:

```ts
  // One 7-point history per entity, indexed by slot. 24 not 22: a Decoy clone
  // can be a pass-combo member. Seven points because slice(1, 1 + ghosts)
  // needs ghosts + 1, and the Super Speed power still wants 6 ghosts.
  const trailRef = useRef<Array<Array<{ x: number; y: number }>>>(
    Array.from({ length: RENDER_PLAYER_COUNT }, () => []),
  );
```

Import `RENDER_PLAYER_COUNT` from `../sim/entities`.

- [ ] **Step 6: Rewrite the trail writer (~1849-1857)**

Replace the single-speedster `find` and the shared push with a per-entity write:

```ts
        // Draw a trail for a live Super Speed hero and for any pass-combo
        // member at x5 or above. The tier gate is what keeps a member's trail
        // alive through the decay after the chain breaks; gating on the bonus
        // being non-zero would light it on x2, and gating on the count would
        // kill it the instant the chain broke.
        for (let i = 0; i < RENDER_PLAYER_COUNT; i += 1) {
          const p = playerAt(s, i);
          const trailing =
            p !== undefined &&
            !suppressCosmeticEffects &&
            (trailGhostsFor(s, i, nextRef.current!.statuses[i]) > 0);
          trailRef.current[i] = trailing
            ? [{ ...p.pos }, ...trailRef.current[i]].slice(0, 7)
            : [];
        }
```

Add the helper beside the other module-level render helpers in `MatchScreen.tsx`, importing `PlayerStatus` from `./interpolate`:

```ts
/**
 * How many ghosts an entity draws this frame: 6 for a live Super Speed hero,
 * 3 for a pass-combo member at x5 or above, 0 for nobody. An entity that is
 * both takes 6 — the power outranks the combo, and it gets ONE trail.
 */
const COMBO_TRAIL_MIN_TIER_D = 1500;
function trailGhostsFor(
  state: MatchState,
  idx: number,
  status: PlayerStatus,
): number {
  const p = playerAt(state, idx);
  if (p === undefined) return 0;
  if (status === 'active' && p.def.power === 'SUPER_SPEED') return 6;
  if (p.comboTierD >= COMBO_TRAIL_MIN_TIER_D && p.comboTicks > 0) return 3;
  return 0;
}
```

- [ ] **Step 7: Rewrite the atlas consumer (~3344)**

Replace the single `activeSpeedster` lookup and its `superSpeedAfterimageActors` call with a loop over every trailing entity:

```ts
    ...trailRef.current.flatMap((points, idx) => {
      const ghosts = trailGhostsFor(match, idx, hud.statuses[idx]);
      return ghosts === 0 || points.length < 2
        ? []
        : superSpeedAfterimageActors(idx, points.map(screenPoint), ghosts);
    }),
```

Delete the now-unused `activeSpeedster` `findIndex`.

- [ ] **Step 8: Rewrite the Circle consumer (~3966)**

This is the second consumer of the same ref and the one most easily missed — leaving it reading a flat array draws circles at `undefined` coordinates. The current block is:

```tsx
                  {trailRef.current.map((t, i) => (
                    <Circle
                      key={i}
                      cx={t.x * scale}
                      cy={t.y * scale}
                      r={Math.max(1.5, 7 - i)}
                      color="#ffffff"
                      opacity={0.55 * (1 - i / trailRef.current.length)}
                    />
                  ))}
```

Replace it with:

```tsx
                  {trailRef.current.flatMap((points, entity) => {
                    const ghosts = trailGhostsFor(
                      match,
                      entity,
                      hud.statuses[entity],
                    );
                    if (ghosts === 0) return [];
                    return points.slice(1, 1 + ghosts).map((t, i) => (
                      <Circle
                        key={`${entity}:${i}`}
                        cx={t.x * scale}
                        cy={t.y * scale}
                        r={Math.max(1.5, 7 - i)}
                        color="#ffffff"
                        opacity={0.55 * (1 - i / ghosts)}
                      />
                    ));
                  })}
```

Two things changed beyond the shape. The key is now `entity:i`, because a flat
`i` would collide across entities. And the slice matches
`superSpeedAfterimageActors` — index 0 is the live body position, so it must be
skipped here exactly as it is there, or the circles sit one frame ahead of the
sprites.

- [ ] **Step 9: Verify the restart clear still works (~2715)**

`trailRef.current = [];` no longer matches the new type. Change it to:

```ts
        trailRef.current = Array.from(
          { length: RENDER_PLAYER_COUNT },
          () => [],
        );
```

- [ ] **Step 10: Type check and run the render suite**

Run: `npx tsc --noEmit && npx jest src/render`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/render/live-power-effect-actors.ts src/render/MatchScreen.tsx src/render/__tests__/live-power-effect-actors.test.ts
git commit -m "feat(render): afterimage trails for pass-combo members at x5"
```

---

### Task 8: Full verification

**Files:** none modified unless a check fails.

- [ ] **Step 1: Type check the whole project**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run: `npx jest`
Expected: PASS. This is the one place the full suite is warranted — the change touches the sim, the render ring and the asset table.

- [ ] **Step 3: Confirm the version and baselines agree**

Run: `grep -n "ENGINE_VERSION = " src/sim/match.ts && grep -n "EXPECTED_.*_GOLDEN = " src/sim/runtime-golden.ts`
Expected: `'m2.5'` and two fingerprints that are **not** `53c44ee0` / `78109294`.

- [ ] **Step 4: Confirm no English copy leaked in**

Run: `npx jest src/i18n/__tests__/no-hardcoded-prose.test.ts`
Expected: PASS with `MAX_REMAINING` unchanged. This feature ships no player-facing prose; if this test wants the number raised, a string was added that needs all seven locales.

- [ ] **Step 5: Commit any fixes and push**

```bash
git push -u origin claude/pass-combo-speed-bonus-2e11d4
```
