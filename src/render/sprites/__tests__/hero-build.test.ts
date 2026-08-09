import sprites from '../sprites.json';
import portraits from '../portraits.json';
import manifest from '../player-look-manifest.json';

type Sheet = { sprites: Record<string, string[]> };

const HERO_IDS = Array.from({ length: 15 }, (_, index) => `f${168 + index}`);
const SIDES = ['r', 'u'] as const;
const RUN_FRAMES = ['run0', 'run1'] as const;
const heroSheet = sprites as Sheet;

/** Inclusive span of painted columns, which is what a silhouette's width means. */
function paintedWidth(row: string): number {
  const painted = [...row]
    .map((token, index) => (token === '.' ? -1 : index))
    .filter((index) => index >= 0);
  return painted.length === 0
    ? 0
    : Math.max(...painted) - Math.min(...painted) + 1;
}

function faceKeys(rows: readonly string[]): Set<string> {
  const keys = new Set<string>();
  for (let y = 7; y <= 14; y += 1) for (const token of rows[y]) keys.add(token);
  return keys;
}

describe('superhero homage looks', () => {
  /**
   * The other half of the hero contract — that every `build: 'hero'` look also
   * sets `shape: 'hero'` — is enforced in generate-sprites.mjs rather than here.
   * It cannot be tested from the shipped sheets: a hero torso under a classic
   * head is pixel-indistinguishable from a deliberate narrow-faced design, and
   * the hero chin shares row 15 with the shipped `long` shape. A build-time
   * throw is the stronger guarantee anyway — the sheets cannot be generated
   * with the pair broken.
   */
  it('ships exactly fifteen, at the end of the field pool', () => {
    expect(manifest.heroes.map((hero) => hero.id)).toEqual(HERO_IDS);
    expect(manifest.field.slice(-15)).toEqual(HERO_IDS);
    expect(new Set(manifest.heroes.map((hero) => hero.name)).size).toBe(15);
  });

  /**
   * Row 18 is the one torso row whose width is constant within a build, which
   * makes it the honest place to measure "bigger". Across the shipped roster it
   * reads 12 slim, 14 normal, 18 muscular; hero geometry puts it at 20. The
   * separation is strict, so a hero can never be mistaken for a heavy ordinary
   * player. If this fails, the geometry moved — do not edit the number.
   */
  it('draws heroes wider than the broadest ordinary build', () => {
    const heroWidths = new Set<number>();
    const ordinaryWidths = new Set<number>();
    for (const side of SIDES)
      for (const frame of RUN_FRAMES) {
        for (const id of manifest.field) {
          const width = paintedWidth(
            heroSheet.sprites[`${side}:${id}:${frame}`][18],
          );
          (HERO_IDS.includes(id) ? heroWidths : ordinaryWidths).add(width);
        }
      }
    expect([...heroWidths]).toEqual([20]);
    expect(Math.max(...ordinaryWidths)).toBe(18);
  });

  it('leaves the outline a column to land in on every frame', () => {
    for (const side of SIDES)
      for (const frame of RUN_FRAMES)
        for (const id of HERO_IDS) {
          for (const row of heroSheet.sprites[`${side}:${id}:${frame}`]) {
            expect([row[0], row[23]]).toEqual(['.', '.']);
          }
        }
  });

  it('gives all fifteen a silhouette of their own', () => {
    const silhouettes = HERO_IDS.map((id) =>
      (portraits as Sheet).sprites[`${id}:rest`]
        .map((row) => row.replace(/[^.]/g, '#'))
        .join('|'),
    );
    expect(new Set(silhouettes).size).toBe(15);
  });

  it('uses the intro portrait head unchanged on every front-facing match frame', () => {
    for (const id of HERO_IDS) {
      const introHead = (portraits as Sheet).sprites[`${id}:rest`].slice(0, 15);
      for (const side of SIDES)
        for (const frame of RUN_FRAMES) {
          expect(
            heroSheet.sprites[`${side}:${id}:${frame}`].slice(0, 15),
          ).toEqual(introHead);
        }
    }
  });

  /**
   * The gamma ramp is not in the generator's SKIN_KEYS, so separateHairFromSkin
   * skips this head entirely and its authored hair keys survive. That is the
   * same escape hatch c212 uses, and hair-skin-separation.test.ts holds every
   * look in it to a contract: a legacy brown must be present and the near-black
   * ramp must not be. Pinned here so a redraw of the mop cannot quietly break
   * that suite instead of this one.
   */
  it('keeps the gamma head inside the drawn-in-a-hair-key contract', () => {
    for (const key of ['f176:rest', 'f176:joy', 'f176:ko']) {
      const present = faceKeys((portraits as Sheet).sprites[key]);
      expect(present.has('T')).toBe(true);
      expect(['h', 'H', 'J'].some((legacy) => present.has(legacy))).toBe(true);
      expect(['x', 'y', 'z'].some((hair) => present.has(hair))).toBe(false);
    }
  });
});
