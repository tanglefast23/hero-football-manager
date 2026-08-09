import { queueControlledAutoSubstitution } from '../game/match-policy';
import { tick } from '../sim/match';
import type { MatchState } from '../sim/types';

/**
 * Advances the same mutable engine state in a bounded chunk. The caller yields
 * between chunks so an old phone does not freeze while finishing a blank match.
 */
export function advanceGraphicsRecoveryChunk(
  state: MatchState,
  autoSubs: boolean,
  maxTicks = 100,
): boolean {
  for (let step = 0; step < maxTicks && state.phase !== 'fulltime'; step += 1) {
    tick(state);
    queueControlledAutoSubstitution(state, autoSubs);
  }
  return state.phase === 'fulltime';
}
