import { resolveTrainingDrillForPath } from './training-paths';
import type { CareerTrainingSlot, GameState } from './types';

/**
 * Validates and stores training slots without applying contract-promise rules.
 * Keeping this leaf helper separate lets promise resolution reuse the exact
 * plan invariants without making contract-promises and training import each
 * other.
 */
export function replaceCareerTrainingPlan(
  state: GameState,
  slots: readonly CareerTrainingSlot[],
): GameState {
  if (state.phase !== 'manage') {
    throw new Error('training plans can only change during the manage phase');
  }
  const maxSlots = state.trainingRules?.maxFocusDrillsPerWeek ?? 3;
  if (slots.length > maxSlots) {
    throw new Error(`a training plan allows at most ${maxSlots} players`);
  }
  if (new Set(slots.map(slot => slot.playerId)).size !== slots.length) {
    throw new Error('a player can occupy only one training slot');
  }
  const roster = new Set(
    state.players
      .filter(player => player.clubId === state.userClubId)
      .map(player => player.id),
  );
  for (const slot of slots) {
    if (!roster.has(slot.playerId)) throw new Error(`unknown trainee ${slot.playerId}`);
    resolveTrainingDrillForPath(state, slot.pathId); // throws on unknown path
  }
  return { ...state, trainingPlan: { slots: slots.map(slot => ({ ...slot })) } };
}
