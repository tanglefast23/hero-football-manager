import {
  existsSync,
  readFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import {
  DEVELOPER_MODE_AVAILABLE,
  developerModeAvailable,
  insideDesktopShell,
  qaRootRoutesEnabled,
} from '../release-surface';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('App Store release surface', () => {
  test('blocks updates that target preview or remove offline and native compatibility protections', () => {
    const directory = mkdtempSync(join(tmpdir(), 'hfm-release-check-'));
    const script = join(process.cwd(), 'scripts/release/check-config.mjs');
    const config = JSON.parse(source('app.json'));
    try {
      mkdirSync(join(directory, 'src/ui'), { recursive: true });
      writeFileSync(
        join(directory, 'src/ui/release-surface.ts'),
        source('src/ui/release-surface.ts'),
      );
      const check = (candidate: typeof config) => {
        writeFileSync(join(directory, 'app.json'), JSON.stringify(candidate));
        return spawnSync(process.execPath, [script], {
          cwd: directory,
          encoding: 'utf8',
        });
      };
      expect(check(config).status).toBe(0);
      for (const unsafe of [
        { updates: { ...config.expo.updates, useEmbeddedUpdate: false } },
        {
          updates: {
            ...config.expo.updates,
            requestHeaders: { 'expo-channel-name': 'preview' },
          },
        },
        { runtimeVersion: { policy: 'appVersion' } },
      ]) {
        const result = check({ expo: { ...config.expo, ...unsafe } });
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Release preflight failed');
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('allows QA roots only in development or on a local web review surface', () => {
    expect(qaRootRoutesEnabled(true, 'ios')).toBe(true);
    expect(qaRootRoutesEnabled(true, 'android')).toBe(true);
    expect(
      qaRootRoutesEnabled(false, 'web', false, { hostname: 'localhost' }),
    ).toBe(true);
    expect(
      qaRootRoutesEnabled(false, 'web', false, {
        hostname: 'hero-football-manager.vercel.app',
      }),
    ).toBe(false);
    expect(qaRootRoutesEnabled(false, 'ios')).toBe(false);
    expect(qaRootRoutesEnabled(false, 'android')).toBe(false);
    // The desktop shell serves the same web bundle but is a shipped product.
    expect(
      qaRootRoutesEnabled(false, 'web', true, { hostname: 'localhost' }),
    ).toBe(false);
    expect(qaRootRoutesEnabled(true, 'web', true)).toBe(true);
  });

  test('keeps the release preflight able to read the Developer Mode switch', () => {
    // The manual QA override is hand-flipped, so the preflight must stop an
    // archive from shipping it. Debug and web availability do not use it.
    const guard =
      /export const DEVELOPER_MODE_AVAILABLE: boolean = (true|false);/;
    expect(guard.exec(source('src/ui/release-surface.ts'))?.[1]).toBe(
      String(DEVELOPER_MODE_AVAILABLE),
    );
    expect(source('scripts/release/check-config.mjs')).toContainSource(
      guard.source,
    );
  });

  test('enables Developer Mode on Debug and local web surfaces but not public web or native Release', () => {
    expect(developerModeAvailable(true, 'ios')).toBe(true);
    expect(developerModeAvailable(true, 'android')).toBe(true);
    expect(
      developerModeAvailable(false, 'web', false, { hostname: 'localhost' }),
    ).toBe(true);
    expect(
      developerModeAvailable(false, 'web', false, {
        hostname: 'hero-football-manager.vercel.app',
      }),
    ).toBe(false);
    expect(developerModeAvailable(false, 'ios')).toBe(false);
    expect(developerModeAvailable(false, 'android')).toBe(false);
    expect(
      developerModeAvailable(false, 'web', true, { hostname: 'localhost' }),
    ).toBe(false);

    const app = source('App.tsx');
    expect(app).toContainSource(
      'const developerModeAvailable = developerModeAvailableForSurface(__DEV__, Platform.OS, insideDesktopShell())',
    );
    expect(app).toContainSource(
      'developerMode={developerModeAvailable ? preferences.developerMode : undefined}',
    );
    expect(app).toContainSource(
      'onToggleDeveloperMode={developerModeAvailable ? toggleDeveloperMode : undefined}',
    );
  });

  test('recognises the desktop shell by its URL scheme, never by an injected marker', () => {
    expect(insideDesktopShell({ protocol: 'hfm:' })).toBe(true);
    expect(insideDesktopShell({ protocol: 'http:' })).toBe(false);
    expect(insideDesktopShell({ protocol: 'file:' })).toBe(false);
    expect(insideDesktopShell(undefined)).toBe(false);
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
    expect(Number(config.expo.ios.buildNumber)).toBeGreaterThanOrEqual(2);

    const titleLanding = source('src/ui/screens/TitleLandingScreen.tsx');
    expect(titleLanding).toContainSource(
      "layoutModeForWidth(width) === 'twoColumn'",
    );
    expect(titleLanding).toContainSource("'min-w-0 max-w-[620px] flex-1'");
  });

  test('regenerates and inspects the app privacy manifest itself', () => {
    const config = JSON.parse(source('app.json')) as {
      expo: {
        ios: {
          privacyManifests: {
            NSPrivacyAccessedAPITypes: Array<{
              NSPrivacyAccessedAPIType: string;
              NSPrivacyAccessedAPITypeReasons: string[];
            }>;
            NSPrivacyCollectedDataTypes: unknown[];
            NSPrivacyTracking: boolean;
          };
        };
      };
    };
    const manifest = config.expo.ios.privacyManifests;

    expect(manifest.NSPrivacyAccessedAPITypes).toEqual([
      {
        NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
        NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
      },
      {
        NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
        NSPrivacyAccessedAPITypeReasons: ['C617.1'],
      },
      {
        NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
        NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
      },
    ]);
    expect(manifest.NSPrivacyCollectedDataTypes).toEqual(
      ['DeviceID', 'CrashData', 'OtherDiagnosticData'].map((type) => ({
        NSPrivacyCollectedDataType: `NSPrivacyCollectedDataType${type}`,
        NSPrivacyCollectedDataTypeLinked: true,
        NSPrivacyCollectedDataTypeTracking: false,
        NSPrivacyCollectedDataTypePurposes: [
          'NSPrivacyCollectedDataTypePurposeAppFunctionality',
        ],
      })),
    );
    expect(manifest.NSPrivacyTracking).toBe(false);
    expect(source('scripts/release/inspect-native-app.mjs')).toContainSource(
      "const privacyManifest = join(app, 'PrivacyInfo.xcprivacy');",
    );
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
