import { copyFor, facesFor } from '../use-copy';
import { LOCALES } from '../locales';

describe('copyFor', () => {
  test('returns a bound t() for the active locale', () => {
    expect(copyFor('en')('settings.language.title')).toBe('Language');
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
  test('Latin locales keep Silkscreen', () => {
    expect(facesFor('de').display).toBe('Silkscreen_700Bold');
    expect(facesFor('es').data).toBe('Silkscreen_400Regular');
  });

  test('Vietnamese swaps both voices together', () => {
    expect(facesFor('vi')).toEqual({
      display: 'Handjet_700Bold',
      data: 'Handjet_400Regular',
    });
  });

  test('every locale names two distinct faces, so the voice split survives', () => {
    for (const locale of LOCALES) {
      const faces = facesFor(locale);
      expect({ locale, faces }).toMatchObject({ locale });
      expect(faces.display).not.toBe(faces.data);
    }
  });
});
