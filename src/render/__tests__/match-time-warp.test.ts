import { TICK_MS } from '../../sim/geometry';
import {
  MATCH_BULLET_TIME_RATE,
  MATCH_HIT_STOP_MS,
  MATCH_TIME_WARP_MAX_MS,
  matchTimeWarpExpired,
  matchTimeWarpScale,
} from '../match-time-warp';

describe('match time warp', () => {
  it('holds the pitch still for the hit-stop', () => {
    expect(matchTimeWarpScale(0)).toBe(0);
    expect(matchTimeWarpScale(MATCH_HIT_STOP_MS - 1)).toBe(0);
  });

  it('runs bullet time once the hit-stop releases', () => {
    expect(matchTimeWarpScale(MATCH_HIT_STOP_MS)).toBe(MATCH_BULLET_TIME_RATE);
    expect(matchTimeWarpScale(MATCH_TIME_WARP_MAX_MS - 1)).toBe(
      MATCH_BULLET_TIME_RATE,
    );
  });

  it('releases to full speed at the safety cap, so a stuck shot cannot hang', () => {
    expect(matchTimeWarpScale(MATCH_TIME_WARP_MAX_MS)).toBe(1);
    expect(matchTimeWarpExpired(MATCH_TIME_WARP_MAX_MS - 1)).toBe(false);
    expect(matchTimeWarpExpired(MATCH_TIME_WARP_MAX_MS)).toBe(true);
  });

  it('holds a long flight to the end, stretch included', () => {
    // The cap is wall clock, but a flight is counted in sim ticks, and bullet
    // time makes each one take TICK_MS / rate of real time. A sixteen-tick
    // shot crosses most of the pitch; anything shorter must fit inside the cap
    // with the hit-stop on top, or the warp releases mid-flight.
    const LONG_FLIGHT_TICKS = 16;
    const wallClockMs =
      MATCH_HIT_STOP_MS +
      (LONG_FLIGHT_TICKS * TICK_MS) / MATCH_BULLET_TIME_RATE;
    expect(wallClockMs).toBeLessThan(MATCH_TIME_WARP_MAX_MS);
    expect(matchTimeWarpScale(wallClockMs)).toBe(MATCH_BULLET_TIME_RATE);
  });

  it('never returns a rate that would freeze play outside the warp', () => {
    expect(matchTimeWarpScale(-1)).toBe(1);
    expect(matchTimeWarpScale(Number.NaN)).toBe(1);
    expect(matchTimeWarpExpired(Number.NaN)).toBe(true);
  });
});
