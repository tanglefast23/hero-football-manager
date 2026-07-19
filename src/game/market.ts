import { mulberry32 } from '../sim/rng';
import type { Attrs, PowerId, Role } from '../sim/types';

const UINT32_MAX = 4294967295;
const ATTR_NAMES = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'] as const;
const OUT_FIELD_ATTRS = ['pac', 'sho', 'pas', 'def', 'tec', 'sta'] as const;
const GOALKEEPER_ATTRS = ['pac', 'pas', 'def', 'tec', 'sta', 'ref'] as const;

export type PlayerPersonality =
  | 'FIERY'
  | 'LOYAL'
  | 'GREEDY'
  | 'JOKER'
  | 'PROFESSIONAL'
  | 'TIMID';

export type ScoutRegion = 'LOCAL' | 'EUROPE' | 'SOUTH_AMERICA' | 'AFRICA' | 'ASIA';

export type ScoutFocus =
  | { kind: 'POSITION'; role: Role }
  | { kind: 'AGE'; minimumAge: number; maximumAge: number }
  | { kind: 'RUMORED_HERO' };

export interface ScoutablePlayer {
  readonly id: string;
  readonly region: ScoutRegion;
  readonly role: Role;
  readonly age: number;
  readonly attrs: Readonly<Attrs>;
  readonly potential: number;
  readonly personality: PlayerPersonality;
  readonly power?: PowerId;
  readonly powerTier?: number;
  readonly contractSeasonsRemaining: number;
}

export interface ScoutMissionSetup {
  readonly careerSeed: number;
  readonly missionId: string;
  /** Monotonic career week, rather than the displayed 1-30 season week. */
  readonly startWeek: number;
  readonly region: ScoutRegion;
  readonly focus: ScoutFocus;
  readonly scoutOfficeLevel: number;
  readonly division: number;
}

export interface ScoutMission {
  readonly id: string;
  readonly missionSeed: number;
  readonly startWeek: number;
  readonly dueWeek: number;
  readonly cost: number;
  readonly region: ScoutRegion;
  readonly focus: ScoutFocus;
  readonly scoutOfficeLevel: number;
}

export interface ScoutedRange {
  readonly minimum: number;
  readonly maximum: number;
}

export type ScoutedAttributeRanges = {
  readonly [Attribute in keyof Attrs]: ScoutedRange;
};

export interface ScoutReport {
  readonly playerId: string;
  readonly role: Role;
  readonly age: number;
  readonly statRanges: ScoutedAttributeRanges;
  readonly potentialRange: ScoutedRange;
  /** Level 3 reports confirm a power; lower-level reports leave it unknown. */
  readonly power?: PowerId;
}

export interface ScoutMissionResult {
  readonly missionId: string;
  readonly completedWeek: number;
  readonly reports: ScoutReport[];
}

const REGION_COST: Readonly<Record<ScoutRegion, number>> = {
  LOCAL: 1000,
  EUROPE: 1800,
  SOUTH_AMERICA: 2500,
  AFRICA: 2200,
  ASIA: 2000,
};

export function scoutMissionCost(region: ScoutRegion, focus: ScoutFocus): number {
  validateScoutFocus(focus);
  const regionCost = REGION_COST[region];
  if (regionCost === undefined) throw new Error(`unknown scouting region ${String(region)}`);
  const focusCost = focus.kind === 'RUMORED_HERO' ? 2500 : focus.kind === 'AGE' ? 500 : 0;
  return Math.min(5000, regionCost + focusCost);
}

export function startScoutMission(setup: ScoutMissionSetup): ScoutMission {
  assertUint32(setup.careerSeed, 'scouting career seed');
  assertNonEmptyString(setup.missionId, 'scouting mission ID');
  assertPositiveSafeInteger(setup.startWeek, 'scouting start week');
  validateDivision(setup.division);
  validateScoutOfficeLevel(setup.scoutOfficeLevel);
  validateScoutFocus(setup.focus);
  if (REGION_COST[setup.region] === undefined) {
    throw new Error(`unknown scouting region ${String(setup.region)}`);
  }
  if (setup.focus.kind === 'RUMORED_HERO' && setup.division > 3) {
    throw new Error('rumored hero scouting unlocks in Division 3');
  }

  const missionSeed = mixSeed(
    setup.careerSeed,
    `${setup.missionId}:${setup.region}:${scoutFocusKey(setup.focus)}`,
  );
  const durationWeeks = 2 + deterministicRoll(missionSeed, 'duration', 2);

  return {
    id: setup.missionId,
    missionSeed,
    startWeek: setup.startWeek,
    dueWeek: checkedAdd(setup.startWeek, durationWeeks, 'scouting due week'),
    cost: scoutMissionCost(setup.region, setup.focus),
    region: setup.region,
    focus: { ...setup.focus },
    scoutOfficeLevel: setup.scoutOfficeLevel,
  };
}

export function resolveScoutMission(
  mission: ScoutMission,
  currentWeek: number,
  candidates: readonly ScoutablePlayer[],
  shortlistSize = 3,
): ScoutMissionResult {
  validateScoutMission(mission);
  assertPositiveSafeInteger(currentWeek, 'scouting resolution week');
  if (currentWeek < mission.dueWeek) throw new Error('scouting mission is not complete yet');
  if (!Number.isSafeInteger(shortlistSize) || shortlistSize < 1 || shortlistSize > 5) {
    throw new Error('scouting shortlist size must be an integer from 1 to 5');
  }
  assertUniqueStrings(candidates.map(candidate => candidate.id), 'scouting candidate ID');
  for (const candidate of candidates) validateScoutablePlayer(candidate);

  const eligible = candidates
    .filter(candidate => candidate.region === mission.region && matchesScoutFocus(candidate, mission.focus))
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id));
  const random = mulberry32(mixSeed(mission.missionSeed, 'shortlist'));
  shuffleInPlace(eligible, random);

  return {
    missionId: mission.id,
    completedWeek: currentWeek,
    reports: eligible.slice(0, shortlistSize).map(candidate => ({
      playerId: candidate.id,
      role: candidate.role,
      age: candidate.age,
      statRanges: scoutAttributeRanges(
        candidate.attrs,
        mission.scoutOfficeLevel,
        mixSeed(mission.missionSeed, candidate.id),
      ),
      potentialRange: scoutingRange(
        candidate.potential,
        mission.scoutOfficeLevel === 1 ? 2 : mission.scoutOfficeLevel === 2 ? 1 : 0,
        1,
        5,
        mixSeed(mission.missionSeed, `${candidate.id}:potential`),
      ),
      ...(mission.scoutOfficeLevel === 3 && candidate.power !== undefined
        ? { power: candidate.power }
        : {}),
    })),
  };
}

export function scoutAttributeRanges(
  attrs: Readonly<Attrs>,
  scoutOfficeLevel: number,
  rangeSeed: number,
): ScoutedAttributeRanges {
  validateAttrs(attrs, 'scouted player');
  validateScoutOfficeLevel(scoutOfficeLevel);
  assertUint32(rangeSeed, 'scouting range seed');
  const span = scoutOfficeLevel === 1 ? 30 : scoutOfficeLevel === 2 ? 18 : 8;

  return {
    pac: scoutingRange(attrs.pac, span, 1, 99, mixSeed(rangeSeed, 'pac')),
    sho: scoutingRange(attrs.sho, span, 1, 99, mixSeed(rangeSeed, 'sho')),
    pas: scoutingRange(attrs.pas, span, 1, 99, mixSeed(rangeSeed, 'pas')),
    def: scoutingRange(attrs.def, span, 1, 99, mixSeed(rangeSeed, 'def')),
    tec: scoutingRange(attrs.tec, span, 1, 99, mixSeed(rangeSeed, 'tec')),
    sta: scoutingRange(attrs.sta, span, 1, 99, mixSeed(rangeSeed, 'sta')),
    ref: scoutingRange(attrs.ref, span, 1, 99, mixSeed(rangeSeed, 'ref')),
  };
}

/** Pre-season is weeks 1-4; the two-week mid-season window is weeks 17-18. */
export function isTransferWindowOpen(week: number): boolean {
  if (!Number.isSafeInteger(week) || week < 1 || week > 30) return false;
  return week <= 4 || (week >= 17 && week <= 18);
}

export interface ValuationPlayer {
  readonly id: string;
  readonly role: Role;
  readonly attrs: Readonly<Attrs>;
  readonly age: number;
  readonly potential: number;
  readonly power?: PowerId;
  readonly powerTier?: number;
  readonly contractSeasonsRemaining: number;
}

export interface TransferQuoteContext {
  readonly careerSeed: number;
  readonly season: number;
  readonly week: number;
  readonly sellingClubDivision: number;
}

export interface TransferQuote {
  readonly playerId: string;
  readonly valuation: number;
  readonly fee: number;
  readonly bandPercent: number;
}

/**
 * Whole-money valuation. Six role-relevant stats set the base, then age,
 * potential, power tier, contract control, and the selling division adjust it.
 */
export function playerValuation(player: ValuationPlayer, sellingClubDivision: number): number {
  validateValuationPlayer(player);
  validateDivision(sellingClubDivision);
  const attributes = player.role === 'GK' ? GOALKEEPER_ATTRS : OUT_FIELD_ATTRS;
  const total = attributes.reduce((sum, attribute) => sum + player.attrs[attribute], 0);
  let value = Math.max(1000, (total - 180) * 80);
  value = scaleByPercent(value, ageValuePercent(player.age), 'age-adjusted player valuation');
  value = scaleByPercent(
    value,
    [0, 80, 90, 100, 120, 145][player.potential],
    'potential-adjusted player valuation',
  );
  if (player.power !== undefined) {
    value = scaleByPercent(
      value,
      [0, 400, 600, 800][player.powerTier ?? 1],
      'power-adjusted player valuation',
    );
  }
  value = scaleByPercent(
    value,
    [60, 85, 100, 115][player.contractSeasonsRemaining],
    'contract-adjusted player valuation',
  );
  value = scaleByPercent(
    value,
    [0, 130, 115, 100, 90, 80][sellingClubDivision],
    'division-adjusted player valuation',
  );
  return Math.max(500, value);
}

/** Asking club quote: 105-125% of deterministic market value. */
export function buyingTransferQuote(
  player: ValuationPlayer,
  context: TransferQuoteContext,
): TransferQuote {
  return transferQuote(player, context, 'BUYING', 105, 21);
}

/** AI bid for a listed player: 80-110% of deterministic market value. */
export function sellingTransferQuote(
  player: ValuationPlayer,
  context: TransferQuoteContext,
): TransferQuote {
  return transferQuote(player, context, 'SELLING', 80, 31);
}

export type ContractPerk =
  | 'GUARANTEED_STARTER'
  | 'CAPTAINCY'
  | 'TRAINING_PRIORITY'
  | 'JERSEY_10';

export type PitchCard =
  | 'FLATTERY'
  | 'TROPHY_PROMISE'
  | 'HOMETOWN_TIES'
  | 'MONEY_TALKS'
  | 'STRAIGHT_TALK';

export type NegotiationMood = 'ANGRY' | 'UNHAPPY' | 'NEUTRAL' | 'PLEASED' | 'THRILLED';
export type NegotiationStatus = 'OPEN' | 'ACCEPTED' | 'REJECTED';

export interface ContractOffer {
  readonly weeklyWage: number;
  readonly termSeasons: number;
  readonly perk: ContractPerk;
}

export interface ContractNegotiationSetup {
  readonly careerSeed: number;
  readonly negotiationId: string;
  readonly playerId: string;
  readonly personality: PlayerPersonality;
  readonly weeklyAsk: number;
}

export interface ContractRoundRecord {
  readonly round: number;
  readonly offer: ContractOffer;
  readonly pitchCard?: PitchCard;
  readonly cardAffinity: -1 | 0 | 1;
  readonly effectiveAsk: number;
  readonly effectiveOffer: number;
  readonly mood: NegotiationMood;
  readonly outcome: 'COUNTER' | 'ACCEPTED' | 'INSULTED' | 'WALKED_AWAY';
}

export interface NegotiationConsequence {
  readonly moraleDelta: number;
  readonly clubFameDelta: number;
}

export interface ContractNegotiation {
  readonly id: string;
  readonly playerId: string;
  readonly personality: PlayerPersonality;
  readonly weeklyAsk: number;
  readonly round: number;
  readonly mood: NegotiationMood;
  readonly pitchInfluencePercent: number;
  readonly pitchCards: PitchCard[];
  readonly usedPitchCards: PitchCard[];
  readonly status: NegotiationStatus;
  readonly history: ContractRoundRecord[];
  readonly acceptedOffer?: ContractOffer;
  readonly consequence?: NegotiationConsequence;
}

export interface RenewalAskPlayer {
  readonly weeklyWage: number;
  readonly personality: PlayerPersonality;
  readonly power?: PowerId;
  readonly onHeroWage: boolean;
}

export interface RenewalAskFactors {
  readonly growthSinceSigningPercent: number;
  readonly famePercent: number;
  readonly heroMultiplier: number;
}

const PITCH_CARDS: readonly PitchCard[] = [
  'FLATTERY',
  'TROPHY_PROMISE',
  'HOMETOWN_TIES',
  'MONEY_TALKS',
  'STRAIGHT_TALK',
];

const LOVED_PITCHES: Readonly<Record<PlayerPersonality, readonly PitchCard[]>> = {
  FIERY: ['TROPHY_PROMISE', 'STRAIGHT_TALK'],
  LOYAL: ['HOMETOWN_TIES', 'FLATTERY'],
  GREEDY: ['MONEY_TALKS', 'TROPHY_PROMISE'],
  JOKER: ['FLATTERY', 'HOMETOWN_TIES'],
  PROFESSIONAL: ['STRAIGHT_TALK', 'TROPHY_PROMISE'],
  TIMID: ['HOMETOWN_TIES', 'STRAIGHT_TALK'],
};

const HATED_PITCHES: Readonly<Record<PlayerPersonality, PitchCard>> = {
  FIERY: 'HOMETOWN_TIES',
  LOYAL: 'MONEY_TALKS',
  GREEDY: 'HOMETOWN_TIES',
  JOKER: 'STRAIGHT_TALK',
  PROFESSIONAL: 'FLATTERY',
  TIMID: 'TROPHY_PROMISE',
};

export function renewalContractAsk(
  player: RenewalAskPlayer,
  factors: RenewalAskFactors,
): number {
  assertPositiveSafeInteger(player.weeklyWage, 'current weekly wage');
  validatePersonality(player.personality);
  assertPercent(factors.growthSinceSigningPercent, 'growth since signing', 300);
  assertPercent(factors.famePercent, 'renewal fame factor', 200);
  if (!Number.isFinite(factors.heroMultiplier)
    || factors.heroMultiplier < 3
    || factors.heroMultiplier > 5) {
    throw new Error('hero wage multiplier must be from 3 to 5');
  }

  let ask = scaleByPercent(
    player.weeklyWage,
    100 + factors.growthSinceSigningPercent,
    'growth-adjusted renewal ask',
  );
  ask = scaleByPercent(ask, 100 + factors.famePercent, 'fame-adjusted renewal ask');
  ask = scaleByPercent(
    ask,
    player.personality === 'GREEDY' ? 120 : player.personality === 'LOYAL' ? 90 : 100,
    'personality-adjusted renewal ask',
  );
  if (player.power !== undefined && !player.onHeroWage) {
    ask = checkedRound(ask * factors.heroMultiplier, 'hero renewal ask');
  }
  return ask;
}

export function dealPitchCards(careerSeed: number, negotiationId: string): PitchCard[] {
  assertUint32(careerSeed, 'negotiation career seed');
  assertNonEmptyString(negotiationId, 'negotiation ID');
  const cards = PITCH_CARDS.slice();
  shuffleInPlace(cards, mulberry32(mixSeed(careerSeed, `pitch:${negotiationId}`)));
  return cards.slice(0, 3);
}

export function startContractNegotiation(
  setup: ContractNegotiationSetup,
): ContractNegotiation {
  assertUint32(setup.careerSeed, 'negotiation career seed');
  assertNonEmptyString(setup.negotiationId, 'negotiation ID');
  assertNonEmptyString(setup.playerId, 'negotiation player ID');
  validatePersonality(setup.personality);
  assertPositiveSafeInteger(setup.weeklyAsk, 'weekly contract ask');

  return {
    id: setup.negotiationId,
    playerId: setup.playerId,
    personality: setup.personality,
    weeklyAsk: setup.weeklyAsk,
    round: 0,
    mood: 'NEUTRAL',
    pitchInfluencePercent: 0,
    pitchCards: dealPitchCards(setup.careerSeed, setup.negotiationId),
    usedPitchCards: [],
    status: 'OPEN',
    history: [],
  };
}

/** Positive affinity means a personality likes the card; negative means it backfires. */
export function pitchCardAffinity(
  personality: PlayerPersonality,
  pitchCard: PitchCard,
): -1 | 0 | 1 {
  validatePersonality(personality);
  validatePitchCard(pitchCard);
  if (LOVED_PITCHES[personality].includes(pitchCard)) return 1;
  return HATED_PITCHES[personality] === pitchCard ? -1 : 0;
}

/** Pitch influence is clamped here so even restored or migrated state cannot exceed +/-20%. */
export function effectiveContractAsk(weeklyAsk: number, pitchInfluencePercent: number): number {
  assertPositiveSafeInteger(weeklyAsk, 'weekly contract ask');
  if (!Number.isSafeInteger(pitchInfluencePercent)) {
    throw new Error('pitch influence must be a safe integer percent');
  }
  const capped = Math.max(-20, Math.min(20, pitchInfluencePercent));
  return scaleByPercent(weeklyAsk, 100 + capped, 'pitch-adjusted contract ask');
}

export function contractOfferValue(offer: ContractOffer): number {
  validateContractOffer(offer);
  const termPercent = (offer.termSeasons - 1) * 3;
  const perkPercent = offer.perk === 'GUARANTEED_STARTER'
    ? 10
    : offer.perk === 'CAPTAINCY'
      ? 8
      : offer.perk === 'TRAINING_PRIORITY'
        ? 6
        : 4;
  return scaleByPercent(
    offer.weeklyWage,
    100 + termPercent + perkPercent,
    'effective contract offer',
  );
}

export function submitContractOffer(
  negotiation: ContractNegotiation,
  offer: ContractOffer,
  pitchCard?: PitchCard,
): ContractNegotiation {
  validateNegotiation(negotiation);
  validateContractOffer(offer);
  if (negotiation.status !== 'OPEN') throw new Error('contract talks have already ended');
  if (negotiation.round >= 3) throw new Error('contract talks allow at most 3 rounds');
  if (pitchCard !== undefined) {
    validatePitchCard(pitchCard);
    if (!negotiation.pitchCards.includes(pitchCard)) {
      throw new Error('pitch card was not dealt for this negotiation');
    }
    if (negotiation.usedPitchCards.includes(pitchCard)) {
      throw new Error('pitch cards may be played only once');
    }
  }

  const affinity = pitchCard === undefined
    ? 0
    : pitchCardAffinity(negotiation.personality, pitchCard);
  const pitchDelta = affinity === 1 ? -10 : affinity === -1 ? 10 : 0;
  const pitchInfluencePercent = Math.max(
    -20,
    Math.min(20, negotiation.pitchInfluencePercent + pitchDelta),
  );
  const effectiveAsk = effectiveContractAsk(negotiation.weeklyAsk, pitchInfluencePercent);
  const effectiveOffer = contractOfferValue(offer);
  const round = negotiation.round + 1;
  const insulting = offer.weeklyWage < negotiation.weeklyAsk / 2;
  const accepted = !insulting && effectiveOffer >= effectiveAsk;
  const finalRejection = !insulting && !accepted && round === 3;
  const outcome: ContractRoundRecord['outcome'] = insulting
    ? 'INSULTED'
    : accepted
      ? 'ACCEPTED'
      : finalRejection
        ? 'WALKED_AWAY'
        : 'COUNTER';
  const mood = insulting
    ? 'ANGRY'
    : shiftMood(moodForOffer(effectiveOffer, effectiveAsk), affinity);
  const record: ContractRoundRecord = {
    round,
    offer: { ...offer },
    ...(pitchCard === undefined ? {} : { pitchCard }),
    cardAffinity: affinity,
    effectiveAsk,
    effectiveOffer,
    mood,
    outcome,
  };
  const status: NegotiationStatus = accepted
    ? 'ACCEPTED'
    : insulting || finalRejection
      ? 'REJECTED'
      : 'OPEN';

  return {
    ...negotiation,
    round,
    mood,
    pitchInfluencePercent,
    usedPitchCards: pitchCard === undefined
      ? [...negotiation.usedPitchCards]
      : [...negotiation.usedPitchCards, pitchCard],
    status,
    history: [...negotiation.history, record],
    ...(accepted ? { acceptedOffer: { ...offer } } : {}),
    ...(insulting ? { consequence: { moraleDelta: -10, clubFameDelta: -2 } } : {}),
  };
}

export type CoachSpecialty =
  | 'ATTACK'
  | 'DEFENSE'
  | 'FITNESS'
  | 'TECHNIQUE'
  | 'GOALKEEPING'
  | 'MOTIVATOR';

export interface RetiredLegendCoachInput {
  readonly playerId: string;
  readonly name: string;
  readonly personality: PlayerPersonality;
  readonly fame: number;
  readonly seasonsAtClub: number;
  readonly specialties?: readonly [CoachSpecialty, CoachSpecialty];
}

export interface CoachCandidate {
  readonly id: string;
  readonly name: string;
  readonly specialties: readonly [CoachSpecialty, CoachSpecialty];
  readonly level: number;
  readonly weeklyWage: number;
  readonly personality: PlayerPersonality;
  readonly requiredDivision: number;
  readonly requiredFame: number;
  readonly loyaltyDiscountPercent: number;
  readonly unlockId?: string;
  readonly retiredLegendPlayerId?: string;
}

export interface CoachMarketSetup {
  readonly careerSeed: number;
  readonly season: number;
  readonly division: number;
  readonly fame: number;
  readonly retiredLegends?: readonly RetiredLegendCoachInput[];
  /** Content-owned formation/drill IDs may be supplied without importing content here. */
  readonly unlockIds?: readonly string[];
}

const COACH_SPECIALTIES: readonly CoachSpecialty[] = [
  'ATTACK',
  'DEFENSE',
  'FITNESS',
  'TECHNIQUE',
  'GOALKEEPING',
  'MOTIVATOR',
];

const PERSONALITIES: readonly PlayerPersonality[] = [
  'FIERY',
  'LOYAL',
  'GREEDY',
  'JOKER',
  'PROFESSIONAL',
  'TIMID',
];

const COACH_FAME_GATES = [0, 0, 100, 250, 500, 900] as const;

export function maxCoachLevelForClub(division: number, fame: number): number {
  validateDivision(division);
  assertNonNegativeSafeInteger(fame, 'club fame');
  const divisionLevel = 6 - division;
  let fameLevel = 1;
  for (let level = 2; level <= 5; level += 1) {
    if (fame >= COACH_FAME_GATES[level]) fameLevel = level;
  }
  return Math.min(divisionLevel, fameLevel);
}

export function generateCoachMarket(setup: CoachMarketSetup): CoachCandidate[] {
  assertUint32(setup.careerSeed, 'coach market career seed');
  assertPositiveSafeInteger(setup.season, 'coach market season');
  validateDivision(setup.division);
  assertNonNegativeSafeInteger(setup.fame, 'club fame');
  const unlockIds = setup.unlockIds ?? [];
  assertUniqueStrings(unlockIds, 'coach unlock ID');
  const legends = (setup.retiredLegends ?? []).slice().sort((left, right) =>
    left.playerId.localeCompare(right.playerId),
  );
  assertUniqueStrings(legends.map(legend => legend.playerId), 'retired legend player ID');
  for (const legend of legends) validateRetiredLegend(legend);

  const marketSeed = mixSeed(setup.careerSeed, `coach-market:${setup.season}`);
  const random = mulberry32(marketSeed);
  const targetCount = 3 + randomInteger(random, 3);
  const maxLevel = maxCoachLevelForClub(setup.division, setup.fame);
  const result: CoachCandidate[] = [];

  for (const legend of legends.slice(0, targetCount)) {
    const level = Math.min(5, maxLevel, 1 + Math.floor(legend.fame / 250));
    const specialties = legend.specialties === undefined
      ? pickCoachSpecialties(mulberry32(mixSeed(marketSeed, `legend:${legend.playerId}`)))
      : [legend.specialties[0], legend.specialties[1]] as const;
    const baseWage = checkedMultiply(500, level, 'legend coach wage');
    result.push({
      id: `legend-${legend.playerId}`,
      name: legend.name,
      specialties,
      level,
      weeklyWage: scaleByPercent(baseWage, 75, 'legend loyalty wage'),
      personality: legend.personality,
      requiredDivision: 6 - level,
      requiredFame: COACH_FAME_GATES[level],
      loyaltyDiscountPercent: 25,
      ...(unlockIds.length === 0
        ? {}
        : { unlockId: unlockIds[randomInteger(random, unlockIds.length)] }),
      retiredLegendPlayerId: legend.playerId,
    });
  }

  while (result.length < targetCount) {
    const genericIndex = result.length;
    const level = genericIndex === legends.length
      ? maxLevel
      : 1 + randomInteger(random, maxLevel);
    result.push({
      id: `coach-s${setup.season}-${genericIndex + 1}`,
      name: `Coach Prospect ${setup.season}-${genericIndex + 1}`,
      specialties: pickCoachSpecialties(random),
      level,
      weeklyWage: checkedMultiply(500, level, 'coach weekly wage'),
      personality: PERSONALITIES[randomInteger(random, PERSONALITIES.length)],
      requiredDivision: 6 - level,
      requiredFame: COACH_FAME_GATES[level],
      loyaltyDiscountPercent: 0,
      ...(unlockIds.length === 0
        ? {}
        : { unlockId: unlockIds[randomInteger(random, unlockIds.length)] }),
    });
  }
  return result;
}

export function isCoachCandidateEligible(
  candidate: CoachCandidate,
  division: number,
  fame: number,
): boolean {
  validateDivision(division);
  assertNonNegativeSafeInteger(fame, 'club fame');
  return division <= candidate.requiredDivision && fame >= candidate.requiredFame;
}

/** Coaches gain one level for every two full seasons employed, capped at level 5. */
export function coachLevelAfterSeasons(level: number, fullSeasonsEmployed: number): number {
  if (!Number.isSafeInteger(level) || level < 1 || level > 5) {
    throw new Error('coach level must be an integer from 1 to 5');
  }
  assertNonNegativeSafeInteger(fullSeasonsEmployed, 'full seasons employed');
  return Math.min(5, level + Math.floor(fullSeasonsEmployed / 2));
}

function transferQuote(
  player: ValuationPlayer,
  context: TransferQuoteContext,
  direction: 'BUYING' | 'SELLING',
  minimumPercent: number,
  bandSize: number,
): TransferQuote {
  validateTransferQuoteContext(context);
  const valuation = playerValuation(player, context.sellingClubDivision);
  const bandPercent = minimumPercent + deterministicRoll(
    context.careerSeed,
    `${direction}:${player.id}:${context.season}:${context.week}`,
    bandSize,
  );
  return {
    playerId: player.id,
    valuation,
    fee: scaleByPercent(valuation, bandPercent, 'transfer quote'),
    bandPercent,
  };
}

function matchesScoutFocus(candidate: ScoutablePlayer, focus: ScoutFocus): boolean {
  if (focus.kind === 'POSITION') return candidate.role === focus.role;
  if (focus.kind === 'AGE') {
    return candidate.age >= focus.minimumAge && candidate.age <= focus.maximumAge;
  }
  // A rumor mission searches the whole region. It does not manufacture a hero;
  // pre-powered finds remain rare because only real candidates can be reported.
  return true;
}

function scoutingRange(
  value: number,
  span: number,
  absoluteMinimum: number,
  absoluteMaximum: number,
  seed: number,
): ScoutedRange {
  if (span === 0) return { minimum: value, maximum: value };
  const minimumStart = Math.max(absoluteMinimum, value - span);
  const maximumStart = Math.min(value, absoluteMaximum - span);
  const start = minimumStart + deterministicRoll(
    seed,
    'range',
    maximumStart - minimumStart + 1,
  );
  return { minimum: start, maximum: start + span };
}

function ageValuePercent(age: number): number {
  if (age <= 19) return 85;
  if (age <= 23) return 105;
  if (age <= 29) return 120;
  if (age <= 32) return 90;
  if (age <= 35) return 65;
  return 40;
}

function moodForOffer(effectiveOffer: number, effectiveAsk: number): NegotiationMood {
  const ratioPercent = Math.floor(
    checkedMultiply(effectiveOffer, 100, 'contract offer ratio') / effectiveAsk,
  );
  if (ratioPercent < 50) return 'ANGRY';
  if (ratioPercent < 75) return 'UNHAPPY';
  if (ratioPercent < 100) return 'NEUTRAL';
  if (ratioPercent < 110) return 'PLEASED';
  return 'THRILLED';
}

function shiftMood(mood: NegotiationMood, steps: -1 | 0 | 1): NegotiationMood {
  const moods: readonly NegotiationMood[] = [
    'ANGRY',
    'UNHAPPY',
    'NEUTRAL',
    'PLEASED',
    'THRILLED',
  ];
  return moods[Math.max(0, Math.min(moods.length - 1, moods.indexOf(mood) + steps))];
}

function pickCoachSpecialties(
  random: () => number,
): readonly [CoachSpecialty, CoachSpecialty] {
  const specialties = COACH_SPECIALTIES.slice();
  shuffleInPlace(specialties, random);
  return [specialties[0], specialties[1]];
}

function validateScoutMission(mission: ScoutMission): void {
  assertNonEmptyString(mission.id, 'scouting mission ID');
  assertUint32(mission.missionSeed, 'scouting mission seed');
  assertPositiveSafeInteger(mission.startWeek, 'scouting start week');
  assertPositiveSafeInteger(mission.dueWeek, 'scouting due week');
  if (mission.dueWeek - mission.startWeek < 2 || mission.dueWeek - mission.startWeek > 3) {
    throw new Error('scouting missions must take 2 or 3 weeks');
  }
  assertPositiveSafeInteger(mission.cost, 'scouting mission cost');
  validateScoutOfficeLevel(mission.scoutOfficeLevel);
  validateScoutFocus(mission.focus);
}

function validateScoutFocus(focus: ScoutFocus): void {
  if (focus.kind === 'POSITION') {
    if (!['GK', 'DEF', 'MID', 'FWD'].includes(focus.role)) {
      throw new Error('scouting position focus has an unknown role');
    }
    return;
  }
  if (focus.kind === 'AGE') {
    if (!Number.isSafeInteger(focus.minimumAge)
      || !Number.isSafeInteger(focus.maximumAge)
      || focus.minimumAge < 16
      || focus.maximumAge > 45
      || focus.minimumAge > focus.maximumAge) {
      throw new Error('scouting age focus must be a valid range from 16 to 45');
    }
    return;
  }
  if (focus.kind !== 'RUMORED_HERO') throw new Error('unknown scouting focus');
}

function scoutFocusKey(focus: ScoutFocus): string {
  if (focus.kind === 'POSITION') return `${focus.kind}:${focus.role}`;
  if (focus.kind === 'AGE') return `${focus.kind}:${focus.minimumAge}-${focus.maximumAge}`;
  return focus.kind;
}

function validateScoutOfficeLevel(level: number): void {
  if (!Number.isSafeInteger(level) || level < 1 || level > 3) {
    throw new Error('Scout Office level must be an integer from 1 to 3');
  }
}

function validateScoutablePlayer(player: ScoutablePlayer): void {
  assertNonEmptyString(player.id, 'scouting candidate ID');
  if (REGION_COST[player.region] === undefined) throw new Error('scouting candidate region is unknown');
  validateAge(player.age);
  validateAttrs(player.attrs, `scouting candidate ${player.id}`);
  validatePotential(player.potential);
  validatePersonality(player.personality);
  if (player.powerTier !== undefined) validatePowerTier(player.powerTier);
  if (!Number.isSafeInteger(player.contractSeasonsRemaining)
    || player.contractSeasonsRemaining < 0
    || player.contractSeasonsRemaining > 3) {
    throw new Error('candidate contract seasons must be an integer from 0 to 3');
  }
}

function validateValuationPlayer(player: ValuationPlayer): void {
  assertNonEmptyString(player.id, 'valuation player ID');
  if (!['GK', 'DEF', 'MID', 'FWD'].includes(player.role)) {
    throw new Error('valuation player role is unknown');
  }
  validateAttrs(player.attrs, `valuation player ${player.id}`);
  validateAge(player.age);
  validatePotential(player.potential);
  if (player.powerTier !== undefined) validatePowerTier(player.powerTier);
  if (!Number.isSafeInteger(player.contractSeasonsRemaining)
    || player.contractSeasonsRemaining < 0
    || player.contractSeasonsRemaining > 3) {
    throw new Error('contract seasons remaining must be an integer from 0 to 3');
  }
}

function validateTransferQuoteContext(context: TransferQuoteContext): void {
  assertUint32(context.careerSeed, 'transfer quote career seed');
  assertPositiveSafeInteger(context.season, 'transfer quote season');
  if (!Number.isSafeInteger(context.week) || context.week < 1 || context.week > 30) {
    throw new Error('transfer quote week must be an integer from 1 to 30');
  }
  validateDivision(context.sellingClubDivision);
}

function validateContractOffer(offer: ContractOffer): void {
  assertPositiveSafeInteger(offer.weeklyWage, 'offered weekly wage');
  if (!Number.isSafeInteger(offer.termSeasons) || offer.termSeasons < 1 || offer.termSeasons > 3) {
    throw new Error('contract term must be an integer from 1 to 3 seasons');
  }
  if (!['GUARANTEED_STARTER', 'CAPTAINCY', 'TRAINING_PRIORITY', 'JERSEY_10'].includes(offer.perk)) {
    throw new Error('contract offer has an unknown perk');
  }
}

function validateNegotiation(negotiation: ContractNegotiation): void {
  assertNonEmptyString(negotiation.id, 'negotiation ID');
  assertNonEmptyString(negotiation.playerId, 'negotiation player ID');
  validatePersonality(negotiation.personality);
  assertPositiveSafeInteger(negotiation.weeklyAsk, 'weekly contract ask');
  if (!Number.isSafeInteger(negotiation.round)
    || negotiation.round < 0
    || negotiation.round > 3
    || negotiation.history.length !== negotiation.round) {
    throw new Error('negotiation round history is invalid');
  }
  if (!Number.isSafeInteger(negotiation.pitchInfluencePercent)
    || negotiation.pitchInfluencePercent < -20
    || negotiation.pitchInfluencePercent > 20) {
    throw new Error('negotiation pitch influence must stay within +/-20%');
  }
  if (negotiation.pitchCards.length !== 3) throw new Error('negotiation must deal 3 pitch cards');
  assertUniqueStrings(negotiation.pitchCards, 'dealt pitch card');
  assertUniqueStrings(negotiation.usedPitchCards, 'used pitch card');
}

function validatePitchCard(pitchCard: PitchCard): void {
  if (!PITCH_CARDS.includes(pitchCard)) throw new Error('unknown pitch card');
}

function validatePersonality(personality: PlayerPersonality): void {
  if (!PERSONALITIES.includes(personality)) throw new Error('unknown personality');
}

function validateRetiredLegend(legend: RetiredLegendCoachInput): void {
  assertNonEmptyString(legend.playerId, 'retired legend player ID');
  assertNonEmptyString(legend.name, 'retired legend name');
  validatePersonality(legend.personality);
  assertNonNegativeSafeInteger(legend.fame, 'retired legend fame');
  if (!Number.isSafeInteger(legend.seasonsAtClub) || legend.seasonsAtClub < 5) {
    throw new Error('retired coach candidates must have at least 5 club seasons');
  }
  if (legend.specialties !== undefined) {
    if (legend.specialties[0] === legend.specialties[1]
      || !COACH_SPECIALTIES.includes(legend.specialties[0])
      || !COACH_SPECIALTIES.includes(legend.specialties[1])) {
      throw new Error('retired legend coach specialties must be two distinct specialties');
    }
  }
}

function validateAttrs(attrs: Readonly<Attrs>, label: string): void {
  for (const attribute of ATTR_NAMES) {
    const value = attrs[attribute];
    if (!Number.isSafeInteger(value) || value < 1 || value > 99) {
      throw new Error(`${label} ${attribute} must be an integer from 1 to 99`);
    }
  }
}

function validateAge(age: number): void {
  if (!Number.isSafeInteger(age) || age < 16 || age > 45) {
    throw new Error('player age must be an integer from 16 to 45');
  }
}

function validatePotential(potential: number): void {
  if (!Number.isSafeInteger(potential) || potential < 1 || potential > 5) {
    throw new Error('player potential must be an integer from 1 to 5');
  }
}

function validatePowerTier(powerTier: number): void {
  if (!Number.isSafeInteger(powerTier) || powerTier < 1 || powerTier > 3) {
    throw new Error('power tier must be an integer from 1 to 3');
  }
}

function validateDivision(division: number): void {
  if (!Number.isSafeInteger(division) || division < 1 || division > 5) {
    throw new Error('division must be an integer from 1 to 5');
  }
}

function assertPercent(value: number, label: string, maximum: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${label} must be an integer percent from 0 to ${maximum}`);
  }
}

function assertUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new Error(`${label} must be a uint32`);
  }
}

function assertNonEmptyString(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative safe integer`);
  }
}

function assertUniqueStrings(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    assertNonEmptyString(value, label);
    if (seen.has(value)) throw new Error(`${label}s must be unique`);
    seen.add(value);
  }
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

function checkedMultiply(left: number, right: number, label: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result)) throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

function checkedRound(value: number, label: string): number {
  const result = Math.round(value);
  if (!Number.isSafeInteger(result)) throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

function scaleByPercent(value: number, percent: number, label: string): number {
  return checkedRound(checkedMultiply(value, percent, label) / 100, label);
}

function deterministicRoll(seed: number, key: string, upperExclusive: number): number {
  if (!Number.isSafeInteger(upperExclusive) || upperExclusive < 1) {
    throw new Error('deterministic roll upper bound must be a positive safe integer');
  }
  return Math.floor(mulberry32(mixSeed(seed, key))() * upperExclusive);
}

function randomInteger(random: () => number, upperExclusive: number): number {
  return Math.floor(random() * upperExclusive);
}

function shuffleInPlace<T>(values: T[], random: () => number): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const other = randomInteger(random, index + 1);
    [values[index], values[other]] = [values[other], values[index]];
  }
}

function mixSeed(seed: number, key: string): number {
  return (seed ^ Math.imul(hashString(key), 0x9e3779b1)) >>> 0;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
