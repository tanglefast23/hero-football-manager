import { resolveCopy } from '../resolve';

const en = {
  'a.hi': 'Hello {name}',
  'a.n.one': '{n} player',
  'a.n.other': '{n} players',
};
const de = { 'a.hi': 'Hallo {name}' };

describe('resolveCopy', () => {
  test('resolves and interpolates', () => {
    expect(resolveCopy('de', de, en, 'a.hi', { name: 'Bert' })).toBe('Hallo Bert');
  });

  test('falls back to English when the locale lacks the key', () => {
    expect(resolveCopy('de', de, en, 'a.n', { n: 1 })).toBe('1 player');
  });

  test('selects a plural sibling from the count param', () => {
    expect(resolveCopy('en', en, en, 'a.n', { n: 1 })).toBe('1 player');
    expect(resolveCopy('en', en, en, 'a.n', { n: 3 })).toBe('3 players');
    expect(resolveCopy('en', en, en, 'a.n', { n: 0 })).toBe('0 players');
  });

  test('pt-BR sends zero to the singular sibling', () => {
    const pt = { 'a.n.one': '{n} jogador', 'a.n.other': '{n} jogadores' };
    expect(resolveCopy('pt-BR', pt, en, 'a.n', { n: 0 })).toBe('0 jogador');
    expect(resolveCopy('pt-BR', pt, en, 'a.n', { n: 2 })).toBe('2 jogadores');
  });

  test('a plain key wins over its plural siblings', () => {
    const both = { 'a.n': 'squad', 'a.n.one': 'one', 'a.n.other': 'many' };
    expect(resolveCopy('en', both, en, 'a.n', { n: 5 })).toBe('squad');
  });

  test('a key missing everywhere returns the key, never a blank', () => {
    expect(resolveCopy('de', de, en, 'a.nope')).toBe('a.nope');
  });

  test('an unfilled placeholder stays visible rather than printing undefined', () => {
    expect(resolveCopy('en', en, en, 'a.hi', {})).toBe('Hello {name}');
  });

  test('params never re-interpolate, so a name containing a placeholder is inert', () => {
    expect(resolveCopy('en', en, en, 'a.hi', { name: '{name}' })).toBe('Hello {name}');
  });

  test('a numeric param is stringified without locale formatting', () => {
    expect(resolveCopy('en', { 'a.x': 'fee {fee}' }, en, 'a.x', { fee: 1240 })).toBe('fee 1240');
  });
});
