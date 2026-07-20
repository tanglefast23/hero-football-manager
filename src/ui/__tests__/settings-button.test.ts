jest.mock('react-native', () => ({
  Modal: 'Modal',
  PanResponder: { create: jest.fn() },
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));

import { SettingsButton, SettingsOverlay } from '../SettingsOverlay';

function findByAccessibilityRole(node: unknown, role: string): { props: Record<string, unknown> } | undefined {
  if (node === null || typeof node !== 'object') return undefined;
  const element = node as { props?: Record<string, unknown> };
  if (element.props?.accessibilityRole === role) return element as { props: Record<string, unknown> };
  const children = element.props?.children;
  const childList = Array.isArray(children) ? children : [children];
  for (const child of childList) {
    const match = findByAccessibilityRole(child, role);
    if (match !== undefined) return match;
  }
  return undefined;
}

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

  it('shows persistence failures as an accessible in-app alert', () => {
    const element = SettingsOverlay({
      open: true,
      volume: 1,
      reduceMotion: false,
      hudSide: 'left',
      saveError: 'Settings were not saved. Storage is unavailable.',
      onVolumeChange: jest.fn(),
      onToggleReduceMotion: jest.fn(),
      onToggleHudSide: jest.fn(),
      onOpenChange: jest.fn(),
    });
    const alert = findByAccessibilityRole(element, 'alert');

    expect(alert?.props.accessibilityLiveRegion).toBe('assertive');
    expect(alert?.props.children).toBeDefined();
  });
});
