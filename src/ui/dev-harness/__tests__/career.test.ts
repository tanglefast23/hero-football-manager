import {
  devHarnessCareer,
  devHarnessCareerAtSeasonEnd,
  devHarnessCareerAtWeek,
} from '../career';

/**
 * The shared seeded career the coming entries will ask for. Pure TypeScript,
 * so unlike the rest of the harness it can actually be run in Jest — and it is
 * the one part where a fault is invisible on screen: a career that stopped a
 * week early still renders, it just renders the wrong week.
 *
 * Seasons are kept to the first one. Every simulated week settles the whole
 * division, so reaching season 3 costs seconds, not milliseconds.
 */
describe('a seeded dev harness career', () => {
  it('stops in the management week it was asked for', () => {
    const state = devHarnessCareerAtWeek(1, 5);

    expect(state.phase).toBe('manage');
    expect(state.season).toBe(1);
    expect(state.week).toBe(5);
  });

  it('opens on week 1 without simulating anything', () => {
    const state = devHarnessCareerAtWeek(1, 1);

    expect(state.week).toBe(1);
    expect(
      state.fixtures.every((fixture) => fixture.status === 'scheduled'),
    ).toBe(true);
  });

  /** The whole point of a seed: one address, one career, every time. */
  it('returns the same career for the same request', () => {
    expect(devHarnessCareerAtWeek(1, 4)).toEqual(devHarnessCareerAtWeek(1, 4));
  });

  it('gives different seeds different careers', () => {
    const one = devHarnessCareerAtWeek(1, 6, 11);
    const other = devHarnessCareerAtWeek(1, 6, 22);

    expect(one.careerSeed).toBe(11);
    expect(other.careerSeed).toBe(22);
    expect(one.fixtures).not.toEqual(other.fixtures);
  });

  it('plays the weeks it passes through rather than skipping them', () => {
    const state = devHarnessCareerAtWeek(1, 6);

    expect(state.ledgers.length).toBeGreaterThan(0);
    expect(state.fixtures.some((fixture) => fixture.status === 'played')).toBe(
      true,
    );
  });

  it('caches, so a second request costs nothing', () => {
    // Same id, and a stop condition the second call would never satisfy: only
    // a cached answer can come back at all.
    const first = devHarnessCareer({
      id: 'cache-probe',
      stopAt: (state) => state.week === 3,
    });
    const second = devHarnessCareer({
      id: 'cache-probe',
      stopAt: () => false,
    });

    expect(second).toBe(first);
  });

  /** A stop that never fires is a bug in the entry, not a career to review. */
  it('throws rather than handing back a half-run career', () => {
    expect(() =>
      devHarnessCareer({
        id: 'never-stops',
        seasonBudget: 1,
        stopAt: () => false,
      }),
    ).toThrow('never reached its stopping point');
  });

  it('reaches the season boundary the season-end screens live at', () => {
    const state = devHarnessCareerAtSeasonEnd(1);

    expect(state.phase).toBe('season-end');
    expect(state.season).toBe(1);
    const seasonOne = state.fixtures.filter((fixture) => fixture.season === 1);
    expect(seasonOne.length).toBeGreaterThan(0);
    expect(seasonOne.every((fixture) => fixture.status === 'played')).toBe(
      true,
    );
  });
});
