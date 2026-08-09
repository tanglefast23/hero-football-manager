import { CatalogSchema } from '../catalog-schema';
import { loadCatalog } from '../load-catalogs';
import { LOCALES } from '../locales';

describe('catalog schema', () => {
  test('accepts a well-formed catalog', () => {
    const parsed = CatalogSchema.parse({
      schemaVersion: 1,
      locale: 'de',
      strings: { 'a.b': 'Hallo' },
    });
    expect(parsed.strings['a.b']).toBe('Hallo');
  });

  test('rejects a locale we do not ship', () => {
    expect(() =>
      CatalogSchema.parse({ schemaVersion: 1, locale: 'pt', strings: {} }),
    ).toThrow();
  });

  test('rejects an empty string value, which is always a mistake', () => {
    expect(() =>
      CatalogSchema.parse({
        schemaVersion: 1,
        locale: 'en',
        strings: { 'a.b': '' },
      }),
    ).toThrow();
  });

  test('rejects a key that is not dot-namespaced', () => {
    expect(() =>
      CatalogSchema.parse({
        schemaVersion: 1,
        locale: 'en',
        strings: { nodots: 'x' },
      }),
    ).toThrow();
  });

  test('rejects an unknown top-level field', () => {
    expect(() =>
      CatalogSchema.parse({
        schemaVersion: 1,
        locale: 'en',
        strings: {},
        extra: 1,
      }),
    ).toThrow();
  });
});

describe('loadCatalog', () => {
  test('loads English', () => {
    expect(loadCatalog('en').strings['settings.language.title']).toBe(
      'Language',
    );
  });

  test('every shipped locale has a parseable catalog file', () => {
    for (const locale of LOCALES) {
      expect(loadCatalog(locale).locale).toBe(locale);
    }
  });

  test('the same catalog object is reused rather than re-parsed', () => {
    expect(loadCatalog('en')).toBe(loadCatalog('en'));
  });
});
