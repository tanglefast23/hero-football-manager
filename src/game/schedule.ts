import { mulberry32 } from '../sim/rng';
import type { LeagueFixture } from './types';
import { compareIds } from './ordering';

const CLUB_COUNT = 10;
const FIRST_LEG_ROUNDS = CLUB_COUNT - 1;
const TOTAL_ROUNDS = FIRST_LEG_ROUNDS * 2;
const OPENING_SEASON_FIRST_LEAGUE_WEEK = 3;
const STANDARD_FIRST_LEAGUE_WEEK = 5;
const LAST_LEAGUE_WEEK = 28;
const UINT32_RANGE = 4294967296;

export function leagueWeekForRound(round: number, season: number): number {
  if (!Number.isInteger(round) || round < 1 || round > TOTAL_ROUNDS) {
    throw new Error(`league round must be an integer from 1 to ${TOTAL_ROUNDS}`);
  }
  if (!Number.isInteger(season) || season <= 0) {
    throw new Error('season must be a positive integer');
  }

  const firstLeagueWeek = season === 1
    ? OPENING_SEASON_FIRST_LEAGUE_WEEK
    : STANDARD_FIRST_LEAGUE_WEEK;
  const weekSpan = LAST_LEAGUE_WEEK - firstLeagueWeek;
  return firstLeagueWeek + Math.floor(((round - 1) * weekSpan) / (TOTAL_ROUNDS - 1));
}

export function generateSeasonFixtures(
  clubIds: string[],
  season: number,
  careerSeed: number,
): LeagueFixture[] {
  validateInputs(clubIds, season, careerSeed);

  const random = mulberry32(mixScheduleSeed(careerSeed, season));
  const firstLeg = generateFirstLeg(clubIds);
  const fixtures: LeagueFixture[] = [];

  for (let roundIndex = 0; roundIndex < TOTAL_ROUNDS; roundIndex += 1) {
    const round = roundIndex + 1;
    const isReturnLeg = roundIndex >= FIRST_LEG_ROUNDS;
    const pairings = firstLeg[roundIndex % FIRST_LEG_ROUNDS];

    for (let matchIndex = 0; matchIndex < pairings.length; matchIndex += 1) {
      const [firstHomeId, firstAwayId] = pairings[matchIndex];
      const homeClubId = isReturnLeg ? firstAwayId : firstHomeId;
      const awayClubId = isReturnLeg ? firstHomeId : firstAwayId;

      fixtures.push({
        id: `s${season}-r${round}-m${matchIndex + 1}`,
        season,
        round,
        week: leagueWeekForRound(round, season),
        homeClubId,
        awayClubId,
        matchSeed: Math.floor(random() * UINT32_RANGE) >>> 0,
        status: 'scheduled',
      });
    }
  }

  return fixtures;
}

/**
 * Places five rivals in the rotation slots that produce a steadily easing
 * opening run. The user's venues alternate home/away, so the third opponent is
 * one raw point stronger than the second: at home it is still the gentler
 * fixture. The weakest rival waits until match five instead of creating an
 * early dip followed by a difficulty rebound. Other clubs retain stable ID
 * order so the result is deterministic for the same division.
 */
export function pinOpeningLeagueOpponents(
  clubIds: readonly string[],
  userClubId: string,
  strengthByClubId: ReadonlyMap<string, number>,
): string[] {
  validateInputs([...clubIds], 1, 0);
  if (!clubIds.includes(userClubId)) throw new Error('opening schedule must include the user club');
  const opponents = clubIds
    .filter(clubId => clubId !== userClubId)
    .map(clubId => {
      const strength = strengthByClubId.get(clubId);
      if (!Number.isFinite(strength)) throw new Error(`opening schedule is missing strength for ${clubId}`);
      return { clubId, strength: strength! };
    })
    .sort((left, right) => right.strength - left.strength || compareIds(left.clubId, right.clubId));
  const hardest = opponents[0].clubId;
  const upperMid = opponents[4].clubId;
  const lowerMid = opponents[5].clubId;
  const secondWeakest = opponents[7].clubId;
  const weakest = opponents[8].clubId;
  const pinned = new Set([hardest, upperMid, lowerMid, secondWeakest, weakest]);
  const remaining = opponents
    .map(opponent => opponent.clubId)
    .filter(clubId => !pinned.has(clubId))
    .sort(compareIds);
  return [
    userClubId,
    ...remaining,
    weakest,
    secondWeakest,
    upperMid,
    lowerMid,
    hardest,
  ];
}

function generateFirstLeg(clubIds: string[]): Array<Array<[string, string]>> {
  let rotation = clubIds.slice();
  const rounds: Array<Array<[string, string]>> = [];

  for (let roundIndex = 0; roundIndex < FIRST_LEG_ROUNDS; roundIndex += 1) {
    const pairings: Array<[string, string]> = [];

    for (let pairingIndex = 0; pairingIndex < CLUB_COUNT / 2; pairingIndex += 1) {
      const left = rotation[pairingIndex];
      const right = rotation[CLUB_COUNT - 1 - pairingIndex];
      pairings.push((roundIndex + pairingIndex) % 2 === 0 ? [left, right] : [right, left]);
    }

    rounds.push(pairings);
    rotation = [rotation[0], rotation[CLUB_COUNT - 1], ...rotation.slice(1, CLUB_COUNT - 1)];
  }

  return rounds;
}

function mixScheduleSeed(careerSeed: number, season: number): number {
  const seed = careerSeed >>> 0;
  const seasonSalt = Math.imul(season, 0x9e3779b9);
  return (seed ^ seasonSalt) >>> 0;
}

function validateInputs(clubIds: string[], season: number, careerSeed: number): void {
  if (clubIds.length !== CLUB_COUNT) {
    throw new Error(`season schedule requires exactly ${CLUB_COUNT} clubs`);
  }
  if (clubIds.some(clubId => typeof clubId !== 'string' || clubId.trim().length === 0)) {
    throw new Error('club IDs must be non-empty strings');
  }
  if (new Set(clubIds).size !== CLUB_COUNT) {
    throw new Error('club IDs must be unique');
  }
  if (!Number.isInteger(season) || season < 1) {
    throw new Error('season must be a positive integer');
  }
  if (!Number.isSafeInteger(careerSeed)) {
    throw new Error('career seed must be a safe integer');
  }
}
