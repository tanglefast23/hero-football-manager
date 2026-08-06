import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { qaRootRoutesEnabled } from '../release-surface';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('App Store release surface', () => {
  test('allows QA roots only in development or on the intentional web review surface', () => {
    expect(qaRootRoutesEnabled(true, 'ios')).toBe(true);
    expect(qaRootRoutesEnabled(true, 'android')).toBe(true);
    expect(qaRootRoutesEnabled(false, 'web')).toBe(true);
    expect(qaRootRoutesEnabled(false, 'ios')).toBe(false);
    expect(qaRootRoutesEnabled(false, 'android')).toBe(false);
  });

  test('ships one adaptive iPhone and iPad configuration', () => {
    const config = JSON.parse(source('app.json')) as {
      expo: {
        orientation: string;
        ios: { supportsTablet: boolean; requireFullScreen: boolean; buildNumber: string };
      };
    };

    expect(config.expo.orientation).toBe('portrait');
    expect(config.expo.ios.supportsTablet).toBe(true);
    expect(config.expo.ios.requireFullScreen).toBe(false);
    expect(config.expo.ios.buildNumber).toMatch(/^\d+$/);

    const titleLanding = source('src/ui/screens/TitleLandingScreen.tsx');
    expect(titleLanding).toContain("layoutModeForWidth(width) === 'twoColumn'");
    expect(titleLanding).toContain("'min-w-0 max-w-[620px] flex-1'");
  });

  test('does not ship the obsolete placeholder hire pitch', () => {
    expect(existsSync(join(process.cwd(), 'src/ui/screens/HirePitchScreen.tsx'))).toBe(false);
    expect(source('App.tsx')).not.toContain('HirePitchScreen');
  });
});
