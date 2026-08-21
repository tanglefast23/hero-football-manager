export type SponsorProfileId = 'STEADY' | 'BALANCED' | 'BOLD';
type SponsorObjectiveLevel = 'EASY' | 'NORMAL' | 'HARD';
export type SponsorObjectiveKind =
  | 'LEAGUE_WINS'
  | 'LEAGUE_GOALS'
  | 'LEAGUE_FINISH'
  | 'LEAGUE_CLEAN_SHEETS'
  | 'LEAGUE_THREE_GOAL_GAMES'
  | 'LEAGUE_AWAY_POINTS';

interface SponsorBrandDefinition {
  readonly id: string;
  readonly name: string;
  readonly offerLine: string;
}

interface SponsorProfileDefinition {
  readonly monthlyPercent: number;
  readonly objectiveLevel: SponsorObjectiveLevel;
  /** Default objective bonus, retained for old schema-4 rules and common families. */
  readonly bonusPercent: number;
  /** Family-specific measured overrides; absent keys use `bonusPercent`. */
  readonly bonusPercentByObjective?: Readonly<
    Partial<Record<SponsorObjectiveKind, number>>
  >;
}

interface SponsorObjectiveDefinition {
  readonly id: string;
  readonly kind: SponsorObjectiveKind;
  readonly labelTemplate: string;
  readonly targets: Readonly<Record<SponsorObjectiveLevel, number>>;
  readonly chairmanDelta: number;
}

/** Authored sponsor content baked into each career by the application ring. */
export interface SponsorRules {
  readonly brands: readonly SponsorBrandDefinition[];
  readonly profiles: Readonly<
    Record<SponsorProfileId, SponsorProfileDefinition>
  >;
  readonly objectives: readonly SponsorObjectiveDefinition[];
}

export interface SponsorObjectiveSnapshot {
  readonly kind: SponsorObjectiveKind;
  /**
   * The objective as a finished English sentence, kept as the fallback for a
   * save written before `labelKey` existed — and for one whose sponsor content
   * row an app update has since removed.
   */
  readonly label: string;
  /**
   * Catalog key for `label`, so a signed deal renders in the player's language.
   *
   * Optional because it always was: `sponsorObjectiveSnapshotSchema` in
   * `persistence/game-state-codec.ts` has accepted `labelKey`/`labelParams`
   * since it was written, and the producer simply never filled them in. Adding
   * them here is a compile-time change only — no migration, no
   * `GAME_SCHEMA_VERSION` bump.
   */
  readonly labelKey?: string;
  /** Raw values for the key's placeholders — `{ target: 8 }`, never `'8 wins'`. */
  readonly labelParams?: Readonly<Record<string, string | number>>;
  readonly target: number;
  readonly nominalBonus: number;
}

interface SponsorObjectiveOutcome {
  readonly met: boolean;
  readonly settledSeason: number;
  readonly actualBonus: number;
}

/**
 * Persisted financial terms and copy. A removed content row cannot rewrite or
 * invalidate a deal the player has already signed.
 */
export interface SponsorContractSnapshot {
  readonly contractId: string;
  readonly sponsorContentId: string;
  readonly sponsorName: string;
  readonly offerLine: string;
  readonly season: number;
  readonly slot: number;
  readonly nominalMonthlyFee: number;
  readonly profile?: SponsorProfileId;
  readonly objective?: SponsorObjectiveSnapshot;
  readonly provisional: boolean;
  readonly signedSeason?: number;
  readonly signedWeek?: number;
  readonly replacedContinuity?: boolean;
  readonly objectiveOutcome?: SponsorObjectiveOutcome;
}

export interface SponsorOfferSnapshot {
  readonly offerId: string;
  readonly sponsorContentId: string;
  readonly sponsorName: string;
  readonly offerLine: string;
  readonly season: number;
  readonly slot: number;
  readonly profile: SponsorProfileId;
  readonly nominalMonthlyFee: number;
  readonly objective: SponsorObjectiveSnapshot;
}

export interface SponsorshipState {
  readonly activeContracts: SponsorContractSnapshot[];
  readonly offers: SponsorOfferSnapshot[];
  readonly portfolioSeason: number;
  readonly offerSeason?: number;
  readonly weeklyChallenge?: SponsorWeeklyChallenge;
}

export type SponsorWeeklyChallengeKind = 'SCORE_THREE' | 'CLEAN_SHEET';

export interface SponsorWeeklyChallenge {
  readonly id: string;
  readonly kind: SponsorWeeklyChallengeKind;
  readonly sponsorName: string;
  readonly season: number;
  readonly chosenWeek: number;
  readonly fixtureId: string;
  readonly fixtureWeek: number;
  readonly nominalBonus: number;
  readonly outcome?: {
    readonly met: boolean;
    readonly actualBonus: number;
  };
}

export type UserMatchCompetition = 'LEAGUE' | 'CUP';
export type UserMatchOutcome = 'WIN' | 'DRAW' | 'LOSS';

export interface PendingUserMatchImpact {
  readonly fixtureId: string;
  readonly competition: UserMatchCompetition;
  /** League before Cup for a same-week double-header. */
  readonly settlementOrder: 0 | 1;
  readonly source: 'PRODUCTION' | 'SYNTHETIC';
  readonly outcome: UserMatchOutcome;
  readonly regulationGoals: number;
  readonly participantPlayerIds: string[];
  readonly powerFiredPlayerIds: string[];
  /** Powered participants at match completion, snapshotted against later awakenings. */
  readonly heroAppearancePlayerIds: string[];
  readonly divisionScale: number;
  readonly supporterWinUnits: number;
  readonly supporterHeroUnits: number;
}

export interface AppliedSupporterImpactSummary {
  readonly fixtureId: string;
  readonly outcome: UserMatchOutcome;
  readonly streakAfter: number;
  readonly resultDelta: number;
  readonly heroDelta: number;
  readonly realizedDelta: number;
}

export interface SupporterWeekSummary {
  readonly season: number;
  readonly week: number;
  readonly before: number;
  readonly after: number;
  readonly totalDelta: number;
  readonly impacts: AppliedSupporterImpactSummary[];
}

export interface SupporterBusinessState {
  readonly consecutiveLosses: number;
  readonly lastAppliedImpact?: SupporterWeekSummary;
}

export interface ClubBusinessState {
  readonly supporters: SupporterBusinessState;
  readonly pendingUserMatchImpacts: PendingUserMatchImpact[];
  readonly sponsorship: SponsorshipState;
}
