import { readFileSync } from 'fs';
import { join } from 'path';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('management shell at accessibility text sizes', () => {
  test('keeps the pinned action and five-tab navigation compact and legible', () => {
    const app = source('App.tsx');
    const shell = source('src/ui/ManagementShell.tsx');
    const scorecard = source('src/ui/components/Scorecard.tsx');

    expect(app).toContain('const APP_MAX_FONT_SIZE_MULTIPLIER = 1.6;');
    expect(app).toContain('maxFontSizeMultiplier: APP_MAX_FONT_SIZE_MULTIPLIER');
    const home = source('src/ui/screens/ClubHomeScreen.tsx');
    expect(home.match(/minimumFontScale=\{0\.65\}/g)).toHaveLength(2);
    expect(scorecard).toContain('maxFontSizeMultiplier?: number;');
    expect(scorecard).toContain('maxFontSizeMultiplier={maxFontSizeMultiplier}');
    expect(shell).toContain('const CHROME_MAX_FONT_SIZE_MULTIPLIER = 1.3;');
    expect(shell.match(/maxFontSizeMultiplier=\{CHROME_MAX_FONT_SIZE_MULTIPLIER\}/g))
      .toHaveLength(4);
    expect(shell).toContain('The full names remain available to assistive');
  });
});
