import { inUsefulContext, LATE_WINDOW_TICKS } from '../sim/powers';
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
  // Since m2.7 a goalkeeper is always FIRE_WHEN_READY, so queueInput refuses a
  // tap on one. Keyed on the role, matching firePolicyForRole — a keeper
  // carrying GUST is exempt too.
  if (player.def.role === 'GK') return false;
  if (inUsefulContext(state, slot)) return true;
  return player.powerState.remainingTicks <= LATE_WINDOW_TICKS;
}
