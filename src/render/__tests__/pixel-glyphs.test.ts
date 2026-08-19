import { matchPitchLayout } from '../interpolate';
import {
  GLYPH_GAP,
  GLYPH_HEIGHT,
  GLYPH_WIDTH,
  MAX_NAME_CHARACTERS,
  foldToDrawable,
  lastName,
  nameGlyph,
  nameplateBox,
  pixelGlyph,
  stackedGlyph,
} from '../pixel-glyphs';

function render(text: string): string[] {
  const glyph = pixelGlyph(text);
  const rows = Array.from({ length: glyph.height }, () =>
    new Array<string>(glyph.width).fill('.'),
  );
  for (const cell of glyph.pixels) rows[cell.y][cell.x] = '#';
  return rows.map((row) => row.join(''));
}

describe('pixelGlyph', () => {
  it('sizes one character to the 3x5 cell', () => {
    const glyph = pixelGlyph('A');
    expect(glyph.width).toBe(GLYPH_WIDTH);
    expect(glyph.height).toBe(GLYPH_HEIGHT);
  });

  it('leaves one blank column between characters', () => {
    expect(pixelGlyph('AB').width).toBe(GLYPH_WIDTH * 2 + GLYPH_GAP);
  });

  it('draws a letter the shape it should be', () => {
    expect(render('A')).toEqual(['###', '#.#', '###', '#.#', '#.#']);
  });

  it('keeps every uppercase letter and digit distinct', () => {
    const alphabet = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'];
    const shapes = alphabet.map((character) => render(character).join('/'));
    // O and 0 share a shape on purpose, as they do in most pixel faces.
    const collisions = shapes.filter(
      (shape, index) => shapes.indexOf(shape) !== index,
    );
    expect(collisions).toEqual([render('0').join('/')]);
  });

  it('drops characters it has no glyph for instead of throwing', () => {
    expect(pixelGlyph('A€B').width).toBe(GLYPH_WIDTH * 2 + GLYPH_GAP);
    expect(pixelGlyph('€€').pixels).toEqual([]);
  });
});

describe('foldToDrawable', () => {
  it('keeps every letter of a Vietnamese name', () => {
    expect(foldToDrawable('Nguyễn')).toBe('NGUYEN');
    expect(foldToDrawable('Trần')).toBe('TRAN');
    expect(foldToDrawable('Đức')).toBe('DUC');
  });

  it('folds the accented Latin the name field allows', () => {
    expect(foldToDrawable('Müller')).toBe('MULLER');
    expect(foldToDrawable('Nuñez')).toBe('NUNEZ');
    expect(foldToDrawable('Søren')).toBe('SOREN');
  });

  it('leaves plain names and their punctuation alone', () => {
    expect(foldToDrawable("O'Neill")).toBe("O'NEILL");
    expect(foldToDrawable('Vidal-Ruiz')).toBe('VIDAL-RUIZ');
  });
});

describe('nameGlyph', () => {
  it('takes the last word of a full name', () => {
    expect(lastName('Marco Van Basten')).toBe('BASTEN');
    expect(lastName('  Rossi ')).toBe('ROSSI');
  });

  it('draws a Vietnamese surname rather than mangling it', () => {
    expect(nameGlyph('Le Nguyễn').pixels).toEqual(pixelGlyph('NGUYEN').pixels);
  });

  it('keeps a digit a created name is allowed to hold', () => {
    expect(nameGlyph('Test Player7').pixels).toEqual(
      pixelGlyph('PLAYER7').pixels,
    );
  });

  it('truncates a name too wide for a phone pitch', () => {
    const glyph = nameGlyph('Aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(glyph.width).toBe(
      MAX_NAME_CHARACTERS * GLYPH_WIDTH + (MAX_NAME_CHARACTERS - 1) * GLYPH_GAP,
    );
  });

  it('draws no plate at all when nothing is drawable', () => {
    expect(nameGlyph('€€€')).toEqual({ pixels: [], width: 0, height: 0 });
    expect(nameGlyph('')).toEqual({ pixels: [], width: 0, height: 0 });
  });
});

describe('nameplateBox at a real phone scale', () => {
  // An iPhone-sized pitch: 390dp wide at 3x, the layout MatchScreen computes.
  const layout = matchPitchLayout(390, 700, 3);
  const pixel = layout.scale * layout.player.drawScale;

  it('draws a name a manager can actually read', () => {
    const glyph = nameGlyph('Marco Rossi');
    const box = nameplateBox(glyph, pixel);
    // One source pixel is one whole dp here, so a cell is 2dp and a letter 10dp
    // tall. The trap this pins is a size put through `scale` (about 0.057) a
    // second time, which would make the cell 0.11dp and draw nothing at all.
    expect(pixel).toBeCloseTo(layout.player.devicePixels / 3, 10);
    expect(box.cell).toBeGreaterThanOrEqual(1.5);
    const width = box.right - box.left;
    expect(width).toBeGreaterThan(20);
    expect(width).toBeLessThan(layout.pitchWidth / 2);
    expect(box.bottom - box.top).toBeGreaterThan(8);
  });

  it('floats clear of the head, never over it', () => {
    const box = nameplateBox(nameGlyph('Rossi'), pixel);
    // The sprite reaches 15 source px above its centre; the plate's bottom edge
    // has to be higher than that, in negative (upward) screen space.
    expect(box.bottom).toBeLessThan(-15 * pixel);
    expect(box.top).toBeLessThan(box.bottom);
  });

  it('keeps a ten-letter name inside the pitch', () => {
    const box = nameplateBox(nameGlyph('Wijnaldum'), pixel);
    expect(box.right - box.left).toBeLessThan(layout.pitchWidth);
  });
});

describe('stackedGlyph', () => {
  function draw(glyph: ReturnType<typeof stackedGlyph>): string[] {
    const rows = Array.from({ length: glyph.height }, () =>
      new Array<string>(glyph.width).fill('.'),
    );
    for (const cell of glyph.pixels) rows[cell.y][cell.x] = '#';
    return rows.map((row) => row.join(''));
  }

  it('centres the narrow line under the wide one', () => {
    const glyph = stackedGlyph(['I', 'III']);
    expect(glyph.width).toBe(pixelGlyph('III').width);
    // The single I is 3 cells wide inside an 11-cell block: 4 blank each side.
    expect(draw(glyph)[0]).toBe('....###....');
    expect(draw(glyph)[4]).toBe('....###....');
  });

  it('leaves one blank row between the lines', () => {
    const glyph = stackedGlyph(['A', 'B']);
    expect(glyph.height).toBe(GLYPH_HEIGHT * 2 + 1);
    expect(draw(glyph)[GLYPH_HEIGHT]).toBe('...');
  });

  it('drops a line with nothing drawable instead of leaving a gap', () => {
    expect(stackedGlyph(['€€', 'A'])).toEqual(pixelGlyph('A'));
    expect(stackedGlyph(['€€', ''])).toEqual({
      pixels: [],
      width: 0,
      height: 0,
    });
  });

  it('draws the exclamation the tackle card needs', () => {
    expect(pixelGlyph('!').pixels.length).toBeGreaterThan(0);
    expect(stackedGlyph(['ROSSI', 'TACKLE!']).width).toBe(
      pixelGlyph('TACKLE!').width,
    );
  });
});
