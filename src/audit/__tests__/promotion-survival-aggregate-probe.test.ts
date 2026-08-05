/**
 * OPT-IN PROMOTION SURVIVAL AGGREGATOR.
 *
 * Point this at one fresh directory containing only shard JSON files from the
 * corrected production promotion-survival probe. It rejects missing, extra,
 * overlapping, stale-week, or wrong-seed evidence before enforcing the cohort
 * gates.
 *
 *   PROMOTION_SURVIVAL_SUMMARY_DIR=/tmp/hfm-promotion-survival \
 *   PROMOTION_SURVIVAL_EXPECTED_SEEDS=300 npm run test:probe -- \
 *     src/audit/__tests__/promotion-survival-aggregate-probe.test.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DifficultyMode } from '../../game';
import {
  aggregatePromotionSurvivalShards,
  parsePromotionSurvivalShardSummary,
} from '../promotion-survival-summary';

const SUMMARY_DIR = requiredNonemptyEnv('PROMOTION_SURVIVAL_SUMMARY_DIR');
const EXPECTED_SEEDS = positiveIntegerEnv('PROMOTION_SURVIVAL_EXPECTED_SEEDS', 300, 10_000);
const EXPECTED_DIFFICULTIES = promotionSurvivalDifficulties(
  process.env.PROMOTION_SURVIVAL_DIFFICULTY,
);

describe('promotion survival aggregate probe', () => {
  it('enforces gates only after exact contiguous shard coverage is present', () => {
    const directory = resolve(SUMMARY_DIR);
    const files = readdirSync(directory)
      .filter(name => name.startsWith('promotion-survival-') && name.endsWith('.json'))
      .sort();
    if (files.length === 0) {
      throw new Error(`no promotion survival shard JSON files found in ${directory}`);
    }
    const shards = files.map(name => parsePromotionSurvivalShardSummary(
      JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as unknown,
    ));
    const aggregate = aggregatePromotionSurvivalShards(shards, {
      expectedDifficulties: EXPECTED_DIFFICULTIES,
      expectedSeedCount: EXPECTED_SEEDS,
      throughWeek: 30,
    });

    expect(aggregate.cells).toHaveLength(EXPECTED_DIFFICULTIES.length);
    expect(aggregate.cells.every(cell => cell.seedCount === EXPECTED_SEEDS)).toBe(true);
    // eslint-disable-next-line no-console
    console.log(`PROMOTION_SURVIVAL_AGGREGATE_JSON ${JSON.stringify(aggregate)}`);
  });
});

function requiredNonemptyEnv(name: string): string {
  const raw = process.env[name];
  if (raw === undefined || raw.trim().length === 0) {
    throw new Error(`${name} must point to a fresh shard-summary directory`);
  }
  return raw.trim();
}

function positiveIntegerEnv(name: string, fallback: number, maximum: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum) {
    throw new Error(`${name} must be a safe positive integer no greater than ${maximum}`);
  }
  return value;
}

function promotionSurvivalDifficulties(raw: string | undefined): readonly DifficultyMode[] {
  if (raw === undefined || raw === 'ALL') return ['COZY', 'CHAIRMAN'];
  if (raw === 'COZY' || raw === 'CHAIRMAN') return [raw];
  throw new Error('PROMOTION_SURVIVAL_DIFFICULTY must be ALL, COZY, or CHAIRMAN');
}
