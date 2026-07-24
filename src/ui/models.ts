import type { MarketNegotiationViewModel } from './market-models';
import type { M2LeagueFixtureViewModel } from './m2-league-models';
import type { AssistantGuideDestination, AssistantGuideSequenceId } from '../content';
import type { PotentialGrade } from '../game/archetype-caps';
import type { PowerId } from '../sim/types';

export type ManagementTab = 'home' | 'squad' | 'club' | 'market' | 'league';

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
  form: readonly ('W' | 'D' | 'L')[];
  resources: ResourceSummaryViewModel;
  nextFixture: FixtureViewModel;
  alerts: readonly ClubAlertViewModel[];
  boardUltimatum?: {
    id: string;
    weeksRemaining: number;
    targetCash: number;
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
  headline: string;
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

export interface AttributeGainViewModel {
  id: string;
  label: string;
  before: number;
  after: number;
  delta: number;
}

export interface FocusedTraineeViewModel {
  id: string;
  name: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  lookId?: string;
  gains: readonly AttributeGainViewModel[];
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

export interface PlayerDevelopmentViewModel {
  focusedTrainees: readonly FocusedTraineeViewModel[];
  trainingSkippedWarning?: string;
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
  development: PlayerDevelopmentViewModel;
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
  highlights: readonly HighlightViewModel[];
  development: PlayerDevelopmentViewModel;
  updates: readonly WeekUpdateViewModel[];
  facilityCompletion?: FacilityCompletionViewModel;
}

export interface SquadPlayerViewModel {
  id: string;
  name: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  lookId?: string;
  overall: number;
  condition: number;
  injuryWeeks: number;
  isStarter: boolean;
  age: number;
  archetype: string;
  potentialGrade: PotentialGrade;
  potentialBonusPercent: number;
  positionTrainingLabel: string;
  personality: string;
  morale: number;
  fame: number;
  weeklyWage: number;
  contractLabel: string;
  contractPromiseLabel?: string;
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
  /** Position (1-based) in this week's training slots, when the player occupies one. */
  slotNumber?: number;
  /** True when a TRAINING_PRIORITY promise requires this player stay slotted (they cannot be dropped). */
  trainingLocked?: boolean;
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
  /** Best unlocked drill tier's title, e.g. "Duels III". */
  drillName: string;
  /** Best unlocked tier's gain for this stat. */
  gain: number;
  currentValue: number;
  atSafetyCeiling: boolean;
}

export interface SquadTrainingViewModel {
  resources: ResourceSummaryViewModel;
  players: readonly SquadPlayerViewModel[];
  slots: readonly {
    playerId: string;
    playerName: string;
    pathId: string;
    drillName: string;
    gainLabel: string;
  }[];
  maxSlots: number;
  /** Every stat path's best-tier option for the selected player, when one is selected. */
  selectedPlayerStatOptions?: readonly TrainingSlotStatOption[];
  weeklyTrainingPointCost: number;
  interrupts: {
    cappedSlots: readonly {
      playerId: string;
      playerName: string;
      pathId: string;
      attribute: string;
      cap: number;
    }[];
    tpShortfall: number;
  };
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

export interface ClubFinancesViewModel {
  periodLabel: string;
  resources: ResourceSummaryViewModel;
  ledger: readonly LedgerLineViewModel[];
  recentTransactions: readonly (LedgerLineViewModel & {
    periodLabel: string;
    balanceAfter: number;
  })[];
  weeklyNet: number;
  projectedBalance: number;
  wageSubsidyLabel?: string;
  trainingGround: TrainingGroundDecisionViewModel;
  legacyTrainingGroundVisible: boolean;
  coachingStaff: readonly CoachStaffMemberViewModel[];
  facilities: ClubFacilityGridViewModel;
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
  outcomeTitle?: string;
  outcomeText?: string;
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
  selectedTerm: 1 | 2 | 3;
  decision: 'pending' | 'renewed';
  requiresNegotiation: boolean;
  remainingExpiredCount: number;
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
  expiredContract?: ExpiredContractViewModel;
  renewalNegotiation?: MarketNegotiationViewModel;
  sliceComplete: boolean;
  canContinue: boolean;
}

export interface ClubLegacyChoiceViewModel {
  id: 'coach-candidate' | 'mentor-youth';
  label: string;
  detail: string;
  outcome: string;
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
  choices: readonly ClubLegacyChoiceViewModel[];
}

export interface ChampionshipCelebrationPlayerViewModel {
  id: string;
  name: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  isHero: boolean;
  /** The exact atlas character used for this player in the final match. */
  spriteKey: string;
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
}
