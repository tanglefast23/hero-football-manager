import fs from 'fs';
import path from 'path';
import ts from 'typescript';

/**
 * Player-facing prose must live in the catalog, not in a component.
 *
 * A TypeScript AST check rather than a lint rule, deliberately: `README.md`
 * records "There is no lint script — that's intentional, don't add one", and
 * the repo carries no ESLint dependency. Standing one up to satisfy this gate
 * would reverse a documented decision as a side effect. The compiler API is
 * already here via `ts-jest`.
 *
 * The gate reports rather than fails while the extraction is in flight — the
 * count is the honest measure of how much copy is still hardcoded, and it
 * ratchets down. `MAX_REMAINING` is what stops it going back up.
 */
const SCOPE = ['src/ui', 'src/render', 'src/application', 'src/game'];
const SCOPE_FILES = ['App.tsx'];

const EXEMPT = [
  // A class component — it cannot call `useCopy`, and it is the screen that
  // renders when something has already gone wrong, so reaching for a context
  // there is the wrong trade. Its three strings stay English on purpose.
  /src\/ui\/ScreenErrorBoundary\.tsx$/,
  /src\/ui\/dev-harness\//,
  /src\/audit\//,
  /__tests__/,
  /\.test\.tsx?$/,
];

/**
 * Where the extraction has reached. Lower this as batches land; never raise it.
 * Zero means Task 13 is done.
 */
const MAX_REMAINING = 70;

function sourceFiles(dir: string, found: string[] = []): string[] {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (/\.tsx?$/.test(full)) found.push(full);
  }
  return found;
}

/** Prose, as opposed to an identifier, a class list or a colour. */
function looksLikeProse(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;
  if (!/[a-z]{2}/.test(trimmed)) return false;
  if (/^[a-z0-9_$-]+$/.test(trimmed)) return false;
  if (/^[\w./@-]+$/.test(trimmed)) return false;
  if (/^(#[0-9a-fA-F]{3,8}|rgba?\(|https?:)/.test(trimmed)) return false;
  return /\s/.test(trimmed) || /^[A-Z]/.test(trimmed);
}

function offendersIn(file: string): number {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node) && looksLikeProse(node.text)) count += 1;
    // Accessibility strings are PROPS, not JSX text. A rule written only
    // against text nodes is structurally blind to them, and the result is
    // VoiceOver reading English to players in six languages.
    if (
      ts.isJsxAttribute(node)
      && /^accessibility(Label|Hint)$/.test(node.name.getText(source))
      && node.initializer !== undefined
      && ts.isStringLiteral(node.initializer)
      && looksLikeProse(node.initializer.text)
    ) count += 1;
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return count;
}

test('hardcoded player-facing prose only ever decreases', () => {
  const files = [...SCOPE.flatMap(dir => sourceFiles(dir)), ...SCOPE_FILES]
    .filter(file => !EXEMPT.some(pattern => pattern.test(file)));

  const remaining = files.reduce((total, file) => total + offendersIn(file), 0);

  // eslint-disable-next-line no-console
  console.log(`hardcoded prose remaining: ${remaining} (ceiling ${MAX_REMAINING})`);
  expect(remaining).toBeLessThanOrEqual(MAX_REMAINING);
});
