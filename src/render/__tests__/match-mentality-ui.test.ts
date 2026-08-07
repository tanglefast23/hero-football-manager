import { readFileSync } from 'fs';
import { join } from 'path';
import { mentalityLabel } from '../match-mentality-ui';
import { MENTALITIES } from '../../sim/tactics';
import { ENABLED_LOCALES, copyFor, loadCatalog } from '../../i18n';

const sourceOf = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('playstyle copy', () => {
  test('keeps the signed-off English, one vocabulary on both layouts', () => {
    expect(mentalityLabel('BALANCED')).toBe('BALANCED');
    expect(mentalityLabel('ATTACK')).toBe('ATTACK');
    expect(mentalityLabel('PROTECT')).toBe('PROTECT');
  });

  test('translates in every enabled locale, and never falls back to English', () => {
    // The bug this replaces: the match screen drew `displayedMentality` — the
    // engine enum — so a French player watching a match read "ATTACK" on the
    // button the tutorial had just told them to press.
    for (const locale of ENABLED_LOCALES.filter(one => one !== 'en')) {
      const t = copyFor(locale);
      const strings = loadCatalog(locale).strings;
      for (const mentality of MENTALITIES) {
        for (const label of [mentalityLabel(mentality, t)]) {
          // Not the enum, not the key, and actually present in this catalog.
          expect({ locale, mentality, label })
            .toMatchObject({ locale, mentality });
          expect(label).not.toBe(mentality);
          expect(label).not.toContain('playstyle');
          expect(Object.values(strings)).toContain(label);
        }
      }
    }
  });

  test('leaves the engine enum alone — it is a recorded control value', () => {
    // `SET_MENTALITY` carries these into the input stream and the replay codec
    // validates them as an enum, so translating them at source would break
    // every saved replay outside English.
    expect([...MENTALITIES]).toEqual(['BALANCED', 'ATTACK', 'PROTECT']);
  });

  test('no match surface draws the raw enum any more', () => {
    const match = sourceOf('src/render/MatchScreen.tsx');

    expect(match).toContain('mentalityLabel(displayedMentality, t)');
    expect(match).toContain("`${t('matchScreen.playstyle')} · ${mentalityLabel(mentality, t)}`");
    expect(match).toContain("`${t('matchScreen.playstyle')} · ${mentalityLabel(e.mentality, t)}`");
    expect(match).not.toContain('{ playstyle: displayedMentality }');
    // The icon still switches on the enum, which is correct: it is a comparison,
    // not copy.
    expect(match).toContain("displayedMentality === 'ATTACK' ? '▲'");
  });
});
