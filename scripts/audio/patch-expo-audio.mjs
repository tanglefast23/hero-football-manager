import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(
  new URL(
    '../../node_modules/expo-audio/ios/AudioPlayer.swift',
    import.meta.url,
  ),
);
const source = readFileSync(path, 'utf8');
const before =
  '    guard let currentDate = ref.currentItem?.currentDate() else {';
// Local files have no live-stream date. This query can block the iOS main thread during frequent sound playback.
const after =
  '    guard source?.uri?.isFileURL != true, let currentDate = ref.currentItem?.currentDate() else {';
if (!source.includes(after)) {
  if (process.argv.includes('--check'))
    throw new Error(
      'Expo Audio local-file timing patch is missing. Run this script without --check.',
    );
  if (source.split(before).length !== 2)
    throw new Error(
      'Review the Expo Audio local-file timing patch after updating expo-audio.',
    );
  writeFileSync(path, source.replace(before, after));
}
