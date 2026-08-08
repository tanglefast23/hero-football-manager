import fs from 'fs';
import path from 'path';
import ts from 'typescript';

/**
 * Finds player-facing prose that is still written into the source instead of
 * the catalog.
 *
 * A TypeScript AST scan rather than a lint rule, deliberately: `README.md`
 * records "There is no lint script — that's intentional, don't add one", and
 * the repo carries no ESLint dependency. Standing one up to satisfy a gate
 * would reverse a documented decision as a side effect. The compiler API is
 * already here via `ts-jest`.
 *
 * A module rather than logic inside the test, for the same reason
 * `glyph-coverage.ts` is a module: the gate asserts a number, but the number is
 * useless without the list behind it, and a worklist generator cannot import a
 * test file.
 *
 * **What this replaces.** The first version of the gate counted exactly two
 * node kinds — bare JSX text and `accessibility{Label,Hint}` — read zero, and
 * was believed to mean the extraction was finished. It was blind to every other
 * rendered prop, to every `.ts` file (a file with no JSX has no JsxText node,
 * so `application/view-models.ts` scored zero while building 256 sentences),
 * and to every template literal. Vietnamese device QA is what exposed it.
 */
export const SCOPE = ['src/ui', 'src/render', 'src/application', 'src/game'];
export const SCOPE_FILES = ['App.tsx'];

export const EXEMPT = [
  // A class component — it cannot call `useCopy`, and it is the screen that
  // renders when something has already gone wrong, so reaching for a context
  // there is the wrong trade. Its three strings stay English on purpose.
  /src\/ui\/ScreenErrorBoundary\.tsx$/,
  /src\/ui\/dev-harness\//,
  /src\/audit\//,
  /__tests__/,
  /\.test\.tsx?$/,

  // Below: files whose strings look like prose to an AST but are never drawn as
  // copy. Each was checked by reading it, not assumed.
  //
  // Pose and frame tables — "Stood square", "Pointing across". These name
  // Bert's sprite poses for whoever is editing the table; the player sees the
  // sprite, never the words.
  /src\/ui\/bert-poses\.ts$/,
  /src\/ui\/bert-walk-frames\.ts$/,
  // A QA fixture list of invented club names. Club names stay English by
  // product decision anyway, so there is nothing here to translate twice over.
  /src\/ui\/awards-ceremony-qa\.ts$/,
  // The fifteen named superheroes. "Barry Allan" is a person's name, not copy:
  // it reads the same in every locale, exactly as the generated first- and
  // last-name pools and the club names already do. The `reference` and `cue`
  // fields beside them are development notes that never reach a screen.
  /src\/game\/special-heroes\.ts$/,
  // ASCII-art sprite rows ("XX............XX") and pixel tables.
  /src\/ui\/endgame-fireworks\.ts$/,
  /src\/ui\/[a-z-]*pixel-art\.ts$/,
  /src\/ui\/[a-z-]*pixel-sprites\.ts$/,
];

/**
 * Props whose value is rendered to the player.
 *
 * A whitelist rather than a blacklist: `testID`, `nativeID`, `variant`, `tone`
 * and friends all take short capitalised strings that read exactly like prose,
 * so an "everything except" rule drowns the signal. Anything genuinely new gets
 * added here the first time it carries copy.
 */
const RENDER_PROPS = new RegExp(
  '^(accessibility(Label|Hint)|title|subtitle|label|heading|headline|kicker|eyebrow'
  + '|stamp|caption|message|body|text|note|hint|placeholder|cta|ctaLabel|summary'
  + '|confirmLabel|cancelLabel|primaryLabel|secondaryLabel|emptyLabel|emptyMessage'
  + '|prompt|question|answer|description|detail|footnote|badge|banner|tooltip)$',
);

export interface Offender {
  file: string;
  line: number;
  text: string;
}

export function sourceFiles(dir: string, found: string[] = []): string[] {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (/\.tsx?$/.test(full)) found.push(full);
  }
  return found;
}

/** Every file this gate is responsible for. */
export function scannedFiles(): string[] {
  return [...SCOPE.flatMap(dir => sourceFiles(dir)), ...SCOPE_FILES]
    .filter(file => !EXEMPT.some(pattern => pattern.test(file)));
}

/**
 * A Tailwind/NativeWind class list.
 *
 * These reach the whitelisted props legitimately — `PaperPanel` takes both a
 * `title` and a styling string — and a multi-token list like
 * `min-h-11 flex-row border-b border-ink/10 px-3` passes every other prose test
 * because it contains spaces. Detected structurally: every token is
 * lowercase-and-punctuation, and at least one carries a `-` or `:` separator.
 */
function isClassList(text: string): boolean {
  const tokens = text.trim().split(/\s+/);
  return tokens.every(token => /^-?[a-z0-9]+([-:/[\].%]|[a-z0-9])*$/.test(token))
    && tokens.some(token => /[-:]/.test(token));
}

/**
 * Prose, as opposed to an identifier, a class list or a colour.
 *
 * `rendered` says the literal is already known to reach the screen — it sits in
 * a whitelisted JSX prop, or it is JSX text. That distinction exists because of
 * the second blind spot this gate shipped with: `/^[\w./@-]+$/` rejects any
 * **single word**, so `label="Cash"`, `label="Sign"`, `'Captain'` and
 * `'Attributes'` were invisible to it — which is to say the most prominent copy
 * on every screen, the button labels, went uncounted. A single bare word in a
 * `.ts` file usually IS an identifier, so the strict rule stays there; inside a
 * prop whose whole purpose is to be displayed, it is copy.
 */
export function looksLikeProse(text: string, rendered = false): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (!/[A-Za-z]{2}/.test(trimmed)) return false;
  if (/^(#[0-9a-fA-F]{3,8}|rgba?\(|https?:)/.test(trimmed)) return false;
  // A colour can sit anywhere in the string, not just at the front: the test
  // above only checked the start, so every `boxShadow: '0 0 0 4px rgba(...)'`
  // in the match HUD counted as copy.
  if (/rgba?\(/.test(trimmed)) return false;
  // CSS length lists — `0 0 12px 4px`, `2px 0 0` — start with a number.
  if (/^-?[\d.]+(px|em|rem|%)?[\s,]/.test(trimmed)) return false;
  if (isClassList(trimmed)) return false;

  const singleToken = !/\s/.test(trimmed);
  if (singleToken) {
    // Displayed single words are real copy, but only when they look like words
    // a person wrote: "Cash", "Sign", "ACTIVE". A lowercase or dotted token in
    // the same position is an id that happened to land in a display prop.
    if (!rendered) return false;
    if (trimmed.length < 2) return false;
    return /^[A-Z][a-z]+$/.test(trimmed) || /^[A-Z]{2,}$/.test(trimmed);
  }

  if (trimmed.length < 4) return false;
  if (!/[a-z]{2}/.test(trimmed)) return false;
  if (/^[a-z0-9_$-]+$/.test(trimmed)) return false;
  if (/^[\w./@-]+$/.test(trimmed)) return false;
  return true;
}

/** Statements whose strings are for developers, never for players. */
function inDeveloperContext(node: ts.Node): boolean {
  for (let current = node.parent; current !== undefined; current = current.parent) {
    if (ts.isThrowStatement(current)) return true;
    if (ts.isNewExpression(current) && /Error$/.test(current.expression.getText())) return true;
    if (ts.isCallExpression(current)) {
      const callee = current.expression.getText();
      // `warnOnce` is this repo's own diagnostic helper (see `src/render/audio.ts`),
      // and its messages — "createAudioPlayer failed" — are for whoever is
      // reading the Metro log, never for a player.
      if (/^console\./.test(callee)) return true;
      if (/^(invariant|assert|warnOnce|warn|logWarning|reportError)$/.test(callee)) return true;
      // Overflow-guard helpers take a LABEL argument that exists only to name
      // the sum in an exception. `src/game` is full of them — "weekly wages",
      // "ticket revenue" — and they are the single largest source of false
      // positives here, because the label is built at the call site rather than
      // inside the `throw`, so the throw-statement check above cannot see it.
      if (/^(checked[A-Z]|safe[A-Z]|assert[A-Z]?|requireSafeInteger|require[A-Z]|validate[A-Z]|scaleByPercent|percentOfMoney)/
        .test(callee)) return true;
    }
    if (ts.isImportDeclaration(current) || ts.isExportDeclaration(current)) return true;
    // A string in type position is a literal type, not copy.
    if (ts.isTypeNode(current)) return true;
    if (ts.isEnumDeclaration(current)) return true;
  }
  return false;
}

/**
 * The marker a file uses to declare English as a deliberate fallback.
 *
 * `hasKeySibling` below only sees the shape `{ label, labelKey }`. Two real
 * patterns in `src/game` hide the pairing from it:
 *
 *   - a helper that takes the English as ARGUMENTS and attaches the keys itself
 *     (`reward(key, title, detail)` in `promotion-progression.ts`);
 *   - a lookup table whose keys live in a SEPARATE const (`DIVISION_NAMES`
 *     beside `DIVISION_NAME_KEYS` in `pyramid.ts`).
 *
 * Rather than teach the scanner to chase either, the code says so out loud:
 * put `@i18n-fallback` in the JSDoc of the function or the variable, and its
 * string literals stop counting. A tag is checkable and greppable — someone
 * removing the key half has to also delete a comment that says why it is there.
 * It is deliberately NOT satisfied by a plain `//` comment.
 */
const FALLBACK_TAG = '@i18n-fallback';

/** Whether the declaration this literal lives inside is tagged as a fallback. */
function inTaggedFallback(node: ts.Node, source: ts.SourceFile): boolean {
  const text = source.getFullText();
  const tagged = (candidate: ts.Node): boolean =>
    (ts.getLeadingCommentRanges(text, candidate.getFullStart()) ?? [])
      .some(range => text.slice(range.pos, range.end).includes(FALLBACK_TAG));

  for (let current: ts.Node | undefined = node; current !== undefined; current = current.parent) {
    // A call to a tagged helper: `reward('promotion.x', 'Title', 'Detail')`.
    if (ts.isCallExpression(current) && ts.isIdentifier(current.expression)) {
      const name = current.expression.text;
      let found = false;
      source.forEachChild(function walk(child) {
        if (found) return;
        if (ts.isFunctionDeclaration(child) && child.name?.text === name && tagged(child)) found = true;
        ts.forEachChild(child, walk);
      });
      if (found) return true;
    }
    // A tagged table: `/** @i18n-fallback */ const DIVISION_NAMES = { … }`.
    if (ts.isVariableStatement(current) && tagged(current)) return true;
  }
  return false;
}

/**
 * True when this literal is the English half of a documented dual write.
 *
 * `src/game` and `src/sim` are pure rings and may not import `src/i18n`, so
 * they emit a catalog key as data and keep the English beside it as a fallback:
 *
 *     { label: 'Cup gate', labelKey: 'ledger.cupGate', labelParams: { count } }
 *
 * That English is deliberate, not a miss. Without this the gate reports every
 * such line forever and can never reach zero — which would leave a permanently
 * red instrument, the exact failure this file was written to end.
 *
 * Detected structurally: a sibling property whose name is this one plus `Key`
 * (`label`/`labelKey`, `title`/`titleKey`, `detail`/`detailKey`), so it cannot
 * be satisfied by a comment or by wishful naming.
 */
function hasKeySibling(node: ts.Node): boolean {
  const property = node.parent;
  if (!ts.isPropertyAssignment(property)) return false;
  const object = property.parent;
  if (!ts.isObjectLiteralExpression(object)) return false;
  const name = property.name.getText();
  return object.properties.some(sibling =>
    sibling.name !== undefined && sibling.name.getText() === `${name}Key`);
}

/** The JSX attribute a literal belongs to, if any. */
function enclosingJsxAttribute(node: ts.Node): ts.JsxAttribute | undefined {
  for (let current = node.parent; current !== undefined; current = current.parent) {
    if (ts.isJsxAttribute(current)) return current;
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) return undefined;
  }
  return undefined;
}

/** A template's shape with its holes blanked, so it can be prose-tested. */
function templateText(node: ts.TemplateExpression): string {
  return node.head.text + node.templateSpans.map(span => `…${span.literal.text}`).join('');
}

export function offendersIn(file: string): Offender[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const found: Offender[] = [];
  const at = (node: ts.Node): number =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

  const record = (node: ts.Node, text: string): void => {
    if (inDeveloperContext(node)) return;
    // An object literal's KEY is never copy; its value may be.
    if (ts.isPropertyAssignment(node.parent) && node.parent.name === node) return;
    if (hasKeySibling(node)) return;
    if (inTaggedFallback(node, source)) return;
    const attribute = enclosingJsxAttribute(node);
    // Inside JSX, only whitelisted props render. Outside JSX — a view model, a
    // notification, a game-logic sentence — there is no prop to consult, and
    // those files are exactly where this gate used to see nothing at all.
    if (attribute !== undefined && !RENDER_PROPS.test(attribute.name.getText(source))) return;
    if (!looksLikeProse(text, attribute !== undefined)) return;
    found.push({ file, line: at(node), text: text.trim().replace(/\s+/g, ' ') });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node) && looksLikeProse(node.text, true)) {
      found.push({ file, line: at(node), text: node.text.trim().replace(/\s+/g, ' ') });
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      record(node, node.text);
    } else if (ts.isTemplateExpression(node)) {
      // Its spans are visited too, but the head and literal parts are not
      // separate StringLiterals, so there is no double count.
      record(node, templateText(node));
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return found;
}

/** Every offender in scope, worst file first. */
export function allOffenders(): Offender[] {
  return scannedFiles().flatMap(file => offendersIn(file));
}
