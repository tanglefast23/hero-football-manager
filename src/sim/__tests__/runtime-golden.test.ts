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

  // scoredById is the m2.2 addition. Assert the golden actually hashes it, so a
  // future rebaseline onto a seed without goals cannot quietly stop covering it.
  it('stamps every golden goal with the shooter stable id', () => {
    const goals = goalGoldenMatch().events.filter(
      (event) => event.kind === 'GOAL',
    );
    expect(goals.length).toBeGreaterThan(0);
    for (const goal of goals) {
      if (goal.kind !== 'GOAL') continue;
      expect(typeof goal.scoredById).toBe('string');
      expect(goal.scoredById).toMatch(goal.team === 0 ? /^r/ : /^u/);
    }
  });
});
