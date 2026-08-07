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
} from '../game/market';
import { divisionTierLabelWith, type DivisionLevel } from '../game/pyramid';
import { contractTermOptions, shortContractReasonCopy } from '../game/retirement';
import { resolveRingCopy } from './copy-fallback';
import {
  playerPotentialGrade,
  POTENTIAL_GRADES,
  superTrainingChancePercent,
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
import { copyFor, type CopyFn } from '../i18n';

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
export type YouthStatLabel = 'PAC' | 'SHO' | 'PAS' | 'DEF' | 'TEC' | 'STA' | 'REF';

/**
 * The six stats a youth card shows. Keepers swap SHO for REF: a shot-stopper's
 * finishing says nothing about them and their reflexes say everything.
 */
function youthStatLine(
  role: 'GK' | 'DEF' | 'MID' | 'FWD',
  attrs: YouthAttrs,
): readonly { readonly label: YouthStatLabel; readonly value: number }[] {
  const keys: readonly YouthAttrKey[] = role === 'GK'
    ? ['pac', 'ref', 'pas', 'def', 'tec', 'sta']
    : ['pac', 'sho', 'pas', 'def', 'tec', 'sta'];
  return keys.map(key => ({
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
function perkViewModels(t: CopyFn): readonly ContractPerkViewModel[] {
  return PERK_COPY_KEYS.map(perk => ({
    id: perk.id,
    label: t(perk.label),
    detail: t(perk.detail),
    gradeLabel: perkGradeLabel(perk.id, t),
  }));
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
function perkGradeLabel(perk: ContractPerk, t: CopyFn): string {
  const percent = contractPerkPercent(perk);
  if (percent >= 10) return t('market.perkGradeA');
  if (percent >= 8) return t('market.perkGradeB');
  if (percent >= 6) return t('market.perkGradeC');
  return t('market.perkGradeD');
}

const CARD_COPY_KEYS: Readonly<Record<string, { label: string; detail: string }>> = {
  FLATTERY: { label: 'market.cardFlatteryLabel', detail: 'market.cardFlatteryDetail' },
  TROPHY_PROMISE: { label: 'market.cardTrophyLabel', detail: 'market.cardTrophyDetail' },
  HOMETOWN_TIES: { label: 'market.cardHometownLabel', detail: 'market.cardHometownDetail' },
  MONEY_TALKS: { label: 'market.cardMoneyLabel', detail: 'market.cardMoneyDetail' },
  STRAIGHT_TALK: { label: 'market.cardStraightLabel', detail: 'market.cardStraightDetail' },
};

export function marketViewModel(
  source: MarketViewModelSource,
  t: CopyFn = englishCopy(),
): MarketViewModel {
  const transferWindowOpen = isTransferWindowOpen(source.week);
  const unlockedSections = source.unlockedSections ?? ['YOUTH', 'SCOUT', 'TRANSFERS', 'COACHES'];
  const identities = new Map(
    (source.scoutedPlayerIdentities ?? []).map(player => [player.id, player]),
  );

  return {
    sections: [...unlockedSections],
    periodLabel: `S${source.season} · W${source.week}`,
    divisionLabel: divisionTierLabelWith(source.division, t),
    cash: source.cash,
    window: {
      open: transferWindowOpen,
      label: transferWindowOpen ? t('market.windowOpenLabel') : t('market.windowClosedLabel'),
      detail: transferWindowOpen
        ? t('market.windowOpenDetail')
        : t('market.windowClosedDetail'),
    },
    scouting: {
      officeLabel: source.scoutOfficeLevel === 0
        ? t('market.noScoutOffice')
        : t('market.scoutOfficeLevel', { level: source.scoutOfficeLevel }),
      precisionLabel: source.scoutOfficeLevel === 0
        ? t('market.scoutPrecisionBroad2')
        : source.scoutOfficeLevel === 1
          ? t('market.scoutPrecisionBroad3')
          : source.scoutOfficeLevel === 2
            ? t('market.scoutPrecisionImproved4')
            : t('market.scoutPrecisionSharp5'),
      status: scoutingStatus(source, t),
      choices: source.scoutOptions.map(option => scoutingChoice(source, option, t)),
      reports: (source.scoutResult?.reports ?? []).map(report => {
        const identity = identities.get(report.playerId);
        const stats = report.role === 'GK'
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
            : { powerLabel: identity?.powerName ?? readableId(report.power) }),
          ...(report.rumoredHeroLead === true && report.power === undefined
            ? { rumorLabel: t('market.heroRumorLooksReal') }
            : {}),
          stats: stats.map(attribute => ({
            label: attribute.toUpperCase(),
            rangeLabel: `${report.statRanges[attribute].minimum}-${report.statRanges[attribute].maximum}`,
          })),
        } satisfies ScoutReportViewModel;
      }),
    },
    transfers: source.transferListings.map(listing =>
      transferListing(source, listing, transferWindowOpen, t)),
    coaches: source.coachCandidates.slice(0, 3).map(candidate => {
      const eligible = isCoachCandidateEligible(
        candidate,
        source.highestDivisionReached ?? source.division,
        source.fame,
      );
      const headWeeklyWage = coachWeeklyWageForRole(candidate, 'HEAD');
      const assistantWeeklyWage = coachWeeklyWageForRole(candidate, 'ASSISTANT');
      const headAffordable = source.cash >= headWeeklyWage;
      const assistantAffordable = source.cash >= assistantWeeklyWage;
      const headCoachId = source.headCoachId ?? source.headCoach?.id;
      const legacySingleHeadSource = source.headCoach !== undefined && source.headCoachId === undefined;
      const alreadyOnStaff = candidate.id === headCoachId || candidate.id === source.assistantCoachId;
      const assistantSlotUnlocked = source.assistantSlotUnlocked === true;
      const generallyAvailable = eligible && !alreadyOnStaff;
      const headAvailable = generallyAvailable && headAffordable && headCoachId === undefined;
      const assistantAvailable = generallyAvailable
        && assistantAffordable
        && assistantSlotUnlocked
        && source.assistantCoachId === undefined;
      return {
        id: candidate.id,
        portraitId: candidate.portraitId ?? candidate.id,
        name: candidate.name,
        age: candidate.age ?? 45,
        level: candidate.level,
        levelLabel: `Lv${candidate.level}`,
        specialtyLabels: [
          readableId(candidate.specialties[0]),
          readableId(candidate.specialties[1]),
        ],
        headEffectLabels: coachRoleEffectLabels(candidate, 'HEAD', t),
        assistantEffectLabels: coachRoleEffectLabels(candidate, 'ASSISTANT', t),
        personalityLabel: readableId(candidate.personality),
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
          : { unlockLabel: t('market.teachesUnlock', { unlock: unlockName(candidate.unlockId) }) }),
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
    offers: intake.offers.map(offer => {
      const affordable = cash >= offer.signingBonus;
      return {
        playerId: offer.player.id,
        playerName: offer.player.name,
        role: offer.player.role,
        lookId: offer.player.lookId,
        ageLabel: t('market.ageLabel', { age: offer.player.age }),
        archetypeLabel: offer.player.archetype,
        potentialLabel: exactPotentialLabel(offer.player.id, offer.player.potential),
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
  if (source.scoutResult !== undefined) {
    return {
      kind: 'COMPLETED',
      headline: t('market.scoutReportsOnDesk', { count: source.scoutResult.reports.length }),
      detail: t('market.scoutReportsDetail'),
      progressLabel: t('market.scoutProgressComplete'),
    };
  }
  const mission = source.activeScoutMission;
  if (mission === undefined) {
    return {
      kind: 'IDLE',
      headline: t('market.scoutIdleHeadline'),
      detail: t('market.scoutIdleDetail'),
      progressLabel: t('market.scoutProgressReady'),
    };
  }
  const weeksRemaining = Math.max(0, mission.dueWeek - source.currentCareerWeek);
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
    headline: t('market.scoutTripInProgress', { region: regionLabel(mission.region) }),
    detail: source.activeScoutMissionFeeWaived === true
      ? t('market.scoutBriefFeeWaived', { focus: focusLabel(mission.focus, t) })
      : t('market.scoutBriefPaid', {
        focus: focusLabel(mission.focus, t),
        cost: formatMoney(mission.cost),
      }),
    progressLabel: t('market.scoutWeeksLeft', { n: weeksRemaining, count: weeksRemaining }),
  };
}

function scoutingChoice(
  source: MarketViewModelSource,
  option: ScoutMissionOptionSource,
  t: CopyFn,
): ScoutMissionChoiceViewModel {
  const cost = scoutMissionCost(option.region, option.focus);
  const progressionDivision = source.highestDivisionReached ?? source.division;
  const heroLocked = option.focus.kind === 'RUMORED_HERO' && progressionDivision > 3;
  const eliteLocked = option.focus.kind === 'ELITE_PROSPECT' && progressionDivision > 2;
  const busy = source.activeScoutMission !== undefined;
  const affordable = source.cash >= cost;
  const feeWaived = !affordable && source.firstScoutFavorAvailable === true;
  return {
    id: option.id,
    region: option.region,
    regionLabel: option.regionLabel ?? regionLabel(option.region),
    focusLabel: focusLabel(option.focus, t),
    detail: option.detail ?? focusDetail(option.focus, t),
    cost,
    feeWaived,
    durationLabel: t('market.scoutDuration'),
    available: !busy && !heroLocked && !eliteLocked && (affordable || feeWaived),
    ...(busy
      ? { blockedReason: t('market.scoutBusy') }
      : heroLocked
        ? { blockedReason: t('market.scoutHeroLocked', { division: divisionTierLabelWith(3, t) }) }
        : eliteLocked
          ? { blockedReason: t('market.scoutEliteLocked', { division: divisionTierLabelWith(2, t) }) }
        : !affordable
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
  const quote = listing.savedQuote ?? (listing.direction === 'BUY'
    ? buyingTransferQuote(listing.player, context)
    : sellingTransferQuote(listing.player, context));
  const affordable = listing.direction === 'SELL' || source.cash >= quote.fee;
  return {
    playerId: listing.player.id,
    playerName: listing.player.name,
    role: listing.player.role,
    lookId: listing.player.lookId,
    age: listing.player.age,
    potentialLabel: exactPotentialLabel(
      listing.player.id,
      listing.player.potential as 1 | 2 | 3 | 4 | 5,
    ),
    direction: listing.direction,
    ...(listing.player.powerName === undefined ? {} : { powerLabel: listing.player.powerName }),
    valuation: quote.valuation,
    quote: quote.fee,
    quoteLabel: listing.direction === 'BUY'
      ? t('market.quoteClubAsking')
      : t('market.quoteBestBid'),
    actionLabel: listing.direction === 'BUY'
      ? t('market.actionOpenTalks')
      : listing.listed === true
        ? t('market.actionAcceptBid')
        : t('market.actionListPlayer'),
    listed: listing.listed === true,
    bids: (listing.bids ?? []).map(bid => ({
      id: bid.id,
      buyerName: bid.buyerName,
      fee: bid.quote.fee,
    })),
    available: windowOpen && affordable && listing.saleBlockedReason === undefined,
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
): string {
  const grade = playerPotentialGrade({ id: playerId, potential });
  return `${grade} · SUPER ${superTrainingChancePercent(grade)}%`;
}

function scoutPotentialLabel(
  playerId: string,
  minimum: number,
  maximum: number,
): string {
  const minTier = Math.max(1, Math.min(5, Math.round(minimum))) as 1 | 2 | 3 | 4 | 5;
  const maxTier = Math.max(1, Math.min(5, Math.round(maximum))) as 1 | 2 | 3 | 4 | 5;
  if (minTier === maxTier) return exactPotentialLabel(playerId, minTier);
  const lowGrade = POTENTIAL_GRADES[(minTier - 1) * 3];
  const highGrade = POTENTIAL_GRADES[(maxTier - 1) * 3 + 2];
  return `${lowGrade}–${highGrade}`;
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
  return {
    id: negotiation.id,
    playerId: negotiation.playerId,
    playerName: source.playerName,
    playerRole: source.playerRole ?? 'MID',
    lookId: source.lookId,
    personality: negotiation.personality,
    personalityLabel: readableId(negotiation.personality),
    status: negotiation.status,
    mood: negotiation.mood,
    moodFace: mood.face,
    moodLabel: mood.label,
    roundLabel: negotiation.status === 'OPEN'
      ? t('market.negotiationRound', { round: negotiation.round + 1 })
      : negotiation.status === 'ACCEPTED'
        ? t('market.negotiationDealAgreed')
        : t('market.negotiationTalksEnded'),
    pitchLeverageLabel: leverage < 0
      ? t('market.pitchLowersWage', { percent: Math.abs(leverage) })
      : leverage > 0
        ? t('market.pitchRaisesWage', { percent: leverage })
        : t('market.pitchNoWageChange'),
    cards: negotiation.pitchCards.map(card => {
      const affinity = pitchCardAffinity(negotiation.personality, card);
      return {
        id: card,
        label: t(CARD_COPY_KEYS[card].label),
        detail: t(CARD_COPY_KEYS[card].detail),
        used: negotiation.usedPitchCards.includes(card),
        affinity: affinity === 1 ? 'LOVED' : affinity === -1 ? 'HATED' : 'NEUTRAL',
      } satisfies PitchCardViewModel;
    }),
    perks: perkViewModels(t),
    termOptions: contractTermOptions(maxTermSeasons),
    ...(maxTermSeasons >= 3 || source.playerAge === undefined ? {} : {
      shortTermReason: resolveRingCopy(t, shortContractReasonCopy(source.playerAge, maxTermSeasons)),
    }),
    initialWeeklyWage: previousOffer ?? source.openingWeeklyWage,
    wageStep,
    walkOutWeeklyWage: insultingOfferFloor(negotiation.weeklyAsk),
    ...(lastOutcome === undefined
      ? {}
      : { lastOutcomeLabel: outcomeLabel(lastOutcome, t) }),
    ...(lastOffer === undefined ? {} : {
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
  if (mood === 'UNHAPPY') return { face: '>_<', label: t('market.moodUnhappy') };
  if (mood === 'PLEASED') return { face: '^_^', label: t('market.moodPleased') };
  if (mood === 'THRILLED') return { face: '★_★', label: t('market.moodThrilled') };
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
  if (focus.kind === 'POSITION') return t('market.focusPositionSearch', { role: focus.role });
  if (focus.kind === 'AGE') {
    return t('market.focusAgeRange', {
      minimum: focus.minimumAge,
      maximum: focus.maximumAge,
    });
  }
  if (focus.kind === 'ELITE_PROSPECT') return t('market.focusEliteProspect');
  return t('market.focusRumoredHero');
}

function focusDetail(focus: ScoutFocus, t: CopyFn): string {
  if (focus.kind === 'POSITION') return t('market.focusPositionDetail', { role: focus.role });
  if (focus.kind === 'AGE') return t('market.focusAgeDetail');
  if (focus.kind === 'ELITE_PROSPECT') return t('market.focusEliteDetail');
  return t('market.focusHeroDetail');
}

function regionLabel(region: ScoutRegion): string {
  return readableId(region);
}

/** Formation unlocks keep their shape ("4-3-3"); other unlocks read as words. */
function unlockName(unlockId: string): string {
  const formation = /^formation[-_:]?(.+)$/i.exec(unlockId);
  return formation === null ? readableId(unlockId) : formation[1];
}

function readableId(value: string): string {
  return value
    .replace(/^formation[-_:]?/i, '')
    .replace(/^drill[-_:]?/i, '')
    .split(/[_-]/g)
    .filter(Boolean)
    .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');
}

function formatMoney(value: number): string {
  // Sign before the symbol, matching the other money formatters: the naive
  // form rendered a negative as "$-1,000".
  const sign = value < 0 ? '-' : '';
  const digits = String(Math.abs(Math.trunc(value)));
  return `${sign}$${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
