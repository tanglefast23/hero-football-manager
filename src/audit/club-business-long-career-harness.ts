/**
 * Production-path, feature-only D5 -> completed-first-D1 balance harness.
 *
 * This is deliberately not a historical comparison. The required frozen
 * pre-feature fixture does not exist, so every value below is labelled as an
 * observed current-career value. Exact counterfactual income attribution
 * belongs to the frozen-outcome accounting harness, not this divergent cohort.
 *
 * Locked conservative manager policy (policy B):
 * - Quick Result, 4-4-2, Auto Subs off;
 * - BALANCED sponsor offer in every available slot;
 * - one scouting/signing window only in the first season of each newly reached
 *   division, with up to two reported XI upgrades;
 * - a $15,000 reserve after every discretionary capital, scouting, drill, and
 *   transfer purchase;
 * - the cheapest affordable eligible head coach before the first advance,
 *   authored opening duties, production desk stories, negotiated renewals, and legacy
 *   choices rather than direct state shortcuts;
 * - Training Pitch L1, Coaching Office L1, then Pitch L2 and one of every
 *   remaining facility at L1, followed by L2 and L3 for useful facilities;
 * - the corrected promotion-survival training and Hero License policy;
 * - a hard 12-season censor. A censored run is a first-D1 gate failure.
 */
import { createHash } from 'node:crypto';
import { createLaunchCareerSetup } from '../application/launch';
import { careerMarketScoutOptions } from '../application/market-source-adapter';
import {
  outstandingInboxDuties,
  pendingAssistantGuideSequence,
  reconcileSatisfiedAssistantGuideSequences,
} from '../application/assistant-guide';
import { eventChoiceUnavailableReason } from '../application/event-selection';
import {
  continueResolvedCareerEvent,
  resolveCareerEventChoice,
} from '../application/career-event-flow';
import { careerEventTargetCandidates } from '../application/career-event-targets';
import {
  homeViewModel,
  reconcileHomeAssistantInbox,
  settleWeeklyStory,
} from '../application/view-models';
import { loadLaunchContent } from '../content';
import {
  acceptSponsorOffer,
  activeCareerMatchday,
  addCreatedPlayer,
  advanceWeek,
  beginCareerTransferTalks,
  beginCareerRenewalTalks,
  beginStoryOnboarding,
  buildCareerMatchTeamDef,
  careerHeroLimit,
  careerRosterCapacity,
  careerTransferTarget,
  completeAssistantGuideMilestone,
  completeAssistantGuideSequence,
  completeCareerRenewal,
  completeCareerTransfer,
  completeFirstOnboardingMatch,
  completeMatchday,
  completePostMatchAwakening,
  createCareer,
  currentUserDivision,
  declineYouthIntakeOffers,
  divisionSponsorAnchor,
  FACILITY_ADJACENCIES,
  FACILITY_CATALOG,
  FACILITY_GRID_HEIGHT,
  FACILITY_GRID_WIDTH,
  hasActiveCareerContractPromise,
  hasAssistantGuideMilestone,
  hireCareerCoach,
  isFirstOnboardingFixture,
  leagueStandings,
  MAX_FACILITY_LEVEL,
  maxRenewalTermSeasons,
  maxSigningTermSeasons,
  nextPendingClubLegend,
  nextTrainingUpgradeOffer,
  pendingTrainingPriorityHolder,
  playerAttributeCaps,
  playerPotentialGrade,
  POTENTIAL_GRADES,
  POSITION_TRAINING_ATTRIBUTES,
  quickMatchForFixture,
  reconcilePendingClubLegends,
  releaseCareerPlayer,
  resolveNextClubLegendLegacy,
  resolvePostMatchAwakening,
  resolveTrainingDrillForPath,
  restoreCareerContractPromiseLineup,
  roleOverall,
  selectCareerEventCoach,
  selectCareerEventFacility,
  selectCareerEventPlayer,
  selectCareerLicensedHeroes,
  sellCareerPlayer,
  setCareerLineup,
  startCareerScoutMission,
  startNextSeason,
  createSeasonSponsorship,
  SPONSOR_OFFER_EXPIRY_WEEK,
  SPONSOR_OFFER_LAST_WEEK,
  SPONSOR_PAYMENT_WEEKS,
  signCareerRenewalAtAsk,
  submitCareerTransferOffer,
  trainPlayerInstantly,
  userCareerRosterCount,
  weeklyAmbientTrainingPoints,
  type CareerPlayer,
  type DifficultyMode,
  type DivisionLevel,
  type FacilityPosition,
  type FacilityType,
  type GameState,
  type PlacedFacility,
  type SponsorObjectiveKind,
  type SponsorProfileId,
} from '../game';
import {
  buildCareerFacility,
  purchaseCareerTrainingUpgrade,
  upgradeCareerFacility,
} from '../game/management';
import type { ScoutReport } from '../game/market';
import { ENGINE_VERSION } from '../sim/match';
import type { Attrs, Role } from '../sim/types';

export const CLUB_BUSINESS_LONG_CAREER_POLICY_VERSION =
  'production-policy-b-v2';
export const CLUB_BUSINESS_LONG_CAREER_MAX_SEASONS = 12;
export const CLUB_BUSINESS_LONG_CAREER_CASH_RESERVE = 15_000;
export const CLUB_BUSINESS_LONG_CAREER_CENSOR_POSITION = 11;

const content = loadLaunchContent();
const PRESEASON_LAST_WEEK = 4;
const MAX_PRESEASON_SIGNINGS = 2;
const POWER_IDS = content.powers.powers.map((power) => power.id);
const TRIGGER_IDS = content.onboarding.triggers.map((trigger) => trigger.id);
const AWAKENING_TUNING = {
  weeklyChanceStepPercent: content.powers.awakening.weeklyChanceStepPercent,
  maxPerSeason: content.powers.awakening.maxPerSeason,
  minimumMatchesBetween: content.powers.awakening.minimumMatchesBetween,
};

type ManagedFacilityType = FacilityType;

interface FacilityPlanEntry {
  readonly type: ManagedFacilityType;
  readonly position: FacilityPosition;
}

/**
 * Every placement is fixed and non-overlapping. It also earns all three useful
 * adjacencies without changing the purchase order: Medical/Pitch,
 * Gym/Dorm, and Fan Shop/Stadium Stand.
 */
const FACILITY_PLAN: readonly FacilityPlanEntry[] = [
  { type: 'training-pitch', position: { x: 0, y: 0 } },
  { type: 'coaching-office', position: { x: 1, y: 2 } },
  { type: 'gym', position: { x: 6, y: 3 } },
  { type: 'dorm', position: { x: 7, y: 3 } },
  { type: 'tech-center', position: { x: 6, y: 0 } },
  { type: 'shooting-range', position: { x: 6, y: 1 } },
  { type: 'keeper-court', position: { x: 7, y: 1 } },
  { type: 'medical-bay', position: { x: 0, y: 2 } },
  { type: 'scout-office', position: { x: 7, y: 0 } },
  { type: 'youth-field', position: { x: 2, y: 0 } },
  { type: 'stadium-stand', position: { x: 4, y: 0 } },
  { type: 'fan-shop', position: { x: 4, y: 2 } },
];

const OWNER_INCOME_FACILITY_PLAN: readonly FacilityPlanEntry[] = [
  { type: 'fan-shop', position: { x: 4, y: 2 } },
  { type: 'stadium-stand', position: { x: 4, y: 0 } },
  { type: 'fan-shop', position: { x: 0, y: 3 } },
  { type: 'stadium-stand', position: { x: 0, y: 4 } },
  { type: 'fan-shop', position: { x: 2, y: 3 } },
  { type: 'stadium-stand', position: { x: 2, y: 4 } },
];

const OWNER_SUPPORT_FACILITY_PLAN: readonly FacilityPlanEntry[] =
  FACILITY_PLAN.slice(2, -2);

const OWNER_DRILL_PATHS = [
  'sprints',
  'finishing',
  'rondo',
  'duels',
  'first-touch',
  'circuit',
  'keeper-drills',
] as const;

const OWNER_IMPORTANT_ATTRIBUTES: Readonly<
  Record<Role, readonly (keyof Attrs)[]>
> = {
  FWD: ['sho', 'pac', 'tec', 'sta'],
  MID: ['pas', 'def', 'pac', 'sta'],
  DEF: ['pas', 'def', 'pac', 'sta'],
  GK: ['ref', 'pas', 'pac', 'sta'],
};

const OWNER_PATH_BY_ATTRIBUTE: Readonly<Record<keyof Attrs, string>> = {
  pac: 'sprints',
  sho: 'finishing',
  pas: 'rondo',
  def: 'duels',
  tec: 'first-touch',
  sta: 'circuit',
  ref: 'keeper-drills',
};

const MANAGED_DRILL_PATHS = [
  'finishing',
  'duels',
  'keeper-drills',
  'rondo',
  'first-touch',
] as const;

export interface LongCareerPolicyDescription {
  readonly version: typeof CLUB_BUSINESS_LONG_CAREER_POLICY_VERSION;
  readonly sponsorProfile: 'BALANCED';
  readonly formation: '4-4-2';
  readonly autoSubs: false;
  readonly headCoach: 'CHEAPEST_AFFORDABLE_BEFORE_FIRST_ADVANCE';
  readonly onboardingDuties: 'BUILD_COACHING_OFFICE_L1_AND_DECLINE_YOUTH';
  readonly deskStories: 'FIRST_AVAILABLE_NON_RISKY_CHOICE';
  readonly renewals: 'NEGOTIATE_AT_ASK_OR_RELEASE_IF_TALKS_REFUSED';
  readonly clubLegacies: 'FAREWELL';
  readonly recruitment: string;
  readonly discretionaryCashReserve: number;
  readonly facilityOrder: readonly ManagedFacilityType[];
  readonly facilityPlacements: readonly {
    readonly type: ManagedFacilityType;
    readonly position: FacilityPosition;
  }[];
  readonly maxSeasons: number;
  readonly censoredGatePosition: number;
  readonly comparison: 'CURRENT_FEATURE_ONLY';
}

export const CLUB_BUSINESS_LONG_CAREER_POLICY: LongCareerPolicyDescription = {
  version: CLUB_BUSINESS_LONG_CAREER_POLICY_VERSION,
  sponsorProfile: 'BALANCED',
  formation: '4-4-2',
  autoSubs: false,
  headCoach: 'CHEAPEST_AFFORDABLE_BEFORE_FIRST_ADVANCE',
  onboardingDuties: 'BUILD_COACHING_OFFICE_L1_AND_DECLINE_YOUTH',
  deskStories: 'FIRST_AVAILABLE_NON_RISKY_CHOICE',
  renewals: 'NEGOTIATE_AT_ASK_OR_RELEASE_IF_TALKS_REFUSED',
  clubLegacies: 'FAREWELL',
  recruitment:
    'first season of each newly reached division; one scout mission; up to two reported XI upgrades',
  discretionaryCashReserve: CLUB_BUSINESS_LONG_CAREER_CASH_RESERVE,
  facilityOrder: FACILITY_PLAN.map((entry) => entry.type),
  facilityPlacements: FACILITY_PLAN.map((entry) => ({
    type: entry.type,
    position: { ...entry.position },
  })),
  maxSeasons: CLUB_BUSINESS_LONG_CAREER_MAX_SEASONS,
  censoredGatePosition: CLUB_BUSINESS_LONG_CAREER_CENSOR_POSITION,
  comparison: 'CURRENT_FEATURE_ONLY',
};

/**
 * Stable input manifest for shard compatibility.
 *
 * Changing a production input requires the policy/input hash to move before
 * old shards can be aggregated with new ones.
 */
export const CLUB_BUSINESS_LONG_CAREER_INPUT_MANIFEST = {
  manifestVersion: 1,
  policy: CLUB_BUSINESS_LONG_CAREER_POLICY,
  engineVersion: ENGINE_VERSION,
  sponsorRules: content.sponsors,
  sponsorRuntime: {
    offerLastWeek: SPONSOR_OFFER_LAST_WEEK,
    offerExpiryWeek: SPONSOR_OFFER_EXPIRY_WEEK,
    paymentWeeks: SPONSOR_PAYMENT_WEEKS,
    representativeSeasonPortfolios: ([5, 4, 3, 2, 1] as const).flatMap(
      (division) =>
        (['COZY', 'CHAIRMAN'] as const).map((difficulty) =>
          createSeasonSponsorship({
            rules: content.sponsors,
            careerSeed: 0x5a17_c0de,
            season: 3,
            division,
            difficulty,
            highestDivisionReached: division,
            nominalAnchor: divisionSponsorAnchor(division),
          }),
        ),
    ),
    implementation: createSeasonSponsorship.toString(),
  },
  facilities: {
    grid: { width: FACILITY_GRID_WIDTH, height: FACILITY_GRID_HEIGHT },
    maximumLevel: MAX_FACILITY_LEVEL,
    catalog: FACILITY_CATALOG,
    adjacencies: FACILITY_ADJACENCIES,
    placements: CLUB_BUSINESS_LONG_CAREER_POLICY.facilityPlacements,
  },
  storyCatalog: content.events,
  matchContent: {
    powers: content.powers,
    onboarding: content.onboarding,
  },
} as const;

export const CLUB_BUSINESS_LONG_CAREER_INPUT_HASH = manifestFingerprint(
  CLUB_BUSINESS_LONG_CAREER_INPUT_MANIFEST,
);

export type RecruitmentStopReason =
  | 'NOT_ELIGIBLE'
  | 'SCOUT_IN_PROGRESS'
  | 'CASH_RESERVE'
  | 'SCOUT_INCOMPLETE'
  | 'NO_REPORTS'
  | 'NO_ELIGIBLE_ORDINARY_TARGETS'
  | 'NO_REPORTED_UPGRADES'
  | 'NO_AFFORDABLE_UPGRADES'
  | 'NO_RESERVE_SALE'
  | 'MAX_SIGNINGS';

export interface LongCareerRecruitmentSummary {
  readonly eligible: boolean;
  readonly scoutStarted: boolean;
  readonly scoutBriefId: string;
  readonly scoutReports: number;
  readonly signings: number;
  readonly transferSpend: number;
  readonly saleIncome: number;
  readonly reportedStartingElevenGain: number;
  readonly stopReason: RecruitmentStopReason;
}

export interface LongCareerSponsorObjectiveSummary {
  readonly slot: number;
  readonly sponsorName: string;
  readonly profile?: SponsorProfileId;
  readonly objectiveKind?: SponsorObjectiveKind;
  readonly objectiveTarget?: number;
  readonly objectiveMet?: boolean;
  readonly actualBonus: number;
}

export interface LongCareerFacilityLevel {
  readonly type: ManagedFacilityType;
  readonly level: 0 | 1 | 2 | 3;
}

export interface LongCareerSeasonSummary {
  readonly season: number;
  readonly division: DivisionLevel;
  readonly firstSeasonInDivision: boolean;
  readonly position: number;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly points: number;
  readonly goalDifference: number;
  readonly promoted: boolean;
  readonly relegated: boolean;
  readonly openingCash: number;
  readonly endingCash: number;
  readonly minimumObservedCash: number;
  readonly openingFans: number;
  readonly endingFans: number;
  readonly fanDelta: number;
  readonly sponsorIncome: number;
  readonly sponsorObjectiveBonuses: number;
  readonly ticketIncome: number;
  readonly merchandiseIncome: number;
  readonly prizeAndSubsidyIncome: number;
  readonly wageExpense: number;
  readonly facilityUpkeepExpense: number;
  readonly loanRepaymentExpense: number;
  /** Weekly ledger net before loans, forced sales, and board rescue packages. */
  readonly ordinaryLedgerNet: number;
  readonly safetyIncome: number;
  readonly facilityCapitalSpend: number;
  readonly drillUpgradeSpend: number;
  readonly scoutingSpend: number;
  readonly transferSpend: number;
  readonly transferSaleIncome: number;
  readonly trainingDrills: number;
  readonly trainingPointStart: number;
  readonly trainingPointAmbientIncome: number;
  readonly trainingPointStoryDelta: number;
  readonly trainingPointOtherDelta: number;
  readonly trainingPointSpend: number;
  readonly trainingPointEnd: number;
  readonly superTrainingSessions: number;
  readonly createdPlayerTrainingDrills: number;
  readonly createdPlayerTrainingPointSpend: number;
  readonly createdPlayerSuperTrainingSessions: number;
  readonly highestImportantAttribute: number;
  readonly importantAttributeMedian: number;
  readonly importantAttributesByRole: Readonly<
    Record<Role, LongCareerImportantAttributeSummary>
  >;
  readonly createdPlayerImportantAttributes?: Readonly<
    Partial<Record<keyof Attrs, number>>
  >;
  readonly sponsorObjectives: readonly LongCareerSponsorObjectiveSummary[];
  readonly recruitment: LongCareerRecruitmentSummary;
  readonly facilities: readonly LongCareerFacilityLevel[];
  readonly startingElevenStrength: number;
  readonly boardUltimatumsIssued: number;
  readonly boardForcedSales: number;
  readonly emergencyLoans: number;
  readonly boardRescues: number;
}

export interface LongCareerTotals {
  readonly sponsorIncome: number;
  readonly sponsorObjectiveBonuses: number;
  readonly ticketIncome: number;
  readonly merchandiseIncome: number;
  readonly wageExpense: number;
  readonly facilityUpkeepExpense: number;
  readonly loanRepaymentExpense: number;
  readonly ordinaryLedgerNet: number;
  readonly safetyIncome: number;
  readonly facilityCapitalSpend: number;
  readonly drillUpgradeSpend: number;
  readonly scoutingSpend: number;
  readonly transferSpend: number;
  readonly transferSaleIncome: number;
  readonly trainingDrills: number;
  readonly sponsorObjectivesMet: number;
  readonly sponsorObjectivesSettled: number;
  readonly boardUltimatumsIssued: number;
  readonly boardForcedSales: number;
  readonly emergencyLoans: number;
  readonly boardRescues: number;
  readonly firstD4RecruitmentFund: number;
}

export interface ClubBusinessLongCareerResult {
  readonly kind: 'club-business-long-career-run';
  readonly policyVersion: typeof CLUB_BUSINESS_LONG_CAREER_POLICY_VERSION;
  readonly inputHash: typeof CLUB_BUSINESS_LONG_CAREER_INPUT_HASH;
  readonly seed: number;
  readonly difficulty: DifficultyMode;
  readonly completedFirstD1: boolean;
  readonly censored: boolean;
  readonly firstD1Season?: number;
  readonly firstD1Position?: number;
  readonly firstD1TopEight: boolean;
  /** Censors map to 11 so they count as failures in both first-D1 gates. */
  readonly firstD1GatePosition: number;
  readonly divisionEntrySeason: Readonly<
    Partial<Record<DivisionLevel, number>>
  >;
  readonly minimumObservedCash: number;
  readonly endingCash: number;
  readonly endingFans: number;
  readonly seasons: readonly LongCareerSeasonSummary[];
  readonly totals: LongCareerTotals;
  readonly finalStateFingerprint: string;
  readonly runMode?: 'CONSERVATIVE' | 'OWNER_MAX_TP';
}

export interface LongCareerImportantAttributeSummary {
  readonly minimum: number;
  readonly median: number;
  readonly maximum: number;
  readonly average: number;
}

export interface LongCareerRunOptions {
  /**
   * Joe's final measurement policy: exhaust TP in potential order, take risky
   * stories, hire both coaches at the earliest legal weeks, and build the
   * TP/economy facility plan without a discretionary cash reserve.
   */
  readonly ownerMaxTp?: boolean;
}

interface RecruitmentWindow {
  eligible: boolean;
  scoutStarted: boolean;
  signingResolved: boolean;
  scoutReports: number;
  scoutBriefId: string;
  stopReason: RecruitmentStopReason;
  signings: number;
  saleIncome: number;
  transferSpend: number;
  reportedStartingElevenGain: number;
}

interface RunObserver {
  minimumCash: number;
  seasonMinimumCash: number;
  readonly ultimatumSeasonById: Map<string, number>;
}

/** Runs one continuous current-feature career; no state is manufactured. */
export function runClubBusinessLongCareer(
  seed: number,
  difficulty: DifficultyMode,
  options: LongCareerRunOptions = {},
): ClubBusinessLongCareerResult {
  assertUint32(seed, 'long-career seed');
  const ownerMaxTp = options.ownerMaxTp === true;
  let state = addCreatedPlayer(
    beginStoryOnboarding(
      createCareer(
        createLaunchCareerSetup(seed, undefined, content, difficulty),
      ),
    ),
    {
      name: 'Long Career Probe Hero',
      ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 },
      difficulty,
    },
  );
  if (state.difficulty !== difficulty) {
    throw new Error(
      `long-career seed ${seed} lost ${difficulty} difficulty identity`,
    );
  }

  const observer: RunObserver = {
    minimumCash: userCash(state),
    seasonMinimumCash: userCash(state),
    ultimatumSeasonById: new Map(),
  };
  observeState(state, observer);

  const visitedDivisions = new Set<DivisionLevel>();
  const divisionEntrySeason: Partial<Record<DivisionLevel, number>> = {};
  const seasons: LongCareerSeasonSummary[] = [];
  let totalTrainingDrills = 0;

  for (
    let seasonIndex = 0;
    seasonIndex < CLUB_BUSINESS_LONG_CAREER_MAX_SEASONS;
    seasonIndex += 1
  ) {
    if (state.phase !== 'manage') {
      throw new Error(
        `long-career seed ${seed} began season ${state.season} in ${state.phase}`,
      );
    }
    const division = userDivision(state);
    const firstSeasonInDivision = !visitedDivisions.has(division);
    if (firstSeasonInDivision) {
      visitedDivisions.add(division);
      divisionEntrySeason[division] = state.season;
    }
    const openingCash = userCash(state);
    const openingFans = userFans(state);
    observer.seasonMinimumCash = openingCash;
    const recruitment = createRecruitmentWindow(
      !ownerMaxTp && firstSeasonInDivision && division < 5,
    );
    const trainingDrillsAtStart = totalTrainingDrills;
    const trainingPointStart = state.trainingPoints;
    let trainingPointAmbientIncome = 0;
    let trainingPointStoryDelta = 0;
    let trainingPointSpend = 0;
    let superTrainingSessions = 0;
    let createdPlayerTrainingDrills = 0;
    let createdPlayerTrainingPointSpend = 0;
    let createdPlayerSuperTrainingSessions = 0;

    let guard = 0;
    while (state.phase !== 'season-end') {
      guard += 1;
      if (guard > 420) {
        throw new Error(
          `long-career seed ${seed} exceeded the season-${state.season} transition guard`,
        );
      }
      if (state.phase === 'manage') {
        // Mirror the player-facing order: any modal lesson is read, this
        // week's desk is settled once, and an authored choice is made before
        // the manager starts changing the club underneath that story.
        state = readManagedOverlayLesson(state);
        const trainingPointsBeforeStory = state.trainingPoints;
        state = resolveManagedDeskStory(state, ownerMaxTp);
        trainingPointStoryDelta +=
          state.trainingPoints - trainingPointsBeforeStory;
        state = readManagedInboxCards(state);
        state = hireCheapestAffordableHeadCoach(state);
        if (ownerMaxTp) state = hireCheapestAffordableAssistantCoach(state);
        state = resolveManagedYouthDuty(state);
        state = chooseManagedHeroLicenses(state);
        state = signBalancedSponsorOffers(state);

        if (
          recruitment.eligible &&
          !recruitment.scoutStarted &&
          !recruitment.signingResolved
        ) {
          state = openRecruitmentWindow(state, recruitment);
        }
        if (recruitment.eligible && state.week <= PRESEASON_LAST_WEEK) {
          state = tryCompleteRecruitment(state, recruitment);
        }
        if (
          recruitment.eligible &&
          !recruitment.signingResolved &&
          state.week > PRESEASON_LAST_WEEK
        ) {
          recruitment.signingResolved = true;
          recruitment.stopReason = 'SCOUT_INCOMPLETE';
        }

        // Keep transfer-window cash liquid until the one new-division mission
        // resolves, then resume the same capital plan used in every season.
        const recruitmentPending =
          recruitment.eligible &&
          state.week <= PRESEASON_LAST_WEEK &&
          !recruitment.signingResolved;
        if (!recruitmentPending) {
          state = ownerMaxTp
            ? advanceOwnerFacilityPlan(state)
            : advanceFacilityPlan(state);
          state = ownerMaxTp
            ? buyOwnerDrillUpgrades(state)
            : buyManagedDrillUpgrades(state);
        }
        const training = ownerMaxTp
          ? trainOwnerPotentialRoster(state)
          : trainManagedCore(state);
        state = training.state;
        totalTrainingDrills += training.drills;
        trainingPointSpend += training.tpSpent;
        superTrainingSessions += training.superSessions;
        createdPlayerTrainingDrills += training.createdPlayerDrills;
        createdPlayerTrainingPointSpend += training.createdPlayerTpSpent;
        createdPlayerSuperTrainingSessions +=
          training.createdPlayerSuperSessions;
        if (
          training.drills > 0 &&
          !hasAssistantGuideMilestone(state, 'first-training-complete')
        ) {
          state = completeAssistantGuideMilestone(
            state,
            'first-training-complete',
          );
        }
        state = readManagedInboxCards(
          reconcileSatisfiedAssistantGuideSequences(state),
        );
        assertPlayerReachableAdvance(state);
        observeState(state, observer);
        const beforeAdvance = state;
        trainingPointAmbientIncome +=
          weeklyAmbientTrainingPoints(beforeAdvance);
        try {
          state = advanceWeek(state);
        } catch (error) {
          throw new Error(
            `long-career seed ${seed} could not advance season ${state.season} week ${state.week}`,
            { cause: error },
          );
        }
        if (
          state.week !== beforeAdvance.week &&
          hasAssistantGuideMilestone(
            beforeAdvance,
            'first-training-complete',
          ) &&
          !hasAssistantGuideMilestone(state, 'first-week-advanced')
        ) {
          state = completeAssistantGuideMilestone(state, 'first-week-advanced');
        }
        observeState(state, observer);
        continue;
      }
      if (state.phase === 'matchday') {
        state = settleProductionMatchday(state);
        observeState(state, observer);
        continue;
      }
      throw new Error(
        `long-career seed ${seed} entered unsupported phase ${state.phase}`,
      );
    }

    if (recruitment.eligible && !recruitment.signingResolved) {
      recruitment.signingResolved = true;
      recruitment.stopReason = 'SCOUT_INCOMPLETE';
    }
    const seasonSummary = summarizeSeason({
      state,
      division,
      firstSeasonInDivision,
      openingCash,
      openingFans,
      seasonMinimumCash: observer.seasonMinimumCash,
      recruitment,
      trainingDrills: totalTrainingDrills - trainingDrillsAtStart,
      trainingPointStart,
      trainingPointAmbientIncome,
      trainingPointStoryDelta,
      trainingPointSpend,
      superTrainingSessions,
      createdPlayerTrainingDrills,
      createdPlayerTrainingPointSpend,
      createdPlayerSuperTrainingSessions,
      boardUltimatumsIssued: [...observer.ultimatumSeasonById.values()].filter(
        (issuedSeason) => issuedSeason === state.season,
      ).length,
    });
    seasons.push(seasonSummary);

    // "First D1" means the season has actually completed. Reaching its opening
    // screen is not enough to claim the survival gate.
    if (division === 1) {
      return {
        ...buildRunResult(
          state,
          seed,
          difficulty,
          seasons,
          divisionEntrySeason,
          observer,
          false,
        ),
        runMode: ownerMaxTp ? 'OWNER_MAX_TP' : 'CONSERVATIVE',
      };
    }
    if (seasonIndex + 1 === CLUB_BUSINESS_LONG_CAREER_MAX_SEASONS) break;
    state = renewExpiringPlayers(state);
    state = resolveManagedClubLegacies(
      reconcilePendingClubLegends(startNextSeason(state)),
    );
    observeState(state, observer);
  }

  return {
    ...buildRunResult(
      state,
      seed,
      difficulty,
      seasons,
      divisionEntrySeason,
      observer,
      true,
    ),
    runMode: ownerMaxTp ? 'OWNER_MAX_TP' : 'CONSERVATIVE',
  };
}

function readManagedOverlayLesson(state: GameState): GameState {
  const sequenceId = pendingAssistantGuideSequence(state, 'home');
  return sequenceId === null
    ? state
    : completeAssistantGuideSequence(state, sequenceId);
}

/** Reads only cards the production inbox actually delivered this week. */
function readManagedInboxCards(state: GameState): GameState {
  let next = reconcileHomeAssistantInbox(
    reconcileSatisfiedAssistantGuideSequences(state),
  );
  const delivered = homeViewModel(next)
    .alerts.map((alert) => alert.guideSequenceId)
    .filter(
      (sequenceId): sequenceId is NonNullable<typeof sequenceId> =>
        sequenceId !== undefined,
    );
  for (const sequenceId of delivered) {
    // These two cards point at real opening jobs. The manager completes them
    // in the world below; merely reading copy must not make a duty disappear.
    if (sequenceId === 'coaching-office' || sequenceId === 'youth-intake')
      continue;
    next = completeAssistantGuideSequence(next, sequenceId);
  }
  return reconcileSatisfiedAssistantGuideSequences(next);
}

function resolveManagedDeskStory(
  state: GameState,
  preferRisky = false,
): GameState {
  let next = settleWeeklyStory(reconcileHomeAssistantInbox(state));
  let guard = 0;
  while (next.pendingEvent !== undefined) {
    guard += 1;
    if (guard > 20)
      throw new Error('long-career story chain exceeded 20 authored events');
    const pending = next.pendingEvent;
    const event = content.events.events.find(
      (candidate) => candidate.id === pending.eventId,
    );
    if (event === undefined)
      throw new Error(
        `long-career desk offered unknown event ${pending.eventId}`,
      );

    if (pending.resolvedChoiceId === undefined) {
      if (
        event.trigger.requiresPlayer === true &&
        pending.selectedPlayerId === undefined
      ) {
        const selected = preferRisky
          ? careerEventTargetCandidates(next, event)
              .playerIds.map((id) =>
                next.players.find((player) => player.id === id),
              )
              .filter((player): player is CareerPlayer => player !== undefined)
              .sort(compareOwnerTrainingPriority)[0]?.id
          : careerEventTargetCandidates(next, event).playerIds[0];
        if (selected === undefined)
          throw new Error(`event ${event.id} has no eligible user player`);
        next = selectCareerEventPlayer(next, selected);
      }
      /**
       * The desk must point targeted stories at something, or the probe runs a
       * catalog whose coach and building cards resolve to nothing and still
       * reports a number. Head coach first, then assistant; lowest building id
       * among the types the story admits, so the choice is deterministic.
       */
      if (
        event.trigger.requiresCoach === true &&
        pending.selectedCoachRole === undefined
      ) {
        const roles = careerEventTargetCandidates(next, event).coachRoles;
        const role = preferRisky
          ? roles.includes('HEAD')
            ? 'HEAD'
            : roles[0]
          : roles[0];
        if (role === undefined)
          throw new Error(`event ${event.id} has no eligible coach`);
        next = selectCareerEventCoach(next, role);
      }
      if (
        event.trigger.requiresFacility !== undefined &&
        pending.selectedFacilityId === undefined
      ) {
        const facilityIds = careerEventTargetCandidates(
          next,
          event,
        ).facilityIds;
        const buildingId = preferRisky
          ? facilityIds
              .map((id) =>
                next.facilities.grid?.buildings.find(
                  (building) => building.id === id,
                ),
              )
              .filter(
                (building): building is PlacedFacility =>
                  building !== undefined,
              )
              .sort(
                (left, right) =>
                  Number(right.type === 'training-pitch') -
                    Number(left.type === 'training-pitch') ||
                  left.id.localeCompare(right.id),
              )[0]?.id
          : facilityIds[0];
        if (buildingId === undefined)
          throw new Error(`event ${event.id} has no operational building`);
        next = selectCareerEventFacility(next, buildingId);
      }
      const availableChoices = event.choices.filter(
        (candidate) =>
          eventChoiceUnavailableReason(next, candidate) === undefined,
      );
      const choice = preferRisky
        ? (availableChoices.find((candidate) => candidate.risky === true) ??
          availableChoices[0])
        : (availableChoices.find((candidate) => candidate.risky !== true) ??
          availableChoices[0]);
      if (choice === undefined)
        throw new Error(`event ${event.id} has no available production choice`);
      const guided = next.eventFlags.includes('m4:event-guide-seen')
        ? next
        : { ...next, eventFlags: [...next.eventFlags, 'm4:event-guide-seen'] };
      next = resolveCareerEventChoice(guided, content.events, choice.id);
    }

    const resolved = next.pendingEvent;
    if (resolved?.resolvedChoiceId === undefined) {
      throw new Error(`event ${event.id} did not persist its resolved choice`);
    }
    const guided = next.eventFlags.includes('m4:event-guide-seen')
      ? next
      : { ...next, eventFlags: [...next.eventFlags, 'm4:event-guide-seen'] };
    next = continueResolvedCareerEvent(guided, content.events).state;
  }
  return next;
}

function hireCheapestAffordableHeadCoach(state: GameState): GameState {
  const market = state.market;
  if (market === undefined)
    throw new Error('long-career coach policy has no career market');
  if (market.headCoach !== undefined) return state;
  const candidates = market.coachCandidates
    .slice()
    .sort(
      (left, right) =>
        left.weeklyWage - right.weeklyWage || left.id.localeCompare(right.id),
    );
  for (const candidate of candidates) {
    try {
      return {
        ...state,
        market: hireCareerCoach(state, market, candidate.id, 'HEAD'),
      };
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (error.message.includes('is not eligible')) continue;
      if (error.message === 'the club cannot cover the coach weekly wage')
        break;
      throw error;
    }
  }
  throw new Error(
    'long-career policy found no affordable eligible head coach before advance',
  );
}

function hireCheapestAffordableAssistantCoach(state: GameState): GameState {
  const market = state.market;
  if (market === undefined)
    throw new Error('owner-policy coach plan has no career market');
  if (market.assistantCoach !== undefined) return state;
  const candidates = market.coachCandidates
    .slice()
    .sort(
      (left, right) =>
        left.weeklyWage - right.weeklyWage || left.id.localeCompare(right.id),
    );
  for (const candidate of candidates) {
    try {
      return {
        ...state,
        market: hireCareerCoach(state, market, candidate.id, 'ASSISTANT'),
      };
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (
        error.message.includes('is not eligible') ||
        error.message === 'an assistant coach requires the Coaching Office' ||
        error.message === 'the same coach cannot fill both staff roles'
      ) {
        continue;
      }
      if (error.message === 'the club cannot cover the coach weekly wage')
        break;
      throw error;
    }
  }
  return state;
}

function resolveManagedYouthDuty(state: GameState): GameState {
  const intake = state.youthIntake;
  if (intake === undefined || intake.status !== 'OPEN') return state;
  const transaction = declineYouthIntakeOffers(state, intake);
  return { ...transaction.state, youthIntake: transaction.intake };
}

function assertPlayerReachableAdvance(state: GameState): void {
  if (state.pendingEvent !== undefined) {
    throw new Error(
      `long-career season ${state.season} week ${state.week} left a desk story unresolved`,
    );
  }
  const duties = outstandingInboxDuties(state);
  if (duties.length > 0) {
    throw new Error(
      `long-career season ${state.season} week ${state.week} left inbox duties: ${duties.join(', ')}`,
    );
  }
  if (state.season !== 1 || state.week !== 1) return;
  if (!hasAssistantGuideMilestone(state, 'intro-complete')) {
    throw new Error(
      'long-career opening did not complete Bert management intro',
    );
  }
  if (!hasAssistantGuideMilestone(state, 'first-training-complete')) {
    throw new Error(
      'long-career opening did not perform the required first training',
    );
  }
  if (state.market?.headCoach === undefined) {
    throw new Error('long-career opening did not hire a head coach');
  }
  const trainingGroundStarted =
    state.facilities.trainingGroundBuilt ||
    (state.facilities.grid?.construction?.kind === 'BUILD' &&
      state.facilities.grid.construction.type === 'training-pitch');
  if (!trainingGroundStarted)
    throw new Error('long-career opening did not start the Training Pitch');
}

function resolveManagedClubLegacies(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (nextPendingClubLegend(next) !== undefined) {
    guard += 1;
    if (guard > 100)
      throw new Error('long-career club-legacy queue exceeded 100 players');
    next = resolveNextClubLegendLegacy(next, 'farewell').state;
  }
  return next;
}

function createRecruitmentWindow(eligible: boolean): RecruitmentWindow {
  return {
    eligible,
    scoutStarted: false,
    signingResolved: !eligible,
    scoutReports: 0,
    scoutBriefId: eligible ? 'NOT_STARTED' : 'NOT_ELIGIBLE',
    stopReason: eligible ? 'SCOUT_IN_PROGRESS' : 'NOT_ELIGIBLE',
    signings: 0,
    saleIncome: 0,
    transferSpend: 0,
    reportedStartingElevenGain: 0,
  };
}

function openRecruitmentWindow(
  state: GameState,
  window: RecruitmentWindow,
): GameState {
  const market = state.market;
  if (market === undefined)
    throw new Error('long-career recruitment has no transfer market');
  const focusRole = weakestStartingRole(state);
  const selected = careerMarketScoutOptions(state)
    .slice()
    .sort(
      (left, right) =>
        scoutPriority(left.focus, focusRole) -
          scoutPriority(right.focus, focusRole) ||
        left.id.localeCompare(right.id),
    )[0];
  if (selected === undefined)
    throw new Error('long-career recruitment has no production scouting brief');
  let mission: ReturnType<typeof startCareerScoutMission>;
  try {
    mission = startCareerScoutMission(
      state,
      market,
      selected.region,
      selected.focus,
      userDivision(state),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'the scouting mission is not affordable'
    ) {
      window.signingResolved = true;
      window.scoutBriefId = selected.id;
      window.stopReason = 'CASH_RESERVE';
      return state;
    }
    throw error;
  }
  if (userCash(mission.state) < CLUB_BUSINESS_LONG_CAREER_CASH_RESERVE) {
    window.signingResolved = true;
    window.scoutBriefId = selected.id;
    window.stopReason = 'CASH_RESERVE';
    return state;
  }
  window.scoutStarted = true;
  window.scoutBriefId = selected.id;
  window.stopReason = 'SCOUT_IN_PROGRESS';
  return { ...mission.state, market: mission.market };
}

function scoutPriority(
  focus: ReturnType<typeof careerMarketScoutOptions>[number]['focus'],
  weakestRole: Role,
): number {
  if (focus.kind === 'POSITION' && focus.role === weakestRole) return 0;
  if (focus.kind === 'AGE' && focus.minimumAge >= 22 && focus.maximumAge <= 29)
    return 1;
  if (focus.kind === 'POSITION') return 2;
  return 3;
}

function tryCompleteRecruitment(
  state: GameState,
  window: RecruitmentWindow,
): GameState {
  if (window.signingResolved || !window.scoutStarted) return state;
  let next = state;
  const initialMarket = next.market;
  if (initialMarket === undefined)
    throw new Error('long-career recruitment lost its market');
  if (initialMarket.activeScoutMission !== undefined) return state;
  window.scoutReports = initialMarket.scoutReports.length;
  window.signingResolved = true;

  for (let signing = 0; signing < MAX_PRESEASON_SIGNINGS; signing += 1) {
    const market = next.market;
    if (market === undefined)
      throw new Error('long-career signing lost its market');
    if (market.scoutReports.length === 0) {
      window.stopReason = window.signings === 0 ? 'NO_REPORTS' : 'MAX_SIGNINGS';
      return next;
    }
    const rosterFull =
      userCareerRosterCount(next) >= careerRosterCapacity(next);
    const previewSale = sellManagedReserve(next, market);
    if (rosterFull && previewSale === undefined) {
      window.stopReason = 'NO_RESERVE_SALE';
      return next;
    }
    const spendableCash = Math.max(
      0,
      userCash(previewSale?.state ?? next) -
        CLUB_BUSINESS_LONG_CAREER_CASH_RESERVE,
    );
    const eligible = market.scoutReports
      .map((report) => signingCandidate(next, market, report))
      .filter(
        (candidate): candidate is NonNullable<typeof candidate> =>
          candidate !== undefined,
      );
    if (eligible.length === 0) {
      window.stopReason = 'NO_ELIGIBLE_ORDINARY_TARGETS';
      return next;
    }
    const upgrades = eligible.filter(
      (candidate) => candidate.reportedUpgrade > 0,
    );
    if (upgrades.length === 0) {
      window.stopReason = 'NO_REPORTED_UPGRADES';
      return next;
    }
    const selected = upgrades
      .filter((candidate) => candidate.fee <= spendableCash)
      .sort(
        (left, right) =>
          right.reportedUpgrade - left.reportedUpgrade ||
          right.reportedPotential - left.reportedPotential ||
          left.fee - right.fee ||
          left.report.playerId.localeCompare(right.report.playerId),
      )[0];
    if (selected === undefined) {
      window.stopReason = 'NO_AFFORDABLE_UPGRADES';
      return next;
    }
    const sale = sellManagedReserve(next, selected.market);
    if (rosterFull && sale === undefined) {
      window.stopReason = 'NO_RESERVE_SALE';
      return next;
    }
    const transferState = sale?.state ?? next;
    const transferMarket = sale?.market ?? selected.market;
    const talks = submitCareerTransferOffer(transferState, transferMarket, {
      weeklyWage: selected.weeklyAsk,
      termSeasons: selected.termSeasons,
      perk: 'GUARANTEED_STARTER',
    });
    const beforeStrength = startingElevenStrength(transferState);
    const completed = completeCareerTransfer(transferState, talks);
    const saleAmount = sale?.state.cashTransactions?.at(-1)?.amount ?? 0;
    window.saleIncome += Math.max(0, saleAmount);
    window.transferSpend += selected.fee;
    next = { ...completed.state, market: completed.market };
    window.signings += 1;
    window.reportedStartingElevenGain +=
      startingElevenStrength(next) - beforeStrength;
  }
  window.stopReason = 'MAX_SIGNINGS';
  return next;
}

function sellManagedReserve(
  state: GameState,
  market: NonNullable<GameState['market']>,
) {
  const lineupIds = new Set(userLineupIds(state));
  const reserve = state.players
    .filter(
      (player) =>
        player.clubId === state.userClubId &&
        !lineupIds.has(player.id) &&
        player.role !== 'GK' &&
        player.power === undefined &&
        player.contractPromise === undefined,
    )
    .sort(
      (left, right) =>
        roleOverall(left.role, left.attrs) -
          roleOverall(right.role, right.attrs) ||
        left.id.localeCompare(right.id),
    )[0];
  if (reserve === undefined) return undefined;
  const buyer = state.clubs
    .filter((club) => club.id !== state.userClubId)
    .sort(
      (left, right) =>
        right.cash - left.cash || left.id.localeCompare(right.id),
    )[0];
  if (buyer === undefined)
    throw new Error('long-career recruitment has no transfer buyer');
  return sellCareerPlayer(
    state,
    market,
    reserve.id,
    buyer.id,
    userDivision(state),
  );
}

function signingCandidate(
  state: GameState,
  market: NonNullable<GameState['market']>,
  report: ScoutReport,
):
  | {
      readonly report: ScoutReport;
      readonly market: NonNullable<GameState['market']>;
      readonly fee: number;
      readonly weeklyAsk: number;
      readonly termSeasons: 1 | 2;
      readonly reportedUpgrade: number;
      readonly reportedPotential: number;
    }
  | undefined {
  const target = careerTransferTarget(
    state,
    report.playerId,
    userDivision(state),
  );
  const player = target?.player;
  if (player === undefined || player.power !== undefined) return undefined;
  const weakest = weakestStarterForRole(state, report.role);
  if (weakest === undefined) return undefined;
  const maxTerm = maxSigningTermSeasons(player, state.careerSeed);
  if (maxTerm < 1) return undefined;
  const candidateMarket = beginCareerTransferTalks(
    state,
    market,
    report.playerId,
  );
  const talks = candidateMarket.transferTalks;
  if (talks === undefined)
    throw new Error('long-career transfer talks did not open');
  return {
    report,
    market: candidateMarket,
    fee: talks.transferQuote.fee,
    weeklyAsk: talks.negotiation.weeklyAsk,
    termSeasons: maxTerm >= 2 ? 2 : 1,
    reportedUpgrade:
      reportedOverall(report) - roleOverall(weakest.role, weakest.attrs),
    reportedPotential:
      (report.potentialRange.minimum + report.potentialRange.maximum) / 2,
  };
}

function signBalancedSponsorOffers(state: GameState): GameState {
  const current = state.clubBusiness.sponsorship;
  if (state.week > PRESEASON_LAST_WEEK || current.offers.length === 0)
    return state;
  let sponsorship = current;
  const provisionalSlots = sponsorship.activeContracts
    .filter(
      (contract) => contract.season === state.season && contract.provisional,
    )
    .map((contract) => contract.slot)
    .sort((left, right) => left - right);
  for (const slot of provisionalSlots) {
    const offer = sponsorship.offers.find(
      (candidate) =>
        candidate.season === state.season &&
        candidate.slot === slot &&
        candidate.profile === 'BALANCED',
    );
    if (offer === undefined) {
      throw new Error(
        `season ${state.season} sponsor slot ${slot} has no BALANCED offer`,
      );
    }
    sponsorship = acceptSponsorOffer(sponsorship, {
      offerId: offer.offerId,
      season: state.season,
      week: state.week,
    });
  }
  return sponsorship === current
    ? state
    : { ...state, clubBusiness: { ...state.clubBusiness, sponsorship } };
}

/**
 * The opening's required Training Pitch L1 and Coaching Office L1 are paid
 * before applying the discretionary reserve. Once both duties are started,
 * Pitch L2 leads the capital plan, followed by every remaining L1, then the L2
 * and L3 rounds. Coaching Office upgrades remain absent: L2/L3 add no benefit.
 */
function advanceFacilityPlan(state: GameState): GameState {
  const grid = state.facilities.grid;
  if (grid === undefined || grid.construction !== undefined) return state;
  const pitch = grid.buildings.find(
    (building) => building.type === 'training-pitch',
  );
  if (pitch === undefined)
    return buildRequiredFacility(state, FACILITY_PLAN[0]);
  const office = grid.buildings.find(
    (building) => building.type === 'coaching-office',
  );
  if (office === undefined)
    return buildRequiredFacility(state, FACILITY_PLAN[1]);
  if (pitch.level < 2) return tryFacilityUpgrade(state, pitch.id);

  for (const entry of FACILITY_PLAN.slice(2)) {
    if (!grid.buildings.some((building) => building.type === entry.type)) {
      return tryFacilityBuild(state, entry);
    }
  }
  for (const targetLevel of [2, 3] as const) {
    for (const entry of FACILITY_PLAN.filter(
      (candidate) => candidate.type !== 'coaching-office',
    )) {
      const building = grid.buildings.find(
        (candidate) => candidate.type === entry.type,
      );
      if (building === undefined)
        throw new Error(`facility plan lost ${entry.type}`);
      if (building.level < targetLevel)
        return tryFacilityUpgrade(state, building.id);
    }
  }
  return state;
}

function advanceOwnerFacilityPlan(state: GameState): GameState {
  const grid = state.facilities.grid;
  if (grid === undefined || grid.construction !== undefined) return state;
  const pitch = grid.buildings.find(
    (building) => building.type === 'training-pitch',
  );
  if (pitch === undefined)
    return buildRequiredFacility(state, FACILITY_PLAN[0]);
  const office = grid.buildings.find(
    (building) => building.type === 'coaching-office',
  );
  if (office === undefined)
    return buildRequiredFacility(state, FACILITY_PLAN[1]);

  for (const entry of OWNER_INCOME_FACILITY_PLAN) {
    const built = grid.buildings.some(
      (building) =>
        building.type === entry.type &&
        building.x === entry.position.x &&
        building.y === entry.position.y,
    );
    if (!built) return tryOwnerFacilityBuild(state, entry);
  }
  for (const entry of OWNER_SUPPORT_FACILITY_PLAN) {
    if (!grid.buildings.some((building) => building.type === entry.type))
      return tryOwnerFacilityBuild(state, entry);
  }
  if (pitch.level < MAX_FACILITY_LEVEL)
    return tryOwnerFacilityUpgrade(state, pitch.id);
  for (const targetLevel of [2, 3] as const) {
    const upgradeOrder = [
      ...grid.buildings.filter(
        (building) =>
          building.type === 'fan-shop' || building.type === 'stadium-stand',
      ),
      ...grid.buildings.filter(
        (building) =>
          building.type !== 'coaching-office' &&
          building.type !== 'training-pitch' &&
          building.type !== 'fan-shop' &&
          building.type !== 'stadium-stand',
      ),
    ].sort(
      (left, right) =>
        Number(left.level >= targetLevel) -
          Number(right.level >= targetLevel) || left.id.localeCompare(right.id),
    );
    const building = upgradeOrder.find(
      (candidate) => candidate.level < targetLevel,
    );
    if (building !== undefined)
      return tryOwnerFacilityUpgrade(state, building.id);
  }
  return state;
}

function tryOwnerFacilityBuild(
  state: GameState,
  entry: FacilityPlanEntry,
): GameState {
  if (userCash(state) < FACILITY_CATALOG[entry.type].buildCost) return state;
  try {
    return buildCareerFacility(state, entry.type, entry.position).state;
  } catch {
    return state;
  }
}

function tryOwnerFacilityUpgrade(
  state: GameState,
  buildingId: string,
): GameState {
  try {
    return upgradeCareerFacility(state, buildingId).state;
  } catch {
    return state;
  }
}

function ownerIncomeBaseComplete(state: GameState): boolean {
  const grid = state.facilities.grid;
  if (grid === undefined || grid.construction !== undefined) return false;
  const pitch = grid.buildings.find(
    (building) => building.type === 'training-pitch',
  );
  return (
    pitch?.level === MAX_FACILITY_LEVEL &&
    grid.buildings.some((building) => building.type === 'coaching-office') &&
    grid.buildings.filter((building) => building.type === 'fan-shop').length ===
      3 &&
    grid.buildings.filter((building) => building.type === 'stadium-stand')
      .length === 3
  );
}

function buildRequiredFacility(
  state: GameState,
  entry: FacilityPlanEntry,
): GameState {
  if (userCash(state) < FACILITY_CATALOG[entry.type].buildCost) return state;
  return buildCareerFacility(state, entry.type, entry.position).state;
}

function tryFacilityBuild(
  state: GameState,
  entry: FacilityPlanEntry,
): GameState {
  try {
    const transaction = buildCareerFacility(state, entry.type, entry.position);
    return userCash(transaction.state) < CLUB_BUSINESS_LONG_CAREER_CASH_RESERVE
      ? state
      : transaction.state;
  } catch {
    return state;
  }
}

function tryFacilityUpgrade(state: GameState, buildingId: string): GameState {
  try {
    const transaction = upgradeCareerFacility(state, buildingId);
    return userCash(transaction.state) < CLUB_BUSINESS_LONG_CAREER_CASH_RESERVE
      ? state
      : transaction.state;
  } catch {
    return state;
  }
}

function buyManagedDrillUpgrades(state: GameState): GameState {
  let next = state;
  for (const pathId of MANAGED_DRILL_PATHS) {
    const offer = nextTrainingUpgradeOffer(next, pathId);
    if (offer === undefined || offer.blockedReason !== undefined) continue;
    if (userCash(next) - offer.cost < CLUB_BUSINESS_LONG_CAREER_CASH_RESERVE)
      continue;
    next = purchaseCareerTrainingUpgrade(next, pathId).state;
  }
  return next;
}

function buyOwnerDrillUpgrades(state: GameState): GameState {
  if (!ownerIncomeBaseComplete(state)) return state;
  let next = state;
  for (const pathId of OWNER_DRILL_PATHS) {
    const offer = nextTrainingUpgradeOffer(next, pathId);
    if (offer === undefined || offer.blockedReason !== undefined) continue;
    if (userCash(next) < offer.cost) continue;
    next = purchaseCareerTrainingUpgrade(next, pathId).state;
  }
  return next;
}

function trainManagedCore(state: GameState): {
  state: GameState;
  drills: number;
  tpSpent: number;
  superSessions: number;
  createdPlayerDrills: number;
  createdPlayerTpSpent: number;
  createdPlayerSuperSessions: number;
} {
  const starters = userLineupIds(state)
    .map((id) => state.players.find((player) => player.id === id))
    .filter(
      (player): player is CareerPlayer =>
        player !== undefined && player.injuryWeeks === 0,
    );
  const core = (['GK', 'DEF', 'MID', 'FWD'] as const)
    .map(
      (role) =>
        starters
          .filter((player) => player.role === role)
          .sort(
            (left, right) =>
              roleOverall(right.role, right.attrs) -
                roleOverall(left.role, left.attrs) ||
              left.id.localeCompare(right.id),
          )[0],
    )
    .filter((player): player is CareerPlayer => player !== undefined);
  const pathByAttribute = {
    pac: 'sprints',
    sho: 'finishing',
    pas: 'rondo',
    def: 'duels',
    tec: 'first-touch',
    sta: 'circuit',
    ref: 'keeper-drills',
  } as const;
  const rotation = (state.season * 30 + state.week) % Math.max(1, core.length);
  const order = [...core.slice(rotation), ...core.slice(0, rotation)];
  let next = state;
  let drills = 0;
  let tpSpent = 0;
  let superSessions = 0;
  let createdPlayerDrills = 0;
  let createdPlayerTpSpent = 0;
  let createdPlayerSuperSessions = 0;
  for (let index = 0; index < order.length; index += 1) {
    const player = order[index];
    const attributes =
      player.role === 'GK'
        ? (['ref'] as const)
        : POSITION_TRAINING_ATTRIBUTES[player.role];
    const attribute =
      attributes[(state.season * 30 + state.week + index) % attributes.length];
    if (player.attrs[attribute] >= playerAttributeCaps(player)[attribute])
      continue;
    const pathId = pathByAttribute[attribute];
    if (resolveTrainingDrillForPath(next, pathId).tpCost > next.trainingPoints)
      continue;
    try {
      const resolution = trainPlayerInstantly(next, player.id, pathId);
      next = resolution.state;
      drills += 1;
      tpSpent += resolution.tpSpent;
      superSessions += Number(resolution.isSuper);
      if (resolution.playerId === state.onboarding?.createdPlayerId) {
        createdPlayerDrills += 1;
        createdPlayerTpSpent += resolution.tpSpent;
        createdPlayerSuperSessions += Number(resolution.isSuper);
      }
    } catch {
      // A training-priority promise can own the next taps; skip this player and
      // continue the deterministic role rotation instead of fabricating gains.
      continue;
    }
  }
  return {
    state: next,
    drills,
    tpSpent,
    superSessions,
    createdPlayerDrills,
    createdPlayerTpSpent,
    createdPlayerSuperSessions,
  };
}

function compareOwnerTrainingPriority(
  left: CareerPlayer,
  right: CareerPlayer,
): number {
  return (
    POTENTIAL_GRADES.indexOf(playerPotentialGrade(right)) -
      POTENTIAL_GRADES.indexOf(playerPotentialGrade(left)) ||
    (right.potential ?? 3) - (left.potential ?? 3) ||
    (left.age ?? 99) - (right.age ?? 99) ||
    left.id.localeCompare(right.id)
  );
}

function trainOwnerPotentialRoster(state: GameState): {
  state: GameState;
  drills: number;
  tpSpent: number;
  superSessions: number;
  createdPlayerDrills: number;
  createdPlayerTpSpent: number;
  createdPlayerSuperSessions: number;
} {
  const priorityHolderId = pendingTrainingPriorityHolder(state)?.playerId;
  const order = state.players
    .filter(
      (player) =>
        player.clubId === state.userClubId &&
        player.injuryWeeks === 0 &&
        (player.awayWeeks ?? 0) === 0 &&
        (player.condition ?? 100) >= 80 &&
        OWNER_IMPORTANT_ATTRIBUTES[player.role].some(
          (attribute) =>
            player.attrs[attribute] < playerAttributeCaps(player)[attribute],
        ),
    )
    .slice()
    .sort((left, right) => {
      if (left.id === priorityHolderId) return -1;
      if (right.id === priorityHolderId) return 1;
      return compareOwnerTrainingPriority(left, right);
    });
  let next = state;
  let drills = 0;
  let tpSpent = 0;
  let superSessions = 0;
  let createdPlayerDrills = 0;
  let createdPlayerTpSpent = 0;
  let createdPlayerSuperSessions = 0;
  for (const plannedPlayer of order) {
    for (let batchDrill = 0; batchDrill < 2; batchDrill += 1) {
      const player = next.players.find(
        (candidate) => candidate.id === plannedPlayer.id,
      );
      if (
        player === undefined ||
        player.injuryWeeks > 0 ||
        (player.awayWeeks ?? 0) > 0
      ) {
        break;
      }
      const caps = playerAttributeCaps(player);
      const attribute = OWNER_IMPORTANT_ATTRIBUTES[player.role]
        .filter((candidate) => player.attrs[candidate] < caps[candidate])
        .slice()
        .sort(
          (left, right) =>
            player.attrs[left] - player.attrs[right] ||
            OWNER_IMPORTANT_ATTRIBUTES[player.role].indexOf(left) -
              OWNER_IMPORTANT_ATTRIBUTES[player.role].indexOf(right),
        )[0];
      if (attribute === undefined) break;
      const pathId = OWNER_PATH_BY_ATTRIBUTE[attribute];
      if (
        resolveTrainingDrillForPath(next, pathId).tpCost > next.trainingPoints
      ) {
        break;
      }
      try {
        const resolution = trainPlayerInstantly(next, player.id, pathId);
        next = resolution.state;
        drills += 1;
        tpSpent += resolution.tpSpent;
        superSessions += Number(resolution.isSuper);
        if (resolution.playerId === state.onboarding?.createdPlayerId) {
          createdPlayerDrills += 1;
          createdPlayerTpSpent += resolution.tpSpent;
          createdPlayerSuperSessions += Number(resolution.isSuper);
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('was promised the next')
        ) {
          return {
            state: next,
            drills,
            tpSpent,
            superSessions,
            createdPlayerDrills,
            createdPlayerTpSpent,
            createdPlayerSuperSessions,
          };
        }
        throw error;
      }
    }
  }
  return {
    state: next,
    drills,
    tpSpent,
    superSessions,
    createdPlayerDrills,
    createdPlayerTpSpent,
    createdPlayerSuperSessions,
  };
}

function chooseManagedHeroLicenses(state: GameState): GameState {
  const lineupIds = new Set(userLineupIds(state));
  const selectedHeroIds = state.players
    .filter(
      (player) =>
        player.clubId === state.userClubId && player.power !== undefined,
    )
    .slice()
    .sort((left, right) => {
      const leftPromise = hasActiveStartingPromise(left);
      const rightPromise = hasActiveStartingPromise(right);
      if (leftPromise !== rightPromise) return leftPromise ? -1 : 1;
      const leftStarts = lineupIds.has(left.id);
      const rightStarts = lineupIds.has(right.id);
      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
      return (
        roleOverall(right.role, right.attrs) -
          roleOverall(left.role, left.attrs) || left.id.localeCompare(right.id)
      );
    })
    .slice(0, careerHeroLimit(state))
    .map((player) => player.id);
  let next = restoreCareerContractPromiseLineup(
    selectCareerLicensedHeroes(state, selectedHeroIds),
  );
  const playerById = new Map(next.players.map((player) => [player.id, player]));
  const lineup = [...userLineupIds(next)];
  const selected = new Set(lineup);
  for (let slot = 0; slot < lineup.length; slot += 1) {
    const starter = playerById.get(lineup[slot]);
    if (starter === undefined)
      throw new Error(`long-career lineup lost player ${lineup[slot]}`);
    const unavailable = starter.injuryWeeks > 0 || (starter.awayWeeks ?? 0) > 0;
    const unlicensedHero =
      starter.power !== undefined && starter.licensed !== true;
    if (!unavailable && !unlicensedHero) continue;
    selected.delete(starter.id);
    const eligible = next.players
      .filter(
        (candidate) =>
          candidate.clubId === next.userClubId &&
          !selected.has(candidate.id) &&
          candidate.injuryWeeks === 0 &&
          (candidate.awayWeeks ?? 0) === 0 &&
          !(candidate.power !== undefined && !candidate.licensed) &&
          (slot === 0 ? candidate.role === 'GK' : candidate.role !== 'GK'),
      )
      .sort((left, right) => {
        const leftRolePenalty = left.role === starter.role ? 0 : 1;
        const rightRolePenalty = right.role === starter.role ? 0 : 1;
        return (
          leftRolePenalty - rightRolePenalty ||
          roleOverall(right.role, right.attrs) -
            roleOverall(left.role, left.attrs) ||
          left.id.localeCompare(right.id)
        );
      })[0];
    if (eligible === undefined) {
      throw new Error(
        `unavailable or unlicensed long-career starter ${starter.id} has no eligible replacement`,
      );
    }
    lineup[slot] = eligible.id;
    selected.add(eligible.id);
  }
  return setCareerLineup(next, lineup);
}

function hasActiveStartingPromise(player: CareerPlayer): boolean {
  return (
    hasActiveCareerContractPromise(player) &&
    (player.contractPromise?.perk === 'GUARANTEED_STARTER' ||
      player.contractPromise?.perk === 'CAPTAINCY')
  );
}

function settleProductionMatchday(state: GameState): GameState {
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined)
    throw new Error('long-career matchday has no active fixture');
  const fixture = matchday.fixture;
  const clubIds = [
    ...new Set(
      matchday.fixtures.flatMap((candidate) => [
        candidate.homeClubId,
        candidate.awayClubId,
      ]),
    ),
  ];
  const teams = Object.fromEntries(
    clubIds.map((clubId) => {
      try {
        return [clubId, buildCareerMatchTeamDef(state, clubId)];
      } catch (error) {
        throw new Error(
          `long-career season ${state.season} week ${state.week} could not build match club ${clubId}`,
          { cause: error },
        );
      }
    }),
  );
  const quickMatches = matchday.fixtures.map((candidate) => ({
    fixture: candidate,
    quick: quickMatchForFixture(
      candidate,
      teams,
      candidate.id === fixture.id
        ? {
            userClubId: state.userClubId,
            initialFormation: '4-4-2',
            autoSubs: false,
          }
        : undefined,
    ),
  }));
  const userQuick = quickMatches.find(
    (candidate) => candidate.fixture.id === fixture.id,
  )?.quick;
  if (userQuick?.production === undefined) {
    throw new Error(
      'long-career Quick Result did not produce user match facts',
    );
  }
  const settled = completeMatchday(
    state,
    quickMatches.map((candidate) => candidate.quick.result),
    userQuick.production,
  );
  const completed = isFirstOnboardingFixture(state, fixture.id)
    ? completeFirstOnboardingMatch(settled, fixture.id)
    : settled;
  if (matchday.kind !== 'league') return completed;
  const awakening = resolvePostMatchAwakening(
    completed,
    fixture.id,
    userQuick.production.participantPlayerIds,
    POWER_IDS,
    TRIGGER_IDS,
    AWAKENING_TUNING,
  );
  return awakening.awakened
    ? completePostMatchAwakening(awakening.state)
    : awakening.state;
}

function renewExpiringPlayers(state: GameState): GameState {
  let next = state;
  const expiring = state.players
    .filter(
      (candidate) =>
        candidate.clubId === state.userClubId &&
        candidate.contractSeasonsRemaining === 0,
    )
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const original of expiring) {
    const player = next.players.find(
      (candidate) => candidate.id === original.id,
    );
    if (player === undefined || player.contractSeasonsRemaining !== 0) continue;
    const maxTerm = maxRenewalTermSeasons(player, state.careerSeed);
    if (maxTerm === 0) continue;
    const market = next.market;
    if (market === undefined)
      throw new Error('long-career renewal policy lost its market');
    // Signs at the agent's ask with no promise, which is what the shipped
    // "Sign now" button does. This used to open talks and offer the ask with a
    // hard-coded JERSEY_10, copied from the old dead `renewPlayer`. That promise
    // takes the number 10 shirt off whoever wears it, so a squad cannot share
    // it: once renewals started refusing a second concurrent #10 promise, a
    // harness renewing everybody this way threw on its second player.
    try {
      const transaction = signCareerRenewalAtAsk(
        next,
        market,
        player.id,
        Math.min(2, maxTerm) as 1 | 2 | 3,
      );
      next = { ...transaction.state, market: transaction.market };
    } catch (error) {
      // A player who will not re-sign leaves; the harness models a manager who
      // keeps whoever will stay, not one who can force a signature.
      if (
        error instanceof Error &&
        error.message.includes('will not re-sign')
      ) {
        next = releaseCareerPlayer(next, player.id);
        continue;
      }
      throw error;
    }
  }
  return next;
}

function summarizeSeason(input: {
  readonly state: GameState;
  readonly division: DivisionLevel;
  readonly firstSeasonInDivision: boolean;
  readonly openingCash: number;
  readonly openingFans: number;
  readonly seasonMinimumCash: number;
  readonly recruitment: RecruitmentWindow;
  readonly trainingDrills: number;
  readonly trainingPointStart: number;
  readonly trainingPointAmbientIncome: number;
  readonly trainingPointStoryDelta: number;
  readonly trainingPointSpend: number;
  readonly superTrainingSessions: number;
  readonly createdPlayerTrainingDrills: number;
  readonly createdPlayerTrainingPointSpend: number;
  readonly createdPlayerSuperTrainingSessions: number;
  readonly boardUltimatumsIssued: number;
}): LongCareerSeasonSummary {
  const { state } = input;
  const importantAttributes = summarizeImportantAttributes(state);
  const row = leagueStandings(state).find(
    (candidate) => candidate.clubId === state.userClubId,
  );
  if (row === undefined)
    throw new Error(`season ${state.season} lost the user standing`);
  const ledgers = state.ledgers.filter(
    (ledger) => ledger.season === state.season,
  );
  const lines = ledgers.flatMap((ledger) => ledger.lines);
  const transactions = (state.cashTransactions ?? []).filter(
    (transaction) => transaction.season === state.season,
  );
  const sponsorContracts = state.clubBusiness.sponsorship.activeContracts
    .filter((contract) => contract.season === state.season)
    .slice()
    .sort((left, right) => left.slot - right.slot);
  return {
    season: state.season,
    division: input.division,
    firstSeasonInDivision: input.firstSeasonInDivision,
    position: row.position,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    points: row.points,
    goalDifference: row.goalDifference,
    promoted: input.division > 1 && row.position <= 2,
    relegated: input.division < 5 && row.position >= 9,
    openingCash: input.openingCash,
    endingCash: userCash(state),
    minimumObservedCash: input.seasonMinimumCash,
    openingFans: input.openingFans,
    endingFans: userFans(state),
    fanDelta: userFans(state) - input.openingFans,
    sponsorIncome: sumAmounts(lines.filter((line) => line.kind === 'sponsor')),
    sponsorObjectiveBonuses: sumAmounts(
      lines.filter(
        (line) =>
          line.kind === 'sponsor' && line.label.endsWith('objective bonus'),
      ),
    ),
    ticketIncome: sumAmounts(lines.filter((line) => line.kind === 'tickets')),
    merchandiseIncome: sumAmounts(
      lines.filter((line) => line.kind === 'merch'),
    ),
    prizeAndSubsidyIncome: sumAmounts(
      lines.filter((line) => line.kind === 'prize' || line.kind === 'subsidy'),
    ),
    wageExpense: -sumAmounts(lines.filter((line) => line.kind === 'wages')),
    facilityUpkeepExpense: -sumAmounts(
      lines.filter((line) => line.kind === 'facilities'),
    ),
    loanRepaymentExpense: -sumAmounts(
      lines.filter((line) => line.kind === 'loan-repayment'),
    ),
    ordinaryLedgerNet: sumAmounts(
      lines.filter(
        (line) =>
          line.kind !== 'emergency-loan' &&
          line.kind !== 'board-sale' &&
          line.kind !== 'board-rescue' &&
          line.kind !== 'loan-repayment',
      ),
    ),
    safetyIncome: sumAmounts(
      lines.filter(
        (line) =>
          line.kind === 'emergency-loan' ||
          line.kind === 'board-sale' ||
          line.kind === 'board-rescue',
      ),
    ),
    facilityCapitalSpend: -sumAmounts(
      transactions.filter(
        (transaction) =>
          transaction.kind === 'facility-build' ||
          transaction.kind === 'facility-upgrade',
      ),
    ),
    drillUpgradeSpend: -sumAmounts(
      transactions.filter(
        (transaction) => transaction.kind === 'training-upgrade',
      ),
    ),
    scoutingSpend: -sumAmounts(
      transactions.filter((transaction) => transaction.kind === 'scouting'),
    ),
    transferSpend: -sumAmounts(
      transactions.filter((transaction) => transaction.kind === 'transfer-buy'),
    ),
    transferSaleIncome: sumAmounts(
      transactions.filter(
        (transaction) => transaction.kind === 'transfer-sell',
      ),
    ),
    trainingDrills: input.trainingDrills,
    trainingPointStart: input.trainingPointStart,
    trainingPointAmbientIncome: input.trainingPointAmbientIncome,
    trainingPointStoryDelta: input.trainingPointStoryDelta,
    trainingPointOtherDelta:
      state.trainingPoints -
      input.trainingPointStart -
      input.trainingPointAmbientIncome -
      input.trainingPointStoryDelta +
      input.trainingPointSpend,
    trainingPointSpend: input.trainingPointSpend,
    trainingPointEnd: state.trainingPoints,
    superTrainingSessions: input.superTrainingSessions,
    createdPlayerTrainingDrills: input.createdPlayerTrainingDrills,
    createdPlayerTrainingPointSpend: input.createdPlayerTrainingPointSpend,
    createdPlayerSuperTrainingSessions:
      input.createdPlayerSuperTrainingSessions,
    highestImportantAttribute: importantAttributes.highest,
    importantAttributeMedian: importantAttributes.median,
    importantAttributesByRole: importantAttributes.byRole,
    ...(importantAttributes.created === undefined
      ? {}
      : { createdPlayerImportantAttributes: importantAttributes.created }),
    sponsorObjectives: sponsorContracts.map((contract) => ({
      slot: contract.slot,
      sponsorName: contract.sponsorName,
      ...(contract.profile === undefined ? {} : { profile: contract.profile }),
      ...(contract.objective === undefined
        ? {}
        : {
            objectiveKind: contract.objective.kind,
            objectiveTarget: contract.objective.target,
          }),
      ...(contract.objectiveOutcome === undefined
        ? {}
        : {
            objectiveMet: contract.objectiveOutcome.met,
          }),
      actualBonus: contract.objectiveOutcome?.actualBonus ?? 0,
    })),
    recruitment: recruitmentSummary(input.recruitment),
    facilities: facilityLevels(state),
    startingElevenStrength: startingElevenStrength(state),
    boardUltimatumsIssued: input.boardUltimatumsIssued,
    boardForcedSales: lines.filter((line) => line.kind === 'board-sale').length,
    emergencyLoans: lines.filter((line) => line.kind === 'emergency-loan')
      .length,
    boardRescues: lines.filter((line) => line.kind === 'board-rescue').length,
  };
}

function summarizeImportantAttributes(state: GameState): {
  readonly highest: number;
  readonly median: number;
  readonly byRole: Record<Role, LongCareerImportantAttributeSummary>;
  readonly created?: Partial<Record<keyof Attrs, number>>;
} {
  const lineupPlayers = userLineupIds(state)
    .map((id) => state.players.find((player) => player.id === id))
    .filter((player): player is CareerPlayer => player !== undefined);
  const roleValues = (role: Role): number[] =>
    lineupPlayers
      .filter((player) => player.role === role)
      .flatMap((player) =>
        OWNER_IMPORTANT_ATTRIBUTES[role].map((attribute) =>
          visibleAttributeValue(player, attribute),
        ),
      );
  const valuesByRole = {
    GK: roleValues('GK'),
    DEF: roleValues('DEF'),
    MID: roleValues('MID'),
    FWD: roleValues('FWD'),
  };
  const allValues = Object.values(valuesByRole).flat();
  if (allValues.length === 0)
    throw new Error('owner-policy summary has no starting-eleven attributes');
  const createdPlayer = state.players.find(
    (player) => player.id === state.onboarding?.createdPlayerId,
  );
  const created =
    createdPlayer === undefined
      ? undefined
      : Object.fromEntries(
          OWNER_IMPORTANT_ATTRIBUTES[createdPlayer.role].map((attribute) => [
            attribute,
            visibleAttributeValue(createdPlayer, attribute),
          ]),
        );
  return {
    highest: Math.max(...allValues),
    median: median(allValues),
    byRole: {
      GK: summarizeAttributeValues(valuesByRole.GK),
      DEF: summarizeAttributeValues(valuesByRole.DEF),
      MID: summarizeAttributeValues(valuesByRole.MID),
      FWD: summarizeAttributeValues(valuesByRole.FWD),
    },
    ...(created === undefined
      ? {}
      : { created: created as Partial<Record<keyof Attrs, number>> }),
  };
}

function summarizeAttributeValues(
  values: readonly number[],
): LongCareerImportantAttributeSummary {
  if (values.length === 0)
    throw new Error('owner-policy summary has an empty role group');
  return {
    minimum: Math.min(...values),
    median: median(values),
    maximum: Math.max(...values),
    average: roundTwo(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    ),
  };
}

function median(values: readonly number[]): number {
  if (values.length === 0)
    throw new Error('owner-policy summary cannot take an empty median');
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? roundTwo((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function visibleAttributeValue(
  player: CareerPlayer,
  attribute: keyof Attrs,
): number {
  return attribute === 'ref'
    ? Math.min(999, player.attrs.ref + (player.refDisplayBonus ?? 0))
    : player.attrs[attribute];
}

function recruitmentSummary(
  window: RecruitmentWindow,
): LongCareerRecruitmentSummary {
  return {
    eligible: window.eligible,
    scoutStarted: window.scoutStarted,
    scoutBriefId: window.scoutBriefId,
    scoutReports: window.scoutReports,
    signings: window.signings,
    transferSpend: window.transferSpend,
    saleIncome: window.saleIncome,
    reportedStartingElevenGain: roundTwo(window.reportedStartingElevenGain),
    stopReason: window.stopReason,
  };
}

function buildRunResult(
  state: GameState,
  seed: number,
  difficulty: DifficultyMode,
  seasons: readonly LongCareerSeasonSummary[],
  divisionEntrySeason: Readonly<Partial<Record<DivisionLevel, number>>>,
  observer: RunObserver,
  censored: boolean,
): ClubBusinessLongCareerResult {
  const firstD1 = seasons.find((season) => season.division === 1);
  const sponsorObjectives = seasons
    .flatMap((season) => season.sponsorObjectives)
    .filter((objective) => objective.objectiveMet !== undefined);
  const lines = state.ledgers.flatMap((ledger) => ledger.lines);
  const sumSeason = (
    pick: (season: LongCareerSeasonSummary) => number,
  ): number => seasons.reduce((sum, season) => sum + pick(season), 0);
  return {
    kind: 'club-business-long-career-run',
    policyVersion: CLUB_BUSINESS_LONG_CAREER_POLICY_VERSION,
    inputHash: CLUB_BUSINESS_LONG_CAREER_INPUT_HASH,
    seed,
    difficulty,
    completedFirstD1: firstD1 !== undefined,
    censored,
    ...(firstD1 === undefined
      ? {}
      : {
          firstD1Season: firstD1.season,
          firstD1Position: firstD1.position,
        }),
    firstD1TopEight: firstD1 !== undefined && firstD1.position <= 8,
    firstD1GatePosition:
      firstD1?.position ?? CLUB_BUSINESS_LONG_CAREER_CENSOR_POSITION,
    divisionEntrySeason: { ...divisionEntrySeason },
    minimumObservedCash: observer.minimumCash,
    endingCash: userCash(state),
    endingFans: userFans(state),
    seasons,
    totals: {
      sponsorIncome: sumSeason((season) => season.sponsorIncome),
      sponsorObjectiveBonuses: sumSeason(
        (season) => season.sponsorObjectiveBonuses,
      ),
      ticketIncome: sumSeason((season) => season.ticketIncome),
      merchandiseIncome: sumSeason((season) => season.merchandiseIncome),
      wageExpense: sumSeason((season) => season.wageExpense),
      facilityUpkeepExpense: sumSeason(
        (season) => season.facilityUpkeepExpense,
      ),
      loanRepaymentExpense: sumSeason((season) => season.loanRepaymentExpense),
      ordinaryLedgerNet: sumSeason((season) => season.ordinaryLedgerNet),
      safetyIncome: sumSeason((season) => season.safetyIncome),
      facilityCapitalSpend: sumSeason((season) => season.facilityCapitalSpend),
      drillUpgradeSpend: sumSeason((season) => season.drillUpgradeSpend),
      scoutingSpend: sumSeason((season) => season.scoutingSpend),
      transferSpend: sumSeason((season) => season.transferSpend),
      transferSaleIncome: sumSeason((season) => season.transferSaleIncome),
      trainingDrills: sumSeason((season) => season.trainingDrills),
      sponsorObjectivesMet: sponsorObjectives.filter(
        (objective) => objective.objectiveMet,
      ).length,
      sponsorObjectivesSettled: sponsorObjectives.length,
      boardUltimatumsIssued: observer.ultimatumSeasonById.size,
      boardForcedSales: lines.filter((line) => line.kind === 'board-sale')
        .length,
      emergencyLoans: lines.filter((line) => line.kind === 'emergency-loan')
        .length,
      boardRescues: lines.filter((line) => line.kind === 'board-rescue').length,
      firstD4RecruitmentFund: sumAmounts(
        lines.filter(
          (line) =>
            line.kind === 'subsidy' &&
            line.label === 'County League recruitment fund',
        ),
      ),
    },
    finalStateFingerprint: stateFingerprint(state),
  };
}

function observeState(state: GameState, observer: RunObserver): void {
  const cash = userCash(state);
  observer.minimumCash = Math.min(observer.minimumCash, cash);
  observer.seasonMinimumCash = Math.min(observer.seasonMinimumCash, cash);
  const ultimatum = state.financialSafety?.boardUltimatum;
  if (ultimatum !== undefined) {
    observer.ultimatumSeasonById.set(ultimatum.id, ultimatum.issuedSeason);
  }
}

function facilityLevels(state: GameState): LongCareerFacilityLevel[] {
  const buildings = state.facilities.grid?.buildings ?? [];
  return FACILITY_PLAN.map((entry) => ({
    type: entry.type,
    level: (buildings.find((building) => building.type === entry.type)?.level ??
      0) as 0 | 1 | 2 | 3,
  }));
}

function weakestStartingRole(state: GameState): Role {
  return userLineupIds(state)
    .map((id) => state.players.find((player) => player.id === id))
    .filter((player): player is CareerPlayer => player !== undefined)
    .sort(
      (left, right) =>
        roleOverall(left.role, left.attrs) -
          roleOverall(right.role, right.attrs) ||
        left.id.localeCompare(right.id),
    )[0].role;
}

function weakestStarterForRole(
  state: GameState,
  role: Role,
): CareerPlayer | undefined {
  return userLineupIds(state)
    .map((id) => state.players.find((player) => player.id === id))
    .filter(
      (player): player is CareerPlayer =>
        player !== undefined &&
        player.role === role &&
        player.contractPromise?.perk !== 'GUARANTEED_STARTER' &&
        player.contractPromise?.perk !== 'CAPTAINCY',
    )
    .sort(
      (left, right) =>
        roleOverall(left.role, left.attrs) -
          roleOverall(right.role, right.attrs) ||
        left.id.localeCompare(right.id),
    )[0];
}

function reportedOverall(report: ScoutReport): number {
  const attrs = Object.fromEntries(
    Object.entries(report.statRanges).map(([key, range]) => [
      key,
      Math.round((range.minimum + range.maximum) / 2),
    ]),
  ) as unknown as Attrs;
  return roleOverall(report.role, attrs);
}

function startingElevenStrength(state: GameState): number {
  const team = buildCareerMatchTeamDef(state, state.userClubId);
  return roundTwo(
    team.players.reduce(
      (sum, player) => sum + roleOverall(player.role, player.attrs),
      0,
    ) / team.players.length,
  );
}

function userDivision(state: GameState): DivisionLevel {
  if (state.m2 === undefined)
    throw new Error('long-career state has no full-career ladder');
  return currentUserDivision(state.m2);
}

function userLineupIds(state: GameState): readonly string[] {
  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === state.userClubId,
  );
  if (lineup === undefined)
    throw new Error('long-career state lost the user lineup');
  return lineup.playerIds;
}

function userCash(state: GameState): number {
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined)
    throw new Error('long-career state lost the user club');
  return club.cash;
}

function userFans(state: GameState): number {
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined)
    throw new Error('long-career state lost the user club');
  return club.fans;
}

function sumAmounts(rows: readonly { readonly amount: number }[]): number {
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function stateFingerprint(state: GameState): string {
  return jsonFingerprint(state);
}

function manifestFingerprint(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined)
    throw new Error('long-career manifest value is not JSON serializable');
  return `sha256:${createHash('sha256').update(json).digest('hex')}:${json.length}`;
}

function jsonFingerprint(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined)
    throw new Error('long-career manifest value is not JSON serializable');
  let hash = 2166136261;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${(hash >>> 0).toString(16).padStart(8, '0')}:${json.length}`;
}

function assertUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new Error(`${label} must be a uint32`);
  }
}
