import type {
  ContractPerk,
  NegotiationMood,
  NegotiationStatus,
  PitchCard,
  PlayerPersonality,
} from '../game/market';

export type MarketSectionId = 'YOUTH' | 'SCOUT' | 'TRANSFERS' | 'COACHES';

export interface MarketWindowViewModel {
  readonly open: boolean;
  readonly label: string;
  readonly detail: string;
}

export interface ScoutMissionChoiceViewModel {
  readonly id: string;
  readonly regionLabel: string;
  readonly focusLabel: string;
  readonly detail: string;
  readonly cost: number;
  readonly durationLabel: string;
  readonly available: boolean;
  readonly blockedReason?: string;
}

export interface ScoutMissionStatusViewModel {
  readonly kind: 'IDLE' | 'IN_PROGRESS' | 'READY' | 'COMPLETED';
  readonly headline: string;
  readonly detail: string;
  readonly progressLabel?: string;
}

export interface ScoutedStatViewModel {
  readonly label: string;
  readonly rangeLabel: string;
}

export interface ScoutReportViewModel {
  readonly playerId: string;
  readonly playerName: string;
  readonly role: 'GK' | 'DEF' | 'MID' | 'FWD';
  readonly lookId?: string;
  readonly ageLabel: string;
  readonly potentialLabel: string;
  readonly powerLabel?: string;
  readonly rumorLabel?: string;
  readonly stats: readonly ScoutedStatViewModel[];
}

export interface ScoutingDeskViewModel {
  readonly officeLabel: string;
  readonly precisionLabel: string;
  readonly status: ScoutMissionStatusViewModel;
  readonly choices: readonly ScoutMissionChoiceViewModel[];
  readonly reports: readonly ScoutReportViewModel[];
}

export interface TransferListingViewModel {
  readonly playerId: string;
  readonly playerName: string;
  readonly role: 'GK' | 'DEF' | 'MID' | 'FWD';
  readonly lookId?: string;
  readonly age: number;
  readonly potentialLabel: string;
  readonly direction: 'BUY' | 'SELL';
  readonly powerLabel?: string;
  readonly valuation: number;
  readonly quote: number;
  readonly quoteLabel: string;
  readonly actionLabel: string;
  readonly listed: boolean;
  readonly bids: readonly {
    readonly id: string;
    readonly buyerName: string;
    readonly fee: number;
  }[];
  readonly available: boolean;
  readonly blockedReason?: string;
}

export interface CoachCandidateViewModel {
  readonly id: string;
  readonly portraitId: string;
  readonly name: string;
  readonly age: number;
  readonly level: number;
  readonly levelLabel: string;
  readonly specialtyLabels: readonly [string, string];
  readonly headEffectLabels: readonly string[];
  readonly assistantEffectLabels: readonly string[];
  readonly personalityLabel: string;
  /** Retained as the canonical candidate/head quote for older consumers. */
  readonly weeklyWage: number;
  readonly headWeeklyWage: number;
  readonly assistantWeeklyWage: number;
  readonly retiredLegend: boolean;
  readonly loyaltyLabel?: string;
  readonly unlockLabel?: string;
  readonly available: boolean;
  readonly headAvailable: boolean;
  readonly assistantAvailable: boolean;
  readonly assistantSlotUnlocked: boolean;
  readonly currentRole?: 'Head coach' | 'Assistant';
  readonly blockedReason?: string;
}

export interface YouthOfferViewModel {
  readonly playerId: string;
  readonly playerName: string;
  readonly role: 'GK' | 'DEF' | 'MID' | 'FWD';
  readonly lookId?: string;
  readonly ageLabel: string;
  readonly archetypeLabel: string;
  readonly potentialLabel: string;
  /**
   * The prospect's real stats, six across (keepers show REF in place of SHO).
   * Academy kids are the club's own, so the card states them outright instead of
   * the scout's estimated ranges.
   */
  readonly stats: readonly {
    readonly label: 'PAC' | 'SHO' | 'PAS' | 'DEF' | 'TEC' | 'STA' | 'REF';
    readonly value: number;
  }[];
  readonly signingBonus: number;
  readonly weeklyWage: number;
  readonly available: boolean;
  readonly blockedReason?: string;
}

export interface YouthIntakeViewModel {
  readonly status: 'OPEN' | 'CLOSED';
  readonly headline: string;
  readonly detail: string;
  readonly rosterLabel: string;
  readonly offers: readonly YouthOfferViewModel[];
  readonly canDecline: boolean;
}

export interface PitchCardViewModel {
  readonly id: PitchCard;
  readonly label: string;
  readonly detail: string;
  readonly used: boolean;
}

export interface ContractPerkViewModel {
  readonly id: ContractPerk;
  readonly label: string;
  readonly detail: string;
}

export interface MarketNegotiationViewModel {
  readonly id: string;
  readonly playerId: string;
  readonly playerName: string;
  readonly playerRole: 'GK' | 'DEF' | 'MID' | 'FWD';
  readonly lookId?: string;
  readonly personality: PlayerPersonality;
  readonly personalityLabel: string;
  readonly status: NegotiationStatus;
  readonly mood: NegotiationMood;
  readonly moodFace: string;
  readonly moodLabel: string;
  readonly roundLabel: string;
  readonly pitchLeverageLabel: string;
  readonly cards: readonly PitchCardViewModel[];
  readonly perks: readonly ContractPerkViewModel[];
  /** Terms this player will actually sign; shorter than 1-2-3 for a veteran. */
  readonly termOptions: readonly (1 | 2 | 3)[];
  /** Present only when age has cut the term below three seasons. */
  readonly shortTermReason?: string;
  readonly initialWeeklyWage: number;
  readonly wageStep: number;
  readonly lastOutcomeLabel?: string;
}

export interface MarketViewModel {
  readonly sections: readonly MarketSectionId[];
  readonly periodLabel: string;
  readonly divisionLabel: string;
  readonly cash: number;
  readonly window: MarketWindowViewModel;
  readonly scouting: ScoutingDeskViewModel;
  readonly transfers: readonly TransferListingViewModel[];
  readonly coaches: readonly CoachCandidateViewModel[];
  readonly youth?: YouthIntakeViewModel;
  readonly negotiation?: MarketNegotiationViewModel;
}
