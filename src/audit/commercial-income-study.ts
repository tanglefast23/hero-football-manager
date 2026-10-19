/**
 * Summaries for the opt-in commercial measurement.
 *
 * Candidates stay unapproved. This module does not change a price or a percent.
 */
import type { DifficultyMode, DivisionLevel } from '../game';
import { CLUB_BUSINESS_LONG_CAREER_CENSOR_POSITION } from './club-business-long-career-harness';
import type {
  ClubBusinessLongCareerResult,
  LongCareerGreenBullPolicy,
  LongCareerInvestmentPolicy,
  LongCareerMatchPolicy,
} from './club-business-long-career-harness';
import type { CupCatchUpStudy } from './cup-catchup-study';

export const COMMERCIAL_MEASUREMENT_SEEDS = [20261019, 20261020] as const;
export const COMMERCIAL_MEASUREMENT_SEED = COMMERCIAL_MEASUREMENT_SEEDS[0];

export interface CommercialArm {
  readonly seed: number;
  readonly difficulty: DifficultyMode;
  readonly matchPolicy: LongCareerMatchPolicy;
  readonly investment: LongCareerInvestmentPolicy;
  readonly greenBull: LongCareerGreenBullPolicy;
  readonly acceptWeek19Trip: boolean;
  readonly maxSeasons: number;
}

export interface CommercialArmSummary {
  readonly seed: number;
  readonly difficulty: DifficultyMode;
  readonly matchPolicy: LongCareerMatchPolicy;
  readonly investment: LongCareerInvestmentPolicy;
  readonly greenBull: LongCareerGreenBullPolicy;
  readonly acceptWeek19Trip: boolean;
  readonly seasonHorizon: number;
  readonly elapsedMs: number;
  readonly censored: boolean;
  readonly completedFirstD1: boolean;
  readonly firstD1GatePosition: number;
  readonly endingCash: number;
  readonly endingFans: number;
  readonly minimumObservedCash: number;
  readonly seasons: readonly {
    readonly season: number;
    readonly division: DivisionLevel;
    readonly position: number;
    readonly played: number;
    readonly won: number;
    readonly drawn: number;
    readonly lost: number;
    readonly points: number;
    readonly promoted: boolean;
    readonly relegated: boolean;
    readonly endingCash: number;
    readonly endingFans: number;
    readonly ticketIncome: number;
    readonly merchandiseIncome: number;
    readonly sponsorIncome: number;
    readonly prizeAndSubsidyIncome: number;
    readonly wageExpense: number;
    readonly facilityUpkeepExpense: number;
    readonly loanRepaymentExpense: number;
    readonly safetyIncome: number;
    readonly facilityCapitalSpend: number;
    readonly scoutingSpend: number;
    readonly transferSpend: number;
    readonly transferSaleIncome: number;
    readonly boardForcedSales: number;
    readonly emergencyLoans: number;
    readonly boardRescues: number;
  }[];
  readonly totals: ClubBusinessLongCareerResult['totals'];
  readonly measurement: ClubBusinessLongCareerResult['measurement'];
}

export function productionArms(maxSeasons: number): CommercialArm[] {
  const arms: CommercialArm[] = [];
  for (const seed of COMMERCIAL_MEASUREMENT_SEEDS) {
    for (const difficulty of ['COZY', 'CHAIRMAN'] as const) {
      for (const investment of ['BALANCED', 'COMMERCIAL_STACK'] as const) {
        for (const greenBull of ['NONUSE', 'USE'] as const) {
          arms.push({
            seed,
            difficulty,
            matchPolicy: 'PRODUCTION_QUICK',
            investment,
            greenBull,
            acceptWeek19Trip: true,
            maxSeasons,
          });
        }
      }
    }
  }
  return arms;
}

export function lockedArms(maxSeasons: number): CommercialArm[] {
  return COMMERCIAL_MEASUREMENT_SEEDS.flatMap((seed) =>
    (['COZY', 'CHAIRMAN'] as const).map((difficulty) => ({
      seed,
      difficulty,
      matchPolicy: 'HARNESS_LOCKED' as const,
      investment: 'BALANCED' as const,
      greenBull: 'NONUSE' as const,
      acceptWeek19Trip: false,
      maxSeasons,
    })),
  );
}

export function summarizeCommercialArm(
  result: ClubBusinessLongCareerResult,
  arm: CommercialArm,
  elapsedMs: number,
): CommercialArmSummary {
  if (result.seed !== arm.seed || result.difficulty !== arm.difficulty) {
    throw new Error(
      'commercial measurement result does not match its seed and difficulty',
    );
  }
  return {
    seed: result.seed,
    difficulty: result.difficulty,
    matchPolicy: arm.matchPolicy,
    investment: arm.investment,
    greenBull: arm.greenBull,
    acceptWeek19Trip: arm.acceptWeek19Trip,
    seasonHorizon: result.seasons.length,
    elapsedMs,
    censored: result.censored,
    completedFirstD1: result.completedFirstD1,
    firstD1GatePosition: result.firstD1GatePosition,
    endingCash: result.endingCash,
    endingFans: result.endingFans,
    minimumObservedCash: result.minimumObservedCash,
    seasons: result.seasons.map((season) => ({
      season: season.season,
      division: season.division,
      position: season.position,
      played: season.played,
      won: season.won,
      drawn: season.drawn,
      lost: season.lost,
      points: season.points,
      promoted: season.promoted,
      relegated: season.relegated,
      endingCash: season.endingCash,
      endingFans: season.endingFans,
      ticketIncome: season.ticketIncome,
      merchandiseIncome: season.merchandiseIncome,
      sponsorIncome: season.sponsorIncome,
      prizeAndSubsidyIncome: season.prizeAndSubsidyIncome,
      wageExpense: season.wageExpense,
      facilityUpkeepExpense: season.facilityUpkeepExpense,
      loanRepaymentExpense: season.loanRepaymentExpense,
      safetyIncome: season.safetyIncome,
      facilityCapitalSpend: season.facilityCapitalSpend,
      scoutingSpend: season.scoutingSpend,
      transferSpend: season.transferSpend,
      transferSaleIncome: season.transferSaleIncome,
      boardForcedSales: season.boardForcedSales,
      emergencyLoans: season.emergencyLoans,
      boardRescues: season.boardRescues,
    })),
    totals: result.totals,
    measurement: result.measurement,
  };
}

function sumSeasons(
  arm: CommercialArmSummary,
  pick: (season: CommercialArmSummary['seasons'][number]) => number,
): number {
  return arm.seasons.reduce((sum, season) => sum + pick(season), 0);
}

function findArm(
  arms: readonly CommercialArmSummary[],
  seed: number,
  difficulty: DifficultyMode,
  investment: LongCareerInvestmentPolicy,
  greenBull: LongCareerGreenBullPolicy,
): CommercialArmSummary | undefined {
  return arms.find(
    (arm) =>
      arm.seed === seed &&
      arm.matchPolicy === 'PRODUCTION_QUICK' &&
      arm.difficulty === difficulty &&
      arm.investment === investment &&
      arm.greenBull === greenBull,
  );
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export interface PenaltyCalibrationStat {
  readonly name: string;
  readonly runs: number;
  readonly homeWins: number;
  readonly homeWinRate: number;
  readonly kickConversion: number;
}

export function renderMeasurementReport(input: {
  readonly cup: CupCatchUpStudy;
  readonly arms: readonly CommercialArmSummary[];
  readonly penaltyStats: readonly PenaltyCalibrationStat[];
  readonly lockedOmitted: boolean;
  readonly seasonHorizon: number;
}): string {
  const production = input.arms.filter(
    (arm) => arm.matchPolicy === 'PRODUCTION_QUICK',
  );
  const greenBullRows = production.map((arm) => ({
    label: `${arm.seed} ${arm.difficulty} ${arm.investment} ${arm.greenBull}`,
    bestDivision: Math.min(...arm.seasons.map((season) => season.division)),
    acceptances: arm.measurement?.greenBullAcceptances.length ?? 0,
    cash: (arm.measurement?.greenBullAcceptances ?? []).reduce(
      (sum, acceptance) => sum + acceptance.cashCost,
      0,
    ),
  }));
  const greenBullAcceptances = greenBullRows.reduce(
    (sum, row) => sum + row.acceptances,
    0,
  );
  const reachedGreenBullDivision = greenBullRows.some(
    (row) => row.bestDivision <= 3,
  );
  const tripLines = production.flatMap((arm) =>
    (arm.measurement?.week19Trips ?? []).map(
      (trip) =>
        `${arm.seed} ${arm.difficulty} ${arm.investment} ${arm.greenBull} D${trip.division}: approved ${trip.approvedCost} TP, original whole bank ${trip.originalWholeBankCost} TP, preserved ${trip.preservedTrainingPoints} TP`,
    ),
  );
  const seeds = [...new Set(production.map((arm) => arm.seed))];
  let comparedPairs = 0;
  let stackCashHigher = 0;
  let stackCashLower = 0;
  const comparisons = seeds.flatMap((seed) =>
    (['COZY', 'CHAIRMAN'] as const).flatMap((difficulty) =>
      (['NONUSE', 'USE'] as const).flatMap((greenBull) => {
        const balanced = findArm(
          production,
          seed,
          difficulty,
          'BALANCED',
          greenBull,
        );
        const stack = findArm(
          production,
          seed,
          difficulty,
          'COMMERCIAL_STACK',
          greenBull,
        );
        if (balanced === undefined || stack === undefined) return [];
        comparedPairs += 1;
        if (stack.endingCash > balanced.endingCash) stackCashHigher += 1;
        if (stack.endingCash < balanced.endingCash) stackCashLower += 1;
        return [
          `${seed} ${difficulty} ${greenBull}: stack ticket ${sumSeasons(stack, (season) => season.ticketIncome) - sumSeasons(balanced, (season) => season.ticketIncome)}, merchandise ${sumSeasons(stack, (season) => season.merchandiseIncome) - sumSeasons(balanced, (season) => season.merchandiseIncome)}, ending cash ${stack.endingCash - balanced.endingCash}, points ${sumSeasons(stack, (season) => season.points) - sumSeasons(balanced, (season) => season.points)}`,
        ];
      }),
    ),
  );
  const spreadLines = (['BALANCED', 'COMMERCIAL_STACK'] as const).flatMap(
    (investment) =>
      (['NONUSE', 'USE'] as const).map((greenBull) => {
        const cash = production
          .filter(
            (arm) =>
              arm.investment === investment && arm.greenBull === greenBull,
          )
          .map((arm) => arm.endingCash);
        const mid = median(cash);
        if (cash.length === 0 || mid === undefined) return '';
        return `${investment} ${greenBull}: n=${cash.length}, median ending cash ${mid}, min ${Math.min(...cash)}, max ${Math.max(...cash)}`;
      }),
  );
  const cupRows = input.cup.rows.filter((row) => row.kind === 'paired');
  const cupLines = (['Semi-final', 'Final'] as const).flatMap((round) =>
    input.cup.gaps.flatMap((gap) => {
      const none = cupRows.filter(
        (row) =>
          row.roundLabel === round &&
          row.gapTarget === gap &&
          row.arm === 'none',
      );
      const catchup = cupRows.filter(
        (row) =>
          row.roundLabel === round &&
          row.gapTarget === gap &&
          row.arm === 'catchup',
      );
      if (none.length === 0 && catchup.length === 0) return [];
      const userMargin = (row: (typeof none)[number]) => {
        const userGoals =
          row.userClubId === row.homeClubId
            ? row.regulationHomeGoals
            : row.regulationAwayGoals;
        const opponentGoals =
          row.userClubId === row.homeClubId
            ? row.regulationAwayGoals
            : row.regulationHomeGoals;
        return userGoals - opponentGoals;
      };
      const mean = (
        rows: typeof none,
        pick: (row: (typeof none)[number]) => number,
      ) =>
        rows.length === 0
          ? 'n/a'
          : (
              rows.reduce((sum, row) => sum + pick(row), 0) / rows.length
            ).toFixed(1);
      const tally = (rows: typeof none) =>
        `${rows.filter((row) => row.regulationOutcome === 'WIN').length} regulation wins, ${rows.filter((row) => row.regulationOutcome === 'DRAW').length} draws, ${rows.filter((row) => row.regulationOutcome === 'LOSS').length} regulation losses, mean user margin ${mean(rows, userMargin)}, mean played opponent rating ${mean(rows, (row) => row.playedOpponentAttrRating)}`;
      return [
        `${round} gap ${gap} (n=${none.length}): none ${tally(none)}; catch-up ${tally(catchup)}`,
      ];
    }),
  );
  const penaltyLines = input.penaltyStats.map(
    (stat) =>
      `${stat.name}: ${stat.homeWins}/${stat.runs} home wins (${stat.runs > 0 ? stat.homeWins / stat.runs : 'n/a'}), kick conversion ${stat.kickConversion}`,
  );
  const useMirrorsNonUse = seeds.every((seed) =>
    (['COZY', 'CHAIRMAN'] as const).every((difficulty) =>
      (['BALANCED', 'COMMERCIAL_STACK'] as const).every((investment) => {
        const used = findArm(production, seed, difficulty, investment, 'USE');
        const unused = findArm(
          production,
          seed,
          difficulty,
          investment,
          'NONUSE',
        );
        if (used === undefined || unused === undefined) return false;
        return (
          used.endingCash === unused.endingCash &&
          sumSeasons(used, (season) => season.ticketIncome) ===
            sumSeasons(unused, (season) => season.ticketIncome) &&
          sumSeasons(used, (season) => season.points) ===
            sumSeasons(unused, (season) => season.points)
        );
      }),
    ),
  );
  const lateCups = production.flatMap(
    (arm) => arm.measurement?.cupMatches ?? [],
  );
  const lateTriggers = lateCups.filter((match) => match.catchupWouldTrigger);
  const careerRounds = [...new Set(lateCups.map((match) => match.roundLabel))];
  return [
    '# Commercial and Cup measurement',
    '',
    'Measurement only. No price, percent, or income multiplier was applied.',
    '',
    input.seasonHorizon === 1
      ? 'This file is the one-season smoke. It is not the three-season cohort. Green Bull does not unlock in a first D5 season, so a zero acceptance count here is not a spend sample.'
      : `This file is the ${input.seasonHorizon}-season cohort. It is not the one-season smoke.`,
    '',
    `Career seeds ${[...new Set([...input.cup.rows.map((row) => row.seed), ...production.map((arm) => arm.seed)])].join(', ')}. Cup pairing uses each seed on Cozy and Chairman. A short horizon is not a first-D1 gate result. firstD1GatePosition ${CLUB_BUSINESS_LONG_CAREER_CENSOR_POSITION} on these runs is the censor placeholder, not a league finish.`,
    '',
    'Income figures come from the long-career ledger after real Quick matches. Scaled Cup matches are not used as income.',
    '',
    'Measurement arms hire the cheapest affordable assistant when that inbox duty is open. The current game blocks the week until the hire. The default harness call does not take that hire.',
    '',
    '## Week 19',
    '',
    'The approved rule charges at most one week of TP. The original whole-bank cost is recorded and not charged. Green Bull is unchanged and still drains the whole bank.',
    '',
    ...(tripLines.length === 0 ? ['No Week 19 trip was recorded.'] : tripLines),
    '',
    `Green Bull acceptances: ${greenBullAcceptances}.`,
    ...(reachedGreenBullDivision
      ? [
          ...greenBullRows
            .filter((row) => row.acceptances > 0)
            .map(
              (row) =>
                `${row.label}: ${row.acceptances} acceptances, cash ${row.cash}`,
            ),
          ...(greenBullAcceptances === 0
            ? [
                'At least one career reached D3, D2, or D1, and the acceptance count is still 0.',
              ]
            : []),
        ]
      : [
          'No career played a D3, D2, or D1 season. Green Bull is offered only in those divisions, so USE and NONUSE both had zero offers. The acceptance count is 0. This horizon is not a Green Bull price sample.',
        ]),
    '',
    '## Commercial arms',
    '',
    ...production.flatMap((arm) => {
      const last = arm.measurement?.purchasingPower.at(-1);
      const facility =
        last?.nextFacilityCost === undefined
          ? 'no next legal facility action'
          : `${last.endingCash} / ${last.nextFacilityCost} = ${(last.endingCash / last.nextFacilityCost).toFixed(2)}x (${last.nextFacilityLabel})`;
      const starter =
        last?.weakestStarterValuation === undefined
          ? 'no valued starter'
          : `${last.endingCash} / ${last.weakestStarterValuation} = ${(last.endingCash / last.weakestStarterValuation).toFixed(2)}x`;
      const purchasing =
        last === undefined
          ? 'purchasing power: not recorded'
          : `purchasing power S${last.season}: facility ${facility}; lowest starter valuation ${starter} (valuation proxy, not an offered transfer fee); stands ${last.standCount}; shops ${last.shopCount}`;
      return [
        `${arm.seed} ${arm.difficulty} ${arm.investment} ${arm.greenBull}: best D${Math.min(...arm.seasons.map((season) => season.division))}, ending cash ${arm.endingCash}, fans ${arm.endingFans}, ticket ${sumSeasons(arm, (season) => season.ticketIncome)}, merchandise ${sumSeasons(arm, (season) => season.merchandiseIncome)}, sponsor ${sumSeasons(arm, (season) => season.sponsorIncome)}, prizes ${sumSeasons(arm, (season) => season.prizeAndSubsidyIncome)}, wages ${sumSeasons(arm, (season) => season.wageExpense)}, upkeep ${sumSeasons(arm, (season) => season.facilityUpkeepExpense)}, capital ${sumSeasons(arm, (season) => season.facilityCapitalSpend)}, loans ${sumSeasons(arm, (season) => season.emergencyLoans)}, forced sales ${sumSeasons(arm, (season) => season.boardForcedSales)}, rescues ${sumSeasons(arm, (season) => season.boardRescues)}, points ${sumSeasons(arm, (season) => season.points)}, promotions ${arm.seasons.filter((season) => season.promoted).length}`,
        purchasing,
      ];
    }),
    '',
    ...spreadLines.filter((line) => line.length > 0),
    'Those min and max values are this cohort only.',
    '',
    ...(comparisons.length === 0
      ? []
      : ['Stack minus balanced:', ...comparisons, '']),
    `Stack ending cash was higher in ${stackCashHigher} of ${comparedPairs} complete pairs and lower in ${stackCashLower}. That count is not a tuning proposal.`,
    ...(useMirrorsNonUse
      ? [
          'USE and NONUSE produced the same cash, ticket, and points on every arm. Green Bull never changed a result. The pair count above counts each seed and difficulty twice.',
        ]
      : []),
    reachedGreenBullDivision
      ? `The candidate is no numerical change. ${production.length} production arms across ${seeds.length} seeds and ${input.seasonHorizon} seasons are not enough to change a percent. The first Stand or Shop copy stays at 100. Each upgrade level stays at 50. Status: UNAPPROVED_NOT_APPLIED.`
      : `The candidate is no numerical change. ${production.length} production arms across ${seeds.length} seeds and ${input.seasonHorizon} seasons did not play D3, so this is not a Green Bull price sample and not enough to call commercial dominance repeated. The first Stand or Shop copy stays at 100. Each upgrade level stays at 50. Status: UNAPPROVED_NOT_APPLIED.`,
    '',
    'A changed income multiplier would hit the next settlement of an old save. That is not grandfathering. Keeping an old formula needs a saved income policy. No multiplier is proposed.',
    '',
    '## Cup catch-up',
    '',
    `Paired rows ${cupRows.length}. Unreachable gaps ${input.cup.unreachable.length}. Natural rows ${input.cup.rows.filter((row) => row.kind === 'natural').length}.`,
    '',
    'Paired rows use the opening Cup opponent with a manufactured attribute gap. They are not Semi-finalists from a late career. A regulation win on both arms does not show that 25 and 50 do nothing against a real late-round side.',
    '',
    ...cupLines,
    '',
    `Career Cup matches in the commercial runs: ${lateCups.length}. Rounds seen: ${careerRounds.join(', ') || 'none'}. Late-round triggers: ${lateTriggers.length}. Power-sign disagreements: ${input.cup.rows.filter((row) => row.powerSignDisagreesWithAttrGap).length} in the Cup study and ${lateCups.filter((match) => match.powerSignDisagreesWithAttrGap).length} in the careers. Unlicensed heroes who outrate a same-role starter are a diagnostic count, not a match rating.`,
    ...(careerRounds.includes('Semi-final') || careerRounds.includes('Final')
      ? []
      : [
          'No career Cup match reached a Semi-final or Final, so these careers did not apply the 25 or 50 percent lift.',
        ]),
    '',
    'Regulation goals stay separate from penalty winners. Production draws use the stored shootout. Locked draws keep the seed winner and do not invent kicks.',
    '',
    'Cited penalty calibration, not rerun:',
    ...(penaltyLines.length === 0
      ? ['The calibration file was not read.']
      : penaltyLines),
    '',
    'Cup candidate: no change. Keep Semi-final 25 and Final 50. Status: UNAPPROVED_NOT_APPLIED.',
    '',
    input.lockedOmitted
      ? 'The old 4-4-2, auto-subs-off arm was omitted from this bounded run.'
      : 'The old 4-4-2, auto-subs-off arm is in the JSON and is not live Quick Match evidence.',
    '',
  ].join('\n');
}
