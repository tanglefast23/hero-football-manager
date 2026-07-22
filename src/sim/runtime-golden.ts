import { ENGINE_VERSION, runMatch } from './match';
import { ROVERS, UNITED } from './teams';

// Compact runtime counterpart to parity-replay.test.ts's detailed Jest
// snapshot. This hash covers the score and every event payload, and is cheap
// enough to run in both Node CI and the app's Hermes boot path.
// Rebaselined deliberately for m1.22: Decoy, Web, Ice, Shadow, Portal, Future
// Sight, and Gravity now use the approved timing, reach, and duration rules
// selected for the final closeout probes.
const EXPECTED_RUNTIME_GOLDEN = '6009c563';

export function runtimeGoldenFingerprint(): string {
  const result = runMatch(42, ROVERS, UNITED, [], {
    homePolicy: 'FIRE_WHEN_READY',
    awayPolicy: 'FIRE_WHEN_READY',
  });
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

export function assertRuntimeGoldenReplay(): void {
  const actual = runtimeGoldenFingerprint();
  if (actual !== EXPECTED_RUNTIME_GOLDEN) {
    throw new Error(
      `runtime golden replay mismatch for ${ENGINE_VERSION}: ${actual} != ${EXPECTED_RUNTIME_GOLDEN}`
    );
  }
}
