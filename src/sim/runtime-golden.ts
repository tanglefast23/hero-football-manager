import { ENGINE_VERSION, runMatch } from './match';
import { ROVERS, UNITED } from './teams';

// Compact runtime counterpart to parity-replay.test.ts's detailed Jest
// snapshot. This hash covers the score and every event payload, and is cheap
// enough to run in both Node CI and the app's Hermes boot path.
// m2.9 rebaseline: manual outfield taps outside useful context are no-ops, and
// save-power taps use the shared defending-third danger prompt. Expired save
// windows also spend Heat. These intentional replay changes move both hashes.
// m2.7 rebaseline: ENGINE_VERSION only. The engine gained the goalkeeper
// firing-policy exemption (a GK slot is always FIRE_WHEN_READY) and substitutes
// now inherit the player they replaced instead of slot 0. Both goldens run
// FIRE_WHEN_READY on both sides, where firePolicyForRole is the identity, and
// neither issues a substitution — so play, RNG consumption, scores and event
// payloads are byte-identical to m2.6. Both hashes move solely because
// fingerprintOf() hashes the version string; parity-replay's snapshot (which
// holds no version) still passes, which is the evidence that nothing else
// moved.
// m2.6 rebaseline: ENGINE_VERSION only. No play, RNG, score or event payload
// change — the bump re-anchors the byte-identical invariant after two fixes
// landed inside m2.5 (see the version history in match.ts). Both hashes move
// solely because fingerprintOf() hashes the version string; parity-replay's
// snapshot (which holds no version) is unchanged, which is the evidence that
// nothing else moved.
// m2.4 rebaseline: ENGINE_VERSION only. The engine gained the
// MOTIVATIONAL_SPEECH coaching input, which no golden match issues — play, RNG
// consumption, scores and event payloads are all byte-identical to m2.3. Both
// hashes move solely because fingerprintOf() hashes the version string, and
// parity-replay's snapshot (which holds no version) is unchanged, which is the
// evidence that nothing else moved.
// Rebaselined deliberately for m2.1 (auto-substitution entry-condition rating +
// freshness floor, incremental replay-input feeding, FIRE_WHEN_READY default).
// m2.3 rebaseline: owner balance decision of 2026-08-16 on how long a stricken
// player stays down — Fire Torch ignite 1.5s -> 3.0s, Web Trap root 12.0s ->
// 6.0s, Super Strength flatten 15.0s -> 6.0s. Removal windows move, so play
// diverges. RNG consumption is unchanged; only the tick counts differ.
// m2.2 rebaseline: GOAL events now carry the scorer's stable id (scoredById),
// which changes the hashed event payloads. Ball physics, RNG consumption and
// scores are unchanged from m2.1.
// Earlier deliberate rebaselines: m2.0 (scale-invariant contest/execution
// domains, career condition carryover, fixed-point PAC/STA movement), m1.29
// (presser standoff ring; PAC-widened duel spacing), m1.25 (five named subs,
// immediate red-energy auto-coaching), m1.26-m1.28 (see git history).
const EXPECTED_RUNTIME_GOLDEN = 'd8a5603b';

// Seed 42 finishes 0-0, so neither this hash nor parity-replay's snapshot has
// ever contained a GOAL payload — adding assistedById to that event moved
// neither baseline, and the forcing reminder stayed silent. The scoring seed
// finishes 1-4: five goals, three of them assisted and from both sides of the
// pitch, two unassisted (which covers the omitted-field branch too). Kept as a
// second baseline rather than folded into the first so a regression stays
// readable as "the goalless one still passes, the scoring one moved".
//
// The seed itself is m2.5. It was 81 until the pass-combo speed bonus, which
// moved that match to five assisted goals and zero unassisted — the hash would
// have rebaselined quietly while the both-kinds contract below went red. Seed
// 25 restores the same profile 81 used to have. Re-scan for a replacement
// rather than weakening the assertion if a future change costs it again.
const EXPECTED_GOAL_GOLDEN = '9e56a3c3';

const GOAL_GOLDEN_SEED = 25;

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
