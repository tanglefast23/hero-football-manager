import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const PLAYER_VISIBLE_ROOTS = ['App.tsx', 'src/application', 'src/ui'] as const;
const EXCLUDED_SEGMENTS = [
  `${path.sep}__tests__${path.sep}`,
  `${path.sep}audit${path.sep}`,
  `${path.sep}dev-harness${path.sep}`,
];
const EXCLUDED_FILES = new Set([
  path.join(ROOT, 'src/ui/awards-ceremony-qa.ts'),
  path.join(ROOT, 'src/ui/components/Scorecard.tsx'),
]);

function sourceFiles(target: string): string[] {
  const absolute = path.join(ROOT, target);
  if (!fs.statSync(absolute).isDirectory()) return [absolute];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) return sourceFiles(path.relative(ROOT, child));
    return /\.tsx?$/.test(entry.name) ? [child] : [];
  });
}

describe('player-visible number formatting boundary', () => {
  test('application and UI code do not use the device locale or local money formatters', () => {
    const offenders: string[] = [];
    for (const file of PLAYER_VISIBLE_ROOTS.flatMap(sourceFiles)) {
      if (
        EXCLUDED_FILES.has(file) ||
        EXCLUDED_SEGMENTS.some((segment) => file.includes(segment))
      )
        continue;
      const source = fs.readFileSync(file, 'utf8');
      source.split('\n').forEach((line, index) => {
        if (
          /\.toLocaleString\s*\(/.test(line) ||
          /\b(?:function|const)\s+formatMoney\b/.test(line)
        ) {
          offenders.push(
            `${path.relative(ROOT, file)}:${index + 1}: ${line.trim()}`,
          );
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
