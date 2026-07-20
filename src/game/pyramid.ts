import { mulberry32, type Rng } from '../sim/rng';
import type { Attrs, Role } from '../sim/types';
import type { PlayerArchetype, PlayerPersonality } from './types';
export type { PlayerArchetype, PlayerPersonality } from './types';

export type DivisionLevel = 1 | 2 | 3 | 4 | 5;

export interface PyramidPlayer {
  id: string;
  clubId: string;
  name: string;
  role: Role;
  lookId?: string;
  attrs: Attrs;
  archetype: PlayerArchetype;
  personality: PlayerPersonality;
  age: number;
  fame: number;
  seasonsAtClub: number;
  morale: number;
  condition: number;
  consecutiveLowMoraleWeeks: number;
  retirementAnnouncementSeason?: number;
}

export interface PyramidClub {
  id: string;
  name: string;
  division: DivisionLevel;
  squadStrength: number;
  squad: PyramidPlayer[];
}

export interface PyramidDivision {
  level: DivisionLevel;
  clubs: PyramidClub[];
}

export interface LeaguePyramid {
  careerSeed: number;
  divisions: PyramidDivision[];
}

export interface DivisionFinishOrder {
  division: DivisionLevel;
  /** Best to worst. All ten clubs in the division must be present exactly once. */
  orderedClubIds: string[];
}

export interface DivisionMovement {
  clubId: string;
  fromDivision: DivisionLevel;
  toDivision: DivisionLevel;
  kind: 'promoted' | 'relegated';
}

export interface PyramidSeasonResolution {
  pyramid: LeaguePyramid;
  movements: DivisionMovement[];
}

export interface CupScore {
  homeGoals: number;
  awayGoals: number;
}

export interface NationalCupFixture {
  id: string;
  season: number;
  round: number;
  homeClubId: string;
  awayClubId: string;
  matchSeed: number;
  status: 'scheduled' | 'played';
  score?: CupScore;
  winnerClubId?: string;
}

export interface NationalCupRound {
  number: number;
  label: 'Play-in' | 'Round of 32' | 'Round of 16' | 'Quarter-final' | 'Semi-final' | 'Final';
  entrantClubIds: string[];
  byeClubIds: string[];
  fixtures: NationalCupFixture[];
}

export interface NationalCup {
  careerSeed: number;
  season: number;
  rounds: NationalCupRound[];
  championClubId?: string;
}

export interface NationalCupResult extends CupScore {
  fixtureId: string;
  /** Required for drawn knockout scores after extra time or penalties. */
  winnerClubId: string;
}

export interface RetirementAnnouncement {
  playerId: string;
  playerName: string;
  announcedInSeason: number;
  retirementAge: number;
}

export interface SeasonEndLifecycleResult {
  activePlayers: PyramidPlayer[];
  retiredPlayers: PyramidPlayer[];
  announcements: RetirementAnnouncement[];
}

export type CoachSpecialty =
  | 'Attack'
  | 'Defense'
  | 'Fitness'
  | 'Technique'
  | 'Goalkeeping'
  | 'Motivator';

export interface LegendCoachCandidate {
  id: string;
  formerPlayerId: string;
  name: string;
  specialties: [CoachSpecialty, CoachSpecialty];
  loyaltyDiscountPercent: number;
}

export interface CoachLegacy {
  choice: 'coach-candidate';
  coachCandidate: LegendCoachCandidate;
}

export interface YouthLegacy {
  choice: 'mentor-youth';
  mentorPlayerId: string;
  startingStatBoostPercent: 15;
  youth: PyramidPlayer;
}

export type LegendLegacy = CoachLegacy | YouthLegacy;

export interface WellbeingUpdate {
  moraleDelta?: number;
  conditionDelta?: number;
}

export interface WellbeingState {
  morale: number;
  condition: number;
  personality: PlayerPersonality;
  consecutiveLowMoraleWeeks: number;
}

export const CLUBS_PER_DIVISION = 10;
export const PYRAMID_DIVISION_COUNT = 5;
export const NATIONAL_CUP_CLUB_COUNT = CLUBS_PER_DIVISION * PYRAMID_DIVISION_COUNT;
export const CLUB_LEGEND_MIN_SEASONS = 5;
export const CLUB_LEGEND_MIN_FAME = 70;
export const LOW_MORALE_THRESHOLD = 30;
export const LEGACY_YOUTH_STAT_BOOST_PERCENT = 15;

const UINT32_RANGE = 4294967296;
const SQUAD_ROLES: readonly Role[] = [
  'GK', 'GK',
  'DEF', 'DEF', 'DEF', 'DEF', 'DEF',
  'MID', 'MID', 'MID', 'MID', 'MID',
  'FWD', 'FWD', 'FWD', 'FWD',
];
const DIVISION_BASE_STRENGTH: Readonly<Record<DivisionLevel, number>> = {
  1: 76,
  2: 68,
  3: 60,
  4: 52,
  5: 44,
};
const ARCHETYPES: readonly PlayerArchetype[] = [
  'Speedster', 'Sniper', 'Playmaker', 'Anchor', 'Wall', 'Engine', 'All-Rounder', 'Prodigy',
];
const PERSONALITIES: readonly PlayerPersonality[] = [
  'Fiery', 'Loyal', 'Greedy', 'Joker', 'Professional', 'Timid',
];
const CLUB_PREFIXES = [
  'Alder', 'Beacon', 'Copper', 'Dunwich', 'Elm', 'Fable', 'Garnet', 'Harbour', 'Iron', 'Juniper',
] as const;
const CLUB_SUFFIXES = ['Athletic', 'City', 'Rovers', 'United', 'Wanderers'] as const;
const FIRST_NAMES = [
  'Ari', 'Ben', 'Cal', 'Dara', 'Eli', 'Finn', 'Gio', 'Hugo', 'Ivo', 'Jae', 'Kai', 'Leo',
  'Milo', 'Nico', 'Ollie', 'Paz', 'Quin', 'Remy', 'Sol', 'Tavi', 'Uma', 'Vik', 'Wes', 'Zane',
] as const;
const LAST_NAMES = [
  'Ash', 'Baird', 'Cole', 'Dunn', 'Everett', 'Flint', 'Gray', 'Hart', 'Irons', 'Jett', 'Knox',
  'Lane', 'Moss', 'North', 'Oak', 'Penn', 'Quick', 'Reed', 'Stone', 'Tate', 'Vale', 'Ward', 'York',
] as const;

/** Generates all five divisions from one injected career seed. */
export function generateLeaguePyramid(careerSeed: number): LeaguePyramid {
  validateSeed(careerSeed);
  const random = mulberry32(mixSeed(careerSeed, 0x50f1a4d));
  const clubNames = shuffled(
    CLUB_PREFIXES.flatMap(prefix => CLUB_SUFFIXES.map(suffix => `${prefix} ${suffix}`)),
    random,
  );
  const divisions: PyramidDivision[] = [];

  for (let level = 1; level <= PYRAMID_DIVISION_COUNT; level += 1) {
    const division = level as DivisionLevel;
    const clubs: PyramidClub[] = [];
    for (let clubIndex = 0; clubIndex < CLUBS_PER_DIVISION; clubIndex += 1) {
      const id = `d${division}-club-${pad2(clubIndex + 1)}`;
      const targetStrength = DIVISION_BASE_STRENGTH[division] + integerRoll(random, -3, 3);
      const squad = generateSquad(id, division, targetStrength, random);
      clubs.push({
        id,
        name: clubNames[(level - 1) * CLUBS_PER_DIVISION + clubIndex],
        division,
        squadStrength: averageSquadStrength(squad),
        squad,
      });
    }
    divisions.push({ level: division, clubs });
  }

  return { careerSeed, divisions };
}

/** Resolves top-two promotion and bottom-two relegation without changing squad strength. */
export function resolvePromotionAndRelegation(
  pyramid: LeaguePyramid,
  finishOrders: readonly DivisionFinishOrder[],
): PyramidSeasonResolution {
  validatePyramid(pyramid);
  validateFinishOrders(pyramid, finishOrders);
  const orderByDivision = new Map(finishOrders.map(order => [order.division, order.orderedClubIds]));
  const movements: DivisionMovement[] = [];
  const targetDivisionByClubId = new Map<string, DivisionLevel>();

  for (const division of pyramid.divisions) {
    const orderedClubIds = orderByDivision.get(division.level)!;
    for (let index = 0; index < orderedClubIds.length; index += 1) {
      const clubId = orderedClubIds[index];
      if (division.level > 1 && index < 2) {
        const toDivision = (division.level - 1) as DivisionLevel;
        targetDivisionByClubId.set(clubId, toDivision);
        movements.push({ clubId, fromDivision: division.level, toDivision, kind: 'promoted' });
      } else if (division.level < 5 && index >= CLUBS_PER_DIVISION - 2) {
        const toDivision = (division.level + 1) as DivisionLevel;
        targetDivisionByClubId.set(clubId, toDivision);
        movements.push({ clubId, fromDivision: division.level, toDivision, kind: 'relegated' });
      } else {
        targetDivisionByClubId.set(clubId, division.level);
      }
    }
  }

  const allClubs = pyramid.divisions.flatMap(division => division.clubs).map(club => {
    const division = targetDivisionByClubId.get(club.id)!;
    return cloneClub({ ...club, division });
  });
  const divisions = divisionLevels().map(level => ({
    level,
    clubs: allClubs
      .filter(club => club.division === level)
      .sort((left, right) => stableIdCompare(left.id, right.id)),
  }));

  return {
    pyramid: { careerSeed: pyramid.careerSeed, divisions },
    movements: movements.sort((left, right) => stableIdCompare(left.clubId, right.clubId)),
  };
}

/** Creates the 50-club National Cup. Fourteen clubs receive deterministic play-in byes. */
export function createNationalCup(
  clubIds: readonly string[],
  season: number,
  careerSeed: number,
): NationalCup {
  validateClubIds(clubIds, NATIONAL_CUP_CLUB_COUNT, 'National Cup');
  validateSeason(season);
  validateSeed(careerSeed);
  const firstRound = createCupRound([...clubIds].sort(stableIdCompare), season, 1, careerSeed);
  return { careerSeed, season, rounds: [firstRound] };
}

/** Completes the current cup round and produces the next one, or names the champion. */
export function advanceNationalCup(
  cup: NationalCup,
  results: readonly NationalCupResult[],
): NationalCup {
  validateSeason(cup.season);
  validateSeed(cup.careerSeed);
  if (cup.championClubId !== undefined) throw new Error('the National Cup is already complete');
  if (cup.rounds.length < 1 || cup.rounds.length > 6) throw new Error('the National Cup has invalid rounds');
  const current = cup.rounds[cup.rounds.length - 1];
  if (current.fixtures.some(fixture => fixture.status !== 'scheduled')) {
    throw new Error('the current National Cup round has already been resolved');
  }
  if (results.length !== current.fixtures.length) {
    throw new Error(`National Cup round ${current.number} requires exactly ${current.fixtures.length} results`);
  }
  const resultByFixtureId = new Map<string, NationalCupResult>();
  for (const result of results) {
    if (resultByFixtureId.has(result.fixtureId)) throw new Error(`duplicate result for ${result.fixtureId}`);
    resultByFixtureId.set(result.fixtureId, result);
  }

  const winners: string[] = [];
  const fixtures = current.fixtures.map(fixture => {
    const result = resultByFixtureId.get(fixture.id);
    if (result === undefined) throw new Error(`missing result for ${fixture.id}`);
    validateCupResult(fixture, result);
    winners.push(result.winnerClubId);
    return {
      ...fixture,
      status: 'played' as const,
      score: { homeGoals: result.homeGoals, awayGoals: result.awayGoals },
      winnerClubId: result.winnerClubId,
    };
  });
  const resolvedRound = { ...current, fixtures };
  const rounds = [...cup.rounds.slice(0, -1), resolvedRound];
  const advancingClubIds = [...current.byeClubIds, ...winners];

  if (advancingClubIds.length === 1) {
    return { ...cup, rounds, championClubId: advancingClubIds[0] };
  }
  const nextRound = createCupRound(
    advancingClubIds.sort(stableIdCompare),
    cup.season,
    current.number + 1,
    cup.careerSeed,
  );
  return { ...cup, rounds: [...rounds, nextRound] };
}

/** One rating point every two completed seasons, capped at +8. It never reads match results. */
export function opponentStrengthForSeason(baseStrength: number, season: number): number {
  validateRating(baseStrength, 'base opponent strength');
  validateSeason(season);
  const seasonIncrease = Math.min(8, Math.floor((season - 1) / 2));
  return Math.min(99, baseStrength + seasonIncrease);
}

export function trainingMultiplierForAge(age: number): 1.5 | 1 | 0.6 {
  validateAge(age);
  if (age <= 23) return 1.5;
  if (age <= 29) return 1;
  return 0.6;
}

/**
 * Ages active players, applies only the documented 30+ PAC/STA decline, and gives
 * every announced player one final season before retirement.
 */
export function resolveSeasonEndLifecycle(
  players: readonly PyramidPlayer[],
  season: number,
  careerSeed: number,
): SeasonEndLifecycleResult {
  validateSeason(season);
  validateSeed(careerSeed);
  const activePlayers: PyramidPlayer[] = [];
  const retiredPlayers: PyramidPlayer[] = [];
  const announcements: RetirementAnnouncement[] = [];

  for (const player of players) {
    validateLifecyclePlayer(player);
    if (player.retirementAnnouncementSeason !== undefined
      && player.retirementAnnouncementSeason < season) {
      retiredPlayers.push(clonePlayer(player));
      continue;
    }

    const declineApplies = player.age >= 30;
    const aged: PyramidPlayer = {
      ...clonePlayer(player),
      age: player.age + 1,
      attrs: declineApplies
        ? {
            ...player.attrs,
            pac: Math.max(1, player.attrs.pac - lifecycleRoll(careerSeed, season, player.id, 'pac', 1, 3)),
            sta: Math.max(1, player.attrs.sta - lifecycleRoll(careerSeed, season, player.id, 'sta', 1, 3)),
          }
        : { ...player.attrs },
    };
    const retirementAge = retirementAnnouncementAge(player, careerSeed);
    if (aged.retirementAnnouncementSeason === undefined && aged.age >= retirementAge) {
      aged.retirementAnnouncementSeason = season;
      announcements.push({
        playerId: aged.id,
        playerName: aged.name,
        announcedInSeason: season,
        retirementAge,
      });
    }
    activePlayers.push(aged);
  }

  return { activePlayers, retiredPlayers, announcements };
}

/** Personality-weighted, stable per-player retirement announcement age from 33 through 38. */
export function retirementAnnouncementAge(
  player: Pick<PyramidPlayer, 'id' | 'personality'>,
  careerSeed: number,
): number {
  validateSeed(careerSeed);
  const pools: Readonly<Record<PlayerPersonality, readonly number[]>> = {
    Fiery: [33, 34, 34, 35, 35, 36, 37, 38],
    Loyal: [34, 35, 35, 36, 36, 37, 37, 38],
    Greedy: [33, 33, 34, 34, 35, 36, 37, 38],
    Joker: [33, 34, 35, 35, 36, 36, 37, 38],
    Professional: [35, 35, 36, 36, 37, 37, 38, 38],
    Timid: [33, 33, 34, 34, 35, 35, 36, 37],
  };
  const pool = pools[player.personality];
  if (pool === undefined) throw new Error(`unknown personality ${String(player.personality)}`);
  const roll = statelessUint32(careerSeed, hashString(player.id), 0x71e1ae);
  return pool[roll % pool.length];
}

export function isClubLegend(
  player: Pick<PyramidPlayer, 'seasonsAtClub' | 'fame'>,
): boolean {
  return Number.isInteger(player.seasonsAtClub)
    && player.seasonsAtClub >= CLUB_LEGEND_MIN_SEASONS
    && Number.isInteger(player.fame)
    && player.fame >= CLUB_LEGEND_MIN_FAME;
}

export function createLegendLegacy(
  legend: PyramidPlayer,
  choice: 'coach-candidate' | 'mentor-youth',
  season: number,
  careerSeed: number,
): LegendLegacy {
  validateSeason(season);
  validateSeed(careerSeed);
  if (!isClubLegend(legend)) throw new Error(`${legend.name} is not eligible for a club-legend legacy`);
  if (choice === 'coach-candidate') {
    return {
      choice,
      coachCandidate: {
        id: `legacy-coach-${legend.id}`,
        formerPlayerId: legend.id,
        name: legend.name,
        specialties: coachSpecialtiesFor(legend),
        loyaltyDiscountPercent: 20,
      },
    };
  }
  if (choice !== 'mentor-youth') throw new Error(`unknown club-legend legacy choice ${String(choice)}`);

  const random = mulberry32(mixSeed(careerSeed, season, hashString(legend.id), 0x1e9ac7));
  const targetStrength = integerRoll(random, 34, 43);
  const role = legend.role;
  const baseAttrs = generateAttributes(targetStrength, role, random);
  const youth: PyramidPlayer = {
    id: `legacy-youth-s${season}-${legend.id}`,
    clubId: legend.clubId,
    name: `${FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)]} ${lastNameOf(legend.name)}`,
    role,
    attrs: boostLegacyYouthAttributes(baseAttrs),
    archetype: legend.archetype,
    personality: PERSONALITIES[Math.floor(random() * PERSONALITIES.length)],
    age: integerRoll(random, 16, 17),
    fame: 5,
    seasonsAtClub: 0,
    morale: 65,
    condition: 100,
    consecutiveLowMoraleWeeks: 0,
  };
  return { choice, mentorPlayerId: legend.id, startingStatBoostPercent: 15, youth };
}

export function boostLegacyYouthAttributes(attrs: Attrs): Attrs {
  validateAttrs(attrs);
  return mapAttrs(attrs, value => Math.min(99, Math.round(value * 1.15)));
}

/** Applies explicit weekly morale/condition changes and tracks sustained low morale. */
export function updatePlayerWellbeing<T extends WellbeingState>(
  player: T,
  update: WellbeingUpdate,
): T {
  validatePercentage(player.morale, 'player morale');
  validatePercentage(player.condition, 'player condition');
  if (!Number.isInteger(player.consecutiveLowMoraleWeeks) || player.consecutiveLowMoraleWeeks < 0) {
    throw new Error('low-morale week count must be a non-negative integer');
  }
  const moraleDelta = update.moraleDelta ?? 0;
  const conditionDelta = update.conditionDelta ?? 0;
  if (!Number.isFinite(moraleDelta) || !Number.isFinite(conditionDelta)) {
    throw new Error('wellbeing changes must be finite numbers');
  }
  const morale = clamp(player.morale + moraleDelta, 0, 100);
  const condition = clamp(player.condition + conditionDelta, 0, 100);
  const consecutiveLowMoraleWeeks = morale < LOW_MORALE_THRESHOLD
    ? player.consecutiveLowMoraleWeeks + 1
    : 0;
  return { ...player, morale, condition, consecutiveLowMoraleWeeks };
}

/** Low morale reduces a stat by at most 10%; morale 30+ has no penalty. */
export function lowMoraleStatModifier(morale: number): number {
  validatePercentage(morale, 'player morale');
  if (morale >= LOW_MORALE_THRESHOLD) return 1;
  return 0.9 + morale / 300;
}

export function applyLowMoraleToStat(stat: number, morale: number): number {
  validateRating(stat, 'player stat');
  return Math.max(1, Math.round(stat * lowMoraleStatModifier(morale)));
}

/** A predictable request rule: personality changes patience, but a single bad week never triggers it. */
export function shouldRequestTransfer(player: WellbeingState): boolean {
  validatePercentage(player.morale, 'player morale');
  if (!Number.isInteger(player.consecutiveLowMoraleWeeks) || player.consecutiveLowMoraleWeeks < 0) {
    throw new Error('low-morale week count must be a non-negative integer');
  }
  const rule: Readonly<Record<PlayerPersonality, { morale: number; weeks: number }>> = {
    Greedy: { morale: 30, weeks: 2 },
    Fiery: { morale: 25, weeks: 2 },
    Joker: { morale: 22, weeks: 3 },
    Timid: { morale: 25, weeks: 3 },
    Professional: { morale: 18, weeks: 4 },
    Loyal: { morale: 12, weeks: 5 },
  };
  const personalityRule = rule[player.personality];
  if (personalityRule === undefined) throw new Error(`unknown personality ${String(player.personality)}`);
  return player.morale <= personalityRule.morale
    && player.consecutiveLowMoraleWeeks >= personalityRule.weeks;
}

function generateSquad(
  clubId: string,
  division: DivisionLevel,
  targetStrength: number,
  random: Rng,
): PyramidPlayer[] {
  return SQUAD_ROLES.map((role, playerIndex) => {
    const age = integerRoll(random, 18, 32);
    return {
      id: `${clubId}-p${pad2(playerIndex + 1)}`,
      clubId,
      name: `${FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(random() * LAST_NAMES.length)]}`,
      role,
      attrs: generateAttributes(targetStrength + integerRoll(random, -5, 5), role, random),
      archetype: ARCHETYPES[Math.floor(random() * ARCHETYPES.length)],
      personality: PERSONALITIES[Math.floor(random() * PERSONALITIES.length)],
      age,
      fame: clamp((6 - division) * 10 + integerRoll(random, 0, 15), 0, 99),
      seasonsAtClub: integerRoll(random, 0, Math.min(8, age - 16)),
      morale: integerRoll(random, 55, 75),
      condition: 100,
      consecutiveLowMoraleWeeks: 0,
    };
  });
}

function generateAttributes(target: number, role: Role, random: Rng): Attrs {
  const jitter = () => integerRoll(random, -3, 3);
  const nudges: Readonly<Record<Role, Attrs>> = {
    GK: { pac: -5, sho: -8, pas: 0, def: 3, tec: 0, sta: 0, ref: 10 },
    DEF: { pac: 0, sho: -4, pas: 0, def: 7, tec: -1, sta: 3, ref: -5 },
    MID: { pac: 0, sho: 0, pas: 6, def: 0, tec: 6, sta: 3, ref: -5 },
    FWD: { pac: 4, sho: 7, pas: 0, def: -5, tec: 3, sta: 0, ref: -5 },
  };
  const roleNudges = nudges[role];
  return {
    pac: clampRating(target + roleNudges.pac + jitter()),
    sho: clampRating(target + roleNudges.sho + jitter()),
    pas: clampRating(target + roleNudges.pas + jitter()),
    def: clampRating(target + roleNudges.def + jitter()),
    tec: clampRating(target + roleNudges.tec + jitter()),
    sta: clampRating(target + roleNudges.sta + jitter()),
    ref: clampRating(target + roleNudges.ref + jitter()),
  };
}

function averageSquadStrength(squad: readonly PyramidPlayer[]): number {
  const total = squad.reduce((sum, player) => sum + playerStrength(player), 0);
  return Math.round(total / squad.length);
}

function playerStrength(player: Pick<PyramidPlayer, 'role' | 'attrs'>): number {
  const { attrs, role } = player;
  if (role === 'GK') return Math.round((attrs.ref * 4 + attrs.def + attrs.pas) / 6);
  if (role === 'DEF') return Math.round((attrs.def * 3 + attrs.pac + attrs.sta + attrs.pas) / 6);
  if (role === 'MID') return Math.round((attrs.pas * 2 + attrs.tec * 2 + attrs.sta + attrs.def) / 6);
  return Math.round((attrs.sho * 3 + attrs.pac + attrs.tec + attrs.pas) / 6);
}

function createCupRound(
  entrantClubIds: string[],
  season: number,
  round: number,
  careerSeed: number,
): NationalCupRound {
  const entrantsByRound = [50, 32, 16, 8, 4, 2] as const;
  const expectedEntrants = entrantsByRound[round - 1];
  if (expectedEntrants === undefined) throw new Error(`unsupported National Cup round ${round}`);
  if (entrantClubIds.length !== expectedEntrants) {
    throw new Error(`National Cup round ${round} requires ${expectedEntrants} entrants`);
  }
  const random = mulberry32(mixSeed(careerSeed, season, round, 0xc09c0a));
  const seededEntrants = shuffled(entrantClubIds, random);
  const byeCount = round === 1 ? 14 : 0;
  const byeClubIds = seededEntrants.slice(0, byeCount);
  const playingClubIds = seededEntrants.slice(byeCount);
  const fixtures: NationalCupFixture[] = [];
  for (let index = 0; index < playingClubIds.length; index += 2) {
    fixtures.push({
      id: `s${season}-cup-r${round}-m${pad2(index / 2 + 1)}`,
      season,
      round,
      homeClubId: playingClubIds[index],
      awayClubId: playingClubIds[index + 1],
      matchSeed: Math.floor(random() * UINT32_RANGE) >>> 0,
      status: 'scheduled',
    });
  }
  return {
    number: round,
    label: cupRoundLabel(round),
    entrantClubIds: [...seededEntrants],
    byeClubIds,
    fixtures,
  };
}

function cupRoundLabel(round: number): NationalCupRound['label'] {
  const labels: NationalCupRound['label'][] = [
    'Play-in', 'Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final',
  ];
  const label = labels[round - 1];
  if (label === undefined) throw new Error(`unsupported National Cup round ${round}`);
  return label;
}

function validateCupResult(fixture: NationalCupFixture, result: NationalCupResult): void {
  if (!Number.isSafeInteger(result.homeGoals) || result.homeGoals < 0
    || !Number.isSafeInteger(result.awayGoals) || result.awayGoals < 0) {
    throw new Error(`National Cup result ${result.fixtureId} has invalid goals`);
  }
  if (result.winnerClubId !== fixture.homeClubId && result.winnerClubId !== fixture.awayClubId) {
    throw new Error(`National Cup winner for ${fixture.id} must be one of its clubs`);
  }
  if (result.homeGoals > result.awayGoals && result.winnerClubId !== fixture.homeClubId) {
    throw new Error(`National Cup winner for ${fixture.id} contradicts its score`);
  }
  if (result.awayGoals > result.homeGoals && result.winnerClubId !== fixture.awayClubId) {
    throw new Error(`National Cup winner for ${fixture.id} contradicts its score`);
  }
}

function validatePyramid(pyramid: LeaguePyramid): void {
  validateSeed(pyramid.careerSeed);
  if (pyramid.divisions.length !== PYRAMID_DIVISION_COUNT) {
    throw new Error('league pyramid requires exactly five divisions');
  }
  const clubIds: string[] = [];
  for (const level of divisionLevels()) {
    const division = pyramid.divisions.find(candidate => candidate.level === level);
    if (division === undefined || division.clubs.length !== CLUBS_PER_DIVISION) {
      throw new Error(`Division ${level} requires exactly ten clubs`);
    }
    for (const club of division.clubs) {
      if (club.division !== level) throw new Error(`club ${club.id} has the wrong division`);
      clubIds.push(club.id);
    }
  }
  validateClubIds(clubIds, NATIONAL_CUP_CLUB_COUNT, 'league pyramid');
}

function validateFinishOrders(
  pyramid: LeaguePyramid,
  finishOrders: readonly DivisionFinishOrder[],
): void {
  if (finishOrders.length !== PYRAMID_DIVISION_COUNT) {
    throw new Error('promotion and relegation requires all five finish orders');
  }
  for (const division of pyramid.divisions) {
    const order = finishOrders.find(candidate => candidate.division === division.level);
    if (order === undefined) throw new Error(`missing Division ${division.level} finish order`);
    validateClubIds(order.orderedClubIds, CLUBS_PER_DIVISION, `Division ${division.level} finish order`);
    const expected = new Set(division.clubs.map(club => club.id));
    if (order.orderedClubIds.some(clubId => !expected.has(clubId))) {
      throw new Error(`Division ${division.level} finish order contains an unknown club`);
    }
  }
  if (new Set(finishOrders.map(order => order.division)).size !== PYRAMID_DIVISION_COUNT) {
    throw new Error('finish-order divisions must be unique');
  }
}

function validateLifecyclePlayer(player: PyramidPlayer): void {
  if (player.id.trim().length === 0) throw new Error('player ID must be non-empty');
  validateAge(player.age);
  validateAttrs(player.attrs);
  validatePercentage(player.fame, 'player fame');
  validatePercentage(player.morale, 'player morale');
  validatePercentage(player.condition, 'player condition');
  if (!Number.isInteger(player.seasonsAtClub) || player.seasonsAtClub < 0) {
    throw new Error('seasons at club must be a non-negative integer');
  }
  if (player.retirementAnnouncementSeason !== undefined) {
    validateSeason(player.retirementAnnouncementSeason);
  }
}

function validateAttrs(attrs: Attrs): void {
  for (const [key, value] of Object.entries(attrs)) validateRating(value, `player attribute ${key}`);
}

function validateClubIds(ids: readonly string[], expectedCount: number, label: string): void {
  if (ids.length !== expectedCount) throw new Error(`${label} requires exactly ${expectedCount} clubs`);
  if (ids.some(id => typeof id !== 'string' || id.trim().length === 0)) {
    throw new Error(`${label} club IDs must be non-empty strings`);
  }
  if (new Set(ids).size !== ids.length) throw new Error(`${label} club IDs must be unique`);
}

function validateSeed(seed: number): void {
  if (!Number.isSafeInteger(seed)) throw new Error('career seed must be a safe integer');
}

function validateSeason(season: number): void {
  if (!Number.isInteger(season) || season < 1) throw new Error('season must be a positive integer');
}

function validateAge(age: number): void {
  if (!Number.isInteger(age) || age < 16) throw new Error('player age must be an integer of at least 16');
}

function validateRating(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 99) {
    throw new Error(`${label} must be an integer from 1 to 99`);
  }
}

function validatePercentage(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} must be a number from 0 to 100`);
  }
}

function lifecycleRoll(
  careerSeed: number,
  season: number,
  playerId: string,
  field: string,
  min: number,
  max: number,
): number {
  const roll = statelessUint32(careerSeed, season, hashString(playerId), hashString(field));
  return min + (roll % (max - min + 1));
}

function statelessUint32(...parts: number[]): number {
  return Math.floor(mulberry32(mixSeed(...parts))() * UINT32_RANGE) >>> 0;
}

function mixSeed(...parts: number[]): number {
  let mixed = 0x811c9dc5;
  for (const part of parts) {
    mixed = Math.imul(mixed ^ (part >>> 0), 0x01000193);
  }
  return mixed >>> 0;
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}

function integerRoll(random: Rng, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function shuffled<T>(values: readonly T[], random: Rng): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function mapAttrs(attrs: Attrs, transform: (value: number) => number): Attrs {
  return {
    pac: transform(attrs.pac),
    sho: transform(attrs.sho),
    pas: transform(attrs.pas),
    def: transform(attrs.def),
    tec: transform(attrs.tec),
    sta: transform(attrs.sta),
    ref: transform(attrs.ref),
  };
}

function coachSpecialtiesFor(legend: PyramidPlayer): [CoachSpecialty, CoachSpecialty] {
  if (legend.role === 'GK') return ['Goalkeeping', 'Motivator'];
  if (legend.archetype === 'Speedster' || legend.archetype === 'Engine') return ['Fitness', 'Attack'];
  if (legend.archetype === 'Sniper') return ['Attack', 'Technique'];
  if (legend.archetype === 'Playmaker' || legend.archetype === 'Prodigy') return ['Technique', 'Attack'];
  if (legend.archetype === 'Anchor' || legend.archetype === 'Wall') return ['Defense', 'Fitness'];
  return ['Motivator', legend.role === 'DEF' ? 'Defense' : 'Technique'];
}

function clonePlayer(player: PyramidPlayer): PyramidPlayer {
  return { ...player, attrs: { ...player.attrs } };
}

function cloneClub(club: PyramidClub): PyramidClub {
  return { ...club, squad: club.squad.map(clonePlayer) };
}

function divisionLevels(): DivisionLevel[] {
  return [1, 2, 3, 4, 5];
}

function stableIdCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function clampRating(value: number): number {
  return clamp(value, 1, 99);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function lastNameOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || 'Legacy';
}
