jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));

jest.mock('../../render/management-sfx', () => ({
  playUiClickSfx: jest.fn(),
}));

import {
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

  it('formats signed resource movement without a positive-negative prefix', () => {
    expect(formatSignedCompactNumber(en, 23)).toBe('+23');
    expect(formatSignedCompactNumber(en, 0)).toBe('0');
    expect(formatSignedCompactNumber(en, -23)).toBe('-23');
  });
});
