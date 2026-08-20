import {
  inUsefulContext,
  isShotSavePower,
  LATE_WINDOW_TICKS,
} from '../sim/powers';
import type { MatchState } from '../sim/types';

/**
 * Models an attentive watched-match tap. Keeper Zones already pause while an
 * enemy attack is live, so spending one merely because its displayed window is
 * closing can replace that safe wait with an armed window that expires before
 * the shot. An attentive keeper tap therefore waits for the shot itself.
 */
export function shouldQueueWellTappedPower(
  state: MatchState,
  slot: number,
): boolean {
  const player = state.players[slot];
  if (player?.powerState.kind !== 'zone') return false;
  // Keepers are tappable since m2.8, so there is no role exclusion here any
  // more. A save keeper's only useful context IS the shot, which `inUsefulContext`
  // already answers for them — and their ten-second window means an attentive
  // manager presses on the attack rather than on the shot, so the late-window
  // fallback below would model a press that is always too late.
  if (isShotSavePower(player.def.power)) return inUsefulContext(state, slot);
  if (inUsefulContext(state, slot)) return true;
  return player.powerState.remainingTicks <= LATE_WINDOW_TICKS;
}
