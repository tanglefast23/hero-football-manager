import type {
  CoachCandidate,
  CoachSpecialty as MarketCoachSpecialty,
  PlayerPersonality as MarketPersonality,
} from './market';
import {
  createLegendLegacy,
  isClubLegend,
  retirementAnnouncementAge,
  type CoachSpecialty as LegacyCoachSpecialty,
  type PyramidPlayer,
} from './pyramid';
import type { CareerPlayer, GameState, PlayerPersonality } from './types';
import { developmentPotentialCeiling } from './archetype-caps';
import { nextDistinctPlayerLook } from './player-appearance';
import { assertUserCareerRosterSpace } from './youth-intake';

export type CareerLegendLegacyChoice = 'coach-candidate' | 'mentor-youth';

export interface CareerLegendLegacyTransaction {
  readonly state: GameState;
  readonly resolvedPlayerId: string;
  readonly choice: CareerLegendLegacyChoice;
  readonly coachCandidate?: CoachCandidate;
  readonly youthPlayer?: CareerPlayer;
}

/** Returns a defensive copy of the first valid, unique legend still awaiting a choice. */
export function nextPendingClubLegend(state: GameState): CareerPlayer | undefined {
  const playerId = eligiblePendingLegendIds(state)[0];
  if (playerId === undefined) return undefined;
  const player = uniqueRetiredPlayers(state).get(playerId)!;
  return cloneCareerPlayer(player);
}

/** Drops stale, ineligible, foreign-club, and repeated IDs without resolving a choice. */
export function reconcilePendingClubLegends(state: GameState): GameState {
  const pendingLegacyPlayerIds = eligiblePendingLegendIds(state);
  if (sameStrings(state.pendingLegacyPlayerIds ?? [], pendingLegacyPlayerIds)) return state;
  return { ...state, pendingLegacyPlayerIds };
}

/**
 * Resolves the next queued club legend into one market coach or one mentored
 * youth. The returned state is JSON-safe and the input is never mutated.
 */
export function resolveNextClubLegendLegacy(
  state: GameState,
  choice: CareerLegendLegacyChoice,
): CareerLegendLegacyTransaction {
  if (state.market === undefined) throw new Error('club-legend legacy choices require a career market');
  const eligibleIds = eligiblePendingLegendIds(state);
  const legendId = eligibleIds[0];
  if (legendId === undefined) throw new Error('there is no eligible pending club legend');
  const retired = uniqueRetiredPlayers(state).get(legendId)!;
  const pyramidLegend = careerPlayerToPyramid(retired);
  const legacy = createLegendLegacy(pyramidLegend, choice, state.season, state.careerSeed);
  const pendingLegacyPlayerIds = eligibleIds.slice(1);

  if (legacy.choice === 'coach-candidate') {
    const coachCandidate = legacyCoachToMarketCandidate(
      legacy.coachCandidate,
      pyramidLegend,
    );
    const alreadyPresent = state.market.coachCandidates.some(candidate =>
      candidate.id === coachCandidate.id
      || candidate.retiredLegendPlayerId === coachCandidate.retiredLegendPlayerId,
    );
    return {
      state: {
        ...state,
        pendingLegacyPlayerIds,
        market: {
          ...state.market,
          coachCandidates: alreadyPresent
            ? [...state.market.coachCandidates]
            : [...state.market.coachCandidates, coachCandidate],
        },
      },
      resolvedPlayerId: legendId,
      choice,
      coachCandidate: cloneCoachCandidate(coachCandidate),
    };
  }

  const generatedYouth = legacyYouthToCareerPlayer(legacy.youth, state.careerSeed);
  const existingYouth = state.players.find(player => player.id === generatedYouth.id);
  const youthPlayer = existingYouth === undefined
    ? {
        ...generatedYouth,
        lookId: nextDistinctPlayerLook(generatedYouth, state.players),
      }
    : {
        ...cloneCareerPlayer(existingYouth),
        lookId: existingYouth.lookId ?? nextDistinctPlayerLook(
          existingYouth,
          state.players.filter(player => player.id !== existingYouth.id),
        ),
      };
  const alreadyPresent = existingYouth !== undefined;
  if (!alreadyPresent) assertUserCareerRosterSpace(state);
  const weeklyWages = alreadyPresent
    ? undefined
    : checkedAdd(
        requireUserClub(state).weeklyWages,
        youthPlayer.weeklyWage,
        'club-legend youth payroll',
      );
  return {
    state: {
      ...state,
      pendingLegacyPlayerIds,
      players: alreadyPresent
        ? state.players.map(cloneCareerPlayer)
        : [...state.players.map(cloneCareerPlayer), youthPlayer],
      clubs: weeklyWages === undefined
        ? state.clubs.map(club => ({ ...club }))
        : state.clubs.map(club => club.id === state.userClubId
          ? { ...club, weeklyWages }
          : { ...club }),
    },
    resolvedPlayerId: legendId,
    choice,
    youthPlayer: cloneCareerPlayer(youthPlayer),
  };
}

function eligiblePendingLegendIds(state: GameState): string[] {
  const retiredById = uniqueRetiredPlayers(state);
  const seen = new Set<string>();
  const eligible: string[] = [];
  for (const playerId of state.pendingLegacyPlayerIds ?? []) {
    if (seen.has(playerId)) continue;
    seen.add(playerId);
    const retired = retiredById.get(playerId);
    if (retired === undefined || retired.clubId !== state.userClubId) continue;
    if (!isClubLegend({
      seasonsAtClub: retired.seasonsAtClub ?? 0,
      fame: retired.fame ?? 0,
    })) continue;
    eligible.push(playerId);
  }
  return eligible;
}

function uniqueRetiredPlayers(state: GameState): Map<string, CareerPlayer> {
  const result = new Map<string, CareerPlayer>();
  for (const player of state.retiredPlayers ?? []) {
    if (!result.has(player.id)) result.set(player.id, player);
  }
  return result;
}

function careerPlayerToPyramid(player: CareerPlayer): PyramidPlayer {
  return {
    id: player.id,
    clubId: player.clubId,
    name: player.name,
    role: player.role,
    attrs: { ...player.attrs },
    archetype: player.archetype ?? 'All-Rounder',
    personality: player.personality ?? 'Professional',
    age: player.age ?? 35,
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

function legacyCoachToMarketCandidate(
  legacy: {
    readonly id: string;
    readonly formerPlayerId: string;
    readonly name: string;
    readonly specialties: readonly [LegacyCoachSpecialty, LegacyCoachSpecialty];
    readonly loyaltyDiscountPercent: number;
  },
  legend: PyramidPlayer,
): CoachCandidate {
  const level = Math.max(1, Math.min(5, 1 + Math.floor((legend.fame - 70) / 10)));
  const baseWage = checkedMultiply(500, level, 'club-legend coach wage');
  const weeklyWage = Math.round(baseWage * (100 - legacy.loyaltyDiscountPercent) / 100);
  const requiredFame = [0, 0, 100, 250, 500, 900][level];
  return {
    id: legacy.id,
    name: legacy.name,
    age: legend.age,
    specialties: [
      marketCoachSpecialty(legacy.specialties[0]),
      marketCoachSpecialty(legacy.specialties[1]),
    ],
    level,
    weeklyWage,
    personality: marketPersonality(legend.personality),
    requiredDivision: 6 - level,
    requiredFame,
    loyaltyDiscountPercent: legacy.loyaltyDiscountPercent,
    retiredLegendPlayerId: legacy.formerPlayerId,
  };
}

function legacyYouthToCareerPlayer(youth: PyramidPlayer, careerSeed: number): CareerPlayer {
  return {
    id: youth.id,
    clubId: youth.clubId,
    name: youth.name,
    role: youth.role,
    ...(youth.lookId === undefined ? {} : { lookId: youth.lookId }),
    attrs: { ...youth.attrs },
    licensed: false,
    weeklyWage: 240,
    onHeroWage: false,
    contractSeasonsRemaining: 3,
    morale: youth.morale,
    injuryWeeks: 0,
    age: youth.age,
    archetype: youth.archetype,
    potential: 4,
    potentialCeiling: developmentPotentialCeiling({
      id: youth.id,
      role: youth.role,
      attrs: youth.attrs,
      age: youth.age,
      potential: 4,
    }),
    consistency: 65,
    personality: youth.personality,
    condition: youth.condition,
    seasonsAtClub: youth.seasonsAtClub,
    fame: youth.fame,
    retirementAge: retirementAnnouncementAge(youth, careerSeed),
    retirementAnnounced: false,
    consecutiveLowMoraleWeeks: youth.consecutiveLowMoraleWeeks,
  };
}

function marketCoachSpecialty(specialty: LegacyCoachSpecialty): MarketCoachSpecialty {
  const values: Readonly<Record<LegacyCoachSpecialty, MarketCoachSpecialty>> = {
    Attack: 'ATTACK',
    Defense: 'DEFENSE',
    Fitness: 'FITNESS',
    Technique: 'TECHNIQUE',
    Goalkeeping: 'GOALKEEPING',
    Motivator: 'MOTIVATOR',
  };
  return values[specialty];
}

function marketPersonality(personality: PlayerPersonality): MarketPersonality {
  const values: Readonly<Record<PlayerPersonality, MarketPersonality>> = {
    Fiery: 'FIERY',
    Loyal: 'LOYAL',
    Greedy: 'GREEDY',
    Joker: 'JOKER',
    Professional: 'PROFESSIONAL',
    Timid: 'TIMID',
  };
  return values[personality];
}

function requireUserClub(state: GameState): GameState['clubs'][number] {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  return club;
}

function cloneCareerPlayer(player: CareerPlayer): CareerPlayer {
  return { ...player, attrs: { ...player.attrs } };
}

function cloneCoachCandidate(candidate: CoachCandidate): CoachCandidate {
  return { ...candidate, specialties: [...candidate.specialties] as [MarketCoachSpecialty, MarketCoachSpecialty] };
}

function checkedAdd(left: number, right: number, label: string): number {
  const value = left + right;
  if (!Number.isSafeInteger(value)) throw new Error(`${label} exceeds the safe integer range`);
  return value;
}

function checkedMultiply(left: number, right: number, label: string): number {
  const value = left * right;
  if (!Number.isSafeInteger(value)) throw new Error(`${label} exceeds the safe integer range`);
  return value;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
