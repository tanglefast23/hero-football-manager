# Financial Report Implementation Plan (v2 — council round 1 applied)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the post-match Match Summary modal as the animated "Financial Report" — slot-machine ledger reveals, seeded gate/merch variance with surge events, facility multiplier beats — per `docs/superpowers/specs/2026-08-06-financial-report-design.md` (the spec).

**Architecture:** Variance rolls once at settlement in the pure game ring, seeded from persisted career data, saving a `reveal` breakdown on the ledger line; the UI replays saved truth only. The reveal sequencing lives in a **pure, fully tested state machine** (`financial-statement-machine.ts`); `FinancialStatement.tsx` is a thin timer/Animated/audio shell over it. A dedicated audio controller owns the four report cues with generation-based cancellation on every cue.

**Tech Stack:** TypeScript, React Native (plain `Animated`), react-native-skia (`Canvas`/`Rect` pixel art), expo-audio, zod v4, Jest (node env, transpile-only — run `npx tsc --noEmit` at the end of EVERY task, not just at the finish line).

**Commit hygiene:** stage explicitly (`git add <paths>`) — never `-am`/`-A`; the worktree may carry unrelated files. Commit after every task.

---

### Task 1: Variance roll module (game ring)

**Files:**
- Create: `src/game/finance-variance.ts`
- Modify: `src/game/types.ts` (~line 293)
- Test: `src/game/__tests__/finance-variance.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/game/__tests__/finance-variance.test.ts
import { applyVariancePercent, matchdayVarianceRoll } from '../finance-variance';

// In-range seeds only: mirror the event-clock contract (nonnegative safe ints;
// the mixer folds them to uint32 itself).
const seedGrid = Array.from({ length: 3000 }, (_, i) => (Math.imul(i, 2654435761) >>> 0));

describe('matchdayVarianceRoll', () => {
  it('is deterministic for identical inputs', () => {
    expect(matchdayVarianceRoll(123456, 1, 5, 'league-gate'))
      .toEqual(matchdayVarianceRoll(123456, 1, 5, 'league-gate'));
  });

  it('rolls independently per source in the same week', () => {
    const seeds = seedGrid.slice(0, 200);
    const gate = seeds.map(seed => matchdayVarianceRoll(seed, 2, 9, 'league-gate').percent);
    const merch = seeds.map(seed => matchdayVarianceRoll(seed, 2, 9, 'merch').percent);
    expect(gate).not.toEqual(merch);
  });

  it('always lands inside a legal band and surge matches the band', () => {
    for (const seed of seedGrid.slice(0, 500)) {
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

  it('surges close to 10% of the time over the fixed seed grid', () => {
    const surges = seedGrid.filter(seed => matchdayVarianceRoll(seed, 1, 5, 'merch').surge).length;
    // Replace with expect(surges).toBe(<measured>) after the first green run.
    expect(surges).toBeGreaterThan(3000 * 0.07);
    expect(surges).toBeLessThan(3000 * 0.13);
  });

  it('rejects out-of-contract inputs', () => {
    expect(() => matchdayVarianceRoll(0.5, 1, 1, 'merch')).toThrow();
    expect(() => matchdayVarianceRoll(-1, 1, 1, 'merch')).toThrow();
    expect(() => matchdayVarianceRoll(1, 0, 1, 'merch')).toThrow();
    expect(() => matchdayVarianceRoll(1, 1, 0, 'merch')).toThrow();
  });
});

describe('applyVariancePercent', () => {
  it('applies the rolled percent with round()', () => {
    expect(applyVariancePercent(1000, 10)).toBe(1100);
    expect(applyVariancePercent(1000, -10)).toBe(900);
    expect(applyVariancePercent(999, 15)).toBe(1149); // round(1148.85)
    expect(applyVariancePercent(0, 20)).toBe(0);
  });

  it('keeps every intermediate a safe integer', () => {
    expect(() => applyVariancePercent(Number.MAX_SAFE_INTEGER - 1, 20)).toThrow();
  });
});
```

- [ ] **Step 2: Run** `npx jest --runTestsByPath src/game/__tests__/finance-variance.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `src/game/finance-variance.ts`**

```ts
import { mulberry32 } from '../sim/rng';
import type { LedgerLineReveal } from './types';

export type VarianceSource = LedgerLineReveal['source'];

/** Distinct stream per source: both gate lines share ledger kind 'tickets'. */
const SOURCE_SALT: Readonly<Record<VarianceSource, number>> = {
  'league-gate': 0x1f83d9ab,
  'cup-gate': 0x5be0cd19,
  merch: 0x9b05688c,
};

/**
 * Season-1 solvency contingency (spec §5): stays −10 unless the
 * opening-economy balance suite fails, in which case it becomes −5 — a
 * NARROWED UNIFORM band (−5…+10, 16 values, mean +2.5 → +3.8% EV per eligible
 * line), never a floor-clamp, which would pile 28.6% of rolls onto −5.
 */
export const SEASON_ONE_NORMAL_BAND_MIN = -10;

export interface VarianceRoll {
  /** normal band min…+10 when surge is false; 11…20 when surge is true. */
  percent: number;
  surge: boolean;
}

/**
 * The weekly income roll for one variance source. Seeded exclusively from
 * persisted career data (the deterministicCareerEventRoll pattern in
 * event-clock.ts), so save/reload can never re-spin and Quick Result banks
 * the same money as a watched match. Consumes no RNG from any other stream.
 */
export function matchdayVarianceRoll(
  careerSeed: number,
  season: number,
  week: number,
  source: VarianceSource,
): VarianceRoll {
  if (!Number.isSafeInteger(careerSeed) || careerSeed < 0) {
    throw new Error('variance careerSeed must be a nonnegative safe integer');
  }
  if (!Number.isSafeInteger(season) || season < 1) {
    throw new Error('variance season must be a positive integer');
  }
  if (!Number.isSafeInteger(week) || week < 1) {
    throw new Error('variance week must be a positive integer');
  }
  const seed = (
    careerSeed
    ^ Math.imul(season, 0x9e3779b1)
    ^ Math.imul(week, 0x85ebca6b)
    ^ SOURCE_SALT[source]
  ) >>> 0;
  const rng = mulberry32(seed);
  const surge = Math.floor(rng() * 10) === 0;
  if (surge) return { percent: 11 + Math.floor(rng() * 10), surge };
  const min = season === 1 ? SEASON_ONE_NORMAL_BAND_MIN : -10;
  const span = 10 - min + 1;
  return { percent: min + Math.floor(rng() * span), surge };
}

/** round(base × (100+p)/100) — variance applies to the base, before multipliers. */
export function applyVariancePercent(base: number, percent: number): number {
  if (!Number.isSafeInteger(base) || base < 0) {
    throw new Error('variance base must be a nonnegative safe integer');
  }
  const scaled = base * (100 + percent);
  if (!Number.isSafeInteger(scaled)) {
    throw new Error('variance product exceeded safe integer range');
  }
  return Math.round(scaled / 100);
}
```

- [ ] **Step 4: Add `LedgerLineReveal` to `src/game/types.ts`** below `LedgerLine` (~line 293) and extend `LedgerLine` — exact code:

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

- [ ] **Step 5: Run tests → PASS; pin the exact surge count; `npx tsc --noEmit` → clean.**

- [ ] **Step 6: Commit** — `git add src/game/finance-variance.ts src/game/types.ts src/game/__tests__/finance-variance.test.ts && git commit -m "feat: add seeded matchday income variance roll"`

---

### Task 2: Settlement attaches variance + reveals

**Files:**
- Modify: `src/game/career.ts` (`settlementLines` ~792, `homeGateIncome` ~1025, `weeklyMerchandiseIncome` ~1039)
- Test: `src/game/__tests__/finance-reveal-settlement.test.ts` (new)

- [ ] **Step 1: Write the failing tests.** Do NOT import private helpers from `career.test.ts` (not exported). Build states through public builders/the public API the way other settlement tests do — if `career.test.ts` constructs states inline, copy the minimal builder into this file as local helpers. Assert through `advanceWeek`/`completeMatchday` → `state.ledgers`. Cases (each its own `it`):

1. Determinism: settle two `structuredClone`-identical states → `JSON.stringify`-identical settled lines.
2. **Watched vs Quick Result equality**: settle the same pre-match state via the two store-visible paths that both end in `completeMatchday` with identical results → identical lines including reveals. (If both paths are literally one function, assert that a second settle of a clone matches — and note in a comment that path equality is structural.)
3. Home league week: `League home gate` line has `reveal.source === 'league-gate'`; reconstruction: `amount === base + Math.floor(base * (multiplierPercent - 100) / 100)`.
4. Merch with shop(s): `reveal.source === 'merch'`; `amount === base * multiplierTimes + adjacencyAmount`; `adjacencyAmount === Math.floor(base * multiplierTimes * adjacencyPercent / 100)`.
5. Away-match week: no gate line; merch line still reveals.
6. Quiet week: merch has NO reveal and equals baseline `weeklyMerchandiseIncome`.
7. Season-final week (`week === SEASON_WEEKS`): no reveals anywhere.
8. Cup home week: `cup-gate` reveal; a league+cup double-header week carries three reveal-capable lines with three independent rolls.
9. Zero-fan home fixture: gate amount 0, NO reveal.
10. Constant lines (wages, upkeep, subsidy, sponsor, prize): never a reveal.
11. **Projection parity at p = 0**: with variance forced ineligible (quiet week), settled gate and merch equal `homeGateIncome`/`weeklyMerchandiseIncome` on the same state.
12. Bounds at scale over ~100 careerSeeds: every reveal's `variancePercent ∈ [−10, 20]`, `surge ⇔ percent ≥ 11`.

- [ ] **Step 2: Run → FAIL** (reveals undefined).

- [ ] **Step 3: Implement in `career.ts`** exactly as follows.

(a) Imports: `matchdayVarianceRoll`, `applyVariancePercent` from `./finance-variance`; add `LedgerLineReveal` to the `./types` import.

(b) Eligibility helper (next to `settlementLines`):

```ts
/**
 * Variance rolls only on settlements the Financial Report presents (spec §5):
 * a played user fixture this week, and never the season-final settlement,
 * which routes to the season review instead of the report.
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

(c) Facility counting — extend the existing loops (keep `gridStadiumStandLevel` exported and delegating):

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

(d) Income functions — baseline signatures preserved for the two projection call sites in `view-models.ts` (lines ~315, ~429); merch baseline moves to per-level rounding (spec §6, deltas ≤ floor(N/2) dollars):

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
  if (result.level === 0 || base <= 0) return { amount: result.amount };
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

(e) The three `settlementLines` push sites spread the optional reveal:

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

- [ ] **Step 4: Run the new file → PASS.**

- [ ] **Step 5: `npm test` and repair expectations.** Failing settlement tests with pinned dollars must be re-derived **from the seed and formula** (compute `matchdayVarianceRoll(careerSeed, season, week, source)` for the test's fixed state and apply the §6 math by hand in a comment) — never by copying jest's actual-value output blind. Quiet-week merch deltas come from the per-level rounding change only. `src/audit/__tests__/opening-economy-balance.test.ts` must pass untouched; if it fails: flip `SEASON_ONE_NORMAL_BAND_MIN` to `-5`, add a focused test pinning the season-1 band (`percent ≥ −5` for season 1, full band for season 2), update `docs/06-economy.md` to the active band + +3.8% EV wording (Task 12 carries the doc), re-run; if still red, STOP and surface to the owner.

- [ ] **Step 6: `npx tsc --noEmit` → clean. Commit** — `git add src/game/career.ts src/game/__tests__/finance-reveal-settlement.test.ts <updated test files> && git commit -m "feat: settle gate and merch income with seeded variance and saved reveals"`

---

### Task 3: Codec — reveal sanitization

**Files:**
- Modify: `src/persistence/game-state-codec.ts` (schema block ~109; normalization pipeline ~2032–2053)
- Test: `src/persistence/__tests__/ledger-reveal-sanitize.test.ts` (new; follow the conventions of the existing codec tests)

- [ ] **Step 1: Write the failing tests.** Round-trip: a state whose latest ledger holds (a) a gate line with valid reveal including `variancePercent: -7` and (b) a valid merch reveal → decode preserves both **exactly** (the negative-variance survival case is mandatory). Strip cases (decode succeeds, `amount` intact, `reveal` gone): source/kind mismatch; `variancePercent: 25` + `surge: true`; `variancePercent: 15` + `surge: false`; `base: 0`; gate reconstruction mismatch; merch adjacency mismatch; `multiplierTimes: 0`; `reveal: "garbage"`; **overflow at each reconstruction intermediate** (e.g. `base: Number.MAX_SAFE_INTEGER - 1, multiplierTimes: 4` — the sanitizer must strip, not throw).

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement.** Reveal schemas next to `ledgerLineSchema` — used ONLY by the sanitizer, never wired into the state schema:

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

// zod v4 accepts enum discriminators directly — no omit/extend dance.
const ledgerLineRevealSchema = z.discriminatedUnion('source', [gateRevealSchema, merchRevealSchema]);
```

The sanitizer joins the existing `unknown => unknown` normalization pipeline (~line 2032) — match that contract and the codec's `isRecord` guard style, returning `value`:

```ts
/**
 * Fail-soft reveal repair (spec §10): a malformed or inconsistent reveal is
 * dropped — and only the reveal — so the line and its authoritative amount
 * always load. Never rejects the save in either direction.
 */
function sanitizeLedgerReveals(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.ledgers)) return value;
  for (const ledger of value.ledgers) {
    if (!isRecord(ledger) || !Array.isArray(ledger.lines)) continue;
    for (const line of ledger.lines) {
      if (!isRecord(line) || line.reveal === undefined) continue;
      if (!revealIsConsistent(line)) delete line.reveal;
    }
  }
  return value;
}

function revealIsConsistent(line: Record<string, unknown>): boolean {
  const parsed = ledgerLineRevealSchema.safeParse(line.reveal);
  if (!parsed.success) return false;
  const reveal = parsed.data;
  if (typeof line.amount !== 'number' || !Number.isSafeInteger(line.amount)) return false;
  if (reveal.surge !== (reveal.variancePercent >= 11)) return false;
  if (reveal.source === 'merch') {
    if (line.kind !== 'merch') return false;
    const afterMultiplier = reveal.base * reveal.multiplierTimes;
    if (!Number.isSafeInteger(afterMultiplier)) return false;
    const adjacencyProduct = afterMultiplier * reveal.adjacencyPercent;
    if (!Number.isSafeInteger(adjacencyProduct)) return false;
    if (reveal.adjacencyAmount !== Math.floor(adjacencyProduct / 100)) return false;
    return afterMultiplier + reveal.adjacencyAmount === line.amount;
  }
  if (line.kind !== 'tickets') return false;
  const bonusProduct = reveal.base * (reveal.multiplierPercent - 100);
  if (!Number.isSafeInteger(bonusProduct)) return false;
  const reconstructed = reveal.base + Math.floor(bonusProduct / 100);
  if (!Number.isSafeInteger(reconstructed)) return false;
  return reconstructed === line.amount;
}
```

Register `sanitizeLedgerReveals` in the normalization pipeline exactly where its peers run (before final validation). `GAME_SCHEMA_VERSION` does NOT bump.

- [ ] **Step 4: Run new tests + the persistence suite** (`npx jest --runTestsByPath src/persistence/__tests__/ledger-reveal-sanitize.test.ts` then `npm test` filtered or full). **Step 5: `npx tsc --noEmit`. Commit** — scoped `git add`, message `"feat: fail-soft ledger reveal sanitization in the save codec"`.

---

### Task 4: View models — reveal pass-through + settlement week

**Files:**
- Modify: `src/ui/models.ts` (~263, ~306), `src/application/view-models.ts` (~2498)
- Modify: `src/application/__tests__/store.test.ts` (~1647 — the hand-built `PostMatchViewModel` literal gains the two new required fields, or typecheck breaks)
- Test: extend the existing `postMatchViewModel` coverage (locate: `grep -rn "postMatchViewModel" src/application/__tests__`)

- [ ] **Step 1: Failing test** — gate/merch lines in `store.postMatch.ledger` carry `reveal` equal to the settled lines'; `postMatch.settlementSeason`/`settlementWeek` equal the settled week; `clubFinancesViewModel(...).ledger` lines have no `reveal` property.

- [ ] **Step 2–3: Implement.** `src/ui/models.ts`:

```ts
import type { LedgerLineReveal } from '../game/types'; // add to the existing type imports

export interface PostMatchLedgerLineViewModel extends LedgerLineViewModel {
  /** Post-match statement rows only: the Finances ledger stays undressed. */
  reveal?: LedgerLineReveal;
}
```

`PostMatchViewModel`: `ledger: readonly PostMatchLedgerLineViewModel[]` plus:

```ts
  /** Settled week identity — the deterministic banner/toy seed (spec §7). */
  settlementSeason: number;
  settlementWeek: number;
```

`postMatchViewModel` ledger mapping gains `...(line.reveal === undefined ? {} : { reveal: line.reveal })` per line, and the return gains `settlementSeason: before.season, settlementWeek: before.week`. Update the `store.test.ts` literal (~1647) with both fields.

- [ ] **Step 4: Tests + `npx tsc --noEmit`. Commit** — `"feat: pass ledger reveals and settlement week through the post-match view model"`.

---

### Task 5: Audio assets + report SFX controller + App wiring

**Files:**
- Create: `assets/audio/sfx/ledger-spin.wav`, `assets/audio/sfx/ledger-thunk.wav`
- Create: `src/render/financial-report-sfx.ts`
- Modify: `App.tsx` (volume effect ~953; unmount teardown ~986)
- Test: `src/render/__tests__/financial-report-sfx.test.ts`

- [ ] **Step 1: Assets** (canonical conversion, matching `flame-up.wav`'s pcm_s16le/48k/stereo):

```bash
ffmpeg -y -i "/Users/joemacprom5/Library/Mobile Documents/com~apple~CloudDocs/sounds/progress.webm" -ar 48000 -ac 2 -c:a pcm_s16le assets/audio/sfx/ledger-spin.wav
ffmpeg -y -i "/Users/joemacprom5/Library/Mobile Documents/com~apple~CloudDocs/sounds/thunk.webm" -ar 48000 -ac 2 -c:a pcm_s16le assets/audio/sfx/ledger-thunk.wav
```

- [ ] **Step 2: Failing tests** (mock `expo-audio` exactly as `src/render/__tests__/management-sfx.test.ts` does; seekTo returns a controllable promise). Cases:
  - Spin: stop before pending seek resolves → late `play` never fires; double-start restarts cleanly.
  - **Thunk pool**: three rapid `playLedgerThunk()` calls use distinct pool players (no self-cutoff); a pending thunk seek after `stopAllFinancialReportSfx()` never plays.
  - Surge: `playSurgeIgnition()` starts flame-up AND crackle (loop=true); `stopSurgeBed()` pauses BOTH; pending flame-up seek after stop never plays; double-stop safe.
  - Lifecycle: `suspend` pauses everything; `resume` restarts the crackle ONLY when the surge bed was active at suspend and has not been stopped since (`crackleActive` with unchanged generation); resume after `stopSurgeBed()` stays silent; a `playLedgerSpin()` while suspended does not start audio (respects `audioIsSuspended()` — verify the exact suspended-query export in `src/render/audio-lifecycle.ts` and use it; if the module instead delivers suspend state only via the owner callbacks, track a local `suspended` flag set by our own suspend/resume handlers).
  - Volume: `setFinancialReportSfxMasterVolume(0)` sets `volume = 0` AND `muted = true` on every player (the repo's documented web/iOS behavior in `audio.ts` ~275); restoring volume unmutes.
  - Rejected seek: `seekTo` rejecting does not throw or wedge the generation.
  - `teardownFinancialReportSfx()` removes/releases all; later play re-inits without throwing.

- [ ] **Step 3: Implement.** Structure: one generation counter **per cue family** (`spinGen`, `thunkGen`, `surgeGen`), a `suspended` flag, and a shared guarded start:

```ts
function seekThenPlay(player: AudioPlayer | null, isCurrent: () => boolean): void {
  if (player === null || suspended) return;
  try {
    player.pause();
    player.seekTo(0).then(
      () => { if (isCurrent() && !suspended) { try { player.play(); } catch { /* non-fatal */ } } },
      () => { /* rejected seek: stay silent, never wedge */ },
    );
  } catch { /* non-fatal */ }
}
```

- Players: `spinPlayer`, `thunkPool: AudioPlayer[]` (3 voices, round-robin index — the management-sfx rapid-pool pattern), `flameUpPlayer`, `cracklePlayer` (loop=true). Gains: spin 0.6, thunk 1.0, flame-up 0.9, crackle 0.5, each × master volume; volume 0 also sets `muted = true` on all.
- `playLedgerSpin()`: `spinGen += 1`; guarded start with `() => gen === spinGen`. `stopLedgerSpin()`: `spinGen += 1; pause`.
- `playLedgerThunk()`: `thunkGen += 1` captured per call; next pool voice; guard `() => gen === thunkGen || true`-style is WRONG — guard is `() => !stoppedAll && !suspended` via a `stopEpoch` captured at call time (`const epoch = stopEpoch; () => epoch === stopEpoch`). `stopAllFinancialReportSfx()` bumps `stopEpoch`.
- `playSurgeIgnition()`: `surgeGen += 1; crackleActive = true`; start flame-up guarded by the surge generation, crackle likewise. `stopSurgeBed()`: `surgeGen += 1; crackleActive = false; pause(flameUpPlayer); pause(cracklePlayer)` — flame-up and crackle stop together (spec: both surge sounds stop at land).
- Lifecycle: `registerAudioOwner({ suspend, resume })` (the contract at `audio-lifecycle.ts:15` requires both). `suspend`: set `suspended = true`, pause all (do NOT bump generations — this is a pause, not a cancel). `resume`: `suspended = false`; if `crackleActive` restart the crackle guarded by the current `surgeGen`; everything else stays silent (a new row restarts its own cues).
- `stopAllFinancialReportSfx()`: bump all generations + `stopEpoch`, `crackleActive = false`, pause everything.
- `setFinancialReportSfxMasterVolume`, `teardownFinancialReportSfx` as in v1, plus the mute behavior.

- [ ] **Step 4: Wire `App.tsx`** — `setFinancialReportSfxMasterVolume(devVolume)` in the volume effect; `teardownFinancialReportSfx()` in the unmount cleanup.

- [ ] **Step 5: Tests → PASS; `npx tsc --noEmit`. Commit** (scoped add includes the two wavs) — `"feat: financial report audio controller and owner-supplied ledger SFX"`.

---

### Task 6: Pixel art — crowd + merch toys

**Files:**
- Create: `src/ui/finance-pixel-art.ts`
- Test: `src/ui/__tests__/finance-pixel-art.test.ts`

Same as plan v1 (tests: 16×16 grids over known palette keys, exactly ten toys, deterministic 4–5-toy pick with duplicate-free results) with two changes:
- `FINANCE_SPRITE_SCALE = 3` (five 16-px sprites at scale 4 = 320 px would clip common phones; at 3 the crowd strip is 240 px + padding).
- Export `financeSpriteRuns(id)` with the `{x, y, width, color}` run shape mirroring `eventSpriteRuns`.

Author the 15 grids (5 cheering chibi fans + confetti; 10 toys: scarf, ball, foam finger, bobblehead, plush mascot, snow globe, boot keychain, jersey, card pack, club mug) in the `event-pixel-art.ts` character-grid style with its palette letters; the two reference grids from plan v1 (`toy-ball`, `toy-scarf`) set the drawing style.

- [ ] Steps: failing tests → implement → PASS → `npx tsc --noEmit` → scoped commit `"feat: crowd and merch toy pixel art for surge banners"`.

---

### Task 7: The pure reveal state machine (NEW — the core logic, fully tested)

**Files:**
- Create: `src/ui/financial-statement-machine.ts`
- Test: `src/ui/__tests__/financial-statement-machine.test.ts`

The riskiest logic in the feature — sequencing, tap semantics, banner queue, audio commands — lives here as a pure reducer so it tests headless in node (spec §13). No React, no timers, no audio imports: the machine consumes events and RETURNS commands; the component executes them.

- [ ] **Step 1: Write the failing tests** for this exact contract:

```ts
// Types (exported by the module):
export type RowPhase = 'pending' | 'spinning' | 'base' | 'chip' | 'multiplied' | 'adjacency' | 'complete';

export interface MachineRow {
  id: string;
  amount: number;
  reveal?: LedgerLineReveal;
}

export interface MachineState {
  generation: number;                 // bumped on EVERY event that cancels scheduled work
  rows: readonly { phase: RowPhase; shownValue: number }[]; // index rows.length = the net row
  status: 'running' | 'reportComplete';
  currentRow: number;                 // rows.length = net row; rows.length + 1 = done sentinel
  stampVisible: boolean;
  bannerQueue: readonly { rowId: string; kind: 'attendance' | 'merch' }[];
  bannersEnqueued: readonly string[]; // row ids — a surged row enqueues exactly once, ever
}

export type MachineEvent =
  | { type: 'start' }
  | { type: 'timer'; generation: number; rowIndex: number; phase: RowPhase | 'advance' }
  | { type: 'tap' }
  | { type: 'bannerShown' };          // dequeues bannerQueue[0]

export type MachineCommand =
  | { type: 'schedule'; afterMs: number; event: MachineEvent }   // event carries the CURRENT generation
  | { type: 'playSpin' } | { type: 'stopSpin' }
  | { type: 'playThunk' }
  | { type: 'playSurgeIgnition' } | { type: 'stopSurgeBed' }
  | { type: 'settleAmount'; rowIndex: number; value: number };   // drives SlotAmount settleKey/value

export function createMachine(rows: readonly MachineRow[], netAmount: number, timings: MachineTimings, reduceMotion: boolean): MachineState;
export function reduce(state: MachineState, event: MachineEvent): { state: MachineState; commands: readonly MachineCommand[] };
```

Behavioral test matrix (each an `it`; drive the machine by feeding back its own scheduled events, fake-timer style but purely synchronously):

1. Happy path: `start` → rows spin/land/complete in order, each with exactly one `playSpin`/`stopSpin`/`playThunk` triple; net row last; stamp after net; `status === 'reportComplete'`.
2. A stale timer (generation ≠ current) is a no-op with zero commands.
3. Tap during EVERY phase of a multiplied surged row: row jumps atomically to `complete` (shownValue = final amount), exactly ONE `playThunk` in the emitted commands, `stopSpin` + `stopSurgeBed` present, banner enqueued exactly once (also when the tap skipped the spin entirely), generation bumped (cancelling scheduled work), next row scheduled after `interRowMs`.
4. Rapid double tap: second tap acts on the NEXT row (never re-completes the same row, never a second thunk for the completed row, never double-schedules).
5. Tap on the net row: net completes + `stampVisible` in the same reduction with ONE `playThunk`; `status === 'reportComplete'`; further taps → zero commands.
6. Multiplied-row phases: gate with `multiplierPercent > 100` goes base → chip → multiplied → complete with `settleAmount` values base → final; merch with `multiplierTimes === 1` but `adjacencyAmount > 0` goes base → adjacency → complete (NO chip phase — the ×1 chip must not exist); merch with both goes base → chip → multiplied → adjacency → complete; identity reveal (percent 100 / times 1, no adjacency) goes base → complete.
7. Surge timing: surged rows schedule their land at `spinMs × 1.3`.
8. Empty ledger: `start` with zero rows goes straight to the net row.
9. Reduce motion: `createMachine(..., reduceMotion: true)` returns every row `complete`, net complete, stamp visible, `status 'reportComplete'`, AND `bannerQueue` pre-populated with every surged row (spec §4 — banners still show statically).
10. Triple surge: three surged rows enqueue three banners in ledger order; `bannerShown` dequeues FIFO.
11. Unmount contract: the machine never needs external cleanup beyond dropping scheduled events (documented invariant — commands are pure data; a component that stops dispatching after unmount leaks nothing).

- [ ] **Step 2: Run → FAIL. Step 3: Implement the reducer** to satisfy exactly that matrix. Key rules: every `tap`/`start` bumps `generation` before emitting `schedule` commands (which embed the NEW generation); `timer` events are dropped unless `event.generation === state.generation` AND the row/phase still matches; `currentRow` advances only through `advance` timers or taps; `bannersEnqueued` (a list used as a set) gates banner enqueueing; the net row completion sets `stampVisible` and `reportComplete` in one reduction when reached by tap, or via a final `STAMP_MS` timer when reached by timer flow.

- [ ] **Step 4: PASS; `npx tsc --noEmit`. Commit** — `"feat: pure financial statement reveal state machine"`.

---

### Task 8: SlotAmount — the digit reel

**Files:**
- Create: `src/ui/components/SlotAmount.tsx`

Contract (fixes the width-reservation and completion-guessing flaws):

```ts
export interface SlotAmountProps {
  /** What the reel currently shows (or settles to). */
  value: number;
  /** The row's FINAL amount — reserves layout width from the start. */
  finalValue: number;
  phase: 'pending' | 'spinning' | 'settled';
  tone: 'income' | 'expense' | 'neutral';
  surge: boolean;
  /** Bump to re-run the settle animation with the new value (odometer). */
  settleKey: number;
  large?: boolean;
  reduceMotion: boolean;
  /** Fired once per settleKey when the last digit finishes settling. */
  onSettled?: () => void;
}
```

Implementation requirements (complete component; no Jest — verified by typecheck + Task 13 QA):
- Format with `formatCurrency` + explicit ASCII `-`/`+` sign (Silkscreen has no U+2212 — documented in `Scorecard.tsx:10`).
- Width reservation: render `format(finalValue)` as an invisible (`opacity: 0`) sizing text; the live reel/placeholder overlays it absolutely. Placeholder `$•••` dimmed.
- Digit cells scale with the OS font scale: `const cellWidth = BASE_DIGIT_WIDTH * PixelRatio.getFontScale()` (same for line height) so the 1.6× Dynamic Type pass doesn't clip.
- Reel track is `0 1 2 3 4 5 6 7 8 9 0` (duplicated zero) so the loop can run 0 → −10×LINE_H and snap back to 0 without a blank frame.
- Settle: animate each digit upward to the target (if the target offset is behind the current position, first jump back one full cycle so motion is always upward — the odometer rule), `delay: index * 30`, duration 90; the LAST digit's animation `start(({ finished }) => finished && onSettled?.())` — completion is callback-driven, never a guessed timeout. `settleKey` re-runs settle with the new `value`.
- Spin loop per digit: `Animated.loop` on translateY, stored in a ref and `.stop()`ed on phase change/unmount (the `EventPixelScene` cleanup pattern).
- Surge: spinning = looping color flicker `#b45309 → #dc2626 → #f59e0b` (single JS-driven Animated.Value, useNativeDriver: false for color only); settled = one font size larger + bold + permanent `#b45309`. Land pop scale 1 → 1.06 → 1 (120 ms, native driver) on settle.
- `reduceMotion`: static final text (surge keeps permanent tint/size); `onSettled` fires synchronously via `useEffect`.
- Colors: income `#265b30`, expense `#a83440`, neutral `#241f2e`; spinning digits at 55% alpha (`8C` suffix).

- [ ] Steps: implement → `npx tsc --noEmit` → commit `"feat: SlotAmount digit-reel component"`.

---

### Task 9: FinancialStatement + SurgeBanner — the thin shell

**Files:**
- Create: `src/ui/components/FinancialStatement.tsx`, `src/ui/components/SurgeBanner.tsx`

- [ ] **Step 1: `SurgeBanner.tsx`** as plan v1 (queue props, `pointerEvents="none"`, pop-in/hold-2s/fade, Skia sprite strip via `financeSpriteRuns` at scale 3, `accessibilityRole="alert"`) with one change: under `reduceMotion` the banner is **fully static** for its 2 s — no pop, no fade (spec §4; "fade only" also violates it).

- [ ] **Step 2: `FinancialStatement.tsx`** — a shell over the Task 7 machine:
  - Holds `machineState` in a `useReducer`-style `useState` + a `dispatch` that runs `reduce`, executes returned commands: `schedule` → `setTimeout` stored in a ref map keyed by generation (all cleared on unmount); audio commands → the Task 5 controller functions; `settleAmount` → per-row `{ value, settleKey }` state consumed by `SlotAmount`.
  - Timings from spec §4 in one constants block: `ROW_SPIN_MS 500, SURGE_SPIN_FACTOR 1.3, NET_SPIN_MS 650, INTER_ROW_MS 80, CHIP_MS 150, ODOMETER_MS 200, ADJACENCY_MS 150, BANNER_HOLD_MS 2000, STAMP_MS 250`. Chip/odometer/adjacency phase transitions are driven by `SlotAmount.onSettled` + scheduled timers carrying the machine generation — never bare guesses.
  - The tap surface is a **native RN `Pressable`** (import from `react-native`, NOT `SfxPressable`) wrapping the ENTIRE PaperPanel content, `accessible={false}` so it never swallows the row-level labels; `onPress={() => dispatch({ type: 'tap' })}`. No function-form `style` on it (iOS trap).
  - Surge rows: warm background wash while spinning — an `Animated.View` row background looping `#fde68a → #fdba74` (the spec's swept wash; a horizontal translateX sweep of a lighter overlay is optional polish if trivial, otherwise the pulse wash suffices — log the choice in the commit body).
  - Chips (`×200%` / `×3`) slide in 10 px + fade at the chip phase; adjacency caption `+X% adjacency` fades at the adjacency phase; suffix rendering and `rowAccessibilityLabel` per plan v1 — but the label helper must skip the multiplier phrase entirely for identity reveals (`multiplierPercent === 100` / `multiplierTimes === 1`), so nothing narrates "times 1".
  - Stamp: self-rendered over the panel corner, `STAMP_MS` rotate −8°→4° + scale 1.4→1 on `stampVisible`, with `playLedgerThunk()` (via machine command flow when timer-driven; the tap path's single thunk already covers it).
  - Unmount cleanup: clear all timers, `stopAllFinancialReportSfx()`.
  - Reduce motion: machine already starts complete (Task 7 case 9); the shell renders everything settled and runs only the banner queue.

- [ ] **Step 3: `npx tsc --noEmit`. Commit** — `"feat: FinancialStatement shell and surge banners"`.

---

### Task 10: Rewire PostMatchSummaryModal

**Files:**
- Modify: `src/ui/PostMatchSummaryModal.tsx`, `src/ui/screens/PostMatchLedgerScreen.tsx` (~125), `src/ui/components/Scorecard.tsx` (~180), `src/ui/__tests__/acceptance-audit-regressions.test.ts` (~63–77)

- [ ] **Step 1: Rewire the modal.**
  - Title → `Financial report`; close button label → `Close financial report`; `onRequestClose` (Android back) must call the same audio-stopping dismiss handler as the close button — introduce one `handleDismiss = () => { stopAllFinancialReportSfx(); onDismiss(); }` used by close, backdrop, Continue, and `onRequestClose`.
  - DELETE the score row + StatusChip block and the `CountUpAmount` component + `animationsComplete`/`onTouchStart`. KEEP the `countUpValue` import — the new `CountUpText` uses it.
  - New order: `<FinancialStatement …/>` → What moved (TP/Fans) → buzz → updates, each in an `EntranceView` (translateY 12→0 + fade, 320 ms, stagger 80 ms; immediate under reduceMotion). **Per-warning stagger**: each update card gets its own `EntranceView` delay (`80 * cardIndex`), and warning-tone cards run one ±3° 300 ms wiggle after entrance. TP/Fans chips: `CountUpText` (local, uses `countUpValue` over 600 ms) **plus a small landing bounce** (scale 1 → 1.08 → 1 on completion).
  - `Metric` in `Scorecard.tsx` types `value: string` — widen to `value: ReactNode` (string remains assignable; smallest diff) so `<Metric value={<CountUpText …/>} …/>` compiles.
  - `PostMatchLedgerScreen.tsx` ~125: the Continue CTA's stale "match summary" accessibility wording → "financial report".
- [ ] **Step 2: Retarget the audit rails** in `acceptance-audit-regressions.test.ts:63–77` — the row `accessibilityLabel` template moved into `FinancialStatement.tsx` and the TP-change markup into the modal's `CountUpText`; point the source-string guards at the new files/strings, do NOT delete them.
- [ ] **Step 3:** `npx jest --runTestsByPath src/ui/__tests__/overlay-dismissal.test.ts src/ui/__tests__/acceptance-audit-regressions.test.ts`; `npx tsc --noEmit`. **Commit** — `"feat: rebuild post-match modal as the Financial Report"`.

---

### Task 11: Dev harness entry

**Files:**
- Create: `src/ui/dev-harness/entries/financial-report.tsx`
- Modify: `src/ui/dev-harness/registry.ts` (import + row, group **`'Match'`** beside Full-time Report)

- [ ] **Step 1: Implement.** Cases as v1 (`baseline`, `facilities`, `gate-surge`, `merch-surge`, `triple-surge`, `zero-fan-home`, `longest-ledger`, `reduce-motion`) with these corrections:
  - Do NOT render the RN `Modal` (it would sit over the harness controls and make them inert). Render the modal's CONTENT inline: `<FinancialStatement …/>` + the What-moved/buzz/updates sections in a ScrollView, plus a "Replay" button that remounts via a `key` bump.
  - Build cases from **one factory + reveal builders**, not eight literals:

```ts
function gateReveal(base: number, opts: { percent?: number; surge?: boolean; standLevel?: number; count?: number; cup?: boolean }): PostMatchLedgerLineViewModel { /* computes amount from the reveal fields */ }
function merchReveal(base: number, opts: { percent?: number; surge?: boolean; times?: number; count?: number; adjacencyPercent?: number }): PostMatchLedgerLineViewModel { /* ditto */ }
function reportCase(lines: PostMatchLedgerLineViewModel[], overrides?: Partial<PostMatchViewModel>): PostMatchViewModel { /* fills result/updates/etc. with plausible fixed values */ }
```

  Amounts are COMPUTED from the reveal fields inside the builders, so every case reconstructs exactly by construction.
- [ ] **Step 2:** `npx tsc --noEmit` (there is no registry-integrity jest test — `route.test.ts` deliberately avoids importing the RN registry; typecheck is the gate). **Commit** — `"feat: financial report dev-harness entry"`.

---

### Task 12: Finances outlook microcopy + docs sync

**Files:**
- Modify: the outlook label sites (`grep -rn "Next four weeks\|Four-week balance" src/ui`), `docs/08-ui-ux.md`, `docs/06-economy.md`, `docs/02-core-loop.md`, `README.md`

- [ ] **Step 1: Microcopy** — `Next four weeks · typical`, `Four-week balance · typical`; update any pinned string assertions.
- [ ] **Step 2: Docs.** `docs/08-ui-ux.md` has TWO stale passages — the weekly-flow paragraph (~line 30: "one tap completes all motion … accounts statement as a modal") AND Match Day flow item 3 (~line 37: "line-by-line count-up … One tap finishes all remaining motion"); rewrite BOTH to the Financial Report flow (row-by-row slot reveal, one-row-per-press skip, reduce-motion) and add the narrow palette exception (permanent gold/orange/red fire tint + larger bold type only on surged income amounts in this report; hero gold elsewhere still means hero/power UI). `docs/06-economy.md`: report-eligible variance (bands, 1-in-10 surge, eligibility, determinism; if the season-1 contingency activated, the −5…+10 band and +3.8% EV), baseline projections, per-level Fan Shop formula. `docs/02-core-loop.md`: statement renamed Financial Report. `README.md` decision log: one line.
- [ ] **Step 3: Commit** — `"docs: sync canon docs with the Financial Report design"`.

---

### Task 13: Full verification + QA evidence

- [ ] `npx tsc --noEmit` → clean; `npm test` → all green including `src/audit/__tests__/opening-economy-balance.test.ts` (contingency path per Task 2 Step 5 if red; STOP if still red after the clamp).
- [ ] **Web animation QA:** `npm run export:web`, copy `canvaskit.wasm` into `dist`, serve, browser pane → dev-harness `financial-report`, **mute audio immediately**, verify every case, capture screenshots (RAF-recorder + forced-paint — the pane freezes RAF while hidden). Close tab, stop server.
- [ ] **Native + audio QA (iOS simulator):** build & launch, dev harness entry: spin bed starts/stops per row; thunk on land and on tap (machine-gun taps stay clean — pool voices); flame-up + crackle on surge rows only and both stop at land; no late audio after rapid skips or dismissal; master volume 0 silences (muted). Background/foreground the app mid-surge-spin → crackle resumes only if that row is still spinning. Shut the simulator down afterwards.
- [ ] Large-text (1.6×) and longest-ledger passes: no clipped digits (font-scaled cells), net + stamp reachable.

---

### Task 14: Commit + PR

- [ ] Final `git status` — clean, all commits on `claude/match-summary-financial-redesign-ee490a`.
- [ ] `git push -u origin claude/match-summary-financial-redesign-ee490a`.
- [ ] `gh pr create` against `main`: title `feat: Financial Report post-match redesign`; body covers the spec, council audits, variance economics (+1.55% EV per eligible line), coverage, QA screenshots; standard generated-with footer. (Council process note: one reviewer preferred gating push/PR on fresh owner authorization; the owner's standing instruction for this session explicitly ordered commit + PR without further asking, so this task proceeds — logged here deliberately.)

---

## Self-review notes (v2)

- Council round-1 items all addressed: pure machine + §13 test matrix (Task 7); audio generations on every cue, flame-up stops with crackle, suspend/resume contract with generation-aware crackle resume, `audioIsSuspended` handling, muted-at-zero, thunk pool, rejected seeks (Task 5); narrowed-uniform season-1 band with correct +3.8% EV (Task 1); SlotAmount `finalValue`/duplicated-zero/upward odometer/font-scale/callback completion/ASCII minus (Task 8); merch `N=1 + adjacency` flow and no "times 1" narration (Tasks 7, 9); warm wash, TP/fans bounce, per-warning stagger, reduce-motion banner init, static reduce-motion banner, Android `onRequestClose`, stale a11y strings (Tasks 9, 10); `Metric` widening, harness group `Match`, inline harness rendering, scale-3 sprites, VM factory (Tasks 10, 11); sanitizer as `unknown => unknown` with `isRecord` + overflow-safe reconstruction + direct discriminatedUnion (Task 3); event-clock-parity seed validation + in-range grid + checked intermediates (Task 1); store.test.ts literal named (Task 4); acceptance-audit rails retargeted not deleted (Task 10); docs/08 both passages (Task 12); derive-from-formula expectation repairs and no private-helper imports (Task 2); scoped staging throughout; jest invocations use `--runTestsByPath` with explicit file paths only.
- Deliberately NOT adopted: gating push/PR on fresh owner approval (contradicts the owner's explicit instruction; noted in Task 14).
- Type/name consistency: `LedgerLineReveal`, `PostMatchLedgerLineViewModel`, `MachineState/Event/Command`, controller API (`playLedgerSpin/stopLedgerSpin/playLedgerThunk/playSurgeIgnition/stopSurgeBed/stopAllFinancialReportSfx/setFinancialReportSfxMasterVolume/teardownFinancialReportSfx`) consistent across Tasks 5, 7, 9, 10.
