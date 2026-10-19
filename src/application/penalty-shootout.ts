import { copyFor, type CopyFn } from '../i18n';
import type { PenaltyShootout } from '../game/penalties';
import type { GameState } from '../game/types';
import type { PlayerDef, TeamDef } from '../sim/types';
import type {
  FaceOffSideViewModel,
  PenaltyKickViewModel,
  PenaltyShootoutViewModel,
} from '../ui/models';

let englishCopyFn: CopyFn | undefined;

export interface PenaltyShootoutArgs {
  readonly fixtureId: string;
  readonly clubTeam: TeamDef;
  readonly opponentTeam: TeamDef;
  /** True when the manager's club was the home side in this fixture. */
  readonly clubIsHome: boolean;
  /** Only settled, saved kicks may drive the presentation. Old ties have none. */
  readonly penalties?: PenaltyShootout;
}

export function savedPenaltyShootout(
  state: Pick<GameState, 'm2'>,
  fixtureId: string,
): PenaltyShootout | undefined {
  return state.m2?.nationalCups
    .flatMap((cup) => cup.rounds.flatMap((round) => round.fixtures))
    .find((fixture) => fixture.id === fixtureId)?.penalties;
}

/** Read saved kicks only. Names and looks can include substitutes from the bench. */
export function penaltyShootoutViewModel(
  args: PenaltyShootoutArgs,
  t: CopyFn = (englishCopyFn ??= copyFor('en')),
): PenaltyShootoutViewModel | null {
  const penalties = args.penalties;
  if (penalties === undefined) return null;
  const playerSide = (
    team: TeamDef,
    playerId: string,
  ): FaceOffSideViewModel | undefined => {
    const player = [...team.players, ...(team.bench ?? [])].find(
      (candidate) => candidate.id === playerId,
    );
    return player === undefined ? undefined : side(player, team.name);
  };
  const kicks: PenaltyKickViewModel[] = [];
  let clubScore = 0;
  let opponentScore = 0;
  for (const kick of penalties.kicks) {
    const clubShoots = (kick.side === 'home') === args.clubIsHome;
    const shooter = playerSide(
      clubShoots ? args.clubTeam : args.opponentTeam,
      kick.takerId,
    );
    const goalkeeper = playerSide(
      clubShoots ? args.opponentTeam : args.clubTeam,
      kick.keeperId,
    );
    // Missing historical metadata must not turn a saved result into invented kicks.
    if (shooter === undefined || goalkeeper === undefined) return null;
    if (kick.scored) {
      if (clubShoots) clubScore += 1;
      else opponentScore += 1;
    }
    kicks.push({
      id: `${args.fixtureId}-penalty-${kicks.length + 1}`,
      shootingSide: clubShoots ? 'club' : 'opponent',
      shooter,
      goalkeeper,
      outcome: kick.scored ? 'score' : 'miss',
      clubScore,
      opponentScore,
    });
  }
  if (
    kicks.length === 0 ||
    clubScore === opponentScore ||
    clubScore !==
      (args.clubIsHome ? penalties.homeGoals : penalties.awayGoals) ||
    opponentScore !==
      (args.clubIsHome ? penalties.awayGoals : penalties.homeGoals)
  )
    return null;
  const winner = clubScore > opponentScore ? 'club' : 'opponent';
  return {
    fixtureId: args.fixtureId,
    clubName: args.clubTeam.name,
    opponentName: args.opponentTeam.name,
    clubIsHome: args.clubIsHome,
    winner,
    kicks,
    finalClubScore: clubScore,
    finalOpponentScore: opponentScore,
    accessibilityLabel: t('penaltyShootout.a11y.final', {
      club: args.clubTeam.name,
      clubScore,
      opponent: args.opponentTeam.name,
      opponentScore,
      winner: winner === 'club' ? args.clubTeam.name : args.opponentTeam.name,
    }),
  };
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
