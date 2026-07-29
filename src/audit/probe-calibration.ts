import type { TeamDef } from '../sim/types';

/**
 * Shared calibration for the balance probes.
 *
 * This exists because `scale` and the "even strength" constant were copy-pasted
 * across `power-firing-probe`, `hero-value-probe` and `multihero-value-probe`.
 * The copies drifted — a fixture fix landed in one of the three, which is why
 * RALLY_CRY reported as a completely dead power in one probe and as merely tiny
 * in another. One definition means a correction lands everywhere at once.
 */

/**
 * Uniformly shifts every attribute on a team, clamped to the legal 1..999 match
 * range. Used to synthesise an opponent a known number of rating points away.
 */
export function scaleTeam(team: TeamDef, delta: number): TeamDef {
  return {
    ...team,
    players: team.players.map(player => ({
      ...player,
      attrs: Object.fromEntries(
        Object.entries(player.attrs).map(([key, value]) => [
          key,
          Math.max(1, Math.min(999, value + delta)),
        ]),
      ) as unknown as typeof player.attrs,
    })),
  };
}

/**
 * The opponent delta at which the opening fixture is genuinely even.
 *
 * MEASURED 2026-07-25, 80 seeds, opening D5 teams, both sides FIRE_WHEN_READY:
 *
 * ```
 * user mean attr 35.66 | opponent mean attr 43.30 | gap 7.64
 * delta   ppm     W/D/L
 *  -12   1.550   37/13/30
 *  -10   1.325   30/16/34
 *   -8   0.813   18/11/51
 *   -5   0.463   10/ 7/63
 *   -2   0.138    2/ 5/73   <-- the previous constant
 *    0   0.063    1/ 2/77
 * ```
 *
 * The old value of -2 was justified by a comment claiming the opponent was "2
 * points stronger". The real gap is 7.64, and at -2 the user loses 91% of
 * matches — so every power-worth number published from that baseline was
 * measured inside a rout, where nothing can move points-per-match. That floor
 * effect, not weak design, is why seven of seventeen powers landed on the clamp
 * floor.
 *
 * Phase-A remeasurement under engine m2.0 (400 frozen seeds) found:
 *
 * ```
 *   -13   1.623
 *   -12   1.403  <-- closest to the locked 1.43 center
 *   -11   1.268
 *   -10   1.290
 * ```
 *
 * Re-measure this whenever team generation or the engine's shot/save model
 * changes; it is a measurement, not a preference.
 */
export const EVEN_DELTA = -12;

/**
 * Opponent deltas to sample when converting a points-per-match difference into
 * "worth in rating points". Centred on EVEN_DELTA so the ladder brackets the
 * even point instead of sitting entirely inside a rout.
 */
export const STRENGTH_LADDER: readonly number[] = [
  -16, -15, -14, -13, -12, -11, -10, -9, -8,
];
