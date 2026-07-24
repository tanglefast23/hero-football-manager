export type TrainingBadgeAction = 'manage' | 'assign-and-pick' | 'reject-full';

/**
 * Decides what a tap on the roster's train badge does. `manage` reopens the
 * drill popup for an assigned player (never toggles); `assign-and-pick` adds
 * the player then opens the popup; `reject-full` forwards to the store so the
 * slot-limit toast fires without opening the popup. Locked players never get
 * here — their badge is disabled.
 */
export function trainingBadgeAction(
  isAssigned: boolean,
  assignedCount: number,
  maxSlots: number,
): TrainingBadgeAction {
  if (isAssigned) return 'manage';
  if (assignedCount >= maxSlots) return 'reject-full';
  return 'assign-and-pick';
}
