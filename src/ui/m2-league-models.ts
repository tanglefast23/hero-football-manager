import type { AwardCategoryId } from '../game/types';

export type M2DivisionLevelViewModel = 1 | 2 | 3 | 4 | 5;

export type M2LeagueSubTab = 'league' | 'cup' | 'leaders';

export interface M2DivisionSummaryViewModel {
  readonly level: M2DivisionLevelViewModel;
  readonly shortLabel: string;
  readonly label: string;
  readonly clubCount: number;
  readonly averageStrength: number;
  readonly strengthRangeLabel: string;
  readonly userSquadStrength: number;
  readonly comparisonLabel: string;
  readonly comparisonTone: 'below' | 'competitive' | 'above';
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

export interface M2LeagueFixtureViewModel {
  readonly id: string;
  readonly week: number;
  readonly weekLabel: string;
  readonly homeClubName: string;
  readonly awayClubName: string;
  readonly opponentName: string;
  readonly venue: 'HOME' | 'AWAY';
  readonly scoreLabel: string;
  readonly status: 'SCHEDULED' | 'PLAYED';
  readonly result?: 'WIN' | 'DRAW' | 'LOSS';
  readonly currentWeek: boolean;
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

export interface M2CupByeViewModel {
  readonly clubName: string;
  readonly involvesUserClub: boolean;
}

export interface M2CupRoundViewModel extends M2CupRoundHistoryViewModel {
  readonly drawn: boolean;
  readonly active: boolean;
  readonly fixtures: readonly M2CupFixtureViewModel[];
  readonly byes: readonly M2CupByeViewModel[];
}

export interface M2NationalCupViewModel {
  readonly available: boolean;
  readonly seasonOptions: readonly M2CupSeasonOptionViewModel[];
  readonly seasonLabel: string;
  readonly statusLabel: string;
  readonly currentRoundLabel: string;
  readonly currentRoundFixtures: readonly M2CupFixtureViewModel[];
  /** Every drawn round, in bracket order, for the portrait road-to-final. */
  readonly rounds: readonly M2CupRoundViewModel[];
  /** Retained for compact consumers; the League screen renders `rounds`. */
  readonly history: readonly M2CupRoundHistoryViewModel[];
  readonly championName?: string;
}

export interface M2LeaderEntryViewModel {
  readonly position: number;
  readonly playerId: string;
  readonly playerName: string;
  readonly clubName: string;
  readonly value: number;
  readonly isUserPlayer: boolean;
}

export interface M2LeaderBoardViewModel {
  readonly categoryId: AwardCategoryId;
  readonly boardLabel: string;
  readonly metricLabel: string;
  /** Shown in place of the rows, so an unscored category still reads as a board. */
  readonly emptyLabel: string;
  readonly entries: readonly M2LeaderEntryViewModel[];
}

export interface M2DivisionLeadersViewModel {
  readonly boards: readonly M2LeaderBoardViewModel[];
}

export interface M2LeagueViewModel {
  readonly title: string;
  readonly seasonLabel: string;
  readonly userDivisionBadge: string;
  readonly selectedDivision: M2DivisionLevelViewModel;
  readonly divisions: readonly M2DivisionSummaryViewModel[];
  readonly selectedDivisionSummary: M2DivisionSummaryViewModel;
  readonly activeTable: M2ActiveLeagueTableViewModel;
  readonly leagueFixtures: readonly M2LeagueFixtureViewModel[];
  readonly cup: M2NationalCupViewModel;
  /** Always contains 'league'; the rest appear as the career earns them. */
  readonly availableTabs: readonly M2LeagueSubTab[];
  readonly leaders: M2DivisionLeadersViewModel;
}
