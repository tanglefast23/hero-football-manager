import type { Role } from '../sim/types';
import type {
  AwardCategoryId,
  CareerPlayer,
  DivisionAwardPlacement,
  PlayerSeasonStatLine,
} from './types';

export interface AwardCategory {
  id: AwardCategoryId;
  /** Only this position line is eligible, so each line has one award to chase. */
  role: Role;
  boardLabel: string;
  metricLabel: string;
}

export const AWARD_CATEGORIES: Readonly<Record<AwardCategoryId, AwardCategory>> = Object.freeze({
  goals: { id: 'goals', role: 'FWD', boardLabel: 'Strikers', metricLabel: 'Goals' },
  passesCompleted: {
    id: 'passesCompleted', role: 'MID', boardLabel: 'Midfielders', metricLabel: 'Passes',
  },
  tacklesWon: { id: 'tacklesWon', role: 'DEF', boardLabel: 'Defenders', metricLabel: 'Tackles won' },
  saves: { id: 'saves', role: 'GK', boardLabel: 'Keepers', metricLabel: 'Saves' },
});

export const PODIUM_SIZE = 3;

export interface DivisionLeaderQuery {
  category: AwardCategoryId;
  season: number;
  /** The live roster, which also decides who is still eligible to be shown. */
  players: readonly CareerPlayer[];
  statLines: readonly PlayerSeasonStatLine[];
  limit?: number;
}

export interface DivisionLeaderEntry extends DivisionAwardPlacement {
  position: number;
}

/**
 * Ranks one category over one season's league rows.
 *
 * Rows are stamped per club, so a player who moved inside the division carries
 * one row per club he played for. They are summed under his current club: two
 * partial placings for the same man are not a leaderboard.
 */
export function divisionLeaderBoard(query: DivisionLeaderQuery): DivisionLeaderEntry[] {
  const category = AWARD_CATEGORIES[query.category];
  const eligible = new Map(query.players
    .filter(player => player.role === category.role)
    .map(player => [player.id, player]));

  const totals = new Map<string, number>();
  for (const statLine of query.statLines) {
    // Cup rows are excluded: a board counting goals scored against another
    // division would not be a division board.
    if (statLine.season !== query.season || statLine.competition !== 'league') continue;
    if (!eligible.has(statLine.playerId)) continue;
    totals.set(
      statLine.playerId,
      (totals.get(statLine.playerId) ?? 0) + statLine[query.category],
    );
  }

  const ranked = [...totals.entries()]
    .filter(([, value]) => value > 0)
    // Player ID is the tiebreak so the board never depends on roster order.
    .sort(([leftId, leftValue], [rightId, rightValue]) => (
      rightValue - leftValue || leftId.localeCompare(rightId)
    ));

  let position = 0;
  let previousValue: number | undefined;
  const entries = ranked.map(([playerId, value], index) => {
    // Equal values share a position; the next distinct value resumes at its
    // natural rank, so two on eleven are both 2nd and the next is 4th.
    if (value !== previousValue) {
      position = index + 1;
      previousValue = value;
    }
    const player = eligible.get(playerId)!;
    return { position, playerId, playerName: player.name, clubId: player.clubId, value };
  });

  return query.limit === undefined ? entries : entries.slice(0, query.limit);
}

/**
 * The top three of a board, cut at three even when the third place is shared.
 * The shared-rank rule says what a tie looks like, not what to do at the cut
 * line, and a fourth "third place" reads worse than a stable arbitrary cut.
 */
export function divisionPodium(
  query: Omit<DivisionLeaderQuery, 'limit'>,
): DivisionAwardPlacement[] {
  return divisionLeaderBoard({ ...query, limit: PODIUM_SIZE }).map(entry => ({
    playerId: entry.playerId,
    playerName: entry.playerName,
    clubId: entry.clubId,
    value: entry.value,
  }));
}
