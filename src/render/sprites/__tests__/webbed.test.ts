import { deriveWebbedFrame, loadSpriteSheet, webbedSpriteKey } from '../loader';

describe('webbed player sprite state', () => {
  it('turns every painted body pixel into the locked grey ramp', () => {
    const palette = {
      '.': null,
      K: '#241f2e',
      R: '#e8433f',
      S: '#eab48c',
      W: '#ffffff',
    };
    const frame = deriveWebbedFrame(['.KRSW.'], palette);

    expect(frame).toHaveLength(1);
    expect(frame[0][0]).toBe('.');
    expect(frame[0].at(-1)).toBe('.');
    expect([...frame[0]].every(token => '.KgGwW'.includes(token))).toBe(true);
    expect(frame[0]).not.toMatch(/[RS]/);
  });

  it('ships rooted front/rear poses without impossible slide variants', () => {
    const sheet = loadSpriteSheet(['r:f00']);
    for (const frame of ['run0', 'back0'] as const) {
      const ordinary = `r:f00:${frame}`;
      const webbed = webbedSpriteKey(ordinary);
      expect(sheet.sprites[webbed]).toBeDefined();
      expect(sheet.sprites[webbed]).toHaveLength(sheet.sprites[ordinary].length);
      expect(sheet.sprites[webbed].every(row => (
        [...row].every(token => '.KgGwW'.includes(token))
      ))).toBe(true);
    }
    expect(sheet.sprites[webbedSpriteKey('r:f00:slide0')]).toBeUndefined();
  });
});
