import {
  buyingTransferQuote,
  isCoachCandidateEligible,
  isTransferWindowOpen,
  insultingOfferFloor,
  pitchCardAffinity,
  scoutMissionCost,
  sellingTransferQuote,
  type CoachCandidate,
  type ContractNegotiation,
  type ContractPerk,
  type ScoutFocus,
  type ScoutMission,
  type ScoutMissionResult,
  type ScoutRegion,
  type TransferQuote,
  type ValuationPlayer,
  contractPerkPercent,
  requiredWeeklyWage,
  weeksUntilTransferWindowOpen,
  FINAL_NEGOTIATION_ROUND,
  type PitchCard,
  type PlayerPersonality,
} from '../game/market';
import { loadLaunchContent } from '../content';
import { copyOrEnglish } from './copy-fallback';
import { proseSlug } from '../i18n/content-strings';
import { divisionTierLabelWith, type DivisionLevel } from '../game/pyramid';
import {
  contractTermOptions,
  shortContractReasonCopy,
} from '../game/retirement';
import { resolveRingCopy } from './copy-fallback';
import {
  archetypeName,
  coachSpecialtyName,
  personalityName,
  powerDisplayName,
  readableToken,
  scoutRegionName,
} from './name-copy';
import {
  playerPotentialGrade,
  POTENTIAL_GRADES,
  superTrainingChancePercent,
  type PotentialGrade,
} from '../game/archetype-caps';
import type {
  ContractPerkViewModel,
  MarketNegotiationViewModel,
  MarketSectionId,
  MarketViewModel,
  PitchCardViewModel,
  ScoutMissionChoiceViewModel,
  ScoutReportViewModel,
  TransferListingViewModel,
  YouthIntakeViewModel,
} from '../ui/market-models';
import { coachRoleEffectLabels } from './coach-effects';
import { coachWeeklyWageForRole } from '../game/market-career';
import {
  detailedScoutReportCost,
  reportSurvivesUntil,
  type DetailedScoutReportMission,
} from '../game/market-career';
import {
  careerContractPromiseBlockedReason,
  type ContractPromiseBlockedReason,
} from '../game/contract-promises';
import type { CareerPlayer, GameState } from '../game/types';
import { copyFor, formatMoneyForCopy, type CopyFn } from '../i18n';

/**
 * English copy, for every caller that has not threaded a locale through yet.
 *
 * Matches `view-models.ts`: a pure module cannot reach React context, so the
 * dependency is a parameter with a default, built once and reused.
 */
let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

export interface ScoutMissionOptionSource {
  readonly id: string;
  readonly region: ScoutRegion;
  readonly focus: ScoutFocus;
  readonly regionLabel?: string;
  readonly detail?: string;
  readonly cost?: number;
  readonly durationWeeks?: number;
}

export interface ScoutedPlayerIdentitySource {
  readonly id: string;
  readonly name: string;
  readonly lookId?: string;
  readonly powerName?: string;
}

export interface TransferListingSource {
  readonly player: ValuationPlayer & {
    readonly name: string;
    readonly lookId?: string;
    readonly powerName?: string;
    /** Same current-growth grade shown for this player on the Squad register. */
    readonly potentialGrade?: PotentialGrade;
    readonly potentialRange?: {
      readonly minimum: number;
      readonly maximum: number;
    };
  };
  readonly direction: 'BUY' | 'SELL';
  readonly sellingClubDivision: number;
  readonly listed?: boolean;
  /**
   * SELL only. Present when the career sale path would reject this sale (no
   * matchday cover after it), so the action renders disabled with the reason
   * instead of erroring on use — or silently vanishing from the desk.
   */
  readonly saleBlockedReason?: string;
  readonly savedQuote?: TransferQuote;
  readonly bids?: readonly {
    readonly id: string;
    readonly buyerName: string;
    readonly quote: TransferQuote;
  }[];
}

export interface NegotiationViewSource {
  readonly state: ContractNegotiation;
  readonly playerName: string;
  readonly playerRole?: 'GK' | 'DEF' | 'MID' | 'FWD';
  readonly lookId?: string;
  /** The visible starting number, normally current wage or the previous offer. */
  readonly openingWeeklyWage: number;
  readonly wageStep?: number;
  /**
   * Longest term this player will sign. Optional and defaulting to the full
   * three seasons so every existing caller keeps working; the two career
   * surfaces supply it, and they compute it differently because the week-30
   * decrement has already run for a renewal but not for an in-season signing.
   */
  readonly maxTermSeasons?: 1 | 2 | 3;
  /** Only needed to phrase the short-term line; omitted, the line is dropped. */
  readonly playerAge?: number;
  /** Live career facts used to disable promises the club cannot honour. */
  readonly contractPromiseContext?: {
    readonly state: GameState;
    readonly player: CareerPlayer;
    readonly heroLimit: number;
  };
}

export interface YouthIntakeViewSource {
  readonly status: 'OPEN' | 'CLOSED';
  readonly declined: boolean;
  readonly rosterCount: number;
  readonly rosterCapacity: number;
  readonly offers: readonly {
    readonly player: {
      readonly id: string;
      readonly name: string;
      readonly role: 'GK' | 'DEF' | 'MID' | 'FWD';
      readonly lookId?: string;
      readonly age: number;
      readonly potential: 1 | 2 | 3 | 4 | 5;
      /** Same current-growth grade shown after this prospect joins the squad. */
      readonly potentialGrade?: PotentialGrade;
      readonly archetype: string;
      readonly weeklyWage: number;
      /** Academy prospects show their real stats — the club's own kids, no fog. */
      readonly attrs: YouthAttrs;
    };
    readonly signingBonus: number;
  }[];
}

type YouthAttrKey = 'pac' | 'sho' | 'pas' | 'def' | 'tec' | 'sta' | 'ref';
type YouthAttrs = Readonly<Record<YouthAttrKey, number>>;
export type YouthStatLabel =
  'PAC' | 'SHO' | 'PAS' | 'DEF' | 'TEC' | 'STA' | 'REF';

/**
 * The six stats a youth card shows. Keepers swap SHO for REF: a shot-stopper's
 * finishing says nothing about them and their reflexes say everything.
 */
function youthStatLine(
  role: 'GK' | 'DEF' | 'MID' | 'FWD',
  attrs: YouthAttrs,
): readonly { readonly label: YouthStatLabel; readonly value: number }[] {
  const keys: readonly YouthAttrKey[] =
    role === 'GK'
      ? ['pac', 'ref', 'pas', 'def', 'tec', 'sta']
      : ['pac', 'sho', 'pas', 'def', 'tec', 'sta'];
  return keys.map((key) => ({
    label: key.toUpperCase() as YouthStatLabel,
    value: attrs[key],
  }));
}

export interface MarketViewModelSource {
  readonly careerSeed: number;
  readonly season: number;
  readonly week: number;
  readonly currentCareerWeek: number;
  readonly division: DivisionLevel;
  /** Best division reached; promotion unlocks survive relegation. */
  readonly highestDivisionReached?: DivisionLevel;
  readonly fame: number;
  readonly cash: number;
  readonly unlockedSections?: readonly MarketSectionId[];
  readonly scoutOfficeLevel: number;
  readonly scoutOptions: readonly ScoutMissionOptionSource[];
  readonly firstScoutFavorAvailable?: boolean;
  readonly activeScoutMission?: ScoutMission;
  readonly activeScoutMissionFeeWaived?: boolean;
  readonly detailedScoutReport?: DetailedScoutReportMission;
  readonly scoutResult?: ScoutMissionResult;
  readonly scoutedPlayerIdentities?: readonly ScoutedPlayerIdentitySource[];
  readonly transferListings: readonly TransferListingSource[];
  readonly coachCandidates: readonly CoachCandidate[];
  readonly headCoach?: CoachCandidate;
  readonly assistantSlotUnlocked?: boolean;
  readonly headCoachId?: string;
  readonly assistantCoachId?: string;
  readonly youthIntake?: YouthIntakeViewSource;
  readonly negotiation?: NegotiationViewSource;
}

/**
 * The promise ladder, graded from the engine's own numbers.
 *
 * `detail` states the mechanical consequence rather than atmosphere. The old
 * copy ("The armband and the room", "First call on focus drills") described none
 * of what these actually do: captaincy silently strips the armband from the
 * current captain, shirt #10 takes the number off whoever wears it, training
 * priority blocks every other player's drills until five are spent, and a
 * starting promise refuses any lineup that drops him for the whole contract.
 *
 * Grade and consequence are co-equal on purpose. The grade rates how hard the
 * promise pushes the agent, and the promise that pushes hardest is also the most
 * expensive to keep — a manager reading the letter alone would pick "A" and walk
 * into a locked lineup slot and a spent Hero License.
 */
const PERK_COPY_KEYS: readonly {
  readonly id: ContractPerk;
  readonly label: string;
  readonly detail: string;
}[] = [
  {
    id: 'GUARANTEED_STARTER',
    label: 'market.perkStarterLabel',
    detail: 'market.perkStarterDetail',
  },
  {
    id: 'CAPTAINCY',
    label: 'market.perkCaptaincyLabel',
    detail: 'market.perkCaptaincyDetail',
  },
  {
    id: 'TRAINING_PRIORITY',
    label: 'market.perkTrainingLabel',
    detail: 'market.perkTrainingDetail',
  },
  {
    id: 'JERSEY_10',
    label: 'market.perkJerseyLabel',
    detail: 'market.perkJerseyDetail',
  },
];

/** Built per call rather than once at module load, because `t` decides the words. */
const KNOWN_PERSONALITIES: readonly string[] = [
  'FIERY',
  'LOYAL',
  'GREEDY',
  'JOKER',
  'PROFESSIONAL',
  'TIMID',
];

function isKnownPersonality(personality: PlayerPersonality): boolean {
  return KNOWN_PERSONALITIES.includes(personality);
}

function perkViewModels(
  t: CopyFn,
  personality: PlayerPersonality,
  context?: NegotiationViewSource['contractPromiseContext'],
): readonly ContractPerkViewModel[] {
  return PERK_COPY_KEYS.map((perk) => {
    const blocked =
      context === undefined
        ? undefined
        : careerContractPromiseBlockedReason(
            context.state,
            context.player,
            perk.id,
            context.heroLimit,
          );
    return {
      id: perk.id,
      label: t(perk.label),
      detail: t(perk.detail),
      gradeLabel: perkGradeLabel(perk.id, t, personality),
      available: blocked === undefined,
      ...(blocked === undefined
        ? {}
        : { blockedReason: blockedReasonCopy(t, blocked) }),
    };
  });
}

function blockedReasonCopy(
  t: CopyFn,
  blocked: ContractPromiseBlockedReason,
): string {
  return copyOrEnglish(t, blocked.key, blocked.text, blocked.params);
}

/**
 * Derived from `contractPerkPercent` rather than written down twice.
 *
 * Thresholds, not ranks: if a rebalance moved Starter from 10% to 7% the badge
 * would read "C · Solid" instead of quietly continuing to claim it is the
 * strongest card in the deck. This repo has been bitten by a hand-copied engine
 * number before — a scouting label promised "+8% training" for two releases
 * after the bonus was deleted.
 */
function perkGradeLabel(
  perk: ContractPerk,
  t: CopyFn,
  personality: PlayerPersonality,
): string {
  // Graded for THIS player, not in the abstract. The agent scores a promise by
  // what his client thinks of it, so a panel grading by the flat ladder would
  // award an A to a guaranteed start the GREEDY man across the table rates
  // below a shirt number — the same hand-copied-number defect this function was
  // written to prevent, one layer up.
  //
  // Falls back to the flat ladder rather than throwing. The engine is right to
  // reject an unknown personality, but this is a BADGE: a malformed or migrated
  // save reaching here must render a slightly generic grade, not take down the
  // negotiation screen the manager is standing on.
  const percent = isKnownPersonality(personality)
    ? contractPerkPercent(perk, personality)
    : contractPerkPercent(perk);
  if (percent >= 10) return t('market.perkGradeA');
  if (percent >= 8) return t('market.perkGradeB');
  if (percent >= 6) return t('market.perkGradeC');
  return t('market.perkGradeD');
}

const CARD_COPY_KEYS: Readonly<
  Record<string, { label: string; detail: string }>
> = {
  FLATTERY: {
    label: 'market.cardFlatteryLabel',
    detail: 'market.cardFlatteryDetail',
  },
  TROPHY_PROMISE: {
    label: 'market.cardTrophyLabel',
    detail: 'market.cardTrophyDetail',
  },
  HOMETOWN_TIES: {
    label: 'market.cardHometownLabel',
    detail: 'market.cardHometownDetail',
  },
  MONEY_TALKS: {
    label: 'market.cardMoneyLabel',
    detail: 'market.cardMoneyDetail',
  },
  STRAIGHT_TALK: {
    label: 'market.cardStraightLabel',
    detail: 'market.cardStraightDetail',
  },
};

export function marketViewModel(
  source: MarketViewModelSource,
  t: CopyFn = englishCopy(),
): MarketViewModel {
  const transferWindowOpen = isTransferWindowOpen(source.week);
  const unlockedSections = source.unlockedSections ?? [
    'YOUTH',
    'SCOUT',
    'TRANSFERS',
    'COACHES',
  ];
  const identities = new Map(
    (source.scoutedPlayerIdentities ?? []).map((player) => [player.id, player]),
  );

  return {
    sections: [...unlockedSections],
    periodLabel: `S${source.season} · W${source.week}`,
    divisionLabel: divisionTierLabelWith(source.division, t),
    cash: source.cash,
    window: {
      open: transferWindowOpen,
      weeksUntilOpen: weeksUntilTransferWindowOpen(source.week),
      label: transferWindowOpen
        ? t('market.windowOpenLabel')
        : t('market.windowClosedLabel'),
      detail: transferWindowOpen
        ? t('market.windowOpenDetail')
        : t('market.windowClosedDetail'),
    },
    scouting: {
      officeLabel:
        source.scoutOfficeLevel === 0
          ? t('market.noScoutOffice')
          : t('market.scoutOfficeLevel', { level: source.scoutOfficeLevel }),
      precisionLabel:
        source.scoutOfficeLevel === 0
          ? t('market.scoutPrecisionBroad2')
          : source.scoutOfficeLevel === 1
            ? t('market.scoutPrecisionBroad3')
            : source.scoutOfficeLevel === 2
              ? t('market.scoutPrecisionImproved4')
              : t('market.scoutPrecisionSharp5'),
      status: scoutingStatus(source, t),
      choices: source.scoutOptions.map((option) =>
        scoutingChoice(source, option, t),
      ),
      reports: (source.scoutResult?.reports ?? []).map((report) => {
        const identity = identities.get(report.playerId);
        const stats =
          report.role === 'GK'
            ? (['pac', 'pas', 'def', 'tec', 'sta', 'ref'] as const)
            : (['pac', 'sho', 'pas', 'def', 'tec', 'sta'] as const);
        return {
          playerId: report.playerId,
          playerName: identity?.name ?? report.playerId,
          role: report.role,
          lookId: identity?.lookId,
          ageLabel: t('market.ageLabel', { age: report.age }),
          potentialLabel: scoutPotentialLabel(
            report.playerId,
            report.potentialRange.minimum,
            report.potentialRange.maximum,
          ),
          ...(report.power === undefined
            ? {}
            : {
                powerLabel:
                  identity?.powerName ?? powerDisplayName(t, report.power),
              }),
          ...(report.rumoredHeroLead === true && report.power === undefined
            ? { rumorLabel: t('market.heroRumorLooksReal') }
            : {}),
          stats: stats.map((attribute) => ({
            label: attribute.toUpperCase(),
            rangeLabel: `${report.statRanges[attribute].minimum}-${report.statRanges[attribute].maximum}`,
          })),
          dismissAvailable:
            source.negotiation?.state.playerId !== report.playerId,
          detailedReportAvailable:
            source.scoutOfficeLevel < 3 &&
            report.potentialRange.minimum !== report.potentialRange.maximum &&
            source.detailedScoutReport === undefined &&
            source.cash >= detailedScoutReportCost(source.division) &&
            reportSurvivesUntil(
              { season: source.season, week: source.week },
              report,
              source.scoutOfficeLevel >= 2 ? 1 : 2,
            ),
          detailedReportLabel:
            source.detailedScoutReport?.playerId === report.playerId
              ? t('market.detailedReportInProgress')
              : t('market.buyDetailedReport', {
                  cost: formatMoneyForCopy(
                    t,
                    detailedScoutReportCost(source.division),
                  ),
                }),
        } satisfies ScoutReportViewModel;
      }),
    },
    transfers: source.transferListings.map((listing) =>
      transferListing(source, listing, transferWindowOpen, t),
    ),
    coaches: source.coachCandidates.slice(0, 3).map((candidate) => {
      const eligible = isCoachCandidateEligible(
        candidate,
        source.highestDivisionReached ?? source.division,
        source.fame,
      );
      const headWeeklyWage = coachWeeklyWageForRole(candidate, 'HEAD');
      const assistantWeeklyWage = coachWeeklyWageForRole(
        candidate,
        'ASSISTANT',
      );
      const headAffordable = source.cash >= headWeeklyWage;
      const assistantAffordable = source.cash >= assistantWeeklyWage;
      const headCoachId = source.headCoachId ?? source.headCoach?.id;
      const legacySingleHeadSource =
        source.headCoach !== undefined && source.headCoachId === undefined;
      const alreadyOnStaff =
        candidate.id === headCoachId ||
        candidate.id === source.assistantCoachId;
      const assistantSlotUnlocked = source.assistantSlotUnlocked === true;
      const generallyAvailable = eligible && !alreadyOnStaff;
      const headAvailable =
        generallyAvailable && headAffordable && headCoachId === undefined;
      const assistantAvailable =
        generallyAvailable &&
        assistantAffordable &&
        assistantSlotUnlocked &&
        source.assistantCoachId === undefined;
      return {
        id: candidate.id,
        portraitId: candidate.portraitId ?? candidate.id,
        name: candidate.name,
        age: candidate.age ?? 45,
        level: candidate.level,
        levelLabel: `Lv${candidate.level}`,
        specialtyLabels: [
          coachSpecialtyName(t, candidate.specialties[0]),
          coachSpecialtyName(t, candidate.specialties[1]),
        ],
        headEffectLabels: coachRoleEffectLabels(candidate, 'HEAD', t),
        assistantEffectLabels: coachRoleEffectLabels(candidate, 'ASSISTANT', t),
        personalityLabel: personalityName(t, candidate.personality),
        weeklyWage: candidate.weeklyWage,
        headWeeklyWage,
        assistantWeeklyWage,
        retiredLegend: candidate.retiredLegendPlayerId !== undefined,
        ...(candidate.loyaltyDiscountPercent > 0
          ? {
              loyaltyLabel: t('market.loyaltyDiscount', {
                percent: candidate.loyaltyDiscountPercent,
              }),
            }
          : {}),
        ...(candidate.unlockId === undefined
          ? {}
          : {
              unlockLabel: t('market.teachesUnlock', {
                unlock: unlockName(candidate.unlockId, t),
              }),
            }),
        available: headAvailable || assistantAvailable,
        headAvailable,
        assistantAvailable,
        assistantSlotUnlocked,
        // A role CODE, not a label — the screen turns it into copy. It used to
        // be the literal union `'Head coach' | 'Assistant'`, which no
        // translated string could satisfy.
        ...(candidate.id === headCoachId
          ? { currentRole: 'HEAD' as const }
          : candidate.id === source.assistantCoachId
            ? { currentRole: 'ASSISTANT' as const }
            : {}),
        ...(legacySingleHeadSource
          ? { blockedReason: dismissCoachFirst(source, t) }
          : alreadyOnStaff
            ? { blockedReason: t('market.alreadyOnCoachingStaff') }
            : !eligible
              ? { blockedReason: t('market.raiseDivisionAndFame') }
              : !headAffordable && !assistantAffordable
                ? { blockedReason: t('market.cannotCoverFirstWage') }
                : headAvailable || assistantAvailable
                  ? {}
                  : headCoachId !== undefined && !assistantSlotUnlocked
                    ? { blockedReason: dismissCoachFirst(source, t) }
                    : { blockedReason: t('market.bothCoachingRolesFilled') }),
      };
    }),
    ...(source.youthIntake === undefined || !unlockedSections.includes('YOUTH')
      ? {}
      : { youth: youthIntakeViewModel(source.youthIntake, source.cash, t) }),
    ...(source.negotiation === undefined
      ? {}
      : { negotiation: marketNegotiationViewModel(source.negotiation, t) }),
  };
}

/** The one blocked reason built twice, so the fallback name is written once. */
function dismissCoachFirst(source: MarketViewModelSource, t: CopyFn): string {
  return t('market.dismissCoachFirst', {
    coach: source.headCoach?.name ?? t('market.theCurrentCoach'),
  });
}

function youthIntakeViewModel(
  intake: YouthIntakeViewSource,
  cash: number,
  t: CopyFn,
): YouthIntakeViewModel {
  const hasRosterSpace = intake.rosterCount < intake.rosterCapacity;
  const isOpen = intake.status === 'OPEN';
  return {
    status: intake.status,
    headline: isOpen
      ? t('market.youthHeadlineOpen')
      : intake.declined
        ? t('market.youthHeadlineDeclined')
        : t('market.youthHeadlineClosed'),
    detail: isOpen
      ? t('market.youthDetailOpen')
      : t('market.youthDetailClosed'),
    rosterLabel: t('market.youthRosterLabel', {
      count: intake.rosterCount,
      capacity: intake.rosterCapacity,
    }),
    offers: intake.offers.map((offer) => {
      const affordable = cash >= offer.signingBonus;
      return {
        playerId: offer.player.id,
        playerName: offer.player.name,
        role: offer.player.role,
        lookId: offer.player.lookId,
        ageLabel: t('market.ageLabel', { age: offer.player.age }),
        archetypeLabel: archetypeName(t, offer.player.archetype),
        potentialLabel: exactPotentialLabel(
          offer.player.id,
          offer.player.potential,
          offer.player.potentialGrade,
        ),
        stats: youthStatLine(offer.player.role, offer.player.attrs),
        signingBonus: offer.signingBonus,
        weeklyWage: offer.player.weeklyWage,
        available: isOpen && hasRosterSpace && affordable,
        ...(!hasRosterSpace
          ? { blockedReason: t('market.youthRosterFull') }
          : !affordable
            ? { blockedReason: t('market.youthCannotAffordBonus') }
            : !isOpen
              ? { blockedReason: t('market.youthIntakeClosed') }
              : {}),
      };
    }),
    canDecline: isOpen && intake.offers.length > 0,
  };
}

function scoutingStatus(
  source: MarketViewModelSource,
  t: CopyFn,
): MarketViewModel['scouting']['status'] {
  const mission = source.activeScoutMission;
  if (mission === undefined && source.scoutResult !== undefined) {
    return {
      kind: 'COMPLETED',
      headline: t('market.scoutReportsOnDesk', {
        count: source.scoutResult.reports.length,
      }),
      detail: t('market.scoutReportsDetail'),
      progressLabel: t('market.scoutProgressComplete'),
    };
  }
  if (mission === undefined) {
    return {
      kind: 'IDLE',
      headline: t('market.scoutIdleHeadline'),
      detail: t('market.scoutIdleDetail'),
      progressLabel: t('market.scoutProgressReady'),
    };
  }
  const weeksRemaining = Math.max(
    0,
    mission.dueWeek - source.currentCareerWeek,
  );
  if (weeksRemaining === 0) {
    return {
      kind: 'READY',
      headline: t('market.scoutReadyHeadline'),
      detail: t('market.scoutReadyDetail'),
      progressLabel: t('market.scoutProgressReportDue'),
    };
  }
  return {
    kind: 'IN_PROGRESS',
    headline: t('market.scoutTripInProgress', {
      region: scoutRegionName(t, mission.region),
    }),
    detail:
      source.activeScoutMissionFeeWaived === true
        ? t('market.scoutBriefFeeWaived', {
            focus: focusLabel(mission.focus, t),
          })
        : t('market.scoutBriefPaid', {
            focus: focusLabel(mission.focus, t),
            cost: formatMoneyForCopy(t, mission.cost),
          }),
    progressLabel: t('market.scoutWeeksLeft', {
      n: weeksRemaining,
      count: weeksRemaining,
    }),
  };
}

function scoutingChoice(
  source: MarketViewModelSource,
  option: ScoutMissionOptionSource,
  t: CopyFn,
): ScoutMissionChoiceViewModel {
  const cost = option.cost ?? scoutMissionCost(option.region, option.focus);
  const progressionDivision = source.highestDivisionReached ?? source.division;
  const heroLocked =
    option.focus.kind === 'RUMORED_HERO' && progressionDivision > 3;
  const eliteLocked =
    option.focus.kind === 'ELITE_PROSPECT' && progressionDivision > 2;
  const busy = source.activeScoutMission !== undefined;
  const affordable = source.cash >= cost;
  const feeWaived = !affordable && source.firstScoutFavorAvailable === true;
  return {
    id: option.id,
    region: option.region,
    ...(option.focus.kind === 'PROFILE' && option.focus.role !== undefined
      ? { role: option.focus.role }
      : {}),
    prospectType:
      option.focus.kind === 'PROFILE'
        ? option.focus.prospectType
        : option.focus.kind === 'RUMORED_HERO'
          ? 'RUMORED_HERO'
          : option.focus.kind === 'ELITE_PROSPECT'
            ? 'ELITE_PROSPECT'
            : option.focus.kind === 'AGE'
              ? 'YOUNG_PROSPECT'
              : 'IMMEDIATE_STARTER',
    regionLabel: option.regionLabel ?? scoutRegionName(t, option.region),
    focusLabel: focusLabel(option.focus, t),
    detail: option.detail ?? focusDetail(option.focus, t),
    cost,
    feeWaived,
    durationLabel:
      option.durationWeeks === undefined
        ? t('market.scoutDuration')
        : t('market.scoutDurationWeeks', {
            n: option.durationWeeks,
            count: option.durationWeeks,
          }),
    available:
      !busy && !heroLocked && !eliteLocked && (affordable || feeWaived),
    ...(busy
      ? { blockedReason: t('market.scoutBusy') }
      : heroLocked
        ? {
            blockedReason: t('market.scoutHeroLocked', {
              division: divisionTierLabelWith(3, t),
            }),
          }
        : eliteLocked
          ? {
              blockedReason: t('market.scoutEliteLocked', {
                division: divisionTierLabelWith(2, t),
              }),
            }
          : !affordable && !feeWaived
            ? { blockedReason: t('market.scoutNotEnoughMoney') }
            : {}),
  };
}

function transferListing(
  source: MarketViewModelSource,
  listing: TransferListingSource,
  windowOpen: boolean,
  t: CopyFn,
): TransferListingViewModel {
  const context = {
    careerSeed: source.careerSeed,
    season: source.season,
    week: source.week,
    sellingClubDivision: listing.sellingClubDivision,
  };
  const quote =
    listing.savedQuote ??
    (listing.direction === 'BUY'
      ? buyingTransferQuote(listing.player, context)
      : sellingTransferQuote(listing.player, context));
  const affordable = listing.direction === 'SELL' || source.cash >= quote.fee;
  return {
    playerId: listing.player.id,
    playerName: listing.player.name,
    role: listing.player.role,
    lookId: listing.player.lookId,
    age: listing.player.age,
    potentialLabel:
      listing.player.potentialRange === undefined
        ? exactPotentialLabel(
            listing.player.id,
            listing.player.potential as 1 | 2 | 3 | 4 | 5,
            listing.player.potentialGrade,
          )
        : scoutPotentialLabel(
            listing.player.id,
            listing.player.potentialRange.minimum,
            listing.player.potentialRange.maximum,
          ),
    direction: listing.direction,
    ...(listing.player.powerName === undefined
      ? {}
      : { powerLabel: listing.player.powerName }),
    valuation: quote.valuation,
    quote: quote.fee,
    quoteLabel:
      listing.direction === 'BUY'
        ? t('market.quoteClubAsking')
        : t('market.quoteBestBid'),
    actionLabel:
      listing.direction === 'BUY'
        ? t('market.actionOpenTalks')
        : listing.listed === true
          ? t('market.actionAcceptBid')
          : t('market.actionListPlayer'),
    listed: listing.listed === true,
    bids: (listing.bids ?? []).map((bid) => ({
      id: bid.id,
      buyerName: bid.buyerName,
      fee: bid.quote.fee,
    })),
    // An unaffordable target stays pressable so the manager gets a direct
    // refusal from the desk instead of a grey control with no response.
    available: windowOpen && listing.saleBlockedReason === undefined,
    ...(!windowOpen
      ? { blockedReason: t('market.transferWindowClosed') }
      : listing.saleBlockedReason !== undefined
        ? { blockedReason: listing.saleBlockedReason }
        : !affordable
          ? { blockedReason: t('market.transferFeeExceedsCash') }
          : {}),
  };
}

/**
 * The grade and what it actually buys.
 *
 * This used to read "C+ · +8% training", which was false: potential contributes
 * nothing to an ordinary drill and has not since its percent bonus was removed
 * and the job moved to the SUPER roll. A manager scouting an A+ prospect was
 * told they train 14% faster when the truth is that they hit a SUPER session a
 * third of the time. Same stale claim the register's Potential tooltip carried
 * until 0bbe4f7 — one deletion, two pieces of text left behind it.
 */
function exactPotentialLabel(
  playerId: string,
  potential: 1 | 2 | 3 | 4 | 5,
  growthGrade?: PotentialGrade,
): string {
  const rawGrade = playerPotentialGrade({ id: playerId, potential });
  return `${growthGrade ?? rawGrade} · SUPER ${superTrainingChancePercent(rawGrade)}%`;
}

function scoutPotentialLabel(
  playerId: string,
  minimum: number,
  maximum: number,
): string {
  const minTier = Math.max(1, Math.min(5, Math.round(minimum))) as
    1 | 2 | 3 | 4 | 5;
  const maxTier = Math.max(1, Math.min(5, Math.round(maximum))) as
    1 | 2 | 3 | 4 | 5;
  if (minTier === maxTier) return exactPotentialLabel(playerId, minTier);
  const lowGrade = POTENTIAL_GRADES[(minTier - 1) * 3];
  const highGrade = POTENTIAL_GRADES[(maxTier - 1) * 3 + 2];
  return `${lowGrade}–${highGrade}`;
}

const AGENT_FINAL_LINES = loadLaunchContent().agentFinalLines.lines;

/** FNV-1a, the same mixer the other line pools draw with. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
const NEGOTIATION_PERKS: readonly ContractPerk[] = [
  'GUARANTEED_STARTER',
  'CAPTAINCY',
  'TRAINING_PRIORITY',
  'JERSEY_10',
];

/**
 * The lookup key for one shape of offer.
 *
 * Exported so the panel and this file cannot disagree about it. A key built
 * twice is a key that goes stale once, and the value behind it is the number
 * the screen promises will be accepted.
 */
export function offerQuoteKey(
  termSeasons: number,
  perk: ContractPerk,
  pitchCard?: PitchCard,
): string {
  return pitchCard === undefined
    ? `${termSeasons}:${perk}`
    : `${termSeasons}:${perk}:${pitchCard}`;
}

/** The saved choice when legal, otherwise the first promise this panel can submit. */
export function contractDraftPerk(
  viewModel: Pick<MarketNegotiationViewModel, 'perks'> | undefined,
  preferred?: ContractPerk,
): ContractPerk {
  if (
    preferred !== undefined &&
    (viewModel === undefined ||
      viewModel.perks.some((perk) => perk.id === preferred && perk.available))
  )
    return preferred;
  return (
    viewModel?.perks.find((perk) => perk.available)?.id ??
    viewModel?.perks[0]?.id ??
    preferred ??
    'GUARANTEED_STARTER'
  );
}

/**
 * Every wage the manager could be told to offer, precomputed.
 *
 * A table rather than a function on the view model, because view models here
 * are plain data — they are snapshotted, compared and serialised in tests, and
 * a closure in one would break all three. The combinatorics are tiny: at most
 * three terms times four promises times four card choices.
 */
function requiredWageQuotes(
  negotiation: ContractNegotiation,
  termOptions: readonly (1 | 2 | 3)[],
): Record<string, number> {
  const quotes: Record<string, number> = {};
  const cards: (PitchCard | undefined)[] = [
    undefined,
    ...negotiation.pitchCards.filter(
      (card) => !negotiation.usedPitchCards.includes(card),
    ),
  ];
  try {
    for (const term of termOptions) {
      for (const perk of NEGOTIATION_PERKS) {
        for (const card of cards) {
          quotes[offerQuoteKey(term, perk, card)] = requiredWeeklyWage(
            negotiation,
            term,
            perk,
            card,
          );
        }
      }
    }
  } catch {
    // The engine is right to reject a malformed negotiation, but this is a
    // READOUT. A save whose shape has drifted must render the panel with a dash
    // where the number goes and let the manager close the talks — not take down
    // the screen they are standing on. The panel already handles a missing
    // quote, so an empty table is a complete answer rather than a hidden one.
    return {};
  }
  return quotes;
}

export function marketNegotiationViewModel(
  source: NegotiationViewSource,
  t: CopyFn = englishCopy(),
): MarketNegotiationViewModel {
  const negotiation = source.state;
  const lastOffer = negotiation.history.at(-1)?.offer;
  const previousOffer = lastOffer?.weeklyWage;
  const mood = moodPresentation(negotiation.mood, t);
  const wageStep = source.wageStep ?? 50;
  const maxTermSeasons = source.maxTermSeasons ?? 3;
  const leverage = negotiation.pitchInfluencePercent;
  const lastOutcome = negotiation.history.at(-1)?.outcome;
  /**
   * The agent's closing position, present only in the last round.
   *
   * Locked to the term and promise the manager last put on the table rather
   * than tracking a live draft. He is naming ONE number and leaving; a figure
   * that slid around under a set of dials would not be an ultimatum, it would
   * be a fourth round wearing an ultimatum's clothes.
   *
   * Absent before the last round and absent once talks are over, so the panel's
   * whole take-it-or-leave-it branch hangs off one optional field.
   */
  const finalDemand =
    negotiation.status !== 'OPEN' ||
    negotiation.round + 1 !== FINAL_NEGOTIATION_ROUND
      ? undefined
      : (() => {
          const termSeasons = (lastOffer?.termSeasons ?? maxTermSeasons) as
            1 | 2 | 3;
          const perk = lastOffer?.perk ?? 'GUARANTEED_STARTER';
          // Same reasoning as the quote table: a demand that cannot be priced is
          // no demand, and the panel falls back to the ordinary offer form rather
          // than crashing on the last round of a drifted save.
          const quoted = requiredWageQuotes(negotiation, [termSeasons])[
            offerQuoteKey(termSeasons, perk)
          ];
          if (quoted === undefined) return undefined;
          const weeklyWage = quoted;
          // Seeded on the negotiation, so re-rendering the panel — or reloading
          // the save — does not hand the same agent a different personality
          // halfway through his own sentence.
          const authored =
            AGENT_FINAL_LINES[
              hashString(`agent-final:${negotiation.id}`) %
                AGENT_FINAL_LINES.length
            ]!;
          return {
            weeklyWage,
            termSeasons,
            perk,
            line: copyOrEnglish(
              t,
              `agent.final.${proseSlug(authored)}`,
              authored,
              {
                wage: formatMoneyForCopy(t, weeklyWage),
              },
            ),
          };
        })();
  return {
    id: negotiation.id,
    playerId: negotiation.playerId,
    playerName: source.playerName,
    playerRole: source.playerRole ?? 'MID',
    lookId: source.lookId,
    personality: negotiation.personality,
    personalityLabel: personalityName(t, negotiation.personality),
    status: negotiation.status,
    mood: negotiation.mood,
    moodFace: mood.face,
    moodLabel: mood.label,
    roundLabel:
      negotiation.status === 'OPEN'
        ? t('market.negotiationRound', { round: negotiation.round + 1 })
        : negotiation.status === 'ACCEPTED'
          ? t('market.negotiationDealAgreed')
          : t('market.negotiationTalksEnded'),
    pitchLeverageLabel:
      leverage < 0
        ? t('market.pitchLowersWage', { percent: Math.abs(leverage) })
        : leverage > 0
          ? t('market.pitchRaisesWage', { percent: leverage })
          : t('market.pitchNoWageChange'),
    cards: negotiation.pitchCards.map((card) => {
      const affinity = pitchCardAffinity(negotiation.personality, card);
      return {
        id: card,
        label: t(CARD_COPY_KEYS[card].label),
        detail: t(CARD_COPY_KEYS[card].detail),
        used: negotiation.usedPitchCards.includes(card),
        affinity:
          affinity === 1 ? 'LOVED' : affinity === -1 ? 'HATED' : 'NEUTRAL',
      } satisfies PitchCardViewModel;
    }),
    perks: perkViewModels(
      t,
      negotiation.personality,
      source.contractPromiseContext,
    ),
    termOptions: contractTermOptions(maxTermSeasons),
    ...(maxTermSeasons >= 3 || source.playerAge === undefined
      ? {}
      : {
          shortTermReason: resolveRingCopy(
            t,
            shortContractReasonCopy(source.playerAge, maxTermSeasons),
          ),
        }),
    initialWeeklyWage: previousOffer ?? source.openingWeeklyWage,
    wageStep,
    walkOutWeeklyWage: insultingOfferFloor(negotiation.weeklyAsk),
    requiredWeeklyWageByOffer: requiredWageQuotes(
      negotiation,
      contractTermOptions(maxTermSeasons),
    ),
    ...(finalDemand === undefined ? {} : { finalDemand }),
    ...(lastOutcome === undefined
      ? {}
      : { lastOutcomeLabel: outcomeLabel(lastOutcome, t) }),
    ...(lastOffer === undefined
      ? {}
      : {
          lastOffer: {
            weeklyWage: lastOffer.weeklyWage,
            termSeasons: lastOffer.termSeasons as 1 | 2 | 3,
            perk: lastOffer.perk,
          },
        }),
  };
}

/** The face is kaomoji, not copy — it reads the same in every language. */
function moodPresentation(
  mood: ContractNegotiation['mood'],
  t: CopyFn,
): { face: string; label: string } {
  if (mood === 'ANGRY') return { face: 'ಠ_ಠ', label: t('market.moodAngry') };
  if (mood === 'UNHAPPY')
    return { face: '>_<', label: t('market.moodUnhappy') };
  if (mood === 'PLEASED')
    return { face: '^_^', label: t('market.moodPleased') };
  if (mood === 'THRILLED')
    return { face: '★_★', label: t('market.moodThrilled') };
  return { face: '•_•', label: t('market.moodListening') };
}

function outcomeLabel(
  outcome: ContractNegotiation['history'][number]['outcome'],
  t: CopyFn,
): string {
  if (outcome === 'ACCEPTED') return t('market.outcomeAccepted');
  if (outcome === 'INSULTED') return t('market.outcomeInsulted');
  if (outcome === 'WALKED_AWAY') return t('market.outcomeWalkedAway');
  return t('market.outcomeRejected');
}

function focusLabel(focus: ScoutFocus, t: CopyFn): string {
  if (focus.kind === 'POSITION')
    return t('market.focusPositionSearch', { role: focus.role });
  if (focus.kind === 'AGE') {
    return t('market.focusAgeRange', {
      minimum: focus.minimumAge,
      maximum: focus.maximumAge,
    });
  }
  if (focus.kind === 'ELITE_PROSPECT') return t('market.focusEliteProspect');
  if (focus.kind === 'PROFILE') {
    if (focus.prospectType === 'IMMEDIATE_STARTER')
      return t('market.focusImmediateStarter');
    if (focus.prospectType === 'YOUNG_PROSPECT')
      return t('market.focusYoungProspect');
    if (focus.prospectType === 'SPECIALIST') return t('market.focusSpecialist');
    return t('market.focusBargain');
  }
  return t('market.focusRumoredHero');
}

function focusDetail(focus: ScoutFocus, t: CopyFn): string {
  if (focus.kind === 'POSITION')
    return t('market.focusPositionDetail', { role: focus.role });
  if (focus.kind === 'AGE') return t('market.focusAgeDetail');
  if (focus.kind === 'ELITE_PROSPECT') return t('market.focusEliteDetail');
  if (focus.kind === 'PROFILE') {
    if (focus.prospectType === 'IMMEDIATE_STARTER')
      return t('market.focusImmediateStarterDetail');
    if (focus.prospectType === 'YOUNG_PROSPECT')
      return t('market.focusYoungProspectDetail');
    if (focus.prospectType === 'SPECIALIST')
      return t('market.focusSpecialistDetail');
    return t('market.focusBargainDetail');
  }
  return t('market.focusHeroDetail');
}

/**
 * Formation unlocks keep their shape ("4-3-3"), which is the same in every
 * language. `DEFAULT_COACH_CONTENT_UNLOCK_IDS` holds exactly one id today and
 * it is a formation, so the second branch is the shape a future drill unlock
 * would take: `drill:duels-3` resolves through the drill's own content key, and
 * only an id neither table knows falls through to the prettifier.
 */
function unlockName(unlockId: string, t: CopyFn): string {
  const formation = /^formation[-_:]?(.+)$/i.exec(unlockId);
  if (formation !== null) return formation[1];
  const drill = /^drill[-_:]?(.+)$/i.exec(unlockId);
  if (drill !== null) {
    const key = `drill.${drill[1]}.name`;
    const resolved = t(key);
    if (resolved !== key) return resolved;
  }
  return readableToken(unlockId);
}
