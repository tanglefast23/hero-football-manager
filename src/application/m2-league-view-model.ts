import {
  currentUserDivision,
  type M2CareerState,
} from '../game/m2-career';
import type {
  DivisionLevel,
  NationalCup,
  NationalCupFixture,
  NationalCupRound,
} from '../game/pyramid';
import { divisionTierLabel } from '../game/pyramid';
import type { LeagueFixture, LeagueStanding } from '../game/types';
import type {
  M2CupFixtureViewModel,
  M2CupRoundViewModel,
  M2CupRoundHistoryViewModel,
  M2DivisionSummaryViewModel,
  M2LeagueFixtureViewModel,
  M2LeagueViewModel,
  M2NationalCupViewModel,
} from '../ui/m2-league-models';

export interface M2LeagueViewModelSource {
  readonly career: M2CareerState;
  readonly season: number;
  readonly activeStandings: readonly LeagueStanding[];
  readonly userSquadStrength?: number;
  readonly selectedDivision?: DivisionLevel;
  readonly selectedCupSeason?: number;
  readonly week?: number;
  readonly phase?: 'manage' | 'matchday' | 'season-end' | 'complete';
  /** The full game schedule; the view model selects this club's current-season road. */
  readonly leagueFixtures?: readonly LeagueFixture[];
}

/** Maps the sidecar pyramid and the live ten-club table into player-facing copy. */
export function m2LeagueViewModel(source: M2LeagueViewModelSource): M2LeagueViewModel {
  validateSeason(source.season);
  const userDivision = currentUserDivision(source.career);
  const userSquadStrength = source.userSquadStrength ?? source.career.pyramid.divisions
    .find(division => division.level === userDivision)!
    .clubs.find(club => club.id === source.career.userClubId)!
    .squadStrength;
  validateStrength(userSquadStrength, 'user squad strength');
  const selectedDivision = source.selectedDivision ?? userDivision;
  const selectedExists = source.career.pyramid.divisions.some(division =>
    division.level === selectedDivision,
  );
  if (!selectedExists) throw new Error(`unknown selected division ${selectedDivision}`);
  const clubNames = new Map(source.career.pyramid.divisions.flatMap(division =>
    division.clubs.map(club => [club.id, club.name] as const),
  ));
  const divisions = source.career.pyramid.divisions
    .slice()
    .sort((left, right) => left.level - right.level)
    .map(division => divisionSummary(
      division.level,
      division.clubs.map(club => club.squadStrength),
      selectedDivision,
      userDivision,
      userSquadStrength,
    ));
  const selectedDivisionSummary = divisions.find(division => division.level === selectedDivision)!;
  const rows = activeTableRows(source, userDivision, clubNames);
  const userRow = rows.find(row => row.isUserClub);
  if (userRow === undefined) throw new Error('the active standings do not contain the user club');

  return {
    title: 'League & Cup',
    seasonLabel: `Season ${source.season}`,
    userDivisionBadge: `D${userDivision} · #${userRow.position}`,
    selectedDivision,
    divisions,
    selectedDivisionSummary,
    activeTable: {
      divisionLabel: divisionTierLabel(userDivision),
      rulesLabel: movementRulesLabel(userDivision),
      matchesPlayed: userRow.played,
      rows,
    },
    leagueFixtures: leagueFixtureHistory(source, clubNames),
    cup: cupViewModel(source, clubNames),
  };
}

function divisionSummary(
  level: DivisionLevel,
  strengths: readonly number[],
  selectedDivision: DivisionLevel,
  userDivision: DivisionLevel,
  userSquadStrength: number,
): M2DivisionSummaryViewModel {
  if (strengths.length !== 10 || strengths.some(strength =>
    !Number.isInteger(strength) || strength < 1 || strength > 99
  )) {
    throw new Error(`Division ${level} must contain ten valid club strengths`);
  }
  const total = strengths.reduce((sum, strength) => sum + strength, 0);
  const minimum = Math.min(...strengths);
  const maximum = Math.max(...strengths);
  const comparison = strengthComparison(userSquadStrength, minimum, maximum);
  return {
    level,
    shortLabel: `D${level}`,
    label: divisionTierLabel(level),
    clubCount: strengths.length,
    averageStrength: Math.round(total / strengths.length),
    strengthRangeLabel: `${minimum}–${maximum}`,
    userSquadStrength,
    comparisonLabel: comparison.label,
    comparisonTone: comparison.tone,
    selected: level === selectedDivision,
    userDivision: level === userDivision,
  };
}

function strengthComparison(
  userSquadStrength: number,
  minimum: number,
  maximum: number,
): { label: string; tone: M2DivisionSummaryViewModel['comparisonTone'] } {
  if (userSquadStrength < minimum) {
    return { label: `${minimum - userSquadStrength} below range`, tone: 'below' };
  }
  if (userSquadStrength > maximum) {
    return { label: `${userSquadStrength - maximum} above range`, tone: 'above' };
  }
  return { label: 'Within range', tone: 'competitive' };
}

function validateStrength(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 99) {
    throw new Error(`${label} must be an integer from 1 to 99`);
  }
}

function activeTableRows(
  source: M2LeagueViewModelSource,
  userDivision: DivisionLevel,
  clubNames: ReadonlyMap<string, string>,
): M2LeagueViewModel['activeTable']['rows'] {
  const activeClubIds = new Set(
    source.career.pyramid.divisions.find(division => division.level === userDivision)!
      .clubs.map(club => club.id),
  );
  if (source.activeStandings.length !== 10) {
    throw new Error('the active league table requires exactly ten standings');
  }
  const seenClubIds = new Set<string>();
  const seenPositions = new Set<number>();
  for (const standing of source.activeStandings) {
    if (!activeClubIds.has(standing.clubId)) {
      throw new Error(`standing ${standing.clubId} does not belong to the active division`);
    }
    if (seenClubIds.has(standing.clubId)) throw new Error(`duplicate standing for ${standing.clubId}`);
    if (!Number.isInteger(standing.position) || standing.position < 1 || standing.position > 10) {
      throw new Error(`standing ${standing.clubId} has an invalid position`);
    }
    if (seenPositions.has(standing.position)) throw new Error(`duplicate league position ${standing.position}`);
    seenClubIds.add(standing.clubId);
    seenPositions.add(standing.position);
    validateStandingNumbers(standing);
  }

  return source.activeStandings
    .slice()
    .sort((left, right) => left.position - right.position)
    .map(standing => ({
      position: standing.position,
      clubId: standing.clubId,
      clubName: requireClubName(clubNames, standing.clubId),
      played: standing.played,
      won: standing.won,
      drawn: standing.drawn,
      lost: standing.lost,
      goalDifference: standing.goalDifference,
      points: standing.points,
      isUserClub: standing.clubId === source.career.userClubId,
      movement: standing.position <= 2 && userDivision > 1
        ? 'PROMOTION' as const
        : standing.position >= 9 && userDivision < 5
          ? 'RELEGATION' as const
          : 'NONE' as const,
    }));
}

function cupViewModel(
  source: M2LeagueViewModelSource,
  clubNames: ReadonlyMap<string, string>,
): M2NationalCupViewModel {
  const cups = source.career.nationalCups.slice().sort((left, right) => left.season - right.season);
  if (cups.length === 0) {
    return {
      available: false,
      seasonOptions: [],
      seasonLabel: `Season ${source.season}`,
      statusLabel: 'Draw pending',
      currentRoundLabel: 'National Cup not drawn',
      currentRoundFixtures: [],
      rounds: [],
      history: [],
    };
  }
  const selectedCup = selectCup(cups, source.selectedCupSeason);
  const currentRound = selectedCup.rounds[selectedCup.rounds.length - 1];
  if (currentRound === undefined) throw new Error(`Season ${selectedCup.season} cup has no rounds`);
  const championName = selectedCup.championClubId === undefined
    ? undefined
    : requireClubName(clubNames, selectedCup.championClubId);
  const roundIsPlayable = selectedCup.season === source.season
    && source.week === [5, 10, 15, 20, 25, 30][currentRound.number - 1]
    && source.phase === 'matchday';
  const rounds = cupRoadToFinal(
    selectedCup,
    source.career.userClubId,
    clubNames,
    currentRound.number,
    roundIsPlayable,
  );

  return {
    available: true,
    seasonOptions: cups.map(cup => ({
      season: cup.season,
      label: `S${cup.season}`,
      selected: cup.season === selectedCup.season,
      complete: cup.championClubId !== undefined,
      ...(cup.championClubId === undefined
        ? {}
        : { championName: requireClubName(clubNames, cup.championClubId) }),
    })),
    seasonLabel: `Season ${selectedCup.season}`,
    statusLabel: championName === undefined ? 'Cup live' : 'Cup complete',
    currentRoundLabel: championName === undefined ? currentRound.label : 'Final result',
    currentRoundFixtures: currentRound.fixtures.map(fixture => cupFixture(
      fixture,
      currentRound,
      source.career.userClubId,
      clubNames,
      roundIsPlayable,
    )),
    rounds,
    history: rounds
      .filter(round => round.drawn)
      .map(({ fixtures: _fixtures, byes: _byes, active: _active, drawn: _drawn, ...history }) => history),
    ...(championName === undefined ? {} : { championName }),
  };
}

/** Maps a single league fixture to its player-facing row. Shared by the M2 pyramid league
 * builder and the season-1 single-division league builder — both careers use the same
 * `LeagueFixture` shape and the same "your result, at a glance" presentation. */
export function leagueFixtureViewModel(
  fixture: LeagueFixture,
  userClubId: string,
  currentWeek: number | undefined,
  clubName: (clubId: string) => string,
): M2LeagueFixtureViewModel {
  const userIsHome = fixture.homeClubId === userClubId;
  const opponentId = userIsHome ? fixture.awayClubId : fixture.homeClubId;
  const score = fixture.score;
  if (fixture.status === 'played' && score === undefined) {
    throw new Error(`played league fixture ${fixture.id} has no score`);
  }
  if (score !== undefined && (
    !Number.isSafeInteger(score.homeGoals)
    || score.homeGoals < 0
    || !Number.isSafeInteger(score.awayGoals)
    || score.awayGoals < 0
  )) throw new Error(`league fixture ${fixture.id} has an invalid score`);

  let result: M2LeagueFixtureViewModel['result'];
  if (score !== undefined) {
    const userGoals = userIsHome ? score.homeGoals : score.awayGoals;
    const opponentGoals = userIsHome ? score.awayGoals : score.homeGoals;
    result = userGoals > opponentGoals ? 'WIN' : userGoals < opponentGoals ? 'LOSS' : 'DRAW';
  }
  return {
    id: fixture.id,
    week: fixture.week,
    weekLabel: `Week ${fixture.week}`,
    homeClubName: clubName(fixture.homeClubId),
    awayClubName: clubName(fixture.awayClubId),
    opponentName: clubName(opponentId),
    venue: userIsHome ? 'HOME' : 'AWAY',
    scoreLabel: score === undefined ? 'VS' : `${score.homeGoals}-${score.awayGoals}`,
    status: fixture.status === 'played' ? 'PLAYED' : 'SCHEDULED',
    ...(result === undefined ? {} : { result }),
    currentWeek: fixture.week === currentWeek,
  };
}

function leagueFixtureHistory(
  source: M2LeagueViewModelSource,
  clubNames: ReadonlyMap<string, string>,
): M2LeagueFixtureViewModel[] {
  return (source.leagueFixtures ?? [])
    .filter(fixture => fixture.season === source.season && (
      fixture.homeClubId === source.career.userClubId
      || fixture.awayClubId === source.career.userClubId
    ))
    .slice()
    .sort((left, right) => left.week - right.week || left.round - right.round || left.id.localeCompare(right.id))
    .map(fixture => leagueFixtureViewModel(
      fixture,
      source.career.userClubId,
      source.week,
      clubId => requireClubName(clubNames, clubId),
    ));
}

function selectCup(cups: readonly NationalCup[], selectedCupSeason?: number): NationalCup {
  if (selectedCupSeason !== undefined) {
    const selected = cups.find(cup => cup.season === selectedCupSeason);
    if (selected === undefined) throw new Error(`Season ${selectedCupSeason} has no National Cup`);
    return selected;
  }
  return cups.find(cup => cup.championClubId === undefined) ?? cups[cups.length - 1];
}

function cupFixture(
  fixture: NationalCupFixture,
  round: NationalCupRound,
  userClubId: string,
  clubNames: ReadonlyMap<string, string>,
  roundIsPlayable: boolean,
): M2CupFixtureViewModel {
  const winnerName = fixture.winnerClubId === undefined
    ? undefined
    : requireClubName(clubNames, fixture.winnerClubId);
  const drawn = fixture.score !== undefined && fixture.score.homeGoals === fixture.score.awayGoals;
  return {
    id: fixture.id,
    roundLabel: round.label,
    homeClubName: requireClubName(clubNames, fixture.homeClubId),
    awayClubName: requireClubName(clubNames, fixture.awayClubId),
    scoreLabel: fixture.score === undefined
      ? 'VS'
      : `${fixture.score.homeGoals}-${fixture.score.awayGoals}${drawn ? ' P' : ''}`,
    status: fixture.status === 'played' ? 'PLAYED' : 'SCHEDULED',
    ...(winnerName === undefined ? {} : { winnerName }),
    involvesUserClub: fixture.homeClubId === userClubId || fixture.awayClubId === userClubId,
    userWon: fixture.winnerClubId === userClubId,
    playableNow: roundIsPlayable
      && fixture.status === 'scheduled'
      && (fixture.homeClubId === userClubId || fixture.awayClubId === userClubId),
  };
}

function cupRoundHistory(
  round: NationalCupRound,
  cup: NationalCup,
  userClubId: string,
): M2CupRoundHistoryViewModel {
  const completedCount = round.fixtures.filter(fixture => fixture.status === 'played').length;
  const userFixture = round.fixtures.find(fixture =>
    fixture.homeClubId === userClubId || fixture.awayClubId === userClubId,
  );
  let userOutcome: string | undefined;
  if (round.byeClubIds.includes(userClubId)) {
    userOutcome = 'Bye';
  } else if (userFixture?.status === 'scheduled') {
    userOutcome = 'Tie waiting';
  } else if (userFixture?.winnerClubId === userClubId) {
    userOutcome = cup.championClubId === userClubId && round.label === 'Final'
      ? 'Champion'
      : 'Advanced';
  } else if (userFixture?.winnerClubId !== undefined) {
    userOutcome = 'Eliminated';
  }
  return {
    round: round.number,
    label: round.label,
    matchCount: round.fixtures.length,
    completedCount,
    statusLabel: completedCount === round.fixtures.length ? 'Complete' : 'Live',
    ...(userOutcome === undefined ? {} : { userOutcome }),
  };
}

function cupRoundViewModel(
  round: NationalCupRound,
  cup: NationalCup,
  userClubId: string,
  clubNames: ReadonlyMap<string, string>,
  roundIsPlayable: boolean,
): M2CupRoundViewModel {
  return {
    ...cupRoundHistory(round, cup, userClubId),
    drawn: true,
    active: round.fixtures.some(fixture => fixture.status === 'scheduled'),
    fixtures: round.fixtures.map(fixture => cupFixture(
      fixture,
      round,
      userClubId,
      clubNames,
      roundIsPlayable,
    )),
    byes: round.byeClubIds.map(clubId => ({
      clubName: requireClubName(clubNames, clubId),
      involvesUserClub: clubId === userClubId,
    })),
  };
}

const CUP_ROAD: readonly {
  number: number;
  label: NationalCupRound['label'];
  matchCount: number;
}[] = [
  { number: 1, label: 'Play-in', matchCount: 18 },
  { number: 2, label: 'Round of 32', matchCount: 16 },
  { number: 3, label: 'Round of 16', matchCount: 8 },
  { number: 4, label: 'Quarter-final', matchCount: 4 },
  { number: 5, label: 'Semi-final', matchCount: 2 },
  { number: 6, label: 'Final', matchCount: 1 },
];

function cupRoadToFinal(
  cup: NationalCup,
  userClubId: string,
  clubNames: ReadonlyMap<string, string>,
  currentRoundNumber: number,
  roundIsPlayable: boolean,
): M2CupRoundViewModel[] {
  return CUP_ROAD.map(stage => {
    const round = cup.rounds.find(candidate => candidate.number === stage.number);
    if (round !== undefined) {
      return cupRoundViewModel(
        round,
        cup,
        userClubId,
        clubNames,
        round.number === currentRoundNumber && roundIsPlayable,
      );
    }
    return {
      round: stage.number,
      label: stage.label,
      matchCount: stage.matchCount,
      completedCount: 0,
      statusLabel: 'Awaiting draw',
      drawn: false,
      active: false,
      fixtures: [],
      byes: [],
    };
  });
}

function movementRulesLabel(division: DivisionLevel): string {
  if (division === 1) return 'Bottom 2 relegated';
  if (division === 5) return 'Top 2 promoted';
  return 'Top 2 up · Bottom 2 down';
}

function validateStandingNumbers(standing: LeagueStanding): void {
  const nonnegative = [
    standing.played,
    standing.won,
    standing.drawn,
    standing.lost,
    standing.goalsFor,
    standing.goalsAgainst,
    standing.points,
  ];
  if (nonnegative.some(value => !Number.isSafeInteger(value) || value < 0)
    || !Number.isSafeInteger(standing.goalDifference)) {
    throw new Error(`standing ${standing.clubId} contains invalid totals`);
  }
}

function requireClubName(names: ReadonlyMap<string, string>, clubId: string): string {
  const name = names.get(clubId);
  if (name === undefined) throw new Error(`unknown pyramid club ${clubId}`);
  return name;
}

function validateSeason(season: number): void {
  if (!Number.isSafeInteger(season) || season < 1) {
    throw new Error('season must be a positive safe integer');
  }
}
