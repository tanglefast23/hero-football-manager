import { mulberry32, type Rng } from '../sim/rng';
import type { Attrs, Role } from '../sim/types';
import {
  archetypeTrainingBonusPercent,
  developmentPotentialCeiling,
  POSITION_TRAINING_ATTRIBUTES,
  potentialTierForDivision,
} from './archetype-caps';
import { nextDistinctPlayerLook } from './player-appearance';
import type {
  CareerPlayer,
  GameState,
  PlayerArchetype,
  PlayerPersonality,
} from './types';
import { recordCashTransaction } from './cash-transactions';
import { isFacilityOperational } from './facilities';
import { DIVISION_TYPICAL_PACE, type DivisionLevel } from './pyramid';
import { reducedPlayerWeeklyWage } from './market';
import { PROMOTION_WAGE_CLAUSE_PERCENT } from './contract-wages';
import {
  isStoryFeaturePacingActive,
  isStoryYouthUnlocked,
} from './story-progression';

const YOUTH_INTAKE_SCHEMA_VERSION = 1;
export const BASE_ROSTER_CAPACITY = 16;

interface YouthIntakeOffer {
  readonly player: CareerPlayer;
  readonly signingBonus: number;
}

/** Plain optional sidecar data; safe for JSON saves without Maps or classes. */
export interface YouthIntakeState {
  readonly schemaVersion: typeof YOUTH_INTAKE_SCHEMA_VERSION;
  readonly season: number;
  readonly status: 'OPEN' | 'CLOSED';
  readonly offers: readonly YouthIntakeOffer[];
  readonly signedPlayerIds: readonly string[];
  readonly declined: boolean;
}

interface YouthIntakeTransaction {
  readonly state: GameState;
  readonly intake: YouthIntakeState;
  readonly signedPlayerId?: string;
  readonly signingBonusPaid: number;
}

/**
 * Story onboarding adds the user's created player without deleting the player
 * they replace in the starting eleven. Preserve that established save shape as
 * one explicit roster slot instead of letting the effective cap drift with the
 * current squad size.
 */
export function careerRosterCapacity(
  state: Pick<GameState, 'onboarding' | 'players' | 'userClubId'>,
): number {
  const createdPlayerId = state.onboarding?.createdPlayerId;
  const hasCreatedPlayer =
    createdPlayerId !== undefined &&
    state.players.some(
      (player) =>
        player.id === createdPlayerId && player.clubId === state.userClubId,
    );
  return BASE_ROSTER_CAPACITY + (hasCreatedPlayer ? 1 : 0);
}

export function userCareerRosterCount(
  state: Pick<GameState, 'players' | 'userClubId'>,
): number {
  return state.players.filter((player) => player.clubId === state.userClubId)
    .length;
}

export function assertUserCareerRosterSpace(
  state: Pick<GameState, 'onboarding' | 'players' | 'userClubId'>,
): void {
  const capacity = careerRosterCapacity(state);
  if (userCareerRosterCount(state) >= capacity) {
    throw new Error(`the ${capacity}-player roster is full`);
  }
}

const ROLES: readonly Role[] = ['GK', 'DEF', 'MID', 'FWD'];
const ARCHETYPES: readonly PlayerArchetype[] = [
  'Speedster',
  'Sniper',
  'Playmaker',
  'Anchor',
  'Wall',
  'Engine',
  'All-Rounder',
  'Prodigy',
];
const PERSONALITIES: readonly PlayerPersonality[] = [
  'Fiery',
  'Loyal',
  'Greedy',
  'Joker',
  'Professional',
  'Timid',
];
const FIRST_NAMES = [
  'Ari',
  'Cal',
  'Dara',
  'Eli',
  'Finn',
  'Gio',
  'Ivo',
  'Jae',
  'Kai',
  'Milo',
  'Nico',
  'Remy',
] as const;
export const YOUTH_LAST_NAMES = [
  'Ash',
  'Cole',
  'Flint',
  'Gray',
  'Hart',
  'Lane',
  'Moss',
  'Oak',
  'Reed',
  'Stone',
  'Vale',
  'Ward',
] as const;
const ROLE_TARGETS: Readonly<Record<Role, number>> = {
  GK: 2,
  DEF: 5,
  MID: 5,
  FWD: 4,
};
const SIGNING_BONUS_BY_FIELD_LEVEL = [500, 750, 1000, 1250] as const;

/** Generates two real choices. A full roster blocks signing, not discovery. */
export function createPreseasonYouthIntake(state: GameState): YouthIntakeState {
  assertPreseasonManagePhase(state);
  validateSeed(state.careerSeed);
  const roster = userRoster(state);

  const random = mulberry32(
    mixSeed(state.careerSeed, state.season, 'youth-intake'),
  );
  const offeredCount = 2;
  const fieldLevel = youthFieldLevel(state);
  const roles = youthRoles(roster, offeredCount, random);
  const appearancePool = [...state.players];
  const offers = roles.map((role, index) => {
    const offer = createOffer(state, role, index, fieldLevel, random);
    const player = {
      ...offer.player,
      lookId: nextDistinctPlayerLook(offer.player, appearancePool),
    };
    appearancePool.push(player);
    return { ...offer, player };
  });

  return {
    schemaVersion: YOUTH_INTAKE_SCHEMA_VERSION,
    season: state.season,
    status: 'OPEN',
    offers,
    signedPlayerIds: [],
    declined: false,
  };
}

/** Creates this season's open intake or an explicit closed clock state. */
export function initializeSeasonYouthIntake(
  state: GameState,
): YouthIntakeState {
  if (isYouthIntakeWindowOpen(state)) return createPreseasonYouthIntake(state);
  validateSeason(state.season);
  userClub(state);
  return closedYouthIntake(state.season);
}

/** Keeps the first academy choice off the desk until Bert introduces it in Week 2. */
export function reconcileStoryYouthIntake(state: GameState): GameState {
  if (!isStoryFeaturePacingActive(state)) return expireYouthIntakeWindow(state);
  const intake = state.youthIntake;
  if (!isStoryYouthUnlocked(state)) {
    if (
      intake?.status === 'CLOSED' &&
      intake.offers.length === 0 &&
      intake.signedPlayerIds.length === 0 &&
      !intake.declined
    ) {
      return state;
    }
    return { ...state, youthIntake: closedYouthIntake(state.season) };
  }
  if (
    isYouthIntakeWindowOpen(state) &&
    (intake === undefined ||
      (intake.status === 'CLOSED' &&
        intake.offers.length === 0 &&
        intake.signedPlayerIds.length === 0 &&
        !intake.declined))
  ) {
    return { ...state, youthIntake: createPreseasonYouthIntake(state) };
  }
  return expireYouthIntakeWindow(state);
}

/**
 * Clears stale offers as soon as the career moves beyond pre-season Week 4.
 *
 * The check is week-based, not window-based: a save made mid-matchday in a
 * week <=4 persists phase 'matchday', and expiring on phase would delete the
 * open offers on the first reload and brick the save on the second (the
 * recreate branch asserts the manage phase).
 */
function expireYouthIntakeWindow(state: GameState): GameState {
  const intake = state.youthIntake;
  if (
    intake === undefined ||
    intake.status === 'CLOSED' ||
    isWithinPreseasonWeeks(state)
  ) {
    return state;
  }
  return {
    ...state,
    youthIntake: {
      ...intake,
      status: 'CLOSED',
      offers: [],
    },
  };
}

/** Signs one offer, pays its explicit bonus, and leaves a second offer open if a slot remains. */
export function signYouthIntakeOffer(
  state: GameState,
  intake: YouthIntakeState,
  playerId: string,
): YouthIntakeTransaction {
  assertPreseasonManagePhase(state);
  validateYouthIntake(intake, state.season);
  if (intake.status !== 'OPEN') throw new Error('the youth intake is closed');
  if (typeof playerId !== 'string' || playerId.trim().length === 0) {
    throw new Error('youth offer player ID must be a non-empty string');
  }
  const offer = intake.offers.find(
    (candidate) => candidate.player.id === playerId,
  );
  if (offer === undefined)
    throw new Error(`unknown youth intake offer ${playerId}`);
  if (offer.player.clubId !== state.userClubId) {
    throw new Error('youth intake offer belongs to a different club');
  }
  if (state.players.some((player) => player.id === playerId)) {
    throw new Error(`player ID ${playerId} is already in the career`);
  }
  const roster = userRoster(state);
  const rosterCapacity = careerRosterCapacity(state);
  assertUserCareerRosterSpace(state);
  const club = userClub(state);
  if (club.cash < offer.signingBonus)
    throw new Error('the youth signing bonus is not affordable');

  const signedPlayer = clonePlayer({
    ...offer.player,
    lookId:
      offer.player.lookId ??
      nextDistinctPlayerLook(offer.player, state.players),
  });
  const players = [...state.players, signedPlayer];
  const clubs = state.clubs.map((candidate) =>
    candidate.id === state.userClubId
      ? {
          ...candidate,
          cash: candidate.cash - offer.signingBonus,
          weeklyWages: checkedAdd(
            candidate.weeklyWages,
            signedPlayer.weeklyWage,
            'club weekly wages after youth signing',
          ),
        }
      : candidate,
  );
  const remainingSlots = rosterCapacity - (roster.length + 1);
  const storyChoiceComplete = isStoryFeaturePacingActive(state);
  const remainingOffers =
    remainingSlots > 0 && !storyChoiceComplete
      ? intake.offers
          .filter((candidate) => candidate.player.id !== playerId)
          .map(cloneOffer)
      : [];
  const nextIntake: YouthIntakeState = {
    ...intake,
    status: remainingOffers.length > 0 ? 'OPEN' : 'CLOSED',
    offers: remainingOffers,
    signedPlayerIds: [...intake.signedPlayerIds, playerId],
  };

  const signedState = recordCashTransaction(
    { ...state, players, clubs },
    {
      kind: 'youth-signing',
      label: `Youth signing · ${signedPlayer.name}`,
      labelKey: 'ledger.youthSigning',
      labelParams: { player: signedPlayer.name },
      amount: -offer.signingBonus,
      referenceId: playerId,
    },
  );
  return {
    state: signedState,
    intake: nextIntake,
    signedPlayerId: playerId,
    signingBonusPaid: offer.signingBonus,
  };
}

/** Declines every remaining offer and closes this season's intake. */
export function declineYouthIntakeOffers(
  state: GameState,
  intake: YouthIntakeState,
): YouthIntakeTransaction {
  assertPreseasonManagePhase(state);
  validateYouthIntake(intake, state.season);
  if (intake.status !== 'OPEN') throw new Error('the youth intake is closed');
  return {
    state,
    intake: {
      ...intake,
      status: 'CLOSED',
      offers: [],
      signedPlayerIds: [...intake.signedPlayerIds],
      declined: true,
    },
    signingBonusPaid: 0,
  };
}

/** The best operational field wins; `.find()` used to take the first one built. */
export function youthFieldLevel(
  state: Pick<GameState, 'facilities'>,
): 0 | 1 | 2 | 3 {
  const grid = state.facilities.grid;
  if (grid === undefined) return 0;
  let level: 0 | 1 | 2 | 3 = 0;
  for (const building of grid.buildings) {
    if (building.type !== 'youth-field') continue;
    if (!isFacilityOperational(grid, building.id)) continue;
    if (building.level > level) level = building.level;
  }
  return level;
}

/** The user club's division, defaulting to D5 before the pyramid exists. */
function userDivisionLevel(state: GameState): DivisionLevel {
  return (
    state.m2?.pyramid.divisions.find((candidate) =>
      candidate.clubs.some((club) => club.id === state.userClubId),
    )?.level ?? 5
  );
}

export function youthSigningBonus(fieldLevel: 0 | 1 | 2 | 3): number {
  return SIGNING_BONUS_BY_FIELD_LEVEL[fieldLevel];
}

/**
 * Fail-soft academy relief after a board sale. It is deliberately cheaper than
 * a normal intake prospect, but stays near the D5 starting strength so repeated
 * rescue sales cannot permanently destroy the squad.
 */
export function createEmergencyYouthReplacement(
  state: GameState,
  role: Role,
  sourceId: string,
): CareerPlayer {
  validateSeed(state.careerSeed);
  if (!ROLES.includes(role))
    throw new Error(`unknown emergency youth role ${String(role)}`);
  if (typeof sourceId !== 'string' || sourceId.length === 0) {
    throw new Error('emergency youth source ID must be a non-empty string');
  }
  const random = mulberry32(
    mixSeed(
      state.careerSeed,
      state.season,
      `board-relief:${state.week}:${sourceId}:${role}`,
    ),
  );
  const fieldLevel = youthFieldLevel(state);
  const targetStrength = 37 + fieldLevel * 3 + integerRoll(random, 0, 4);
  const attrs = generateAttributes(targetStrength, role, random);
  const id = `board-relief-s${state.season}-w${state.week}-${hashString(`${sourceId}:${role}`).toString(16)}`;
  if (state.players.some((player) => player.id === id)) {
    throw new Error(`player ID ${id} is already in the career`);
  }
  /*
   * The rescue is a prospect, not just a body: the same division-scaled roll a
   * normal intake gets, and the same Youth Field bonus on it.
   *
   * Floored at 2, which is not timidity — it is the whole reason this reads as
   * an upgrade. `potentialTierForDivision` is deliberately humble at the bottom
   * and returns tier 1 on 90% of Division 5 rolls, so handing board relief the
   * raw roll would have made the rescue WORSE in the division where the board
   * actually sells players. The floor keeps today's guarantee everywhere and
   * lets D4 and above draw better, which is where the roll has room to give.
   */
  const potentialRoll = Math.max(
    0,
    integerRoll(random, 0, 99) - fieldLevel * 10,
  );
  const rolledPotential = potentialTierForDivision(
    userDivisionLevel(state),
    potentialRoll,
  );
  const potential = rolledPotential === 1 ? 2 : rolledPotential;
  return {
    id,
    clubId: state.userClubId,
    name: `${FIRST_NAMES[integerRoll(random, 0, FIRST_NAMES.length - 1)]} ${YOUTH_LAST_NAMES[integerRoll(random, 0, YOUTH_LAST_NAMES.length - 1)]}`,
    role,
    lookId: nextDistinctPlayerLook({ id, role }, state.players),
    attrs,
    licensed: false,
    weeklyWage: reducedPlayerWeeklyWage(75 + targetStrength * 2),
    onHeroWage: false,
    contractSeasonsRemaining: 2,
    morale: 55,
    injuryWeeks: 0,
    age: 17,
    archetype: 'All-Rounder',
    potential,
    potentialCeiling: developmentPotentialCeiling({
      id,
      role,
      attrs,
      age: 17,
      potential,
    }),
    consistency: 50 + integerRoll(random, 0, 10),
    personality: 'Professional',
    condition: 100,
    seasonsAtClub: 0,
    fame: 0,
    retirementAge: 35,
    retirementAnnounced: false,
    consecutiveLowMoraleWeeks: 0,
    signingStatTotal: Object.values(attrs).reduce(
      (sum, value) => sum + value,
      0,
    ),
  };
}

function createOffer(
  state: GameState,
  role: Role,
  index: number,
  fieldLevel: 0 | 1 | 2 | 3,
  random: Rng,
): YouthIntakeOffer {
  const division = userDivisionLevel(state);
  const targetStrength =
    32 + fieldLevel * 5 + (5 - division) * 3 + integerRoll(random, 0, 6);
  const paceTarget = Math.max(
    targetStrength,
    DIVISION_TYPICAL_PACE[division] - 10 + fieldLevel * 2,
  );
  const attrs = generateAttributes(targetStrength, role, random, paceTarget);
  const id = `youth-s${state.season}-${index + 1}`;
  if (state.players.some((player) => player.id === id)) {
    throw new Error(`player ID ${id} is already in the career`);
  }
  // Better youth fields improve the roll within the current division's talent
  // pool. They cannot reveal A-range talent before D1.
  const potentialRoll = Math.max(
    0,
    integerRoll(random, 0, 99) - fieldLevel * 10,
  );
  const potential = potentialTierForDivision(division, potentialRoll);
  const age = integerRoll(random, 16, 17);
  const retirementAge = 33 + integerRoll(random, 0, 5);
  const compatibleArchetypes = ARCHETYPES.filter((archetype) =>
    POSITION_TRAINING_ATTRIBUTES[role].some(
      (attribute) => archetypeTrainingBonusPercent(archetype, attribute) > 0,
    ),
  );
  const player: CareerPlayer = {
    id,
    clubId: state.userClubId,
    name: `${FIRST_NAMES[integerRoll(random, 0, FIRST_NAMES.length - 1)]} ${YOUTH_LAST_NAMES[integerRoll(random, 0, YOUTH_LAST_NAMES.length - 1)]}`,
    role,
    attrs,
    licensed: false,
    weeklyWage: reducedPlayerWeeklyWage(100 + targetStrength * 3),
    promotionWagePercent: PROMOTION_WAGE_CLAUSE_PERCENT,
    onHeroWage: false,
    contractSeasonsRemaining: 3,
    morale: 65,
    injuryWeeks: 0,
    age,
    archetype:
      compatibleArchetypes[
        integerRoll(random, 0, compatibleArchetypes.length - 1)
      ],
    potential,
    potentialCeiling: developmentPotentialCeiling({
      id,
      role,
      attrs,
      age,
      potential,
    }),
    consistency: 45 + integerRoll(random, 0, 30),
    personality:
      PERSONALITIES[integerRoll(random, 0, PERSONALITIES.length - 1)],
    condition: 100,
    seasonsAtClub: 0,
    fame: 0,
    retirementAge,
    retirementAnnounced: false,
    consecutiveLowMoraleWeeks: 0,
    signingStatTotal: Object.values(attrs).reduce(
      (sum, value) => sum + value,
      0,
    ),
  };
  return { player, signingBonus: youthSigningBonus(fieldLevel) };
}

function youthRoles(
  roster: readonly CareerPlayer[],
  count: number,
  random: Rng,
): Role[] {
  const counts: Record<Role, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const player of roster) counts[player.role] += 1;
  const roles: Role[] = [];
  for (let index = 0; index < count; index += 1) {
    const shuffledRoles = ROLES.map((role) => ({ role, tie: random() })).sort(
      (left, right) => {
        const leftDeficit = ROLE_TARGETS[left.role] - counts[left.role];
        const rightDeficit = ROLE_TARGETS[right.role] - counts[right.role];
        return rightDeficit - leftDeficit || left.tie - right.tie;
      },
    );
    const role = shuffledRoles[0].role;
    roles.push(role);
    counts[role] += 1;
  }
  return roles;
}

function generateAttributes(
  target: number,
  role: Role,
  random: Rng,
  paceTarget = target,
): Attrs {
  const roleNudges: Readonly<Record<Role, Attrs>> = {
    GK: { pac: -5, sho: -8, pas: 0, def: 3, tec: 0, sta: 0, ref: 10 },
    DEF: { pac: 0, sho: -4, pas: 0, def: 7, tec: -1, sta: 3, ref: -5 },
    MID: { pac: 0, sho: 0, pas: 6, def: 0, tec: 6, sta: 3, ref: -5 },
    FWD: { pac: 4, sho: 7, pas: 0, def: -5, tec: 3, sta: 0, ref: -5 },
  };
  const nudges = roleNudges[role];
  const value = (nudge: number) =>
    clampRating(target + nudge + integerRoll(random, -3, 3));
  return {
    pac: clampRating(paceTarget + nudges.pac + integerRoll(random, -3, 3)),
    sho: value(nudges.sho),
    pas: value(nudges.pas),
    def: value(nudges.def),
    tec: value(nudges.tec),
    sta: value(nudges.sta),
    ref: value(nudges.ref),
  };
}

function validateYouthIntake(intake: YouthIntakeState, season: number): void {
  if (intake.schemaVersion !== YOUTH_INTAKE_SCHEMA_VERSION) {
    throw new Error(`unsupported youth intake schema ${intake.schemaVersion}`);
  }
  if (
    !Number.isSafeInteger(intake.season) ||
    intake.season < 1 ||
    intake.season !== season
  ) {
    throw new Error('youth intake belongs to a different season');
  }
  if (intake.status !== 'OPEN' && intake.status !== 'CLOSED') {
    throw new Error('youth intake status is invalid');
  }
  if (typeof intake.declined !== 'boolean')
    throw new Error('youth intake declined flag is invalid');
  const offerIds = intake.offers.map((offer) => offer.player.id);
  if (new Set(offerIds).size !== offerIds.length)
    throw new Error('youth offer player IDs must be unique');
  if (new Set(intake.signedPlayerIds).size !== intake.signedPlayerIds.length) {
    throw new Error('signed youth player IDs must be unique');
  }
  for (const offer of intake.offers) {
    if (!Number.isSafeInteger(offer.signingBonus) || offer.signingBonus < 0) {
      throw new Error('youth signing bonus must be a nonnegative safe integer');
    }
    if (
      offer.player.clubId.trim().length === 0 ||
      offer.player.id.trim().length === 0
    ) {
      throw new Error('youth offers require player and club IDs');
    }
    if (offer.player.age !== 16 && offer.player.age !== 17) {
      throw new Error('youth offers must be age 16 or 17');
    }
  }
}

function userRoster(state: GameState): CareerPlayer[] {
  return state.players.filter((player) => player.clubId === state.userClubId);
}

function userClub(state: GameState) {
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined)
    throw new Error(`unknown user club ${state.userClubId}`);
  return club;
}

function assertPreseasonManagePhase(state: GameState): void {
  if (state.phase !== 'manage')
    throw new Error('youth intake decisions require the manage phase');
  validateSeason(state.season);
  if (!Number.isSafeInteger(state.week) || state.week < 1 || state.week > 4) {
    throw new Error(
      'youth intake is available only during pre-season weeks 1-4',
    );
  }
  userClub(state);
}

function isYouthIntakeWindowOpen(
  state: Pick<GameState, 'phase' | 'season' | 'week'>,
): boolean {
  return state.phase === 'manage' && isWithinPreseasonWeeks(state);
}

function isWithinPreseasonWeeks(
  state: Pick<GameState, 'season' | 'week'>,
): boolean {
  return (
    Number.isSafeInteger(state.season) &&
    state.season >= 1 &&
    Number.isSafeInteger(state.week) &&
    state.week >= 1 &&
    state.week <= 4
  );
}

function validateSeason(season: number): void {
  if (!Number.isSafeInteger(season) || season < 1) {
    throw new Error('youth intake season must be a positive safe integer');
  }
}

function closedYouthIntake(season: number): YouthIntakeState {
  return {
    schemaVersion: YOUTH_INTAKE_SCHEMA_VERSION,
    season,
    status: 'CLOSED',
    offers: [],
    signedPlayerIds: [],
    declined: false,
  };
}

function validateSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) {
    throw new Error('youth intake career seed must be a uint32');
  }
}

function cloneOffer(offer: YouthIntakeOffer): YouthIntakeOffer {
  return {
    player: clonePlayer(offer.player),
    signingBonus: offer.signingBonus,
  };
}

function clonePlayer(player: CareerPlayer): CareerPlayer {
  return { ...player, attrs: { ...player.attrs } };
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result))
    throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

function clampRating(value: number): number {
  return Math.max(1, Math.min(999, value));
}

function integerRoll(random: Rng, minimum: number, maximum: number): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function mixSeed(careerSeed: number, season: number, key: string): number {
  return (
    (careerSeed ^
      Math.imul(season, 0x9e3779b1) ^
      Math.imul(hashString(key), 0x85ebca6b)) >>>
    0
  );
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
