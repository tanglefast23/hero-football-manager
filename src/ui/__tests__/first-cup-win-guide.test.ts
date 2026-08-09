import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENABLED_LOCALES, loadCatalog } from '../../i18n';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('first Hero Cup win guide', () => {
  it('opens the Cup page, celebrates the Round of 32, and dismisses on any tap', () => {
    const app = read('App.tsx');
    const league = read('src/ui/screens/M2LeagueScreen.tsx');
    const bracket = read('src/ui/components/CupBracket.tsx');

    expect(app).toContainSource("'milestone:first-cup-win'");
    expect(app).toContainSource("store.setActiveTab('league')");
    expect(app).toContainSource('sequenceId="first-cup-round-of-32"');
    expect(app).toContainSource("setConciergeFocus('national-cup')");
    expect(app).toContainSource("firstCupRoundOf32GuideOwed ? 'cup'");
    expect(league).toContainSource(
      'onTouchStart={guideRoundOf32 ? onDismissRoundOf32Guide : undefined}',
    );
    expect(bracket).toContainSource('guideRoundOf32 && index === 0');
    expect(bracket).toContainSource("detail={t('firstCupWin.youAreHere')}");
  });

  it('has all four guide lines in every supported language', () => {
    const keys = [
      'firstCupWin.roundOf32Title',
      'firstCupWin.roundOf32Body1',
      'firstCupWin.roundOf32Body2',
      'firstCupWin.youAreHere',
    ];

    for (const locale of ENABLED_LOCALES) {
      const strings = loadCatalog(locale).strings;
      for (const key of keys) expect(strings[key]?.trim()).toBeTruthy();
    }
  });
});
