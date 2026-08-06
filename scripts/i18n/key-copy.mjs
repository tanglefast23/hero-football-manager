/**
 * Move whole JSX labels and accessibility props into the copy catalog.
 *
 * Scope is deliberately narrow: only text nodes that are the ENTIRE content of
 * their element, and only short ones. A fragment sitting beside `{amount}` has
 * to be recomposed into one string with a placeholder, which is a judgement
 * call about word order in six languages — not something to automate.
 *
 * Keys are `<area>.<slug>`, where the area comes from the file name. The spec
 * asks for keys that name the thing rather than the text, and for a short UI
 * label those are usually the same thing ("Club office" -> clubOffice). Long
 * prose is skipped for exactly that reason: `weLostBadlyThisWeek` would become
 * a lie the first time the sentence changed.
 *
 * Usage: node scripts/i18n/key-copy.mjs <file> [...]
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const MAX_WORDS = 5;
const CATALOG = 'content/i18n/en.json';

const area = file => {
  const base = path.basename(file).replace(/\.(tsx?|jsx?)$/, '')
    .replace(/(Screen|Modal|Panel|Overlay)$/, '');
  return base.charAt(0).toLowerCase() + base.slice(1);
};

const slug = text => {
  const words = text.trim().replace(/[^\w\s-]/g, '').split(/\s+/).filter(Boolean);
  return words.map((w, i) => {
    const lower = w.toLowerCase();
    return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join('').slice(0, 40);
};

function looksLikeProse(text) {
  const s = text.trim();
  if (s.length < 4) return false;
  if (!/[a-z]{2}/.test(s)) return false;
  if (/^[a-z0-9_$-]+$/.test(s)) return false;
  if (/^[\w./@-]+$/.test(s)) return false;
  if (/^(#[0-9a-fA-F]{3,8}|rgba?\(|https?:)/.test(s)) return false;
  return /\s/.test(s) || /^[A-Z]/.test(s);
}

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const byEnglish = new Map(Object.entries(catalog.strings).map(([k, v]) => [v, k]));

let totalKeyed = 0;

for (const file of process.argv.slice(2)) {
  const original = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true);
  const edits = [];
  const a = area(file);

  const visit = node => {
    if (ts.isJsxText(node) && looksLikeProse(node.text)) {
      const siblings = node.parent?.children ?? [];
      const beside = siblings.some(c => ts.isJsxExpression(c));
      const text = node.text.trim();
      if (!beside && text.split(/\s+/).length <= MAX_WORDS && !text.includes('\n')) {
        const english = text.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
        const key = byEnglish.get(english) ?? `${a}.${slug(text)}`;
        edits.push({ start: node.getStart(sf), end: node.getEnd(), key, english,
                     replacement: `{t('${key}')}` });
      }
    }
    if (ts.isJsxAttribute(node)
        && /^accessibility(Label|Hint)$/.test(node.name.getText(sf))
        && node.initializer && ts.isStringLiteral(node.initializer)
        && looksLikeProse(node.initializer.text)) {
      const english = node.initializer.text;
      const key = byEnglish.get(english) ?? `${a}.a11y.${slug(english)}`;
      edits.push({ start: node.initializer.getStart(sf), end: node.initializer.getEnd(),
                   key, english, replacement: `{t('${key}')}` });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);

  if (edits.length === 0) { console.log(`  ${file}: nothing to key`); continue; }

  let out = original;
  for (const edit of [...edits].sort((x, y) => y.start - x.start)) {
    out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end);
    catalog.strings[edit.key] = edit.english;
    byEnglish.set(edit.english, edit.key);
  }
  fs.writeFileSync(file, out);
  totalKeyed += edits.length;
  console.log(`  ${file}: keyed ${edits.length}`);
}

catalog.strings = Object.fromEntries(Object.entries(catalog.strings).sort());
fs.writeFileSync(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`keyed ${totalKeyed}; catalog now ${Object.keys(catalog.strings).length} keys`);
