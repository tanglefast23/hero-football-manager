import fs from 'fs';
import path from 'path';
import { copyFor, formatMoneyForCopy } from '../../i18n';

const ROOT = path.resolve(__dirname, '../../..');

describe('AUD-022 localization recovery', () => {
  test('German settings actions use the correct settings noun', () => {
    const de = copyFor('de');
    expect(de('settings.open')).toBe('Einstellungen öffnen');
    expect(de('settings.close')).toBe('Einstellungen schließen');
  });

  test('the screen error boundary receives every player-facing string from t()', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/ui/ScreenErrorBoundary.tsx'),
      'utf8',
    );
    for (const key of [
      'screenErrorBoundary.thisScreenCouldNotOpen',
      'screenErrorBoundary.body',
      'screenErrorBoundary.technicalDetail',
      'screenErrorBoundary.backToTitle',
      'screenErrorBoundary.a11y.returnToTheTitleScreen',
    ]) {
      expect(source).toContain(`t('${key}'`);
    }
  });

  test('selected German locale controls money grouping', () => {
    expect(formatMoneyForCopy(copyFor('de'), 12_400)).toBe('$12.400');
    expect(formatMoneyForCopy(copyFor('de'), 12_400, true)).toBe('+$12.400');
  });
});
