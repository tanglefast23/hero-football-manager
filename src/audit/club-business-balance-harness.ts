import { loadLaunchContent } from '../content';
import {
  applyBuzzImpacts,
  applySupporterImpacts,
  BUZZ_WIN_POINTS,
  createClubBusinessState,
} from '../game/club-business';
import type {
  PendingUserMatchImpact,
  SponsorObjectiveKind,
  SponsorProfileId,
  SponsorshipState,
} from '../game/club-business-types';
import { difficultyRules } from '../game/difficulty';
import { divisionFans, divisionTicketPrice } from '../game/full-career';
import type { DivisionLevel } from '../game/pyramid';
import { CUP_SETTLEMENT_WEEKS, generateSeasonFixtures } from '../game/schedule';
import {
  SPONSOR_PAYMENT_WEEKS,
  acceptSponsorOffer,
  actualSponsorPortfolioIncome,
  allocateSponsorPortfolioPayment,
  createSeasonSponsorship,
  divisionSponsorAnchor,
  settleSponsorObjectivesAtWeek30,
} from '../game/sponsors';
import type { DifficultyMode, LeagueFixture } from '../game/types';
import { mulberry32 } from '../sim/rng';

const content = loadLaunchContent();
const USER_CLUB_ID = 'club-business-user';
const CLUB_IDS = [
  USER_CLUB_ID,
  'club-02',
  'club-03',
  'club-04',
  'club-05',
  'club-06',
  'club-07',
  'club-08',
  'club-09',
  'club-10',
] as const;
const SEASON = 3;
const SEASON_WEEKS = 30;

/** Exact schema-3 to current Level-2/3 uplift across every non-office facility. */
export const CLUB_BUSINESS_FACILITY_UPGRADE_UPLIFT = 95_500;

export interface ClubBusinessBalanceScenario {
  readonly seed: number;
  readonly division: DivisionLevel;
  readonly difficulty: DifficultyMode;
  readonly profile: SponsorProfileId;
  /** Probe-only content sensitivity; omitted runs the shipped authored value. */
  readonly profileBonusPercent?: number;
  /** Probe-only content sensitivity; omitted runs the shipped authored value. */
  readonly profileMonthlyPercent?: number;
  /** Probe-only objective-family sensitivity; omitted runs the shipped authored value. */
  readonly profileObjectiveBonusPercent?: Partial<
    Record<SponsorObjectiveKind, number>
  >;
  /** Probe-only Buzz earning sensitivity; omitted uses the shipped win value. */
  readonly buzzWinPoints?: number;
  /** Probe-only per-match cap on hero-moment Buzz; omitted preserves no sub-cap. */
  readonly buzzHeroMomentCap?: number;
}

export interface ClubBusinessIncomeAttribution {
  readonly monthlySponsorDelta: number;
  readonly sponsorObjectiveBonus: number;
  readonly buzzPayout: number;
  readonly supporterGateDelta: number;
  readonly supporterMerchDelta: number;
  readonly totalNewIncome: number;
}

export interface ClubBusinessSponsorContractResult {
  readonly contractId: string;
  readonly slot: number;
  readonly profile: SponsorProfileId;
  readonly objectiveKind: SponsorObjectiveKind;
  readonly target: number;
  readonly objectiveMet: boolean;
  readonly actualMonthlyPayment: number;
  readonly actualObjectiveBonus: number;
  readonly actualSeasonValue: number;
}

export interface ClubBusinessBalanceResult {
  readonly scenario: ClubBusinessBalanceScenario;
  readonly controlSponsorIncome: number;
  readonly featureSponsorIncome: number;
  readonly attribution: ClubBusinessIncomeAttribution;
  readonly controlCashAfterMandatoryPitchUplift: number;
  readonly featureCashAfterMandatoryPitchUplift: number;
  readonly mandatoryPitchUplift: number;
  readonly startingFans: number;
  readonly endingFans: number;
  readonly minimumFans: number;
  readonly maximumLossStreak: number;
  readonly buzzHalfValues: readonly [number, number];
  readonly buzzCapCount: number;
  readonly objectiveMetCount: number;
  readonly objectiveCount: number;
  /** Exact contract-level values used for objective-family stratification. */
  readonly sponsorContracts: readonly ClubBusinessSponsorContractResult[];
}

/**
 * Frozen-outcome accounting comparison for one complete Buzz-active season.
 * Both sides receive the same schedule and results. The control retains the
 * old scalar sponsor and fixed supporter count; the feature side uses the real
 * sponsor, supporter, and Buzz functions. The only modeled facility difference
 * is the mandatory Training Pitch Level-2 uplift ($8,000 -> $10,000).
 */
export function runClubBusinessBalanceScenario(
  scenario: ClubBusinessBalanceScenario,
): ClubBusinessBalanceResult {
  validateScenario(scenario);
  const generated = generateScenarioFixtures(scenario);
  const sponsorIncomePercent = difficultyRules({
    difficulty: scenario.difficulty,
  }).sponsorIncomePercent;
  const nominalAnchor = divisionSponsorAnchor(scenario.division);
  const controlMonthlySponsor = Math.floor(
    (nominalAnchor * sponsorIncomePercent) / 100,
  );
  let sponsorship = signedPortfolio(scenario, nominalAnchor);
  const monthlyAllocationByContractId = new Map(
    allocateSponsorPortfolioPayment(
      sponsorship.activeContracts,
      sponsorIncomePercent,
    ).map((allocation) => [allocation.contractId, allocation.actualAmount]),
  );
  const featureMonthlySponsor =
    sponsorship.activeContracts.length === 0
      ? controlMonthlySponsor
      : actualSponsorPortfolioIncome(
          sponsorship.activeContracts,
          sponsorIncomePercent,
        );

  let business = createClubBusinessState({ season: SEASON });
  business = { ...business, sponsorship };
  let fans = divisionFans(scenario.division);
  const startingFans = fans;
  let minimumFans = fans;
  let maximumLossStreak = 0;
  let controlSponsorIncome = 0;
  let featureSponsorIncome = 0;
  let sponsorObjectiveBonus = 0;
  let buzzPayout = 0;
  let supporterGateDelta = 0;
  let supporterMerchDelta = 0;
  const buzzHalfValues: number[] = [];
  const cashIds = new Set<string>();

  const userFixturesByWeek = new Map<
    number,
    (typeof generated.userFixtures)[number][]
  >();
  for (const entry of generated.userFixtures) {
    const weekEntries = userFixturesByWeek.get(entry.fixture.week) ?? [];
    weekEntries.push(entry);
    userFixturesByWeek.set(entry.fixture.week, weekEntries);
  }
  for (let week = 1; week <= SEASON_WEEKS; week += 1) {
    const entries = userFixturesByWeek.get(week) ?? [];
    const impacts = entries
      .map((entry) => entry.impact)
      .sort((left, right) => left.settlementOrder - right.settlementOrder);

    // Gate and merchandise are fixed before the current week's supporter
    // impact, matching settleWeekResults. A canonical one-shop comparison
    // isolates the extra merch created by ordinary supporter changes.
    for (const entry of entries) {
      if (entry.fixture.homeClubId === USER_CLUB_ID) {
        supporterGateDelta +=
          gateIncome(fans, scenario.division) -
          gateIncome(startingFans, scenario.division);
      }
    }
    supporterMerchDelta += Math.floor(fans / 5) - Math.floor(startingFans / 5);

    if ((SPONSOR_PAYMENT_WEEKS as readonly number[]).includes(week)) {
      recordUniqueCashId(cashIds, `control-sponsor-${week}`);
      recordUniqueCashId(cashIds, `feature-sponsor-${week}`);
      controlSponsorIncome += controlMonthlySponsor;
      featureSponsorIncome += featureMonthlySponsor;
    }

    if (week === SEASON_WEEKS && sponsorship.activeContracts.length > 0) {
      const settled = settleSponsorObjectivesAtWeek30(
        sponsorship,
        generated.fixtures,
        USER_CLUB_ID,
        SEASON,
        week,
        sponsorIncomePercent,
      );
      sponsorship = settled.sponsorship;
      for (const payment of settled.payments) {
        recordUniqueCashId(cashIds, `objective-${payment.contractId}`);
        sponsorObjectiveBonus += payment.actualAmount;
      }
    }

    const appliedBuzz = applyBuzzImpacts(
      business.buzz,
      impacts,
      SEASON,
      week,
      featureMonthlySponsor,
    );
    if (appliedBuzz.payout !== undefined) {
      recordUniqueCashId(cashIds, appliedBuzz.payout.idempotencyKey);
      buzzPayout += appliedBuzz.payout.amount;
      buzzHalfValues.push(
        appliedBuzz.buzz.lastSettlementSummary!.prePayoutValue,
      );
    }
    const appliedSupporters = applySupporterImpacts(
      business.supporters,
      fans,
      impacts,
      SEASON,
      week,
    );
    fans = appliedSupporters.fanCount;
    minimumFans = Math.min(minimumFans, fans);
    maximumLossStreak = Math.max(
      maximumLossStreak,
      appliedSupporters.supporters.consecutiveLosses,
    );
    business = {
      ...business,
      supporters: appliedSupporters.supporters,
      buzz: appliedBuzz.buzz,
      sponsorship,
    };
  }

  if (buzzHalfValues.length !== 2) {
    throw new Error(
      `expected two Buzz boundaries, received ${buzzHalfValues.length}`,
    );
  }
  const attribution: ClubBusinessIncomeAttribution = {
    monthlySponsorDelta: featureSponsorIncome - controlSponsorIncome,
    sponsorObjectiveBonus,
    buzzPayout,
    supporterGateDelta,
    supporterMerchDelta,
    totalNewIncome: 0,
  };
  const totalNewIncome =
    attribution.monthlySponsorDelta +
    attribution.sponsorObjectiveBonus +
    attribution.buzzPayout +
    attribution.supporterGateDelta +
    attribution.supporterMerchDelta;
  const completeAttribution = { ...attribution, totalNewIncome };
  const mandatoryPitchUplift = 2_000;
  const startingCash = 100_000;
  const controlCashAfterMandatoryPitchUplift =
    startingCash + controlSponsorIncome;
  const featureCashAfterMandatoryPitchUplift =
    startingCash +
    featureSponsorIncome +
    sponsorObjectiveBonus +
    buzzPayout +
    supporterGateDelta +
    supporterMerchDelta -
    mandatoryPitchUplift;
  const cashDifference =
    featureCashAfterMandatoryPitchUplift - controlCashAfterMandatoryPitchUplift;
  if (cashDifference !== totalNewIncome - mandatoryPitchUplift) {
    throw new Error('Club Business cash attribution does not conserve money');
  }

  const objectiveContracts = sponsorship.activeContracts.filter(
    (contract) => contract.objective !== undefined,
  );
  const sponsorContracts = objectiveContracts.map((contract) => {
    if (
      contract.profile === undefined ||
      contract.objective === undefined ||
      contract.objectiveOutcome === undefined
    ) {
      throw new Error(
        `sponsor contract ${contract.contractId} is missing settled authored terms`,
      );
    }
    const actualMonthlyPayment = monthlyAllocationByContractId.get(
      contract.contractId,
    );
    if (actualMonthlyPayment === undefined) {
      throw new Error(
        `sponsor contract ${contract.contractId} is missing its monthly allocation`,
      );
    }
    return {
      contractId: contract.contractId,
      slot: contract.slot,
      profile: contract.profile,
      objectiveKind: contract.objective.kind,
      target: contract.objective.target,
      objectiveMet: contract.objectiveOutcome.met,
      actualMonthlyPayment,
      actualObjectiveBonus: contract.objectiveOutcome.actualBonus,
      actualSeasonValue:
        actualMonthlyPayment * SPONSOR_PAYMENT_WEEKS.length +
        contract.objectiveOutcome.actualBonus,
    };
  });
  const sponsorContractSeasonValue = sponsorContracts.reduce(
    (total, contract) => total + contract.actualSeasonValue,
    0,
  );
  if (
    sponsorContracts.length > 0 &&
    sponsorContractSeasonValue !== featureSponsorIncome + sponsorObjectiveBonus
  ) {
    throw new Error(
      'contract-level sponsor attribution does not conserve money',
    );
  }
  return {
    scenario,
    controlSponsorIncome,
    featureSponsorIncome,
    attribution: completeAttribution,
    controlCashAfterMandatoryPitchUplift,
    featureCashAfterMandatoryPitchUplift,
    mandatoryPitchUplift,
    startingFans,
    endingFans: fans,
    minimumFans,
    maximumLossStreak,
    buzzHalfValues: [buzzHalfValues[0], buzzHalfValues[1]],
    buzzCapCount: buzzHalfValues.filter((value) => value === 100).length,
    objectiveMetCount: objectiveContracts.filter(
      (contract) => contract.objectiveOutcome?.met,
    ).length,
    objectiveCount: objectiveContracts.length,
    sponsorContracts,
  };
}

function signedPortfolio(
  scenario: ClubBusinessBalanceScenario,
  nominalAnchor: number,
): SponsorshipState {
  const rules =
    scenario.profileBonusPercent === undefined &&
    scenario.profileMonthlyPercent === undefined
      ? content.sponsors
      : {
          ...content.sponsors,
          profiles: {
            ...content.sponsors.profiles,
            [scenario.profile]: {
              ...content.sponsors.profiles[scenario.profile],
              ...(scenario.profileBonusPercent === undefined
                ? {}
                : { bonusPercent: scenario.profileBonusPercent }),
              ...(scenario.profileMonthlyPercent === undefined
                ? {}
                : { monthlyPercent: scenario.profileMonthlyPercent }),
            },
          },
        };
  let sponsorship = createSeasonSponsorship({
    rules,
    careerSeed: scenario.seed,
    season: SEASON,
    division: scenario.division,
    difficulty: scenario.difficulty,
    highestDivisionReached: scenario.division,
    nominalAnchor,
  });
  if (scenario.profileObjectiveBonusPercent !== undefined) {
    const baselineBySlot = new Map(
      sponsorship.activeContracts.map((contract) => [
        contract.slot,
        contract.nominalMonthlyFee,
      ]),
    );
    sponsorship = {
      ...sponsorship,
      offers: sponsorship.offers.map((offer) => {
        if (offer.profile !== scenario.profile) return offer;
        const bonusPercent =
          scenario.profileObjectiveBonusPercent![offer.objective.kind];
        if (bonusPercent === undefined) return offer;
        const baseline = baselineBySlot.get(offer.slot);
        if (baseline === undefined)
          throw new Error(
            `missing sponsor sensitivity basis for slot ${offer.slot}`,
          );
        return {
          ...offer,
          objective: {
            ...offer.objective,
            nominalBonus: Math.round((baseline * bonusPercent) / 100),
          },
        };
      }),
    };
  }
  const slots = sponsorship.activeContracts.map((contract) => contract.slot);
  for (const slot of slots) {
    const offer = sponsorship.offers.find(
      (candidate) =>
        candidate.slot === slot && candidate.profile === scenario.profile,
    );
    if (offer === undefined)
      throw new Error(`missing ${scenario.profile} offer for slot ${slot}`);
    sponsorship = acceptSponsorOffer(sponsorship, {
      offerId: offer.offerId,
      season: SEASON,
      week: 1,
    });
  }
  return sponsorship;
}

function generateScenarioFixtures(scenario: ClubBusinessBalanceScenario): {
  readonly fixtures: LeagueFixture[];
  readonly userFixtures: readonly {
    readonly fixture: LeagueFixture;
    readonly impact: PendingUserMatchImpact;
  }[];
} {
  const random = mulberry32(scenario.seed);
  const scale = 6 - scenario.division;
  const heroCount = Math.min(4, 7 - scenario.division);
  const scheduled = generateSeasonFixtures(
    [...CLUB_IDS],
    SEASON,
    scenario.seed,
  );
  const userFixtures: Array<{
    fixture: LeagueFixture;
    impact: PendingUserMatchImpact;
  }> = [];
  const fixtures = scheduled.map((fixture) => {
    const userIsHome = fixture.homeClubId === USER_CLUB_ID;
    const userIsAway = fixture.awayClubId === USER_CLUB_ID;
    let homeGoals: number;
    let awayGoals: number;
    if (userIsHome || userIsAway) {
      const resultRoll = random();
      const outcome =
        resultRoll < 0.45 ? 'WIN' : resultRoll < 0.7 ? 'DRAW' : 'LOSS';
      const [userGoals, opponentGoals] = goalsForOutcome(outcome, random);
      homeGoals = userIsHome ? userGoals : opponentGoals;
      awayGoals = userIsHome ? opponentGoals : userGoals;
      const participantPlayerIds = Array.from(
        { length: 11 },
        (_, index) => `user-player-${index + 1}`,
      );
      const heroAppearancePlayerIds = participantPlayerIds.slice(0, heroCount);
      const powerFiredPlayerIds = heroAppearancePlayerIds.filter(
        () => random() < 0.65,
      );
      const impact: PendingUserMatchImpact = {
        fixtureId: fixture.id,
        competition: 'LEAGUE',
        settlementOrder: 0,
        source: 'PRODUCTION',
        outcome,
        regulationGoals: userGoals,
        participantPlayerIds,
        powerFiredPlayerIds,
        heroAppearancePlayerIds,
        divisionScale: scale,
        supporterWinUnits: outcome === 'WIN' ? 5 * scale : 0,
        supporterHeroUnits: heroCount * scale,
        buzzWin:
          outcome === 'WIN' ? (scenario.buzzWinPoints ?? BUZZ_WIN_POINTS) : 0,
        buzzGoals: userGoals,
        buzzHeroMoments: cappedHeroMomentBuzz(
          powerFiredPlayerIds.length * 2,
          scenario.buzzHeroMomentCap,
        ),
      };
      const played = {
        ...fixture,
        status: 'played' as const,
        score: { homeGoals, awayGoals },
      };
      userFixtures.push({ fixture: played, impact });
      return played;
    }

    homeGoals = Math.floor(random() * 4);
    awayGoals = Math.floor(random() * 4);
    return {
      ...fixture,
      status: 'played' as const,
      score: { homeGoals, awayGoals },
    };
  });
  // Every club reaches at least one Cup tie; this representative path starts
  // in the play-in and continues while it wins. Including the Cup makes the
  // D5 income check generous rather than manufacturing a failure by omission.
  for (
    let roundIndex = 0;
    roundIndex < CUP_SETTLEMENT_WEEKS.length;
    roundIndex += 1
  ) {
    const outcomeRoll = random();
    const outcome = outcomeRoll < 0.45 ? 'WIN' : 'LOSS';
    const [userGoals, opponentGoals] = goalsForOutcome(outcome, random);
    const userIsHome = roundIndex % 2 === 0;
    const participantPlayerIds = Array.from(
      { length: 11 },
      (_, index) => `user-player-${index + 1}`,
    );
    const heroAppearancePlayerIds = participantPlayerIds.slice(0, heroCount);
    const powerFiredPlayerIds = heroAppearancePlayerIds.filter(
      () => random() < 0.65,
    );
    const cupFixture: LeagueFixture = {
      id: `cup-s${SEASON}-r${roundIndex + 1}`,
      season: SEASON,
      round: roundIndex + 1,
      week: CUP_SETTLEMENT_WEEKS[roundIndex],
      homeClubId: userIsHome ? USER_CLUB_ID : 'cup-opponent',
      awayClubId: userIsHome ? 'cup-opponent' : USER_CLUB_ID,
      matchSeed: Math.floor(random() * 0x1_0000_0000) >>> 0,
      status: 'played',
      score: {
        homeGoals: userIsHome ? userGoals : opponentGoals,
        awayGoals: userIsHome ? opponentGoals : userGoals,
      },
    };
    userFixtures.push({
      fixture: cupFixture,
      impact: {
        fixtureId: cupFixture.id,
        competition: 'CUP',
        settlementOrder: 1,
        source: 'PRODUCTION',
        outcome,
        regulationGoals: userGoals,
        participantPlayerIds,
        powerFiredPlayerIds,
        heroAppearancePlayerIds,
        divisionScale: scale,
        supporterWinUnits: outcome === 'WIN' ? 5 * scale : 0,
        supporterHeroUnits: heroCount * scale,
        buzzWin:
          outcome === 'WIN' ? (scenario.buzzWinPoints ?? BUZZ_WIN_POINTS) : 0,
        buzzGoals: userGoals,
        buzzHeroMoments: cappedHeroMomentBuzz(
          powerFiredPlayerIds.length * 2,
          scenario.buzzHeroMomentCap,
        ),
      },
    });
    if (outcome === 'LOSS') break;
  }
  return { fixtures, userFixtures };
}

function goalsForOutcome(
  outcome: PendingUserMatchImpact['outcome'],
  random: () => number,
): readonly [number, number] {
  if (outcome === 'DRAW') {
    const goals = Math.floor(random() * 3);
    return [goals, goals];
  }
  const winnerGoals = 1 + Math.floor(random() * 4);
  const loserGoals = Math.floor(random() * winnerGoals);
  return outcome === 'WIN'
    ? [winnerGoals, loserGoals]
    : [loserGoals, winnerGoals];
}

function gateIncome(fans: number, division: DivisionLevel): number {
  return Math.floor((fans * 3) / 5) * divisionTicketPrice(division);
}

function cappedHeroMomentBuzz(raw: number, cap: number | undefined): number {
  return cap === undefined ? raw : Math.min(raw, cap);
}

function recordUniqueCashId(ids: Set<string>, id: string): void {
  if (ids.has(id)) throw new Error(`duplicate Club Business cash ID ${id}`);
  ids.add(id);
}

function validateScenario(scenario: ClubBusinessBalanceScenario): void {
  if (
    !Number.isSafeInteger(scenario.seed) ||
    scenario.seed < 0 ||
    scenario.seed > 0xffff_ffff
  ) {
    throw new Error('Club Business balance seed must be a uint32');
  }
  if (![1, 2, 3, 4, 5].includes(scenario.division)) {
    throw new Error('Club Business balance division must be D1-D5');
  }
  if (
    scenario.profileBonusPercent !== undefined &&
    (!Number.isSafeInteger(scenario.profileBonusPercent) ||
      scenario.profileBonusPercent < 0 ||
      scenario.profileBonusPercent > 1_000)
  ) {
    throw new Error(
      'Club Business profile bonus percent must be an integer from 0 to 1000',
    );
  }
  if (
    scenario.profileMonthlyPercent !== undefined &&
    (!Number.isSafeInteger(scenario.profileMonthlyPercent) ||
      scenario.profileMonthlyPercent < 1 ||
      scenario.profileMonthlyPercent > 500)
  ) {
    throw new Error(
      'Club Business profile monthly percent must be an integer from 1 to 500',
    );
  }
  for (const [kind, percent] of Object.entries(
    scenario.profileObjectiveBonusPercent ?? {},
  )) {
    if (
      !['LEAGUE_WINS', 'LEAGUE_GOALS', 'LEAGUE_FINISH'].includes(kind) ||
      !Number.isSafeInteger(percent) ||
      percent < 0 ||
      percent > 1_000
    ) {
      throw new Error(
        'Club Business objective-family bonus percent must be 0 to 1000',
      );
    }
  }
  if (
    scenario.buzzWinPoints !== undefined &&
    (!Number.isSafeInteger(scenario.buzzWinPoints) ||
      scenario.buzzWinPoints < 0 ||
      scenario.buzzWinPoints > 100)
  ) {
    throw new Error(
      'Club Business Buzz win points must be an integer from 0 to 100',
    );
  }
  if (
    scenario.buzzHeroMomentCap !== undefined &&
    (!Number.isSafeInteger(scenario.buzzHeroMomentCap) ||
      scenario.buzzHeroMomentCap < 0 ||
      scenario.buzzHeroMomentCap > 100)
  ) {
    throw new Error(
      'Club Business hero-moment Buzz cap must be an integer from 0 to 100',
    );
  }
}
