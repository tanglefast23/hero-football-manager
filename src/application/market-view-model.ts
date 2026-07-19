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
  type ValuationPlayer,
} from '../game/market';
import type {
  ContractPerkViewModel,
  MarketNegotiationViewModel,
  MarketViewModel,
  PitchCardViewModel,
  ScoutMissionChoiceViewModel,
  ScoutReportViewModel,
  TransferListingViewModel,
  YouthIntakeViewModel,
} from '../ui/market-models';

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
  readonly powerName?: string;
}

export interface TransferListingSource {
  readonly player: ValuationPlayer & {
    readonly name: string;
    readonly powerName?: string;
  };
  readonly direction: 'BUY' | 'SELL';
  readonly sellingClubDivision: number;
}

export interface NegotiationViewSource {
  readonly state: ContractNegotiation;
  readonly playerName: string;
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
  readonly division: number;
  readonly fame: number;
  readonly cash: number;
  readonly scoutOfficeLevel: number;
  readonly scoutOptions: readonly ScoutMissionOptionSource[];
  readonly activeScoutMission?: ScoutMission;
  readonly scoutResult?: ScoutMissionResult;
  readonly scoutedPlayerIdentities?: readonly ScoutedPlayerIdentitySource[];
  readonly transferListings: readonly TransferListingSource[];
  readonly coachCandidates: readonly CoachCandidate[];
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
  const identities = new Map(
    (source.scoutedPlayerIdentities ?? []).map(player => [player.id, player]),
  );

  return {
    periodLabel: `S${source.season} · W${source.week}`,
    divisionLabel: `Division ${source.division}`,
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
          ageLabel: `Age ${report.age}`,
          potentialLabel: starRange(report.potentialRange.minimum, report.potentialRange.maximum),
          ...(report.power === undefined
            ? {}
            : { powerLabel: identity?.powerName ?? readableId(report.power) }),
          stats: stats.map(attribute => ({
            label: attribute.toUpperCase(),
            rangeLabel: `${report.statRanges[attribute].minimum}-${report.statRanges[attribute].maximum}`,
          })),
        } satisfies ScoutReportViewModel;
      }),
    },
    transfers: source.transferListings.map(listing => transferListing(source, listing, transferWindowOpen)),
    coaches: source.coachCandidates.map(candidate => {
      const eligible = isCoachCandidateEligible(candidate, source.division, source.fame);
      const affordable = source.cash >= candidate.weeklyWage;
      return {
        id: candidate.id,
        name: candidate.name,
        level: candidate.level,
        levelLabel: `Lv${candidate.level}`,
        specialtyLabels: [
          readableId(candidate.specialties[0]),
          readableId(candidate.specialties[1]),
        ],
        personalityLabel: readableId(candidate.personality),
        weeklyWage: candidate.weeklyWage,
        retiredLegend: candidate.retiredLegendPlayerId !== undefined,
        ...(candidate.loyaltyDiscountPercent > 0
          ? { loyaltyLabel: `${candidate.loyaltyDiscountPercent}% loyalty discount` }
          : {}),
        ...(candidate.unlockId === undefined
          ? {}
          : { unlockLabel: `Teaches ${readableId(candidate.unlockId)}` }),
        available: eligible && affordable,
        ...(!eligible
          ? { blockedReason: 'Raise division and fame to make contact.' }
          : !affordable
            ? { blockedReason: 'Cannot cover the first weekly wage.' }
            : {}),
      };
    }),
    ...(source.youthIntake === undefined
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
        ageLabel: `Age ${offer.player.age}`,
        potentialLabel: `${'★'.repeat(offer.player.potential)}${'☆'.repeat(5 - offer.player.potential)} potential`,
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
      detail: 'Open a dossier to compare the scout ranges with the transfer quote.',
      progressLabel: 'Filed',
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
      detail: 'Resolve this week to place the new dossiers on the desk.',
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
  const heroLocked = option.focus.kind === 'RUMORED_HERO' && source.division > 3;
  const busy = source.activeScoutMission !== undefined;
  const affordable = source.cash >= cost;
  return {
    id: option.id,
    regionLabel: option.regionLabel ?? regionLabel(option.region),
    focusLabel: focusLabel(option.focus),
    detail: option.detail ?? focusDetail(option.focus),
    cost,
    durationLabel: '2-3 weeks',
    available: !busy && !heroLocked && affordable,
    ...(busy
      ? { blockedReason: 'Scout already away.' }
      : heroLocked
        ? { blockedReason: 'Rumored heroes unlock in Division 3.' }
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
  const quote = listing.direction === 'BUY'
    ? buyingTransferQuote(listing.player, context)
    : sellingTransferQuote(listing.player, context);
  const affordable = listing.direction === 'SELL' || source.cash >= quote.fee;
  return {
    playerId: listing.player.id,
    playerName: listing.player.name,
    role: listing.player.role,
    age: listing.player.age,
    direction: listing.direction,
    ...(listing.player.powerName === undefined ? {} : { powerLabel: listing.player.powerName }),
    valuation: quote.valuation,
    quote: quote.fee,
    quoteLabel: listing.direction === 'BUY' ? 'Club asking' : 'Best bid',
    actionLabel: listing.direction === 'BUY' ? 'Open talks' : 'Accept bid',
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
      ? `Pitch helping · ${Math.abs(leverage)}%`
      : leverage > 0
        ? `Agent resistance · ${leverage}%`
        : 'Pitch neutral · 0%',
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
  return 'Rumored hero';
}

function focusDetail(focus: ScoutFocus): string {
  if (focus.kind === 'POSITION') return `Look only for players who can fill ${focus.role}.`;
  if (focus.kind === 'AGE') return 'Hunt within a specific point of the age curve.';
  return 'Expensive and usually wrong—but the rare hit arrives powered.';
}

function regionLabel(region: ScoutRegion): string {
  return readableId(region);
}

function starRange(minimum: number, maximum: number): string {
  return minimum === maximum ? `${minimum}★ potential` : `${minimum}-${maximum}★ potential`;
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
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
