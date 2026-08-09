import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { CUP_DISPLAY_NAME, DIVISION_NAMES } from '../game/pyramid';

const SRC_DIR = join(__dirname, '..');
const CONTENT_DIR = join(SRC_DIR, '..', 'content');
const SELF = join(__dirname, 'competition-names.test.ts');

/**
 * The competitions used to be named in thirty-nine places at once, and drifted:
 * the weekly UI said "Global Cup" all season while the endgame screen and the
 * Hall of Fame renamed the same trophy "National Cup", so the climb's second
 * requirement was hard to recognise as the prize the manager had been chasing.
 *
 * A shared constant only protects the strings that are composed from it. This
 * guard protects the rest — JSX copy, JSON content, error text, comments — by
 * refusing to let a retired name back into the tree at all.
 */
const RETIRED_NAMES: readonly {
  readonly pattern: RegExp;
  readonly nowCalled: string;
}[] = [
  { pattern: /global cup/gi, nowCalled: CUP_DISPLAY_NAME },
  { pattern: /national cup/gi, nowCalled: CUP_DISPLAY_NAME },
  /**
   * Case-sensitive, unlike the two above. Bert's opening line — "Took a
   * high-school team all the way to the national championship, did you?" — is a
   * real-world competition in the manager's backstory, not division two, and
   * must survive a rename of the division.
   */
  { pattern: /National Championship/g, nowCalled: DIVISION_NAMES[2] },
];

function sourceFiles(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') files.push(...sourceFiles(path));
    } else if (
      entry.isFile() &&
      /\.(?:ts|tsx|json)$/.test(entry.name) &&
      path !== SELF
    ) {
      files.push(path);
    }
  }

  return files;
}

function retiredNameViolations(roots: readonly string[]): string[] {
  const violations: string[] = [];

  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, 'utf8');
      for (const { pattern, nowCalled } of RETIRED_NAMES) {
        const hits = source.match(pattern);
        if (hits)
          violations.push(`${file}: ${hits.join(', ')} — now "${nowCalled}"`);
      }
    }
  }

  return violations;
}

describe('competition names', () => {
  it('uses one name for the cup and one for each division across code and content', () => {
    expect(retiredNameViolations([SRC_DIR, CONTENT_DIR])).toEqual([]);
  });

  it('keeps every division on the geography ladder that reads as a rank', () => {
    expect(Object.values(DIVISION_NAMES)).toEqual([
      'Global League',
      'National League',
      'Regional League',
      'County League',
      'District League',
    ]);
  });

  it('names the cup outside the division ladder, so no rung can claim it', () => {
    const rungAdjectives = Object.values(DIVISION_NAMES).map(
      (name) => name.split(' ')[0],
    );

    for (const adjective of rungAdjectives) {
      expect(CUP_DISPLAY_NAME).not.toContain(adjective);
    }
  });

  it('catches a retired name in any nested file, in any case', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'hfm-names-guard-'));
    const nestedDir = join(fixtureRoot, 'nested', 'deeper');

    try {
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(
        join(nestedDir, 'screen.tsx'),
        'const title = "GLOBAL CUP";\n',
      );
      writeFileSync(
        join(nestedDir, 'copy.json'),
        '{ "term": "National Cup" }\n',
      );

      expect(retiredNameViolations([fixtureRoot])).toHaveLength(2);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("leaves the manager's real-world backstory alone", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'hfm-names-backstory-'));

    try {
      writeFileSync(
        join(fixtureRoot, 'guide.json'),
        '{ "body": "all the way to the national championship, did you?" }\n',
      );

      expect(retiredNameViolations([fixtureRoot])).toEqual([]);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
