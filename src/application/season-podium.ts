import {
  leagueStandings,
  roleOverall,
  type CareerPlayer,
  type GameState,
} from '../game';
import type { SeasonPodiumPlaceViewModel, SeasonPodiumViewModel } from '../ui';
import { playerLookId } from '../render/sprites/player-look';
import { copyFor, type CopyFn } from '../i18n';

let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

const FLAG_PREFIX = 'celebration:season-podium:season-';

export function seasonPodiumFlag(season: number): string {
  return `${FLAG_PREFIX}${season}`;
}

/**
 * The medal ceremony for a season that ended just short of the title.
 *
 * Second and third only. First place already has the championship parade, and
 * a club that finished fourth has nothing to stand on — the boundary goes
 * straight to the awards for them, as it always did. One flag per season, the
 * same shape the parade uses, so the scene cannot replay by relaunching into
 * the boundary or backing into it from the awards.
 */
export function hasPendingSeasonPodium(state: GameState): boolean {
  if (state.phase !== 'season-end' && state.phase !== 'complete') return false;
  return (
    userPodiumPosition(state) !== undefined &&
    !state.eventFlags.includes(seasonPodiumFlag(state.season))
  );
}

export function completeSeasonPodium(state: GameState): GameState {
  if (!hasPendingSeasonPodium(state)) return state;
  return {
    ...state,
    eventFlags: [...state.eventFlags, seasonPodiumFlag(state.season)],
  };
}

function userPodiumPosition(state: GameState): 2 | 3 | undefined {
  const row = leagueStandings(state).find(
    (standing) => standing.clubId === state.userClubId,
  );
  return row?.position === 2 || row?.position === 3 ? row.position : undefined;
}

/**
 * TOTAL BY CONSTRUCTION, for the reason the parade's view model gives: the
 * screen sits inside the season transition and its own completion is the only
 * way off it, so a thrown view model would strand the save. A division that has
 * lost a club, or a club whose squad is empty, still gets a podium — with a
 * stand-in figure on the empty block rather than a crash on every relaunch.
 */
export function seasonPodiumViewModel(
  state: GameState,
  t: CopyFn = englishCopy(),
): SeasonPodiumViewModel {
  const standings = leagueStandings(state);
  const userPosition = userPodiumPosition(state) ?? 2;
  const places = ([1, 2, 3] as const).map((position) =>
    placeViewModel(
      state,
      standings.find((standing) => standing.position === position),
      position,
      t,
    ),
  );

  return {
    seasonLabel: t('endgameCelebration.seasonLabel', { season: state.season }),
    headline:
      userPosition === 2
        ? t('seasonPodium.headlineSecond')
        : t('seasonPodium.headlineThird'),
    clubName:
      state.clubs.find((club) => club.id === state.userClubId)?.name ??
      t('endgameCelebration.yourClub'),
    userPosition,
    places,
  };
}

function placeViewModel(
  state: GameState,
  standing: { clubId: string; points: number } | undefined,
  position: 1 | 2 | 3,
  t: CopyFn,
): SeasonPodiumPlaceViewModel {
  const clubId = standing?.clubId;
  const best = clubId === undefined ? undefined : bestPlayer(state, clubId);
  // The block is a fixed part of the picture, so an absent club keeps its step
  // and stands an unnamed player on it rather than leaving a hole in the set.
  const playerId = best?.id ?? `season-podium-${position}`;
  const role = best?.role ?? 'FWD';
  return {
    position,
    clubName:
      clubId === undefined
        ? t('endgameCelebration.yourClub')
        : (state.clubs.find((club) => club.id === clubId)?.name ??
          t('endgameCelebration.yourClub')),
    isUserClub: clubId === state.userClubId,
    points: standing?.points ?? 0,
    playerId,
    playerName: best?.name ?? t('endgameCelebration.yourCaptain'),
    role,
    isHero: best?.power !== undefined,
    lookId: playerLookId(playerId, role, best?.lookId),
  };
}

/** The club's face on its block: its highest-overall player, ties by id. */
function bestPlayer(
  state: GameState,
  clubId: string,
): CareerPlayer | undefined {
  return state.players
    .filter((player) => player.clubId === clubId)
    .sort(
      (left, right) =>
        roleOverall(right.role, right.attrs) -
          roleOverall(left.role, left.attrs) || compareIds(left.id, right.id),
    )[0];
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
