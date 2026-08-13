import { copyFor } from '../../i18n';
import { copyOrEnglish } from '../copy-fallback';

/**
 * A typed name containing a brace must not silently switch the sentence back to
 * English.
 *
 * `copyOrEnglish` treats a residual `{placeholder}` as proof the caller failed
 * to supply params, and drops the translation for the English beside it. That is
 * right for a save written before its producer emitted params — and wrong when
 * the brace came from a param VALUE, because player and club names are typed.
 * A Spanish manager who called a rookie `Mr {count}` got Spanish menus and
 * English ledger lines, recap lines and store notices, with nothing on screen
 * looking broken.
 *
 * `validateTypedName` now rejects braces at the input, which closes the path a
 * NEW career can take. This is the guard for the shared function every caller
 * routes through, which also serves saves written before that rule and any
 * future non-typed source of brace-bearing text.
 */
describe('copyOrEnglish and a brace inside a param value', () => {
  const t = copyFor('es');
  const english = 'Sam pulled up in training — out 2 weeks.';

  test('keeps the translation when the brace came from the name', () => {
    const hostile = copyOrEnglish(t, 'store.trainingInjury', english, {
      player: 'Mr {count}',
      n: 2,
      count: 2,
    });

    expect(hostile).not.toBe(english);
    expect(hostile).toContain('Mr {count}');
    // The same sentence with an ordinary name, to prove the assertion above is
    // measuring the translation rather than an accident of the fallback.
    expect(hostile).toBe(
      copyOrEnglish(t, 'store.trainingInjury', english, {
        player: 'Sam',
        n: 2,
        count: 2,
      }).replace('Sam', 'Mr {count}'),
    );
  });

  test('still falls back when the TEMPLATE has an unfilled hole', () => {
    // The behaviour this guard must not break: params genuinely missing.
    expect(
      copyOrEnglish(t, 'store.trainingInjury', english, { n: 2, count: 2 }),
    ).toBe(english);
  });

  test('still falls back when the catalog has never heard of the key', () => {
    expect(copyOrEnglish(t, 'store.notAKeyAtAll', english)).toBe(english);
  });
});
