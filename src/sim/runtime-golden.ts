import { ENGINE_VERSION, runMatch } from './match';
import { ROVERS, UNITED } from './teams';

// Compact runtime counterpart to parity-replay.test.ts's detailed Jest
// snapshot. This hash covers the score and every event payload, and is cheap
// enough to run in both Node CI and the app's Hermes boot path.
// Rebaselined deliberately for m2.1 (auto-substitution entry-condition rating +
// freshness floor, incremental replay-input feeding, FIRE_WHEN_READY default).
// m2.2 rebaseline: GOAL events now carry the scorer's stable id (scoredById),
// which changes the hashed event payloads. Ball physics, RNG consumption and
// scores are unchanged from m2.1.
// Earlier deliberate rebaselines: m2.0 (scale-invariant contest/execution
// domains, career condition carryover, fixed-point PAC/STA movement), m1.29
// (presser standoff ring; PAC-widened duel spacing), m1.25 (five named subs,
// immediate red-energy auto-coaching), m1.26-m1.28 (see git history).
const EXPECTED_RUNTIME_GOLDEN = '7d48fa26';

// Seed 42 finishes 0-0, so neither this hash nor parity-replay's snapshot has
// ever contained a GOAL payload — adding assistedById to that event moved
// neither baseline, and the forcing reminder stayed silent. Seed 81 finishes
// 3-2: five goals, three of them assisted and from both sides of the pitch, two
// unassisted (which covers the omitted-field branch too). Kept as a second
// baseline rather than folded into the first so a regression stays readable as
// "the goalless one still passes, the scoring one moved".
const EXPECTED_GOAL_GOLDEN = '15e4df15';

const GOAL_GOLDEN_SEED = 81;

function goldenMatch(seed: number): ReturnType<typeof runMatch> {
  return runMatch(seed, ROVERS, UNITED, [], {
    homePolicy: 'FIRE_WHEN_READY',
    awayPolicy: 'FIRE_WHEN_READY',
  });
}

/**
 * The scoring golden's raw result, so the test can assert an assisted goal is
 * still in there. A hash alone cannot say *why* it changed, and a seed that
 * stopped scoring would look exactly like any other rebaseline.
 */
export function goalGoldenMatch(): ReturnType<typeof runMatch> {
  return goldenMatch(GOAL_GOLDEN_SEED);
}

function fingerprintOf(result: ReturnType<typeof runMatch>): string {
  const serialized = JSON.stringify({
    engineVersion: ENGINE_VERSION,
    score: result.score,
    events: result.events,
  });
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function runtimeGoldenFingerprint(): string {
  return fingerprintOf(goldenMatch(42));
}

/** The scoring counterpart: this is the only golden that hashes a GOAL payload. */
function goalGoldenFingerprint(): string {
  return fingerprintOf(goalGoldenMatch());
}

/**
 * Returns the fingerprints it just verified so the app's boot gate can log them
 * without paying for a second pair of full matches.
 */
export function assertRuntimeGoldenReplay(): string {
  const actual = runtimeGoldenFingerprint();
  if (actual !== EXPECTED_RUNTIME_GOLDEN) {
    throw new Error(
      `runtime golden replay mismatch for ${ENGINE_VERSION}: ${actual} != ${EXPECTED_RUNTIME_GOLDEN}`,
    );
  }
  const actualGoal = goalGoldenFingerprint();
  if (actualGoal !== EXPECTED_GOAL_GOLDEN) {
    throw new Error(
      `goal golden replay mismatch for ${ENGINE_VERSION}: ${actualGoal} != ${EXPECTED_GOAL_GOLDEN}`,
    );
  }
  return `${actual} ${actualGoal}`;
}
