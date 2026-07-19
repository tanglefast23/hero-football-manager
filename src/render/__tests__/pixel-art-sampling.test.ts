import { readFileSync } from 'fs';
import { join } from 'path';

const ATLAS_SCREENS = [
  'src/render/MatchScreen.tsx',
  'src/render/StressScreen.tsx',
  'src/ui/screens/AwakeningCutsceneScreen.tsx',
] as const;

describe('pixel-art sampling contract', () => {
  test.each(ATLAS_SCREENS)('%s disables interpolation on every sprite atlas', fileName => {
    const source = readFileSync(join(process.cwd(), fileName), 'utf8');
    const atlasCount = source.match(/<Atlas\b/g)?.length ?? 0;
    const nearestSamplingCount = source.match(/sampling=\{PIXEL_ART_SAMPLING\}/g)?.length ?? 0;

    expect(atlasCount).toBeGreaterThan(0);
    expect(nearestSamplingCount).toBe(atlasCount);
  });
});
