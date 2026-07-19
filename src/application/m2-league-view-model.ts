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
import type { LeagueStanding } from '../game/types';
import type {
  M2CupFixtureViewModel,
  M2CupRoundHistoryViewModel,
  M2DivisionSummaryViewModel,
  M2LeagueViewModel,
  M2NationalCupViewModel,
} from '../ui/m2-league-models';

export interface M2LeagueViewModelSource {
  readonly career: M2CareerState;
  readonly season: number;
  readonly activeStandings: readonly LeagueStanding[];
  readonly selectedDivision?: DivisionLevel;
  readonly selectedCupSeason?: number;
  readonly week?: number;
  readonly phase?: 'manage' | 'matchday' | 'season-end' | 'complete';
}

/** Maps the sidecar pyramid and the live ten-club table into player-facing copy. */
export function m2LeagueViewModel(source: M2LeagueViewModelSource): M2LeagueViewModel {
  validateSeason(source.season);
  const userDivision = currentUserDivision(source.career);
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
    ));
  const selectedDivisionSummary = divisions.find(division => division.level === selectedDivision)!;
  const rows = activeTableRows(source, userDivision, clubNames);
  const userRow = rows.find(row => row.isUserClub);
  if (userRow === undefined) throw new Error('the active standings do not contain the user club');

  return {
    title: 'League & Cup',
    seasonLabel: `Season ${source.season}`,
    userDivisionBadge: `DIVISION ${userDivision} · #${userRow.position}`,
    selectedDivision,
    divisions,
    selectedDivisionSummary,
    activeTable: {
      divisionLabel: `Division ${userDivision}`,
      rulesLabel: movementRulesLabel(userDivision),
      matchesPlayed: userRow.played,
      rows,
    },
    cup: cupViewModel(source, clubNames),
  };
}

function divisionSummary(
  level: DivisionLevel,
  strengths: readonly number[],
  selectedDivision: DivisionLevel,
  userDivision: DivisionLevel,
): M2DivisionSummaryViewModel {
  if (strengths.length !== 10 || strengths.some(strength =>
    !Number.isInteger(strength) || strength < 1 || strength > 99
  )) {
    throw new Error(`Division ${level} must contain ten valid club strengths`);
  }
  const total = strengths.reduce((sum, strength) => sum + strength, 0);
  const minimum = Math.min(...strengths);
  const maximum = Math.max(...strengths);
  return {
    level,
    shortLabel: `D${level}`,
    label: `Division ${level}`,
    clubCount: strengths.length,
    averageStrength: Math.round(total / strengths.length),
    strengthRangeLabel: `${minimum}-${maximum}`,
    selected: level === selectedDivision,
    userDivision: level === userDivision,
  };
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
      history: [],
    };
  }
  const selectedCup = selectCup(cups, source.selectedCupSeason);
  const currentRound = selectedCup.rounds[selectedCup.rounds.length - 1];
  if (currentRound === undefined) throw new Error(`Season ${selectedCup.season} cup has no rounds`);
  const championName = selectedCup.championClubId === undefined
    ? undefined
    : requireClubName(clubNames, selectedCup.championClubId);

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
      selectedCup.season === source.season
        && source.week === [5, 10, 15, 20, 25, 30][currentRound.number - 1]
        && source.phase === 'matchday',
    )),
    history: selectedCup.rounds.map(round => cupRoundHistory(
      round,
      selectedCup,
      source.career.userClubId,
    )),
    ...(championName === undefined ? {} : { championName }),
  };
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
    statusLabel: completedCount === round.fixtures.length ? 'Filed' : 'Live',
    ...(userOutcome === undefined ? {} : { userOutcome }),
  };
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
