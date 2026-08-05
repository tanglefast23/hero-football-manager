# Financial Report Implementation Plan (v3 — plan-council rounds 1–2 applied)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the post-match Match Summary modal as the animated "Financial Report" — slot-machine ledger reveals, seeded gate/merch variance with surge events, facility multiplier beats — per `docs/superpowers/specs/2026-08-06-financial-report-design.md` (the spec).

**Architecture:** Variance rolls once at settlement in the pure game ring, seeded from persisted career data, saving a `reveal` breakdown on the ledger line; the UI replays saved truth only. The reveal sequencing lives in a **pure, fully tested state machine** (`financial-statement-machine.ts`) plus a **testable command runtime** (`financial-statement-runtime.ts`); `FinancialStatement.tsx` is a thin shell. A dedicated audio controller owns the four report cues with generation + suspend-epoch cancellation on every cue.

**Tech Stack:** TypeScript, React Native (plain `Animated`), react-native-skia (`Canvas`/`Rect` pixel art), expo-audio, zod v4, Jest (node env, transpile-only — run `npx tsc --noEmit` at the end of EVERY task).

**Commit hygiene:** stage explicitly (`git add <paths>`) — never `-am`/`-A`. Commit after every task.

---

### Task 1: Variance roll module (game ring)

**Files:**
- Create: `src/game/finance-variance.ts`
- Modify: `src/game/types.ts` (~line 293)
- Test: `src/game/__tests__/finance-variance.test.ts`

- [ ] **Step 1: Failing tests** — as follows (note the uint32 seed contract):

```ts
import { applyVariancePercent, matchdayVarianceRoll } from '../finance-variance';

// In-range seeds only: the persisted careerSeed contract is uint32
// (game-state-codec pins it; event-clock validates 0…0xffffffff).
const seedGrid = Array.from({ length: 3000 }, (_, i) => (Math.imul(i, 2654435761) >>> 0));

describe('matchdayVarianceRoll', () => {
  it('is deterministic for identical inputs', () => {
    expect(matchdayVarianceRoll(123456, 1, 5, 'league-gate'))
      .toEqual(matchdayVarianceRoll(123456, 1, 5, 'league-gate'));
  });

  it('rolls independently per source in the same week', () => {
    const seeds = seedGrid.slice(0, 200);
    const gate = seeds.map(s => matchdayVarianceRoll(s, 2, 9, 'league-gate').percent);
    const merch = seeds.map(s => matchdayVarianceRoll(s, 2, 9, 'merch').percent);
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
    const surges = seedGrid.filter(s => matchdayVarianceRoll(s, 1, 5, 'merch').surge).length;
    // Replace with expect(surges).toBe(<measured>) after the first green run.
    expect(surges).toBeGreaterThan(3000 * 0.07);
    expect(surges).toBeLessThan(3000 * 0.13);
  });

  it('rejects out-of-contract inputs', () => {
    expect(() => matchdayVarianceRoll(0.5, 1, 1, 'merch')).toThrow();
    expect(() => matchdayVarianceRoll(-1, 1, 1, 'merch')).toThrow();
    expect(() => matchdayVarianceRoll(0x100000000, 1, 1, 'merch')).toThrow(); // > uint32
    expect(() => matchdayVarianceRoll(1, 0, 1, 'merch')).toThrow();
    expect(() => matchdayVarianceRoll(1, 1, 0, 'merch')).toThrow();
  });
});

describe('applyVariancePercent', () => {
  it('applies the rolled percent with round()', () => {
    expect(applyVariancePercent(1000, 10)).toBe(1100);
    expect(applyVariancePercent(1000, -10)).toBe(900);
    expect(applyVariancePercent(999, 15)).toBe(1149);
    expect(applyVariancePercent(0, 20)).toBe(0);
  });

  it('keeps every intermediate a safe integer', () => {
    expect(() => applyVariancePercent(Number.MAX_SAFE_INTEGER - 1, 20)).toThrow();
  });
});
```

- [ ] **Step 2: Run** `npx jest --runTestsByPath src/game/__tests__/finance-variance.test.ts` → FAIL.

- [ ] **Step 3: Implement `src/game/finance-variance.ts`** — identical to v2 except the seed guard is the uint32 contract:

```ts
  if (!Number.isSafeInteger(careerSeed) || careerSeed < 0 || careerSeed > 0xffffffff) {
    throw new Error('variance careerSeed must be a uint32');
  }
```

Full module (unchanged otherwise):

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
  if (!Number.isSafeInteger(careerSeed) || careerSeed < 0 || careerSeed > 0xffffffff) {
    throw new Error('variance careerSeed must be a uint32');
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

- [ ] **Step 4: `LedgerLineReveal` + `LedgerLine.reveal` in `src/game/types.ts`** — exact code as v2 (discriminated union: gate arm `source/base/variancePercent/surge/multiplierPercent/facilityCount`; merch arm adds `multiplierTimes/facilityCount/adjacencyPercent/adjacencyAmount`; doc comments preserved):

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

- [ ] **Step 5: PASS; pin the surge count; `npx tsc --noEmit`.**
- [ ] **Step 6: Commit** — `git add src/game/finance-variance.ts src/game/types.ts src/game/__tests__/finance-variance.test.ts && git commit -m "feat: add seeded matchday income variance roll"`

---

### Task 2: Settlement attaches variance + reveals

**Files:**
- Modify: `src/game/career.ts` (`settlementLines` ~792, `homeGateIncome` ~1025, `weeklyMerchandiseIncome` ~1039)
- Test: `src/game/__tests__/finance-reveal-settlement.test.ts` (new)

- [ ] **Step 1: Failing tests.** Build states through public API/local builders (do NOT import private helpers from `career.test.ts`; copy minimal builders into this file). Assert through `advanceWeek`/`completeMatchday` → `state.ledgers`. Cases:

1. Determinism: settle two `structuredClone`-identical states → `JSON.stringify`-identical settled lines.
2. Home league week: `reveal.source === 'league-gate'`; `amount === base + Math.floor(base * (multiplierPercent - 100) / 100)`.
3. Merch with shop(s): `reveal.source === 'merch'`; `amount === base * multiplierTimes + adjacencyAmount`; `adjacencyAmount === Math.floor(base * multiplierTimes * adjacencyPercent / 100)`.
4. Away-match week: no gate line; merch still reveals.
5. Quiet week: merch has NO reveal and equals baseline `weeklyMerchandiseIncome`.
6. Season-final week: no reveals anywhere.
7. Cup home week: `cup-gate` reveal; league+cup double-header carries three reveal-capable lines with three independent rolls.
8. Zero-fan home fixture: gate amount 0, NO reveal.
9. Constant lines: never a reveal.
10. **Projection parity at p = 0, per source** — for each of gate and merch, SEARCH the seed space in-test for a `careerSeed` where `matchdayVarianceRoll(seed, season, week, source).percent === 0` (loop seeds; assert one found; hardcode nothing), build a report-ELIGIBLE home-match state with that seed, settle, and assert the settled line equals the baseline function on the same state. This tests real gate parity on a week that HAS a gate line (a quiet week cannot).
11. Bounds at scale over ~100 careerSeeds: `variancePercent ∈ [−10, 20]`, `surge ⇔ percent ≥ 11`.

**Watched vs Quick Result parity is a store-path test, not a game-ring test** — it lands in Task 4's file: drive the store's quick-result path and watched path (they fork at `store.ts` ~902 / ~1014) from identical pre-states with identical fixture results and assert identical settled ledgers including reveals. Clone determinism (case 1 here) is NOT a substitute.

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement in `career.ts`** — exact code as plan v2 (unchanged; reproduced here so this document stands alone):

(a) Imports: `matchdayVarianceRoll`, `applyVariancePercent` from `./finance-variance`; `LedgerLineReveal` in the types import.

(b) Eligibility:

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

(c) Facility counting (keep `gridStadiumStandLevel` exported, delegating):

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

(d) Income functions — baseline signatures preserved for the two projection call sites (`view-models.ts` ~315, ~429); merch baseline moves to per-level rounding (spec §6):

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

(e) The three `settlementLines` push sites spread the optional reveal (exact replacements as v2):

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

- [ ] **Step 4: New file → PASS.**
- [ ] **Step 5: `npm test`; repair pinned expectations by re-deriving from seed + formula** (compute the roll for the test's fixed state, apply §6 math, and leave the derivation in a comment) — never by copying jest output. `opening-economy-balance.test.ts` must pass untouched; if red: flip `SEASON_ONE_NORMAL_BAND_MIN` to `-5`, add the focused season-band test (season 1 `percent ≥ −5`, season 2 full band), note the doc/PR follow-ups (Tasks 12/14: docs/06 active band + BOTH EV figures — season-1 +3.8%, later seasons +1.55%), include `src/game/finance-variance.ts` in this task's staging, re-run; if still red, STOP and surface to owner.
- [ ] **Step 6: `npx tsc --noEmit`; scoped commit** — `"feat: settle gate and merch income with seeded variance and saved reveals"`.

---

### Task 3: Codec — reveal sanitization

**Files:**
- Modify: `src/persistence/game-state-codec.ts` (schema block ~109; normalization pipeline ~2032–2053)
- Test: `src/persistence/__tests__/ledger-reveal-sanitize.test.ts`

- [ ] **Step 1: Failing tests** — round-trip preservation (incl. `variancePercent: -7` survival), and strip cases: source/kind mismatch; band/flag disagreements both ways; `base: 0`; gate reconstruction mismatch; merch adjacency mismatch; `multiplierTimes: 0`; `reveal: "garbage"`; overflow at EACH reconstruction intermediate — multiplication AND the final addition (e.g. `base: Number.MAX_SAFE_INTEGER - 1, multiplierTimes: 4`; and a case where `afterMultiplier + adjacencyAmount` overflows) — strips, never throws.

- [ ] **Step 2 → 3: Implement.** Schemas (sanitizer-only, never in the state schema):

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

// zod v4 accepts enum discriminators directly.
const ledgerLineRevealSchema = z.discriminatedUnion('source', [gateRevealSchema, merchRevealSchema]);
```

Pipeline normalizer (`unknown => unknown`, `isRecord`-guarded, registered with its peers ~line 2032, before final validation):

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
    const reconstructed = afterMultiplier + reveal.adjacencyAmount;
    if (!Number.isSafeInteger(reconstructed)) return false;
    return reconstructed === line.amount;
  }
  if (line.kind !== 'tickets') return false;
  const bonusProduct = reveal.base * (reveal.multiplierPercent - 100);
  if (!Number.isSafeInteger(bonusProduct)) return false;
  const reconstructed = reveal.base + Math.floor(bonusProduct / 100);
  if (!Number.isSafeInteger(reconstructed)) return false;
  return reconstructed === line.amount;
}
```

`GAME_SCHEMA_VERSION` does NOT bump.

- [ ] **Step 4: PASS + persistence suite; `npx tsc --noEmit`; scoped commit** — `"feat: fail-soft ledger reveal sanitization in the save codec"`.

---

### Task 4: View models — pass-through, settlement week, store-path parity

**Files:**
- Modify: `src/ui/models.ts` (~263, ~306), `src/application/view-models.ts` (~2498)
- Modify: `src/application/__tests__/store.test.ts` (~1647 — `examplePostMatch()` literal gains both new required fields)
- Test: extend the existing `postMatchViewModel`/store coverage

- [ ] **Step 1: Failing tests.**
  1. Reveal pass-through: gate/merch lines in `store.postMatch.ledger` carry `reveal` equal to the settled lines'; `settlementSeason`/`settlementWeek` equal the settled week; `clubFinancesViewModel(...).ledger` lines carry no `reveal`.
  2. **Watched vs Quick Result parity (application paths):** from two identical pre-match stores, drive one through the quick-result action and one through the watched-match completion path (the fork at `store.ts` ~902 / ~1014) with identical fixture results; assert the settled `career.ledgers` tails are deeply equal INCLUDING reveals, and both `postMatch.ledger` view models match.

- [ ] **Step 2 → 3: Implement** (as v2): `PostMatchLedgerLineViewModel extends LedgerLineViewModel { reveal?: LedgerLineReveal }` in `src/ui/models.ts` (+ type import); `PostMatchViewModel.ledger` retyped; `settlementSeason`/`settlementWeek` added; `postMatchViewModel` maps `...(line.reveal === undefined ? {} : { reveal: line.reveal })` and returns `settlementSeason: before.season, settlementWeek: before.week`; `store.test.ts` literal updated.

- [ ] **Step 4: PASS; `npx tsc --noEmit`; scoped commit** — `"feat: pass ledger reveals and settlement week through the post-match view model"`.

---

### Task 5: Audio assets + report SFX controller + App wiring

**Files:**
- Create: `assets/audio/sfx/ledger-spin.wav`, `assets/audio/sfx/ledger-thunk.wav`
- Create: `src/render/financial-report-sfx.ts`
- Modify: `App.tsx` (volume effect ~953; unmount teardown ~986)
- Test: `src/render/__tests__/financial-report-sfx.test.ts`

- [ ] **Step 1: Assets** (pcm_s16le/48k/stereo, matching `flame-up.wav`):

```bash
ffmpeg -y -i "/Users/joemacprom5/Library/Mobile Documents/com~apple~CloudDocs/sounds/progress.webm" -ar 48000 -ac 2 -c:a pcm_s16le assets/audio/sfx/ledger-spin.wav
ffmpeg -y -i "/Users/joemacprom5/Library/Mobile Documents/com~apple~CloudDocs/sounds/thunk.webm" -ar 48000 -ac 2 -c:a pcm_s16le assets/audio/sfx/ledger-thunk.wav
```

- [ ] **Step 2: Failing tests.** Mock `expo-audio` as `management-sfx.test.ts` does, with controllable `seekTo` promises; the fake player shape must include a writable `muted` field. Cases:
  - Spin: stop before pending seek resolves → no late play; double-start restarts cleanly.
  - **Thunk pool (4 voices, per-voice generation):** four rapid `playLedgerThunk()` calls use four distinct voices; a FIFTH call wraps to voice 0 — if voice 0's original seek is still unresolved, the wrapped call's new generation invalidates it (delayed-seek wraparound test); a pending thunk seek after `stopAllFinancialReportSfx()` never plays.
  - Surge: `playSurgeIgnition()` starts flame-up AND crackle (loop=true); `stopSurgeBed()` pauses BOTH; pending flame-up seek after stop never plays; double-stop safe.
  - **Suspend epoch:** `playLedgerSpin()` with unresolved seek → suspend → resume → old seek resolves → NOTHING plays (the suspend epoch captured at start no longer matches). Crackle intent survives: surge active at suspend → resume restarts crackle with a FRESH seek; surge stopped before resume → silence. A `play*` call while `audioIsSuspended()` is true starts nothing.
  - Volume: `setFinancialReportSfxMasterVolume(0)` sets `volume = 0` AND `muted = true` everywhere; restoring unmutes.
  - Rejected seek: never throws, never wedges later plays.
  - `teardownFinancialReportSfx()` removes/releases all; later play re-inits cleanly.

- [ ] **Step 3: Implement.** Cancellation model — three layers, all checked inside every async `isCurrent` guard:
  - **Per-cue generation:** `spinGen`; `surgeGen` + `crackleActive`; per-thunk-voice `voiceGen[i]` (bumped each time that voice is (re)used — the wraparound guard).
  - **`stopEpoch`:** bumped by `stopAllFinancialReportSfx()`; captured by every start.
  - **`suspendEpoch`:** bumped by BOTH `suspend()` and `resume()`; captured by every start — a seek that started before a suspend can never play after resume.
  - Import and consult `audioIsSuspended()` from `./audio-lifecycle` (exported at ~line 70) at every start; register `registerAudioOwner({ suspend, resume })` (contract requires both, ~line 15). `suspend`: pause all players (crackle intent — `crackleActive` — preserved). `resume`: if `crackleActive` and the surge generation unchanged, start a FRESH crackle seek; all other cues stay silent.

```ts
function seekThenPlay(player: AudioPlayer | null, isCurrent: () => boolean): void {
  if (player === null || audioIsSuspended()) return;
  try {
    player.pause();
    player.seekTo(0).then(
      () => { if (isCurrent() && !audioIsSuspended()) { try { player.play(); } catch { /* non-fatal */ } } },
      () => { /* rejected seek: stay silent, never wedge */ },
    );
  } catch { /* non-fatal */ }
}
```

Every call site builds `isCurrent` from the tuple it captured at start, e.g. spin: `const gen = ++spinGen; const stop = stopEpoch; const sus = suspendEpoch; seekThenPlay(spinPlayer, () => gen === spinGen && stop === stopEpoch && sus === suspendEpoch)`. Thunk voice i: `const gen = ++voiceGen[i]; …` plus the same epoch pair. Gains: spin 0.6, thunk 1.0, flame-up 0.9, crackle 0.5, each × master; volume 0 ⇒ `muted = true` on all (audio.ts ~275 behavior). `stopSurgeBed()` pauses flame-up AND crackle and bumps `surgeGen`, clears `crackleActive`. Exports: `playLedgerSpin, stopLedgerSpin, playLedgerThunk, playSurgeIgnition, stopSurgeBed, stopAllFinancialReportSfx, setFinancialReportSfxMasterVolume, teardownFinancialReportSfx`.

- [ ] **Step 4: Wire `App.tsx`** — volume effect + unmount teardown. **Step 5: PASS; `npx tsc --noEmit`; scoped commit (includes both wavs)** — `"feat: financial report audio controller and owner-supplied ledger SFX"`.

---

### Task 6: Pixel art — crowd + merch toys

**Files:**
- Create: `src/ui/finance-pixel-art.ts`
- Test: `src/ui/__tests__/finance-pixel-art.test.ts`

- [ ] **Step 1: Failing tests:**

```ts
import { CROWD_SPRITE_IDS, MERCH_TOY_IDS, financeSpriteRows, financeSpriteRuns, pickMerchToys } from '../finance-pixel-art';

describe('finance pixel art', () => {
  it('every sprite is a 16x16 grid over known palette keys', () => {
    for (const id of [...CROWD_SPRITE_IDS, ...MERCH_TOY_IDS]) {
      const rows = financeSpriteRows(id);
      expect(rows).toHaveLength(16);
      for (const row of rows) expect(row).toHaveLength(16);
      expect(financeSpriteRuns(id).length).toBeGreaterThan(0);
    }
  });

  it('ships exactly ten merch toys and five crowd fans', () => {
    expect(MERCH_TOY_IDS).toHaveLength(10);
    expect(CROWD_SPRITE_IDS).toHaveLength(5);
  });

  it('picks 4-5 toys deterministically from season and week', () => {
    const a = pickMerchToys(2, 9);
    expect(pickMerchToys(2, 9)).toEqual(a);
    expect(a.length).toBeGreaterThanOrEqual(4);
    expect(a.length).toBeLessThanOrEqual(5);
    expect(new Set(a).size).toBe(a.length);
    expect(pickMerchToys(2, 10)).not.toEqual(a); // true for this seed pair
  });
});
```

- [ ] **Step 2 → 3: Implement.** `event-pixel-art.ts` format: 16×16 character grids over a local copy of its `PALETTE` letters; `FINANCE_SPRITE_CELL = 16`, **`FINANCE_SPRITE_SCALE = 3`** (five sprites at scale 4 = 320 px would clip phones; scale 3 → 240 px + padding). Exports: `CROWD_SPRITE_IDS` (5 cheering chibi fans, arms up, varied kit colors, confetti pixels), `MERCH_TOY_IDS` (scarf, ball, foam finger, bobblehead, plush mascot, snow globe, boot keychain, jersey, card pack, club mug), `financeSpriteRows(id)`, `financeSpriteRuns(id): readonly { x: number; y: number; width: number; color: string }[]` (row-run-length encoding of non-`.` cells, mirroring `eventSpriteRuns`), and:

```ts
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

Reference grids setting the drawing style (author the other 13 to match — chunky `K` ink outlines, docs/11 palette):

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

- [ ] **Step 4: PASS; `npx tsc --noEmit`; scoped commit** — `"feat: crowd and merch toy pixel art for surge banners"`.

---

### Task 7: The pure reveal machine + command runtime (fully tested core)

**Files:**
- Create: `src/ui/financial-statement-machine.ts`
- Create: `src/ui/financial-statement-runtime.ts`
- Test: `src/ui/__tests__/financial-statement-machine.test.ts`, `src/ui/__tests__/financial-statement-runtime.test.ts`

**Machine contract** — the reducer is configured (it must know rows, net, and timings; a bare `(state, event)` cannot compute anything):

```ts
export interface MachineTimings {
  rowSpinMs: number;        // 500
  surgeSpinFactor: number;  // 1.3
  netSpinMs: number;        // 650
  interRowMs: number;       // 80
  chipMs: number;           // 150
  odometerMs: number;       // 200
  adjacencyMs: number;      // 150
  stampMs: number;          // 250
}
export const DEFAULT_MACHINE_TIMINGS: MachineTimings; // the spec §4 values above

export interface MachineRow { id: string; amount: number; reveal?: LedgerLineReveal }

export interface MachineConfig {
  rows: readonly MachineRow[];
  netAmount: number;
  timings: MachineTimings;
  reduceMotion: boolean;
}

export type RowPhase = 'pending' | 'spinning' | 'base' | 'chip' | 'multiplied' | 'adjacency' | 'complete';

export interface MachineState {
  generation: number;      // bumped by every event that cancels scheduled work
  rows: readonly { phase: RowPhase; shownValue: number; settleKey: number; settleMode: SettleMode }[];
  net: { phase: 'pending' | 'spinning' | 'complete'; shownValue: number; settleKey: number; settleMode: SettleMode };
  stampVisible: boolean;
  status: 'running' | 'reportComplete';
  cursor: { kind: 'row'; index: number } | { kind: 'net' } | { kind: 'done' };
  bannerQueue: readonly { rowId: string; kind: 'attendance' | 'merch' }[];
  bannersEnqueued: readonly string[];
}

export type SettleMode = 'land' | 'odometer' | 'adjacency' | 'instant';

export type MachineEvent =
  | { type: 'start' }
  | { type: 'timer'; generation: number; target: 'row' | 'net'; index: number; expectPhase: RowPhase | 'advance' | 'stamp' }
  | { type: 'amountSettled'; generation: number; target: 'row' | 'net'; index: number; settleKey: number }
  | { type: 'tap' }
  | { type: 'bannerShown'; rowId: string };  // ignored unless rowId is the queue head

export type MachineCommand =
  | { type: 'schedule'; afterMs: number; event: MachineEvent }
  | { type: 'playSpin' } | { type: 'stopSpin' }
  | { type: 'playThunk' }
  | { type: 'playSurgeIgnition' } | { type: 'stopSurgeBed' };

export function createMachine(config: MachineConfig): MachineState;
export function reduce(config: MachineConfig, state: MachineState, event: MachineEvent):
  { state: MachineState; commands: readonly MachineCommand[] };
```

Notes locked in: `settleAmount` is not a command — the row's `{ shownValue, settleKey, settleMode }` in state drives `SlotAmount`, and `amountSettled` events flow back (generation-checked) to advance phases. Phase-advance rules: base-land thunk fires on the base `amountSettled` (digits actually landed), not when the spin timer expires; the spin timer only transitions `spinning → base` (stop spin audio + set the base value settling). The **automatic** net path emits TWO thunks (net `amountSettled` → thunk; stamp timer → thunk + `stampVisible`); a **tapped** net coalesces into ONE thunk with stamp in the same reduction. Merch flow: `hasMultiplier = multiplierTimes > 1`, `hasAdjacency = adjacencyAmount > 0`, independent — N=1+adjacency goes base → adjacency (no chip); identity reveals go base → complete.

- [ ] **Step 1: Failing machine tests** — the matrix (drive the machine by feeding back its own scheduled/settled events synchronously):

1. Happy path (timer flow): rows spin → base → … → complete in order; exactly one playSpin/stopSpin per row; base thunk emitted on `amountSettled`, not on the spin timer; net row last; automatic net = two thunks (land + stamp); `status 'reportComplete'`.
2. Stale timer (old generation) and stale `amountSettled` (old settleKey) → zero commands.
3. Tap during EVERY phase of a multiplied surged row → atomic complete (`settleMode 'instant'`, shownValue final), ONE thunk, stopSpin + stopSurgeBed present, banner enqueued exactly once (also when the tap skipped the spin phase entirely), generation bumped, next row scheduled after `interRowMs`.
4. Rapid double tap → second tap acts on the NEXT row; never re-completes, never double-thunks, never double-schedules.
5. Tap on net → complete + stamp + `reportComplete` in one reduction, ONE thunk; further taps → zero commands.
6. Phase flows: gate `multiplierPercent > 100` → base(land) → chip → multiplied(odometer) → complete; merch N>1 + adjacency → base → chip → multiplied → adjacency → complete; merch N=1 + adjacency → base → adjacency → complete (NO chip); identity → base → complete. `settleMode` values match each transition.
7. Surge timing: land timer at `rowSpinMs × surgeSpinFactor`; `playSurgeIgnition` at spin start; `stopSurgeBed` at the spin→base transition **also on the automatic (non-tapped) path**, with exactly one banner.
8. Empty ledger: `start` goes straight to the net row.
9. Reduce motion: everything complete at creation, stamp visible, `reportComplete`, bannerQueue pre-populated with every surged row in ledger order.
10. Triple surge: three banners FIFO in ledger order; `bannerShown` with the HEAD rowId dequeues; `bannerShown` with a non-head rowId is ignored.
11. `createMachine` with `netAmount` and rows reproduces shownValues from config (config-driven, no hidden state).

- [ ] **Step 2: Implement the machine to that matrix.**

**Runtime contract** (`financial-statement-runtime.ts`) — the RN-free executor the component uses; testable with fake timers:

```ts
export interface RuntimeAudio {
  playSpin(): void; stopSpin(): void; playThunk(): void;
  playSurgeIgnition(): void; stopSurgeBed(): void; stopAll(): void;
}
export interface StatementRuntime {
  dispatch(event: MachineEvent): void;   // reduce against an authoritative internal ref,
                                         // publish the snapshot via onState, THEN execute commands
  dispose(): void;                       // clears all pending timeouts, suppresses any
                                         // already-dequeued callback, calls audio.stopAll() once
  readonly getState: () => MachineState;
}
export function createStatementRuntime(opts: {
  config: MachineConfig;
  audio: RuntimeAudio;
  onState: (state: MachineState) => void;
  setTimeoutFn?: typeof setTimeout;      // injectable for tests
  clearTimeoutFn?: typeof clearTimeout;
}): StatementRuntime;
```

The authoritative-ref rule (React-batching safety): `dispatch` reduces against the runtime's own `state` field, replaces it synchronously, calls `onState(snapshot)`, and only then executes commands — never reduce inside a React functional updater, never execute commands from one.

- [ ] **Step 3: Failing runtime tests** (jest fake timers): scheduled events fire through timers and advance the machine; `dispose()` clears every pending handle (advance timers after dispose → nothing runs), suppresses in-flight callbacks, calls `audio.stopAll()` exactly once (double-dispose safe); two synchronous `dispatch({type:'tap'})` calls act on consecutive rows (authoritative ref, not stale closures).

- [ ] **Step 4: Implement runtime; all tests PASS; `npx tsc --noEmit`; scoped commit** — `"feat: pure financial statement machine and command runtime"`.

---

### Task 8: SlotAmount — the digit reel

**Files:**
- Create: `src/ui/components/SlotAmount.tsx`

Contract (consumes machine row state directly):

```ts
export interface SlotAmountProps {
  value: number;                 // what the reel settles to now
  finalValue: number;            // the row's FINAL amount — reserves width from the start
  phase: 'pending' | 'spinning' | 'settled';
  settleMode: 'land' | 'odometer' | 'adjacency' | 'instant';
  settleKey: number;             // re-runs the settle animation for the new value
  tone: 'income' | 'expense' | 'neutral';
  surge: boolean;
  large?: boolean;
  reduceMotion: boolean;
  onSettled?: (settleKey: number) => void;  // fires ONCE per settleKey, after digits AND land pop
}
```

Requirements (complete component; typecheck + QA verified):
- ASCII `-`/`+` signs (Silkscreen lacks U+2212 — `Scorecard.tsx:10`); `formatCurrency` digits.
- Width reservation: invisible `format(finalValue)` sizing text; live reel/placeholder absolutely overlaid; `$•••` dimmed placeholder for `pending`.
- Cell geometry scales with `PixelRatio.getFontScale()` (the 1.6× pass).
- Reel track spans TWO full cycles + closing zero (`0…9,0…9,0`) so an upward roll from ANY settled digit to ANY target digit stays upward (from position p, the target's next occurrence ≤ one cycle ahead always exists); continuous spin loops over one cycle.
- Settle durations by mode: `land` = 90 ms/digit with 30 ms left-to-right stagger; `odometer` = 200 ms total; `adjacency` = 150 ms total; `instant` = no animation, jump to final. `onSettled(settleKey)` fires after the LAST digit's animation completes AND the 120 ms land pop finishes (`Animated.sequence` completion callback — never a guessed timeout). `instant` fires it synchronously (via effect).
- Spin loops stored in refs, `.stop()`ed on phase change/unmount (`EventPixelScene` cleanup pattern).
- Surge: spinning = looping `#b45309 → #dc2626 → #f59e0b` color flicker (JS-driven, `useNativeDriver: false` for color only); settled = one font size larger + permanent `#b45309`. **No synthetic bold**: `pixel-type-and-empty-states.test.ts:42` rejects `font-mono font-bold`; the mono face has no authored bold — the surge treatment is SIZE + COLOR only (spec's "bold" satisfied by weight-of-presence; log as a deviation in the commit body).
- Land pop scale 1 → 1.06 → 1 (120 ms, native driver) as part of the settle sequence.
- Colors: income `#265b30`, expense `#a83440`, neutral `#241f2e`; spinning digits at 55% alpha.
- `reduceMotion`: static final text; `onSettled` fires synchronously per settleKey.

- [ ] Steps: implement → `npx tsc --noEmit` → scoped commit `"feat: SlotAmount digit-reel component"`.

---

### Task 9: FinancialStatement, SurgeBanner, FinancialReportBody

**Files:**
- Create: `src/ui/components/FinancialStatement.tsx`, `src/ui/components/SurgeBanner.tsx`, `src/ui/components/FinancialReportBody.tsx`

- [ ] **Step 1: `SurgeBanner.tsx`** — full spec (self-contained; no references to earlier plan versions):

```ts
export interface SurgeBannerEvent { rowId: string; kind: 'attendance' | 'merch' }
export interface SurgeBannerProps {
  queue: readonly SurgeBannerEvent[];   // machine.bannerQueue
  settlementSeason: number;             // toy-subset seed (spec §7)
  settlementWeek: number;
  onShown: (rowId: string) => void;     // dispatches {type:'bannerShown', rowId}
  reduceMotion: boolean;
}
```

Renders `pointerEvents="none"` absolutely over the statement (`className="absolute inset-x-4 top-1/3"`), showing `queue[0]` only: paper card `border-2 border-b-4 border-ink bg-paper`, `rotate: '-3deg'`; pop-in `Animated.spring` scale 0.2 → 1, hold 2000 ms, fade 200 ms, then `onShown(rowId)`. Under `reduceMotion` the card is FULLY static (no pop, no fade) for its 2 s. Content: Skia `<Canvas>` sprite strip — `attendance`: the five `CROWD_SPRITE_IDS` side by side; `merch`: `pickMerchToys(settlementSeason, settlementWeek)` side by side — each sprite drawn as `<Rect>`s from `financeSpriteRuns(id)` at `FINANCE_SPRITE_SCALE` (3), the `EventPixelScene` rendering pattern. Headline `PixelText`: `EXTREME ATTENDANCE!` (`text-red-dark`) / `TRENDING MERCHANDISE!` (`text-pitch-ink`). `accessibilityRole="alert"`, label = headline.

- [ ] **Step 2: `FinancialStatement.tsx`** — thin shell:

```ts
export interface FinancialStatementProps {
  lines: readonly PostMatchLedgerLineViewModel[];
  netAmount: number;
  settlementSeason: number;
  settlementWeek: number;
  reduceMotion: boolean;
}
```

- Creates the runtime once (`useRef`/`useMemo`): `createStatementRuntime({ config: { rows, netAmount, timings: DEFAULT_MACHINE_TIMINGS, reduceMotion }, audio: <the Task 5 controller mapped to RuntimeAudio>, onState: setMachineState })`; dispatches `{type:'start'}` on mount; `runtime.dispose()` on unmount.
- Owns the PaperPanel (`kicker="Accounts office" title="Match statement"`, NO stamp prop — stamp self-rendered on `stampVisible` with the 250 ms slam: rotate −8°→4°, scale 1.4→1).
- Rows render label + UI-only suffix (gate `facilityCount > 0` → `· N stand(s)`; merch `multiplierTimes >= 2` → `· N shop(s)`), the chip (`×{multiplierPercent}%` / `×{multiplierTimes}`, slide-in 10 px + fade at the chip phase), the adjacency caption (`+{adjacencyPercent}% adjacency`, fade at the adjacency phase), and `<SlotAmount>` fed from the machine row state (`value/settleKey/settleMode/phase`), with `onSettled={(key) => runtime.dispatch({ type: 'amountSettled', generation: state.generation, target, index, settleKey: key })}`.
- Tap surface: native RN `Pressable` (NOT `SfxPressable`) wrapping the ENTIRE panel content, `accessible={false}`, `onPress={() => runtime.dispatch({ type: 'tap' })}`, no function-form `style`.
- Surge rows while spinning: the **sweeping warm wash** — an absolutely-positioned `Animated.View` overlay (`#fdba74` at 35% opacity, width 40% of the row) whose translateX loops from −40% to 140% of the row width (~600 ms cycle, native driver); the row's base background sits at `#fde68a`. A pulse alone does not satisfy the spec's "sweeping the row".
- `rowAccessibilityLabel` helper exactly as specified in spec §12, skipping the multiplier phrase entirely for identity reveals (never "times 1" / "times 100 percent"), appending "Surged this week." on surges.
- `<SurgeBanner queue={state.bannerQueue} settlementSeason={…} settlementWeek={…} onShown={rowId => runtime.dispatch({ type: 'bannerShown', rowId })} reduceMotion={reduceMotion} />` over the panel.

- [ ] **Step 3: `FinancialReportBody.tsx`** — the shared inner composition used by BOTH the modal and the dev harness (so harness QA exercises the production composition):

```ts
export interface FinancialReportBodyProps {
  viewModel: PostMatchViewModel;
  reduceMotion: boolean;
}
```

Renders, in order: `<FinancialStatement lines={viewModel.ledger} netAmount={viewModel.netAmount} settlementSeason={viewModel.settlementSeason} settlementWeek={viewModel.settlementWeek} reduceMotion={reduceMotion} />` → What moved (TP/Fans `Metric`s with `CountUpText` + landing bounce) → buzz card → updates, each in `EntranceView` (translateY 12→0 + fade 320 ms; per-card stagger `80 * index`; warning-tone cards add one ±3° 300 ms wiggle; immediate under reduceMotion). `CountUpText` and `EntranceView` live here.

- [ ] **Step 4: `npx tsc --noEmit`; scoped commit** — `"feat: FinancialStatement shell, surge banners, shared report body"`.

---

### Task 10: Rewire PostMatchSummaryModal

**Files:**
- Modify: `src/ui/PostMatchSummaryModal.tsx`, `src/ui/screens/PostMatchLedgerScreen.tsx` (~125), `src/ui/components/Scorecard.tsx` (~180), `src/ui/__tests__/acceptance-audit-regressions.test.ts` (~63–77)

- [ ] **Step 1:**
  - Title → `Financial report`; close label → `Close financial report`; one shared `handleDismiss = () => { stopAllFinancialReportSfx(); onDismiss(); }` used by close, backdrop, Continue, AND `onRequestClose` (Android back).
  - DELETE the score row + StatusChip block, `CountUpAmount`, `animationsComplete`/`onTouchStart`. KEEP the `countUpValue` import (used by `CountUpText` in `FinancialReportBody`).
  - Body becomes `<FinancialReportBody viewModel={viewModel} reduceMotion={reduceMotion} />` inside the existing ScrollView; keep `playMatchStatementSfx` mount effect.
  - `Metric.value` in `Scorecard.tsx` widens `string → ReactNode` (string stays assignable).
  - `PostMatchLedgerScreen.tsx` ~125: stale "match summary" accessibility wording → "financial report".
- [ ] **Step 2:** Retarget the audit rails in `acceptance-audit-regressions.test.ts:63–77` (row `accessibilityLabel` guard → `FinancialStatement.tsx`; TP-change guard → the new `CountUpText`/`FinancialReportBody` source) — retarget, never delete.
- [ ] **Step 3:** `npx jest --runTestsByPath src/ui/__tests__/overlay-dismissal.test.ts src/ui/__tests__/acceptance-audit-regressions.test.ts src/ui/__tests__/pixel-type-and-empty-states.test.ts`; `npx tsc --noEmit`. **Commit** — `"feat: rebuild post-match modal as the Financial Report"`.

---

### Task 11: Dev harness entry

**Files:**
- Create: `src/ui/dev-harness/entries/financial-report.tsx`
- Modify: `src/ui/dev-harness/registry.ts` (import + row, group **`'Match'`**, beside Full-time Report)

- [ ] **Step 1:** Cases: `baseline`, `facilities` (2 stands ×200%, 3 shops ×3 + adjacency), `gate-surge`, `merch-surge`, `triple-surge`, `zero-fan-home`, `longest-ledger`, `reduce-motion` — and `reduce-motion` MUST include a surged line so the static banner is exercised. Render `<FinancialReportBody>` INLINE (no RN `Modal` — it would sit over the harness controls) in a ScrollView with a "Replay" button that bumps a `key` to remount. Build view models from one factory + reveal builders (amounts COMPUTED from reveal fields so every case reconstructs by construction):

```ts
function gateReveal(base: number, opts?: { percent?: number; surge?: boolean; standLevel?: number; standCount?: number; cup?: boolean }): PostMatchLedgerLineViewModel { /* amount = base + floor(base * standLevel * 50 / 100) */ }
function merchReveal(base: number, opts?: { percent?: number; surge?: boolean; times?: number; count?: number; adjacencyPercent?: number }): PostMatchLedgerLineViewModel { /* amount = base*times + floor(base*times*adj/100) */ }
function reportCase(lines: PostMatchLedgerLineViewModel[], overrides?: Partial<PostMatchViewModel>): PostMatchViewModel { /* fixed plausible result/updates/TP/fans/settlement week */ }
```

- [ ] **Step 2:** `npx tsc --noEmit` (no registry jest test exists — `route.test.ts` deliberately avoids the RN registry). **Commit** — `"feat: financial report dev-harness entry"`.

---

### Task 12: Finances outlook microcopy + docs sync

**Files:**
- Modify: outlook label sites (`grep -rn "Next four weeks\|Four-week balance" src/ui`), `docs/08-ui-ux.md`, `docs/06-economy.md`, `docs/02-core-loop.md`, `README.md`

- [ ] **Step 1:** `Next four weeks · typical`, `Four-week balance · typical`; update pinned string assertions.
- [ ] **Step 2:** `docs/08-ui-ux.md`: rewrite BOTH stale passages — the weekly-flow paragraph (~line 30) and Match Day flow item 3 (~line 37) — to the Financial Report flow (row-by-row slot reveal, one-row-per-press, reduce-motion), plus the narrow palette exception (permanent fire tint + larger type only on surged income amounts in this report). `docs/06-economy.md`: report-eligible variance (bands, 1-in-10 surge, eligibility, determinism; the active band + both EV figures if the season-1 contingency flipped), baseline projections, per-level Fan Shop formula. `docs/02-core-loop.md`: statement renamed Financial Report. `README.md`: decision-log line AND advance the "locked through 2026-08-05" heading date.
- [ ] **Step 3: Commit** — `"docs: sync canon docs with the Financial Report design"`.

---

### Task 13: Full verification + QA evidence

- [ ] `npx tsc --noEmit`; `npm test` (includes `opening-economy-balance.test.ts`; contingency path per Task 2 Step 5; STOP if still red after the clamp).
- [ ] **Web animation QA:** the dev harness needs its flag — export with `EXPO_PUBLIC_DEV_HARNESS=1 npx expo export --platform web --clear` then the `fix-worker-bundles` step (see README ~line 24 for the documented harness export command), copy `canvaskit.wasm` into `dist`, serve, browser pane → `financial-report` entry, **mute audio immediately**, verify every case, capture screenshots (RAF-recorder + forced-paint). Close tab, stop server.
- [ ] **Native + audio QA (iOS simulator):** launch with `EXPO_PUBLIC_DEV_HARNESS=1` set for the harness; verify: spin bed per row; thunk on land and tap (machine-gun clean — 4-voice pool); flame-up + crackle on surge rows only, both stopping at land; no late audio after rapid skips/dismissal; volume 0 silences (muted). Background/foreground mid-surge-spin → crackle resumes only if that row still spins; a suspend-straddling seek never plays. Shut the simulator down afterwards.
- [ ] Large-text (1.6×) and longest-ledger passes: no clipped digits, net + stamp reachable.

---

### Task 14: Commit + PR

- [ ] Final `git status` clean; `git push -u origin claude/match-summary-financial-redesign-ee490a`.
- [ ] `gh pr create` against `main`: title `feat: Financial Report post-match redesign`; body: spec + council audits, variance economics (+1.55% EV per eligible line; if the season-1 contingency activated, report BOTH figures — season-1 +3.8%, later seasons +1.55%), coverage summary, QA screenshots; standard generated-with footer. (Council note: one reviewer initially preferred gating push/PR on fresh authorization; the owner's standing instruction for this session explicitly ordered commit + PR without further asking — Codex accepted this in round 2.)

---

## Self-review notes (v3)

- Round-2 items: machine reducer now configured (`MachineConfig` into `createMachine`/`reduce`), net represented explicitly (`net` field + cursor sentinel), `amountSettled` and rowId-carrying `bannerShown` events added, authoritative-ref dispatch rule stated (Task 7); runtime executor extracted and fake-timer-tested for disposal/stopAll-once/double-tap (Tasks 7); SlotAmount gains `settleMode` with per-mode durations, two-cycle track, pop-inclusive callback, no-synthetic-bold rule (Task 8); base thunk on digit-land, automatic net two thunks vs tapped one (Task 7 rules + tests); suspend epoch + per-voice thunk generations + 4-voice pool + `audioIsSuspended()` direct + wraparound test (Task 5); uint32 seed + merch final-addition safe check (Tasks 1, 3); projection parity via searched zero-roll seeds on eligible weeks, store-path watched-vs-quick parity in Task 4 (Tasks 2, 4); settlementSeason/Week wired modal → statement → banner → `pickMerchToys` (Tasks 9, 10); sweeping wash specified concretely (Task 9); all "plan v1" references replaced with self-contained content (Tasks 6, 9); `EXPO_PUBLIC_DEV_HARNESS=1` + `--clear` export and native flag (Task 13); shared `FinancialReportBody` for modal + harness (Tasks 9–11); reduce-motion harness case includes a surge (Task 11); contingency staging + dual-EV PR reporting (Tasks 2, 14); README locked-through heading (Task 12).
- Fable round-2 notes honored: `MachineTimings` exported with defaults; thunk pool implemented to the tests (per-voice generations, no vestigial shared counter); fake player shape includes `muted`.
- Name consistency: `MachineConfig/MachineTimings/DEFAULT_MACHINE_TIMINGS/SettleMode`, `createStatementRuntime/RuntimeAudio/StatementRuntime`, `FinancialReportBody`, controller API unchanged across Tasks 5/7/9/10.
