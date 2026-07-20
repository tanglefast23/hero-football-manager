import portraitData from '../../render/sprites/portraits.json';
import { blinkRows } from '../portrait-blink';

const sheet = portraitData as { sprites: Record<string, string[]> };

describe('blinkRows', () => {
  it('closes open eyes on a resting face using its own skin colour', () => {
    const result = blinkRows(sheet.sprites['g00:rest']);
    expect(result).not.toBeNull();
    // The upper eye row becomes skin; the lower row becomes a dark lid line.
    expect(result![8]).toBe('.....KSSSSSSSSSSSSK.....');
    expect(result![9]).toBe('....KSSSKKSSSSKKSSSK....');
  });

  it('leaves non-eye rows untouched and preserves the row count', () => {
    const rest = sheet.sprites['g00:rest'];
    const result = blinkRows(rest)!;
    expect(result.length).toBe(rest.length);
    rest.forEach((row, y) => {
      if (y !== 8 && y !== 9) expect(result[y]).toBe(row);
    });
  });

  it('adapts to a face whose skin colour is not the default', () => {
    // f00's skin fill is 'n', not 'S' — the upper eye row must close to 'n'.
    const result = blinkRows(sheet.sprites['f00:rest'])!;
    expect(result[8]).not.toContain('W');
    expect(result[8]).toContain('n');
  });

  it('returns null when a face has no open eyes to close (joy squint)', () => {
    expect(blinkRows(sheet.sprites['g00:joy'])).toBeNull();
  });
});
