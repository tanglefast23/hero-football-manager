import { AWARD_CATEGORIES, divisionLeaderBoard } from '../game/division-leaders';
import type { AwardCategoryId, CareerPlayer, PlayerSeasonStatLine } from '../game/types';
import type {
  M2DivisionLeadersViewModel,
  M2LeaderBoardViewModel,
} from '../ui/m2-league-models';
import { copyFor, type CopyFn } from '../i18n';

let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

/**
 * Board order, deliberately the reverse of the awards ceremony's.
 *
 * The board is scanned, so the most-read category leads. The ceremony is
 * watched, so it builds to goals last. They are different jobs, and unifying
 * the two orders would cost one of them the thing it is ordered for.
 */
const BOARD_ORDER: readonly AwardCategoryId[] = [
  'goals', 'passesCompleted', 'tacklesWon', 'saves',
];

/** Five names read at a glance; a longer board is a table, not a leaderboard. */
const BOARD_LIMIT = 5;

export interface DivisionLeadersViewModelSource {
  readonly season: number;
  readonly players: readonly CareerPlayer[];
  readonly statLines: readonly PlayerSeasonStatLine[];
  readonly userClubId: string;
  readonly clubNames: ReadonlyMap<string, string>;
}

/** Ranks one board per position line for the League screen's leaders tab. */
export function divisionLeadersViewModel(
  source: DivisionLeadersViewModelSource,
  t: CopyFn = englishCopy(),
): M2DivisionLeadersViewModel {
  const boards: M2LeaderBoardViewModel[] = BOARD_ORDER.map(categoryId => {
    const category = AWARD_CATEGORIES[categoryId];
    const entries = divisionLeaderBoard({
      category: categoryId,
      season: source.season,
      players: source.players,
      statLines: source.statLines,
      limit: BOARD_LIMIT,
    }).map(entry => ({
      position: entry.position,
      playerId: entry.playerId,
      playerName: entry.playerName,
      // A club regenerated out of the pyramid still has to render as something,
      // and its identifier beats a blank cell.
      clubName: source.clubNames.get(entry.clubId) ?? entry.clubId,
      value: entry.value,
      isUserPlayer: entry.clubId === source.userClubId,
    }));
    return {
      categoryId,
      boardLabel: category.boardLabel,
      metricLabel: category.metricLabel,
      emptyLabel: t('m2League.noneRecordedYetThisSeason', {
        metric: category.metricLabel.toLowerCase(),
      }),
      entries,
    };
  });
  return { boards };
}
