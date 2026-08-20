import {
  applySupporterImpacts,
  createClubBusinessState,
} from '../club-business';
import type { PendingUserMatchImpact } from '../club-business-types';

function impact(
  fixtureId: string,
  outcome: PendingUserMatchImpact['outcome'],
  options: Partial<PendingUserMatchImpact> = {},
): PendingUserMatchImpact {
  const scale = options.divisionScale ?? 1;
  const heroes = options.heroAppearancePlayerIds ?? [];
  const goals = options.regulationGoals ?? 0;
  return {
    fixtureId,
    competition: 'LEAGUE',
    settlementOrder: 0,
    source: 'PRODUCTION',
    outcome,
    regulationGoals: goals,
    participantPlayerIds: options.participantPlayerIds ?? heroes,
    powerFiredPlayerIds: options.powerFiredPlayerIds ?? [],
    heroAppearancePlayerIds: heroes,
    divisionScale: scale,
    supporterWinUnits: outcome === 'WIN' ? 5 * scale : 0,
    supporterHeroUnits: heroes.length * scale,
    ...options,
  };
}

describe('supporter growth and sustained-loss decline', () => {
  it('adds wins and actual hero appearances at the current division scale', () => {
    const result = applySupporterImpacts(
      { consecutiveLosses: 0 },
      500,
      [
        impact('w1', 'WIN', {
          divisionScale: 3,
          heroAppearancePlayerIds: ['h1', 'h2'],
          supporterWinUnits: 15,
          supporterHeroUnits: 6,
        }),
      ],
      3,
      8,
    );

    expect(result.fanCount).toBe(521);
    expect(result.positiveFanGain).toBe(21);
    expect(result.supporters.consecutiveLosses).toBe(0);
    expect(result.supporters.lastAppliedImpact?.totalDelta).toBe(21);
  });

  it('declines slowly only from the third loss and loses 22 over seven D5 losses', () => {
    let supporters = { consecutiveLosses: 0 };
    let fanCount = 500;
    const deltas: number[] = [];
    for (let number = 1; number <= 7; number += 1) {
      const applied = applySupporterImpacts(
        supporters,
        fanCount,
        [impact(`loss-${number}`, 'LOSS')],
        1,
        number,
      );
      deltas.push(applied.fanCount - fanCount);
      supporters = applied.supporters;
      fanCount = applied.fanCount;
    }

    expect(deltas).toEqual([0, 0, -3, -4, -5, -5, -5]);
    expect(fanCount).toBe(478);
  });

  it('guarantees a scaled net loss from the third defeat even with four heroes', () => {
    const heroes = ['h1', 'h2', 'h3', 'h4'];
    const applied = applySupporterImpacts(
      { consecutiveLosses: 2 },
      1_500,
      [
        impact('third-loss', 'LOSS', {
          divisionScale: 3,
          heroAppearancePlayerIds: heroes,
          participantPlayerIds: heroes,
          supporterHeroUnits: 12,
        }),
      ],
      4,
      10,
    );

    expect(applied.fanCount).toBe(1_497);
    expect(applied.supporters.lastAppliedImpact?.impacts[0]).toMatchObject({
      resultDelta: -9,
      heroDelta: 12,
      realizedDelta: -3,
    });
  });

  it('resets the streak on a draw and enforces league-before-Cup ordering', () => {
    expect(
      applySupporterImpacts(
        { consecutiveLosses: 4 },
        500,
        [impact('draw', 'DRAW')],
        3,
        9,
      ).supporters.consecutiveLosses,
    ).toBe(0);

    expect(() =>
      applySupporterImpacts(
        { consecutiveLosses: 0 },
        500,
        [
          impact('cup', 'WIN', { competition: 'CUP', settlementOrder: 1 }),
          impact('league', 'WIN', { settlementOrder: 0 }),
        ],
        3,
        9,
      ),
    ).toThrow(/league before Cup/);
  });
});

describe('schema-3 Club Business defaults', () => {
  it('creates empty supporter and pending-impact state without rewriting history', () => {
    expect(createClubBusinessState({ season: 3 })).toEqual({
      supporters: { consecutiveLosses: 0 },
      pendingUserMatchImpacts: [],
      sponsorship: { activeContracts: [], offers: [], portfolioSeason: 3 },
    });
  });
});
