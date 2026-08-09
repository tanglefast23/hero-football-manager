import { contentStrings, loadCatalog } from '../index';
import { voiceOf, faceForKey } from '../voice';
import { faceFile, glyphSet, missingGlyphs } from '../glyph-coverage';
import { localeMeta } from '../locales';

/**
 * The pixel-drawn leaves inside prose namespaces.
 *
 * `event.` and `glossary.` are body namespaces, and most of what they hold IS
 * prose — but their headings are drawn in Silkscreen. For as long as `voiceOf`
 * classified by prefix alone, gate 5 skipped 206 of their 508 strings, the
 * loudest text on the screen among them.
 *
 * These tests exist in three parts because two of them can pass while the third
 * fails, and only the third proves the gate WORKS:
 *
 * 1. the leaves that must be checked, are;
 * 2. the prose beside them is still exempt — an over-broad override would
 *    reject the em dashes and curly quotes body copy legitimately contains;
 * 3. a deliberately bad glyph in a display leaf is REJECTED.
 *
 * Without (3) the whole thing can pass by measuring nothing, which is precisely
 * how the original bug shipped.
 */

const english = () => ({ ...contentStrings(), ...loadCatalog('en').strings });

describe('display leaves inside body namespaces', () => {
  test('every pixel-drawn leaf is display, so gate 5 checks it', () => {
    const keys = Object.keys(english());
    const shouldBeDisplay = keys.filter(
      (key) =>
        /^event\.[^.]+\.title$/.test(key) ||
        /^event\.[^.]+\.[^.]+\.label$/.test(key) ||
        /^event\.[^.]+\.[^.]+\.[^.]+\.headline$/.test(key) ||
        key === 'glossary.clubHandbook' ||
        /^glossary\.[^.]+\.title$/.test(key),
    );

    // Guards against the list quietly matching nothing, which would make every
    // assertion below vacuous.
    expect(shouldBeDisplay.length).toBeGreaterThanOrEqual(200);

    const wrong = shouldBeDisplay.filter((key) => voiceOf(key) !== 'display');
    expect(wrong).toEqual([]);
  });

  test('the prose beside them is still body, so valid copy is not rejected', () => {
    const keys = Object.keys(english());
    const mustStayBody = keys.filter(
      (key) =>
        /^event\.[^.]+\.body$/.test(key) ||
        /^event\.[^.]+\.[^.]+\.[^.]+\.text$/.test(key) ||
        /^glossary\.[^.]+\.[^.]+\.term$/.test(key) ||
        /^glossary\.[^.]+\.[^.]+\.definition$/.test(key),
    );

    expect(mustStayBody.length).toBeGreaterThanOrEqual(200);

    const wrong = mustStayBody.filter((key) => voiceOf(key) !== 'body');
    expect(wrong).toEqual([]);
  });

  test('a bad glyph in a display leaf is REJECTED — the gate can fail', () => {
    // The negative control, and it earned its place immediately: it was first
    // written with U+2026 (…), on the assumption Silkscreen lacked it. The face
    // HAS it. So do the en dash, em dash, guillemets, euro, curly quotes, bullet
    // and middle dot — the built face covers ordinary European punctuation far
    // better than the spec that commissioned this test assumed.
    //
    // U+2192 (→) is genuinely absent, and is reachable: "Aufstieg → Ruhm" is the
    // kind of thing a translator writes in a headline.
    //
    // The lesson is the test's own reason for existing. A gate that has never
    // been shown to fail is not known to work, and the guess about WHICH glyph
    // was missing was wrong on the first try.
    const faces = localeMeta('vi').faces;
    const family = faceForKey('event.some-event.title', faces);
    expect(family).not.toBeNull();

    const covered = glyphSet(faceFile(family!));
    expect(missingGlyphs('Aufstieg → Ruhm', covered)).toEqual(['→']);
    // The middle dot C4's category stamp composes with is present, not assumed.
    expect(missingGlyphs('SELTEN · MYSTERIUM', covered)).toEqual([]);

    // And the same string in a BODY leaf is fine, because nothing pixel draws it.
    expect(faceForKey('event.some-event.body', faces)).toBeNull();
  });
});

/**
 * The drift guard.
 *
 * Every round of this workstream found the same class of bug: another pixel
 * render site nobody had listed. The render-site audit that produced
 * `DISPLAY_LEAVES` was correct on the day it was written, and will rot the first
 * time someone draws a new `event.*` leaf.
 *
 * So the set of `event.`/`glossary.` key shapes written in source is pinned. Add
 * a new one and this fails until it is classified here — which forces the
 * question "what face does it draw in?" at the moment the key is introduced,
 * rather than at the next audit.
 *
 * **Known limit, stated so it is never over-trusted:** this sees keys written as
 * literals. It cannot see a key composed through a variable, and two real ones
 * are — `${outcomeKey}.headline` and `${outcomeKey}.text`, built at
 * `view-models.ts:1236`. They are declared by hand below. Nor can it see a
 * `categoryLabel`-class bug, where there is no key at all. This complements the
 * audit; it does not replace it.
 */
describe('key shapes drawn from the prose namespaces', () => {
  const SOURCE_DIRS = ['src/ui', 'src/application', 'src/render'];

  /** shape -> the voice it must resolve to, and where it is drawn. */
  const DECLARED: Readonly<Record<string, 'display' | 'body'>> = {
    'event.<>.title': 'display', //                StoryEventScreen.tsx:277
    'event.<>.body': 'body', //                    StoryEventScreen.tsx:293
    'event.<>.<>.label': 'display', //             StoryEventScreen.tsx:412
    'event.<>.<>.<>': 'body', //                   the outcomeKey PREFIX, view-models.ts:1236
    'glossary.<>.title': 'display', //             GlossaryPanel.tsx:71
    'glossary.<>.<>.term': 'body', //              GlossaryPanel.tsx:80
    'glossary.<>.<>.definition': 'body', //        GlossaryPanel.tsx:81
  };

  /** Composed through a variable, so the scan cannot see them. */
  const COMPOSED: Readonly<Record<string, 'display' | 'body'>> = {
    'event.<>.<>.<>.headline': 'display', //       StoryEventScreen.tsx:192
    'event.<>.<>.<>.text': 'body', //              StoryEventScreen.tsx:197
  };

  test('no undeclared key shape has appeared', () => {
    const { execSync } =
      require('child_process') as typeof import('child_process');
    const raw = execSync(
      `grep -rhoE '\`(event|glossary)\\.[^\`]*\`' ${SOURCE_DIRS.join(' ')} || true`,
      { encoding: 'utf8' },
    );
    const found = new Set(
      raw
        .split('\n')
        .filter(Boolean)
        .map((line) => line.replace(/`/g, '').replace(/\$\{[^}]*\}/g, '<>')),
    );

    // Anti-vacuity: a broken grep would make this pass silently.
    expect(found.size).toBeGreaterThanOrEqual(5);
    expect([...found].filter((shape) => DECLARED[shape] === undefined)).toEqual(
      [],
    );
  });

  test('every declared shape resolves to the voice it is declared with', () => {
    const sample = (shape: string) => shape.replace(/<>/g, 'x');
    for (const [shape, expected] of Object.entries({
      ...DECLARED,
      ...COMPOSED,
    })) {
      // The bare outcomeKey prefix is never rendered on its own.
      if (shape === 'event.<>.<>.<>') continue;
      expect({ shape, voice: voiceOf(sample(shape)) }).toEqual({
        shape,
        voice: expected,
      });
    }
  });
});
