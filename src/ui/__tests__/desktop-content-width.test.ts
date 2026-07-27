import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SCREEN_DIR = 'src/ui/screens';
const read = (file: string) => readFileSync(join(process.cwd(), SCREEN_DIR, file), 'utf8');

/**
 * Debug and one-off art screens are not part of the played game and are exempt.
 * Full-screen cinematics deliberately fill the window.
 */
const EXEMPT = new Set([
  'AwakeningArtQaScreen.tsx',
  'PowerArtQaScreen.tsx',
  'AwakeningCutsceneScreen.tsx',
  'ChampionshipCelebrationScreen.tsx',
  'FixtureMatchDayScreen.tsx',
  'TitleLandingScreen.tsx',
  'NewGameWelcomeScreen.tsx',
  'CharacterCreationScreen.tsx',
  'WeeklyReviewScreen.tsx',
  'HirePitchScreen.tsx',
  'StoryEventScreen.tsx',
  'ClubFinancesScreen.tsx',
]);

describe('desktop content width', () => {
  const screens = readdirSync(join(process.cwd(), SCREEN_DIR))
    .filter(file => file.endsWith('.tsx') && !EXEMPT.has(file));

  it('clamps every scrolling management screen to the two-column measure', () => {
    expect(screens.length).toBeGreaterThan(5);
    const unclamped = screens.filter(file => {
      const source = read(file);
      // Either the shared hook, or the literal measure the older screens use.
      return !source.includes('useDesktopContentStyle')
        && !source.includes('max-w-[1180px]');
    });
    expect(unclamped).toEqual([]);
  });

  it('keeps one definition of the measure', () => {
    const clamp = readFileSync(join(process.cwd(), 'src/ui/layout/DesktopClamp.tsx'), 'utf8');
    expect(clamp).toContain('export const DESKTOP_CONTENT_MAX_WIDTH = 1180;');
    // Phones must not be wrapped: there the content already is the window.
    expect(clamp).toContain("useLayoutMode() === 'twoColumn'");
  });
});

describe('cup guidance', () => {
  it('leads with the cup when the inbox sends you to it', () => {
    const league = readFileSync(join(process.cwd(), 'src/ui/screens/M2LeagueScreen.tsx'), 'utf8');

    // SectionFlow fills column one top-to-bottom, so "left column, already
    // framed" on a wide viewport just means the cup is the first section —
    // there is nothing to scroll to once it leads the page.
    expect(league).toContain("allSections.filter(section => section.key === 'cup')");
    expect(league).toContain("allSections.filter(section => section.key !== 'cup')");
    expect(league).toContain('const sections = guideNationalCup');
    // The phone keeps its scroll-into-view, because there the cup is below.
    expect(league).toContain("if (guideNationalCup && layoutMode === 'single')");
  });
});
