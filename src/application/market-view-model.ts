import {
  buyingTransferQuote,
  isCoachCandidateEligible,
  isTransferWindowOpen,
  scoutMissionCost,
  sellingTransferQuote,
  type CoachCandidate,
  type ContractNegotiation,
  type ScoutFocus,
  type ScoutMission,
  type ScoutMissionResult,
  type ScoutRegion,
  type TransferQuote,
  type ValuationPlayer,
} from '../game/market';
import { divisionTierLabel, type DivisionLevel } from '../game/pyramid';
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
    };
    readonly signingBonus: number;
  }[];
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
  readonly activeScoutMission?: ScoutMission;
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

const PERKS: readonly ContractPerkViewModel[] = [
  { id: 'GUARANTEED_STARTER', label: 'Starter', detail: 'A place in the first XI.' },
  { id: 'CAPTAINCY', label: 'Captaincy', detail: 'The armband and the room.' },
  { id: 'TRAINING_PRIORITY', label: 'Training', detail: 'First call on focus drills.' },
  { id: 'JERSEY_10', label: 'Shirt #10', detail: 'The famous number.' },
];

const CARD_COPY: Readonly<Record<string, { label: string; detail: string }>> = {
  FLATTERY: { label: 'Flattery', detail: 'Tell them the terrace already sings their name.' },
  TROPHY_PROMISE: { label: 'Trophy promise', detail: 'Sell the silverware dream.' },
  HOMETOWN_TIES: { label: 'Hometown ties', detail: 'This club can feel like home.' },
  MONEY_TALKS: { label: 'Money talks', detail: 'Keep it brisk and businesslike.' },
  STRAIGHT_TALK: { label: 'Straight talk', detail: 'No theatre. Say exactly what you mean.' },
};

export function marketViewModel(source: MarketViewModelSource): MarketViewModel {
  const transferWindowOpen = isTransferWindowOpen(source.week);
  const unlockedSections = source.unlockedSections ?? ['YOUTH', 'SCOUT', 'TRANSFERS', 'COACHES'];
  const identities = new Map(
    (source.scoutedPlayerIdentities ?? []).map(player => [player.id, player]),
  );

  return {
    sections: [...unlockedSections],
    periodLabel: `S${source.season} · W${source.week}`,
    divisionLabel: divisionTierLabel(source.division),
    cash: source.cash,
    window: {
      open: transferWindowOpen,
      label: transferWindowOpen ? 'Window open' : 'Window closed',
      detail: transferWindowOpen
        ? 'Deals may be registered this week.'
        : 'Scout and plan now. Registrations reopen in pre-season or weeks 17-18.',
    },
    scouting: {
      officeLabel: `Scout Office · Lv${source.scoutOfficeLevel}`,
      precisionLabel: source.scoutOfficeLevel === 1
        ? 'Broad estimates'
        : source.scoutOfficeLevel === 2
          ? 'Improved estimates'
          : 'Sharp estimates · powers confirmed',
      status: scoutingStatus(source),
      choices: source.scoutOptions.map(option => scoutingChoice(source, option)),
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
          ageLabel: `Age ${report.age}`,
          ...(report.power === undefined
            ? {}
            : { powerLabel: identity?.powerName ?? readableId(report.power) }),
          ...(report.rumoredHeroLead === true && report.power === undefined
            ? { rumorLabel: 'The hero rumor looks real' }
            : {}),
          stats: stats.map(attribute => ({
            label: attribute.toUpperCase(),
            rangeLabel: `${report.statRanges[attribute].minimum}-${report.statRanges[attribute].maximum}`,
          })),
        } satisfies ScoutReportViewModel;
      }),
    },
    transfers: source.transferListings.map(listing => transferListing(source, listing, transferWindowOpen)),
    coaches: source.coachCandidates.slice(0, 3).map(candidate => {
      const eligible = isCoachCandidateEligible(
        candidate,
        source.highestDivisionReached ?? source.division,
        source.fame,
      );
      const affordable = source.cash >= candidate.weeklyWage;
      const headCoachId = source.headCoachId ?? source.headCoach?.id;
      const legacySingleHeadSource = source.headCoach !== undefined && source.headCoachId === undefined;
      const alreadyOnStaff = candidate.id === headCoachId || candidate.id === source.assistantCoachId;
      const assistantSlotUnlocked = source.assistantSlotUnlocked === true;
      const generallyAvailable = eligible && affordable && !alreadyOnStaff;
      const headAvailable = generallyAvailable && headCoachId === undefined;
      const assistantAvailable = generallyAvailable
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
        headEffectLabels: coachRoleEffectLabels(candidate, 'HEAD'),
        assistantEffectLabels: coachRoleEffectLabels(candidate, 'ASSISTANT'),
        personalityLabel: readableId(candidate.personality),
        weeklyWage: candidate.weeklyWage,
        retiredLegend: candidate.retiredLegendPlayerId !== undefined,
        ...(candidate.loyaltyDiscountPercent > 0
          ? { loyaltyLabel: `${candidate.loyaltyDiscountPercent}% loyalty discount` }
          : {}),
        ...(candidate.unlockId === undefined
          ? {}
          : { unlockLabel: `Teaches ${unlockName(candidate.unlockId)}` }),
        available: headAvailable || assistantAvailable,
        headAvailable,
        assistantAvailable,
        assistantSlotUnlocked,
        ...(candidate.id === headCoachId
          ? { currentRole: 'Head coach' as const }
          : candidate.id === source.assistantCoachId
            ? { currentRole: 'Assistant' as const }
            : {}),
        ...(legacySingleHeadSource
          ? { blockedReason: `Dismiss ${source.headCoach?.name ?? 'the current coach'} first.` }
          : alreadyOnStaff
          ? { blockedReason: 'Already on the coaching staff.' }
          : !eligible
            ? { blockedReason: 'Raise division and fame to make contact.' }
            : !affordable
              ? { blockedReason: 'Cannot cover the first weekly wage.' }
              : headAvailable || assistantAvailable
                ? {}
                : headCoachId !== undefined && !assistantSlotUnlocked
                  ? { blockedReason: `Dismiss ${source.headCoach?.name ?? 'the current coach'} first.` }
                  : { blockedReason: 'Both coaching roles are already filled.' }),
      };
    }),
    ...(source.youthIntake === undefined || !unlockedSections.includes('YOUTH')
      ? {}
      : { youth: youthIntakeViewModel(source.youthIntake, source.cash) }),
    ...(source.negotiation === undefined
      ? {}
      : { negotiation: marketNegotiationViewModel(source.negotiation) }),
  };
}

function youthIntakeViewModel(
  intake: YouthIntakeViewSource,
  cash: number,
): YouthIntakeViewModel {
  const hasRosterSpace = intake.rosterCount < intake.rosterCapacity;
  const isOpen = intake.status === 'OPEN';
  return {
    status: intake.status,
    headline: isOpen
      ? 'Academy prospects have arrived'
      : intake.declined
        ? 'This intake was declined'
        : 'This intake is closed',
    detail: isOpen
      ? 'Offers remain on the desk through pre-season. Make roster space before signing if needed.'
      : 'The academy will bring a fresh group next season.',
    rosterLabel: `${intake.rosterCount}/${intake.rosterCapacity} rostered`,
    offers: intake.offers.map(offer => {
      const affordable = cash >= offer.signingBonus;
      return {
        playerId: offer.player.id,
        playerName: offer.player.name,
        role: offer.player.role,
        lookId: offer.player.lookId,
        ageLabel: `Age ${offer.player.age}`,
        archetypeLabel: offer.player.archetype,
        signingBonus: offer.signingBonus,
        weeklyWage: offer.player.weeklyWage,
        available: isOpen && hasRosterSpace && affordable,
        ...(!hasRosterSpace
          ? { blockedReason: `Roster full · sell or release a player first.` }
          : !affordable
            ? { blockedReason: 'Cannot afford the signing bonus.' }
            : !isOpen
              ? { blockedReason: 'This intake is closed.' }
              : {}),
      };
    }),
    canDecline: isOpen && intake.offers.length > 0,
  };
}

function scoutingStatus(source: MarketViewModelSource): MarketViewModel['scouting']['status'] {
  if (source.scoutResult !== undefined) {
    return {
      kind: 'COMPLETED',
      headline: `${source.scoutResult.reports.length} reports on the desk`,
      detail: 'Open a scouting report to compare the estimated ability with the transfer price.',
      progressLabel: 'Complete',
    };
  }
  const mission = source.activeScoutMission;
  if (mission === undefined) {
    return {
      kind: 'IDLE',
      headline: 'The scout is waiting',
      detail: 'Choose one region and one brief. Reports take two or three weeks.',
      progressLabel: 'Ready',
    };
  }
  const weeksRemaining = Math.max(0, mission.dueWeek - source.currentCareerWeek);
  if (weeksRemaining === 0) {
    return {
      kind: 'READY',
      headline: 'The scout is back',
      detail: 'Finish this week to receive the new scouting reports.',
      progressLabel: 'Report due',
    };
  }
  return {
    kind: 'IN_PROGRESS',
    headline: `${regionLabel(mission.region)} trip in progress`,
    detail: `${focusLabel(mission.focus)} brief · paid ${formatMoney(mission.cost)}.`,
    progressLabel: `${weeksRemaining} week${weeksRemaining === 1 ? '' : 's'} left`,
  };
}

function scoutingChoice(
  source: MarketViewModelSource,
  option: ScoutMissionOptionSource,
): ScoutMissionChoiceViewModel {
  const cost = scoutMissionCost(option.region, option.focus);
  const progressionDivision = source.highestDivisionReached ?? source.division;
  const heroLocked = option.focus.kind === 'RUMORED_HERO' && progressionDivision > 3;
  const eliteLocked = option.focus.kind === 'ELITE_PROSPECT' && progressionDivision > 2;
  const busy = source.activeScoutMission !== undefined;
  const affordable = source.cash >= cost;
  return {
    id: option.id,
    regionLabel: option.regionLabel ?? regionLabel(option.region),
    focusLabel: focusLabel(option.focus),
    detail: option.detail ?? focusDetail(option.focus),
    cost,
    durationLabel: '2-3 weeks',
    available: !busy && !heroLocked && !eliteLocked && affordable,
    ...(busy
      ? { blockedReason: 'Scout Sent' }
      : heroLocked
        ? { blockedReason: `Rumored heroes unlock in ${divisionTierLabel(3)}.` }
        : eliteLocked
          ? { blockedReason: `Elite prospects unlock in ${divisionTierLabel(2)}.` }
        : !affordable
          ? { blockedReason: 'Not enough money.' }
          : {}),
  };
}

function transferListing(
  source: MarketViewModelSource,
  listing: TransferListingSource,
  windowOpen: boolean,
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
    direction: listing.direction,
    ...(listing.player.powerName === undefined ? {} : { powerLabel: listing.player.powerName }),
    valuation: quote.valuation,
    quote: quote.fee,
    quoteLabel: listing.direction === 'BUY' ? 'Club asking' : 'Best bid',
    actionLabel: listing.direction === 'BUY'
      ? 'Open talks'
      : listing.listed === true
        ? 'Accept bid'
        : 'List player',
    listed: listing.listed === true,
    bids: (listing.bids ?? []).map(bid => ({
      id: bid.id,
      buyerName: bid.buyerName,
      fee: bid.quote.fee,
    })),
    available: windowOpen && affordable,
    ...(!windowOpen
      ? { blockedReason: 'Registration window closed.' }
      : !affordable
        ? { blockedReason: 'Transfer fee exceeds current cash.' }
        : {}),
  };
}

export function marketNegotiationViewModel(
  source: NegotiationViewSource,
): MarketNegotiationViewModel {
  const negotiation = source.state;
  const previousOffer = negotiation.history.at(-1)?.offer.weeklyWage;
  const mood = moodPresentation(negotiation.mood);
  const wageStep = source.wageStep ?? 50;
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
      ? `Round ${negotiation.round + 1} of 3`
      : negotiation.status === 'ACCEPTED'
        ? 'Deal agreed'
        : 'Talks ended',
    pitchLeverageLabel: leverage < 0
      ? `Pitch lowers wage demand by ${Math.abs(leverage)}%`
      : leverage > 0
        ? `Pitch raises wage demand by ${leverage}%`
        : 'Pitch does not change wage demand',
    cards: negotiation.pitchCards.map(card => ({
      id: card,
      label: CARD_COPY[card].label,
      detail: CARD_COPY[card].detail,
      used: negotiation.usedPitchCards.includes(card),
    } satisfies PitchCardViewModel)),
    perks: PERKS,
    initialWeeklyWage: previousOffer ?? source.openingWeeklyWage,
    wageStep,
    ...(lastOutcome === undefined
      ? {}
      : { lastOutcomeLabel: outcomeLabel(lastOutcome) }),
  };
}

function moodPresentation(mood: ContractNegotiation['mood']): { face: string; label: string } {
  if (mood === 'ANGRY') return { face: 'ಠ_ಠ', label: 'Angry' };
  if (mood === 'UNHAPPY') return { face: '>_<', label: 'Unhappy' };
  if (mood === 'PLEASED') return { face: '^_^', label: 'Pleased' };
  if (mood === 'THRILLED') return { face: '★_★', label: 'Thrilled' };
  return { face: '•_•', label: 'Listening' };
}

function outcomeLabel(outcome: ContractNegotiation['history'][number]['outcome']): string {
  if (outcome === 'ACCEPTED') return 'The agent shakes your hand.';
  if (outcome === 'INSULTED') return 'The offer caused offence. Talks are over.';
  if (outcome === 'WALKED_AWAY') return 'Three rounds passed. The agent walked.';
  return 'Not enough yet. The agent is waiting for a better offer.';
}

function focusLabel(focus: ScoutFocus): string {
  if (focus.kind === 'POSITION') return `${focus.role} search`;
  if (focus.kind === 'AGE') return `Age ${focus.minimumAge}-${focus.maximumAge}`;
  if (focus.kind === 'ELITE_PROSPECT') return 'Elite prospect';
  return 'Rumored hero';
}

function focusDetail(focus: ScoutFocus): string {
  if (focus.kind === 'POSITION') return `Look only for players who can fill ${focus.role}.`;
  if (focus.kind === 'AGE') return 'Hunt within a specific point of the age curve.';
  if (focus.kind === 'ELITE_PROSPECT') return 'Target young players with four- or five-star potential.';
  return 'Expensive and usually wrong—but the rare hit arrives powered.';
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
  return `$${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
