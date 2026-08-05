import {
  applyBuzzImpacts,
  applySupporterImpacts,
  createClubBusinessState,
  migratedEmptyBuzzState,
} from '../club-business';
import type { PendingUserMatchImpact } from '../club-business-types';

function impact(
  fixtureId: string,
  outcome: PendingUserMatchImpact['outcome'],
  options: Partial<PendingUserMatchImpact> = {},
): PendingUserMatchImpact {
  const scale = options.divisionScale ?? 1;
  const heroes = options.heroAppearancePlayerIds ?? [];
  const powerHeroes = options.powerFiredPlayerIds ?? [];
  const goals = options.regulationGoals ?? 0;
  return {
    fixtureId,
    competition: 'LEAGUE',
    settlementOrder: 0,
    source: 'PRODUCTION',
    outcome,
    regulationGoals: goals,
    participantPlayerIds: options.participantPlayerIds ?? heroes,
    powerFiredPlayerIds: powerHeroes,
    heroAppearancePlayerIds: heroes,
    divisionScale: scale,
    supporterWinUnits: outcome === 'WIN' ? 5 * scale : 0,
    supporterHeroUnits: heroes.length * scale,
    buzzWin: outcome === 'WIN' ? 4 : 0,
    buzzGoals: goals,
    buzzHeroMoments: powerHeroes.length * 2,
    ...options,
  };
}

describe('supporter growth and sustained-loss decline', () => {
  it('adds wins and actual hero appearances at the current division scale', () => {
    const result = applySupporterImpacts(
      { consecutiveLosses: 0 },
      500,
      [impact('w1', 'WIN', {
        divisionScale: 3,
        heroAppearancePlayerIds: ['h1', 'h2'],
        supporterWinUnits: 15,
        supporterHeroUnits: 6,
      })],
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
      [impact('third-loss', 'LOSS', {
        divisionScale: 3,
        heroAppearancePlayerIds: heroes,
        participantPlayerIds: heroes,
        supporterHeroUnits: 12,
      })],
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
    expect(applySupporterImpacts(
      { consecutiveLosses: 4 },
      500,
      [impact('draw', 'DRAW')],
      3,
      9,
    ).supporters.consecutiveLosses).toBe(0);

    expect(() => applySupporterImpacts(
      { consecutiveLosses: 0 },
      500,
      [
        impact('cup', 'WIN', { competition: 'CUP', settlementOrder: 1 }),
        impact('league', 'WIN', { settlementOrder: 0 }),
      ],
      3,
      9,
    )).toThrow(/league before Cup/);
  });
});

describe('Buzz earnings and twice-season payout', () => {
  it('adds wins, regulation goals, and distinct hero moments from Season 3', () => {
    const applied = applyBuzzImpacts(
      { value: 40 },
      [impact('league', 'WIN', {
        regulationGoals: 4,
        powerFiredPlayerIds: ['h1', 'h2'],
        buzzWin: 4,
        buzzGoals: 4,
        buzzHeroMoments: 4,
      })],
      3,
      14,
      4_000,
    );

    expect(applied.buzz.value).toBe(52);
    expect(applied.payout).toBeUndefined();
  });

  it('includes the Week 15 match, caps, pays from actual sponsor income, and resets', () => {
    const applied = applyBuzzImpacts(
      { value: 94 },
      [impact('week-15', 'WIN', {
        regulationGoals: 3,
        powerFiredPlayerIds: ['h1'],
        buzzWin: 4,
        buzzGoals: 3,
        buzzHeroMoments: 2,
      })],
      3,
      15,
      3_200,
    );

    expect(applied.payout).toEqual({
      amount: 3_200,
      half: 1,
      idempotencyKey: 'buzz/3/half-1',
      label: 'Buzz payout · First half',
    });
    expect(applied.buzz.value).toBe(0);
    expect(applied.buzz.lastSettlementSummary).toMatchObject({
      before: 94,
      rawEarned: 9,
      realizedEarned: 6,
      prePayoutValue: 100,
      payout: 3_200,
      resetValue: 0,
    });
  });

  it('does not earn before Season 3 or repay an already consumed half', () => {
    expect(applyBuzzImpacts(
      { value: 0 },
      [impact('locked', 'WIN')],
      2,
      15,
      2_000,
    )).toEqual({ buzz: { value: 0 } });

    const settled = { value: 0, lastSettledSeason: 3, lastSettledHalf: 1 as const };
    expect(applyBuzzImpacts(settled, [impact('retry', 'WIN')], 3, 15, 4_000))
      .toEqual({ buzz: settled });
  });
});

describe('schema-3 Club Business defaults', () => {
  it.each([
    [{ season: 2, week: 30, phase: 'season-end' as const, settledLedgerWeeks: [30] }, {}],
    [{ season: 3, week: 2, phase: 'manage' as const, settledLedgerWeeks: [] }, { lastSettledSeason: 2, lastSettledHalf: 2 }],
    [{ season: 3, week: 15, phase: 'matchday' as const, settledLedgerWeeks: [] }, { lastSettledSeason: 2, lastSettledHalf: 2 }],
    [{ season: 3, week: 15, phase: 'manage' as const, settledLedgerWeeks: [15] }, { lastSettledSeason: 3, lastSettledHalf: 1 }],
    [{ season: 3, week: 16, phase: 'manage' as const, settledLedgerWeeks: [15] }, { lastSettledSeason: 3, lastSettledHalf: 1 }],
    [{ season: 3, week: 30, phase: 'matchday' as const, settledLedgerWeeks: [15] }, { lastSettledSeason: 3, lastSettledHalf: 1 }],
    [{ season: 3, week: 30, phase: 'season-end' as const, settledLedgerWeeks: [15] }, { lastSettledSeason: 3, lastSettledHalf: 2 }],
  ])('maps the Buzz boundary without inventing cash: %j', (input, marker) => {
    expect(migratedEmptyBuzzState(input)).toEqual({ value: 0, ...marker });
  });

  it('creates empty supporter and pending-impact state without rewriting history', () => {
    expect(createClubBusinessState({ season: 3, week: 16, settledLedgerWeeks: [15] }))
      .toMatchObject({
        supporters: { consecutiveLosses: 0 },
        pendingUserMatchImpacts: [],
        sponsorship: { activeContracts: [], offers: [], portfolioSeason: 3 },
        buzz: { value: 0, lastSettledSeason: 3, lastSettledHalf: 1 },
      });
  });
});
