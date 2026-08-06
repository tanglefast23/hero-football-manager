import { ENABLED_LOCALES, LOCALES, isLocale, localeMeta } from '../locales';

describe('locale registry', () => {
  test('ships seven locales with English first', () => {
    expect(LOCALES).toEqual(['en', 'es', 'pt-BR', 'fr', 'de', 'id', 'vi']);
  });

  test('a locale is enabled only once its phase is complete', () => {
    // Widening this is the LAST step of a translation phase, never the first:
    // every quality gate runs against it, so widening early turns them all red
    // at once and the real failures get lost in the noise.
    expect(ENABLED_LOCALES).toEqual(['en', 'es', 'pt-BR', 'fr', 'id', 'de', 'vi']);
  });

  test('every locale names itself in its own language', () => {
    expect(localeMeta('es').endonym).toBe('Español');
    expect(localeMeta('vi').endonym).toBe('Tiếng Việt');
    expect(localeMeta('de').endonym).toBe('Deutsch');
  });

  test('pt-BR groups with French for plurals, not with Spanish', () => {
    expect(localeMeta('pt-BR').pluralRule).toBe('zeroIsOne');
    expect(localeMeta('fr').pluralRule).toBe('zeroIsOne');
    expect(localeMeta('es').pluralRule).toBe('oneOther');
    expect(localeMeta('id').pluralRule).toBe('none');
  });

  test('French groups with U+00A0, not a narrow or thin space', () => {
    // Asserted by codepoint, because these three characters are visually
    // identical in a diff. Silkscreen has U+00A0 and has neither U+202F nor
    // U+2009 -- picking the typographically correct narrow space would render
    // a tofu box in every French money value.
    expect(localeMeta('fr').groupSeparator.codePointAt(0)).toBe(0x00a0);
  });

  test('no locale groups with a character Silkscreen lacks', () => {
    const SILKSCREEN_SAFE = new Set([0x002c, 0x002e, 0x00a0, 0x0020]);
    for (const locale of LOCALES) {
      const cp = localeMeta(locale).groupSeparator.codePointAt(0);
      expect({ locale, cp }).toMatchObject({ locale });
      expect(SILKSCREEN_SAFE.has(cp ?? -1)).toBe(true);
    }
  });

  test('only Vietnamese uses the second face, and it swaps both voices', () => {
    expect(localeMeta('en').faces).toEqual({
      display: 'Silkscreen_700Bold',
      data: 'Silkscreen_400Regular',
    });
    expect(localeMeta('vi').faces).toEqual({
      display: 'Handjet_700Bold',
      data: 'Handjet_400Regular',
    });
  });

  test('every locale declares an expansion budget', () => {
    for (const locale of LOCALES) {
      expect(localeMeta(locale).expansion).toBeGreaterThanOrEqual(1);
    }
    expect(localeMeta('de').expansion).toBe(1.3);
  });

  test('isLocale rejects an unknown tag', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('pt')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});
