import sprites from '../sprites.json';
import portraits from '../portraits.json';

type Sheet = {
  palette: Record<string, string | null>;
  sprites: Record<string, string[]>;
};

/** The hair-only ramp. The skin ramp may not borrow these, nor they it. */
const HAIR_KEYS = ['x', 'y', 'z'] as const;
/** The browns hair used to share with skin. Hair may no longer be drawn in them. */
const LEGACY_HAIR_KEYS = ['h', 'H', 'J'] as const;
const SKIN_KEYS = ['d', 'm', 'n', 'S', 'L'] as const;

/**
 * Two flat blocks this size stop reading as separate shapes below about 25.
 * Hair drawn over a face — a fringe, a beard, dreadlocks — is the case that
 * matters, and it was landing as low as 8.
 */
const SEPARATION_FLOOR = 25;

function lab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => {
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

/** Every palette key used anywhere in the head, brow to chin. */
function faceKeys(rows: readonly string[]): Set<string> {
  const keys = new Set<string>();
  for (let y = 7; y <= 14 && y < rows.length; y += 1)
    for (const char of rows[y]) keys.add(char);
  return keys;
}

/**
 * The discriminator the recolour turns on. A look whose face holds a real skin
 * tone is a face with hair over it, however much hair: `f43` is dreadlocks with
 * skin peeking between the strands. A look whose face holds no skin tone at all
 * is drawn IN a hair-family key — `c212`'s whole head is `h` — and recolouring
 * that key would blacken the face itself.
 */
const faceHasRealSkin = (rows: readonly string[]) =>
  SKIN_KEYS.some((key) => faceKeys(rows).has(key));

describe.each([
  [
    'sprites.json',
    sprites as Sheet,
    (key: string) => key.split(':').length >= 3 && key.endsWith(':run0'),
  ],
  [
    'portraits.json',
    portraits as Sheet,
    (key: string) => key.endsWith(':rest'),
  ],
])('%s hair reads as hair', (_name, sheet, isFrontFrame) => {
  const frames = Object.keys(sheet.sprites).filter(isFrontFrame);

  it('separates every hair tone from every skin tone it shares a head with', () => {
    expect(frames.length).toBeGreaterThan(100);
    const failures: string[] = [];
    for (const key of frames) {
      const present = faceKeys(sheet.sprites[key]);
      for (const hair of HAIR_KEYS) {
        if (!present.has(hair)) continue;
        for (const skin of SKIN_KEYS) {
          if (!present.has(skin)) continue;
          const separation = deltaE(
            sheet.palette[hair] as string,
            sheet.palette[skin] as string,
          );
          if (separation < SEPARATION_FLOOR) {
            failures.push(
              `${key}: ${hair} beside ${skin} is only ΔE ${separation.toFixed(1)}`,
            );
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('never draws hair in a colour the skin ramp also uses', () => {
    // The whole defect was one palette serving both: `h` was the dark-hair base
    // AND the shadow on the darkest skin, so a fringe over a face vanished.
    const offenders = frames.filter((key) => {
      const present = faceKeys(sheet.sprites[key]);
      return (
        faceHasRealSkin(sheet.sprites[key]) &&
        LEGACY_HAIR_KEYS.some((legacy) => present.has(legacy))
      );
    });
    expect(offenders).toEqual([]);
  });

  it('leaves the faces that are drawn in a hair key alone', () => {
    const drawnInHairKey = frames.filter(
      (key) => !faceHasRealSkin(sheet.sprites[key]),
    );
    // A handful of the darkest looks: their whole head is one tone.
    expect(drawnInHairKey.length).toBeGreaterThan(0);
    expect(drawnInHairKey.length).toBeLessThan(frames.length / 20);
    for (const key of drawnInHairKey) {
      const present = faceKeys(sheet.sprites[key]);
      // Untouched, so still on the legacy key and NOT on the near-black ramp.
      expect(LEGACY_HAIR_KEYS.some((legacy) => present.has(legacy))).toBe(true);
      expect(HAIR_KEYS.some((hair) => present.has(hair))).toBe(false);
    }
  });
});

describe('hair palette', () => {
  it('defines the ramp in both sheets, identically', () => {
    for (const key of HAIR_KEYS) {
      expect(typeof (sprites as Sheet).palette[key]).toBe('string');
      expect((portraits as Sheet).palette[key]).toBe(
        (sprites as Sheet).palette[key],
      );
    }
  });

  it('stays clear of the ink outline, so hair is not mistaken for a border', () => {
    const ink = (sprites as Sheet).palette.K as string;
    for (const key of HAIR_KEYS) {
      expect(
        deltaE((sprites as Sheet).palette[key] as string, ink),
      ).toBeGreaterThan(12);
    }
  });
});
