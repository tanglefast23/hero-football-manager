import { compareIds, DIVISION_NAMES, divisionTierLabel, rosterForClub } from '../game';
import type { DivisionLevel } from '../game/pyramid';
import type {
  GameState,
  HallOfFameRecord,
  HallOfFameScorer,
  HallOfFameTier,
  HallOfFameTitle,
  SeasonRecap,
} from '../game/types';
import { highestFamePlayer, TRUE_ENDING_SEEN_FLAG } from './endgame-celebration';
import type {
  HallOfFameHonourViewModel,
  HallOfFameStatViewModel,
  HallOfFameTierViewModel,
  HallOfFameViewModel,
} from '../ui/models';

/**
 * The Hall of Fame: what a finished career leaves behind.
 *
 * Two halves that must not be confused. `captureHallOfFameRecord` runs ONCE, at
 * the summit, and writes numbers into the save; everything else here only reads
 * that record back. Nothing recomputes a career total at display time, because
 * by then it cannot: promotion regenerates rival rosters, the season transition
 * prunes stat rows, and a save reopened ten seasons later has no evidence left.
 */

/**
 * The pyramid's own names, so a tier is named here exactly as the league table
 * names it. The record persists a plain number, and the codec constrains it to
 * the five real levels, so the fallbacks are defensive only.
 */
const DIVISION_LEVELS: readonly DivisionLevel[] = [1, 2, 3, 4, 5];

function asDivisionLevel(division: number): DivisionLevel | undefined {
  return DIVISION_LEVELS.find(level => level === division);
}

function divisionName(division: number): string {
  const level = asDivisionLevel(division);
  return level === undefined ? `Division ${division}` : DIVISION_NAMES[level];
}

function divisionLabel(division: number): string {
  const level = asDivisionLevel(division);
  return level === undefined ? `D${division}` : divisionTierLabel(level);
}

/**
 * How many goals a season's Golden Boot was worth.
 *
 * `buildSeasonRecap` writes this as `"22 goals"` and keeps the number nowhere
 * else — `SeasonRecapAward` carries only strings. Reading it back is a real
 * coupling to a display string, so it is pinned by a test that runs the shipped
 * recap builder and reads the result through this function. A detail this
 * cannot parse counts zero rather than throwing: a career must never be unable
 * to reach its own record.
 */
export function goldenBootGoals(detail: string): number {
  const match = /^(\d+) goals$/.exec(detail);
  return match === null ? 0 : Number(match[1]);
}

/**
 * The record, taken at the moment the pair of trophies is complete.
 *
 * TOTAL BY CONSTRUCTION, for the reason `endgameCelebrationViewModel` gives:
 * this runs inside the season transition, on the way out of a cutscene that has
 * no other exit. A throw here would strand a save on the last screen of the
 * game. A career missing its recaps records zeroes and keeps its trophies.
 */
export function captureHallOfFameRecord(state: GameState): HallOfFameRecord {
  const recaps = [...(state.seasonRecaps ?? [])].sort((left, right) => left.season - right.season);
  const clubName = state.clubs.find(club => club.id === state.userClubId)?.name ?? 'Your club';

  let played = 0;
  let won = 0;
  let drawn = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  const divisionTitles: HallOfFameTitle[] = [];
  for (const recap of recaps) {
    played += recap.played;
    won += recap.won;
    drawn += recap.drawn;
    lost += recap.lost;
    goalsFor += recap.goalsFor;
    goalsAgainst += recap.goalsAgainst;
    if (recap.finalPosition === 1) {
      divisionTitles.push({ season: recap.season, division: recap.division });
    }
  }

  const star = highestFamePlayer(rosterForClub(state, state.userClubId));
  const topScorer = careerTopScorer(recaps);

  return {
    season: state.season,
    clubName,
    played,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    divisionTitles,
    // Read from the cup records rather than from `SeasonRecap.cupResult`, which
    // is a sentence: the trophy that ends the game must not be counted by
    // matching a display string.
    cupWinSeasons: (state.m2?.nationalCups ?? [])
      .filter(cup => cup.championClubId === state.userClubId)
      .map(cup => cup.season)
      .sort((left, right) => left - right),
    tiers: careerTiers(recaps),
    ...(topScorer === undefined ? {} : { topScorer }),
    ...(star === undefined ? {} : {
      star: {
        playerId: star.id,
        playerName: star.name,
        fame: star.fame ?? 0,
        seasonsAtClub: star.seasonsAtClub ?? 0,
      },
    }),
  };
}

/**
 * Banks the record the first time the climb is complete, and never again.
 *
 * Idempotent and keyed on the true-ending flag rather than on the caller, so a
 * second pass over an already-finished career cannot overwrite a record with a
 * later, thinner version of itself.
 */
export function recordHallOfFame(state: GameState): GameState {
  if (!state.eventFlags.includes(TRUE_ENDING_SEEN_FLAG)) return state;
  if (state.hallOfFame !== undefined) return state;
  return { ...state, hallOfFame: captureHallOfFameRecord(state) };
}

/**
 * What the Hall of Fame page draws, in both of its states.
 *
 * The locked state is a state of the page, not a reason to hide the button: a
 * manager who taps it before the end is told what unlocks it, which is the only
 * place in the game that says the climb has an end at all.
 */
export function hallOfFameViewModel(state: GameState): HallOfFameViewModel {
  const record = state.hallOfFame;
  if (record === undefined) {
    const lines = [
      'Finish the climb to see your record.',
      'Both trophies: the Global League and the National Cup.',
    ];
    return {
      status: 'locked',
      title: 'Hall of Fame',
      kicker: 'Club records',
      headline: 'Not written yet',
      lines,
      accessibilityLabel: `Hall of Fame, locked. ${lines.join(' ')}`,
    };
  }

  const stats = recordStats(record);
  const honours = recordHonours(record);
  return {
    status: 'complete',
    title: 'Hall of Fame',
    kicker: 'Club records',
    headline: record.clubName,
    subheading: `The climb, completed in ${seasonCount(record.season)}`,
    stats,
    honours,
    // Defensive: the page cannot be reached without the Cup, so an empty list
    // means a record from a save the Cup history no longer backs. Better a
    // written line than an empty box that looks like a rendering fault.
    honoursEmptyLabel: 'No trophy on record.',
    tiers: record.tiers.map(tierViewModel),
    accessibilityLabel: [
      `${record.clubName} Hall of Fame.`,
      `The climb, completed in ${seasonCount(record.season)}.`,
      ...stats.map(stat => `${stat.label}: ${stat.value}. ${stat.detail}`),
    ].join(' '),
  };
}

/** The headline numbers, in the order the page reads them. */
function recordStats(record: HallOfFameRecord): HallOfFameStatViewModel[] {
  const goalDifference = record.goalsFor - record.goalsAgainst;
  const stats: HallOfFameStatViewModel[] = [
    {
      id: 'seasons',
      label: 'Seasons',
      value: `${record.season}`,
      detail: `Season 1 to season ${record.season}`,
    },
    {
      id: 'record',
      label: 'Won / Drawn / Lost',
      value: `${record.won} / ${record.drawn} / ${record.lost}`,
      detail: `${record.played} league games played`,
    },
    {
      id: 'goals',
      label: 'Goals for / against',
      value: `${record.goalsFor} / ${record.goalsAgainst}`,
      detail: `${goalDifference >= 0 ? '+' : ''}${goalDifference} goal difference`,
    },
    {
      id: 'titles',
      label: 'Division titles',
      value: `${record.divisionTitles.length}`,
      detail: record.divisionTitles.length === 0
        ? 'Promoted without a title'
        : record.divisionTitles.map(title => `D${title.division}`).join(' · '),
    },
    {
      id: 'cups',
      label: 'National Cups',
      value: `${record.cupWinSeasons.length}`,
      detail: record.cupWinSeasons.length === 0
        ? 'None recorded'
        : `Season${record.cupWinSeasons.length === 1 ? '' : 's'} ${record.cupWinSeasons.join(', ')}`,
    },
  ];

  if (record.topScorer !== undefined) {
    const scorer = record.topScorer;
    stats.push({
      id: 'top-scorer',
      label: 'Top scorer',
      value: scorer.playerName,
      // Says what the number is a total OF. It counts the seasons he led the
      // club, which is what the save keeps, and claiming a career total it
      // cannot prove would be the easier and worse sentence.
      detail: `${scorer.goals} goals across ${goldenBootCount(scorer.goldenBoots)}`,
    });
  }
  if (record.star !== undefined) {
    const star = record.star;
    stats.push({
      id: 'star',
      label: 'Most famous',
      value: star.playerName,
      detail: `${star.fame} fame · ${seasonCount(star.seasonsAtClub)} at the club`,
    });
  }
  return stats;
}

/** Every trophy, oldest first, so the list reads as the climb happened. */
function recordHonours(record: HallOfFameRecord): HallOfFameHonourViewModel[] {
  const honours = [
    ...record.divisionTitles.map(title => ({
      id: `title-${title.season}`,
      season: title.season,
      label: `Season ${title.season}`,
      // The D-number is left off: the climb ladder below carries it, and the
      // name is the part that says which trophy this was.
      value: `${divisionName(title.division)} champions`,
    })),
    ...record.cupWinSeasons.map(season => ({
      id: `cup-${season}`,
      season,
      label: `Season ${season}`,
      value: 'National Cup winners',
    })),
  ];
  return honours
    // Two trophies in one season list in a fixed order rather than in whichever
    // order they were pushed: the Cup before the title, alphabetically by id.
    .sort((left, right) => left.season - right.season || compareIds(left.id, right.id))
    .map(({ id, label, value }) => ({ id, label, value }));
}

function tierViewModel(tier: HallOfFameTier): HallOfFameTierViewModel {
  return {
    division: tier.division,
    label: divisionLabel(tier.division),
    firstSeason: tier.firstSeason,
    seasons: tier.seasons,
    bestPosition: tier.bestPosition,
    best: `Best ${ordinal(tier.bestPosition)}`,
    detail: `Reached in season ${tier.firstSeason} · ${seasonCount(tier.seasons)}`,
  };
}

/**
 * One row per tier, in the order the club first reached them.
 *
 * The climb, read off the recaps: a relegation and a second promotion fold back
 * into the same row rather than opening a new one, because the row answers
 * "what did the club do at this level", not "how many spells did it have".
 */
function careerTiers(recaps: readonly SeasonRecap[]): HallOfFameTier[] {
  const byDivision = new Map<number, HallOfFameTier>();
  for (const recap of recaps) {
    const existing = byDivision.get(recap.division);
    if (existing === undefined) {
      byDivision.set(recap.division, {
        division: recap.division,
        firstSeason: recap.season,
        seasons: 1,
        bestPosition: recap.finalPosition,
      });
      continue;
    }
    existing.seasons += 1;
    existing.bestPosition = Math.min(existing.bestPosition, recap.finalPosition);
  }
  return [...byDivision.values()].sort((left, right) => (
    left.firstSeason - right.firstSeason || right.division - left.division
  ));
}

/**
 * The man who scored most of the club's goals, as far as the save can tell.
 *
 * Built from the per-season Golden Boot alone, and deliberately not blended
 * with `divisionAwards.goals`: that board is strikers-only and league-only, so
 * mixing the two would produce a total nobody could explain and would rank a
 * midfielder below a worse striker. One source, one sentence.
 */
function careerTopScorer(recaps: readonly SeasonRecap[]): HallOfFameScorer | undefined {
  const byPlayer = new Map<string, HallOfFameScorer>();
  for (const recap of recaps) {
    const award = recap.topScorer;
    if (award === undefined) continue;
    const existing = byPlayer.get(award.playerId);
    const goals = goldenBootGoals(award.detail);
    if (existing === undefined) {
      byPlayer.set(award.playerId, {
        playerId: award.playerId,
        // Denormalised at the moment it was true: the man may have retired,
        // been sold, or had his ID recycled by a regenerated rival roster.
        playerName: award.playerName,
        goals,
        goldenBoots: 1,
      });
      continue;
    }
    existing.goals += goals;
    existing.goldenBoots += 1;
  }
  return [...byPlayer.values()].sort((left, right) => (
    right.goals - left.goals
    || right.goldenBoots - left.goldenBoots
    || compareIds(left.playerId, right.playerId)
  ))[0];
}

function seasonCount(seasons: number): string {
  return `${seasons} season${seasons === 1 ? '' : 's'}`;
}

function goldenBootCount(boots: number): string {
  return `${boots} Golden Boot season${boots === 1 ? '' : 's'}`;
}

function ordinal(position: number): string {
  const tens = position % 100;
  if (tens >= 11 && tens <= 13) return `${position}th`;
  const units = position % 10;
  if (units === 1) return `${position}st`;
  if (units === 2) return `${position}nd`;
  if (units === 3) return `${position}rd`;
  return `${position}th`;
}
