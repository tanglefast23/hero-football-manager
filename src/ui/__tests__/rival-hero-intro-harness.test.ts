import { readFileSync } from 'fs';
import { join } from 'path';

const source = (file: string) =>
  readFileSync(join(process.cwd(), file), 'utf8');

describe('rival hero intro Dev Harness entry', () => {
  it('registers five stable deep-link cases backed by the production builder and screen', () => {
    const entry = source('src/ui/dev-harness/entries/rival-hero-intro.tsx');
    for (const caseId of [
      'barry-allan',
      'scott-somers',
      'steve-rodgers',
      'bruno-bannor',
      'bruce-wain',
    ])
      expect(entry).toContainSource(`id: '${caseId}'`);
    expect(entry).toContainSource('rivalHeroIntroViewModelForHeroId');
    expect(entry).toContainSource('<RivalHeroIntroScreen');
    expect(entry).toContainSource('label="Replay"');
    expect(entry).toContainSource('label="Reduced"');

    const registry = source('src/ui/dev-harness/registry.ts');
    expect(registry).toContainSource(
      "import { rivalHeroIntroEntry } from './entries/rival-hero-intro';",
    );
    expect(registry).toContainSource('rivalHeroIntroEntry,');
  });

  it('routes the rival before Cup Bert, condition warning, and the lineup, with hard cuts', () => {
    const app = source('App.tsx');
    expect(app.indexOf('if (rivalHeroIntro !== undefined)')).toBeLessThan(
      app.indexOf('<FixtureMatchDayScreen'),
    );
    expect(app).toContainSource('rivalHeroIntro === undefined');
    expect(app).toContainSource('|| screenKey === RivalHeroIntroScreen;');
    expect(app).toContainSource(
      'rivalHeroIntro === undefined && lowConditionMatchdayStarter !== null',
    );
  });
});
