import { copyFor, facesFor } from '../use-copy';
import { LOCALES } from '../locales';

describe('copyFor', () => {
  test('returns a bound t() for the active locale', () => {
    const t = copyFor('en');
    expect(t('settings.language.title')).toBe('Language');
    expect(t.locale).toBe('en');
  });

  test('every shipped locale returns its own copy, not the English fallback', () => {
    // There is no untranslated locale left to demonstrate fallback with, which
    // is what finishing the translation phases looks like. Fallback itself is
    // still covered by the resolver's own tests.
    expect(copyFor('es')('settings.language.title')).toBe('Idioma');
    expect(copyFor('pt-BR')('settings.language.title')).toBe('Idioma');
    expect(copyFor('fr')('settings.language.title')).toBe('Langue');
    expect(copyFor('de')('settings.language.title')).toBe('Sprache');
    expect(copyFor('id')('settings.language.title')).toBe('Bahasa');
    expect(copyFor('vi')('settings.language.title')).toBe('Ngôn ngữ');
  });

  test('a key nobody has authored returns the key', () => {
    expect(copyFor('en')('does.not.exist')).toBe('does.not.exist');
  });
});

describe('facesFor', () => {
  test('every locale draws from the one pixel family', () => {
    // There is no per-language face swap any more: the Silkscreen derivative
    // covers Vietnamese too, so choosing `vi` no longer redraws the whole UI —
    // including the English still awaiting translation — in a different font.
    for (const locale of LOCALES) {
      expect({ locale, faces: facesFor(locale) }).toEqual({
        locale,
        faces: {
          display: 'HFMSilkscreen_700Bold',
          data: 'HFMSilkscreen_400Regular',
        },
      });
    }
  });

  test('every locale names two distinct faces, so the voice split survives', () => {
    for (const locale of LOCALES) {
      const faces = facesFor(locale);
      expect({ locale, faces }).toMatchObject({ locale });
      expect(faces.display).not.toBe(faces.data);
    }
  });
});
