import * as Haptics from 'expo-haptics';
import type { MatchEvent } from '../sim/types';
import { hapticCueForEvent } from './haptic-cues';
import { claimManagementFeedback } from './management-feedback-activation';

export type ManagementHapticCue =
  'select' | 'tap' | 'commit' | 'success' | 'warning' | 'hero';
let hapticsEnabled = true;

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

/** Native feedback is presentation-only and always fails soft. */
export function playHapticForEvent(
  event: MatchEvent,
  controlledTeam: 0 | 1,
): void {
  if (!hapticsEnabled) return;
  const cue = hapticCueForEvent(event, controlledTeam);
  let feedback: Promise<void> | undefined;
  if (cue === 'zone') feedback = Haptics.selectionAsync();
  else if (cue === 'power')
    feedback = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  else if (cue === 'rival-power')
    feedback = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  else if (cue === 'goal')
    feedback = Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    );
  else if (cue === 'conceded')
    feedback = Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning,
    );
  void feedback?.catch(() => undefined);
}

/**
 * Management feedback is never part of simulation state and always fails soft.
 *
 * Weight tracks consequence: a plain `tap` on a row must not feel like a
 * `commit` that spends club money, so the impact styles are kept distinct.
 */
export function playManagementHaptic(cue: ManagementHapticCue): void {
  if (!hapticsEnabled) return;
  if (!claimManagementFeedback('haptic')) return;
  const feedback =
    cue === 'select'
      ? Haptics.selectionAsync()
      : cue === 'success'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : cue === 'warning'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          : Haptics.impactAsync(
              cue === 'hero' || cue === 'commit'
                ? Haptics.ImpactFeedbackStyle.Heavy
                : Haptics.ImpactFeedbackStyle.Rigid,
            );
  void feedback.catch(() => undefined);
}
