import type {
  ContractPerk,
  NegotiationMood,
  NegotiationStatus,
  PitchCard,
  PlayerPersonality,
  ScoutRegion,
} from '../game/market';

export type MarketSectionId = 'YOUTH' | 'SCOUT' | 'TRANSFERS' | 'COACHES';

export interface MarketWindowViewModel {
  readonly open: boolean;
  readonly label: string;
  readonly detail: string;
  /** Zero while open; otherwise the weekly advances to Week 17 or next Season's Week 1. */
  readonly weeksUntilOpen: number;
}

export interface ScoutMissionChoiceViewModel {
  readonly id: string;
  /**
   * The region CODE. `regionLabel` is drawn and will be translated, so anything
   * that has to RECOGNISE a region matches on this instead.
   */
  readonly region: ScoutRegion;
  readonly regionLabel: string;
  readonly focusLabel: string;
  readonly detail: string;
  readonly cost: number;
  /** This otherwise unaffordable first trip is covered by the scout. */
  readonly feeWaived?: boolean;
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
  /**
   * A role code, not a label. It was the literal union `'Head coach' |
   * 'Assistant'`, which a translated string cannot satisfy; the screen maps it
   * to copy at render.
   */
  readonly currentRole?: 'HEAD' | 'ASSISTANT';
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
  /**
   * How this personality receives the card: 'LOVED' cuts the ask, 'HATED' raises
   * it, 'NEUTRAL' does neither. The mapping has always existed in the engine and
   * was never shown, so a hated card cost 10% AND one of only three rounds with
   * nothing on screen to warn you.
   */
  readonly affinity?: 'LOVED' | 'HATED' | 'NEUTRAL';
  readonly id: PitchCard;
  readonly label: string;
  readonly detail: string;
  readonly used: boolean;
}

export interface ContractPerkViewModel {
  readonly id: ContractPerk;
  readonly label: string;
  /** What the promise costs the club, in plain mechanics. Never flavour. */
  readonly detail: string;
  /**
   * How hard the promise pushes the agent, as "A · Huge" through "D · Small".
   *
   * Rates bargaining pull only — never desirability to the manager. The two run
   * opposite here: the promise that sways the agent most is also the one that
   * costs the squad most, which is why the panel captions this column "Value to
   * agent" and gives `detail` equal weight beside it.
   */
  readonly gradeLabel: string;
  /** False when the career cannot honour this promise right now. */
  readonly available: boolean;
  /** Player-facing, localized explanation shown on a disabled row. */
  readonly blockedReason?: string;
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
  /**
   * The lowest weekly wage that still counts as an offer. Below it the agent
   * walks out on the spot, so the screen names the figure rather than letting
   * the manager discover it by ending the talks.
   */
  readonly walkOutWeeklyWage: number;
  /**
   * The lowest wage that signs him, for every shape of offer the panel can dial
   * in. Keyed by `offerQuoteKey`.
   *
   * This is the number the screen exists to show. Without it the manager was
   * bidding against a figure the view model deliberately withheld, from a
   * slider seeded at 70% of it, with three attempts — which is not a
   * negotiation, it is a guessing game with a hidden answer.
   */
  readonly requiredWeeklyWageByOffer: Readonly<Record<string, number>>;
  /**
   * The agent's closing position. Present only in the final round.
   *
   * Its presence IS the mode switch: when this is set the manager no longer
   * makes an offer, they take this one or lose the player.
   */
  readonly finalDemand?: {
    readonly weeklyWage: number;
    readonly termSeasons: 1 | 2 | 3;
    readonly perk: ContractPerk;
    /** Already carrying the figure — one of fifteen authored ultimatums. */
    readonly line: string;
  };
  readonly lastOutcomeLabel?: string;
  /**
   * The offer that produced the current round, absent before the first one.
   *
   * The panel's draft restores term and promise from this rather than snapping
   * back to defaults, which is what makes a choice survive a counter-offer and
   * survive reloading a save mid-negotiation.
   */
  readonly lastOffer?: {
    readonly weeklyWage: number;
    readonly termSeasons: 1 | 2 | 3;
    readonly perk: ContractPerk;
  };
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
