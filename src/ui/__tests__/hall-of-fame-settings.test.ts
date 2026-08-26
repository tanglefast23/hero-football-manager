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
import { hallOfFameViewModel } from '../../application/hall-of-fame';
import type { GameState, HallOfFameRecord } from '../../game/types';
import type { HallOfFameViewModel } from '../models';
import { SettingsOverlay, type SettingsOverlayProps } from '../SettingsOverlay';

/**
 * The Hall of Fame is reached from Settings and nowhere else, so the row and
 * its two states are the whole entrance to the feature. Jest has no DOM, so
 * this walks the element tree the overlay returns rather than rendering it.
 */
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

/**
 * The sub-pages are component elements, not rendered trees, so nothing inside
 * them exists to search for. Which one the panel holds is decided by the props
 * it was handed — `viewModel` for the record, `content` for the glossary.
 */
function findByProp(
  node: unknown,
  prop: string,
): { props: Record<string, unknown> } | undefined {
  if (node === null || typeof node !== 'object') return undefined;
  const element = node as { props?: Record<string, unknown> };
  if (element.props !== undefined && prop in element.props) {
    return element as { props: Record<string, unknown> };
  }
  const children = element.props?.children;
  const childList = Array.isArray(children) ? children : [children];
  for (const child of childList) {
    const match = findByProp(child, prop);
    if (match !== undefined) return match;
  }
  return undefined;
}

const RECORD: HallOfFameRecord = {
  season: 6,
  clubName: 'Bramble Rovers',
  played: 60,
  won: 40,
  drawn: 10,
  lost: 10,
  goalsFor: 120,
  goalsAgainst: 55,
  divisionTitles: [{ season: 6, division: 1 }],
  cupWinSeasons: [5],
  tiers: [{ division: 1, firstSeason: 5, seasons: 2, bestPosition: 1 }],
};

/** Built by the shipped builder, so the row reflects a real career's page. */
function viewModel(record?: HallOfFameRecord): HallOfFameViewModel {
  return hallOfFameViewModel({ hallOfFame: record } as unknown as GameState);
}

function overlay(overrides: Partial<SettingsOverlayProps>) {
  return SettingsOverlay({
    open: true,
    glossary: { schemaVersion: 1, categories: [] },
    glossaryOpen: false,
    privacySupportOpen: false,
    volume: 1,
    reduceMotion: false,
    quickMatchEnabled: false,
    hudSide: 'left',
    hapticsEnabled: true,
    textScale: 1,
    language: 'en' as const,
    onLanguageChange: () => {},
    highContrast: false,
    colorSafeKits: true,
    cutInMode: 'full',
    assistantMode: 'teacher',
    onVolumeChange: jest.fn(),
    onToggleReduceMotion: jest.fn(),
    onToggleQuickMatch: jest.fn(),
    onToggleHudSide: jest.fn(),
    onToggleHaptics: jest.fn(),
    onCycleTextScale: jest.fn(),
    onToggleHighContrast: jest.fn(),
    onToggleColorSafeKits: jest.fn(),
    onToggleCutInMode: jest.fn(),
    onEmailSupport: jest.fn(),
    onOpenPrivacyPolicy: jest.fn(),
    onSetAssistantMode: jest.fn(),
    onGlossaryOpenChange: jest.fn(),
    onPrivacySupportOpenChange: jest.fn(),
    onOpenChange: jest.fn(),
    ...overrides,
  });
}

// The two labels are catalog copy — "Open the Hall of Fame" and "Hall of Fame,
// locked until the climb is complete" — so they are looked up the same way the
// row looks them up rather than duplicated as literals here.
const t = copyFor('en');
const OPEN_LABEL = t('settings.hallOfFame.a11y.open');
const LOCKED_LABEL = t('settings.hallOfFame.a11y.locked');

describe('the Hall of Fame row in Settings', () => {
  it('is hidden when there is no career to have a record', () => {
    const element = overlay({});

    expect(findByAccessibilityLabel(element, OPEN_LABEL)).toBeUndefined();
    expect(findByAccessibilityLabel(element, LOCKED_LABEL)).toBeUndefined();
  });

  it('offers the locked page while the climb is unfinished', () => {
    const onHallOfFameOpenChange = jest.fn();
    const element = overlay({
      hallOfFame: viewModel(),
      onHallOfFameOpenChange,
    });
    const row = findByAccessibilityLabel(element, LOCKED_LABEL);

    expect(row).toBeDefined();
    // It opens either way: the locked page is what explains what unlocks it.
    (row?.props.onPress as (() => void) | undefined)?.();
    expect(onHallOfFameOpenChange).toHaveBeenCalledWith(true);
  });

  it('offers the record once the climb is complete', () => {
    const element = overlay({ hallOfFame: viewModel(RECORD) });

    expect(findByAccessibilityLabel(element, OPEN_LABEL)).toBeDefined();
    expect(findByAccessibilityLabel(element, LOCKED_LABEL)).toBeUndefined();
  });

  it('replaces the settings list with the page while it is open', () => {
    const page = viewModel(RECORD);
    const element = overlay({
      hallOfFame: page,
      hallOfFameOpen: true,
      onHallOfFameOpenChange: jest.fn(),
    });

    expect(findByProp(element, 'viewModel')?.props.viewModel).toBe(page);
    expect(findByAccessibilityLabel(element, 'Open glossary')).toBeUndefined();
    expect(
      findByAccessibilityLabel(element, 'Open the Hall of Fame'),
    ).toBeUndefined();
  });

  /** The glossary is the older sub-page and still wins the panel. */
  it('leaves the glossary in place when both are open', () => {
    const element = overlay({
      hallOfFame: viewModel(RECORD),
      hallOfFameOpen: true,
      glossaryOpen: true,
      onHallOfFameOpenChange: jest.fn(),
    });

    expect(findByProp(element, 'content')).toBeDefined();
    expect(findByProp(element, 'viewModel')).toBeUndefined();
  });
});
