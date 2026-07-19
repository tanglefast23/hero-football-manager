jest.mock('react-native', () => ({
  Modal: 'Modal',
  PanResponder: { create: jest.fn() },
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));

import { SettingsButton } from '../SettingsOverlay';

describe('SettingsButton', () => {
  it('keeps one reserved 44-point touch target on paper screens', () => {
    const element = SettingsButton({ onPress: jest.fn() });
    expect(element.props.accessibilityLabel).toBe('Open settings');
    expect(element.props.className).toContain('h-11');
    expect(element.props.className).toContain('w-11');
  });

  it('uses the same dimensions in match chrome', () => {
    const element = SettingsButton({ onPress: jest.fn(), variant: 'match' });
    expect(element.props.className).toContain('h-11');
    expect(element.props.className).toContain('w-11');
    expect(element.props.className).toContain('bg-ink-soft');
  });
});
