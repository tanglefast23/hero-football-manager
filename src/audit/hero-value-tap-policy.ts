import {
  inUsefulContext,
  isShotSavePower,
  savePowerDangerPrompt,
} from '../sim/powers';
import type { MatchState } from '../sim/types';

/**
 * Models an attentive watched-match tap. Outfield heroes wait for their
 * authored useful context. Save powers use the same defending-third danger
 * prompt as the live button.
 */
export function shouldQueueWellTappedPower(
  state: MatchState,
  slot: number,
): boolean {
  const player = state.players[slot];
  if (player?.powerState.kind !== 'zone') return false;
  if (isShotSavePower(player.def.power))
    return savePowerDangerPrompt(state, slot);
  return inUsefulContext(state, slot);
}
