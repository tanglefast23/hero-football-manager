import { pluralSuffix } from '../plural';

describe('pluralSuffix', () => {
  test('English and Spanish treat zero as plural', () => {
    expect(pluralSuffix('en', 0)).toBe('other');
    expect(pluralSuffix('en', 1)).toBe('one');
    expect(pluralSuffix('en', 2)).toBe('other');
    expect(pluralSuffix('es', 0)).toBe('other');
    expect(pluralSuffix('de', 0)).toBe('other');
  });

  test('French and Brazilian Portuguese treat zero as singular', () => {
    expect(pluralSuffix('fr', 0)).toBe('one');
    expect(pluralSuffix('fr', 1)).toBe('one');
    expect(pluralSuffix('fr', 2)).toBe('other');
    expect(pluralSuffix('pt-BR', 0)).toBe('one');
    expect(pluralSuffix('pt-BR', 1)).toBe('one');
    expect(pluralSuffix('pt-BR', 2)).toBe('other');
  });

  test('Indonesian and Vietnamese have a single form', () => {
    expect(pluralSuffix('id', 0)).toBe('other');
    expect(pluralSuffix('id', 1)).toBe('other');
    expect(pluralSuffix('vi', 5)).toBe('other');
  });

  test('negative counts select on magnitude', () => {
    expect(pluralSuffix('en', -1)).toBe('one');
    expect(pluralSuffix('fr', -0)).toBe('one');
  });
});
