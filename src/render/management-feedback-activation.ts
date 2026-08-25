export interface ManagementFeedbackActivation {
  soundPlayed: boolean;
  hapticPlayed: boolean;
}

let active: ManagementFeedbackActivation | null = null;

export function createManagementFeedbackActivation(): ManagementFeedbackActivation {
  return { soundPlayed: false, hapticPlayed: false };
}

export function withManagementFeedbackActivation<T>(
  activation: ManagementFeedbackActivation,
  action: () => T,
): T {
  const previous = active;
  active = activation;
  try {
    return action();
  } finally {
    active = previous;
  }
}

/** True only for the first feedback of this kind in one physical activation. */
export function claimManagementFeedback(kind: 'sound' | 'haptic'): boolean {
  if (active === null) return true;
  const field = kind === 'sound' ? 'soundPlayed' : 'hapticPlayed';
  if (active[field]) return false;
  active[field] = true;
  return true;
}
