import {
  nationalCupRoundSettlementAwards,
  resolveWeeklySettlementAwards,
  weeklySettlementAwardKeys,
} from '../weekly-settlement-awards';
import type { WeeklyLedger, WeeklySettlementAward } from '../types';

function playInAward() {
  return nationalCupRoundSettlementAwards({
    clubId: 'user-club',
    season: 2,
    roundNumber: 1,
    roundLabel: 'Play-in',
  }).awards[0];
}

function finalAward() {
  return nationalCupRoundSettlementAwards({
    clubId: 'user-club',
    season: 2,
    roundNumber: 6,
    roundLabel: 'Final',
  }).awards[0];
}

describe('weekly settlement awards', () => {
  test('builds the Cup cash and supporter award under one stable round key', () => {
    expect(playInAward()).toEqual({
      line: {
        kind: 'prize',
        label: 'Hero Cup Play-in win',
        // Dual-written, like the league prize beside it. Until this landed the
        // cup line had no key at all, so a cup run paid out in English forever.
        labelKey: 'ledger.cupRoundWin',
        labelParams: {
          cup: 'Hero Cup',
          cupKey: 'm2League.heroCup',
          round: 'Play-in',
          roundKey: 'm2League.cupRound.playIn',
        },
        amount: 2_000,
        idempotencyKey: 'cup-round:user-club:s2:r1',
      },
      fanGain: 6,
    });
  });

  test('pays $100,000 for winning the Hero Cup', () => {
    expect(finalAward()).toMatchObject({
      line: {
        labelKey: 'ledger.cupChampions',
        amount: 100_000,
      },
      fanGain: 120,
    });
  });

  test('collapses an identical duplicate without paying its cash or fans twice', () => {
    const award = playInAward();
    const duplicate: WeeklySettlementAward = {
      line: { ...award.line },
      fanGain: award.fanGain,
    };

    expect(
      resolveWeeklySettlementAwards([], { awards: [award, duplicate] }),
    ).toEqual({
      lines: [award.line],
      fanGain: 6,
    });
  });

  test('throws when one key is requested with a different payload', () => {
    const award = playInAward();
    const conflict: WeeklySettlementAward = {
      line: { ...award.line, amount: award.line.amount + 1 },
      fanGain: award.fanGain,
    };

    expect(() =>
      resolveWeeklySettlementAwards([], { awards: [award, conflict] }),
    ).toThrow('reused with a different payload');
  });

  test('treats an identical paid ledger line as a no-op and rejects a conflict', () => {
    const award = playInAward();
    const paid: WeeklyLedger = {
      season: 2,
      week: 6,
      lines: [{ ...award.line }],
      balanceAfter: 12_000,
    };

    expect(resolveWeeklySettlementAwards([paid], { awards: [award] })).toEqual({
      lines: [],
      fanGain: 0,
    });
    expect(() =>
      resolveWeeklySettlementAwards(
        [{ ...paid, lines: [{ ...award.line, amount: 1_999 }] }],
        { awards: [award] },
      ),
    ).toThrow('conflicts with a paid ledger line');
  });

  test('keeps award namespaces distinct across all planned cash sources', () => {
    const keys = [
      weeklySettlementAwardKeys.cupRound('user', 3, 2),
      weeklySettlementAwardKeys.leaguePrize('user', 3),
      weeklySettlementAwardKeys.recruitmentFund('user'),
      weeklySettlementAwardKeys.sponsorMonth('user', 3, 8),
      weeklySettlementAwardKeys.sponsorObjective('user', 3, 'slot-1'),
    ];

    expect(new Set(keys).size).toBe(keys.length);
  });
});
