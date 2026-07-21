import { currentUserDivision } from './m2-career';
import type { CareerPlayer, GameState, SeasonRecap, SeasonRecapAward } from './types';

export function buildSeasonRecap(state: GameState): SeasonRecap {
  const fixtures = state.fixtures.filter(fixture => (
    fixture.season === state.season
    && fixture.status === 'played'
    && fixture.score !== undefined
    && (fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId)
  ));
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

  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  const cashChange = club.cash - seasonOpeningCash(state, club.cash);
  const roster = state.players.filter(player => player.clubId === state.userClubId);
  const goalsByPlayer = new Map(
    (state.seasonGoalTallies ?? [])
      .filter(tally => tally.season === state.season)
      .map(tally => [tally.playerId, tally.goals]),
  );
  const sortedScorers = roster.slice().sort((left, right) => (
    (goalsByPlayer.get(right.id) ?? 0) - (goalsByPlayer.get(left.id) ?? 0)
    || playerScore(right) - playerScore(left)
    || left.id.localeCompare(right.id)
  ));
  const sortedPlayers = roster.slice().sort((left, right) => (
    playerSeasonScore(right, goalsByPlayer) - playerSeasonScore(left, goalsByPlayer)
    || left.id.localeCompare(right.id)
  ));
  const topScorerGoals = sortedScorers[0] === undefined
    ? 0
    : goalsByPlayer.get(sortedScorers[0].id) ?? 0;
  const young = sortedPlayers.filter(player => (player.age ?? 99) <= 21)[0];
  const hero = sortedPlayers.filter(player => player.power !== undefined)[0];
  const position = finalPosition(state);
  const latestResolvedEvent = state.resolvedEventHistory
    ?.filter(event => event.season === state.season)
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
    trainingCapsReached: (state.trainingCapNotices ?? []).filter(notice => notice.season === state.season).length,
    cupResult: cupResult(state),
    ...(latestResolvedEvent === undefined ? {} : { memorableEventId: latestResolvedEvent }),
    // A Golden Boot for nobody is worse than no Golden Boot at all.
    ...(topScorerGoals === 0 || sortedScorers[0] === undefined ? {} : {
      topScorer: award(sortedScorers[0], 'Golden Boot', `${topScorerGoals} goals`),
    }),
    ...(sortedPlayers[0] === undefined ? {} : {
      playerOfSeason: award(sortedPlayers[0], 'Player of the Season', 'Goals, form, morale, and development'),
    }),
    ...(young === undefined ? {} : {
      youngPlayer: award(young, 'Young Player', `Age ${young.age ?? 21} breakout season`),
    }),
    ...(hero === undefined ? {} : {
      heroOfSeason: award(hero, 'Hero of the Season', `${hero.power!.replaceAll('_', ' ')} made the difference`),
    }),
  };
}

function seasonOpeningCash(state: GameState, closingCash: number): number {
  if (state.seasonOpeningCash !== undefined) return state.seasonOpeningCash;
  // Compatibility for saves created before M4. Reconstruct the opening balance
  // from every persisted cash movement we can identify in the current season.
  const ledgerChange = state.ledgers
    .filter(ledger => ledger.season === state.season)
    .reduce(
      (total, ledger) => total + ledger.lines.reduce((sum, line) => sum + line.amount, 0),
      0,
    );
  const transactionChange = (state.cashTransactions ?? [])
    .filter(transaction => transaction.season === state.season)
    .reduce((total, transaction) => total + transaction.amount, 0);
  return closingCash - ledgerChange - transactionChange;
}

export function recordSeasonRecap(state: GameState): GameState {
  const recap = buildSeasonRecap(state);
  return {
    ...state,
    seasonRecaps: [
      ...(state.seasonRecaps ?? []).filter(candidate => candidate.season !== recap.season),
      recap,
    ].sort((left, right) => left.season - right.season),
  };
}

export function latestSeasonRecap(state: GameState): SeasonRecap | undefined {
  return state.seasonRecaps?.find(candidate => candidate.season === state.season);
}

function award(player: CareerPlayer, label: string, detail: string): SeasonRecapAward {
  return { playerId: player.id, playerName: player.name, label, detail };
}

function playerScore(player: CareerPlayer): number {
  return Object.values(player.attrs).reduce((sum, value) => sum + value, 0);
}

function playerSeasonScore(player: CareerPlayer, goals: ReadonlyMap<string, number>): number {
  return playerScore(player) + (goals.get(player.id) ?? 0) * 30 + (player.morale ?? 0) + (player.fame ?? 0);
}

function finalPosition(state: GameState): number {
  const rows = state.clubs.map(club => {
    let played = 0;
    let points = 0;
    let difference = 0;
    for (const fixture of state.fixtures) {
      if (fixture.season !== state.season || fixture.status !== 'played' || fixture.score === undefined) continue;
      if (fixture.homeClubId !== club.id && fixture.awayClubId !== club.id) continue;
      const home = fixture.homeClubId === club.id;
      const scored = home ? fixture.score.homeGoals : fixture.score.awayGoals;
      const conceded = home ? fixture.score.awayGoals : fixture.score.homeGoals;
      played += 1;
      difference += scored - conceded;
      points += scored > conceded ? 3 : scored === conceded ? 1 : 0;
    }
    return { clubId: club.id, played, points, difference };
  }).sort((left, right) => right.points - left.points || right.difference - left.difference || left.clubId.localeCompare(right.clubId));
  const index = rows.findIndex(row => row.clubId === state.userClubId);
  if (index >= 0) return index + 1;
  return rows.length;
}

function cupResult(state: GameState): string {
  const cup = state.m2?.nationalCups.find(candidate => candidate.season === state.season);
  if (cup === undefined) return 'Not entered';
  if (cup.championClubId === state.userClubId) return 'Winners';
  const lastRound = cup.rounds
    .filter(round => round.fixtures.some(fixture => (
      fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId
    )))
    .at(-1);
  return lastRound?.label ?? 'Entered';
}
