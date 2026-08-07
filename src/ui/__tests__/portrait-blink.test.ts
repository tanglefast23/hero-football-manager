import portraitData from '../../render/sprites/portraits.json';
import { blinkRows } from '../portrait-blink';

const sheet = portraitData as { sprites: Record<string, string[]> };

const EYE_BAND_TOP = 5;
const EYE_BAND_BOTTOM = 10;

function changedRows(before: string[], after: string[]): number[] {
  return before.map((row, y) => (row === after[y] ? -1 : y)).filter(y => y >= 0);
}

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

  describe('faces drawn without eye whites', () => {
    it('closes a dot-eyed face by painting the eyes its own skin', () => {
      const rest = sheet.sprites['f04:rest'];
      // Two-pixel dark eyes on row 9, no whites anywhere in the eye band.
      expect(rest[9]).toBe('.....KnnKKnnnnKKnnK.....');
      const result = blinkRows(rest);
      expect(result).not.toBeNull();
      expect(result).not.toEqual(rest);
      expect(result![9]).toBe('.....KnnnnnnnnnnnnK.....');
    });

    it('closes a single-pixel dot eye too', () => {
      const rest = sheet.sprites['f02:rest'];
      expect(rest[9]).toBe('...KmmKmmKmmmmKmmKmmK...');
      // The sideburn lines at columns 6 and 17 run vertically into more dark
      // pixels, so only the ringed dots at 9 and 14 close.
      expect(blinkRows(rest)![9]).toBe('...KmmKmmmmmmmmmmKmmK...');
    });

    it('confines the synthesised blink to the eye band', () => {
      const rest = sheet.sprites['f04:rest'];
      const changed = changedRows(rest, blinkRows(rest)!);
      expect(changed).toHaveLength(1);
      changed.forEach(y => {
        expect(y).toBeGreaterThanOrEqual(EYE_BAND_TOP);
        expect(y).toBeLessThanOrEqual(EYE_BAND_BOTTOM);
      });
    });

    it('never paints outside the eye band on any sprite in the sheet', () => {
      const strays = Object.entries(sheet.sprites).flatMap(([key, rows]) => {
        const closed = blinkRows(rows);
        if (closed === null) return [];
        return changedRows(rows, closed)
          .filter(y => y < EYE_BAND_TOP || y > EYE_BAND_BOTTOM)
          .map(y => `${key} row ${y}`);
      });
      expect(strays).toEqual([]);
    });

    it('leaves a face whose whole head is one tone alone', () => {
      // c212 draws its entire head in the legacy hair key 'h'. Its eye whites
      // still close the ordinary way, but no 'h' pixel may be painted over —
      // a looser eye search would mistake the flat head for skin and erase it.
      const rest = sheet.sprites['c212:rest'];
      const result = blinkRows(rest)!;
      rest.forEach((row, y) => {
        [...row].forEach((char, x) => {
          if (char === 'h') expect(result[y][x]).toBe('h');
        });
      });
      expect(result[8]).toBe('.....KhhhhhhhhhhhhK.....');
      expect(result[9]).toBe('....KhhhKKhhhhKKhhhK....');
    });

    it('leaves squinting expressions closed', () => {
      // The joy chevron and the ko cross are already shut; closing them again
      // would rub out half the mark and leave a blank face.
      expect(blinkRows(sheet.sprites['g00:joy'])).toBeNull();
      expect(blinkRows(sheet.sprites['f02:joy'])).toBeNull();
      expect(blinkRows(sheet.sprites['f04:ko'])).toBeNull();
    });

    it('leaves faces with no visible eyes alone', () => {
      // f112 wears glasses — the frames fill the band and no pupil is drawn.
      expect(blinkRows(sheet.sprites['f112:rest'])).toBeNull();
      // g14's hair curtain covers everything but a strip of cheek.
      expect(blinkRows(sheet.sprites['g14:rest'])).toBeNull();
    });

    it('blinks nearly every resting face in the sheet', () => {
      const rest = Object.entries(sheet.sprites).filter(([key]) => key.endsWith(':rest'));
      const blinking = rest.filter(([, rows]) => blinkRows(rows) !== null);
      // 333 of 433 before dark eyes were synthesised. Regenerating the sheet may
      // move this — update it deliberately, don't loosen the assertion.
      //
      // 419 of 448 since the fifteen superhero looks landed: eleven of them
      // blink, and the four that do not are all correct refusals. Toni Starke's
      // faceplate, Scott Somers' visor, and Tchalo Adaku's panther mask put no
      // pupil in the eye band at all — the same case as f112's glasses above.
      // Bruno Bannor's gamma-green head is drawn in `T`, which is not on the
      // skin ramp, so there is no skin colour to close the lid with and
      // declining is the fail-safe.
      expect(rest).toHaveLength(448);
      expect(blinking).toHaveLength(419);
    });
  });
});
