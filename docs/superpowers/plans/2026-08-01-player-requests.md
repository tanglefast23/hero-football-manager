# Player Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From season 2 week 5, squad players periodically ask the manager for things on a new Requests tab; granting costs money, weeks or condition, refusing costs a new per-player loyalty score that decides contract renewals.

**Architecture:** All decision logic lives in two new pure modules under `src/game/` (`loyalty.ts`, `player-requests.ts`) driven by a seeded PRNG, with the 30 requests authored as zod-validated JSON in `content/`. The application layer builds a view model; the UI adds a two-tab row to the Squad screen and reuses the existing walk-on overlay and decision-card patterns. `src/sim/` is not touched.

**Tech Stack:** TypeScript, React Native + Expo, NativeWind, zod, Jest (node environment, no DOM).

**Source spec:** [docs/superpowers/specs/2026-08-01-player-requests-design.md](../specs/2026-08-01-player-requests-design.md)

---

## Ground rules for every task

- `src/game/` and `src/sim/` are **pure TypeScript**. No React Native, Expo or Skia imports. No `Math.random`, no `Date.now`. Every random draw goes through `deterministicCareerEventRoll` from `src/game/event-clock.ts`.
- Jest runs in the **node** environment. There is no DOM and `require('react-native')` throws. Do not write tests that import screens.
- Run a single test file with `npx jest src/game/__tests__/loyalty.test.ts`.
- Run everything with `npm test`.
- Typecheck with `npx tsc --noEmit`.
- Commit after every task.

---

## File structure

**New files**

| Path | Responsibility |
| --- | --- |
| `src/game/loyalty.ts` | Loyalty derivation, clamping, renewal effect. Pure. |
| `src/game/player-requests.ts` | Cadence, eligibility, weighting, pricing, resolution, effect ticking. Pure. |
| `content/player-requests.json` | The 30 authored requests plus tuning. |
| `src/application/player-request-view-model.ts` | `GameState` → view model for the Requests tab. |
| `src/ui/screens/SquadRequestsPanel.tsx` | The tab's contents. |
| `src/ui/PlayerRequestWalkOn.tsx` | Walk-on + speech bubble for the asking player. |
| `src/ui/PlayerRequestDecisionCard.tsx` | The grant/refuse modal. |
| `src/game/__tests__/loyalty.test.ts` | |
| `src/game/__tests__/player-requests.test.ts` | |
| `src/application/__tests__/player-request-view-model.test.ts` | |

**Modified files**

| Path | Change |
| --- | --- |
| `src/game/types.ts` | `loyalty`, `awayWeeks` on `CareerPlayer`; `playerRequests` on `GameState` |
| `src/persistence/game-state-codec.ts` | Schemas; `GAME_SCHEMA_VERSION` 2 → 3 |
| `src/game/market.ts` | `loyaltyPercent` in `RenewalAskFactors` |
| `src/game/player-wellbeing.ts` | Pass loyalty into the underpaid check |
| `src/game/lineup.ts`, `src/game/squad.ts` | `awayWeeks` blocks selection |
| `src/game/contract-promises.ts` | Away players exempt from starting promises; request-granted training priority |
| `src/game/training.ts` | Drill gain multiplier from active effects |
| `src/game/career.ts` | Weekly tick: roll, countdowns, lapse |
| `src/content/schemas.ts`, `src/content/load.ts` | Load and validate the request catalog |
| `src/ui/event-pixel-sprites.ts` | 9 new 16×16 sprites |
| `src/ui/screens/SquadTrainingScreen.tsx` | Tab row; loyalty tile on the profile card |
| `content/assistant-guide.json`, `src/game/assistant-guide.ts`, `src/ui/bert-beat-moments.ts` | Bert's briefing |

---

## Task 1: Loyalty core

Loyalty is **derived, not initialised**. `CareerPlayer.loyalty` is optional; when absent it is computed from a stable hash of the career seed and player id. This avoids editing the six separate player-construction sites in `full-career.ts`, `youth-intake.ts`, `market-career.ts`, `legacy-career.ts`, `squad.ts` and `onboarding/story-onboarding.ts`, any one of which would be easy to miss, and it makes every pre-existing save work unchanged.

**Files:**
- Create: `src/game/loyalty.ts`
- Test: `src/game/__tests__/loyalty.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/__tests__/loyalty.test.ts`:

```ts
import {
  INITIAL_LOYALTY_MAX,
  INITIAL_LOYALTY_MIN,
  LOYALTY_NO_RENEWAL_THRESHOLD,
  adjustLoyalty,
  initialLoyalty,
  loyaltyRenewalPercent,
  playerLoyalty,
  willRenegotiate,
} from '../loyalty';

describe('initialLoyalty', () => {
  it('always lands inside the 60 to 75 band', () => {
    for (let index = 0; index < 500; index += 1) {
      const value = initialLoyalty(12345, `player-${index}`);
      expect(value).toBeGreaterThanOrEqual(INITIAL_LOYALTY_MIN);
      expect(value).toBeLessThanOrEqual(INITIAL_LOYALTY_MAX);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('is stable for the same seed and player, and differs across players', () => {
    expect(initialLoyalty(999, 'rojas')).toBe(initialLoyalty(999, 'rojas'));
    const spread = new Set(
      Array.from({ length: 60 }, (_, index) => initialLoyalty(999, `p${index}`)),
    );
    expect(spread.size).toBeGreaterThan(8);
  });

  it('rejects a non-uint32 career seed', () => {
    expect(() => initialLoyalty(-1, 'rojas')).toThrow('career seed');
  });
});

describe('playerLoyalty', () => {
  it('prefers the persisted value when present', () => {
    expect(playerLoyalty({ id: 'rojas', loyalty: 41 }, 999)).toBe(41);
  });

  it('derives a value when the field is absent', () => {
    expect(playerLoyalty({ id: 'rojas' }, 999)).toBe(initialLoyalty(999, 'rojas'));
  });
});

describe('adjustLoyalty', () => {
  it('clamps to 0 and 100', () => {
    expect(adjustLoyalty(98, 5)).toBe(100);
    expect(adjustLoyalty(2, -5)).toBe(0);
    expect(adjustLoyalty(60, -5)).toBe(55);
  });
});

describe('loyaltyRenewalPercent', () => {
  it('matches the design table', () => {
    expect(loyaltyRenewalPercent(100)).toBe(-20);
    expect(loyaltyRenewalPercent(75)).toBe(-10);
    expect(loyaltyRenewalPercent(50)).toBe(0);
    expect(loyaltyRenewalPercent(25)).toBe(10);
    expect(loyaltyRenewalPercent(0)).toBe(20);
  });

  it('rejects a loyalty outside 0 to 100', () => {
    expect(() => loyaltyRenewalPercent(101)).toThrow('loyalty');
  });
});

describe('willRenegotiate', () => {
  it('is false below the no-renewal threshold and true at it', () => {
    expect(willRenegotiate(LOYALTY_NO_RENEWAL_THRESHOLD - 1)).toBe(false);
    expect(willRenegotiate(LOYALTY_NO_RENEWAL_THRESHOLD)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/__tests__/loyalty.test.ts`
Expected: FAIL — `Cannot find module '../loyalty'`

- [ ] **Step 3: Write the implementation**

Create `src/game/loyalty.ts`:

```ts
import { mulberry32 } from '../sim/rng';

/**
 * How much a player wants to stay, 0 to 100.
 *
 * Deliberately not morale. Morale is fast — it moves on results, recovers on
 * wins, and scales match attributes by ±10%. Loyalty is slow: nothing but the
 * manager's own decisions move it, it never recovers on its own, and its only
 * job is the price of the next contract. One sting you feel on Saturday, one
 * scar you meet at the negotiating table.
 */
export const INITIAL_LOYALTY_MIN = 60;
export const INITIAL_LOYALTY_MAX = 75;

/** Below this a player will not re-sign at any price; they run the deal down. */
export const LOYALTY_NO_RENEWAL_THRESHOLD = 30;

/** Loyalty at or below this reads in warning red on the player card. */
export const LOYALTY_WARNING_THRESHOLD = 40;

/**
 * Derived rather than stored at construction.
 *
 * Players are built in six separate places across the career, market, youth,
 * legacy, squad and onboarding modules. Initialising a field in all six is a
 * standing invitation to miss one, and a missed one would surface as a player
 * whose loyalty silently reads as undefined at the negotiating table. Deriving
 * it from the career seed and the player's stable id gives every player a value
 * from the moment they exist — including everyone in every save written before
 * this feature — and nothing has to remember to do it.
 */
export function initialLoyalty(careerSeed: number, playerId: string): number {
  if (!Number.isInteger(careerSeed) || careerSeed < 0 || careerSeed > 4294967295) {
    throw new Error('loyalty career seed must be a uint32');
  }
  if (typeof playerId !== 'string' || playerId.trim().length === 0) {
    throw new Error('loyalty player ID must be a non-empty string');
  }
  const seed = (careerSeed ^ Math.imul(hashString(playerId), 0x9e3779b1)) >>> 0;
  const span = INITIAL_LOYALTY_MAX - INITIAL_LOYALTY_MIN + 1;
  return INITIAL_LOYALTY_MIN + Math.floor(mulberry32(seed)() * span);
}

/** The persisted value if the player has one, otherwise their derived value. */
export function playerLoyalty(
  player: { readonly id: string; readonly loyalty?: number },
  careerSeed: number,
): number {
  return player.loyalty ?? initialLoyalty(careerSeed, player.id);
}

export function adjustLoyalty(loyalty: number, delta: number): number {
  validateLoyalty(loyalty);
  if (!Number.isInteger(delta)) throw new Error('loyalty delta must be an integer');
  return Math.max(0, Math.min(100, loyalty + delta));
}

/**
 * Signed percentage points applied to the renewal ask, matching the shape of
 * the `growthSinceSigningPercent` and `famePercent` factors beside it.
 * Loyalty 100 asks for 20% less; loyalty 0 asks for 20% more.
 */
export function loyaltyRenewalPercent(loyalty: number): number {
  validateLoyalty(loyalty);
  return Math.round((50 - loyalty) * 0.4);
}

export function willRenegotiate(loyalty: number): boolean {
  validateLoyalty(loyalty);
  return loyalty >= LOYALTY_NO_RENEWAL_THRESHOLD;
}

function validateLoyalty(loyalty: number): void {
  if (!Number.isInteger(loyalty) || loyalty < 0 || loyalty > 100) {
    throw new Error('player loyalty must be an integer from 0 to 100');
  }
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/__tests__/loyalty.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git add src/game/loyalty.ts src/game/__tests__/loyalty.test.ts
git commit -m "feat: add derived player loyalty"
```

---

## Task 2: Persist loyalty and awayWeeks

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/persistence/game-state-codec.ts`
- Test: `src/persistence/__tests__/game-state-codec.test.ts`

- [ ] **Step 1: Add the fields to `CareerPlayer`**

In `src/game/types.ts`, inside `interface CareerPlayer`, immediately after the `condition?: number;` line:

```ts
  /**
   * How much they want to stay, 0 to 100. Absent means "never moved from the
   * derived starting value"; read it through `playerLoyalty` in
   * `src/game/loyalty.ts`, never directly.
   */
  loyalty?: number;
  /**
   * Weeks unavailable because a granted request took them away.
   *
   * Deliberately not `injuryWeeks`. Sharing that field would let the Medical
   * Bay shorten a beach holiday and would make the roster announce that a
   * striker is "recovering" from the Bahamas.
   */
  awayWeeks?: number;
```

- [ ] **Step 2: Add the cash transaction kind**

In `src/game/types.ts`, add to the `CashTransactionKind` union (line 264):

```ts
  | 'player-request'
```

Granting a money request must go through `recordCashTransaction`, not a bare `club.cash` edit — the finances screen and the career balance summary both read that ledger.

Add the matching literal to the cash-transaction schema's `kind` enum in `src/persistence/game-state-codec.ts`.

- [ ] **Step 3: Add the request state types**

In `src/game/types.ts`, above `export interface GameState`:

```ts
export type PlayerRequestResolution = 'GRANTED' | 'REFUSED' | 'LAPSED';

export interface PendingPlayerRequest {
  requestId: string;
  playerId: string;
  askedSeason: number;
  askedWeek: number;
  /**
   * Money cost snapshotted when the request opened. Without it a renewal or a
   * wage rise between the ask and the answer would silently change the number
   * already printed on the card.
   */
  costAmount?: number;
  /** True once the second-week inbox warning has been queued. */
  warned: boolean;
}

/**
 * Only the drill effects exist. Status requests — armband, shirt 10,
 * guaranteed start, training priority — were cut from v1 because they collide
 * with `contractPromise`, which holds a single object per player.
 */
export type RequestEffectKind = 'DRILL_PLAYER' | 'DRILL_SQUAD';

export interface ActiveRequestEffect {
  kind: RequestEffectKind;
  /** Absent for squad-wide effects. */
  playerId?: string;
  weeksRemaining: number;
  /** Drill gain scale, e.g. 50 for half gains. */
  multiplierPercent?: number;
}

export interface ResolvedPlayerRequest {
  requestId: string;
  playerId: string;
  season: number;
  week: number;
  resolution: PlayerRequestResolution;
  costAmount?: number;
}

export interface PlayerRequestState {
  weeksSinceRequest: number;
  pending?: PendingPlayerRequest;
  effects: ActiveRequestEffect[];
  /** Newest first, capped at MAX_PLAYER_REQUEST_HISTORY. */
  history: ResolvedPlayerRequest[];
  lastAskingPlayerId?: string;
}
```

Then add to `GameState`, after the `financialSafety?: FinancialSafetyState;` line:

```ts
  /** Absent on saves written before player requests; defaulted on reconciliation. */
  playerRequests?: PlayerRequestState;
```

And bump the schema version at the top of the file:

```ts
export const GAME_SCHEMA_VERSION = 3;
```

**Bumping the constant alone bricks every save on disk.** `migrateStoredGameState` (`src/persistence/game-state-codec.ts:1722`) walks one boundary at a time and throws `UnsupportedGameSchemaError` when a rung is missing, so a schema-2 save would refuse to load rather than upgrade. The next step adds the rung. Do not separate these two steps into different commits.

- [ ] **Step 4: Write the failing codec test**

Append to `src/persistence/__tests__/game-state-codec.test.ts`:

```ts
describe('player request persistence', () => {
  it('round-trips loyalty, awayWeeks and pending request state', () => {
    const state = baseState();
    const withRequests: GameState = {
      ...state,
      players: state.players.map((player, index) => (index === 0
        ? { ...player, loyalty: 41, awayWeeks: 2 }
        : player)),
      playerRequests: {
        weeksSinceRequest: 3,
        pending: {
          requestId: 'bahamas-fortnight',
          playerId: state.players[0].id,
          askedSeason: 2,
          askedWeek: 7,
          warned: false,
        },
        effects: [{
          kind: 'DRILL_SQUAD',
          weeksRemaining: 2,
          multiplierPercent: 60,
        }],
        history: [{
          requestId: 'gold-boots',
          playerId: state.players[0].id,
          season: 2,
          week: 5,
          resolution: 'GRANTED',
          costAmount: 1200,
        }],
        lastAskingPlayerId: state.players[0].id,
      },
    };

    expect(decodeGameState(encodeGameState(withRequests))).toEqual(withRequests);
  });

  it('rejects a loyalty above 100', () => {
    const state = baseState();
    const broken = {
      ...state,
      players: state.players.map((player, index) => (index === 0
        ? { ...player, loyalty: 101 }
        : player)),
    };

    expect(() => decodeGameState(encodeGameState(broken as GameState))).toThrow();
  });
});
```

Use whatever fixture helper the existing tests in that file already use in place of `baseState()`; do not invent a new one.

- [ ] **Step 5: Run test to verify it fails**

Run: `npx jest src/persistence/__tests__/game-state-codec.test.ts`
Expected: FAIL — the strict object schema rejects the unknown `playerRequests` key

- [ ] **Step 6: Add the zod schemas**

In `src/persistence/game-state-codec.ts`, beside the other player fields in the career-player schema (near the existing `shirtNumber` and `isCaptain` entries around line 205):

```ts
    loyalty: z.number().int().min(0).max(100).optional(),
    awayWeeks: z.number().int().min(0).max(10).optional(),
```

Add these schemas above the game-state schema:

```ts
const pendingPlayerRequestSchema = z.strictObject({
  requestId: nonEmptyString,
  playerId: nonEmptyString,
  askedSeason: positiveInteger,
  askedWeek: positiveInteger,
  costAmount: z.number().int().min(0).optional(),
  warned: z.boolean(),
});

const activeRequestEffectSchema = z.strictObject({
  kind: z.enum(['DRILL_PLAYER', 'DRILL_SQUAD']),
  playerId: nonEmptyString.optional(),
  weeksRemaining: z.number().int().min(1).max(30),
  multiplierPercent: z.number().int().min(1).max(200).optional(),
});

const resolvedPlayerRequestSchema = z.strictObject({
  requestId: nonEmptyString,
  playerId: nonEmptyString,
  season: positiveInteger,
  week: positiveInteger,
  resolution: z.enum(['GRANTED', 'REFUSED', 'LAPSED']),
  costAmount: z.number().int().min(0).optional(),
});

const playerRequestStateSchema = z.strictObject({
  weeksSinceRequest: z.number().int().min(0).max(200),
  pending: pendingPlayerRequestSchema.optional(),
  effects: z.array(activeRequestEffectSchema).max(20),
  history: z.array(resolvedPlayerRequestSchema).max(40),
  lastAskingPlayerId: nonEmptyString.optional(),
});
```

Reuse whatever the file already names for `nonEmptyString` and `positiveInteger`; both already exist in it. Then add to the game-state object schema, beside `financialSafety`:

```ts
    playerRequests: playerRequestStateSchema.optional(),
```

- [ ] **Step 7: Add the 2 → 3 migration rung**

Append to `GAME_STATE_MIGRATIONS` (`src/persistence/game-state-codec.ts:1701`), which is currently an empty array:

```ts
const GAME_STATE_MIGRATIONS: readonly GameStateMigration[] = [
  {
    to: 3,
    // Every field player requests added is optional, and loyalty is derived
    // from the career seed when absent, so a schema-2 save is already a valid
    // schema-3 save. The rung exists because the ladder refuses a missing
    // boundary outright — without it every save on disk fails to load.
    up: state => state,
  },
];
```

- [ ] **Step 8: Prove an old save still loads**

Append to `src/persistence/__tests__/game-state-codec.test.ts`:

```ts
it('walks a schema-2 save up to the current version', () => {
  const legacy = { ...JSON.parse(JSON.stringify(baseState())), schemaVersion: 2 };
  const migrated = migrateStoredGameState(legacy) as GameState;

  expect(migrated.schemaVersion).toBe(GAME_SCHEMA_VERSION);
  expect(() => decodeGameState(JSON.stringify(migrated))).not.toThrow();
});
```

Run: `npx jest src/persistence/__tests__/game-state-codec.test.ts`
Expected: PASS — including this test. If it throws `UnsupportedGameSchemaError`, the rung is missing or its `to` is wrong.

- [ ] **Step 9: Run the full suite to catch schema-version fallout**

Run: `npm test`
Expected: any failure is a test asserting `GAME_SCHEMA_VERSION === 2`. Update those assertions to `3`.

- [ ] **Step 10: Commit**

```bash
git add src/game/types.ts src/persistence/game-state-codec.ts src/persistence/__tests__/game-state-codec.test.ts
git commit -m "feat: persist loyalty, away weeks and player request state"
```

---

## Task 3: Loyalty moves the renewal ask

**Files:**
- Modify: `src/game/market.ts:449` (`RenewalAskFactors`), `src/game/market.ts:482` (`renewalContractAsk`)
- Modify: `src/game/player-wellbeing.ts:105` (`isUnderpaidPlayer`)
- Test: `src/game/__tests__/market.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/game/__tests__/market.test.ts`:

```ts
describe('loyalty in the renewal ask', () => {
  const player = {
    weeklyWage: 1000,
    personality: 'PROFESSIONAL' as const,
    onHeroWage: false,
  };
  const factors = {
    growthSinceSigningPercent: 0,
    famePercent: 0,
    heroMultiplier: 4,
  };

  it('discounts the ask for a loyal player and inflates it for a disloyal one', () => {
    expect(renewalContractAsk(player, { ...factors, loyaltyPercent: -20 })).toBe(800);
    expect(renewalContractAsk(player, { ...factors, loyaltyPercent: 0 })).toBe(1000);
    expect(renewalContractAsk(player, { ...factors, loyaltyPercent: 20 })).toBe(1200);
  });

  it('rejects a loyalty factor outside the supported band', () => {
    expect(() => renewalContractAsk(player, { ...factors, loyaltyPercent: 21 }))
      .toThrow('renewal loyalty factor');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/__tests__/market.test.ts -t "loyalty in the renewal ask"`
Expected: FAIL — `loyaltyPercent` is not accepted and the ask is unchanged

- [ ] **Step 3: Add the factor**

In `src/game/market.ts`, add to `RenewalAskFactors`:

```ts
  /**
   * Signed percentage points from the player's loyalty, −20 to 20. Separate
   * from `famePercent` because that factor is unsigned and this one is not.
   */
  readonly loyaltyPercent: number;
```

In `renewalContractAsk`, after the existing fame validation:

```ts
  if (!Number.isInteger(factors.loyaltyPercent)
    || factors.loyaltyPercent < -20
    || factors.loyaltyPercent > 20) {
    throw new Error('renewal loyalty factor must be an integer from -20 to 20');
  }
```

And apply it immediately after the fame scaling line, before the personality scaling:

```ts
  ask = scaleByPercent(ask, 100 + factors.loyaltyPercent, 'loyalty-adjusted renewal ask');
```

- [ ] **Step 4: Keep loyalty OUT of the underpaid check**

`isUnderpaidPlayer` (`src/game/player-wellbeing.ts:105`) also calls `renewalContractAsk`, so it must now pass the new field. Pass **zero**, and say why:

```ts
    heroMultiplier: 4,
    // Deliberately not the player's real loyalty. Loyalty has exactly one job —
    // the renewal ask — and the InfoTip on the player card says so. Feeding it
    // here would make every refusal ALSO raise the "fair wage" line, adding a
    // silent −2 morale a week and a faster transfer request that no button on
    // the decision card ever mentioned. That is a third punishment channel the
    // manager was never shown.
    loyaltyPercent: 0,
```

Do not change `isUnderpaidPlayer`'s signature, and do not import `loyalty.ts` into `player-wellbeing.ts`.

- [ ] **Step 5: Fix the renewal talks caller and add the no-renewal gate**

The other caller is `beginCareerRenewalTalks` at `src/game/market-career.ts:440`. It needs the new factor *and* the below-30 refusal, which is the only place that rule can live — it is the single entry point to renewal talks.

Add the import:

```ts
import { LOYALTY_NO_RENEWAL_THRESHOLD, loyaltyRenewalPercent, playerLoyalty, willRenegotiate } from './loyalty';
```

Then, immediately after the `const player = expiredUserPlayer(state, playerId);` line:

```ts
  const loyalty = playerLoyalty(player, state.careerSeed);
  // Below the threshold there is no number that buys them. The manager has
  // watched this fall on the player card all season, and Bert said it would
  // land here, so this is a consequence rather than an ambush.
  if (!willRenegotiate(loyalty)) {
    throw new Error(
      `${player.name} will not re-sign. Loyalty below ${LOYALTY_NO_RENEWAL_THRESHOLD} ends talks before they start.`,
    );
  }
```

And add the factor to the `renewalContractAsk` call in the same function:

```ts
    heroMultiplier: 4,
    loyaltyPercent: loyaltyRenewalPercent(loyalty),
```

- [ ] **Step 6: Confirm no caller was missed**

Run: `rg -n "renewalContractAsk" src --glob '!**/__tests__/**'`
Expected: exactly three results — the definition in `market.ts`, `player-wellbeing.ts`, and `market-career.ts`. Any other result must also be given a `loyaltyPercent`.

- [ ] **Step 7: Add the refusal test**

Append to `src/game/__tests__/market-career.test.ts`:

```ts
it('refuses to open renewal talks for a player below the loyalty threshold', () => {
  const state = seasonEndFixture();
  const target = expiredPlayer(state);
  const disloyal = {
    ...state,
    players: state.players.map(player => (player.id === target.id
      ? { ...player, loyalty: 12 }
      : player)),
  };

  expect(() => beginCareerRenewalTalks(disloyal, disloyal.market!, target.id))
    .toThrow('will not re-sign');
});
```

Use the fixture helpers that file already defines.

- [ ] **Step 8: Run the tests**

Run: `npx jest src/game/__tests__/market.test.ts src/game/__tests__/player-wellbeing.test.ts src/game/__tests__/market-career.test.ts`
Expected: PASS

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add src/game/market.ts src/game/market-career.ts src/game/player-wellbeing.ts src/game/__tests__
git commit -m "feat: loyalty moves the contract renewal ask"
```

---

## Task 4: Away players cannot be selected

`awayWeeks` must block selection exactly as `injuryWeeks` does, and — critically — must exempt the player from starting-promise enforcement. Without that exemption, granting a holiday to a player who was promised a starting place makes every subsequent lineup save throw.

**Files:**
- Modify: `src/game/lineup.ts:135`, `src/game/squad.ts:45,167,178,386`, `src/game/contract-promises.ts:117,136,170`
- Test: `src/game/__tests__/squad.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/game/__tests__/squad.test.ts`:

```ts
describe('away players', () => {
  it('is not an eligible replacement while away', () => {
    const state = careerFixture();
    const bench = state.players.find(player => (
      player.clubId === state.userClubId
      && !startingIds(state).has(player.id)
      && player.role !== 'GK'
    ))!;
    const away = {
      ...state,
      players: state.players.map(player => (player.id === bench.id
        ? { ...player, awayWeeks: 2 }
        : player)),
    };

    expect(eligibleReplacements(away, startingOutfieldId(away)))
      .not.toContain(bench.id);
  });

  it('does not demand a starting place for an away promised player', () => {
    const state = careerFixture();
    const starter = state.players.find(player => (
      player.clubId === state.userClubId && startingIds(state).has(player.id)
    ))!;
    const promised = applyCareerContractPromise(state, starter.id, 'GUARANTEED_STARTER');
    const away = {
      ...promised,
      players: promised.players.map(player => (player.id === starter.id
        ? { ...player, awayWeeks: 1 }
        : player)),
    };
    const withoutThem = startingIdsArray(away).filter(id => id !== starter.id);

    expect(() => assertCareerLineupHonorsContractPromises(away, withoutThem)).not.toThrow();
  });
});
```

Use the fixture and helper names the existing tests in that file already use; do not invent new ones.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/__tests__/squad.test.ts -t "away players"`
Expected: FAIL — the away player is still eligible and the promise still throws

- [ ] **Step 3: Add a shared availability helper**

Create the helper in `src/game/lineup.ts`, exported so both modules share one definition:

```ts
/**
 * Fit and present. Injury and leave are separate fields but identical to
 * selection, so every caller asks this rather than testing two numbers and
 * eventually forgetting one.
 */
export function isAvailableForSelection(
  player: { injuryWeeks?: number; awayWeeks?: number },
): boolean {
  return (player.injuryWeeks ?? 0) === 0 && (player.awayWeeks ?? 0) === 0;
}
```

Add `awayWeeks?: number;` beside the existing `injuryWeeks?: number;` on the lineup player interface in the same file.

- [ ] **Step 4: Replace every availability test**

Run: `rg -n "injuryWeeks === 0|injuryWeeks > 0|\(player.injuryWeeks \?\? 0\) === 0" src/game`

At each of these sites, substitute the helper:

- `src/game/lineup.ts:135` — `&& (player.injuryWeeks ?? 0) === 0` becomes `&& isAvailableForSelection(player)`
- `src/game/squad.ts:45` — the injured-starter filter becomes `!isAvailableForSelection(player)`
- `src/game/squad.ts:167` — `starter.injuryWeeks === 0` becomes `isAvailableForSelection(starter)`
- `src/game/squad.ts:178,386` — `candidate.injuryWeeks === 0` becomes `isAvailableForSelection(candidate)`
- `src/game/squad.ts:256` — `replacement.injuryWeeks > 0` becomes `!isAvailableForSelection(replacement)`
- `src/game/contract-promises.ts:117,136,170` — `player.injuryWeeks === 0` becomes `isAvailableForSelection(player)`

Leave `src/game/board-ultimatum.ts:360` and `src/game/post-match-awakening.ts:236,275` alone: a player on holiday is still sellable and still awakening-eligible, so those two genuinely mean "not injured".

**Two sites the grep will not obviously flag, and both matter:**

`buildCareerTeamDef` (`src/game/squad.ts:44`) throws when the lineup contains a player with `injuryWeeks > 0`. It does **not** check `awayWeeks`, so without this change an away player does not error — they silently play the match. Change the guard:

```ts
  const unavailable = roster.find(
    player => lineup.playerIds.includes(player.id) && !isAvailableForSelection(player),
  );
  if (unavailable !== undefined) {
    throw new Error(`unavailable player ${unavailable.id} must be replaced in the lineup`);
  }
```

This turns a silent wrong result into a loud one. Task 10 then makes sure it never fires, by repairing the lineup at the moment leave is granted.

`trainPlayerInstantly` (`src/game/training.ts:115`) gates only on injury, so a player in the Bahamas can still take drills. Change it:

```ts
  if (!isAvailableForSelection(player)) {
    throw new Error(`${player.name} is unavailable and cannot train`);
  }
```

- [ ] **Step 5: Test both**

Append to `src/game/__tests__/squad.test.ts`:

```ts
  it('refuses to build a team with an away player still in the XI', () => {
    const state = careerFixture();
    const starter = state.players.find(p => startingIds(state).has(p.id))!;
    const away = {
      ...state,
      players: state.players.map(p => (p.id === starter.id ? { ...p, awayWeeks: 2 } : p)),
    };

    expect(() => buildCareerTeamDef(away, away.userClubId)).toThrow('unavailable player');
  });
```

Append to `src/game/__tests__/training.test.ts`:

```ts
  it('refuses to train an away player', () => {
    const state = careerFixture();
    const target = state.players.find(p => p.clubId === state.userClubId)!;
    const away = {
      ...state,
      players: state.players.map(p => (p.id === target.id ? { ...p, awayWeeks: 1 } : p)),
    };

    expect(() => trainPlayerInstantly(away, target.id, 'pace'))
      .toThrow('unavailable and cannot train');
  });
```

Use the path id the file's existing drill tests use in place of `'pace'`.

- [ ] **Step 6: Run the tests**

Run: `npx jest src/game/__tests__/squad.test.ts src/game/__tests__/lineup.test.ts src/game/__tests__/contract-promises.test.ts src/game/__tests__/training.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/game/lineup.ts src/game/squad.ts src/game/contract-promises.ts src/game/training.ts src/game/__tests__
git commit -m "feat: away players cannot be selected or trained"
```

---

## Task 5: The request catalog

**Files:**
- Create: `content/player-requests.json`
- Modify: `src/content/schemas.ts`, `src/content/load.ts`
- Test: `src/content/__tests__/schemas.test.ts`

- [ ] **Step 1: Write the catalog**

Create `content/player-requests.json`. The full authored set — all 30, exactly as specified in section 5 of the design doc:

```json
{
  "schemaVersion": 1,
  "tuning": {
    "startSeason": 2,
    "startWeek": 5,
    "baseChancePercent": 25,
    "starFameThreshold": 50,
    "starGoalRank": 2,
    "minSeasonsAtClub": 1,
    "answerWeeks": 2,
    "cadence": {
      "COZY": { "minWeeks": 8, "guaranteeWeeks": 12, "starMinWeeks": 6, "starGuaranteeWeeks": 10 },
      "CHAIRMAN": { "minWeeks": 6, "guaranteeWeeks": 10, "starMinWeeks": 4, "starGuaranteeWeeks": 8 }
    }
  },
  "requests": [
    { "id": "gift-for-my-bae", "title": "Something with diamonds", "line": "Something with diamonds in it. She'll know if it's fake.", "art": ["money-bag", "star-sparkle"], "cost": { "kind": "MONEY_PLAYER", "wageMultiple": 3 } },
    { "id": "the-car", "title": "The car", "line": "I've seen the one. It's yellow.", "art": ["sports-car", "money-bag"], "cost": { "kind": "MONEY_PLAYER", "wageMultiple": 12 } },
    { "id": "gold-boots", "title": "Custom gold boots", "line": "My initials on the heel.", "art": ["boot", "star-sparkle"], "cost": { "kind": "MONEY_PLAYER", "wageMultiple": 4 } },
    { "id": "fly-my-mum-in", "title": "Fly my mum in", "line": "Every home game. She's never seen me play.", "art": ["ticket", "letter"], "cost": { "kind": "MONEY_PLAYER", "wageMultiple": 5 } },
    { "id": "personal-chef", "title": "A personal chef", "line": "I can't eat what's in that canteen.", "art": ["chef-hat", "burger"], "cost": { "kind": "MONEY_PLAYER", "wageMultiple": 6 } },
    { "id": "home-studio", "title": "A studio at home", "line": "I've got bars, boss. I need a booth.", "art": ["microphone", "tv"], "cost": { "kind": "MONEY_PLAYER", "wageMultiple": 8 } },
    { "id": "cousins-wedding", "title": "My cousin's wedding", "line": "I said I'd pay. Loudly. In front of everyone.", "art": ["envelope", "money-bag"], "cost": { "kind": "MONEY_PLAYER", "wageMultiple": 7 } },
    { "id": "matchday-barber", "title": "Matchday barber", "line": "I can't go out there like this.", "art": ["scissors", "scarf"], "cost": { "kind": "MONEY_PLAYER", "wageMultiple": 3 } },
    { "id": "highlights-drone", "title": "A highlights drone", "line": "My agent says I need content.", "art": ["drone", "camera"], "cost": { "kind": "MONEY_PLAYER", "wageMultiple": 4 } },
    { "id": "fix-my-old-pitch", "title": "Fix my old pitch", "line": "The one I grew up on. New fence, new nets.", "art": ["cone", "banner-flag"], "cost": { "kind": "MONEY_PLAYER", "wageMultiple": 3 } },

    { "id": "squad-massage", "title": "Massage therapist", "line": "The lads are stiff. Get someone in.", "art": ["massage-table", "tape-roll"], "cost": { "kind": "MONEY_SQUAD", "billMultiplePercent": 50 }, "grantBonus": { "kind": "CONDITION_SQUAD", "amount": 8 } },
    { "id": "squad-headphones", "title": "Squad headphones", "line": "Everyone. Matching. It's a unity thing.", "art": ["headphones", "shirt"], "cost": { "kind": "MONEY_SQUAD", "billMultiplePercent": 40 }, "grantBonus": { "kind": "MORALE_SQUAD", "amount": 3 } },
    { "id": "charter-the-plane", "title": "Charter the plane", "line": "Six hours on a coach before a cup tie?", "art": ["plane", "ticket"], "cost": { "kind": "MONEY_SQUAD", "billMultiplePercent": 80 }, "grantBonus": { "kind": "CONDITION_SQUAD", "amount": 4 } },
    { "id": "dressing-room-speakers", "title": "Dressing room speakers", "line": "The ones in there are a war crime.", "art": ["speaker", "party-hat"], "cost": { "kind": "MONEY_SQUAD", "billMultiplePercent": 40 }, "grantBonus": { "kind": "MORALE_SQUAD", "amount": 3 } },
    { "id": "bbq-at-my-place", "title": "Barbecue at my place", "line": "Everyone's coming. You're paying.", "art": ["spatula", "party-hat"], "cost": { "kind": "MONEY_SQUAD", "billMultiplePercent": 30 } },

    { "id": "bahamas-fortnight", "title": "Two weeks in the Bahamas", "line": "Sun. Sea. Don't call me.", "art": ["palm-tree", "sunglasses"], "cost": { "kind": "ABSENCE", "weeks": 2 } },
    { "id": "sisters-wedding", "title": "My sister's wedding", "line": "It's abroad. I'm giving a speech.", "art": ["envelope", "letter"], "cost": { "kind": "ABSENCE", "weeks": 1 } },
    { "id": "film-cameo", "title": "A film cameo", "line": "They want me on set. I have a LINE.", "art": ["camera", "sunglasses"], "cost": { "kind": "ABSENCE", "weeks": 2 } },
    { "id": "national-call-up", "title": "National call-up", "line": "My country called. I'm going.", "art": ["banner-flag", "ticket"], "cost": { "kind": "ABSENCE", "weeks": 2 } },
    { "id": "grandmothers-birthday", "title": "Grandmother's birthday", "line": "She's ninety. I'm going home.", "art": ["letter", "dog"], "cost": { "kind": "ABSENCE", "weeks": 1 } },
    { "id": "silent-retreat", "title": "A silent retreat", "line": "A month in the mountains. No football.", "art": ["rain-cloud", "tuning-fork"], "cost": { "kind": "ABSENCE", "weeks": 3 } },

    { "id": "one-big-night-out", "title": "One big night out", "line": "The whole squad. One night. Trust me.", "art": ["drink-can", "party-hat"], "cost": { "kind": "CONDITION_SQUAD", "amount": 10 } },
    { "id": "carnival-weekend", "title": "Carnival weekend", "line": "It's once a year and we're ALL going.", "art": ["banner-flag", "party-hat"], "cost": { "kind": "CONDITION_SQUAD", "amount": 8 } },
    { "id": "all-night-tournament", "title": "All-night tournament", "line": "Video games. Dressing room. Till four.", "art": ["tv", "drink-can"], "cost": { "kind": "CONDITION_SQUAD", "amount": 6 } },

    { "id": "my-own-guru", "title": "My own guru", "line": "He trains me my way for a month.", "art": ["tuning-fork", "cone"], "cost": { "kind": "DRILL_PLAYER", "multiplierPercent": 50, "weeks": 4 } },
    { "id": "ease-off-the-lads", "title": "Ease off the lads", "line": "They're cooked, boss.", "art": ["cone", "rain-cloud"], "cost": { "kind": "DRILL_SQUAD", "multiplierPercent": 60, "weeks": 2 } },
    { "id": "agent-in-the-room", "title": "My agent sits in", "line": "He watches training now. He has notes.", "art": ["briefcase", "tactics-board"], "cost": { "kind": "DRILL_PLAYER", "multiplierPercent": 70, "weeks": 3 } },

    { "id": "ship-my-car-over", "title": "Ship my car over", "line": "It's been in a container for six months.", "art": ["briefcase", "ticket"], "cost": { "kind": "MONEY_PLAYER", "wageMultiple": 4 } },
    { "id": "charity-match-back-home", "title": "A match back home", "line": "One game in my old town. I'm not asking twice.", "art": ["banner-flag", "letter"], "cost": { "kind": "MONEY_PLAYER", "wageMultiple": 6 } },
    { "id": "proper-team-photo", "title": "A proper team photo", "line": "A real photographer. Not your phone.", "art": ["camera", "shirt"], "cost": { "kind": "MONEY_SQUAD", "billMultiplePercent": 50 }, "grantBonus": { "kind": "MORALE_SQUAD", "amount": 3 } }
  ]
}
```

### The four status requests are cut from v1

`give-me-the-armband`, `i-want-the-ten`, `start-me-every-week` and `train-me-first` are **not** in this catalog. They were cut on the owner's call after an audit, and the reason is worth recording so nobody re-adds them casually.

All four collide with live contract-promise machinery in `src/game/contract-promises.ts`:

- `CAPTAINCY` and `JERSEY_10` set `isCaptain` / `shirtNumber` **and** write `contractPromise`. A request that moved the badge would strip `isCaptain` from a player who still holds the promise — the badge would lie while the starting guarantee kept binding.
- `CAPTAINCY` is also in `STARTING_PROMISES`, so it silently guarantees a starting place; a request granting "the armband" would have been granting far more than a badge.
- `pendingTrainingPriorityHolder` uses `find()` over roster order. A second debt source beside the contract one would gate training on whichever player happened to sort first, with the wrong remaining count.
- A season-bounded `GUARANTEED_START` had an off-by-one that left the final league week uncovered.

Cutting them removes the entire `contractPromise` interaction surface from this feature. The four replacements above need **no new sprites** and no new cost kinds. Money, absence, condition and drill requests carry the fantasy on their own.

If they are ever revived, they belong in their own cycle with their own tests, after captaincy is given a mechanical effect worth competing for.

- [ ] **Step 2: Write the failing schema test**

Append to `src/content/__tests__/schemas.test.ts`:

```ts
import playerRequestsJson from '../../../content/player-requests.json';
import { PlayerRequestCatalogSchema } from '../schemas';

describe('player request catalog', () => {
  it('parses the shipped catalog', () => {
    expect(() => PlayerRequestCatalogSchema.parse(playerRequestsJson)).not.toThrow();
  });

  it('ships exactly thirty requests with unique ids', () => {
    const catalog = PlayerRequestCatalogSchema.parse(playerRequestsJson);
    expect(catalog.requests).toHaveLength(30);
    expect(new Set(catalog.requests.map(request => request.id)).size).toBe(30);
  });

  it('rejects a duplicate request id', () => {
    const catalog = PlayerRequestCatalogSchema.parse(playerRequestsJson);
    const duplicated = {
      ...catalog,
      requests: [catalog.requests[0], { ...catalog.requests[1], id: catalog.requests[0].id }],
    };
    expect(() => PlayerRequestCatalogSchema.parse(duplicated)).toThrow('request ID');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/content/__tests__/schemas.test.ts -t "player request catalog"`
Expected: FAIL — `PlayerRequestCatalogSchema` is not exported

- [ ] **Step 4: Add the schema**

In `src/content/schemas.ts`, above `LaunchContentSchema`:

```ts
const RequestCostSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('MONEY_PLAYER'), wageMultiple: z.number().int().min(1).max(50) }),
  z.strictObject({ kind: z.literal('MONEY_SQUAD'), billMultiplePercent: z.number().int().min(5).max(300) }),
  z.strictObject({ kind: z.literal('ABSENCE'), weeks: z.number().int().min(1).max(4) }),
  z.strictObject({ kind: z.literal('CONDITION_SQUAD'), amount: z.number().int().min(1).max(30) }),
  z.strictObject({
    kind: z.literal('DRILL_PLAYER'),
    multiplierPercent: z.number().int().min(10).max(99),
    weeks: z.number().int().min(1).max(8),
  }),
  z.strictObject({
    kind: z.literal('DRILL_SQUAD'),
    multiplierPercent: z.number().int().min(10).max(99),
    weeks: z.number().int().min(1).max(8),
  }),
]);

const RequestGrantBonusSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('CONDITION_SQUAD'), amount: z.number().int().min(1).max(20) }),
  z.strictObject({ kind: z.literal('MORALE_SQUAD'), amount: z.number().int().min(1).max(10) }),
]);

const PlayerRequestSchema = z.strictObject({
  id: idSchema,
  title: displayNameSchema,
  line: z.string().trim().min(1).max(160),
  art: z.tuple([idSchema, idSchema]),
  cost: RequestCostSchema,
  grantBonus: RequestGrantBonusSchema.optional(),
});

const RequestCadenceSchema = z.strictObject({
  minWeeks: z.number().int().min(1).max(30),
  guaranteeWeeks: z.number().int().min(2).max(40),
  starMinWeeks: z.number().int().min(1).max(30),
  starGuaranteeWeeks: z.number().int().min(2).max(40),
}).superRefine((cadence, context) => {
  if (cadence.minWeeks >= cadence.guaranteeWeeks) {
    addIssue(context, ['minWeeks'], 'cadence minWeeks must be below guaranteeWeeks');
  }
  if (cadence.starMinWeeks >= cadence.starGuaranteeWeeks) {
    addIssue(context, ['starMinWeeks'], 'star cadence minWeeks must be below guaranteeWeeks');
  }
});

export const PlayerRequestCatalogSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  tuning: z.strictObject({
    startSeason: z.number().int().min(1).max(10),
    startWeek: z.number().int().min(1).max(30),
    baseChancePercent: z.number().int().min(1).max(100),
    starFameThreshold: z.number().int().min(0).max(99),
    starGoalRank: z.number().int().min(1).max(5),
    /**
     * Tenure is measured in SEASONS, not weeks. `CareerPlayer` carries
     * `seasonsAtClub` and nothing finer, so a week-level knob here would be
     * config that silently does nothing.
     */
    minSeasonsAtClub: z.number().int().min(0).max(5),
    answerWeeks: z.number().int().min(1).max(5),
    cadence: z.strictObject({
      COZY: RequestCadenceSchema,
      CHAIRMAN: RequestCadenceSchema,
    }),
  }),
  requests: z.array(PlayerRequestSchema).min(1),
}).superRefine((catalog, context) => {
  addDuplicateIssues(catalog.requests.map(request => request.id), context, ['requests'], 'request ID');
});

export type PlayerRequestCatalog = z.infer<typeof PlayerRequestCatalogSchema>;
export type PlayerRequestDefinition = z.infer<typeof PlayerRequestSchema>;
export type RequestCost = z.infer<typeof RequestCostSchema>;
export type RequestGrantBonus = z.infer<typeof RequestGrantBonusSchema>;
```

Add it to `LaunchContentSchema`:

```ts
  playerRequests: PlayerRequestCatalogSchema,
```

- [ ] **Step 5: Wire the loader**

In `src/content/load.ts`, add the import and the key:

```ts
import playerRequestsJson from '../../content/player-requests.json';
```

```ts
    playerRequests: playerRequestsJson,
```

- [ ] **Step 6: Add the art cross-check**

Inside the `LaunchContentSchema.superRefine` body, verify every art name exists. Because `EVENT_SPRITE_ROWS` lives in `src/ui/` and content must not import UI, assert the names against a literal list kept in the schema file:

```ts
/**
 * Sprite names the request catalog may reference. Duplicated from
 * `src/ui/event-pixel-sprites.ts` on purpose: `src/content/` must not import
 * from `src/ui/`, and a stale name here is caught by the sprite-coverage test
 * in `src/ui/__tests__/event-pixel-sprites.test.ts`.
 */
const REQUEST_ART_SPRITES = new Set([
  'banner-flag', 'blazer', 'boot', 'burger', 'camera', 'chef-hat', 'cone', 'dog',
  'drink-can', 'drone', 'envelope', 'headphones', 'letter', 'locker',
  'massage-table', 'microphone', 'money-bag', 'palm-tree', 'party-hat', 'plane',
  'rain-cloud', 'scarf', 'scissors', 'shirt', 'speaker', 'spatula', 'sports-car',
  'star-sparkle', 'sunglasses', 'tactics-board', 'tape-roll', 'ticket', 'trophy',
  'tuning-fork', 'tv',
]);
```

```ts
  content.playerRequests.requests.forEach((request, index) => {
    request.art.forEach((sprite, spriteIndex) => {
      if (!REQUEST_ART_SPRITES.has(sprite)) {
        addIssue(
          context,
          ['playerRequests', 'requests', index, 'art', spriteIndex],
          `unknown request art sprite ${sprite}`,
        );
      }
    });
  });
```

- [ ] **Step 7: Run the tests**

Run: `npx jest src/content`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add content/player-requests.json src/content/schemas.ts src/content/load.ts src/content/__tests__/schemas.test.ts
git commit -m "feat: add the player request catalog"
```

---

## Task 6: Nine new sprites

**Files:**
- Modify: `src/ui/event-pixel-sprites.ts`
- Test: `src/ui/__tests__/event-pixel-sprites.test.ts`

- [ ] **Step 1: Write the failing coverage test**

Create or append to `src/ui/__tests__/event-pixel-sprites.test.ts`:

```ts
import playerRequestsJson from '../../../content/player-requests.json';
import { EVENT_SPRITE_ROWS } from '../event-pixel-sprites';

describe('request art coverage', () => {
  it('has a sprite for every name the request catalog references', () => {
    const missing = playerRequestsJson.requests
      .flatMap(request => request.art)
      .filter(sprite => EVENT_SPRITE_ROWS[sprite] === undefined);

    expect(missing).toEqual([]);
  });

  it('keeps every request sprite a 16 by 16 grid', () => {
    for (const sprite of new Set(playerRequestsJson.requests.flatMap(r => r.art))) {
      const rows = EVENT_SPRITE_ROWS[sprite];
      expect(rows).toHaveLength(16);
      for (const row of rows) expect(row).toHaveLength(16);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/__tests__/event-pixel-sprites.test.ts`
Expected: FAIL — missing lists the nine new names

- [ ] **Step 3: Author the nine sprites**

Add to `EVENT_SPRITE_ROWS` in `src/ui/event-pixel-sprites.ts`. Every row must be exactly 16 characters. The palette characters are documented at the top of `src/ui/event-pixel-art.ts`; read that table before drawing and reuse the characters neighbouring sprites already use (`K` outline, `W` white, `D` dark, and the colour letters).

The nine required names are: `sports-car`, `chef-hat`, `microphone`, `scissors`, `massage-table`, `headphones`, `plane`, `speaker`, `palm-tree`.

Draw each in the same style as the existing `boot` and `drone` entries: heavy `K` outline, one or two flat fills, no gradients, silhouette readable at 16px. Example shape to match the house style:

```ts
  'palm-tree': [
    '................',
    '.....KKKK.......',
    '...KKGGGGKK.....',
    '..KGGGGGGGGK....',
    '.KGGKKKKKKGGK...',
    '.KGK..KK..KGK...',
    '..K...KK...K....',
    '......KDK.......',
    '......KDK.......',
    '.....KDDK.......',
    '.....KDK........',
    '....KDDK........',
    '....KDK.........',
    '..KKKKKKK.......',
    '.KYYYYYYYK......',
    '................',
  ],
```

- [ ] **Step 4: Register the request art keys**

`EventPixelScene` takes an `artKey: string` and looks the sprite list up in `EVENT_OBJECTS` (`src/ui/event-pixel-art.ts:43`). Rather than changing that component, derive the request entries from the catalog so the pairing stays authored in content and cannot drift.

In `src/ui/event-pixel-art.ts`, add the import and spread the derived entries into the existing map:

```ts
import playerRequestsJson from '../../content/player-requests.json';
```

```ts
export const EVENT_OBJECTS: Readonly<Record<string, readonly string[]>> = {
  // ... every existing 'event-*' entry stays exactly as it is ...
  ...Object.fromEntries(
    playerRequestsJson.requests.map(request => [`request-${request.id}`, request.art]),
  ),
};
```

Every request therefore renders through `artKey={`request-${id}`}` with no new component and no second copy of the sprite pairing.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/ui/__tests__/event-pixel-sprites.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/event-pixel-sprites.ts src/ui/event-pixel-art.ts src/ui/__tests__/event-pixel-sprites.test.ts
git commit -m "feat: add nine request art sprites"
```

---

## Task 7: Cadence, eligibility and weighting

**Files:**
- Create: `src/game/player-requests.ts`
- Test: `src/game/__tests__/player-requests.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/__tests__/player-requests.test.ts`:

```ts
import {
  requestChancePercent,
  eligibleAskers,
  starQualifiers,
  weightForPlayer,
  pickAsker,
} from '../player-requests';
import type { CareerPlayer } from '../types';

function player(overrides: Partial<CareerPlayer> & { id: string }): CareerPlayer {
  return {
    clubId: 'user-club',
    name: overrides.id,
    role: 'FWD',
    attrs: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50, ref: 50 },
    licensed: false,
    weeklyWage: 500,
    onHeroWage: false,
    contractSeasonsRemaining: 2,
    morale: 60,
    injuryWeeks: 0,
    seasonsAtClub: 2,
    fame: 0,
    condition: 100,
    ...overrides,
  } as CareerPlayer;
}

const COZY = { minWeeks: 8, guaranteeWeeks: 12, starMinWeeks: 6, starGuaranteeWeeks: 10 };

describe('requestChancePercent', () => {
  it('is zero before the minimum gap', () => {
    expect(requestChancePercent(0, COZY, false, 25)).toBe(0);
    expect(requestChancePercent(7, COZY, false, 25)).toBe(0);
  });

  it('opens at the base chance on the minimum week', () => {
    expect(requestChancePercent(8, COZY, false, 25)).toBe(25);
  });

  it('reaches certainty on the guarantee week', () => {
    expect(requestChancePercent(12, COZY, false, 25)).toBe(100);
    expect(requestChancePercent(40, COZY, false, 25)).toBe(100);
  });

  it('uses the tighter star window when a star is on the books', () => {
    expect(requestChancePercent(6, COZY, true, 25)).toBe(25);
    expect(requestChancePercent(10, COZY, true, 25)).toBe(100);
  });
});

describe('weightForPlayer', () => {
  it('is 1 for an anonymous player', () => {
    expect(weightForPlayer(player({ id: 'a', fame: 10 }), [])).toBe(1);
  });

  it('doubles for a famous player', () => {
    expect(weightForPlayer(player({ id: 'a', fame: 60 }), [])).toBe(2);
  });

  it('doubles for a division goal leader', () => {
    expect(weightForPlayer(player({ id: 'a', fame: 10 }), ['a'])).toBe(2);
  });

  it('compounds to 4 for a famous goal leader', () => {
    expect(weightForPlayer(player({ id: 'a', fame: 60 }), ['a'])).toBe(4);
  });
});

describe('eligibleAskers', () => {
  const roster = [
    player({ id: 'fit' }),
    player({ id: 'injured', injuryWeeks: 2 }),
    player({ id: 'away', awayWeeks: 1 }),
    player({ id: 'new', seasonsAtClub: 0 }),
    player({ id: 'listed', transferRequested: true }),
    player({ id: 'previous' }),
  ];

  it('excludes injured, away, transfer-listed and the previous asker', () => {
    const ids = eligibleAskers(roster, {
      lastAskingPlayerId: 'previous',
      minSeasonsAtClub: 0,
      absence: false,
    }).map(candidate => candidate.id);

    expect(ids).toContain('fit');
    expect(ids).not.toContain('injured');
    expect(ids).not.toContain('away');
    expect(ids).not.toContain('listed');
    expect(ids).not.toContain('previous');
  });

  it('excludes a player in their first season at the club', () => {
    const ids = eligibleAskers(roster, { minSeasonsAtClub: 1, absence: false })
      .map(candidate => candidate.id);

    expect(ids).not.toContain('new');
    expect(ids).toContain('fit');
  });

  it('never offers an absence request to the only fit goalkeeper', () => {
    const squad = [player({ id: 'keeper', role: 'GK' }), player({ id: 'striker' })];

    expect(eligibleAskers(squad, { minSeasonsAtClub: 0, absence: true }).map(c => c.id))
      .toEqual(['striker']);
  });

  it('does offer an absence request to a backed-up goalkeeper', () => {
    const squad = [
      player({ id: 'keeper', role: 'GK' }),
      player({ id: 'reserve-keeper', role: 'GK' }),
    ];

    expect(eligibleAskers(squad, { minSeasonsAtClub: 0, absence: true }).map(c => c.id))
      .toEqual(['keeper', 'reserve-keeper']);
  });
});

describe('pickAsker', () => {
  it('is deterministic for the same roll', () => {
    const roster = [player({ id: 'a' }), player({ id: 'b', fame: 60 })];

    expect(pickAsker(roster, [], 0)?.id).toBe('a');
    expect(pickAsker(roster, [], 1)?.id).toBe('b');
    expect(pickAsker(roster, [], 2)?.id).toBe('b');
  });

  it('returns undefined for an empty pool', () => {
    expect(pickAsker([], [], 0)).toBeUndefined();
  });
});

describe('starQualifiers', () => {
  it('names the top two scorers in the division', () => {
    const tallies = [
      { season: 2, playerId: 'a', goals: 9 },
      { season: 2, playerId: 'b', goals: 12 },
      { season: 2, playerId: 'c', goals: 4 },
      { season: 1, playerId: 'd', goals: 30 },
    ];

    expect(starQualifiers(tallies, 2, 2)).toEqual(['b', 'a']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/__tests__/player-requests.test.ts`
Expected: FAIL — `Cannot find module '../player-requests'`

- [ ] **Step 3: Write the implementation**

Create `src/game/player-requests.ts`:

```ts
import { chooseWeightedOutcome } from './event-clock';
import type { CareerPlayer, PlayerSeasonGoalTally } from './types';

export interface RequestCadence {
  readonly minWeeks: number;
  readonly guaranteeWeeks: number;
  readonly starMinWeeks: number;
  readonly starGuaranteeWeeks: number;
}

/**
 * The odds a quiet week produces a request, rising with the drought.
 *
 * Shaped like `quietWeekEventChancePercent` in `event-clock.ts` and for the
 * same reason: a flat weekly chance makes long silences feel like the game
 * forgot about you, and a hard "guaranteed on week N" makes the wait feel
 * scripted. The difference is the floor — nothing at all can happen before
 * `minWeeks`, so the gap between requests is an exact window rather than a
 * distribution with a long left tail.
 */
export function requestChancePercent(
  weeksSinceRequest: number,
  cadence: RequestCadence,
  hasStar: boolean,
  baseChancePercent: number,
): number {
  if (!Number.isInteger(weeksSinceRequest) || weeksSinceRequest < 0) {
    throw new Error('weeks since the last request must be a nonnegative integer');
  }
  const minWeeks = hasStar ? cadence.starMinWeeks : cadence.minWeeks;
  const guaranteeWeeks = hasStar ? cadence.starGuaranteeWeeks : cadence.guaranteeWeeks;
  if (weeksSinceRequest < minWeeks) return 0;
  if (weeksSinceRequest >= guaranteeWeeks) return 100;

  const span = guaranteeWeeks - minWeeks;
  const progress = (weeksSinceRequest - minWeeks) / span;
  // Eased, not linear: the first week past the floor barely moves the odds and
  // the last one moves them a lot, so the wait reads as patience running out.
  return Math.round(baseChancePercent + (100 - baseChancePercent) * progress * progress);
}

/** Player ids ranked in the top `rank` of the division for goals this season. */
export function starQualifiers(
  tallies: readonly PlayerSeasonGoalTally[],
  season: number,
  rank: number,
): string[] {
  return tallies
    .filter(tally => tally.season === season && tally.goals > 0)
    .slice()
    .sort((left, right) => right.goals - left.goals || left.playerId.localeCompare(right.playerId))
    .slice(0, rank)
    .map(tally => tally.playerId);
}

export const STAR_FAME_THRESHOLD = 50;

/**
 * Base 1, doubled once per star qualifier met, so a famous division top scorer
 * asks four times as often as an anonymous squad player. The qualifier list is
 * a parameter rather than a hard-coded fame test so the assists, tackles and
 * saves boards from the separate division-leaders work drop in without
 * touching this function.
 */
export function weightForPlayer(
  player: Pick<CareerPlayer, 'id' | 'fame'>,
  qualifierIds: readonly string[],
): number {
  let weight = 1;
  if ((player.fame ?? 0) >= STAR_FAME_THRESHOLD) weight *= 2;
  if (qualifierIds.includes(player.id)) weight *= 2;
  return weight;
}

export interface EligibilityContext {
  readonly lastAskingPlayerId?: string;
  /**
   * Seasons, not weeks. `CareerPlayer` has `seasonsAtClub` and no finer tenure,
   * so a "4 weeks at the club" rule cannot be honestly implemented and is not
   * pretended at. A player signed this season reads as 0 and cannot ask until
   * a season turns.
   */
  readonly minSeasonsAtClub: number;
  /** True when the drawn request would take the player away from matches. */
  readonly absence: boolean;
}

export function eligibleAskers(
  roster: readonly CareerPlayer[],
  context: EligibilityContext,
): CareerPlayer[] {
  const fitKeepers = roster.filter(player => player.role === 'GK' && isAvailable(player));
  return roster.filter(player => {
    if (!isAvailable(player)) return false;
    if (player.transferRequested === true) return false;
    if (player.id === context.lastAskingPlayerId) return false;
    if ((player.seasonsAtClub ?? 0) < context.minSeasonsAtClub) return false;
    // Sending away the only fit keeper leaves no legal XI, so the request is
    // never offered rather than being offered and then failing to apply.
    if (context.absence && player.role === 'GK' && fitKeepers.length <= 1) return false;
    return true;
  });
}

/** Weighted pick from a roll in `[0, totalWeight)`. */
export function pickAsker(
  pool: readonly CareerPlayer[],
  qualifierIds: readonly string[],
  roll: number,
): CareerPlayer | undefined {
  if (pool.length === 0) return undefined;
  const weights = pool.map(player => weightForPlayer(player, qualifierIds));
  return pool[chooseWeightedOutcome(weights, roll)];
}

/** Total weight of a pool, for sizing the roll. */
export function totalAskerWeight(
  pool: readonly CareerPlayer[],
  qualifierIds: readonly string[],
): number {
  return pool.reduce((sum, player) => sum + weightForPlayer(player, qualifierIds), 0);
}

function isAvailable(player: CareerPlayer): boolean {
  return player.injuryWeeks === 0 && (player.awayWeeks ?? 0) === 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/__tests__/player-requests.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/player-requests.ts src/game/__tests__/player-requests.test.ts
git commit -m "feat: add request cadence, eligibility and weighting"
```

---

## Task 8: Pricing

**Files:**
- Modify: `src/game/player-requests.ts`
- Test: `src/game/__tests__/player-requests.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/game/__tests__/player-requests.test.ts`:

```ts
import { requestMoneyCost, absenceWeeksFor } from '../player-requests';

describe('requestMoneyCost', () => {
  it('prices an individual ask off that player\'s wage', () => {
    expect(requestMoneyCost(
      { kind: 'MONEY_PLAYER', wageMultiple: 3 },
      { playerWeeklyWage: 1400, squadWeeklyWageBill: 20000 },
    )).toBe(4200);
  });

  it('prices a squad ask off the whole wage bill', () => {
    expect(requestMoneyCost(
      { kind: 'MONEY_SQUAD', billMultiplePercent: 50 },
      { playerWeeklyWage: 1400, squadWeeklyWageBill: 20000 },
    )).toBe(10000);
  });

  it('is undefined for a non-money cost', () => {
    expect(requestMoneyCost(
      { kind: 'ABSENCE', weeks: 2 },
      { playerWeeklyWage: 1400, squadWeeklyWageBill: 20000 },
    )).toBeUndefined();
  });

  it('never returns a negative or fractional amount', () => {
    expect(requestMoneyCost(
      { kind: 'MONEY_SQUAD', billMultiplePercent: 30 },
      { playerWeeklyWage: 0, squadWeeklyWageBill: 1 },
    )).toBe(1);
  });
});

describe('absenceWeeksFor', () => {
  it('honours the authored weeks on Chairman', () => {
    expect(absenceWeeksFor(3, 'CHAIRMAN')).toBe(3);
  });

  it('caps at one week on Cozy', () => {
    expect(absenceWeeksFor(3, 'COZY')).toBe(1);
    expect(absenceWeeksFor(1, 'COZY')).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/__tests__/player-requests.test.ts -t "requestMoneyCost"`
Expected: FAIL — the functions are not exported

- [ ] **Step 3: Write the implementation**

Append to `src/game/player-requests.ts`:

```ts
import type { RequestCost } from '../content';
import type { DifficultyMode } from './types';

export interface RequestPricingContext {
  readonly playerWeeklyWage: number;
  readonly squadWeeklyWageBill: number;
}

/**
 * Money asks are priced off wages, never off the cash balance.
 *
 * A percentage of cash looks self-scaling and is not. The economy is fail-soft
 * and a club may legitimately sit below zero, where a percentage of the balance
 * is a payment TO the manager for granting a request; and at a low balance
 * every ask becomes free, so a struggling club would farm loyalty for nothing.
 * Wages scale with division, squad quality and hero status on their own, they
 * are never negative, and they make a star's demands cost more than a
 * reserve's — which is the thing the fiction wants anyway.
 */
export function requestMoneyCost(
  cost: RequestCost,
  context: RequestPricingContext,
): number | undefined {
  if (cost.kind === 'MONEY_PLAYER') {
    return Math.max(1, Math.round(context.playerWeeklyWage * cost.wageMultiple));
  }
  if (cost.kind === 'MONEY_SQUAD') {
    return Math.max(1, Math.round(context.squadWeeklyWageBill * cost.billMultiplePercent / 100));
  }
  return undefined;
}

/** Cozy never loses a player for more than one week. */
export function absenceWeeksFor(authoredWeeks: number, difficulty: DifficultyMode): number {
  return difficulty === 'COZY' ? Math.min(1, authoredWeeks) : authoredWeeks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/__tests__/player-requests.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/player-requests.ts src/game/__tests__/player-requests.test.ts
git commit -m "feat: price player requests off wages"
```

---

## Task 9: Resolution deltas

**Files:**
- Modify: `src/game/player-requests.ts`
- Test: `src/game/__tests__/player-requests.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/game/__tests__/player-requests.test.ts`:

```ts
import { resolutionDeltas } from '../player-requests';

describe('resolutionDeltas', () => {
  it('grants an individual request on Chairman', () => {
    expect(resolutionDeltas('GRANTED', 'PLAYER', 'CHAIRMAN')).toEqual({
      asker: { loyalty: 5, morale: 5 },
      squad: { loyalty: 0, morale: 0 },
    });
  });

  it('grants a squad request as a squad-wide bump plus the asker\'s own', () => {
    expect(resolutionDeltas('GRANTED', 'SQUAD', 'CHAIRMAN')).toEqual({
      asker: { loyalty: 5, morale: 5 },
      squad: { loyalty: 2, morale: 5 },
    });
  });

  it('refuses harder on Chairman than on Cozy', () => {
    expect(resolutionDeltas('REFUSED', 'PLAYER', 'CHAIRMAN').asker)
      .toEqual({ loyalty: -5, morale: -8 });
    expect(resolutionDeltas('REFUSED', 'PLAYER', 'COZY').asker)
      .toEqual({ loyalty: -3, morale: -4 });
  });

  it('charges a lapse at exactly the refusal rate', () => {
    expect(resolutionDeltas('LAPSED', 'PLAYER', 'CHAIRMAN'))
      .toEqual(resolutionDeltas('REFUSED', 'PLAYER', 'CHAIRMAN'));
    expect(resolutionDeltas('LAPSED', 'SQUAD', 'COZY'))
      .toEqual(resolutionDeltas('REFUSED', 'SQUAD', 'COZY'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/__tests__/player-requests.test.ts -t "resolutionDeltas"`
Expected: FAIL — not exported

- [ ] **Step 3: Write the implementation**

Append to `src/game/player-requests.ts`:

```ts
import type { PlayerRequestResolution } from './types';

export type RequestTarget = 'PLAYER' | 'SQUAD';

export interface RequestDelta {
  readonly loyalty: number;
  readonly morale: number;
}

export interface RequestDeltas {
  /** Applied to the asking player alone, on top of any squad delta. */
  readonly asker: RequestDelta;
  /** Applied to every user-club player, the asker included. */
  readonly squad: RequestDelta;
}

const NONE: RequestDelta = { loyalty: 0, morale: 0 };

/**
 * A lapse costs exactly what a refusal costs.
 *
 * The second-week inbox notice prints the number, so the manager was told. A
 * discount for ignoring it would make silence cheaper than deciding, which is
 * the opposite of the lesson.
 */
export function resolutionDeltas(
  resolution: PlayerRequestResolution,
  target: RequestTarget,
  difficulty: DifficultyMode,
): RequestDeltas {
  if (resolution === 'GRANTED') {
    return {
      asker: { loyalty: 5, morale: 5 },
      squad: target === 'SQUAD' ? { loyalty: 2, morale: 5 } : NONE,
    };
  }
  const cozy = difficulty === 'COZY';
  return {
    asker: cozy ? { loyalty: -3, morale: -4 } : { loyalty: -5, morale: -8 },
    squad: target !== 'SQUAD'
      ? NONE
      : cozy
        ? { loyalty: -1, morale: -2 }
        : { loyalty: -2, morale: -3 },
  };
}

/** Which requests hit the whole squad rather than one player. */
export function requestTarget(cost: RequestCost): RequestTarget {
  return cost.kind === 'MONEY_SQUAD'
    || cost.kind === 'CONDITION_SQUAD'
    || cost.kind === 'DRILL_SQUAD'
    ? 'SQUAD'
    : 'PLAYER';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/__tests__/player-requests.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/player-requests.ts src/game/__tests__/player-requests.test.ts
git commit -m "feat: add request resolution deltas"
```

---

## Task 10: Applying a resolution to the game state

**Files:**
- Modify: `src/game/player-requests.ts`
- Test: `src/game/__tests__/player-requests.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/game/__tests__/player-requests.test.ts`:

```ts
import { canAffordRequest, resolvePlayerRequest } from '../player-requests';
import { playerLoyalty } from '../loyalty';

describe('resolvePlayerRequest', () => {
  it('grants a money request, charging cash and lifting loyalty and morale', () => {
    const state = requestFixture('gold-boots');
    const next = resolvePlayerRequest(state, CATALOG, 'GRANTED');
    const asker = next.players.find(p => p.id === state.playerRequests!.pending!.playerId)!;
    const club = next.clubs.find(c => c.id === next.userClubId)!;
    const before = state.clubs.find(c => c.id === state.userClubId)!;

    expect(club.cash).toBe(before.cash - state.playerRequests!.pending!.costAmount!);
    expect(playerLoyalty(asker, next.careerSeed))
      .toBe(playerLoyalty(state.players.find(p => p.id === asker.id)!, state.careerSeed) + 5);
    expect(asker.morale).toBe(65);
    expect(next.playerRequests!.pending).toBeUndefined();
    expect(next.playerRequests!.weeksSinceRequest).toBe(0);
    expect(next.playerRequests!.history[0].resolution).toBe('GRANTED');
  });

  it('caps a Bahamas fortnight at one week on Cozy', () => {
    // The fixture has no explicit difficulty, and DEFAULT_DIFFICULTY is COZY
    // (src/game/difficulty.ts:3), so the authored 2 weeks is capped to 1.
    const state = requestFixture('bahamas-fortnight');
    const next = resolvePlayerRequest(state, CATALOG, 'GRANTED');
    const asker = next.players.find(p => p.id === state.playerRequests!.pending!.playerId)!;

    expect(asker.awayWeeks).toBe(1);
    expect(next.clubs.find(c => c.id === next.userClubId)!.cash)
      .toBe(state.clubs.find(c => c.id === state.userClubId)!.cash);
  });

  it('honours the full two weeks on Chairman', () => {
    const state = { ...requestFixture('bahamas-fortnight'), difficulty: 'CHAIRMAN' as const };
    const next = resolvePlayerRequest(state, CATALOG, 'GRANTED');

    expect(next.players.find(p => p.id === state.playerRequests!.pending!.playerId)!.awayWeeks)
      .toBe(2);
  });

  it('takes an away starter out of the XI immediately', () => {
    const state = requestFixture('bahamas-fortnight');
    const asker = state.players.find(p => p.id === state.playerRequests!.pending!.playerId)!;
    const started = {
      ...state,
      lineups: state.lineups.map(lineup => (lineup.clubId === state.userClubId
        ? { ...lineup, playerIds: [asker.id, ...lineup.playerIds.slice(1)] }
        : lineup)),
    };
    const next = resolvePlayerRequest(started, CATALOG, 'GRANTED');

    expect(next.lineups.find(l => l.clubId === next.userClubId)!.playerIds)
      .not.toContain(asker.id);
    // The guard in buildCareerTeamDef is what would otherwise throw on Saturday.
    expect(() => buildCareerTeamDef(next, next.userClubId)).not.toThrow();
  });

  it('records the spend as a cash transaction', () => {
    const state = requestFixture('gold-boots');
    const next = resolvePlayerRequest(state, CATALOG, 'GRANTED');
    const entry = (next.cashTransactions ?? []).at(-1)!;

    expect(entry.kind).toBe('player-request');
    expect(entry.amount).toBe(-state.playerRequests!.pending!.costAmount!);
  });

  it('refuses to grant what the club cannot pay for', () => {
    const state = requestFixture('the-car');
    const broke = {
      ...state,
      clubs: state.clubs.map(c => (c.id === state.userClubId ? { ...c, cash: 0 } : c)),
    };

    expect(() => resolvePlayerRequest(broke, CATALOG, 'GRANTED')).toThrow('cannot afford');
    expect(() => resolvePlayerRequest(broke, CATALOG, 'REFUSED')).not.toThrow();
  });

  it('grants a squad condition request as a debt applied to every squad player', () => {
    const state = requestFixture('one-big-night-out');
    const next = resolvePlayerRequest(state, CATALOG, 'GRANTED');
    const squad = next.players.filter(p => p.clubId === next.userClubId);

    for (const player of squad) expect(player.condition).toBe(90);
  });

  it('grants a themed bonus alongside the cost', () => {
    const state = requestFixture('squad-massage');
    const drained = {
      ...state,
      players: state.players.map(p => (p.clubId === state.userClubId
        ? { ...p, condition: 70 }
        : p)),
    };
    const next = resolvePlayerRequest(drained, CATALOG, 'GRANTED');

    for (const player of next.players.filter(p => p.clubId === next.userClubId)) {
      expect(player.condition).toBe(78);
    }
  });

  it('refuses without spending cash and drops loyalty and morale', () => {
    const state = requestFixture('gold-boots');
    const next = resolvePlayerRequest(state, CATALOG, 'REFUSED');
    const asker = next.players.find(p => p.id === state.playerRequests!.pending!.playerId)!;

    expect(next.clubs.find(c => c.id === next.userClubId)!.cash)
      .toBe(state.clubs.find(c => c.id === state.userClubId)!.cash);
    expect(asker.morale).toBe(52);
    expect(next.playerRequests!.history[0].resolution).toBe('REFUSED');
  });

  it('records a drill request as a bounded effect and never as a contract promise', () => {
    const state = requestFixture('my-own-guru');
    const next = resolvePlayerRequest(state, CATALOG, 'GRANTED');
    const asker = next.players.find(p => p.id === state.playerRequests!.pending!.playerId)!;

    expect(asker.contractPromise).toBeUndefined();
    expect(next.playerRequests!.effects).toContainEqual({
      kind: 'DRILL_PLAYER',
      playerId: asker.id,
      weeksRemaining: 4,
      multiplierPercent: 50,
    });
  });

  it('throws when there is nothing pending', () => {
    const state = requestFixture('gold-boots');
    const empty = { ...state, playerRequests: { ...state.playerRequests!, pending: undefined } };

    expect(() => resolvePlayerRequest(empty, CATALOG, 'GRANTED')).toThrow('no pending request');
  });
});

describe('canAffordRequest', () => {
  it('is false when the club cannot pay in full', () => {
    const state = requestFixture('the-car');
    const broke = {
      ...state,
      clubs: state.clubs.map(c => (c.id === state.userClubId ? { ...c, cash: 0 } : c)),
    };

    expect(canAffordRequest(broke)).toBe(false);
  });

  it('is true for a request with no money cost even at zero cash', () => {
    const state = requestFixture('bahamas-fortnight');
    const broke = {
      ...state,
      clubs: state.clubs.map(c => (c.id === state.userClubId ? { ...c, cash: 0 } : c)),
    };

    expect(canAffordRequest(broke)).toBe(true);
  });
});
```

Add this helper at the top of the test file. `careerFixture()` is whatever full-career fixture builder the neighbouring `src/game/__tests__` files already use — reuse it, do not write a new one.

```ts
import { requestDefinition, requestMoneyCost, DEFAULT_PLAYER_REQUEST_STATE } from '../player-requests';
import { loadLaunchContent } from '../../content';
import type { GameState } from '../types';

/**
 * Tests may load content; production `src/game/*` may not. Every entry point
 * takes the catalog as an argument, so this is the only place in the request
 * tests that touches the loader.
 */
const CATALOG = loadLaunchContent().playerRequests;

/**
 * A season-2 career with one request already open. Morale and condition are
 * flattened so every delta assertion reads as an absolute number rather than a
 * difference against whatever the fixture happened to roll.
 */
function requestFixture(requestId: string): GameState {
  const base = careerFixture();
  const roster = base.players.filter(player => player.clubId === base.userClubId);
  const asker = roster[1];
  const club = base.clubs.find(candidate => candidate.id === base.userClubId)!;
  const definition = requestDefinition(CATALOG, requestId);
  const costAmount = requestMoneyCost(definition.cost, {
    playerWeeklyWage: asker.weeklyWage,
    squadWeeklyWageBill: club.weeklyWages,
  });

  return {
    ...base,
    season: 2,
    week: 8,
    players: base.players.map(player => (player.clubId !== base.userClubId
      ? player
      : {
          ...player,
          morale: 60,
          condition: 100,
        })),
    playerRequests: {
      ...DEFAULT_PLAYER_REQUEST_STATE,
      pending: {
        requestId,
        playerId: asker.id,
        askedSeason: 2,
        askedWeek: 8,
        ...(costAmount === undefined ? {} : { costAmount }),
        warned: false,
      },
    },
  };
}
```

The fixture makes `roster[1]` the asker, so `roster[0]` stays free for tests that need a second squad player.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/__tests__/player-requests.test.ts -t "resolvePlayerRequest"`
Expected: FAIL — not exported

- [ ] **Step 3: Write the implementation**

Append to `src/game/player-requests.ts`. Import what it needs at the top of the file:

```ts
import { recordCashTransaction } from './cash-transactions';
import { difficultyRules, careerDifficulty } from './difficulty';
import { adjustLoyalty, playerLoyalty } from './loyalty';
import { repairCareerLineupForInjuries } from './squad';
import { SEASON_WEEKS, type GameState, type ActiveRequestEffect } from './types';
import type { PlayerRequestCatalog, PlayerRequestDefinition } from '../content';

export const MAX_PLAYER_REQUEST_HISTORY = 20;

/**
 * The catalog is INJECTED, never loaded here.
 *
 * No production module under `src/game/` imports the content loader — verify
 * with `rg "loadLaunchContent" src/game --glob '!**​/__tests__/**'`, which
 * returns nothing today. Calling it from this file would couple the pure
 * career ring to JSON parsing, make every headless run pay a ~40-80ms zod pass,
 * and give tests no way to substitute a small catalog. Callers in the
 * application layer already hold the parsed content and pass it down.
 */
export function requestDefinition(
  catalog: PlayerRequestCatalog,
  requestId: string,
): PlayerRequestDefinition {
  const definition = catalog.requests.find(candidate => candidate.id === requestId);
  if (definition === undefined) throw new Error(`unknown player request ${requestId}`);
  return definition;
}

/**
 * You cannot grant what the club does not have.
 *
 * NOT the difficulty cash floor. Every other discretionary purchase in the game
 * — scouting (`market-career.ts:209`), youth signings, transfers, drill
 * upgrades — guards on `club.cash < cost`, and the fail-soft floor exists for
 * obligations a manager cannot avoid (wages, upkeep), not for luxuries. Spending
 * past zero would also write a negative `balanceAfter`, which
 * `cashTransactionSchema` rejects as a nonnegative integer — an unsaveable career.
 */
export function canAffordRequest(state: GameState): boolean {
  const pending = state.playerRequests?.pending;
  if (pending?.costAmount === undefined) return true;
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  return club.cash >= pending.costAmount;
}

export function resolvePlayerRequest(
  state: GameState,
  catalog: PlayerRequestCatalog,
  resolution: PlayerRequestResolution,
): GameState {
  const requests = state.playerRequests;
  const pending = requests?.pending;
  if (requests === undefined || pending === undefined) {
    throw new Error('no pending request to resolve');
  }
  // The UI disables the Grant button below the cash floor, but the pure API is
  // the contract. A disabled button is a courtesy; this is the rule.
  if (resolution === 'GRANTED' && !canAffordRequest(state)) {
    throw new Error('the club cannot afford this request');
  }
  const definition = requestDefinition(catalog, pending.requestId);
  const difficulty = careerDifficulty(state);
  const target = requestTarget(definition.cost);
  const deltas = resolutionDeltas(resolution, target, difficulty);
  const granted = resolution === 'GRANTED';

  // Squad-wide condition only moves on a granted request; refusing a night out
  // costs feelings, not legs.
  const conditionDelta = !granted
    ? 0
    : (definition.cost.kind === 'CONDITION_SQUAD' ? -definition.cost.amount : 0)
      + (definition.grantBonus?.kind === 'CONDITION_SQUAD' ? definition.grantBonus.amount : 0);
  const bonusMorale = granted && definition.grantBonus?.kind === 'MORALE_SQUAD'
    ? definition.grantBonus.amount
    : 0;

  const awayWeeks = granted && definition.cost.kind === 'ABSENCE'
    ? absenceWeeksFor(definition.cost.weeks, difficulty)
    : 0;

  const players = state.players.map(player => {
    if (player.clubId !== state.userClubId) return player;
    const isAsker = player.id === pending.playerId;

    const loyaltyDelta = deltas.squad.loyalty + (isAsker ? deltas.asker.loyalty : 0);
    const moraleDelta = deltas.squad.morale
      + bonusMorale
      + (isAsker ? deltas.asker.morale : 0);

    return {
      ...player,
      loyalty: adjustLoyalty(playerLoyalty(player, state.careerSeed), loyaltyDelta),
      morale: Math.max(0, Math.min(100, player.morale + moraleDelta)),
      condition: Math.max(0, Math.min(100, (player.condition ?? 100) + conditionDelta)),
      ...(isAsker && awayWeeks > 0 ? { awayWeeks } : {}),
    };
  });

  const cost = granted ? pending.costAmount ?? 0 : 0;
  // Charge first, then record. `recordCashTransaction` is a recorder, not a
  // mutator — it stamps `balanceAfter: club.cash` and changes nothing — so
  // handing it unchanged state would log a spend that never happened. Same
  // charge-then-record order as scouting and transfers.
  const charged: GameState = cost === 0
    ? { ...state, players }
    : {
        ...state,
        players,
        clubs: state.clubs.map(club => (club.id === state.userClubId
          ? { ...club, cash: club.cash - cost }
          : club)),
      };
  const spent = cost === 0
    ? charged
    : recordCashTransaction(charged, {
        kind: 'player-request',
        label: definition.title,
        amount: -cost,
        referenceId: pending.requestId,
      });

  const settled: GameState = {
    ...spent,
    playerRequests: {
      weeksSinceRequest: 0,
      effects: [...requests.effects, ...grantedEffects(definition.cost, pending.playerId, granted)],
      history: [
        {
          requestId: pending.requestId,
          playerId: pending.playerId,
          season: state.season,
          week: state.week,
          resolution,
          ...(cost === 0 ? {} : { costAmount: cost }),
        },
        ...requests.history,
      ].slice(0, MAX_PLAYER_REQUEST_HISTORY),
      lastAskingPlayerId: pending.playerId,
    },
  };

  // Granting leave mid-week benches a starter, and nothing else would notice
  // until Saturday. Repair now, through the same path weekly settlement and the
  // injury drill already use, so the XI is legal the instant the card closes.
  return awayWeeks > 0 ? repairCareerLineupForInjuries(settled) : settled;
}

/**
 * Request effects are their own list, never `contractPromise`.
 *
 * `CareerPlayer.contractPromise` holds a single object, so writing to it here
 * would silently destroy whatever was agreed at the negotiating table. Only the
 * two drill effects exist; the status requests that would have needed a perk
 * were cut from v1 for exactly this reason.
 */
function grantedEffects(
  cost: RequestCost,
  playerId: string,
  granted: boolean,
): ActiveRequestEffect[] {
  if (!granted) return [];
  if (cost.kind === 'DRILL_PLAYER') {
    return [{
      kind: 'DRILL_PLAYER',
      playerId,
      weeksRemaining: cost.weeks,
      multiplierPercent: cost.multiplierPercent,
    }];
  }
  if (cost.kind === 'DRILL_SQUAD') {
    return [{
      kind: 'DRILL_SQUAD',
      weeksRemaining: cost.weeks,
      multiplierPercent: cost.multiplierPercent,
    }];
  }
  return [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/__tests__/player-requests.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/player-requests.ts src/game/__tests__/player-requests.test.ts
git commit -m "feat: apply granted and refused requests to career state"
```

---

## Task 11: Effects tick and expire

Cutting the status requests removed the dual training-priority source and the season-bounded starting guarantee from this task. What remains is the drill multiplier and its countdown — and **no `contract-promises.ts` changes at all** beyond the away-exemption already made in Task 4.

**Files:**
- Modify: `src/game/player-requests.ts`, `src/game/training.ts`
- Test: `src/game/__tests__/player-requests.test.ts`, `src/game/__tests__/training.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/game/__tests__/player-requests.test.ts`:

```ts
import { tickRequestEffects, drillMultiplierPercent } from '../player-requests';

describe('tickRequestEffects', () => {
  it('counts every effect down and drops the expired ones', () => {
    expect(tickRequestEffects([
      { kind: 'DRILL_SQUAD', weeksRemaining: 2, multiplierPercent: 60 },
      { kind: 'DRILL_PLAYER', playerId: 'a', weeksRemaining: 1, multiplierPercent: 50 },
    ])).toEqual([
      { kind: 'DRILL_SQUAD', weeksRemaining: 1, multiplierPercent: 60 },
    ]);
  });

  it('is a no-op on an empty list', () => {
    expect(tickRequestEffects([])).toEqual([]);
  });
});

describe('drillMultiplierPercent', () => {
  it('is 100 with no effects', () => {
    expect(drillMultiplierPercent([], 'a')).toBe(100);
  });

  it('applies a squad effect to everyone', () => {
    expect(drillMultiplierPercent(
      [{ kind: 'DRILL_SQUAD', weeksRemaining: 2, multiplierPercent: 60 }],
      'a',
    )).toBe(60);
  });

  it('applies a player effect only to that player', () => {
    const effects = [{ kind: 'DRILL_PLAYER' as const, playerId: 'a', weeksRemaining: 2, multiplierPercent: 50 }];
    expect(drillMultiplierPercent(effects, 'a')).toBe(50);
    expect(drillMultiplierPercent(effects, 'b')).toBe(100);
  });

  it('compounds a stacked squad and player effect', () => {
    expect(drillMultiplierPercent([
      { kind: 'DRILL_SQUAD', weeksRemaining: 2, multiplierPercent: 60 },
      { kind: 'DRILL_PLAYER', playerId: 'a', weeksRemaining: 2, multiplierPercent: 50 },
    ], 'a')).toBe(30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/__tests__/player-requests.test.ts -t "tickRequestEffects"`
Expected: FAIL — not exported

- [ ] **Step 3: Write the implementation**

Append to `src/game/player-requests.ts`:

```ts
/** One week of decay; an effect that reaches zero is gone. */
export function tickRequestEffects(
  effects: readonly ActiveRequestEffect[],
): ActiveRequestEffect[] {
  return effects
    .map(effect => ({ ...effect, weeksRemaining: effect.weeksRemaining - 1 }))
    .filter(effect => effect.weeksRemaining > 0);
}

/** Drill gain scale for one player, squad and personal effects compounded. */
export function drillMultiplierPercent(
  effects: readonly ActiveRequestEffect[],
  playerId: string,
): number {
  return effects.reduce((percent, effect) => {
    const applies = effect.kind === 'DRILL_SQUAD'
      || (effect.kind === 'DRILL_PLAYER' && effect.playerId === playerId);
    return applies ? Math.round(percent * (effect.multiplierPercent ?? 100) / 100) : percent;
  }, 100);
}
```

- [ ] **Step 4: Write the failing training test**

Append to `src/game/__tests__/training.test.ts`:

```ts
  it('reduces drill gains while a personal drill effect is live', () => {
    const state = careerFixture();
    const target = state.players.find(p => p.clubId === state.userClubId)!;
    const penalised = {
      ...state,
      playerRequests: {
        weeksSinceRequest: 0,
        history: [],
        effects: [{
          kind: 'DRILL_PLAYER' as const,
          playerId: target.id,
          weeksRemaining: 4,
          multiplierPercent: 50,
        }],
      },
    };

    expect(gainFrom(trainPlayerInstantly(penalised, target.id, 'pace')))
      .toBeLessThan(gainFrom(trainPlayerInstantly(state, target.id, 'pace')));
  });
```

Use the drill path id and gain-reading helper that file's existing tests already use in place of `'pace'` and `gainFrom`.

- [ ] **Step 5: Apply the multiplier in training**

In `src/game/training.ts`, inside the growth helper at line 216 (the one returning `{ value, trainingBonusRemainders, facilityStaBonusRemainder }`), scale `baseGain`:

```ts
  const requestScale = drillMultiplierPercent(state.playerRequests?.effects ?? [], player.id);
  const baseGain = Math.max(
    1,
    Math.round(rolledGain * structuralMultiplier * requestScale / 100),
  );
```

Add the import:

```ts
import { drillMultiplierPercent } from './player-requests';
```

The `Math.max(1, ...)` floor stays: a drill must always be worth something, even at a compounded 30%.

- [ ] **Step 6: Run the tests**

Run: `npx jest src/game/__tests__/player-requests.test.ts src/game/__tests__/training.test.ts`
Expected: PASS

- [ ] **Step 7: Confirm no import cycle**

Run: `npx tsc --noEmit`
Expected: no errors. `training.ts` now imports `player-requests.ts`, which imports `squad.ts`, which imports `lineup.ts`. None of those import `training.ts`, so the graph stays acyclic — a circular-import error here means something was added to `player-requests.ts` that does not belong.

- [ ] **Step 8: Commit**

```bash
git add src/game/player-requests.ts src/game/training.ts src/game/__tests__
git commit -m "feat: request drill effects scale training gains"
```

---

## Task 12: The weekly tick

**Files:**
- Modify: `src/game/player-requests.ts`, `src/game/career.ts`
- Test: `src/game/__tests__/player-requests.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/game/__tests__/player-requests.test.ts`:

```ts
import { advancePlayerRequests, DEFAULT_PLAYER_REQUEST_STATE } from '../player-requests';

describe('advancePlayerRequests', () => {
  it('does nothing before the start season and week', () => {
    const early = { ...requestFixture('gold-boots'), season: 2, week: 4, playerRequests: undefined };
    expect(advancePlayerRequests(early, CATALOG, true).playerRequests)
      .toEqual({ ...DEFAULT_PLAYER_REQUEST_STATE });
  });

  it('counts down away weeks every settled week', () => {
    const state = { ...requestFixture('gold-boots'), playerRequests: DEFAULT_PLAYER_REQUEST_STATE };
    const away = {
      ...state,
      players: state.players.map((p, i) => (i === 0 ? { ...p, awayWeeks: 2 } : p)),
    };

    expect(advancePlayerRequests(away, CATALOG, true).players[0].awayWeeks).toBe(1);
  });

  it('warns in the second week and lapses in the third', () => {
    const state = requestFixture('gold-boots');
    const pending = { ...state.playerRequests!.pending!, askedSeason: 2, askedWeek: 8 };
    const week9 = advancePlayerRequests({
      ...state,
      week: 9,
      playerRequests: { ...state.playerRequests!, pending },
    }, CATALOG, true);
    expect(week9.playerRequests!.pending!.warned).toBe(true);

    const week10 = advancePlayerRequests({
      ...week9,
      week: 10,
      playerRequests: { ...week9.playerRequests!, pending: { ...pending, warned: true } },
    }, CATALOG, true);
    expect(week10.playerRequests!.pending).toBeUndefined();
    expect(week10.playerRequests!.history[0].resolution).toBe('LAPSED');
  });

  it('cancels silently when the asker leaves the club', () => {
    const state = requestFixture('gold-boots');
    const sold = {
      ...state,
      players: state.players.filter(p => p.id !== state.playerRequests!.pending!.playerId),
    };
    const next = advancePlayerRequests(sold, CATALOG, true);

    expect(next.playerRequests!.pending).toBeUndefined();
    expect(next.playerRequests!.history).toHaveLength(0);
  });

  it('cancels when the asker asks for a transfer', () => {
    const state = requestFixture('gold-boots');
    const listed = {
      ...state,
      players: state.players.map(p => (p.id === state.playerRequests!.pending!.playerId
        ? { ...p, transferRequested: true }
        : p)),
    };

    expect(advancePlayerRequests(listed, CATALOG, true).playerRequests!.pending).toBeUndefined();
  });

  it('ticks leave and effects but opens nothing on the season-end path', () => {
    const state = {
      ...requestFixture('gold-boots'),
      playerRequests: { ...DEFAULT_PLAYER_REQUEST_STATE, weeksSinceRequest: 40 },
    };
    const away = {
      ...state,
      players: state.players.map((p, i) => (i === 0 ? { ...p, awayWeeks: 2 } : p)),
    };
    const next = advancePlayerRequests(away, CATALOG, false);

    expect(next.players[0].awayWeeks).toBe(1);
    expect(next.playerRequests!.pending).toBeUndefined();
  });

  it('never opens a second request while one is pending', () => {
    const state = {
      ...requestFixture('gold-boots'),
      playerRequests: { ...requestFixture('gold-boots').playerRequests!, weeksSinceRequest: 40 },
    };

    expect(advancePlayerRequests(state, CATALOG, true).playerRequests!.pending!.requestId)
      .toBe('gold-boots');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/__tests__/player-requests.test.ts -t "advancePlayerRequests"`
Expected: FAIL — not exported

- [ ] **Step 3: Write the implementation**

Append to `src/game/player-requests.ts`:

```ts
import { deterministicCareerEventRoll } from './event-clock';
import type { PlayerRequestState } from './types';

export const DEFAULT_PLAYER_REQUEST_STATE: PlayerRequestState = {
  weeksSinceRequest: 0,
  effects: [],
  history: [],
};

/**
 * A pending request that no longer makes sense, cleared with no penalty.
 *
 * Called from the weekly tick AND from every path that can remove a player or
 * flip them to transfer-listed, because waiting for settlement would leave the
 * UI offering Grant on a player who has already been sold.
 */
export function cancelPendingPlayerRequestIfInvalid(state: GameState): GameState {
  const pending = state.playerRequests?.pending;
  if (pending === undefined) return state;
  const asker = state.players.find(player => player.id === pending.playerId);
  const stillValid = asker !== undefined
    && asker.clubId === state.userClubId
    && asker.transferRequested !== true;
  if (stillValid) return state;
  return {
    ...state,
    playerRequests: { ...state.playerRequests!, pending: undefined },
  };
}

/**
 * One settled week: leave counts down, effects decay, a stale request is warned
 * and then lapsed, and a quiet week may produce a new ask.
 *
 * `openRequests` is false on the season-end path. Requests are a management-week
 * beat; opening one on the week the season ends would hand the manager a card
 * they cannot act on before the clock resets.
 *
 * Every draw is seeded from persisted career data through
 * `deterministicCareerEventRoll`, so saving and reloading cannot re-roll who
 * asks or what they want.
 */
export function advancePlayerRequests(
  state: GameState,
  catalog: PlayerRequestCatalog,
  openRequests: boolean,
): GameState {
  const tuning = catalog.tuning;
  const requests = state.playerRequests ?? DEFAULT_PLAYER_REQUEST_STATE;

  const players = state.players.map(player => ((player.awayWeeks ?? 0) > 0
    ? { ...player, awayWeeks: player.awayWeeks! - 1 }
    : player));
  let next: GameState = cancelPendingPlayerRequestIfInvalid({
    ...state,
    players,
    playerRequests: { ...requests, effects: tickRequestEffects(requests.effects) },
  });

  const started = state.season > tuning.startSeason
    || (state.season === tuning.startSeason && state.week >= tuning.startWeek);
  if (!started || !openRequests) return next;

  const pending = next.playerRequests!.pending;
  if (pending !== undefined) {
    const weeksWaiting = state.week - pending.askedWeek;
    if (weeksWaiting >= tuning.answerWeeks) return resolvePlayerRequest(next, catalog, 'LAPSED');
    if (weeksWaiting >= 1 && !pending.warned) {
      return withRequests(next, {
        ...next.playerRequests!,
        pending: { ...pending, warned: true },
      });
    }
    return next;
  }

  const roster = next.players.filter(player => player.clubId === next.userClubId);
  const qualifiers = starQualifiers(
    next.seasonGoalTallies ?? [],
    next.season,
    tuning.starGoalRank,
  );
  const hasStar = roster.some(player => weightForPlayer(player, qualifiers) > 1);
  const cadence = tuning.cadence[careerDifficulty(next)];
  const weeksSince = next.playerRequests!.weeksSinceRequest + 1;
  next = withRequests(next, { ...next.playerRequests!, weeksSinceRequest: weeksSince });

  const context = {
    careerSeed: next.careerSeed,
    season: next.season,
    week: next.week,
    riskyChoices: 0,
  };
  const chance = requestChancePercent(weeksSince, cadence, hasStar, tuning.baseChancePercent);
  if (deterministicCareerEventRoll(context, 'request:open', 0, 100) >= chance) return next;

  // Pick the asker pool FIRST for the drawn request; if an absence draw leaves
  // nobody eligible — a squad with one fit keeper — fall back to a non-absence
  // request rather than swallowing a roll that already succeeded.
  const drawn = catalog.requests[
    deterministicCareerEventRoll(context, 'request:pick', 1, catalog.requests.length)
  ];
  const definition = pooledDefinition(drawn, catalog, roster, next, tuning, qualifiers, context);
  if (definition === undefined) return next;

  const pool = eligibleAskers(roster, {
    ...(next.playerRequests!.lastAskingPlayerId === undefined
      ? {}
      : { lastAskingPlayerId: next.playerRequests!.lastAskingPlayerId }),
    minSeasonsAtClub: tuning.minSeasonsAtClub,
    absence: definition.cost.kind === 'ABSENCE',
  });
  const asker = pickAsker(
    pool,
    qualifiers,
    deterministicCareerEventRoll(context, 'request:asker', 2, totalAskerWeight(pool, qualifiers)),
  );
  if (asker === undefined) return next;

  const club = next.clubs.find(candidate => candidate.id === next.userClubId)!;
  const costAmount = requestMoneyCost(definition.cost, {
    playerWeeklyWage: asker.weeklyWage,
    squadWeeklyWageBill: club.weeklyWages,
  });

  return withRequests(next, {
    ...next.playerRequests!,
    pending: {
      requestId: definition.id,
      playerId: asker.id,
      askedSeason: next.season,
      askedWeek: next.week,
      ...(costAmount === undefined ? {} : { costAmount }),
      warned: false,
    },
  });
}

/** The drawn request, or the first non-absence one if nobody can be sent away. */
function pooledDefinition(
  drawn: PlayerRequestDefinition,
  catalog: PlayerRequestCatalog,
  roster: readonly CareerPlayer[],
  state: GameState,
  tuning: PlayerRequestCatalog['tuning'],
  qualifiers: readonly string[],
  context: Parameters<typeof deterministicCareerEventRoll>[0],
): PlayerRequestDefinition | undefined {
  const base = {
    ...(state.playerRequests!.lastAskingPlayerId === undefined
      ? {}
      : { lastAskingPlayerId: state.playerRequests!.lastAskingPlayerId }),
    minSeasonsAtClub: tuning.minSeasonsAtClub,
  };
  if (totalAskerWeight(
    eligibleAskers(roster, { ...base, absence: drawn.cost.kind === 'ABSENCE' }),
    qualifiers,
  ) > 0) return drawn;

  const fallbacks = catalog.requests.filter(request => request.cost.kind !== 'ABSENCE');
  if (fallbacks.length === 0) return undefined;
  const replacement = fallbacks[
    deterministicCareerEventRoll(context, 'request:fallback', 3, fallbacks.length)
  ];
  return totalAskerWeight(eligibleAskers(roster, { ...base, absence: false }), qualifiers) > 0
    ? replacement
    : undefined;
}

function withRequests(state: GameState, requests: PlayerRequestState): GameState {
  return { ...state, playerRequests: requests };
}
```

- [ ] **Step 4: Wire it into weekly settlement — exact insertion points**

`settleCurrentWeek` (`src/game/career.ts:335`) has **two** returns, and both already wrap `repairCareerLineupForInjuries` inside `advanceM2WeeklySidecars`. Getting this wrong either double-ticks the clock or leaves a benched-by-leave player in the XI, so patch both explicitly.

Add the import:

```ts
import { advancePlayerRequests } from './player-requests';
```

`settleCurrentWeek` must also receive the catalog. Add it as a parameter and thread it from every caller — the application store already holds parsed content, and the headless harness passes `loadLaunchContent().playerRequests` at its own boundary.

**Season-end return (`career.ts:407`, the `state.week === SEASON_WEEKS` branch).** Replace:

```ts
    const withRecap = recordSeasonRecap(settledState);
    return advanceM2WeeklySidecars(
      repairCareerLineupForInjuries(withRecap),
      state.week,
      cupAlreadyResolved,
    );
```

with:

```ts
    const withRecap = recordSeasonRecap(settledState);
    // openRequests: false — leave and effects still tick, but no card is dealt
    // on the week the season ends and the clock resets.
    const withRequests = advancePlayerRequests(withRecap, catalog, false);
    return advanceM2WeeklySidecars(
      repairCareerLineupForInjuries(withRequests),
      state.week,
      cupAlreadyResolved,
    );
```

**Normal return (`career.ts:431`).** Replace:

```ts
  return advanceM2WeeklySidecars(
    repairCareerLineupForInjuries(settledState),
    state.week,
    cupAlreadyResolved,
  );
```

with:

```ts
  // Runs on `settledState`, which already carries `week + 1`. The pending
  // request therefore stamps `askedWeek` as the week the manager is about to
  // play, so `answerWeeks: 2` means warned next week and lapsed the week after.
  const withRequests = advancePlayerRequests(settledState, catalog, true);
  return advanceM2WeeklySidecars(
    repairCareerLineupForInjuries(withRequests),
    state.week,
    cupAlreadyResolved,
  );
```

Both calls sit **before** `repairCareerLineupForInjuries` on purpose: `advancePlayerRequests` decrements `awayWeeks`, and repair must see the post-decrement flags so a returning player is put back rather than left out for an extra week.

- [ ] **Step 5: Reset the clock at season rollover**

In the season-transition function in the same file, add:

```ts
    playerRequests: {
      weeksSinceRequest: 0,
      // Effects are season-bounded by construction; a drill penalty must not
      // survive into a season the manager never agreed to spend it in.
      effects: [],
      history: state.playerRequests?.history ?? [],
    },
```

- [ ] **Step 6: Cancel on sale, retirement and transfer request**

`advancePlayerRequests` cancels at settlement, but that is a week too late for the UI, which would keep offering Grant on a player who has already left. Call the pure guard at each mutation point:

```ts
  return cancelPendingPlayerRequestIfInvalid(nextState);
```

Add it to the return of: the board forced-sale application in `src/game/board-ultimatum.ts`, the player-sale path in `src/game/market-career.ts`, the retirement processing in `src/game/career.ts`, and wherever `transferRequested` is flipped to true in `src/game/player-wellbeing.ts`.

- [ ] **Step 7: Forbid a second call site**

`advancePlayerRequests` has no settled-week stamp, so it is safe **only** if it runs exactly once per settlement. Stories needed exactly this guard — `eventClock.storySettledWeek` exists because the desk is reconciled on every render and re-rolled without it.

Run: `rg -n "advancePlayerRequests" src --glob '!**/__tests__/**'`
Expected: exactly **two** results, both inside `settleCurrentWeek`. Never call it from the application layer, a view model, or a desk reconcile. If a third call site is ever needed, add a `requestSettledSeason`/`requestSettledWeek` stamp first, mirroring `src/game/event-clock.ts`.

- [ ] **Step 8: Run the tests**

Run: `npx jest src/game`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/game/player-requests.ts src/game/career.ts src/game/board-ultimatum.ts src/game/market-career.ts src/game/player-wellbeing.ts src/game/__tests__/player-requests.test.ts
git commit -m "feat: roll, warn and lapse requests on the weekly tick"
```

---

## Task 13: The inbox warning

**Files:**
- Modify: `src/application/view-models.ts:961,1054`
- Test: `src/application/__tests__/view-models.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/application/__tests__/view-models.test.ts`:

```ts
describe('player request inbox alert', () => {
  function withPending(warned: boolean) {
    const state = careerFixture();
    return {
      ...state,
      season: 2,
      week: 9,
      playerRequests: {
        weeksSinceRequest: 0,
        effects: [],
        history: [],
        pending: {
          requestId: 'gold-boots',
          playerId: state.players.find(p => p.clubId === state.userClubId)!.id,
          askedSeason: 2,
          askedWeek: 8,
          costAmount: 1200,
          warned,
        },
      },
    };
  }

  it('raises an urgent alert once the request has been warned', () => {
    expect(homeProductAlerts(withPending(true)).map(alert => alert.id))
      .toContain('player-request-waiting');
  });

  it('raises nothing while the request is fresh', () => {
    expect(homeProductAlerts(withPending(false)).map(alert => alert.id))
      .not.toContain('player-request-waiting');
  });
});
```

`homeProductAlerts` is the real export at `src/application/view-models.ts:773`. Reuse the `careerFixture` helper that file's existing tests already use.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/application/__tests__/view-models.test.ts -t "player request inbox alert"`
Expected: FAIL — the alert is absent

- [ ] **Step 3: Add the alert**

In `homeProductAlerts` (`src/application/view-models.ts:773`), and at both `:961` and `:1054` where `productAlerts` is assembled for the inbox week plan, append:

```ts
    ...(state.playerRequests?.pending?.warned === true
      ? [{ id: 'player-request-waiting', priority: 'urgent' as const, oneShot: true }]
      : []),
```

Where the inbox renders an alert's copy, add the case. The penalty is stated in full, because a lapse charges exactly the refusal rate and the manager must have been told the number:

```ts
  if (alertId === 'player-request-waiting') {
    const pending = state.playerRequests!.pending!;
    const asker = state.players.find(player => player.id === pending.playerId);
    const catalog = loadLaunchContent().playerRequests;
    const deltas = resolutionDeltas(
      'REFUSED',
      requestTarget(requestDefinition(catalog, pending.requestId).cost),
      careerDifficulty(state),
    );
    return {
      title: 'STILL WAITING',
      detail: `${asker?.name ?? 'A player'} is still waiting on an answer. Leave it and you lose ${Math.abs(deltas.asker.loyalty)} loyalty and ${Math.abs(deltas.asker.morale)} morale.`,
      destination: 'squad-requests' as const,
    };
  }
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/application`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/application/view-models.ts src/application/__tests__/view-models.test.ts
git commit -m "feat: warn about an unanswered request in the inbox"
```

---

## Task 13a: `ON LEAVE` in the squad view model

The design promises an `ON LEAVE · 2 WEEKS` chip, and no task built it. Without this the roster shows an away player as fully available: `view-models.ts:1359` computes `canStart` from `injuryWeeks` alone, and `unavailableLabel` only ever describes an injury.

**Files:**
- Modify: `src/application/view-models.ts:1355-1364`, `src/ui/models.ts`, `src/ui/screens/SquadTrainingScreen.tsx:820`
- Test: `src/application/__tests__/view-models.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/application/__tests__/view-models.test.ts`:

```ts
describe('away players in the squad view model', () => {
  it('cannot start and reads as on leave', () => {
    const state = careerFixture();
    const target = state.players.find(p => p.clubId === state.userClubId)!;
    const away = {
      ...state,
      players: state.players.map(p => (p.id === target.id ? { ...p, awayWeeks: 2 } : p)),
    };
    const row = squadTrainingViewModel(away, /* the other four arguments */)
      .players.find(p => p.playerId === target.id)!;

    expect(row.canStart).toBe(false);
    expect(row.unavailableLabel).toBe('ON LEAVE · 2 WEEKS');
    expect(row.awayWeeks).toBe(2);
  });
});
```

`squadTrainingViewModel` (`src/application/view-models.ts:1379`) takes **five** arguments and its fixture must be a `'full'` career — a shorter call compiles against a default and silently yields an empty roster, so the test would pass vacuously. Copy the exact call shape from the neighbouring training tests.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/application/__tests__/view-models.test.ts -t "away players in the squad"`
Expected: FAIL — `canStart` is `true` and `unavailableLabel` is undefined

- [ ] **Step 3: Add the field to the UI model**

In `src/ui/models.ts`, in `SquadPlayerViewModel` beside `injuryWeeks`:

```ts
  awayWeeks: number;
```

- [ ] **Step 4: Teach the view model about leave**

At `src/application/view-models.ts:1355`, replace:

```ts
        injuryWeeks: player.injuryWeeks,
        licensed: player.licensed,
        canStart: player.injuryWeeks === 0 && !unlicensedHero,
        ...(player.injuryWeeks > 0
          ? { unavailableLabel: `OUT · ${weekCountLabel(player.injuryWeeks)}` }
          : unlicensedHero
            ? { unavailableLabel: 'Hero License required' }
            : {}),
```

with:

```ts
        injuryWeeks: player.injuryWeeks,
        awayWeeks: player.awayWeeks ?? 0,
        licensed: player.licensed,
        canStart: isAvailableForSelection(player) && !unlicensedHero,
        // Injury outranks leave: a player who is somehow both is out for the
        // harder reason, and the Medical Bay is the one the manager can act on.
        ...(player.injuryWeeks > 0
          ? { unavailableLabel: `OUT · ${weekCountLabel(player.injuryWeeks)}` }
          : (player.awayWeeks ?? 0) > 0
            ? { unavailableLabel: `ON LEAVE · ${weekCountLabel(player.awayWeeks!)}` }
            : unlicensedHero
              ? { unavailableLabel: 'Hero License required' }
              : {}),
```

Add `import { isAvailableForSelection } from '../game/lineup';`

- [ ] **Step 5: Show the chip on the profile card**

`SquadTrainingScreen.tsx:820` renders a red `OUT · N WEEKS` block for injury. Add the leave case beside it:

```tsx
      ) : selectedPlayer.awayWeeks > 0 ? (
        <View className="mb-3 border-2 border-b-4 border-gold-dark bg-gold-light p-3">
          <Text className="font-pixel text-base uppercase text-gold-dark">
            ON LEAVE · {selectedPlayer.awayWeeks} {selectedPlayer.awayWeeks === 1 ? 'WEEK' : 'WEEKS'}
          </Text>
          <Text className="mt-1 text-sm text-ink/70">Away on a granted request. Unavailable for selection.</Text>
        </View>
      ) : null}
```

Gold, not red: leave is a consequence the manager chose, not a warning that something went wrong. Keeping red for injury alone means the two read apart at a glance.

- [ ] **Step 6: Check every other reader of `injuryWeeks`**

Run: `rg -n "injuryWeeks" src/application src/ui --glob '!**/__tests__/**'`

Anywhere the answer means "can this player be picked" — matchday selection, the condition warning, the substitution board — must move to `isAvailableForSelection`. Anywhere it means "is this player hurt" — Medical Bay copy, injury alerts — stays exactly as it is.

- [ ] **Step 7: Run the tests**

Run: `npx jest src/application`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/application/view-models.ts src/ui/models.ts src/ui/screens/SquadTrainingScreen.tsx src/application/__tests__/view-models.test.ts
git commit -m "feat: show away players as on leave and unavailable"
```

---

## Task 14: The view model

**Files:**
- Create: `src/application/player-request-view-model.ts`
- Test: `src/application/__tests__/player-request-view-model.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/application/__tests__/player-request-view-model.test.ts`:

```ts
import { playerRequestViewModel } from '../player-request-view-model';

describe('playerRequestViewModel', () => {
  it('is unavailable before season 2 week 5', () => {
    const state = { ...requestFixture('gold-boots'), season: 2, week: 4, playerRequests: undefined };
    expect(playerRequestViewModel(state).available).toBe(false);
  });

  it('is available with no pending request from season 2 week 5', () => {
    const state = { ...requestFixture('gold-boots'), week: 5, playerRequests: { weeksSinceRequest: 0, effects: [], history: [] } };
    const model = playerRequestViewModel(state);

    expect(model.available).toBe(true);
    expect(model.pending).toBeUndefined();
    expect(model.glowing).toBe(false);
  });

  it('glows and prints both button costs while a request is pending', () => {
    const model = playerRequestViewModel(requestFixture('bahamas-fortnight'));

    expect(model.glowing).toBe(true);
    expect(model.pending!.grantLabel).toBe('Out 2 weeks');
    expect(model.pending!.refuseLabel).toBe('−5 loyalty · −8 morale');
    expect(model.pending!.canAfford).toBe(true);
  });

  it('disables granting when the club cannot pay', () => {
    const state = requestFixture('the-car');
    const broke = {
      ...state,
      clubs: state.clubs.map(c => (c.id === state.userClubId ? { ...c, cash: 0 } : c)),
    };

    expect(playerRequestViewModel(broke).pending!.canAfford).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/application/__tests__/player-request-view-model.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/application/player-request-view-model.ts`:

```ts
import { loadLaunchContent } from '../content';
import { careerDifficulty } from '../game/difficulty';
import {
  absenceWeeksFor,
  canAffordRequest,
  requestDefinition,
  requestTarget,
  resolutionDeltas,
} from '../game/player-requests';
import type { GameState, PlayerRequestResolution } from '../game/types';
import type { PlayerRequestDefinition } from '../content';

export interface PendingRequestViewModel {
  readonly requestId: string;
  readonly playerId: string;
  readonly playerName: string;
  readonly playerRole: string;
  readonly lookId?: string;
  readonly title: string;
  readonly line: string;
  /** Feeds `EventPixelScene`; always `request-<id>`. */
  readonly artKey: string;
  readonly grantLabel: string;
  readonly refuseLabel: string;
  readonly canAfford: boolean;
  readonly weeksToAnswer: number;
}

export interface RequestHistoryViewModel {
  readonly label: string;
  readonly resolution: PlayerRequestResolution;
}

export interface PlayerRequestViewModel {
  readonly available: boolean;
  readonly glowing: boolean;
  readonly pending?: PendingRequestViewModel;
  readonly history: readonly RequestHistoryViewModel[];
  readonly emptyDetail: string;
}

/**
 * The application layer is where the catalog is read. `src/game/` takes it as
 * an argument; this is the boundary that supplies it.
 */
export function playerRequestViewModel(state: GameState): PlayerRequestViewModel {
  const catalog = loadLaunchContent().playerRequests;
  const tuning = catalog.tuning;
  const available = state.season > tuning.startSeason
    || (state.season === tuning.startSeason && state.week >= tuning.startWeek);
  const pending = state.playerRequests?.pending;

  const history = (state.playerRequests?.history ?? []).map(entry => ({
    label: `${requestDefinition(catalog, entry.requestId).title} · S${entry.season} W${entry.week}`,
    resolution: entry.resolution,
  }));

  if (!available || pending === undefined) {
    return {
      available,
      glowing: false,
      history,
      emptyDetail: 'The dressing room is quiet. It won’t last.',
    };
  }

  const definition = requestDefinition(catalog, pending.requestId);
  const player = state.players.find(candidate => candidate.id === pending.playerId);
  const difficulty = careerDifficulty(state);
  const refuse = resolutionDeltas('REFUSED', requestTarget(definition.cost), difficulty).asker;

  return {
    available,
    glowing: true,
    history,
    emptyDetail: 'The dressing room is quiet. It won’t last.',
    pending: {
      requestId: definition.id,
      playerId: pending.playerId,
      playerName: player?.name ?? 'A player',
      playerRole: player?.role ?? 'MID',
      ...(player?.lookId === undefined ? {} : { lookId: player.lookId }),
      title: definition.title,
      line: definition.line,
      artKey: `request-${definition.id}`,
      grantLabel: grantLabel(definition, pending.costAmount, difficulty),
      refuseLabel: `−${Math.abs(refuse.loyalty)} loyalty · −${Math.abs(refuse.morale)} morale`,
      canAfford: canAffordRequest(state),
      weeksToAnswer: Math.max(0, tuning.answerWeeks - (state.week - pending.askedWeek)),
    },
  };
}

function grantLabel(
  definition: PlayerRequestDefinition,
  costAmount: number | undefined,
  difficulty: ReturnType<typeof careerDifficulty>,
): string {
  const cost = definition.cost;
  if (cost.kind === 'MONEY_PLAYER' || cost.kind === 'MONEY_SQUAD') {
    return `−${(costAmount ?? 0).toLocaleString('en-GB')}`;
  }
  if (cost.kind === 'ABSENCE') {
    const weeks = absenceWeeksFor(cost.weeks, difficulty);
    return `Out ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  if (cost.kind === 'CONDITION_SQUAD') return `Squad −${cost.amount} condition`;
  if (cost.kind === 'DRILL_PLAYER') return `Their drills ×${cost.multiplierPercent / 100} for ${cost.weeks} weeks`;
  return `Squad drills ×${cost.multiplierPercent / 100} for ${cost.weeks} weeks`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/application/__tests__/player-request-view-model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/application/player-request-view-model.ts src/application/__tests__/player-request-view-model.test.ts
git commit -m "feat: add the player request view model"
```

---

## Task 15: The Requests panel

**Files:**
- Create: `src/ui/screens/SquadRequestsPanel.tsx`

No unit test: Jest runs in the node environment here and importing a screen throws. This is verified in the browser preview at the end.

- [ ] **Step 1: Write the panel**

Create `src/ui/screens/SquadRequestsPanel.tsx`:

```tsx
import { Text, View } from 'react-native';
import { EmptyDocket } from '../components/EmptyDocket';
import { PaperPanel, SectionLabel, StatusChip } from '../components/Scorecard';
import { EventPixelScene } from '../components/EventPixelScene';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import { PixelText } from '../components/PixelText';
import type { PlayerRequestViewModel } from '../../application/player-request-view-model';

export function SquadRequestsPanel({
  viewModel,
  onOpenRequest,
}: {
  viewModel: PlayerRequestViewModel;
  /** Starts the walk-on; the decision card follows it. */
  onOpenRequest: () => void;
}) {
  const pending = viewModel.pending;

  return (
    <View>
      <SectionLabel
        eyebrow="The dressing room"
        title="Requests"
        right={pending ? <StatusChip label={`${pending.weeksToAnswer} WK TO ANSWER`} tone="hero" /> : undefined}
      />

      {pending === undefined ? (
        <EmptyDocket title="No requests" detail={viewModel.emptyDetail} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${pending.playerName} asks: ${pending.title}. Open to decide.`}
          onPress={onOpenRequest}
          className="min-h-24 flex-row items-center border-2 border-b-4 border-blue-dark bg-blue-light p-3"
          style={({ pressed }) => ({
            opacity: pressed ? 0.82 : 1,
            transform: [{ translateY: pressed ? 2 : 0 }],
          })}
        >
          <View className="mr-3"><EventPixelScene artKey={pending.artKey} /></View>
          <View className="min-w-0 flex-1">
            <PixelText className="text-sm uppercase text-blue-dark">{pending.playerName}</PixelText>
            <Text className="mt-1 text-base font-bold text-ink" numberOfLines={1}>{pending.title}</Text>
            <Text className="mt-1 text-sm leading-5 text-ink/60" numberOfLines={2}>
              &ldquo;{pending.line}&rdquo;
            </Text>
          </View>
        </Pressable>
      )}

      {viewModel.history.length > 0 ? (
        <PaperPanel kicker="Recently" title="What you decided" className="mt-4">
          <View className="gap-2">
            {viewModel.history.slice(0, 6).map((entry, index) => (
              <View key={`${entry.label}-${index}`} className="flex-row items-center justify-between gap-3">
                <Text className="min-w-0 flex-1 text-sm text-ink/70" numberOfLines={1}>{entry.label}</Text>
                <StatusChip
                  label={entry.resolution === 'GRANTED' ? 'GRANTED' : entry.resolution === 'REFUSED' ? 'REFUSED' : 'IGNORED'}
                  tone={entry.resolution === 'GRANTED' ? 'success' : 'danger'}
                />
              </View>
            ))}
          </View>
        </PaperPanel>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/ui/screens/SquadRequestsPanel.tsx
git commit -m "feat: add the squad requests panel"
```

---

## Task 16: The tab row and the loyalty tile

**Files:**
- Modify: `src/ui/screens/SquadTrainingScreen.tsx`, `src/ui/models.ts`, `src/application/view-models.ts`

- [ ] **Step 1: Add loyalty and fame to the squad player view model**

In `src/ui/models.ts`, in the `SquadPlayerViewModel` interface beside the existing `morale: number;`:

```ts
  loyalty: number;
```

`fame: number` is already present at line 276. In `src/application/view-models.ts:1444`, beside `morale: player.morale,`:

```ts
        loyalty: playerLoyalty(player, state.careerSeed),
```

with the import `import { playerLoyalty } from '../game/loyalty';`

- [ ] **Step 2: Restructure the profile card metric rows**

In `src/ui/screens/SquadTrainingScreen.tsx` at line 836, the second metric row currently reads Age | Potential | Morale. Move morale down beside loyalty so the two feelings sit together and fame — which now decides who makes requests — becomes visible:

```tsx
      <View className="mt-2 flex-row gap-2">
        <Metric label="Age" value={String(selectedPlayer.age)} />
        <Metric
          label="Potential"
          value={`${selectedPlayer.potentialGrade} · ${selectedPlayer.superChancePercent}% SUPER`}
          tone="positive"
        />
        <Metric label="Fame" value={String(selectedPlayer.fame)} />
      </View>
      <View className="mt-2 flex-row gap-2">
        <Metric label="Morale" value={`${selectedPlayer.morale}%`} />
        <Metric
          label="Loyalty"
          value={String(selectedPlayer.loyalty)}
          tone={selectedPlayer.loyalty <= LOYALTY_WARNING_THRESHOLD ? 'negative' : 'normal'}
        />
        <InfoTip
          align="right"
          text="How much they want to stay. It decides the price of their next contract, and below 30 they will not re-sign at all."
          accessibilityLabel={`Loyalty ${selectedPlayer.loyalty} out of 100. It decides the price of their next contract, and below 30 they will not re-sign at all.`}
        />
      </View>
```

Import the threshold: `import { LOYALTY_WARNING_THRESHOLD } from '../../game/loyalty';`

- [ ] **Step 3: Add the tab row**

`squadTrainingViewModel` (`src/application/view-models.ts:1379`) takes five arguments and its tests pass vacuously unless the fixture is in `'full'` career mode. When you touch its tests, confirm the fixture is a full career and that every call site passes all five arguments — a four-argument call compiles against a defaulted parameter and silently produces an empty roster.

Add two props to `SquadTrainingScreenProps`:

```ts
  /** The Requests tab's model; `available: false` hides the tab row entirely. */
  requestViewModel: PlayerRequestViewModel;
  onOpenRequest: () => void;
```

Add local state and render the row above `SectionFlow`, matching the league's division selector exactly:

```tsx
  const [squadTab, setSquadTab] = useState<'drills' | 'requests'>('drills');
```

```tsx
        {requestViewModel.available ? (
          <View className="mb-4 flex-row gap-1">
            {(['drills', 'requests'] as const).map(tab => {
              const selected = tab === squadTab;
              const glowing = tab === 'requests' && requestViewModel.glowing && !selected;
              return (
                <Pressable
                  key={tab}
                  accessibilityRole="tab"
                  accessibilityLabel={tab === 'requests' && requestViewModel.glowing
                    ? 'Requests tab, one waiting'
                    : `${tab === 'drills' ? 'Drills' : 'Requests'} tab`}
                  accessibilityState={{ selected }}
                  onPress={() => setSquadTab(tab)}
                  className={selected
                    ? 'min-h-14 flex-1 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light px-1 py-2'
                    : 'min-h-14 flex-1 items-center justify-center border-2 border-b-4 border-ink/40 bg-white px-1 py-2'}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.82 : 1,
                    transform: [{ translateY: pressed ? 2 : 0 }],
                    ...(glowing ? GUIDED_ALERT_GLOW : {}),
                  })}
                >
                  <Text className="font-pixel text-sm uppercase text-ink">
                    {tab === 'drills' ? 'Drills' : 'Requests'}
                    {glowing ? '  ●' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
```

Import `GUIDED_ALERT_GLOW` from `../guidance-glow`.

Then branch the body: when `squadTab === 'requests'`, render `<SquadRequestsPanel viewModel={requestViewModel} onOpenRequest={onOpenRequest} />` in place of the `SectionFlow`.

**The style prop must stay object-form.** A function-form `style` on any `Pressable` breaks layout on iOS only — zero height, no taps. This has bitten this codebase twice. The form above returns an object from the function and is correct; do not lift the whole style into a function that returns a style array.

- [ ] **Step 4: Add the bottom-rail marker**

In `src/ui/ManagementShell.tsx`, add an optional prop `squadAlert?: boolean` and, inside the tab map for `tab.id === 'squad'`, render a small dot when it is true. Match the existing glyph styling; a `●` in `text-stamp` beside the glyph is enough.

- [ ] **Step 5: Verify in the browser preview**

The dev server cannot boot in this repo, but the static export can. Run:

```bash
npm run export:web && cp node_modules/canvaskit-wasm/bin/full/canvaskit.wasm dist/
```

Then serve `dist/` and open it with `preview_start`. **Immediately mute it** — the web build auto-plays looping music:

```js
document.querySelectorAll('audio,video').forEach(el => { el.muted = true; })
```

Confirm: the tab row is absent in season 1; present from S2 W5; the Requests tab glows when one is pending; both tabs switch. **Close the preview tab and kill the server when done.**

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/SquadTrainingScreen.tsx src/ui/ManagementShell.tsx src/ui/models.ts src/application/view-models.ts
git commit -m "feat: add the squad requests tab and the loyalty tile"
```

---

## Task 17: The walk-on and the decision card

**Files:**
- Create: `src/ui/PlayerRequestWalkOn.tsx`, `src/ui/PlayerRequestDecisionCard.tsx`
- Modify: `App.tsx`, `src/application/store.ts`

- [ ] **Step 1: Write the walk-on**

Create `src/ui/PlayerRequestWalkOn.tsx`, modelled directly on `src/ui/PlayerWalkOnWelcome.tsx`:

```tsx
import { useWindowDimensions, View } from 'react-native';
import { CharacterSpeechOverlay } from './CharacterSpeechOverlay';
import { PLAYER_SPRITE_CELL, PlayerRunSprite } from '../render/PlayerRunSprite';
import type { TutorialAnchorLayout } from './tutorial-cue-position';
import type { PendingRequestViewModel } from '../application/player-request-view-model';

const SPRITE_SCALE = 4;
const FALLBACK_GROUND_OFFSET = 78;
const MIN_LINE_MS = 2_400;
const MS_PER_CHARACTER = 60;

/**
 * The asking player walks on and says their line, then the decision card
 * follows. Same rig as the new-signing hello on purpose: the manager has
 * already learned that a player walking on means a player is talking to them.
 */
export function PlayerRequestWalkOn({
  request,
  navigationAnchor,
  reduceMotion = false,
  onDone,
}: {
  request: PendingRequestViewModel;
  navigationAnchor?: TutorialAnchorLayout | null;
  reduceMotion?: boolean;
  onDone: () => void;
}) {
  const { height: viewportHeight } = useWindowDimensions();
  const groundOffset = navigationAnchor
    ? Math.max(0, viewportHeight - navigationAnchor.y)
    : FALLBACK_GROUND_OFFSET;

  return (
    <CharacterSpeechOverlay
      lines={[request.line]}
      characterWidth={PLAYER_SPRITE_CELL.width * SPRITE_SCALE}
      characterHeight={PLAYER_SPRITE_CELL.height * SPRITE_SCALE}
      groundOffset={groundOffset}
      autoAdvanceMs={Math.max(MIN_LINE_MS, request.line.length * MS_PER_CHARACTER)}
      reduceMotion={reduceMotion}
      accessibilityLabel={`${request.playerName} says: ${request.line}`}
      onDone={onDone}
    >
      <View>
        <PlayerRunSprite
          playerId={request.playerId}
          role={request.playerRole as never}
          lookId={request.lookId}
          scale={SPRITE_SCALE}
          walking
        />
      </View>
    </CharacterSpeechOverlay>
  );
}
```

- [ ] **Step 2: Write the decision card**

Create `src/ui/PlayerRequestDecisionCard.tsx`:

```tsx
import { Modal, Text, View } from 'react-native';
import { ActionButton, PaperPanel } from './components/Scorecard';
import { EventPixelScene } from './components/EventPixelScene';
import { PixelText } from './components/PixelText';
import type { PendingRequestViewModel } from '../application/player-request-view-model';

export function PlayerRequestDecisionCard({
  request,
  onGrant,
  onRefuse,
}: {
  request: PendingRequestViewModel;
  onGrant: () => void;
  onRefuse: () => void;
}) {
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onRefuse}>
      <View className="flex-1 items-center justify-center bg-ink/70 px-4">
        <PaperPanel
          kicker={`${request.playerName} asks`}
          title={request.title}
          className="w-full max-w-[520px]"
        >
          <View className="flex-row items-center gap-3">
            <EventPixelScene artKey={request.artKey} />
            <Text className="min-w-0 flex-1 text-base leading-6 text-ink/75">
              &ldquo;{request.line}&rdquo;
            </Text>
          </View>

          <View className="mt-4 flex-row gap-2">
            <View className="flex-1">
              <ActionButton
                label="Grant"
                variant="primary"
                disabled={!request.canAfford}
                onPress={onGrant}
                accessibilityLabel={`Grant. ${request.canAfford ? request.grantLabel : 'Not enough in the books'}`}
              />
              <PixelText className="mt-1 text-center text-sm uppercase text-ink/60">
                {request.canAfford ? request.grantLabel : 'Not enough in the books'}
              </PixelText>
            </View>
            <View className="flex-1">
              <ActionButton
                label="Refuse"
                variant="danger"
                onPress={onRefuse}
                accessibilityLabel={`Refuse. ${request.refuseLabel}`}
              />
              <PixelText className="mt-1 text-center text-sm uppercase text-stamp">
                {request.refuseLabel}
              </PixelText>
            </View>
          </View>
        </PaperPanel>
      </View>
    </Modal>
  );
}
```

`ActionButton` takes `variant`, not `tone` (`src/ui/components/Scorecard.tsx:105`). Confirm `'danger'` is a member of `ButtonVariant` at line 88 and substitute the file's own destructive variant name if it differs.

- [ ] **Step 3: Add the store action**

In `src/application/store.ts`, add an action alongside the existing career mutations:

```ts
  resolvePlayerRequest(resolution: PlayerRequestResolution): void {
    const state = requireCareer();
    // The store is an application-layer module, so it is allowed to read
    // content; the pure resolver is not, which is why the catalog is passed in.
    const catalog = loadLaunchContent().playerRequests;
    setCareer(resolvePlayerRequestPure(state, catalog, resolution));
    queueCareerSave();
  },
```

Match the file's own naming for `requireCareer`, `setCareer` and its save-coalescing call; do not introduce a new save path. Import the pure function under an alias so it does not shadow the action name.

- [ ] **Step 4: Wire the overlays into App.tsx**

Near the existing `PlayerWalkOnWelcome` render at `App.tsx:1865`, add a two-stage overlay driven by local state: opening a request sets `requestStage` to `'walk-on'`; the walk-on's `onDone` moves it to `'card'`; granting or refusing dispatches the store action and clears it.

- [ ] **Step 5: Verify in the browser preview**

Same export-and-serve loop as Task 16, with the same mute-on-load step. Advance to a week with a pending request, open the Requests tab, tap the card, and confirm the player walks on, speaks, the card appears, and both buttons resolve. **Close the tab and kill the server.**

- [ ] **Step 6: Commit**

```bash
git add src/ui/PlayerRequestWalkOn.tsx src/ui/PlayerRequestDecisionCard.tsx App.tsx src/application/store.ts
git commit -m "feat: add the request walk-on and decision card"
```

---

## Task 18: Bert's briefing

**Files:**
- Modify: `content/assistant-guide.json`, `src/game/assistant-guide.ts`, `src/ui/bert-beat-moments.ts`, `src/application/view-models.ts`

- [ ] **Step 1: Register the sequence id**

In `src/game/assistant-guide.ts`, add to `M2_ASSISTANT_GUIDE_SEQUENCE_IDS`, after `'national-cup'`:

```ts
  'player-requests',
```

- [ ] **Step 2: Author the sequence**

Add to the `sequences` array in `content/assistant-guide.json`:

```json
{
  "id": "player-requests",
  "inbox": {
    "title": "A WORD FROM THE DRESSING ROOM",
    "detail": "One of yours wants a favour."
  },
  "destination": "squad-requests",
  "pages": [{
    "kicker": "The dressing room",
    "title": "They want things now",
    "body": [
      "Players with a name start asking for things. A gift, a spa day, two weeks in the sun.",
      "Say yes, it costs you now. Say no, it costs you at contract time — they remember."
    ],
    "focus": "squad-requests",
    "objective": "OPEN THE REQUESTS TAB.",
    "buttonLabel": "Let's hear it."
  }]
}
```

The `destination` and `focus` values must be added to whatever enums `src/content/schemas.ts` validates them against, and `squad-requests` must be added to the `AssistantGuideFocus` and `ManagerTipDestination` unions the UI reads.

- [ ] **Step 3: Pair the faces**

In `src/ui/bert-beat-moments.ts`, add to `AUTHORED`:

```ts
  // Dressing-room gossip, then he points at the tab that will carry it.
  'player-requests': ['confiding', 'pointing-out'],
```

- [ ] **Step 4: Queue it at season 2 week 5**

Where `dueGuides` is computed in `src/application/view-models.ts` (feeding lines 961 and 1054), add the gate:

```ts
    ...(state.season > 2 || (state.season === 2 && state.week >= 5)
      ? ['player-requests' as const]
      : []),
```

Queuing the same sequence repeatedly is harmless — the flag machinery deduplicates.

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: PASS. Existing tests that assert the exact count of guide sequences or their order must be updated; adding an id at the end of the list keeps index-based assertions stable.

- [ ] **Step 6: Commit**

```bash
git add content/assistant-guide.json src/game/assistant-guide.ts src/ui/bert-beat-moments.ts src/application/view-models.ts src/content/schemas.ts
git commit -m "feat: Bert introduces player requests in season 2"
```

---

## Task 19: The balance harness stance

**Files:**
- Modify: `src/game/headless.ts`
- Create: `src/audit/__tests__/request-cost-probe.test.ts`

- [ ] **Step 1: Suppress request opens in the harness**

Auto-refusing every pending request is the wrong tool, even though it spends no cash. It still drives morale down and drags loyalty toward the no-renewal cliff — and because resolving a request resets the drought counter, it produces the **maximum possible** request throughput, which is more cumulative damage than any real career would take.

Do not open requests at all in headless runs instead. `advancePlayerRequests` already takes an `openRequests` flag for the season-end path; reuse it. In `src/game/headless.ts`, thread `openRequests: false` through the harness's `settleCurrentWeek` call so leave and effects still tick — there will be none — and no card is ever dealt.

```ts
// The harness measures the economy, not the dressing room. A request it never
// answers would bleed morale and loyalty on a schedule no player would produce,
// so the harness career simply never receives one.
```

Confirm the harness passes the flag explicitly rather than relying on a default of `true`.

- [ ] **Step 2: Write the grant-everything probe**

Create `src/audit/__tests__/request-cost-probe.test.ts` following the shape of the existing `src/audit/__tests__/stat-yield-probe.test.ts`. Run one full season with every request granted, and report total cash spent, total weeks lost to absences, and closing loyalty across the squad. Assert only loose bounds — the probe exists to make the number visible, not to pin it:

```ts
    expect(spent).toBeGreaterThan(0);
    expect(spent).toBeLessThan(club.cash + 200_000);
```

- [ ] **Step 3: Run the harness**

Run: `npm test`
Expected: PASS, including every pre-existing balance assertion

- [ ] **Step 4: Commit**

```bash
git add src/game/headless.ts src/audit/__tests__/request-cost-probe.test.ts
git commit -m "test: measure the cost of granting every request"
```

---

## Task 20: Final verification

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: PASS, zero failures

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Confirm the golden replay is untouched**

Run: `npx jest src/sim`
Expected: PASS with **no golden-replay snapshot update**. If the snapshot changed, something reached into `src/sim/` that should not have — find it and revert it. `ENGINE_VERSION` must not be bumped by this work.

- [ ] **Step 4: Confirm purity**

Run: `rg -n "Math.random|Date.now|react-native" src/game/player-requests.ts src/game/loyalty.ts`
Expected: no output

- [ ] **Step 5: Browser sweep**

Export, serve, mute on load, and walk the whole feature: season 1 has no tab row; S2 W5 delivers Bert's briefing; a pending request glows both the rail and the sub-tab; the walk-on plays; both buttons resolve; loyalty and morale move on the player card; an ignored request produces the inbox warning and then lapses. **Close the tab and kill the server.**

- [ ] **Step 6: Review the diff, then commit**

Run: `git status --short`

Stage the files this plan named and nothing else. **Do not run `git add -A`** — this repository is worked by several concurrent sessions and the tree routinely carries another session's uncommitted changes, so a blanket add commits someone else's work.

```bash
git add src/game src/application src/ui src/persistence src/content content docs/superpowers
git commit -m "feat: player requests, loyalty and the squad requests tab"
```
