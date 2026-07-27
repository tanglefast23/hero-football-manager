# Rival Match Preload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision 2** — incorporates two independent plan reviews. Changes from revision 1 are listed under "What the reviews changed" below.

**Goal:** Remove the synchronous rival-match simulation from league settle, so that a player who has spent any time on the matchday week reaches full time without the UI freezing.

**Honest numbers.** Today every league settle simulates the division's other four fixtures on the JS thread: measured **142.7ms** per match and **571.6ms** for four in Node/V8 (2026-07-27), roughly **1.7–2.3s** on device. After this change:

| Path | Preload complete | Preload cold (instant tap) |
|---|---|---|
| Watched full time | ~0 | unchanged (~2s) |
| Quick Result | ~0.5s (own match only) | unchanged (~2.5s) |

The cold column is why the trigger fires as early as possible and keeps running during the watched match. Eliminating the cold column entirely requires an asynchronous settle, which is deliberately **not** in this plan — see Non-goals.

**Architecture:** Split the existing all-at-once tick loop into a resumable resolver that advances N ticks and stops, sharing one validated match constructor with the synchronous path. A pure pump works through the division's other fixtures; a thin `requestIdleCallback` hook drives it in idle slices from the moment the career enters matchday phase until the week settles. Finished results land in an in-memory cache fingerprinted on the exact `TeamDef`s used. At settle the store passes cache hits to `resolveMatchday` through its **existing** `suppliedResults` parameter. A miss simulates synchronously exactly as today.

**Tech Stack:** TypeScript, Jest (node environment), Zustand, React Native 0.86 (Expo). No new dependencies.

---

## What the reviews changed

1. **A test that could not have run.** `jest.config.js` is `testEnvironment: 'node'` with a transform matching only `.tsx?` and no React Native preset — every existing UI test reads source as *text* for exactly this reason. Revision 1 put the pump in a module importing `react-native` and then imported it from a test. The pump is now RN-free in `src/application/`, with the hook alone in `src/ui/`.
2. **A false validation claim.** `teamsForFixture` validates the teams map and each `TeamDef`, but **not** the fixture — `quickMatchForFixture` calls `validateScheduledFixture` separately. Revision 1's resolver skipped it. Both paths now share one constructor, which also keeps `fixtureResultFrom` and `teamsForFixture` private.
3. **The preload restarted on every lineup edit.** `swapStartingPlayer` replaces the career object (`store.ts:1010-1016`), so a memo keyed on `store.career` tore the effect down mid-fixture. The session is now keyed on matchday identity, and the pump skips fixtures already cached.
4. **`InteractionManager` is a deprecated stub in RN 0.86** (`InteractionManagerStub`, `@deprecated` throughout). Replaced with `requestIdleCallback`, which RN installs as a global (`Libraries/Core/setUpTimers.js:84`), with a `setTimeout` fallback.
5. **The wrong boundary test was cited.** The game ring is guarded by `src/game/__tests__/architecture.test.ts`, not the sim ring's `import-layers.test.ts`.
6. **Earlier trigger (not from either review).** Rival squads are settled once the week has advanced, so the preload starts at `career.phase === 'matchday'` rather than when the matchday *screen* opens — it runs while the player is still on the home screen — and keeps running through the watched match, which is the largest idle window available.
7. `git rm` of a benchmark file that was never `git add`ed would fail; the benchmark is now untracked-and-deleted with no commit step.

## Background: why this is safe

1. **Seeds are pinned early.** `matchSeed` is assigned when the season schedule is generated (`src/game/schedule.ts:55`). Computing a fixture earlier is byte-identical.
2. **Teams are built from live state** (`buildCareerMatchTeams`, `src/game/squad.ts:90`), so composition moves until kickoff. Hence fingerprinting rather than trusting.
3. **Rival fixtures never involve the user's club,** so nothing the player does from the home or matchday screens — lineup, formation, hero licence — can change them. A transfer can, and the fingerprint catches it.

A result is a pure function of `(matchSeed, homeTeamDef, awayTeamDef)`; `simMatch.tick` mutates only the state passed to it, so chunking cannot change an outcome.

## Non-goals

- **Asynchronous settle.** Would be required to fix an instant cold Quick Result, but settle mutates career state, queues a save, resolves awakenings and builds the post-match ledger. Its synchronous shape structurally prevents interleaving bugs; an async window plus a cancellable "calculating" state is a separate plan with its own UX decisions.
- **Caching the player's own match.** `quickResult` needs `quickMatch.match` — the full final `MatchState` — because awakening resolution reads actual participants including auto-substitutes (see the doc comment on `QuickFixtureMatch`; discarding it previously broke bench-player awakenings). Caching a whole `MatchState` is a materially different design, and the user's `TeamDef` is invalidated by the very lineup edits that screen exists for.
- **Replacing rival simulation with the squad-strength model** used for other divisions (`src/game/m2-career.ts:234-260`). That changes league balance.
- **Persisting the cache.** A reload recomputes.
- **`ENGINE_VERSION` must not change.** If a golden replay or balance assertion moves, the implementation is wrong. Do not update the snapshot.

## File Structure

| File | Responsibility |
|---|---|
| `src/game/matchday.ts` *(modify)* | Gains a shared private `createFixtureMatch` used by both paths, and exports `createFixtureResolver`. Keeping the resolver here is what lets `fixtureResultFrom` and `teamsForFixture` stay private. |
| `src/application/rival-result-cache.ts` *(new)* | Fingerprinted store of finished rival results. Owns `storeRivalResult`, `cachedRivalResults`, `hasRivalResult`, `clearRivalResultCache`. |
| `src/application/rival-preload.ts` *(new)* | Pure pump. **No React, no react-native** — this is what makes it testable under the node Jest environment. |
| `src/ui/use-rival-preload.ts` *(new)* | The only file that touches React or scheduling. Matches the existing hook convention (`src/ui/use-reduced-motion.ts`, `use-key-bindings.ts`, `use-tap-guard.ts`). |
| `src/application/store.ts` *(modify)* | Claims cache hits at settle; clears the cache once the week is settled. |
| `App.tsx` *(modify)* | Mounts the hook for the whole matchday phase. |

---

### Task 1: Shared match constructor and the resumable resolver

**Files:**
- Modify: `src/game/matchday.ts`
- Test: `src/game/__tests__/fixture-resolver.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/__tests__/fixture-resolver.test.ts`:

```ts
import { ROVERS, UNITED } from '../../sim/teams';
import type { TeamDef } from '../../sim/types';
import { createFixtureResolver, quickResultForFixture } from '../matchday';
import type { LeagueFixture } from '../types';

const TEAMS: Readonly<Record<string, TeamDef>> = {
  [ROVERS.id]: ROVERS,
  [UNITED.id]: UNITED,
};

function fixture(id: string, matchSeed: number): LeagueFixture {
  return {
    id,
    season: 1,
    round: 1,
    week: 5,
    homeClubId: ROVERS.id,
    awayClubId: UNITED.id,
    matchSeed,
    status: 'scheduled',
  };
}

function drain(scheduled: LeagueFixture, ticksPerSlice: number) {
  const resolver = createFixtureResolver(scheduled, TEAMS);
  let guard = 0;
  while (!resolver.done) {
    resolver.advance(ticksPerSlice);
    guard += 1;
    if (guard > 100_000) throw new Error('resolver did not finish');
  }
  return resolver.result();
}

describe('createFixtureResolver', () => {
  it('produces the identical result to the all-at-once path', () => {
    const scheduled = fixture('resolver-1', 4242);

    expect(drain(scheduled, 64)).toEqual(quickResultForFixture(scheduled, TEAMS));
  });

  it('is unaffected by slice size — chunking cannot change a result', () => {
    const scheduled = fixture('resolver-2', 99);

    expect(drain(scheduled, 1)).toEqual(drain(scheduled, 100_000));
    expect(drain(scheduled, 1)).toEqual(quickResultForFixture(scheduled, TEAMS));
  });

  it('refuses to hand over a result before the match has finished', () => {
    const resolver = createFixtureResolver(fixture('resolver-3', 7), TEAMS);
    resolver.advance(10);

    expect(resolver.done).toBe(false);
    expect(() => resolver.result()).toThrow('has not finished');
  });

  it('validates the fixture exactly as the synchronous path does', () => {
    const unscheduled = { ...fixture('resolver-4', 7), status: 'played' as const };

    expect(() => createFixtureResolver(unscheduled, TEAMS))
      .toThrow(/scheduled/i);
  });

  it('stops advancing once finished so extra pumps are harmless', () => {
    const resolver = createFixtureResolver(fixture('resolver-5', 11), TEAMS);
    while (!resolver.done) resolver.advance(256);
    const settled = resolver.result();

    resolver.advance(1_000);

    expect(resolver.result()).toEqual(settled);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/game/__tests__/fixture-resolver.test.ts`
Expected: FAIL — `createFixtureResolver is not a function`.

- [ ] **Step 3: Extract the shared constructor**

In `src/game/matchday.ts`, add above `quickMatchForFixture`:

```ts
/**
 * The one place a fixture becomes a match. Both the all-at-once path and the
 * resumable one go through here so validation and the auto-fire policies cannot
 * drift apart — an earlier draft of the resolver rebuilt this inline and
 * silently skipped `validateScheduledFixture`, which `teamsForFixture` does not
 * perform.
 */
function createFixtureMatch(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
): MatchState {
  validateScheduledFixture(fixture);
  const [home, away] = teamsForFixture(fixture, teamsByClubId);
  return simMatch.createMatch(fixture.matchSeed, home, away, {
    homePolicy: 'FIRE_WHEN_READY',
    awayPolicy: 'FIRE_WHEN_READY',
  });
}
```

Then replace the body of `quickMatchForFixture` down to the tick loop with:

```ts
export function quickMatchForFixture(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
): QuickFixtureMatch {
  const match = createFixtureMatch(fixture, teamsByClubId);
  while (match.phase !== 'fulltime') simMatch.tick(match);
  return {
    result: fixtureResultFrom(fixture, match),
    replay: simMatch.envelopeFrom(match),
    match,
  };
}
```

- [ ] **Step 4: Add the resolver to the same file**

Append to `src/game/matchday.ts`:

```ts
/**
 * A fixture whose simulation can be advanced a bounded number of ticks and then
 * put down.
 *
 * `quickMatchForFixture` runs ~2,000 ticks in one burst — ~500ms on device,
 * long enough to freeze the frame it lands on. This lets a caller spread the
 * identical work across idle slices. Chunking cannot change the outcome: the
 * seed is fixed at schedule time and `tick` mutates only the state it is given.
 * `fixture-resolver.test.ts` pins that against slice sizes 1 and 100,000.
 *
 * Pure by the rules of this ring — no timers, no clock. The caller decides when
 * to advance and by how much.
 */
export interface FixtureResolver {
  readonly fixtureId: string;
  readonly done: boolean;
  advance(maxTicks: number): void;
  result(): FixtureResult;
}

export function createFixtureResolver(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
): FixtureResolver {
  const match = createFixtureMatch(fixture, teamsByClubId);

  return {
    fixtureId: fixture.id,
    get done(): boolean {
      return match.phase === 'fulltime';
    },
    advance(maxTicks: number): void {
      for (let step = 0; step < maxTicks && match.phase !== 'fulltime'; step += 1) {
        simMatch.tick(match);
      }
    },
    result(): FixtureResult {
      if (match.phase !== 'fulltime') {
        throw new Error(`fixture ${fixture.id} has not finished`);
      }
      return fixtureResultFrom(fixture, match);
    },
  };
}
```

- [ ] **Step 5: Verify**

Run: `npx jest src/game/__tests__/fixture-resolver.test.ts src/game/__tests__/matchday.test.ts src/game/__tests__/architecture.test.ts`
Expected: PASS. `architecture.test.ts` is the game-ring boundary guard — it fails if the new code reaches outside `src/game` or `src/sim`, or introduces a clock or RNG call.

- [ ] **Step 6: Commit**

```bash
git add src/game/matchday.ts src/game/__tests__/fixture-resolver.test.ts
git commit -m "feat(matchday): one validated constructor, and a resolver that can pause"
```

---

### Task 2: The fingerprinted result cache

**Files:**
- Create: `src/application/rival-result-cache.ts`
- Test: `src/application/__tests__/rival-result-cache.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/application/__tests__/rival-result-cache.test.ts`:

```ts
import { ROVERS, UNITED } from '../../sim/teams';
import type { TeamDef } from '../../sim/types';
import type { FixtureResult, LeagueFixture } from '../../game/types';
import {
  cachedRivalResults,
  clearRivalResultCache,
  hasRivalResult,
  storeRivalResult,
} from '../rival-result-cache';

const TEAMS: Readonly<Record<string, TeamDef>> = {
  [ROVERS.id]: ROVERS,
  [UNITED.id]: UNITED,
};

function fixture(id: string): LeagueFixture {
  return {
    id,
    season: 1,
    round: 1,
    week: 5,
    homeClubId: ROVERS.id,
    awayClubId: UNITED.id,
    matchSeed: 7,
    status: 'scheduled',
  };
}

const RESULT: FixtureResult = { fixtureId: 'rival-1', homeGoals: 2, awayGoals: 1 };

describe('rival result cache', () => {
  beforeEach(() => {
    clearRivalResultCache();
  });

  it('returns a stored result when the squads are unchanged', () => {
    const scheduled = fixture('rival-1');
    storeRivalResult(scheduled, TEAMS, RESULT);

    expect(hasRivalResult(scheduled, TEAMS)).toBe(true);
    expect(cachedRivalResults([scheduled], TEAMS)).toEqual([RESULT]);
  });

  it('misses when a squad changed after the result was stored', () => {
    const scheduled = fixture('rival-1');
    storeRivalResult(scheduled, TEAMS, RESULT);
    const afterTransfer: Readonly<Record<string, TeamDef>> = {
      ...TEAMS,
      [ROVERS.id]: { ...ROVERS, players: ROVERS.players.slice(0, 10) },
    };

    expect(hasRivalResult(scheduled, afterTransfer)).toBe(false);
    expect(cachedRivalResults([scheduled], afterTransfer)).toEqual([]);
  });

  it('returns only the fixtures it actually holds', () => {
    const stored = fixture('rival-1');
    storeRivalResult(stored, TEAMS, RESULT);

    expect(cachedRivalResults([stored, fixture('rival-2')], TEAMS)).toEqual([RESULT]);
  });

  it('clears completely so a settled week never leaks into the next', () => {
    const scheduled = fixture('rival-1');
    storeRivalResult(scheduled, TEAMS, RESULT);
    clearRivalResultCache();

    expect(cachedRivalResults([scheduled], TEAMS)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/application/__tests__/rival-result-cache.test.ts`
Expected: FAIL — `Cannot find module '../rival-result-cache'`.

- [ ] **Step 3: Write the implementation**

Create `src/application/rival-result-cache.ts`:

```ts
import type { TeamDef } from '../sim/types';
import type { FixtureResult, LeagueFixture } from '../game/types';

/**
 * Finished rival results waiting to be claimed at settle time.
 *
 * Deliberately advisory. A miss costs exactly what the game cost before this
 * existed — a synchronous simulation — so no league table can be wrong because
 * the cache was cold, stale or empty. That property is what lets the preload
 * run opportunistically without a correctness argument attached to its timing.
 */
interface CachedResult {
  readonly fingerprint: string;
  readonly result: FixtureResult;
}

const cache = new Map<string, CachedResult>();

/**
 * Identifies the exact inputs a result was computed from.
 *
 * A match is a pure function of (seed, home TeamDef, away TeamDef), so
 * comparing the full serialized definitions is exact rather than a guess about
 * which state fields matter — training, a transfer, an injury and a formation
 * change all move it. Deliberately not hashed: a collision here would publish a
 * wrong scoreline, and ~10KB per fixture is nothing against the ~500ms it
 * protects. `clearRivalResultCache` at settle is what keeps that bounded; a
 * 38-week season would otherwise accumulate a few hundred KB of dead entries.
 */
function fingerprint(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
): string | null {
  const home = teamsByClubId[fixture.homeClubId];
  const away = teamsByClubId[fixture.awayClubId];
  if (home === undefined || away === undefined) return null;
  return `${fixture.matchSeed}|${JSON.stringify(home)}|${JSON.stringify(away)}`;
}

export function storeRivalResult(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
  result: FixtureResult,
): void {
  const key = fingerprint(fixture, teamsByClubId);
  if (key === null) return;
  cache.set(fixture.id, { fingerprint: key, result });
}

/** True when this fixture is already resolved against these exact squads. */
export function hasRivalResult(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
): boolean {
  const entry = cache.get(fixture.id);
  if (entry === undefined) return false;
  return entry.fingerprint === fingerprint(fixture, teamsByClubId);
}

/**
 * The subset of `fixtures` whose results are cached and still match the squads
 * they were computed from. Safe to hand straight to `resolveMatchday`.
 */
export function cachedRivalResults(
  fixtures: readonly LeagueFixture[],
  teamsByClubId: Readonly<Record<string, TeamDef>>,
): FixtureResult[] {
  const claimed: FixtureResult[] = [];
  for (const fixture of fixtures) {
    if (!hasRivalResult(fixture, teamsByClubId)) continue;
    claimed.push(cache.get(fixture.id)!.result);
  }
  return claimed;
}

export function clearRivalResultCache(): void {
  cache.clear();
}
```

- [ ] **Step 4: Verify and commit**

Run: `npx jest src/application/__tests__/rival-result-cache.test.ts`
Expected: PASS, 4 tests.

```bash
git add src/application/rival-result-cache.ts src/application/__tests__/rival-result-cache.test.ts
git commit -m "feat(matchday): an advisory, fingerprinted cache for rival results"
```

---

### Task 3: The pure pump

**Files:**
- Create: `src/application/rival-preload.ts`
- Test: `src/application/__tests__/rival-preload.test.ts`

This module must not import React or react-native. Jest runs in a node environment with a transform matching only `.tsx?`, so a react-native import anywhere in this module's graph makes the test unrunnable.

- [ ] **Step 1: Write the failing test**

Create `src/application/__tests__/rival-preload.test.ts`:

```ts
import { ROVERS, UNITED } from '../../sim/teams';
import type { TeamDef } from '../../sim/types';
import { quickResultForFixture } from '../../game/matchday';
import type { LeagueFixture } from '../../game/types';
import { cachedRivalResults, clearRivalResultCache } from '../rival-result-cache';
import { createPreloadPump } from '../rival-preload';

const TEAMS: Readonly<Record<string, TeamDef>> = {
  [ROVERS.id]: ROVERS,
  [UNITED.id]: UNITED,
};

function fixture(id: string, matchSeed: number): LeagueFixture {
  return {
    id,
    season: 1,
    round: 1,
    week: 5,
    homeClubId: ROVERS.id,
    awayClubId: UNITED.id,
    matchSeed,
    status: 'scheduled',
  };
}

function drain(pump: { done: boolean; step: (ticks: number) => void }): void {
  let guard = 0;
  while (!pump.done) {
    pump.step(64);
    guard += 1;
    if (guard > 200_000) throw new Error('pump did not finish');
  }
}

describe('rival preload pump', () => {
  beforeEach(() => {
    clearRivalResultCache();
  });

  it('fills the cache with results identical to the synchronous path', () => {
    const rivals = [fixture('rival-a', 101), fixture('rival-b', 202)];

    drain(createPreloadPump(rivals, TEAMS));

    expect(cachedRivalResults(rivals, TEAMS)).toEqual(
      rivals.map(scheduled => quickResultForFixture(scheduled, TEAMS)),
    );
  });

  it('publishes each fixture as it finishes rather than all at the end', () => {
    const rivals = [fixture('rival-a', 303), fixture('rival-b', 404)];
    const pump = createPreloadPump(rivals, TEAMS);

    let guard = 0;
    while (cachedRivalResults(rivals, TEAMS).length === 0) {
      pump.step(64);
      guard += 1;
      if (guard > 200_000) throw new Error('pump published nothing');
    }

    expect(cachedRivalResults(rivals, TEAMS)).toHaveLength(1);
    expect(pump.done).toBe(false);
  });

  it('resumes rather than restarting when a previous pump already finished work', () => {
    const rivals = [fixture('rival-a', 505), fixture('rival-b', 606)];
    drain(createPreloadPump(rivals, TEAMS));

    // A lineup edit tears the session down; the replacement must not redo
    // matches that are already cached against these same squads.
    const replacement = createPreloadPump(rivals, TEAMS);
    replacement.step(1);

    expect(replacement.done).toBe(true);
  });

  it('is a no-op with nothing to preload', () => {
    const pump = createPreloadPump([], TEAMS);

    expect(pump.done).toBe(true);
    expect(() => pump.step(64)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/application/__tests__/rival-preload.test.ts`
Expected: FAIL — `Cannot find module '../rival-preload'`.

- [ ] **Step 3: Write the implementation**

Create `src/application/rival-preload.ts`:

```ts
import { createFixtureResolver, type FixtureResolver } from '../game/matchday';
import type { TeamDef } from '../sim/types';
import type { LeagueFixture } from '../game/types';
import { hasRivalResult, storeRivalResult } from './rival-result-cache';

export interface PreloadPump {
  readonly done: boolean;
  /** Advances the current fixture by at most `maxTicks`, publishing on finish. */
  step(maxTicks: number): void;
}

/**
 * Works through the division's other fixtures one at a time, publishing each to
 * the cache the moment it finishes.
 *
 * Sequential rather than interleaved so that a pump interrupted half way leaves
 * whole, usable results behind. Already-cached fixtures are skipped, which is
 * what makes a torn-down session resume instead of starting over — the session
 * is rebuilt whenever the career object changes, and on the matchday screen
 * that is every lineup edit.
 *
 * No React and no react-native here on purpose: Jest runs in a node
 * environment that cannot transform React Native's entry point, so this stays
 * importable from a test and the scheduling lives in `src/ui/use-rival-preload`.
 */
export function createPreloadPump(
  fixtures: readonly LeagueFixture[],
  teamsByClubId: Readonly<Record<string, TeamDef>>,
  makeResolver: (
    fixture: LeagueFixture,
    teams: Readonly<Record<string, TeamDef>>,
  ) => FixtureResolver = createFixtureResolver,
): PreloadPump {
  let index = 0;
  let current: FixtureResolver | null = null;

  const skipSettled = (): void => {
    while (
      current === null
      && index < fixtures.length
      && hasRivalResult(fixtures[index], teamsByClubId)
    ) {
      index += 1;
    }
  };

  skipSettled();

  return {
    get done(): boolean {
      return index >= fixtures.length;
    },
    step(maxTicks: number): void {
      skipSettled();
      if (index >= fixtures.length) return;
      if (current === null) current = makeResolver(fixtures[index], teamsByClubId);

      current.advance(maxTicks);
      if (!current.done) return;

      storeRivalResult(fixtures[index], teamsByClubId, current.result());
      current = null;
      index += 1;
      skipSettled();
    },
  };
}
```

- [ ] **Step 4: Verify and commit**

Run: `npx jest src/application/__tests__/rival-preload.test.ts`
Expected: PASS, 4 tests.

```bash
git add src/application/rival-preload.ts src/application/__tests__/rival-preload.test.ts
git commit -m "feat(matchday): a resumable pump that skips work already done"
```

---

### Task 4: The idle-time hook

**Files:**
- Create: `src/ui/use-rival-preload.ts`

No test: this file is React Native and cannot be imported under the node Jest environment. All logic worth asserting lives in the pump, which is tested. Keep this file thin enough that reading it is sufficient review.

- [ ] **Step 1: Write the hook**

Create `src/ui/use-rival-preload.ts`:

```ts
import { useEffect } from 'react';
import { createPreloadPump } from '../application/rival-preload';
import type { TeamDef } from '../sim/types';
import type { LeagueFixture } from '../game/types';

/** Ticks per inner burst — small enough to re-check the deadline often. */
const TICKS_PER_BURST = 32;
/**
 * Keep working while at least this much of the idle slice remains. A static
 * screen can use most of it; while a match is animating the floor is high so
 * the preload only takes genuinely spare time. There is far more of it there
 * (~200s of match against ~2s of work), so being timid costs nothing.
 */
const STATIC_FLOOR_MS = 2;
const WATCHING_FLOOR_MS = 6;
/** Upper bound on waiting for an idle moment that may never come. */
const IDLE_TIMEOUT_MS = 500;
/** Slice length assumed when falling back to setTimeout. */
const FALLBACK_BUDGET_MS = 6;

interface IdleDeadline {
  timeRemaining: () => number;
}

type CancelHandle = { cancel: () => void };

/**
 * `InteractionManager` is a deprecated stub in React Native 0.86, so this uses
 * `requestIdleCallback`, which RN installs as a global. The fallback keeps web
 * and any runtime without it working on a plain timer.
 */
function scheduleIdle(run: (deadline: IdleDeadline) => void): CancelHandle {
  const idle = (globalThis as {
    requestIdleCallback?: (
      callback: (deadline: IdleDeadline) => void,
      options?: { timeout: number },
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  });

  if (typeof idle.requestIdleCallback === 'function') {
    const handle = idle.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    return {
      cancel: () => idle.cancelIdleCallback?.(handle),
    };
  }

  const timer = setTimeout(
    () => run({ timeRemaining: () => FALLBACK_BUDGET_MS }),
    IDLE_TIMEOUT_MS,
  );
  return { cancel: () => clearTimeout(timer) };
}

/**
 * Resolves the division's other fixtures in idle time so that settling the week
 * does not have to.
 *
 * Runs for the whole matchday phase rather than just the matchday screen: rival
 * squads are settled the moment the week advances, so the player's time on the
 * home screen is usable, and the watched match is the largest idle window there
 * is. Restricting this to the team sheet left an eager player paying the full
 * freeze anyway.
 *
 * Everything it produces is advisory — if it never runs, is cancelled, or is
 * invalidated by a transfer, settle simulates synchronously as it always did.
 */
export function useRivalPreload(
  sessionKey: string | null,
  fixtures: readonly LeagueFixture[],
  teamsByClubId: Readonly<Record<string, TeamDef>> | null,
  watching: boolean,
): void {
  useEffect(() => {
    if (sessionKey === null || teamsByClubId === null || fixtures.length === 0) {
      return undefined;
    }

    const pump = createPreloadPump(fixtures, teamsByClubId);
    let cancelled = false;
    let scheduled: CancelHandle | null = null;

    const runSlice = (deadline: IdleDeadline): void => {
      if (cancelled) return;
      const floor = watching ? WATCHING_FLOOR_MS : STATIC_FLOOR_MS;
      while (!pump.done && deadline.timeRemaining() > floor) {
        try {
          pump.step(TICKS_PER_BURST);
        } catch {
          // A refused fixture must not escape from a scheduler callback and
          // take the app down. Settle recomputes it synchronously.
          cancelled = true;
          return;
        }
      }
      if (cancelled || pump.done) return;
      scheduled = scheduleIdle(runSlice);
    };

    scheduled = scheduleIdle(runSlice);

    return () => {
      cancelled = true;
      scheduled?.cancel();
    };
    // `fixtures` and `teamsByClubId` are rebuilt with `sessionKey`, which is
    // what decides when a session restarts; listing them would restart it on
    // every lineup edit, which is what revision 1 got wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, watching]);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/use-rival-preload.ts
git commit -m "feat(matchday): drive the preload from idle time"
```

---

### Task 5: Claim cache hits at settle

**Files:**
- Modify: `src/application/store.ts`

`resolveMatchday(fixtures, teams, suppliedResults)` already simulates only what was not supplied and validates supplied results against the fixture list, so a hit needs no change to it.

- [ ] **Step 1: Import the cache**

```ts
import { cachedRivalResults, clearRivalResultCache } from './rival-result-cache';
```

- [ ] **Step 2: Claim hits in `quickResult`**

Replace:

```ts
      const results = kind === 'league'
        ? resolveMatchday(fixtures, teams, [quickMatch.result])
        : [quickMatch.result];
```

with:

```ts
      // Whatever the preload finished is handed over as a supplied result, so
      // `resolveMatchday` simulates only what is genuinely missing. A cold or
      // stale cache contributes nothing and it simulates all four, as before.
      const results = kind === 'league'
        ? resolveMatchday(fixtures, teams, [
            quickMatch.result,
            ...cachedRivalResults(
              fixtures.filter(candidate => candidate.id !== fixture.id),
              teams,
            ),
          ])
        : [quickMatch.result];
```

- [ ] **Step 3: Claim hits in `finishWatchedMatch`**

Replace:

```ts
      const results = kind === 'league'
        ? resolveMatchday(fixtures, teams, [supplied])
        : [supplied];
```

with:

```ts
      const results = kind === 'league'
        ? resolveMatchday(fixtures, teams, [
            supplied,
            ...cachedRivalResults(
              fixtures.filter(candidate => candidate.id !== fixture.id),
              teams,
            ),
          ])
        : [supplied];
```

The `filter` matters: supplying the user's fixture twice trips `resolveMatchday`'s duplicate guard.

- [ ] **Step 4: Clear the cache once the week is settled**

After each `const after = completeMatchday(before, results);` in **both** actions, add:

```ts
      // The week is settled; nothing may claim these again, and the fingerprints
      // are large enough that a season of them would be worth real memory.
      clearRivalResultCache();
```

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit && npx jest src/application/__tests__/store.test.ts`
Expected: tsc exit 0; store tests PASS unchanged — they exercise the cold path, which must behave exactly as before.

```bash
git add src/application/store.ts
git commit -m "feat(matchday): claim preloaded rival results at settle time"
```

---

### Task 6: Mount it for the whole matchday phase

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add the imports**

`activeCareerMatchday` and `buildCareerMatchTeams` both reach `./src/game` through the wildcard re-exports in `src/game/index.ts` (`export * from './career'` line 5, `export * from './squad'` line 32), so add them to the existing `./src/game` import list. Then:

```ts
import { useRivalPreload } from './src/ui/use-rival-preload';
```

- [ ] **Step 2: Derive the session and mount the hook**

In `GameApp`, beside the `squadTrainingVm` memo:

```ts
  // Rival squads are settled the moment the week advances, so the preload can
  // start while the player is still on the home screen rather than waiting for
  // the team sheet. Keyed by the matchday itself: lineup edits replace the
  // career object on every swap, and keying on that restarted the work.
  const matchdayPreloadKey = store.career !== null
    && store.career.phase === 'matchday'
    ? `${store.career.season}:${store.career.week}`
    : null;

  const matchdayPreload = useMemo(() => {
    if (matchdayPreloadKey === null) return null;
    const career = useM1Store.getState().career;
    if (career === null) return null;
    const matchday = activeCareerMatchday(career);
    if (matchday === undefined || matchday.kind !== 'league') return null;
    const rivals = matchday.fixtures.filter(candidate => candidate.id !== matchday.fixture.id);
    if (rivals.length === 0) return null;
    return {
      rivals,
      teams: buildCareerMatchTeams(
        career,
        [...new Set(rivals.flatMap(candidate => [candidate.homeClubId, candidate.awayClubId]))],
      ),
    };
  }, [matchdayPreloadKey]);

  useRivalPreload(
    matchdayPreloadKey,
    matchdayPreload?.rivals ?? [],
    matchdayPreload?.teams ?? null,
    store.screen === 'watched',
  );
```

The memo reads the career imperatively because it must recompute on the session key alone, not on career identity. Only the rival clubs are built — the user's own `TeamDef` is not an input to any of these fixtures.

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add App.tsx
git commit -m "feat(matchday): preload rivals from the moment the week turns"
```

---

### Task 7: Integration proof

**Files:**
- Test: `src/application/__tests__/rival-preload-integration.test.ts`

- [ ] **Step 1: Write the test**

Mirror the matchday setup used at `src/application/__tests__/store.test.ts:1087-1097` (`startCreatedCareer`, then `useM1Store.setState` with `phase: 'matchday'`). Create `src/application/__tests__/rival-preload-integration.test.ts`:

```ts
import { useM1Store } from '../store';
import { buildCareerMatchTeams } from '../../game';
import { createPreloadPump } from '../rival-preload';
import { clearRivalResultCache } from '../rival-result-cache';
import type { GameState } from '../../game/types';

jest.mock('expo-sqlite', () => ({}), { virtual: true });

const DEFAULT_CREATION_RATINGS = { pace: 3, shooting: 3, passing: 3, defending: 3 } as const;

function startCareerAtMatchday(seed: number): GameState {
  useM1Store.getState().startNewCareer(seed);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS as never,
  });
  const career = useM1Store.getState().career!;
  const fixture = career.fixtures.find(candidate => (
    candidate.season === 1
    && (candidate.homeClubId === career.userClubId || candidate.awayClubId === career.userClubId)
  ))!;
  useM1Store.setState({
    career: { ...career, week: fixture.week, phase: 'matchday' },
    screen: 'matchday',
  });
  return useM1Store.getState().career!;
}

describe('preloaded rivals reach settle unchanged', () => {
  beforeEach(() => {
    clearRivalResultCache();
  });

  it('settles a matchday identically warm and cold', () => {
    // Cold: nothing cached, every rival simulated at settle.
    startCareerAtMatchday(20260727);
    useM1Store.getState().quickResult();
    const cold = useM1Store.getState().career!;

    // Warm: the same matchday with every rival preloaded first.
    clearRivalResultCache();
    const career = startCareerAtMatchday(20260727);
    const matchday = career.fixtures.filter(candidate => (
      candidate.season === 1 && candidate.week === career.week && candidate.status === 'scheduled'
    ));
    const rivals = matchday.filter(candidate => (
      candidate.homeClubId !== career.userClubId && candidate.awayClubId !== career.userClubId
    ));
    const teams = buildCareerMatchTeams(
      career,
      [...new Set(rivals.flatMap(candidate => [candidate.homeClubId, candidate.awayClubId]))],
    );
    const pump = createPreloadPump(rivals, teams);
    let guard = 0;
    while (!pump.done) {
      pump.step(256);
      guard += 1;
      if (guard > 200_000) throw new Error('pump did not finish');
    }
    useM1Store.getState().quickResult();
    const warm = useM1Store.getState().career!;

    expect(warm.fixtures).toEqual(cold.fixtures);
    expect(warm.money).toEqual(cold.money);
  });

  it('drops the cache once the week is settled', () => {
    const career = startCareerAtMatchday(20260728);
    const rivals = career.fixtures.filter(candidate => (
      candidate.season === 1
      && candidate.week === career.week
      && candidate.status === 'scheduled'
      && candidate.homeClubId !== career.userClubId
      && candidate.awayClubId !== career.userClubId
    ));
    const teams = buildCareerMatchTeams(
      career,
      [...new Set(rivals.flatMap(candidate => [candidate.homeClubId, candidate.awayClubId]))],
    );
    const pump = createPreloadPump(rivals, teams);
    while (!pump.done) pump.step(256);

    useM1Store.getState().quickResult();

    // A late scheduler callback after settle must not be able to publish into
    // the next week.
    const { cachedRivalResults } = require('../rival-result-cache');
    expect(cachedRivalResults(rivals, teams)).toEqual([]);
  });
});
```

If `startNewCareer` requires a stubbed repository in this environment, mirror `stubCareerRepository` from `store.test.ts:1357` rather than inventing a new one.

- [ ] **Step 2: Run it**

Run: `npx jest src/application/__tests__/rival-preload-integration.test.ts`
Expected: PASS, 2 tests. A failure of the first test means warm and cold settle differ — the change is wrong, and no amount of tuning fixes it.

- [ ] **Step 3: Commit**

```bash
git add src/application/__tests__/rival-preload-integration.test.ts
git commit -m "test(matchday): warm and cold settle must agree"
```

---

### Task 8: Verify nothing moved, then measure

- [ ] **Step 1: Determinism and balance gates**

Run: `npx jest src/sim/__tests__/parity-replay.test.ts src/sim/__tests__/rng.test.ts src/game/__tests__/balance.test.ts src/game/__tests__/architecture.test.ts`
Expected: PASS with **no snapshot written**. A written snapshot means a replay-affecting change crept in — stop and diagnose, do not update it.

- [ ] **Step 2: Confirm `ENGINE_VERSION` untouched**

Run: `git diff origin/main -- src/sim/match.ts`
Expected: empty.

- [ ] **Step 3: Full suite**

Run: `npx jest`
Expected: all suites pass, 3 snapshots passed, 0 written.

- [ ] **Step 4: Measure the slice cost**

Create `src/game/__tests__/zzz-temp-bench.test.ts`, run it, record the number, then delete the file with `rm` (it is untracked, so there is nothing to `git rm` and no commit to make):

```ts
import { ROVERS, UNITED } from '../../sim/teams';
import type { TeamDef } from '../../sim/types';
import { createFixtureResolver } from '../matchday';
import type { LeagueFixture } from '../types';

const TEAMS: Readonly<Record<string, TeamDef>> = {
  [ROVERS.id]: ROVERS,
  [UNITED.id]: UNITED,
};

test('TEMP BENCH: worst slice cost', () => {
  const fixture: LeagueFixture = {
    id: 'bench',
    season: 1,
    round: 1,
    week: 5,
    homeClubId: ROVERS.id,
    awayClubId: UNITED.id,
    matchSeed: 1234,
    status: 'scheduled',
  };
  const resolver = createFixtureResolver(fixture, TEAMS);
  let worst = 0;
  while (!resolver.done) {
    const started = process.hrtime.bigint();
    resolver.advance(32);
    worst = Math.max(worst, Number(process.hrtime.bigint() - started) / 1e6);
  }
  console.info(`WORST_SLICE_MS ${worst.toFixed(2)}`);
  expect(worst).toBeLessThan(8);
});
```

Baseline measured 2026-07-27 on this machine: one match **142.7ms**, four rivals **571.6ms** in Node/V8. Expect roughly 3-4x on device.

- [ ] **Step 5: Device check**

Tests cannot show the absence of a freeze. On a simulator or device, measure and record three numbers before and after: cold Quick Result, warm Quick Result, watched full time. Then confirm the fallback still works — tap Quick Result the instant the week turns and check the league table is correct despite the cold cache.

---

## Notes for a reviewer

- **The load-bearing test is Task 1's slice-size invariance.** Everything else assumes chunking cannot change a result; that test is what pins it.
- **Every failure mode is a miss.** If the fingerprint is over-sensitive the cache always misses and the feature is merely useless. There is no path where a stale entry is served, because the comparison is against the same `TeamDef`s settle will use.
- **Residual freeze is real and recorded.** An instant cold Quick Result is unchanged from today. The follow-up is an asynchronous settle, deliberately out of scope here.
- **The watching floor is reasoned, not measured.** `WATCHING_FLOOR_MS = 6` assumes the match's own work leaves short idle slices and the preload should stay out of them. Task 8 Step 5 is where that gets checked.
