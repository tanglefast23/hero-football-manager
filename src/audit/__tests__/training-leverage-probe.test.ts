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
    throw new Error(
      `${name} must be a positive integer, got ${JSON.stringify(raw)}`,
    );
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `${name} must be a safe positive integer, got ${JSON.stringify(raw)}`,
    );
  }
  return value;
}
const SEEDS = positiveIntegerEnv('LEVERAGE_SEEDS', 300);
const SEED_START = positiveIntegerEnv('LEVERAGE_SEED_START', 1);

/**
 * Powers are stripped by default so the arms measure bare stat leverage (repo
 * probe convention). `LEVERAGE_POWERS=on` keeps them, which is the condition
 * the recorded 1.89x REF/SHO baseline was measured under — the two numbers
 * answer different questions and the header quotes both.
 */
const KEEP_POWERS = process.env.LEVERAGE_POWERS === 'on';

type MutableTeam = TeamDef & {
  players: Array<{
    id: string;
    attrs: Record<string, number>;
    power?: PowerId;
  }>;
};

function mirror(tag: string): TeamDef {
  const team = structuredClone(ROVERS) as MutableTeam;
  team.id = `${ROVERS.id}-${tag}`;
  team.name = `${ROVERS.name} ${tag}`;
  for (const player of team.players) {
    player.id = `${player.id}-${tag}`;
    if (!KEEP_POWERS) player.power = undefined;
  }
  return team;
}

function boosted(
  playerIdx: number,
  stat: 'ref' | 'sho' | 'def',
  delta: number,
): TeamDef {
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
  let pts = 0,
    gf = 0,
    ga = 0,
    teamShots = 0,
    trackedShots = 0,
    teamPasses = 0;
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
    teamShots += home.events.filter(
      (e) => e.kind === 'SHOT' && e.by < 11,
    ).length;
    teamShots += away.events.filter(
      (e) => e.kind === 'SHOT' && e.by >= 11,
    ).length;
    trackedShots += home.events.filter(
      (e) => e.kind === 'SHOT' && e.by === trackIdx,
    ).length;
    trackedShots += away.events.filter(
      (e) => e.kind === 'SHOT' && e.by === trackIdx + 11,
    ).length;
    teamPasses += home.events.filter(
      (e) => e.kind === 'PASS' && e.from < 11,
    ).length;
    teamPasses += away.events.filter(
      (e) => e.kind === 'PASS' && e.from >= 11,
    ).length;
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
    console.log(
      `LEVERAGE seeds=${SEED_START}..${SEED_START + SEEDS - 1} powers=${KEEP_POWERS ? 'on' : 'off'}`,
    );
    console.log(
      `LEVERAGE base: pts=${base.pts.toFixed(3)} GF=${base.gf.toFixed(3)} passes=${base.passes.toFixed(1)} shots=${base.shots.toFixed(1)} strikerShare=${(base.trackedShotShare * 100).toFixed(1)}%`,
    );
    console.log(
      `LEVERAGE REF+24: pts=${ref.pts.toFixed(3)} GA=${ref.ga.toFixed(3)} lift=${refLift.toFixed(3)}`,
    );
    console.log(
      `LEVERAGE DEF+24: pts=${def.pts.toFixed(3)} GA=${def.ga.toFixed(3)} lift=${defLift.toFixed(3)}`,
    );
    console.log(
      `LEVERAGE SHO+24: pts=${sho.pts.toFixed(3)} GF=${sho.gf.toFixed(3)} lift=${shoLift.toFixed(3)} passes=${sho.passes.toFixed(1)} shots=${sho.shots.toFixed(1)} strikerShare=${(sho.trackedShotShare * 100).toFixed(1)}%`,
    );
    console.log(
      `LEVERAGE ratios: REF/SHO=${(refLift / shoLift).toFixed(2)} DEF/SHO=${(defLift / shoLift).toFixed(2)}`,
    );
    expect(shoLift).toBeGreaterThan(0);
    expect(refLift).toBeGreaterThan(0);
    expect(defLift).toBeGreaterThan(0);
  }, 1200000);
});
