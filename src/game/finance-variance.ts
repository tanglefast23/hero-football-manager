import { mulberry32 } from '../sim/rng';
import type { LedgerLineReveal } from './types';

export type VarianceSource = LedgerLineReveal['source'];

/** Distinct stream per source: both gate lines share ledger kind 'tickets'. */
const SOURCE_SALT: Readonly<Record<VarianceSource, number>> = {
  'league-gate': 0x1f83d9ab,
  'cup-gate': 0x5be0cd19,
  merch: 0x9b05688c,
};

/**
 * Season-1 solvency contingency (spec §5): stays −10 unless the
 * opening-economy balance suite fails, in which case it becomes −5 — a
 * NARROWED UNIFORM band (−5…+10, 16 values, mean +2.5 → +3.8% EV per eligible
 * line), never a floor-clamp, which would pile 28.6% of rolls onto −5.
 */
export const SEASON_ONE_NORMAL_BAND_MIN = -10;

export interface VarianceRoll {
  /** normal band min…+10 when surge is false; 11…20 when surge is true. */
  percent: number;
  surge: boolean;
}

/**
 * The weekly income roll for one variance source. Seeded exclusively from
 * persisted career data (the deterministicCareerEventRoll pattern in
 * event-clock.ts), so save/reload can never re-spin and Quick Result banks
 * the same money as a watched match. Consumes no RNG from any other stream.
 */
export function matchdayVarianceRoll(
  careerSeed: number,
  season: number,
  week: number,
  source: VarianceSource,
): VarianceRoll {
  if (
    !Number.isSafeInteger(careerSeed) ||
    careerSeed < 0 ||
    careerSeed > 0xffffffff
  ) {
    throw new Error('variance careerSeed must be a uint32');
  }
  if (!Number.isSafeInteger(season) || season < 1) {
    throw new Error('variance season must be a positive integer');
  }
  if (!Number.isSafeInteger(week) || week < 1) {
    throw new Error('variance week must be a positive integer');
  }
  const seed =
    (careerSeed ^
      Math.imul(season, 0x9e3779b1) ^
      Math.imul(week, 0x85ebca6b) ^
      SOURCE_SALT[source]) >>>
    0;
  const rng = mulberry32(seed);
  const surge = Math.floor(rng() * 10) === 0;
  if (surge) return { percent: 11 + Math.floor(rng() * 10), surge };
  const min = season === 1 ? SEASON_ONE_NORMAL_BAND_MIN : -10;
  const span = 10 - min + 1;
  return { percent: min + Math.floor(rng() * span), surge };
}

/** round(base × (100+p)/100) — variance applies to the base, before multipliers. */
export function applyVariancePercent(base: number, percent: number): number {
  if (!Number.isSafeInteger(base) || base < 0) {
    throw new Error('variance base must be a nonnegative safe integer');
  }
  const scaled = base * (100 + percent);
  if (!Number.isSafeInteger(scaled)) {
    throw new Error('variance product exceeded safe integer range');
  }
  return Math.round(scaled / 100);
}
