import type { MarketNegotiationViewModel } from './market-models';
import type { M2LeagueFixtureViewModel } from './m2-league-models';
import type {
  AssistantGuideDestination,
  AssistantGuideSequenceId,
  ManagerTipDestination,
} from '../content';
import type { PotentialGrade } from '../game/archetype-caps';
import type { AwardCategoryId } from '../game/types';
import type { PowerId } from '../sim/types';
import type { TrainingModifier } from '../game/training';

export type ManagementTab = 'home' | 'squad' | 'club' | 'market' | 'league';

/**
 * The Club office's three boards. Held above the screen because the desk sends
 * the manager to a specific one — the inbox's build job opens Facility, the
 * ledger warnings open Finances — and because Bert's fans lesson has to know
 * which board is showing before he steps out on it.
 */
export type ClubOfficeTab = 'facility' | 'staff' | 'finances';

export interface ResourceSummaryViewModel {
  money: number;
  trainingPoints: number;
}

export interface FixtureViewModel {
  id: string;
  weekLabel: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  venueLabel: string;
  opponentHeroCount: number;
  matchdayReady: boolean;
}

export interface ClubAlertViewModel {
  id: string;
  title: string;
  detail: string;
  tone: 'urgent' | 'event' | 'info';
  guideSequenceId?: AssistantGuideSequenceId;
  destination?: AssistantGuideDestination;
  /** Set on player-scoped alerts (e.g. a player waiting on a request) so taps can deep-link to that player. */
  playerId?: string;
  /**
   * Marks a row about a powered player, drawn as the board panel's Hero chip.
   * A hero leaving is the loaded case and used to read like any other row.
   */
  isHero?: boolean;
}

/**
 * A calendar beat with nothing to decide. Notes carry no route and no tone:
 * the whole message is on the card, so there is nothing to open.
 */
export interface ManagerNoteViewModel {
  id: string;
  title: string;
  detail: string;
  /** Tips are a find on a quiet week; notes are the calendar. Read differently. */
  kind?: 'note' | 'tip';
  /** Optional demonstration reached by the tip's Take Me There button. */
  destination?: ManagerTipDestination;
}

export interface LeagueSnippetViewModel {
  position: number;
  clubName: string;
  played: number;
  goalDifference: number;
  points: number;
}

export interface LeagueTableRowViewModel {
  position: number;
  clubId: string;
  clubName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalDifference: number;
  points: number;
  isUserClub: boolean;
  inPromotionPlaces: boolean;
}

export interface LeagueTableViewModel {
  divisionLabel: string;
  seasonLabel: string;
  weekLabel: string;
  matchesPlayed: number;
  matchesTotal: number;
  userPosition: number;
  userPoints: number;
  leaderPoints: number;
  rows: readonly LeagueTableRowViewModel[];
  readonly leagueFixtures: readonly M2LeagueFixtureViewModel[];
}

export interface HomeViewModel {
  clubName: string;
  managerName: string;
  seasonLabel: string;
  divisionLabel: string;
  weekLabel: string;
  nextMatchTimingLabel: string;
  /** True only when the engine has an unresolved league or Hero Cup fixture this week. */
  isCurrentGameWeek: boolean;
  form: readonly ('W' | 'D' | 'L')[];
  resources: ResourceSummaryViewModel;
  nextFixture: FixtureViewModel;
  alerts: readonly ClubAlertViewModel[];
  notes: readonly ManagerNoteViewModel[];
  boardUltimatum?: {
    id: string;
    weeksRemaining: number;
    targetCash: number;
    /**
     * What the board is asking for, in words. The target is zero — the board
     * wants the overdraft cleared — and printing that as "$0" read like an
     * unfilled placeholder.
     */
    targetLabel: string;
    cashNeeded: number;
    protectedPlayerId?: string;
    candidates: readonly {
      playerId: string;
      playerName: string;
      role: 'GK' | 'DEF' | 'MID' | 'FWD';
      lookId?: string;
      weeklyWage: number;
      marketValue: number;
      forcedSaleFee: number;
      discountPercent: number;
      isHero: boolean;
    }[];
  };
  boardResolution?: {
    kind: 'TARGET_MET' | 'FORCED_SALE';
    headline: string;
    detail: string;
    soldPlayer?: {
      id: string;
      name: string;
      role: 'GK' | 'DEF' | 'MID' | 'FWD';
      lookId?: string;
      buyerName: string;
      fee: number;
    };
    replacementPlayer?: {
      id: string;
      name: string;
      role: 'GK' | 'DEF' | 'MID' | 'FWD';
      lookId?: string;
      age: number;
      weeklyWage: number;
    };
    fansLost?: number;
    moraleDelta?: number;
  };
  table: readonly LeagueSnippetViewModel[];
}

export interface TacticViewModel {
  id: string;
  label: string;
  detail: string;
}

export interface LineupPlayerViewModel {
  id: string;
  name: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  lookId?: string;
  shirtNumber: number;
  isHero: boolean;
  overall: number;
  condition: number;
}

export interface BenchPlayerViewModel extends LineupPlayerViewModel {
  injuryWeeks: number;
  /** Weeks away on a granted request. Blocks selection exactly as injury does. */
  awayWeeks: number;
  licensed: boolean;
  canStart: boolean;
  unavailableLabel?: string;
}

export interface HeroLicenseViewModel {
  playerId: string;
  playerName: string;
  powerName: string;
  licensed: boolean;
}

export interface MatchDayViewModel {
  fixture: FixtureViewModel;
  formationLabel: string;
  selectedTacticId: string;
  tactics: readonly TacticViewModel[];
  lineup: readonly LineupPlayerViewModel[];
  bench: readonly BenchPlayerViewModel[];
  heroLimit: number;
  heroes: readonly HeroLicenseViewModel[];
  licenseReady: boolean;
}

export interface MatchResultViewModel {
  fixtureId: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  outcomeLabel: 'WIN' | 'DRAW' | 'LOSS';
  /**
   * Which name the report boxes up as the winner, independent of the manager's
   * point of view. A league draw boxes nobody; a tied Cup score boxes the
   * recorded penalty winner.
   */
  winner: 'home' | 'away' | null;
  /**
   * True when this defeat put the club out of the Hero Cup.
   *
   * There is no second leg and level ties are settled on the day, so a cup
   * loss is always the end of the run — which is what Bert's once-a-career
   * consolation is hung on.
   */
  cupExit: boolean;
}

/**
 * What the touchline says about the result, decided once so a re-render cannot
 * change the gaffer's mind halfway through reading it.
 *
 * He always has a line: this is the report's closing beat, so a silent coach
 * would leave the score with nothing under it. A loss puts him in tears unless
 * the blame roll comes up, in which case the assistant is standing there being
 * pointed at instead. Absent entirely when the club has no head coach to react,
 * which only happens between sacking one and hiring the next.
 */
export interface FulltimeReactionViewModel {
  pose: 'joy' | 'rest' | 'cry' | 'point';
  coachPortraitId: string;
  coachName: string;
  /** What he says, from the pool the result fell into. */
  line: string;
  /** Only on the blame pose: who is getting it. */
  assistantPortraitId?: string;
  assistantName?: string;
}

export interface LedgerLineViewModel {
  id: string;
  label: string;
  amount: number;
  kind: 'income' | 'expense' | 'neutral';
}

export interface HighlightViewModel {
  id: string;
  minuteLabel: string;
  description: string;
}

export interface WeekUpdateViewModel {
  id: string;
  title: string;
  detail: string;
  tone: 'positive' | 'warning' | 'info';
}

export interface FacilityCompletionViewModel {
  type: FacilityTypeViewModel;
  name: string;
  level: 1 | 2 | 3;
  kind: 'BUILD' | 'UPGRADE';
}

export interface WeeklyReviewViewModel {
  completedWeekLabel: string;
  nextWeekLabel: string;
  clubName: string;
  cashBefore: number;
  cashAfter: number;
  netAmount: number;
  trainingPointsBefore: number;
  trainingPointsAfter: number;
  netTrainingPoints: number;
  ledger: readonly LedgerLineViewModel[];
  updates: readonly WeekUpdateViewModel[];
  facilityCompletion?: FacilityCompletionViewModel;
  nextFixture?: FixtureViewModel;
}

export interface PostMatchViewModel {
  result: MatchResultViewModel;
  ledger: readonly LedgerLineViewModel[];
  netAmount: number;
  trainingPointsGained: number;
  fanDelta: number;
  /** Present from Season 3 when this was a production user match. */
  buzz?: {
    earned: number;
    rawEarned: number;
    valueAfter: number;
    win: number;
    goals: number;
    heroMoments: number;
    payout?: number;
  };
  highlights: readonly HighlightViewModel[];
  updates: readonly WeekUpdateViewModel[];
  facilityCompletion?: FacilityCompletionViewModel;
  /** Absent when the club has nobody on the touchline to react. */
  reaction?: FulltimeReactionViewModel;
}

export interface SquadPlayerViewModel {
  id: string;
  name: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  lookId?: string;
  overall: number;
  condition: number;
  injuryWeeks: number;
  /** Weeks away on a granted request; shown as its own ON LEAVE panel. */
  awayWeeks: number;
  /**
   * Whether a drill would be accepted right now. Derived once here so the
   * button and `trainPlayerInstantly` cannot disagree about who is available —
   * a disabled control is better than an error banner after the tap.
   */
  canTrain: boolean;
  isStarter: boolean;
  age: number;
  archetype: string;
  potentialGrade: PotentialGrade;
  /** Chance the next drill is a SUPER (1.5x) session, from the potential grade. */
  superChancePercent: number;
  /** Drills still owed under a TRAINING_PRIORITY promise; shown as the countdown badge. */
  priorityDrillsRemaining?: number;
  /** Tap-time injury gamble at current condition; 0 above the fatigue line. */
  injuryRiskPercent: number;
  positionTrainingLabel: string;
  personality: string;
  morale: number;
  /** How much they want to stay, 0-100. Decides the price of the next contract. */
  loyalty: number;
  fame: number;
  weeklyWage: number;
  contractLabel: string;
  contractPromiseLabel?: string;
  /** Set only within one season of the announcement; absent while it is far off. */
  retirementLabel?: string;
  shirtNumber?: number;
  isCaptain: boolean;
  powerName?: string;
  licensed: boolean;
  attributes: readonly {
    label: 'PAC' | 'SHO' | 'PAS' | 'DEF' | 'TEC' | 'STA' | 'REF';
    value: number;
    /** Universal safety ceiling; intentionally hidden from normal player-facing UI. */
    cap: number;
  }[];
}

export interface FocusDrillViewModel {
  id: string;
  name: string;
  focusLabel: string;
  gainLabel: string;
  moneyCost: number;
  trainingPointCost: number;
  selected: boolean;
  available: boolean;
  lockedReason?: string;
}

export interface CoachStaffMemberViewModel {
  id: string;
  role: 'HEAD' | 'ASSISTANT';
  roleLabel: 'Head coach' | 'Assistant coach';
  portraitId: string;
  name: string;
  age: number;
  personalityLabel: string;
  level: number;
  specialtyLabels: readonly [string, string];
  effectLabels: readonly string[];
  weeklyWage: number;
  seasonsEmployed: number;
  severanceCost: number;
}

export interface TrainingSlotStatOption {
  pathId: string;
  /** Display label for the stat, e.g. "Defense". */
  label: string;
  /** Attribute code for the compact current-value line, e.g. "DEF". */
  shortCode: 'PAC' | 'SHO' | 'PAS' | 'DEF' | 'TEC' | 'STA' | 'REF';
  /** Owned drill tier's title, e.g. "Duels 3". */
  drillName: string;
  /** Owned tier's TP cost per tap. */
  tpCost: number;
  /** Owned tier's gain for this stat. */
  gain: number;
  /** The selected player's current value in this stat. */
  currentValue: number;
  /** Where the authored drill alone would take this stat. */
  baseValueAfter: number;
  /** Signed whole-point difference from player and club training modifiers. */
  trainingAdjustment: number;
  /** Active modifiers grouped for the confirmation card. */
  /** Each influence on this drill's result, with the direction it pushes. */
  trainingModifiers: readonly TrainingModifier[];
  /** True at the invisible 999 safety ceiling; never shown as a number. */
  atSafetyCeiling: boolean;
  /** False when the TP bank cannot cover this drill right now. */
  affordable: boolean;
}

/** One training path's drill shop row: what the club owns and what the next tier costs. */
export interface TrainingUpgradeViewModel {
  pathId: string;
  /** The stat the path trains, e.g. "Defense". */
  label: string;
  /** The owned drill's title, e.g. "Duels 2". */
  drillName: string;
  ownedTier: number;
  /** What one tap of the owned drill gives and costs today. */
  ownedGain: number;
  ownedTpCost: number;
  /** Absent once the path owns Tier 5. */
  nextTier?: number;
  nextGain?: number;
  nextTpCost?: number;
  cost?: number;
  /** Set when the upgrade is on the shelf but cannot be bought yet. */
  blockedReason?: string;
}

/** One resolved instant drill, sequenced so repeat taps re-animate. */
export interface DrillResultViewModel {
  sequence: number;
  /**
   * Which drill this was in the whole career, from GameState.totalInstantDrills.
   * The condition warning waits for the third one: by then the manager has seen
   * the number move twice and is ready to be told what it costs.
   */
  totalDrillsRun: number;
  playerId: string;
  pathId: string;
  drillId: string;
  attribute: string;
  tpSpent: number;
  isSuper: boolean;
  /** The stored stat, which the sim, scout, wage and transfer fee all read. */
  before: number;
  after: number;
  /**
   * What the scene counts up to. Runs ahead of the stored pair for a keeper's
   * Reflexes so the halved Keeper Drills ladder reads like the outfield one;
   * identical to `before` / `after` for everything else.
   */
  displayedBefore: number;
  displayedAfter: number;
  conditionAfter: number;
  injury?: { chancePercent: number; recoveryWeeks: number };
}

export interface SquadTrainingViewModel {
  resources: ResourceSummaryViewModel;
  players: readonly SquadPlayerViewModel[];
  /**
   * The rookie the manager built. They are sorted to the top of the roster, and
   * the first-training cue glows their Train button alone — lighting all
   * fifteen left the "Tap +" arrow pointing at nothing in particular.
   */
  createdPlayerId?: string;
  /** Every stat path's owned-tier option for the selected player, when one is selected. */
  selectedPlayerStatOptions?: readonly TrainingSlotStatOption[];
  /** The drill shop: one row per training path, in TRAINING_PATHS order. */
  drillUpgrades: readonly TrainingUpgradeViewModel[];
  /** Set while a fit promised player is still owed drills: only they may train. */
  trainingPromiseGate?: { playerId: string; playerName: string; remaining: number };
}

export interface TrainingGroundDecisionViewModel {
  built: boolean;
  underConstruction: boolean;
  weeksRemaining?: number;
  affordable: boolean;
  cost: number;
  weeklyTrainingPoints: number;
}

export type FacilityTypeViewModel =
  | 'training-pitch'
  | 'gym'
  | 'tech-center'
  | 'shooting-range'
  | 'keeper-court'
  | 'medical-bay'
  | 'dorm'
  | 'scout-office'
  | 'coaching-office'
  | 'youth-field'
  | 'fan-shop'
  | 'stadium-stand';

export interface ClubFacilityBuildingViewModel {
  id: string;
  type: FacilityTypeViewModel;
  name: string;
  level: 1 | 2 | 3;
  x: number;
  y: number;
  width: number;
  height: number;
  weeklyUpkeep: number;
  effectLabel: string;
  nextLevelEffectLabel?: string;
  upgradeCost?: number;
  upgradeBlockedReason?: string;
  canUpgrade: boolean;
  upgradeShortfall: number;
  relocationFee: number;
  status: 'operational' | 'construction' | 'upgrading';
  weeksRemaining?: number;
  targetLevel?: 1 | 2 | 3;
  canRelocate: boolean;
  relocationShortfall: number;
  activeAdjacencyIds: readonly string[];
  /** Half of everything sunk into it, paid back on closing. */
  closeRefund: number;
  /** False while a crew is on it: nothing half-built can be demolished. */
  canClose: boolean;
}

export interface ClubFacilityCatalogViewModel {
  type: FacilityTypeViewModel;
  name: string;
  buildCost: number;
  width: number;
  height: number;
  weeklyUpkeep: number;
  effectLabel: string;
  available: boolean;
  affordable: boolean;
  buildWeeks: number;
  blockedReason?: string;
  affordabilityShortfall: number;
}

export interface ClubFacilityGridViewModel {
  width: 8;
  height: 6;
  buildings: readonly ClubFacilityBuildingViewModel[];
  catalog: readonly ClubFacilityCatalogViewModel[];
  weeklyUpkeep: number;
  activeAdjacencies: readonly string[];
  discoveredAdjacencies: readonly string[];
  activeProject?: {
    buildingId: string;
    name: string;
    benefitLabel: string;
    kind: 'BUILD' | 'UPGRADE';
    weeksRemaining: number;
    totalWeeks: number;
    targetLevel: 1 | 2 | 3;
  };
}

/**
 * The board's emergency loan, while any of it is still owed.
 *
 * Present only when there is a balance to show, which is the same rule the
 * `emergency-loan` inbox row uses. The row was the club's ONLY view of this for
 * as long as the loan lasted, which is why it could never be allowed to yield
 * its desk slot; the accounts office is where a debt belongs.
 */
export interface ClubLoanViewModel {
  /** What the board paid in. The balance starts higher: the loan carries interest. */
  originalAmount: number;
  remainingBalance: number;
  /** 'Repayments begin' before the first repayment season, 'Weeks left' during it. */
  scheduleLabel: string;
  scheduleValue: string;
  detail: string;
}

/**
 * Match, sponsor and prize income from the settled week.
 *
 * These are the three ledger kinds `weeklyNet` deliberately cannot forecast — a
 * gate needs a home fixture, the sponsor pays every fourth week, the prize lands
 * once a season — so they are reported as banked fact beside the projection
 * rather than folded into it.
 */
export interface ClubVariableIncomeViewModel {
  amount: number;
  /**
   * Why the amount is zero, on the weeks where a bare `$0` would read as a bug
   * rather than as a fact. Absent whenever the amount speaks for itself.
   */
  detail?: string;
}

export interface SponsorOfferViewModel {
  offerId: string;
  sponsorName: string;
  offerLine: string;
  profile: 'STEADY' | 'BALANCED' | 'BOLD';
  profileLabel: string;
  nominalMonthlyFee: number;
  actualMonthlyFee: number;
  objectiveLabel: string;
  nominalBonus: number;
  actualBonus: number;
}

export interface SponsorSlotViewModel {
  slot: number;
  slotLabel: string;
  sponsorName: string;
  offerLine: string;
  provisional: boolean;
  nominalMonthlyFee: number;
  actualMonthlyFee: number;
  objectiveLabel?: string;
  objectiveProgressLabel?: string;
  objectiveStatus?: 'IN_PROGRESS' | 'MET' | 'FAILED';
  nominalBonus?: number;
  actualBonus?: number;
  offers: readonly SponsorOfferViewModel[];
}

export interface ClubSponsorshipViewModel {
  managed: boolean;
  offerWindowOpen: boolean;
  actualMonthlyIncome: number;
  nominalMonthlyIncome: number;
  /** The next ordinary sponsor payment, or the next pre-season once W28 passed. */
  nextPaymentLabel: string;
  chairmanPercent?: number;
  slots: readonly SponsorSlotViewModel[];
  buzz?: {
    value: number;
    pendingPayout: number;
    nextPayoutLabel: string;
    lastSettlementLabel?: string;
  };
}

export interface ClubFinancesViewModel {
  periodLabel: string;
  resources: ResourceSummaryViewModel;
  /** Absent until the board writes its one emergency loan, and once it is repaid. */
  loan?: ClubLoanViewModel;
  /**
   * The settled weeks the statement shows, newest first, each line carrying the
   * week it belongs to. Falls back to the recurring projection before the first
   * week settles.
   */
  ledger: readonly (LedgerLineViewModel & { periodLabel: string })[];
  recentTransactions: readonly (LedgerLineViewModel & {
    periodLabel: string;
    balanceAfter: number;
  })[];
  fans: number;
  variableIncome: ClubVariableIncomeViewModel;
  weeklyNet: number;
  projectedBalance: number;
  wageSubsidyLabel?: string;
  trainingGround: TrainingGroundDecisionViewModel;
  legacyTrainingGroundVisible: boolean;
  /** Titles the office. The board being read is named by the tab strip under it. */
  clubName: string;
  coachingStaff: readonly CoachStaffMemberViewModel[];
  facilities: ClubFacilityGridViewModel;
  trainingPointIncome: TrainingPointIncomeViewModel;
  /** Absent until D4 managed sponsorship or Season 3 Buzz becomes visible. */
  sponsorship?: ClubSponsorshipViewModel;
}

/**
 * Where next week's training points come from, one row per contributor.
 *
 * The number in the HUD is the only thing the manager ever saw, so a Training
 * Pitch upgrade and a coach hire both read as "it went up" without saying by
 * how much or because of what.
 */
export interface TrainingPointIncomeViewModel {
  rows: readonly {
    id: string;
    label: string;
    /** What earns it, when the label alone does not say. */
    detail?: string;
    points: number;
  }[];
  total: number;
}

export interface StoryEventPlayerViewModel {
  id: string;
  name: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  detail: string;
  powerName?: string;
}

export interface StoryEventChoiceViewModel {
  id: string;
  label: string;
  detail: string;
  consequenceHint: string;
  tone: 'safe' | 'risky';
  disabled?: boolean;
  disabledReason?: string;
}

export type StoryEventRewardKind =
  | 'money'
  | 'morale'
  | 'fans'
  | 'training-points'
  | 'stat'
  | 'injury'
  | 'story';

export interface StoryEventRewardViewModel {
  label: string;
  kind: StoryEventRewardKind;
  positive: boolean;
}

export interface StoryEventViewModel {
  id: string;
  artKey: string;
  category: 'mystery' | 'club' | 'media' | 'sponsor' | 'player' | 'medical' | 'fan';
  weekLabel: string;
  categoryLabel: string;
  title: string;
  body: string;
  selectedPlayer?: StoryEventPlayerViewModel;
  playerSelectionRequired: boolean;
  choices: readonly StoryEventChoiceViewModel[];
  resolvedChoiceId?: string;
  resolvedRisky?: boolean;
  resolvedSuccess?: boolean;
  outcomeTitle?: string;
  outcomeText?: string;
  outcomeRewards?: readonly StoryEventRewardViewModel[];
  outcomeHasFollowUp?: true;
  successCutscene?: {
    artKey: string;
    headline: string;
    rewards: readonly string[];
    hasFollowUp?: true;
  };
}

export interface AwakeningCutsceneViewModel {
  fixtureLabel: string;
  playerId: string;
  playerName: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  lookId?: string;
  powerId: PowerId;
  powerName: string;
  /** Plain-language mechanics copy shown before the playable effect demo. */
  powerDescription: string;
  limpCopy: string;
  triggerVisual:
    | 'caterpillar'
    | 'water'
    | 'cpr'
    | 'sponge'
    | 'sneeze'
    | 'ice'
    | 'drink'
    | 'sprinkler'
    | 'shin-guard'
    | 'meteor'
    | 'ball'
    | 'confetti'
    | 'feather'
    | 'thermometer'
    | 'defibrillator';
  triggerKicker: string;
  triggerTitle: string;
  triggerCallout: string;
  triggerDetail: string;
  triggerCopy: string;
  omenCopy: string;
  revealCopy: string;
  firstHero: boolean;
  licenseLabel: string;
  continueLabel: string;
}

export interface SeasonTableRowViewModel {
  position: number;
  clubId: string;
  clubName: string;
  played: number;
  goalDifference: number;
  points: number;
  isUserClub: boolean;
  promoted: boolean;
}

export interface ExpiredContractViewModel {
  playerId: string;
  playerName: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  lookId?: string;
  powerName?: string;
  currentWeeklyWage: number;
  quotedWeeklyWage: number;
  isHeroWageCliff: boolean;
  termOptions: readonly (1 | 2 | 3)[];
  /** Present only when age has cut the term below three seasons. */
  shortTermReason?: string;
  selectedTerm: 1 | 2 | 3;
  decision: 'pending' | 'renewed';
  requiresNegotiation: boolean;
  remainingExpiredCount: number;
}

/** Money and target outcomes already settled by the real Week 30 career path. */
export interface SeasonEndClubBusinessViewModel {
  objectiveResults: readonly {
    contractId: string;
    sponsorName: string;
    objectiveLabel: string;
    met: boolean;
    /** The cash that reached the club after any Chairman adjustment. */
    actualBonus: number;
  }[];
  objectiveBonusTotal: number;
  buzz?: {
    reached: number;
    actualPayout: number;
    resetTo: 0;
  };
  /** Objective bonuses plus the season-end Buzz payment, using actual receipts. */
  actualPayoutTotal: number;
}

export interface SeasonEndViewModel {
  seasonLabel: string;
  outcomeLabel: 'CHAMPIONS' | 'PROMOTED' | 'SAFE' | 'RELEGATED';
  headline: string;
  summary: string;
  finalPosition: number;
  prizeMoney: number;
  difficultyLabel: 'COZY' | 'CHAIRMAN';
  recap?: {
    record: string;
    goals: string;
    cashChange: number;
    closingCash: number;
    trainingCapsReached: number;
    cupResult: string;
    memorableEventTitle?: string;
    awards: readonly {
      playerId: string;
      playerName: string;
      role: 'GK' | 'DEF' | 'MID' | 'FWD';
      lookId?: string;
      label: string;
      detail: string;
    }[];
  };
  table: readonly SeasonTableRowViewModel[];
  promotionRewards?: {
    divisionLabel: string;
    items: readonly {
      title: string;
      detail: string;
    }[];
  };
  clubBusinessSettlement?: SeasonEndClubBusinessViewModel;
  expiredContract?: ExpiredContractViewModel;
  renewalNegotiation?: MarketNegotiationViewModel;
  sliceComplete: boolean;
  canContinue: boolean;
}

export interface ClubLegacyChoiceViewModel {
  id: 'coach-candidate' | 'farewell';
  label: string;
  detail: string;
  outcome: string;
}

/** One name on the club's roll of former players. */
export interface ClubLegacyFormerPlayerViewModel {
  playerId: string;
  playerName: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  lookId?: string;
  /** Powered players get the board panel's Hero chip here too. */
  isHero: boolean;
  detail: string;
}

export interface ClubLegacyViewModel {
  seasonLabel: string;
  queueLabel: string;
  playerId: string;
  playerName: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  lookId?: string;
  archetype: string;
  personality: string;
  fame: number;
  seasonsAtClub: number;
  /** True when the legend played with a power. A hero's farewell reads differently. */
  isHero: boolean;
  choices: readonly ClubLegacyChoiceViewModel[];
  /** Everyone who has retired from this club, most recent first. */
  formerPlayers: readonly ClubLegacyFormerPlayerViewModel[];
  /** How many the roll is showing out of, when it is longer than the panel. */
  formerPlayerTotal: number;
}

export interface ChampionshipCelebrationPlayerViewModel {
  id: string;
  name: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  isHero: boolean;
  /** The exact atlas character used for this player in the final match. */
  spriteKey: string;
}

/** A hired coach, drawn as a standing figure for the celebration scenes. */
export interface CelebrationCoachViewModel {
  readonly id: string;
  readonly name: string;
  readonly spriteKey: string;
}

export interface ChampionshipCelebrationViewModel {
  seasonLabel: string;
  clubName: string;
  assistantName: string;
  star: ChampionshipCelebrationPlayerViewModel & {
    goals: number;
    hasRecordedGoals: boolean;
  };
  squad: readonly ChampionshipCelebrationPlayerViewModel[];
  /** The hired staff, standing with the squad. Empty when the club runs none. */
  coaches: readonly CelebrationCoachViewModel[];
}

/**
 * The three moments that mark the end of the main climb.
 *
 * `global-league` and `cup-winners` are the halfway houses — one trophy in, one
 * still to get — and each points at the other. `true-ending` is the pair being
 * completed, in whichever order the manager completed it.
 */
export type EndgameCelebrationKind = 'global-league' | 'cup-winners' | 'true-ending';

export interface EndgameCelebrationPlayerViewModel {
  readonly id: string;
  readonly name: string;
  readonly role: 'GK' | 'DEF' | 'MID' | 'FWD';
  readonly isHero: boolean;
  /** Career fame, which is what picked the star out of the squad. */
  readonly fame: number;
  /** The exact atlas character used for this player in the final match. */
  readonly spriteKey: string;
  /** His assigned look, so a single walk-on wears his own face. */
  readonly lookId?: string;
}

export interface EndgameCelebrationViewModel {
  readonly kind: EndgameCelebrationKind;
  readonly seasonLabel: string;
  readonly clubName: string;
  readonly assistantName: string;
  readonly headline: string;
  readonly subheading: string;
  /**
   * Body copy on the two smaller screens, and one speech bubble per entry on
   * the true ending. Always rendered in full under reduced motion: no line of
   * this may live only in the animation.
   */
  readonly lines: readonly string[];
  /** The highest-fame player. Absent only for a club with no squad left. */
  readonly star?: EndgameCelebrationPlayerViewModel;
  /** Everyone else, for the two squad walk-outs. Empty on the true ending. */
  readonly squad: readonly EndgameCelebrationPlayerViewModel[];
  /** The hired staff, standing with the squad. Empty when the club runs none. */
  readonly coaches: readonly CelebrationCoachViewModel[];
  /** False on the true ending, which holds the manager in for all of it. */
  readonly skippable: boolean;
  readonly accessibilityLabel: string;
}

/**
 * One name on one podium.
 *
 * `position` is the podium slot, not the leader board's shared rank. The podium
 * is already cut to three and ordered by the board's player-ID tiebreak, and
 * the prize pays whoever tops it, so numbering the slots is what keeps the man
 * who is crowned and the man who is paid the same man.
 */
export interface AwardCeremonyPlacingViewModel {
  readonly position: number;
  readonly playerId: string;
  readonly playerName: string;
  readonly clubName: string;
  readonly value: number;
  readonly isUserPlayer: boolean;
}

/**
 * The one player who walks on to speak for a board.
 *
 * Always the manager's own: his highest-placed player on that podium. A rival
 * never walks on, however he finished — reversed after seeing two walk-ons a
 * board running, where the rival's moment cost the manager's the room.
 */
export interface AwardCeremonySpeakerViewModel {
  readonly placing: AwardCeremonyPlacingViewModel;
  /** Which pool the line was drawn from: he topped the board, or he did not. */
  readonly tone: AwardCeremonySpeechTone;
  readonly line: string;
}

export type AwardCeremonySpeechTone = 'winner' | 'runner-up';

export interface AwardCeremonyBeatViewModel {
  readonly categoryId: AwardCategoryId;
  readonly boardLabel: string;
  readonly metricLabel: string;
  /**
   * Up to three, in the order they are revealed: third, then second, then
   * first. A division where nobody registered the metric has none.
   */
  readonly placings: readonly AwardCeremonyPlacingViewModel[];
  /** Shown in place of the podium when the category has no placings. */
  readonly emptyLabel: string;
  /**
   * Absent when no player of the manager's reached this podium, which is also
   * every board a rival won outright: the three placings are read out and the
   * ceremony moves on.
   */
  readonly speaker?: AwardCeremonySpeakerViewModel;
  /** Whether this board's prize was paid to the manager's club. */
  readonly wonByUserPlayer: boolean;
}

export interface AwardCeremonyPrizeViewModel {
  readonly totalTrainingPoints: number;
  /**
   * What ONE board is worth at the division the club is entering.
   *
   * Context for the total, not a factor of it: the prize tapers per board, so
   * `total` is not this figure times `boardsWon`.
   */
  readonly perCategoryTrainingPoints: number;
  readonly boardsWon: number;
}

export interface AwardCeremonyViewModel {
  readonly seasonLabel: string;
  /**
   * Always four, in reveal order: keepers, defenders, midfielders, strikers.
   * A season the club won nothing in still has four beats to watch.
   */
  readonly beats: readonly AwardCeremonyBeatViewModel[];
  readonly prize: AwardCeremonyPrizeViewModel;
}

/** One figure on the Hall of Fame page: a label, the number, and what it is of. */
export interface HallOfFameStatViewModel {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

/**
 * One trophy, stamped with the season it was won.
 *
 * Deliberately not a stat row: an honour needs no third line saying what kind
 * of trophy it is, because "D3 National champions" already says it.
 */
export interface HallOfFameHonourViewModel {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

/**
 * One tier the club played in, as the climb ladder draws it.
 *
 * Split into a figure and a sentence for the reason the stat rows are: at
 * 375pt a tier row has about 255pt of text width, and the whole spell written
 * as one line breaks after "best", leaving the finish stranded on a line of
 * its own. Two lines, broken where the writing breaks anyway.
 */
export interface HallOfFameTierViewModel {
  readonly division: number;
  readonly label: string;
  readonly firstSeason: number;
  readonly seasons: number;
  readonly bestPosition: number;
  /** The finish, as the figure of the row: "Best 1st". */
  readonly best: string;
  /** When the club got there and how long it stayed. */
  readonly detail: string;
}

/**
 * The Hall of Fame before the climb is finished.
 *
 * A state of the page rather than a hidden page: the button is always there,
 * and tapping it is the one place that says the climb has an end.
 */
export interface HallOfFameLockedViewModel {
  readonly status: 'locked';
  readonly title: string;
  readonly kicker: string;
  readonly headline: string;
  readonly lines: readonly string[];
  readonly accessibilityLabel: string;
}

/**
 * The finished career's record.
 *
 * Every number here was captured when the climb completed and is only read
 * back. Nothing on this page is recomputed from live state, which by then no
 * longer holds the evidence.
 */
export interface HallOfFameRecordViewModel {
  readonly status: 'complete';
  readonly title: string;
  readonly kicker: string;
  readonly headline: string;
  readonly subheading: string;
  readonly stats: readonly HallOfFameStatViewModel[];
  /** Titles and Cups, oldest first. */
  readonly honours: readonly HallOfFameHonourViewModel[];
  /** Shown instead of the honours list when the club won no league title. */
  readonly honoursEmptyLabel: string;
  readonly tiers: readonly HallOfFameTierViewModel[];
  readonly accessibilityLabel: string;
}

export type HallOfFameViewModel = HallOfFameLockedViewModel | HallOfFameRecordViewModel;
