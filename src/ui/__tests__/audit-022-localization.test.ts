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
    expect(source).toContain('const t = currentStoreCopy();');
    expect(source).not.toContain('useCopy');
  });

  test('the crash recovery copy warns that the last action may have saved', () => {
    expect(copyFor('en')('screenErrorBoundary.body')).toBe(
      'Your last action may already be saved. Return to the title screen, continue, and check before you try it again.',
    );
  });

  test('localized routes have a German recovery boundary below the provider', () => {
    const app = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
    const gameApp = app.slice(app.indexOf('function GameApp('));

    expect(gameApp).toMatch(
      /<LocaleProvider value=\{preferences\.language\}>\s*<ScreenErrorBoundary[\s\S]*?<SafeAreaProvider>/,
    );
    expect(copyFor('de')('screenErrorBoundary.thisScreenCouldNotOpen')).toBe(
      'Bildschirm ließ sich nicht öffnen',
    );
    expect(copyFor('de')('screenErrorBoundary.backToTitle')).toBe(
      'Zurück zum Titel',
    );
    expect(app).toContain(
      '<GameApp key={gameGeneration} onRecover={recoverGame} />',
    );
    expect(gameApp).toContain('onRecover={onRecover}');
  });

  test('selected German locale controls money grouping', () => {
    expect(formatMoneyForCopy(copyFor('de'), 12_400)).toBe('$12.400');
    expect(formatMoneyForCopy(copyFor('de'), 12_400, true)).toBe('+$12.400');
  });

  test('German title celebrations do not fall back to English', () => {
    expect(copyFor('de')('championshipCelebration.wonTheLeague')).toBe(
      'DU HAST DIE LIGA GEWONNEN!',
    );
    expect(copyFor('de')('seasonEnd.leagueTitle')).toBe('Ligameister');
  });
});
