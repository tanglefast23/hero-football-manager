import fs from 'fs';
import ts from 'typescript';
const file = process.argv[2];
const sf = ts.createSourceFile(
  file,
  fs.readFileSync(file, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
function prose(t) {
  const s = t.trim();
  if (s.length < 4) return false;
  if (!/[a-z]{2}/.test(s)) return false;
  if (/^[a-z0-9_$-]+$/.test(s)) return false;
  if (/^[\w./@-]+$/.test(s)) return false;
  if (/^(#[0-9a-fA-F]{3,8}|rgba?\(|https?:)/.test(s)) return false;
  return /\s/.test(s) || /^[A-Z]/.test(s);
}
const out = [];
const visit = (n) => {
  if (ts.isJsxText(n) && prose(n.text))
    out.push([
      sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
      'TEXT',
      n.text.trim(),
    ]);
  if (
    ts.isJsxAttribute(n) &&
    /^accessibility(Label|Hint)$/.test(n.name.getText(sf)) &&
    n.initializer &&
    ts.isStringLiteral(n.initializer) &&
    prose(n.initializer.text)
  )
    out.push([
      sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
      'A11Y',
      n.initializer.text,
    ]);
  ts.forEachChild(n, visit);
};
ts.forEachChild(sf, visit);
for (const [l, k, t] of out)
  console.log(`${String(l).padStart(5)} ${k} ${JSON.stringify(t)}`);
