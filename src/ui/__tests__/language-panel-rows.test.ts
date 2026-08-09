import { languagePanelRows } from '../language-panel-rows';
import { ENABLED_LOCALES, LOCALES, localeMeta } from '../../i18n';
import { faceFile, glyphSet, missingGlyphs } from '../../i18n/glyph-coverage';

describe('languagePanelRows', () => {
  test('names every language in its own language', () => {
    const rows = languagePanelRows('en', ['en', 'es', 'pt-BR', 'vi']);
    expect(rows.map((row) => row.endonym)).toEqual([
      'English',
      'Español',
      'Português (Brasil)',
      'Tiếng Việt',
    ]);
  });

  test('marks exactly one row as selected', () => {
    const rows = languagePanelRows('es', ['en', 'es', 'de']);
    expect(rows.filter((row) => row.selected).map((row) => row.locale)).toEqual(
      ['es'],
    );
  });

  test('offers only what has actually shipped', () => {
    expect(languagePanelRows('en').map((row) => row.locale)).toEqual([
      ...ENABLED_LOCALES,
    ]);
  });

  test('every row carries its OWN face, not the active language s', () => {
    // All seven languages now draw from one family, so this no longer changes
    // what is on screen — but the row must still resolve its own locale rather
    // than the active one. Getting that backwards would break the picker the
    // day a language needs a different face again, and the control offering the
    // fix would be the broken one.
    for (const active of LOCALES) {
      const rows = languagePanelRows(active, [...LOCALES]);
      expect({ active, faces: rows.map((row) => row.face) }).toEqual({
        active,
        faces: LOCALES.map((locale) => localeMeta(locale).faces.display),
      });
    }
  });

  test('the endonym is drawn in a face that can spell it', () => {
    // `Tiếng Việt` is the reason the derivative exists: the picker draws each
    // language's name in that language's face, so a face that cannot spell one
    // of them breaks the control offering the fix.
    const vietnamese = languagePanelRows('en', ['en', 'vi']).find(
      (row) => row.locale === 'vi',
    );
    expect(vietnamese?.face).toBe('HFMSilkscreen_700Bold');
    expect(
      missingGlyphs(
        vietnamese?.endonym ?? '',
        glyphSet(faceFile(vietnamese!.face)),
      ),
    ).toEqual([]);
  });
});
