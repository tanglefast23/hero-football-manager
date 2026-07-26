jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));

jest.mock('../../render/management-sfx', () => ({
  playUiClickSfx: jest.fn(),
}));

import { formatCurrency, formatSignedCompactNumber } from '../components/Scorecard';

describe('currency formatting', () => {
  it('puts the dollar sign before every money amount', () => {
    expect(formatCurrency(500)).toBe('$500');
    expect(formatCurrency(8_000)).toBe('$8,000');
    // ASCII hyphen, not U+2212: Silkscreen has no true-minus glyph, so the
    // typographic minus rendered in the system fallback face mid-string.
    expect(formatCurrency(-500)).toBe('-$500');
    expect(formatCurrency(500, true)).toBe('+$500');
  });

  it('formats signed resource movement without a positive-negative prefix', () => {
    expect(formatSignedCompactNumber(23)).toBe('+23');
    expect(formatSignedCompactNumber(0)).toBe('0');
    expect(formatSignedCompactNumber(-23)).toBe('-23');
  });
});
