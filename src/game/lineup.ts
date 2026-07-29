import type { Attrs, Role, TeamDef } from '../sim/types';
import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import type { ProgressionPlayer } from './progression';

export type MatchSquadPlayer = ProgressionPlayer & {
  name: string;
  role: Role;
  lookId?: string;
  morale: number;
  condition?: number;
  injuryWeeks?: number;
};

const ATTR_NAMES = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'] as const;

/**
 * Canon morale band: 50 is neutral, 0 is -10%, and 100 is +10%.
 * Applying it at this boundary pins the effective attributes in replay teams.
 */
export function matchAttrsAtMorale(attrs: Readonly<Attrs>, morale: number): Attrs {
  if (!Number.isSafeInteger(morale) || morale < 0 || morale > 100) {
    throw new Error('Player morale must be an integer from 0 to 100');
  }
  const scalePerThousand = 900 + morale * 2;
  const adjusted = { ...attrs };
  for (const attribute of ATTR_NAMES) {
    adjusted[attribute] = Math.max(
      1,
      Math.min(MAX_PLAYER_ATTRIBUTE, Math.round((attrs[attribute] * scalePerThousand) / 1000)),
    );
  }
  return adjusted;
}

function assertUniqueIds(ids: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(`${label} IDs must be non-empty strings`);
    }
    if (seen.has(id)) {
      throw new Error(`${label} IDs must be unique`);
    }
    seen.add(id);
  }
}

/**
 * Converts persistent squad state into the match engine's strict 11-player
 * boundary. Powers are match eligibility, not merely roster ownership.
 */
export function buildTeamDef(
  club: { id: string; name: string },
  roster: readonly MatchSquadPlayer[],
  lineupIds: readonly string[],
  heroLimit = 2,
): TeamDef {
  if (lineupIds.length !== 11) {
    throw new Error('A match lineup must contain exactly 11 players');
  }
  if (!Number.isSafeInteger(heroLimit) || heroLimit < 0) {
    throw new Error('Hero limit must be a non-negative integer');
  }

  assertUniqueIds(roster.map(player => player.id), 'Roster player');
  assertUniqueIds(lineupIds, 'Lineup player');

  const rosterById = new Map(roster.map(player => [player.id, player]));
  const lineup = lineupIds.map(id => {
    const player = rosterById.get(id);
    if (!player) {
      throw new Error(`Unknown lineup player ID: ${id}`);
    }
    return player;
  });

  for (const player of roster) {
    if (!Number.isSafeInteger(player.morale) || player.morale < 0 || player.morale > 100) {
      throw new Error(`Player ${player.id} morale must be an integer from 0 to 100`);
    }
    if (player.condition !== undefined
      && (!Number.isSafeInteger(player.condition) || player.condition < 0 || player.condition > 100)) {
      throw new Error(`Player ${player.id} condition must be an integer from 0 to 100`);
    }
    for (const attribute of ATTR_NAMES) {
      const value = player.attrs[attribute];
      if (!Number.isSafeInteger(value) || value < 1 || value > MAX_PLAYER_ATTRIBUTE) {
        throw new Error(
          `Player ${player.id} attribute ${attribute} must be an integer from 1 to ${MAX_PLAYER_ATTRIBUTE}`,
        );
      }
    }
    if (player.licensed && !player.power) {
      throw new Error(`Licensed player ${player.id} must own a power`);
    }
    if (player.powerTier !== undefined
      && (!Number.isSafeInteger(player.powerTier) || player.powerTier < 1 || player.powerTier > 3)) {
      throw new Error(`Player ${player.id} power tier must be an integer from 1 to 3`);
    }
  }

  const goalkeepers = lineup.filter(player => player.role === 'GK');
  if (goalkeepers.length !== 1) {
    throw new Error('A match lineup must contain exactly one goalkeeper');
  }
  if (lineup[0].role !== 'GK') {
    throw new Error('The goalkeeper must occupy lineup slot 0');
  }

  for (const player of lineup) {
    if (player.power && !player.licensed) {
      throw new Error(`Hero ${player.id} must be licensed or benched`);
    }
  }

  const licensedHeroCount = lineup.filter(player => player.licensed).length;
  if (licensedHeroCount > heroLimit) {
    throw new Error(`A match lineup may contain at most ${heroLimit} licensed heroes`);
  }

  const lineupIdSet = new Set(lineupIds);
  const toPlayerDef = (player: MatchSquadPlayer) => ({
    id: player.id,
    name: player.name,
    role: player.role,
    ...(player.lookId === undefined ? {} : { lookId: player.lookId }),
    startingCondition: player.condition ?? 100,
    attrs: matchAttrsAtMorale(player.attrs, player.morale),
    ...(player.licensed && player.power
      ? { power: player.power, powerTier: player.powerTier ?? 1 as const }
      : {}),
  });
  const bench = roster.filter(player =>
    !lineupIdSet.has(player.id)
    && (player.injuryWeeks ?? 0) === 0
    && !(player.power && !player.licensed),
  );

  return {
    id: club.id,
    name: club.name,
    players: lineup.map(toPlayerDef),
    bench: bench.map(toPlayerDef),
  };
}
