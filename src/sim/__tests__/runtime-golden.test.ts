import { assertRuntimeGoldenReplay, runtimeGoldenFingerprint } from '../runtime-golden';

describe('runtime golden replay', () => {
  it('matches the full score and event-payload fingerprint in Node', () => {
    expect(() => assertRuntimeGoldenReplay()).not.toThrow();
    expect(runtimeGoldenFingerprint()).toMatch(/^[0-9a-f]{8}$/);
  });
});
