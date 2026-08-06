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
const activeQaVariables = qaEnvironmentVariables.filter(name => process.env[name]);
if (activeQaVariables.length > 0) {
  failures.push(`QA environment variables are set: ${activeQaVariables.join(', ')}`);
}

const config = JSON.parse(readFileSync(resolve('app.json'), 'utf8')).expo;
if (config.orientation !== 'portrait') failures.push('expo.orientation must be portrait for iPhone');
if (config.ios?.supportsTablet !== true) failures.push('expo.ios.supportsTablet must be true');
if (config.ios?.requireFullScreen !== false) failures.push('expo.ios.requireFullScreen must be false for iPad multitasking');
if (!/^\d+$/.test(config.ios?.buildNumber ?? '')) failures.push('expo.ios.buildNumber must be a numeric string');
if (config.ios?.infoPlist?.ITSAppUsesNonExemptEncryption !== false) {
  failures.push('ITSAppUsesNonExemptEncryption must be declared false');
}

if (failures.length > 0) {
  console.error('Release preflight failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Release preflight passed: iPhone portrait, adaptive iPad, build number, encryption declaration, and no QA flags.');
}
