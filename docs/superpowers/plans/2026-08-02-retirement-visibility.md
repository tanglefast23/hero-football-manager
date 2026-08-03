# Retirement Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a player's approaching retirement on the squad card and in the inbox one season before it is announced, and cap contract offers so a deal can never outlive the man who signed it.

**Architecture:** One new pure module, `src/game/retirement.ts`, derives every number from `(careerSeed, playerId, age)` — no stored state, no save migration, following the `src/game/loyalty.ts` precedent. View models read it to build capped term lists and card labels; the two market completion functions read it as an engine backstop. Retirement timing itself is untouched.

**Tech Stack:** TypeScript, Jest (`testEnvironment: 'node'` — no DOM, no `react-native`), React Native / NativeWind for the two screens.

**Spec:** `docs/superpowers/specs/2026-08-02-retirement-visibility-design.md`

---

## Outcome — implemented 2026-08-02, full suite green (2393 passed, 0 failed)

An external audit reviewed this plan before execution and found five real
defects. All were accepted and fixed; the tasks below are recorded as written,
with the deltas here.

**1. A third unguarded write path (the audit's highest finding, and correct).**
The plan guarded only the two market completion functions. `renewCareerPlayer`
in `src/game/squad.ts` also writes `contractSeasonsRemaining`, and
`src/application/store.ts:1455` renews through *it*, not through the negotiated
market flow — so the shipped renewal button was the one path left open. The
guard now sits in all three. It could not go in `renewContract`
(`src/game/progression.ts`) as the audit first suggested: that function is pure
and holds neither the squad nor the career seed.

**2. Announced players were capped wrong.** The planned
`max(1, seasonsBefore) + 1` gave an announced player a 2-season signing cap,
which outlives them. Renewal is now refused outright (cap 0) and signing is
capped at 1. The redundant outer `max(1, ...)` was dropped from both helpers.

**3. A latent bug in the headless harness, surfaced by the guard.** Seven
balance-rail tests failed on `Nora Vale has announced their retirement and
cannot re-sign`. `src/game/headless.ts` renewed *every* expired player,
including announced ones — work the shipped game never does, because both
`startNextSeason` and `seasonEndViewModel` exempt them via
`willRetireAtSeasonTransition`. The harness (and the equivalent loop in
`active-manager-balance.test.ts`) now applies the same filter. This was a real
defect in the harness, not a test that needed relaxing.

**4. The market ship path was missed.** The plan looked for the signing call in
`view-models.ts`; it is actually built in
`src/application/market-source-adapter.ts`. `maxTermSeasons` is optional on
`NegotiationViewSource`, defaulting to 3, so existing callers keep working.

**5. Fixtures were pointed at the wrong files and hardcoded a lucky age.**
`squadTrainingViewModel` takes **three** arguments, not five, and the home view
model is `homeViewModel(state)` — one argument. Tests now derive the veteran's
age from `seasonsBeforeRetirement` instead of assuming 36, which for a
Professional can be two seasons out and would have made the label assertions
pass or fail on an id hash. Inbox tests build on the `deskClearCareer` pattern
from `desk-story-inbox.test.ts`, or the alert is evicted by a full desk.

**Also changed beyond the plan:** the property test now runs a real contract
alongside the real lifecycle and asserts zero seasons owed at retirement, rather
than comparing one formula against another.

**Not verified in a browser.** All three UI surfaces need an aged player to
appear, which a fresh career cannot reach without seeding a save. They are
covered by view-model tests and a clean `tsc --noEmit`, not by a visual pass.

---

## Background an engineer needs before starting

Retirement already works and must not change. In `src/game/pyramid.ts`:

- `retirementAnnouncementAge(player, careerSeed)` returns a stable 33–38 from a
  personality-weighted pool, hashed from `(careerSeed, player.id)`. It is a pure
  function — same inputs, same answer, forever.
- `resolveSeasonEndLifecycle(players, season, careerSeed)` ages everyone by one at
  each season transition. The first transition where the new age reaches the
  retirement age stamps `retirementAnnouncementSeason = season`. The player then
  plays exactly one more season and is moved to `retiredPlayers` at the next
  transition.

Two facts drive the whole plan:

1. **`personality` is optional on `CareerPlayer`.** `src/application/view-models.ts`
   defaults it to `'Professional'`. Every retirement calculation must use one
   shared default, or the UI will display one number while the engine enforces
   another.
2. **Contracts decrement at week 30** (`src/game/career.ts:479`), inside the same
   season. So a term signed in a transfer window also covers the season in
   progress; a term signed at season-end does not. That is why there are two
   term formulas, not one.

Run all tests with `npx jest`. Run one file with `npx jest <path>`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/game/retirement.ts` | **Create.** Every derived retirement number and label. Single source of truth. |
| `src/game/index.ts` | **Modify.** Re-export the new module. |
| `src/game/__tests__/retirement.test.ts` | **Create.** Property test binding the cap to real transitions. |
| `src/game/market-career.ts` | **Modify.** Engine backstop in `completeCareerTransfer` and `completeCareerRenewal`. |
| `src/game/__tests__/retirement-contract-cap.test.ts` | **Create.** Backstop rejection tests. |
| `src/application/view-models.ts` | **Modify.** Renewal `termOptions`, card label, one-shot inbox alert. |
| `src/application/market-view-model.ts` | **Modify.** Signing `termOptions` + explanatory note. |
| `src/ui/models.ts` | **Modify.** New view-model fields. |
| `src/ui/screens/SeasonEndScreen.tsx` | **Modify.** Render the renewal note. |
| `src/ui/screens/MarketScreen.tsx` | **Modify.** Render capped terms + note; clamp the draft. |
| `src/ui/screens/SquadTrainingScreen.tsx` | **Modify.** Render the card label. |
| `src/application/__tests__/retirement-visibility.test.ts` | **Create.** View-model + inbox tests. |

---

## Task 1: The derived retirement module

**Files:**
- Create: `src/game/retirement.ts`
- Modify: `src/game/index.ts`
- Test: `src/game/__tests__/retirement.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/__tests__/retirement.test.ts`:

```ts
import { describe, expect, it } from '@jest/globals';
import { resolveSeasonEndLifecycle, type PyramidPlayer } from '../pyramid';
import {
  maxRenewalTermSeasons,
  maxSigningTermSeasons,
  retirementCardLabel,
  seasonsBeforeRetirement,
} from '../retirement';
import type { PlayerPersonality } from '../types';

const ATTRS = { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50, ref: 50 };
const PERSONALITIES: PlayerPersonality[] = [
  'Fiery', 'Loyal', 'Greedy', 'Joker', 'Professional', 'Timid',
];

function lifecyclePlayer(overrides: Partial<PyramidPlayer> = {}): PyramidPlayer {
  return {
    id: 'player-1',
    clubId: 'club-1',
    name: 'Ari Flint',
    role: 'MID',
    attrs: { ...ATTRS },
    archetype: 'Playmaker',
    personality: 'Professional',
    age: 25,
    fame: 50,
    seasonsAtClub: 2,
    morale: 50,
    condition: 80,
    consecutiveLowMoraleWeeks: 0,
    ...overrides,
  };
}

/**
 * Counts the seasons this player is still on the roster AFTER the next
 * transition, by running the real lifecycle rather than trusting the formula.
 */
function seasonsActuallyPlayed(player: PyramidPlayer, careerSeed: number): number {
  let squad: PyramidPlayer[] = [player];
  let season = 1;
  let played = 0;
  while (squad.length > 0 && played < 30) {
    squad = resolveSeasonEndLifecycle(squad, season, careerSeed).activePlayers;
    season += 1;
    if (squad.length > 0) played += 1;
  }
  return played;
}

describe('seasonsBeforeRetirement', () => {
  it('matches the seasons the lifecycle actually grants, for every personality and veteran age', () => {
    for (const personality of PERSONALITIES) {
      for (let age = 30; age <= 38; age += 1) {
        const player = lifecyclePlayer({ id: `p-${personality}-${age}`, personality, age });
        expect(seasonsBeforeRetirement(player, 456)).toBe(seasonsActuallyPlayed(player, 456));
      }
    }
  });

  it('returns zero once retirement has been announced', () => {
    const player = lifecyclePlayer({ age: 36, retirementAnnouncementSeason: 4 });
    expect(seasonsBeforeRetirement(player, 456)).toBe(0);
  });

  it('grants one final season to a player already past their retirement age', () => {
    const player = lifecyclePlayer({ id: 'overdue', personality: 'Timid', age: 44 });
    expect(seasonsBeforeRetirement(player, 456)).toBe(1);
  });
});

describe('contract term caps', () => {
  it('never lets a renewal outlive the player, for every personality and veteran age', () => {
    for (const personality of PERSONALITIES) {
      for (let age = 30; age <= 38; age += 1) {
        const player = lifecyclePlayer({ id: `r-${personality}-${age}`, personality, age });
        expect(maxRenewalTermSeasons(player, 456))
          .toBeLessThanOrEqual(seasonsActuallyPlayed(player, 456));
      }
    }
  });

  it('lets an in-season signing also cover the season in progress', () => {
    for (const personality of PERSONALITIES) {
      for (let age = 30; age <= 38; age += 1) {
        const player = lifecyclePlayer({ id: `s-${personality}-${age}`, personality, age });
        expect(maxSigningTermSeasons(player, 456))
          .toBe(Math.min(3, maxRenewalTermSeasons(player, 456) + 1));
      }
    }
  });

  it('never caps a player who is too young for it to bite', () => {
    for (const personality of PERSONALITIES) {
      const player = lifecyclePlayer({ id: `y-${personality}`, personality, age: 30 });
      expect(maxRenewalTermSeasons(player, 456)).toBe(3);
    }
  });

  it('always allows at least one season', () => {
    const player = lifecyclePlayer({ id: 'ancient', age: 44 });
    expect(maxRenewalTermSeasons(player, 456)).toBe(1);
    expect(maxSigningTermSeasons(player, 456)).toBe(2);
  });
});

describe('retirementCardLabel', () => {
  it('says nothing while retirement is more than one season away', () => {
    const player = lifecyclePlayer({ id: 'far', personality: 'Professional', age: 30 });
    expect(retirementCardLabel(player, 456)).toBeUndefined();
  });

  it('warns exactly one season before the announcement', () => {
    const player = lifecyclePlayer({ id: 'soon', personality: 'Professional', age: 30 });
    const oneOut = { ...player, age: 30 + seasonsBeforeRetirement(player, 456) - 1 };
    expect(retirementCardLabel(oneOut, 456)).toBe('Considering retirement in 1 year');
  });

  it('marks the final season once announced', () => {
    const player = lifecyclePlayer({ age: 36, retirementAnnouncementSeason: 4 });
    expect(retirementCardLabel(player, 456)).toBe('Final season — retires in summer');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/game/__tests__/retirement.test.ts`
Expected: FAIL — `Cannot find module '../retirement'`.

- [ ] **Step 3: Write the module**

Create `src/game/retirement.ts`:

```ts
import { retirementAnnouncementAge } from './pyramid';
import type { CareerPlayer, PlayerPersonality } from './types';

/**
 * How much of a career is left, and who is allowed to know.
 *
 * Every number here is DERIVED from the career seed and the player's stable id
 * rather than stored, for the same reason loyalty is: players are built in six
 * separate modules, and a field initialised in five of them is a bug waiting for
 * the sixth. Deriving it means every player in every save — including saves
 * written before this feature — has an answer from the moment they exist.
 *
 * This module is the single source of truth. `personality` is optional on
 * `CareerPlayer` and the squad view model defaults it to 'Professional'; a
 * second call site choosing a different default would display one number while
 * the engine enforced another.
 */

/** Longest contract the game offers, from `validateContractOffer` in market.ts. */
const MAX_CONTRACT_TERM_SEASONS = 3;

/** Mirrors the squad view model's default for players predating M2 metadata. */
const DEFAULT_PERSONALITY: PlayerPersonality = 'Professional';
const DEFAULT_AGE = 24;

type RetirementPlayer = Pick<CareerPlayer, 'id'>
  & Partial<Pick<CareerPlayer, 'age' | 'personality' | 'retirementAnnouncementSeason'>>;

export function retirementAgeFor(player: RetirementPlayer, careerSeed: number): number {
  return retirementAnnouncementAge(
    { id: player.id, personality: player.personality ?? DEFAULT_PERSONALITY },
    careerSeed,
  );
}

/**
 * Seasons this player can still be contracted for, counting from the next
 * season transition onward.
 *
 * The `max(1, ...)` is the true answer rather than a floor. A player whose age
 * already exceeds their retirement age — a 38-year-old signed with a retirement
 * age of 34 — has not announced yet, so the next transition announces them and
 * the lifecycle grants them one final season.
 */
export function seasonsBeforeRetirement(player: RetirementPlayer, careerSeed: number): number {
  if (player.retirementAnnouncementSeason !== undefined) return 0;
  return Math.max(1, retirementAgeFor(player, careerSeed) - (player.age ?? DEFAULT_AGE));
}

/**
 * Longest renewal signable at season end. The week-30 decrement has already run
 * by the time renewals are offered, so the term covers only future seasons.
 */
export function maxRenewalTermSeasons(player: RetirementPlayer, careerSeed: number): 1 | 2 | 3 {
  const seasons = Math.max(1, seasonsBeforeRetirement(player, careerSeed));
  return Math.min(MAX_CONTRACT_TERM_SEASONS, seasons) as 1 | 2 | 3;
}

/**
 * Longest deal signable in a transfer window. One longer than a renewal,
 * because week 30 will decrement this contract once more before the season
 * ends, so the term also has to cover the season in progress.
 */
export function maxSigningTermSeasons(player: RetirementPlayer, careerSeed: number): 1 | 2 | 3 {
  const seasons = Math.max(1, seasonsBeforeRetirement(player, careerSeed)) + 1;
  return Math.min(MAX_CONTRACT_TERM_SEASONS, seasons) as 1 | 2 | 3;
}

/** The terms a term selector may offer, always starting at one season. */
export function contractTermOptions(maxTerm: 1 | 2 | 3): readonly (1 | 2 | 3)[] {
  return ([1, 2, 3] as const).filter(term => term <= maxTerm);
}

/**
 * Squad-card status, or undefined while retirement is far enough away that the
 * card stays quiet. Deliberately narrower than the contract table, which is
 * allowed to be candid at any age.
 */
export function retirementCardLabel(
  player: RetirementPlayer,
  careerSeed: number,
): string | undefined {
  if (player.retirementAnnouncementSeason !== undefined) return 'Final season — retires in summer';
  return seasonsBeforeRetirement(player, careerSeed) === 1
    ? 'Considering retirement in 1 year'
    : undefined;
}

/** True for exactly the players who will announce at this season's end. */
export function isConsideringRetirement(player: RetirementPlayer, careerSeed: number): boolean {
  return player.retirementAnnouncementSeason === undefined
    && seasonsBeforeRetirement(player, careerSeed) === 1;
}

/**
 * The line under a capped term selector. Explains the short deal as the player's
 * own judgement rather than as a rule the UI is imposing.
 */
export function shortContractReason(
  playerName: string,
  age: number,
  maxTerm: 1 | 2 | 3,
): string {
  const years = maxTerm === 1 ? '1 year' : `${maxTerm} years`;
  return `He'll only put his name to ${years} — at ${age} he reckons that's about all he has left in him.`;
}
```

- [ ] **Step 4: Export it**

Add to `src/game/index.ts`, keeping the file's existing alphabetical-ish grouping — insert after the `export * from './player-requests';` line:

```ts
export * from './retirement';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/game/__tests__/retirement.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/game/retirement.ts src/game/index.ts src/game/__tests__/retirement.test.ts
git commit -m "feat: derive remaining-career seasons and contract term caps"
```

---

## Task 2: Engine backstop on the two completion paths

The UI will never offer an over-long term after Tasks 3 and 4, so this is an
invariant check, not a user-facing error. It belongs at completion because that
is where `contractSeasonsRemaining` is actually written, and the only place with
`state` (and therefore `careerSeed`) in hand.

**Files:**
- Modify: `src/game/market-career.ts` (`completeCareerTransfer` ~line 395, `completeCareerRenewal` ~line 527)
- Test: `src/game/__tests__/retirement-contract-cap.test.ts`

- [ ] **Step 1: Read the two call sites**

Run: `npx jest --listTests src/game/__tests__ >/dev/null; grep -n "contractSeasonsRemaining: offer.termSeasons\|contractSeasonsRemaining: accepted.termSeasons" src/game/market-career.ts`
Expected: two line numbers, one per completion function.

- [ ] **Step 2: Write the failing test**

Create `src/game/__tests__/retirement-contract-cap.test.ts`:

```ts
import { describe, expect, it } from '@jest/globals';
import { assertContractTermFitsCareer } from '../market-career';
import { maxRenewalTermSeasons, maxSigningTermSeasons } from '../retirement';
import type { CareerPlayer } from '../types';

function veteran(overrides: Partial<CareerPlayer> = {}): CareerPlayer {
  return {
    id: 'vet-1',
    clubId: 'user-club',
    name: 'Sten Halvorsen',
    role: 'DEF',
    attrs: { pac: 50, sho: 40, pas: 55, def: 70, tec: 50, sta: 55, ref: 20 },
    licensed: false,
    weeklyWage: 400,
    onHeroWage: false,
    contractSeasonsRemaining: 0,
    morale: 60,
    injuryWeeks: 0,
    age: 37,
    personality: 'Timid',
    ...overrides,
  } as CareerPlayer;
}

describe('assertContractTermFitsCareer', () => {
  const seed = 456;

  it('accepts a term at the renewal cap', () => {
    const player = veteran();
    const cap = maxRenewalTermSeasons(player, seed);
    expect(() => assertContractTermFitsCareer(player, cap, seed, 'renewal')).not.toThrow();
  });

  it('rejects a renewal one season longer than the player has left', () => {
    const player = veteran();
    const tooLong = (maxRenewalTermSeasons(player, seed) + 1) as 1 | 2 | 3;
    expect(() => assertContractTermFitsCareer(player, tooLong, seed, 'renewal'))
      .toThrow(/only has \d+ season/);
  });

  it('accepts a term at the signing cap', () => {
    const player = veteran();
    const cap = maxSigningTermSeasons(player, seed);
    expect(() => assertContractTermFitsCareer(player, cap, seed, 'signing')).not.toThrow();
  });

  it('rejects a signing one season longer than the player has left', () => {
    const player = veteran();
    const tooLong = (maxSigningTermSeasons(player, seed) + 1) as 1 | 2 | 3;
    expect(() => assertContractTermFitsCareer(player, tooLong, seed, 'signing'))
      .toThrow(/only has \d+ season/);
  });

  it('leaves a player young enough to sign any term alone', () => {
    const player = veteran({ id: 'young', age: 24 });
    expect(() => assertContractTermFitsCareer(player, 3, seed, 'renewal')).not.toThrow();
    expect(() => assertContractTermFitsCareer(player, 3, seed, 'signing')).not.toThrow();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/game/__tests__/retirement-contract-cap.test.ts`
Expected: FAIL — `assertContractTermFitsCareer` is not exported from `../market-career`.

- [ ] **Step 4: Add the guard to `market-career.ts`**

Add the import near the other `./` imports at the top of `src/game/market-career.ts`:

```ts
import { maxRenewalTermSeasons, maxSigningTermSeasons } from './retirement';
```

Add the exported guard beside the file's other assertion helpers:

```ts
/**
 * The squad screen and both term selectors already refuse an over-long term, so
 * reaching this is an invariant break rather than a user mistake. It lives at
 * completion because that is the only point where the term becomes a real
 * `contractSeasonsRemaining` and where `careerSeed` is in hand.
 */
export function assertContractTermFitsCareer(
  player: CareerPlayer,
  termSeasons: number,
  careerSeed: number,
  kind: 'renewal' | 'signing',
): void {
  const cap = kind === 'renewal'
    ? maxRenewalTermSeasons(player, careerSeed)
    : maxSigningTermSeasons(player, careerSeed);
  if (termSeasons > cap) {
    throw new Error(
      `${player.name} only has ${cap} season${cap === 1 ? '' : 's'} left and cannot sign for ${termSeasons}`,
    );
  }
}
```

- [ ] **Step 5: Call it from both completion paths**

In `completeCareerTransfer`, immediately before the `const transferred: CareerPlayer = {` literal:

```ts
assertContractTermFitsCareer(player, offer.termSeasons, state.careerSeed, 'signing');
```

In `completeCareerRenewal`, immediately before the `const renewed: CareerPlayer = {` literal:

```ts
assertContractTermFitsCareer(player, accepted.termSeasons, state.careerSeed, 'renewal');
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest src/game/__tests__/retirement-contract-cap.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Run the full engine suite for regressions**

Run: `npx jest src/game`
Expected: PASS. If an existing market or career test now throws
`only has N seasons left`, it is seeding a veteran with an over-long contract —
lower that fixture's `termSeasons` to the cap rather than weakening the guard.

- [ ] **Step 8: Commit**

```bash
git add src/game/market-career.ts src/game/__tests__/retirement-contract-cap.test.ts
git commit -m "feat: reject contract terms that outlive the player"
```

---

## Task 3: Cap the season-review renewal term

**Files:**
- Modify: `src/application/view-models.ts` (`seasonEndViewModel`, `termOptions` at ~line 687)
- Modify: `src/ui/models.ts` (`ExpiredContractViewModel`)
- Modify: `src/ui/screens/SeasonEndScreen.tsx` (~line 244)
- Test: `src/application/__tests__/retirement-visibility.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/application/__tests__/retirement-visibility.test.ts`:

```ts
import { describe, expect, it } from '@jest/globals';
import { seasonEndViewModel } from '../view-models';
import { maxRenewalTermSeasons } from '../../game';
import { launchContent } from '../../content/launch';
import { seasonEndStateWithExpiredVeteran } from './helpers/retirement-fixtures';

describe('renewal term cap', () => {
  it('offers only the seasons the veteran has left', () => {
    const { state, player } = seasonEndStateWithExpiredVeteran({ age: 37, personality: 'Timid' });
    const cap = maxRenewalTermSeasons(player, state.careerSeed);
    const view = seasonEndViewModel(state, launchContent(), 1);
    expect(view.expiredContract?.termOptions).toEqual(
      [1, 2, 3].filter(term => term <= cap),
    );
  });

  it('explains the short term in the player own words', () => {
    const { state, player } = seasonEndStateWithExpiredVeteran({ age: 37, personality: 'Timid' });
    const cap = maxRenewalTermSeasons(player, state.careerSeed);
    const view = seasonEndViewModel(state, launchContent(), 1);
    expect(view.expiredContract?.shortTermReason)
      .toContain(cap === 1 ? '1 year' : `${cap} years`);
    expect(view.expiredContract?.shortTermReason).toContain('37');
  });

  it('says nothing extra for a player with a full career ahead', () => {
    const { state } = seasonEndStateWithExpiredVeteran({ age: 24, personality: 'Timid' });
    const view = seasonEndViewModel(state, launchContent(), 1);
    expect(view.expiredContract?.termOptions).toEqual([1, 2, 3]);
    expect(view.expiredContract?.shortTermReason).toBeUndefined();
  });

  it('never pre-selects a term above the cap', () => {
    const { state, player } = seasonEndStateWithExpiredVeteran({ age: 37, personality: 'Timid' });
    const cap = maxRenewalTermSeasons(player, state.careerSeed);
    const view = seasonEndViewModel(state, launchContent(), 3);
    expect(view.expiredContract!.selectedTerm).toBeLessThanOrEqual(cap);
  });
});
```

- [ ] **Step 2: Write the fixture helper**

Create `src/application/__tests__/helpers/retirement-fixtures.ts`. Build it from
whatever season-end fixture the neighbouring tests already use — open
`src/application/__tests__/legacy-flow.test.ts` and reuse its state builder
rather than hand-rolling a `GameState`. The helper must return a state in the
`'season-end'` phase whose user club contains one player with
`contractSeasonsRemaining: 0` and the requested `age` and `personality`, plus
that player:

```ts
import type { CareerPlayer, GameState, PlayerPersonality } from '../../../game';

export function seasonEndStateWithExpiredVeteran(
  attrs: { age: number; personality: PlayerPersonality },
): { state: GameState; player: CareerPlayer } {
  // Reuse the season-end state builder from legacy-flow.test.ts, then override
  // the first user-club player with an expired contract and the given age and
  // personality. Return both the state and that player so the test can compute
  // the same cap the view model will.
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/application/__tests__/retirement-visibility.test.ts`
Expected: FAIL — `termOptions` is `[1, 2, 3]` regardless of age, and
`shortTermReason` does not exist.

- [ ] **Step 4: Add the fields to `src/ui/models.ts`**

In `ExpiredContractViewModel`, immediately after the `termOptions` line:

```ts
  /** Present only when age has cut the term below three seasons. */
  shortTermReason?: string;
```

- [ ] **Step 5: Compute them in `seasonEndViewModel`**

Add to the imports from `../game` in `src/application/view-models.ts`:

```ts
  contractTermOptions,
  maxRenewalTermSeasons,
  shortContractReason,
```

Replace the `termOptions: [1, 2, 3] as const,` / `selectedTerm,` pair inside the
`expiredContract` literal with:

```ts
        termOptions: contractTermOptions(
          maxRenewalTermSeasons(expiredPlayer, state.careerSeed),
        ),
        selectedTerm: Math.min(
          selectedTerm,
          maxRenewalTermSeasons(expiredPlayer, state.careerSeed),
        ) as 1 | 2 | 3,
        ...(maxRenewalTermSeasons(expiredPlayer, state.careerSeed) === 3 ? {} : {
          shortTermReason: shortContractReason(
            expiredPlayer.name,
            expiredPlayer.age ?? 24,
            maxRenewalTermSeasons(expiredPlayer, state.careerSeed),
          ),
        }),
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx jest src/application/__tests__/retirement-visibility.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Render the line in `SeasonEndScreen.tsx`**

Immediately after the closing `</View>` of the `contract.termOptions.map(...)`
row (around line 260), add:

```tsx
                  {contract.shortTermReason === undefined ? null : (
                    <Text className="mt-2 text-sm leading-5 text-ink/60">
                      {contract.shortTermReason}
                    </Text>
                  )}
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/application/view-models.ts src/ui/models.ts src/ui/screens/SeasonEndScreen.tsx src/application/__tests__/
git commit -m "feat: cap renewal terms to the seasons a veteran has left"
```

---

## Task 4: Cap the market signing term

**Files:**
- Modify: `src/application/market-view-model.ts` (`marketNegotiationViewModel` ~line 474)
- Modify: `src/ui/models.ts` (`MarketNegotiationViewModel`)
- Modify: `src/ui/screens/MarketScreen.tsx` (`useContractDraft` ~line 841, term selector ~line 957)
- Modify: `src/application/view-models.ts` (renewal call to `marketNegotiationViewModel` ~line 697)
- Test: `src/application/__tests__/retirement-visibility.test.ts`

Note the shared component: `NegotiationPanel` renders both the market signing
and the season-end renewal negotiation. It must take its terms from the view
model in both cases, so `NegotiationViewSource` gains the cap as an input rather
than deriving it — the two callers compute it with different formulas.

- [ ] **Step 1: Write the failing test**

Append to `src/application/__tests__/retirement-visibility.test.ts`:

```ts
import { marketNegotiationViewModel } from '../market-view-model';
import { openNegotiationFor } from './helpers/retirement-fixtures';

describe('signing term cap', () => {
  it('offers one more season than a renewal, because week 30 has not run yet', () => {
    const { source, renewalCap } = openNegotiationFor({ age: 37, personality: 'Timid' });
    const view = marketNegotiationViewModel({
      ...source,
      maxTermSeasons: Math.min(3, renewalCap + 1) as 1 | 2 | 3,
    });
    expect(view.termOptions).toEqual(
      [1, 2, 3].filter(term => term <= Math.min(3, renewalCap + 1)),
    );
  });

  it('offers every term when no cap is supplied', () => {
    const { source } = openNegotiationFor({ age: 24, personality: 'Timid' });
    const view = marketNegotiationViewModel({ ...source, maxTermSeasons: 3 });
    expect(view.termOptions).toEqual([1, 2, 3]);
  });
});
```

Add `openNegotiationFor` to `src/application/__tests__/helpers/retirement-fixtures.ts`,
returning a `NegotiationViewSource` for a player of the given age and personality
plus that player's renewal cap.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/application/__tests__/retirement-visibility.test.ts -t "signing term cap"`
Expected: FAIL — `termOptions` does not exist on `MarketNegotiationViewModel`.

- [ ] **Step 3: Add the fields to `src/ui/models.ts`**

In `MarketNegotiationViewModel`, after the `perks` field:

```ts
  termOptions: readonly (1 | 2 | 3)[];
  /** Present only when age has cut the term below three seasons. */
  shortTermReason?: string;
```

- [ ] **Step 4: Extend the view model**

In `src/application/market-view-model.ts`, add to `NegotiationViewSource`:

```ts
  readonly maxTermSeasons: 1 | 2 | 3;
  readonly playerAge?: number;
```

Add to the returned object in `marketNegotiationViewModel`, beside `perks: PERKS,`:

```ts
    termOptions: contractTermOptions(source.maxTermSeasons),
    ...(source.maxTermSeasons === 3 || source.playerAge === undefined ? {} : {
      shortTermReason: shortContractReason(
        source.playerName,
        source.playerAge,
        source.maxTermSeasons,
      ),
    }),
```

Import `contractTermOptions` and `shortContractReason` from `../game`.

- [ ] **Step 5: Supply the cap at both call sites**

In `src/application/view-models.ts`, the renewal negotiation (~line 697) gains:

```ts
            maxTermSeasons: maxRenewalTermSeasons(expiredPlayer, state.careerSeed),
            playerAge: expiredPlayer.age ?? 24,
```

Find the market signing call to `marketNegotiationViewModel` — run
`grep -rn "marketNegotiationViewModel(" src/application/` to locate it — and add:

```ts
            maxTermSeasons: maxSigningTermSeasons(player, state.careerSeed),
            playerAge: player.age ?? 24,
```

where `player` is the negotiation's target. Import `maxSigningTermSeasons` from `../game`.

- [ ] **Step 6: Render capped terms in `MarketScreen.tsx`**

Replace the hardcoded term list (~line 957):

```tsx
              {([1, 2, 3] as const).map(term => (
```

with:

```tsx
              {viewModel.termOptions.map(term => (
```

Immediately after the closing `</View>` of that row, add:

```tsx
            {viewModel.shortTermReason === undefined ? null : (
              <Text className="mt-2 text-sm leading-5 text-ink/60">
                {viewModel.shortTermReason}
              </Text>
            )}
```

- [ ] **Step 7: Clamp the draft**

`useContractDraft` initialises and resets `termSeasons` to `2`, which is invalid
when the cap is 1. In `src/ui/screens/MarketScreen.tsx`, change the initialiser:

```tsx
  const [termSeasons, setTermSeasons] = useState<1 | 2 | 3>(
    Math.min(2, viewModel?.termOptions.at(-1) ?? 3) as 1 | 2 | 3,
  );
```

and inside the existing `useEffect` that resets on target change, replace
`setTermSeasons(2);` with:

```tsx
    setTermSeasons(Math.min(2, maxTerm) as 1 | 2 | 3);
```

Add `const maxTerm = viewModel?.termOptions.at(-1) ?? 3;` above the `useEffect`
and add `maxTerm` to its dependency array.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx jest src/application/__tests__/retirement-visibility.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 9: Typecheck and run the UI suite**

Run: `npx tsc --noEmit && npx jest src/ui`
Expected: no errors, all pass.

- [ ] **Step 10: Commit**

```bash
git add src/application/market-view-model.ts src/application/view-models.ts src/ui/models.ts src/ui/screens/MarketScreen.tsx src/application/__tests__/
git commit -m "feat: cap market signing terms to the seasons a veteran has left"
```

---

## Task 5: The player-card label

**Files:**
- Modify: `src/application/view-models.ts` (squad player mapping ~line 1493)
- Modify: `src/ui/models.ts` (`SquadPlayerViewModel`)
- Modify: `src/ui/screens/SquadTrainingScreen.tsx`
- Test: `src/application/__tests__/retirement-visibility.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/application/__tests__/retirement-visibility.test.ts`:

```ts
import { squadPlayerLabelsFor } from './helpers/retirement-fixtures';

describe('player-card retirement label', () => {
  it('stays quiet while retirement is more than one season away', () => {
    expect(squadPlayerLabelsFor({ age: 30, personality: 'Professional' }).retirementLabel)
      .toBeUndefined();
  });

  it('warns one season before the announcement', () => {
    expect(squadPlayerLabelsFor({ age: 36, personality: 'Professional' }).retirementLabel)
      .toBe('Considering retirement in 1 year');
  });

  it('marks the final season once announced', () => {
    expect(
      squadPlayerLabelsFor({
        age: 37,
        personality: 'Professional',
        retirementAnnouncementSeason: 1,
      }).retirementLabel,
    ).toBe('Final season — retires in summer');
  });
});
```

`squadPlayerLabelsFor` builds a `'manage'`-phase full career state containing one
user-club player with the given fields, calls the squad view model, and returns
that player's entry. **Trap:** the squad and training view models pass vacuously
unless the career is in `'full'` mode with the five-argument
`squadTrainingViewModel` — copy the setup from
`src/application/__tests__/archetype-cap-view-model.test.ts` rather than
inventing one.

Add it to `src/application/__tests__/helpers/retirement-fixtures.ts`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/application/__tests__/retirement-visibility.test.ts -t "player-card retirement label"`
Expected: FAIL — `retirementLabel` does not exist.

- [ ] **Step 3: Add the field to `src/ui/models.ts`**

In the squad player view model, immediately after `contractPromiseLabel?: string;`:

```ts
  /** Set only within one season of the announcement; absent while it is far off. */
  retirementLabel?: string;
```

- [ ] **Step 4: Populate it**

In `src/application/view-models.ts`, immediately after the `contractLabel:` entry
in the squad player mapping:

```ts
        ...(retirementCardLabel(player, state.careerSeed) === undefined ? {} : {
          retirementLabel: retirementCardLabel(player, state.careerSeed),
        }),
```

Add `retirementCardLabel` to the imports from `../game`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/application/__tests__/retirement-visibility.test.ts -t "player-card retirement label"`
Expected: PASS, 3 tests.

- [ ] **Step 6: Render it**

In `src/ui/screens/SquadTrainingScreen.tsx`, find where `contractLabel` is
rendered (`grep -n "contractLabel" src/ui/screens/SquadTrainingScreen.tsx`) and
add a chip beside it, matching the surrounding `StatusChip` usage:

```tsx
        {player.retirementLabel === undefined ? null : (
          <StatusChip label={player.retirementLabel} tone="hero" />
        )}
```

Use whichever chip component that block already uses; do not introduce a new one.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/application/view-models.ts src/ui/models.ts src/ui/screens/SquadTrainingScreen.tsx src/application/__tests__/
git commit -m "feat: show an approaching retirement on the player card"
```

---

## Task 6: The one-shot inbox heads-up

The desk shows at most three items a week (`view-models.ts:1169`), urgent first.
The existing `retirement-announcement-*` alert is not one-shot and re-renders
every week of the final season; a second recurring retirement alert would start
evicting injuries and board deadlines. The new one is therefore one-shot.

The existing announcement alert is **not** touched — Bert's `retirement` guide
sequence anchors to it (`view-models.ts:1130`).

**Files:**
- Modify: `src/application/view-models.ts` (`homeProductAlerts` ~line 857, `isOneShotProductAlert` ~line 1038)
- Test: `src/application/__tests__/retirement-visibility.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/application/__tests__/retirement-visibility.test.ts`:

```ts
import { clubHomeViewModel, isOneShotProductAlert } from '../view-models';
import { manageStateWithVeteran } from './helpers/retirement-fixtures';

describe('retirement heads-up alert', () => {
  it('lands for a player one season from announcing', () => {
    const { state, content } = manageStateWithVeteran({ age: 36, personality: 'Professional' });
    const view = clubHomeViewModel(state, content);
    expect(view.alerts.some(alert => alert.id.startsWith('retirement-considering-'))).toBe(true);
  });

  it('does not land for a player with seasons still ahead', () => {
    const { state, content } = manageStateWithVeteran({ age: 30, personality: 'Professional' });
    const view = clubHomeViewModel(state, content);
    expect(view.alerts.some(alert => alert.id.startsWith('retirement-considering-'))).toBe(false);
  });

  it('does not repeat once the player has announced', () => {
    const { state, content } = manageStateWithVeteran({
      age: 37,
      personality: 'Professional',
      retirementAnnouncementSeason: 1,
    });
    const view = clubHomeViewModel(state, content);
    expect(view.alerts.some(alert => alert.id.startsWith('retirement-considering-'))).toBe(false);
  });

  it('is registered as one-shot so it does not hold a desk slot all season', () => {
    const { state, content } = manageStateWithVeteran({ age: 36, personality: 'Professional' });
    const first = clubHomeViewModel(state, content);
    const alert = first.alerts.find(item => item.id.startsWith('retirement-considering-'))!;
    expect(isOneShotProductAlert(alert.id)).toBe(true);
  });
});
```

`manageStateWithVeteran` returns a `'manage'`-phase full career state plus the
launch content. `isOneShotProductAlert` is currently module-private in
`view-models.ts` — export it as part of this task so the last test can reach it.

Confirm the home view model's exported name first:
`grep -n "export function clubHome\|export function homeViewModel" src/application/view-models.ts`
and use whatever it actually is in both the test and the fixture.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/application/__tests__/retirement-visibility.test.ts -t "retirement heads-up"`
Expected: FAIL — no alert with that prefix is produced.

- [ ] **Step 3: Emit the alert**

In `src/application/view-models.ts`, add `isConsideringRetirement` to the imports
from `../game`. In the alert list, immediately after the existing
`retirementAnnouncements.map(...)` block:

```ts
    ...rosterForClub(state, state.userClubId)
      .filter(player => isConsideringRetirement(player, state.careerSeed))
      .map(player => ({
        id: `retirement-considering-${state.season}-${player.id}`,
        title: `${player.name} is thinking about retirement`,
        detail: `Age ${player.age ?? 24} · one more season after this one. Plan the succession now.`,
        tone: 'info' as const,
      })),
```

Use whichever roster helper the surrounding alerts already use — check how
`injured` and `transferRequests` are built a few lines above and match it.

- [ ] **Step 4: Register it as one-shot and export the predicate**

Replace `isOneShotProductAlert` with:

```ts
export function isOneShotProductAlert(alertId: string): boolean {
  return alertId.startsWith('board-resolution:')
    || alertId.startsWith('training-cap:')
    || alertId.startsWith('retirement-considering-');
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/application/__tests__/retirement-visibility.test.ts`
Expected: PASS, all 13 tests across the file.

- [ ] **Step 6: Run the whole suite**

Run: `npx jest`
Expected: PASS. A desk-inbox test that asserts an exact alert count may now see
one more on an ageing squad — check whether the fixture squad contains a veteran
before adjusting anything, and fix the expectation rather than the feature.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/application/view-models.ts src/application/__tests__/
git commit -m "feat: warn once when a player is a season from retiring"
```

---

## Task 7: Documentation

**Files:**
- Modify: `docs/05-players-training-coaches.md` (line 51, the age-curve bullet)

- [ ] **Step 1: Amend the age-curve bullet**

The existing line ends `Retirement announced at 33–38 (personality-weighted).`
Append:

```
The squad card and the inbox both flag a player one season before that
announcement, and no contract may be signed or renewed past a player's last
playable season.
```

- [ ] **Step 2: Commit**

```bash
git add docs/05-players-training-coaches.md
git commit -m "docs: record the retirement warning and contract cap"
```

---

## Self-review notes

**Spec coverage.** §2 cap → Tasks 1, 2, 3, 4. §2.1 two formulas → Task 1
(`maxRenewalTermSeasons` / `maxSigningTermSeasons`, tested against the real
lifecycle). §2.2 seasons left → Task 1. §3 visibility → Task 5. §4 copy → Tasks
3, 4 (`shortContractReason`), 6 (alert copy). §5 one-shot → Task 6. §6
architecture → Task 1 (module), Tasks 3–5 (view model), Task 2 (engine). §7 out
of scope — no `ENGINE_VERSION` change, no migration, no lifecycle edit appears in
any task. §8 tests → Task 1 property test, Task 2 rejection tests, Tasks 3–6
view-model tests.

**Known soft spots for the implementer.** Three fixture helpers in Task 3, 4 and
5 are described by contract rather than written out, because they must be built
from the existing test-state builders in this repo rather than hand-rolled — a
hand-rolled `GameState` will pass vacuously. Read the named neighbouring test
file before writing each one.
