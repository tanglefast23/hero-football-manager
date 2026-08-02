import { leagueStandings, rosterForClub, type CareerPlayer, type GameState } from '../game';
import type { ChampionshipCelebrationViewModel } from '../ui';
import { playerLookId } from '../render/sprites/player-look';
import { endgameSupersedesLeagueTitle } from './endgame-celebration';

const FLAG_PREFIX = 'celebration:league-title:season-';

export function championshipCelebrationFlag(season: number): string {
  return `${FLAG_PREFIX}${season}`;
}

/**
 * The ordinary title screen, which now covers D2–D5 and every D1 title after
 * the first.
 *
 * The FIRST D1 title is the end of the ladder and gets its own screen, so this
 * one stands down for it rather than announcing the same result first. The
 * endgame screen flags the season on its way out, which is what stops this from
 * firing the moment the suppression lifts.
 */
export function hasPendingChampionshipCelebration(state: GameState): boolean {
  if (state.phase !== 'season-end' && state.phase !== 'complete') return false;
  if (endgameSupersedesLeagueTitle(state)) return false;
  const champions = leagueStandings(state)[0];
  return champions?.clubId === state.userClubId
    && !state.eventFlags.includes(championshipCelebrationFlag(state.season));
}

export function completeChampionshipCelebration(state: GameState): GameState {
  if (!hasPendingChampionshipCelebration(state)) return state;
  return {
    ...state,
    eventFlags: [...state.eventFlags, championshipCelebrationFlag(state.season)],
  };
}

export function championshipCelebrationViewModel(
  state: GameState,
  assistantName: string,
): ChampionshipCelebrationViewModel {
  if (!hasPendingChampionshipCelebration(state)) {
    throw new Error('there is no pending league championship celebration');
  }
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  const squad = rosterForClub(state, state.userClubId);
  if (squad.length === 0) throw new Error('the champions have no players to celebrate');
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  if (lineup === undefined) throw new Error('the champions have no starting lineup');
  const finalFixture = state.fixtures
    .filter(fixture => fixture.status === 'played'
      && (fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId))
    .sort((left, right) => right.week - left.week || compareIds(right.id, left.id))[0];
  if (finalFixture === undefined) throw new Error('the champions have no completed fixture');
  const spriteSide = finalFixture.homeClubId === state.userClubId ? 'r' : 'u';

  // Summed across competitions: a player now owns one row per competition, and
  // the striker being paraded scored his cup goals for this club too.
  const goalsByPlayerId = new Map<string, number>();
  for (const line of state.seasonStatLines ?? []) {
    if (line.season !== state.season) continue;
    goalsByPlayerId.set(line.playerId, (goalsByPlayerId.get(line.playerId) ?? 0) + line.goals);
  }
  const sorted = [...squad].sort((left, right) => {
    const goalDifference = (goalsByPlayerId.get(right.id) ?? 0) - (goalsByPlayerId.get(left.id) ?? 0);
    if (goalDifference !== 0) return goalDifference;
    if (left.attrs.sho !== right.attrs.sho) return right.attrs.sho - left.attrs.sho;
    return compareIds(left.id, right.id);
  });
  const star = sorted[0]!;
  const starGoals = goalsByPlayerId.get(star.id) ?? 0;
  const playerViewModel = (player: CareerPlayer) => {
    return {
      id: player.id,
      name: player.name,
      role: player.role,
      isHero: player.power !== undefined,
      spriteKey: `${spriteSide}:${playerLookId(player.id, player.role, player.lookId)}:run0`,
    };
  };

  return {
    seasonLabel: `Season ${state.season}`,
    clubName: club.name,
    assistantName,
    star: {
      ...playerViewModel(star),
      goals: starGoals,
      hasRecordedGoals: goalsByPlayerId.size > 0,
    },
    squad: squad
      .filter(player => player.id !== star.id)
      .sort((left, right) => compareIds(left.id, right.id))
      .map(playerViewModel),
  };
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
