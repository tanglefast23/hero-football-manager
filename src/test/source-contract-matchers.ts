import ts from 'typescript';

declare global {
  namespace jest {
    interface Matchers<R> {
      /** Compare source fragments by tokens, without binding the test to Prettier line wraps. */
      toContainSource(expected: unknown): R;
      /** Match source after ignoring formatting whitespace when the direct regex does not match. */
      toMatchSource(expected: string | RegExp): R;
    }
  }
}

expect.extend({
  toContainSource(received: unknown, expected: unknown) {
    let pass = false;
    if (typeof received === 'string' && typeof expected === 'string') {
      pass =
        containsTextFragment(received, expected) ||
        containsTokenSequence(sourceTokens(received), sourceTokens(expected)) ||
        containsTokenSequence(scannedTokens(received), scannedTokens(expected));
    } else if (Array.isArray(received)) {
      pass = received.some((item) => this.equals(item, expected));
    } else if (received instanceof Set) {
      pass = received.has(expected);
    }
    return {
      pass,
      message: () =>
        `expected ${this.utils.printReceived(received)} ${pass ? 'not ' : ''}to contain source ${this.utils.printExpected(expected)}`,
    };
  },

  toMatchSource(received: unknown, expected: string | RegExp) {
    if (typeof received !== 'string') {
      return {
        pass: false,
        message: () =>
          `expected ${this.utils.printReceived(received)} to be source text`,
      };
    }
    const pattern =
      typeof expected === 'string' ? new RegExp(expected) : expected;
    const direct = new RegExp(pattern.source, pattern.flags).test(received);
    const hasFormattingExpression = /\\s|\\[rn]|\s/.test(pattern.source);
    const compactPatternSource = pattern.source
      .replace(/\\s(?:[+*?]|\{\d+(?:,\d*)?\})?/g, '')
      .replace(/\\[rn](?:[+*?]|\{\d+(?:,\d*)?\})?/g, '')
      .replace(/\s+(?:[+*?]|\{\d+(?:,\d*)?\})?/g, '');
    const compactPatternMatchesEmpty =
      compactPatternSource.length > 0 &&
      new RegExp(compactPatternSource, pattern.flags).test('');
    const compact =
      !this.isNot &&
      hasFormattingExpression &&
      compactPatternSource.length > 0 &&
      !compactPatternMatchesEmpty &&
      new RegExp(compactPatternSource, pattern.flags).test(
        received.replace(/\s+/g, ''),
      );
    const pass = direct || compact;
    return {
      pass,
      message: () =>
        `expected source ${pass ? 'not ' : ''}to match ${this.utils.printExpected(expected)}`,
    };
  },
});

function containsTextFragment(source: string, expected: string): boolean {
  if (expected.length === 0) return false;
  if (textTriviaContains(source, expected)) return true;
  const file = ts.createSourceFile(
    'source-contract.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let found = false;
  const checkedCommentRanges = new Set<string>();
  const checkComments = (position: number): void => {
    for (const range of [
      ...(ts.getLeadingCommentRanges(source, position) ?? []),
      ...(ts.getTrailingCommentRanges(source, position) ?? []),
    ]) {
      const key = `${range.pos}:${range.end}`;
      if (checkedCommentRanges.has(key)) continue;
      checkedCommentRanges.add(key);
      if (source.slice(range.pos, range.end).includes(expected)) found = true;
    }
  };
  const visit = (node: ts.Node): void => {
    if (found) return;
    checkComments(node.pos);
    checkComments(node.end);
    if (
      (ts.isStringLiteralLike(node) ||
        ts.isRegularExpressionLiteral(node) ||
        ts.isTemplateExpression(node) ||
        ts.isJsxText(node)) &&
      node.getText(file).includes(expected)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

function textTriviaContains(source: string, expected: string): boolean {
  for (
    let occurrence = source.indexOf(expected);
    occurrence >= 0;
    occurrence = source.indexOf(expected, occurrence + 1)
  ) {
    const lineStart = source.lastIndexOf('\n', occurrence - 1) + 1;
    const blockStart = source.lastIndexOf('/*', occurrence);
    const blockEnd = source.lastIndexOf('*/', occurrence);
    const anchors =
      blockStart > blockEnd ? [lineStart, blockStart] : [lineStart];
    for (const anchor of anchors) {
      const scanner = ts.createScanner(
        ts.ScriptTarget.Latest,
        false,
        ts.LanguageVariant.JSX,
        source.slice(anchor),
      );
      for (
        let kind = scanner.scan();
        kind !== ts.SyntaxKind.EndOfFileToken;
        kind = scanner.scan()
      ) {
        const tokenStart = anchor + scanner.getTokenPos();
        const tokenEnd = anchor + scanner.getTextPos();
        if (tokenStart > occurrence) break;
        if (
          (kind === ts.SyntaxKind.SingleLineCommentTrivia ||
            kind === ts.SyntaxKind.MultiLineCommentTrivia) &&
          tokenStart <= occurrence &&
          tokenEnd >= occurrence + expected.length
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function containsTokenSequence(
  receivedTokens: readonly string[],
  expectedTokens: readonly string[],
): boolean {
  if (
    expectedTokens.length === 0 ||
    expectedTokens.length > receivedTokens.length
  ) {
    return false;
  }
  return receivedTokens.some(
    (_token, start) =>
      start + expectedTokens.length <= receivedTokens.length &&
      expectedTokens.every(
        (expected, offset) => receivedTokens[start + offset] === expected,
      ),
  );
}

function sourceTokens(source: string): string[] {
  const file = ts.createSourceFile(
    'source-contract.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const tokens: string[] = [];
  const visit = (node: ts.Node): void => {
    const children = node.getChildren(file);
    if (children.length > 0) {
      children.forEach(visit);
      return;
    }
    let text = node.getText(file);
    if (node.kind === ts.SyntaxKind.JsxText) {
      tokens.push(...rawScannedTokens(text));
      return;
    }
    if (
      node.kind === ts.SyntaxKind.StringLiteral &&
      /^['"][A-Za-z_$][A-Za-z0-9_$-]*['"]$/.test(text)
    ) {
      text = `string:${text.slice(1, -1)}`;
    }
    if (node.kind !== ts.SyntaxKind.EndOfFileToken && text !== '')
      tokens.push(text);
  };
  visit(file);
  return normalizeTokens(tokens);
}

function scannedTokens(source: string): string[] {
  return normalizeTokens(rawScannedTokens(source));
}

function rawScannedTokens(source: string): string[] {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.JSX,
    source,
  );
  const tokens: string[] = [];
  for (
    let kind = scanner.scan();
    kind !== ts.SyntaxKind.EndOfFileToken;
    kind = scanner.scan()
  ) {
    let text = scanner.getTokenText();
    if (
      kind === ts.SyntaxKind.StringLiteral &&
      /^['"][A-Za-z_$][A-Za-z0-9_$-]*['"]$/.test(text)
    ) {
      text = `string:${text.slice(1, -1)}`;
    }
    if (text !== '') tokens.push(text);
  }
  return tokens;
}

function normalizeTokens(tokens: readonly string[]): string[] {
  const withoutArrowParameterParens = tokens.filter(
    (token, index) =>
      !(
        (token === '(' &&
          /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(tokens[index + 1] ?? '') &&
          tokens[index + 2] === ')' &&
          tokens[index + 3] === '=>') ||
        (token === ')' &&
          tokens[index - 2] === '(' &&
          /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(tokens[index - 1] ?? '') &&
          tokens[index + 1] === '=>')
      ),
  );
  const hasUnclosedDelimiter =
    withoutArrowParameterParens.filter((token) => token === '(').length >
      withoutArrowParameterParens.filter((token) => token === ')').length ||
    withoutArrowParameterParens.filter((token) => token === '[').length >
      withoutArrowParameterParens.filter((token) => token === ']').length ||
    withoutArrowParameterParens.filter((token) => token === '{').length >
      withoutArrowParameterParens.filter((token) => token === '}').length;
  return withoutArrowParameterParens.filter(
    (token, index) =>
      token !== ',' ||
      (![')', ']', '}'].includes(
        withoutArrowParameterParens[index + 1] ?? '',
      ) &&
        (index !== withoutArrowParameterParens.length - 1 ||
          hasUnclosedDelimiter)),
  );
}

export {};
