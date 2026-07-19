import {
  advanceM2NationalCup,
  initializeM2Career,
  startM2NationalCup,
  type M2CareerState,
} from '../../game/m2-career';
import type { NationalCupResult } from '../../game/pyramid';
import type { LeagueStanding } from '../../game/types';
import { m2LeagueViewModel } from '../m2-league-view-model';

const USER_CLUB = { id: 'user-club', name: 'Caped Ball FC', squadStrength: 47 };

function standings(state: M2CareerState, userPosition = 3): LeagueStanding[] {
  const division = state.pyramid.divisions.find(candidate =>
    candidate.clubs.some(club => club.id === state.userClubId),
  )!;
  const ordered = [
    ...division.clubs.filter(club => club.id !== state.userClubId),
  ];
  ordered.splice(userPosition - 1, 0, division.clubs.find(club => club.id === state.userClubId)!);
  return ordered.map((club, index) => ({
    position: index + 1,
    clubId: club.id,
    played: 8,
    won: Math.max(0, 7 - index),
    drawn: index % 2,
    lost: Math.max(0, index - 2),
    goalsFor: 20 - index,
    goalsAgainst: 5 + index,
    goalDifference: 15 - index * 2,
    points: Math.max(0, 22 - index * 2),
  }));
}

function homeWins(state: M2CareerState): NationalCupResult[] {
  return state.nationalCups.at(-1)!.rounds.at(-1)!.fixtures.map(fixture => ({
    fixtureId: fixture.id,
    homeGoals: 1,
    awayGoals: 0,
    winnerClubId: fixture.homeClubId,
  }));
}

describe('m2LeagueViewModel', () => {
  it('maps the five-division ladder and truthful active table without mutating inputs', () => {
    const career = initializeM2Career({ careerSeed: 551, userClub: USER_CLUB });
    const activeStandings = standings(career, 3);
    const frozen = JSON.stringify({ career, activeStandings });
    const view = m2LeagueViewModel({
      career,
      season: 2,
      activeStandings,
      selectedDivision: 2,
    });

    expect(view).toMatchObject({
      seasonLabel: 'Season 2',
      userDivisionBadge: 'DIVISION 5 · #3',
      selectedDivision: 2,
      selectedDivisionSummary: {
        label: 'Division 2',
        selected: true,
        userDivision: false,
      },
      activeTable: {
        divisionLabel: 'Division 5',
        rulesLabel: 'Top 2 promoted',
        matchesPlayed: 8,
      },
    });
    expect(view.divisions.map(division => division.level)).toEqual([1, 2, 3, 4, 5]);
    expect(view.divisions.map(division => division.averageStrength)[0])
      .toBeGreaterThan(view.divisions.map(division => division.averageStrength)[4]);
    expect(view.activeTable.rows).toHaveLength(10);
    expect(view.activeTable.rows[2]).toMatchObject({
      clubId: USER_CLUB.id,
      clubName: USER_CLUB.name,
      isUserClub: true,
      movement: 'NONE',
    });
    expect(view.activeTable.rows.slice(0, 2).every(row => row.movement === 'PROMOTION')).toBe(true);
    expect(JSON.stringify({ career, activeStandings })).toBe(frozen);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  it('shows the current cup draw, filed round history, and resolved club names', () => {
    let career = startM2NationalCup(
      initializeM2Career({ careerSeed: 82, userClub: USER_CLUB }),
      3,
    );
    career = advanceM2NationalCup(career, homeWins(career));
    const view = m2LeagueViewModel({ career, season: 3, activeStandings: standings(career) });

    expect(view.cup).toMatchObject({
      available: true,
      seasonLabel: 'Season 3',
      statusLabel: 'Cup live',
      currentRoundLabel: 'Round of 32',
    });
    expect(view.cup.currentRoundFixtures).toHaveLength(16);
    expect(view.cup.currentRoundFixtures[0].homeClubName).not.toMatch(/^d\d-club/);
    expect(view.cup.history[0]).toMatchObject({
      label: 'Play-in',
      matchCount: 18,
      completedCount: 18,
      statusLabel: 'Filed',
    });
    expect(view.cup.history[1]).toMatchObject({
      label: 'Round of 32',
      matchCount: 16,
      completedCount: 0,
      statusLabel: 'Live',
    });
  });

  it('enables only the user tie on its active cup matchday', () => {
    let career: M2CareerState | undefined;
    for (let seed = 1; seed <= 50 && career === undefined; seed += 1) {
      const candidate = startM2NationalCup(
        initializeM2Career({ careerSeed: seed, userClub: USER_CLUB }),
        1,
      );
      if (candidate.nationalCups[0].rounds[0].fixtures.some(fixture => (
        fixture.homeClubId === USER_CLUB.id || fixture.awayClubId === USER_CLUB.id
      ))) career = candidate;
    }
    if (career === undefined) throw new Error('expected a deterministic user play-in tie');

    const view = m2LeagueViewModel({
      career,
      season: 1,
      week: 5,
      phase: 'matchday',
      activeStandings: standings(career),
    });
    const userFixture = view.cup.currentRoundFixtures.find(fixture => fixture.involvesUserClub);

    expect(userFixture).toMatchObject({ status: 'SCHEDULED', playableNow: true });
    expect(view.cup.currentRoundFixtures.filter(fixture => fixture.playableNow)).toHaveLength(1);
  });

  it('shows a champion and preserves completed cup seasons in the selector', () => {
    let career = startM2NationalCup(
      initializeM2Career({ careerSeed: 900, userClub: USER_CLUB }),
      1,
    );
    while (career.nationalCups[0].championClubId === undefined) {
      career = advanceM2NationalCup(career, homeWins(career));
    }
    career = startM2NationalCup(career, 2);
    const live = m2LeagueViewModel({ career, season: 2, activeStandings: standings(career) });
    const archive = m2LeagueViewModel({
      career,
      season: 2,
      activeStandings: standings(career),
      selectedCupSeason: 1,
    });

    expect(live.cup.seasonOptions).toHaveLength(2);
    expect(live.cup.seasonLabel).toBe('Season 2');
    expect(archive.cup).toMatchObject({
      seasonLabel: 'Season 1',
      statusLabel: 'Cup complete',
      currentRoundLabel: 'Final result',
      championName: expect.any(String),
    });
    expect(archive.cup.seasonOptions[0]).toMatchObject({
      selected: true,
      complete: true,
      championName: expect.any(String),
    });
    expect(archive.cup.currentRoundFixtures).toHaveLength(1);
  });

  it('shows a useful empty cup state and rejects standings from the wrong division', () => {
    const career = initializeM2Career({ careerSeed: 17, userClub: USER_CLUB });
    const empty = m2LeagueViewModel({ career, season: 1, activeStandings: standings(career) });
    expect(empty.cup).toMatchObject({
      available: false,
      statusLabel: 'Draw pending',
      currentRoundLabel: 'National Cup not drawn',
    });

    const malformed = standings(career);
    malformed[0] = { ...malformed[0], clubId: career.pyramid.divisions[0].clubs[0].id };
    expect(() => m2LeagueViewModel({ career, season: 1, activeStandings: malformed }))
      .toThrow('does not belong');
  });
});
