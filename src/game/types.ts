import type { Attrs, PowerId, Role } from '../sim/types';
import type { FacilityGridState } from './facilities';
import type { CareerMarketState } from './market-career';
import type { DeskTipState } from './desk-tips';
import type { M2CareerState } from './m2-career';
import type { YouthIntakeState } from './youth-intake';

export const GAME_SCHEMA_VERSION = 2;
export const SEASON_WEEKS = 30;

export type GamePhase = 'manage' | 'matchday' | 'season-end' | 'complete';
export type DifficultyMode = 'COZY' | 'CHAIRMAN';

export interface CreatedPlayerAppearance {
  skinTone: 0 | 1 | 2 | 3 | 4 | 5;
  hairstyle: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  kitAccent: 0 | 1 | 2 | 3;
}

export interface ClubState {
  id: string;
  name: string;
  cash: number;
  fans: number;
  ticketPrice: number;
  sponsorMonthlyFee: number;
  weeklyWages: number;
}

export interface CareerSetup {
  seed: number;
  userClubId: string;
  /** Omitted by non-launch fixtures and saves created before roster expansion. */
  launchRosterVersion?: number;
  clubs: ClubState[];
  startingTrainingPoints?: number;
  players?: CareerPlayer[];
  lineups?: ClubLineupState[];
  trainingRules?: TrainingRules;
  /** Defaults to Cozy for old fixtures and saves. */
  difficulty?: DifficultyMode;
}

export interface CareerTrainingDrill {
  id: string;
  moneyCost: number;
  tpCost: number;
  gains: Partial<Attrs>;
}

export interface TrainingRules {
  /** Full focus-drill catalog, baked in so the pure engine can resolve tiers. */
  focusDrills: CareerTrainingDrill[];
}

export type PlayerArchetype =
  | 'Speedster'
  | 'Sniper'
  | 'Playmaker'
  | 'Anchor'
  | 'Wall'
  | 'Engine'
  | 'All-Rounder'
  | 'Prodigy';

export type PlayerPersonality =
  | 'Fiery'
  | 'Loyal'
  | 'Greedy'
  | 'Joker'
  | 'Professional'
  | 'Timid';

export type CareerContractPerk =
  | 'GUARANTEED_STARTER'
  | 'CAPTAINCY'
  | 'TRAINING_PRIORITY'
  | 'JERSEY_10';

export interface CareerContractPromise {
  perk: CareerContractPerk;
  agreedSeason: number;
}

export interface CareerPlayer {
  id: string;
  clubId: string;
  name: string;
  role: Role;
  /** Persisted presentation identity; optional for schema-1 save migration. */
  lookId?: string;
  /** Only the user-created player carries editable paper-doll choices. */
  createdAppearance?: CreatedPlayerAppearance;
  attrs: Attrs;
  power?: PowerId;
  powerTier?: 1 | 2 | 3;
  licensed: boolean;
  weeklyWage: number;
  onHeroWage: boolean;
  contractSeasonsRemaining: number;
  contractPromise?: CareerContractPromise;
  shirtNumber?: number;
  isCaptain?: boolean;
  morale: number;
  injuryWeeks: number;
  /** M2 metadata stays optional so schema-1 M1 saves remain readable. */
  age?: number;
  archetype?: PlayerArchetype;
  potential?: 1 | 2 | 3 | 4 | 5;
  /** Legacy schema-1 field. Read for save compatibility; no longer limits training. */
  potentialCeiling?: number;
  consistency?: number;
  personality?: PlayerPersonality;
  condition?: number;
  seasonsAtClub?: number;
  fame?: number;
  retirementAge?: number;
  retirementAnnounced?: boolean;
  retirementAnnouncementSeason?: number;
  consecutiveLowMoraleWeeks?: number;
  transferRequested?: boolean;
  /** Percentage-point carry for exact Motivator morale protection. */
  motivatorMoraleRemainder?: number;
  /** Half-percentage-point carry used once assistant Motivators are present. */
  motivatorMoraleRemainderHalfPoints?: number;
  /** Attribute total when the current contract began, used for earned wage growth. */
  signingStatTotal?: number;
  /** Percentage-point carry for exact integer Gym + Dorm stamina bonuses. */
  facilityStaBonusRemainder?: number;
  /** Hundredths of coach-earned growth banked until each attribute reaches a full point. */
  coachTrainingBonusRemainders?: Partial<Record<keyof Attrs, number>>;
  /** Hundredths from archetype, position, Potential, and coach growth bonuses. */
  trainingBonusRemainders?: Partial<Record<keyof Attrs, number>>;
  /** Drills since the last SUPER session; drives the pity-timer guarantee. */
  drillsSinceSuper?: number;
  /** Drills still owed under a TRAINING_PRIORITY promise; blocks other training while > 0. */
  priorityDrillsRemaining?: number;
}

export interface ClubLineupState {
  clubId: string;
  playerIds: string[];
}

export interface FacilityState {
  trainingGroundBuilt: boolean;
  /** Optional only while schema-1 M1 saves are reconciled into M2. */
  grid?: FacilityGridState;
}

export interface CareerEventState {
  weeksWithoutEvent: number;
  riskyChoices: number;
  /**
   * The week whose story offer has already been settled, so reconciling the
   * same desk twice cannot re-roll it. Absent on saves written before stories
   * moved from the Advance Week interrupt to the inbox.
   */
  storySettledSeason?: number;
  storySettledWeek?: number;
}

export interface ResolvedCareerEvent {
  eventId: string;
  season: number;
  week: number;
}

export interface PendingCareerEvent {
  eventId: string;
  selectedPlayerId?: string;
  resolvedChoiceId?: string;
  outcomeText?: string;
  /** Stable content outcome identity for save/reload-safe success presentation. */
  resolvedOutcomeIndex?: number;
  resolvedRisky?: boolean;
  resolvedSuccess?: boolean;
  /** Optional content-authored follow-up offered before the management week advances. */
  resolvedNextEventId?: string;
}

export interface PendingCareerAwakening {
  fixtureId: string;
  playerId: string;
  power: PowerId;
  triggerId: string;
  firstHero: boolean;
}

export interface CareerAwakeningState {
  matchesSinceLastAwakening: number;
  usedTriggerIds: string[];
  pending?: PendingCareerAwakening;
}

export type OnboardingStage =
  | 'create-player'
  | 'first-match'
  | 'collapse'
  | 'reveal'
  | 'complete';

export interface CareerOnboardingState {
  stage: OnboardingStage;
  createdPlayerId?: string;
  firstFixtureId?: string;
  /** Retained only so saves made before automatic awakenings remain readable. */
  selectedOrigin?: 'CHEMICAL' | 'CREATURE' | 'SERUM';
  awakenedPower?: PowerId;
}

export interface FixtureScore {
  homeGoals: number;
  awayGoals: number;
}

export type FixtureStatus = 'scheduled' | 'played';

export interface LeagueFixture {
  id: string;
  season: number;
  round: number;
  week: number;
  homeClubId: string;
  awayClubId: string;
  matchSeed: number;
  status: FixtureStatus;
  score?: FixtureScore;
}

export interface FixtureResult extends FixtureScore {
  fixtureId: string;
  /** Ordered scorer IDs when the full simulation result is available. */
  scorerPlayerIds?: string[];
  /**
   * Per-player countable actions. Present alongside `scorerPlayerIds` rather
   * than replacing it: career validation checks the scorer list against the
   * scoreline, and that invariant is worth more than the small redundancy.
   */
  contributions?: PlayerMatchContribution[];
}

export type LedgerLineKind =
  | 'tickets'
  | 'sponsor'
  | 'prize'
  | 'merch'
  | 'training'
  | 'facilities'
  | 'wages'
  | 'subsidy'
  | 'emergency-loan'
  | 'board-sale'
  | 'loan-repayment'
  | 'board-rescue';

export interface LedgerLine {
  kind: LedgerLineKind;
  label: string;
  amount: number;
}

export interface WeeklyLedger {
  season: number;
  week: number;
  lines: LedgerLine[];
  balanceAfter: number;
}

export type CashTransactionKind =
  | 'facility-build'
  | 'facility-upgrade'
  | 'facility-relocation'
  | 'training-upgrade'
  | 'scouting'
  | 'transfer-buy'
  | 'transfer-sell'
  | 'youth-signing'
  | 'coach-hiring'
  | 'coach-dismissal';

/**
 * Immediate M2 cash movements live beside weekly ledgers so buying something
 * never fabricates or changes a settled week. This is deliberately plain JSON.
 */
export interface CashTransaction {
  id: string;
  season: number;
  week: number;
  kind: CashTransactionKind;
  label: string;
  amount: number;
  balanceAfter: number;
  referenceId?: string;
}

/** One player's countable actions in a single finished match. */
export interface PlayerMatchContribution {
  playerId: string;
  goals: number;
  assists: number;
  tacklesWon: number;
  saves: number;
}

export type AwardCompetition = 'league' | 'cup';

/**
 * One player's season in one competition, for one club.
 *
 * `clubId` is stamped when the row is written rather than resolved at read
 * time: players transfer mid-season, so a row resolved later would attribute a
 * sold player's first-half goals to whoever bought him.
 */
export interface PlayerSeasonStatLine {
  season: number;
  playerId: string;
  clubId: string;
  competition: AwardCompetition;
  goals: number;
  assists: number;
  tacklesWon: number;
  saves: number;
}

export type AwardCategoryId = 'goals' | 'assists' | 'tacklesWon' | 'saves';

/** One placing, denormalised so it survives the rival roster being regenerated. */
export interface DivisionAwardPlacement {
  playerId: string;
  playerName: string;
  clubId: string;
  value: number;
}

export interface FinancialSafetyState {
  consecutiveNegativeWeeks: number;
  emergencyLoanUsed: boolean;
  loan?: {
    originalAmount: number;
    remainingBalance: number;
    repaymentStartsSeason: number;
    remainingWeeks: number;
  };
  /** Active four-week fail-soft intervention. Optional for all pre-M2 saves. */
  boardUltimatum?: BoardUltimatumState;
  /** Most recent outcome, retained so the office can explain what happened. */
  latestBoardResolution?: BoardUltimatumResolution;
}

export interface CupGiantKillingCelebration {
  fixtureId: string;
  divisionGap: number;
  title: string;
  body: string;
}

export interface BoardSaleCandidate {
  playerId: string;
  marketValue: number;
  forcedSaleFee: number;
  discountPercent: 30;
}

export interface BoardUltimatumState {
  id: string;
  issuedSeason: number;
  issuedWeek: number;
  weeksRemaining: number;
  targetCash: number;
  candidates: BoardSaleCandidate[];
  protectedPlayerId?: string;
}

export type BoardUltimatumResolution =
  | {
      id: string;
      kind: 'TARGET_MET';
      resolvedSeason: number;
      resolvedWeek: number;
      targetCash: number;
    }
  | {
      id: string;
      kind: 'FORCED_SALE';
      resolvedSeason: number;
      resolvedWeek: number;
      targetCash: number;
      playerId: string;
      buyerClubId: string;
      replacementPlayerId: string;
      fee: number;
      discountPercent: 30;
      moraleDelta: -8;
      fansLost: number;
    };

export interface CareerRetirementAnnouncement {
  playerId: string;
  playerName: string;
  announcedInSeason: number;
  retirementAge: number;
}

export interface SeasonRecapAward {
  playerId: string;
  playerName: string;
  label: string;
  detail: string;
}

export interface SeasonRecap {
  season: number;
  division: number;
  finalPosition: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  cashChange: number;
  closingCash: number;
  trainingCapsReached: number;
  cupResult: string;
  memorableEventId?: string;
  topScorer?: SeasonRecapAward;
  playerOfSeason?: SeasonRecapAward;
  youngPlayer?: SeasonRecapAward;
  heroOfSeason?: SeasonRecapAward;
}

export interface GameState {
  schemaVersion: number;
  /** Marks launch-content roster migrations that have already been applied. */
  launchRosterVersion?: number;
  careerSeed: number;
  userClubId: string;
  season: number;
  week: number;
  phase: GamePhase;
  /** Old saves omit this and are treated as Cozy. */
  difficulty?: DifficultyMode;
  clubs: ClubState[];
  fixtures: LeagueFixture[];
  players: CareerPlayer[];
  lineups: ClubLineupState[];
  facilities: FacilityState;
  trainingRules?: TrainingRules;
  eventClock: CareerEventState;
  eventFlags: string[];
  resolvedEventIds: string[];
  /** Season-stamped history used by recaps; absent on pre-M4 saves. */
  resolvedEventHistory?: ResolvedCareerEvent[];
  pendingEvent?: PendingCareerEvent;
  /** This week's manager's-tip decision. Absent on saves written before tips. */
  deskTip?: DeskTipState;
  awakening: CareerAwakeningState;
  /** Optional only so pre-onboarding internal M1 saves remain loadable. */
  onboarding?: CareerOnboardingState;
  trainingPoints: number;
  /**
   * Drill tier the club has bought for each training path, keyed by path id.
   * Absent paths — and every path in a save written before drill upgrades were
   * a purchase — are owned at tier 1.
   */
  ownedTrainingTiers?: Record<string, number>;
  /** Lifetime instant-drill count; the RNG nonce that keeps back-to-back taps distinct. */
  totalInstantDrills?: number;
  ledgers: WeeklyLedger[];
  /** User-club cash when the active season began, for an exact season recap delta. */
  seasonOpeningCash?: number;
  /** Immediate M2 purchases and sales; weekly settlement remains in ledgers. */
  cashTransactions?: CashTransaction[];
  /**
   * Absent on saves written before division-leader tracking. Those saves keep
   * loading, but their goal history does not survive: `seasonGoalTallies` is
   * not migrated, and the root schema passes it through as an untyped key
   * nothing reads any more — so the Golden Boot, the hero's first goal and the
   * championship scorer list all start from zero for an in-flight career.
   * Accepted under the standing decision that breaking saves is fine until
   * TestFlight.
   */
  seasonStatLines?: PlayerSeasonStatLine[];
  /**
   * Every career is a full career. The field stays because saves in the field
   * carry it and the persisted schema keys two validation rules off it; the
   * codec normalises the retired `'m1-slice'` value on read.
   */
  careerMode: 'full';
  /** M2 sidecars are plain data and defaulted during application reconciliation. */
  m2?: M2CareerState;
  market?: CareerMarketState;
  youthIntake?: YouthIntakeState;
  retiredPlayers?: CareerPlayer[];
  pendingLegacyPlayerIds?: string[];
  /** Current final-season notices presented after a season transition. */
  retirementAnnouncements?: CareerRetirementAnnouncement[];
  /** Immutable snapshots used by the season-review presentation. */
  seasonRecaps?: SeasonRecap[];
  financialSafety?: FinancialSafetyState;
  /** Persisted FIFO until Bert has delivered every post-Cup giant-killing walk-on. */
  pendingCupGiantKillingCelebrations?: CupGiantKillingCelebration[];
}

export interface LeagueStanding {
  position: number;
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}
