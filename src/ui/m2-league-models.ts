export type M2DivisionLevelViewModel = 1 | 2 | 3 | 4 | 5;

export interface M2DivisionSummaryViewModel {
  readonly level: M2DivisionLevelViewModel;
  readonly shortLabel: string;
  readonly label: string;
  readonly clubCount: number;
  readonly averageStrength: number;
  readonly strengthRangeLabel: string;
  readonly selected: boolean;
  readonly userDivision: boolean;
}

export interface M2LeagueTableRowViewModel {
  readonly position: number;
  readonly clubId: string;
  readonly clubName: string;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalDifference: number;
  readonly points: number;
  readonly isUserClub: boolean;
  readonly movement: 'PROMOTION' | 'RELEGATION' | 'NONE';
}

export interface M2ActiveLeagueTableViewModel {
  readonly divisionLabel: string;
  readonly rulesLabel: string;
  readonly matchesPlayed: number;
  readonly rows: readonly M2LeagueTableRowViewModel[];
}

export interface M2CupSeasonOptionViewModel {
  readonly season: number;
  readonly label: string;
  readonly selected: boolean;
  readonly complete: boolean;
  readonly championName?: string;
}

export interface M2CupFixtureViewModel {
  readonly id: string;
  readonly roundLabel: string;
  readonly homeClubName: string;
  readonly awayClubName: string;
  readonly scoreLabel: string;
  readonly status: 'SCHEDULED' | 'PLAYED';
  readonly winnerName?: string;
  readonly involvesUserClub: boolean;
  readonly userWon: boolean;
  readonly playableNow: boolean;
}

export interface M2CupRoundHistoryViewModel {
  readonly round: number;
  readonly label: string;
  readonly matchCount: number;
  readonly completedCount: number;
  readonly statusLabel: string;
  readonly userOutcome?: string;
}

export interface M2NationalCupViewModel {
  readonly available: boolean;
  readonly seasonOptions: readonly M2CupSeasonOptionViewModel[];
  readonly seasonLabel: string;
  readonly statusLabel: string;
  readonly currentRoundLabel: string;
  readonly currentRoundFixtures: readonly M2CupFixtureViewModel[];
  readonly history: readonly M2CupRoundHistoryViewModel[];
  readonly championName?: string;
}

export interface M2LeagueViewModel {
  readonly title: string;
  readonly seasonLabel: string;
  readonly userDivisionBadge: string;
  readonly selectedDivision: M2DivisionLevelViewModel;
  readonly divisions: readonly M2DivisionSummaryViewModel[];
  readonly selectedDivisionSummary: M2DivisionSummaryViewModel;
  readonly activeTable: M2ActiveLeagueTableViewModel;
  readonly cup: M2NationalCupViewModel;
}
