import { formatInteger, formatMoney } from '../format-number';
import { LOCALES, localeMeta } from '../locales';

const NBSP = ' ';

describe('formatInteger', () => {
  test('groups in threes with the locale separator', () => {
    expect(formatInteger('en', 1240)).toBe('1,240');
    expect(formatInteger('de', 1240)).toBe('1.240');
    expect(formatInteger('fr', 1240)).toBe(`1${NBSP}240`);
    expect(formatInteger('vi', 1240000)).toBe('1.240.000');
  });

  test('leaves short numbers alone', () => {
    expect(formatInteger('de', 0)).toBe('0');
    expect(formatInteger('de', 999)).toBe('999');
  });

  test('keeps the sign outside the grouping', () => {
    expect(formatInteger('en', -1240)).toBe('-1,240');
    expect(formatInteger('en', -1240000)).toBe('-1,240,000');
  });

  test('adds a positive sign only when requested', () => {
    expect(formatInteger('de', 1240, true)).toBe('+1.240');
    expect(formatInteger('de', 0, true)).toBe('0');
  });

  test('truncates toward zero rather than rounding', () => {
    expect(formatInteger('en', 1240.9)).toBe('1,240');
    expect(formatInteger('en', -1240.9)).toBe('-1,240');
  });

  test('never emits a separator the locale did not ask for', () => {
    for (const locale of LOCALES) {
      const separator = localeMeta(locale).groupSeparator;
      const formatted = formatInteger(locale, 1234567);
      expect({ locale, formatted }).toMatchObject({ locale });
      expect(formatted).toBe(`1${separator}234${separator}567`);
    }
  });
});

describe('formatMoney', () => {
  test('the dollar sign is fictional and never moves', () => {
    expect(formatMoney('en', 1240)).toBe('$1,240');
    expect(formatMoney('de', 1240)).toBe('$1.240');
    expect(formatMoney('vi', 1240)).toBe('$1.240');
  });

  test('negative money reads as minus then symbol', () => {
    expect(formatMoney('en', -1240)).toBe('-$1,240');
  });

  test('zero is not special-cased into a blank', () => {
    expect(formatMoney('en', 0)).toBe('$0');
  });

  test('adds a positive sign before the symbol only when requested', () => {
    expect(formatMoney('de', 1240, true)).toBe('+$1.240');
    expect(formatMoney('de', 0, true)).toBe('$0');
  });
});
