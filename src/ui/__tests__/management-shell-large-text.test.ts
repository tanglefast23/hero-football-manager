import { readFileSync } from 'fs';
import { join } from 'path';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('management shell at accessibility text sizes', () => {
  test('does not cap player actions while fixed data cells stay measured', () => {
    const app = source('App.tsx');
    const shell = source('src/ui/ManagementShell.tsx');
    const scorecard = source('src/ui/components/Scorecard.tsx');

    expect(app).not.toContain('APP_MAX_FONT_SIZE_MULTIPLIER');
    expect(app).not.toContain('Text.defaultProps');
    const home = source('src/ui/screens/ClubHomeScreen.tsx');
    expect(home.match(/minimumFontScale=\{0\.65\}/g)).toHaveLength(2);
    expect(scorecard).not.toContain('maxFontSizeMultiplier?: number;');
    const actionButton = scorecard.slice(
      scorecard.indexOf('export function ActionButton'),
      scorecard.indexOf('interface MetricProps'),
    );
    expect(actionButton).not.toContain('adjustsFontSizeToFit');
    expect(actionButton).not.toContain('numberOfLines={1}');
    expect(shell).toContain(
      'const FIXED_HEADER_MAX_FONT_SIZE_MULTIPLIER = 1.3;',
    );
    expect(
      shell.match(
        /maxFontSizeMultiplier=\{FIXED_HEADER_MAX_FONT_SIZE_MULTIPLIER\}/g,
      ),
    ).toHaveLength(1);

    const actions = shell.slice(
      shell.indexOf('<ActionButton'),
      shell.indexOf('const styles'),
    );
    expect(actions).not.toContain('maxFontSizeMultiplier');
    expect(shell).toContain('Player actions below are not capped');
  });
});
