import { mulberry32 } from '../sim/rng';
import type { Attrs, PowerId, Role } from '../sim/types';
import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import coachIdentityData from './coach-identities.json';
import { compareIds } from './ordering';
import { roleOverall } from './archetype-caps';
import {
  CLUB_LEGEND_MIN_FAME,
  DIVISION_SUPPORT_STRENGTHS,
  divisionTierLabel,
  type DivisionLevel,
} from './pyramid';

const UINT32_MAX = 4294967295;
const ATTR_NAMES = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'] as const;
const OUT_FIELD_ATTRS = ['pac', 'sho', 'pas', 'def', 'tec', 'sta'] as const;
const GOALKEEPER_ATTRS = ['pac', 'pas', 'def', 'tec', 'sta', 'ref'] as const;
/**
 * A support-level player in each division is priced against that division's
 * actual income, rather than against an obsolete universal raw-stat baseline.
 * The ladder still makes elite players more expensive, while a wholesale
 * rebase of every rating no longer multiplies prices by accident.
 */
export const DIVISION_TRANSFER_VALUE_ANCHORS: Readonly<
  Record<DivisionLevel, number>
> = {
  1: 32_000,
  2: 22_000,
  3: 14_500,
  4: 9_500,
  5: 6_500,
};
/** Weekly wage for a support-level generated player in each division. */
export const DIVISION_WEEKLY_WAGE_ANCHORS: Readonly<
  Record<DivisionLevel, number>
> = {
  1: 700,
  2: 500,
  3: 340,
  4: 230,
  5: 150,
};

export type PlayerPersonality =
  'FIERY' | 'LOYAL' | 'GREEDY' | 'JOKER' | 'PROFESSIONAL' | 'TIMID';

export type ScoutRegion =
  'LOCAL' | 'EUROPE' | 'SOUTH_AMERICA' | 'AFRICA' | 'ASIA';

export type ScoutProspectType =
  'IMMEDIATE_STARTER' | 'YOUNG_PROSPECT' | 'SPECIALIST' | 'BARGAIN';

export type ScoutFocus =
  | { kind: 'POSITION'; role: Role }
  | { kind: 'AGE'; minimumAge: number; maximumAge: number }
  | { kind: 'ELITE_PROSPECT' }
  | { kind: 'RUMORED_HERO' }
  | { kind: 'PROFILE'; prospectType: ScoutProspectType; role?: Role };

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
  /** Transient source division used only to compare bargain value. */
  readonly sellingClubDivision?: number;
}

interface ScoutMissionSetup {
  readonly careerSeed: number;
  readonly missionId: string;
  /** Monotonic career week, rather than the displayed 1-30 season week. */
  readonly startWeek: number;
  readonly region: ScoutRegion;
  readonly focus: ScoutFocus;
  readonly scoutOfficeLevel: number;
  readonly division: number;
  readonly starterScores?: Readonly<Partial<Record<Role, number>>>;
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
  /** Same-role strength when the mission began, for Immediate Starter searches. */
  readonly starterScores?: Readonly<Partial<Record<Role, number>>>;
}

interface ScoutedRange {
  readonly minimum: number;
  readonly maximum: number;
}

type ScoutedAttributeRanges = {
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
  readonly powerTier?: number;
  /** A rare hero-focus hit without revealing the exact power below office level 3. */
  readonly rumoredHeroLead?: true;
  /** Saved by the career wrapper so reports from different missions can coexist. */
  readonly completedSeason?: number;
  readonly completedWeek?: number;
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

export function scoutMissionCost(
  region: ScoutRegion,
  focus: ScoutFocus,
): number {
  validateScoutFocus(focus);
  const regionCost = REGION_COST[region];
  if (regionCost === undefined)
    throw new Error(`unknown scouting region ${String(region)}`);
  const focusCost =
    focus.kind === 'RUMORED_HERO'
      ? 2500
      : focus.kind === 'ELITE_PROSPECT'
        ? 1500
        : focus.kind === 'PROFILE'
          ? 1000 + (focus.role === undefined ? 0 : 750)
          : focus.kind === 'AGE'
            ? 500
            : 0;
  return regionCost + focusCost;
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
    throw new Error(`rumored hero scouting unlocks in ${divisionTierLabel(3)}`);
  }
  if (setup.focus.kind === 'ELITE_PROSPECT' && setup.division > 2) {
    throw new Error(
      `elite prospect scouting unlocks in ${divisionTierLabel(2)}`,
    );
  }

  const missionSeed = mixSeed(
    setup.careerSeed,
    `${setup.missionId}:${setup.region}:${scoutFocusKey(setup.focus)}`,
  );
  const durationWeeks =
    2 +
    deterministicRoll(missionSeed, 'duration', 2) +
    (setup.focus.kind === 'PROFILE' && setup.focus.role !== undefined ? 1 : 0);

  return {
    id: setup.missionId,
    missionSeed,
    startWeek: setup.startWeek,
    dueWeek: checkedAdd(setup.startWeek, durationWeeks, 'scouting due week'),
    cost: scoutMissionCost(setup.region, setup.focus),
    region: setup.region,
    focus: { ...setup.focus },
    scoutOfficeLevel: setup.scoutOfficeLevel,
    ...(setup.starterScores === undefined
      ? {}
      : { starterScores: { ...setup.starterScores } }),
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
  if (currentWeek < mission.dueWeek)
    throw new Error('scouting mission is not complete yet');
  if (
    !Number.isSafeInteger(shortlistSize) ||
    shortlistSize < 1 ||
    shortlistSize > 5
  ) {
    throw new Error('scouting shortlist size must be an integer from 1 to 5');
  }
  assertUniqueStrings(
    candidates.map((candidate) => candidate.id),
    'scouting candidate ID',
  );
  for (const candidate of candidates) validateScoutablePlayer(candidate);

  const eligible = candidates
    .filter(
      (candidate) =>
        candidate.region === mission.region &&
        matchesScoutFocus(candidate, mission.focus),
    )
    .slice()
    .sort((left, right) => compareIds(left.id, right.id));
  const random = mulberry32(mixSeed(mission.missionSeed, 'shortlist'));
  const shortlist =
    mission.focus.kind === 'RUMORED_HERO'
      ? rumoredHeroShortlist(
          eligible,
          shortlistSize,
          mission.missionSeed,
          random,
        )
      : mission.focus.kind === 'PROFILE'
        ? profileShortlist(eligible, shortlistSize, mission, random)
        : shuffledShortlist(eligible, shortlistSize, random);

  return {
    missionId: mission.id,
    completedWeek: currentWeek,
    reports: shortlist.map((candidate) => ({
      playerId: candidate.id,
      role: candidate.role,
      age: candidate.age,
      statRanges: scoutAttributeRanges(
        candidate.attrs,
        Math.max(1, mission.scoutOfficeLevel),
        mixSeed(mission.missionSeed, candidate.id),
      ),
      potentialRange: scoutingRange(
        candidate.potential,
        mission.scoutOfficeLevel <= 1
          ? 2
          : mission.scoutOfficeLevel === 2
            ? 1
            : 0,
        1,
        5,
        mixSeed(mission.missionSeed, `${candidate.id}:potential`),
      ),
      ...(mission.scoutOfficeLevel === 3 && candidate.power !== undefined
        ? { power: candidate.power, powerTier: candidate.powerTier ?? 1 }
        : {}),
      ...(mission.focus.kind === 'RUMORED_HERO' && candidate.power !== undefined
        ? { rumoredHeroLead: true as const }
        : {}),
    })),
  };
}

function shuffledShortlist(
  eligible: ScoutablePlayer[],
  shortlistSize: number,
  random: () => number,
): ScoutablePlayer[] {
  shuffleInPlace(eligible, random);
  return eligible.slice(0, shortlistSize);
}

function profileShortlist(
  eligible: ScoutablePlayer[],
  shortlistSize: number,
  mission: ScoutMission,
  random: () => number,
): ScoutablePlayer[] {
  const focus = mission.focus;
  if (focus.kind !== 'PROFILE')
    return shuffledShortlist(eligible, shortlistSize, random);
  eligible.sort(
    (left, right) =>
      profileScore(right, focus.prospectType, mission.starterScores) -
        profileScore(left, focus.prospectType, mission.starterScores) ||
      compareIds(left.id, right.id),
  );
  // Four times the shortlist, so the shuffle below has a real band to draw
  // from rather than returning the sorted head every time. The old
  // `Math.max(shortlistSize, shortlistSize * 4)` could only ever pick the
  // second term.
  const band = eligible.slice(0, shortlistSize * 4);
  shuffleInPlace(band, random);
  return band.slice(0, shortlistSize);
}

function profileScore(
  player: ScoutablePlayer,
  type: ScoutProspectType,
  starterScores: Readonly<Partial<Record<Role, number>>> | undefined,
): number {
  const overall = roleOverall(player.role, player.attrs);
  if (type === 'IMMEDIATE_STARTER') {
    // "How much better than the starter I already have." Without a score to
    // beat, fall back to the player's own overall rather than to `overall`
    // itself — subtracting that returned 0 for every candidate and collapsed
    // the shortlist to id order, silently. A career mission always supplies
    // `starterScores` (0 for a role the club cannot field), so this only
    // reaches direct callers, which is exactly where a flat ranking was
    // hardest to notice.
    const starter = starterScores?.[player.role];
    return starter === undefined ? overall : overall - starter;
  }
  if (type === 'YOUNG_PROSPECT') {
    return player.potential * 1000 + overall;
  }
  if (type === 'SPECIALIST') {
    const relevant =
      player.role === 'GK'
        ? [player.attrs.ref, player.attrs.def, player.attrs.pas]
        : player.role === 'DEF'
          ? [player.attrs.def, player.attrs.sta, player.attrs.pac]
          : player.role === 'MID'
            ? [player.attrs.pas, player.attrs.tec, player.attrs.def]
            : [player.attrs.sho, player.attrs.pac, player.attrs.tec];
    return Math.max(...relevant) * 100 - Math.round(overall);
  }
  const value = playerValuation(player, player.sellingClubDivision ?? 5);
  return Math.round(
    ((overall + player.potential * 5) * 100000) / Math.max(1, value),
  );
}

function rumoredHeroShortlist(
  eligible: ScoutablePlayer[],
  shortlistSize: number,
  missionSeed: number,
  random: () => number,
): ScoutablePlayer[] {
  const heroes = eligible.filter((candidate) => candidate.power !== undefined);
  const ordinary = eligible.filter(
    (candidate) => candidate.power === undefined,
  );
  // Partitioned before the shuffle, not sorted after it: by division 3 the hero
  // bucket holds dozens of generated opponents, so an unbiased pick would
  // surface one of the four named characters almost never and "reachable"
  // would be a claim the code does not support. The 25% rumour roll below still
  // decides whether anything is found at all, so the find stays rare.
  const named = heroes.filter((candidate) =>
    candidate.id.startsWith(SPECIAL_HERO_ID_PREFIX),
  );
  const generated = heroes.filter(
    (candidate) => !candidate.id.startsWith(SPECIAL_HERO_ID_PREFIX),
  );
  shuffleInPlace(named, random);
  shuffleInPlace(generated, random);
  heroes.length = 0;
  heroes.push(...named, ...generated);
  shuffleInPlace(ordinary, random);
  const rumorIsReal = mulberry32(mixSeed(missionSeed, 'rumor-payoff'))() < 0.25;
  if (!rumorIsReal || heroes.length === 0)
    return ordinary.slice(0, shortlistSize);
  return [heroes[0], ...ordinary].slice(0, shortlistSize);
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
    pac: scoutingRange(
      attrs.pac,
      span,
      1,
      MAX_PLAYER_ATTRIBUTE,
      mixSeed(rangeSeed, 'pac'),
    ),
    sho: scoutingRange(
      attrs.sho,
      span,
      1,
      MAX_PLAYER_ATTRIBUTE,
      mixSeed(rangeSeed, 'sho'),
    ),
    pas: scoutingRange(
      attrs.pas,
      span,
      1,
      MAX_PLAYER_ATTRIBUTE,
      mixSeed(rangeSeed, 'pas'),
    ),
    def: scoutingRange(
      attrs.def,
      span,
      1,
      MAX_PLAYER_ATTRIBUTE,
      mixSeed(rangeSeed, 'def'),
    ),
    tec: scoutingRange(
      attrs.tec,
      span,
      1,
      MAX_PLAYER_ATTRIBUTE,
      mixSeed(rangeSeed, 'tec'),
    ),
    sta: scoutingRange(
      attrs.sta,
      span,
      1,
      MAX_PLAYER_ATTRIBUTE,
      mixSeed(rangeSeed, 'sta'),
    ),
    ref: scoutingRange(
      attrs.ref,
      span,
      1,
      MAX_PLAYER_ATTRIBUTE,
      mixSeed(rangeSeed, 'ref'),
    ),
  };
}

/** Pre-season is weeks 1-4; the two-week mid-season window is weeks 17-18. */
export function isTransferWindowOpen(week: number): boolean {
  if (!Number.isSafeInteger(week) || week < 1 || week > 30) return false;
  return week <= 4 || (week >= 17 && week <= 18);
}

/** Whole weekly advances until registration next opens; zero while it is open. */
export function weeksUntilTransferWindowOpen(week: number): number {
  if (!Number.isSafeInteger(week) || week < 1 || week > 30) {
    throw new Error('week must be a safe integer from 1 to 30');
  }
  if (isTransferWindowOpen(week)) return 0;
  if (week < 17) return 17 - week;
  return 31 - week;
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

interface TransferQuoteContext {
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
 * Whole-money valuation. Six role-relevant stats set a quadratic premium
 * relative to the selling division's support band, then age, potential, power
 * tier and contract control adjust it.
 */
export function playerValuation(
  player: ValuationPlayer,
  sellingClubDivision: number,
): number {
  validateValuationPlayer(player);
  validateDivision(sellingClubDivision);
  const division = sellingClubDivision as DivisionLevel;
  const attributes = player.role === 'GK' ? GOALKEEPER_ATTRS : OUT_FIELD_ATTRS;
  const total = attributes.reduce(
    (sum, attribute) => sum + player.attrs[attribute],
    0,
  );
  const supportTotal = DIVISION_SUPPORT_STRENGTHS[division] * attributes.length;
  let value = checkedRound(
    (DIVISION_TRANSFER_VALUE_ANCHORS[division] * total * total) /
      (supportTotal * supportTotal),
    'division-anchored player valuation',
  );
  value = scaleByPercent(
    value,
    ageValuePercent(player.age),
    'age-adjusted player valuation',
  );
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
  return Math.max(500, value);
}

/**
 * Global wage relief, applied to every generated wage.
 *
 * The opening was reading as too tight across the board, and the wage bill is
 * the pressure that never lets up. Held as one factor rather than folded into
 * the anchors so the curve above stays the documented one and this stays a
 * balance decision that can be read, tuned, or reversed on its own.
 *
 * The authored launch rosters in `content/clubs.json` carry the same 4% cut.
 *
 * Started at 5%, which pushed the six-season passive-club cash peak from
 * 113,256 to 135,714 — a fifth richer for a twentieth off the wage bill,
 * because a passive club banks the saving every week and never spends it.
 */
const GLOBAL_WAGE_SCALE = 0.96;

/** Player-only relief applied after every existing wage rule. Coach wages are separate. */
export const PLAYER_WAGE_REDUCTION_PERCENT = 15;
export const ADDITIONAL_PLAYER_WAGE_REDUCTION_PERCENT = 5;

export function reducedPlayerWeeklyWage(currentWeeklyWage: number): number {
  if (!Number.isSafeInteger(currentWeeklyWage) || currentWeeklyWage < 0) {
    throw new Error('player weekly wage must be a non-negative safe integer');
  }
  return checkedRound(
    (currentWeeklyWage * (100 - PLAYER_WAGE_REDUCTION_PERCENT)) / 100,
    'reduced player weekly wage',
  );
}

/** One-time save migration for careers that already received the earlier 10% cut. */
export function furtherReducedPlayerWeeklyWage(
  currentWeeklyWage: number,
): number {
  if (!Number.isSafeInteger(currentWeeklyWage) || currentWeeklyWage < 0) {
    throw new Error('player weekly wage must be a non-negative safe integer');
  }
  return checkedRound(
    (currentWeeklyWage * (100 - ADDITIONAL_PLAYER_WAGE_REDUCTION_PERCENT)) /
      100,
    'further reduced player weekly wage',
  );
}

/**
 * Rebased generated-player wage curve. Seven-stat average is compared with the
 * division's support rating, so rival growth and star premiums remain visible
 * without charging the user twice for the ladder's larger raw numbers.
 */
/** Ids of the fifteen named characters all share this prefix. */
const SPECIAL_HERO_ID_PREFIX = 'special-';

export function generatedPlayerWeeklyWage(
  attrs: Readonly<Attrs>,
  divisionValue: number,
): number {
  validateDivision(divisionValue);
  for (const attribute of ATTR_NAMES) {
    const value = attrs[attribute];
    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > MAX_PLAYER_ATTRIBUTE
    ) {
      throw new Error(
        `${attribute} must be an integer from 1 to ${MAX_PLAYER_ATTRIBUTE}`,
      );
    }
  }
  const division = divisionValue as DivisionLevel;
  const total = ATTR_NAMES.reduce(
    (sum, attribute) => sum + attrs[attribute],
    0,
  );
  const wage = checkedRound(
    (GLOBAL_WAGE_SCALE * DIVISION_WEEKLY_WAGE_ANCHORS[division] * total) /
      (DIVISION_SUPPORT_STRENGTHS[division] * ATTR_NAMES.length),
    'division-anchored weekly wage',
  );
  return reducedPlayerWeeklyWage(Math.max(150, wage));
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
  'GUARANTEED_STARTER' | 'CAPTAINCY' | 'TRAINING_PRIORITY' | 'JERSEY_10';

export type PitchCard =
  | 'FLATTERY'
  | 'TROPHY_PROMISE'
  | 'HOMETOWN_TIES'
  | 'MONEY_TALKS'
  | 'STRAIGHT_TALK';

export type NegotiationMood =
  'ANGRY' | 'UNHAPPY' | 'NEUTRAL' | 'PLEASED' | 'THRILLED';
export type NegotiationStatus = 'OPEN' | 'ACCEPTED' | 'REJECTED';

export interface ContractOffer {
  readonly weeklyWage: number;
  readonly termSeasons: number;
  readonly perk: ContractPerk;
}

interface ContractNegotiationSetup {
  readonly careerSeed: number;
  readonly negotiationId: string;
  readonly playerId: string;
  readonly personality: PlayerPersonality;
  readonly weeklyAsk: number;
}

interface ContractRoundRecord {
  readonly round: number;
  readonly offer: ContractOffer;
  readonly pitchCard?: PitchCard;
  readonly cardAffinity: -1 | 0 | 1;
  readonly effectiveAsk: number;
  readonly effectiveOffer: number;
  readonly mood: NegotiationMood;
  readonly outcome: 'COUNTER' | 'ACCEPTED' | 'INSULTED' | 'WALKED_AWAY';
}

interface NegotiationConsequence {
  readonly moraleDelta: number;
  readonly clubFameDelta: number;
}

export interface ContractNegotiation {
  readonly id: string;
  /**
   * Carried so a round's mood swing can be derived rather than rolled.
   *
   * `src/game` is a pure ring: no `Math.random`, same seed means byte-identical
   * results. Storing the career seed on the negotiation is what lets the
   * per-round wobble be a function of (seed, id, round) instead of a dice throw
   * a reload could re-roll into a better price.
   */
  readonly careerSeed?: number;
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

interface RenewalAskPlayer {
  readonly weeklyWage: number;
  readonly personality: PlayerPersonality;
  readonly power?: PowerId;
  readonly onHeroWage: boolean;
}

interface RenewalAskFactors {
  readonly growthSinceSigningPercent: number;
  readonly famePercent: number;
  readonly heroMultiplier: number;
  /**
   * Signed percentage points from the player's loyalty, −20 to 20. Required
   * rather than optional on purpose: an optional field defaulting to zero would
   * let a real call site skip loyalty silently, and there is no way to tell that
   * apart from a deliberate zero. `loyaltyRenewalPercent` in
   * `src/game/loyalty.ts` produces it.
   */
  readonly loyaltyPercent: number;
}

const PITCH_CARDS: readonly PitchCard[] = [
  'FLATTERY',
  'TROPHY_PROMISE',
  'HOMETOWN_TIES',
  'MONEY_TALKS',
  'STRAIGHT_TALK',
];

const LOVED_PITCHES: Readonly<Record<PlayerPersonality, readonly PitchCard[]>> =
  {
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
  if (
    !Number.isFinite(factors.heroMultiplier) ||
    factors.heroMultiplier < 3 ||
    factors.heroMultiplier > 5
  ) {
    throw new Error('hero wage multiplier must be from 3 to 5');
  }
  // Validated here rather than through `assertPercent`, which rejects negatives.
  // This factor is signed: a loyal player asks for less, not zero less.
  if (
    !Number.isInteger(factors.loyaltyPercent) ||
    factors.loyaltyPercent < -20 ||
    factors.loyaltyPercent > 20
  ) {
    throw new Error('renewal loyalty factor must be an integer from -20 to 20');
  }

  let ask = scaleByPercent(
    player.weeklyWage,
    100 + factors.growthSinceSigningPercent,
    'growth-adjusted renewal ask',
  );
  ask = scaleByPercent(
    ask,
    100 + factors.famePercent,
    'fame-adjusted renewal ask',
  );
  ask = scaleByPercent(
    ask,
    100 + factors.loyaltyPercent,
    'loyalty-adjusted renewal ask',
  );
  ask = scaleByPercent(
    ask,
    player.personality === 'GREEDY'
      ? 120
      : player.personality === 'LOYAL'
        ? 90
        : 100,
    'personality-adjusted renewal ask',
  );
  if (player.power !== undefined && !player.onHeroWage) {
    ask = checkedRound(ask * factors.heroMultiplier, 'hero renewal ask');
  }
  // Everything above compounds, and compounding is what produced the number
  // this cap exists to stop. Growth, fame, loyalty, personality and the hero
  // premium each multiply the last, so a well-trained famous hero could ask
  // 4.0 x 2.0 x 1.2 x 4 = 46x his old wage — and the screen presented that as
  // the awakening's doing, beside a struck-through wage, with nothing on it to
  // explain the other 11x.
  //
  // The ceiling is on the WHOLE ask rather than on any one factor, because no
  // single factor was wrong: each is defensible and their product is not. This
  // is the only number a player ever sees here, so it is the one that has to
  // match what the game promises — a renewal costs up to five times the old
  // deal, and never more, however the five is arrived at.
  return Math.min(
    ask,
    checkedRound(
      player.weeklyWage * MAX_RENEWAL_ASK_MULTIPLE,
      'capped renewal ask',
    ),
  );
}

/**
 * The most any renewal may ask, as a multiple of what the club already pays.
 *
 * Doc 06's "hero rates are 3-5x" is a statement about the number on the card,
 * which is the only place a manager can read it. Before this cap that sentence
 * described `heroMultiplier` alone — one term in a product of five — and the
 * card routinely showed eight or nine times the old wage while every internal
 * value stayed inside its documented range.
 */
export const MAX_RENEWAL_ASK_MULTIPLE = 5;

export function dealPitchCards(
  careerSeed: number,
  negotiationId: string,
): PitchCard[] {
  assertUint32(careerSeed, 'negotiation career seed');
  assertNonEmptyString(negotiationId, 'negotiation ID');
  const cards = PITCH_CARDS.slice();
  shuffleInPlace(
    cards,
    mulberry32(mixSeed(careerSeed, `pitch:${negotiationId}`)),
  );
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
    careerSeed: setup.careerSeed,
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
/**
 * The lowest weekly wage the agent will still talk about.
 *
 * Below this the offer is an insult: talks end on the spot, the player loses
 * morale and the club loses reputation. Exported because the screen has to say
 * the number BEFORE the offer is sent — the rule used to be enforced silently
 * and explained only in small print under the button, so the first a manager
 * knew of it was the talks being over.
 */
export function insultingOfferFloor(weeklyAsk: number): number {
  assertPositiveSafeInteger(weeklyAsk, 'weekly contract ask');
  return Math.ceil(weeklyAsk / 2);
}

/**
 * The most an agent's mood can move his price in a single round, either way.
 *
 * The reason this exists at all: a flat threshold makes every negotiation the
 * same arithmetic problem, and solving arithmetic twice is not a game. A round
 * that can come in under the number is a round you can get lucky in, and
 * getting lucky is the only way "I talked him down" ever feels like something
 * you did rather than something you calculated.
 *
 * Eight percent is sized against the wage step. On a mid-table ask the swing is
 * a step or two — enough that the same offer genuinely lands differently, small
 * enough that it never turns a considered offer into a coin toss.
 */
export const ASK_WOBBLE_PERCENT = 8;

/**
 * The round the agent stops moving and names his price.
 *
 * From here the wobble is off. Everything the final round says has to be true,
 * because the manager is being asked to take it or leave it — a stated number
 * that a hidden roll could still refuse would be the worst version of this
 * screen, not the best one.
 */
export const FINAL_NEGOTIATION_ROUND = 3;

/**
 * How this round's agent is feeling, as signed percentage points on his ask.
 *
 * Derived from the career seed, the negotiation id and the round number, so it
 * is stable under save-and-reload and different for every player, every season
 * and every round. Rerolling it is impossible by construction: there is no
 * state to reroll, only a pure function of three values the save already holds.
 */
export function askWobblePercent(
  careerSeed: number | undefined,
  negotiationId: string,
  round: number,
): number {
  // A negotiation saved before the seed was carried has no mood to derive. It
  // negotiates flat rather than throwing: the alternative is that reopening a
  // save captured mid-talks crashes on the next offer, and a missing wobble is
  // invisible where a crash is not. New negotiations always carry the seed —
  // `startContractNegotiation` requires it.
  if (careerSeed === undefined) return 0;
  assertUint32(careerSeed, 'negotiation career seed');
  assertNonEmptyString(negotiationId, 'negotiation ID');
  if (!Number.isSafeInteger(round) || round < 1) {
    throw new Error('negotiation round must be a positive integer');
  }
  // The final round is the agent's stated position, not a mood.
  if (round >= FINAL_NEGOTIATION_ROUND) return 0;
  const roll = mulberry32(
    mixSeed(careerSeed, `ask:${negotiationId}:r${round}`),
  )();
  const span = ASK_WOBBLE_PERCENT * 2 + 1;
  return Math.floor(roll * span) - ASK_WOBBLE_PERCENT;
}

export function effectiveContractAsk(
  weeklyAsk: number,
  pitchInfluencePercent: number,
): number {
  assertPositiveSafeInteger(weeklyAsk, 'weekly contract ask');
  if (!Number.isSafeInteger(pitchInfluencePercent)) {
    throw new Error('pitch influence must be a safe integer percent');
  }
  const capped = Math.max(-20, Math.min(20, pitchInfluencePercent));
  return scaleByPercent(weeklyAsk, 100 + capped, 'pitch-adjusted contract ask');
}

/**
 * What a promise is worth to the player, as percentage points added to the wage
 * on the table.
 *
 * Exported so the negotiation panel can grade the four promises from the same
 * numbers the agent judges them by. A grade hand-written in the view model is a
 * second opinion that drifts the first time these move, and the promise ladder
 * is the one thing the panel has to state correctly — it is the only reason to
 * pick the promise that costs the squad the most.
 */
/**
 * What each temperament thinks of each promise, in percentage points on top of
 * the base ladder.
 *
 * The ladder alone made personality worth reading in exactly one place — the
 * pitch cards — while the promises, which cost the squad far more, were priced
 * identically for a mercenary and a homebody. Reading your player now pays
 * twice: once for the card you play, once for the thing you promise.
 *
 * The signs are the character, not a spread:
 * - GREEDY discounts everything that is not money. He is the one player for
 *   whom promises are a weak lever, which is what makes him expensive.
 * - FIERY wants the armband and hates being told he will merely play.
 * - TIMID wants the security of the shirt and the starting place; the armband
 *   is a burden he did not ask for.
 * - PROFESSIONAL values the work — training priority — over the ceremony.
 * - JOKER wants the number 10 on his back and very little else.
 * - LOYAL is warmed by all of it, mildly. He was staying anyway.
 */
const PERK_PERSONALITY_BONUS: Readonly<
  Record<PlayerPersonality, Readonly<Record<ContractPerk, number>>>
> = {
  GREEDY: {
    GUARANTEED_STARTER: -4,
    CAPTAINCY: -4,
    TRAINING_PRIORITY: -4,
    JERSEY_10: -2,
  },
  FIERY: {
    GUARANTEED_STARTER: -2,
    CAPTAINCY: 4,
    TRAINING_PRIORITY: 0,
    JERSEY_10: 2,
  },
  TIMID: {
    GUARANTEED_STARTER: 4,
    CAPTAINCY: -4,
    TRAINING_PRIORITY: 2,
    JERSEY_10: 0,
  },
  PROFESSIONAL: {
    GUARANTEED_STARTER: 0,
    CAPTAINCY: 2,
    TRAINING_PRIORITY: 4,
    JERSEY_10: -2,
  },
  JOKER: {
    GUARANTEED_STARTER: 0,
    CAPTAINCY: -2,
    TRAINING_PRIORITY: -2,
    JERSEY_10: 4,
  },
  LOYAL: {
    GUARANTEED_STARTER: 2,
    CAPTAINCY: 2,
    TRAINING_PRIORITY: 2,
    JERSEY_10: 2,
  },
};

/**
 * The base worth of a promise, before the player's own opinion of it.
 *
 * The order is the cost to the club, not the cost to the wage bill: a
 * guaranteed start binds every team sheet for the length of the deal, the
 * armband is taken off somebody else, training priority spends five drills, and
 * a shirt number costs nothing at all. The biggest discount is the biggest
 * handcuff, deliberately.
 */
function contractPerkBasePercent(perk: ContractPerk): number {
  if (perk === 'GUARANTEED_STARTER') return 10;
  if (perk === 'CAPTAINCY') return 8;
  if (perk === 'TRAINING_PRIORITY') return 6;
  return 4;
}

/**
 * What a promise is worth to this player, as percentage points added to the
 * wage on the table.
 *
 * Exported so the negotiation panel can grade the four promises from the same
 * numbers the agent judges them by. A grade hand-written in the view model is a
 * second opinion that drifts the first time these move, and the promise ladder
 * is the one thing the panel has to state correctly.
 *
 * `personality` is optional so the grading call sites that have no player in
 * hand still get the base ladder rather than a thrown error.
 */
export function contractPerkPercent(
  perk: ContractPerk,
  personality?: PlayerPersonality,
): number {
  validateContractPerk(perk);
  const base = contractPerkBasePercent(perk);
  if (personality === undefined) return base;
  validatePersonality(personality);
  // Floored at 1 rather than allowed to reach zero: a promise the club is
  // genuinely bound by must always be worth something, or GREEDY players would
  // present a promise button that provably does nothing.
  return Math.max(1, base + PERK_PERSONALITY_BONUS[personality][perk]);
}

export function contractOfferValue(
  offer: ContractOffer,
  personality?: PlayerPersonality,
): number {
  validateContractOffer(offer);
  return scaleByPercent(
    offer.weeklyWage,
    contractOfferBonusPercent(offer.termSeasons, offer.perk, personality),
    'effective contract offer',
  );
}

/**
 * The whole multiplier on a wage, as a percentage — term plus promise.
 *
 * Named once because three places need exactly this number and must not derive
 * it separately: the acceptance test, the wage the panel tells the manager to
 * offer, and the figure the agent names in his closing line. Two of those are
 * shown to the player as promises about the third.
 */
export function contractOfferBonusPercent(
  termSeasons: number,
  perk: ContractPerk,
  personality?: PlayerPersonality,
): number {
  return 100 + (termSeasons - 1) * 3 + contractPerkPercent(perk, personality);
}

/**
 * The lowest weekly wage this negotiation would accept, right now.
 *
 * This is the number the screen exists to show. Before it, the panel reported
 * mood, the walk-out floor and a leverage percentage, and left the manager to
 * reconstruct the actual figure from three of them — which is not a puzzle, it
 * is a hidden number. Every lever the manager can pull moves this one value, so
 * showing it live is what makes the term buttons, the promises and the pitch
 * cards legible as the discounts they are.
 *
 * `round` decides whether the agent's mood is in play. Passing the round he is
 * ABOUT to answer is what makes this agree with `submitContractOffer`.
 */
export function requiredWeeklyWage(
  negotiation: ContractNegotiation,
  termSeasons: number,
  perk: ContractPerk,
  pitchCard?: PitchCard,
): number {
  validateNegotiation(negotiation);
  validateContractPerk(perk);
  const round = negotiation.round + 1;
  const affinity =
    pitchCard === undefined
      ? 0
      : pitchCardAffinity(negotiation.personality, pitchCard);
  const influence = Math.max(
    -20,
    Math.min(
      20,
      negotiation.pitchInfluencePercent +
        (affinity === 1 ? -10 : affinity === -1 ? 10 : 0) +
        askWobblePercent(negotiation.careerSeed, negotiation.id, round),
    ),
  );
  const ask = effectiveContractAsk(negotiation.weeklyAsk, influence);
  const bonus = contractOfferBonusPercent(
    termSeasons,
    perk,
    negotiation.personality,
  );
  // Rounded UP: the acceptance test is `offer x bonus >= ask`, and a wage
  // rounded down would be one dollar short of the number the screen just
  // promised would work. Told to offer it, the manager must be accepted.
  const needed = Math.ceil((ask * 100) / bonus);
  // An offer below the insult line ends talks however well it scores, so the
  // number shown can never be one that would get the manager thrown out.
  return Math.max(needed, insultingOfferFloor(negotiation.weeklyAsk));
}

/**
 * The wage the negotiation panel opens on.
 *
 * Derived from the ask, never from the player's current wage. The panel used to
 * seed the stepper with what the club already paid, and for anyone whose ask has
 * outgrown their wage by more than 2x — every powered player on the wage cliff,
 * and any heavily developed, famous or GREEDY player — that seed sits below the
 * insult line, so the very first tap of "Make the offer" ended talks.
 *
 * Kept beside `submitContractOffer` because the two share an invariant: this
 * must never return a wage that function would call insulting.
 *
 * It is deliberately NOT the ask itself. Seeding at the ask makes the panel's
 * primary button an instant full-price accept that also commits whatever promise
 * the draft happens to be defaulting to — one mis-tap signing at list price and
 * spending a Hero License. 70% is a respectful opening counter: comfortably
 * above the insult line, and too low to be accepted in round one even with a
 * loved pitch card (0.7 x 1.16 = 0.81 against a 0.90 floor), so "Make the offer"
 * keeps meaning negotiate while the one-tap accept stays its own button.
 */
export function renewalOpeningOfferWage(
  weeklyAsk: number,
  wageStep: number,
): number {
  assertPositiveSafeInteger(weeklyAsk, 'weekly contract ask');
  assertPositiveSafeInteger(wageStep, 'wage step');
  const opening = Math.round((weeklyAsk * 0.7) / wageStep) * wageStep;
  // Step rounding can land under half the ask on small numbers (ask 101, step
  // 50 rounds to 50 against a 50.5 insult line), so the floor is applied last.
  return Math.max(wageStep, Math.ceil(weeklyAsk / 2), opening);
}

export function submitContractOffer(
  negotiation: ContractNegotiation,
  offer: ContractOffer,
  pitchCard?: PitchCard,
): ContractNegotiation {
  validateNegotiation(negotiation);
  validateContractOffer(offer);
  if (negotiation.status !== 'OPEN')
    throw new Error('contract talks have already ended');
  if (negotiation.round >= 3)
    throw new Error('contract talks allow at most 3 rounds');
  if (pitchCard !== undefined) {
    validatePitchCard(pitchCard);
    if (!negotiation.pitchCards.includes(pitchCard)) {
      throw new Error('pitch card was not dealt for this negotiation');
    }
    if (negotiation.usedPitchCards.includes(pitchCard)) {
      throw new Error('pitch cards may be played only once');
    }
  }

  const affinity =
    pitchCard === undefined
      ? 0
      : pitchCardAffinity(negotiation.personality, pitchCard);
  const pitchDelta = affinity === 1 ? -10 : affinity === -1 ? 10 : 0;
  const pitchInfluencePercent = Math.max(
    -20,
    Math.min(20, negotiation.pitchInfluencePercent + pitchDelta),
  );
  const round = negotiation.round + 1;
  // The mood of the round rides on top of the cards, and is clamped with them:
  // a hated card plus a bad mood must not push the ask past what the +/-20 cap
  // was written to guarantee.
  const wobbledInfluence = Math.max(
    -20,
    Math.min(
      20,
      pitchInfluencePercent +
        askWobblePercent(negotiation.careerSeed, negotiation.id, round),
    ),
  );
  const effectiveAsk = effectiveContractAsk(
    negotiation.weeklyAsk,
    wobbledInfluence,
  );
  const effectiveOffer = contractOfferValue(offer, negotiation.personality);
  const insulting =
    offer.weeklyWage < insultingOfferFloor(negotiation.weeklyAsk);
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
    usedPitchCards:
      pitchCard === undefined
        ? [...negotiation.usedPitchCards]
        : [...negotiation.usedPitchCards, pitchCard],
    status,
    history: [...negotiation.history, record],
    ...(accepted ? { acceptedOffer: { ...offer } } : {}),
    ...(insulting
      ? { consequence: { moraleDelta: -10, clubFameDelta: -2 } }
      : {}),
  };
}

export type CoachSpecialty =
  'ATTACK' | 'DEFENSE' | 'FITNESS' | 'TECHNIQUE' | 'GOALKEEPING' | 'MOTIVATOR';

interface RetiredLegendCoachInput {
  readonly playerId: string;
  readonly name: string;
  readonly personality: PlayerPersonality;
  readonly fame: number;
  readonly seasonsAtClub: number;
  readonly age?: number;
  readonly specialties?: readonly [CoachSpecialty, CoachSpecialty];
}

/**
 * What a story has permanently changed about one coach.
 *
 * Additive on top of his level, and it travels with him: firing a coach you
 * have invested a fortnight's course in loses the investment, which is what
 * makes the choice a choice. Caps are enforced where they are applied, not by
 * trusting content — see `COACH_BOOST_CAPS`.
 */
export interface CoachBoosts {
  /** Percentage points on his specialty training bonus. One head level is 10. */
  readonly trainingPercent?: number;
  /** Weekly Training Points, on top of the level's own contribution. */
  readonly weeklyTp?: number;
  /** Motivator strength in half-levels, matching the shape of the plumbing. */
  readonly motivatorHalfLevels?: number;
}

/** One head-coach level in each direction, and no further, for a coach's whole career. */
export const COACH_BOOST_CAPS = {
  trainingPercent: 10,
  weeklyTp: 4,
  motivatorHalfLevels: 2,
} as const;

export interface CoachCandidate {
  readonly id: string;
  readonly portraitId?: string;
  readonly name: string;
  readonly age?: number;
  readonly specialties: readonly [CoachSpecialty, CoachSpecialty];
  readonly level: number;
  readonly boosts?: CoachBoosts;
  readonly weeklyWage: number;
  readonly personality: PlayerPersonality;
  readonly requiredDivision: number;
  readonly requiredFame: number;
  readonly loyaltyDiscountPercent: number;
  readonly unlockId?: string;
  readonly retiredLegendPlayerId?: string;
}

interface CoachMarketSetup {
  readonly careerSeed: number;
  readonly season: number;
  readonly division: number;
  readonly fame: number;
  readonly retiredLegends?: readonly RetiredLegendCoachInput[];
  /** Content-owned formation/drill IDs may be supplied without importing content here. */
  readonly unlockIds?: readonly string[];
  readonly excludedPortraitIds?: readonly string[];
}

/**
 * Curated identities keep staff memorable and deliberately multicultural.
 * Gameplay traits are rolled independently so appearance never encodes skill.
 */
const COACH_IDENTITIES: readonly { id: string; name: string; age: number }[] =
  coachIdentityData.map((identity) => ({
    id: identity.id,
    name: identity.name,
    age: identity.age,
  }));

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

/**
 * Club fame, not player fame, indexed by the coach level it unlocks.
 *
 * Deliberately unchanged by the move of the player ceiling from 99 to 999. Club
 * fame is a SUM over the squad and was never bounded by the per-player cap, so
 * the seasons in which these gates are crossed did not move: a career reaches
 * roughly 450 club fame in season 1 and 1050 in season 3 on either scale,
 * because nobody is near any ceiling that early. All the new ceiling changes is
 * that the total keeps climbing afterwards instead of flattening — every gate
 * here is already behind the manager by then.
 *
 * Exported because `legacy-career.ts` prices the same gates onto its own coach
 * candidates, and a second copy of this array is exactly the kind of thing that
 * drifts.
 */
export const COACH_FAME_GATES = [0, 0, 100, 250, 500, 900] as const;

/**
 * A head coach's weekly wage per level, the one number the whole staff bill
 * scales from.
 *
 * Every coach price in the game is this times the coach's level, so the ladder
 * runs $300 / $600 / $900 / $1,200 / $1,500 a week from level 1 to 5, and an
 * assistant costs half of the same figure (`ASSISTANT_COACH_WAGE_PERCENT`) —
 * $150 for a level 1. Loyalty discounts come off the top of that.
 *
 * The $300 base keeps the first guided hire and the assistant that follows the
 * Coaching Office affordable while preserving the same linear level ladder.
 *
 * Exported because four call sites price coaches — the market, both retired
 * legend paths, and the yearly re-price on season rollover — and four copies of
 * the same literal is exactly the kind of thing that drifts.
 */
export const COACH_WAGE_PER_LEVEL = 300;

/**
 * The guard on the summed club total, raised with the player ceiling.
 *
 * A defensive clamp against corrupted data, not a balance value — nothing in
 * the game gates above 900. It was 9999, which a sixteen-man squad could not
 * reach while every player capped at 99 but reaches easily now, and a total
 * pegged at its clamp would have quietly stopped tracking the squad it
 * describes. Sixteen players at `FAME_CEILING` is 15984, so this cannot bind.
 */
export const CAREER_CLUB_FAME_CEILING = 99_999;

/**
 * A retired club legend's own fame, converted to the level of coach he becomes.
 *
 * One level per hundred fame above the club-legend gate, which is a bit over
 * two more seasons of first-team football each: 200 makes a level 1 coach, 400
 * a level 3, 600 and up a level 5. So the club's longest servants make its best
 * coaches, and the very best of them is now reachable — under the old 99
 * ceiling this topped out at level 3 no matter who retired.
 *
 * One rule, used by both paths that build a coach from a retired player. They
 * used to disagree: `generateCoachMarket` divided fame by 250, which under a
 * 99 ceiling could only ever return level 1.
 */
export function legendCoachLevel(fame: number): number {
  assertNonNegativeSafeInteger(fame, 'retired legend fame');
  return Math.max(
    1,
    Math.min(5, 1 + Math.floor((fame - CLUB_LEGEND_MIN_FAME) / 100)),
  );
}

/**
 * How much a player's renown adds to his renewal ask, as a percentage.
 *
 * Fame is not a percentage — it runs to `FAME_CEILING` — so it cannot be handed
 * to `renewalContractAsk` raw. One point of premium per four fame puts the
 * +100% maximum at 400, twice the star threshold and about nine seasons of
 * first-team football: a genuine household name, and the same maximum a
 * saturated player paid before. What changes is the middle, which used to be
 * flat: every starter in the game hit the old 99-fame maximum in his second
 * season and paid the full premium from then on, so the factor discriminated
 * between nobody.
 */
export function renewalFamePercent(fame: number): number {
  assertNonNegativeSafeInteger(fame, 'player fame');
  return Math.min(100, Math.round(fame / 4));
}

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
  const excludedPortraitIds = new Set(setup.excludedPortraitIds ?? []);
  const legends = (setup.retiredLegends ?? [])
    .slice()
    .sort((left, right) => compareIds(left.playerId, right.playerId));
  assertUniqueStrings(
    legends.map((legend) => legend.playerId),
    'retired legend player ID',
  );
  for (const legend of legends) validateRetiredLegend(legend);

  const marketSeed = mixSeed(setup.careerSeed, `coach-market:${setup.season}`);
  const random = mulberry32(marketSeed);
  const shuffledUnlockIds = unlockIds.slice();
  shuffleInPlace(
    shuffledUnlockIds,
    mulberry32(mixSeed(marketSeed, 'coach-unlocks')),
  );
  const targetCount = 3 + randomInteger(random, 3);
  const maxLevel = maxCoachLevelForClub(setup.division, setup.fame);
  const result: CoachCandidate[] = [];
  const availableIdentities = COACH_IDENTITIES.filter(
    (identity) => !excludedPortraitIds.has(identity.id),
  );

  for (const legend of legends.slice(0, targetCount)) {
    const level = Math.min(maxLevel, legendCoachLevel(legend.fame));
    const specialties =
      legend.specialties === undefined
        ? pickCoachSpecialties(
            mulberry32(mixSeed(marketSeed, `legend:${legend.playerId}`)),
          )
        : ([legend.specialties[0], legend.specialties[1]] as const);
    const baseWage = checkedMultiply(
      COACH_WAGE_PER_LEVEL,
      level,
      'legend coach wage',
    );
    result.push({
      id: `legend-${legend.playerId}`,
      portraitId: `legend-${legend.playerId}`,
      name: legend.name,
      age: legend.age ?? 35,
      specialties,
      level,
      weeklyWage: scaleByPercent(baseWage, 75, 'legend loyalty wage'),
      personality: legend.personality,
      requiredDivision: 6 - level,
      requiredFame: COACH_FAME_GATES[level],
      loyaltyDiscountPercent: 25,
      ...(result.length >= shuffledUnlockIds.length
        ? {}
        : { unlockId: shuffledUnlockIds[result.length] }),
      retiredLegendPlayerId: legend.playerId,
    });
  }

  while (result.length < targetCount) {
    const genericIndex = result.length;
    if (availableIdentities.length === 0) break;
    const identity = availableIdentities.splice(
      randomInteger(random, availableIdentities.length),
      1,
    )[0];
    const level =
      genericIndex === legends.length
        ? maxLevel
        : 1 + randomInteger(random, maxLevel);
    result.push({
      id: `coach-s${setup.season}-${identity.id}`,
      portraitId: identity.id,
      name: identity.name,
      age: identity.age,
      specialties: pickCoachSpecialties(random),
      level,
      weeklyWage: checkedMultiply(
        COACH_WAGE_PER_LEVEL,
        level,
        'coach weekly wage',
      ),
      personality: PERSONALITIES[randomInteger(random, PERSONALITIES.length)],
      requiredDivision: 6 - level,
      requiredFame: COACH_FAME_GATES[level],
      loyaltyDiscountPercent: 0,
      ...(result.length >= shuffledUnlockIds.length
        ? {}
        : { unlockId: shuffledUnlockIds[result.length] }),
    });
  }
  // Spread the headline specialty across the whole list, not just away from the
  // first candidate. Comparing only against `result[0]` left 1 and 2 free to
  // share a primary, and the market's own test only asserted more than one
  // distinct value, so a list reading DEFENSE / ATTACK / ATTACK passed.
  //
  // A swap is all that is available — the pair is already rolled — so a
  // collision that cannot be resolved by swapping is left alone rather than
  // rerolled, which would move the seeded stream.
  const takenPrimaries = new Set<CoachSpecialty>();
  return result.map((candidate) => {
    const [primary, secondary] = candidate.specialties;
    const swap = takenPrimaries.has(primary) && !takenPrimaries.has(secondary);
    takenPrimaries.add(swap ? secondary : primary);
    return swap
      ? { ...candidate, specialties: [secondary, primary] as const }
      : candidate;
  });
}

export function isCoachCandidateEligible(
  candidate: CoachCandidate,
  division: number,
  fame: number,
): boolean {
  validateDivision(division);
  assertNonNegativeSafeInteger(fame, 'club fame');
  return (
    division <= candidate.requiredDivision && fame >= candidate.requiredFame
  );
}

/** Coaches gain one level for every two full seasons employed, capped at level 5. */
export function coachLevelAfterSeasons(
  level: number,
  fullSeasonsEmployed: number,
): number {
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
  const bandPercent =
    minimumPercent +
    deterministicRoll(
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

function matchesScoutFocus(
  candidate: ScoutablePlayer,
  focus: ScoutFocus,
): boolean {
  if (focus.kind === 'POSITION') return candidate.role === focus.role;
  if (focus.kind === 'AGE') {
    return (
      candidate.age >= focus.minimumAge && candidate.age <= focus.maximumAge
    );
  }
  if (focus.kind === 'ELITE_PROSPECT') {
    return candidate.age <= 23 && candidate.potential >= 4;
  }
  if (focus.kind === 'PROFILE') {
    return (
      (focus.role === undefined || candidate.role === focus.role) &&
      (focus.prospectType !== 'YOUNG_PROSPECT' || candidate.age <= 21)
    );
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
  const start =
    minimumStart +
    deterministicRoll(seed, 'range', maximumStart - minimumStart + 1);
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

function moodForOffer(
  effectiveOffer: number,
  effectiveAsk: number,
): NegotiationMood {
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
  return moods[
    Math.max(0, Math.min(moods.length - 1, moods.indexOf(mood) + steps))
  ];
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
  if (
    mission.dueWeek - mission.startWeek < 2 ||
    mission.dueWeek - mission.startWeek > 4
  ) {
    throw new Error('scouting missions must take 2 to 4 weeks');
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
    if (
      !Number.isSafeInteger(focus.minimumAge) ||
      !Number.isSafeInteger(focus.maximumAge) ||
      focus.minimumAge < 16 ||
      focus.maximumAge > 45 ||
      focus.minimumAge > focus.maximumAge
    ) {
      throw new Error('scouting age focus must be a valid range from 16 to 45');
    }
    return;
  }
  if (focus.kind === 'PROFILE') {
    if (
      ![
        'IMMEDIATE_STARTER',
        'YOUNG_PROSPECT',
        'SPECIALIST',
        'BARGAIN',
      ].includes(focus.prospectType) ||
      (focus.role !== undefined &&
        !['GK', 'DEF', 'MID', 'FWD'].includes(focus.role))
    ) {
      throw new Error('scouting profile focus is invalid');
    }
    return;
  }
  if (focus.kind !== 'RUMORED_HERO' && focus.kind !== 'ELITE_PROSPECT') {
    throw new Error('unknown scouting focus');
  }
}

function scoutFocusKey(focus: ScoutFocus): string {
  if (focus.kind === 'POSITION') return `${focus.kind}:${focus.role}`;
  if (focus.kind === 'PROFILE')
    return `${focus.kind}:${focus.prospectType}:${focus.role ?? 'ANY'}`;
  if (focus.kind === 'AGE')
    return `${focus.kind}:${focus.minimumAge}-${focus.maximumAge}`;
  return focus.kind;
}

function validateScoutOfficeLevel(level: number): void {
  if (!Number.isSafeInteger(level) || level < 0 || level > 3) {
    throw new Error('Scout Office level must be an integer from 0 to 3');
  }
}

function validateScoutablePlayer(player: ScoutablePlayer): void {
  assertNonEmptyString(player.id, 'scouting candidate ID');
  if (REGION_COST[player.region] === undefined)
    throw new Error('scouting candidate region is unknown');
  validateAge(player.age);
  validateAttrs(player.attrs, `scouting candidate ${player.id}`);
  validatePotential(player.potential);
  validatePersonality(player.personality);
  if (player.powerTier !== undefined) validatePowerTier(player.powerTier);
  if (
    !Number.isSafeInteger(player.contractSeasonsRemaining) ||
    player.contractSeasonsRemaining < 0 ||
    player.contractSeasonsRemaining > 3
  ) {
    throw new Error(
      'candidate contract seasons must be an integer from 0 to 3',
    );
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
  if (
    !Number.isSafeInteger(player.contractSeasonsRemaining) ||
    player.contractSeasonsRemaining < 0 ||
    player.contractSeasonsRemaining > 3
  ) {
    throw new Error(
      'contract seasons remaining must be an integer from 0 to 3',
    );
  }
}

function validateTransferQuoteContext(context: TransferQuoteContext): void {
  assertUint32(context.careerSeed, 'transfer quote career seed');
  assertPositiveSafeInteger(context.season, 'transfer quote season');
  if (
    !Number.isSafeInteger(context.week) ||
    context.week < 1 ||
    context.week > 30
  ) {
    throw new Error('transfer quote week must be an integer from 1 to 30');
  }
  validateDivision(context.sellingClubDivision);
}

function validateContractOffer(offer: ContractOffer): void {
  assertPositiveSafeInteger(offer.weeklyWage, 'offered weekly wage');
  if (
    !Number.isSafeInteger(offer.termSeasons) ||
    offer.termSeasons < 1 ||
    offer.termSeasons > 3
  ) {
    throw new Error('contract term must be an integer from 1 to 3 seasons');
  }
  validateContractPerk(offer.perk);
}

function validateContractPerk(perk: ContractPerk): void {
  if (
    ![
      'GUARANTEED_STARTER',
      'CAPTAINCY',
      'TRAINING_PRIORITY',
      'JERSEY_10',
    ].includes(perk)
  ) {
    throw new Error('contract offer has an unknown perk');
  }
}

function validateNegotiation(negotiation: ContractNegotiation): void {
  assertNonEmptyString(negotiation.id, 'negotiation ID');
  assertNonEmptyString(negotiation.playerId, 'negotiation player ID');
  validatePersonality(negotiation.personality);
  assertPositiveSafeInteger(negotiation.weeklyAsk, 'weekly contract ask');
  if (
    !Number.isSafeInteger(negotiation.round) ||
    negotiation.round < 0 ||
    negotiation.round > 3 ||
    negotiation.history.length !== negotiation.round
  ) {
    throw new Error('negotiation round history is invalid');
  }
  if (
    !Number.isSafeInteger(negotiation.pitchInfluencePercent) ||
    negotiation.pitchInfluencePercent < -20 ||
    negotiation.pitchInfluencePercent > 20
  ) {
    throw new Error('negotiation pitch influence must stay within +/-20%');
  }
  if (negotiation.pitchCards.length !== 3)
    throw new Error('negotiation must deal 3 pitch cards');
  assertUniqueStrings(negotiation.pitchCards, 'dealt pitch card');
  assertUniqueStrings(negotiation.usedPitchCards, 'used pitch card');
}

function validatePitchCard(pitchCard: PitchCard): void {
  if (!PITCH_CARDS.includes(pitchCard)) throw new Error('unknown pitch card');
}

function validatePersonality(personality: PlayerPersonality): void {
  if (!PERSONALITIES.includes(personality))
    throw new Error('unknown personality');
}

function validateRetiredLegend(legend: RetiredLegendCoachInput): void {
  assertNonEmptyString(legend.playerId, 'retired legend player ID');
  assertNonEmptyString(legend.name, 'retired legend name');
  validatePersonality(legend.personality);
  assertNonNegativeSafeInteger(legend.fame, 'retired legend fame');
  if (
    legend.age !== undefined &&
    (!Number.isSafeInteger(legend.age) || legend.age < 30 || legend.age > 60)
  ) {
    throw new Error('retired coach candidates must be age 30 to 60');
  }
  if (!Number.isSafeInteger(legend.seasonsAtClub) || legend.seasonsAtClub < 5) {
    throw new Error(
      'retired coach candidates must have at least 5 club seasons',
    );
  }
  if (legend.specialties !== undefined) {
    if (
      legend.specialties[0] === legend.specialties[1] ||
      !COACH_SPECIALTIES.includes(legend.specialties[0]) ||
      !COACH_SPECIALTIES.includes(legend.specialties[1])
    ) {
      throw new Error(
        'retired legend coach specialties must be two distinct specialties',
      );
    }
  }
}

function validateAttrs(attrs: Readonly<Attrs>, label: string): void {
  for (const attribute of ATTR_NAMES) {
    const value = attrs[attribute];
    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > MAX_PLAYER_ATTRIBUTE
    ) {
      throw new Error(
        `${label} ${attribute} must be an integer from 1 to ${MAX_PLAYER_ATTRIBUTE}`,
      );
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
  if (!Number.isSafeInteger(result))
    throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

function checkedMultiply(left: number, right: number, label: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result))
    throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

function checkedRound(value: number, label: string): number {
  const result = Math.round(value);
  if (!Number.isSafeInteger(result))
    throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

function scaleByPercent(value: number, percent: number, label: string): number {
  return checkedRound(checkedMultiply(value, percent, label) / 100, label);
}

function deterministicRoll(
  seed: number,
  key: string,
  upperExclusive: number,
): number {
  if (!Number.isSafeInteger(upperExclusive) || upperExclusive < 1) {
    throw new Error(
      'deterministic roll upper bound must be a positive safe integer',
    );
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
