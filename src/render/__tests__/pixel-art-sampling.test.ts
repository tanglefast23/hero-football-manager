import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Every <Atlas> in the app must pass sampling={PIXEL_ART_SAMPLING}; the Skia
 * default is bilinear filtering, which blurs pixel-art sprites the moment they
 * scale past 1x. Scanning the whole tree (instead of a hardcoded screen list)
 * is what makes this a contract: a new screen that forgets the prop fails here
 * before anyone sees a soft sprite.
 */
function sourceFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' || entry.name === '__tests__'
        ? []
        : sourceFilesUnder(full);
    }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('pixel-art sampling contract', () => {
  // "<Atlas" followed by whitespace matches only JSX usage (props always
  // follow), not prose mentions of "<Atlas>" in comments.
  const atlasScreens = sourceFilesUnder(join(process.cwd(), 'src')).filter(
    file => /<Atlas\s/.test(readFileSync(file, 'utf8')),
  );

  test('at least one screen renders a sprite atlas', () => {
    expect(atlasScreens.length).toBeGreaterThan(0);
  });

  test.each(atlasScreens)('%s disables interpolation on every sprite atlas', fileName => {
    const source = readFileSync(fileName, 'utf8');
    const atlasCount = source.match(/<Atlas\s/g)?.length ?? 0;
    const nearestSamplingCount = source.match(/sampling=\{PIXEL_ART_SAMPLING\}/g)?.length ?? 0;

    expect(nearestSamplingCount).toBe(atlasCount);
  });
});
