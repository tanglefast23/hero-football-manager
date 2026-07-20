jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));

jest.mock('../../render/management-sfx', () => ({
  playUiClickSfx: jest.fn(),
}));

import { formatCurrency } from '../components/Scorecard';

describe('currency formatting', () => {
  it('puts the dollar sign before every money amount', () => {
    expect(formatCurrency(500)).toBe('$500');
    expect(formatCurrency(8_000)).toBe('$8,000');
    expect(formatCurrency(-500)).toBe('−$500');
    expect(formatCurrency(500, true)).toBe('+$500');
  });
});
