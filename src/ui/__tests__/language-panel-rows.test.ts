import { languagePanelRows } from '../language-panel-rows';
import { ENABLED_LOCALES, LOCALES } from '../../i18n';

describe('languagePanelRows', () => {
  test('names every language in its own language', () => {
    const rows = languagePanelRows('en', ['en', 'es', 'pt-BR', 'vi']);
    expect(rows.map(row => row.endonym))
      .toEqual(['English', 'Español', 'Português (Brasil)', 'Tiếng Việt']);
  });

  test('marks exactly one row as selected', () => {
    const rows = languagePanelRows('es', ['en', 'es', 'de']);
    expect(rows.filter(row => row.selected).map(row => row.locale)).toEqual(['es']);
  });

  test('offers only what has actually shipped', () => {
    expect(languagePanelRows('en').map(row => row.locale)).toEqual([...ENABLED_LOCALES]);
  });

  test('the Vietnamese row carries its own face whatever the active language', () => {
    for (const active of LOCALES) {
      const vietnamese = languagePanelRows(active, ['en', 'vi']).find(row => row.locale === 'vi');
      expect({ active, face: vietnamese?.face })
        .toEqual({ active, face: 'Handjet_700Bold' });
    }
  });

  test('Latin rows stay on Silkscreen even when Vietnamese is active', () => {
    const rows = languagePanelRows('vi', ['en', 'de', 'vi']);
    expect(rows.find(row => row.locale === 'de')?.face).toBe('Silkscreen_700Bold');
  });
});
