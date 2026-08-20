import {
  CUP_DISPLAY_NAME,
  CUP_NAME_KEY,
  CUP_ROUND_NAME_KEYS,
  type NationalCupRound,
} from './pyramid';
import type {
  IdempotentLedgerLine,
  WeeklyLedger,
  WeeklySettlementAward,
  WeeklySettlementAwards,
} from './types';

export const EMPTY_WEEKLY_SETTLEMENT_AWARDS: WeeklySettlementAwards = {
  awards: [],
};

/**
 * These prefixes are part of the persisted ledger contract. Keep the identity
 * tied to the thing earned, never to a label that copy edits may change.
 */
export const weeklySettlementAwardKeys = {
  cupRound: (clubId: string, season: number, roundNumber: number): string =>
    `cup-round:${clubId}:s${season}:r${roundNumber}`,
  leaguePrize: (clubId: string, season: number): string =>
    `league-prize:${clubId}:s${season}`,
  recruitmentFund: (clubId: string): string =>
    `recruitment-fund:${clubId}:first-d4`,
  sponsorMonth: (
    clubId: string,
    season: number,
    week: number,
    contractId = 'basic',
  ): string => `sponsor-month:${clubId}:s${season}:w${week}:${contractId}`,
  sponsorObjective: (
    clubId: string,
    season: number,
    contractId: string,
  ): string => `sponsor-objective:${clubId}:s${season}:${contractId}`,
  sponsorWeeklyChallenge: (clubId: string, season: number): string =>
    `sponsor-weekly-challenge:${clubId}:s${season}`,
} as const;

const CUP_PRIZE_BY_ROUND: Readonly<Record<NationalCupRound['label'], number>> =
  {
    'Play-in': 2_000,
    'Round of 32': 3_000,
    'Round of 16': 4_000,
    'Quarter-final': 6_000,
    'Semi-final': 8_000,
    Final: 25_000,
  };

const CUP_FANS_BY_ROUND: Readonly<Record<NationalCupRound['label'], number>> = {
  'Play-in': 6,
  'Round of 32': 10,
  'Round of 16': 16,
  'Quarter-final': 24,
  'Semi-final': 36,
  Final: 120,
};

export function nationalCupRoundSettlementAwards(input: {
  readonly clubId: string;
  readonly season: number;
  readonly roundNumber: number;
  readonly roundLabel: NationalCupRound['label'];
}): WeeklySettlementAwards {
  return {
    awards: [
      {
        line: {
          kind: 'prize',
          // Never keyed at all until now, unlike the league prize beside it — so
          // a cup run paid out in English on the statement forever.
          label:
            input.roundLabel === 'Final'
              ? `${CUP_DISPLAY_NAME} champions`
              : `${CUP_DISPLAY_NAME} ${input.roundLabel} win`,
          labelKey:
            input.roundLabel === 'Final'
              ? 'ledger.cupChampions'
              : 'ledger.cupRoundWin',
          labelParams: {
            cup: CUP_DISPLAY_NAME,
            cupKey: CUP_NAME_KEY,
            round: input.roundLabel,
            roundKey: CUP_ROUND_NAME_KEYS[input.roundLabel],
          },
          amount: CUP_PRIZE_BY_ROUND[input.roundLabel],
          idempotencyKey: weeklySettlementAwardKeys.cupRound(
            input.clubId,
            input.season,
            input.roundNumber,
          ),
        },
        fanGain: CUP_FANS_BY_ROUND[input.roundLabel],
      },
    ],
  };
}

/**
 * Resolves an award bundle against every retained ledger. An exact retry is a
 * no-op; reusing a key for different money is a hard data error.
 */
export function resolveWeeklySettlementAwards(
  existingLedgers: readonly WeeklyLedger[],
  awards: WeeklySettlementAwards,
): { lines: IdempotentLedgerLine[]; fanGain: number } {
  const paidByKey = new Map<string, IdempotentLedgerLine>();
  for (const ledger of existingLedgers) {
    for (const line of ledger.lines) {
      if (line.idempotencyKey === undefined) continue;
      assertIdempotencyKey(line.idempotencyKey);
      const idempotentLine: IdempotentLedgerLine = {
        ...line,
        idempotencyKey: line.idempotencyKey,
      };
      const prior = paidByKey.get(line.idempotencyKey);
      if (prior !== undefined && !sameLine(prior, idempotentLine)) {
        throw new Error(
          `weekly settlement award key ${line.idempotencyKey} has conflicting ledger payloads`,
        );
      }
      paidByKey.set(line.idempotencyKey, idempotentLine);
    }
  }

  const requestedByKey = new Map<string, WeeklySettlementAward>();
  for (const award of awards.awards) {
    validateAward(award);
    const key = award.line.idempotencyKey;
    const prior = requestedByKey.get(key);
    if (prior !== undefined && !sameAward(prior, award)) {
      throw new Error(
        `weekly settlement award key ${key} was reused with a different payload`,
      );
    }
    if (prior === undefined) requestedByKey.set(key, award);
  }

  const lines: IdempotentLedgerLine[] = [];
  let fanGain = 0;
  for (const award of requestedByKey.values()) {
    const paid = paidByKey.get(award.line.idempotencyKey);
    if (paid !== undefined) {
      if (!sameLine(paid, award.line)) {
        throw new Error(
          `weekly settlement award key ${award.line.idempotencyKey} conflicts with a paid ledger line`,
        );
      }
      continue;
    }
    lines.push({ ...award.line });
    fanGain = checkedAdd(
      fanGain,
      award.fanGain ?? 0,
      'weekly settlement fan award',
    );
  }
  return { lines, fanGain };
}

function validateAward(award: WeeklySettlementAward): void {
  assertIdempotencyKey(award.line.idempotencyKey);
  if (!Number.isSafeInteger(award.line.amount) || award.line.amount <= 0) {
    throw new Error(
      'weekly settlement cash award must be a positive safe integer',
    );
  }
  if (
    award.fanGain !== undefined &&
    (!Number.isSafeInteger(award.fanGain) || award.fanGain < 0)
  ) {
    throw new Error(
      'weekly settlement fan award must be a nonnegative safe integer',
    );
  }
}

function assertIdempotencyKey(key: string): void {
  if (key.trim().length === 0)
    throw new Error('weekly settlement award key must not be empty');
}

function sameAward(
  left: WeeklySettlementAward,
  right: WeeklySettlementAward,
): boolean {
  return (
    sameLine(left.line, right.line) &&
    (left.fanGain ?? 0) === (right.fanGain ?? 0)
  );
}

function sameLine(
  left: IdempotentLedgerLine,
  right: IdempotentLedgerLine,
): boolean {
  return (
    left.idempotencyKey === right.idempotencyKey &&
    left.kind === right.kind &&
    left.label === right.label &&
    left.amount === right.amount
  );
}

function checkedAdd(left: number, right: number, label: string): number {
  const sum = left + right;
  if (!Number.isSafeInteger(sum))
    throw new Error(`${label} exceeds the safe integer range`);
  return sum;
}
