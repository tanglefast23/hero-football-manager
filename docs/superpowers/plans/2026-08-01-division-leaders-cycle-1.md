# Division Leaders (Cycle 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record goals, assists, tackles won and saves for every player in the user's division, and show them as four position-filtered leaderboards on a new LEADERS tab in the League screen.

**Architecture:** The sim gains a real assist (tracked as ball possession moves between teammates, stamped onto the `GOAL` event). A single fold turns a finished match into per-player contributions, which accumulate into per-season, per-competition stat lines on `GameState`. The season transition denormalises each category's top three into `SeasonRecap`, then prunes rows for players who no longer exist. The League screen splits into three progressively-unlocked sub-tabs.

**Tech Stack:** TypeScript, Jest (ts-jest, `testEnvironment: 'node'`), zod for save validation, React Native + NativeWind for screens.

**Design spec:** [2026-08-01-division-leaders-design.md](../specs/2026-08-01-division-leaders-design.md)

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `src/sim/types.ts` | `MatchState` assist-tracking fields; `GOAL.assistedById` | Modify |
| `src/sim/match.ts` | Initialise fields; observe possession once per tick; `ENGINE_VERSION` | Modify |
| `src/sim/engine.ts` | Stamp `assistedById` on goals; clear on save and kickoff | Modify |
| `src/game/match-contributions.ts` | `contributionsFrom(match)` — the one fold | **Create** |
| `src/game/types.ts` | `PlayerMatchContribution`, `PlayerSeasonStatLine`, `DivisionAwardPlacement`, `AwardCategory` | Modify |
| `src/game/matchday.ts` | Attach contributions to `FixtureResult` | Modify |
| `src/application/store.ts` | Attach contributions on the **watched** path | Modify |
| `src/game/division-leaders.ts` | Ranking, role filter, transfer aggregation, podium | **Create** |
| `src/game/career.ts` | `recordStatLines` replaces `recordSeasonGoals` | Modify |
| `src/game/season-recap.ts` | Snapshot podiums; prune orphans | Modify |
| `src/persistence/game-state-codec.ts` | Schemas for the new shapes | Modify |
| `src/application/division-leaders-view-model.ts` | Stat lines → board view models | **Create** |
| `src/ui/m2-league-models.ts` | Leaders + sub-tab view model types | Modify |
| `src/application/m2-league-view-model.ts` | Wire leaders and tab availability | Modify |
| `src/ui/screens/M2LeagueScreen.tsx` | Sub-tab shell; cup moves into a tab | Modify |
| `src/ui/components/DivisionLeaderBoard.tsx` | One category board | **Create** |
| `content/assistant-guide.json` | `division-leaders` beat | Modify |
| `src/content/schemas.ts` | `league-leaders` destination, `division-leaders` focus | Modify |
| `App.tsx` | Route `league-leaders` to the League tab's leaders sub-tab | Modify |
| `src/ui/__tests__/desktop-content-width.test.ts` | Retarget the cup-guidance assertions | Modify |
| `src/game/__tests__/assist-yield-rail.test.ts` | CI guard on assist yield | **Create** |

Two new game-ring modules rather than growing `career.ts` (1200+ lines) and `matchday.ts`: ranking and contribution-folding are independently testable and have nothing to do with week advancement.

---

## Task 1: Assist tracking in the sim

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/match.ts:85-108`, `src/sim/match.ts:220-249`
- Modify: `src/sim/engine.ts:237`, `src/sim/engine.ts:1709`, `src/sim/engine.ts:1736`
- Test: `src/sim/__tests__/assists.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/sim/__tests__/assists.test.ts`:

```ts
import { createMatch, runMatch, tick } from '../match';
import { ROVERS, UNITED } from '../teams';
import type { MatchState } from '../types';

const POLICIES = { homePolicy: 'FIRE_WHEN_READY' as const, awayPolicy: 'FIRE_WHEN_READY' as const };

function goalsWithAssists(seeds: number): { goals: number; assisted: number } {
  let goals = 0;
  let assisted = 0;
  for (let index = 0; index < seeds; index += 1) {
    const result = runMatch(900_000 + index * 7919, ROVERS, UNITED, [], POLICIES);
    for (const event of result.events) {
      if (event.kind !== 'GOAL') continue;
      goals += 1;
      if (event.assistedById !== undefined) assisted += 1;
    }
  }
  return { goals, assisted };
}

describe('assist tracking', () => {
  it('starts a match with no assist candidate', () => {
    const state: MatchState = createMatch(1, ROVERS, UNITED);
    expect(state.assistCandidateId).toBeNull();
  });

  it('credits a teammate who held the ball before the scorer', () => {
    const { goals, assisted } = goalsWithAssists(20);
    expect(goals).toBeGreaterThan(0);
    expect(assisted).toBeGreaterThan(0);
  });

  it('never credits the scorer with their own assist', () => {
    for (let index = 0; index < 20; index += 1) {
      const result = runMatch(900_000 + index * 7919, ROVERS, UNITED, [], POLICIES);
      const slotIds = new Map<number, string>();
      // Slot identity is stable for this assertion because no substitutions are
      // queued: runMatch is called with no inputs.
      const match = createMatch(900_000 + index * 7919, ROVERS, UNITED, POLICIES);
      match.players.forEach((player, slot) => slotIds.set(slot, player.def.id));
      for (const event of result.events) {
        if (event.kind !== 'GOAL' || event.assistedById === undefined) continue;
        expect(event.assistedById).not.toBe(slotIds.get(event.by));
      }
    }
  });

  it('is deterministic — the same seed produces the same assists', () => {
    const first = runMatch(4242, ROVERS, UNITED, [], POLICIES);
    const second = runMatch(4242, ROVERS, UNITED, [], POLICIES);
    expect(first.events).toEqual(second.events);
  });

  it('clears the candidate when a kickoff restarts play', () => {
    const state = createMatch(7, ROVERS, UNITED, POLICIES);
    for (let step = 0; step < 400; step += 1) tick(state);
    const goalTicks = state.events.filter(event => event.kind === 'GOAL');
    // Any goal restarts the kickoff, which must leave no stale candidate behind.
    if (goalTicks.length > 0) expect(state.assistCandidateId).toBeNull();
  });

  // --- Constructed cases -------------------------------------------------
  // These are the reason the design stamps a stable id rather than a slot.
  // The smoke tests above cannot fail on any of them.

  it('credits the assister who was substituted off before the goal', () => {
    const state = createMatch(11, ROVERS, UNITED, POLICIES);
    const assisterId = state.players[7].def.id;
    const scorerId = state.players[9].def.id;

    // Slot 7 holds, then slot 9 receives: slot 7 is the assist candidate.
    state.ball = { kind: 'held', by: 7 };
    observeForTest(state);
    state.ball = { kind: 'held', by: 9 };
    observeForTest(state);
    expect(state.assistCandidateId).toBe(assisterId);

    // Slot 7 now leaves the pitch. The candidate must survive as an identity,
    // not as a slot that someone else has taken over.
    state.players[7] = { ...state.players[7], def: { ...state.players[7].def, id: 'substitute-7' } };
    expect(state.assistCandidateId).toBe(assisterId);
    expect(state.assistCandidateId).not.toBe(scorerId);
  });

  it('clears the candidate when the other team takes the ball', () => {
    const state = createMatch(12, ROVERS, UNITED, POLICIES);
    state.ball = { kind: 'held', by: 7 };
    observeForTest(state);
    state.ball = { kind: 'held', by: 9 };
    observeForTest(state);
    expect(state.assistCandidateId).not.toBeNull();

    state.ball = { kind: 'held', by: 15 }; // team 1
    observeForTest(state);
    expect(state.assistCandidateId).toBeNull();
  });

  it('keeps the candidate across a pass in flight', () => {
    const state = createMatch(13, ROVERS, UNITED, POLICIES);
    state.ball = { kind: 'held', by: 7 };
    observeForTest(state);
    state.ball = {
      kind: 'pass', pos: { x: 0, y: 0 }, from: 7, to: 9,
      willSucceed: true, interceptor: -1, z: 0, vz: 0, speed: 1,
    };
    observeForTest(state);
    state.ball = { kind: 'held', by: 9 };
    observeForTest(state);
    expect(state.assistCandidateId).toBe(state.players[7].def.id);
  });

  it('survives a decoy clone being dismissed while it held the ball', () => {
    const state = createMatch(14, ROVERS, UNITED, POLICIES);
    // Slot 22 is team 0's clone; give it a source and let it hold the ball.
    state.decoyClones[0] = {
      ownerIdx: 9, sourceIdx: 9, sourcePlayerId: state.players[9].def.id,
      pos: { x: 10, y: 10 }, formationSlot: 9, untilTick: 999,
    } as NonNullable<MatchState['decoyClones'][0]>;
    state.ball = { kind: 'held', by: 22 };
    observeForTest(state);
    // The clone's touch is attributed to the hero it copied.
    expect(state.ballHolderId).toBe(state.players[9].def.id);

    // Dismissal: ball goes loose, the clone stops existing.
    state.ball = { kind: 'loose', pos: { x: 10, y: 10 }, vel: { x: 0, y: 0 }, z: 0, vz: 0 };
    state.decoyClones[0] = null;
    observeForTest(state);

    // A teammate picks it up. This must not throw.
    state.ball = { kind: 'held', by: 7 };
    expect(() => observeForTest(state)).not.toThrow();
    expect(state.assistCandidateId).toBe(state.players[9].def.id);
  });
});
```

`observeForTest` is `observePossession` exported for testing. Export it from
`src/sim/match.ts` as `export function observePossession` and import it in the
test as `import { observePossession as observeForTest } from '../match';`.
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/sim/__tests__/assists.test.ts`
Expected: FAIL — `Property 'assistCandidateId' does not exist on type 'MatchState'`.

- [ ] **Step 3: Add the state fields and the event field**

In `src/sim/types.ts`, add to the `GOAL` variant of `MatchEvent` (currently line 266):

```ts
  | {
    t: number;
    kind: 'GOAL';
    by: number;
    team: 0 | 1;
    /**
     * Stable id of the teammate who held the ball immediately before the
     * scorer. A stable id rather than a slot because the assisting touch
     * precedes the goal by many ticks, so a substitution can land in between
     * and a slot would resolve to the wrong player.
     */
    assistedById?: string;
  }
```

Add to `MatchState` (after `ball: BallState;`, currently line 333):

```ts
  /** Stable id of the player last observed holding the ball. */
  ballHolderId: string | null;
  /** Team of that holder, so a turnover is detectable without a slot lookup. */
  ballHolderTeam: 0 | 1 | null;
  /** Stable id of the previous same-team holder, or null when unassisted. */
  assistCandidateId: string | null;
```

**Store an id, not a slot.** A slot survives its occupant. `dismissDecoy`
(`src/sim/powers.ts:1201`) drops a clone-held ball to `loose` and then sets
`state.decoyClones[team] = null`, so a stored slot 22 outlives the entity it
named. The next real holder would resolve `attributedPlayerIndex(state, 22)`
back to 22 — the clone is gone, so there is nothing to redirect to — and
`state.players[22]` is `undefined`, because that array is only the 22 base
players. That is a crash mid-match, on a path the product actively encourages.

Resolving to a stable id at observation time removes the lifetime entirely: a
stale id is an inert string, and a clone's touch is already attributed to the
hero it was copied from.

- [ ] **Step 4: Initialise them in `createMatch`**

In `src/sim/match.ts`, inside the `state` literal (after `ball: { kind: 'held', by: 9 },`):

```ts
    ballHolderId: null,
    ballHolderTeam: null,
    assistCandidateId: null,
```

- [ ] **Step 5: Observe possession once per tick**

In `src/sim/match.ts`, add near the other helpers:

```ts
/**
 * The single place possession changes are noticed.
 *
 * The ball passes through non-held states (`pass`, `loose`) between touches, so
 * this returns early while nobody holds it — that is what preserves the
 * previous holder across a pass in flight. Nine call sites in the engine assign
 * `state.ball`; observing the result once per tick avoids patching all of them.
 */
function observePossession(state: MatchState): void {
  if (state.ball.kind !== 'held') return;
  const holder = state.players[attributedPlayerIndex(state, state.ball.by)];
  // A decoy clone whose source has left the pitch resolves to nothing.
  if (holder === undefined) return;
  if (holder.def.id === state.ballHolderId) return;
  state.assistCandidateId =
    state.ballHolderId !== null && state.ballHolderTeam === holder.team
      ? state.ballHolderId
      : null;
  state.ballHolderId = holder.def.id;
  state.ballHolderTeam = holder.team;
}
```

Import it: add `attributedPlayerIndex` to the existing import from `./entities`.

Call it in `tick`, immediately after `shotFlightTick(state);`:

```ts
  observePossession(state);
```

- [ ] **Step 6: Clear on save and on kickoff**

In `src/sim/engine.ts`, in `restartKickoff` (line 237), immediately after `clearRestartPowerState(state);`:

```ts
  state.ballHolderId = null;
  state.ballHolderTeam = null;
  state.assistCandidateId = null;
```

In `src/sim/engine.ts`, immediately after the `SAVE` emit (line 1709):

```ts
        // A goal off the rebound is unassisted; the move that produced the
        // save is over.
        state.assistCandidateId = null;
```

- [ ] **Step 7: Stamp the goal**

In `src/sim/engine.ts`, replace the `GOAL` emit (line 1736):

```ts
  const scorerId = state.players[attributedPlayerIndex(state, b.by)].def.id;
  const assistedById = state.assistCandidateId;
  emit(state, {
    t: state.tick,
    kind: 'GOAL',
    by: b.by,
    team: shooter.team,
    ...(assistedById !== null && assistedById !== scorerId ? { assistedById } : {}),
  });
```

`attributedPlayerIndex` is already imported in `engine.ts`; if not, add it from `./entities`.

- [ ] **Step 8: Run the tests**

Run: `npx jest src/sim/__tests__/assists.test.ts`
Expected: PASS, 9 tests. The four constructed cases are the ones that matter —
if only the smoke tests pass, the substitution and decoy bugs are still live.

- [ ] **Step 9: Commit**

```bash
git add src/sim/types.ts src/sim/match.ts src/sim/engine.ts src/sim/__tests__/assists.test.ts
git commit -m "feat(sim): track assists as possession moves between teammates"
```

---

## Task 2: Record the version decision, and fix the blind tripwire

**REVISED DURING EXECUTION. The original premise was wrong.**

This task was written as "bump `ENGINE_VERSION` to m2.1, regenerate the golden
snapshots." Neither half survived contact with the code.

**The golden snapshots did not move.** Both fixtures finish 0-0, so neither can
observe a change to the `GOAL` event. The forcing reminder CLAUDE.md relies on
never fired — not because nothing changed, but because the tripwire is blind to
this entire class of change.

**The bump is all cost and no benefit.** CLAUDE.md's trigger is "behavior,
tuning, or RNG consumption." Two independent 40-seed fingerprints — one by the
implementer, one by the spec reviewer against the parent commit — showed the
event stream is byte-identical with `assistedById` stripped. Nothing moved.
Meanwhile:

- Saves do not version-check. `save-file.ts:147` requires only a non-empty
  string, so a bump is invisible to careers either way.
- Replays *do* hard-check. `match.ts:501` throws `replay engine mismatch` on any
  difference, and replays are persisted in SQLite (`replay-repository.ts`).
- Replay envelopes carry **no events** — `envelopeFrom` (`match.ts:300`) stores
  seed, teams, inputs and opts, and re-simulation regenerates everything else.

So an m2.0 replay run on this code produces an identical match, now annotated
with assists. Bumping would reject every stored replay to prevent a divergence
that cannot occur.

**Decision: `ENGINE_VERSION` stays at `m2.0`.**

What this task does instead is close the hole the non-failure exposed.

**Files:**
- Modify: `src/sim/runtime-golden.ts` and/or `src/sim/__tests__/parity-replay.test.ts`
- Test: goal-bearing golden coverage

- [ ] **Step 1: Confirm the blindness**

Verify that the existing golden fixtures produce no `GOAL` event. This is the
justification for the whole task — if a fixture does score, the coverage already
exists and this task shrinks to nothing.

- [ ] **Step 2: Add a goal-bearing seed**

Add golden coverage over a seed that reliably scores, so the hash spans at least
one `GOAL` payload including `assistedById`. Additive — a new baseline for a new
seed, leaving the existing 0-0 baseline untouched, so this cannot mask a
regression in what is already covered.

- [ ] **Step 3: Prove the new coverage is live**

Mutate the assist rule (e.g. stamp a wrong id), confirm the new golden fails,
then restore. A tripwire that has not been seen to trip is not a tripwire.

- [ ] **Step 4: Commit**

The commit message must record the version decision and its evidence, because
that reasoning is the durable artefact — not the code.

**Files:**
- Modify: `src/sim/match.ts:26`
- Modify: `src/sim/__tests__/__snapshots__/parity-replay.test.ts.snap` (regenerated)

- [ ] **Step 1: Confirm the golden replay currently fails**

Run: `npx jest src/sim/__tests__/parity-replay.test.ts src/sim/__tests__/runtime-golden.test.ts`
Expected: FAIL — snapshot mismatch showing added `assistedById` keys.

- [ ] **Step 2: Bump the version**

In `src/sim/match.ts`, line 26:

```ts
export const ENGINE_VERSION = 'm2.1';
```

- [ ] **Step 3: Regenerate the snapshot**

Run: `npx jest src/sim/__tests__/parity-replay.test.ts src/sim/__tests__/runtime-golden.test.ts -u`
Expected: PASS, snapshots written.

- [ ] **Step 4: Run the whole sim suite**

Run: `npx jest src/sim`
Expected: PASS. Any other failure here is a real regression from Task 1, not a snapshot artefact — fix it rather than updating more snapshots.

- [ ] **Step 5: Commit**

```bash
git add src/sim/match.ts src/sim/__tests__/__snapshots__
git commit -m "chore(sim): bump ENGINE_VERSION to m2.1 for the assist event field"
```

---

## Task 3: `contributionsFrom` — the one fold

**Files:**
- Create: `src/game/match-contributions.ts`
- Modify: `src/game/types.ts`
- Test: `src/game/__tests__/match-contributions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/__tests__/match-contributions.test.ts`:

```ts
import { contributionsFrom } from '../match-contributions';
import type { MatchEvent, MatchState } from '../../sim/types';

/** Minimal MatchState carrying only what contributionsFrom reads. */
function matchWith(events: MatchEvent[], slotIds: string[]): MatchState {
  return {
    players: slotIds.map(id => ({ def: { id } })),
    events,
  } as unknown as MatchState;
}

const SLOTS = Array.from({ length: 22 }, (_, slot) => `p${slot}`);

describe('contributionsFrom', () => {
  it('credits a goal to the slot occupant', () => {
    const rows = contributionsFrom(matchWith(
      [{ t: 10, kind: 'GOAL', by: 9, team: 0 }],
      SLOTS,
    ));
    expect(rows).toEqual([{ playerId: 'p9', goals: 1, assists: 0, tacklesWon: 0, saves: 0 }]);
  });

  it('credits an assist to the stamped id, not a slot', () => {
    const rows = contributionsFrom(matchWith(
      [{ t: 10, kind: 'GOAL', by: 9, team: 0, assistedById: 'p7' }],
      SLOTS,
    ));
    expect(rows).toContainEqual({ playerId: 'p7', goals: 0, assists: 1, tacklesWon: 0, saves: 0 });
  });

  it('counts saves for the keeper slot', () => {
    const rows = contributionsFrom(matchWith(
      [{ t: 5, kind: 'SAVE', by: 0, resolveLeft: 90 }],
      SLOTS,
    ));
    expect(rows).toEqual([{ playerId: 'p0', goals: 0, assists: 0, tacklesWon: 0, saves: 1 }]);
  });

  it('counts won standing and slide tackles but not power tackles', () => {
    const rows = contributionsFrom(matchWith([
      { t: 1, kind: 'TACKLE', by: 3, on: 15, won: true, style: 'standing', contact: true },
      { t: 2, kind: 'TACKLE', by: 3, on: 15, won: true, style: 'slide', contact: true },
      { t: 3, kind: 'TACKLE', by: 3, on: 15, won: true, style: 'power', contact: true },
      { t: 4, kind: 'TACKLE', by: 3, on: 15, won: false, style: 'standing', contact: true },
    ], SLOTS));
    expect(rows).toEqual([{ playerId: 'p3', goals: 0, assists: 0, tacklesWon: 2, saves: 0 }]);
  });

  it('credits a first-half goal to the starter, not the player who replaced him', () => {
    const rows = contributionsFrom(matchWith([
      { t: 10, kind: 'GOAL', by: 9, team: 0 },
      { t: 50, kind: 'SUBSTITUTION', player: 9, outPlayerId: 'p9', inPlayerId: 'sub1', team: 0 },
      { t: 80, kind: 'GOAL', by: 9, team: 0 },
    ], SLOTS.map((id, slot) => (slot === 9 ? 'sub1' : id))));
    expect(rows).toContainEqual({ playerId: 'p9', goals: 1, assists: 0, tacklesWon: 0, saves: 0 });
    expect(rows).toContainEqual({ playerId: 'sub1', goals: 1, assists: 0, tacklesWon: 0, saves: 0 });
  });

  it('returns nothing for a match with no countable events', () => {
    expect(contributionsFrom(matchWith([{ t: 0, kind: 'KICKOFF', half: 1 }], SLOTS))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/game/__tests__/match-contributions.test.ts`
Expected: FAIL — `Cannot find module '../match-contributions'`.

- [ ] **Step 3: Add the type**

In `src/game/types.ts`, beside `PlayerSeasonGoalTally`:

```ts
/** One player's countable actions in a single finished match. */
export interface PlayerMatchContribution {
  playerId: string;
  goals: number;
  assists: number;
  tacklesWon: number;
  saves: number;
}
```

- [ ] **Step 4: Write the implementation**

Create `src/game/match-contributions.ts`:

```ts
import type { MatchState } from '../sim/types';
import type { PlayerMatchContribution } from './types';

type Countable = 'goals' | 'assists' | 'tacklesWon' | 'saves';

/**
 * Every countable action in a finished match, resolved to stable player ids.
 *
 * Walks backwards for the same reason `goalsFrom` does: a GOAL, SAVE or TACKLE
 * names a lineup SLOT, and substitutes inherit the slot they come on into.
 * Reading slot owners from the starting lineup credits a substitute's goal to
 * the player he replaced; reading from the final state makes the mirrored
 * mistake. Substitutions record the outgoing player, so rewinding them from the
 * final state puts every slot back to whoever held it at the time.
 *
 * Assists are exempt from all of that — the engine stamps a stable id precisely
 * because the assisting touch can precede the goal by a substitution.
 */
export function contributionsFrom(match: MatchState): PlayerMatchContribution[] {
  const slotOwners = new Map<number, string>();
  match.players.forEach((player, slot) => slotOwners.set(slot, player.def.id));

  const totals = new Map<string, PlayerMatchContribution>();
  const bump = (playerId: string, key: Countable): void => {
    const row = totals.get(playerId)
      ?? { playerId, goals: 0, assists: 0, tacklesWon: 0, saves: 0 };
    row[key] += 1;
    totals.set(playerId, row);
  };

  for (let index = match.events.length - 1; index >= 0; index -= 1) {
    const event = match.events[index];
    if (event.kind === 'GOAL') {
      const scorer = slotOwners.get(event.by);
      if (scorer !== undefined) bump(scorer, 'goals');
      if (event.assistedById !== undefined) bump(event.assistedById, 'assists');
    } else if (event.kind === 'SAVE') {
      const keeper = slotOwners.get(event.by);
      if (keeper !== undefined) bump(keeper, 'saves');
    } else if (event.kind === 'TACKLE' && event.won && event.style !== 'power') {
      // Power tackles are excluded: a ball-winning power would otherwise decide
      // the defender award on power ownership rather than defending.
      const tackler = slotOwners.get(event.by);
      if (tackler !== undefined) bump(tackler, 'tacklesWon');
    } else if (event.kind === 'SUBSTITUTION') {
      slotOwners.set(event.player, event.outPlayerId);
    }
  }

  return [...totals.values()];
}
```

- [ ] **Step 5: Run the tests**

Run: `npx jest src/game/__tests__/match-contributions.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/game/match-contributions.ts src/game/types.ts src/game/__tests__/match-contributions.test.ts
git commit -m "feat(game): fold a finished match into per-player contributions"
```

---

## Task 4: Attach contributions to `FixtureResult`

**Files:**
- Modify: `src/game/types.ts:231-235`
- Modify: `src/game/matchday.ts:154-164`
- Test: `src/game/__tests__/matchday-contributions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/__tests__/matchday-contributions.test.ts`:

```ts
import { resolveMatchday } from '../matchday';
import { ROVERS, UNITED } from '../../sim/teams';
import type { LeagueFixture } from '../types';

const FIXTURE: LeagueFixture = {
  id: 'f1', season: 1, week: 1, homeClubId: 'home', awayClubId: 'away',
  status: 'scheduled', matchSeed: 4242,
};

describe('matchday contributions', () => {
  it('attaches contributions whose goals match the scoreline', () => {
    const [result] = resolveMatchday([FIXTURE], { home: ROVERS, away: UNITED });
    const goals = (result.contributions ?? []).reduce((sum, row) => sum + row.goals, 0);
    expect(result.contributions).toBeDefined();
    expect(goals).toBe(result.homeGoals + result.awayGoals);
  });

  it('agrees with scorerPlayerIds about who scored', () => {
    const [result] = resolveMatchday([FIXTURE], { home: ROVERS, away: UNITED });
    const fromContributions = new Map<string, number>();
    for (const row of result.contributions ?? []) {
      if (row.goals > 0) fromContributions.set(row.playerId, row.goals);
    }
    const fromScorers = new Map<string, number>();
    for (const id of result.scorerPlayerIds ?? []) {
      fromScorers.set(id, (fromScorers.get(id) ?? 0) + 1);
    }
    expect(fromContributions).toEqual(fromScorers);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/game/__tests__/matchday-contributions.test.ts`
Expected: FAIL — `Property 'contributions' does not exist on type 'FixtureResult'`.

- [ ] **Step 3: Widen `FixtureResult`**

In `src/game/types.ts`, replace lines 231-235:

```ts
export interface FixtureResult extends FixtureScore {
  fixtureId: string;
  /** Ordered scorer IDs when the full simulation result is available. */
  scorerPlayerIds?: string[];
  /**
   * Per-player countable actions. Present alongside `scorerPlayerIds` rather
   * than replacing it: career validation checks the scorer list against the
   * scoreline, and that invariant is worth more than the small redundancy.
   */
  contributions?: PlayerMatchContribution[];
}
```

- [ ] **Step 4: Populate it**

In `src/game/matchday.ts`, replace `fixtureResultFrom` (line 154):

```ts
function fixtureResultFrom(fixture: LeagueFixture, match: MatchState): FixtureResult {
  const scorerPlayerIds = goalsFrom(match).map(goal => goal.playerId);
  const contributions = contributionsFrom(match);
  return {
    fixtureId: fixture.id,
    homeGoals: match.score[0],
    awayGoals: match.score[1],
    ...(scorerPlayerIds.length === match.score[0] + match.score[1]
      ? { scorerPlayerIds }
      : {}),
    ...(contributions.length > 0 ? { contributions } : {}),
  };
}
```

Add the import at the top of `src/game/matchday.ts`:

```ts
import { contributionsFrom } from './match-contributions';
```

- [ ] **Step 5: Run the tests**

Run: `npx jest src/game/__tests__/matchday-contributions.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add src/game/types.ts src/game/matchday.ts src/game/__tests__/matchday-contributions.test.ts
git commit -m "feat(game): attach per-player contributions to fixture results"
```

---

## Task 4b: The watched-match path

**This is the path the player actually uses, and `fixtureResultFrom` never runs on it.**

`finishWatchedMatch` (`src/application/store.ts:814`) hand-builds its result
object from `goalsFrom(result)` and passes it to `resolveMatchday` as a
*supplied* result. `resolveMatchday` keeps supplied results verbatim — it only
folds fixtures it had to simulate itself. So without this task:

- the user's own watched fixture records nothing
- rival fixtures, simulated for them, record everything

Every leaderboard would show a full field of rivals and none of your players.
Task 6's tests drive `resolveMatchday` headlessly and would all pass.

**Files:**
- Modify: `src/application/store.ts:814-845`
- Test: `src/application/__tests__/watched-match-contributions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/application/__tests__/watched-match-contributions.test.ts`:

```ts
import { contributionsFrom } from '../../game/match-contributions';
import { goalsFrom } from '../../game/matchday';
import { createMatch, tick } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';

/**
 * The store builds its own FixtureResult from a watched MatchState instead of
 * going through fixtureResultFrom. This asserts the two agree, which is the
 * property that keeps watched and Quick Result leaderboards identical.
 */
describe('watched match contributions', () => {
  it('produces contributions consistent with the scorer list', () => {
    const match = createMatch(4242, ROVERS, UNITED, {
      homePolicy: 'FIRE_WHEN_READY', awayPolicy: 'FIRE_WHEN_READY',
    });
    while (match.phase !== 'fulltime') tick(match);

    const scorers = goalsFrom(match).map(goal => goal.playerId);
    const contributions = contributionsFrom(match);
    const goalsByPlayer = new Map<string, number>();
    for (const row of contributions) {
      if (row.goals > 0) goalsByPlayer.set(row.playerId, row.goals);
    }
    const expected = new Map<string, number>();
    for (const id of scorers) expected.set(id, (expected.get(id) ?? 0) + 1);

    expect(goalsByPlayer).toEqual(expected);
    expect(contributions.reduce((sum, row) => sum + row.saves, 0)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to verify it passes already**

Run: `npx jest src/application/__tests__/watched-match-contributions.test.ts`
Expected: PASS. This test guards the invariant; the store wiring below is what
actually needs changing, and it has no headless test because it lives behind
zustand and a live match screen.

- [ ] **Step 3: Wire the store**

In `src/application/store.ts`, in `finishWatchedMatch`, extend the `supplied`
object (line ~819):

```ts
      const goals = goalsFrom(result);
      const scorerPlayerIds = goals.map(goal => goal.playerId);
      const contributions = contributionsFrom(result);
      const supplied = {
        fixtureId: fixture.id,
        homeGoals: result.score[0],
        awayGoals: result.score[1],
        ...(scorerPlayerIds.length === result.score[0] + result.score[1]
          ? { scorerPlayerIds }
          : {}),
        ...(contributions.length > 0 ? { contributions } : {}),
      };
```

Add the import:

```ts
import { contributionsFrom } from '../game/match-contributions';
```

This covers both branches — the league path spreads `supplied` into
`resolveMatchday`, and the cup path uses `[supplied]` directly.

- [ ] **Step 4: Search for any other hand-built result**

Run: `rg -n "homeGoals:.*score\[0\]" src --glob '!*__tests__*'`
Expected: `src/game/matchday.ts` (handled in Task 4) and
`src/application/store.ts` (handled above). If any third site appears, it needs
the same treatment — a supplied result that omits contributions is a silent
recording hole, not a compile error.

- [ ] **Step 5: Run the suite and the type gate**

Run: `npx jest src/application && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/application/store.ts src/application/__tests__/watched-match-contributions.test.ts
git commit -m "fix(app): record contributions for watched matches, not only simulated ones"
```

---

## Task 5: `PlayerSeasonStatLine` and the codec

**Files:**
- Modify: `src/game/types.ts:290-294`, `src/game/types.ts:437`
- Modify: `src/persistence/game-state-codec.ts:408-414`, `:742`, `:1034-1042`
- Test: `src/persistence/__tests__/stat-line-codec.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/persistence/__tests__/stat-line-codec.test.ts`:

```ts
import { parseStoredGameState, serializeGameState } from '../game-state-codec';
import { createCareer } from '../../game/career';
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';

const content = loadLaunchContent();

describe('stat line persistence', () => {
  it('round-trips stat lines unchanged', () => {
    const state = createCareer(createLaunchCareerSetup(1234, undefined, content));
    const withLines = {
      ...state,
      seasonStatLines: [{
        season: 1, playerId: 'p1', clubId: 'c1', competition: 'league' as const,
        goals: 3, assists: 2, tacklesWon: 11, saves: 0,
      }],
    };
    const parsed = parseStoredGameState(JSON.parse(serializeGameState(withLines)));
    expect(parsed.seasonStatLines).toEqual(withLines.seasonStatLines);
  });

  it('rejects a stat line with a negative count', () => {
    const state = createCareer(createLaunchCareerSetup(1234, undefined, content));
    const broken = {
      ...state,
      seasonStatLines: [{
        season: 1, playerId: 'p1', clubId: 'c1', competition: 'league' as const,
        goals: -1, assists: 0, tacklesWon: 0, saves: 0,
      }],
    };
    expect(() => parseStoredGameState(JSON.parse(JSON.stringify(broken)))).toThrow();
  });

  it('rejects an unknown competition', () => {
    const state = createCareer(createLaunchCareerSetup(1234, undefined, content));
    const broken = {
      ...state,
      seasonStatLines: [{
        season: 1, playerId: 'p1', clubId: 'c1', competition: 'friendly',
        goals: 0, assists: 0, tacklesWon: 0, saves: 0,
      }],
    };
    expect(() => parseStoredGameState(JSON.parse(JSON.stringify(broken)))).toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/persistence/__tests__/stat-line-codec.test.ts`
Expected: FAIL — `seasonStatLines` is not a known property.

- [ ] **Step 3: Replace the type**

In `src/game/types.ts`, replace `PlayerSeasonGoalTally` (lines 290-294):

```ts
export type AwardCompetition = 'league' | 'cup';

/**
 * One player's season in one competition, for one club.
 *
 * `clubId` is stamped when the row is written rather than resolved at read
 * time: players transfer mid-season, so a row resolved later would attribute a
 * sold player's first-half goals to whoever bought him.
 */
export interface PlayerSeasonStatLine {
  season: number;
  playerId: string;
  clubId: string;
  competition: AwardCompetition;
  goals: number;
  assists: number;
  tacklesWon: number;
  saves: number;
}
```

In `src/game/types.ts`, replace line 437:

```ts
  /**
   * Absent on saves written before division-leader tracking. Those saves keep
   * loading, but their goal history does not survive: `seasonGoalTallies` is
   * not migrated, and the root schema strips unknown keys, so the old rows are
   * dropped on read. Accepted under the standing decision that breaking saves
   * is fine until TestFlight.
   */
  seasonStatLines?: PlayerSeasonStatLine[];
```

**Be honest about what this costs.** Dropping the old rows takes the season
Golden Boot, `heroHasScored` (`src/game/career-events.ts:240`) and the
championship-celebration scorer list back to zero for any in-flight career. If
that becomes unacceptable before TestFlight, the codebase already has the
mechanism: raise `GAME_SCHEMA_VERSION` in `src/game/types.ts` and append an
`up()` to `GAME_STATE_MIGRATIONS` (`src/persistence/game-state-codec.ts:1702`,
which documents the procedure and is currently an empty array). The hard part
is `clubId` for historical rows — the player may since have transferred — so
that migration would have to either use the player's current club or drop
pre-migration rows, and that is a decision to take deliberately rather than
inside an `up()`.

Note also that acceptance fixtures under `fixtures/acceptance-audit-*/` still
carry `seasonGoalTallies`. Anything that loads them needs the same call.

- [ ] **Step 4: Replace the schema**

In `src/persistence/game-state-codec.ts`, replace `seasonGoalTallySchema` (line 408):

```ts
const seasonStatLineSchema = z
  .object({
    season: positiveInteger,
    playerId: nonemptyString,
    clubId: nonemptyString,
    competition: z.enum(['league', 'cup']),
    goals: nonnegativeInteger,
    assists: nonnegativeInteger,
    tacklesWon: nonnegativeInteger,
    saves: nonnegativeInteger,
  })
  .passthrough();
```

Replace line 742:

```ts
    seasonStatLines: z.array(seasonStatLineSchema).optional(),
```

Update the cross-field validation at line 1034 to iterate `seasonStatLines`, keeping the same duplicate-key rule but keying on `season:playerId:clubId:competition`:

```ts
    const seenStatLineKeys = new Set<string>();
    for (let index = 0; index < (state.seasonStatLines ?? []).length; index += 1) {
      const line = state.seasonStatLines![index];
      const key = `${line.season}:${line.playerId}:${line.clubId}:${line.competition}`;
      if (seenStatLineKeys.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate stat line ${key}`,
          path: ['seasonStatLines', index],
        });
      }
      seenStatLineKeys.add(key);
    }
```

- [ ] **Step 5: Run the tests**

Run: `npx jest src/persistence/__tests__/stat-line-codec.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Fix every compile break**

Run: `npx tsc --noEmit`
Expected: errors at `src/game/career.ts:134`, `:220`, `:228`, `:778`, `:1183`, `src/game/career-events.ts:240`, `src/game/season-recap.ts:32`, `src/application/championship-celebration.ts:47`. Tasks 6 and 7 fix these. Leave them failing for now and do not commit a broken tree — proceed straight to Task 6.

---

## Task 6: Record stat lines

**Files:**
- Modify: `src/game/career.ts:134`, `:220-228`, `:778`, `:1179-1206`
- Modify: `src/game/career-events.ts:240`, `src/application/championship-celebration.ts:47`, `src/game/season-recap.ts:32`
- Test: `src/game/__tests__/stat-line-recording.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/__tests__/stat-line-recording.test.ts`:

```ts
import { createCareer, activeCareerMatchday, completeMatchday } from '../career';
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import { buildCareerMatchTeams } from '../index';
import { resolveMatchday } from '../matchday';

const content = loadLaunchContent();

function playOneWeek() {
  const state = createCareer(createLaunchCareerSetup(4_000_000, undefined, content));
  const matchday = activeCareerMatchday(state)!;
  const clubIds = [...new Set(matchday.fixtures.flatMap(f => [f.homeClubId, f.awayClubId]))];
  const teams = buildCareerMatchTeams(state, clubIds);
  const results = resolveMatchday(matchday.fixtures, teams);
  return { before: state, after: completeMatchday(state, results) };
}

describe('stat line recording', () => {
  it('records league rows stamped with the scoring club', () => {
    const { after } = playOneWeek();
    const lines = after.seasonStatLines ?? [];
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.competition).toBe('league');
      const player = after.players.find(candidate => candidate.id === line.playerId);
      expect(player).toBeDefined();
      expect(line.clubId).toBe(player!.clubId);
    }
  });

  it('records tackles and saves, not only goals', () => {
    const { after } = playOneWeek();
    const lines = after.seasonStatLines ?? [];
    expect(lines.reduce((sum, line) => sum + line.tacklesWon, 0)).toBeGreaterThan(0);
    expect(lines.reduce((sum, line) => sum + line.saves, 0)).toBeGreaterThan(0);
  });

  it('is deterministic across identical runs', () => {
    expect(playOneWeek().after.seasonStatLines).toEqual(playOneWeek().after.seasonStatLines);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/game/__tests__/stat-line-recording.test.ts`
Expected: FAIL — compile errors from Task 5, plus `seasonStatLines` undefined.

- [ ] **Step 3: Replace `recordSeasonGoals`**

In `src/game/career.ts`, replace the function at line 1179:

```ts
function recordStatLines(
  state: GameState,
  fixtures: LeagueFixture[],
  resultByFixtureId: ReadonlyMap<string, FixtureResult>,
  competition: AwardCompetition,
): GameState['seasonStatLines'] {
  const clubByPlayerId = new Map(state.players.map(player => [player.id, player.clubId]));
  const totals = new Map(
    (state.seasonStatLines ?? []).map(line => [
      `${line.season}:${line.playerId}:${line.clubId}:${line.competition}`,
      { ...line },
    ]),
  );

  for (const fixture of fixtures) {
    const result = resultByFixtureId.get(fixture.id);
    for (const contribution of result?.contributions ?? []) {
      const clubId = clubByPlayerId.get(contribution.playerId);
      if (clubId === undefined) continue;
      const key = `${state.season}:${contribution.playerId}:${clubId}:${competition}`;
      const previous = totals.get(key);
      totals.set(key, {
        season: state.season,
        playerId: contribution.playerId,
        clubId,
        competition,
        goals: checkedAdd(previous?.goals ?? 0, contribution.goals, `${contribution.playerId} goals`),
        assists: checkedAdd(previous?.assists ?? 0, contribution.assists, `${contribution.playerId} assists`),
        tacklesWon: checkedAdd(previous?.tacklesWon ?? 0, contribution.tacklesWon, `${contribution.playerId} tackles`),
        saves: checkedAdd(previous?.saves ?? 0, contribution.saves, `${contribution.playerId} saves`),
      });
    }
  }

  return [...totals.values()];
}
```

Add `AwardCompetition` to the type import at the top of `career.ts`.

- [ ] **Step 4: Update the three call sites**

Line 134 — `createCareer` initial state:

```ts
    seasonStatLines: [],
```

Lines 220 and 228 — league matchday:

```ts
  const seasonStatLines = recordStatLines(state, scheduledFixtures, resultByFixtureId, 'league');
```

```ts
    seasonStatLines,
```

Line 778 — cup matchday:

```ts
    seasonStatLines: recordStatLines(state, cupMatchday.fixtures, resultByFixtureId, 'cup'),
```

- [ ] **Step 5: Update the three readers**

`src/game/career-events.ts:240` — replace `state.seasonGoalTallies` with `state.seasonStatLines`, keeping the same predicate shape.

`src/application/championship-celebration.ts:47` — replace `state.seasonGoalTallies` with `state.seasonStatLines`; the mapped value becomes `line.goals`.

`src/game/season-recap.ts:32` — the club-only Golden Boot sums both competitions:

```ts
  const goalsByPlayer = new Map<string, number>();
  for (const line of state.seasonStatLines ?? []) {
    if (line.season !== state.season) continue;
    goalsByPlayer.set(line.playerId, (goalsByPlayer.get(line.playerId) ?? 0) + line.goals);
  }
```

- [ ] **Step 6: Run the tests and the type gate**

Run: `npx jest src/game/__tests__/stat-line-recording.test.ts && npx tsc --noEmit`
Expected: PASS, 3 tests; no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/game src/persistence src/application/championship-celebration.ts
git commit -m "feat(game): record per-player season stat lines by competition"
```

---

## Task 7: Ranking, role filter, and podiums

**Files:**
- Create: `src/game/division-leaders.ts`
- Modify: `src/game/types.ts`
- Test: `src/game/__tests__/division-leaders.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/__tests__/division-leaders.test.ts`:

```ts
import { AWARD_CATEGORIES, divisionLeaderBoard, divisionPodium } from '../division-leaders';
import type { CareerPlayer, PlayerSeasonStatLine } from '../types';

function player(id: string, role: CareerPlayer['role'], clubId = 'c1'): CareerPlayer {
  return { id, clubId, name: id.toUpperCase(), role } as CareerPlayer;
}

function line(playerId: string, clubId: string, goals: number, extra: Partial<PlayerSeasonStatLine> = {}): PlayerSeasonStatLine {
  return {
    season: 1, playerId, clubId, competition: 'league',
    goals, assists: 0, tacklesWon: 0, saves: 0, ...extra,
  };
}

describe('division leader boards', () => {
  it('ranks only players eligible for the category', () => {
    const board = divisionLeaderBoard({
      category: AWARD_CATEGORIES.goals,
      season: 1,
      players: [player('a', 'FWD'), player('b', 'MID')],
      statLines: [line('a', 'c1', 5), line('b', 'c1', 40)],
      limit: 5,
    });
    expect(board.map(entry => entry.playerId)).toEqual(['a']);
  });

  it('sums a transferred player across his clubs', () => {
    const moved = player('a', 'FWD', 'c2');
    const board = divisionLeaderBoard({
      category: AWARD_CATEGORIES.goals,
      season: 1,
      players: [moved],
      statLines: [line('a', 'c1', 4), line('a', 'c2', 3)],
      limit: 5,
    });
    expect(board).toEqual([{ position: 1, playerId: 'a', playerName: 'A', clubId: 'c2', value: 7 }]);
  });

  it('excludes cup rows', () => {
    const board = divisionLeaderBoard({
      category: AWARD_CATEGORIES.goals,
      season: 1,
      players: [player('a', 'FWD')],
      statLines: [line('a', 'c1', 4), line('a', 'c1', 9, { competition: 'cup' })],
      limit: 5,
    });
    expect(board[0].value).toBe(4);
  });

  it('gives tied players the same position and resumes after the gap', () => {
    const board = divisionLeaderBoard({
      category: AWARD_CATEGORIES.goals,
      season: 1,
      players: [player('a', 'FWD'), player('b', 'FWD'), player('c', 'FWD')],
      statLines: [line('a', 'c1', 9), line('b', 'c1', 9), line('c', 'c1', 4)],
      limit: 5,
    });
    expect(board.map(entry => entry.position)).toEqual([1, 1, 3]);
  });

  it('omits players with a zero value', () => {
    const board = divisionLeaderBoard({
      category: AWARD_CATEGORIES.goals,
      season: 1,
      players: [player('a', 'FWD'), player('b', 'FWD')],
      statLines: [line('a', 'c1', 2), line('b', 'c1', 0)],
      limit: 5,
    });
    expect(board.map(entry => entry.playerId)).toEqual(['a']);
  });

  it('caps a podium at three even when four players tie', () => {
    const players = ['a', 'b', 'c', 'd'].map(id => player(id, 'FWD'));
    const podium = divisionPodium({
      category: AWARD_CATEGORIES.goals,
      season: 1,
      players,
      statLines: players.map(entry => line(entry.id, 'c1', 7)),
    });
    expect(podium).toHaveLength(3);
    expect(podium.map(entry => entry.playerId)).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/game/__tests__/division-leaders.test.ts`
Expected: FAIL — `Cannot find module '../division-leaders'`.

- [ ] **Step 3: Add the shared types**

In `src/game/types.ts`:

```ts
export type AwardCategoryId = 'goals' | 'assists' | 'tacklesWon' | 'saves';

/** One placing, denormalised so it survives the rival roster being regenerated. */
export interface DivisionAwardPlacement {
  playerId: string;
  playerName: string;
  clubId: string;
  value: number;
}
```

- [ ] **Step 4: Write the implementation**

Create `src/game/division-leaders.ts`:

```ts
import type {
  AwardCategoryId,
  CareerPlayer,
  DivisionAwardPlacement,
  PlayerSeasonStatLine,
  Role,
} from './types';

export interface AwardCategory {
  readonly id: AwardCategoryId;
  readonly role: Role;
  readonly boardLabel: string;
  readonly metricLabel: string;
}

/** One award per position line, so every player type has something to chase. */
export const AWARD_CATEGORIES: Readonly<Record<AwardCategoryId, AwardCategory>> = Object.freeze({
  goals: { id: 'goals', role: 'FWD', boardLabel: 'Strikers', metricLabel: 'Goals' },
  assists: { id: 'assists', role: 'MID', boardLabel: 'Midfielders', metricLabel: 'Assists' },
  tacklesWon: { id: 'tacklesWon', role: 'DEF', boardLabel: 'Defenders', metricLabel: 'Tackles won' },
  saves: { id: 'saves', role: 'GK', boardLabel: 'Keepers', metricLabel: 'Saves' },
});

export const PODIUM_SIZE = 3;

export interface DivisionLeaderQuery {
  readonly category: AwardCategory;
  readonly season: number;
  readonly players: readonly CareerPlayer[];
  readonly statLines: readonly PlayerSeasonStatLine[];
  readonly limit: number;
}

export interface DivisionLeaderEntry extends DivisionAwardPlacement {
  readonly position: number;
}

/**
 * The ranked board for one category.
 *
 * League rows only — a division board that counted cup goals would include
 * goals scored against clubs from other divisions. Rows are summed across
 * clubs so a player who transferred inside the division appears once with his
 * real total rather than twice with two partial ones.
 */
export function divisionLeaderBoard(query: DivisionLeaderQuery): DivisionLeaderEntry[] {
  const eligible = new Map(
    query.players
      .filter(player => player.role === query.category.role)
      .map(player => [player.id, player]),
  );

  const totals = new Map<string, number>();
  for (const line of query.statLines) {
    if (line.season !== query.season || line.competition !== 'league') continue;
    if (!eligible.has(line.playerId)) continue;
    totals.set(line.playerId, (totals.get(line.playerId) ?? 0) + line[query.category.id]);
  }

  const ranked = [...totals.entries()]
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, query.limit);

  const entries: DivisionLeaderEntry[] = [];
  ranked.forEach(([playerId, value], index) => {
    const previous = entries[index - 1];
    const player = eligible.get(playerId)!;
    entries.push({
      // Equal values share a position, and the next distinct value resumes at
      // the natural rank — two players on 11 are both 2nd, the next is 4th.
      position: previous !== undefined && previous.value === value ? previous.position : index + 1,
      playerId,
      playerName: player.name,
      clubId: player.clubId,
      value,
    });
  });
  return entries;
}

/**
 * The top three, denormalised for the season snapshot.
 *
 * Hard-capped at three. The board's shared-rank rule says what a tie looks
 * like but not what to do when four players tie for third; a ceremony that
 * revealed a fourth third place would be worse than a stable arbitrary cut.
 */
export function divisionPodium(
  query: Omit<DivisionLeaderQuery, 'limit'>,
): DivisionAwardPlacement[] {
  return divisionLeaderBoard({ ...query, limit: PODIUM_SIZE })
    .map(({ playerId, playerName, clubId, value }) => ({ playerId, playerName, clubId, value }));
}
```

- [ ] **Step 5: Run the tests**

Run: `npx jest src/game/__tests__/division-leaders.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/game/division-leaders.ts src/game/types.ts src/game/__tests__/division-leaders.test.ts
git commit -m "feat(game): rank division leaders by position with transfer aggregation"
```

---

## Task 8: Snapshot podiums, then prune

**Files:**
- Modify: `src/game/types.ts` (`SeasonRecap`)
- Modify: `src/game/season-recap.ts`
- Modify: `src/persistence/game-state-codec.ts` (recap schema, line 696 area)
- Test: `src/game/__tests__/division-award-snapshot.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/__tests__/division-award-snapshot.test.ts`:

```ts
import { buildSeasonRecap, prunedStatLines } from '../season-recap';
import type { CareerPlayer, GameState, PlayerSeasonStatLine } from '../types';

function line(playerId: string, clubId: string, over: Partial<PlayerSeasonStatLine> = {}): PlayerSeasonStatLine {
  return {
    season: 1, playerId, clubId, competition: 'league',
    goals: 0, assists: 0, tacklesWon: 0, saves: 0, ...over,
  };
}

describe('season stat line pruning', () => {
  const active = { id: 'active', clubId: 'c1' } as CareerPlayer;
  const retired = { id: 'retired', clubId: 'c1' } as CareerPlayer;

  it('keeps rows for active players', () => {
    const state = { players: [active], retiredPlayers: [], seasonStatLines: [line('active', 'c1')] } as unknown as GameState;
    expect(prunedStatLines(state).map(row => row.playerId)).toEqual(['active']);
  });

  it('keeps rows for retired players', () => {
    const state = { players: [], retiredPlayers: [retired], seasonStatLines: [line('retired', 'c1')] } as unknown as GameState;
    expect(prunedStatLines(state).map(row => row.playerId)).toEqual(['retired']);
  });

  it('drops rows for players who exist nowhere', () => {
    const state = { players: [active], retiredPlayers: [], seasonStatLines: [line('active', 'c1'), line('gone', 'c9')] } as unknown as GameState;
    expect(prunedStatLines(state).map(row => row.playerId)).toEqual(['active']);
  });
});
```

Append to the same file a recap assertion:

```ts
import { createCareer, activeCareerMatchday, completeMatchday } from '../career';
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import { buildCareerMatchTeams } from '../index';
import { resolveMatchday } from '../matchday';

describe('division award snapshot', () => {
  it('stamps a podium carrying names, clubs and numeric values', () => {
    const content = loadLaunchContent();
    let state = createCareer(createLaunchCareerSetup(4_000_000, undefined, content));
    const matchday = activeCareerMatchday(state)!;
    const clubIds = [...new Set(matchday.fixtures.flatMap(f => [f.homeClubId, f.awayClubId]))];
    state = completeMatchday(state, resolveMatchday(matchday.fixtures, buildCareerMatchTeams(state, clubIds)));

    const recap = buildSeasonRecap(state);
    expect(recap.divisionAwards).toBeDefined();
    for (const placings of Object.values(recap.divisionAwards!)) {
      expect(placings.length).toBeLessThanOrEqual(3);
      for (const placing of placings) {
        expect(placing.playerName.length).toBeGreaterThan(0);
        expect(placing.clubId.length).toBeGreaterThan(0);
        expect(typeof placing.value).toBe('number');
      }
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/game/__tests__/division-award-snapshot.test.ts`
Expected: FAIL — `prunedStatLines` is not exported and `divisionAwards` does not exist.

- [ ] **Step 3: Widen `SeasonRecap`**

In `src/game/types.ts`, add to `SeasonRecap`:

```ts
  /**
   * Top three per category, denormalised at the season transition.
   *
   * The bridge to the awards ceremony. Raw stat rows for rivals are pruned
   * once a division change regenerates their clubs, so anything the ceremony
   * needs must be captured here while the players still exist.
   */
  divisionAwards?: Record<AwardCategoryId, DivisionAwardPlacement[]>;
```

- [ ] **Step 4: Build and prune**

In `src/game/season-recap.ts`, add:

```ts
import { AWARD_CATEGORIES, divisionPodium } from './division-leaders';
import type { AwardCategoryId, DivisionAwardPlacement } from './types';

function divisionAwards(state: GameState): Record<AwardCategoryId, DivisionAwardPlacement[]> {
  const query = {
    season: state.season,
    players: state.players,
    statLines: state.seasonStatLines ?? [],
  };
  return {
    goals: divisionPodium({ ...query, category: AWARD_CATEGORIES.goals }),
    assists: divisionPodium({ ...query, category: AWARD_CATEGORIES.assists }),
    tacklesWon: divisionPodium({ ...query, category: AWARD_CATEGORIES.tacklesWon }),
    saves: divisionPodium({ ...query, category: AWARD_CATEGORIES.saves }),
  };
}

/**
 * Stat rows worth keeping after a season transition.
 *
 * Retired players are spared explicitly. They leave `state.players` at the
 * transition, so a rule keyed on that array alone would delete the career
 * record of the club's own retired heroes.
 */
export function prunedStatLines(state: GameState): PlayerSeasonStatLine[] {
  const known = new Set([
    ...state.players.map(player => player.id),
    ...(state.retiredPlayers ?? []).map(player => player.id),
  ]);
  return (state.seasonStatLines ?? []).filter(line => known.has(line.playerId));
}
```

Add `divisionAwards: divisionAwards(state),` to the object returned by `buildSeasonRecap`.

Call `prunedStatLines` **after the new season's roster has been rebuilt**, in
`startNextFullCareerSeason` — not in the recap branch.

Ordering matters twice over:

- The recap must be built **before** any prune, or the podium is computed from
  rows that have already been deleted.
- The prune must run **after** `generatedActiveDivision` replaces the rival
  roster on a promotion or relegation. Pruning in the recap branch runs while
  the old division's players are still present, so their rows survive a further
  full season and are only collected at the *next* transition. Boards stay
  correct either way — they filter by live `players` — but the save carries a
  season of dead rows for no reason.

- [ ] **Step 5: Extend the codec**

In `src/persistence/game-state-codec.ts`, beside `seasonRecapAwardSchema` (line 696):

```ts
const divisionAwardPlacementSchema = z.object({
  playerId: nonemptyString,
  playerName: nonemptyString,
  clubId: nonemptyString,
  value: nonnegativeInteger,
}).passthrough();

const divisionAwardsSchema = z.object({
  goals: z.array(divisionAwardPlacementSchema).max(3),
  assists: z.array(divisionAwardPlacementSchema).max(3),
  tacklesWon: z.array(divisionAwardPlacementSchema).max(3),
  saves: z.array(divisionAwardPlacementSchema).max(3),
});
```

Add `divisionAwards: divisionAwardsSchema.optional(),` to the season recap schema.

- [ ] **Step 6: Run the tests**

Run: `npx jest src/game/__tests__/division-award-snapshot.test.ts && npx tsc --noEmit`
Expected: PASS, 4 tests; no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/game src/persistence
git commit -m "feat(game): snapshot division award podiums before pruning stat lines"
```

---

## Task 9: Leaders view model

**Files:**
- Create: `src/application/division-leaders-view-model.ts`
- Modify: `src/ui/m2-league-models.ts`
- Modify: `src/application/m2-league-view-model.ts:25-36`, `:70-86`
- Test: `src/application/__tests__/division-leaders-view-model.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/application/__tests__/division-leaders-view-model.test.ts`:

```ts
import { divisionLeadersViewModel } from '../division-leaders-view-model';
import type { CareerPlayer, PlayerSeasonStatLine } from '../../game/types';

const PLAYERS = [
  { id: 'mine', clubId: 'me', name: 'Gem Arrow', role: 'FWD' },
  { id: 'theirs', clubId: 'them', name: 'Flint Vale', role: 'FWD' },
] as CareerPlayer[];

const LINES: PlayerSeasonStatLine[] = [
  { season: 1, playerId: 'mine', clubId: 'me', competition: 'league', goals: 6, assists: 0, tacklesWon: 0, saves: 0 },
  { season: 1, playerId: 'theirs', clubId: 'them', competition: 'league', goals: 9, assists: 0, tacklesWon: 0, saves: 0 },
];

describe('division leaders view model', () => {
  const model = divisionLeadersViewModel({
    season: 1,
    players: PLAYERS,
    statLines: LINES,
    userClubId: 'me',
    clubNames: new Map([['me', 'Brambleroad'], ['them', 'Quartz FC']]),
  });

  it('produces one board per category in fixed order', () => {
    expect(model.boards.map(board => board.categoryId))
      .toEqual(['goals', 'assists', 'tacklesWon', 'saves']);
  });

  it('labels boards by position so the filter is honest', () => {
    expect(model.boards[0].boardLabel).toBe('Strikers');
    expect(model.boards[0].metricLabel).toBe('Goals');
  });

  it('resolves club names and flags the user players', () => {
    const [leader, second] = model.boards[0].entries;
    expect(leader).toMatchObject({ playerName: 'Flint Vale', clubName: 'Quartz FC', isUserPlayer: false, value: 9 });
    expect(second).toMatchObject({ playerName: 'Gem Arrow', clubName: 'Brambleroad', isUserPlayer: true, value: 6 });
  });

  it('renders an empty board without throwing', () => {
    const empty = divisionLeadersViewModel({
      season: 1, players: PLAYERS, statLines: [], userClubId: 'me',
      clubNames: new Map([['me', 'Brambleroad']]),
    });
    expect(empty.boards.every(board => board.entries.length === 0)).toBe(true);
    expect(empty.boards[0].emptyLabel.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/application/__tests__/division-leaders-view-model.test.ts`
Expected: FAIL — `Cannot find module '../division-leaders-view-model'`.

- [ ] **Step 3: Add the view model types**

In `src/ui/m2-league-models.ts`:

```ts
export type M2LeagueSubTab = 'league' | 'cup' | 'leaders';

export interface M2LeaderEntryViewModel {
  readonly position: number;
  readonly playerId: string;
  readonly playerName: string;
  readonly clubName: string;
  readonly value: number;
  readonly isUserPlayer: boolean;
}

export interface M2LeaderBoardViewModel {
  readonly categoryId: 'goals' | 'assists' | 'tacklesWon' | 'saves';
  readonly boardLabel: string;
  readonly metricLabel: string;
  readonly emptyLabel: string;
  readonly entries: readonly M2LeaderEntryViewModel[];
}

export interface M2DivisionLeadersViewModel {
  readonly boards: readonly M2LeaderBoardViewModel[];
}
```

Add to `M2LeagueViewModel`:

```ts
  readonly availableTabs: readonly M2LeagueSubTab[];
  readonly leaders: M2DivisionLeadersViewModel;
```

- [ ] **Step 4: Write the builder**

Create `src/application/division-leaders-view-model.ts`:

```ts
import { AWARD_CATEGORIES, divisionLeaderBoard } from '../game/division-leaders';
import type { AwardCategoryId, CareerPlayer, PlayerSeasonStatLine } from '../game/types';
import type {
  M2DivisionLeadersViewModel,
  M2LeaderBoardViewModel,
} from '../ui/m2-league-models';

/**
 * Board order, deliberately the reverse of the ceremony's.
 *
 * The board is scanned, so the most-read category leads. The ceremony is
 * watched, so it builds to goals last. They are different jobs and the two
 * orders should not be unified.
 */
const ORDER: readonly AwardCategoryId[] = ['goals', 'assists', 'tacklesWon', 'saves'];

const BOARD_LIMIT = 5;

export interface DivisionLeadersViewModelSource {
  readonly season: number;
  readonly players: readonly CareerPlayer[];
  readonly statLines: readonly PlayerSeasonStatLine[];
  readonly userClubId: string;
  readonly clubNames: ReadonlyMap<string, string>;
}

export function divisionLeadersViewModel(
  source: DivisionLeadersViewModelSource,
): M2DivisionLeadersViewModel {
  const boards: M2LeaderBoardViewModel[] = ORDER.map(categoryId => {
    const category = AWARD_CATEGORIES[categoryId];
    const entries = divisionLeaderBoard({
      category,
      season: source.season,
      players: source.players,
      statLines: source.statLines,
      limit: BOARD_LIMIT,
    }).map(entry => ({
      position: entry.position,
      playerId: entry.playerId,
      playerName: entry.playerName,
      clubName: source.clubNames.get(entry.clubId) ?? entry.clubId,
      value: entry.value,
      isUserPlayer: entry.clubId === source.userClubId,
    }));
    return {
      categoryId,
      boardLabel: category.boardLabel,
      metricLabel: category.metricLabel,
      emptyLabel: `No ${category.metricLabel.toLowerCase()} yet this season.`,
      entries,
    };
  });
  return { boards };
}
```

- [ ] **Step 5: Wire it into the league view model**

In `src/application/m2-league-view-model.ts`, add to `M2LeagueViewModelSource`:

```ts
  readonly players?: readonly CareerPlayer[];
  readonly statLines?: readonly PlayerSeasonStatLine[];
```

Add to the returned object in `m2LeagueViewModel`:

```ts
    availableTabs: availableSubTabs(source),
    leaders: divisionLeadersViewModel({
      season: source.season,
      players: source.players ?? [],
      statLines: source.statLines ?? [],
      userClubId: source.career.userClubId,
      clubNames,
    }),
```

And the derivation, in the same file:

```ts
/**
 * Both unlocks are derived, never persisted — there is no stored flag that can
 * drift out of sync with the thing it describes.
 */
const LEADERS_UNLOCK_WEEKS_AFTER_FIRST_CUP = 3;

function availableSubTabs(source: M2LeagueViewModelSource): M2LeagueSubTab[] {
  const tabs: M2LeagueSubTab[] = ['league'];
  const cups = source.career.nationalCups;
  if (cups.length === 0) return tabs;
  tabs.push('cup');

  const firstCupWeek = Math.min(...cups.flatMap(cup =>
    cup.rounds.flatMap(round => round.fixtures.map(fixture => fixture.week)),
  ));
  const week = source.week ?? 0;
  if (Number.isFinite(firstCupWeek)
    && week >= firstCupWeek + LEADERS_UNLOCK_WEEKS_AFTER_FIRST_CUP) {
    tabs.push('leaders');
  }
  return tabs;
}
```

If `NationalCupFixture` has no `week`, use the cup's own scheduling field — check `src/game/pyramid.ts` and adapt, keeping the same "first cup match + 3" rule.

- [ ] **Step 6: Pass the data through at the call site**

Find where `m2LeagueViewModel` is called in `src/application/view-models.ts` and add `players: state.players` and `statLines: state.seasonStatLines ?? []` to the source object.

- [ ] **Step 7: Run the tests**

Run: `npx jest src/application && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/application src/ui/m2-league-models.ts
git commit -m "feat(app): build division leader boards and derive League sub-tabs"
```

---

## Task 10: League sub-tabs and the leaders board UI

**Files:**
- Create: `src/ui/components/DivisionLeaderBoard.tsx`
- Modify: `src/ui/screens/M2LeagueScreen.tsx`
- Test: `src/ui/__tests__/division-leader-board.test.ts`

- [ ] **Step 1: Write the failing test**

`jest.config.js` uses `testEnvironment: 'node'` with no DOM, so this tests the pure presentation helper rather than rendering.

Create `src/ui/__tests__/division-leader-board.test.ts`:

```ts
import { leaderRowLabel, subTabLabel, visibleSubTabs } from '../components/DivisionLeaderBoard';

describe('leader board presentation', () => {
  it('reads a row as position, player, club and value', () => {
    expect(leaderRowLabel({
      position: 2, playerId: 'p', playerName: 'Gem Arrow',
      clubName: 'Quartz FC', value: 9, isUserPlayer: true,
    }, 'Goals')).toBe('2. Gem Arrow, Quartz FC, 9 goals. Your player.');
  });

  it('omits the ownership suffix for rivals', () => {
    expect(leaderRowLabel({
      position: 1, playerId: 'p', playerName: 'Flint Vale',
      clubName: 'Quartz FC', value: 12, isUserPlayer: false,
    }, 'Saves')).toBe('1. Flint Vale, Quartz FC, 12 saves.');
  });

  it('hides the tab strip until a second tab unlocks', () => {
    expect(visibleSubTabs(['league'])).toEqual([]);
    expect(visibleSubTabs(['league', 'cup'])).toEqual(['league', 'cup']);
  });

  it('labels tabs', () => {
    expect(subTabLabel('leaders')).toBe('LEADERS');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/ui/__tests__/division-leader-board.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component and its helpers**

Create `src/ui/components/DivisionLeaderBoard.tsx`:

```tsx
import { Text, View } from 'react-native';
import type {
  M2LeaderBoardViewModel,
  M2LeaderEntryViewModel,
  M2LeagueSubTab,
} from '../m2-league-models';
import { PaperPanel, SectionLabel } from './Scorecard';
import { PixelText } from './PixelText';

/** The strip stays hidden while there is nothing to switch between. */
export function visibleSubTabs(available: readonly M2LeagueSubTab[]): M2LeagueSubTab[] {
  return available.length < 2 ? [] : [...available];
}

export function subTabLabel(tab: M2LeagueSubTab): string {
  return tab === 'league' ? 'LEAGUE' : tab === 'cup' ? 'CUP' : 'LEADERS';
}

export function leaderRowLabel(entry: M2LeaderEntryViewModel, metricLabel: string): string {
  const suffix = entry.isUserPlayer ? ' Your player.' : '';
  return `${entry.position}. ${entry.playerName}, ${entry.clubName}, `
    + `${entry.value} ${metricLabel.toLowerCase()}.${suffix}`;
}

export function DivisionLeaderBoard({ board }: { board: M2LeaderBoardViewModel }) {
  return (
    <View className="mt-4">
      <SectionLabel eyebrow={board.boardLabel} title={board.metricLabel} />
      <PaperPanel kicker={board.boardLabel} title={board.metricLabel}>
        {board.entries.length === 0 ? (
          <Text className="text-sm text-ink/60">{board.emptyLabel}</Text>
        ) : board.entries.map(entry => (
          <View
            key={entry.playerId}
            accessible
            accessibilityLabel={leaderRowLabel(entry, board.metricLabel)}
            className={entry.isUserPlayer
              ? 'mt-1 flex-row items-center border-2 border-blue-dark bg-blue-light px-2 py-2'
              : 'mt-1 flex-row items-center border-2 border-ink/40 bg-white px-2 py-2'}
          >
            <PixelText className="w-8 text-sm uppercase text-ink">{entry.position}</PixelText>
            <Text className="flex-1 text-sm text-ink">{entry.playerName}</Text>
            <Text className="mr-3 text-xs text-ink/60">{entry.clubName}</Text>
            <Text className="font-mono text-sm text-ink">{entry.value}</Text>
          </View>
        ))}
      </PaperPanel>
    </View>
  );
}
```

- [ ] **Step 4: Add the tab shell to the League screen**

In `src/ui/screens/M2LeagueScreen.tsx`:

1. Add `activeSubTab: M2LeagueSubTab` and `onSelectSubTab: (tab: M2LeagueSubTab) => void` to `M2LeagueScreenProps`. Hold `activeSubTab` as local state in the screen, defaulting to `'league'`; the guide overrides it via `guideSubTab` (Task 11).
2. Render `visibleSubTabs(viewModel.availableTabs)` as a row of `Pressable` tabs above the content, each `accessibilityRole="tab"` with `accessibilityState={{ selected }}`.
3. Move the existing cup section out of `allSections` so it renders only when `activeSubTab === 'cup'`.
4. Render `viewModel.leaders.boards.map(board => <DivisionLeaderBoard key={board.categoryId} board={board} />)` when `activeSubTab === 'leaders'`.
5. Keep the ladder, standings and fixtures sections under `activeSubTab === 'league'`.

**On `Pressable` styles.** Function-form `style` has caused iOS-only zero-height
layout failures in this codebase, and the existing pressables in this very file
use it — they get away with it because they carry an explicit `min-h-14`. Give
the new tab controls an explicit minimum height. If you use function form, do
not let height depend on it.

- [ ] **Step 5: Migrate the cup guide beat and its test**

The `national-cup` beat sets `destination: "league-cup"` and `focus:
"national-cup"`, and the screen currently *scrolls* to the cup section via
`guideNationalCup` (line 46). Replace that: when the guide targets the cup,
select the `'cup'` sub-tab. Delete the now-dead `cupYRef` scroll logic and the
`allSections` cup reordering.

**`src/ui/__tests__/desktop-content-width.test.ts` will fail, and it is not a
normal test.** It asserts against the *source text* of `M2LeagueScreen.tsx`:

```
expect(league).toContain("allSections.filter(section => section.key === 'cup')");
expect(league).toContain('const sections = guideNationalCup');
expect(league).toContain("if (guideNationalCup && layoutMode === 'single')");
```

Every one of those strings is deleted by this task. Rewrite that block to assert
the new guarantee — that a guide targeting the cup selects the cup sub-tab —
rather than deleting the test. Its intent (the cup is what you see when the
inbox sends you there) still holds; only the mechanism changed.

- [ ] **Step 6: Run the tests and the type gate**

Run: `npx jest src/ui && npx tsc --noEmit`
Expected: PASS; no type errors. A failure in `desktop-content-width.test.ts`
means step 5 was only half done.

- [ ] **Step 7: Commit**

```bash
git add src/ui
git commit -m "feat(ui): split the League screen into LEAGUE, CUP and LEADERS tabs"
```

---

## Task 11: Bert's division-leaders beat

**Files:**
- Modify: `content/assistant-guide.json`
- Modify: `src/game/assistant-guide.ts:18` (beat id ordering)
- Test: `src/ui/__tests__/bert-briefing-beats.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Add to `src/ui/__tests__/bert-briefing-beats.test.ts`:

```ts
it('includes a division-leaders beat pointing at the leaders tab', () => {
  const beat = loadLaunchContent().assistantGuide.beats
    .find(entry => entry.id === 'division-leaders');
  expect(beat).toBeDefined();
  expect(beat!.destination).toBe('league-leaders');
  expect(beat!.pages.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/ui/__tests__/bert-briefing-beats.test.ts`
Expected: FAIL — beat is undefined.

- [ ] **Step 3: Add the content**

In `content/assistant-guide.json`, immediately after the `national-cup` entry:

```json
    {
      "id": "division-leaders",
      "inbox": {
        "title": "Who leads your division",
        "detail": "Four awards, one for each position. Win one and the board pays for it."
      },
      "destination": "league-leaders",
      "pages": [
        {
          "kicker": "The race within the race",
          "title": "Division Leaders",
          "body": [
            "Every club in your division is tracked. Goals for strikers, assists for midfielders, tackles for defenders, saves for keepers — one award each, so everyone in your squad has something to chase."
          ],
          "focus": "division-leaders",
          "objective": "SEE WHERE YOUR PLAYERS RANK.",
          "buttonLabel": "Show me the boards."
        },
        {
          "kicker": "Season's end",
          "title": "Worth winning",
          "body": [
            "Whoever tops a category at the end of the season is presented with it. Win one and the board rewards the club with Training Points for next season."
          ],
          "focus": "division-leaders",
          "buttonLabel": "We'll take all four."
        }
      ]
    },
```

Add `'division-leaders'` to the ordered beat id list in `src/game/assistant-guide.ts:18`, immediately after `'national-cup'`.

- [ ] **Step 4: Extend the content schemas**

The beat will not validate without both of these. In `src/content/schemas.ts`:

1. Add `'league-leaders'` to `AssistantGuideDestinationSchema` (the union that
   currently ends at `'league-cup'`, line 230).
2. Add `'division-leaders'` to `AssistantGuideFocusSchema` (used at line 240).

- [ ] **Step 5: Route the destination in App.tsx**

`openAssistantGuide` (`App.tsx:1098`) maps guide destinations to tabs and has a
`destination === 'league-cup'` branch at line 1131 with nothing for leaders.
Add a `'league-leaders'` branch that selects the `league` tab **and** sets the
League sub-tab to `'leaders'`, mirroring however the cup branch is wired after
Task 10.

Both destinations now need a sub-tab, so `M2LeagueScreen` should receive the
guide's target sub-tab rather than a pair of booleans — replace the
`guideNationalCup` prop with `guideSubTab?: M2LeagueSubTab`.

- [ ] **Step 6: Run the tests**

Run: `npx jest src/ui/__tests__/bert-briefing-beats.test.ts src/content && npx tsc --noEmit`
Expected: PASS; no type errors. A zod rejection here means step 4 was skipped.

- [ ] **Step 7: Commit**

```bash
git add content/assistant-guide.json src/game/assistant-guide.ts src/content/schemas.ts App.tsx src/ui
git commit -m "feat(content): add Bert's division-leaders briefing beat and route it"
```

---

## Task 12: CI assist yield rail

**Files:**
- Create: `src/game/__tests__/assist-yield-rail.test.ts`
- Modify: `src/audit/__tests__/stat-yield-probe.test.ts` (keep, document the split)

This guard cannot live in `MINI_BALANCE_RAILS`: that harness never runs the sim — `scoreFixture` (`src/game/balance.ts:242`) fabricates scorelines from a `mulberry32` goal roll, so it produces no events and has nothing to measure. It also cannot be the probe, which is opt-in and therefore silent by definition.

- [ ] **Step 1: Write the rail**

Create `src/game/__tests__/assist-yield-rail.test.ts`:

```ts
import { runMatch } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';

/**
 * Measured band from the design probe (2.05-2.80 assists per match across D5,
 * D3 and D1). The rail is deliberately wider than the measurement so ordinary
 * balance work does not trip it, but narrow enough to catch the midfielder
 * board silently emptying.
 */
const MINIMUM_ASSISTS_PER_MATCH = 1.4;
const MAXIMUM_ASSISTS_PER_MATCH = 3.6;
const SEEDS = 20;

describe('assist yield rail', () => {
  it('keeps assists inside the band the leaders board was designed against', () => {
    let assists = 0;
    let goals = 0;
    for (let index = 0; index < SEEDS; index += 1) {
      const result = runMatch(900_000 + index * 7919, ROVERS, UNITED, [], {
        homePolicy: 'FIRE_WHEN_READY', awayPolicy: 'FIRE_WHEN_READY',
      });
      for (const event of result.events) {
        if (event.kind !== 'GOAL') continue;
        goals += 1;
        if (event.assistedById !== undefined) assists += 1;
      }
    }
    const perMatch = assists / SEEDS;
    expect(goals).toBeGreaterThan(0);
    expect(perMatch).toBeGreaterThanOrEqual(MINIMUM_ASSISTS_PER_MATCH);
    expect(perMatch).toBeLessThanOrEqual(MAXIMUM_ASSISTS_PER_MATCH);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx jest src/game/__tests__/assist-yield-rail.test.ts`
Expected: PASS in a few seconds. If it fails low, the assist-clearing rules in Task 1 are too aggressive — diagnose with the probe, do not widen the band.

- [ ] **Step 3: Run the full suite and the type gate**

Run: `npx tsc --noEmit && npx jest`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/game/__tests__/assist-yield-rail.test.ts src/audit/__tests__/stat-yield-probe.test.ts
git commit -m "test(game): guard assist yield in CI so the midfielder board cannot empty silently"
```

---

## Self-Review

**Spec coverage.** Section 1 (engine assists) → Tasks 1-2. Section 2 (`contributionsFrom`, tackle style filter, saves, `scorerPlayerIds` cross-check) → Tasks 3-4, **4b**. Section 3 (stat line, `clubId`, competition) → Task 5. Section 4 (recording) → Task 6. Section 5 (ranking, role filter, ties, transfers, podium cut) → Task 7. Section 6 (snapshot before prune, retirees spared) → Task 8. Section 7 (sub-tabs, derived unlocks, guide beat migration) → Tasks 9-10. Section 8 (Bert) → Task 11. Section 9 (testing, CI rail) → Tasks 1-12.

**The two failure modes this plan is shaped to avoid.**

1. **Recording only on the path tests exercise.** `resolveMatchday` folds
   fixtures it simulates; it passes *supplied* results through untouched. The
   player's own watched match arrives as a supplied result built by hand in
   `store.ts`. Task 4b exists solely because every headless test in Tasks 4 and
   6 would pass while the user's own leaderboards stayed empty.
2. **A slot outliving its occupant.** Task 1 stores a stable id rather than a
   slot for exactly the reason the *event* does. Decoy slot 22 can name an
   entity that no longer exists, and `state.players` has no index 22.

**Known soft spots for the implementer.**

- Task 9 Step 5 assumes `NationalCupFixture` carries `week`. It does — verify
  the field name against `src/game/pyramid.ts` before writing the expression.
- Task 10 is the only task without executable assertions on the rendered
  output — Jest here is `testEnvironment: 'node'` with no DOM, so components
  cannot be rendered. The pure helpers are tested; the visual result needs a
  preview check.
- Tasks 10 and 11 must land together or the cup guide breaks in between: the
  screen stops scrolling to the cup before `App.tsx` learns to select the tab.
  Consider a single commit across both.
- `src/ui/__tests__/desktop-content-width.test.ts` asserts on the *source text*
  of `M2LeagueScreen.tsx`. Task 10 deletes the exact strings it matches. It must
  be rewritten, not deleted.

**Type consistency.** `PlayerSeasonStatLine`, `PlayerMatchContribution`, `DivisionAwardPlacement`, `AwardCategoryId`, `AwardCompetition`, `AwardCategory`, `DivisionLeaderEntry`, `M2LeagueSubTab`, `M2LeaderEntryViewModel`, `M2LeaderBoardViewModel`, `M2DivisionLeadersViewModel` are each defined once and referenced with the same names and fields throughout. `contributionsFrom`, `divisionLeaderBoard`, `divisionPodium`, `prunedStatLines`, `divisionLeadersViewModel`, `availableSubTabs`, `visibleSubTabs`, `subTabLabel`, `leaderRowLabel`, `observePossession` likewise. `MatchState` carries `ballHolderId`, `ballHolderTeam` and `assistCandidateId` — there is no `ballHolderSlot`.

