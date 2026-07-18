export type ManagementTab = 'home' | 'squad' | 'club' | 'market' | 'league';

export interface ResourceSummaryViewModel {
  money: number;
  trainingPoints: number;
  heroEssence: number;
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
}

export interface HomeViewModel {
  clubName: string;
  managerName: string;
  seasonLabel: string;
  weekLabel: string;
  form: readonly ('W' | 'D' | 'L')[];
  resources: ResourceSummaryViewModel;
  nextFixture: FixtureViewModel;
  alerts: readonly ClubAlertViewModel[];
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
  shirtNumber: number;
  isHero: boolean;
}

export interface HeroLicenseViewModel {
  playerId: string;
  playerName: string;
  powerName: string;
  licensed: boolean;
}

export interface MatchDayViewModel {
  fixture: FixtureViewModel;
  selectedTacticId: string;
  tactics: readonly TacticViewModel[];
  lineup: readonly LineupPlayerViewModel[];
  heroLimit: number;
  heroes: readonly HeroLicenseViewModel[];
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

export interface PostMatchViewModel {
  result: MatchResultViewModel;
  ledger: readonly LedgerLineViewModel[];
  netAmount: number;
  trainingPointsGained: number;
  fanDelta: number;
  heroEssenceGained: number;
  highlights: readonly HighlightViewModel[];
}

export interface SquadPlayerViewModel {
  id: string;
  name: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  overall: number;
  condition: number;
  weeklyWage: number;
  contractLabel: string;
  powerName?: string;
  licensed: boolean;
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
}

export interface SquadTrainingViewModel {
  resources: ResourceSummaryViewModel;
  players: readonly SquadPlayerViewModel[];
  selectedPlayerId?: string;
  drills: readonly FocusDrillViewModel[];
  assignedPlayerIds: readonly string[];
  selectedDrillCount: number;
  maxDrills: number;
  totalMoneyCost: number;
  totalTrainingPointCost: number;
  canApply: boolean;
}

export interface TrainingGroundDecisionViewModel {
  built: boolean;
  affordable: boolean;
  cost: number;
  weeklyTrainingPoints: number;
}

export interface ClubFinancesViewModel {
  periodLabel: string;
  resources: ResourceSummaryViewModel;
  ledger: readonly LedgerLineViewModel[];
  weeklyNet: number;
  projectedBalance: number;
  wageSubsidyLabel?: string;
  trainingGround: TrainingGroundDecisionViewModel;
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
}

export interface StoryEventViewModel {
  id: string;
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
  powerName?: string;
  currentWeeklyWage: number;
  quotedWeeklyWage: number;
  isHeroWageCliff: boolean;
  termOptions: readonly (1 | 2 | 3)[];
  selectedTerm: 1 | 2 | 3;
  decision: 'pending' | 'renewed';
  canAfford: boolean;
}

export interface SeasonEndViewModel {
  seasonLabel: string;
  outcomeLabel: 'CHAMPIONS' | 'PROMOTED' | 'SAFE' | 'RELEGATED';
  headline: string;
  summary: string;
  finalPosition: number;
  prizeMoney: number;
  table: readonly SeasonTableRowViewModel[];
  expiredContract?: ExpiredContractViewModel;
  sliceComplete: boolean;
  canContinue: boolean;
}
