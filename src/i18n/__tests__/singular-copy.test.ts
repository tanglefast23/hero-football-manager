import { ENABLED_LOCALES, copyFor } from '../index';

// "1 seasons" and "for 1 weeks" shipped because these keys had no singular
// sibling and their callers never passed `n`. Each key now resolves a count of
// one without the plural noun in the five locales that mark number; id and vi
// have a single form, so there the check is only that the key still resolves.
const PLURAL_NOUNS: Partial<Record<string, readonly string[]>> = {
  en: ['seasons', 'weeks'],
  es: ['temporadas', 'semanas'],
  'pt-BR': ['temporadas', 'semanas'],
  fr: ['saisons', 'semaines'],
  de: ['Saisons', 'Wochen'],
};

const KEYS: readonly [string, Record<string, string | number>][] = [
  ['market.offerSummary', { wage: '$1', seasons: 1, promise: 'p' }],
  ['market.finalTerms', { seasons: 1, promise: 'p' }],
  [
    'market.a11y.offerPlayerTermsAndPromise',
    { player: 'A', wage: '$1', seasons: 1, promise: 'p' },
  ],
  ['seasonEnd.a11y.signPlayer', { player: 'A', seasons: 1, wage: '$1' }],
  ['playerRequests.costPlayerDrills', { multiplier: 2, weeks: 1 }],
  ['playerRequests.costSquadDrills', { multiplier: 2, weeks: 1 }],
  ['clubFinances.closedWeeksRemaining', { count: 1 }],
  ['trainingDrill.a11y.gotInjured', { player: 'A', weeks: 1 }],
];

describe('a count of one reads singular', () => {
  for (const locale of ENABLED_LOCALES) {
    test(locale, () => {
      const t = copyFor(locale);
      for (const [key, params] of KEYS) {
        const text = t(key, { n: 1, ...params });
        expect(text).not.toBe(key);
        for (const noun of PLURAL_NOUNS[locale] ?? []) {
          expect(text).not.toContain(noun);
        }
      }
    });
  }

  test('a count of two still reads plural in English', () => {
    const t = copyFor('en');
    expect(t('market.finalTerms', { n: 2, seasons: 2, promise: 'p' })).toBe(
      '2 seasons, p. No more rounds.',
    );
  });
});
