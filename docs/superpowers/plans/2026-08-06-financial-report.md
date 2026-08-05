# Financial Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the post-match Match Summary modal as the animated "Financial Report" — slot-machine ledger reveals, seeded gate/merch variance with surge events, facility multiplier beats — per `docs/superpowers/specs/2026-08-06-financial-report-design.md` (the spec; council-audited; its §-references are used throughout).

**Architecture:** Variance rolls once at settlement in the pure game ring (`src/game`), seeded from persisted career data, and saves a `reveal` breakdown on the ledger line; the UI replays saved truth only. A dedicated audio controller owns the four report cues. New UI components (`SlotAmount`, `FinancialStatement`, `SurgeBanner`) implement the reveal state machine inside the existing modal shell.

**Tech Stack:** TypeScript, React Native (plain `Animated`), react-native-skia (`Canvas`/`Rect` pixel art), expo-audio, zod, Jest.

**Worktree:** already isolated (`claude/match-summary-financial-redesign-ee490a`). Commit after every task.

**Verification commands** (used throughout):
- Tests: `npx jest <path> --runTestsByPath` (single file) / `npm test` (suite, includes the opening-economy balance harness — nothing in `src/audit` except `*-probe` tests is excluded)
- Types: `npx tsc --noEmit`

---

### Task 1: Variance roll module (game ring)

**Files:**
- Create: `src/game/finance-variance.ts`
- Test: `src/game/__tests__/finance-variance.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/game/__tests__/finance-variance.test.ts
import { applyVariancePercent, matchdayVarianceRoll } from '../finance-variance';

describe('matchdayVarianceRoll', () => {
  it('is deterministic for identical inputs', () => {
    const a = matchdayVarianceRoll(123456, 1, 5, 'league-gate');
    const b = matchdayVarianceRoll(123456, 1, 5, 'league-gate');
    expect(a).toEqual(b);
  });

  it('rolls independently per source in the same week', () => {
    const seeds = Array.from({ length: 200 }, (_, i) => i * 7919 + 13);
    const gate = seeds.map(seed => matchdayVarianceRoll(seed, 2, 9, 'league-gate').percent);
    const merch = seeds.map(seed => matchdayVarianceRoll(seed, 2, 9, 'merch').percent);
    expect(gate).not.toEqual(merch);
  });

  it('always lands inside a legal band and surge matches the band', () => {
    for (let seed = 0; seed < 500; seed += 1) {
      for (const source of ['league-gate', 'cup-gate', 'merch'] as const) {
        const roll = matchdayVarianceRoll(seed, 1 + (seed % 3), 1 + (seed % 29), source);
        expect(Number.isSafeInteger(roll.percent)).toBe(true);
        if (roll.surge) {
          expect(roll.percent).toBeGreaterThanOrEqual(11);
          expect(roll.percent).toBeLessThanOrEqual(20);
        } else {
          expect(roll.percent).toBeGreaterThanOrEqual(-10);
          expect(roll.percent).toBeLessThanOrEqual(10);
        }
      }
    }
  });

  it('surges close to 10% of the time over a fixed seed grid', () => {
    let surges = 0;
    const total = 3000;
    for (let i = 0; i < total; i += 1) {
      if (matchdayVarianceRoll(i * 2654435761 + 1, 1, 5, 'merch').surge) surges += 1;
    }
    // Deterministic grid: assert the exact measured count once known; the
    // tolerance below guards the initial red run only. After the first green
    // run, replace with `expect(surges).toBe(<measured>)`.
    expect(surges).toBeGreaterThan(total * 0.07);
    expect(surges).toBeLessThan(total * 0.13);
  });

  it('rejects non-safe-integer inputs', () => {
    expect(() => matchdayVarianceRoll(0.5, 1, 1, 'merch')).toThrow();
    expect(() => matchdayVarianceRoll(1, -1, 1, 'merch')).toThrow();
  });
});

describe('applyVariancePercent', () => {
  it('applies the rolled percent with round()', () => {
    expect(applyVariancePercent(1000, 10)).toBe(1100);
    expect(applyVariancePercent(1000, -10)).toBe(900);
    expect(applyVariancePercent(999, 15)).toBe(1149); // round(1148.85)
    expect(applyVariancePercent(0, 20)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/game/__tests__/finance-variance.test.ts --runTestsByPath` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/game/finance-variance.ts
import { mulberry32 } from '../sim/rng';
import type { LedgerLineReveal } from './types';

export type VarianceSource = LedgerLineReveal['source'];

/** Distinct stream per source: both gate lines share ledger kind 'tickets'. */
const SOURCE_SALT: Readonly<Record<VarianceSource, number>> = {
  'league-gate': 0x1f83d9ab,
  'cup-gate': 0x5be0cd19,
  merch: 0x9b05688c,
};

export interface VarianceRoll {
  /** −10…+10 when surge is false; 11…20 when surge is true. */
  percent: number;
  surge: boolean;
}

/**
 * The weekly income roll for one variance source. Seeded exclusively from
 * persisted career data (the deterministicCareerEventRoll pattern), so
 * save/reload can never re-spin and Quick Result banks the same money as a
 * watched match. Consumes no RNG from any other stream.
 */
export function matchdayVarianceRoll(
  careerSeed: number,
  season: number,
  week: number,
  source: VarianceSource,
): VarianceRoll {
  if (!Number.isSafeInteger(careerSeed)) throw new Error('variance careerSeed must be a safe integer');
  if (!Number.isSafeInteger(season) || season < 1) throw new Error('variance season must be a positive integer');
  if (!Number.isSafeInteger(week) || week < 1) throw new Error('variance week must be a positive integer');
  const seed = (
    careerSeed
    ^ Math.imul(season, 0x9e3779b1)
    ^ Math.imul(week, 0x85ebca6b)
    ^ SOURCE_SALT[source]
  ) >>> 0;
  const rng = mulberry32(seed);
  const surge = Math.floor(rng() * 10) === 0;
  const percent = surge
    ? 11 + Math.floor(rng() * 10)   // uniform 11…20
    : -10 + Math.floor(rng() * 21); // uniform −10…+10
  return { percent, surge };
}

/** round(base × (100+p)/100) — variance applies to the base, before multipliers. */
export function applyVariancePercent(base: number, percent: number): number {
  if (!Number.isSafeInteger(base) || base < 0) throw new Error('variance base must be a nonnegative safe integer');
  const varied = Math.round(base * (100 + percent) / 100);
  if (!Number.isSafeInteger(varied)) throw new Error('varied amount exceeded safe integer range');
  return varied;
}
```

Note: this imports `LedgerLineReveal` from `./types`, added in the same commit (Step 4) so the module compiles.

- [ ] **Step 4: Add the reveal types to `src/game/types.ts`** — directly below the `LedgerLine` interface (~line 293):

```ts
/**
 * Saved breakdown of a varied income line, written once at settlement so the
 * Financial Report replays saved truth and never recomputes money at display
 * time. Identity values are stored explicitly (multiplierPercent 100, counts
 * 0/1, adjacency zeros) rather than omitted.
 */
export type LedgerLineReveal =
  | {
      source: 'league-gate' | 'cup-gate';
      /** Post-variance base the reel lands on first. Always > 0. */
      base: number;
      /** −10…+20; 11…20 iff surge. */
      variancePercent: number;
      surge: boolean;
      /** 100 + 50 × combined operational Stadium Stand level; 100 when none. */
      multiplierPercent: number;
      /** Operational stand buildings; 0 when none. */
      facilityCount: number;
    }
  | {
      source: 'merch';
      /** Varied per-level income (what one Lv1 shop makes). Always > 0. */
      base: number;
      variancePercent: number;
      surge: boolean;
      /** Combined operational Fan Shop level, ≥ 1. */
      multiplierTimes: number;
      /** Operational shop buildings, ≥ 1. */
      facilityCount: number;
      /** merchIncomeBonusPercent at settlement; 0 if none. */
      adjacencyPercent: number;
      /** floor(base × multiplierTimes × adjacencyPercent / 100); 0 if none. */
      adjacencyAmount: number;
    };
```

and extend `LedgerLine`:

```ts
export interface LedgerLine {
  kind: LedgerLineKind;
  label: string;
  amount: number;
  /** Stable identity for cash awards that must survive retries and reloads. */
  idempotencyKey?: string;
  /** Present only on varied income lines from report-eligible settlements. */
  reveal?: LedgerLineReveal;
}
```

- [ ] **Step 5: Run tests** → PASS. Then pin the exact surge count measured in the grid test (replace the tolerance assertions with `expect(surges).toBe(<measured>)`).

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: add seeded matchday income variance roll"`

---

### Task 2: Settlement attaches variance + reveals

**Files:**
- Modify: `src/game/career.ts` (`settlementLines` ~line 792, `homeGateIncome` ~1025, `weeklyMerchandiseIncome` ~1039)
- Test: `src/game/__tests__/finance-reveal-settlement.test.ts` (new)

- [ ] **Step 1: Write the failing tests.** Build states with the same helpers the existing settlement tests use (see `src/game/__tests__/career.test.ts` for the state-builder conventions — reuse its fixture/club builders rather than inventing new ones). Cover, as separate `it` cases:

```ts
// src/game/__tests__/finance-reveal-settlement.test.ts — shape of each case:
// 1. Determinism: advanceWeek twice from structuredClone'd identical states →
//    byte-identical settled lines (JSON.stringify equality).
// 2. Home league week: 'League home gate' line has reveal.source 'league-gate';
//    reconstruction holds: amount === base + Math.floor(base * (multiplierPercent - 100) / 100).
// 3. Merch line (shop built): reveal.source 'merch';
//    amount === base * multiplierTimes + adjacencyAmount;
//    adjacencyAmount === Math.floor(base * multiplierTimes * adjacencyPercent / 100).
// 4. Away-match week: no gate line at all; merch line still carries a reveal.
// 5. Quiet week (no user fixture): merch line has NO reveal and equals the
//    baseline weeklyMerchandiseIncome value.
// 6. Season-final week (week === SEASON_WEEKS): no reveals on any line.
// 7. Cup home week: cup gate line carries reveal.source 'cup-gate'; a week that
//    is BOTH a league and cup home week carries three reveal-capable lines
//    with three independent rolls.
// 8. Zero-fan home fixture: gate line amount 0 and NO reveal.
// 9. Constant lines (wages, upkeep, subsidy, sponsor, prize): never a reveal.
// 10. Variance bounds at scale: iterate ~100 careerSeeds; every gate/merch
//     line's variancePercent ∈ [−10,20], surge ⇔ band 11…20.
```

Every case asserts through the public API (`advanceWeek`/`completeMatchday` → `state.ledgers`), not by calling private helpers.

- [ ] **Step 2: Run to verify failure** → reveals are undefined.

- [ ] **Step 3: Implement in `career.ts`.**

(a) Imports: add `matchdayVarianceRoll`, `applyVariancePercent` from `./finance-variance`; add `LedgerLineReveal` to the types import.

(b) Eligibility helper (place next to `settlementLines`):

```ts
/**
 * Variance rolls only on settlements the Financial Report presents (§5 of the
 * spec): a played user fixture this week, and never the season-final
 * settlement, which routes to the season review instead of the report.
 */
function varianceEligibleSettlement(state: GameState): boolean {
  if (state.week === SEASON_WEEKS) return false;
  const playedLeague = state.fixtures.some(fixture =>
    fixture.season === state.season
    && fixture.week === state.week
    && fixture.status === 'played'
    && (fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId));
  if (playedLeague) return true;
  const currentCup = state.m2?.nationalCups.find(cup => cup.season === state.season);
  const currentRound = currentCup?.rounds.find(round => (
    CUP_SETTLEMENT_WEEKS[round.number - 1] === state.week
  ));
  return currentRound?.fixtures.some(fixture =>
    fixture.status === 'played'
    && (fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId),
  ) ?? false;
}
```

(c) Facility counting. Extend the existing loops into count-aware helpers (keep `gridStadiumStandLevel` exported and delegating):

```ts
function gridStadiumStands(grid: FacilityGridState | undefined): { level: number; count: number } {
  if (grid === undefined) return { level: 0, count: 0 };
  let level = 0;
  let count = 0;
  for (const building of grid.buildings) {
    if (building.type !== 'stadium-stand') continue;
    if (!isFacilityOperational(grid, building.id)) continue;
    level = checkedAdd(level, building.level, 'combined Stadium Stand level');
    count += 1;
  }
  return { level, count };
}

export function gridStadiumStandLevel(grid: FacilityGridState | undefined): number {
  return gridStadiumStands(grid).level;
}

function gridFanShops(grid: FacilityGridState | undefined): { level: number; count: number } {
  if (grid === undefined) return { level: 0, count: 0 };
  let level = 0;
  let count = 0;
  for (const building of grid.buildings) {
    if (building.type !== 'fan-shop') continue;
    if (!isFacilityOperational(grid, building.id)) continue;
    level = checkedAdd(level, building.level, 'combined Fan Shop level');
    count += 1;
  }
  return { level, count };
}
```

(d) Rewrite the two income functions around a shared varied core. **Baseline signatures and call sites for projections stay** (`homeGateIncome`, `weeklyMerchandiseIncome`), but merch moves to per-level rounding (§6 — deltas ≤ floor(N/2) dollars):

```ts
export function homeGateIncome(state: GameState, userClub: ClubState, label: string): number {
  return gateIncomeFromBase(state, rawGateBase(userClub, label)).amount;
}

function rawGateBase(userClub: ClubState, label: string): number {
  const attendance = sixtyPercentOf(userClub.fans);
  return checkedMultiply(attendance, userClub.ticketPrice, label);
}

function gateIncomeFromBase(state: GameState, base: number): { amount: number; standLevel: number } {
  const standLevel = gridStadiumStandLevel(state.facilities.grid);
  if (standLevel === 0) return { amount: base, standLevel };
  const bonus = Math.floor(checkedMultiply(
    base,
    standLevel * STADIUM_STAND_GATE_BONUS_PERCENT_PER_LEVEL,
    'Stadium Stand gate bonus',
  ) / 100);
  return { amount: checkedAdd(base, bonus, 'home gate income'), standLevel };
}

function homeGateIncomeWithReveal(
  state: GameState,
  userClub: ClubState,
  label: string,
  source: 'league-gate' | 'cup-gate',
): { amount: number; reveal?: LedgerLineReveal } {
  const rawBase = rawGateBase(userClub, label);
  if (!varianceEligibleSettlement(state) || rawBase <= 0) {
    return { amount: gateIncomeFromBase(state, rawBase).amount };
  }
  const roll = matchdayVarianceRoll(state.careerSeed, state.season, state.week, source);
  const base = applyVariancePercent(rawBase, roll.percent);
  const { amount, standLevel } = gateIncomeFromBase(state, base);
  const { count } = gridStadiumStands(state.facilities.grid);
  return {
    amount,
    reveal: {
      source,
      base,
      variancePercent: roll.percent,
      surge: roll.surge,
      multiplierPercent: 100 + standLevel * STADIUM_STAND_GATE_BONUS_PERCENT_PER_LEVEL,
      facilityCount: count,
    },
  };
}

/** A small recurring return for building a Fan Shop, with the documented adjacency bonus. */
export function weeklyMerchandiseIncome(state: GameState, userClub: ClubState): number {
  return merchandiseIncomeFromPerLevel(state, rawMerchPerLevel(userClub)).amount;
}

function rawMerchPerLevel(userClub: ClubState): number {
  // One merchandise unit per two fans per shop level makes the income building
  // repay itself within the opening season at the D5 supporter floor.
  return Math.floor(requireSafeInteger(userClub.fans, 'club fans') / 2);
}

function merchandiseIncomeFromPerLevel(state: GameState, perLevel: number): {
  amount: number; level: number; adjacencyPercent: number; adjacencyAmount: number;
} {
  const grid = state.facilities.grid;
  const { level } = gridFanShops(grid);
  if (grid === undefined || level === 0) {
    return { amount: 0, level, adjacencyPercent: 0, adjacencyAmount: 0 };
  }
  const afterMultiplier = checkedMultiply(perLevel, level, 'Fan Shop merchandise base');
  const adjacencyPercent = facilityEffects(grid).merchIncomeBonusPercent;
  const adjacencyAmount = Math.floor(checkedMultiply(
    afterMultiplier,
    adjacencyPercent,
    'Fan Shop merchandise adjacency bonus',
  ) / 100);
  return {
    amount: checkedAdd(afterMultiplier, adjacencyAmount, 'Fan Shop merchandise income'),
    level,
    adjacencyPercent,
    adjacencyAmount,
  };
}

function weeklyMerchandiseIncomeWithReveal(
  state: GameState,
  userClub: ClubState,
): { amount: number; reveal?: LedgerLineReveal } {
  const rawPerLevel = rawMerchPerLevel(userClub);
  if (!varianceEligibleSettlement(state) || rawPerLevel <= 0) {
    return { amount: merchandiseIncomeFromPerLevel(state, rawPerLevel).amount };
  }
  const roll = matchdayVarianceRoll(state.careerSeed, state.season, state.week, 'merch');
  const base = applyVariancePercent(rawPerLevel, roll.percent);
  const result = merchandiseIncomeFromPerLevel(state, base);
  if (result.level === 0 || base <= 0) {
    return { amount: result.amount };
  }
  const { count } = gridFanShops(state.facilities.grid);
  return {
    amount: result.amount,
    reveal: {
      source: 'merch',
      base,
      variancePercent: roll.percent,
      surge: roll.surge,
      multiplierTimes: result.level,
      facilityCount: count,
      adjacencyPercent: result.adjacencyPercent,
      adjacencyAmount: result.adjacencyAmount,
    },
  };
}
```

(e) In `settlementLines`, replace the three push sites:

```ts
  if (homeFixture !== undefined) {
    const gate = homeGateIncomeWithReveal(state, userClub, 'ticket revenue', 'league-gate');
    lines.push({
      kind: 'tickets',
      label: 'League home gate',
      amount: gate.amount,
      ...(gate.reveal === undefined ? {} : { reveal: gate.reveal }),
    });
  }
```

```ts
  if (currentCupRound !== undefined && homeCupFixture !== undefined) {
    const cupGate = homeGateIncomeWithReveal(state, userClub, 'Hero Cup ticket revenue', 'cup-gate');
    lines.push({
      kind: 'tickets',
      label: `${CUP_DISPLAY_NAME} ${currentCupRound.label} home gate`,
      amount: cupGate.amount,
      ...(cupGate.reveal === undefined ? {} : { reveal: cupGate.reveal }),
    });
  }
```

```ts
  const merchandise = weeklyMerchandiseIncomeWithReveal(state, userClub);
  if (merchandise.amount > 0) {
    lines.push({
      kind: 'merch',
      label: 'Fan Shop merchandise',
      amount: merchandise.amount,
      ...(merchandise.reveal === undefined ? {} : { reveal: merchandise.reveal }),
    });
  }
```

- [ ] **Step 4: Run the new test file** → PASS.

- [ ] **Step 5: Run the full game/application suites and update pinned dollar expectations.** `npm test`. Expected breakage: settlement-integration tests with pinned amounts (e.g. `src/game/__tests__/m2-weekly-integration.test.ts`, `src/application/__tests__/*finances*`, store tests) now differ on match weeks by the deterministic roll, and quiet-week merch by ≤ floor(N/2) from the rounding change. Recompute each pinned value by reading the test's actual output — the new values are deterministic. Do NOT touch `src/audit` assertions; if `opening-economy-balance.test.ts` fails, apply the spec §5 contingency (season-1 clamp in `matchdayVarianceRoll` callers is NOT the mechanism — instead add the clamp inside `matchdayVarianceRoll` via an optional `options?: { minPercent?: number }` parameter passed from the two `WithReveal` functions when `state.season === 1`), re-run, and if it still fails STOP and surface to the owner.

- [ ] **Step 6: Commit** — `git commit -am "feat: settle gate and merch income with seeded variance and saved reveals"`

---

### Task 3: Codec — reveal sanitization

**Files:**
- Modify: `src/persistence/game-state-codec.ts` (ledger schema ~line 109; normalization passes ~line 2040)
- Test: `src/persistence/__tests__/ledger-reveal-sanitize.test.ts` (new; follow the existing codec test conventions in `src/persistence/__tests__/`)

- [ ] **Step 1: Write the failing tests.** Encode a valid state whose latest ledger has (a) a gate line with a valid reveal including `variancePercent: -7`, (b) a merch line with a valid reveal; decode; expect both reveals preserved exactly. Then hand-corrupt the JSON (decode → mutate → re-encode as the codec's tests do) for each strip case and expect: decode succeeds, `line.amount` intact, `line.reveal` gone:
  - `source: 'merch'` on a `kind: 'tickets'` line (source/kind mismatch)
  - `variancePercent: 25` with `surge: true` (out of band)
  - `variancePercent: 15` with `surge: false` (band/flag disagreement)
  - `base: 0` (zero base)
  - gate reveal where `base + floor(base × (multiplierPercent−100)/100) !== amount` (reconstruction mismatch)
  - merch reveal where `adjacencyAmount !== floor(base × multiplierTimes × adjacencyPercent / 100)` (adjacency mismatch)
  - `multiplierTimes: 0` on merch (constraint violation)
  - `reveal: "garbage"` (not an object)

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement.** Add a reveal schema next to `ledgerLineSchema` — used ONLY by the sanitizer (never wired into the state schema, so a bad reveal can never fail whole-save validation):

```ts
const gateRevealSchema = z.object({
  source: z.enum(['league-gate', 'cup-gate']),
  base: safeInteger.refine(v => v > 0),
  variancePercent: safeInteger.refine(v => v >= -10 && v <= 20),
  surge: z.boolean(),
  multiplierPercent: safeInteger.refine(v => v >= 100),
  facilityCount: safeInteger.refine(v => v >= 0),
});

const merchRevealSchema = z.object({
  source: z.literal('merch'),
  base: safeInteger.refine(v => v > 0),
  variancePercent: safeInteger.refine(v => v >= -10 && v <= 20),
  surge: z.boolean(),
  multiplierTimes: safeInteger.refine(v => v >= 1),
  facilityCount: safeInteger.refine(v => v >= 1),
  adjacencyPercent: safeInteger.refine(v => v >= 0),
  adjacencyAmount: safeInteger.refine(v => v >= 0),
});

const ledgerLineRevealSchema = z.discriminatedUnion('source', [
  gateRevealSchema.omit({ source: true }).extend({ source: z.enum(['league-gate', 'cup-gate']) }),
  merchRevealSchema,
]);
```

(If the `omit/extend` dance fights zod's discriminated-union typing, define the two arms directly as above — `gateRevealSchema` already carries its own `source` enum, so `z.discriminatedUnion('source', [gateRevealSchema, merchRevealSchema])` is the simpler correct form. Use whichever compiles cleanly under the repo's zod version.)

Then the sanitize pass, applied where the codec runs its other pre-validation normalizations (~line 2040, alongside the existing recoverable-data fixups — match the surrounding function style):

```ts
/**
 * Fail-soft reveal repair (spec §10): a malformed or inconsistent reveal is
 * dropped — and only the reveal — so the line and its authoritative amount
 * always load. Never rejects the save in either direction.
 */
function sanitizeLedgerReveals(state: { ledgers?: unknown }): void {
  if (!Array.isArray(state.ledgers)) return;
  for (const ledger of state.ledgers) {
    if (typeof ledger !== 'object' || ledger === null) continue;
    const lines = (ledger as { lines?: unknown }).lines;
    if (!Array.isArray(lines)) continue;
    for (const line of lines) {
      if (typeof line !== 'object' || line === null) continue;
      const candidate = line as { kind?: unknown; amount?: unknown; reveal?: unknown };
      if (candidate.reveal === undefined) continue;
      if (!revealIsConsistent(candidate)) delete candidate.reveal;
    }
  }
}

function revealIsConsistent(line: { kind?: unknown; amount?: unknown; reveal?: unknown }): boolean {
  const parsed = ledgerLineRevealSchema.safeParse(line.reveal);
  if (!parsed.success) return false;
  const reveal = parsed.data;
  if (typeof line.amount !== 'number' || !Number.isSafeInteger(line.amount)) return false;
  if (reveal.surge !== (reveal.variancePercent >= 11)) return false;
  if (reveal.source === 'merch') {
    if (line.kind !== 'merch') return false;
    const afterMultiplier = reveal.base * reveal.multiplierTimes;
    if (!Number.isSafeInteger(afterMultiplier)) return false;
    const expectedAdjacency = Math.floor(afterMultiplier * reveal.adjacencyPercent / 100);
    if (reveal.adjacencyAmount !== expectedAdjacency) return false;
    return afterMultiplier + reveal.adjacencyAmount === line.amount;
  }
  if (line.kind !== 'tickets') return false;
  const bonus = Math.floor(reveal.base * (reveal.multiplierPercent - 100) / 100);
  if (!Number.isSafeInteger(reveal.base + bonus)) return false;
  return reveal.base + bonus === line.amount;
}
```

Call `sanitizeLedgerReveals(...)` from the same place the codec applies its other normalizations, before final validation. `GAME_SCHEMA_VERSION` does NOT bump.

- [ ] **Step 4: Run tests** → PASS. Run the full persistence suite: `npx jest src/persistence --runTestsByPath src/persistence/__tests__/*.test.ts` (or `npm test`).

- [ ] **Step 5: Commit** — `git commit -am "feat: fail-soft ledger reveal sanitization in the save codec"`

---

### Task 4: View models — reveal pass-through + settlement week

**Files:**
- Modify: `src/ui/models.ts` (~line 263 and ~line 306)
- Modify: `src/application/view-models.ts` (`postMatchViewModel` ~line 2498)
- Test: extend `src/application/__tests__/store.test.ts` or the view-model test file that already covers `postMatchViewModel` (locate with `grep -rn "postMatchViewModel" src/application/__tests__`)

- [ ] **Step 1: Write the failing test.** After a settled home match with a shop and stands, `store.postMatch.ledger` lines for gate/merch carry `reveal` equal to the settled `LedgerLine.reveal`, and `postMatch.settlementSeason`/`settlementWeek` equal the settled week. Finances view model lines (`clubFinancesViewModel(...).ledger[n]`) have no `reveal` property.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement.** In `src/ui/models.ts`:

```ts
import type { LedgerLineReveal } from '../game/types'; // add to existing type imports

export interface LedgerLineViewModel {
  id: string;
  label: string;
  amount: number;
  kind: 'income' | 'expense' | 'neutral';
}

/** Post-match statement rows only: the Finances ledger stays undressed. */
export interface PostMatchLedgerLineViewModel extends LedgerLineViewModel {
  reveal?: LedgerLineReveal;
}
```

In `PostMatchViewModel` change `ledger: readonly LedgerLineViewModel[]` to `ledger: readonly PostMatchLedgerLineViewModel[]` and add:

```ts
  /** Settled week identity — the deterministic banner/toy seed (spec §7). */
  settlementSeason: number;
  settlementWeek: number;
```

In `postMatchViewModel` (view-models.ts ~2498):

```ts
    ledger: (ledger?.lines ?? []).map((line, index) => ({
      id: `${before.season}-${before.week}-${index}`,
      label: line.label,
      amount: line.amount,
      kind: line.amount > 0 ? 'income' : line.amount < 0 ? 'expense' : 'neutral',
      ...(line.reveal === undefined ? {} : { reveal: line.reveal }),
    })),
    settlementSeason: before.season,
    settlementWeek: before.week,
```

- [ ] **Step 4: Run tests** → PASS. `npx tsc --noEmit`.

- [ ] **Step 5: Commit** — `git commit -am "feat: pass ledger reveals and settlement week through the post-match view model"`

---

### Task 5: Audio assets + report SFX controller + App wiring

**Files:**
- Create: `assets/audio/sfx/ledger-spin.wav`, `assets/audio/sfx/ledger-thunk.wav`
- Create: `src/render/financial-report-sfx.ts`
- Modify: `App.tsx` (volume effect ~line 953; teardown effect ~line 986)
- Test: `src/render/__tests__/financial-report-sfx.test.ts` (mock `expo-audio` exactly as `src/render/__tests__/management-sfx.test.ts` does)

- [ ] **Step 1: Convert and add the assets** (already staged in the session scratchpad; the canonical commands, matching `flame-up.wav`'s pcm_s16le/48k/stereo):

```bash
ffmpeg -y -i "/Users/joemacprom5/Library/Mobile Documents/com~apple~CloudDocs/sounds/progress.webm" -ar 48000 -ac 2 -c:a pcm_s16le assets/audio/sfx/ledger-spin.wav
ffmpeg -y -i "/Users/joemacprom5/Library/Mobile Documents/com~apple~CloudDocs/sounds/thunk.webm" -ar 48000 -ac 2 -c:a pcm_s16le assets/audio/sfx/ledger-thunk.wav
```

- [ ] **Step 2: Write the failing controller tests.** Mock `expo-audio` with recording fake players (the management-sfx test file shows the exact mock shape: `createAudioPlayer` returning `{ play, pause, remove, release, seekTo: jest.fn(() => Promise.resolve()), volume, loop }`). Cases:
  - `playLedgerSpin()` then `stopLedgerSpin()` before the seek promise resolves → the late `play` never fires (generation token).
  - `playLedgerSpin()` twice rapidly → second call restarts (seek+play), no double-play from the first.
  - `playSurgeIgnition()` starts flame-up one-shot AND the crackle loop player (loop=true); `stopSurgeBed()` pauses the loop; calling it twice is safe.
  - `setFinancialReportSfxMasterVolume(0)` silences every player (volume 0 on all).
  - `stopAllFinancialReportSfx()` pauses everything; `teardownFinancialReportSfx()` removes/releases all players and a later `playLedgerThunk()` re-inits without throwing.

- [ ] **Step 3: Run to verify failure.**

- [ ] **Step 4: Implement `src/render/financial-report-sfx.ts`.** Model the lazy-init/teardown structure on `management-sfx.ts` and the loop handling on `audio.ts`:

```ts
/**
 * Report-owned audio for the Financial Report modal (spec §9): the slot-spin
 * bed, the landing thunk, and the two surge cues. Deliberately NOT in the
 * management-sfx registry — the report needs a loop player, per-cue gain, and
 * cancellation around async seek/play, none of which the one-shot registry has.
 */
import type { AudioPlayer, AudioSource } from 'expo-audio';

const SPIN_SOURCE: AudioSource = require('../../assets/audio/sfx/ledger-spin.wav');
const THUNK_SOURCE: AudioSource = require('../../assets/audio/sfx/ledger-thunk.wav');
const FLAME_UP_SOURCE: AudioSource = require('../../assets/audio/sfx/flame-up.wav');
const CRACKLE_SOURCE: AudioSource = require('../../assets/audio/sfx/flame-loop.m4a');

// Per-cue gain under the shared master volume: the spin bed sits low so the
// thunk and flame reads land above it.
const SPIN_GAIN = 0.6;
const THUNK_GAIN = 1.0;
const FLAME_UP_GAIN = 0.9;
const CRACKLE_GAIN = 0.5;

let spinPlayer: AudioPlayer | null = null;
let thunkPlayer: AudioPlayer | null = null;
let flameUpPlayer: AudioPlayer | null = null;
let cracklePlayer: AudioPlayer | null = null;
let masterVolume = 1;
let ready = false;
/** Bumped on every stop/start; async seek callbacks check it before playing. */
let spinGeneration = 0;
let crackleGeneration = 0;
let crackleActive = false;

function init(): void {
  if (ready) return;
  try {
    const mod = require('expo-audio') as typeof import('expo-audio');
    spinPlayer = mod.createAudioPlayer(SPIN_SOURCE);
    thunkPlayer = mod.createAudioPlayer(THUNK_SOURCE);
    flameUpPlayer = mod.createAudioPlayer(FLAME_UP_SOURCE);
    cracklePlayer = mod.createAudioPlayer(CRACKLE_SOURCE);
    cracklePlayer.loop = true;
    ready = true;
    applyVolumes();
  } catch {
    spinPlayer = thunkPlayer = flameUpPlayer = cracklePlayer = null;
  }
}

function applyVolumes(): void {
  if (spinPlayer) spinPlayer.volume = SPIN_GAIN * masterVolume;
  if (thunkPlayer) thunkPlayer.volume = THUNK_GAIN * masterVolume;
  if (flameUpPlayer) flameUpPlayer.volume = FLAME_UP_GAIN * masterVolume;
  if (cracklePlayer) cracklePlayer.volume = CRACKLE_GAIN * masterVolume;
}

function seekThenPlay(player: AudioPlayer | null, generation: number, isCurrent: () => boolean): void {
  if (player === null) return;
  try {
    player.pause();
    void player.seekTo(0).then(() => {
      if (!isCurrent()) return; // stopped or superseded while seeking
      try { player.play(); } catch { /* device audio loss is non-fatal */ }
    });
  } catch { /* non-fatal */ }
}

export function playLedgerSpin(): void {
  init();
  spinGeneration += 1;
  const generation = spinGeneration;
  seekThenPlay(spinPlayer, generation, () => generation === spinGeneration);
}

export function stopLedgerSpin(): void {
  spinGeneration += 1;
  try { spinPlayer?.pause(); } catch { /* non-fatal */ }
}

export function playLedgerThunk(): void {
  init();
  // The thunk is fire-and-forget; a retrigger restarts it, which is the wanted
  // machine-gun feel under rapid skips.
  seekThenPlay(thunkPlayer, 0, () => true);
}

export function playSurgeIgnition(): void {
  init();
  seekThenPlay(flameUpPlayer, 0, () => true);
  crackleGeneration += 1;
  crackleActive = true;
  const generation = crackleGeneration;
  seekThenPlay(cracklePlayer, generation, () => generation === crackleGeneration && crackleActive);
}

export function stopSurgeBed(): void {
  crackleGeneration += 1;
  crackleActive = false;
  try { cracklePlayer?.pause(); } catch { /* non-fatal */ }
}

export function stopAllFinancialReportSfx(): void {
  stopLedgerSpin();
  stopSurgeBed();
  try { thunkPlayer?.pause(); } catch { /* non-fatal */ }
  try { flameUpPlayer?.pause(); } catch { /* non-fatal */ }
}

export function setFinancialReportSfxMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  applyVolumes();
}

export function teardownFinancialReportSfx(): void {
  stopAllFinancialReportSfx();
  for (const player of [spinPlayer, thunkPlayer, flameUpPlayer, cracklePlayer]) {
    try {
      player?.remove();
      player?.release();
    } catch { /* one bad player must not block the rest */ }
  }
  spinPlayer = thunkPlayer = flameUpPlayer = cracklePlayer = null;
  ready = false;
}
```

Check `src/render/audio-lifecycle.ts` for the looping-owner registration contract (the file's header names "every looping owner"); if it exposes a register function used by menu/match audio, register `stopAllFinancialReportSfx` as the suspend handler and nothing on resume (spec §9: a suspend that outlives the row resumes to silence — the FinancialStatement component restarts cues itself when a new row begins).

- [ ] **Step 5: Wire `App.tsx`.** In the volume effect add `setFinancialReportSfxMasterVolume(devVolume);`; in the unmount cleanup add `teardownFinancialReportSfx();`. Add both imports.

- [ ] **Step 6: Run tests** → PASS. `npx tsc --noEmit`.

- [ ] **Step 7: Commit** — `git commit -am "feat: financial report audio controller and owner-supplied ledger SFX"`

---

### Task 6: Pixel art — crowd + merch toys

**Files:**
- Create: `src/ui/finance-pixel-art.ts`
- Test: `src/ui/__tests__/finance-pixel-art.test.ts`

- [ ] **Step 1: Write the failing tests.**

```ts
import { CROWD_SPRITE_IDS, MERCH_TOY_IDS, financeSpriteRows, pickMerchToys } from '../finance-pixel-art';

describe('finance pixel art', () => {
  it('every sprite is a 16x16 grid over known palette keys', () => {
    for (const id of [...CROWD_SPRITE_IDS, ...MERCH_TOY_IDS]) {
      const rows = financeSpriteRows(id);
      expect(rows).toHaveLength(16);
      for (const row of rows) expect(row).toHaveLength(16);
    }
  });

  it('ships exactly ten merch toys', () => {
    expect(MERCH_TOY_IDS).toHaveLength(10);
  });

  it('picks 4-5 toys deterministically from season and week', () => {
    const a = pickMerchToys(2, 9);
    const b = pickMerchToys(2, 9);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(4);
    expect(a.length).toBeLessThanOrEqual(5);
    expect(new Set(a).size).toBe(a.length);
    expect(pickMerchToys(2, 10)).not.toEqual(a); // different week, different mix (true for this seed pair)
  });
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement.** Follow the `event-pixel-art.ts` format exactly: 16×16 character grids over a local palette (reuse the same palette letters/colors as `EVENT` art so the art style matches — copy the `PALETTE` map). Export:

```ts
export const CROWD_SPRITE_IDS = ['fan-cheer-a', 'fan-cheer-b', 'fan-cheer-c', 'fan-cheer-d', 'fan-cheer-e'] as const;
export const MERCH_TOY_IDS = [
  'toy-scarf', 'toy-ball', 'toy-foam-finger', 'toy-bobblehead', 'toy-plush-mascot',
  'toy-snow-globe', 'toy-boot-keychain', 'toy-jersey', 'toy-card-pack', 'toy-club-mug',
] as const;
export type FinanceSpriteId = typeof CROWD_SPRITE_IDS[number] | typeof MERCH_TOY_IDS[number];
export function financeSpriteRows(id: FinanceSpriteId): readonly string[] { /* lookup */ }
export interface SpriteRun { x: number; y: number; width: number; color: string }
export function financeSpriteRuns(id: FinanceSpriteId): readonly SpriteRun[] { /* row-run-length encode non-'.' cells */ }
export function pickMerchToys(season: number, week: number): FinanceSpriteId[] {
  const seed = (Math.imul(season, 0x9e3779b1) ^ Math.imul(week, 0x85ebca6b) ^ 0x6d2b79f5) >>> 0;
  const rng = mulberry32(seed);
  const count = 4 + Math.floor(rng() * 2);
  const pool = [...MERCH_TOY_IDS];
  const picked: FinanceSpriteId[] = [];
  for (let i = 0; i < count; i += 1) {
    picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return picked;
}
```

(`mulberry32` imported from `../sim/rng` — UI code may import the pure sim ring.) The run encoder walks each row and emits `{x, y, width, color}` for maximal same-color spans, skipping `.` (transparent) — mirror how `eventSpriteRuns` in `event-pixel-art.ts` does it and keep the same `EVENT_SPRITE_CELL`-style scale constants (`FINANCE_SPRITE_CELL = 16`, `FINANCE_SPRITE_SCALE = 4`).

Author the 15 grids (5 cheering chibi fans with raised arms in varied kit colors + confetti pixels; 10 toys as listed). Art direction: chunky `K` ink outlines like the cast portraits, docs/11 palette letters. Two reference grids to set the drawing style (author the rest to match):

```ts
'toy-ball': [
  '................',
  '................',
  '.....KKKKKK.....',
  '...KKWWWWWWKK...',
  '..KWWWKKWWWWWK..',
  '..KWWKKKKWWWWK..',
  '.KWWWKKKKWWWWWK.',
  '.KWKKWWWWKKWWWK.',
  '.KWKKWWWWKKWWWK.',
  '.KWWWKKKKWWWWWK.',
  '..KWWKKKKWWWWK..',
  '..KWWWKKWWWWWK..',
  '...KKWWWWWWKK...',
  '.....KKKKKK.....',
  '................',
  '................',
],
'toy-scarf': [
  '................',
  '..KKKK..........',
  '.KRRRRK.........',
  '.KWWWWK.........',
  '.KRRRRKKKKKK....',
  '.KWWWWRRRRRRK...',
  '.KRRRRWWWWWWK...',
  '..KKRRRRRRRRK...',
  '....KWWWWWWK....',
  '....KRRRRRRK....',
  '....KWWWWWWK....',
  '....KRRRRKK.....',
  '....KRRRK.......',
  '....KKKK........',
  '................',
  '................',
],
```

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat: crowd and merch toy pixel art for surge banners"`

---

### Task 7: SlotAmount — the digit reel

**Files:**
- Create: `src/ui/components/SlotAmount.tsx`

No Jest coverage (the node test env has no react-native — platform components verify by typecheck + harness QA).

- [ ] **Step 1: Implement.** Contract with `FinancialStatement`:

```ts
export type SlotPhase = 'pending' | 'spinning' | 'settled';

export interface SlotAmountProps {
  /** The value currently shown when settled; digits reel-cycle while spinning. */
  value: number;
  phase: SlotPhase;
  tone: 'income' | 'expense' | 'neutral';
  surge: boolean;
  /** Digit-settle stagger start signal: bump to re-run the settle animation (odometer). */
  settleKey: number;
  large?: boolean;
  reduceMotion: boolean;
}
```

Implementation notes (complete component, ~170 lines):
- Format with `formatCurrency(Math.abs(value), false)` plus an explicit leading `+`/`−` sign from the tone/value; split into characters. Non-digit characters (`$ , + −`) render as static `<Text>`; each digit renders as a fixed-width cell (`width: DIGIT_WIDTH` = 10 for base size / 13 for `large`, both on the 8-pt-friendly grid at the mono font sizes already used in the modal: `text-base` and `text-xl`).
- Each digit cell: `overflow-hidden` View of one line-height; inside, an `Animated.View` column of the ten digits 0–9 (mono font). Spinning: `Animated.loop(Animated.timing(translateY, { toValue: -10 * LINE_H, duration: 260, easing: Easing.linear, useNativeDriver: true }))` from 0 — a fast continuous cycle. Settled: stop the loop, then `Animated.timing` to `-digit * LINE_H` with `duration: 90`, `delay: index * 30` (the left-to-right click-click-click). `settleKey` in a `useEffect` dep re-runs the settle timing so the odometer roll (base → multiplied total) replays with the new value's digits.
- `phase === 'pending'`: render the dimmed placeholder `$•••` in `text-ink/30` at the same fixed width (reserve `formatCurrency` width of the final value so nothing shifts — render the final string invisibly to size the row, exactly one hidden `<Text>` with `opacity: 0` and the placeholder absolutely centered over it).
- Colors: income `#265b30`, expense `#a83440`, neutral `#241f2e` (the modal's existing constants); while spinning wrap the digit color at 55% opacity via the color's `Animated` interpolation or a static `${color}8C` alpha suffix — static alpha is fine and cheaper.
- Surge: when `surge && phase === 'spinning'`, drive a looping color flicker (interpolate an `Animated.Value` through `['#b45309', '#dc2626', '#f59e0b']`, 400 ms loop — colors from the approved mockup) — note color interpolation cannot use the native driver; keep `useNativeDriver: false` for that single Animated.Value. When `surge && phase === 'settled'`, render one font size larger + `font-bold` with fixed color `#b45309`, permanently.
- Land pop: on transition into `settled`, run scale 1 → 1.06 → 1 (120 ms total, native driver) on the row's amount container.
- `reduceMotion`: render the final formatted string as plain static `<Text>` (surge keeps its permanent tint/size), no Animated at all.
- Cleanup: every effect returns a cancel that calls `.stopAnimation()`/`clearTimeout` — the unmount-while-spinning test in Task 8's QA checklist depends on no stray timers.
- Do not use function-form `style` on any Pressable anywhere in these components (known iOS trap; there is no Pressable in SlotAmount itself).

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → clean.

- [ ] **Step 3: Commit** — `git commit -am "feat: SlotAmount digit-reel component"`

---

### Task 8: FinancialStatement + SurgeBanner — the reveal state machine

**Files:**
- Create: `src/ui/components/FinancialStatement.tsx`
- Create: `src/ui/components/SurgeBanner.tsx`

- [ ] **Step 1: Implement `SurgeBanner.tsx`.** Props:

```ts
export interface SurgeBannerEvent {
  id: string;                       // row id — one banner per surged row
  kind: 'attendance' | 'merch';
  settlementSeason: number;
  settlementWeek: number;
}
export interface SurgeBannerProps {
  queue: readonly SurgeBannerEvent[];
  onShown: (id: string) => void;    // called 2s after an event becomes visible
  reduceMotion: boolean;
}
```

Renders `pointerEvents="none"` absolutely over the statement (`className="absolute inset-x-4 top-1/3"`). Shows `queue[0]` only: paper card, `border-2 border-b-4 border-ink bg-paper`, slight `rotate: '-3deg'`; pop-in `Animated.spring` scale 0.2 → 1 (skip under reduceMotion — fade only), hold 2000 ms, fade 200 ms, then `onShown(id)` (parent dequeues; next event shows on re-render). Content: a Skia `<Canvas>` strip of sprite runs — `kind === 'attendance'`: the five `CROWD_SPRITE_IDS` side by side; `kind === 'merch'`: `pickMerchToys(settlementSeason, settlementWeek)` side by side — each sprite drawn as `<Rect>`s from `financeSpriteRuns(id)` at `FINANCE_SPRITE_SCALE`, exactly how `EventPixelScene` renders event objects. Below the strip, `PixelText` headline: `EXTREME ATTENDANCE!` in `text-red-dark` / `TRENDING MERCHANDISE!` in `text-pitch-ink`. `accessibilityRole="alert"`, `accessibilityLabel` = the headline.

- [ ] **Step 2: Implement `FinancialStatement.tsx`.** Props:

```ts
export interface FinancialStatementProps {
  lines: readonly PostMatchLedgerLineViewModel[];
  netAmount: number;
  settlementSeason: number;
  settlementWeek: number;
  reduceMotion: boolean;
}
```

The component owns the PaperPanel (`kicker="Accounts office" title="Match statement"` — NO `stamp` prop; the stamp is self-rendered), the row list, the net banner, the stamp, the banner queue, and all audio calls. Complete state machine:

```ts
type RowPhase = 'pending' | 'spinning' | 'base' | 'chip' | 'multiplied' | 'complete';
interface RowState { phase: RowPhase; shownValue: number; settleKey: number }
// Rows are lines + one net pseudo-row at index lines.length. Stamp shows when
// the net row completes.
```

Timing constants in one block (spec §4): `ROW_SPIN_MS = 500`, `SURGE_SPIN_FACTOR = 1.3`, `NET_SPIN_MS = 650`, `INTER_ROW_MS = 80`, `CHIP_MS = 150`, `ODOMETER_MS = 200`, `ADJACENCY_MS = 150`, `BANNER_HOLD_MS = 2000`, `STAMP_MS = 250`.

Per-row phase flow, driven by one `advance(rowIndex, phase)` reducer + `setTimeout` chain (all timeouts kept in a ref and cleared on unmount):

1. `spinning` — `playLedgerSpin()`; surge rows also `playSurgeIgnition()`; duration `ROW_SPIN_MS` (× `SURGE_SPIN_FACTOR` when `reveal?.surge`). SlotAmount `phase='spinning'`, `value` = the row's first landing value: `reveal?.base ?? amount`.
2. `base` — `stopLedgerSpin()`, `stopSurgeBed()` (if surge), `playLedgerThunk()`; SlotAmount settles on `reveal?.base ?? amount`. If the row has no multiplier beat (no reveal, or gate `multiplierPercent === 100`, or merch `multiplierTimes === 1 && adjacencyAmount === 0`) → straight to `complete` after the settle (`10 * 30 + 90` ms cap ≈ 400 ms; use a 420 ms timeout). If surged → enqueue its banner now.
3. `chip` — chip slides in (`CHIP_MS`); then
4. `multiplied` — `shownValue` becomes gate `amount` / merch `base × multiplierTimes`, `settleKey += 1` (odometer roll, `ODOMETER_MS`); merch with `adjacencyAmount > 0` rolls once more to `amount` after `ADJACENCY_MS` with the caption fading in; then
5. `complete` — after `INTER_ROW_MS`, start the next row. The net pseudo-row spins `NET_SPIN_MS`, lands (thunk), then the stamp slams (`STAMP_MS` rotate −8°→4°, scale 1.4→1, `playLedgerThunk()` — its own thunk when reached by timer).

Tap-to-complete (spec §4): the row list is wrapped in a **native RN `Pressable`** (NOT `SfxPressable` — no generic click; import `Pressable` from `react-native`), `onPress` only:

```ts
const completeCurrentRow = () => {
  const index = currentRowIndexRef.current;
  if (index > rowCount) return;                 // everything already complete
  clearAllRowTimers();
  stopLedgerSpin(); stopSurgeBed();
  playLedgerThunk();                            // exactly one thunk per tap
  if (isNetRow(index)) {
    setNet({ phase: 'complete' });              // amount + stamp in one beat, one shared thunk
    setStampVisible(true);
  } else {
    setRow(index, { phase: 'complete', shownValue: finalAmount(index), settleKey: bump() });
    if (isSurged(index) && !bannerAlreadyEnqueued(index)) enqueueBanner(index); // still exactly one banner
    scheduleNextRow(index, INTER_ROW_MS);
  }
};
```

Rows render: label (`text-base text-ink`) + UI-only suffix from the reveal (`facilityCount > 0` on gate → `· ${count} stand${count === 1 ? '' : 's'}`; merch `multiplierTimes >= 2` → `· ${facilityCount} shop${…}`), chip (`border-2 border-pitch-dark bg-pitch-light px-1 text-pitch-ink`, text `×${multiplierPercent}%` / `×${multiplierTimes}`, entering with a 10 px translateX+fade), adjacency caption under the row (`text-xs text-ink/60`, `+${adjacencyPercent}% adjacency`), and the SlotAmount. Pending rows show the placeholder per Task 7.

Accessibility per spec §12 (label carries everything immediately — build with a helper):

```ts
function rowAccessibilityLabel(line: PostMatchLedgerLineViewModel): string {
  const money = (v: number) => formatCurrency(Math.abs(v));
  const sign = line.amount > 0 ? 'plus ' : line.amount < 0 ? 'minus ' : '';
  if (line.reveal === undefined) return `${line.label}, ${sign}${money(line.amount)}`;
  const r = line.reveal;
  const surgeNote = r.surge ? ' Surged this week.' : '';
  if (r.source === 'merch') {
    const adjacency = r.adjacencyPercent > 0 ? `, plus ${r.adjacencyPercent} percent adjacency` : '';
    return `${line.label}, ${r.facilityCount} shop${r.facilityCount === 1 ? '' : 's'}. Base ${money(r.base)}, times ${r.multiplierTimes}${adjacency}, total ${money(line.amount)}.${surgeNote}`;
  }
  const stands = r.facilityCount > 0 ? `, ${r.facilityCount} stand${r.facilityCount === 1 ? '' : 's'}` : '';
  return `${line.label}${stands}. Base ${money(r.base)}, times ${r.multiplierPercent} percent, total ${money(line.amount)}.${surgeNote}`;
}
```

`reduceMotion`: every row/net `complete`, stamp visible, chips/captions shown, no audio except nothing (spin bed never starts); banner queue still runs (static cards, 2 s each). All report audio also stops in the component's unmount cleanup via `stopAllFinancialReportSfx()`.

- [ ] **Step 3: Typecheck** → clean.

- [ ] **Step 4: Commit** — `git commit -am "feat: FinancialStatement reveal state machine and surge banners"`

---

### Task 9: Rewire PostMatchSummaryModal

**Files:**
- Modify: `src/ui/PostMatchSummaryModal.tsx`

- [ ] **Step 1: Rewire.** Keep the Modal shell, header, close, backdrop, footer Continue exactly as-is except:
  - Header title text: `Match summary` → `Financial report`.
  - DELETE: the score row + StatusChip block (lines ~87–102), the `CountUpAmount` component, `countUpValue` import, the `animationsComplete` state and `onTouchStart` handler.
  - New ScrollView order: `<FinancialStatement lines={viewModel.ledger} netAmount={viewModel.netAmount} settlementSeason={viewModel.settlementSeason} settlementWeek={viewModel.settlementWeek} reduceMotion={reduceMotion} />` first, then a `WhatMoved` chips row (TP/Fans, from the existing Metric markup), then the buzz card, then the updates ("What needs attention") section — each below-the-statement section wrapped in a small `EntranceView` (local helper in this file: `Animated.View` translateY 12→0 + opacity 0→1, 320 ms, staggered `delay = 80 * index`, immediate under reduceMotion; warning-tone update cards additionally run one 300 ms ±3° wiggle after entrance).
  - TP/Fans chips count up: replace static `Metric` values with a small `CountUpText` local component using the existing `countUpValue` over 600 ms (this keeps `count-up.ts` in use).
  - On dismiss (`onDismiss` from close/backdrop/Continue): call `stopAllFinancialReportSfx()` before forwarding (belt-and-braces with the statement's unmount cleanup).
  - Keep `playMatchStatementSfx()`/`stopMatchStatementSfx()` mount effect as-is.

- [ ] **Step 2: Typecheck; run the UI test suites** (`npx jest src/ui --runTestsByPath $(ls src/ui/__tests__/*.test.ts)` — `overlay-dismissal.test.ts` and `acceptance-audit-regressions.test.ts` reference this modal; update any assertion on the removed score block or old tap behavior).

- [ ] **Step 3: Commit** — `git commit -am "feat: rebuild post-match modal as the Financial Report"`

---

### Task 10: Dev harness entry

**Files:**
- Create: `src/ui/dev-harness/entries/financial-report.tsx`
- Modify: `src/ui/dev-harness/registry.ts` (import + registry row, group `'Season'`)

- [ ] **Step 1: Implement.** Cases (spec §10): `baseline` (no facilities, home win week), `facilities` (2 stands ×200%, 3 shops ×3 + adjacency), `gate-surge`, `merch-surge`, `triple-surge` (league + cup + merch reveals all surged), `zero-fan-home` ($0 gate line, no reveal), `longest-ledger` (sponsor portfolio + prize + buzz + loan repayment rows), `reduce-motion`. Unlike `fulltime-report.tsx` (which replays a real career), this entry hand-builds `PostMatchViewModel` objects — the reveal dressing is exactly what's under review, so the states must be exact; each case is a literal with correctly reconstructing reveal math (compute `amount` from the reveal fields in the literal, e.g. base 1968 × 200% → amount 3936). Render `<PostMatchSummaryModal viewModel={vm} reduceMotion={caseId === 'reduce-motion'} onDismiss={() => {}} />`.

- [ ] **Step 2: Typecheck; run the harness registry test** (`src/ui/dev-harness/__tests__` covers registry integrity).

- [ ] **Step 3: Commit** — `git commit -am "feat: financial report dev-harness entry"`

---

### Task 11: Finances outlook microcopy + docs sync

**Files:**
- Modify: the Finances screen label sites — locate with `grep -rn "Next four weeks\|Four-week balance" src/ui`
- Modify: `docs/08-ui-ux.md`, `docs/06-economy.md`, `docs/02-core-loop.md`

- [ ] **Step 1: Microcopy.** Append the qualifier to both outlook labels: `Next four weeks · typical`, `Four-week balance · typical`. Update any snapshot/string assertions that pin them.

- [ ] **Step 2: Docs (spec §10 council items).**
  - `docs/08-ui-ux.md`: replace the "one tap completes all post-match motion" passage (~line 37) with the Financial Report flow: row-by-row slot reveal, one-row-per-press skip, reduce-motion behavior; add the narrow palette exception — permanent gold/orange/red fire tint + larger bold type allowed *only* on surged income amounts in the Financial Report; hero gold elsewhere still means hero/power UI.
  - `docs/06-economy.md`: report-eligible variance (bands, 1-in-10 surge, eligibility rule, determinism), baseline projections stay variance-free, and the per-level Fan Shop formula.
  - `docs/02-core-loop.md`: the post-match income statement is named the Financial Report.
  - `README.md` decision log: one line for the feature (matches repo convention of logging decisions).

- [ ] **Step 3: Commit** — `git commit -am "docs: sync canon docs with the Financial Report design"`

---

### Task 12: Full verification + QA evidence

- [ ] **Step 1:** `npx tsc --noEmit` → clean.
- [ ] **Step 2:** `npm test` → all green, including `src/audit/__tests__/opening-economy-balance.test.ts` (the balance harness). If it fails: apply the spec §5 season-1 clamp inside the `WithReveal` callers via `matchdayVarianceRoll` options, re-run; if still red, STOP — surface to owner.
- [ ] **Step 3: Animation QA (web static export).** `npm run export:web`, copy `canvaskit.wasm` into `dist` (known worktree pattern), serve, open the browser pane at the dev-harness `financial-report` entry, **mute audio immediately** (`document.querySelectorAll('audio,video').forEach(el => el.muted = true)`). Verify each case; capture screenshots (RAF-recorder + forced-paint technique — the pane freezes RAF while hidden). Close the tab and stop the server when done.
- [ ] **Step 4: Audio + native QA (iOS simulator).** Build/launch the sim (`xcodebuildmcp-cli` skill or `npm run ios`), open the dev harness entry, verify: spin bed starts/stops per row, thunk on land and tap, flame + crackle on surge rows only, no late audio after rapid skips, master-volume zero silences the report. Shut the simulator down afterwards.
- [ ] **Step 5:** Large-text pass (iOS text size at max) and longest-ledger case: net row + stamp reachable, no clipped labels.

---

### Task 13: Commit + PR

- [ ] **Step 1:** Final `git status` — clean tree, all work committed on `claude/match-summary-financial-redesign-ee490a`.
- [ ] **Step 2:** Push: `git push -u origin claude/match-summary-financial-redesign-ee490a`.
- [ ] **Step 3:** PR against `main` (`gh pr create`): title `feat: Financial Report post-match redesign`; body summarizes the spec, the council audit, the variance economics (+1.55% EV per eligible line), test coverage, and embeds the QA screenshots; ends with the standard generated-with footer.

---

## Self-review notes (already applied)

- Spec coverage checked section-by-section: §3 → Task 9; §4 → Tasks 7–9; §5 → Tasks 1–2 (+ contingency in 2/12); §6 → Tasks 2, 8, 11; §7 → Tasks 6, 8; §8 → Task 9; §9 → Task 5; §10 → Tasks 1–10; §11 → Tasks 2–3; §12 → Task 8; §13 → Tasks 1–5, 10, 12; §14 honored (no Finances redesign beyond microcopy).
- Type names consistent across tasks: `LedgerLineReveal`, `PostMatchLedgerLineViewModel`, `SlotPhase`, `SurgeBannerEvent`, controller function names as listed in Task 5 and consumed in Task 8.
- The Jest env has no DOM/react-native (repo memory): no component render tests are planned; UI correctness is carried by the typechecker, the state-machine design, and the harness QA in Task 12.
