import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENABLED_LOCALES, loadCatalog } from '../../i18n';

const homeSource = () =>
  readFileSync(
    join(process.cwd(), 'src/ui/screens/ClubHomeScreen.tsx'),
    'utf8',
  );

describe('club home inbox card roles', () => {
  it('uses purple STORY cards, yellow ordinary cards, and grey manager tips', () => {
    const home = homeSource();

    expect(home).toContainSource(
      "if (alert.isStory) return 'border-story-dark bg-story-light'",
    );
    expect(home).toContainSource("return 'border-gold-dark bg-gold-light'");
    expect(home).toContainSource(
      '<StatusChip label={t(\'clubHome.story\')} tone="story" />',
    );
    expect(home).toContainSource(
      'className="border-2 border-b-4 border-grey-dark bg-paper-dark p-3"',
    );
  });

  it('translates the STORY tag in every supported language', () => {
    for (const locale of ENABLED_LOCALES) {
      expect(
        loadCatalog(locale).strings['clubHome.story']?.trim(),
      ).toBeTruthy();
    }
  });
});
