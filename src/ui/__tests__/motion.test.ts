import {
  LIST_STAGGER_MS,
  MOTION_MS,
  listStaggerDelay,
  motionDuration,
} from '../motion';

describe('motion vocabulary', () => {
  it('keeps the steps ordered and distinct', () => {
    const steps = Object.values(MOTION_MS);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(new Set(steps).size).toBe(steps.length);
  });

  it('separates neighbouring steps enough to be felt as different', () => {
    // Two timings within ~30% of each other are the failure this table exists
    // to prevent: distinguishable enough to be inconsistent, not enough to read
    // as a deliberate choice.
    const steps = Object.values(MOTION_MS);
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i] / steps[i - 1]).toBeGreaterThan(1.3);
    }
  });

  it('collapses every step under reduced motion', () => {
    for (const step of Object.keys(MOTION_MS) as (keyof typeof MOTION_MS)[]) {
      expect(motionDuration(step, true)).toBe(0);
      expect(motionDuration(step, false)).toBe(MOTION_MS[step]);
    }
  });

  it('staggers a list in order and caps the tail', () => {
    expect(listStaggerDelay(0)).toBe(0);
    expect(listStaggerDelay(3)).toBe(3 * LIST_STAGGER_MS);
    // A long list must not still be arriving after the player has read it.
    expect(listStaggerDelay(50)).toBe(listStaggerDelay(8));
    expect(listStaggerDelay(50)).toBeLessThanOrEqual(400);
  });
});
