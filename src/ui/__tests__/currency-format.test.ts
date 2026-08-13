jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));

jest.mock('../../render/management-sfx', () => ({
  playUiClickSfx: jest.fn(),
}));

import {
  compactHudMoney,
  formatCompactHudNumber,
  formatCurrency,
  formatSignedCompactNumber,
} from '../components/Scorecard';
import { copyFor } from '../../i18n';

const en = copyFor('en');
const de = copyFor('de');

describe('currency formatting', () => {
  it('puts the dollar sign before every money amount', () => {
    expect(formatCurrency(en, 500)).toBe('$500');
    expect(formatCurrency(en, 8_000)).toBe('$8,000');
    expect(formatCurrency(de, 8_000)).toBe('$8.000');
    // ASCII hyphen, not U+2212: Silkscreen has no true-minus glyph, so the
    // typographic minus rendered in the system fallback face mid-string.
    expect(formatCurrency(en, -500)).toBe('-$500');
    expect(formatCurrency(en, 500, true)).toBe('+$500');
  });

  it('keeps the HUD money chip reading the same way as its spoken label', () => {
    // The chip paints the mark and the figure as two Text nodes in two faces.
    // The sign used to ride the figure, so a broke club's HUD said "$-3,178"
    // while its accessibilityLabel correctly said "-$3,178".
    expect(compactHudMoney(en, '$', -3_178)).toEqual({
      glyph: '-$',
      amount: '3,178',
    });
    expect(
      `${compactHudMoney(en, '$', -3_178).glyph}${compactHudMoney(en, '$', -3_178).amount}`,
    ).toBe(formatCurrency(en, -3_178));
    expect(compactHudMoney(en, '$', 3_178)).toEqual({
      glyph: '$',
      amount: '3,178',
    });
    expect(compactHudMoney(en, '$', 0)).toEqual({ glyph: '$', amount: '0' });
    // The abbreviation survives the split, and so does the locale's grouping.
    expect(compactHudMoney(en, '$', -12_500)).toEqual({
      glyph: '-$',
      amount: '12.5k',
    });
    expect(compactHudMoney(de, '$', -9_500)).toEqual({
      glyph: '-$',
      amount: '9.500',
    });
  });

  it('abbreviates top-bar numerals above ten thousand', () => {
    expect(formatCompactHudNumber(en, 9_999)).toBe('9,999');
    expect(formatCompactHudNumber(en, 10_000)).toBe('10k');
    expect(formatCompactHudNumber(en, 12_500)).toBe('12.5k');
    expect(formatCompactHudNumber(en, 2_000_000)).toBe('2M');
  });

  it('formats signed resource movement without a positive-negative prefix', () => {
    expect(formatSignedCompactNumber(en, 23)).toBe('+23');
    expect(formatSignedCompactNumber(en, 0)).toBe('0');
    expect(formatSignedCompactNumber(en, -23)).toBe('-23');
  });
});
