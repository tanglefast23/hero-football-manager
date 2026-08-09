import fs from 'fs';
import path from 'path';
import ts from 'typescript';
const SCOPE = ['src/ui', 'src/render', 'src/application', 'src/game'];
const FILES = ['App.tsx'];
const EXEMPT = [
  /src\/ui\/dev-harness\//,
  /src\/audit\//,
  /__tests__/,
  /\.test\.tsx?$/,
];
function walk(d, o = []) {
  if (!fs.existsSync(d)) return o;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, o);
    else if (/\.tsx?$/.test(f)) o.push(f);
  }
  return o;
}
function prose(t) {
  const s = t.trim();
  if (s.length < 4) return false;
  if (!/[a-z]{2}/.test(s)) return false;
  if (/^[a-z0-9_$-]+$/.test(s)) return false;
  if (/^[\w./@-]+$/.test(s)) return false;
  if (/^(#[0-9a-fA-F]{3,8}|rgba?\(|https?:)/.test(s)) return false;
  return /\s/.test(s) || /^[A-Z]/.test(s);
}
const files = [...SCOPE.flatMap((d) => walk(d)), ...FILES].filter(
  (f) => !EXEMPT.some((p) => p.test(f)),
);
let whole = 0,
  fragment = 0,
  a11y = 0;
for (const f of files) {
  const sf = ts.createSourceFile(
    f,
    fs.readFileSync(f, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const v = (node) => {
    if (ts.isJsxText(node) && prose(node.text)) {
      const sibs =
        node.parent && node.parent.children ? node.parent.children : [];
      const hasExpr = sibs.some((c) => ts.isJsxExpression(c));
      if (hasExpr) fragment++;
      else whole++;
    }
    if (
      ts.isJsxAttribute(node) &&
      /^accessibility(Label|Hint)$/.test(node.name.getText(sf)) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      prose(node.initializer.text)
    )
      a11y++;
    ts.forEachChild(node, v);
  };
  ts.forEachChild(sf, v);
}
console.log('whole JSX strings (mechanical):', whole);
console.log('fragments beside an expression (need composing):', fragment);
console.log('accessibility props (mechanical):', a11y);
