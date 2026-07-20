import { loadLaunchContent } from '../../content';
import { createCareer, type GameState } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import {
  homeViewModel,
  matchDayViewModel,
  postMatchViewModel,
  squadTrainingViewModel,
} from '../view-models';

describe('management injury and lineup presentation', () => {
  const content = loadLaunchContent();

  it('shows active injuries on Home, in Squad, and on the match-day bench', () => {
    const initial = createCareer(createLaunchCareerSetup(20260720, undefined, content, 'full'));
    const lineup = initial.lineups.find(candidate => candidate.clubId === initial.userClubId)!;
    const benchPlayer = initial.players.find(player => (
      player.clubId === initial.userClubId && !lineup.playerIds.includes(player.id)
    ))!;
    const injured: GameState = {
      ...initial,
      players: initial.players.map(player => player.id === benchPlayer.id
        ? { ...player, injuryWeeks: 2 }
        : player),
    };

    expect(homeViewModel(injured).alerts).toContainEqual({
      id: `injury-${benchPlayer.id}`,
      title: `${benchPlayer.name} · OUT`,
      detail: 'OUT · 2 WEEKS — unavailable for selection.',
      tone: 'urgent',
    });

    const squadPlayer = squadTrainingViewModel(injured, content, benchPlayer.id, [], [])
      .players.find(player => player.id === benchPlayer.id);
    expect(squadPlayer).toMatchObject({ injuryWeeks: 2, isStarter: false });

    const fixture = injured.fixtures.find(candidate => (
      candidate.homeClubId === injured.userClubId || candidate.awayClubId === injured.userClubId
    ))!;
    const matchday = matchDayViewModel({ ...injured, week: fixture.week, phase: 'matchday' }, content);
    expect(matchday.bench.find(player => player.id === benchPlayer.id)).toMatchObject({
      injuryWeeks: 2,
      canStart: false,
      unavailableLabel: 'OUT · 2 WEEKS',
    });
  });

  it('carries a new-injury notice into the post-match office summary', () => {
    const initial = createCareer(createLaunchCareerSetup(20260721, undefined, content, 'full'));
    const fixture = initial.fixtures.find(candidate => (
      candidate.homeClubId === initial.userClubId || candidate.awayClubId === initial.userClubId
    ))!;
    const before: GameState = { ...initial, week: fixture.week, phase: 'matchday' };
    const lineup = before.lineups.find(candidate => candidate.clubId === before.userClubId)!;
    const injuredId = lineup.playerIds[1];
    const injuredPlayer = before.players.find(player => player.id === injuredId)!;
    const replacement = before.players.find(player => (
      player.clubId === before.userClubId
      && player.role === injuredPlayer.role
      && !lineup.playerIds.includes(player.id)
      && player.power === undefined
    ))!;
    const after: GameState = {
      ...before,
      phase: 'manage',
      players: before.players.map(player => player.id === injuredId
        ? { ...player, injuryWeeks: 3 }
        : player),
      lineups: before.lineups.map(candidate => candidate.clubId === before.userClubId
        ? {
            ...candidate,
            playerIds: candidate.playerIds.map(playerId => playerId === injuredId ? replacement.id : playerId),
          }
        : candidate),
    };

    const score = fixture.homeClubId === before.userClubId
      ? { homeGoals: 1, awayGoals: 0 }
      : { homeGoals: 0, awayGoals: 1 };
    const summary = postMatchViewModel(before, after, fixture.id, score);

    expect(summary.updates).toContainEqual(expect.objectContaining({
      id: `injury-${injuredId}`,
      detail: `OUT · 3 WEEKS. ${replacement.name} has moved into the Starting XI.`,
      tone: 'warning',
    }));
  });
});
