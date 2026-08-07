import { roleOverall } from '../game/archetype-caps';
import type { PlayerDef, TeamDef } from '../sim/types';
import type {
  FaceOffSideViewModel,
  FaceOffStrike,
  QuickResultFaceOffViewModel,
} from '../ui/models';
import { copyFor, type CopyFn } from '../i18n';

let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

/**
 * The Quick Result face-off, as pure data.
 *
 * Everything here is a function of a match that has already been simulated,
 * settled and saved. It consumes no RNG and touches no career state, so a
 * career with the face-off and a career without it are byte-identical.
 */

/**
 * Who ends up kicking the ball.
 *
 * Driven by the post-match view model's own verdict rather than by the goals,
 * because a Hero Cup tie level after ninety minutes is still a win or a loss —
 * it is settled on the recorded penalty winner. Reading the score here would
 * call every shoot-out a draw.
 */
export function faceOffStrike(outcomeLabel: 'WIN' | 'DRAW' | 'LOSS'): FaceOffStrike {
  if (outcomeLabel === 'WIN') return 'club';
  if (outcomeLabel === 'LOSS') return 'opponent';
  return 'bounce';
}

/**
 * The best outfielder in an eleven.
 *
 * `roleOverall` is the squad register's own metric, imported rather than
 * re-derived: a second definition of "best" would name a player the manager's
 * own team sheet disagrees with.
 *
 * Keepers are excluded — a goalkeeper dribbling a ball past a striker reads
 * wrong, and the keeper is not what the club is proud of. The all-keeper
 * fallback below cannot occur in production (`buildTeamDef` always fields one
 * keeper and ten outfielders) and exists so a malformed eleven degrades to a
 * strange picture rather than to no scene at all.
 */
export function bestOutfieldPlayer(team: TeamDef): PlayerDef | null {
  const outfield = team.players.filter(player => player.role !== 'GK');
  return bestByOverall(outfield.length > 0 ? outfield : team.players);
}

/** Highest `roleOverall`; ties break on ascending id so the pick never drifts. */
function bestByOverall(players: readonly PlayerDef[]): PlayerDef | null {
  let best: PlayerDef | null = null;
  let bestOverall = -1;
  for (const player of players) {
    const overall = roleOverall(player.role, player.attrs);
    if (overall > bestOverall || (overall === bestOverall && best !== null && player.id < best.id)) {
      best = player;
      bestOverall = overall;
    }
  }
  return best;
}

function side(player: PlayerDef, clubName: string): FaceOffSideViewModel {
  return {
    playerId: player.id,
    playerName: player.name,
    role: player.role,
    ...(player.lookId === undefined ? {} : { lookId: player.lookId }),
    clubName,
  };
}

/**
 * The whole scene, or null when it cannot be drawn.
 *
 * Null rather than a throw: the caller shows the settled result instead, and a
 * decorative overlay must never be able to block a played match from reaching
 * the manager.
 */
export function quickResultFaceOffViewModel(args: {
  clubTeam: TeamDef;
  opponentTeam: TeamDef;
  outcomeLabel: 'WIN' | 'DRAW' | 'LOSS';
}, t: CopyFn = englishCopy()): QuickResultFaceOffViewModel | null {
  const clubPlayer = bestOutfieldPlayer(args.clubTeam);
  const opponentPlayer = bestOutfieldPlayer(args.opponentTeam);
  if (clubPlayer === null || opponentPlayer === null) return null;

  // The club is always index 0 and is always drawn on the left, whatever the
  // venue: the manager's team occupying a fixed side is worth more than
  // modelling home and away in a two-second card.
  const sides: readonly [FaceOffSideViewModel, FaceOffSideViewModel] = [
    side(clubPlayer, args.clubTeam.name),
    side(opponentPlayer, args.opponentTeam.name),
  ];

  return {
    sides,
    strike: faceOffStrike(args.outcomeLabel),
    accessibilityLabel: t('matchScreen.a11y.faceOff', {
      player: sides[0].playerName,
      club: sides[0].clubName,
      opponent: sides[1].playerName,
      opponentClub: sides[1].clubName,
    }),
  };
}
