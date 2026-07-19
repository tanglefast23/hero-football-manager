import type { Attrs, PowerId, Role } from '../sim/types';

export const GAME_SCHEMA_VERSION = 1;
export const M1_SEASONS = 2;
export const SEASON_WEEKS = 30;

export type GamePhase = 'manage' | 'matchday' | 'season-end' | 'complete';

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
  clubs: ClubState[];
  startingTrainingPoints?: number;
  players?: CareerPlayer[];
  lineups?: ClubLineupState[];
  trainingRules?: TrainingRules;
}

export interface CareerTrainingDrill {
  id: string;
  moneyCost: number;
  tpCost: number;
  gains: Partial<Attrs>;
}

export interface CareerTrainingPlan {
  assignedPlayerIds: string[];
  drills: CareerTrainingDrill[];
}

export interface TrainingRules {
  baseConditioning: CareerTrainingDrill;
  maxFocusDrillsPerWeek: number;
}

export interface CareerPlayer {
  id: string;
  clubId: string;
  name: string;
  role: Role;
  attrs: Attrs;
  power?: PowerId;
  licensed: boolean;
  weeklyWage: number;
  onHeroWage: boolean;
  contractSeasonsRemaining: number;
  morale: number;
  injuryWeeks: number;
}

export interface ClubLineupState {
  clubId: string;
  playerIds: string[];
}

export interface FacilityState {
  trainingGroundBuilt: boolean;
}

export interface CareerEventState {
  weeksWithoutEvent: number;
  riskyChoices: number;
}

export interface PendingCareerEvent {
  eventId: string;
  selectedPlayerId?: string;
  resolvedChoiceId?: string;
  outcomeText?: string;
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
}

export type LedgerLineKind =
  | 'tickets'
  | 'sponsor'
  | 'prize'
  | 'training'
  | 'wages'
  | 'subsidy';

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

export interface GameState {
  schemaVersion: number;
  careerSeed: number;
  userClubId: string;
  season: number;
  week: number;
  phase: GamePhase;
  clubs: ClubState[];
  fixtures: LeagueFixture[];
  players: CareerPlayer[];
  lineups: ClubLineupState[];
  facilities: FacilityState;
  trainingRules?: TrainingRules;
  trainingPlan?: CareerTrainingPlan;
  eventClock: CareerEventState;
  eventFlags: string[];
  resolvedEventIds: string[];
  pendingEvent?: PendingCareerEvent;
  awakening: CareerAwakeningState;
  /** Optional only so pre-onboarding internal M1 saves remain loadable. */
  onboarding?: CareerOnboardingState;
  trainingPoints: number;
  heroEssence: number;
  ledgers: WeeklyLedger[];
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
