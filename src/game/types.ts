import type { Attrs, PowerId, Role } from '../sim/types';
import type { FacilityGridState } from './facilities';
import type { CareerMarketState } from './market-career';
import type { DeskTipState } from './desk-tips';
import type { M2CareerState } from './m2-career';
import type { YouthIntakeState } from './youth-intake';
import type { ClubBusinessState, SponsorRules } from './club-business-types';

export const GAME_SCHEMA_VERSION = 4;
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
  /**
   * The player-request catalog, baked in like `trainingRules` so the pure
   * engine can roll requests without importing content. Omitted by the balance
   * harness and by fixtures that do not exercise requests, which is what turns
   * the feature off for them.
   */
  playerRequestRules?: PlayerRequestCatalog;
  /** Validated sponsor content baked in by the application ring. */
  sponsorRules?: SponsorRules;
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
  /**
   * How much they want to stay, 0 to 100. Absent means "never moved from the
   * derived starting value"; read it through `playerLoyalty` in
   * `src/game/loyalty.ts` rather than touching this field directly.
   */
  loyalty?: number;
  /**
   * Weeks unavailable because a granted request took them away.
   *
   * Deliberately not `injuryWeeks`. Sharing that field would let the Medical
   * Bay shorten a beach holiday and would make the roster announce that a
   * striker is "recovering" from the Bahamas.
   */
  awayWeeks?: number;
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
  /**
   * How far this keeper's *displayed* Reflexes is allowed to run ahead of the
   * stored value, so a halved Keeper Drills ladder reads like the outfield one.
   *
   * Presentation only. Nothing in `src/sim/`, `lineup.ts`, `squad.ts` or
   * `market.ts` reads it — a reviewer can confirm that with one grep rather than
   * by reasoning about call graphs, which is the property that makes the trick
   * safe to ship and cheap to delete. The scout, the wage, the transfer fee and
   * the match engine all see `attrs.ref`.
   */
  refDisplayBonus?: number;
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
  | 'buzz'
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
  /** Stable identity for cash awards that must survive retries and reloads. */
  idempotencyKey?: string;
}

export interface IdempotentLedgerLine extends LedgerLine {
  idempotencyKey: string;
}

export interface WeeklySettlementAward {
  line: IdempotentLedgerLine;
  /** Supporters applied only after this week's gate and merchandise are fixed. */
  fanGain?: number;
}

export interface WeeklySettlementAwards {
  awards: WeeklySettlementAward[];
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
  | 'facility-closure'
  | 'training-upgrade'
  | 'scouting'
  | 'transfer-buy'
  | 'transfer-sell'
  | 'youth-signing'
  | 'coach-hiring'
  | 'coach-dismissal'
  | 'player-request';

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
  passesCompleted: number;
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
  passesCompleted: number;
}

/**
 * Midfielders are ranked on passes rather than assists deliberately.
 *
 * Measured on this engine, ~93% of assists are credited to forwards: attackers
 * receive the ball and carry it, so the last teammate to touch it before a goal
 * is usually another attacker. A midfielders' assist board reads 3, 2, 1 beside
 * a 23-goal Golden Boot. Passes completed is 36% midfield at D5 and 48% at D1,
 * and it has names on it from week one. Assists are still recorded — they are
 * real match data — they are simply not what this board ranks.
 */
export type AwardCategoryId = 'goals' | 'passesCompleted' | 'tacklesWon' | 'saves';

/** One placing, denormalised so it survives the rival roster being regenerated. */
export interface DivisionAwardPlacement {
  playerId: string;
  playerName: string;
  clubId: string;
  value: number;
}

/** What the four division boards paid, in Training Points. */
export interface DivisionAwardPrize {
  trainingPoints: number;
  categoriesWon: AwardCategoryId[];
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
  /**
   * Top three per category, denormalised at the season transition.
   *
   * The bridge to the awards ceremony. Raw stat rows for rivals are pruned once
   * a division change regenerates their clubs, so anything the ceremony needs
   * must be captured here while the players still exist.
   */
  divisionAwards?: Record<AwardCategoryId, DivisionAwardPlacement[]>;
  /**
   * What those podiums paid, stamped by the season transition that granted it.
   *
   * Absent means the transition has not run yet, not that nothing was won. The
   * ceremony is presented BEFORE the transition, so it shows a projection it
   * recomputes from `divisionAwards`; this field is the record of the grant,
   * written afterwards, and it exists so the two can be compared instead of
   * silently disagreeing. A season that won nothing is stamped with a zero.
   */
  divisionAwardPrize?: DivisionAwardPrize;
}

/** One division title, stamped with the season it was taken. */
export interface HallOfFameTitle {
  season: number;
  division: number;
}

/** One tier the club played in, and what it did there. */
export interface HallOfFameTier {
  division: number;
  /** First season the club played at this tier. */
  firstSeason: number;
  seasons: number;
  /** Best league finish at this tier; 1 is a title. */
  bestPosition: number;
}

/**
 * The club's leading scorer, counted the only way a finished career still can.
 *
 * `goals` is the total from the seasons he was the club's own top scorer, which
 * is a floor rather than a career total: goals are recorded per season in
 * `seasonStatLines`, and those rows are pruned at every season transition. The
 * per-season Golden Boot in `SeasonRecap` is what survives, so it is what this
 * counts — and it counts both competitions and every position, which the
 * division goal board (strikers, league only) does not.
 */
export interface HallOfFameScorer {
  playerId: string;
  playerName: string;
  goals: number;
  /** Seasons he finished as the club's leading scorer. */
  goldenBoots: number;
}

/** The most famous man in the squad when the climb ended. */
export interface HallOfFameStar {
  playerId: string;
  playerName: string;
  fame: number;
  seasonsAtClub: number;
}

/**
 * The career's record, denormalised the moment the climb is completed.
 *
 * A snapshot, never a live query, for the reason `SeasonRecap.divisionAwards`
 * is one: promotion regenerates every rival roster and the season transition
 * prunes old stat rows, so a career reopened ten seasons later cannot rebuild
 * who scored what. Names and numbers are copied in while they are still true.
 */
export interface HallOfFameRecord {
  /**
   * The season the second trophy landed. Every career opens in season 1, so
   * this is also the number of seasons the climb took.
   */
  season: number;
  clubName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Every division title, oldest first. */
  divisionTitles: HallOfFameTitle[];
  /** Every season the Hero Cup was lifted, oldest first. */
  cupWinSeasons: number[];
  /** One row per tier played, in the order the club reached them. */
  tiers: HallOfFameTier[];
  /** Absent when nobody ever scored for the club. */
  topScorer?: HallOfFameScorer;
  /** Absent only for a club with no squad left. */
  star?: HallOfFameStar;
}

/**
 * The request catalog, as the ENGINE requires it.
 *
 * Defined here rather than imported from `src/content/` because `src/game/` may
 * depend only on itself and inward on `src/sim/` — a rule the architecture test
 * enforces, and one that a type-only import would still break, since it leaves
 * the ring unable to compile on its own.
 *
 * So the direction is inverted: the engine states the shape it needs, and the
 * content catalog has to satisfy it. `src/content/__tests__/player-requests.test.ts`
 * asserts that the zod-validated catalog is assignable to these types, which
 * fails at compile time if either side drifts.
 */
export type PlayerRequestCost =
  | { readonly kind: 'MONEY_PLAYER'; readonly wageMultiple: number }
  | { readonly kind: 'MONEY_SQUAD'; readonly billMultiplePercent: number }
  | { readonly kind: 'ABSENCE'; readonly weeks: number }
  | { readonly kind: 'CONDITION_SQUAD'; readonly amount: number }
  | { readonly kind: 'DRILL_PLAYER'; readonly multiplierPercent: number; readonly weeks: number }
  | { readonly kind: 'DRILL_SQUAD'; readonly multiplierPercent: number; readonly weeks: number };

export type PlayerRequestGrantBonus =
  | { readonly kind: 'CONDITION_SQUAD'; readonly amount: number }
  | { readonly kind: 'MORALE_SQUAD'; readonly amount: number };

export interface PlayerRequestDefinition {
  readonly id: string;
  readonly title: string;
  readonly line: string;
  readonly art: readonly [string, string];
  readonly cost: PlayerRequestCost;
  readonly grantBonus?: PlayerRequestGrantBonus;
}

export interface PlayerRequestCadence {
  readonly minWeeks: number;
  readonly guaranteeWeeks: number;
  readonly starMinWeeks: number;
  readonly starGuaranteeWeeks: number;
}

export interface PlayerRequestTuning {
  readonly startSeason: number;
  readonly startWeek: number;
  readonly baseChancePercent: number;
  readonly starFameThreshold: number;
  readonly starGoalRank: number;
  readonly minSeasonsAtClub: number;
  readonly answerWeeks: number;
  readonly cadence: Readonly<Record<DifficultyMode, PlayerRequestCadence>>;
}

export interface PlayerRequestCatalog {
  readonly tuning: PlayerRequestTuning;
  readonly requests: readonly PlayerRequestDefinition[];
}

export type PlayerRequestResolution = 'GRANTED' | 'REFUSED' | 'LAPSED';

export interface PendingPlayerRequest {
  requestId: string;
  playerId: string;
  askedSeason: number;
  askedWeek: number;
  /**
   * Money cost snapshotted when the request opened. Without it a renewal or a
   * wage rise between the ask and the answer would silently change the number
   * already printed on the card.
   */
  costAmount?: number;
  /** True once the second-week inbox warning has been queued. */
  warned: boolean;
}

/**
 * Only the drill effects exist. The status requests that would have needed a
 * perk — armband, shirt 10, guaranteed start, training priority — were cut
 * from v1 because `contractPromise` holds a single object per player, so
 * writing one from a request would destroy whatever was agreed at the
 * negotiating table.
 */
export type RequestEffectKind = 'DRILL_PLAYER' | 'DRILL_SQUAD';

export interface ActiveRequestEffect {
  kind: RequestEffectKind;
  /** Absent for squad-wide effects. */
  playerId?: string;
  weeksRemaining: number;
  /** Drill gain scale, e.g. 50 for half gains. */
  multiplierPercent?: number;
}

export interface ResolvedPlayerRequest {
  requestId: string;
  playerId: string;
  season: number;
  week: number;
  resolution: PlayerRequestResolution;
  costAmount?: number;
}

export interface PlayerRequestState {
  weeksSinceRequest: number;
  pending?: PendingPlayerRequest;
  effects: ActiveRequestEffect[];
  /** Newest first, capped at MAX_PLAYER_REQUEST_HISTORY. */
  history: ResolvedPlayerRequest[];
  lastAskingPlayerId?: string;
}

/** Whether Bert teaches this career or limits himself to real club business. */
export type AssistantMode = 'teacher' | 'advisor';

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
  /** Old saves omit this and are taught, exactly as they were. */
  assistantMode?: AssistantMode;
  clubs: ClubState[];
  fixtures: LeagueFixture[];
  players: CareerPlayer[];
  lineups: ClubLineupState[];
  facilities: FacilityState;
  trainingRules?: TrainingRules;
  /** Baked request catalog; absent means requests never open for this career. */
  playerRequestRules?: PlayerRequestCatalog;
  /** Baked sponsor catalog; restored by launch reconciliation when absent. */
  sponsorRules?: SponsorRules;
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
  /**
   * Written once, when both trophies are in. Absent means the climb is not
   * finished — or was finished before the record existed, which no career can
   * be given retroactively.
   */
  hallOfFame?: HallOfFameRecord;
  financialSafety?: FinancialSafetyState;
  /** Absent on saves written before player requests; defaulted on reconciliation. */
  playerRequests?: PlayerRequestState;
  /** Persisted FIFO until Bert has delivered every post-Cup giant-killing walk-on. */
  pendingCupGiantKillingCelebrations?: CupGiantKillingCelebration[];
  /** Schema-4 audience and managed-sponsorship state. */
  clubBusiness: ClubBusinessState;
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
