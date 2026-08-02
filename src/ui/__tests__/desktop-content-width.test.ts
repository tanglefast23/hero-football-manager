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
  'AwardsCeremonyQaScreen.tsx',
  'AwakeningCutsceneScreen.tsx',
  'ChampionshipCelebrationScreen.tsx',
  'EndgameCelebrationScreen.tsx',
  'AwardsCeremonyScreen.tsx',
  'FixtureMatchDayScreen.tsx',
  'TitleLandingScreen.tsx',
  'NewGameWelcomeScreen.tsx',
  'CharacterCreationScreen.tsx',
  'WeeklyReviewScreen.tsx',
  'HirePitchScreen.tsx',
  'StoryEventScreen.tsx',
  'ClubFinancesScreen.tsx',
  // Not a scrolling screen: a panel rendered inside SquadTrainingScreen's
  // already-clamped ScrollView. Clamping it again would nest two measures.
  'SquadRequestsPanel.tsx',
  // Same reason: a sub-page of the Settings modal, whose panel is already
  // capped at max-w-lg. The 1180pt measure is more than twice that.
  'HallOfFameScreen.tsx',
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
  it('shows the cup when the inbox sends you to it', () => {
    const league = readFileSync(join(process.cwd(), 'src/ui/screens/M2LeagueScreen.tsx'), 'utf8');

    // The screen is now three sub-tabs, so a guide targeting the cup selects
    // the cup tab. That replaces the old reorder-and-scroll: on every viewport
    // the cup is the whole page, not a section somewhere down it.
    expect(league).toContain('setSelectedSubTab(guideSubTab)');
    expect(league).toContain("activeSubTab === 'cup'");
    expect(league).toContain('? cupSections');
    // The guide selects a tab, it does not pin one: the strip has to stay live
    // while the concierge focus is still set.
    expect(league).toContain('onPress={() => setSelectedSubTab(tab)}');
  });
});
