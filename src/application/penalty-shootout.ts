import { roleOverall } from '../game/archetype-caps';
import { copyFor, type CopyFn } from '../i18n';
import type { PlayerDef, TeamDef } from '../sim/types';
import type {
  FaceOffSideViewModel,
  PenaltyKickViewModel,
  PenaltyShootoutViewModel,
} from '../ui/models';

let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

export interface PenaltyShootoutArgs {
  fixtureId: string;
  careerSeed: number;
  matchSeed: number;
  round: number;
  clubTeam: TeamDef;
  opponentTeam: TeamDef;
  winner: 'club' | 'opponent';
  /** True when the manager's club was the home side in this fixture. */
  clubIsHome: boolean;
}

interface KickTemplate {
  readonly winner: readonly boolean[];
  readonly loser: readonly boolean[];
}

/**
 * Four legal scripts, selected by fixture data. Regulation scripts stay alive
 * through both fifth kicks; sudden-death scripts finish after a complete pair.
 */
const KICK_TEMPLATES: readonly KickTemplate[] = [
  {
    winner: [true, true, false, true, true],
    loser: [true, false, true, true, false],
  },
  {
    winner: [false, true, true, false, true],
    loser: [true, false, false, true, false],
  },
  {
    winner: [true, false, true, true, false, true],
    loser: [true, false, true, true, false, false],
  },
  {
    winner: [true, true, false, true, false, true, true],
    loser: [true, true, false, true, false, true, false],
  },
];

/** Pure presentation data. It never reads or advances the match PRNG. */
export function penaltyShootoutViewModel(
  args: PenaltyShootoutArgs,
  t: CopyFn = englishCopy(),
): PenaltyShootoutViewModel | null {
  const clubShooters = orderedShooters(args.clubTeam);
  const opponentShooters = orderedShooters(args.opponentTeam);
  const clubGoalkeeper = startingGoalkeeper(args.clubTeam);
  const opponentGoalkeeper = startingGoalkeeper(args.opponentTeam);
  if (
    clubShooters.length === 0 ||
    opponentShooters.length === 0 ||
    clubGoalkeeper === null ||
    opponentGoalkeeper === null
  ) {
    return null;
  }

  const template =
    KICK_TEMPLATES[
      hashString(
        `penalty-shootout:${args.careerSeed}:${args.matchSeed}:${args.round}:${args.fixtureId}`,
      ) % KICK_TEMPLATES.length
    ]!;
  const clubOutcomes =
    args.winner === 'club' ? template.winner : template.loser;
  const opponentOutcomes =
    args.winner === 'opponent' ? template.winner : template.loser;
  const clubKeeperSide = side(clubGoalkeeper, args.clubTeam.name);
  const opponentKeeperSide = side(opponentGoalkeeper, args.opponentTeam.name);
  const kicks: PenaltyKickViewModel[] = [];
  let clubScore = 0;
  let opponentScore = 0;

  for (let round = 0; round < clubOutcomes.length; round += 1) {
    const clubScored = clubOutcomes[round]!;
    if (clubScored) clubScore += 1;
    kicks.push({
      id: `${args.fixtureId}-penalty-${kicks.length + 1}`,
      shootingSide: 'club',
      shooter: side(
        clubShooters[round % clubShooters.length]!,
        args.clubTeam.name,
      ),
      goalkeeper: opponentKeeperSide,
      outcome: clubScored ? 'score' : 'miss',
      clubScore,
      opponentScore,
    });

    const opponentScored = opponentOutcomes[round]!;
    if (opponentScored) opponentScore += 1;
    kicks.push({
      id: `${args.fixtureId}-penalty-${kicks.length + 1}`,
      shootingSide: 'opponent',
      shooter: side(
        opponentShooters[round % opponentShooters.length]!,
        args.opponentTeam.name,
      ),
      goalkeeper: clubKeeperSide,
      outcome: opponentScored ? 'score' : 'miss',
      clubScore,
      opponentScore,
    });
  }

  const winnerName =
    args.winner === 'club' ? args.clubTeam.name : args.opponentTeam.name;
  return {
    fixtureId: args.fixtureId,
    clubName: args.clubTeam.name,
    opponentName: args.opponentTeam.name,
    clubIsHome: args.clubIsHome,
    winner: args.winner,
    kicks,
    finalClubScore: clubScore,
    finalOpponentScore: opponentScore,
    accessibilityLabel: t('penaltyShootout.a11y.final', {
      club: args.clubTeam.name,
      clubScore,
      opponent: args.opponentTeam.name,
      opponentScore,
      winner: winnerName,
    }),
  };
}

/** Shooting and technique lead; the squad register's role rating settles ties. */
export function orderedShooters(team: TeamDef): readonly PlayerDef[] {
  return team.players
    .filter((player) => player.role !== 'GK')
    .slice()
    .sort(
      (left, right) =>
        penaltyRating(right) - penaltyRating(left) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, 5);
}

/** The starting keeper, or the strongest starter when malformed data has none. */
export function startingGoalkeeper(team: TeamDef): PlayerDef | null {
  const goalkeeper = team.players.find((player) => player.role === 'GK');
  if (goalkeeper !== undefined) return goalkeeper;
  return (
    team.players
      .slice()
      .sort(
        (left, right) =>
          roleOverall(right.role, right.attrs) -
            roleOverall(left.role, left.attrs) ||
          left.id.localeCompare(right.id),
      )[0] ?? null
  );
}

function penaltyRating(player: PlayerDef): number {
  return (
    player.attrs.sho * 4 +
    player.attrs.tec * 2 +
    roleOverall(player.role, player.attrs)
  );
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

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
