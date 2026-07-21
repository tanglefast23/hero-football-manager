import { scaledBody } from '../text-scale';

describe('accessibility body text scale', () => {
  it('leaves body copy untouched at the system size', () => {
    expect(scaledBody(1)).toEqual({ fontSize: 16, lineHeight: 24 });
  });

  it('scales font size and line height together so prose never overlaps', () => {
    expect(scaledBody(1.3)).toEqual({ fontSize: 21, lineHeight: 31 });
  });

  it('scales smaller supporting copy from its own base size', () => {
    expect(scaledBody(1.15, 14, 20)).toEqual({ fontSize: 16, lineHeight: 23 });
  });

  it('rounds to whole pixels so scaled text never renders on a half pixel', () => {
    for (const scale of [1, 1.15, 1.3] as const) {
      const style = scaledBody(scale);
      expect(style.fontSize).toBe(Math.round(style.fontSize!));
      expect(style.lineHeight).toBe(Math.round(style.lineHeight!));
    }
  });
});
