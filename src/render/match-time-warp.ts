/**
 * The renderer's own playback clock for a tier-2 shot: the pitch holds still at
 * the strike, then runs in bullet time until the shot resolves.
 *
 * The gate is danger, not the outcome. A goal is only known ticks after the
 * ball has left the boot, so gating on GOAL could only ever celebrate — the
 * point of a hit-stop is to make the flight itself tense. `shotTier` already
 * grades every shot off `shotDanger` (`1 - P(save)` against the keeper actually
 * facing it), so tier 2 is the band worth stopping the world for.
 *
 * Render ring only. This scales the wall-clock rate the frame loop feeds the
 * sim and the Atlas interpolation window. Tick order, RNG draws and events are
 * untouched, so no replay, no golden snapshot and no ENGINE_VERSION is
 * involved.
 */

/** How long the pitch holds completely still at the strike. */
export const MATCH_HIT_STOP_MS = 90;

/** Wall-clock rate multiplier once the hit-stop releases. */
export const MATCH_BULLET_TIME_RATE = 0.35;

/**
 * Safety release. A shot that never resolves — a deflection that keeps the ball
 * a shot, a stalled JS thread — must not leave the match in bullet time for
 * ever.
 *
 * Measured in WALL CLOCK, which is the trap: a flight of N sim ticks takes
 * `MATCH_HIT_STOP_MS + N * TICK_MS / MATCH_BULLET_TIME_RATE` of it. The first
 * value here was 2500ms, chosen against the sim duration and forgetting the
 * 0.35 stretch, so a ten-tick shot blew the cap at about tick 8 and finished at
 * full speed with the camera snapped wide. The test beside this file pins the
 * arithmetic to a flight long enough to cross most of the pitch.
 */
export const MATCH_TIME_WARP_MAX_MS = 5000;

/**
 * Integer magnification while the warp runs. The same step the power punch-in
 * uses, so the pixel grid holds and both effects read as one camera.
 */
export const MATCH_TIME_WARP_ZOOM = 2;

/**
 * Wall-clock rate multiplier at a given age of the warp: 0 through the
 * hit-stop, bullet time after it, and 1 once the safety release has passed.
 */
export function matchTimeWarpScale(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 1;
  if (elapsedMs >= MATCH_TIME_WARP_MAX_MS) return 1;
  if (elapsedMs < MATCH_HIT_STOP_MS) return 0;
  return MATCH_BULLET_TIME_RATE;
}

/** Whether the safety release has passed and the warp must be torn down. */
export function matchTimeWarpExpired(elapsedMs: number): boolean {
  return !Number.isFinite(elapsedMs) || elapsedMs >= MATCH_TIME_WARP_MAX_MS;
}
