import fs from 'fs';
import path from 'path';

/**
 * No player-facing file may name a font family directly.
 *
 * A literal family name is invisible to the language swap: these are module-
 * scope constants fed into `StyleSheet.create`, evaluated once at import, so no
 * runtime rebinding reaches them. Left alone, a Vietnamese player gets correct
 * type on className-styled chrome and broken type on the match screen — the
 * game's biggest moments.
 *
 * The pattern matches the family literal ANYWHERE in the file, not just after
 * `fontFamily:`. An earlier version of this guard checked only the direct form
 * and so missed the indirect one, which is what SubstitutionBoard,
 * MatchControlRail and PowerTitleTakeover actually use:
 *
 *     const PIXEL_BOLD = 'Silkscreen_700Bold';
 *     const styles = StyleSheet.create({ name: { fontFamily: PIXEL_BOLD } });
 *
 * That narrower guard would go green with the match screen still broken.
 */
const FACE_LITERAL = /['"](HFMSilkscreen|Silkscreen|Handjet|VT323)_/;

/**
 * `src/i18n/` legitimately names the families — it is where the mapping lives.
 * The dev harness and QA screens stay English by policy, so their type never
 * has to follow the language.
 */
const EXEMPT = [
  /src\/i18n\//,
  /src\/ui\/dev-harness\//,
  /src\/audit\//,
  /__tests__/,
];

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (/\.tsx?$/.test(full)) found.push(full);
  }
  return found;
}

/**
 * Files still to convert to `usePixelStyles`.
 *
 * This list may only ever shrink, and the test below enforces that: a new file
 * that hardcodes a face fails immediately, while the known remainder does not
 * hold CI red during the migration. It is empty, which is what finished the
 * conversion — every player-facing surface now reads its face from the locale.
 */
const NOT_YET_CONVERTED: string[] = [];

function offenders(): string[] {
  return sourceFiles('src')
    .filter((file) => !EXEMPT.some((pattern) => pattern.test(file)))
    .filter((file) => FACE_LITERAL.test(fs.readFileSync(file, 'utf8')))
    .sort();
}

test('no NEW file hardcodes a font family', () => {
  expect(
    offenders().filter((file) => !NOT_YET_CONVERTED.includes(file)),
  ).toEqual([]);
});

test('the remainder list is honest — every entry still needs converting', () => {
  // Stops the list outliving the work. A converted file left in the list would
  // otherwise silently keep its exemption forever.
  const stale = NOT_YET_CONVERTED.filter((file) => !offenders().includes(file));
  expect(stale).toEqual([]);
});
