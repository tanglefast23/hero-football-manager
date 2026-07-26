import sprites from '../sprites.json';
import portraits from '../portraits.json';

type Sheet = { palette: Record<string, string | null>; sprites: Record<string, string[]> };

/** The hair-only ramp. No skin ramp may borrow these, and vice versa. */
const HAIR_KEYS = ['x', 'y', 'z'] as const;
/** The browns hair used to share with skin. Hair may no longer be drawn in them. */
const LEGACY_HAIR_KEYS = ['h', 'H', 'J'] as const;

/**
 * Two flat colour blocks this size stop reading as separate shapes below about
 * 25. Hair drawn over a face — a fringe, a beard, dreadlocks — is the case that
 * matters, and it was landing as low as 8.
 */
const SEPARATION_FLOOR = 25;

function lab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

function dominant(rows: readonly string[], from: number, to: number, skip: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (let y = from; y <= to && y < rows.length; y += 1) {
    for (const char of rows[y]) {
      if (char === '.' || skip.includes(char)) continue;
      counts.set(char, (counts.get(char) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [char, count] of counts) if (count > bestCount) { best = char; bestCount = count; }
  return best;
}

const crownOf = (rows: readonly string[]) => dominant(rows, 1, 5, ['K']);
const cheekOf = (rows: readonly string[]) => dominant(rows, 8, 10, ['K', 'W']);

describe.each([
  ['sprites.json', sprites as Sheet, (key: string) => key.split(':').length >= 3 && key.endsWith(':run0')],
  ['portraits.json', portraits as Sheet, (key: string) => key.endsWith(':rest')],
])('%s hair reads as hair', (_name, sheet, isFrontFrame) => {
  const frames = Object.keys(sheet.sprites).filter(isFrontFrame);

  it('has a hair ramp that clears every skin tone it is drawn against', () => {
    expect(frames.length).toBeGreaterThan(100);
    const failures: string[] = [];
    for (const key of frames) {
      const rows = sheet.sprites[key];
      const crown = crownOf(rows);
      const cheek = cheekOf(rows);
      if (crown === null || cheek === null || crown === cheek) continue;
      if (!HAIR_KEYS.includes(crown as typeof HAIR_KEYS[number])) continue;
      const hair = sheet.palette[crown];
      const skin = sheet.palette[cheek];
      if (typeof hair !== 'string' || typeof skin !== 'string') continue;
      const separation = deltaE(hair, skin);
      if (separation < SEPARATION_FLOOR) failures.push(`${key}: ${crown} on ${cheek} is only ΔE ${separation.toFixed(1)}`);
    }
    expect(failures).toEqual([]);
  });

  it('never draws hair in a colour the skin ramp also uses', () => {
    // The whole defect was one palette serving both: `h` was the dark-hair base
    // AND the shadow on the darkest skin, so a fringe over a face was invisible.
    const offenders = frames.filter(key => {
      const crown = crownOf(sheet.sprites[key]);
      const cheek = cheekOf(sheet.sprites[key]);
      if (crown === null || cheek === null || crown === cheek) return false;
      return LEGACY_HAIR_KEYS.includes(crown as typeof LEGACY_HAIR_KEYS[number]);
    });
    expect(offenders).toEqual([]);
  });

  it('leaves alone the looks whose face is drawn in a hair key', () => {
    // c212's entire head is one tone. Recolouring that key globally would have
    // blackened the faces of the darkest-skinned characters, which is exactly
    // why this is a per-look substitution and not a palette edit.
    const sameKey = frames.filter(key => {
      const rows = sheet.sprites[key];
      const crown = crownOf(rows);
      return crown !== null && crown === cheekOf(rows);
    });
    expect(sameKey.length).toBeGreaterThan(0);
    for (const key of sameKey) {
      const crown = crownOf(sheet.sprites[key]);
      expect(HAIR_KEYS).not.toContain(crown);
    }
  });
});

describe('hair palette', () => {
  it('defines the ramp in both sheets, identically', () => {
    for (const key of HAIR_KEYS) {
      expect(typeof (sprites as Sheet).palette[key]).toBe('string');
      expect((portraits as Sheet).palette[key]).toBe((sprites as Sheet).palette[key]);
    }
  });

  it('stays clear of the ink outline, so hair is not mistaken for a border', () => {
    const ink = (sprites as Sheet).palette.K;
    expect(typeof ink).toBe('string');
    for (const key of HAIR_KEYS) {
      expect(deltaE((sprites as Sheet).palette[key] as string, ink as string)).toBeGreaterThan(12);
    }
  });
});
