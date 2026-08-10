import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES, loadCatalog } from '../../i18n';

const source = (path: string): string =>
  readFileSync(join(process.cwd(), path), 'utf8');

describe('closed registration desk', () => {
  it('turns grey and shows the localized countdown as an unavailable button', () => {
    const market = source('src/ui/screens/MarketScreen.tsx');
    const scorecard = source('src/ui/components/Scorecard.tsx');

    expect(market).toContainSource("tone={closed ? 'muted' : 'default'}");
    expect(market).toContainSource('muted={closed}');
    expect(market).toContainSource("t('market.openInWeeks'");
    expect(market).toMatchSource(
      /label=\{countdownLabel\}[\s\S]{0,100}disabled[\s\S]{0,100}onPress=/,
    );
    expect(scorecard).toContainSource(
      "tone?: 'default' | 'attention' | 'muted'",
    );

    for (const locale of LOCALES) {
      const strings = loadCatalog(locale).strings;
      expect(strings['market.openInWeeks.one']).toContain('{count}');
      expect(strings['market.openInWeeks.other']).toContain('{count}');
    }
  });
});
