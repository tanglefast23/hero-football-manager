import {
  AWAY_DECOY_INDEX,
  HOME_DECOY_INDEX,
  attributedPlayerIndex,
} from '../sim/entities';
import type { MatchState } from '../sim/types';
import type { PlayerMatchContribution } from './types';

type Countable =
  'goals' | 'assists' | 'tacklesWon' | 'saves' | 'passesCompleted';

/**
 * Every countable action in a finished match, resolved to stable player ids.
 *
 * Walks backwards because a SAVE, TACKLE or PASS names a lineup SLOT, and
 * substitutes inherit the slot they come on into. Reading slot owners from the
 * starting lineup credits a substitute's action to the player he replaced;
 * reading from the final state makes the mirrored mistake. Substitutions
 * record the outgoing player, so rewinding them from the final state puts
 * every slot back to whoever held it at the time.
 *
 * Decoy clones are rewound the same way. They are entities 22 and 23, which own
 * no slot, so a clone's tackle or pass would otherwise be credited to nobody.
 * `DECOY_POP` names the clone's source slot as it leaves the pitch, and clone
 * entities only act while a clone is live, so seeding from any clone still
 * standing at full time and rewinding each pop maps every clone action to the
 * player it was copied from.
 *
 * Goals and assists are exempt from all of that — the engine stamps stable
 * ids (`scoredById`, `assistedById`) precisely because a substitution can
 * land between the touch and the ball crossing the line.
 */
export function contributionsFrom(
  match: MatchState,
): PlayerMatchContribution[] {
  const slotOwners = new Map<number, string>();
  match.players.forEach((player, slot) => slotOwners.set(slot, player.def.id));

  const cloneSources = new Map<number, number>([
    [HOME_DECOY_INDEX, attributedPlayerIndex(match, HOME_DECOY_INDEX)],
    [AWAY_DECOY_INDEX, attributedPlayerIndex(match, AWAY_DECOY_INDEX)],
  ]);
  const ownerOf = (entity: number): string | undefined =>
    slotOwners.get(cloneSources.get(entity) ?? entity);

  const totals = new Map<string, PlayerMatchContribution>();
  const bump = (playerId: string, key: Countable): void => {
    const row = totals.get(playerId) ?? {
      playerId,
      goals: 0,
      assists: 0,
      tacklesWon: 0,
      saves: 0,
      passesCompleted: 0,
    };
    row[key] += 1;
    totals.set(playerId, row);
  };

  for (let index = match.events.length - 1; index >= 0; index -= 1) {
    const event = match.events[index];
    if (event.kind === 'GOAL') {
      // Stable id stamped at shot launch: a substitution during the shot's
      // flight must not hand the goal to the slot's new occupant.
      bump(event.scoredById, 'goals');
      if (event.assistedById !== undefined) bump(event.assistedById, 'assists');
    } else if (event.kind === 'SAVE') {
      // Only a keeper saves, and a clone is never one: `by` is slot 0 or 11.
      const keeper = slotOwners.get(event.by);
      if (keeper !== undefined) bump(keeper, 'saves');
    } else if (
      event.kind === 'TACKLE' &&
      event.won &&
      event.style !== 'power'
    ) {
      // Power tackles are excluded: a ball-winning power would otherwise decide
      // the defender award on power ownership rather than defending.
      const tackler = ownerOf(event.by);
      if (tackler !== undefined) bump(tackler, 'tacklesWon');
    } else if (event.kind === 'PASS' && event.ok) {
      const passer = ownerOf(event.from);
      if (passer !== undefined) bump(passer, 'passesCompleted');
    } else if (event.kind === 'DECOY_POP') {
      // Rewind: before this pop the clone entity was copying `source`.
      cloneSources.set(event.clone, event.source);
    } else if (event.kind === 'SUBSTITUTION') {
      // Rewind: before this swap the shirt belonged to the player going off.
      slotOwners.set(event.player, event.outPlayerId);
    }
  }

  return [...totals.values()];
}
