import {
  midseasonTrainingCaptain,
  midseasonTrainingGain,
  rosterForClub,
  type CareerPlayer,
  type GameState,
} from '../game';
import { playerLookId } from '../render/sprites/player-look';
import type {
  MidseasonTrainingPlayerViewModel,
  MidseasonTrainingViewModel,
} from '../ui/models';
import { copyFor, formatIntegerForCopy, type CopyFn } from '../i18n';

let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

export function midseasonTrainingViewModel(
  state: GameState,
  t: CopyFn = englishCopy(),
): MidseasonTrainingViewModel {
  const roster = rosterForClub(state, state.userClubId);
  const selectedCaptain = midseasonTrainingCaptain(state);
  const fallbackCaptain: CareerPlayer =
    selectedCaptain ??
    ({
      id: 'midseason-training-captain',
      clubId: state.userClubId,
      name: t('midseasonTraining.yourCaptain'),
      role: 'FWD',
      attrs: { pac: 1, sho: 1, pas: 1, def: 1, tec: 1, sta: 1, ref: 1 },
      licensed: false,
      weeklyWage: 0,
      onHeroWage: false,
      contractSeasonsRemaining: 1,
      morale: 50,
      injuryWeeks: 0,
    } satisfies CareerPlayer);
  const lineupIds =
    state.lineups.find((lineup) => lineup.clubId === state.userClubId)
      ?.playerIds ?? [];
  const lineupOrder = new Map(
    lineupIds.map((playerId, index) => [playerId, index]),
  );
  const orderedRoster = [...roster].sort((left, right) => {
    const leftOrder = lineupOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = lineupOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  const playerViewModel = (
    player: CareerPlayer,
  ): MidseasonTrainingPlayerViewModel => ({
    id: player.id,
    name: player.name,
    role: player.role,
    spriteKey: `r:${playerLookId(player.id, player.role, player.lookId)}:run0`,
    isCaptain: player.id === fallbackCaptain.id,
  });
  const captain = playerViewModel(fallbackCaptain);

  return {
    clubName:
      state.clubs.find((club) => club.id === state.userClubId)?.name ??
      t('midseasonTraining.yourClub'),
    season: state.season,
    trainingPoints: state.trainingPoints,
    trainingPointsLabel: formatIntegerForCopy(t, state.trainingPoints),
    statGain: midseasonTrainingGain(state),
    captain,
    squad:
      orderedRoster.length === 0
        ? [captain]
        : orderedRoster.map(playerViewModel),
  };
}
