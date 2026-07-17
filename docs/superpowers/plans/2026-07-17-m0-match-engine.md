# M0 Match Engine Implementation Plan (v2 — revised after external review)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The M0 fun-gate build — a deterministic 11v11 match simulation (pure TypeScript) rendered with Skia Atlas: your 2 heroes vs. 1 rival hero, in-flight passes, per-power useful contexts, tap-to-fire with a real attention ladder (tap 100% > contextual auto 85% > lapse 75%), cheap telegraphs, Quick Result, and a worklet-path stress test.

**Architecture:** `src/sim/` is a pure, deterministic TypeScript engine (no RN/Skia/Expo imports; seeded PRNG; 100ms fixed ticks; integer-cm positions; no transcendental Math — logistic curve ships as a generated, checked-in integer table). One-way import graph: `rng/geometry → contest/formation/types → events → powers → engine → match`. `src/render/` interpolates tick snapshots at 60fps via Skia `Atlas`. Replays are envelopes (versions + seed + teams + inputs), not bare seeds.

**Tech Stack:** Expo (blank TypeScript template), @shopify/react-native-skia (Atlas), react-native-reanimated v4, Jest + ts-jest.

**Spec sources:** `docs/03-match-engine.md`, `docs/04-superpowers.md`, `docs/09-tech-stack.md`, `docs/10-roadmap.md` (M0).

**v2 changes from review:** United gets the SUPER_STRENGTH rival hero (license cap respected, counterplay tested); passes travel and are interceptable; `firePolicy` + per-power context predicates; causal-divergence and timing-value acceptance tests; `events.ts` breaks import cycles; `speedFor(state, idx)` authoritative; contest table replaces `Math.exp`; `Math.sqrt`-of-integer-squares replaces `Math.hypot`; replay envelope + full-payload golden snapshot; AppState-safe capped game loop with pause; worklet-driven stress screen; comprehension-question fun gate.

**Conventions for every task:** TypeScript strict; no `Math.random`/`Date.now`/`Math.exp`/`Math.hypot` anywhere under `src/sim/` (`Math.sqrt` on integer products is allowed — IEEE-exact); run `npx tsc --noEmit` before each commit; commit messages are descriptive and end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. M0 UI uses `StyleSheet.create` placeholders — NativeWind adoption is deliberately deferred to M1.

**File map (locked):**

```
App.tsx                          screen switcher: home | match | stress
scripts/gen-contest-table.mjs    one-shot generator for the logistic table
src/sim/rng.ts                   mulberry32 seeded PRNG
src/sim/geometry.ts              Vec, dist, dist2, moveToward, clamp + pitch constants
src/sim/contest-table.json       generated integer logistic table (committed)
src/sim/contest.ts               table-based contested-roll helper
src/sim/types.ts                 all sim types, events, inputs, replay envelope
src/sim/teams.ts                 Rovers (SPEED+TORCH) vs United (STRENGTH rival)
src/sim/formation.ts             4-4-2 anchors, mirroring, ball-shift
src/sim/events.ts                emit() — lowest-level event sink (breaks cycles)
src/sim/powers.ts                gauge, fire policies, contexts, 3 power effects
src/sim/engine.ts                movement, possession, pass flight, tackles, shots, restarts
src/sim/match.ts                 public API: createMatch, tick, queueInput, runMatch, runReplay
src/sim/__tests__/*.test.ts      one per module + parity acceptance suite
src/render/interpolate.ts        snapshot + lerp (pure, tested)
src/render/atlas.ts              placeholder sprite texture
src/render/MatchScreen.tsx       canvas + telegraphs + HUD + lifecycle-safe loop
src/render/StressScreen.tsx      2,000-sprite worklet-driven Atlas FPS test
```

---

### Task 1: Scaffold — Expo app, strict TS, Jest harness

**Files:**
- Create: Expo scaffold at repo root (via temp dir), `jest.config.js`
- Modify: `tsconfig.json`, `package.json`

- [ ] **Step 1: Scaffold Expo without clobbering README.md**

```bash
cd /Users/joemacprom5/Documents/Vibecode/Hero_Football_Manager
npx create-expo-app@latest hfm-scaffold --template blank-typescript
rm hfm-scaffold/README.md
cp -R hfm-scaffold/. .
rm -rf hfm-scaffold
grep -q '^\.DS_Store$' .gitignore || echo '.DS_Store' >> .gitignore
```

Expected: `App.tsx`, `package.json`, `tsconfig.json`, `app.json`, `assets/`, `.gitignore` at repo root; `README.md`, `CLAUDE.md`, `docs/`, `research/` untouched.

- [ ] **Step 2: Strict TS + JSON module imports**

`tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "resolveJsonModule": true
  }
}
```

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Jest for the pure sim core**

```bash
npm i -D jest ts-jest @types/jest
```

`jest.config.js`:

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
};
```

Add `"test": "jest"` to `package.json` scripts.

- [ ] **Step 4: Verify harness**

Run: `npm test` → "No tests found" (config loads cleanly; exit 1 is expected at this step).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo blank-TS app with strict TS, JSON modules, ts-jest"
```

---

### Task 2: Seeded PRNG (`rng.ts`)

**Files:**
- Create: `src/sim/rng.ts`
- Test: `src/sim/__tests__/rng.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { mulberry32 } from '../rng';

describe('mulberry32', () => {
  it('same seed produces identical sequences', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) expect(a()).toBe(b());
  });

  it('different seeds diverge', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(Array.from({ length: 10 }, a)).not.toEqual(Array.from({ length: 10 }, b));
  });

  it('outputs stay in [0,1) with a sane mean', () => {
    const r = mulberry32(7);
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 10000).toBeGreaterThan(0.47);
    expect(sum / 10000).toBeLessThan(0.53);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- rng` → FAIL: cannot find module '../rng'.

- [ ] **Step 3: Implement**

```ts
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- rng` → 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/sim/rng.ts src/sim/__tests__/rng.test.ts
git commit -m "feat(sim): seeded mulberry32 PRNG with determinism tests"
```

---

### Task 3: Geometry — sqrt-exact, no hypot (`geometry.ts`)

**Files:**
- Create: `src/sim/geometry.ts`
- Test: `src/sim/__tests__/geometry.test.ts`

IEEE 754 note baked into this design: `+ − × ÷ sqrt` are exactly specified (bit-identical on V8/Hermes/JSC); `Math.hypot` and `Math.exp` are not. All distance math uses integer squares + `Math.sqrt`; all threshold checks use `dist2` (no sqrt at all).

- [ ] **Step 1: Write the failing test**

```ts
import { dist, dist2, moveToward, clamp, PITCH_W, PITCH_H, GOAL_W, GOAL_CENTER_X, TICK_MS, HALF_TICKS } from '../geometry';

describe('geometry', () => {
  it('constants match the design doc', () => {
    expect(TICK_MS).toBe(100);
    expect(HALF_TICKS).toBe(1000);
    expect(PITCH_W).toBe(6800);
    expect(PITCH_H).toBe(10500);
    expect(GOAL_W).toBe(1400);
    expect(GOAL_CENTER_X).toBe(3400);
  });

  it('dist is euclidean, rounded; dist2 is the exact integer square', () => {
    expect(dist({ x: 0, y: 0 }, { x: 300, y: 400 })).toBe(500);
    expect(dist2({ x: 0, y: 0 }, { x: 300, y: 400 })).toBe(250000);
  });

  it('moveToward advances by speed, never overshoots, stays integer', () => {
    expect(moveToward({ x: 0, y: 0 }, { x: 100, y: 0 }, 60)).toEqual({ x: 60, y: 0 });
    expect(moveToward({ x: 0, y: 0 }, { x: 30, y: 0 }, 60)).toEqual({ x: 30, y: 0 });
    const p = moveToward({ x: 0, y: 0 }, { x: 1000, y: 1000 }, 100);
    expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
  });

  it('clamp bounds values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- geometry` → FAIL: cannot find module.

- [ ] **Step 3: Implement**

```ts
export interface Vec { x: number; y: number; }

export const TICK_MS = 100;
export const HALF_TICKS = 1000;
export const PITCH_W = 6800;
export const PITCH_H = 10500;
export const GOAL_W = 1400;
export const GOAL_CENTER_X = PITCH_W / 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist2(a: Vec, b: Vec): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function dist(a: Vec, b: Vec): number {
  return Math.round(Math.sqrt(dist2(a, b)));
}

export function moveToward(from: Vec, to: Vec, speed: number): Vec {
  const d2 = dist2(from, to);
  if (d2 === 0 || d2 <= speed * speed) return { x: to.x, y: to.y };
  const t = speed / Math.sqrt(d2);
  return { x: Math.round(from.x + (to.x - from.x) * t), y: Math.round(from.y + (to.y - from.y) * t) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- geometry` → 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/sim/geometry.ts src/sim/__tests__/geometry.test.ts
git commit -m "feat(sim): sqrt-exact integer geometry (no Math.hypot) and pitch constants"
```

---

### Task 4: Contest table — logistic without Math.exp (`contest.ts`)

**Files:**
- Create: `scripts/gen-contest-table.mjs`, `src/sim/contest-table.json` (generated), `src/sim/contest.ts`
- Test: `src/sim/__tests__/contest.test.ts`

- [ ] **Step 1: Write the generator and run it ONCE**

`scripts/gen-contest-table.mjs`:

```js
// Generates the logistic probability table used by src/sim/contest.ts.
// Math.exp is allowed HERE (build machine, one-off) — never in src/sim at runtime.
import { writeFileSync } from 'node:fs';

const table = [];
for (let d = -99; d <= 99; d++) {
  table.push(Math.round(65536 / (1 + Math.exp(-d / 12))));
}
writeFileSync('src/sim/contest-table.json', JSON.stringify(table));
console.log(`wrote ${table.length} entries`);
```

Run: `node scripts/gen-contest-table.mjs` → "wrote 199 entries". The JSON is committed; regeneration is always an explicit, reviewed act.

- [ ] **Step 2: Write the failing test**

```ts
import { contestProbability, contest } from '../contest';
import { mulberry32 } from '../rng';

describe('contest (table-based logistic)', () => {
  it('equal stats = 50%', () => {
    expect(contestProbability(50, 50)).toBeCloseTo(0.5, 3);
  });

  it('+20 advantage ≈ 84%', () => {
    expect(contestProbability(60, 40)).toBeCloseTo(0.8411, 2);
  });

  it('matches the true logistic within 1e-4 across the whole range', () => {
    for (let d = -99; d <= 99; d++) {
      const truth = 1 / (1 + Math.exp(-d / 12)); // Math.exp fine IN TESTS (approximation check, not runtime)
      expect(Math.abs(contestProbability(50 + d, 50) - truth)).toBeLessThan(1e-4);
    }
  });

  it('is monotonic and clamps beyond ±99', () => {
    expect(contestProbability(200, 0)).toBe(contestProbability(149, 50));
    let prev = 0;
    for (let d = -99; d <= 99; d++) {
      const p = contestProbability(50 + d, 50);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it('statistical: 60v40 wins ~84% over 10k seeded rolls', () => {
    const rng = mulberry32(123);
    let wins = 0;
    for (let i = 0; i < 10000; i++) if (contest(rng, 60, 40)) wins++;
    expect(wins / 10000).toBeGreaterThan(0.81);
    expect(wins / 10000).toBeLessThan(0.87);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- contest` → FAIL: cannot find module '../contest'.

- [ ] **Step 4: Implement**

```ts
import type { Rng } from './rng';
import table from './contest-table.json';
import { clamp } from './geometry';

/** P(attacker beats defender), from the committed integer table — no Math.exp at runtime. */
export function contestProbability(attacker: number, defender: number, mod = 0): number {
  const d = clamp(Math.round(attacker + mod - defender), -99, 99);
  return table[d + 99] / 65536;
}

export function contest(rng: Rng, attacker: number, defender: number, mod = 0): boolean {
  return rng() < contestProbability(attacker, defender, mod);
}
```

- [ ] **Step 5: Run tests, then commit**

Run: `npm test -- contest` → 5 passed.

```bash
git add scripts/gen-contest-table.mjs src/sim/contest-table.json src/sim/contest.ts src/sim/__tests__/contest.test.ts
git commit -m "feat(sim): checked-in logistic contest table — removes Math.exp from the runtime sim"
```

---

### Task 5: Types, replay envelope, demo teams (`types.ts`, `teams.ts`)

**Files:**
- Create: `src/sim/types.ts`, `src/sim/teams.ts`
- Test: `src/sim/__tests__/teams.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { ROVERS, UNITED } from '../teams';

describe('demo teams', () => {
  for (const team of [ROVERS, UNITED]) {
    it(`${team.name} has 11 players with a GK first`, () => {
      expect(team.players).toHaveLength(11);
      expect(team.players[0].role).toBe('GK');
      expect(team.players.filter(p => p.role === 'DEF')).toHaveLength(4);
      expect(team.players.filter(p => p.role === 'MID')).toHaveLength(4);
      expect(team.players.filter(p => p.role === 'FWD')).toHaveLength(2);
    });
  }

  it('Rovers field 2 heroes (license cap); United fields 1 rival hero — all 3 M0 powers covered', () => {
    expect(ROVERS.players.map(p => p.power).filter(Boolean).sort()).toEqual(['FIRE_TORCH', 'SUPER_SPEED']);
    expect(UNITED.players.map(p => p.power).filter(Boolean)).toEqual(['SUPER_STRENGTH']);
  });

  it('all attributes are 1-99', () => {
    for (const p of [...ROVERS.players, ...UNITED.players]) {
      for (const v of Object.values(p.attrs)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(99);
      }
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- teams` → FAIL: cannot find module.

- [ ] **Step 3: Implement `src/sim/types.ts` (single source of truth for every later task)**

```ts
import type { Vec } from './geometry';
import type { Rng } from './rng';

export type PowerId = 'SUPER_SPEED' | 'SUPER_STRENGTH' | 'FIRE_TORCH';
export type Role = 'GK' | 'DEF' | 'MID' | 'FWD';
export type FirePolicy = 'SAVE_FOR_TAP' | 'FIRE_WHEN_READY';

export interface Attrs {
  pac: number; sho: number; pas: number; def: number; tec: number; sta: number; ref: number;
}

export interface PlayerDef {
  id: string; name: string; role: Role; attrs: Attrs; power?: PowerId;
}

export interface TeamDef { id: string; name: string; players: PlayerDef[]; }

export type PowerState =
  | { kind: 'idle' }
  | { kind: 'ready'; sinceTick: number }
  | { kind: 'winding'; untilTick: number; strength: number }
  | { kind: 'active'; untilTick: number; strength: number };

export type OutReason = 'ko' | 'ignited' | 'redcard';

export interface SimPlayer {
  def: PlayerDef;
  team: 0 | 1;
  pos: Vec;
  condition: number;
  gauge: number;
  powerState: PowerState;
  firePolicy: FirePolicy;
  outUntilTick: number;       // 0 = fine
  outReason?: OutReason;
  tackleCooldownUntil: number;
  cards: 0 | 1 | 2;
}

export type BallState =
  | { kind: 'held'; by: number }
  | { kind: 'loose'; pos: Vec; vel: Vec }
  | { kind: 'pass'; pos: Vec; from: number; to: number; willSucceed: boolean; interceptor: number }
  | { kind: 'shot'; pos: Vec; vel: Vec; by: number; power: number; targetX: number };

export type MatchEvent =
  | { t: number; kind: 'KICKOFF'; half: 1 | 2 }
  | { t: number; kind: 'PASS'; from: number; to: number; ok: boolean }
  | { t: number; kind: 'TACKLE'; by: number; on: number; won: boolean }
  | { t: number; kind: 'SHOT'; by: number; power: number }
  | { t: number; kind: 'SAVE'; by: number; resolveLeft: number }
  | { t: number; kind: 'MISS'; by: number }
  | { t: number; kind: 'GOAL'; by: number; team: 0 | 1 }
  | { t: number; kind: 'POWER_READY'; player: number }
  | { t: number; kind: 'POWER_FIRED'; player: number; power: PowerId; strength: number }
  | { t: number; kind: 'POWER_INTERRUPTED'; player: number }
  | { t: number; kind: 'CARD'; player: number; color: 'yellow' | 'red' }
  | { t: number; kind: 'IGNITED'; player: number }
  | { t: number; kind: 'EXTINGUISHED'; player: number }
  | { t: number; kind: 'RECOVERED'; player: number }
  | { t: number; kind: 'HALF_TIME' }
  | { t: number; kind: 'FULL_TIME' };

export type MatchInput = { tick: number; kind: 'POWER_TAP'; player: number };

export interface MatchOpts {
  homePolicy?: FirePolicy;   // default SAVE_FOR_TAP
  awayPolicy?: FirePolicy;   // default FIRE_WHEN_READY
  blindAutoHome?: boolean;   // TEST-ONLY: home heroes auto-fire ignoring context (timing-value baseline)
}

export interface MatchState {
  tick: number;
  half: 1 | 2;
  phase: 'play' | 'fulltime';
  score: [number, number];
  players: SimPlayer[];      // 22; 0-10 team 0 (attacks toward y=0), 11-21 team 1
  ball: BallState;
  resolve: [number, number];
  rng: Rng;
  events: MatchEvent[];
  pendingInputs: MatchInput[];
  blindAutoHome: boolean;
}

export interface MatchResult { score: [number, number]; events: MatchEvent[]; }

export interface ReplayEnvelope {
  schemaVersion: 1;
  engineVersion: string;
  seed: number;
  home: TeamDef;
  away: TeamDef;
  inputs: MatchInput[];
}
```

- [ ] **Step 4: Implement `src/sim/teams.ts`**

```ts
import type { Attrs, PlayerDef, Role, TeamDef, PowerId } from './types';

function p(id: string, name: string, role: Role, attrs: Attrs, power?: PowerId): PlayerDef {
  return { id, name, role, attrs, power };
}
const a = (pac: number, sho: number, pas: number, def: number, tec: number, sta: number, ref: number): Attrs =>
  ({ pac, sho, pas, def, tec, sta, ref });

export const ROVERS: TeamDef = {
  id: 'rovers', name: 'Bramble Rovers',
  players: [
    p('r0', 'Sam Mitts', 'GK', a(40, 20, 45, 40, 35, 60, 62)),
    p('r1', 'Ed Stone', 'DEF', a(55, 30, 50, 62, 45, 65, 10)),
    p('r2', 'Bo Hedges', 'DEF', a(52, 28, 48, 60, 42, 68, 10)),
    p('r3', 'Max Tanko', 'DEF', a(50, 25, 45, 64, 40, 70, 10)),
    p('r4', 'Ty Brooks', 'DEF', a(58, 32, 52, 58, 48, 64, 10)),
    p('r5', 'Gio Marsh', 'MID', a(60, 45, 62, 50, 58, 66, 10)),
    p('r6', 'Ken Ash', 'MID', a(56, 42, 65, 48, 60, 62, 10)),
    p('r7', 'Leo Quick', 'MID', a(62, 44, 58, 45, 56, 68, 10)),
    p('r8', 'Ravi Chan', 'MID', a(58, 40, 60, 52, 54, 64, 10)),
    p('r9', 'Dario Flint', 'FWD', a(66, 62, 48, 25, 60, 60, 10), 'FIRE_TORCH'),
    p('r10', 'Zip Vela', 'FWD', a(72, 58, 45, 22, 62, 58, 10), 'SUPER_SPEED'),
  ],
};

export const UNITED: TeamDef = {
  id: 'united', name: 'Ferrous United',
  players: [
    p('u0', 'Vic Palm', 'GK', a(42, 22, 46, 42, 36, 62, 64)),
    p('u1', 'Ali Frost', 'DEF', a(56, 30, 50, 63, 46, 66, 10)),
    p('u2', 'Jon Crag', 'DEF', a(53, 28, 48, 61, 43, 67, 10)),
    p('u3', 'Rex Bould', 'DEF', a(51, 26, 46, 65, 41, 69, 10), 'SUPER_STRENGTH'),
    p('u4', 'Nik Vale', 'DEF', a(57, 31, 51, 59, 47, 65, 10)),
    p('u5', 'Oz Reeds', 'MID', a(59, 44, 61, 51, 57, 65, 10)),
    p('u6', 'Cal Dunn', 'MID', a(57, 43, 64, 49, 59, 63, 10)),
    p('u7', 'Ian Slate', 'MID', a(61, 45, 57, 46, 55, 67, 10)),
    p('u8', 'Uri Kemp', 'MID', a(57, 41, 59, 53, 53, 63, 10)),
    p('u9', 'Abe Torro', 'FWD', a(65, 61, 47, 26, 59, 61, 10)),
    p('u10', 'Moe Lyle', 'FWD', a(70, 57, 44, 23, 61, 59, 10)),
  ],
};
```

- [ ] **Step 5: Verify and commit**

Run: `npm test -- teams` → 4 passed. Run: `npx tsc --noEmit` → clean.

```bash
git add src/sim/types.ts src/sim/teams.ts src/sim/__tests__/teams.test.ts
git commit -m "feat(sim): match types, replay envelope, and 2-hero vs 1-rival-hero demo teams"
```

---

### Task 6: Formation anchors (`formation.ts`)

**Files:**
- Create: `src/sim/formation.ts`
- Test: `src/sim/__tests__/formation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { anchorFor } from '../formation';
import { PITCH_W, PITCH_H } from '../geometry';

describe('formation 4-4-2', () => {
  it('team 0 GK anchors near its own goal (high y — team 0 attacks toward y=0)', () => {
    const gk = anchorFor(0, 0, { x: PITCH_W / 2, y: PITCH_H / 2 });
    expect(gk.y).toBeGreaterThan(PITCH_H * 0.85);
  });

  it('team 1 mirrors team 0', () => {
    const ball = { x: PITCH_W / 2, y: PITCH_H / 2 };
    const t0 = anchorFor(0, 5, ball);
    const t1 = anchorFor(1, 5, ball);
    expect(t1.y).toBe(PITCH_H - t0.y);
    expect(t1.x).toBe(t0.x);
  });

  it('anchors shift toward the ball', () => {
    const left = anchorFor(0, 5, { x: 0, y: PITCH_H / 2 });
    const right = anchorFor(0, 5, { x: PITCH_W, y: PITCH_H / 2 });
    expect(left.x).toBeLessThan(right.x);
  });

  it('all 11 slots are in-bounds integers', () => {
    for (let slot = 0; slot < 11; slot++) {
      const a = anchorFor(0, slot, { x: 100, y: 100 });
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(PITCH_W);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThanOrEqual(PITCH_H);
      expect(Number.isInteger(a.x) && Number.isInteger(a.y)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- formation` → FAIL.

- [ ] **Step 3: Implement**

```ts
import { PITCH_W, PITCH_H, clamp, type Vec } from './geometry';

const ANCHORS_442: ReadonlyArray<readonly [number, number]> = [
  [0.50, 0.94],
  [0.15, 0.78], [0.38, 0.80], [0.62, 0.80], [0.85, 0.78],
  [0.15, 0.55], [0.38, 0.58], [0.62, 0.58], [0.85, 0.55],
  [0.38, 0.30], [0.62, 0.30],
];

const BALL_PULL_X = 0.15;
const BALL_PULL_Y = 0.10;

export function anchorFor(team: 0 | 1, slot: number, ballPos: Vec): Vec {
  const [fx, fy] = ANCHORS_442[slot];
  const baseX = fx * PITCH_W;
  const baseY = (team === 0 ? fy : 1 - fy) * PITCH_H;
  const x = clamp(Math.round(baseX + (ballPos.x - baseX) * BALL_PULL_X), 0, PITCH_W);
  const y = clamp(Math.round(baseY + (ballPos.y - baseY) * BALL_PULL_Y), 0, PITCH_H);
  return { x, y };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- formation` → 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/sim/formation.ts src/sim/__tests__/formation.test.ts
git commit -m "feat(sim): 4-4-2 anchors with mirroring and ball pull"
```

---

> **Task 7.5 note:** the code blocks below predate the post-audit hardening commit `31394e0` (replay envelope fields, stoppage-time boundaries, restart invariants, deep-copied teams, DAG guard) and later amendments. The as-built files are canon; these blocks are historical. See commits `31394e0`, `f1b8603`, and the amendment sections below.

### Task 7: Events sink, match skeleton, movement (`events.ts`, `match.ts`, `engine.ts` v1)

**Files:**
- Create: `src/sim/events.ts`, `src/sim/engine.ts`, `src/sim/match.ts`
- Test: `src/sim/__tests__/match.test.ts`

`events.ts` exists solely to break import cycles: everything may import it; it imports only types.

- [ ] **Step 1: Write the failing test**

```ts
import { createMatch, tick, runMatch } from '../match';
import { ROVERS, UNITED } from '../teams';
import { HALF_TICKS } from '../geometry';

describe('match skeleton', () => {
  it('creates 22 players with correct fire policies', () => {
    const m = createMatch(42, ROVERS, UNITED);
    expect(m.players).toHaveLength(22);
    expect(m.players[10].firePolicy).toBe('SAVE_FOR_TAP');   // your hero
    expect(m.players[14].firePolicy).toBe('FIRE_WHEN_READY'); // rival hero
    expect(m.ball.kind).toBe('held');
    expect(m.events[0]).toMatchObject({ kind: 'KICKOFF', half: 1 });
  });

  it('runs to FULL_TIME with HALF_TIME exactly at HALF_TICKS', () => {
    const r = runMatch(42, ROVERS, UNITED);
    const kinds = r.events.map(e => e.kind);
    expect(kinds.filter(k => k === 'KICKOFF').length).toBeGreaterThanOrEqual(2);
    expect(kinds[kinds.length - 1]).toBe('FULL_TIME');
    expect(r.events.find(e => e.kind === 'HALF_TIME')?.t).toBe(HALF_TICKS);
  });

  it('is deterministic: same seed → identical stream and score', () => {
    const a = runMatch(7, ROVERS, UNITED);
    const b = runMatch(7, ROVERS, UNITED);
    expect(a.events).toEqual(b.events);
    expect(a.score).toEqual(b.score);
  });

  it('players move each tick', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const before = m.players.map(p => ({ ...p.pos }));
    for (let i = 0; i < 50; i++) tick(m);
    const moved = m.players.filter((p, i) => p.pos.x !== before[i].x || p.pos.y !== before[i].y);
    expect(moved.length).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- match` → FAIL: cannot find module.

- [ ] **Step 3: Implement**

`src/sim/events.ts`:

```ts
import type { MatchEvent, MatchState } from './types';

export function emit(state: MatchState, e: MatchEvent): void {
  state.events.push(e);
}
```

`src/sim/engine.ts` (v1 — later tasks extend this file; stubs are named forward-references replaced by the listed task):

```ts
import { anchorFor } from './formation';
import { dist2, moveToward, PITCH_W, PITCH_H, type Vec } from './geometry';
import { emit } from './events';
import type { MatchState, SimPlayer } from './types';

export function goalYFor(team: 0 | 1): number {
  return team === 0 ? 0 : PITCH_H;
}

/** Authoritative speed: reads power state internally (Task 12 supplies the multiplier). */
export function speedFor(state: MatchState, idx: number): number {
  const p = state.players[idx];
  const conditionScale = 0.75 + 0.25 * (p.condition / 100);
  return Math.round((40 + p.def.attrs.pac) * conditionScale * speedMultiplier(state, idx));
}

/** Task 12 replaces via powers.ts re-import; v1 constant keeps the engine testable now. */
export function speedMultiplier(_state: MatchState, _idx: number): number {
  return 1;
}

export function ballPos(state: MatchState): Vec {
  const b = state.ball;
  return b.kind === 'held' ? state.players[b.by].pos : b.pos;
}

export function drainStamina(p: SimPlayer, movedFar: boolean): void {
  p.condition = Math.max(0, p.condition - (movedFar ? 0.02 : 0.005));
}

export function restartKickoff(state: MatchState, toTeam: 0 | 1): void {
  const center = { x: PITCH_W / 2, y: PITCH_H / 2 };
  for (let i = 0; i < 22; i++) {
    const p = state.players[i];
    p.pos = anchorFor(p.team, i % 11, center);
  }
  const striker = toTeam === 0 ? 9 : 20;
  state.players[striker].pos = { ...center };
  state.ball = { kind: 'held', by: striker };
}

export function movementTick(state: MatchState): void {
  const ball = ballPos(state);
  for (let i = 0; i < 22; i++) {
    const p = state.players[i];
    if (p.outUntilTick > state.tick) continue;
    if (p.outUntilTick !== 0) {
      if (p.outUntilTick !== Number.MAX_SAFE_INTEGER) {
        emit(state, { t: state.tick, kind: p.outReason === 'ignited' ? 'EXTINGUISHED' : 'RECOVERED', player: i });
      }
      p.outUntilTick = 0;
      p.outReason = undefined;
    }
    const isCarrier = state.ball.kind === 'held' && state.ball.by === i;
    const isPassReceiver = state.ball.kind === 'pass' && state.ball.to === i;
    const chaseLoose = state.ball.kind === 'loose' && dist2(p.pos, ball) < 1500 * 1500;
    const target: Vec = isCarrier
      ? { x: ball.x, y: goalYFor(p.team) === 0 ? Math.max(0, p.pos.y - 800) : Math.min(PITCH_H, p.pos.y + 800) }
      : isPassReceiver || chaseLoose ? ball
      : anchorFor(p.team, i % 11, ball);
    const before = p.pos;
    p.pos = moveToward(p.pos, target, speedFor(state, i));
    drainStamina(p, dist2(before, p.pos) > 6400);
  }
}
```

`src/sim/match.ts`:

```ts
import { mulberry32 } from './rng';
import { HALF_TICKS } from './geometry';
import { emit } from './events';
import { movementTick, restartKickoff } from './engine';
import type { MatchInput, MatchOpts, MatchResult, MatchState, ReplayEnvelope, SimPlayer, TeamDef } from './types';

export const ENGINE_VERSION = 'm0.2';
const TOTAL_TICKS = HALF_TICKS * 2;

function makePlayers(home: TeamDef, away: TeamDef, opts: MatchOpts): SimPlayer[] {
  const mk = (team: 0 | 1, defs: TeamDef): SimPlayer[] =>
    defs.players.map(def => ({
      def, team,
      pos: { x: 0, y: 0 }, // set by restartKickoff below
      condition: 100, gauge: 0,
      powerState: { kind: 'idle' as const },
      firePolicy: team === 0 ? (opts.homePolicy ?? 'SAVE_FOR_TAP') : (opts.awayPolicy ?? 'FIRE_WHEN_READY'),
      outUntilTick: 0, tackleCooldownUntil: 0, cards: 0 as const,
    }));
  return [...mk(0, home), ...mk(1, away)];
}

export function createMatch(seed: number, home: TeamDef, away: TeamDef, opts: MatchOpts = {}): MatchState {
  const state: MatchState = {
    tick: 0, half: 1, phase: 'play', score: [0, 0],
    players: makePlayers(home, away, opts),
    ball: { kind: 'held', by: 9 },
    resolve: [100, 100],
    rng: mulberry32(seed),
    events: [], pendingInputs: [],
    blindAutoHome: opts.blindAutoHome ?? false,
  };
  restartKickoff(state, 0);
  emit(state, { t: 0, kind: 'KICKOFF', half: 1 });
  return state;
}

export function queueInput(state: MatchState, input: MatchInput): void {
  state.pendingInputs.push(input);
}

export function tick(state: MatchState): void {
  if (state.phase === 'fulltime') return;
  state.tick++;

  movementTick(state);

  if (state.half === 1 && state.tick === HALF_TICKS) {
    state.half = 2;
    emit(state, { t: state.tick, kind: 'HALF_TIME' });
    state.resolve = [Math.min(100, state.resolve[0] + 30), Math.min(100, state.resolve[1] + 30)];
    for (const p of state.players) p.condition = Math.min(100, p.condition + 15);
    restartKickoff(state, 1);
    emit(state, { t: state.tick, kind: 'KICKOFF', half: 2 });
  } else if (state.tick >= TOTAL_TICKS) {
    state.phase = 'fulltime';
    emit(state, { t: state.tick, kind: 'FULL_TIME' });
  }
}

export function runMatch(seed: number, home: TeamDef, away: TeamDef, inputs: MatchInput[] = [], opts: MatchOpts = {}): MatchResult {
  const state = createMatch(seed, home, away, opts);
  for (const i of inputs) queueInput(state, i);
  while (state.phase !== 'fulltime') tick(state);
  return { score: state.score, events: state.events };
}

export function runReplay(env: ReplayEnvelope): MatchResult {
  if (env.engineVersion !== ENGINE_VERSION) {
    throw new Error(`replay engine mismatch: ${env.engineVersion} vs ${ENGINE_VERSION}`);
  }
  return runMatch(env.seed, env.home, env.away, env.inputs);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- match` → 4 passed. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/sim/events.ts src/sim/engine.ts src/sim/match.ts src/sim/__tests__/match.test.ts
git commit -m "feat(sim): match skeleton with events sink, fire policies, replay entrypoint, anchor movement"
```

---

### Task 8: Possession with in-flight passes (`engine.ts` v2)

**Files:**
- Modify: `src/sim/engine.ts`
- Modify: `src/sim/match.ts` (call `possessionTick` after `movementTick`)
- Test: `src/sim/__tests__/engine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { createMatch, runMatch, tick } from '../match';
import { ROVERS, UNITED } from '../teams';

describe('possession', () => {
  it('passes happen and both teams touch the ball', () => {
    const r = runMatch(42, ROVERS, UNITED);
    const passes = r.events.filter(e => e.kind === 'PASS');
    expect(passes.length).toBeGreaterThan(10);
    const passers = new Set(passes.map(e => (e as { from: number }).from));
    expect([...passers].some(i => i < 11)).toBe(true);
    expect([...passers].some(i => i >= 11)).toBe(true);
  });

  it('some passes fail (interceptions exist)', () => {
    const r = runMatch(42, ROVERS, UNITED);
    expect(r.events.some(e => e.kind === 'PASS' && !(e as { ok: boolean }).ok)).toBe(true);
  });

  it('passes TRAVEL — the ball is observably in a pass state between launch and arrival', () => {
    const m = createMatch(42, ROVERS, UNITED);
    let sawFlight = false;
    for (let i = 0; i < 600 && !sawFlight; i++) {
      tick(m);
      if (m.ball.kind === 'pass') sawFlight = true;
    }
    expect(sawFlight).toBe(true);
  });

  it('remains deterministic', () => {
    expect(runMatch(9, ROVERS, UNITED).events).toEqual(runMatch(9, ROVERS, UNITED).events);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- engine` → FAIL: no PASS events.

- [ ] **Step 3: Implement in `engine.ts`**

Add (imports at top of file: `contest` from `./contest`, `dist`, `GOAL_CENTER_X` from `./geometry`; `addGauge` from `./powers` arrives in Task 11 — until then declare the local stub shown):

```ts
export const PASS_SPEED = 250;

/** Task 11 replaces with the real gauge (import from ./powers). */
export function addGauge(_state: MatchState, _idx: number, _amount: number): void {}

export function nearestOpponent(state: MatchState, idx: number): number {
  const me = state.players[idx];
  let best = -1, bestD2 = Infinity;
  for (let i = 0; i < 22; i++) {
    const o = state.players[i];
    if (o.team === me.team || !isAvailable(state, i)) continue;
    const d2 = dist2(o.pos, me.pos);
    if (d2 < bestD2) { bestD2 = d2; best = i; }
  }
  return best;
}

function bestPassTarget(state: MatchState, from: number): number {
  const me = state.players[from];
  const gy = goalYFor(me.team);
  let best = -1, bestScore = -Infinity;
  for (let i = 0; i < 22; i++) {
    const mate = state.players[i];
    if (i === from || mate.team !== me.team || !isAvailable(state, i)) continue;
    const d2 = dist2(mate.pos, me.pos);
    if (d2 < 400 * 400 || d2 > 3500 * 3500) continue;
    const forwardness = Math.abs(mate.pos.y - gy);
    const marker = nearestOpponent(state, i);
    const space = marker === -1 ? 1000 : dist(state.players[marker].pos, mate.pos);
    const score = -forwardness + space * 2;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

export function possessionTick(state: MatchState): void {
  const b = state.ball;

  if (b.kind === 'loose') {
    b.pos = { x: b.pos.x + b.vel.x, y: b.pos.y + b.vel.y };
    b.vel = { x: Math.trunc(b.vel.x * 0.8), y: Math.trunc(b.vel.y * 0.8) };
    for (let i = 0; i < 22; i++) {
      if (!isAvailable(state, i)) continue;
      const p = state.players[i];
      if (dist2(p.pos, b.pos) < 150 * 150) {
        state.ball = { kind: 'held', by: i };
        addGauge(state, i, 8);
        return;
      }
    }
    return;
  }

  if (b.kind === 'pass') {
    const targetIdx = b.willSucceed ? b.to : (b.interceptor !== -1 ? b.interceptor : b.to);
    const target = state.players[targetIdx].pos;
    b.pos = moveToward(b.pos, target, PASS_SPEED);
    if (dist2(b.pos, target) < 150 * 150) {
      if (b.willSucceed || b.interceptor !== -1) {
        state.ball = { kind: 'held', by: targetIdx };
        addGauge(state, targetIdx, 8);
      } else {
        state.ball = { kind: 'loose', pos: { ...b.pos }, vel: { x: 0, y: 0 } };
      }
    }
    return;
  }

  if (b.kind !== 'held') return; // 'shot' handled in Task 10
  if (state.players[b.by].outUntilTick > state.tick) return; // unconscious carriers don't play (Task 7 review)
  if (state.tick % 5 !== 0) return;

  const carrierIdx = b.by;
  const carrier = state.players[carrierIdx];
  const gy = goalYFor(carrier.team);
  const goal = { x: GOAL_CENTER_X, y: gy };
  const toGoal = dist(carrier.pos, goal);
  const marker = nearestOpponent(state, carrierIdx);
  const pressured = marker !== -1 && dist2(state.players[marker].pos, carrier.pos) < 400 * 400;

  if (toGoal < 2500 && carrier.def.role !== 'GK') {
    attemptShot(state, carrierIdx, toGoal); // real implementation in Task 10
    return;
  }

  if (pressured || state.rng() < 0.35) {
    const to = bestPassTarget(state, carrierIdx);
    if (to !== -1) {
      const interceptorIdx = nearestOpponent(state, to);
      const interceptStat = interceptorIdx === -1 ? 20 : effectiveStat(state, interceptorIdx, 'def');
      const ok = contest(state.rng, effectiveStat(state, carrierIdx, 'pas'), interceptStat, 10);
      emit(state, { t: state.tick, kind: 'PASS', from: carrierIdx, to, ok });
      state.ball = { kind: 'pass', pos: { ...carrier.pos }, from: carrierIdx, to, willSucceed: ok, interceptor: interceptorIdx };
    }
  }
}

/** Task 10 replaces with real shooting. */
export function attemptShot(_state: MatchState, _by: number, _distToGoal: number): void {}
```

In `match.ts` `tick()`, after `movementTick(state);` add `possessionTick(state);` (extend the engine import).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- engine && npm test -- match` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/sim/engine.ts src/sim/match.ts src/sim/__tests__/engine.test.ts
git commit -m "feat(sim): possession with in-flight interceptable passes and loose balls"
```

---

### Task 9: Tackling & knockouts (`engine.ts` v3)

**Files:**
- Modify: `src/sim/engine.ts`, `src/sim/match.ts`
- Test: append to `src/sim/__tests__/engine.test.ts`

- [ ] **Step 1: Write the failing test (append)**

```ts
describe('tackling', () => {
  it('tackles occur, some won and some lost', () => {
    const r = runMatch(42, ROVERS, UNITED);
    const tackles = r.events.filter(e => e.kind === 'TACKLE') as Array<{ won: boolean }>;
    expect(tackles.length).toBeGreaterThan(5);
    expect(tackles.some(t => t.won)).toBe(true);
    expect(tackles.some(t => !t.won)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- engine` → FAIL: tackles.length = 0.

- [ ] **Step 3: Implement in `engine.ts`**

First, pressing (Task 9 amendment — docs/03 specifies defenders "mark, press"; without it, zonal anchors never bring defenders inside tackle range and tackling is unreachable). In `movementTick`, insert before the player loop:

```ts
  const presserIdx = state.ball.kind === 'held' ? nearestOpponent(state, state.ball.by) : -1;
```

and extend the target selection so the presser closes down the carrier (merge into the existing ternary — the presser's target is the ball):

```ts
    const target: Vec = isCarrier
      ? { x: ball.x, y: goalYFor(p.team) === 0 ? Math.max(0, p.pos.y - 800) : Math.min(PITCH_H, p.pos.y + 800) }
      : i === presserIdx || isPassReceiver || chaseLoose ? ball
      : anchorFor(p.team, i % 11, ball);
```

(`nearestOpponent` is a hoisted function declaration defined later in the file — legal.) Then add the tackle machinery:

```ts
/** Task 11/12 replace these with imports from ./powers. */
export function interruptWindup(_state: MatchState, _idx: number): void {}
export function fireSuppressed(_state: MatchState, _tackler: number, _carrier: number): boolean { return false; }
export function dribbleBonus(_state: MatchState, _carrier: number): number { return 0; }
export function defenseBonus(_state: MatchState, _idx: number): number { return 0; }

export function tackleTick(state: MatchState): void {
  if (state.ball.kind !== 'held') return;
  const carrierIdx = state.ball.by;
  const carrier = state.players[carrierIdx];

  let tackler = -1, tacklerD2 = 250 * 250 + 1;
  for (let i = 0; i < 22; i++) {
    const d = state.players[i];
    if (d.team === carrier.team || !isAvailable(state, i)) continue;
    if (state.tick < d.tackleCooldownUntil) continue;
    if (fireSuppressed(state, i, carrierIdx)) continue;
    const d2 = dist2(d.pos, carrier.pos);
    if (d2 <= 250 * 250 && d2 < tacklerD2) { tacklerD2 = d2; tackler = i; }
  }
  if (tackler === -1) return;

  const d = state.players[tackler];
  d.tackleCooldownUntil = state.tick + 10;
  const won = contest(state.rng, effectiveStat(state, tackler, 'def') + defenseBonus(state, tackler), effectiveStat(state, carrierIdx, 'tec'), -dribbleBonus(state, carrierIdx));
  emit(state, { t: state.tick, kind: 'TACKLE', by: tackler, on: carrierIdx, won });
  if (won) {
    state.ball = { kind: 'held', by: tackler };
    addGauge(state, tackler, 15);
    interruptWindup(state, carrierIdx);
  }
}
```

(Amended after the Task 9 review: the tackler is the NEAREST eligible defender, not the first by index — the index-order tie-break made the GK the busiest tackler on the pitch and starved wide slots entirely.)

```ts
```

In `match.ts` `tick()`, after `possessionTick(state);` add `tackleTick(state);`.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- engine` → all pass, determinism intact.

- [ ] **Step 5: Commit**

```bash
git add src/sim/engine.ts src/sim/match.ts src/sim/__tests__/engine.test.ts
git commit -m "feat(sim): tackling with cooldowns, turnovers, and power hook points"
```

---

### Task 10: Shooting, saves, GK Resolve, goals (`engine.ts` v4)

**Files:**
- Modify: `src/sim/engine.ts`, `src/sim/match.ts`
- Test: `src/sim/__tests__/shooting.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { runMatch } from '../match';
import { ROVERS, UNITED } from '../teams';

describe('shooting and goals', () => {
  it('across 30 seeds, goals happen and scores are sane', () => {
    let totalGoals = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const r = runMatch(seed, ROVERS, UNITED);
      const goals = r.events.filter(e => e.kind === 'GOAL').length;
      expect(goals).toBe(r.score[0] + r.score[1]);
      expect(goals).toBeLessThanOrEqual(15);
      totalGoals += goals;
    }
    expect(totalGoals).toBeGreaterThan(15);
    expect(totalGoals).toBeLessThan(240);
  });

  it('saves deplete GK Resolve', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const save = runMatch(seed, ROVERS, UNITED).events.find(e => e.kind === 'SAVE') as { resolveLeft: number } | undefined;
      if (save) {
        expect(save.resolveLeft).toBeLessThan(100);
        return;
      }
    }
    throw new Error('no SAVE event in 30 matches — shooting is broken');
  });

  it('a much weaker GK concedes more (500-match aggregate)', () => {
    const weakGk = structuredClone(UNITED);
    weakGk.players[0].attrs.ref = 20;
    let vsNormal = 0, vsWeak = 0;
    for (let seed = 1; seed <= 500; seed++) {
      vsNormal += runMatch(seed, ROVERS, UNITED).score[0];
      vsWeak += runMatch(seed, ROVERS, weakGk).score[0];
    }
    expect(vsWeak).toBeGreaterThan(vsNormal);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- shooting` → FAIL: zero goals (stub).

- [ ] **Step 3: Implement in `engine.ts`**

Replace the `attemptShot` stub; add `shotBonus` hook and `shotFlightTick`:

```ts
/** Hook for future shot-boosting powers (none among the M0 three). */
export function shotBonus(_state: MatchState, _by: number): number { return 0; }

export function attemptShot(state: MatchState, by: number, distToGoal: number): void {
  const shooter = state.players[by];
  const gy = goalYFor(shooter.team);
  const spread = 200 + (99 - effectiveStat(state, by, 'sho')) * 10;
  const targetX = Math.round(GOAL_CENTER_X + (state.rng() * 2 - 1) * spread);
  const power = Math.max(1, Math.round(effectiveStat(state, by, 'sho') + shotBonus(state, by) - distToGoal / 100));
  emit(state, { t: state.tick, kind: 'SHOT', by, power });
  addGauge(state, by, 20);
  const dir = gy === 0 ? -1 : 1;
  state.ball = {
    kind: 'shot',
    pos: { ...shooter.pos },
    vel: { x: Math.trunc((targetX - shooter.pos.x) / Math.max(1, distToGoal / 300)), y: 300 * dir },
    by, power, targetX,
  };
}

export function shotFlightTick(state: MatchState): void {
  const b = state.ball;
  if (b.kind !== 'shot') return;
  b.pos = { x: b.pos.x + b.vel.x, y: b.pos.y + b.vel.y };
  const shooter = state.players[b.by];
  const gy = goalYFor(shooter.team);
  const crossed = gy === 0 ? b.pos.y <= 0 : b.pos.y >= PITCH_H;
  if (!crossed) return;

  const defendingTeam: 0 | 1 = shooter.team === 0 ? 1 : 0;
  const gkIdx = defendingTeam === 0 ? 0 : 11;
  const onTarget = Math.abs(b.targetX - GOAL_CENTER_X) <= GOAL_W / 2;

  if (!onTarget) {
    emit(state, { t: state.tick, kind: 'MISS', by: b.by });
    restartKickoff(state, defendingTeam);
    return;
  }

  if (!isAvailable(state, gkIdx)) {
    state.score[shooter.team]++;
    emit(state, { t: state.tick, kind: 'GOAL', by: b.by, team: shooter.team });
    restartKickoff(state, defendingTeam);
    return; // an ignited/KO'd keeper cannot save (Task 7.5 audit) — open goal
  }

  const resolveScale = 0.5 + 0.5 * (state.resolve[defendingTeam] / 100);
  const saved = contest(state.rng, effectiveStat(state, gkIdx, 'ref') * resolveScale, b.power);

  if (saved) {
    state.resolve[defendingTeam] = Math.max(0, state.resolve[defendingTeam] - Math.round(b.power / 4));
    emit(state, { t: state.tick, kind: 'SAVE', by: gkIdx, resolveLeft: state.resolve[defendingTeam] });
    addGauge(state, gkIdx, 12);
    state.ball = { kind: 'held', by: gkIdx };
  } else {
    state.score[shooter.team]++;
    emit(state, { t: state.tick, kind: 'GOAL', by: b.by, team: shooter.team });
    restartKickoff(state, defendingTeam);
  }
}
```

(`GOAL_W` joins the geometry import.) In `match.ts` `tick()` the order becomes:

```ts
  movementTick(state);
  possessionTick(state);
  tackleTick(state);
  shotFlightTick(state);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test` → ALL suites pass. The 500-match aggregate should finish well under 30s — if not, treat as a perf smell and investigate before proceeding.

- [ ] **Step 5: Commit**

```bash
git add src/sim/engine.ts src/sim/match.ts src/sim/__tests__/shooting.test.ts
git commit -m "feat(sim): ball-flight shooting, GK saves with Resolve attrition, goals and restarts"
```

---

### Task 11: Hero Gauge, fire policies, contexts, windup (`powers.ts` v1)

**Files:**
- Create: `src/sim/powers.ts`
- Modify: `src/sim/engine.ts` (stubs → real imports), `src/sim/match.ts` (call `powerTick` first)
- Test: `src/sim/__tests__/powers.test.ts`

Numbers (docs/03–04): gauge touch +8 / tackle won +15 / shot +20 / save +12 / trickle 0.02 per tick. SAVE_FOR_TAP: READY window 80 ticks → after lapse fire at first useful context at 0.75 (hard deadline 120 ticks since ready). FIRE_WHEN_READY: fire at first useful context at 0.85. Tap: 1.0. Windup 15 ticks, interruptible (gauge → 50).

- [ ] **Step 1: Write the failing test**

```ts
import { createMatch, queueInput, runMatch, tick } from '../match';
import { ROVERS, UNITED } from '../teams';
import type { MatchState } from '../types';

const SPEEDSTER = 10; // Zip Vela (SAVE_FOR_TAP by default)
const RIVAL = 14;     // Rex Bould, United SUPER_STRENGTH (FIRE_WHEN_READY by default)

function tickUntil(m: MatchState, pred: () => boolean, max = 500): void {
  for (let i = 0; i < max && !pred(); i++) tick(m);
}

describe('hero gauge and firing', () => {
  it('non-heroes never gain gauge; heroes trickle up', () => {
    const m = createMatch(42, ROVERS, UNITED);
    for (let i = 0; i < 200; i++) tick(m);
    expect(m.players[1].gauge).toBe(0);
    expect(m.players[SPEEDSTER].gauge).toBeGreaterThan(0);
  });

  it('gauge 100 emits POWER_READY', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[SPEEDSTER].gauge = 99.9;
    tickUntil(m, () => m.events.some(e => e.kind === 'POWER_READY' && (e as { player: number }).player === SPEEDSTER), 100);
    expect(m.events.some(e => e.kind === 'POWER_READY')).toBe(true);
  });

  it('a tap fires at strength 1.0 after the windup', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[SPEEDSTER].gauge = 99.9;
    tickUntil(m, () => m.players[SPEEDSTER].powerState.kind === 'ready', 100);
    queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: SPEEDSTER });
    tickUntil(m, () => m.events.some(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === SPEEDSTER));
    const fired = m.events.find(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === SPEEDSTER) as { strength: number; power: string };
    expect(fired.power).toBe('SUPER_SPEED');
    expect(fired.strength).toBe(1);
  });

  it('an ignored SAVE_FOR_TAP window auto-fires at 0.75', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[SPEEDSTER].gauge = 99.9;
    tickUntil(m, () => m.events.some(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === SPEEDSTER), 400);
    const fired = m.events.find(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === SPEEDSTER) as { strength: number };
    expect(fired.strength).toBe(0.75);
  });

  it('the rival hero fires on its own at 0.85 (FIRE_WHEN_READY, contextual)', () => {
    const r = runMatch(42, ROVERS, UNITED);
    const rivalFired = r.events.filter(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === RIVAL) as Array<{ strength: number }>;
    expect(rivalFired.length).toBeGreaterThan(0);
    expect(rivalFired.every(f => f.strength === 0.85)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- powers` → FAIL: gauge stays 0.

- [ ] **Step 3: Implement `src/sim/powers.ts` (v1: lifecycle; effects arrive in Task 12)**

```ts
import { emit } from './events';
import { dist2 } from './geometry';
import type { MatchState } from './types';

export const READY_WINDOW_TICKS = 80;
export const HARD_DEADLINE_TICKS = 120;
export const WINDUP_TICKS = 15;
export const TAP_STRENGTH = 1.0;
export const CONTEXT_AUTO_STRENGTH = 0.85;
export const LAPSE_STRENGTH = 0.75;
export const GAUGE_TRICKLE = 0.02;

export function addGauge(state: MatchState, idx: number, amount: number): void {
  const p = state.players[idx];
  if (!p.def.power || p.powerState.kind !== 'idle') return;
  p.gauge = Math.min(100, p.gauge + amount);
  if (p.gauge >= 100) {
    p.powerState = { kind: 'ready', sinceTick: state.tick };
    emit(state, { t: state.tick, kind: 'POWER_READY', player: idx });
  }
}

export function interruptWindup(state: MatchState, idx: number): void {
  const p = state.players[idx];
  if (p.powerState.kind !== 'winding') return;
  p.powerState = { kind: 'idle' };
  p.gauge = 50;
  emit(state, { t: state.tick, kind: 'POWER_INTERRUPTED', player: idx });
}

/** The "when should I fire?" answer, per power. Shown to players via chip glow. */
export function inUsefulContext(state: MatchState, idx: number): boolean {
  const p = state.players[idx];
  const power = p.def.power;
  if (!power) return false;
  const b = state.ball;
  const oppCarrierNear = (range: number) =>
    b.kind === 'held' && state.players[b.by].team !== p.team && dist2(state.players[b.by].pos, p.pos) < range * range;

  if (power === 'SUPER_STRENGTH') return oppCarrierNear(900);
  if (power === 'SUPER_SPEED') {
    return (b.kind === 'held' && b.by === idx) || (b.kind === 'loose' && dist2(b.pos, p.pos) < 1500 * 1500);
  }
  return (b.kind === 'held' && b.by === idx) || oppCarrierNear(800); // FIRE_TORCH
}

function startWindup(state: MatchState, idx: number, strength: number): void {
  state.players[idx].powerState = { kind: 'winding', untilTick: state.tick + WINDUP_TICKS, strength };
}

export function powerTick(state: MatchState): void {
  const due = state.pendingInputs.filter(i => i.tick <= state.tick);
  state.pendingInputs = state.pendingInputs.filter(i => i.tick > state.tick);
  for (const input of due) {
    const p = state.players[input.player];
    if (input.kind === 'POWER_TAP' && p.powerState.kind === 'ready') {
      startWindup(state, input.player, TAP_STRENGTH);
    }
  }

  for (let idx = 0; idx < 22; idx++) {
    const p = state.players[idx];
    if (!p.def.power) continue;
    if (p.outUntilTick > state.tick) {
      if (p.powerState.kind === 'winding') interruptWindup(state, idx);
      continue; // out players neither charge nor fire (Task 7 review)
    }

    if (p.powerState.kind === 'idle') {
      if (p.outUntilTick <= state.tick) addGauge(state, idx, GAUGE_TRICKLE);
    } else if (p.powerState.kind === 'ready') {
      const waited = state.tick - p.powerState.sinceTick;
      const blind = p.team === 0 && state.blindAutoHome;
      if (p.firePolicy === 'FIRE_WHEN_READY') {
        if (blind || inUsefulContext(state, idx)) startWindup(state, idx, CONTEXT_AUTO_STRENGTH);
        else if (waited >= HARD_DEADLINE_TICKS) startWindup(state, idx, LAPSE_STRENGTH); // starvation fix (Task 11 review)
      } else if (waited >= HARD_DEADLINE_TICKS) {
        startWindup(state, idx, LAPSE_STRENGTH);
      } else if (waited >= READY_WINDOW_TICKS && inUsefulContext(state, idx)) {
        startWindup(state, idx, LAPSE_STRENGTH);
      }
    } else if (p.powerState.kind === 'winding') {
      if (state.tick >= p.powerState.untilTick) activatePower(state, idx, p.powerState.strength);
    } else if (p.powerState.kind === 'active') {
      if (state.tick >= p.powerState.untilTick) {
        p.powerState = { kind: 'idle' };
        p.gauge = 0;
      }
    }
  }
}

/** Task 12 replaces with real per-power effects. v1: 1-tick active flash. */
export function activatePower(state: MatchState, idx: number, strength: number): void {
  const p = state.players[idx];
  emit(state, { t: state.tick, kind: 'POWER_FIRED', player: idx, power: p.def.power!, strength });
  p.powerState = { kind: 'active', untilTick: state.tick + 1, strength };
  p.gauge = 0;
}
```

In `engine.ts`: delete the `addGauge` and `interruptWindup` stubs and add local imports (NOT bare re-exports — a re-export creates no local binding):

```ts
import { addGauge, interruptWindup } from './powers';
export { addGauge, interruptWindup };
```

In `match.ts` `tick()`: `powerTick(state);` becomes the FIRST call (inputs apply before physics), importing from `./powers`.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test` → all suites pass. Import graph check: powers imports only events/geometry/types — no cycle.

- [ ] **Step 5: Commit**

```bash
git add src/sim/powers.ts src/sim/engine.ts src/sim/match.ts src/sim/__tests__/powers.test.ts
git commit -m "feat(sim): hero gauge with fire policies, useful contexts, interruptible windups"
```

---

### Task 12: The three power effects (`powers.ts` v2)

**Files:**
- Modify: `src/sim/powers.ts`, `src/sim/engine.ts`
- Test: append to `src/sim/__tests__/powers.test.ts`

Effects at strength `s` (docs/04): SUPER_SPEED — speed ×2.2, +15 dribble, 40×s ticks. SUPER_STRENGTH — opposing carrier within 800: steal + knockout 80×s ticks, else +35 DEF for 80×s; 25% yellow / 5% red. FIRE_TORCH — 50×s ticks: suppresses tackles on the carrier, +25 dribble; nearest opponent within 800 IGNITED (out 100 ticks → EXTINGUISHED); 15% yellow.

- [ ] **Step 1: Write the failing test (append; add `speedFor` from `../engine` to imports)**

```ts
import { speedFor } from '../engine';

describe('power effects', () => {
  it('SUPER_SPEED multiplies speed while active — read through the authoritative speedFor(state, idx)', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const base = speedFor(m, SPEEDSTER);
    m.players[SPEEDSTER].powerState = { kind: 'active', untilTick: m.tick + 40, strength: 1 };
    expect(speedFor(m, SPEEDSTER)).toBe(Math.round((base / 1) * 2.2));
  });

  it('FIRE_TORCH ignites the nearest opponent, who is later extinguished', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const torch = 9;
    m.players[torch].gauge = 99.9;
    tickUntil(m, () => m.players[torch].powerState.kind === 'ready', 200);
    queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: torch });
    tickUntil(m, () => m.events.some(e => e.kind === 'IGNITED'), 300);
    const ignited = m.events.find(e => e.kind === 'IGNITED') as { player: number };
    expect(ignited.player).toBeGreaterThanOrEqual(11);
    tickUntil(m, () => m.events.some(e => e.kind === 'EXTINGUISHED'), 300);
    expect(m.events.some(e => e.kind === 'EXTINGUISHED')).toBe(true);
  });

  it('rival SUPER_STRENGTH steals the ball and knocks out the carrier', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.ball = { kind: 'held', by: SPEEDSTER };
    m.players[SPEEDSTER].pos = { ...m.players[RIVAL].pos };
    m.players[RIVAL].gauge = 99.9;
    tickUntil(m, () => m.events.some(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === RIVAL), 200);
    expect(m.players[SPEEDSTER].outUntilTick).toBeGreaterThan(m.tick - 20);
    expect(m.events.some(e => e.kind === 'TACKLE' && (e as { by: number }).by === RIVAL)).toBe(true);
  });

  it('cards appear across many seeds', () => {
    let sawCard = false;
    for (let seed = 1; seed <= 60 && !sawCard; seed++) {
      sawCard = runMatch(seed, ROVERS, UNITED).events.some(e => e.kind === 'CARD');
    }
    expect(sawCard).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- powers` → FAIL: speed unchanged / no IGNITED.

- [ ] **Step 3: Implement effects in `powers.ts`**

Replace v1 `activatePower`, add queries:

```ts
const DUR = { SUPER_SPEED: 40, SUPER_STRENGTH: 80, FIRE_TORCH: 50 } as const;

export function isActive(state: MatchState, idx: number): boolean {
  const ps = state.players[idx].powerState;
  return ps.kind === 'active' && state.tick < ps.untilTick;
}

function sendOff(state: MatchState, idx: number): void {
  state.players[idx].outUntilTick = Number.MAX_SAFE_INTEGER;
  state.players[idx].outReason = 'redcard';
  emit(state, { t: state.tick, kind: 'CARD', player: idx, color: 'red' });
}

function rollCard(state: MatchState, idx: number, yellowP: number, redP: number): void {
  const r = state.rng();
  const p = state.players[idx];
  if (r < redP) {
    p.cards = 2;
    sendOff(state, idx);
  } else if (r < redP + yellowP) {
    p.cards = Math.min(2, p.cards + 1) as 0 | 1 | 2;
    emit(state, { t: state.tick, kind: 'CARD', player: idx, color: 'yellow' });
    if (p.cards === 2) sendOff(state, idx); // second yellow = red, real soccer rules (Task 5 review ruling)
  }
}

export function activatePower(state: MatchState, idx: number, strength: number): void {
  const p = state.players[idx];
  const power = p.def.power!;
  emit(state, { t: state.tick, kind: 'POWER_FIRED', player: idx, power, strength });
  p.powerState = { kind: 'active', untilTick: state.tick + Math.round(DUR[power] * strength), strength };
  p.gauge = 0;

  if (power === 'FIRE_TORCH') {
    rollCard(state, idx, 0.15, 0);
    let nearest = -1, nearestD2 = 800 * 800;
    for (let i = 0; i < 22; i++) {
      const o = state.players[i];
      if (o.team === p.team || o.outUntilTick > state.tick) continue;
      const d2 = dist2(o.pos, p.pos);
      if (d2 < nearestD2) { nearestD2 = d2; nearest = i; }
    }
    if (nearest !== -1) {
      state.players[nearest].outUntilTick = state.tick + 100;
      state.players[nearest].outReason = 'ignited';
      emit(state, { t: state.tick, kind: 'IGNITED', player: nearest });
    }
  } else if (power === 'SUPER_STRENGTH') {
    rollCard(state, idx, 0.25, 0.05);
    if (state.ball.kind === 'held' && p.outUntilTick <= state.tick) {
      const carrierIdx = state.ball.by;
      const carrier = state.players[carrierIdx];
      if (carrier.team !== p.team && dist2(carrier.pos, p.pos) < 800 * 800) {
        carrier.outUntilTick = state.tick + Math.round(80 * strength);
        carrier.outReason = 'ko';
        state.ball = { kind: 'held', by: idx };
        emit(state, { t: state.tick, kind: 'TACKLE', by: idx, on: carrierIdx, won: true });
      }
    }
  }
}

export function speedMultiplier(state: MatchState, idx: number): number {
  return isActive(state, idx) && state.players[idx].def.power === 'SUPER_SPEED' ? 2.2 : 1;
}

export function dribbleBonus(state: MatchState, carrierIdx: number): number {
  if (!isActive(state, carrierIdx)) return 0;
  const power = state.players[carrierIdx].def.power;
  return power === 'SUPER_SPEED' ? 15 : power === 'FIRE_TORCH' ? 25 : 0;
}

export function fireSuppressed(state: MatchState, _tacklerIdx: number, carrierIdx: number): boolean {
  return isActive(state, carrierIdx) && state.players[carrierIdx].def.power === 'FIRE_TORCH';
}

export function defenseBonus(state: MatchState, idx: number): number {
  return isActive(state, idx) && state.players[idx].def.power === 'SUPER_STRENGTH' ? 35 : 0;
}
```

In `engine.ts`: delete the four stubs (`speedMultiplier`, `fireSuppressed`, `dribbleBonus`, `defenseBonus`) and extend the existing powers import (local bindings, then re-export):

```ts
import { addGauge, interruptWindup, speedMultiplier, fireSuppressed, dribbleBonus, defenseBonus } from './powers';
export { addGauge, interruptWindup, speedMultiplier, fireSuppressed, dribbleBonus, defenseBonus };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test` → all suites pass, including earlier determinism tests.

#### Task 12.1 amendment — target-locked charge for SUPER_STRENGTH (approved after the first Task 12 attempt measured a 0% steal landing rate)

Root cause: closing into context range makes the carrier "pressured," so they pass away during the 15-tick windup; re-checking proximity at completion always whiffs. Fix: lock at windup start, chase while winding, resolve against the locked target. Releasing the ball fast remains the counterplay (the flatten still lands, the steal doesn't).

`src/sim/types.ts` — the winding variant gains an optional lock:
```ts
  | { kind: 'winding'; untilTick: number; strength: number; targetIdx?: number }
```

`src/sim/powers.ts` — constants + lock at windup start + pass-through:
```ts
const STRENGTH_LOCK_RANGE = 1200;
const STRENGTH_LAND_RANGE = 400;

function startWindup(state: MatchState, idx: number, strength: number): void {
  const p = state.players[idx];
  let targetIdx: number | undefined;
  if (p.def.power === 'SUPER_STRENGTH' && state.ball.kind === 'held') {
    const carrier = state.players[state.ball.by];
    if (carrier.team !== p.team && dist2(carrier.pos, p.pos) < STRENGTH_LOCK_RANGE * STRENGTH_LOCK_RANGE) {
      targetIdx = state.ball.by;
    }
  }
  p.powerState = { kind: 'winding', untilTick: state.tick + WINDUP_TICKS, strength, targetIdx };
}
```
In `powerTick`'s winding branch, pass the lock through: `activatePower(state, idx, p.powerState.strength, p.powerState.targetIdx);`

`activatePower` gains the fourth parameter and its SUPER_STRENGTH branch becomes:
```ts
  } else if (power === 'SUPER_STRENGTH') {
    rollCard(state, idx, 0.25, 0.05);
    if (p.outUntilTick <= state.tick && targetIdx !== undefined) {
      const target = state.players[targetIdx];
      if (target.outUntilTick <= state.tick && dist2(target.pos, p.pos) < STRENGTH_LAND_RANGE * STRENGTH_LAND_RANGE) {
        target.outUntilTick = state.tick + Math.round(80 * strength);
        target.outReason = 'ko';
        const hadBall = state.ball.kind === 'held' && state.ball.by === targetIdx;
        if (hadBall) state.ball = { kind: 'held', by: idx };
        emit(state, { t: state.tick, kind: 'TACKLE', by: idx, on: targetIdx, won: hadBall });
      }
    }
  }
```

`src/sim/engine.ts` `movementTick` — a winding hero with a lock CHARGES the target (insert after the `isCarrier` computation, and add the branch to the target ternary between the carrier branch and the presser branch):
```ts
    const chargeTarget = p.powerState.kind === 'winding' && p.powerState.targetIdx !== undefined
      ? state.players[p.powerState.targetIdx].pos : null;
```
```ts
      : chargeTarget ? chargeTarget
```

Test amendments: the rigged steal/ignite tests place both players at midfield (y≈5250, outside shot range) and set `powerState = { kind: 'ready', sinceTick: m.tick }` directly to control timing; the steal test asserts the locked target is flattened (`outReason 'ko'` + a TACKLE event by the rival) regardless of whether the steal component landed; the Task 11 "rival fires at 0.85" test is loosened to the policy-level truth (strengths ⊆ {0.85, 0.75}, never 1.0, with at least one 0.85 across seeds 1–10). Acceptance: SUPER_STRENGTH KO landing rate ≥50% of its fires across seeds 1–20.

- [ ] **Step 5: Commit**

```bash
git add src/sim/types.ts src/sim/powers.ts src/sim/engine.ts src/sim/__tests__/powers.test.ts
git commit -m "feat(sim): SUPER_SPEED, rival SUPER_STRENGTH, FIRE_TORCH effects with cards and ignition"
```

---

### Task 12.2: "In the Zone" activation rework + hardening batch (user pivot 2026-07-17 + external audit)

ONE commit. Modifies types.ts, powers.ts, engine.ts, match.ts + reworks affected tests. This replaces the READY-window model; the fun-gate tests zone semantics.

**A. State machine (types.ts):**
```ts
export type PowerState =
  | { kind: 'idle' }
  | { kind: 'zone'; remainingTicks: number }
  | { kind: 'winding'; untilTick: number; strength: number; targetIdx?: number }
  | { kind: 'active'; untilTick: number; strength: number };
```
MatchEvent gains `| { t: number; kind: 'POWER_EXPIRED'; player: number }`. The `gauge` field on SimPlayer is renamed in MEANING only (it is heat now) — keep the field name `gauge` to limit churn; add a comment.

**B. powers.ts rework:** constants `ZONE_WINDOW_TICKS = 70`, `ZONE_HEAT_THRESHOLD = 60`, `ZONE_ENTRY_RATE = 0.0009` (per heat point above threshold, per tick), `PURSUIT_MULT = 1.3`. Remove READY_WINDOW_TICKS/HARD_DEADLINE_TICKS. addGauge: heroes only, idle only, cap 200 (heat may exceed 100), NO ready transition — entry happens in powerTick. New helper `teamPowerBusy(state, team)`: any teammate with powerState winding or active. addGauge returns early when teamPowerBusy (heat freezes). powerTick per available hero:
1. If `teamPowerBusy(state, p.team)` and THIS hero is not the busy one → `continue` (zones and heat frozen).
2. idle: trickle via addGauge; then if `p.gauge >= ZONE_HEAT_THRESHOLD && state.rng() < (p.gauge - ZONE_HEAT_THRESHOLD) * ZONE_ENTRY_RATE` → `p.powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS }; p.gauge = 0; emit POWER_READY` (event kind retained; it now means zone entry). NOTE: this conditional rng draw is state-dependent and deterministic; powerTick draws happen before all other systems each tick, ascending index — document with a comment.
3. zone: taps (consumed at top of powerTick as today, valid only when that hero's state is zone) → windup at TAP_STRENGTH. FIRE_WHEN_READY: in context → windup 0.85; `remainingTicks <= 20` and no context → windup 0.75. Then `remainingTicks--`; at 0 → `emit POWER_EXPIRED; p.gauge = 50; idle`.
4. winding/active: unchanged (windup completes → activatePower with targetIdx; active expires → idle, gauge stays 0).
`speedMultiplier` additionally returns PURSUIT_MULT when winding with a targetIdx (the charge accelerates — Super Strength landing-rate fix; if seeds 1–20 landing stays <50%, raise STRENGTH_LAND_RANGE 400→500 and report which knob was needed).
`knockOut(state, idx, ticks, reason)` centralizes going-out: if the ball is held by idx → ball becomes loose at their position (vel 0); set outUntilTick/outReason. Used by FIRE_TORCH ignite, SUPER_STRENGTH KO, and sendOff (sendOff passes Number.MAX_SAFE_INTEGER).

**C. match.ts hardening:** `opts: { ...opts }` in createMatch; queueInput pushes separate copies `{ ...input }` into pendingInputs and inputLog; envelopeFrom maps inputs to fresh copies. `ENGINE_VERSION = 'm0.3'`. New `validateEnvelope(env)` called first in runReplay: schemaVersion === 1; engineVersion is a string; seed is a finite integer; both teams have exactly 11 players each with string id/name, role in {GK,DEF,MID,FWD}, 7 finite numeric attrs in 1..99, power undefined or in the PowerId set; inputs is an array of {kind:'POWER_TAP', tick: finite integer ≥ 1, player: finite integer}. Throw descriptive errors.

**D. Test rework acceptance gates** (adapt Task 11/12 tests to zone semantics; rigs set `powerState = { kind: 'zone', remainingTicks: 70 }` directly):
- Manual hero's expired window emits POWER_EXPIRED and leaves gauge 50, and NEVER auto-fires.
- FIRE_WHEN_READY fires 0.85 in context, 0.75 late-window; never 1.0 without a tap.
- One-active: rig two home heroes in zone, fire one → the other's remainingTicks must not decrease while the first is winding/active, and heat must not accumulate.
- knockOut releases a held ball (rig: ignite the carrier → ball becomes loose at their feet) — the audit's possession-freeze case.
- validateEnvelope rejects: string player index, NaN/Infinity tick, unknown input kind, unknown power, 10-player squad, attrs out of range (one test each, forged from a valid envelopeFrom output).
- Empirical (report, delete harness): seeds 1-20 zones/hero/match mean in [1.5, 3.5]; Super Strength KO landing ≥50%; possession changes after tick 1000 still >0; determinism double-run 5 seeds; full suite green + tsc clean + import-layers green.

Commit: `feat(sim): In-the-Zone activation, one-active-per-team, knockOut ball release, envelope validation, m0.3`

**12.2 follow-up ruling (as-built, commit 79a2f42):** target-requiring powers (`requiresTarget(power)`, true for SUPER_STRENGTH) never take the late-window 0.75 fallback — their windows expire like manual misses. SUPER_STRENGTH context = STRENGTH_LOCK_RANGE (one constant, 1200). PURSUIT_MULT 1.4. Measured: rival 0.7 fires/match, 100% locked, 92.9% KO landing.

### Task 13: Acceptance suite — parity, causality, timing value, golden replay, balance

**Pre-flight (one commit before the suite):**
1. Context upgrades (12.2 review Issue A — home heroes were context-less in ~50% of zones): SUPER_SPEED's useful context becomes "self-carrier AND in the attacking half (own y < PITCH_H/2 for team 0, mirrored for team 1), OR loose ball within 1500"; FIRE_TORCH's becomes "self-carrier with an opponent within 800 (its ignite radius — fire when a marker is on you), OR opposing carrier within 800". One constant per radius shared with the effect code so they can't drift.
2. validateEnvelope extension (Issue B): reject `homePolicy`/`awayPolicy` outside {SAVE_FOR_TAP, FIRE_WHEN_READY}, non-boolean `blindAutoHome`, and out-of-range `input.player` (integer 0..21) — descriptive errors + one forged-envelope test each.
3. Balance Lever A (Task 10 review): `attemptShot` distance penalty `distToGoal / 100` → `/ 200` (target: save rate ~70-75%, goals/match ~2-3). ENGINE_VERSION stays m0.3 (same unreleased batch).
4. Fix the stale GAUGE_CAP comment in powers.ts (heat exceeds 100 via involvement, not freeze).

**TIMING VALUE — redesigned gates (decision record, replacing `contextual > blind`):** the old gate compared two AIs and measured our trigger quality, not player agency. The claims the game actually makes, each with its own gate:
- **GATE-1 attention floor**: firing beats never-firing — home goals with all-FIRE_WHEN_READY vs SAVE_FOR_TAP-never-tapped over 400 seeds; paired margin must be positive with a bootstrap 95% CI lower bound > 0.
- **GATE-2 moment quality (per power, the player-agency claim)**: scripted paired comparisons on identical seeds — SUPER_SPEED tapped at a value moment (carrier attacking-half) vs tapped at an anti-moment (own-half, no threat): attacking outcomes (shots within 150 ticks of the fire) must favor the value moment with CI > 0 over 200 paired samples; FIRE_TORCH fired with a marker inside 800 vs alone: ignitions must occur only/overwhelmingly in the former; SUPER_STRENGTH is structurally proven (locked fires land 92.9%, targetless fires cannot exist).
- **GATE-3 auto sanity**: contextual auto must not embarrass — home goals contextual-auto ≥ blind-auto − 5% over 400 seeds (parity acceptable; regression not).
Justification: GATE-2 is what "your tap matters" means; GATE-1 is why watching pays at all; GATE-3 keeps Quick Result respectable. The blind comparator remains test-only scaffolding (blindAutoHome).

**Tuning round 1 (decision record, after first gate run):** GATE-1 measured +0.065 goals/match CI [-0.065, +0.198] — real but imperceptible, contradicting docs/09's "hero uplift 15-25%" target. Effect magnitudes raised: `DUR` map SUPER_SPEED 40 → 70, FIRE_TORCH 50 → 80, SUPER_STRENGTH 80 → 110; FIRE_TORCH ignite-out 100 → 140 ticks. Blowout rail measured 19.5 goals/match for a +20 team (compounding through every contest): new **game-management rule** in possessionTick — when a carrier's team leads by 4+ goals, the shoot trigger tightens to `toGoal < 1700` and the pass inclination rises (`state.rng() < 0.35` → `< 0.6`), deterministic, rng-order preserved (the draw still happens on the same condition path). Rails and gates unchanged; goldens regenerate (they were never committed). ENGINE_VERSION stays m0.3 — same unreleased batch. Suite runtime budget raised to 180s (measured 137s; gate power > speed).

**Files:**
- Test: `src/sim/__tests__/parity.test.ts`

These are the M0 acceptance gate. They should pass immediately if Tasks 7–12 are correct; if TIMING VALUE fails, the contexts aren't valuable — that's a design problem to fix (tune contexts/effects), never a test to weaken.

- [ ] **Step 1: Write the tests**

```ts
import { ENGINE_VERSION, runMatch, runReplay } from '../match';
import { ROVERS, UNITED } from '../teams';
import type { MatchInput, ReplayEnvelope } from '../types';

describe('M0 acceptance', () => {
  it('PARITY: zero-input runs are byte-identical (watched-no-taps == Quick Result)', () => {
    const a = runMatch(42, ROVERS, UNITED);
    const b = runMatch(42, ROVERS, UNITED);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('CAUSAL DIVERGENCE: some tap changes actual match outcomes (score or shot count), not just event bytes', () => {
    let causal = false;
    for (let seed = 1; seed <= 60 && !causal; seed++) {
      const base = runMatch(seed, ROVERS, UNITED);
      const ready = base.events.find(e => e.kind === 'POWER_READY' && (e as { player: number }).player < 11) as
        | { t: number; player: number } | undefined;
      if (!ready) continue;
      const taps: MatchInput[] = [{ tick: ready.t + 1, kind: 'POWER_TAP', player: ready.player }];
      const tapped = runMatch(seed, ROVERS, UNITED, taps);
      const shots = (r: { events: Array<{ kind: string }> }) => r.events.filter(e => e.kind === 'SHOT').length;
      if (tapped.score[0] !== base.score[0] || tapped.score[1] !== base.score[1] || shots(tapped) !== shots(base)) {
        causal = true;
      }
    }
    expect(causal).toBe(true);
  });

  it('TIMING VALUE: context-aware firing beats context-blind firing (200-seed aggregate)', () => {
    let contextual = 0, blind = 0;
    for (let seed = 1; seed <= 200; seed++) {
      contextual += runMatch(seed, ROVERS, UNITED, [], { homePolicy: 'FIRE_WHEN_READY' }).score[0];
      blind += runMatch(seed, ROVERS, UNITED, [], { homePolicy: 'FIRE_WHEN_READY', blindAutoHome: true }).score[0];
    }
    expect(contextual).toBeGreaterThan(blind);
  });

  it('GOLDEN REPLAY: full event payloads locked for a taped envelope', () => {
    const base = runMatch(42, ROVERS, UNITED);
    const ready = base.events.find(e => e.kind === 'POWER_READY' && (e as { player: number }).player < 11) as
      | { t: number; player: number } | undefined;
    const env: ReplayEnvelope = {
      schemaVersion: 1,
      engineVersion: ENGINE_VERSION,
      seed: 42,
      home: ROVERS,
      away: UNITED,
      inputs: ready ? [{ tick: ready.t + 1, kind: 'POWER_TAP', player: ready.player }] : [],
    };
    const r = runReplay(env);
    expect({ score: r.score, events: r.events }).toMatchSnapshot();
  });

  it('BALANCE SMOKE: a clearly stronger team wins the aggregate (200 matches)', () => {
    const strong = structuredClone(ROVERS);
    for (const p of strong.players) {
      for (const k of Object.keys(p.attrs) as Array<keyof typeof p.attrs>) {
        p.attrs[k] = Math.min(99, p.attrs[k] + 20);
      }
    }
    let strongWins = 0, weakWins = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const r = runMatch(seed, strong, UNITED);
      if (r.score[0] > r.score[1]) strongWins++;
      else if (r.score[1] > r.score[0]) weakWins++;
    }
    expect(strongWins).toBeGreaterThan(weakWins * 1.5);
  });
});
```

- [ ] **Step 2: Run**

Run: `npm test -- parity` → 5 passed (snapshot file created under `__snapshots__/`). If TIMING VALUE fails, use the systematic-debugging skill on the context predicates and effect durations — do not proceed to rendering with a failing agency test.

- [ ] **Step 3: Commit (with snapshot)**

```bash
git add src/sim/__tests__/parity.test.ts src/sim/__tests__/__snapshots__
git commit -m "test(sim): M0 acceptance — parity, causal divergence, timing value, golden replay, balance"
```

---

### Workstream A (concurrent): B+ heroic-chibi sprite pack

Runs in an isolated git worktree (branch `feature/m0-pixel-art`) in parallel with Tasks 9–13; merged before Task 14 integration. User decision (2026-07-17): the M0 fun-gate tests the match WITH real art — polish is part of the fantasy being validated.

- **Style**: B+ heroic chibi (see docs/01, docs/08): ~12×19px sprites, big readable head (~8px wide), two-heads-tall body, 1px dark outline `#3a2b23`, flat colors, no anti-aliasing.
- **Coverage**: all 22 players hand-designed with individual variety (hair style/color, skin tone, facial hair, body type). Stars visually distinct: Dario Flint (FIRE_TORCH — spiky red-orange hair), Zip Vela (SUPER_SPEED — slim build, aerodynamic look), Rex Bould (SUPER_STRENGTH — muscular build, wide shoulders). Kits: Rovers red `#e8433f`, United blue `#3f6fd8`, distinct GK kits (teal / amber). 2-frame run cycle per player + shared ball sprite.
- **Format**: sprites as pixel-map DATA (`src/render/sprites/sprites.json`: palette + rows-of-chars per sprite frame, keyed by player id `r0…u10`), zod-free typed loader, and `buildSpriteAtlas(Skia)` compositing all frames into one texture with `rectFor(playerId, frame)` lookup. State effects (windup flash, active glow, out gray, ignited orange) stay renderer-side tints — not extra sprites.
- **Preview**: `art/preview.html` — a standalone browser page rendering every sprite at 8× from the same JSON, for user approval before integration.
- Task 14 integration consumes `buildSpriteAtlas` in place of `makePlaceholderTexture` (which remains as fallback).

### Task 14: Match screen — telegraphs, threat chip, lifecycle-safe loop

**Files:**
- Create: `src/render/interpolate.ts`, `src/render/atlas.ts`, `src/render/MatchScreen.tsx`
- Modify: `App.tsx`
- Test: `src/render/__tests__/interpolate.test.ts`

- [ ] **Step 1: Install rendering deps**

```bash
npx expo install @shopify/react-native-skia react-native-reanimated react-native-worklets
```

Ensure `babel.config.js` plugins end with `'react-native-worklets/plugin'` (Reanimated v4 convention; check the installed version's README if babel errors).

- [ ] **Step 2: TDD the snapshot + lerp math**

`src/render/__tests__/interpolate.test.ts`:

```ts
import { lerpVec, snapshotFrame } from '../interpolate';
import { createMatch, tick } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';

describe('interpolate', () => {
  it('lerpVec blends between two points', () => {
    expect(lerpVec({ x: 0, y: 0 }, { x: 100, y: 200 }, 0.5)).toEqual({ x: 50, y: 100 });
    expect(lerpVec({ x: 0, y: 0 }, { x: 100, y: 200 }, 0)).toEqual({ x: 0, y: 0 });
    expect(lerpVec({ x: 0, y: 0 }, { x: 100, y: 200 }, 1)).toEqual({ x: 100, y: 200 });
  });

  it('snapshotFrame captures players, ball, carrier, and statuses', () => {
    const m = createMatch(42, ROVERS, UNITED);
    tick(m);
    const s = snapshotFrame(m);
    expect(s.players).toHaveLength(22);
    expect(s.statuses).toHaveLength(22);
    expect(typeof s.carrier).toBe('number');
    expect(s.ball).toBeDefined();
  });
});
```

Run: `npm test -- interpolate` → FAIL. Implement `src/render/interpolate.ts`:

```ts
import type { MatchState } from '../sim/types';
import { ballPos } from '../sim/engine';
import type { Vec } from '../sim/geometry';

export type PlayerStatus = 'ok' | 'windup' | 'active' | 'out' | 'ignited';

export interface PitchFrame {
  players: Vec[];
  ball: Vec;
  carrier: number; // -1 when ball not held
  statuses: PlayerStatus[];
}

export function lerpVec(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function snapshotFrame(state: MatchState): PitchFrame {
  return {
    players: state.players.map(p => ({ ...p.pos })),
    ball: ballPos(state),
    carrier: state.ball.kind === 'held' ? state.ball.by : -1,
    statuses: state.players.map(p => {
      if (p.outUntilTick > state.tick) return p.outReason === 'ignited' ? 'ignited' : 'out';
      if (p.powerState.kind === 'winding') return 'windup';
      if (p.powerState.kind === 'active') return 'active';
      return 'ok';
    }),
  };
}

export function lerpFrame(prev: PitchFrame, next: PitchFrame, t: number): PitchFrame {
  return {
    players: prev.players.map((p, i) => lerpVec(p, next.players[i], t)),
    ball: lerpVec(prev.ball, next.ball, t),
    carrier: next.carrier,
    statuses: next.statuses,
  };
}
```

Run: `npm test -- interpolate` → PASS.

- [ ] **Step 3: Placeholder atlas texture**

`src/render/atlas.ts`:

```ts
import { Skia, rect } from '@shopify/react-native-skia';

export const SPRITE = 16;

export function makePlaceholderTexture() {
  const surface = Skia.Surface.MakeOffscreen(SPRITE, SPRITE)!;
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setColor(Skia.Color('white'));
  canvas.drawRect(rect(0, 0, SPRITE, SPRITE), paint);
  surface.flush();
  return surface.makeImageSnapshot();
}
```

- [ ] **Step 4: MatchScreen (complete file)**

Lifecycle rules baked in: capped catch-up (max 5 ticks/frame), AppState pause with clock reset on resume, manual pause via the scorebar. Telegraphs: possession ring, windup pulse, gold active tint, speed trail, ignite marker, power banner. Chips: two tappable hero chips + one non-tappable red THREAT chip for the rival (its gauge is visible — learning to fear it IS the counterplay lesson).

```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Atlas, Canvas, Circle, Fill, Skia, useRSXformBuffer, useRectBuffer } from '@shopify/react-native-skia';
import { createMatch, queueInput, tick } from '../sim/match';
import { ROVERS, UNITED } from '../sim/teams';
import { PITCH_W, PITCH_H, TICK_MS } from '../sim/geometry';
import type { MatchEvent, MatchState } from '../sim/types';
import { lerpFrame, snapshotFrame, type PitchFrame } from './interpolate';
import { makePlaceholderTexture, SPRITE } from './atlas';

const MY_HEROES = [9, 10];   // Flint (FIRE_TORCH), Vela (SUPER_SPEED)
const RIVAL_HERO = 14;       // Rex Bould (SUPER_STRENGTH)
const MAX_CATCHUP_TICKS = 5;

export function MatchScreen({ seed, onDone }: { seed: number; onDone: (state: MatchState) => void }) {
  const { width } = useWindowDimensions();
  const scale = width / PITCH_W;
  const pitchH = PITCH_H * scale;

  const stateRef = useRef<MatchState>(createMatch(seed, ROVERS, UNITED));
  const prevRef = useRef<PitchFrame>(snapshotFrame(stateRef.current));
  const nextRef = useRef<PitchFrame>(snapshotFrame(stateRef.current));
  const trailRef = useRef<Array<{ x: number; y: number }>>([]);
  const [frame, setFrame] = useState<PitchFrame>(prevRef.current);
  const [hud, setHud] = useState({ score: [0, 0] as [number, number], tick: 0, banner: '' });
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const speedRef = useRef(1);
  const pausedRef = useRef(false);
  speedRef.current = speed;
  pausedRef.current = paused;
  const [, forceChips] = useState(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') { last = performance.now(); acc = 0; }
      else pausedRef.current = true; // background → hard pause; user resumes via tap
    });

    const loop = (now: number) => {
      const s = stateRef.current;
      if (!pausedRef.current) {
        acc = Math.min(acc + (now - last) * speedRef.current, TICK_MS * MAX_CATCHUP_TICKS);
      }
      last = now;
      while (acc >= TICK_MS && s.phase !== 'fulltime' && !pausedRef.current) {
        prevRef.current = nextRef.current;
        tick(s);
        nextRef.current = snapshotFrame(s);
        const speedster = s.players.find((p, i) => nextRef.current.statuses[i] === 'active' && p.def.power === 'SUPER_SPEED');
        if (speedster) {
          trailRef.current = [{ ...speedster.pos }, ...trailRef.current].slice(0, 3);
        } else trailRef.current = [];
        acc -= TICK_MS;
      }
      setFrame(lerpFrame(prevRef.current, nextRef.current, Math.min(1, acc / TICK_MS)));
      const fired = s.events.slice(-6).find((e): e is Extract<MatchEvent, { kind: 'POWER_FIRED' }> => e.kind === 'POWER_FIRED');
      setHud({
        score: [...s.score] as [number, number],
        tick: s.tick,
        banner: fired ? `${fired.power.replace(/_/g, ' ')} — ${s.players[fired.player].def.name}` : '',
      });
      forceChips(c => c + 1);
      if (s.phase === 'fulltime') { onDone(s); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); sub.remove(); };
  }, [onDone]);

  const texture = useMemo(() => makePlaceholderTexture(), []);
  const sprites = useRectBuffer(22, r => r.setXYWH(0, 0, SPRITE, SPRITE));
  const transforms = useRSXformBuffer(22, (f, i) => {
    const p = frame.players[i];
    f.set(scale * 40, 0, p.x * scale - 8, p.y * scale - 8);
  });
  const colors = useMemo(
    () => frame.statuses.map((st, i) => {
      if (st === 'ignited') return Skia.Color('#ff6a00');
      if (st === 'out') return Skia.Color('#666666');
      if (st === 'windup') return Skia.Color(stateRef.current.tick % 4 < 2 ? '#ffffff' : '#f5c518');
      if (st === 'active') return Skia.Color('#f5c518');
      return Skia.Color(i < 11 ? '#e8433f' : '#3f6fd8');
    }),
    [frame],
  );

  const minute = Math.min(90, Math.ceil((hud.tick / 2000) * 90));
  const s = stateRef.current;

  const chip = (idx: number, tappable: boolean) => {
    const p = s.players[idx];
    const ready = p.powerState.kind === 'ready';
    const inContext = ready; // chip already pulses on ready; context glow refinement is renderer-side sugar in M1
    return (
      <Pressable
        key={idx}
        disabled={!tappable}
        style={[styles.chip, ready && (tappable ? styles.chipReady : styles.chipThreat)]}
        onPress={() => queueInput(s, { tick: s.tick + 1, kind: 'POWER_TAP', player: idx })}
      >
        <Text style={styles.chipName}>{(tappable ? '' : '⚠ ') + p.def.name.split(' ')[1]}</Text>
        <View style={styles.gaugeTrack}>
          <View style={[styles.gaugeFill, !tappable && styles.gaugeFillThreat, { width: `${Math.round(p.gauge)}%` }]} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <Pressable style={styles.scorebar} onPress={() => setPaused(x => !x)}>
        <Text style={styles.scoreText}>ROV {hud.score[0]} – {hud.score[1]} UNI · {minute}'{paused ? ' ⏸' : ''}</Text>
        <Pressable onPress={() => setSpeed(x => (x === 1 ? 2 : 1))}>
          <Text style={styles.speedText}>×{speed}</Text>
        </Pressable>
      </Pressable>
      <Canvas style={{ width, height: pitchH }}>
        <Fill color="#2e7d3a" />
        {trailRef.current.map((t, i) => (
          <Circle key={i} cx={t.x * scale} cy={t.y * scale} r={4 - i} color="#ffffff" opacity={0.5 - i * 0.15} />
        ))}
        <Atlas image={texture} sprites={sprites} transforms={transforms} colors={colors} />
        {frame.carrier >= 0 ? (
          <Circle
            cx={frame.players[frame.carrier].x * scale}
            cy={frame.players[frame.carrier].y * scale}
            r={12} color="#ffffff" style="stroke" strokeWidth={2}
          />
        ) : null}
        <Circle cx={frame.ball.x * scale} cy={frame.ball.y * scale} r={5} color="white" />
      </Canvas>
      {hud.banner ? <Text style={styles.banner}>⚡ {hud.banner}</Text> : null}
      <View style={styles.chips}>
        {MY_HEROES.map(i => chip(i, true))}
        {chip(RIVAL_HERO, false)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101418' },
  scorebar: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, paddingTop: 56 },
  scoreText: { color: 'white', fontSize: 18, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  speedText: { color: 'white', fontSize: 18, padding: 4 },
  banner: { color: '#f5c518', fontSize: 18, fontWeight: 'bold', textAlign: 'center', padding: 8 },
  chips: { flexDirection: 'row', justifyContent: 'space-around', padding: 16 },
  chip: { backgroundColor: '#1e2630', borderRadius: 12, padding: 12, minWidth: 96, alignItems: 'center' },
  chipReady: { backgroundColor: '#4a3b10', borderWidth: 2, borderColor: '#f5c518' },
  chipThreat: { backgroundColor: '#3a1512', borderWidth: 2, borderColor: '#e8433f' },
  chipName: { color: 'white', fontSize: 14, marginBottom: 6 },
  gaugeTrack: { width: 72, height: 8, backgroundColor: '#0a0e12', borderRadius: 4, overflow: 'hidden' },
  gaugeFill: { height: 8, backgroundColor: '#f5c518' },
  gaugeFillThreat: { backgroundColor: '#e8433f' },
});
```

- [ ] **Step 5: Home screen (`App.tsx`, complete file)**

```tsx
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MatchScreen } from './src/render/MatchScreen';
import { StressScreen } from './src/render/StressScreen';
import { runMatch } from './src/sim/match';
import { ROVERS, UNITED } from './src/sim/teams';
import type { MatchState } from './src/sim/types';

type Screen = 'home' | 'match' | 'stress';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [seed, setSeed] = useState(42);
  const [result, setResult] = useState<string | null>(null);

  const finishWatched = (s: MatchState) => {
    setResult(`Watched · ROV ${s.score[0]} – ${s.score[1]} UNI (seed ${seed})`);
    setScreen('home');
  };

  if (screen === 'match') return <MatchScreen seed={seed} onDone={finishWatched} />;
  if (screen === 'stress') return <StressScreen />;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Hero Football Manager — M0</Text>
      <Text style={styles.seed}>Seed: {seed}</Text>
      {result ? <Text style={styles.result}>{result}</Text> : null}
      <Pressable style={styles.btn} onPress={() => setScreen('match')}><Text style={styles.btnText}>Watch match</Text></Pressable>
      <Pressable
        style={styles.btn}
        onPress={() => {
          const r = runMatch(seed, ROVERS, UNITED);
          setResult(`Quick · ROV ${r.score[0]} – ${r.score[1]} UNI (seed ${seed})`);
        }}
      >
        <Text style={styles.btnText}>Quick result</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={() => setSeed(x => x + 1)}><Text style={styles.btnText}>New seed</Text></Pressable>
      <Pressable style={styles.btn} onPress={() => setScreen('stress')}><Text style={styles.btnText}>Stress test</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101418', alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  seed: { color: '#9ab', fontSize: 16, fontVariant: ['tabular-nums'] },
  result: { color: '#f5c518', fontSize: 16 },
  btn: { backgroundColor: '#1e2630', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, minWidth: 220, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 17 },
});
```

Note: `StressScreen` is created in Task 15 — create a placeholder now so TS compiles: `export function StressScreen() { return null; }` in `src/render/StressScreen.tsx`, replaced next task.

- [ ] **Step 6: Manual verification on simulator**

Run: `npx tsc --noEmit` → clean. `npx expo start --ios`.

Checklist:
- [ ] Match plays; the white ring marks the ball carrier at all times; passes visibly travel.
- [ ] Your two chips fill gold; READY pulses; tapping fires within ~1.5s; sprite flickers white during wind-up; banner names the power.
- [ ] The rival THREAT chip fills red and Rex Bould's power visibly flattens your carrier without your input.
- [ ] Fire Torch turns an opponent orange, then gray, then back.
- [ ] ×2 doubles pace; tapping the scorebar pauses; backgrounding the app and returning does NOT fast-forward the match.
- [ ] Quick Result with the same seed equals an untapped watched match (spot-check one seed).

- [ ] **Step 7: Commit**

```bash
git add App.tsx src/render babel.config.js package.json package-lock.json app.json
git commit -m "feat(render): match screen with telegraphs, threat chip, and lifecycle-safe game loop"
```

---

### Task 15: Stress screen on the worklet path

**Files:**
- Modify: `src/render/StressScreen.tsx` (replace placeholder)

This screen exists to validate the PRODUCTION rendering path (worklet-driven Atlas transforms, zero per-frame React state). A benchmark that re-renders React every frame measures the wrong thing.

- [ ] **Step 1: Implement (complete file)**

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Atlas, Canvas, Fill, Skia, useClock, useRSXformBuffer, useRectBuffer } from '@shopify/react-native-skia';
import { useFrameCallback, runOnJS } from 'react-native-reanimated';
import { makePlaceholderTexture, SPRITE } from './atlas';
import { mulberry32 } from '../sim/rng';

const N = 2000;

export function StressScreen() {
  const { width, height } = useWindowDimensions();
  const [fps, setFps] = useState(0);
  const clock = useClock();

  const seeds = useMemo(() => {
    const rng = mulberry32(1);
    return Array.from({ length: N }, () => ({
      x: rng() * width, y: rng() * height, vx: rng() * 120 - 60, vy: rng() * 120 - 60,
    }));
  }, [width, height]);

  const texture = useMemo(() => makePlaceholderTexture(), []);
  const sprites = useRectBuffer(N, r => r.setXYWH(0, 0, SPRITE, SPRITE));
  const transforms = useRSXformBuffer(N, (f, i) => {
    'worklet';
    const s = seeds[i];
    const t = clock.value / 1000;
    const x = ((s.x + s.vx * t) % width + width) % width;
    const y = ((s.y + s.vy * t) % height + height) % height;
    f.set(0.6, 0, x, y);
  });
  const colors = useMemo(() => seeds.map((_, i) => Skia.Color(i % 2 ? '#e8433f' : '#3f6fd8')), [seeds]);

  const frameStats = useMemo(() => ({ frames: 0, since: 0 }), []);
  useFrameCallback(info => {
    'worklet';
    frameStats.frames++;
    frameStats.since += info.timeSincePreviousFrame ?? 0;
    if (frameStats.since >= 1000) {
      runOnJS(setFps)(Math.round((frameStats.frames * 1000) / frameStats.since));
      frameStats.frames = 0;
      frameStats.since = 0;
    }
  });

  useEffect(() => () => {}, []);

  return (
    <View style={styles.root}>
      <Canvas style={{ width, height: height - 120 }}>
        <Fill color="#101418" />
        <Atlas image={texture} sprites={sprites} transforms={transforms} colors={colors} />
      </Canvas>
      <Text style={styles.fps}>{N} sprites · {fps} fps (worklet path)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101418' },
  fps: { color: '#f5c518', fontSize: 20, textAlign: 'center', padding: 24, fontVariant: ['tabular-nums'] },
});
```

API note: `useClock`/`useRSXformBuffer`/`useFrameCallback` signatures follow the installed Skia/Reanimated versions' Atlas documentation — if hooks drifted, follow the current official Atlas+Reanimated example. The requirement is fixed: transforms update on the UI thread; no per-frame React state besides the 1Hz fps text.

- [ ] **Step 2: Device checks**

- iOS simulator + iPhone: expect a solid 60 fps at 2,000 sprites.
- Budget/mid Android (the whole point): if fps < 55 at 2,000, halve N until stable and record the ceiling in README. The match needs ~25 sprites, so ≥500 stable is a comfortable pass; if even 500 struggles, STOP and investigate the Atlas usage before building more match UI.

- [ ] **Step 3: Commit**

```bash
git add src/render/StressScreen.tsx
git commit -m "feat(render): worklet-driven 2000-sprite Atlas stress screen (production render path)"
```

---

### Task 16: Wrap-up — run instructions and the fun-gate protocol

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append to README.md**

```markdown
## Running the M0 prototype

- `npm test` — deterministic sim suite (engine, powers, acceptance gates)
- `npx expo start --ios` — home: Watch match / Quick result / New seed / Stress test
- M0 renders placeholder shapes with telegraphs by design; real art arrives in M1.

### M0 fun-gate protocol (before starting M1)

Hand the phone to 3 people for one watched match each, then ask:
1. "What just happened?" after a power fires — can they name cause and effect?
2. "When should you tap?" — do they discover the timing decision unprompted?
3. "Was the rival's power scary but fair?" — threat comprehension without frustration.
Record answers next to this section. Redesign before M1 if answers are muddled or nobody smiles.
```

- [ ] **Step 2: Full verification**

Run: `npm test` → all pass. Run: `npx tsc --noEmit` → clean.

- [ ] **Step 3: Final commit**

```bash
git add README.md
git commit -m "docs: M0 run instructions and fun-gate protocol"
```

---

## Self-review (performed at plan-writing time, v2)

- **Review findings addressed:** rival hero + license-cap-consistent teams (Task 5); in-flight passes (Task 8); fire policies + contexts + attention ladder (Task 11); causal-divergence and timing-value acceptance tests (Task 13); `events.ts` + local-import-then-re-export + `speedFor(state, idx)` + one-way import graph `rng/geometry → contest/formation/types → events → powers → engine → match` (Tasks 7–12); no `Math.exp`/`Math.hypot` in the sim (Tasks 3–4); replay envelope + full-payload golden snapshot (Tasks 5, 13); capped catch-up + AppState pause (Task 14); worklet stress path (Task 15); comprehension gate (Task 16).
- **Placeholder scan:** remaining stubs are labeled forward-references replaced by a named task (`attemptShot` 8→10; `addGauge`/`interruptWindup`/`fireSuppressed`/`dribbleBonus`/`defenseBonus`/`speedMultiplier` 7–9→11–12); `StressScreen` placeholder 14→15. No TBDs.
- **Type consistency check:** `firePolicy` on SimPlayer (Task 5) is set in `makePlayers` (Task 7) and read in `powerTick` (Task 11); `outReason` set by powers (Task 12) and consumed by `movementTick` recovery events (Task 7) and `snapshotFrame` (Task 14); `blindAutoHome` defined in MatchOpts/MatchState (Task 5), set in `createMatch` (Task 7), read in `powerTick` (Task 11), exercised by the timing-value test (Task 13); gauge numbers match docs (8/15/20/12, 0.02 trickle, windows 80/120, strengths 1.0/0.85/0.75, windup 15).
- **Retained judgment calls for the executor:** (1) match screen stays JS-loop + per-frame setState for M0 (22 sprites; worklet migration is an M1 task per docs/10) — the stress screen validates the production path; (2) shot flight is straight-line with pre-rolled aim; (3) pass outcome is pre-rolled at launch with visible flight (interception point = the pre-chosen interceptor) — full en-route re-contest is M1 polish; (4) `structuredClone` in tests needs Node 17+.
