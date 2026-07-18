import { ROVERS, UNITED } from '../../sim/teams';
import type { TeamDef } from '../../sim/types';
import { runHeadlessM1Career, summarizeCareer } from '../headless';
import type { CareerSetup, GameState } from '../types';

jest.setTimeout(30000);

function makeSetup(): CareerSetup {
  return {
    seed: 246813579,
    userClubId: 'club-00',
    startingTrainingPoints: 5,
    clubs: Array.from({ length: 10 }, (_, index) => ({
      id: `club-${String(index).padStart(2, '0')}`,
      name: `Club ${index}`,
      cash: 50000,
      fans: 600 + index * 10,
      ticketPrice: 4,
      sponsorMonthlyFee: 1800,
      weeklyWages: 1400,
    })),
  };
}

function cloneTeam(source: TeamDef, id: string): TeamDef {
  return {
    id,
    name: `${source.name} ${id}`,
    players: source.players.map((player, index) => ({
      ...player,
      id: `${id}-player-${index}`,
      attrs: { ...player.attrs },
    })),
  };
}

function makeTeams(setup: CareerSetup): Readonly<Record<string, TeamDef>> {
  return Object.fromEntries(
    setup.clubs.map((club, index) => [
      club.id,
      cloneTeam(index % 2 === 0 ? ROVERS : UNITED, club.id),
    ]),
  );
}

describe('headless M1 career', () => {
  let setup: CareerSetup;
  let teams: Readonly<Record<string, TeamDef>>;
  let setupBefore: string;
  let teamsBefore: string;
  let first: GameState;
  let second: GameState;

  beforeAll(() => {
    setup = makeSetup();
    teams = makeTeams(setup);
    setupBefore = JSON.stringify(setup);
    teamsBefore = JSON.stringify(teams);
    first = runHeadlessM1Career(setup, teams);
    second = runHeadlessM1Career(setup, teams);
  });

  test('quick-resolves every fixture through both M1 seasons', () => {
    expect(first.phase).toBe('complete');
    expect(first.season).toBe(2);
    expect(first.week).toBe(30);
    expect(first.fixtures).toHaveLength(180);
    expect(first.fixtures.filter(fixture => fixture.status === 'played')).toHaveLength(180);
    expect(first.fixtures.every(fixture => fixture.score !== undefined)).toBe(true);
    expect(first.ledgers).toHaveLength(60);

    const summary = summarizeCareer(first);
    const userClub = first.clubs.find(club => club.id === first.userClubId);
    expect(summary.endingCash).toBe(userClub?.cash);
    expect(summary.trainingPoints).toBe(first.trainingPoints);
    expect(summary.minimumBalance).toBe(
      Math.min(...first.ledgers.map(ledger => ledger.balanceAfter)),
    );
    expect(Object.keys(summary.finalPositionBySeason)).toEqual(['1', '2']);
    expect(Object.values(summary.finalPositionBySeason).every(position => position >= 1 && position <= 10))
      .toBe(true);
  });

  test('is byte-identical and leaves setup and team inputs unchanged', () => {
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(summarizeCareer(first))).toBe(JSON.stringify(summarizeCareer(second)));
    expect(JSON.stringify(setup)).toBe(setupBefore);
    expect(JSON.stringify(teams)).toBe(teamsBefore);
  });
});
