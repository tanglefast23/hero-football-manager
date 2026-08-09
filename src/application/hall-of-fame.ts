import { compareIds, DIVISION_NAME_KEYS, divisionTierLabelWith, rosterForClub } from '../game';
import type { DivisionLevel } from '../game/pyramid';
import type {
  GameState,
  HallOfFameRecord,
  HallOfFameScorer,
  HallOfFameTier,
  HallOfFameTitle,
  SeasonRecap,
} from '../game/types';
import { copyFor, type CopyFn } from '../i18n';
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
 *
 * WHICH HALF MAY BE TRANSLATED. Only the reading half. Everything
 * `captureHallOfFameRecord` writes goes into the save and is read back for the
 * life of the career, so its one piece of prose — the `Your club` fallback —
 * stays English on purpose and takes no `t`. The view models below are built
 * fresh on every render and never persisted, so all of their copy is catalog
 * copy.
 */

/**
 * The pyramid's own names, so a tier is named here exactly as the league table
 * names it. The record persists a plain number, and the codec constrains it to
 * the five real levels, so the fallbacks are defensive only.
 */
const DIVISION_LEVELS: readonly DivisionLevel[] = [1, 2, 3, 4, 5];

/**
 * English copy, for every caller that has not threaded a locale through yet —
 * the same parameter-with-a-default shape `view-models.ts` uses.
 */
let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

function asDivisionLevel(division: number): DivisionLevel | undefined {
  return DIVISION_LEVELS.find(level => level === division);
}

function divisionName(division: number, t: CopyFn): string {
  const level = asDivisionLevel(division);
  return level === undefined
    ? t('hallOfFame.divisionFallback', { division })
    : t(DIVISION_NAME_KEYS[level]);
}

function divisionLabel(division: number, t: CopyFn): string {
  const level = asDivisionLevel(division);
  return level === undefined ? `D${division}` : divisionTierLabelWith(level, t);
}

/**
 * How many goals a season's Golden Boot was worth.
 *
 * `buildSeasonRecap` now persists the count as `award.goals`, so this reads a
 * number and never a sentence. The regex is the **legacy path only**, for
 * recaps saved before that field existed.
 *
 * It used to be the only path, which made a display string load-bearing: the
 * detail reads "22 goals", so any rewording — and every translation — would
 * silently zero a career's top-scorer total. Nothing would have caught it,
 * because the copy stayed perfectly valid.
 *
 * A detail this cannot parse still counts zero rather than throwing: a career
 * must never be unable to reach its own record.
 */
export function goldenBootGoals(award: { detail: string; goals?: number }): number {
  if (typeof award.goals === 'number') return award.goals;
  const match = /^(\d+) goals$/.exec(award.detail);
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
/** @i18n-fallback Club names are persisted product data and stay English. */
export function captureHallOfFameRecord(state: GameState): HallOfFameRecord {
  const recaps = [...(state.seasonRecaps ?? [])].sort((left, right) => left.season - right.season);
  // NOT catalog copy, deliberately. This is written into the save and read back
  // as the club's name for the rest of the career, so a translated value would
  // be baked into the record in whatever language the summit happened to be
  // played in and would stay there after a language change. Club names stay
  // English by product decision, and this stands in for one.
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
export function hallOfFameViewModel(
  state: GameState,
  t: CopyFn = englishCopy(),
): HallOfFameViewModel {
  const record = state.hallOfFame;
  if (record === undefined) {
    const lines = [
      t('hallOfFame.lockedLead'),
      t('hallOfFame.lockedCondition'),
    ];
    return {
      status: 'locked',
      title: t('settings.hallOfFame.label'),
      kicker: t('hallOfFame.clubRecords'),
      headline: t('hallOfFame.notWrittenYet'),
      lines,
      accessibilityLabel: t('hallOfFame.a11yLocked', { lines: lines.join(' ') }),
    };
  }

  const stats = recordStats(record, t);
  const honours = recordHonours(record, t);
  return {
    status: 'complete',
    title: t('settings.hallOfFame.label'),
    kicker: t('hallOfFame.clubRecords'),
    headline: record.clubName,
    subheading: t('hallOfFame.completedIn', { seasons: seasonCount(record.season, t) }),
    stats,
    honours,
    // Defensive: the page cannot be reached without the Cup, so an empty list
    // means a record from a save the Cup history no longer backs. Better a
    // written line than an empty box that looks like a rendering fault.
    honoursEmptyLabel: t('hallOfFame.honoursEmpty'),
    tiers: record.tiers.map(tier => tierViewModel(tier, t)),
    accessibilityLabel: [
      t('hallOfFame.a11yTitle', { club: record.clubName }),
      t('hallOfFame.a11yCompletedIn', { seasons: seasonCount(record.season, t) }),
      ...stats.map(stat => `${stat.label}: ${stat.value}. ${stat.detail}`),
    ].join(' '),
  };
}

/** The headline numbers, in the order the page reads them. */
function recordStats(record: HallOfFameRecord, t: CopyFn): HallOfFameStatViewModel[] {
  const goalDifference = record.goalsFor - record.goalsAgainst;
  const stats: HallOfFameStatViewModel[] = [
    {
      id: 'seasons',
      label: t('hallOfFame.statSeasons'),
      value: `${record.season}`,
      detail: t('hallOfFame.statSeasonsDetail', { season: record.season }),
    },
    {
      id: 'record',
      label: t('hallOfFame.statRecord'),
      value: `${record.won} / ${record.drawn} / ${record.lost}`,
      detail: t('hallOfFame.statRecordDetail', { played: record.played }),
    },
    {
      id: 'goals',
      label: t('hallOfFame.statGoals'),
      value: `${record.goalsFor} / ${record.goalsAgainst}`,
      detail: t('hallOfFame.statGoalsDetail', {
        difference: `${goalDifference >= 0 ? '+' : ''}${goalDifference}`,
      }),
    },
    {
      id: 'titles',
      label: t('hallOfFame.statTitles'),
      value: `${record.divisionTitles.length}`,
      detail: record.divisionTitles.length === 0
        ? t('hallOfFame.statTitlesEmpty')
        : record.divisionTitles.map(title => `D${title.division}`).join(' · '),
    },
    {
      id: 'cups',
      label: t('hallOfFame.statCups'),
      value: `${record.cupWinSeasons.length}`,
      detail: record.cupWinSeasons.length === 0
        ? t('hallOfFame.statCupsEmpty')
        : t('hallOfFame.statCupsDetail', {
            n: record.cupWinSeasons.length,
            seasons: record.cupWinSeasons.join(', '),
          }),
    },
  ];

  if (record.topScorer !== undefined) {
    const scorer = record.topScorer;
    stats.push({
      id: 'top-scorer',
      label: t('hallOfFame.statTopScorer'),
      value: scorer.playerName,
      // Says what the number is a total OF. It counts the seasons he led the
      // club, which is what the save keeps, and claiming a career total it
      // cannot prove would be the easier and worse sentence.
      detail: t('hallOfFame.statTopScorerDetail', {
        goals: scorer.goals,
        boots: goldenBootCount(scorer.goldenBoots, t),
      }),
    });
  }
  if (record.star !== undefined) {
    const star = record.star;
    stats.push({
      id: 'star',
      label: t('hallOfFame.statMostFamous'),
      value: star.playerName,
      detail: t('hallOfFame.statMostFamousDetail', {
        fame: star.fame,
        seasons: seasonCount(star.seasonsAtClub, t),
      }),
    });
  }
  return stats;
}

/** Every trophy, oldest first, so the list reads as the climb happened. */
function recordHonours(record: HallOfFameRecord, t: CopyFn): HallOfFameHonourViewModel[] {
  const honours = [
    ...record.divisionTitles.map(title => ({
      id: `title-${title.season}`,
      season: title.season,
      label: t('leagueTable.seasonLabel', { season: title.season }),
      // The D-number is left off: the climb ladder below carries it, and the
      // name is the part that says which trophy this was.
      value: t('hallOfFame.honourChampions', { division: divisionName(title.division, t) }),
    })),
    ...record.cupWinSeasons.map(season => ({
      id: `cup-${season}`,
      season,
      label: t('leagueTable.seasonLabel', { season }),
      value: t('cupBracket.heroCupWinners'),
    })),
  ];
  return honours
    // Two trophies in one season list in a fixed order rather than in whichever
    // order they were pushed: the Cup before the title, alphabetically by id.
    .sort((left, right) => left.season - right.season || compareIds(left.id, right.id))
    .map(({ id, label, value }) => ({ id, label, value }));
}

function tierViewModel(tier: HallOfFameTier, t: CopyFn): HallOfFameTierViewModel {
  return {
    division: tier.division,
    label: divisionLabel(tier.division, t),
    firstSeason: tier.firstSeason,
    seasons: tier.seasons,
    bestPosition: tier.bestPosition,
    best: t('hallOfFame.tierBest', { position: ordinal(tier.bestPosition) }),
    detail: t('hallOfFame.tierDetail', {
      season: tier.firstSeason,
      seasons: seasonCount(tier.seasons, t),
    }),
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
    const goals = goldenBootGoals(award);
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

function seasonCount(seasons: number, t: CopyFn): string {
  return t('viewModels.seasonCount', { n: seasons, count: seasons });
}

function goldenBootCount(boots: number, t: CopyFn): string {
  return t('hallOfFame.goldenBootCount', { n: boots, count: boots });
}

/**
 * English ordinal suffixes, left in the source. Every locale forms these
 * differently and several do not use a suffix at all, so a `1st`/`2nd` table is
 * not something a per-key catalog entry can express — it needs its own rule per
 * language. Out of scope for a copy extraction; noted rather than half-done.
 */
function ordinal(position: number): string {
  const tens = position % 100;
  if (tens >= 11 && tens <= 13) return `${position}th`;
  const units = position % 10;
  if (units === 1) return `${position}st`;
  if (units === 2) return `${position}nd`;
  if (units === 3) return `${position}rd`;
  return `${position}th`;
}
