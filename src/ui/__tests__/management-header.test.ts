import { managementHeaderLine } from '../management-header';

describe('management header line', () => {
  test('drops the division tier name from the visible line but keeps the week', () => {
    const line = managementHeaderLine('Season 1 · D5 · District League', 'Week 1 / 30');

    expect(line.visible).toBe('Season 1 · D5 · Week 1 / 30');
  });

  test('speaks the full division name to assistive technology', () => {
    const line = managementHeaderLine('Season 1 · D5 · District League', 'Week 1 / 30');

    expect(line.spoken).toBe('Season 1 · D5 · District League · Week 1 / 30');
  });

  test('leaves a season label that carries no tier name untouched', () => {
    const line = managementHeaderLine('Season 3', 'Week 12 / 30');

    expect(line.visible).toBe('Season 3 · Week 12 / 30');
    expect(line.spoken).toBe('Season 3 · Week 12 / 30');
  });

  /**
   * The rung is the part the header exists to show — a promoted manager reads
   * it every week — so trimming must never take D1 with the tier name.
   */
  test('keeps the division rung for every tier', () => {
    for (const [level, name] of [
      [1, 'Global League'],
      [3, 'Regional League'],
      [5, 'District League'],
    ] as const) {
      const line = managementHeaderLine(`Season 7 · D${level} · ${name}`, 'Week 30 / 30');

      expect(line.visible).toBe(`Season 7 · D${level} · Week 30 / 30`);
      expect(line.visible).not.toContain(name);
    }
  });

  /**
   * The whole point of the trim: the composed line has to fit a 375pt phone,
   * where react-native-web ignores `adjustsFontSizeToFit` and clips instead.
   * The measured budget was 351pt of box for a line that wanted 452pt at ~10.3pt
   * per character in the pixel face, so 34 characters is the ceiling.
   */
  test('fits the phone-width character budget at the widest realistic labels', () => {
    const line = managementHeaderLine('Season 28 · D1 · Global League', 'Week 30 / 30');

    expect(line.visible.length).toBeLessThanOrEqual(34);
  });
});
