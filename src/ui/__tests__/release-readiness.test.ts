import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  DEVELOPER_MODE_AVAILABLE,
  qaRootRoutesEnabled,
} from '../release-surface';

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

  test('keeps the release preflight able to read the Developer Mode switch', () => {
    // The switch is hand-flipped, so the preflight is the only thing that stops
    // an archive shipping the save/load rail. It reads the declaration by
    // pattern: reword the constant and the guard must still find it, or the
    // release passes with Developer Mode silently on.
    const guard =
      /export const DEVELOPER_MODE_AVAILABLE: boolean = (true|false);/;
    expect(guard.exec(source('src/ui/release-surface.ts'))?.[1]).toBe(
      String(DEVELOPER_MODE_AVAILABLE),
    );
    expect(source('scripts/release/check-config.mjs')).toContainSource(
      guard.source,
    );
  });

  test('gates the developer save rail on the switch rather than on __DEV__', () => {
    // Developer Mode has to survive a build where __DEV__ is false — a static
    // web export or TestFlight — which is the whole point of the switch.
    const app = source('App.tsx');
    expect(app).toContainSource(
      'developerMode={DEVELOPER_MODE_AVAILABLE ? preferences.developerMode : undefined}',
    );
    expect(app).toContainSource(
      'onToggleDeveloperMode={DEVELOPER_MODE_AVAILABLE ? toggleDeveloperMode : undefined}',
    );
    expect(app).not.toContainSource('__DEV__ ? preferences.developerMode');
    expect(app).not.toContainSource('__DEV__ && preferences.developerMode');
  });

  test('ships one adaptive iPhone and iPad configuration', () => {
    const config = JSON.parse(source('app.json')) as {
      expo: {
        orientation: string;
        ios: {
          supportsTablet: boolean;
          requireFullScreen: boolean;
          buildNumber: string;
        };
      };
    };

    expect(config.expo.orientation).toBe('portrait');
    expect(config.expo.ios.supportsTablet).toBe(true);
    expect(config.expo.ios.requireFullScreen).toBe(false);
    expect(config.expo.ios.buildNumber).toMatchSource(/^\d+$/);

    const titleLanding = source('src/ui/screens/TitleLandingScreen.tsx');
    expect(titleLanding).toContainSource(
      "layoutModeForWidth(width) === 'twoColumn'",
    );
    expect(titleLanding).toContainSource("'min-w-0 max-w-[620px] flex-1'");
  });

  test('does not ship the obsolete placeholder hire pitch', () => {
    expect(
      existsSync(join(process.cwd(), 'src/ui/screens/HirePitchScreen.tsx')),
    ).toBe(false);
    expect(source('App.tsx')).not.toContainSource('HirePitchScreen');
  });

  test('gives the Silkscreen license a production asset owner', () => {
    expect(source('metro.config.js')).toContainSource(
      "config.resolver.assetExts.push('txt')",
    );
    expect(source('src/ui/PrivacySupportPanel.tsx')).toContainSource(
      "require('../../assets/fonts/OFL.txt')",
    );
  });
});
