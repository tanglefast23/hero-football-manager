// The sort is a saved preference, so its vocabulary lives with the other
// persisted UI settings (textScale, hudSide, cutInMode) rather than here.
export type { SquadSort, SquadSortDirection, SquadSortKey } from '../persistence';
import type { SquadSort, SquadSortKey } from '../persistence';

interface SortableSquadPlayer {
  id: string;
  name: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  overall: number;
  superChancePercent: number;
  condition: number;
}

/**
 * Which way a column opens on its first tap. A rating is asked for best-first,
 * so numbers open descending. A name or a position is asked for alphabetically,
 * so text opens A to Z — tapping POS and getting M, G, F, D reads as broken.
 */
const OPENS_ASCENDING: Readonly<Record<SquadSortKey, boolean>> = {
  player: true,
  role: true,
  overall: false,
  potential: false,
  condition: false,
};

export function nextSquadSort(current: SquadSort | null, key: SquadSortKey): SquadSort | null {
  const opening = OPENS_ASCENDING[key] ? 'ascending' : 'descending';
  if (current?.key !== key) return { key, direction: opening };
  if (current.direction === opening) {
    return { key, direction: opening === 'ascending' ? 'descending' : 'ascending' };
  }
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
    return left.superChancePercent - right.superChancePercent;
  }
  return left.condition - right.condition;
}
