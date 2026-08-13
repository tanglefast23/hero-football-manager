// These tests call the components as plain functions, so there is no React
// dispatcher and `useContext` returns null. Only the context lookup is stubbed:
// `t` still resolves through the real English catalog, so assertions on
// accessibility labels keep testing the copy that actually ships.
jest.mock('../../i18n', () => {
  const actual = jest.requireActual('../../i18n');
  return {
    ...actual,
    useLocale: () => 'en',
    useCopy: () => actual.copyFor('en'),
  };
});

jest.mock('react-native', () => ({
  Modal: 'Modal',
  PanResponder: { create: jest.fn() },
  // The overlay asks Platform whether to add the web dialog role; native is the
  // branch that adds nothing, so these trees stay exactly as they were.
  Platform: { OS: 'ios' },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
}));

import { copyFor } from '../../i18n';
import { SettingsButton, SettingsOverlay } from '../SettingsOverlay';

function findByAccessibilityRole(
  node: unknown,
  role: string,
): { props: Record<string, unknown> } | undefined {
  if (node === null || typeof node !== 'object') return undefined;
  const element = node as { props?: Record<string, unknown> };
  if (element.props?.accessibilityRole === role)
    return element as { props: Record<string, unknown> };
  const children = element.props?.children;
  const childList = Array.isArray(children) ? children : [children];
  for (const child of childList) {
    const match = findByAccessibilityRole(child, role);
    if (match !== undefined) return match;
  }
  return undefined;
}

function findByAccessibilityLabel(
  node: unknown,
  label: string,
): { props: Record<string, unknown> } | undefined {
  if (node === null || typeof node !== 'object') return undefined;
  const element = node as { props?: Record<string, unknown> };
  if (element.props?.accessibilityLabel === label)
    return element as { props: Record<string, unknown> };
  const children = element.props?.children;
  const childList = Array.isArray(children) ? children : [children];
  for (const child of childList) {
    const match = findByAccessibilityLabel(child, label);
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
    const onSetAssistantMode = jest.fn();
    const element = SettingsOverlay({
      open: true,
      glossary: {
        schemaVersion: 1,
        categories: [
          {
            id: 'players',
            title: 'Players',
            entries: [{ term: 'Fame', definition: 'Renown.' }],
          },
        ],
      },
      glossaryOpen: false,
      privacySupportOpen: false,
      volume: 1,
      reduceMotion: false,
      hudSide: 'left',
      hapticsEnabled: true,
      textScale: 1,
      language: 'en' as const,
      onCycleLanguage: () => {},
      highContrast: false,
      colorSafeKits: true,
      cutInMode: 'full',
      assistantMode: 'teacher',
      saveError: 'Settings were not saved. Storage is unavailable.',
      onVolumeChange: jest.fn(),
      onToggleReduceMotion: jest.fn(),
      onToggleHudSide: jest.fn(),
      onToggleHaptics: jest.fn(),
      onCycleTextScale: jest.fn(),
      onToggleHighContrast: jest.fn(),
      onToggleColorSafeKits: jest.fn(),
      onToggleCutInMode: jest.fn(),
      onEmailSupport: jest.fn(),
      onSetAssistantMode,
      onGlossaryOpenChange: jest.fn(),
      onPrivacySupportOpenChange: jest.fn(),
      onOpenChange: jest.fn(),
    });
    const alert = findByAccessibilityRole(element, 'alert');

    expect(alert?.props.accessibilityLiveRegion).toBe('assertive');
    expect(alert?.props.children).toBeDefined();
    expect(findByAccessibilityLabel(element, 'Open glossary')).toBeDefined();
    // "Bert is teaching. Tap to have him stay out of your way." — catalog copy,
    // so it is looked up rather than repeated as a literal here.
    const bertMode = findByAccessibilityLabel(
      element,
      copyFor('en')('settings.assistant.a11y.teaching'),
    );
    expect(bertMode).toBeDefined();
    (bertMode?.props.onPress as (() => void) | undefined)?.();
    expect(onSetAssistantMode).toHaveBeenCalledWith('advisor');
  });

  it('only exposes Developer Mode when the Debug-build props are supplied', () => {
    const onToggleDeveloperMode = jest.fn();
    const common = {
      open: true,
      glossary: { schemaVersion: 1 as const, categories: [] },
      glossaryOpen: false,
      privacySupportOpen: false,
      volume: 1 as const,
      reduceMotion: false,
      hudSide: 'left' as const,
      hapticsEnabled: true,
      textScale: 1 as const,
      language: 'en' as const,
      onCycleLanguage: () => {},
      highContrast: false,
      colorSafeKits: true,
      cutInMode: 'full' as const,
      onVolumeChange: jest.fn(),
      onToggleReduceMotion: jest.fn(),
      onToggleHudSide: jest.fn(),
      onToggleHaptics: jest.fn(),
      onCycleTextScale: jest.fn(),
      onToggleHighContrast: jest.fn(),
      onToggleColorSafeKits: jest.fn(),
      onToggleCutInMode: jest.fn(),
      onEmailSupport: jest.fn(),
      onGlossaryOpenChange: jest.fn(),
      onPrivacySupportOpenChange: jest.fn(),
      onOpenChange: jest.fn(),
    };

    expect(
      findByAccessibilityLabel(SettingsOverlay(common), 'Developer mode'),
    ).toBeUndefined();
    expect(
      findByAccessibilityLabel(
        SettingsOverlay(common),
        'Open privacy and support',
      ),
    ).toBeDefined();

    const debug = SettingsOverlay({
      ...common,
      developerMode: true,
      onToggleDeveloperMode,
    });
    const developerMode = findByAccessibilityLabel(debug, 'Developer mode');
    expect(developerMode?.props.accessibilityState).toEqual({ checked: true });
    (developerMode?.props.onPress as (() => void) | undefined)?.();
    expect(onToggleDeveloperMode).toHaveBeenCalledTimes(1);
  });
});
