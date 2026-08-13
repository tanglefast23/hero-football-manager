import { mulberry32 } from '../sim/rng';
import { SEASON_WEEKS, type LeagueFixture } from './types';
import { compareIds } from './ordering';

const CLUB_COUNT = 10;
const FIRST_LEG_ROUNDS = CLUB_COUNT - 1;
const TOTAL_ROUNDS = FIRST_LEG_ROUNDS * 2;
const OPENING_SEASON_FIRST_LEAGUE_WEEK = 3;
const STANDARD_FIRST_LEAGUE_WEEK = 5;
/**
 * The last week the even spread may use. Rounds 1–17 are spaced across it
 * exactly as before the finale was pinned, which is what keeps the cup calendar
 * below unchanged.
 */
const LAST_SPREAD_LEAGUE_WEEK = 28;

/**
 * Every season ends on a league match.
 *
 * The final round is pinned to the season's last week rather than landing
 * wherever the even spread puts it, so the table, promotion and relegation are
 * settled the moment the manager walks off the pitch. Before the pin the league
 * finished in Week 28 and Week 30 was a dead week that still had to be advanced
 * through, with the desk offering a "Next match" that did not exist.
 */
const SEASON_FINALE_WEEK = SEASON_WEEKS;

/**
 * The week each Hero Cup round settles, chosen to land on weeks the league
 * calendar leaves empty so a cup tie is its own event instead of a second match
 * bolted onto a league week. `leagueWeekForRound` fills weeks 3–26 plus 30 in
 * season 1 and 5–26 plus 30 from season 2 on, which leaves these empty weeks:
 *
 *   season 1:  1 2   6   9   12    15    18    21    24 27 28 29
 *   season 2+: 1 2 3 4 8       12       16       20  24 27 28 29
 *
 * Only 12, 24, 27, 28 and 29 are free in every season, so no six-week set can
 * be empty in all of them. This set is empty for the whole of season 1 and
 * doubles up only twice (weeks 6 and 18) from season 2 on — the fewest possible
 * without opening in weeks 1–2, before the league has even kicked off, or
 * settling the final in week 30 on top of the league finale.
 *
 * Lives here rather than in `career.ts` because it is season-calendar data, and
 * because `player-requests.ts` reads it to decide whether a cost priced in
 * missed matches can be collected — an import `career.ts` cannot supply without
 * a cycle.
 */
export const CUP_SETTLEMENT_WEEKS = [6, 12, 18, 24, 27, 29] as const;
const UINT32_RANGE = 4294967296;

export function leagueWeekForRound(round: number, season: number): number {
  if (!Number.isInteger(round) || round < 1 || round > TOTAL_ROUNDS) {
    throw new Error(
      `league round must be an integer from 1 to ${TOTAL_ROUNDS}`,
    );
  }
  if (!Number.isInteger(season) || season <= 0) {
    throw new Error('season must be a positive integer');
  }

  if (round === TOTAL_ROUNDS) return SEASON_FINALE_WEEK;

  const firstLeagueWeek =
    season === 1
      ? OPENING_SEASON_FIRST_LEAGUE_WEEK
      : STANDARD_FIRST_LEAGUE_WEEK;
  const weekSpan = LAST_SPREAD_LEAGUE_WEEK - firstLeagueWeek;
  return (
    firstLeagueWeek + Math.floor(((round - 1) * weekSpan) / (TOTAL_ROUNDS - 1))
  );
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
 * opening run: the division's bottom five, strongest of them first.
 *
 * Match one used to be the single HARDEST club in the division, on the theory
 * that the run should ease from a peak. Measured against the shipped launch
 * division that peak is a wall — the user club opens 11 rating points below its
 * first opponent and a real career lost that fixture 0-13. The opener is now
 * upper-mid instead, and the hardest club falls back into the unpinned pool so
 * it lands somewhere after match five.
 *
 * The user's venues alternate home/away, so each opponent is a raw point
 * weaker than the last while the venue swings the other way. Other clubs retain
 * stable ID order so the result is deterministic for the same division.
 */
export function pinOpeningLeagueOpponents(
  clubIds: readonly string[],
  userClubId: string,
  strengthByClubId: ReadonlyMap<string, number>,
): string[] {
  validateInputs([...clubIds], 1, 0);
  if (!clubIds.includes(userClubId))
    throw new Error('opening schedule must include the user club');
  const opponents = clubIds
    .filter((clubId) => clubId !== userClubId)
    .map((clubId) => {
      const strength = strengthByClubId.get(clubId);
      if (!Number.isFinite(strength))
        throw new Error(`opening schedule is missing strength for ${clubId}`);
      return { clubId, strength: strength! };
    })
    .sort(
      (left, right) =>
        right.strength - left.strength || compareIds(left.clubId, right.clubId),
    );
  const upperMid = opponents[4].clubId;
  const lowerMid = opponents[5].clubId;
  const midLow = opponents[6].clubId;
  const secondWeakest = opponents[7].clubId;
  const weakest = opponents[8].clubId;
  const pinned = new Set([upperMid, lowerMid, midLow, secondWeakest, weakest]);
  const remaining = opponents
    .map((opponent) => opponent.clubId)
    .filter((clubId) => !pinned.has(clubId))
    .sort(compareIds);
  return [
    userClubId,
    ...remaining,
    weakest,
    secondWeakest,
    midLow,
    lowerMid,
    upperMid,
  ];
}

function generateFirstLeg(clubIds: string[]): Array<Array<[string, string]>> {
  let rotation = clubIds.slice();
  const rounds: Array<Array<[string, string]>> = [];

  for (let roundIndex = 0; roundIndex < FIRST_LEG_ROUNDS; roundIndex += 1) {
    const pairings: Array<[string, string]> = [];

    for (
      let pairingIndex = 0;
      pairingIndex < CLUB_COUNT / 2;
      pairingIndex += 1
    ) {
      const left = rotation[pairingIndex];
      const right = rotation[CLUB_COUNT - 1 - pairingIndex];
      pairings.push(
        (roundIndex + pairingIndex) % 2 === 0 ? [left, right] : [right, left],
      );
    }

    rounds.push(pairings);
    rotation = [
      rotation[0],
      rotation[CLUB_COUNT - 1],
      ...rotation.slice(1, CLUB_COUNT - 1),
    ];
  }

  return rounds;
}

function mixScheduleSeed(careerSeed: number, season: number): number {
  const seed = careerSeed >>> 0;
  const seasonSalt = Math.imul(season, 0x9e3779b9);
  return (seed ^ seasonSalt) >>> 0;
}

function validateInputs(
  clubIds: string[],
  season: number,
  careerSeed: number,
): void {
  if (clubIds.length !== CLUB_COUNT) {
    throw new Error(`season schedule requires exactly ${CLUB_COUNT} clubs`);
  }
  if (
    clubIds.some(
      (clubId) => typeof clubId !== 'string' || clubId.trim().length === 0,
    )
  ) {
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
