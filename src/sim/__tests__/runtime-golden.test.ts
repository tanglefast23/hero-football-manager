import {
  assertRuntimeGoldenReplay,
  goalGoldenFingerprint,
  goalGoldenMatch,
  runtimeGoldenFingerprint,
} from '../runtime-golden';

describe('runtime golden replay', () => {
  it('matches the full score and event-payload fingerprint in Node', () => {
    expect(() => assertRuntimeGoldenReplay()).not.toThrow();
    expect(runtimeGoldenFingerprint()).toMatch(/^[0-9a-f]{8}$/);
    expect(goalGoldenFingerprint()).toMatch(/^[0-9a-f]{8}$/);
  });

  // The goalless seed 42 golden cannot see a GOAL payload at all. Assert the
  // scoring golden still carries one *with an assist*, or a future rebaseline
  // could quietly restore a hash that covers nothing again.
  it('hashes a scoring match whose goals include an assist', () => {
    const result = goalGoldenMatch();
    const goals = result.events.filter(event => event.kind === 'GOAL');
    expect(goals.length).toBeGreaterThan(0);
    expect(goals.filter(goal => goal.kind === 'GOAL' && goal.assistedById !== undefined).length)
      .toBeGreaterThan(0);
  });
});
