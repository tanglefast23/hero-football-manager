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
      shell.indexOf('ref={navigationGuideAnchor.anchorRef}'),
    );
    expect(actions).not.toContain('maxFontSizeMultiplier');
    expect(shell).toContain('Player actions below are not capped');
    expect(shell.match(/className="min-w-0 flex-shrink"/g)).toHaveLength(2);
    expect(shell).toContain(
      'className="min-w-0 flex-shrink flex-row items-center gap-2"',
    );
    expect(shell.match(/maxFontSizeMultiplier=\{1\.2\}/g)).toHaveLength(3);
    expect(shell).toContain("'mt-1 text-[11px] uppercase text-ink'");
  });
});
