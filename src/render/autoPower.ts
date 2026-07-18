import { queueInput } from '../sim/match';
import { teamPowerBusy } from '../sim/powers';
import type { MatchState } from '../sim/types';

/** Queue the earliest legal home Zone as a normal, replay-recorded tap. */
export function queueAutoPowerTap(state: MatchState): number | null {
  if (state.phase === 'fulltime' || teamPowerBusy(state, 0)) return null;

  // A manual tap already queued for the next tick wins. This also prevents
  // AUTO from adding duplicate replay inputs between render frames.
  if (state.pendingInputs.some((input) => input.kind === 'POWER_TAP')) return null;

  for (let idx = 0; idx < 11; idx++) {
    const player = state.players[idx];
    if (!player.def.power || player.outUntilTick > state.tick || player.powerState.kind !== 'zone') continue;
    queueInput(state, { tick: state.tick + 1, kind: 'POWER_TAP', player: idx });
    return idx;
  }

  return null;
}
