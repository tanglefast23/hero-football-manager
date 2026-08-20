import { emit } from './events';
import type { MatchState, PlayerDef } from './types';

export const MAX_SUBSTITUTIONS = 5;
export type BeforeSubstitution = (
  state: MatchState,
  playerIndex: number,
  outgoingPlayerId: string,
) => void;

function copyPlayerDef(player: PlayerDef): PlayerDef {
  return { ...player, attrs: { ...player.attrs } };
}

/** The single mutation path for both replayed manual and derived automatic swaps. */
export function performSubstitution(
  state: MatchState,
  team: 0 | 1,
  playerIndex: number,
  replacementId: string,
  beforeSubstitution?: BeforeSubstitution,
): boolean {
  const first = team * 11;
  if (playerIndex < first || playerIndex >= first + 11) return false;
  if (state.substitutionsUsed[team] >= MAX_SUBSTITUTIONS) return false;

  const benchIndex = state.bench[team].findIndex(
    (player) => player.id === replacementId,
  );
  if (benchIndex < 0) return false;
  const replacement = state.bench[team][benchIndex];
  const outgoing = state.players[playerIndex];
  if (
    outgoing.team !== team ||
    outgoing.outReason === 'redcard' ||
    (outgoing.def.role === 'GK') !== (replacement.role === 'GK')
  )
    return false;

  beforeSubstitution?.(state, playerIndex, outgoing.def.id);
  state.bench[team].splice(benchIndex, 1);
  const outPlayerId = outgoing.def.id;
  state.players[playerIndex] = {
    def: copyPlayerDef(replacement),
    team,
    pos: { ...outgoing.pos },
    movementResidue: { x: 0, y: 0 },
    condition: replacement.startingCondition ?? 100,
    gauge: 0,
    zonesOpened: 0,
    powerState: { kind: 'idle' },
    // A substitute inherits the policy of the player they replaced, never the
    // match's OPENING policy — which goes stale the moment a manager flips the
    // HERO POWER setting mid-match. Role is preserved across a substitution (a
    // GK may only replace a GK, checked above), so the outgoing player is
    // always the right source, and since m2.8 retired the keeper exemption
    // that holds for keepers on the same terms as everyone else.
    firePolicy: outgoing.firePolicy,
    outUntilTick: 0,
    tackleRecoveryUntil: 0,
    tackleCooldownUntil: state.tick,
    cards: 0,
    // A substitute is a new object, so it starts outside every live chain by
    // construction. There is deliberately no membership to clear.
    comboTierD: 0,
    comboTicks: 0,
    comboChainId: 0,
  };
  state.substitutionsUsed[team] += 1;
  emit(state, {
    t: state.tick,
    kind: 'SUBSTITUTION',
    team,
    player: playerIndex,
    outPlayerId,
    inPlayerId: replacement.id,
  });
  return true;
}
