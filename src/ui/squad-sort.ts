export type SquadSortKey = 'role' | 'player' | 'overall' | 'potential' | 'condition';
export type SquadSortDirection = 'descending' | 'ascending';

export interface SquadSort {
  key: SquadSortKey;
  direction: SquadSortDirection;
}

interface SortableSquadPlayer {
  id: string;
  name: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  overall: number;
  potentialBonusPercent: number;
  condition: number;
}

export function nextSquadSort(current: SquadSort | null, key: SquadSortKey): SquadSort | null {
  if (current?.key !== key) return { key, direction: 'descending' };
  if (current.direction === 'descending') return { key, direction: 'ascending' };
  return null;
}

export function sortSquadPlayers<T extends SortableSquadPlayer>(
  players: readonly T[],
  sort: SquadSort | null,
): T[] {
  if (sort === null) return [...players];
  const multiplier = sort.direction === 'descending' ? -1 : 1;
  return players
    .map((player, defaultIndex) => ({ player, defaultIndex }))
    .sort((left, right) => {
      const comparison = comparePlayers(left.player, right.player, sort.key);
      return comparison === 0
        ? left.defaultIndex - right.defaultIndex
        : comparison * multiplier;
    })
    .map(entry => entry.player);
}

function comparePlayers(
  left: SortableSquadPlayer,
  right: SortableSquadPlayer,
  key: SquadSortKey,
): number {
  if (key === 'player') return left.name.localeCompare(right.name);
  if (key === 'role') return left.role.localeCompare(right.role);
  if (key === 'overall') return left.overall - right.overall;
  if (key === 'potential') {
    return left.potentialBonusPercent - right.potentialBonusPercent;
  }
  return left.condition - right.condition;
}
