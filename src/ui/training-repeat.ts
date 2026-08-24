import { INSTANT_DRILL_CONDITION_COST } from '../game/training';
import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';

export const MAX_CONSECUTIVE_DRILLS = 9;
export const INJURY_RISK_CONDITION_THRESHOLD = 30;

/** Repeat choices are capped at nine and never promise more TP than is banked. */
export function maximumAffordableTrainingRuns(
  trainingPoints: number,
  trainingPointCost: number,
): number {
  if (trainingPointCost <= 0) return MAX_CONSECUTIVE_DRILLS;
  return Math.max(
    0,
    Math.min(
      MAX_CONSECUTIVE_DRILLS,
      Math.floor(trainingPoints / trainingPointCost),
    ),
  );
}

/** Repeat choices stop at the first drill that can fill the visible headroom. */
export function maximumVisibleTrainingRuns(
  currentValue: number,
  nextOrdinaryGain: number,
): number {
  const headroom = MAX_PLAYER_ATTRIBUTE - currentValue;
  return headroom <= 0
    ? 0
    : Math.ceil(headroom / Math.max(1, nextOrdinaryGain));
}

/**
 * A drill is safe when it STARTS at 30% condition or above. This returns how
 * many consecutive drills can begin before the next one crosses that line.
 */
export function maximumSafeTrainingRuns(condition: number): number {
  if (condition < INJURY_RISK_CONDITION_THRESHOLD) return 0;
  return Math.min(
    MAX_CONSECUTIVE_DRILLS,
    Math.floor(
      (condition - INJURY_RISK_CONDITION_THRESHOLD) /
        INSTANT_DRILL_CONDITION_COST,
    ) + 1,
  );
}

/** Number of selected drills whose own starting condition is below 30%. */
export function riskyTrainingRunCount(condition: number, runs: number): number {
  let riskyRuns = 0;
  for (let index = 0; index < runs; index += 1) {
    if (
      condition - index * INSTANT_DRILL_CONDITION_COST <
      INJURY_RISK_CONDITION_THRESHOLD
    ) {
      riskyRuns += 1;
    }
  }
  return riskyRuns;
}
