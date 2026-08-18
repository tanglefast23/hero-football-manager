import { readFileSync } from 'fs';
import { join } from 'path';
import { loadCatalog } from '../../i18n';
import { LOCALES } from '../../i18n/locales';
import { COACHING_FORMATION_IDS } from '../../sim/tactics';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const picker = source('src/ui/components/FormationPickerModal.tsx');
const matchDay = source('src/ui/screens/FixtureMatchDayScreen.tsx');

describe('match-day formation picker', () => {
  test('names every shape it offers, in every language', () => {
    // The chip used to cycle silently: the manager saw 3-4-3 and never learned
    // it was all-out attack. The picker reads the blurb, so every coachable
    // shape has to have one in all seven catalogs.
    expect(picker).toContainSource('t(`formation.${formation}.blurb`)');
    for (const locale of LOCALES) {
      const strings = loadCatalog(locale).strings;
      for (const formation of COACHING_FORMATION_IDS) {
        expect(strings[`formation.${formation}.blurb`]).toBeTruthy();
      }
    }
    expect(loadCatalog('en').strings['formation.3-4-3.blurb']).toBe(
      'All-out attack',
    );
  });

  test('ships only existing catalog keys, so it is translated on day one', () => {
    const keys = [...picker.matchAll(/t\('([\w.-]+)'/gu)].map((m) => m[1]);
    expect(keys).toContain('matchScreen.formation');
    const strings = loadCatalog('en').strings;
    for (const key of keys) expect(strings[key]).toBeTruthy();
  });

  test('is what the team-sheet chip opens, and picking one closes it', () => {
    expect(matchDay).toContainSource(
      'onPress={() => setFormationPickerOpen(true)}',
    );
    expect(matchDay).toContainSource(
      'options={formationPickerOpen ? formationOptions : null}',
    );
    expect(matchDay).toContainSource('setFormationPickerOpen(false);');
    expect(matchDay).toContainSource('onSelectFormation(formation);');
  });
});
