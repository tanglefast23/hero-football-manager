import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import fullSheet from '../sprites.json';

/**
 * `sprites.json` (1.98 MB) and `portraits.json` (1.36 MB) are fetched as their
 * own chunks on web, which is worth 2.6 MB of the first load. That only works
 * while exactly ONE module imports them.
 *
 * The failure is silent and expensive, and it has already happened once: a
 * version of this change left `loader.ts` importing `sprites.json` statically
 * inside the lazy match chunk. Metro saw a module shared between the main
 * graph and an async graph and hoisted all 1.5 MB into `__common-*.js`, which
 * is itself a first-load file. The export measured 11 KB WORSE than before the
 * change, and every other test was green.
 *
 * So: the owner pair may import them, and nothing else may.
 */
const OWNERS = [
  'src/render/sprites/pixel-sheets.ts',
  'src/render/sprites/pixel-sheets.web.ts',
];
// The leading slash matters: without it this also matches the deliberately
// eager `management-sprites.json` and the title's own `title-sprites.json`.
const GUARDED = /['"][^'"]*\/(sprites|portraits)\.json['"]/;
const ROOT = join(__dirname, '../../../..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') return [];
      return sourceFiles(path);
    }
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe('pixel sheet owner', () => {
  it('is the only module importing the two big sheets', () => {
    const offenders = sourceFiles(join(ROOT, 'src'))
      .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
      .filter(({ path, source }) => {
        const rel = relative(ROOT, path);
        if (OWNERS.includes(rel)) return false;
        return GUARDED.test(source);
      })
      .map(({ path }) => relative(ROOT, path));

    expect(offenders).toEqual([]);
  });

  it('keeps the run sprite cell equal to the sheet it no longer reads', () => {
    // The cell is a literal in both platform files so a walk-on's box does not
    // wait for the lazily fetched sheet, and the roster never reflows when it
    // lands. That only holds while the literal and the sheet agree. Read as
    // source because this Jest environment has no React Native.
    for (const file of [
      'src/render/PlayerRunSprite.tsx',
      'src/render/PlayerRunSprite.web.tsx',
    ]) {
      const source = readFileSync(join(ROOT, file), 'utf8');
      expect(source).toContain(`const CELL_WIDTH = ${fullSheet.cell.w};`);
      expect(source).toContain(`const CELL_HEIGHT = ${fullSheet.cell.h};`);
    }
  });
});
