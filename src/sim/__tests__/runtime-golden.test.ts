import { assertRuntimeGoldenReplay, goalGoldenMatch } from '../runtime-golden';

describe('runtime golden replay', () => {
  it('matches the full score and event-payload fingerprints in Node', () => {
    expect(() => assertRuntimeGoldenReplay()).not.toThrow();
  });

  // The goalless seed 42 golden cannot see a GOAL payload at all. Assert the
  // scoring golden still carries goals of both kinds, or a rebaseline onto a
  // seed that only ever scores assisted goals would drop the omitted-field
  // branch while still looking like it covers assists.
  it('hashes a scoring match with both assisted and unassisted goals', () => {
    const { events } = goalGoldenMatch();
    const assisted = events.filter(
      (event) => event.kind === 'GOAL' && event.assistedById !== undefined,
    );
    const unassisted = events.filter(
      (event) => event.kind === 'GOAL' && event.assistedById === undefined,
    );
    expect(assisted.length).toBeGreaterThan(0);
    expect(unassisted.length).toBeGreaterThan(0);
  });
});
