# M0 Match Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The M0 fun-gate build — a deterministic 11v11 match simulation (pure TypeScript) rendered with Skia Atlas, with 3 superpowers, a Hero Gauge, tap-to-fire, Quick Result, and a budget-device stress test.

**Architecture:** `src/sim/` is a pure, deterministic TypeScript engine (no RN/Skia/Expo imports, seeded PRNG only, 100ms fixed ticks, integer-cm positions) that emits a typed event stream. `src/render/` consumes tick snapshots and interpolates them at 60fps via Skia's batched `Atlas` API. User power-taps are queued inputs into the sim — same seed + same inputs = identical match.

**Tech Stack:** Expo (blank TypeScript template), @shopify/react-native-skia (Atlas), react-native-reanimated v4, Jest + ts-jest for the sim core.

**Spec sources:** `docs/03-match-engine.md`, `docs/04-superpowers.md`, `docs/09-tech-stack.md`, `docs/10-roadmap.md` (M0 section).

**Conventions for every task:** TypeScript strict; no `Math.random`/`Date.now` anywhere under `src/sim/`; run `npx tsc --noEmit` before each commit; every commit message is descriptive and ends with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. M0 UI uses `StyleSheet.create` placeholders — NativeWind adoption is deliberately deferred to M1 (M0 HUD is throwaway; adopting NativeWind here would double scaffold work for screens that get replaced).

**File map (locked):**

```
App.tsx                          screen switcher: home | match | stress
src/sim/rng.ts                   mulberry32 seeded PRNG
src/sim/geometry.ts              Vec, dist, moveToward, clamp + pitch constants
src/sim/types.ts                 all sim types & events
src/sim/teams.ts                 two hardcoded demo teams (3 heroes on Rovers)
src/sim/contest.ts               logistic contested-roll helper
src/sim/formation.ts             4-4-2 anchors, mirroring, ball-shift
src/sim/engine.ts                per-tick internals: movement, possession, tackles, shots
src/sim/powers.ts                Hero Gauge, windup/interrupt, 3 power effects
src/sim/match.ts                 public API: createMatch, tick, queueInput, runMatch
src/sim/__tests__/*.test.ts      one test file per module above
src/render/interpolate.ts        lerp between tick snapshots (pure, tested)
src/render/atlas.ts              placeholder sprite texture + transform builders
src/render/MatchScreen.tsx       canvas + HUD (chips, banner, speed, score)
src/render/StressScreen.tsx      2,000-sprite Atlas FPS test
```

---

### Task 1: Scaffold — Expo app, strict TS, Jest harness

**Files:**
- Create: entire Expo scaffold at repo root (via temp dir), `jest.config.js`
- Modify: `tsconfig.json`, `package.json`, `.gitignore`

- [ ] **Step 1: Scaffold Expo into the existing repo without clobbering README.md**

```bash
cd /Users/joemacprom5/Documents/Vibecode/Hero_Football_Manager
npx create-expo-app@latest hfm-scaffold --template blank-typescript
rm hfm-scaffold/README.md
cp -R hfm-scaffold/. .
rm -rf hfm-scaffold
```

Expected: `App.tsx`, `package.json`, `tsconfig.json`, `app.json`, `assets/`, `.gitignore` now exist at repo root; our `README.md`, `CLAUDE.md`, `docs/`, `research/` untouched.

- [ ] **Step 2: Enforce strict TypeScript**

Ensure `tsconfig.json` contains (add `strict` if the template didn't):

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}
```

Run: `npx tsc --noEmit` → Expected: no errors.

- [ ] **Step 3: Install and configure Jest for the pure sim core**

```bash
npm i -D jest ts-jest @types/jest
```

Create `jest.config.js`:

```js
/** Jest runs ONLY the pure sim/render-math tests; RN components are verified on-device in M0. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
};
```

Add to `package.json` scripts: `"test": "jest"`.

- [ ] **Step 4: Verify the harness runs (zero tests is the expected state)**

Run: `npm test`
Expected: exits reporting no tests found (exit code 1 is fine at this step — the config loaded without error; the message must be "No tests found", not a config exception).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo blank-TS app with strict TS and ts-jest harness"
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
    const seqA = Array.from({ length: 10 }, a);
    const seqB = Array.from({ length: 10 }, b);
    expect(seqA).not.toEqual(seqB);
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

Run: `npm test -- rng`
Expected: FAIL — cannot find module '../rng'.

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

Run: `npm test -- rng` → Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/sim/rng.ts src/sim/__tests__/rng.test.ts
git commit -m "feat(sim): seeded mulberry32 PRNG with determinism tests"
```

---

### Task 3: Geometry & pitch constants (`geometry.ts`)

**Files:**
- Create: `src/sim/geometry.ts`
- Test: `src/sim/__tests__/geometry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { dist, moveToward, clamp, PITCH_W, PITCH_H, GOAL_W, TICK_MS, HALF_TICKS } from '../geometry';

describe('geometry', () => {
  it('constants match the design doc', () => {
    expect(TICK_MS).toBe(100);
    expect(HALF_TICKS).toBe(1000);
    expect(PITCH_W).toBe(6800);
    expect(PITCH_H).toBe(10500);
    expect(GOAL_W).toBe(1400);
  });

  it('dist is euclidean, rounded to integer cm', () => {
    expect(dist({ x: 0, y: 0 }, { x: 300, y: 400 })).toBe(500);
  });

  it('moveToward advances by speed and never overshoots', () => {
    const p = moveToward({ x: 0, y: 0 }, { x: 100, y: 0 }, 60);
    expect(p).toEqual({ x: 60, y: 0 });
    const q = moveToward({ x: 0, y: 0 }, { x: 30, y: 0 }, 60);
    expect(q).toEqual({ x: 30, y: 0 });
  });

  it('moveToward returns integer coordinates on diagonals', () => {
    const p = moveToward({ x: 0, y: 0 }, { x: 1000, y: 1000 }, 100);
    expect(Number.isInteger(p.x)).toBe(true);
    expect(Number.isInteger(p.y)).toBe(true);
  });

  it('clamp bounds values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- geometry` → Expected: FAIL — cannot find module.

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

export function dist(a: Vec, b: Vec): number {
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y));
}

export function moveToward(from: Vec, to: Vec, speed: number): Vec {
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  if (d <= speed || d === 0) return { x: to.x, y: to.y };
  const t = speed / d;
  return { x: Math.round(from.x + (to.x - from.x) * t), y: Math.round(from.y + (to.y - from.y) * t) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- geometry` → Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/sim/geometry.ts src/sim/__tests__/geometry.test.ts
git commit -m "feat(sim): integer-cm geometry helpers and pitch constants"
```

---

### Task 4: Sim types & demo teams (`types.ts`, `teams.ts`)

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

  it('Rovers field exactly the 3 M0 powers; United has none', () => {
    expect(ROVERS.players.map(p => p.power).filter(Boolean).sort())
      .toEqual(['FIRE_TORCH', 'SUPER_SPEED', 'SUPER_STRENGTH']);
    expect(UNITED.players.every(p => !p.power)).toBe(true);
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

Run: `npm test -- teams` → Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement types**

`src/sim/types.ts` — the single source of truth every later task imports:

```ts
import type { Vec } from './geometry';
import type { Rng } from './rng';

export type PowerId = 'SUPER_SPEED' | 'SUPER_STRENGTH' | 'FIRE_TORCH';
export type Role = 'GK' | 'DEF' | 'MID' | 'FWD';

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

export interface SimPlayer {
  def: PlayerDef;
  team: 0 | 1;
  pos: Vec;
  condition: number;        // 0-100, in-match stamina
  gauge: number;            // 0-100 Hero Gauge (0 forever for non-heroes)
  powerState: PowerState;
  outUntilTick: number;     // knocked out / ignited until this tick (0 = fine)
  tackleCooldownUntil: number;
  cards: 0 | 1 | 2;
}

export type BallState =
  | { kind: 'held'; by: number }
  | { kind: 'loose'; pos: Vec; vel: Vec }
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
  | { t: number; kind: 'HALF_TIME' }
  | { t: number; kind: 'FULL_TIME' };

export type MatchInput = { tick: number; kind: 'POWER_TAP'; player: number };

export type Phase = 'play' | 'fulltime';

export interface MatchState {
  tick: number;
  half: 1 | 2;
  phase: Phase;
  score: [number, number];
  players: SimPlayer[];      // 22; 0-10 = team 0 (attacks toward y=0), 11-21 = team 1
  ball: BallState;
  resolve: [number, number]; // GK Resolve per team, 0-100
  rng: Rng;
  events: MatchEvent[];
  pendingInputs: MatchInput[];
}

export interface MatchResult { score: [number, number]; events: MatchEvent[]; }
```

- [ ] **Step 4: Implement demo teams**

`src/sim/teams.ts`:

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
    p('r3', 'Max Tanko', 'DEF', a(50, 25, 45, 64, 40, 70, 10), 'SUPER_STRENGTH'),
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
    p('u3', 'Rex Bould', 'DEF', a(51, 26, 46, 65, 41, 69, 10)),
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

- [ ] **Step 5: Run tests and typecheck, then commit**

Run: `npm test -- teams` → Expected: 4 passed. Run: `npx tsc --noEmit` → clean.

```bash
git add src/sim/types.ts src/sim/teams.ts src/sim/__tests__/teams.test.ts
git commit -m "feat(sim): core match types and two hardcoded demo teams (3 heroes on Rovers)"
```

---

### Task 5: Contested rolls (`contest.ts`)

**Files:**
- Create: `src/sim/contest.ts`
- Test: `src/sim/__tests__/contest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { contestProbability, contest } from '../contest';
import { mulberry32 } from '../rng';

describe('contest', () => {
  it('equal stats = 50%', () => {
    expect(contestProbability(50, 50)).toBeCloseTo(0.5, 5);
  });

  it('+20 advantage ≈ 84% (logistic with divisor 12)', () => {
    expect(contestProbability(60, 40)).toBeCloseTo(0.8411, 3);
  });

  it('modifier shifts the attacker side', () => {
    expect(contestProbability(50, 50, 12)).toBeCloseTo(contestProbability(62, 50), 5);
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

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- contest` → Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

```ts
import type { Rng } from './rng';

/** P(attacker beats defender). Divisor 12 per docs/03: ±20 stat gap ≈ 84/16. */
export function contestProbability(attacker: number, defender: number, mod = 0): number {
  return 1 / (1 + Math.exp(-(attacker + mod - defender) / 12));
}

export function contest(rng: Rng, attacker: number, defender: number, mod = 0): boolean {
  return rng() < contestProbability(attacker, defender, mod);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- contest` → Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/sim/contest.ts src/sim/__tests__/contest.test.ts
git commit -m "feat(sim): logistic contested-roll helper with statistical test"
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

  it('team 1 is a mirror of team 0', () => {
    const ballCenter = { x: PITCH_W / 2, y: PITCH_H / 2 };
    const t0 = anchorFor(0, 5, ballCenter);
    const t1 = anchorFor(1, 5, ballCenter);
    expect(t1.y).toBe(PITCH_H - t0.y);
    expect(t1.x).toBe(t0.x);
  });

  it('anchors shift toward the ball', () => {
    const left = anchorFor(0, 5, { x: 0, y: PITCH_H / 2 });
    const right = anchorFor(0, 5, { x: PITCH_W, y: PITCH_H / 2 });
    expect(left.x).toBeLessThan(right.x);
  });

  it('all 11 slots return in-bounds integer positions', () => {
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

Run: `npm test -- formation` → Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import { PITCH_W, PITCH_H, clamp, type Vec } from './geometry';

/** 4-4-2 anchor fractions for a team attacking toward y=0. Slot order matches TeamDef.players. */
const ANCHORS_442: ReadonlyArray<readonly [number, number]> = [
  [0.50, 0.94], // GK
  [0.15, 0.78], [0.38, 0.80], [0.62, 0.80], [0.85, 0.78], // DEF
  [0.15, 0.55], [0.38, 0.58], [0.62, 0.58], [0.85, 0.55], // MID
  [0.38, 0.30], [0.62, 0.30], // FWD
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

Run: `npm test -- formation` → Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/sim/formation.ts src/sim/__tests__/formation.test.ts
git commit -m "feat(sim): 4-4-2 formation anchors with mirroring and ball pull"
```

---

### Task 7: Match skeleton — clock, halves, movement (`match.ts` + `engine.ts` v1)

**Files:**
- Create: `src/sim/match.ts`, `src/sim/engine.ts`
- Test: `src/sim/__tests__/match.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { createMatch, tick, runMatch } from '../match';
import { ROVERS, UNITED } from '../teams';
import { HALF_TICKS } from '../geometry';

describe('match skeleton', () => {
  it('creates 22 players holding kickoff ball', () => {
    const m = createMatch(42, ROVERS, UNITED);
    expect(m.players).toHaveLength(22);
    expect(m.ball.kind).toBe('held');
    expect(m.events[0]).toMatchObject({ kind: 'KICKOFF', half: 1 });
  });

  it('runs to FULL_TIME with HALF_TIME in between', () => {
    const r = runMatch(42, ROVERS, UNITED);
    const kinds = r.events.map(e => e.kind);
    expect(kinds.filter(k => k === 'KICKOFF').length).toBeGreaterThanOrEqual(2);
    expect(kinds).toContain('HALF_TIME');
    expect(kinds[kinds.length - 1]).toBe('FULL_TIME');
  });

  it('halftime fires exactly at HALF_TICKS', () => {
    const r = runMatch(42, ROVERS, UNITED);
    const ht = r.events.find(e => e.kind === 'HALF_TIME');
    expect(ht?.t).toBe(HALF_TICKS);
  });

  it('is deterministic: same seed → identical event stream', () => {
    const a = runMatch(7, ROVERS, UNITED);
    const b = runMatch(7, ROVERS, UNITED);
    expect(a.events).toEqual(b.events);
    expect(a.score).toEqual(b.score);
  });

  it('players move each tick (no statues)', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const before = m.players.map(p => ({ ...p.pos }));
    for (let i = 0; i < 50; i++) tick(m);
    const moved = m.players.filter((p, i) => p.pos.x !== before[i].x || p.pos.y !== before[i].y);
    expect(moved.length).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- match` → Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement `engine.ts` v1 (movement only) and `match.ts`**

`src/sim/engine.ts` (v1 — later tasks extend this file):

```ts
import { anchorFor } from './formation';
import { moveToward, type Vec } from './geometry';
import type { MatchState, SimPlayer } from './types';

export function speedFor(p: SimPlayer): number {
  const conditionScale = 0.75 + 0.25 * (p.condition / 100);
  return Math.round((40 + p.def.attrs.pac) * conditionScale);
}

export function ballPos(state: MatchState): Vec {
  const b = state.ball;
  return b.kind === 'held' ? state.players[b.by].pos : b.pos;
}

export function drainStamina(p: SimPlayer, sprinting: boolean): void {
  p.condition = Math.max(0, p.condition - (sprinting ? 0.02 : 0.005));
}

/** v1: everyone runs formation anchors; carrier logic arrives in Task 8. */
export function movementTick(state: MatchState): void {
  const ball = ballPos(state);
  for (let i = 0; i < 22; i++) {
    const p = state.players[i];
    if (p.outUntilTick > state.tick) continue;
    const target = anchorFor(p.team, i % 11, ball);
    const before = p.pos;
    p.pos = moveToward(p.pos, target, speedFor(p));
    drainStamina(p, Math.hypot(p.pos.x - before.x, p.pos.y - before.y) > 80);
  }
}
```

`src/sim/match.ts`:

```ts
import { mulberry32 } from './rng';
import { HALF_TICKS, PITCH_W, PITCH_H } from './geometry';
import { anchorFor } from './formation';
import { movementTick } from './engine';
import type { MatchEvent, MatchInput, MatchResult, MatchState, SimPlayer, TeamDef } from './types';

const TOTAL_TICKS = HALF_TICKS * 2;

function makePlayers(home: TeamDef, away: TeamDef): SimPlayer[] {
  const mk = (team: 0 | 1, defs: TeamDef): SimPlayer[] =>
    defs.players.map((def, slot) => ({
      def, team,
      pos: anchorFor(team, slot, { x: PITCH_W / 2, y: PITCH_H / 2 }),
      condition: 100, gauge: 0,
      powerState: { kind: 'idle' as const },
      outUntilTick: 0, tackleCooldownUntil: 0, cards: 0 as const,
    }));
  return [...mk(0, home), ...mk(1, away)];
}

export function emit(state: MatchState, e: MatchEvent): void {
  state.events.push(e);
}

export function restartKickoff(state: MatchState, toTeam: 0 | 1): void {
  for (let i = 0; i < 22; i++) {
    const p = state.players[i];
    p.pos = anchorFor(p.team, i % 11, { x: PITCH_W / 2, y: PITCH_H / 2 });
  }
  const striker = toTeam === 0 ? 9 : 20; // first FWD slot of that team
  state.players[striker].pos = { x: PITCH_W / 2, y: PITCH_H / 2 };
  state.ball = { kind: 'held', by: striker };
}

export function createMatch(seed: number, home: TeamDef, away: TeamDef): MatchState {
  const state: MatchState = {
    tick: 0, half: 1, phase: 'play', score: [0, 0],
    players: makePlayers(home, away),
    ball: { kind: 'held', by: 9 },
    resolve: [100, 100],
    rng: mulberry32(seed),
    events: [], pendingInputs: [],
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

export function runMatch(seed: number, home: TeamDef, away: TeamDef, inputs: MatchInput[] = []): MatchResult {
  const state = createMatch(seed, home, away);
  for (const i of inputs) queueInput(state, i);
  while (state.phase !== 'fulltime') tick(state);
  return { score: state.score, events: state.events };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- match` → Expected: 5 passed. Also `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/sim/match.ts src/sim/engine.ts src/sim/__tests__/match.test.ts
git commit -m "feat(sim): match skeleton — clock, halves, kickoffs, anchor movement, determinism"
```

---

### Task 8: Possession — carrier decisions, dribbling, passing (`engine.ts` v2)

**Files:**
- Modify: `src/sim/engine.ts` (add possession logic; `movementTick` gains carrier/chaser targets)
- Modify: `src/sim/match.ts` (call `possessionTick` after `movementTick`)
- Test: `src/sim/__tests__/engine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { runMatch } from '../match';
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

  it('remains deterministic with possession logic', () => {
    expect(runMatch(9, ROVERS, UNITED).events).toEqual(runMatch(9, ROVERS, UNITED).events);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- engine` → Expected: FAIL — no PASS events (passes.length = 0).

- [ ] **Step 3: Implement possession in `engine.ts`**

Add to `src/sim/engine.ts` (and update `movementTick`'s target selection as shown):

```ts
import { contest } from './contest';
import { dist, GOAL_CENTER_X, PITCH_H, PITCH_W } from './geometry';
import { emit } from './match';

export function goalYFor(team: 0 | 1): number {
  return team === 0 ? 0 : PITCH_H; // team 0 attacks toward y=0
}

export function nearestOpponent(state: MatchState, idx: number): number {
  const me = state.players[idx];
  let best = -1, bestD = Infinity;
  for (let i = 0; i < 22; i++) {
    const o = state.players[i];
    if (o.team === me.team || o.outUntilTick > state.tick) continue;
    const d = dist(o.pos, me.pos);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function bestPassTarget(state: MatchState, from: number): number {
  const me = state.players[from];
  const gy = goalYFor(me.team);
  let best = -1, bestScore = -Infinity;
  for (let i = 0; i < 22; i++) {
    const mate = state.players[i];
    if (i === from || mate.team !== me.team || mate.outUntilTick > state.tick) continue;
    const d = dist(mate.pos, me.pos);
    if (d < 400 || d > 3500) continue;
    const forwardness = Math.abs(mate.pos.y - gy); // smaller = closer to goal
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
      const p = state.players[i];
      if (p.outUntilTick > state.tick) continue;
      if (dist(p.pos, b.pos) < 150) {
        state.ball = { kind: 'held', by: i };
        addGauge(state, i, 8); // touch
        return;
      }
    }
    return;
  }

  if (b.kind !== 'held') return; // 'shot' handled in Task 10
  const carrierIdx = b.by;
  const carrier = state.players[carrierIdx];

  if (state.tick % 5 !== 0) return; // decide every 5 ticks

  const gy = goalYFor(carrier.team);
  const goal = { x: GOAL_CENTER_X, y: gy };
  const toGoal = dist(carrier.pos, goal);
  const marker = nearestOpponent(state, carrierIdx);
  const pressured = marker !== -1 && dist(state.players[marker].pos, carrier.pos) < 400;

  if (toGoal < 2500 && carrier.def.role !== 'GK') {
    attemptShot(state, carrierIdx, toGoal); // defined in Task 10; stub below for now
    return;
  }

  if (pressured || state.rng() < 0.35) {
    const to = bestPassTarget(state, carrierIdx);
    if (to !== -1) {
      const interceptorIdx = nearestOpponent(state, to);
      const interceptStat = interceptorIdx === -1 ? 20 : state.players[interceptorIdx].def.attrs.def;
      const ok = contest(state.rng, carrier.def.attrs.pas, interceptStat, 10);
      emit(state, { t: state.tick, kind: 'PASS', from: carrierIdx, to, ok });
      if (ok) {
        state.ball = { kind: 'held', by: to };
        addGauge(state, to, 8); // touch
      } else if (interceptorIdx !== -1) {
        state.ball = { kind: 'held', by: interceptorIdx };
        addGauge(state, interceptorIdx, 8);
      } else {
        state.ball = { kind: 'loose', pos: { ...carrier.pos }, vel: { x: 0, y: 0 } };
      }
    }
  }
  // else: keep dribbling — movementTick drives the carrier toward goal
}

/** Task 10 replaces this stub with real shooting. */
export function attemptShot(_state: MatchState, _by: number, _distToGoal: number): void {}

/** Task 11 replaces this stub with real gauge logic (heroes only, caps, READY events). */
export function addGauge(_state: MatchState, _idx: number, _amount: number): void {}
```

Update `movementTick` target selection (replace the `const target = ...` line):

```ts
    const isCarrier = state.ball.kind === 'held' && state.ball.by === i;
    const chaseLoose = state.ball.kind === 'loose' && dist(p.pos, ball) < 1500;
    const target = isCarrier
      ? { x: ball.x, y: goalYFor(p.team) === 0 ? Math.max(0, p.pos.y - 800) : Math.min(PITCH_H, p.pos.y + 800) }
      : chaseLoose ? ball
      : anchorFor(p.team, i % 11, ball);
```

In `src/sim/match.ts` `tick()`, after `movementTick(state);` add:

```ts
  possessionTick(state);
```

(Import `possessionTick` from `./engine`.)

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- engine && npm test -- match` → Expected: all pass (skeleton tests still green).

- [ ] **Step 5: Commit**

```bash
git add src/sim/engine.ts src/sim/match.ts src/sim/__tests__/engine.test.ts
git commit -m "feat(sim): possession — carrier decisions, passing with interceptions, loose balls"
```

---

### Task 9: Tackling & knockouts (`engine.ts` v3)

**Files:**
- Modify: `src/sim/engine.ts` (add `tackleTick`; call from `match.ts` after `possessionTick`)
- Modify: `src/sim/match.ts`
- Test: append to `src/sim/__tests__/engine.test.ts`

- [ ] **Step 1: Write the failing test (append to engine.test.ts)**

```ts
describe('tackling', () => {
  it('tackles occur, some won and some lost', () => {
    const r = runMatch(42, ROVERS, UNITED);
    const tackles = r.events.filter(e => e.kind === 'TACKLE') as Array<{ won: boolean }>;
    expect(tackles.length).toBeGreaterThan(5);
    expect(tackles.some(t => t.won)).toBe(true);
    expect(tackles.some(t => !t.won)).toBe(true);
  });

  it('a won tackle transfers possession', () => {
    const r = runMatch(42, ROVERS, UNITED);
    const i = r.events.findIndex(e => e.kind === 'TACKLE' && (e as { won: boolean }).won);
    expect(i).toBeGreaterThan(-1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- engine` → Expected: FAIL — tackles.length = 0.

- [ ] **Step 3: Implement in `engine.ts`**

```ts
export function tackleTick(state: MatchState): void {
  if (state.ball.kind !== 'held') return;
  const carrierIdx = state.ball.by;
  const carrier = state.players[carrierIdx];

  for (let i = 0; i < 22; i++) {
    const d = state.players[i];
    if (d.team === carrier.team || d.outUntilTick > state.tick) continue;
    if (state.tick < d.tackleCooldownUntil) continue;
    if (dist(d.pos, carrier.pos) > 250) continue;
    if (fireSuppressed(state, i, carrierIdx)) continue; // Task 12: FIRE_TORCH aura; stub below

    d.tackleCooldownUntil = state.tick + 10;
    const carrierBonus = dribbleBonus(state, carrierIdx); // Task 12: power bonuses; stub below
    const won = contest(state.rng, d.def.attrs.def, carrier.def.attrs.tec, -carrierBonus);
    emit(state, { t: state.tick, kind: 'TACKLE', by: i, on: carrierIdx, won });
    if (won) {
      state.ball = { kind: 'held', by: i };
      addGauge(state, i, 15); // tackle won
      interruptWindup(state, carrierIdx); // Task 11 implements; stub below
    }
    return; // at most one tackle attempt per tick
  }
}

/** Task 12 replaces: opponents shy away from an active FIRE_TORCH carrier. */
export function fireSuppressed(_state: MatchState, _tackler: number, _carrier: number): boolean {
  return false;
}
/** Task 12 replaces: TEC bonus while SUPER_SPEED is active, etc. */
export function dribbleBonus(_state: MatchState, _carrier: number): number {
  return 0;
}
/** Task 11 replaces: interrupt a winding power on tackle. */
export function interruptWindup(_state: MatchState, _idx: number): void {}
```

In `match.ts` `tick()`, after `possessionTick(state);` add `tackleTick(state);` (import it).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- engine` → Expected: all pass, determinism test still green.

- [ ] **Step 5: Commit**

```bash
git add src/sim/engine.ts src/sim/match.ts src/sim/__tests__/engine.test.ts
git commit -m "feat(sim): tackling with cooldowns, possession turnovers, power stubs"
```

---

### Task 10: Shooting, saves, GK Resolve, goals (`engine.ts` v4)

**Files:**
- Modify: `src/sim/engine.ts` (real `attemptShot`, `shotFlightTick`)
- Modify: `src/sim/match.ts` (call `shotFlightTick`, handle restart after goals)
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
    expect(totalGoals).toBeGreaterThan(15); // avg > 0.5 goals/match
    expect(totalGoals).toBeLessThan(240);   // avg < 8 goals/match
  });

  it('saves deplete GK Resolve', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = runMatch(seed, ROVERS, UNITED);
      const save = r.events.find(e => e.kind === 'SAVE') as { resolveLeft: number } | undefined;
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

Run: `npm test -- shooting` → Expected: FAIL — zero goals (attemptShot is a stub).

- [ ] **Step 3: Implement in `engine.ts`**

Replace the `attemptShot` stub and add `shotFlightTick`:

```ts
export function attemptShot(state: MatchState, by: number, distToGoal: number): void {
  const shooter = state.players[by];
  const gy = goalYFor(shooter.team);
  const spread = 200 + (99 - shooter.def.attrs.sho) * 10;
  const targetX = Math.round(GOAL_CENTER_X + (state.rng() * 2 - 1) * spread);
  const power = Math.max(1, Math.round(shooter.def.attrs.sho + shotBonus(state, by) - distToGoal / 100));
  emit(state, { t: state.tick, kind: 'SHOT', by, power });
  addGauge(state, by, 20); // shot on target credit granted on the attempt
  const dir = gy === 0 ? -1 : 1;
  state.ball = {
    kind: 'shot',
    pos: { ...shooter.pos },
    vel: { x: Math.trunc((targetX - shooter.pos.x) / Math.max(1, distToGoal / 300)), y: 300 * dir },
    by, power, targetX,
  };
}

/** Task 12 replaces: shot power bonuses from powers (none among the M0 three; hook stays). */
export function shotBonus(_state: MatchState, _by: number): number {
  return 0;
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
  const onTarget = Math.abs(b.targetX - GOAL_CENTER_X) <= 700; // GOAL_W / 2

  if (!onTarget) {
    emit(state, { t: state.tick, kind: 'MISS', by: b.by });
    restartKickoff(state, defendingTeam);
    return;
  }

  const gk = state.players[gkIdx];
  const resolveScale = 0.5 + 0.5 * (state.resolve[defendingTeam] / 100);
  const gkEffective = gk.def.attrs.ref * resolveScale;
  const saved = contest(state.rng, gkEffective, b.power);

  if (saved) {
    state.resolve[defendingTeam] = Math.max(0, state.resolve[defendingTeam] - Math.round(b.power / 4));
    emit(state, { t: state.tick, kind: 'SAVE', by: gkIdx, resolveLeft: state.resolve[defendingTeam] });
    addGauge(state, gkIdx, 12); // save
    state.ball = { kind: 'held', by: gkIdx };
  } else {
    state.score[shooter.team]++;
    emit(state, { t: state.tick, kind: 'GOAL', by: b.by, team: shooter.team });
    restartKickoff(state, defendingTeam);
  }
}
```

(`restartKickoff` is imported from `./match` — add it to the existing import.)

In `match.ts` `tick()`, call order becomes:

```ts
  movementTick(state);
  possessionTick(state);
  tackleTick(state);
  shotFlightTick(state);
```

Also in `possessionTick`, the shot branch guard stays as written in Task 8 (`toGoal < 2500 && role !== 'GK'`).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test` → Expected: ALL suites pass (rng, geometry, teams, contest, formation, match, engine, shooting). The 500-match aggregate test should run in well under 30s; if slower, investigate before proceeding (perf smell in the tick loop).

- [ ] **Step 5: Commit**

```bash
git add src/sim/engine.ts src/sim/match.ts src/sim/__tests__/shooting.test.ts
git commit -m "feat(sim): shooting with ball flight, GK saves, Resolve attrition, goals and restarts"
```

---

### Task 11: Hero Gauge, taps, windup, auto-fire (`powers.ts` v1)

**Files:**
- Create: `src/sim/powers.ts`
- Modify: `src/sim/engine.ts` (replace `addGauge` + `interruptWindup` stubs with re-exports)
- Modify: `src/sim/match.ts` (consume `pendingInputs`, call `powerTick`)
- Test: `src/sim/__tests__/powers.test.ts`

Numbers from docs/03 + 04: gauge events touch +8 / tackle won +15 / shot +20 / save +12, trickle 0.02/tick; READY window 80 ticks then auto-fire at strength 0.75; tap = strength 1.0; windup 15 ticks, interruptible (gauge drops to 50).

- [ ] **Step 1: Write the failing test**

```ts
import { createMatch, queueInput, tick } from '../match';
import { ROVERS, UNITED } from '../teams';
import type { MatchState } from '../types';

const HERO = 10; // Zip Vela, SUPER_SPEED

function forceReady(m: MatchState, idx: number): void {
  m.players[idx].gauge = 100;
}

function tickUntil(m: MatchState, pred: () => boolean, max = 400): void {
  for (let i = 0; i < max && !pred(); i++) tick(m);
}

describe('hero gauge and firing', () => {
  it('non-heroes never gain gauge; heroes trickle up', () => {
    const m = createMatch(42, ROVERS, UNITED);
    for (let i = 0; i < 200; i++) tick(m);
    expect(m.players[1].gauge).toBe(0);          // Ed Stone, no power
    expect(m.players[HERO].gauge).toBeGreaterThan(0);
  });

  it('gauge 100 emits POWER_READY', () => {
    const m = createMatch(42, ROVERS, UNITED);
    forceReady(m, HERO);
    tick(m);
    expect(m.events.some(e => e.kind === 'POWER_READY' && (e as { player: number }).player === HERO)).toBe(true);
  });

  it('a tap fires at strength 1.0 after the windup', () => {
    const m = createMatch(42, ROVERS, UNITED);
    forceReady(m, HERO);
    tick(m); // becomes ready
    queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: HERO });
    tickUntil(m, () => m.events.some(e => e.kind === 'POWER_FIRED'));
    const fired = m.events.find(e => e.kind === 'POWER_FIRED') as { strength: number; power: string };
    expect(fired.power).toBe('SUPER_SPEED');
    expect(fired.strength).toBe(1);
    expect(m.players[HERO].gauge).toBe(0);
  });

  it('an ignored READY window auto-fires at strength 0.75 after 80 ticks', () => {
    const m = createMatch(42, ROVERS, UNITED);
    forceReady(m, HERO);
    tickUntil(m, () => m.events.some(e => e.kind === 'POWER_FIRED'), 200);
    const fired = m.events.find(e => e.kind === 'POWER_FIRED') as { strength: number };
    expect(fired.strength).toBe(0.75);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- powers` → Expected: FAIL — gauge stays 0 (stub), no POWER_READY.

- [ ] **Step 3: Implement `powers.ts` v1**

```ts
import { emit } from './match';
import type { MatchState } from './types';

export const READY_WINDOW_TICKS = 80;
export const WINDUP_TICKS = 15;
export const AUTO_FIRE_STRENGTH = 0.75;
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

function startWindup(state: MatchState, idx: number, strength: number): void {
  const p = state.players[idx];
  p.powerState = { kind: 'winding', untilTick: state.tick + WINDUP_TICKS, strength };
}

export function powerTick(state: MatchState): void {
  // 1. consume this tick's inputs
  const due = state.pendingInputs.filter(i => i.tick <= state.tick);
  state.pendingInputs = state.pendingInputs.filter(i => i.tick > state.tick);
  for (const input of due) {
    const p = state.players[input.player];
    if (input.kind === 'POWER_TAP' && p.powerState.kind === 'ready') {
      startWindup(state, input.player, 1.0);
    }
  }

  for (let idx = 0; idx < 22; idx++) {
    const p = state.players[idx];
    if (!p.def.power) continue;

    if (p.powerState.kind === 'idle') {
      addGauge(state, idx, GAUGE_TRICKLE);
    } else if (p.powerState.kind === 'ready') {
      if (state.tick - p.powerState.sinceTick >= READY_WINDOW_TICKS) {
        startWindup(state, idx, AUTO_FIRE_STRENGTH);
      }
    } else if (p.powerState.kind === 'winding') {
      if (state.tick >= p.powerState.untilTick) {
        activatePower(state, idx, p.powerState.strength); // Task 12; stub below
      }
    } else if (p.powerState.kind === 'active') {
      if (state.tick >= p.powerState.untilTick) {
        p.powerState = { kind: 'idle' };
        p.gauge = 0;
      }
    }
  }
}

/** Task 12 replaces with real per-power effects. v1 just flips to a 1-tick active state. */
export function activatePower(state: MatchState, idx: number, strength: number): void {
  const p = state.players[idx];
  emit(state, { t: state.tick, kind: 'POWER_FIRED', player: idx, power: p.def.power!, strength });
  p.powerState = { kind: 'active', untilTick: state.tick + 1, strength };
  p.gauge = 0;
}
```

In `engine.ts`: delete the `addGauge` and `interruptWindup` stubs, replace with:

```ts
export { addGauge, interruptWindup } from './powers';
```

In `match.ts` `tick()`, add `powerTick(state);` as the FIRST call (before `movementTick`), importing from `./powers` — inputs must apply before physics so a tap at tick N affects tick N.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test` → Expected: all suites pass. Note: `powers.ts` imports `emit` from `match.ts` and `match.ts` imports `powerTick` from `powers.ts` — TypeScript handles this circular import because all uses are call-time, not module-init-time. If Jest complains, move `emit` into a new `src/sim/events.ts` and update both importers.

- [ ] **Step 5: Commit**

```bash
git add src/sim/powers.ts src/sim/engine.ts src/sim/match.ts src/sim/__tests__/powers.test.ts
git commit -m "feat(sim): hero gauge, tap inputs, windup with interrupts, auto-fire at 75%"
```

---

### Task 12: The three power effects (`powers.ts` v2)

**Files:**
- Modify: `src/sim/powers.ts` (real `activatePower` + effect queries)
- Modify: `src/sim/engine.ts` (wire `fireSuppressed`, `dribbleBonus`, speed multiplier into stubs)
- Test: append to `src/sim/__tests__/powers.test.ts`

Effect spec (docs/04, at strength `s`): SUPER_SPEED — speed ×2.2, dribble contest +15 TEC, 40 ticks × s. SUPER_STRENGTH — if opposing carrier within 800: steal ball + knock them out 80 ticks × s, else +35 DEF buff 80 ticks × s; 25% yellow / 5% red on fire. FIRE_TORCH — 50 ticks × s active: opponents within 600 won't tackle and fight at −25 DEF; nearest opponent within 800 is IGNITED (out 100 ticks, EXTINGUISHED event on return); 15% yellow.

- [ ] **Step 1: Write the failing test (append to powers.test.ts)**

```ts
import { speedFor } from '../engine';

describe('power effects', () => {
  it('SUPER_SPEED multiplies movement speed while active', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const base = speedFor(m.players[HERO]);
    m.players[HERO].powerState = { kind: 'active', untilTick: m.tick + 40, strength: 1 };
    expect(speedFor(m.players[HERO])).toBe(Math.round(base * 2.2));
  });

  it('FIRE_TORCH ignites the nearest opponent, who is later extinguished', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const torch = 9; // Dario Flint
    m.players[torch].gauge = 100;
    tick(m);
    queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: torch });
    tickUntil(m, () => m.events.some(e => e.kind === 'IGNITED'), 100);
    const ignited = m.events.find(e => e.kind === 'IGNITED') as { player: number };
    expect(ignited.player).toBeGreaterThanOrEqual(11); // an opponent
    tickUntil(m, () => m.events.some(e => e.kind === 'EXTINGUISHED'), 200);
    expect(m.events.some(e => e.kind === 'EXTINGUISHED')).toBe(true);
  });

  it('SUPER_STRENGTH near the carrier steals the ball and knocks them out', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const tank = 3; // Max Tanko
    // put an opposing carrier right next to Tanko
    m.ball = { kind: 'held', by: 20 };
    m.players[20].pos = { ...m.players[tank].pos };
    m.players[tank].gauge = 100;
    tick(m);
    queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: tank });
    tickUntil(m, () => m.events.some(e => e.kind === 'POWER_FIRED'), 50);
    expect(m.players[20].outUntilTick).toBeGreaterThan(m.tick);
    expect(m.ball).toMatchObject({ kind: 'held', by: tank });
  });

  it('cards are possible on aggressive powers across many seeds', () => {
    let sawCard = false;
    for (let seed = 1; seed <= 60 && !sawCard; seed++) {
      const r = runMatch(seed, ROVERS, UNITED);
      sawCard = r.events.some(e => e.kind === 'CARD');
    }
    expect(sawCard).toBe(true);
  });
});
```

(Also add `runMatch` to the existing import from `../match` at the top of the file.)

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- powers` → Expected: FAIL — speed unchanged, no IGNITED events.

- [ ] **Step 3: Implement effects**

In `powers.ts`, replace the v1 `activatePower` and add queries:

```ts
import { dist } from './geometry';

const DUR = { SUPER_SPEED: 40, SUPER_STRENGTH: 80, FIRE_TORCH: 50 } as const;

export function isActive(state: MatchState, idx: number): boolean {
  const ps = state.players[idx].powerState;
  return ps.kind === 'active' && state.tick < ps.untilTick;
}

function rollCard(state: MatchState, idx: number, yellowP: number, redP: number): void {
  const r = state.rng();
  if (r < redP) {
    state.players[idx].cards = 2;
    emit(state, { t: state.tick, kind: 'CARD', player: idx, color: 'red' });
    state.players[idx].outUntilTick = Number.MAX_SAFE_INTEGER; // sent off for the match
  } else if (r < redP + yellowP) {
    state.players[idx].cards = Math.min(2, state.players[idx].cards + 1) as 0 | 1 | 2;
    emit(state, { t: state.tick, kind: 'CARD', player: idx, color: 'yellow' });
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
    let nearest = -1, nearestD = Infinity;
    for (let i = 0; i < 22; i++) {
      const o = state.players[i];
      if (o.team === p.team || o.outUntilTick > state.tick) continue;
      const d = dist(o.pos, p.pos);
      if (d < 800 && d < nearestD) { nearestD = d; nearest = i; }
    }
    if (nearest !== -1) {
      state.players[nearest].outUntilTick = state.tick + 100;
      emit(state, { t: state.tick, kind: 'IGNITED', player: nearest });
    }
  } else if (power === 'SUPER_STRENGTH') {
    rollCard(state, idx, 0.25, 0.05);
    if (state.ball.kind === 'held') {
      const carrierIdx = state.ball.by;
      const carrier = state.players[carrierIdx];
      if (carrier.team !== p.team && dist(carrier.pos, p.pos) < 800 && p.outUntilTick <= state.tick) {
        carrier.outUntilTick = state.tick + Math.round(80 * strength);
        state.ball = { kind: 'held', by: idx };
        emit(state, { t: state.tick, kind: 'TACKLE', by: idx, on: carrierIdx, won: true });
      }
    }
  }
  // SUPER_SPEED needs no immediate effect — its queries below do the work.
}

export function speedMultiplier(state: MatchState, idx: number): number {
  const p = state.players[idx];
  return isActive(state, idx) && p.def.power === 'SUPER_SPEED' ? 2.2 : 1;
}

export function dribbleBonus(state: MatchState, carrierIdx: number): number {
  const p = state.players[carrierIdx];
  if (!isActive(state, carrierIdx)) return 0;
  if (p.def.power === 'SUPER_SPEED') return 15;
  if (p.def.power === 'FIRE_TORCH') return 25; // opponents fight the flames at an equivalent penalty
  return 0;
}

export function fireSuppressed(state: MatchState, _tacklerIdx: number, carrierIdx: number): boolean {
  const c = state.players[carrierIdx];
  return isActive(state, carrierIdx) && c.def.power === 'FIRE_TORCH';
}

export function defenseBonus(state: MatchState, idx: number): number {
  const p = state.players[idx];
  return isActive(state, idx) && p.def.power === 'SUPER_STRENGTH' ? 35 : 0;
}
```

In `engine.ts`:
- Delete the `fireSuppressed` and `dribbleBonus` stubs; re-export from powers: `export { fireSuppressed, dribbleBonus, defenseBonus } from './powers';`
- In `speedFor`, multiply by the power: change the return to
  `return Math.round((40 + p.def.attrs.pac) * conditionScale * mult);` where the function now takes the multiplier via a second optional param `mult = 1`, and `movementTick` calls `speedFor(p, speedMultiplier(state, i))` (import `speedMultiplier` from `./powers`).
- In `tackleTick`, change the tackler's stat to `d.def.attrs.def + defenseBonus(state, i)`.

Also — EXTINGUISHED emission: in `movementTick`, when skipping an out player, detect recovery:

```ts
    if (p.outUntilTick > state.tick) continue;
    if (p.outUntilTick !== 0 && p.outUntilTick <= state.tick) {
      if (p.outUntilTick !== Number.MAX_SAFE_INTEGER) emit(state, { t: state.tick, kind: 'EXTINGUISHED', player: i });
      p.outUntilTick = 0;
    }
```

Note: EXTINGUISHED doubles as the generic "back on their feet" event in M0 (renderer shows the ref-with-extinguisher gag only for previously IGNITED players — the renderer correlates by player index).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test` → Expected: all suites pass, including the older determinism tests (power logic consumes rng only through `state.rng`).

- [ ] **Step 5: Commit**

```bash
git add src/sim/powers.ts src/sim/engine.ts src/sim/__tests__/powers.test.ts
git commit -m "feat(sim): SUPER_SPEED, SUPER_STRENGTH, FIRE_TORCH effects with cards and ignition"
```

---

### Task 13: Parity, divergence, golden replay, balance smoke

**Files:**
- Test: `src/sim/__tests__/parity.test.ts`

- [ ] **Step 1: Write the tests (these should pass immediately if Tasks 7–12 are correct — they are the M0 acceptance gate, not TDD)**

```ts
import { runMatch } from '../match';
import { ROVERS, UNITED } from '../teams';
import type { MatchInput } from '../types';

describe('M0 acceptance: determinism contract', () => {
  it('PARITY: zero-input runs are byte-identical (watched-no-taps == Quick Result)', () => {
    const a = runMatch(42, ROVERS, UNITED);
    const b = runMatch(42, ROVERS, UNITED);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('DIVERGENCE: a tap input changes the match (inputs are real)', () => {
    const base = runMatch(42, ROVERS, UNITED);
    const ready = base.events.find(e => e.kind === 'POWER_READY') as { t: number; player: number } | undefined;
    expect(ready).toBeDefined();
    const taps: MatchInput[] = [{ tick: ready!.t + 1, kind: 'POWER_TAP', player: ready!.player }];
    const tapped = runMatch(42, ROVERS, UNITED, taps);
    expect(JSON.stringify(tapped.events)).not.toBe(JSON.stringify(base.events));
  });

  it('GOLDEN REPLAY: seed 42 event stream is locked (bump snapshot consciously)', () => {
    const r = runMatch(42, ROVERS, UNITED);
    expect({ score: r.score, eventKinds: r.events.map(e => `${e.t}:${e.kind}`) }).toMatchSnapshot();
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

Run: `npm test -- parity`
Expected: 4 passed (a `__snapshots__/parity.test.ts.snap` file is created). If DIVERGENCE fails, the input path is broken — that invalidates the whole design promise; debug with the systematic-debugging skill before touching anything else.

- [ ] **Step 3: Commit (including the snapshot)**

```bash
git add src/sim/__tests__/parity.test.ts src/sim/__tests__/__snapshots__
git commit -m "test(sim): M0 acceptance — parity, tap divergence, golden replay, balance smoke"
```

---

### Task 14: Skia renderer — match screen with HUD and tap-to-fire

**Files:**
- Create: `src/render/interpolate.ts`, `src/render/atlas.ts`, `src/render/MatchScreen.tsx`
- Modify: `App.tsx`
- Test: `src/render/__tests__/interpolate.test.ts` (pure math only; visuals verified on-device in Step 5)

- [ ] **Step 1: Install rendering deps**

```bash
npx expo install @shopify/react-native-skia react-native-reanimated react-native-worklets
```

Add the Reanimated plugin: ensure `babel.config.js` plugins array ends with `'react-native-worklets/plugin'` (Reanimated v4's plugin now lives in the worklets package; verify against the installed version's README if babel errors).

- [ ] **Step 2: TDD the interpolation math**

`src/render/__tests__/interpolate.test.ts`:

```ts
import { lerpVec, snapshotPositions } from '../interpolate';
import { createMatch, tick } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';

describe('interpolate', () => {
  it('lerpVec blends between two points', () => {
    expect(lerpVec({ x: 0, y: 0 }, { x: 100, y: 200 }, 0.5)).toEqual({ x: 50, y: 100 });
    expect(lerpVec({ x: 0, y: 0 }, { x: 100, y: 200 }, 0)).toEqual({ x: 0, y: 0 });
    expect(lerpVec({ x: 0, y: 0 }, { x: 100, y: 200 }, 1)).toEqual({ x: 100, y: 200 });
  });

  it('snapshotPositions captures 22 players + ball', () => {
    const m = createMatch(42, ROVERS, UNITED);
    tick(m);
    const s = snapshotPositions(m);
    expect(s.players).toHaveLength(22);
    expect(s.ball).toBeDefined();
  });
});
```

Run: `npm test -- interpolate` → FAIL. Then implement `src/render/interpolate.ts`:

```ts
import type { MatchState } from '../sim/types';
import { ballPos } from '../sim/engine';
import type { Vec } from '../sim/geometry';

export interface PitchSnapshot { players: Vec[]; ball: Vec; }

export function lerpVec(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function snapshotPositions(state: MatchState): PitchSnapshot {
  return { players: state.players.map(p => ({ ...p.pos })), ball: ballPos(state) };
}

export function lerpSnapshot(prev: PitchSnapshot, next: PitchSnapshot, t: number): PitchSnapshot {
  return {
    players: prev.players.map((p, i) => lerpVec(p, next.players[i], t)),
    ball: lerpVec(prev.ball, next.ball, t),
  };
}
```

Run: `npm test -- interpolate` → PASS.

- [ ] **Step 3: Placeholder atlas + MatchScreen**

`src/render/atlas.ts` — one tiny texture, every sprite is a tinted rect from it:

```ts
import { Skia, rect } from '@shopify/react-native-skia';

export const SPRITE = 16; // px cell in the placeholder texture

/** A 16x16 white square drawn once; Atlas tints it per sprite via colors[]. */
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

`src/render/MatchScreen.tsx` (complete file):

```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Atlas, Canvas, Circle, Fill, Skia, useRSXformBuffer, useRectBuffer } from '@shopify/react-native-skia';
import { createMatch, queueInput, tick } from '../sim/match';
import { ROVERS, UNITED } from '../sim/teams';
import { PITCH_W, PITCH_H, TICK_MS } from '../sim/geometry';
import type { MatchEvent, MatchState } from '../sim/types';
import { lerpSnapshot, snapshotPositions, type PitchSnapshot } from './interpolate';
import { makePlaceholderTexture, SPRITE } from './atlas';

const HERO_SLOTS = [3, 9, 10]; // Rovers heroes: Tanko, Flint, Vela

export function MatchScreen({ seed, onDone }: { seed: number; onDone: (state: MatchState) => void }) {
  const { width } = useWindowDimensions();
  const scale = width / PITCH_W;
  const pitchH = PITCH_H * scale;

  const stateRef = useRef<MatchState>(createMatch(seed, ROVERS, UNITED));
  const prevSnapRef = useRef<PitchSnapshot>(snapshotPositions(stateRef.current));
  const nextSnapRef = useRef<PitchSnapshot>(snapshotPositions(stateRef.current));
  const [frame, setFrame] = useState<PitchSnapshot>(prevSnapRef.current);
  const [hud, setHud] = useState({ score: [0, 0] as [number, number], tick: 0, gauges: [0, 0, 0], banner: '' });
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);
  speedRef.current = speed;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const s = stateRef.current;
      acc += (now - last) * speedRef.current;
      last = now;
      while (acc >= TICK_MS && s.phase !== 'fulltime') {
        prevSnapRef.current = nextSnapRef.current;
        tick(s);
        nextSnapRef.current = snapshotPositions(s);
        acc -= TICK_MS;
      }
      setFrame(lerpSnapshot(prevSnapRef.current, nextSnapRef.current, Math.min(1, acc / TICK_MS)));
      const recent = s.events.slice(-6);
      const fired = recent.find((e): e is Extract<MatchEvent, { kind: 'POWER_FIRED' }> => e.kind === 'POWER_FIRED');
      setHud({
        score: [...s.score] as [number, number],
        tick: s.tick,
        gauges: HERO_SLOTS.map(i => Math.round(s.players[i].gauge)),
        banner: fired ? `${fired.power.replace('_', ' ')} — ${s.players[fired.player].def.name}` : '',
      });
      if (s.phase === 'fulltime') { onDone(s); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  const texture = useMemo(() => makePlaceholderTexture(), []);
  const N = 22;
  const sprites = useRectBuffer(N, (r) => r.setXYWH(0, 0, SPRITE, SPRITE));
  const transforms = useRSXformBuffer(N, (f, i) => {
    const p = frame.players[i];
    f.set(scale * 40, 0, p.x * scale - 8, p.y * scale - 8);
  });
  const colors = useMemo(
    () => frame.players.map((_, i) => {
      const sp = stateRef.current.players[i];
      if (sp.outUntilTick > stateRef.current.tick) return Skia.Color('#666666');
      if (HERO_SLOTS.includes(i) && sp.powerState.kind !== 'idle') return Skia.Color('#f5c518');
      return Skia.Color(i < 11 ? '#e8433f' : '#3f6fd8');
    }),
    [frame],
  );

  const minute = Math.min(90, Math.ceil((hud.tick / 2000) * 90));

  return (
    <View style={styles.root}>
      <View style={styles.scorebar}>
        <Text style={styles.scoreText}>ROV {hud.score[0]} – {hud.score[1]} UNI · {minute}'</Text>
        <Pressable onPress={() => setSpeed(s => (s === 1 ? 2 : 1))}>
          <Text style={styles.speedText}>×{speed}</Text>
        </Pressable>
      </View>
      <Canvas style={{ width, height: pitchH }}>
        <Fill color="#2e7d3a" />
        <Atlas image={texture} sprites={sprites} transforms={transforms} colors={colors} />
        <Circle cx={frame.ball.x * scale} cy={frame.ball.y * scale} r={5} color="white" />
      </Canvas>
      {hud.banner ? <Text style={styles.banner}>⚡ {hud.banner}</Text> : null}
      <View style={styles.chips}>
        {HERO_SLOTS.map((slot, i) => {
          const ready = stateRef.current.players[slot].powerState.kind === 'ready';
          return (
            <Pressable
              key={slot}
              style={[styles.chip, ready && styles.chipReady]}
              onPress={() => queueInput(stateRef.current, { tick: stateRef.current.tick + 1, kind: 'POWER_TAP', player: slot })}
            >
              <Text style={styles.chipName}>{ROVERS.players[slot].name.split(' ')[1]}</Text>
              <View style={styles.gaugeTrack}><View style={[styles.gaugeFill, { width: `${hud.gauges[i]}%` }]} /></View>
            </Pressable>
          );
        })}
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
  chipName: { color: 'white', fontSize: 14, marginBottom: 6 },
  gaugeTrack: { width: 72, height: 8, backgroundColor: '#0a0e12', borderRadius: 4, overflow: 'hidden' },
  gaugeFill: { height: 8, backgroundColor: '#f5c518' },
});
```

- [ ] **Step 4: Home screen + Quick Result in `App.tsx` (complete file)**

```tsx
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MatchScreen } from './src/render/MatchScreen';
import { runMatch } from './src/sim/match';
import { ROVERS, UNITED } from './src/sim/teams';
import type { MatchState } from './src/sim/types';

type Screen = 'home' | 'match';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [seed, setSeed] = useState(42);
  const [result, setResult] = useState<string | null>(null);

  const finishWatched = (s: MatchState) => {
    setResult(`Watched · ROV ${s.score[0]} – ${s.score[1]} UNI (seed ${seed})`);
    setScreen('home');
  };

  const quickResult = () => {
    const r = runMatch(seed, ROVERS, UNITED);
    setResult(`Quick · ROV ${r.score[0]} – ${r.score[1]} UNI (seed ${seed})`);
  };

  if (screen === 'match') return <MatchScreen seed={seed} onDone={finishWatched} />;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Hero Football Manager — M0</Text>
      <Text style={styles.seed}>Seed: {seed}</Text>
      {result ? <Text style={styles.result}>{result}</Text> : null}
      <Pressable style={styles.btn} onPress={() => setScreen('match')}><Text style={styles.btnText}>Watch match</Text></Pressable>
      <Pressable style={styles.btn} onPress={quickResult}><Text style={styles.btnText}>Quick result</Text></Pressable>
      <Pressable style={styles.btn} onPress={() => setSeed(s => s + 1)}><Text style={styles.btnText}>New seed</Text></Pressable>
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

- [ ] **Step 5: Manual verification on simulator**

Run: `npx tsc --noEmit` → clean. Then `npx expo start --ios` (or scan with Expo Go on device).

Checklist — all must hold:
- [ ] Match plays: red vs blue rects move, ball travels, score updates, clock counts to 90'.
- [ ] Hero chips fill gold; a full chip highlights; tapping it fires within ~1.5s and the banner names the power.
- [ ] Fire Torch turns one blue player gray (out) for ~10 in-game seconds.
- [ ] ×2 speed visibly doubles pace; match ends and returns to home with the score.
- [ ] Quick Result with the same seed and zero taps equals the score you get watching without tapping (spot-check one seed).

- [ ] **Step 6: Commit**

```bash
git add App.tsx src/render babel.config.js package.json package-lock.json app.json
git commit -m "feat(render): Skia Atlas match screen with hero chips, tap-to-fire, quick result"
```

---

### Task 15: Stress screen + M0 wrap-up

**Files:**
- Create: `src/render/StressScreen.tsx`
- Modify: `App.tsx` (third button), `README.md` (run instructions)

- [ ] **Step 1: Stress screen (complete file)**

```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Atlas, Canvas, Fill, Skia, useRSXformBuffer, useRectBuffer } from '@shopify/react-native-skia';
import { makePlaceholderTexture, SPRITE } from './atlas';
import { mulberry32 } from '../sim/rng';

const N = 2000;

export function StressScreen() {
  const { width, height } = useWindowDimensions();
  const [fps, setFps] = useState(0);
  const tRef = useRef(0);

  const seeds = useMemo(() => {
    const rng = mulberry32(1);
    return Array.from({ length: N }, () => ({ x: rng() * width, y: rng() * height, vx: rng() * 4 - 2, vy: rng() * 4 - 2 }));
  }, [width, height]);

  const [, force] = useState(0);
  useEffect(() => {
    let raf = 0, frames = 0, windowStart = performance.now();
    const loop = () => {
      tRef.current += 1;
      frames++;
      const now = performance.now();
      if (now - windowStart >= 1000) {
        setFps(Math.round((frames * 1000) / (now - windowStart)));
        frames = 0; windowStart = now;
      }
      force(f => f + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const texture = useMemo(() => makePlaceholderTexture(), []);
  const sprites = useRectBuffer(N, (r) => r.setXYWH(0, 0, SPRITE, SPRITE));
  const transforms = useRSXformBuffer(N, (f, i) => {
    const s = seeds[i];
    const t = tRef.current;
    f.set(0.6, 0, (s.x + s.vx * t) % width, (s.y + s.vy * t + height) % height);
  });
  const colors = useMemo(() => seeds.map((_, i) => Skia.Color(i % 2 ? '#e8433f' : '#3f6fd8')), [seeds]);

  return (
    <View style={styles.root}>
      <Canvas style={{ width, height: height - 120 }}>
        <Fill color="#101418" />
        <Atlas image={texture} sprites={sprites} transforms={transforms} colors={colors} />
      </Canvas>
      <Text style={styles.fps}>{N} sprites · {fps} fps</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101418' },
  fps: { color: '#f5c518', fontSize: 20, textAlign: 'center', padding: 24, fontVariant: ['tabular-nums'] },
});
```

Wire into `App.tsx`: extend `type Screen = 'home' | 'match' | 'stress';`, render `<StressScreen />` when `screen === 'stress'`, add a fourth home button `Stress test` setting it. (Add a back gesture note: shake → reload is acceptable for M0 dev.)

- [ ] **Step 2: Device checks**

- iOS simulator + your iPhone: expect a solid 60 fps at 2,000 sprites.
- Budget/mid Android (research risk #1 — the whole point of this screen): if fps < 55 at 2,000, reduce N until stable and record the ceiling in README; the match needs only ~25 so anything ≥ 500 is a comfortable pass. If even 500 struggles, STOP and investigate Atlas usage (per-sprite components creeping in is the known trap).

- [ ] **Step 3: Update README run instructions**

Append to `README.md`:

```markdown
## Running the M0 prototype

- `npm test` — sim test suite (deterministic core, powers, acceptance)
- `npx expo start --ios` — home screen: Watch match / Quick result / New seed / Stress test
- M0 renders placeholder shapes by design; art arrives in M1. Fun-gate checklist lives in docs/10-roadmap.md.
```

- [ ] **Step 4: Full-suite verification**

Run: `npm test` → all pass. Run: `npx tsc --noEmit` → clean. Run: `npm run lint:fix` if a lint script exists (the blank template ships none — skip if absent, do NOT add tooling in M0).

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(render): 2000-sprite Atlas stress screen and M0 run instructions"
```

---

## Self-review (performed at plan-writing time)

- **Spec coverage vs. M0 (docs/10):** sim core with 2 hardcoded teams ✓ (Tasks 4–10), seeded determinism ✓ (Tasks 2, 7, 13), Atlas renderer + budget-Android stress ✓ (Tasks 14–15), 3 powers with gauge/tap/auto-fire ✓ (Tasks 11–12), parity + divergence test ✓ (Task 13). Fun-gate playtest itself is a human step after Task 15 — deliberately not a plan task.
- **Placeholder scan:** the only stubs are explicitly labeled forward-references (`attemptShot` Task 8→10, `addGauge`/`interruptWindup` Task 8/9→11, `fireSuppressed`/`dribbleBonus`/`shotBonus` Task 9/10→12), each replaced by a named later task. No TBDs.
- **Type consistency:** event names, `PowerState` variants, `outUntilTick`, `queueInput`, gauge numbers (8/15/20/12, 0.02 trickle, 80-tick window, 0.75 auto, 15-tick windup) match docs/03–04 and are used identically across tasks.
- **Known judgment calls for the reviewer:** (1) `emit` lives in `match.ts`, creating a benign circular import with `powers.ts` — Task 11 documents the `events.ts` escape hatch. (2) Renderer drives sim on the JS thread with per-frame `setState` — acceptable at 22 sprites for M0, flagged for worklet-driven transforms in M1. (3) Shot flight uses simplified straight-line travel with pre-rolled aim; fine for placeholder feel. (4) `structuredClone` in tests requires Node 17+ (any current Node qualifies).
