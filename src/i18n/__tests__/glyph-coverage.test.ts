import { faceFile, glyphSet, missingGlyphs } from '../glyph-coverage';
import { LOCALES, localeMeta } from '../locales';

describe('faceFile', () => {
  test('maps a registered family name to its shipped TTF', () => {
    expect(faceFile('Silkscreen_700Bold')).toMatch(
      /@expo-google-fonts\/silkscreen\/700Bold\/Silkscreen_700Bold\.ttf$/,
    );
  });

  test('rejects a name that is not family_weight', () => {
    expect(() => faceFile('Silkscreen')).toThrow();
  });
});

describe('glyphSet', () => {
  const silkscreen = glyphSet(faceFile('Silkscreen_400Regular'));

  test('Silkscreen covers Latin-1 and nothing beyond it', () => {
    // The measured basis of the whole Vietnamese decision. If this number moves,
    // the font premise in the design spec has changed and must be re-checked.
    expect(silkscreen.size).toBe(226);
  });

  test('Silkscreen draws Spanish, Portuguese, French and German', () => {
    expect(missingGlyphs('ñáéíóú¿¡ü', silkscreen)).toEqual([]);
    expect(missingGlyphs('ãõçâêôà', silkscreen)).toEqual([]);
    expect(missingGlyphs('èùïœçîû', silkscreen)).toEqual([]);
    expect(missingGlyphs('äöüß', silkscreen)).toEqual([]);
  });

  test('Silkscreen cannot draw Vietnamese — the reason a second face exists', () => {
    expect(missingGlyphs('ếộữạằọđơư', silkscreen).length).toBe(9);
  });

  test('Silkscreen has U+00A0 but not U+202F or U+2009', () => {
    expect(missingGlyphs(' ', silkscreen)).toEqual([]);
    expect(missingGlyphs(' ', silkscreen)).toEqual([' ']);
    expect(missingGlyphs(' ', silkscreen)).toEqual([' ']);
  });

  test('Handjet draws the Vietnamese Silkscreen cannot, in both weights', () => {
    // The other half of the font decision: Handjet was chosen over VT323
    // because it ships 400 AND 700, preserving the display/data voice split
    // that PixelText treats as load-bearing. Both cuts must cover Vietnamese,
    // or only half the UI works.
    for (const family of ['Handjet_400Regular', 'Handjet_700Bold']) {
      const covered = glyphSet(faceFile(family));
      expect({ family, missing: missingGlyphs('ếộữạằọđơư', covered) })
        .toEqual({ family, missing: [] });
    }
  });

  test('every locale can draw its own group separator and the currency sign', () => {
    for (const locale of LOCALES) {
      const covered = glyphSet(faceFile(localeMeta(locale).faces.data));
      const characters = `${localeMeta(locale).groupSeparator}$-0123456789`;
      expect({ locale, missing: missingGlyphs(characters, covered) })
        .toEqual({ locale, missing: [] });
    }
  });
});
