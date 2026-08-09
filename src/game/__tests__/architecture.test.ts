import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'path';

const GAME_DIR = join(__dirname, '..');
const SIM_DIR = join(GAME_DIR, '..', 'sim');

// The game ring shares the sim's cross-runtime determinism contract. Keep this
// list in step with src/sim/__tests__/determinism-guard.test.ts.
const BANNED_RUNTIME =
  /\b(?:Math\.(?:exp|hypot|pow|sin|cos|tan|log|random|atan2|atan|asin|acos|cbrt|log2|log10|log1p|expm1|sinh|cosh|tanh|fround)|Date\.now|new Date|performance\.now)\s*\(/g;

function sourceFiles(root = GAME_DIR): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__')
        files.push(...sourceFiles(join(root, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(join(root, entry.name));
    }
  }

  return files;
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function importSpecifiers(source: string): string[] {
  return [
    ...source.matchAll(/from\s+['"]([^'"]+)['"]/g),
    ...source.matchAll(/import\s+['"]([^'"]+)['"]/g),
    ...source.matchAll(/(?:import|require)\s*\(\s*['"]([^'"]+)['"]/g),
  ].map((match) => match[1]);
}

function runtimeViolations(root = GAME_DIR): string[] {
  const violations: string[] = [];

  for (const file of sourceFiles(root)) {
    const source = withoutComments(readFileSync(file, 'utf8'));
    const hits = source.match(BANNED_RUNTIME);
    if (hits) violations.push(`${file}: ${hits.join(', ')}`);
    if (source.includes('**'))
      violations.push(`${file}: exponentiation operator **`);
  }

  return violations;
}

function isWithin(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return (
    pathFromRoot === '' ||
    (!isAbsolute(pathFromRoot) &&
      pathFromRoot !== '..' &&
      !pathFromRoot.startsWith(`..${sep}`))
  );
}

function isAllowedGameImport(file: string, specifier: string): boolean {
  if (!specifier.startsWith('.')) return false;
  const target = resolve(dirname(file), specifier);
  return isWithin(GAME_DIR, target) || isWithin(SIM_DIR, target);
}

describe('game architecture boundary', () => {
  it('contains no nondeterministic or engine-varying runtime calls', () => {
    expect(runtimeViolations()).toEqual([]);
  });

  it('depends only on its own ring or inward on sim', () => {
    const violations: string[] = [];

    for (const file of sourceFiles()) {
      const source = readFileSync(file, 'utf8');
      for (const specifier of importSpecifiers(source)) {
        if (!isAllowedGameImport(file, specifier)) {
          violations.push(`${file} imports '${specifier}'`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('resolves nested game and sim imports without allowing outward dependencies', () => {
    const nestedFile = join(GAME_DIR, 'onboarding', 'example.ts');

    expect(isAllowedGameImport(nestedFile, '../types')).toBe(true);
    expect(isAllowedGameImport(nestedFile, '../../sim/rng')).toBe(true);
    expect(isAllowedGameImport(nestedFile, '../../ui/screens/example')).toBe(
      false,
    );
    expect(isAllowedGameImport(nestedFile, 'react-native')).toBe(false);
  });

  it('recursively inspects production modules in nested folders', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'hfm-game-guard-'));
    const nestedDir = join(fixtureRoot, 'nested', 'deeper');

    try {
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(
        join(nestedDir, 'bad.ts'),
        'export const value = Math.random();\n',
      );
      expect(runtimeViolations(fixtureRoot)).toHaveLength(1);
      expect(runtimeViolations(fixtureRoot)[0]).toContain('Math.random');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
