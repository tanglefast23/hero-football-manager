import {
  PROMOTION_SURVIVAL_SUMMARY_VERSION,
  aggregatePromotionSurvivalShards,
  parsePromotionSurvivalShardSummary,
  promotionSurvivalSeed,
  type PromotionSurvivalRunSummary,
  type PromotionSurvivalShardSummary,
} from '../promotion-survival-summary';

describe('promotion survival shard summaries', () => {
  it('aggregates disjoint shards before enforcing cohort-level survival gates', () => {
    const summaries = [
      shard('COZY', 0, 50),
      shard('COZY', 50, 50),
      shard('CHAIRMAN', 0, 50),
      shard('CHAIRMAN', 50, 50),
    ];

    const aggregate = aggregatePromotionSurvivalShards(summaries, {
      expectedDifficulties: ['COZY', 'CHAIRMAN'],
      expectedSeedCount: 100,
    });

    expect(aggregate.cells).toEqual([
      expect.objectContaining({
        difficulty: 'COZY',
        seedCount: 100,
        promotedWithinTwo: 100,
        recruitmentResolved: 100,
        signed: 34,
        preparedSurvived: 60,
        medianPreparedPosition: 8,
      }),
      expect.objectContaining({
        difficulty: 'CHAIRMAN',
        seedCount: 100,
        promotedWithinTwo: 100,
        recruitmentResolved: 100,
        signed: 34,
        preparedSurvived: 60,
        medianPreparedPosition: 8,
      }),
    ]);
  });

  it('rejects a partial shard set instead of treating it as the full cohort', () => {
    expect(() => aggregatePromotionSurvivalShards([shard('COZY', 0, 50)], {
      expectedDifficulties: ['COZY'],
      expectedSeedCount: 100,
    })).toThrow(/exact contiguous range/);
  });

  it('rejects duplicate seed coverage across otherwise valid shards', () => {
    expect(() => aggregatePromotionSurvivalShards([
      shard('COZY', 0, 50),
      shard('COZY', 0, 50),
    ], {
      expectedDifficulties: ['COZY'],
      expectedSeedCount: 50,
    })).toThrow(/duplicated/);
  });

  it('enforces survival only after the exact aggregate is present', () => {
    const losing = shard('COZY', 0, 100, seedIndex => ({
      preparedPosition: seedIndex < 50 ? 8 : 9,
    }));
    expect(() => aggregatePromotionSurvivalShards([losing], {
      expectedDifficulties: ['COZY'],
      expectedSeedCount: 100,
    })).toThrow(/not above 50%/);
  });

  it('validates the deterministic seed identity in machine-readable input', () => {
    const summary = shard('COZY', 20, 2);
    const invalid = {
      ...summary,
      runs: [{ ...summary.runs[0], seed: 123 }, summary.runs[1]],
    };

    expect(parsePromotionSurvivalShardSummary(summary)).toEqual(summary);
    expect(() => parsePromotionSurvivalShardSummary(invalid)).toThrow(/does not match index/);
  });
});

function shard(
  difficulty: PromotionSurvivalShardSummary['difficulty'],
  seedOffset: number,
  seedCount: number,
  patch: (seedIndex: number) => { readonly preparedPosition?: number } = seedIndex => ({
    preparedPosition: seedIndex % 10 < 6 ? 8 : 9,
  }),
): PromotionSurvivalShardSummary {
  return {
    kind: 'promotion-survival-shard',
    schemaVersion: PROMOTION_SURVIVAL_SUMMARY_VERSION,
    difficulty,
    seedOffset,
    seedCount,
    throughWeek: 30,
    runs: Array.from({ length: seedCount }, (_, index) => {
      const seedIndex = seedOffset + index;
      const preparedPosition = patch(seedIndex).preparedPosition ?? 8;
      return run(seedIndex, preparedPosition);
    }),
  };
}

function run(seedIndex: number, preparedPosition: number): PromotionSurvivalRunSummary {
  return {
    seedIndex,
    seed: promotionSurvivalSeed(seedIndex),
    promotedInSeason: seedIndex % 2 + 1,
    prepared: {
      completed: true,
      played: 18,
      position: preparedPosition,
      points: 30,
      endingCash: 10_000 + seedIndex,
      recruitmentResolved: true,
      signed: seedIndex % 3 === 0,
    },
    control: {
      completed: true,
      played: 18,
      position: 9,
      points: 20,
      endingCash: 20_000 + seedIndex,
    },
  };
}
