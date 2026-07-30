# Attack-vs-Defense Training Leverage (m2.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink the measured defense-over-attack training-leverage gap (REF ≈ 1.9×, DEF ≈ 1.7× the points value of SHO per equal log-gain) to ≤ 1.35× by routing more chances to standout finishers — no hidden rating curves, no drill-price changes.

**Architecture:** A goal chain multiplies P(chance created) × P(on target) × P(beat keeper). The defending keeper's REF sits in the last factors of *every* opposing chain, while one striker's SHO only touches his own ~40% shot share — so per-point leverage skews defensive by roughly 1/share (measured 2026-07-30: +24 REF prevented 0.88 goals/match, +24 SHO added 0.36, mirrored teams, equal 62→86 baselines). The fix raises the striker's share inside `bestPassOption` via a new selection seam, `selectRoutedPassTarget`: every candidate keeps its **unboosted** expected value; the returned `PassOption.gateValue` is the **maximum unboosted value** — for any fixed state that is bit-identical to what m2.0's action gate compared against shoot/carry, so **the per-decision pass gate is unchanged** (aggregate passes per match can still drift through changed recipients and downstream states, which is why match volume is bounded against recorded m2.0 absolutes). The routing boost — `finisherRoutingBoost` on the **teammate-relative** receiver-vs-passer SHO contest, deliberately independent of the opposing keeper — only redirects the *recipient*, only among candidates within `ROUTING_VALUE_TOLERANCE` of that maximum, and not at all when the best value is non-positive (those decisions keep m2.0's exact pick, tie order included). Goalkeepers are ineligible on both ends via the pure `finisherRoutingApplies` helper, and a GK passer never even reads its own SHO. Contest math stays untouched, ratings never lie (the m2.0 honesty rule), and on screen it reads as "the team feeds its star." Replay-affecting ⇒ `ENGINE_VERSION` m2.0 → m2.1 + golden rebaselines — but only **after** the sweep proves the target reachable AND the full CI rail (authored during the gate) runs green pre-bless; a failed sweep reverts the wiring and stops for an owner decision with nothing blessed. A permanent leverage probe plus the CI rail (seeds disjoint from the gain-sweep window — they participate in acceptance, so they are validation data, not untouched data) keep the ratio and the behavior envelope measured forever.

**Explicitly rejected levers** (tiebreak 2026-07-30, memory `gk-training-leverage-measured`, plan-review rounds 1–3): repricing/nerfing keeper drills (wrong layer; DEF drills are statistically as strong, meta just shifts to Duels); raising `DIVISION_GOALKEEPER_REF_RATINGS` (makes SHO training *worse*); compressing defensive contest slopes (re-creates the hidden-curve dishonesty m1.28→m2.0 deliberately removed — an owner-level trade-off only, alongside the gentler owner dials of raising `ROUTING_VALUE_TOLERANCE` or `FINISHER_ROUTING_CAP`); coupling the routing boost to opposing keeper REF (round 1 — logistic compression means high REF would shrink the opponent's routing edge, handing REF a second defensive channel); boosting the gate value itself (round 2 — a routed target with a lower unboosted value would leak into the pass-vs-shoot/carry gate and change per-decision behavior).

**Tech Stack:** Pure-TS sim (`src/sim/`, no RN/Expo imports, seeded PRNG only), Jest probes via `npm run test:probe`, deterministic fixed-seed rails.

**Measured baseline (2026-07-30, 600 matches/arm, mirrored ROVERS, FIRE_WHEN_READY both sides, seeds 1–300; power-on measurement — superseded by the power-free re-baseline below):**

| Arm | pts/match | GF | GA | Δpts vs base |
|---|---:|---:|---:|---:|
| BASE mirror | 1.375 | 1.590 | 1.590 | — |
| +24 REF (GK, 62→86) | 1.948 | 1.512 | 0.707 | +0.573 |
| +24 DEF (CB, 64→88) | 1.882 | 1.620 | 0.957 | +0.507 |
| +24 SHO (FWD, 62→86) | 1.678 | 1.953 | 1.548 | +0.303 |

Leverage ratios (power-on measurement; superseded by the power-free re-baseline below): REF/SHO = **1.89**, DEF/SHO = **1.67**.

**Power-free re-baseline (2026-07-30, 600 matches/arm, mirrored ROVERS with FIRE_TORCH/SUPER_SPEED stripped, FIRE_WHEN_READY both sides, seeds 1–300).** Stripping the striker's live power reversed the sign: with the SHO arm no longer getting a self-reinforcing power-proc bonus on top of the raw attribute gain, SHO leverage is now *higher* than REF/DEF, not lower. Cells not printed by the probe for a given arm (it only logs GA for REF/DEF and GF for SHO) are marked `—`; BASE's GA is inferred equal to its GF by mirror symmetry, matching the convention of the power-on table above:

| Arm | pts/match | GF | GA | Δpts vs base |
|---|---:|---:|---:|---:|
| BASE mirror | 1.323 | 0.962 | 0.962 | — |
| +24 REF (GK, 62→86) | 1.918 | — | 0.292 | +0.595 |
| +24 DEF (CB, 64→88) | 1.885 | — | 0.425 | +0.562 |
| +24 SHO (FWD, 62→86) | 2.063 | 1.950 | — | +0.740 |

Leverage ratios: REF/SHO = **0.80**, DEF/SHO = **0.76**. Target after m2.1: **both ≤ 1.35** on the tuning window (seeds 1–300) AND the held-out window (1001–1300), and the full CI rail (seeds 2001–2150, bounds ≤ 1.45) green, with all existing balance rails green.

---

## File Structure

- Create: `src/audit/__tests__/training-leverage-probe.test.ts` — permanent opt-in probe (excluded from CI by the `*-probe.test.ts` jest ignore pattern); env-tunable seed window/count; prints pts/arm, leverage ratios, striker shot share, and passes/shots per match.
- Create: `src/sim/__tests__/finisher-routing.test.ts` — unit tests for `finisherRoutingBoost`, `finisherRoutingApplies`, and `selectRoutedPassTarget` + integration tests (GK post-save distribution invariance via `possessionTick`, calibrated routing flip).
- Create: `src/sim/__tests__/training-leverage-rails.test.ts` — deterministic CI rail on seeds 2001–2150 (disjoint from the gain sweep; authored and run during Task 3's gate, committed in Task 4) asserting leverage ≤ 1.45, absolute pass/shot volume vs recorded m2.0 baselines, and striker-share monotonicity.
- Modify: `src/sim/engine.ts` — add `FINISHER_ROUTING_GAIN`, `ROUTING_VALUE_TOLERANCE`, `finisherRoutingBoost`, `finisherRoutingApplies`, `RoutedPassCandidate`, `selectRoutedPassTarget`; rename `PassOption.value` → `PassOption.gateValue` (consumers: `attackingDecision` at ~engine.ts:1001 only); rework `bestPassOption` (~line 939) to build candidates and delegate.
- Modify: `src/sim/match.ts:26` — `ENGINE_VERSION` `'m2.0'` → `'m2.1'` with an explanation comment (Task 4 only, after the gate).
- Modify: `src/sim/runtime-golden.ts` — new `EXPECTED_RUNTIME_GOLDEN` hash + rebaseline comment.
- Regenerate: `src/sim/__tests__/__snapshots__/parity-replay.test.ts.snap` (via `jest -u`, only after the version decision — never before; diff must be inspected, not rubber-stamped).
- Modify: `docs/03-match-engine.md` — finisher-routing paragraph; the "unused filler" sentence at docs/03-match-engine.md:36 is **replaced** (the old wording would contradict the new mechanics note).
- Modify: `README.md` — decision-log entry AND the `Current engine: **m2.0**` marker at README.md:16 (the suite enforces it).

---

### Task 0: Isolated worktree + commit this plan

The primary checkout is usually dirty with unrelated render/UI work (see memory `hfm-concurrent-worktrees`) — never build this there. This plan document itself is untracked in the primary checkout, so the fresh worktree will NOT contain it until committed.

- [ ] **Step 1: Create the worktree and branch from origin/main**

```bash
git -C /Users/joemacprom5/Documents/Vibecode/Hero_Football_Manager fetch origin
git -C /Users/joemacprom5/Documents/Vibecode/Hero_Football_Manager worktree add \
  ../hfm-leverage-m2.1 -b balance/attack-defense-leverage-m2.1 origin/main
cd /Users/joemacprom5/Documents/Vibecode/hfm-leverage-m2.1 && npm install
```

- [ ] **Step 2: Bring the plan into the branch and commit it**

```bash
cp /Users/joemacprom5/Documents/Vibecode/Hero_Football_Manager/docs/superpowers/plans/2026-07-30-attack-defense-training-leverage.md \
   docs/superpowers/plans/2026-07-30-attack-defense-training-leverage.md
git add docs/superpowers/plans/2026-07-30-attack-defense-training-leverage.md
git commit -m "docs: plan for m2.1 attack-vs-defense training leverage"
```

All later tasks run inside `hfm-leverage-m2.1`. Finish via PR — main is often locked by the primary worktree; never merge locally.

---

### Task 1: Permanent training-leverage probe + m2.0 baselines on ALL THREE windows

**Files:**
- Create: `src/audit/__tests__/training-leverage-probe.test.ts`

- [ ] **Step 1: Write the probe** (measurement script, not a TDD unit — it must pass immediately and print numbers)

```ts
/**
 * SCRATCH PROBE (not a gate): measures training leverage — the points value of
 * +24 to one defensive stat vs +24 to one attacking stat at equal log-ratio
 * baselines (Sam Mitts REF 62, Dario Flint SHO 62). Mirrored ROVERS remove
 * roster asymmetry; FIRE_WHEN_READY removes the manual-vs-auto policy skew.
 *
 * Run:      npm run test:probe -- src/audit/__tests__/training-leverage-probe.test.ts
 * Held-out: LEVERAGE_SEED_START=1001 npm run test:probe -- src/audit/__tests__/training-leverage-probe.test.ts
 * Rail win: LEVERAGE_SEED_START=2001 LEVERAGE_SEEDS=150 npm run test:probe -- ...
 *
 * Baseline (m2.0, 2026-07-30, seeds 1-300, powers ON — superseded, kept for
 * history): REF/SHO 1.89, DEF/SHO 1.67.
 * Baseline (m2.0, 2026-07-30, seeds 1-300, power-free re-baseline): REF/SHO
 * 0.80, DEF/SHO 0.76 — see
 * docs/superpowers/plans/2026-07-30-attack-defense-training-leverage.md
 */
import { runMatch } from '../../sim/match';
import { ROVERS } from '../../sim/teams';
import type { PowerId, TeamDef } from '../../sim/types';

const POLICIES = {
  homePolicy: 'FIRE_WHEN_READY' as const,
  awayPolicy: 'FIRE_WHEN_READY' as const,
};

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${name} must be a positive integer, got ${JSON.stringify(raw)}`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a safe positive integer, got ${JSON.stringify(raw)}`);
  }
  return value;
}
const SEEDS = positiveIntegerEnv('LEVERAGE_SEEDS', 300);
const SEED_START = positiveIntegerEnv('LEVERAGE_SEED_START', 1);

type MutableTeam = TeamDef & { players: Array<{ id: string; attrs: Record<string, number>; power?: PowerId }> };

function mirror(tag: string): TeamDef {
  const team = structuredClone(ROVERS) as MutableTeam;
  team.id = `${ROVERS.id}-${tag}`;
  team.name = `${ROVERS.name} ${tag}`;
  for (const player of team.players) {
    player.id = `${player.id}-${tag}`;
    // Powers stripped so the arms measure bare stat leverage (repo probe convention).
    player.power = undefined;
  }
  return team;
}

function boosted(playerIdx: number, stat: 'ref' | 'sho' | 'def', delta: number): TeamDef {
  const team = mirror('a') as MutableTeam;
  team.players[playerIdx].attrs[stat] += delta;
  return team;
}

interface ArmResult {
  readonly pts: number;
  readonly gf: number;
  readonly ga: number;
  readonly passes: number;
  readonly shots: number;
  readonly trackedShotShare: number;
}

/** trackIdx: squad index on team A whose share of team-A shots is reported. */
function measure(teamA: TeamDef, trackIdx: number): ArmResult {
  const teamB = mirror('b');
  let pts = 0, gf = 0, ga = 0, teamShots = 0, trackedShots = 0, teamPasses = 0;
  for (let seed = SEED_START; seed < SEED_START + SEEDS; seed++) {
    const home = runMatch(seed, teamA, teamB, [], POLICIES);
    const away = runMatch(seed, teamB, teamA, [], POLICIES);
    for (const [aGoals, bGoals] of [
      [home.score[0], home.score[1]],
      [away.score[1], away.score[0]],
    ]) {
      gf += aGoals;
      ga += bGoals;
      pts += aGoals > bGoals ? 3 : aGoals === bGoals ? 1 : 0;
    }
    // Team A occupies indices 0-10 at home and 11-21 away.
    teamShots += home.events.filter(e => e.kind === 'SHOT' && e.by < 11).length;
    teamShots += away.events.filter(e => e.kind === 'SHOT' && e.by >= 11).length;
    trackedShots += home.events.filter(e => e.kind === 'SHOT' && e.by === trackIdx).length;
    trackedShots += away.events.filter(e => e.kind === 'SHOT' && e.by === trackIdx + 11).length;
    teamPasses += home.events.filter(e => e.kind === 'PASS' && e.from < 11).length;
    teamPasses += away.events.filter(e => e.kind === 'PASS' && e.from >= 11).length;
  }
  const matches = SEEDS * 2;
  return {
    pts: pts / matches,
    gf: gf / matches,
    ga: ga / matches,
    passes: teamPasses / matches,
    shots: teamShots / matches,
    trackedShotShare: teamShots === 0 ? 0 : trackedShots / teamShots,
  };
}

describe('training leverage probe', () => {
  it('measures REF/DEF/SHO leverage, striker share, and volume', () => {
    const base = measure(mirror('a'), 9);
    const ref = measure(boosted(0, 'ref', 24), 9);
    const def = measure(boosted(3, 'def', 24), 9);
    const sho = measure(boosted(9, 'sho', 24), 9);
    const refLift = ref.pts - base.pts;
    const defLift = def.pts - base.pts;
    const shoLift = sho.pts - base.pts;
    console.log(`LEVERAGE seeds=${SEED_START}..${SEED_START + SEEDS - 1}`);
    console.log(`LEVERAGE base: pts=${base.pts.toFixed(3)} GF=${base.gf.toFixed(3)} passes=${base.passes.toFixed(1)} shots=${base.shots.toFixed(1)} strikerShare=${(base.trackedShotShare * 100).toFixed(1)}%`);
    console.log(`LEVERAGE REF+24: pts=${ref.pts.toFixed(3)} GA=${ref.ga.toFixed(3)} lift=${refLift.toFixed(3)}`);
    console.log(`LEVERAGE DEF+24: pts=${def.pts.toFixed(3)} GA=${def.ga.toFixed(3)} lift=${defLift.toFixed(3)}`);
    console.log(`LEVERAGE SHO+24: pts=${sho.pts.toFixed(3)} GF=${sho.gf.toFixed(3)} lift=${shoLift.toFixed(3)} passes=${sho.passes.toFixed(1)} shots=${sho.shots.toFixed(1)} strikerShare=${(sho.trackedShotShare * 100).toFixed(1)}%`);
    console.log(`LEVERAGE ratios: REF/SHO=${(refLift / shoLift).toFixed(2)} DEF/SHO=${(defLift / shoLift).toFixed(2)}`);
    expect(shoLift).toBeGreaterThan(0);
    expect(refLift).toBeGreaterThan(0);
    expect(defLift).toBeGreaterThan(0);
  }, 1200000);
});
```

- [ ] **Step 2: Record m2.0 baselines on ALL THREE seed windows** (the rail's absolute volume bounds and the PR's "before" tables need pre-change numbers on the exact windows that will be re-measured):

```bash
npm run test:probe -- src/audit/__tests__/training-leverage-probe.test.ts
LEVERAGE_SEED_START=1001 npm run test:probe -- src/audit/__tests__/training-leverage-probe.test.ts
LEVERAGE_SEED_START=2001 LEVERAGE_SEEDS=150 npm run test:probe -- src/audit/__tests__/training-leverage-probe.test.ts
```

Expected: all PASS; window 1–300 ratios near REF/SHO≈1.9, DEF/SHO≈1.7. Save every `LEVERAGE` line to a scratch note — the window-2001 `base` passes/shots values become the `M20_BASE_*` constants in the rail (Task 3 Step 5), and all three windows go in the PR "before" table.

- [ ] **Step 3: Commit**

```bash
git add src/audit/__tests__/training-leverage-probe.test.ts
git commit -m "audit: add permanent training-leverage probe (REF/DEF vs SHO)"
```

---

### Task 2: Pure routing seam — `finisherRoutingBoost` + `finisherRoutingApplies` + `selectRoutedPassTarget` (TDD)

**Files:**
- Create: `src/sim/__tests__/finisher-routing.test.ts` (unit portion; integration tests added in Task 4 after wiring exists)
- Modify: `src/sim/engine.ts` (new code near `SHOT_KEEPER_MOD_D64` ~line 590 and next to the `PassOption` interface ~line 614)

- [ ] **Step 1: Write the failing unit tests**

```ts
import {
  FINISHER_ROUTING_GAIN,
  ROUTING_VALUE_TOLERANCE,
  finisherRoutingApplies,
  finisherRoutingBoost,
  selectRoutedPassTarget,
} from '../engine';
import type { RoutedPassCandidate } from '../engine';

function candidate(
  to: number,
  value: number,
  boost: number,
  risk = 0.02,
): RoutedPassCandidate {
  return { to, value, boost, completion: value + risk, risk, interceptor: -1, interceptStat: 1 };
}

describe('finisherRoutingBoost', () => {
  it('leaves equal finishers unchanged', () => {
    expect(finisherRoutingBoost(0.5)).toBe(1);
  });

  it('never penalizes a pass toward a worse finisher (recycling stays intact)', () => {
    expect(finisherRoutingBoost(0.2)).toBe(1);
    expect(finisherRoutingBoost(0)).toBe(1);
  });

  it('boosts a pass toward a better finisher, scaled by the edge', () => {
    expect(finisherRoutingBoost(0.75)).toBeCloseTo(
      Math.min(1.5, 1 + FINISHER_ROUTING_GAIN * 0.5), 10);
  });

  it('caps the boost at 1.5', () => {
    expect(finisherRoutingBoost(1)).toBe(1.5);
  });

  // The helper's signature is the REF-independence proof: it takes only the
  // receiver-vs-passer SHO contest probability. The opposing keeper cannot
  // reach it. (positionThreat's existing SHO-vs-REF pricing is pre-m2.1
  // behavior and out of scope.)
});

describe('finisherRoutingApplies', () => {
  it('covers all four role combinations', () => {
    expect(finisherRoutingApplies('MID', 'FWD')).toBe(true);
    expect(finisherRoutingApplies('GK', 'FWD')).toBe(false);
    expect(finisherRoutingApplies('MID', 'GK')).toBe(false);
    expect(finisherRoutingApplies('GK', 'GK')).toBe(false);
  });
});

describe('selectRoutedPassTarget', () => {
  it('returns null with no candidates', () => {
    expect(selectRoutedPassTarget([])).toBeNull();
  });

  it('degenerates to plain argmax when every boost is 1 (m2.0 behavior)', () => {
    const picked = selectRoutedPassTarget([
      candidate(3, 0.10, 1),
      candidate(9, 0.08, 1),
    ]);
    expect(picked).not.toBeNull();
    expect(picked?.to).toBe(3);
    expect(picked?.gateValue).toBe(0.10);
  });

  it('routes to a boosted near-best candidate but gates on the MAX unboosted value', () => {
    const picked = selectRoutedPassTarget([
      candidate(3, 0.10, 1),
      candidate(9, 0.09, 1.4), // within tolerance of 0.10, boosted
    ]);
    expect(picked?.to).toBe(9);
    // The per-decision action gate must see exactly what m2.0 saw.
    expect(picked?.gateValue).toBe(0.10);
  });

  it('never routes to a candidate below the value tolerance, whatever the boost', () => {
    const farBelow = 0.10 * (1 - ROUTING_VALUE_TOLERANCE) - 0.001;
    const picked = selectRoutedPassTarget([
      candidate(3, 0.10, 1),
      candidate(9, farBelow, 1.5),
    ]);
    expect(picked?.to).toBe(3);
  });

  it('disables routing entirely when the best value is non-positive', () => {
    const picked = selectRoutedPassTarget([
      candidate(3, -0.01, 1),
      candidate(9, -0.02, 1.5),
    ]);
    expect(picked?.to).toBe(3);
    expect(picked?.gateValue).toBe(-0.01);
  });

  it('preserves m2.0 first-max tie order for equal NEGATIVE values despite boosts', () => {
    const picked = selectRoutedPassTarget([
      candidate(3, -0.01, 1),
      candidate(9, -0.01, 1.5), // tied at the non-positive max, boosted — must NOT win
    ]);
    expect(picked?.to).toBe(3);
  });

  it('preserves m2.0 first-max tie order for equal ZERO values despite boosts', () => {
    const picked = selectRoutedPassTarget([
      candidate(3, 0, 1),
      candidate(9, 0, 1.5),
    ]);
    expect(picked?.to).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/sim/__tests__/finisher-routing.test.ts`
Expected: FAIL — the exports do not exist.

- [ ] **Step 3: Implement in `src/sim/engine.ts`.** Constants + helpers near `SHOT_KEEPER_MOD_D64`; the candidate type and selector next to `PassOption` (~line 614). Also rename `PassOption.value` → `gateValue` and update its single consumer (`attackingDecision`, ~line 1001: `passOption.gateValue * passBias`):

```ts
/**
 * m2.1 finisher routing. A goal chain multiplies P(chance) x P(on target) x
 * P(beat keeper): the defending keeper's REF sits in every opposing chain,
 * while one striker's SHO only touches his own shot share — measured 2026-07-30
 * at REF ~1.9x SHO per training point (docs/superpowers/plans/
 * 2026-07-30-attack-defense-training-leverage.md). Rather than bend contest
 * math (the hidden-curve trap m2.0 removed), routing redirects near-best pass
 * targets toward better finishers. `edge` is the receiver-vs-passer SHO
 * contest probability — teammate-relative on purpose: pricing it against the
 * opposing keeper would hand REF a second defensive channel (high REF
 * compresses both finishers into the logistic tail, muting the routing edge).
 * Asymmetric by design: a worse finisher never penalizes the pass.
 */
export const FINISHER_ROUTING_GAIN = 1.0;
const FINISHER_ROUTING_CAP = 1.5;

/** `edge`: contestProbability(receiver SHO, passer SHO); 0.5 = equal. */
export function finisherRoutingBoost(edge: number): number {
  return Math.min(
    FINISHER_ROUTING_CAP,
    1 + FINISHER_ROUTING_GAIN * Math.max(0, 2 * (edge - 0.5)),
  );
}

/**
 * GK SHO is authored low with no dedicated mechanic (docs/03): keepers are
 * ineligible on both ends of the routing boost.
 */
export function finisherRoutingApplies(passerRole: Role, receiverRole: Role): boolean {
  return passerRole !== 'GK' && receiverRole !== 'GK';
}

/** A pass candidate with its unboosted EV split and its routing boost. */
export interface RoutedPassCandidate {
  readonly to: number;
  /** Unboosted completion - risk: exactly what m2.0 maximized. */
  readonly value: number;
  readonly completion: number;
  readonly risk: number;
  /** finisherRoutingBoost output; 1 whenever routing does not apply. */
  readonly boost: number;
  readonly interceptor: number;
  readonly interceptStat: number;
}

/** Routing may only redirect among near-best candidates. */
export const ROUTING_VALUE_TOLERANCE = 0.2;

/**
 * Picks the pass target. `gateValue` is the MAXIMUM unboosted value — for any
 * fixed state, bit-identical to what m2.0's pass-vs-shoot/carry gate compared,
 * so the per-decision action choice cannot move (aggregate match volume can
 * still drift via changed recipients; the leverage rail bounds it against
 * m2.0 absolutes). The boost only chooses WHICH near-best candidate receives
 * the ball: eligibility requires an unboosted value within
 * ROUTING_VALUE_TOLERANCE of the best, and when the best value is
 * non-positive the first maximum wins outright (m2.0 tie order), so a boost
 * can never force or redirect a bad or desperate ball. With every boost at 1
 * the eligible-set argmax degenerates to m2.0's plain argmax.
 */
export function selectRoutedPassTarget(
  candidates: readonly RoutedPassCandidate[],
): PassOption | null {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  for (const c of candidates) if (c.value > best.value) best = c;
  if (best.value <= 0) {
    return {
      to: best.to,
      gateValue: best.value,
      interceptor: best.interceptor,
      interceptStat: best.interceptStat,
    };
  }
  let chosen = best;
  let chosenScore = best.completion * best.boost - best.risk;
  for (const c of candidates) {
    if (c === best) continue;
    if (c.value < (1 - ROUTING_VALUE_TOLERANCE) * best.value) continue;
    const score = c.completion * c.boost - c.risk;
    if (score > chosenScore) {
      chosenScore = score;
      chosen = c;
    }
  }
  return {
    to: chosen.to,
    gateValue: best.value,
    interceptor: chosen.interceptor,
    interceptStat: chosen.interceptStat,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/sim/__tests__/finisher-routing.test.ts && npx tsc --noEmit`
Expected: PASS (12 tests), typecheck green (the `gateValue` rename is complete). Nothing calls the seam yet, so the full suite and goldens stay green.

- [ ] **Step 5: Commit**

```bash
git add src/sim/__tests__/finisher-routing.test.ts src/sim/engine.ts
git commit -m "feat(sim): add finisher routing seam (unwired)"
```

---

### Task 3: Wire, sweep, author the rail, and gate — NO commits, NO version bump yet

Nothing in this task is committed except nothing — the wiring and the rail live only in the working tree until the gate passes; a failed sweep is reverted and reported, so no golden can ever bless a failed design.

- [ ] **Step 1: Rework `bestPassOption`** (engine.ts ~line 939) to build candidates and delegate:

```ts
function bestPassOption(state: MatchState, from: number): PassOption | null {
  const passer = requirePlayerAt(state, from);
  // A keeper passer must not even read its own SHO (docs/03).
  const passerIsKeeper = passer.def.role === 'GK';
  const passerSho = passerIsKeeper ? 0 : executionStat(state, from, 'sho');
  const candidates: RoutedPassCandidate[] = [];
  for (const i of activePlayerIndices(state)) {
    const mate = requirePlayerAt(state, i);
    if (i === from || mate.team !== passer.team || !isAvailable(state, i)) continue;
    const distance2 = dist2(mate.pos, passer.pos);
    if (distance2 < 400 * 400 || distance2 > 3500 * 3500) continue;

    const inputs = passContestInputs(state, from, i, true);
    const completion = inputs.probability * positionThreat(state, i, mate.pos);
    const risk = (1 - inputs.probability) * opponentTurnoverCost(state, inputs.interceptor);
    const boost = finisherRoutingApplies(passer.def.role, mate.def.role)
      ? finisherRoutingBoost(contestProbability(executionStat(state, i, 'sho'), passerSho))
      : 1;
    candidates.push({
      to: i,
      value: completion - risk,
      completion,
      risk,
      boost,
      interceptor: inputs.interceptor,
      interceptStat: inputs.interceptStat,
    });
  }
  return selectRoutedPassTarget(candidates);
}
```

- [ ] **Step 2: Fixed-state invariance sanity.** Run:

```bash
npx jest src/sim/__tests__/finisher-routing.test.ts src/sim/__tests__/attacking-decision.test.ts src/sim/__tests__/attacking-balance.test.ts src/sim/__tests__/balance-rails.test.ts
```

`attacking-decision.test.ts` must pass **entirely unmodified** — with the gate-value design, every fixed-state shot/carry/pass value and action kind is bit-identical to m2.0 (the two backpass tests at :100–118 doubly so: both receivers there are worse finishers than the Dario carrier, so every boost is 1). `attacking-balance.test.ts` covers aggregate real-match backpass and pass-completion behavior. Any failure in either file is a wiring bug, never a calibration chore. Parity/golden tests will fail in the working tree; that is expected and stays uncommitted.

- [ ] **Step 3: Sweep `FINISHER_ROUTING_GAIN` ∈ {0.5, 1.0, 1.5}.** For each value, edit the constant and run:

```bash
npm run test:probe -- src/audit/__tests__/training-leverage-probe.test.ts
npx jest src/sim/__tests__/balance-rails.test.ts
```

Record per gain: REF/SHO, DEF/SHO, base pts, base GF (scoring drift), striker share, passes/match and shots/match vs the Task 1 m2.0 numbers, and rails pass/fail.

- [ ] **Step 4: Validate the winner on the held-out window:**

```bash
LEVERAGE_SEED_START=1001 npm run test:probe -- src/audit/__tests__/training-leverage-probe.test.ts
```

- [ ] **Step 5: Author the CI rail NOW and run it with the candidate gain** — the exact assertions that will guard CI must be green *before* the version is blessed, or a rail failure after the golden commit would strand the branch. Create `src/sim/__tests__/training-leverage-rails.test.ts`; replace the two `<recorded>` constants with the window-2001 m2.0 `base` numbers from Task 1 Step 2:

```ts
import { runMatch } from '../match';
import { ROVERS } from '../teams';
import type { PowerId, TeamDef } from '../types';

// m2.1 leverage rail: defensive training must not dwarf attacking training.
// Guards the finisher-routing fix (docs/superpowers/plans/
// 2026-07-30-attack-defense-training-leverage.md). If this rail fails, the
// attack-vs-defense training economy or the routing behavior regressed — tune
// the engine, never the bounds. Seeds 2001-2150 are disjoint from the
// gain-sweep window (they participate in acceptance as validation data). The
// volume bounds reference m2.0 measurements taken on THIS window before the
// routing change (plan Task 1 Step 2) — re-measure them only alongside an
// ENGINE_VERSION decision. Deep measurement: the opt-in training-leverage probe.

const POLICIES = {
  homePolicy: 'FIRE_WHEN_READY' as const,
  awayPolicy: 'FIRE_WHEN_READY' as const,
};
const SEED_START = 2001;
const SEEDS = 150;

// m2.0 baselines, seeds 2001-2150 (measured 2026-07-30, pre-routing).
const M20_BASE_PASSES_PER_MATCH = <recorded>;
const M20_BASE_SHOTS_PER_MATCH = <recorded>;

type MutableTeam = TeamDef & { players: Array<{ id: string; attrs: Record<string, number>; power?: PowerId }> };

function mirror(tag: string): TeamDef {
  const team = structuredClone(ROVERS) as MutableTeam;
  team.id = `${ROVERS.id}-${tag}`;
  team.name = `${ROVERS.name} ${tag}`;
  for (const player of team.players) {
    player.id = `${player.id}-${tag}`;
    // Powers stripped so the arms measure bare stat leverage (repo probe convention).
    player.power = undefined;
  }
  return team;
}

function boosted(playerIdx: number, stat: 'ref' | 'sho' | 'def', delta: number): TeamDef {
  const team = mirror('a') as MutableTeam;
  team.players[playerIdx].attrs[stat] += delta;
  return team;
}

interface ArmResult {
  readonly pts: number;
  readonly passes: number;
  readonly shots: number;
  readonly strikerShare: number;
}

function measure(teamA: TeamDef): ArmResult {
  const teamB = mirror('b');
  let pts = 0, passes = 0, shots = 0, strikerShots = 0;
  for (let seed = SEED_START; seed < SEED_START + SEEDS; seed++) {
    const home = runMatch(seed, teamA, teamB, [], POLICIES);
    const away = runMatch(seed, teamB, teamA, [], POLICIES);
    for (const [aGoals, bGoals] of [
      [home.score[0], home.score[1]],
      [away.score[1], away.score[0]],
    ]) {
      pts += aGoals > bGoals ? 3 : aGoals === bGoals ? 1 : 0;
    }
    passes += home.events.filter(e => e.kind === 'PASS' && e.from < 11).length;
    passes += away.events.filter(e => e.kind === 'PASS' && e.from >= 11).length;
    shots += home.events.filter(e => e.kind === 'SHOT' && e.by < 11).length;
    shots += away.events.filter(e => e.kind === 'SHOT' && e.by >= 11).length;
    strikerShots += home.events.filter(e => e.kind === 'SHOT' && e.by === 9).length;
    strikerShots += away.events.filter(e => e.kind === 'SHOT' && e.by === 20).length;
  }
  const matches = SEEDS * 2;
  return {
    pts: pts / matches,
    passes: passes / matches,
    shots: shots / matches,
    strikerShare: shots === 0 ? 0 : strikerShots / shots,
  };
}

describe('training leverage rails (m2.1)', () => {
  it('keeps defensive training within 1.45x of attacking training, volume anchored to m2.0', () => {
    const base = measure(mirror('a'));
    const ref = measure(boosted(0, 'ref', 24));
    const def = measure(boosted(3, 'def', 24));
    const sho = measure(boosted(9, 'sho', 24));
    const refLift = ref.pts - base.pts;
    const defLift = def.pts - base.pts;
    const shoLift = sho.pts - base.pts;
    console.log(`LEVERAGE RAIL: base=${base.pts.toFixed(3)} refLift=${refLift.toFixed(3)} defLift=${defLift.toFixed(3)} shoLift=${shoLift.toFixed(3)} REF/SHO=${(refLift / shoLift).toFixed(2)} DEF/SHO=${(defLift / shoLift).toFixed(2)} basePasses=${base.passes.toFixed(1)} baseShots=${base.shots.toFixed(1)} baseShare=${(base.strikerShare * 100).toFixed(1)}% shoShare=${(sho.strikerShare * 100).toFixed(1)}%`);
    // Mirrored baseline sanity — a drifting base means the harness broke.
    expect(base.pts).toBeGreaterThanOrEqual(1.15);
    expect(base.pts).toBeLessThanOrEqual(1.6);
    // Attacking training must genuinely matter.
    expect(shoLift).toBeGreaterThanOrEqual(0.15);
    // Leverage targets: headroom over the tuned 1.35, plus floors so attack
    // never becomes dominant either.
    expect(refLift / shoLift).toBeLessThanOrEqual(1.45);
    expect(refLift / shoLift).toBeGreaterThanOrEqual(0.8);
    expect(defLift / shoLift).toBeLessThanOrEqual(1.45);
    expect(defLift / shoLift).toBeGreaterThanOrEqual(0.7);
    // Volume anchored to pre-routing m2.0 absolutes: routing must move
    // distribution, not the shape of the game.
    expect(Math.abs(base.passes / M20_BASE_PASSES_PER_MATCH - 1)).toBeLessThanOrEqual(0.15);
    expect(Math.abs(base.shots / M20_BASE_SHOTS_PER_MATCH - 1)).toBeLessThanOrEqual(0.2);
    // And the marginal effect of SHO training stays a distribution effect.
    expect(Math.abs(sho.passes / base.passes - 1)).toBeLessThanOrEqual(0.12);
    expect(Math.abs(sho.shots / base.shots - 1)).toBeLessThanOrEqual(0.25);
    expect(sho.strikerShare).toBeGreaterThan(base.strikerShare);
  }, 900000);
});
```

Run: `npx jest src/sim/__tests__/training-leverage-rails.test.ts` — must be green with the candidate gain before proceeding.

- [ ] **Step 6: Decide by rule (no taste required):**
  - Pick the **smallest** gain with: REF/SHO ≤ 1.35 AND DEF/SHO ≤ 1.35 on seeds 1–300 and 1001–1300; the full rail (Step 5) green; `balance-rails.test.ts` green; `attacking-decision.test.ts` and `attacking-balance.test.ts` green unmodified.
  - If no swept gain qualifies: `git checkout -- src/sim/engine.ts` (Task 2's commit already contains the seam, so this restores it while dropping the wiring — verify with `git diff --exit-code -- src/sim/engine.ts` and a green `npx jest src/sim/__tests__/finisher-routing.test.ts`), delete the uncommitted rail file, and STOP — report to the owner that **this routing configuration** (gain sweep at `ROUTING_VALUE_TOLERANCE` 0.2, cap 1.5) failed, with the best-achieved ratios. Escalation dials, all owner-level: raise the tolerance or cap (still honest, more aggressive routing), or the defensive-contest-compression trade-off (rating honesty vs leverage parity, the m1.28↔m2.0 tension). Do not implement any of them, do not bump the version, do not touch goldens.

---

### Task 4: Version bump, goldens, integration tests — one green commit

Only reached when Task 3's gate passed. Replay-affecting change ⇒ per CLAUDE.md the behavior, the `ENGINE_VERSION` bump, and both golden updates land in the SAME commit (the pre-validated rail rides along).

**Files:**
- Modify: `src/sim/match.ts:26`, `src/sim/runtime-golden.ts`, `src/sim/__tests__/finisher-routing.test.ts`, `README.md:16`
- Add: `src/sim/__tests__/training-leverage-rails.test.ts` (authored and validated in Task 3)
- Regenerate: `src/sim/__tests__/__snapshots__/parity-replay.test.ts.snap`

- [ ] **Step 1: Confirm the final gain** from Task 3 is set in `src/sim/engine.ts`.

- [ ] **Step 2: Bump the engine version with its reason** in `src/sim/match.ts`:

```ts
// m2.1: finisher routing — near-best pass targets redirect toward
// teammate-relative better finishers (attack-vs-defense training-leverage
// fix). Per-decision action gates and contest math unchanged; see
// docs/superpowers/plans/2026-07-30-attack-defense-training-leverage.md.
export const ENGINE_VERSION = 'm2.1';
```

- [ ] **Step 3: Rebaseline the runtime golden.** Run `npx jest src/sim/__tests__/runtime-golden.test.ts` — it fails printing the new fingerprint. Paste it into `src/sim/runtime-golden.ts` and extend the comment:

```ts
// Rebaselined deliberately for m2.1 (finisher routing: near-best pass targets
// redirect toward better finishers — attack-vs-defense training-leverage fix).
// Earlier deliberate rebaselines: m2.0 (scale-invariant domains), m1.29, m1.25,
// m1.26-m1.28 (see git history).
const EXPECTED_RUNTIME_GOLDEN = '<paste printed hash>';
```

- [ ] **Step 4: Regenerate the parity snapshot AND inspect the diff** — it locks the full event stream:

```bash
npx jest src/sim/__tests__/parity-replay.test.ts -u
git diff --stat src/sim/__tests__/__snapshots__/
git diff src/sim/__tests__/__snapshots__/ | grep -E '^[-+].*"kind"' | sort | uniq -c | sort -rn | head -20
```

Expected: recipient changes and their downstream divergence only — event-kind counts shift moderately. A wholesale change in match shape (goal counts exploding, SHOT events vanishing) means the wiring is wrong — STOP and debug, do not commit.

- [ ] **Step 5: Add the integration tests** to `src/sim/__tests__/finisher-routing.test.ts`:

```ts
import { attackingDecision, possessionTick } from '../engine';
import { createMatch } from '../match';
import { GOAL_CENTER_X } from '../geometry';
import { ROVERS, UNITED } from '../teams';
import type { MatchState, TeamDef } from '../types';

type MutableRoster = TeamDef & { players: Array<{ attrs: { sho: number } }> };

function keeperDistributionScenario(keeperSho: number): MatchState {
  const team = structuredClone(ROVERS) as MutableRoster;
  team.players[0].attrs.sho = keeperSho;
  const m = createMatch(7, team as TeamDef, UNITED);
  m.tick = 40;
  // Real post-save path: a held ball with an elapsed release tick drives the
  // goalkeeper-distribution branch of possessionTick straight into
  // bestPassOption — the exact code path the GK exclusion must protect.
  m.ball = { kind: 'held', by: 0, releaseAfterTick: 40 };
  m.players[0].pos = { x: GOAL_CENTER_X, y: 9600 };
  for (let i = 12; i < 22; i++) m.players[i].pos = { x: 300, y: 300 };
  for (let i = 1; i < 11; i++) m.players[i].outUntilTick = Number.MAX_SAFE_INTEGER;
  // Two in-range outlets: a defender and a forward at mirrored spots.
  m.players[1].outUntilTick = 0; m.players[1].pos = { x: GOAL_CENTER_X - 800, y: 8400 };
  m.players[9].outUntilTick = 0; m.players[9].pos = { x: GOAL_CENTER_X + 800, y: 8400 };
  return m;
}

describe('finisher routing integration', () => {
  it('keeper SHO never steers post-save distribution', () => {
    const low = keeperDistributionScenario(20);
    const high = keeperDistributionScenario(90);
    possessionTick(low);
    possessionTick(high);
    expect(high.events.filter(e => e.kind === 'PASS'))
      .toEqual(low.events.filter(e => e.kind === 'PASS'));
    expect(high.ball).toEqual(low.ball);
  });

  // Calibrated flip: the safe option (Max Tanko, SHO 25) must be slightly
  // better UNBOOSTED than Dario Flint (SHO 62) yet inside
  // ROUTING_VALUE_TOLERANCE, so only the routing boost separates them.
  // CALIBRATION PROTOCOL (mirrors attacking-decision.test.ts's distance
  // comments): (1) temporarily make finisherRoutingBoost return 1; the test
  // MUST then pick 3 — adjust Dario's y offset until it does (start from the
  // values below, move him further from goal in 100-unit steps); (2) restore
  // the boost; the test MUST pick 9. Both checks are required — a scenario
  // that picks 9 in both states is a false positive (round-2 review finding).
  it('routing flips a near-tied choice toward the better finisher', () => {
    const m = createMatch(7, ROVERS, UNITED);
    m.tick = 5;
    const carrier = 8; // Ravi Chan, SHO 40
    m.ball = { kind: 'held', by: carrier };
    m.players[carrier].pos = { x: GOAL_CENTER_X, y: 4600 };
    for (let i = 12; i < 22; i++) m.players[i].pos = { x: 300, y: 9000 };
    m.players[11].pos = { x: GOAL_CENTER_X, y: 0 };
    for (let i = 0; i < 11; i++) {
      if (i !== carrier) m.players[i].outUntilTick = Number.MAX_SAFE_INTEGER;
    }
    m.players[3].outUntilTick = 0; m.players[3].pos = { x: GOAL_CENTER_X - 900, y: 3300 };
    m.players[9].outUntilTick = 0; m.players[9].pos = { x: GOAL_CENTER_X + 900, y: 3500 };

    const decision = attackingDecision(m, carrier);
    expect(decision.kind).toBe('pass');
    expect((decision as { to?: number }).to).toBe(9);
  });
});
```

Run the calibration protocol as written, then `npx jest src/sim/__tests__/finisher-routing.test.ts` — all green with the boost restored.

- [ ] **Step 6: Full suite triage.** Run `npx jest src/sim`. With the gate-value design, fixed-state decision values and action kinds are bit-identical to m2.0 — so `attacking-decision.test.ts` (including the backpass tests at :100–118) must pass **unmodified**, and any fixed-state numeric or action-kind drift anywhere is a wiring bug: STOP and debug. The only legitimate differences are pass recipients and their downstream replay events (parity snapshot, aggregate stats).

- [ ] **Step 7: Update the README engine marker** (README.md:16): `Current engine: **m2.1**.`

- [ ] **Step 8: Everything green, commit atomically**

```bash
npx jest src/sim && npx tsc --noEmit
git add src/sim/engine.ts src/sim/match.ts src/sim/runtime-golden.ts \
  src/sim/__tests__/finisher-routing.test.ts \
  src/sim/__tests__/training-leverage-rails.test.ts \
  src/sim/__tests__/__snapshots__/parity-replay.test.ts.snap \
  README.md
git commit -m "feat(sim): m2.1 finisher routing — feed standout finishers (ENGINE_VERSION bump + golden rebaseline + leverage rail)"
```

---

### Task 5: Docs + decision log

**Files:**
- Modify: `docs/03-match-engine.md`
- Modify: `README.md`

- [ ] **Step 1: `docs/03-match-engine.md`.** First, **replace** the sentence at docs/03-match-engine.md:36 — currently `(Every player stores all 7 fields — GKs' SHO and outfielders' REF are unused filler.)` — with:

> (Every player stores all 7 fields. Outfielders' REF is unused filler. GKs' SHO has no dedicated mechanic — a keeper never shoots, a GK passer skips the m2.1 routing boost entirely and GK targets are ineligible for it; it is read only by the generic `positionThreat` pricing that predates m2.1.)

Then, in the attacking-decision section, add:

> **Finisher routing (m2.1).** When choosing a pass target, candidates within 20% of the best unboosted expected value may be redirected toward a teammate who beats the passer in a SHO-vs-SHO contest (`finisherRoutingBoost`, up to 1.5×). Target selection only: the value compared against shoot/carry is the unchanged m2.0 maximum, so the per-decision pass gate cannot move — only who receives the ball (aggregate match volume is separately bounded against recorded m2.0 absolutes by the leverage rail). Routing is fully disabled for non-positive pass values (m2.0 pick and tie order preserved), the edge is teammate-relative on purpose (pricing it against the opposing keeper would give REF a second defensive channel), worse finishers are never penalized, and goalkeepers are ineligible on both ends. Rationale: the keeper's REF contests every opposing chance while one striker's SHO only touches his own shot share, which made defensive training ~1.9× the points value of attacking training per point (measured 2026-07-30). Guarded by `training-leverage-rails.test.ts` (leverage ≤ 1.45×, volume anchored to recorded m2.0 absolutes, share monotonicity) on seeds disjoint from the gain-sweep window; deep measurement in the opt-in `training-leverage-probe`.

- [ ] **Step 2: `README.md` decision log** — add one entry:

> **2026-07-30 — m2.1 finisher routing.** Defensive training measured ~1.9× (REF) / ~1.7× (DEF) the points value of SHO training per point. Fixed at the decision layer (near-best pass targets redirect to the better finisher; per-decision gates unchanged, aggregate volume bounded against m2.0), not by drill repricing, roster inflation, or contest-curve compression. New CI leverage rail enforces ≤1.45× on seeds disjoint from the gain sweep.

- [ ] **Step 3: Commit**

```bash
git add docs/03-match-engine.md README.md
git commit -m "docs: record m2.1 finisher routing decision and leverage rail"
```

---

### Task 6: Full verification + PR

- [ ] **Step 1: Full gates**

```bash
npx tsc --noEmit
npm test
```

Expected: both green (probe files stay excluded automatically; the README m2.1 marker check passes because Task 4 Step 7 updated it).

- [ ] **Step 2: Final measurement on all three windows**, paste before/after + sweep tables into the PR:

```bash
npm run test:probe -- src/audit/__tests__/training-leverage-probe.test.ts
LEVERAGE_SEED_START=1001 npm run test:probe -- src/audit/__tests__/training-leverage-probe.test.ts
LEVERAGE_SEED_START=2001 LEVERAGE_SEEDS=150 npm run test:probe -- src/audit/__tests__/training-leverage-probe.test.ts
```

Expected: ratios within the Task 3 Step 6 targets on every window, striker share visibly above the m2.0 baseline, volumes inside the anchored bounds.

- [ ] **Step 3: Push and open the PR** — title must state the *measured* result, not the aspiration (if Task 3 stopped at the gate, this task is never reached):

```bash
git push -u origin balance/attack-defense-leverage-m2.1
gh pr create --title "m2.1 finisher routing: attack-vs-defense training leverage <measured REF/SHO>x (was 1.89x)" --body "<before/after, sweep, and held-out tables>"
```

- [ ] **Step 4: Update assistant memory** — extend the `gk-training-leverage-measured` memory file (assistant-side note store, not a repo artifact) with the shipped gain, final ratios, and rail location.

---

## Out of scope (deliberately)

- Drill prices/gains and `content/training.json` — untouched; the uniform ladder survives.
- `DIVISION_GOALKEEPER_REF_RATINGS` and all roster content — untouched.
- Raising `ROUTING_VALUE_TOLERANCE`/`FINISHER_ROUTING_CAP` beyond the shipped values, and defensive-contest compression (slope/divisor) — owner-level escalation dials only, in that order of invasiveness, if the shipped configuration can't reach ≤ 1.35.
- `positionThreat`'s existing SHO-vs-REF pricing (including its use of GK SHO for keeper receivers) — pre-m2.1 behavior, legitimate EV pricing, not the new channel; changing it would be a separate measured campaign.
- Economy-side compensation (goals paying money/fans) — a separate, compatible lever the owner can add later.
- First-match W/D/L table re-measurement — game-layer; the sim-level ratio is the design target. Available on request after merge.
