import {
  currentUserDivision,
  divisionAfterFinish,
  latestSeasonRecap,
  type GameState,
  type SeasonRecap,
} from '../game';
import type { AwardCeremonyViewModel } from '../ui/models';
import { copyFor, type CopyFn } from '../i18n';
import { awardCeremonyViewModel } from './award-ceremony-view-model';

let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

const FLAG_PREFIX = 'ceremony:division-awards:season-';

export function awardsCeremonyFlag(season: number): string {
  return `${FLAG_PREFIX}${season}`;
}

/**
 * Whether this season's awards have still to be presented.
 *
 * Flagged on the career rather than held in the store, exactly as the
 * championship celebration is: a flag survives a relaunch, so a ceremony
 * watched before the app was killed is not shown a second time on the way back
 * into the recap.
 */
export function hasPendingAwardsCeremony(state: GameState): boolean {
  if (state.phase !== 'season-end' && state.phase !== 'complete') return false;
  return !state.eventFlags.includes(awardsCeremonyFlag(state.season));
}

/**
 * Idempotent, and only ever writes at a season boundary.
 *
 * A season still being played has no awards to have watched, so flagging one
 * would silently suppress the ceremony it is about to earn. The screen can only
 * be reached at a boundary; this makes that a property rather than a habit.
 */
export function markAwardsCeremonyComplete(state: GameState): GameState {
  if (!hasPendingAwardsCeremony(state)) return state;
  return {
    ...state,
    eventFlags: [...state.eventFlags, awardsCeremonyFlag(state.season)],
  };
}

/**
 * The ceremony a career is about to watch.
 *
 * TOTAL BY CONSTRUCTION — it must not throw for any state that can reach the
 * screen. The ceremony sits inside the season transition, and the only way off
 * it is its own completion action, so a thrown view model would leave the
 * career with no route to the recap and no way to start the next season. A
 * missing recap therefore reads as four empty boards, not as an error.
 */
export function careerAwardCeremonyViewModel(
  state: GameState,
  t: CopyFn = englishCopy(),
): AwardCeremonyViewModel {
  const recap = latestSeasonRecap(state) ?? emptyRecap(state);
  const clubNames = new Map(
    (state.m2?.pyramid.divisions ?? []).flatMap((division) =>
      division.clubs.map((club) => [club.id, club.name] as const),
    ),
  );
  return awardCeremonyViewModel(
    {
      recap,
      userClubId: state.userClubId,
      clubNames,
      targetDivision: targetDivision(recap),
    },
    t,
  );
}

/**
 * Assigned looks by player ID, so a winner walks on wearing his own face.
 *
 * Anyone missing — a rival whose club has already been regenerated — falls back
 * to the stable hash of his ID inside `playerLookId`, which is the same look
 * the match drew him with.
 */
export function awardCeremonyLookIds(
  state: GameState,
): ReadonlyMap<string, string> {
  return new Map(
    state.players.flatMap((player) =>
      player.lookId === undefined ? [] : [[player.id, player.lookId] as const],
    ),
  );
}

/**
 * The division the club is ABOUT to enter, which is what the prize is sized
 * against. Promotion raises the prize tier. A low finish cannot lower it,
 * because the player club is never relegated.
 */
function targetDivision(recap: SeasonRecap): number {
  const division = clampDivision(recap.division);
  return Math.min(division, divisionAfterFinish(division, recap.finalPosition));
}

function clampDivision(division: number): 1 | 2 | 3 | 4 | 5 {
  const rounded = Math.round(division);
  if (rounded <= 1) return 1;
  if (rounded >= 5) return 5;
  return rounded as 2 | 3 | 4;
}

/**
 * A career at a season boundary always has a recap — `recordSeasonRecap` writes
 * one on the week the phase flips. This covers the states that never went
 * through that door: a hand-built save, or a slice that completed some other
 * way. Zeroed rather than guessed, so nothing invents a podium.
 */
function emptyRecap(state: GameState): SeasonRecap {
  const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
  return {
    season: state.season,
    division,
    // Mid-table, so the empty recap cannot silently claim a promotion the club
    // did not earn and price the (zero) prize against the wrong division.
    finalPosition: 5,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    cashChange: 0,
    closingCash:
      state.clubs.find((club) => club.id === state.userClubId)?.cash ?? 0,
    trainingCapsReached: 0,
    cupResult: '—',
  };
}
