import type { Attrs } from '../sim/types';
import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import { roleOverall } from './archetype-caps';
import {
  advanceNationalCup,
  applyDivisionFourRelegationPack,
  createNationalCup,
  generateLeaguePyramid,
  resolvePromotionAndRelegation,
  resolveSeasonEndLifecycle,
  retirementAnnouncementAge,
  type DivisionFinishOrder,
  type DivisionLevel,
  type DivisionMovement,
  type LeaguePyramid,
  type NationalCup,
  type NationalCupResult,
  type PyramidClub,
  type PyramidPlayer,
  type RetirementAnnouncement,
} from './pyramid';
import type {
  CareerPlayer,
  GameState,
  PlayerArchetype,
  PlayerPersonality,
} from './types';

export const M2_CAREER_SCHEMA_VERSION = 1;
const UINT32_MAX = 4294967295;

export interface M2UserClubIdentity {
  id: string;
  name: string;
  squadStrength: number;
}

export interface M2CareerInitialization {
  careerSeed: number;
  userClub: M2UserClubIdentity;
}

/** Sidecar state until the shared GameState/save schema adopts M2 fields. */
export interface M2CareerState {
  schemaVersion: number;
  careerSeed: number;
  userClubId: string;
  /** Best tier ever reached; lower division numbers are stronger tiers. */
  highestDivisionReached?: DivisionLevel;
  pyramid: LeaguePyramid;
  nationalCups: NationalCup[];
}

export interface M2PromotionResolution {
  state: M2CareerState;
  movements: DivisionMovement[];
}

export interface ActiveDivisionSnapshot {
  readonly clubs: GameState['clubs'];
  readonly players: GameState['players'];
}

export type StructuralCareerPlayer = CareerPlayer & {
  age?: number;
  archetype?: PlayerArchetype;
  personality?: PlayerPersonality;
  condition?: number;
  seasonsAtClub?: number;
  fame?: number;
  retirementAge?: number;
  retirementAnnounced?: boolean;
  consecutiveLowMoraleWeeks?: number;
  retirementAnnouncementSeason?: number;
};

export interface M2CareerPlayer extends Omit<
  CareerPlayer,
  | 'age'
  | 'archetype'
  | 'personality'
  | 'condition'
  | 'seasonsAtClub'
  | 'fame'
  | 'retirementAge'
  | 'retirementAnnounced'
> {
  age: number;
  archetype: PlayerArchetype;
  personality: PlayerPersonality;
  condition: number;
  seasonsAtClub: number;
  fame: number;
  consecutiveLowMoraleWeeks: number;
  retirementAge: number;
  retirementAnnounced: boolean;
  retirementAnnouncementSeason?: number;
}

export interface M2CareerLifecycleResult {
  activePlayers: M2CareerPlayer[];
  retiredPlayers: M2CareerPlayer[];
  announcements: RetirementAnnouncement[];
}

export interface EndlessCareerSeasonTransitionPlan {
  nextSeason: number;
  division: DivisionLevel;
  /** Pyramid after every non-user club receives this season's single growth step. */
  state: M2CareerState;
  activeClubs: PyramidClub[];
  activeClubIds: string[];
  generatedOpponentClubs: PyramidClub[];
  generatedOpponentPlayers: PyramidPlayer[];
}

/** True when the player has completed their announced final season. */
export function willRetireAtSeasonTransition(
  player: Pick<StructuralCareerPlayer, 'retirementAnnounced' | 'retirementAnnouncementSeason'>,
  completedSeason: number,
): boolean {
  validateSeason(completedSeason);
  if (player.retirementAnnouncementSeason !== undefined) {
    return player.retirementAnnouncementSeason < completedSeason;
  }
  // Legacy schema-1 saves recorded only the boolean. Lifecycle normalization
  // treats those announcements as coming from the previous season.
  return player.retirementAnnounced === true;
}

/**
 * Builds all five divisions and uses one generated Division-5 slot for the real
 * user club. The user's actual squad remains in GameState rather than being
 * duplicated in this sidecar, so its pyramid squad is intentionally empty.
 */
export function initializeM2Career(input: M2CareerInitialization): M2CareerState {
  validateSeed(input.careerSeed);
  validateUserClub(input.userClub);
  const generated = generateLeaguePyramid(input.careerSeed);
  const generatedIds = new Set(generated.divisions.flatMap(division =>
    division.clubs.map(club => club.id),
  ));
  const replacedClubId = generated.divisions
    .find(division => division.level === 5)!
    .clubs[0].id;
  generatedIds.delete(replacedClubId);
  if (generatedIds.has(input.userClub.id)) {
    throw new Error(`user club ID ${input.userClub.id} collides with a generated club`);
  }

  const divisions = generated.divisions.map(division => ({
    level: division.level,
    clubs: division.clubs.map(club => club.id !== replacedClubId
      ? cloneClub(club)
      : {
          id: input.userClub.id,
          name: input.userClub.name,
          division: 5 as const,
          squadStrength: input.userClub.squadStrength,
          squad: [],
        }),
  }));

  return {
    schemaVersion: M2_CAREER_SCHEMA_VERSION,
    careerSeed: input.careerSeed,
    userClubId: input.userClub.id,
    highestDivisionReached: 5,
    pyramid: { careerSeed: input.careerSeed, divisions },
    nationalCups: [],
  };
}

export function currentUserDivision(state: M2CareerState): DivisionLevel {
  const matches = state.pyramid.divisions.filter(division =>
    division.clubs.some(club => club.id === state.userClubId),
  );
  if (matches.length !== 1) {
    throw new Error(`user club ${state.userClubId} must appear in exactly one division`);
  }
  return matches[0].level;
}

/**
 * Replaces the generated starting tier with the validated clubs already used
 * by the M1 match loop. This keeps familiar rivals and makes their cup IDs and
 * first promotion table agree with the active career.
 */
export function synchronizeM2ActiveDivision(
  state: M2CareerState,
  snapshot: ActiveDivisionSnapshot,
  division = currentUserDivision(state),
): M2CareerState {
  validateStateIdentity(state);
  if (snapshot.clubs.length !== 10) throw new Error('an active division requires exactly ten clubs');
  const clubIds = new Set(snapshot.clubs.map(club => club.id));
  if (clubIds.size !== 10 || !clubIds.has(state.userClubId)) {
    throw new Error('active division club IDs must be unique and include the user club');
  }
  const outsideIds = new Set(state.pyramid.divisions
    .filter(candidate => candidate.level !== division)
    .flatMap(candidate => candidate.clubs.map(club => club.id)));
  if ([...clubIds].some(id => outsideIds.has(id))) {
    throw new Error('an active division club ID collides with another pyramid tier');
  }
  const pyramidClubs = snapshot.clubs.map(club => {
    const squad = snapshot.players
      .filter(player => player.clubId === club.id)
      .map(player => careerPlayerToPyramid(player));
    if (squad.length < 11) throw new Error(`club ${club.id} needs at least eleven players`);
    return {
      id: club.id,
      name: club.name,
      division,
      squadStrength: clubSquadStrength(squad),
      squad,
    };
  });
  return {
    ...state,
    highestDivisionReached: Math.min(
      state.highestDivisionReached ?? division,
      division,
    ) as DivisionLevel,
    pyramid: {
      ...state.pyramid,
      divisions: state.pyramid.divisions.map(candidate => candidate.level === division
        ? { level: division, clubs: pyramidClubs.map(cloneClub) }
        : candidate),
    },
  };
}

/** Stable simulated finish orders for tiers the user does not actively play. */
export function deterministicM2FinishOrders(
  state: M2CareerState,
  season: number,
  activeDivision: DivisionLevel,
  activeOrderedClubIds: readonly string[],
): DivisionFinishOrder[] {
  validateStateIdentity(state);
  validateSeason(season);
  const active = state.pyramid.divisions.find(division => division.level === activeDivision);
  if (active === undefined) throw new Error(`unknown active Division ${activeDivision}`);
  if (activeOrderedClubIds.length !== 10
    || new Set(activeOrderedClubIds).size !== 10
    || activeOrderedClubIds.some(id => !active.clubs.some(club => club.id === id))) {
    throw new Error('active finish order must contain its ten clubs exactly once');
  }
  return state.pyramid.divisions.map(division => ({
    division: division.level,
    orderedClubIds: division.level === activeDivision
      ? [...activeOrderedClubIds]
      : division.clubs.slice().sort((left, right) => {
          const strength = right.squadStrength - left.squadStrength;
          if (strength !== 0) return strength;
          const leftTie = stableSeasonTie(state.careerSeed, season, left.id);
          const rightTie = stableSeasonTie(state.careerSeed, season, right.id);
          return leftTie - rightTie || stableIdCompare(left.id, right.id);
        }).map(club => club.id),
  }));
}

/** Starts one all-division cup while retaining completed cups as plain history. */
export function startM2NationalCup(state: M2CareerState, season: number): M2CareerState {
  validateStateIdentity(state);
  validateSeason(season);
  if (state.nationalCups.some(cup => cup.championClubId === undefined)) {
    throw new Error('the active National Cup must finish before another can start');
  }
  if (state.nationalCups.some(cup => cup.season === season)) {
    throw new Error(`Season ${season} already has a National Cup`);
  }
  const clubIds = state.pyramid.divisions.flatMap(division =>
    division.clubs.map(club => club.id),
  );
  const seedDivisionByClubId = Object.fromEntries(state.pyramid.divisions.flatMap(division => (
    division.clubs.map(club => [club.id, division.level] as const)
  )));
  return {
    ...state,
    nationalCups: [
      ...state.nationalCups,
      createNationalCup(clubIds, season, state.careerSeed, seedDivisionByClubId),
    ],
  };
}

export function advanceM2NationalCup(
  state: M2CareerState,
  results: readonly NationalCupResult[],
): M2CareerState {
  validateStateIdentity(state);
  let activeCupIndex = -1;
  for (let index = state.nationalCups.length - 1; index >= 0; index -= 1) {
    if (state.nationalCups[index].championClubId === undefined) {
      activeCupIndex = index;
      break;
    }
  }
  if (activeCupIndex === -1) throw new Error('there is no active National Cup');
  const advanced = advanceNationalCup(state.nationalCups[activeCupIndex], results);
  return {
    ...state,
    nationalCups: state.nationalCups.map((cup, index) => index === activeCupIndex ? advanced : cup),
  };
}

/**
 * Resolves exactly the currently scheduled cup round. This is the weekly-tick
 * counterpart to quickResolveM2NationalCup, which intentionally finishes the
 * entire remaining competition in one call.
 */
export function resolveNextM2NationalCupRound(
  state: M2CareerState,
  suppliedResult?: NationalCupResult,
): M2CareerState {
  validateStateIdentity(state);
  const cup = state.nationalCups.find(candidate => candidate.championClubId === undefined);
  if (cup === undefined) throw new Error('there is no active National Cup');
  const round = cup.rounds[cup.rounds.length - 1];
  if (round === undefined || round.fixtures.some(fixture => fixture.status !== 'scheduled')) {
    throw new Error('the active National Cup has no scheduled round');
  }
  const results = deterministicCupRoundResults(state, cup, round.number);
  if (suppliedResult === undefined) return advanceM2NationalCup(state, results);
  const fixtureIndex = round.fixtures.findIndex(fixture => fixture.id === suppliedResult.fixtureId);
  if (fixtureIndex === -1) {
    throw new Error(`National Cup result ${suppliedResult.fixtureId} is not in the current round`);
  }
  return advanceM2NationalCup(
    state,
    results.map((result, index) => index === fixtureIndex ? { ...suppliedResult } : result),
  );
}

/** Resolves any remaining cup rounds from stable squad strength, never scoreline history. */
export function quickResolveM2NationalCup(state: M2CareerState): M2CareerState {
  validateStateIdentity(state);
  let resolved = state;
  while (resolved.nationalCups.some(cup => cup.championClubId === undefined)) {
    resolved = resolveNextM2NationalCupRound(resolved);
  }
  return resolved;
}

export function applyM2PromotionAndRelegation(
  state: M2CareerState,
  finishOrders: readonly DivisionFinishOrder[],
): M2PromotionResolution {
  validateStateIdentity(state);
  const resolved = resolvePromotionAndRelegation(state.pyramid, finishOrders);
  return {
    state: { ...state, pyramid: resolved.pyramid },
    movements: resolved.movements,
  };
}

/**
 * Adapts schema-1 CareerPlayers into the richer lifecycle without discarding
 * contracts, powers, wages, licensing, or injuries. Missing M2 fields receive
 * conservative migration defaults.
 */
export function resolveM2CareerPlayerLifecycle(
  players: readonly StructuralCareerPlayer[],
  season: number,
  careerSeed: number,
): M2CareerLifecycleResult {
  validateSeason(season);
  validateSeed(careerSeed);
  const sourceById = new Map<string, StructuralCareerPlayer>();
  const lifecyclePlayers: PyramidPlayer[] = players.map(player => {
    if (sourceById.has(player.id)) throw new Error(`duplicate career player ID ${player.id}`);
    sourceById.set(player.id, player);
    return normalizeLifecyclePlayer(player, season);
  });
  const resolved = resolveSeasonEndLifecycle(lifecyclePlayers, season, careerSeed);

  return {
    activePlayers: resolved.activePlayers.map(player => mergeCareerPlayer(
      sourceById.get(player.id)!,
      player,
      careerSeed,
    )),
    retiredPlayers: resolved.retiredPlayers.map(player => mergeCareerPlayer(
      sourceById.get(player.id)!,
      player,
      careerSeed,
    )),
    announcements: resolved.announcements.map(announcement => ({ ...announcement })),
  };
}

/**
 * Describes the next endless season without changing GameState. Opponent growth
 * depends only on the next season number, never user results or scorelines.
 */
export function planEndlessCareerSeasonTransition(
  state: M2CareerState,
  completedSeason: number,
): EndlessCareerSeasonTransitionPlan {
  validateStateIdentity(state);
  validateSeason(completedSeason);
  if (completedSeason >= Number.MAX_SAFE_INTEGER) {
    throw new Error('completed season exceeds the supported range');
  }
  const nextSeason = completedSeason + 1;
  let advancedState: M2CareerState = {
    ...state,
    pyramid: {
      ...state.pyramid,
      divisions: state.pyramid.divisions.map(candidate => ({
        ...candidate,
        clubs: candidate.clubs.map(club => club.id === state.userClubId
          ? cloneClub(club)
          : scaleOpponentClub(club, nextSeason)),
      })),
    },
  };
  const division = currentUserDivision(advancedState);
  if (division === 4) {
    advancedState = {
      ...advancedState,
      pyramid: applyDivisionFourRelegationPack(advancedState.pyramid, state.userClubId),
    };
  }
  const currentClubs = advancedState.pyramid.divisions
    .find(candidate => candidate.level === division)!.clubs;
  const userClub = currentClubs.find(club => club.id === state.userClubId)!;
  const generatedOpponentClubs = currentClubs
    .filter(club => club.id !== state.userClubId)
    .map(cloneClub)
    .sort((left, right) => stableIdCompare(left.id, right.id));
  if (generatedOpponentClubs.length !== 9) {
    throw new Error(`Division ${division} must provide exactly nine opponents`);
  }
  const activeClubs = [cloneClub(userClub), ...generatedOpponentClubs.map(cloneClub)];
  return {
    nextSeason,
    division,
    state: advancedState,
    activeClubs,
    activeClubIds: activeClubs.map(club => club.id),
    generatedOpponentClubs,
    generatedOpponentPlayers: generatedOpponentClubs.flatMap(club => club.squad.map(clonePlayer)),
  };
}

function normalizeLifecyclePlayer(
  player: StructuralCareerPlayer,
  season: number,
): PyramidPlayer {
  const announcementSeason = player.retirementAnnouncementSeason
    ?? (player.retirementAnnounced === true ? Math.max(1, season - 1) : undefined);
  return {
    id: player.id,
    clubId: player.clubId,
    name: player.name,
    role: player.role,
    ...(player.lookId === undefined ? {} : { lookId: player.lookId }),
    attrs: { ...player.attrs },
    archetype: player.archetype ?? 'All-Rounder',
    personality: player.personality ?? 'Professional',
    age: player.age ?? 24,
    fame: player.fame ?? 0,
    seasonsAtClub: player.seasonsAtClub ?? 0,
    morale: player.morale,
    condition: player.condition ?? 100,
    consecutiveLowMoraleWeeks: player.consecutiveLowMoraleWeeks ?? 0,
    ...(announcementSeason === undefined ? {} : { retirementAnnouncementSeason: announcementSeason }),
  };
}

function mergeCareerPlayer(
  source: StructuralCareerPlayer,
  lifecycle: PyramidPlayer,
  careerSeed: number,
): M2CareerPlayer {
  const announcementSeason = lifecycle.retirementAnnouncementSeason;
  return {
    ...source,
    attrs: { ...lifecycle.attrs },
    age: lifecycle.age,
    archetype: lifecycle.archetype,
    personality: lifecycle.personality,
    condition: lifecycle.condition,
    seasonsAtClub: lifecycle.seasonsAtClub + 1,
    fame: lifecycle.fame,
    morale: lifecycle.morale,
    consecutiveLowMoraleWeeks: lifecycle.consecutiveLowMoraleWeeks,
    retirementAge: retirementAnnouncementAge(lifecycle, careerSeed),
    retirementAnnounced: announcementSeason !== undefined,
    ...(announcementSeason === undefined ? {} : { retirementAnnouncementSeason: announcementSeason }),
  };
}

function careerPlayerToPyramid(player: StructuralCareerPlayer): PyramidPlayer {
  return {
    id: player.id,
    clubId: player.clubId,
    name: player.name,
    role: player.role,
    ...(player.lookId === undefined ? {} : { lookId: player.lookId }),
    attrs: { ...player.attrs },
    archetype: player.archetype ?? 'All-Rounder',
    personality: player.personality ?? 'Professional',
    age: player.age ?? 24,
    fame: player.fame ?? 0,
    seasonsAtClub: player.seasonsAtClub ?? 0,
    morale: player.morale,
    condition: player.condition ?? 100,
    consecutiveLowMoraleWeeks: player.consecutiveLowMoraleWeeks ?? 0,
    ...(player.retirementAnnouncementSeason === undefined
      ? {}
      : { retirementAnnouncementSeason: player.retirementAnnouncementSeason }),
  };
}

/** Live full-squad rating used by the pyramid and its player-facing comparison. */
export function clubSquadStrength(
  squad: readonly Pick<PyramidPlayer, 'role' | 'attrs'>[],
): number {
  if (squad.length === 0) throw new Error('club squad strength requires at least one player');
  const total = squad.reduce(
    (clubTotal, player) => clubTotal + roleOverall(player.role, player.attrs),
    0,
  );
  return Math.max(1, Math.min(MAX_PLAYER_ATTRIBUTE, Math.round(total / squad.length)));
}

function stableSeasonTie(careerSeed: number, season: number, clubId: string): number {
  let hash = (careerSeed ^ Math.imul(season, 0x9e3779b9)) >>> 0;
  for (let index = 0; index < clubId.length; index += 1) {
    hash = Math.imul(hash ^ clubId.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash;
}

function pyramidClub(state: M2CareerState, clubId: string): PyramidClub {
  const club = state.pyramid.divisions
    .flatMap(division => division.clubs)
    .find(candidate => candidate.id === clubId);
  if (club === undefined) throw new Error(`unknown pyramid club ${clubId}`);
  return club;
}

function deterministicCupRoundResults(
  state: M2CareerState,
  cup: NationalCup,
  roundNumber: number,
): NationalCupResult[] {
  const round = cup.rounds[cup.rounds.length - 1];
  if (round === undefined || round.number !== roundNumber) {
    throw new Error(`National Cup round ${roundNumber} is not current`);
  }
  return round.fixtures.map(fixture => {
    const home = pyramidClub(state, fixture.homeClubId);
    const away = pyramidClub(state, fixture.awayClubId);
    const homeScore = home.squadStrength + stableSeasonTie(
      state.careerSeed,
      cup.season * 10 + round.number,
      home.id,
    ) % 7;
    const awayScore = away.squadStrength + stableSeasonTie(
      state.careerSeed,
      cup.season * 10 + round.number,
      away.id,
    ) % 7;
    const homeWins = homeScore === awayScore
      ? stableIdCompare(home.id, away.id) < 0
      : homeScore > awayScore;
    return {
      fixtureId: fixture.id,
      homeGoals: homeWins ? 1 : 0,
      awayGoals: homeWins ? 0 : 1,
      winnerClubId: homeWins ? home.id : away.id,
    };
  });
}

function scaleOpponentClub(club: PyramidClub, season: number): PyramidClub {
  // `club` already contains every prior season's applied growth after the
  // active division is synchronized. Apply only this season's step so the
  // documented +8 curve does not compound the same bonus every year.
  const previousSeasonBonus = Math.min(8, Math.floor(Math.max(0, season - 2) / 2));
  const currentSeasonBonus = Math.min(8, Math.floor((season - 1) / 2));
  const increase = currentSeasonBonus - previousSeasonBonus;
  const squadStrength = Math.min(MAX_PLAYER_ATTRIBUTE, club.squadStrength + increase);
  return {
    ...club,
    squadStrength,
    squad: club.squad.map(player => ({
      ...player,
      attrs: increaseAttrs(player.attrs, increase),
    })),
  };
}

function increaseAttrs(attrs: Attrs, increase: number): Attrs {
  const boosted = (value: number) => Math.min(MAX_PLAYER_ATTRIBUTE, value + increase);
  return {
    pac: boosted(attrs.pac),
    sho: boosted(attrs.sho),
    pas: boosted(attrs.pas),
    def: boosted(attrs.def),
    tec: boosted(attrs.tec),
    sta: boosted(attrs.sta),
    ref: boosted(attrs.ref),
  };
}

function validateStateIdentity(state: M2CareerState): void {
  if (state.schemaVersion !== M2_CAREER_SCHEMA_VERSION) {
    throw new Error(`unsupported M2 career schema ${state.schemaVersion}`);
  }
  validateSeed(state.careerSeed);
  if (state.pyramid.careerSeed !== state.careerSeed) {
    throw new Error('M2 career and pyramid seeds must match');
  }
  currentUserDivision(state);
}

function validateUserClub(club: M2UserClubIdentity): void {
  if (typeof club.id !== 'string' || club.id.trim().length === 0) {
    throw new Error('user club ID must be a non-empty string');
  }
  if (typeof club.name !== 'string' || club.name.trim().length === 0) {
    throw new Error('user club name must be a non-empty string');
  }
  if (!Number.isInteger(club.squadStrength)
    || club.squadStrength < 1
    || club.squadStrength > MAX_PLAYER_ATTRIBUTE) {
    throw new Error(`user club strength must be an integer from 1 to ${MAX_PLAYER_ATTRIBUTE}`);
  }
}

function validateSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    throw new Error('career seed must be a uint32 integer');
  }
}

function validateSeason(season: number): void {
  if (!Number.isSafeInteger(season) || season < 1) {
    throw new Error('season must be a positive safe integer');
  }
}

function cloneClub(club: PyramidClub): PyramidClub {
  return { ...club, squad: club.squad.map(clonePlayer) };
}

function clonePlayer(player: PyramidPlayer): PyramidPlayer {
  return { ...player, attrs: { ...player.attrs } };
}

function stableIdCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
