import type { Rng } from './rng';
import table from './contest-table.json';
import conditionLogTable from './clog-table.json';
import { clamp } from './geometry';
import ratingLogTable from './log-table.json';
import resolveLogTable from './resolve-table.json';

export const D64_SCALE = 64;
const MAX_CONTEST_D64 = 99 * D64_SCALE;
export const LOG_RATIO_K = ratingLogTable.k;

function assertGeneratedTables(): void {
  if (!Number.isSafeInteger(LOG_RATIO_K)
    || LOG_RATIO_K < 1
    || conditionLogTable.k !== LOG_RATIO_K
    || resolveLogTable.k !== LOG_RATIO_K
    || ratingLogTable.values.length !== 999
    || conditionLogTable.values.length !== 101
    || resolveLogTable.values.length !== 101) {
    throw new Error('scale-invariant contest tables do not match the runtime contract');
  }
}

assertGeneratedTables();

export function ratingD64(rating: number): number {
  if (!Number.isSafeInteger(rating) || rating < 1 || rating > 999) {
    throw new Error('contest rating must be an integer from 1 to 999');
  }
  return ratingLogTable.values[rating - 1];
}

export function conditionD64(condition: number): number {
  const conditionIndex = clamp(Math.floor(condition), 0, 100);
  return conditionLogTable.values[conditionIndex];
}

export function resolveD64(resolve: number): number {
  const resolveIndex = clamp(Math.floor(resolve), 0, 100);
  return resolveLogTable.values[resolveIndex];
}

export function conditionedRatingD64(rating: number, condition: number): number {
  return ratingD64(rating) + conditionD64(condition);
}

/** P(attacker beats defender), interpolated at 1/64 of an old contest point. */
export function contestProbability(attackerD64: number, defenderD64: number, modD64 = 0): number {
  const differenceD64 = clamp(
    Math.round(attackerD64 + modD64 - defenderD64),
    -MAX_CONTEST_D64,
    MAX_CONTEST_D64,
  );
  const lowerDifference = Math.floor(differenceD64 / D64_SCALE);
  const remainder = differenceD64 - lowerDifference * D64_SCALE;
  const lowerValue = table[lowerDifference + 99];
  const upperValue = table[Math.min(198, lowerDifference + 100)];
  const interpolated = Math.round(
    (lowerValue * (D64_SCALE - remainder) + upperValue * remainder) / D64_SCALE,
  );
  return interpolated / 65536;
}

export function contest(
  rng: Rng,
  attackerD64: number,
  defenderD64: number,
  modD64 = 0,
): boolean {
  return rng() < contestProbability(attackerD64, defenderD64, modD64);
}
