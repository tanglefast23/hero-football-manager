import type { Attrs } from '../sim/types';
import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import { roleOverall } from './archetype-caps';
import { isSpecialHeroId } from './special-heroes';
import { compareIds } from './ordering';
import {
  advanceNationalCup,
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

const M2_CAREER_SCHEMA_VERSION = 2;
const UINT32_MAX = 4294967295;
const ATTR_KEYS = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'] as const;

interface M2UserClubIdentity {
  id: string;
  name: string;
  squadStrength: number;
}

interface M2CareerInitialization {
  careerSeed: number;
  userClub: M2UserClubIdentity;
}

/** Sidecar state until the shared GameState/save schema adopts M2 fields. */
export interface M2CareerState {
  schemaVersion: number;
  careerSeed: number;
  userClubId: string;
  /** Last season whose one-time rival growth step is present in the pyramid. */
  opponentGrowthThroughSeason: number;
  /** Best tier ever reached; lower division numbers are stronger tiers. */
  highestDivisionReached?: DivisionLevel;
  pyramid: LeaguePyramid;
  nationalCups: NationalCup[];
}

interface M2PromotionResolution {
  state: M2CareerState;
  movements: DivisionMovement[];
}

interface ActiveDivisionSnapshot {
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

interface M2CareerPlayer extends Omit<
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

interface M2CareerLifecycleResult {
  activePlayers: M2CareerPlayer[];
  retiredPlayers: M2CareerPlayer[];
  announcements: RetirementAnnouncement[];
}

interface EndlessCareerSeasonTransitionPlan {
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
  player: Pick<
    StructuralCareerPlayer,
    'retirementAnnounced' | 'retirementAnnouncementSeason'
  >,
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
export function initializeM2Career(
  input: M2CareerInitialization,
): M2CareerState {
  validateSeed(input.careerSeed);
  validateUserClub(input.userClub);
  const generated = generateLeaguePyramid(input.careerSeed);
  const generatedIds = new Set(
    generated.divisions.flatMap((division) =>
      division.clubs.map((club) => club.id),
    ),
  );
  const replacedClubId = generated.divisions.find(
    (division) => division.level === 5,
  )!.clubs[0].id;
  generatedIds.delete(replacedClubId);
  if (generatedIds.has(input.userClub.id)) {
    throw new Error(
      `user club ID ${input.userClub.id} collides with a generated club`,
    );
  }

  const divisions = generated.divisions.map((division) => ({
    level: division.level,
    clubs: division.clubs.map((club) =>
      club.id !== replacedClubId
        ? cloneClub(club)
        : {
            id: input.userClub.id,
            name: input.userClub.name,
            division: 5 as const,
            squadStrength: input.userClub.squadStrength,
            squad: [],
          },
    ),
  }));

  return {
    schemaVersion: M2_CAREER_SCHEMA_VERSION,
    careerSeed: input.careerSeed,
    userClubId: input.userClub.id,
    opponentGrowthThroughSeason: 1,
    highestDivisionReached: 5,
    pyramid: { careerSeed: input.careerSeed, divisions },
    nationalCups: [],
  };
}

export function currentUserDivision(state: M2CareerState): DivisionLevel {
  const matches = state.pyramid.divisions.filter((division) =>
    division.clubs.some((club) => club.id === state.userClubId),
  );
  if (matches.length !== 1) {
    throw new Error(
      `user club ${state.userClubId} must appear in exactly one division`,
    );
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
  if (snapshot.clubs.length !== 10)
    throw new Error('an active division requires exactly ten clubs');
  const clubIds = new Set(snapshot.clubs.map((club) => club.id));
  if (clubIds.size !== 10 || !clubIds.has(state.userClubId)) {
    throw new Error(
      'active division club IDs must be unique and include the user club',
    );
  }
  const outsideIds = new Set(
    state.pyramid.divisions
      .filter((candidate) => candidate.level !== division)
      .flatMap((candidate) => candidate.clubs.map((club) => club.id)),
  );
  if ([...clubIds].some((id) => outsideIds.has(id))) {
    throw new Error(
      'an active division club ID collides with another pyramid tier',
    );
  }
  const pyramidClubs = snapshot.clubs.map((club) => {
    const squad = snapshot.players
      // Named superheroes never enter pyramid data — the user's own signings
      // included. They belong to a division rather than a club, and are rebuilt
      // for whichever club is strongest each season. Writing them here would let
      // a relegated host carry a D1 character down to D4, would make next
      // season's host ranking count last season's heroes, and would let
      // `allCareerTransferTargets` offer a powerless copy rebuilt by
      // `pyramidCareerPlayer` from the wrong tier. Nothing needs them here: the
      // season transition rebuilds the user's squad from live state, never from
      // the pyramid.
      .filter(
        (player) => player.clubId === club.id && !isSpecialHeroId(player.id),
      )
      .map((player) => careerPlayerToPyramid(player));
    if (squad.length < 11)
      throw new Error(`club ${club.id} needs at least eleven players`);
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
      divisions: state.pyramid.divisions.map((candidate) =>
        candidate.level === division
          ? { level: division, clubs: pyramidClubs.map(cloneClub) }
          : candidate,
      ),
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
  const active = state.pyramid.divisions.find(
    (division) => division.level === activeDivision,
  );
  if (active === undefined)
    throw new Error(`unknown active Division ${activeDivision}`);
  if (
    activeOrderedClubIds.length !== 10 ||
    new Set(activeOrderedClubIds).size !== 10 ||
    activeOrderedClubIds.some(
      (id) => !active.clubs.some((club) => club.id === id),
    )
  ) {
    throw new Error(
      'active finish order must contain its ten clubs exactly once',
    );
  }
  return state.pyramid.divisions.map((division) => ({
    division: division.level,
    orderedClubIds:
      division.level === activeDivision
        ? [...activeOrderedClubIds]
        : division.clubs
            .slice()
            .sort((left, right) => {
              const strength =
                currentClubStrength(right) - currentClubStrength(left);
              if (strength !== 0) return strength;
              const leftTie = stableSeasonTie(
                state.careerSeed,
                season,
                left.id,
              );
              const rightTie = stableSeasonTie(
                state.careerSeed,
                season,
                right.id,
              );
              return leftTie - rightTie || compareIds(left.id, right.id);
            })
            .map((club) => club.id),
  }));
}

/**
 * How many seasons keep their full Hero Cup bracket.
 *
 * The M2 clock never ends, so retaining every bracket grew the save without
 * bound — 13 kb per season, 769 kb of cups by season 60, re-serialised after
 * every action. Ten seasons is what the Cup tab's season picker can usefully
 * offer; past that a bracket is history nobody opens. The cup RECORD is never
 * dropped, only its rounds, because the champion is what Hall of Fame, the
 * endgame trigger and "cups won" are counted from.
 */
export const RETAINED_CUP_BRACKET_SEASONS = 10;

/**
 * Drops the rounds of completed cups that have fallen outside the retention
 * window. An unfinished cup is never touched — it is still being played — and
 * a cup already pruned is left alone.
 */
function pruneCupBrackets(cups: readonly NationalCup[]): NationalCup[] {
  const ordered = [...cups].sort((left, right) => left.season - right.season);
  const firstRetained = Math.max(
    0,
    ordered.length - RETAINED_CUP_BRACKET_SEASONS,
  );
  return ordered.map((cup, index) => {
    if (index >= firstRetained) return cup;
    if (cup.championClubId === undefined || cup.rounds.length === 0) return cup;
    // The seeding map only serves a bracket that can still be drawn or shown.
    const { seedDivisionByClubId: retiredSeeds, ...record } = cup;
    return { ...record, rounds: [] };
  });
}

/** Starts one all-division cup while retaining completed cups as plain history. */
export function startM2NationalCup(
  state: M2CareerState,
  season: number,
): M2CareerState {
  validateStateIdentity(state);
  validateSeason(season);
  if (state.nationalCups.some((cup) => cup.championClubId === undefined)) {
    throw new Error('the active Hero Cup must finish before another can start');
  }
  if (state.nationalCups.some((cup) => cup.season === season)) {
    throw new Error(`Season ${season} already has a Hero Cup`);
  }
  const clubIds = state.pyramid.divisions.flatMap((division) =>
    division.clubs.map((club) => club.id),
  );
  const seedDivisionByClubId = Object.fromEntries(
    state.pyramid.divisions.flatMap((division) =>
      division.clubs.map((club) => [club.id, division.level] as const),
    ),
  );
  return {
    ...state,
    nationalCups: pruneCupBrackets([
      ...state.nationalCups,
      createNationalCup(
        clubIds,
        season,
        state.careerSeed,
        seedDivisionByClubId,
      ),
    ]),
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
  if (activeCupIndex === -1) throw new Error('there is no active Hero Cup');
  const advanced = advanceNationalCup(
    state.nationalCups[activeCupIndex],
    results,
  );
  return {
    ...state,
    nationalCups: state.nationalCups.map((cup, index) =>
      index === activeCupIndex ? advanced : cup,
    ),
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
  const cup = state.nationalCups.find(
    (candidate) => candidate.championClubId === undefined,
  );
  if (cup === undefined) throw new Error('there is no active Hero Cup');
  const round = cup.rounds[cup.rounds.length - 1];
  if (
    round === undefined ||
    round.fixtures.some((fixture) => fixture.status !== 'scheduled')
  ) {
    throw new Error('the active Hero Cup has no scheduled round');
  }
  const results = deterministicCupRoundResults(state, cup, round.number);
  if (suppliedResult === undefined) return advanceM2NationalCup(state, results);
  const fixtureIndex = round.fixtures.findIndex(
    (fixture) => fixture.id === suppliedResult.fixtureId,
  );
  if (fixtureIndex === -1) {
    throw new Error(
      `Hero Cup result ${suppliedResult.fixtureId} is not in the current round`,
    );
  }
  return advanceM2NationalCup(
    state,
    results.map((result, index) =>
      index === fixtureIndex ? { ...suppliedResult } : result,
    ),
  );
}

/** Resolves any remaining cup rounds from stable squad strength, never scoreline history. */
export function quickResolveM2NationalCup(state: M2CareerState): M2CareerState {
  validateStateIdentity(state);
  let resolved = state;
  while (
    resolved.nationalCups.some((cup) => cup.championClubId === undefined)
  ) {
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
  const lifecyclePlayers: PyramidPlayer[] = players.map((player) => {
    if (sourceById.has(player.id))
      throw new Error(`duplicate career player ID ${player.id}`);
    sourceById.set(player.id, player);
    return normalizeLifecyclePlayer(player, season);
  });
  const resolved = resolveSeasonEndLifecycle(
    lifecyclePlayers,
    season,
    careerSeed,
  );

  return {
    activePlayers: resolved.activePlayers.map((player) =>
      mergeCareerPlayer(sourceById.get(player.id)!, player, careerSeed),
    ),
    retiredPlayers: resolved.retiredPlayers.map((player) =>
      mergeCareerPlayer(sourceById.get(player.id)!, player, careerSeed),
    ),
    announcements: resolved.announcements.map((announcement) => ({
      ...announcement,
    })),
  };
}

/**
 * Describes the next endless season without changing GameState. Opponent growth
 * depends only on the next season number, never user results or scorelines.
 */
/**
 * How fast the league improves. Supplied by the career's difficulty so Chairman
 * faces a field that pulls away faster; the default reproduces Cozy exactly, so
 * callers that do not care are unaffected.
 */
interface OpponentGrowthRules {
  opponentGrowthPercent: number;
  opponentGrowthAttributeCap: number;
}

const DEFAULT_OPPONENT_GROWTH: OpponentGrowthRules = {
  opponentGrowthPercent: 2.5,
  opponentGrowthAttributeCap: 700,
};

export function planEndlessCareerSeasonTransition(
  state: M2CareerState,
  completedSeason: number,
  growth: OpponentGrowthRules = DEFAULT_OPPONENT_GROWTH,
): EndlessCareerSeasonTransitionPlan {
  validateStateIdentity(state);
  validateSeason(completedSeason);
  if (completedSeason >= Number.MAX_SAFE_INTEGER) {
    throw new Error('completed season exceeds the supported range');
  }
  const nextSeason = completedSeason + 1;
  const applyGrowth = state.opponentGrowthThroughSeason < nextSeason;
  let advancedState: M2CareerState = {
    ...state,
    opponentGrowthThroughSeason: Math.max(
      state.opponentGrowthThroughSeason,
      nextSeason,
    ),
    pyramid: {
      ...state.pyramid,
      divisions: state.pyramid.divisions.map((candidate) => ({
        ...candidate,
        clubs: candidate.clubs.map((club) =>
          club.id === state.userClubId
            ? cloneClub(club)
            : applyGrowth
              ? scaleOpponentClub(club, nextSeason, growth, state.careerSeed)
              : cloneClub(club),
        ),
      })),
    },
  };
  const division = currentUserDivision(advancedState);
  const currentClubs = advancedState.pyramid.divisions.find(
    (candidate) => candidate.level === division,
  )!.clubs;
  const userClub = currentClubs.find((club) => club.id === state.userClubId)!;
  const generatedOpponentClubs = currentClubs
    .filter((club) => club.id !== state.userClubId)
    .map(cloneClub)
    .sort((left, right) => compareIds(left.id, right.id));
  if (generatedOpponentClubs.length !== 9) {
    throw new Error(`Division ${division} must provide exactly nine opponents`);
  }
  const activeClubs = [
    cloneClub(userClub),
    ...generatedOpponentClubs.map(cloneClub),
  ];
  return {
    nextSeason,
    division,
    state: advancedState,
    activeClubs,
    activeClubIds: activeClubs.map((club) => club.id),
    generatedOpponentClubs,
    generatedOpponentPlayers: generatedOpponentClubs.flatMap((club) =>
      club.squad.map(clonePlayer),
    ),
  };
}

function normalizeLifecyclePlayer(
  player: StructuralCareerPlayer,
  season: number,
): PyramidPlayer {
  const announcementSeason =
    player.retirementAnnouncementSeason ??
    (player.retirementAnnounced === true ? Math.max(1, season - 1) : undefined);
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
    ...(announcementSeason === undefined
      ? {}
      : { retirementAnnouncementSeason: announcementSeason }),
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
    ...(announcementSeason === undefined
      ? {}
      : { retirementAnnouncementSeason: announcementSeason }),
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
  if (squad.length === 0)
    throw new Error('club squad strength requires at least one player');
  const total = squad.reduce(
    (clubTotal, player) => clubTotal + roleOverall(player.role, player.attrs),
    0,
  );
  return Math.max(
    1,
    Math.min(MAX_PLAYER_ATTRIBUTE, Math.round(total / squad.length)),
  );
}

function stableSeasonTie(
  careerSeed: number,
  season: number,
  clubId: string,
): number {
  let hash = (careerSeed ^ Math.imul(season, 0x9e3779b9)) >>> 0;
  for (let index = 0; index < clubId.length; index += 1) {
    hash = Math.imul(hash ^ clubId.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash;
}

function pyramidClub(state: M2CareerState, clubId: string): PyramidClub {
  const club = state.pyramid.divisions
    .flatMap((division) => division.clubs)
    .find((candidate) => candidate.id === clubId);
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
    throw new Error(`Hero Cup round ${roundNumber} is not current`);
  }
  return round.fixtures.map((fixture) => {
    const home = pyramidClub(state, fixture.homeClubId);
    const away = pyramidClub(state, fixture.awayClubId);
    const winnerClubId = deterministicCupTieWinner(
      state.careerSeed,
      cup.season,
      round.number,
      home,
      away,
    );
    const homeWins = winnerClubId === home.id;
    return {
      fixtureId: fixture.id,
      homeGoals: homeWins ? 1 : 0,
      awayGoals: homeWins ? 0 : 1,
      winnerClubId: homeWins ? home.id : away.id,
    };
  });
}

export function deterministicCupTieWinner(
  careerSeed: number,
  season: number,
  round: number,
  home: PyramidClub,
  away: PyramidClub,
): string {
  const homeScore =
    currentClubStrength(home) *
    deterministicCupPerformanceBasisPoints(careerSeed, season, round, home.id);
  const awayScore =
    currentClubStrength(away) *
    deterministicCupPerformanceBasisPoints(careerSeed, season, round, away.id);
  if (homeScore === awayScore)
    return compareIds(home.id, away.id) < 0 ? home.id : away.id;
  return homeScore > awayScore ? home.id : away.id;
}

function scaleOpponentClub(
  club: PyramidClub,
  season: number,
  growth: OpponentGrowthRules,
  careerSeed: number,
): PyramidClub {
  const squad = club.squad.map((player) => ({
    ...player,
    attrs: growOpponentAttrs(
      player.attrs,
      player.id,
      season,
      careerSeed,
      growth,
    ),
  }));
  return {
    ...club,
    squadStrength: clubSquadStrength(squad),
    squad,
  };
}

function growOpponentAttrs(
  attrs: Attrs,
  playerId: string,
  season: number,
  careerSeed: number,
  growth: OpponentGrowthRules,
): Attrs {
  const next = { ...attrs };
  for (const attribute of ATTR_KEYS) {
    const scaled = attrs[attribute] * (100 + growth.opponentGrowthPercent);
    const floor = Math.floor(scaled / 100);
    const remainder = scaled % 100;
    const roll =
      opponentGrowthRoll(careerSeed, season, playerId, attribute) % 100;
    next[attribute] = Math.min(
      MAX_PLAYER_ATTRIBUTE,
      growth.opponentGrowthAttributeCap,
      floor + Number(roll < remainder),
    );
  }
  return next;
}

function validateStateIdentity(state: M2CareerState): void {
  if (state.schemaVersion !== M2_CAREER_SCHEMA_VERSION) {
    throw new Error(`unsupported M2 career schema ${state.schemaVersion}`);
  }
  validateSeed(state.careerSeed);
  if (
    !Number.isSafeInteger(state.opponentGrowthThroughSeason) ||
    state.opponentGrowthThroughSeason < 1
  ) {
    throw new Error('opponent growth season must be a positive safe integer');
  }
  if (state.pyramid.careerSeed !== state.careerSeed) {
    throw new Error('M2 career and pyramid seeds must match');
  }
  currentUserDivision(state);
}

function currentClubStrength(club: PyramidClub): number {
  return club.squad.length === 0
    ? club.squadStrength
    : clubSquadStrength(club.squad);
}

/**
 * Mostly ±6%, with a 6.5% 2.5x tail and a 1.5% 7x giant tail. The distribution
 * is a percentage, so rebasing attributes never makes the Cup window inert.
 */
function deterministicCupPerformanceBasisPoints(
  careerSeed: number,
  season: number,
  round: number,
  clubId: string,
): number {
  const bucket =
    stableSeasonTie(careerSeed, season * 10 + round, `${clubId}:cup-tail`) %
    10_000;
  if (bucket < 150) return 70_000;
  if (bucket < 800) return 25_000;
  return (
    9_400 +
    (stableSeasonTie(careerSeed, season * 10 + round, `${clubId}:cup-normal`) %
      1_201)
  );
}

function opponentGrowthRoll(
  careerSeed: number,
  season: number,
  playerId: string,
  attribute: keyof Attrs,
): number {
  return stableSeasonTie(careerSeed, season, `${playerId}:growth:${attribute}`);
}

function validateUserClub(club: M2UserClubIdentity): void {
  if (typeof club.id !== 'string' || club.id.trim().length === 0) {
    throw new Error('user club ID must be a non-empty string');
  }
  if (typeof club.name !== 'string' || club.name.trim().length === 0) {
    throw new Error('user club name must be a non-empty string');
  }
  if (
    !Number.isInteger(club.squadStrength) ||
    club.squadStrength < 1 ||
    club.squadStrength > MAX_PLAYER_ATTRIBUTE
  ) {
    throw new Error(
      `user club strength must be an integer from 1 to ${MAX_PLAYER_ATTRIBUTE}`,
    );
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
