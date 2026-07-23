const mockSelectionAsync = jest.fn(() => Promise.resolve());
const mockImpactAsync = jest.fn(() => Promise.resolve());
const mockNotificationAsync = jest.fn(() => Promise.resolve());

jest.mock('expo-haptics', () => ({
  selectionAsync: mockSelectionAsync,
  impactAsync: mockImpactAsync,
  notificationAsync: mockNotificationAsync,
  ImpactFeedbackStyle: { Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

import { playHapticForEvent, playManagementHaptic, setHapticsEnabled } from '../haptics';

describe('persistent haptics gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHapticsEnabled(true);
  });

  it('silences match and management feedback when disabled', () => {
    setHapticsEnabled(false);
    playManagementHaptic('success');
    playHapticForEvent({ t: 1, kind: 'GOAL', by: 9, team: 0 }, 0);

    expect(mockSelectionAsync).not.toHaveBeenCalled();
    expect(mockImpactAsync).not.toHaveBeenCalled();
    expect(mockNotificationAsync).not.toHaveBeenCalled();
  });

  it('restores semantic feedback when enabled again', () => {
    setHapticsEnabled(false);
    setHapticsEnabled(true);
    playManagementHaptic('select');
    playHapticForEvent({ t: 1, kind: 'POWER_FIRED', player: 9, power: 'WEB_TRAP', strength: 1 }, 0);

    expect(mockSelectionAsync).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledWith('heavy');
  });

  it('uses a medium impact for tap feedback', () => {
    playManagementHaptic('tap');

    expect(mockImpactAsync).toHaveBeenCalledWith('medium');
  });
});
