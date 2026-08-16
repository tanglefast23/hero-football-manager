import { keeperSaveProbability } from '../sim/engine';
import { playerAt } from '../sim/entities';
import type { BallState, MatchState } from '../sim/types';

/**
 * How frightening a shot is, and the visual grade that follows from it.
 *
 * Danger is the chance a shot beats the keeper it is actually facing, so it
 * keeps its meaning at every stat scale. `SHOT.power` does not: it is a log
 * projection of the shooter's SHO against distance that ignores the keeper
 * entirely, and cap-free development walks it past any fixed threshold. See
 * docs/adr/0001-shot-danger-is-keeper-relative.md for the measurements.
 *
 * Render-ring only. The sim neither knows nor cares that this exists — it
 * reads an exported sim seam and emits nothing back, so no replay, no event
 * and no ENGINE_VERSION is involved.
 */

/** Danger at or above which a shot draws the boot burst. */
export const SHOT_DANGER_TIER_1 = 0.33;
/** Danger at or above which a shot burns for its whole flight. */
export const SHOT_DANGER_TIER_2 = 0.5;

export type ShotTier = 0 | 1 | 2;

/**
 * The keeper a shot from `shooterTeam` has to beat. Slot 0 keeps goal for team
 * 0 and slot 11 for team 1, matching `shotFlightTick`'s own `gkIdx`.
 */
export function defendingKeeperIndex(shooterTeam: 0 | 1): number {
  return shooterTeam === 0 ? 11 : 0;
}

/**
 * `1 - P(save)` for a shot in flight, or `null` when the ball is not a shot or
 * either end of the contest is missing. Null means "draw it as ordinary": a
 * missing entity must never crash the render loop, and must never be read as
 * maximum danger.
 */
export function shotDanger(state: MatchState, ball: BallState): number | null {
  if (ball.kind !== 'shot') return null;
  const shooter = playerAt(state, ball.by);
  if (shooter === undefined) return null;
  const keeperIdx = defendingKeeperIndex(shooter.team);
  // keeperSaveProbability throws on an empty slot, so check before calling.
  if (playerAt(state, keeperIdx) === undefined) return null;
  // Keeper power bonuses are deliberately excluded. A keeper power that fires
  // mid-flight would otherwise change a number we promise to stamp once.
  const danger =
    1 - keeperSaveProbability(state, keeperIdx, ball.shotStrengthD64);
  if (!Number.isFinite(danger)) return null;
  return Math.max(0, Math.min(1, danger));
}

/**
 * The visual grade for a danger reading. Null danger grades as ordinary, so an
 * unreadable shot looks exactly like today rather than like a special one.
 */
export function shotTier(danger: number | null): ShotTier {
  if (danger === null) return 0;
  if (danger >= SHOT_DANGER_TIER_2) return 2;
  if (danger >= SHOT_DANGER_TIER_1) return 1;
  return 0;
}

/**
 * Burst intensity for a tier-1 shot, spread across the range danger actually
 * occupies. Measured danger tops out near 0.62, so mapping 0..1 straight onto
 * intensity would waste the top third of the dial — the mistake `power / 100`
 * made in the other direction.
 */
export function shotBurstIntensity(danger: number | null): number {
  if (danger === null) return 0;
  const span = 0.65 - SHOT_DANGER_TIER_1;
  return Math.max(0, Math.min(1, (danger - SHOT_DANGER_TIER_1) / span));
}
