import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const qaEnvironmentVariables = [
  'EXPO_PUBLIC_DEV_HARNESS',
  'EXPO_PUBLIC_POWER_MATCH_QA',
  'EXPO_PUBLIC_POWER_CUTIN_QA',
  'EXPO_PUBLIC_POWER_ART_QA',
  'EXPO_PUBLIC_AWAKENING_ART_QA',
  'EXPO_PUBLIC_AWARDS_CEREMONY_QA',
  'EXPO_PUBLIC_AWAKENING_PREVIEW_ID',
];

const failures = [];
const activeQaVariables = qaEnvironmentVariables.filter(
  (name) => process.env[name],
);
if (activeQaVariables.length > 0) {
  failures.push(
    `QA environment variables are set: ${activeQaVariables.join(', ')}`,
  );
}

// Developer Mode is on in every ordinary build, so the one thing standing
// between an archive and a player-visible save/load rail is a hand-flipped
// constant. Read it rather than trust it was remembered.
const releaseSurface = readFileSync(
  resolve('src/ui/release-surface.ts'),
  'utf8',
);
const developerModeAvailable =
  /export const DEVELOPER_MODE_AVAILABLE: boolean = (true|false);/.exec(
    releaseSurface,
  );
if (developerModeAvailable === null) {
  failures.push(
    'DEVELOPER_MODE_AVAILABLE could not be read from src/ui/release-surface.ts',
  );
} else if (developerModeAvailable[1] !== 'false') {
  failures.push(
    'DEVELOPER_MODE_AVAILABLE must be false for a release' +
      ' — it ships the Settings toggle and the developer save/load rail',
  );
}

const config = JSON.parse(readFileSync(resolve('app.json'), 'utf8')).expo;
if (config.orientation !== 'portrait')
  failures.push('expo.orientation must be portrait for iPhone');
if (config.ios?.supportsTablet !== true)
  failures.push('expo.ios.supportsTablet must be true');
if (config.ios?.requireFullScreen !== false)
  failures.push(
    'expo.ios.requireFullScreen must be false for iPad multitasking',
  );
const buildNumber = config.ios?.buildNumber ?? '';
if (!/^\d+$/.test(buildNumber))
  failures.push('expo.ios.buildNumber must be a numeric string');
else if (Number(buildNumber) < 2)
  failures.push(
    'expo.ios.buildNumber must be at least 2 because build 1 already exists',
  );
if (config.ios?.infoPlist?.ITSAppUsesNonExemptEncryption !== false) {
  failures.push('ITSAppUsesNonExemptEncryption must be declared false');
}

// expo-audio's config plugin defaults enableBackgroundPlayback to true, which
// puts UIBackgroundModes=["audio"] in the Info.plist. A game with no
// background audio content declaring that mode is an App Review 2.5.4
// rejection, so the flag must be pinned false in app.json.
const audioPlugin = (config.plugins ?? []).find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-audio',
);
if (audioPlugin?.[1]?.enableBackgroundPlayback !== false) {
  failures.push(
    'expo-audio plugin must set "enableBackgroundPlayback": false' +
      ' — the plugin default adds the audio background mode to Info.plist',
  );
}

if (failures.length > 0) {
  console.error('Release preflight failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    'Release preflight passed: iPhone portrait, adaptive iPad, build number, encryption declaration, no QA flags, and Developer Mode off.',
  );
}
