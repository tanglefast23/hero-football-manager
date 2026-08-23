import {
  FIREWORK_CELL,
  FIREWORK_SHELL_IDS,
  fireworkBursts,
  fireworkShellKeyframes,
  fireworkShellRuns,
} from '../endgame-fireworks';

describe('firework shells', () => {
  it('ships three shapes and no image files', () => {
    expect(FIREWORK_SHELL_IDS.length).toBe(3);
  });

  it.each(FIREWORK_SHELL_IDS)('draws %s inside its own cell', (shellId) => {
    const runs = fireworkShellRuns(shellId);

    expect(runs.length).toBeGreaterThan(0);
    runs.forEach((run) => {
      expect(run.x).toBeGreaterThanOrEqual(0);
      expect(run.y).toBeGreaterThanOrEqual(0);
      expect(run.y).toBeLessThan(FIREWORK_CELL);
      expect(run.width).toBeGreaterThan(0);
      expect(run.x + run.width).toBeLessThanOrEqual(FIREWORK_CELL);
    });
  });

  /**
   * Runs are same-colour spans, so two of them may never touch on one row: a
   * split that produced neighbours would mean a run was cut for no reason and
   * the shell costs more rects than it needs.
   */
  it.each(FIREWORK_SHELL_IDS)('merges every same-ink span of %s', (shellId) => {
    const runs = fireworkShellRuns(shellId);
    const byRow = new Map<number, typeof runs>();
    runs.forEach((run) => byRow.set(run.y, [...(byRow.get(run.y) ?? []), run]));

    byRow.forEach((row) => {
      const ordered = [...row].sort((left, right) => left.x - right.x);
      ordered.forEach((run, index) => {
        const previous = ordered[index - 1];
        if (previous === undefined) return;
        const touching = previous.x + previous.width === run.x;
        expect(touching && previous.opacity === run.opacity).toBe(false);
      });
    });
  });

  it('uses the shell ink and its dimmer trailing spark, and nothing else', () => {
    const opacities = new Set(
      FIREWORK_SHELL_IDS.flatMap((shellId) =>
        fireworkShellRuns(shellId).map((run) => run.opacity),
      ),
    );

    expect([...opacities].sort()).toEqual([0.55, 1]);
  });

  it('refuses a shell it does not have', () => {
    expect(() => fireworkShellRuns('burst-nope')).toThrow(
      'unknown firework shell',
    );
  });
});

describe('the firework display', () => {
  it('keeps wrapped shell keyframes in chronological order', () => {
    const failing = fireworkShellKeyframes(0.88);
    const rounded = failing.inputRange.map(
      (value) => Math.round(value * 100) / 100,
    );

    expect(rounded).toEqual([0, 0.04, 0.22, 0.88, 1]);
    expect(rounded).not.toEqual([0, 0.22, 0.88, 0.04, 1]);
  });

  it.each([0.5, 0.7, 0.84, 0.88, 0.99])(
    'builds valid animation ranges at phase %s',
    (phase) => {
      expectValidKeyframes(fireworkShellKeyframes(phase));
    },
  );

  /**
   * The true ending re-renders on every tap and every rotation. A rolled layout
   * would rearrange the whole sky under the man who is mid-sentence.
   */
  it('lays the same sky out every time for the same scene', () => {
    expect(fireworkBursts('true-ending', 5)).toEqual(
      fireworkBursts('true-ending', 5),
    );
    expect(fireworkBursts('true-ending', 5)).not.toEqual(
      fireworkBursts('global-league', 5),
    );
  });

  it('keeps every shell in the sky above the stand', () => {
    fireworkBursts('true-ending', 5).forEach((burst) => {
      expect(burst.leftPercent).toBeGreaterThanOrEqual(0);
      expect(burst.leftPercent).toBeLessThanOrEqual(95);
      expect(burst.topPercent).toBeGreaterThanOrEqual(0);
      // The horizon is at 46% of the screen (`HORIZON_PERCENT`); a shell that
      // opens below this is going off behind the stand.
      expect(burst.topPercent).toBeLessThan(36);
      expect(burst.scale).toBeGreaterThan(0);
    });
  });

  /**
   * Staggered phases are the whole point: five shells firing together is one
   * flash, five spread across the loop is a sky that keeps going while somebody
   * talks over it.
   */
  it('spreads the shells across the loop rather than firing them together', () => {
    const phases = fireworkBursts('true-ending', 5).map((burst) => burst.phase);

    expect(new Set(phases).size).toBe(phases.length);
    phases.forEach((phase) => {
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
    });
  });

  it('picks a colour every palette can answer', () => {
    fireworkBursts('true-ending', 6, 3).forEach((burst) => {
      expect(burst.colorIndex).toBeGreaterThanOrEqual(0);
      expect(burst.colorIndex).toBeLessThan(3);
      expect(FIREWORK_SHELL_IDS).toContain(burst.shellId);
    });
  });

  it('has an empty sky rather than a broken one when asked for no shells', () => {
    expect(fireworkBursts('true-ending', 0)).toEqual([]);
  });

  it.each([
    ['true-ending', 5],
    ['global-league', 5],
    ['cup-winners', 3],
  ] as const)('gives every %s shell valid keyframes', (scene, count) => {
    fireworkBursts(scene, count).forEach((burst) => {
      expectValidKeyframes(fireworkShellKeyframes(burst.phase));
    });
  });
});

function expectValidKeyframes(
  keyframes: ReturnType<typeof fireworkShellKeyframes>,
): void {
  expect(keyframes.inputRange).toHaveLength(keyframes.opacityRange.length);
  expect(keyframes.inputRange).toHaveLength(keyframes.scaleRange.length);
  keyframes.inputRange.forEach((value, index, range) => {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
    if (index > 0) expect(value).toBeGreaterThanOrEqual(range[index - 1]);
  });
  keyframes.opacityRange.forEach((value) => {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  });
  keyframes.scaleRange.forEach((value) => expect(value).toBeGreaterThan(0));
}
