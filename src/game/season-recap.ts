import { divisionPodium } from './division-leaders';
import { currentUserDivision } from './m2-career';
import { compareIds, compareStandings } from './ordering';
import { CUP_ROUND_NAME_KEYS } from './pyramid';
import type {
  AwardCategoryId,
  CareerPlayer,
  DivisionAwardPlacement,
  GameState,
  PlayerSeasonStatLine,
  SeasonRecap,
  SeasonRecapAward,
} from './types';

export function buildSeasonRecap(state: GameState): SeasonRecap {
  const fixtures = state.fixtures.filter(
    (fixture) =>
      fixture.season === state.season &&
      fixture.status === 'played' &&
      fixture.score !== undefined &&
      (fixture.homeClubId === state.userClubId ||
        fixture.awayClubId === state.userClubId),
  );
  let won = 0;
  let drawn = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  for (const fixture of fixtures) {
    const home = fixture.homeClubId === state.userClubId;
    const scored = home ? fixture.score!.homeGoals : fixture.score!.awayGoals;
    const conceded = home ? fixture.score!.awayGoals : fixture.score!.homeGoals;
    goalsFor += scored;
    goalsAgainst += conceded;
    if (scored > conceded) won += 1;
    else if (scored < conceded) lost += 1;
    else drawn += 1;
  }

  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined)
    throw new Error(`unknown user club ${state.userClubId}`);
  const cashChange = club.cash - seasonOpeningCash(state, club.cash);
  const roster = state.players.filter(
    (player) => player.clubId === state.userClubId,
  );
  // Both competitions: the Golden Boot is the club's own award, and it counted
  // cup goals before stat lines were split by competition. Only the division
  // board is league-only.
  const goalsByPlayer = new Map<string, number>();
  for (const line of state.seasonStatLines ?? []) {
    if (line.season !== state.season) continue;
    goalsByPlayer.set(
      line.playerId,
      (goalsByPlayer.get(line.playerId) ?? 0) + line.goals,
    );
  }
  const sortedScorers = roster
    .slice()
    .sort(
      (left, right) =>
        (goalsByPlayer.get(right.id) ?? 0) -
          (goalsByPlayer.get(left.id) ?? 0) ||
        playerScore(right) - playerScore(left) ||
        compareIds(left.id, right.id),
    );
  const sortedPlayers = roster
    .slice()
    .sort(
      (left, right) =>
        playerSeasonScore(right, goalsByPlayer) -
          playerSeasonScore(left, goalsByPlayer) ||
        compareIds(left.id, right.id),
    );
  const topScorerGoals =
    sortedScorers[0] === undefined
      ? 0
      : (goalsByPlayer.get(sortedScorers[0].id) ?? 0);
  const young = sortedPlayers.filter((player) => (player.age ?? 99) <= 21)[0];
  const hero = sortedPlayers.filter((player) => player.power !== undefined)[0];
  const position = finalPosition(state);
  const latestResolvedEvent = state.resolvedEventHistory
    ?.filter((event) => event.season === state.season)
    .at(-1)?.eventId;

  return {
    season: state.season,
    division: state.m2 === undefined ? 5 : currentUserDivision(state.m2),
    finalPosition: position,
    played: fixtures.length,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    cashChange,
    closingCash: club.cash,
    // Cap-free development plus instant drills retired cap notices entirely;
    // the persisted recap field stays for old saves and always reads zero now.
    trainingCapsReached: 0,
    ...cupResult(state),
    divisionAwards: divisionAwards(state),
    ...(latestResolvedEvent === undefined
      ? {}
      : { memorableEventId: latestResolvedEvent }),
    // A Golden Boot for nobody is worse than no Golden Boot at all.
    ...(topScorerGoals === 0 || sortedScorers[0] === undefined
      ? {}
      : {
          topScorer: award(
            sortedScorers[0],
            'Golden Boot',
            `${topScorerGoals} goals`,
            'recap.award.goldenBoot',
            { goals: topScorerGoals },
            topScorerGoals,
          ),
        }),
    ...(sortedPlayers[0] === undefined
      ? {}
      : {
          playerOfSeason: award(
            sortedPlayers[0],
            'Player of the Season',
            'Goals, form, morale, and development',
            'recap.award.playerOfTheSeason',
          ),
        }),
    ...(young === undefined
      ? {}
      : {
          youngPlayer: award(
            young,
            'Young Player',
            `Age ${young.age ?? 21} breakout season`,
            'recap.award.youngPlayer',
            { age: young.age ?? 21 },
          ),
        }),
    ...(hero === undefined
      ? {}
      : {
          heroOfSeason: award(
            hero,
            'Hero of the Season',
            `${hero.power!.replaceAll('_', ' ')} made the difference`,
            'recap.award.heroOfSeason',
            { power: hero.power!.replaceAll('_', ' ') },
          ),
        }),
  };
}

function seasonOpeningCash(state: GameState, closingCash: number): number {
  if (state.seasonOpeningCash !== undefined) return state.seasonOpeningCash;
  // Compatibility for saves created before M4. Reconstruct the opening balance
  // from every persisted cash movement we can identify in the current season.
  const ledgerChange = state.ledgers
    .filter((ledger) => ledger.season === state.season)
    .reduce(
      (total, ledger) =>
        total + ledger.lines.reduce((sum, line) => sum + line.amount, 0),
      0,
    );
  const transactionChange = (state.cashTransactions ?? [])
    .filter((transaction) => transaction.season === state.season)
    .reduce((total, transaction) => total + transaction.amount, 0);
  return closingCash - ledgerChange - transactionChange;
}

/**
 * The four podiums, captured while every player on them still exists.
 *
 * `SeasonRecapAward` is not reused: it carries no club, and its number survives
 * only inside a display string. The ceremony renders a club beside each placing
 * and compares the values numerically.
 */
function divisionAwards(
  state: GameState,
): Record<AwardCategoryId, DivisionAwardPlacement[]> {
  const division = {
    season: state.season,
    players: state.players,
    statLines: state.seasonStatLines ?? [],
  };
  return {
    goals: divisionPodium({ ...division, category: 'goals' }),
    passesCompleted: divisionPodium({
      ...division,
      category: 'passesCompleted',
    }),
    tacklesWon: divisionPodium({ ...division, category: 'tacklesWon' }),
    saves: divisionPodium({ ...division, category: 'saves' }),
  };
}

/**
 * Keeps only the rows the career can still render: a named player, in a season
 * no older than the one that just finished.
 *
 * A promotion or relegation regenerates every rival roster, so those player IDs
 * resolve to nothing and their rows could only ever render as `p_10423 · 22
 * goals`. Retired players are spared that rule explicitly: they leave
 * `state.players` at the season transition, and a rule keyed on that array
 * alone would delete the career record of the club's own retired heroes.
 *
 * Past seasons go because nothing durable reads them. Every board filters to
 * the current season — the division leaderboards, the recap's Golden Boot, the
 * championship celebration — and the podiums that mattered are already
 * denormalised into `SeasonRecap.divisionAwards`, names and clubs included,
 * precisely because raw rows do not survive a division change. The one
 * unfiltered reader is the `first-hero-goal` milestone, and milestone flags are
 * appended to `state.eventFlags` and never removed, so an earned flag cannot be
 * un-earned by pruning the evidence a season later. Without this, a player who
 * stays fifteen seasons carries fifteen rows forever.
 *
 * Called with the pre-transition state, so `state.season` is the season that
 * just finished: it is kept, and everything before it is dropped.
 *
 * Only safe to run once the recap has snapshotted the season's podiums.
 */
export function prunedStatLines(state: GameState): PlayerSeasonStatLine[] {
  const known = new Set([
    ...state.players.map((player) => player.id),
    ...(state.retiredPlayers ?? []).map((player) => player.id),
  ]);
  return (state.seasonStatLines ?? []).filter(
    (line) => line.season >= state.season && known.has(line.playerId),
  );
}

export function recordSeasonRecap(state: GameState): GameState {
  const recap = buildSeasonRecap(state);
  return {
    ...state,
    seasonRecaps: [
      ...(state.seasonRecaps ?? []).filter(
        (candidate) => candidate.season !== recap.season,
      ),
      recap,
    ].sort((left, right) => left.season - right.season),
  };
}

export function latestSeasonRecap(state: GameState): SeasonRecap | undefined {
  return state.seasonRecaps?.find(
    (candidate) => candidate.season === state.season,
  );
}

/**
 * @i18n-fallback `label` and `detail` are the English source for `labelKey` and
 * `${labelKey}.detail`, passed as arguments so this helper can attach the key.
 * The English also stays in the save, because `hall-of-fame.ts` parses a legacy
 * recap's `detail` for its goal count.
 */
function award(
  player: CareerPlayer,
  label: string,
  detail: string,
  labelKey: string,
  labelParams?: Readonly<Record<string, string | number>>,
  goals?: number,
): SeasonRecapAward {
  return {
    playerId: player.id,
    playerName: player.name,
    label,
    detail,
    labelKey,
    ...(labelParams === undefined ? {} : { labelParams }),
    ...(goals === undefined ? {} : { goals }),
  };
}

function playerScore(player: CareerPlayer): number {
  return Object.values(player.attrs).reduce((sum, value) => sum + value, 0);
}

/**
 * Fame enters at a tenth of its face value, and has to.
 *
 * This picks the season's player, and the other three terms are a season's
 * work: a few hundred points of attributes, thirty a goal, a morale reading out
 * of 100. Fame is a career total that runs to `FAME_CEILING`, so added whole it
 * would outweigh every one of them and the award would go to whoever had been
 * here longest, every year, forever. A tenth keeps it worth what it was worth
 * when the ceiling was 99: a nudge between close candidates.
 */
function playerSeasonScore(
  player: CareerPlayer,
  goals: ReadonlyMap<string, number>,
): number {
  return (
    playerScore(player) +
    (goals.get(player.id) ?? 0) * 30 +
    (player.morale ?? 0) +
    Math.round((player.fame ?? 0) / 10)
  );
}

/**
 * Where the club finished the season it just played.
 *
 * Ordered by `compareStandings` — the same comparator `leagueStandings` sorts
 * with, imported rather than restated. The transition promotes and relegates
 * off that table while the awards ceremony prices its prize off this number, so
 * the two must be one rule. Restating the terms here is what let them drift:
 * this function once tiebroke with `localeCompare` where the table used plain
 * `<`/`>`, and on an exact points, goal-difference and goals-for tie across the
 * promotion cutoff the ceremony could frame a promotion that never happened.
 */
function finalPosition(state: GameState): number {
  const rows = state.clubs
    .map((club) => {
      let points = 0;
      let goalDifference = 0;
      let goalsFor = 0;
      for (const fixture of state.fixtures) {
        if (
          fixture.season !== state.season ||
          fixture.status !== 'played' ||
          fixture.score === undefined
        )
          continue;
        if (fixture.homeClubId !== club.id && fixture.awayClubId !== club.id)
          continue;
        const home = fixture.homeClubId === club.id;
        const scored = home ? fixture.score.homeGoals : fixture.score.awayGoals;
        const conceded = home
          ? fixture.score.awayGoals
          : fixture.score.homeGoals;
        goalDifference += scored - conceded;
        goalsFor += scored;
        points += scored > conceded ? 3 : scored === conceded ? 1 : 0;
      }
      return { clubId: club.id, points, goalDifference, goalsFor };
    })
    .sort(compareStandings);
  const index = rows.findIndex((row) => row.clubId === state.userClubId);
  if (index >= 0) return index + 1;
  return rows.length;
}

/**
 * @i18n-fallback English beside `cupResultKey`, which the screen renders
 * instead.
 *
 * The named-round branch used to carry no key, on the reasoning that the round
 * label is keyed where the bracket is built — but this value is denormalised
 * into the save and read back by the SeasonEnd panel, which never sees the
 * bracket. So every season of every new career put an English "Quarter-final"
 * on the panel title in all six languages. `CUP_ROUND_NAME_KEYS` supplies the
 * key; the English stays as the fallback for recaps written before it did.
 */
function cupResult(
  state: GameState,
): Pick<SeasonRecap, 'cupResult' | 'cupResultKey'> {
  const cup = state.m2?.nationalCups.find(
    (candidate) => candidate.season === state.season,
  );
  if (cup === undefined)
    return { cupResult: 'Not entered', cupResultKey: 'recap.cupNotEntered' };
  if (cup.championClubId === state.userClubId) {
    return { cupResult: 'Winners', cupResultKey: 'recap.cupWinners' };
  }
  const lastRound = cup.rounds
    .filter((round) =>
      round.fixtures.some(
        (fixture) =>
          fixture.homeClubId === state.userClubId ||
          fixture.awayClubId === state.userClubId,
      ),
    )
    .at(-1);
  return lastRound?.label === undefined
    ? { cupResult: 'Entered', cupResultKey: 'recap.cupEntered' }
    : {
        cupResult: lastRound.label,
        cupResultKey: CUP_ROUND_NAME_KEYS[lastRound.label],
      };
}
