/**
 * Give every component that now calls `t()` a `const t = useCopy();`, and the
 * file its import.
 *
 * Insertion uses the AST's function-body position, not a regex on the signature.
 * A regex match on `function Foo(` lands inside the destructured parameter list
 * when the props are multi-line — which is most of them here — and produces
 * `function Foo({ const t = useCopy(); onPress, ... })`. That parses as garbage
 * and the error points somewhere else entirely.
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const importFor = (file) => {
  const depth = file.startsWith('App.tsx') ? 0 : file.split('/').length - 2;
  const to = file.startsWith('App.tsx')
    ? './src/i18n'
    : `${'../'.repeat(depth)}i18n`;
  return `import { useCopy } from '${to}';`;
};

for (const file of process.argv.slice(2)) {
  const original = fs.readFileSync(file, 'utf8');
  if (!/\bt\('/.test(original)) {
    console.log(`  ${file}: no t() calls`);
    continue;
  }

  const sf = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true);
  const inserts = [];

  const scan = (node, holder) => {
    const isFn =
      ts.isFunctionDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node);
    const next = isFn && node.body && ts.isBlock(node.body) ? node : holder;
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(sf) === 't' &&
      next
    ) {
      inserts.push(next);
    }
    ts.forEachChild(node, (child) => scan(child, next));
  };
  ts.forEachChild(sf, (node) => scan(node, undefined));

  // Only the outermost function of each nest needs the hook; a callback inside
  // it closes over the same `t`.
  const bodies = [...new Set(inserts)].filter(
    (fn) =>
      !inserts.some(
        (other) =>
          other !== fn &&
          other.getStart(sf) < fn.getStart(sf) &&
          other.getEnd() > fn.getEnd(),
      ),
  );

  let out = original;
  for (const fn of bodies.sort(
    (a, b) => b.body.getStart(sf) - a.body.getStart(sf),
  )) {
    if (/const t = useCopy\(\)/.test(fn.body.getText(sf))) continue;
    const at = fn.body.getStart(sf) + 1;
    out = `${out.slice(0, at)}\n  const t = useCopy();${out.slice(at)}`;
  }

  if (!/from '[^']*i18n'/.test(out)) {
    const lines = out.split('\n');
    const last = lines.reduce(
      (best, l, i) =>
        l.startsWith('import ') || l.startsWith('} from ') ? i : best,
      0,
    );
    lines.splice(last + 1, 0, importFor(file));
    out = lines.join('\n');
  } else if (
    !/useCopy/.test(
      out
        .split('\n')
        .filter((l) => l.includes('i18n'))
        .join('\n'),
    )
  ) {
    out = out.replace(
      /import \{ ([^}]*) \} from ('[^']*i18n')/,
      (m, names, from) => `import { useCopy, ${names.trim()} } from ${from}`,
    );
  }

  fs.writeFileSync(file, out);
  console.log(`  ${file}: hooked ${bodies.length}`);
}
