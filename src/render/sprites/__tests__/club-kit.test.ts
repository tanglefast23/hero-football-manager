import {
  CHANGE_STRIP_RAMP,
  COLOR_SAFE_HOME_RAMP,
  KIT_SWATCHES,
  clubKitPlan,
  kitPatternCell,
  swatchById,
  type KitRamp,
} from '../club-kit';

/**
 * Perceptual distance, the cheap approximation the pixel bible already reasons
 * in. The absolute number matters less than the baseline it is compared to.
 */
function redmean(a: string, b: string): number {
  const rgb = (hex: string) => [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const mean = (r1 + r2) / 2;
  return Math.sqrt(
    (2 + mean / 256) * (r1 - r2) ** 2 +
      4 * (g1 - g2) ** 2 +
      (2 + (255 - mean) / 256) * (b1 - b2) ** 2,
  );
}

const GK_GREEN = '#1d9e75';
const GK_AMBER = '#ba7517';
const STOCK_RED = '#e8433f';
/**
 * The floor is the game's own worst shipped case, not a taste call: the stock
 * red kit already stands 139 from the away keeper's amber.
 */
const SHIPPED_FLOOR = redmean(STOCK_RED, GK_AMBER);
const body = (ramp: KitRamp) => ramp[1];

describe('kit swatches', () => {
  it('is calibrated against the separation the game already ships', () => {
    expect(Math.round(SHIPPED_FLOOR)).toBe(139);
  });

  it('keeps every kit distinguishable from both goalkeeper kits', () => {
    for (const swatch of KIT_SWATCHES) {
      expect(redmean(body(swatch.ramp), GK_GREEN)).toBeGreaterThanOrEqual(
        SHIPPED_FLOOR,
      );
      expect(redmean(body(swatch.ramp), GK_AMBER)).toBeGreaterThanOrEqual(
        SHIPPED_FLOOR,
      );
    }
  });

  it('spends no two slots on the same colour', () => {
    for (let i = 0; i < KIT_SWATCHES.length; i += 1) {
      for (let j = i + 1; j < KIT_SWATCHES.length; j += 1) {
        expect(
          redmean(body(KIT_SWATCHES[i].ramp), body(KIT_SWATCHES[j].ramp)),
        ).toBeGreaterThan(100);
      }
    }
  });

  /**
   * A swatch that makes the opponent change must not look like what they change
   * INTO, or the remedy recreates the clash. STONE sits close to the strip and
   * is legal only because it never triggers a change.
   */
  it('never dresses both sides in the change strip', () => {
    for (const swatch of KIT_SWATCHES) {
      if (!swatch.clashesHomeStock && !swatch.clashesAwayStock) continue;
      expect(
        redmean(body(swatch.ramp), body(CHANGE_STRIP_RAMP)),
      ).toBeGreaterThan(120);
    }
  });

  it('ships three authored steps per ramp and unique ids', () => {
    const ids = new Set<string>();
    for (const swatch of KIT_SWATCHES) {
      expect(swatch.ramp).toHaveLength(3);
      for (const step of swatch.ramp) expect(step).toMatch(/^#[0-9a-f]{6}$/);
      expect(ids.has(swatch.id)).toBe(false);
      ids.add(swatch.id);
    }
    expect(ids.size).toBe(10);
  });

  it('finds a swatch by id and answers undefined for anything else', () => {
    expect(swatchById('CRIMSON')?.ramp[1]).toBe(STOCK_RED);
    expect(swatchById('TEAL')).toBeUndefined();
    expect(swatchById('')).toBeUndefined();
  });
});

describe('kitPatternCell', () => {
  it('paints nothing for a plain shirt', () => {
    expect(kitPatternCell('PLAIN', 16, 0, 16)).toBe(false);
    expect(kitPatternCell('PLAIN', 20, 7, 16)).toBe(false);
  });

  it('runs stripes two pixels wide, and down every row alike', () => {
    const row16 = [0, 1, 2, 3, 4, 5].map((col) =>
      kitPatternCell('STRIPES', 16, col, 16),
    );
    expect(row16).toEqual([false, false, true, true, false, false]);
    for (let row = 16; row <= 23; row += 1) {
      expect(kitPatternCell('STRIPES', row, 2, 16)).toBe(true);
    }
  });

  it('alternates checks every two rows as well as every two columns', () => {
    expect(kitPatternCell('CHECKS', 16, 0, 16)).toBe(false);
    expect(kitPatternCell('CHECKS', 16, 2, 16)).toBe(true);
    expect(kitPatternCell('CHECKS', 18, 0, 16)).toBe(true);
    expect(kitPatternCell('CHECKS', 18, 2, 16)).toBe(false);
  });

  it('takes the band top from its caller, because a portrait starts elsewhere', () => {
    expect(kitPatternCell('CHECKS', 18, 0, 18)).toBe(false);
  });
});

describe('clubKitPlan', () => {
  const kit = { base: 'FOREST', pattern: 'STRIPES', patternColor: 'STONE' };

  it('dresses the user side and leaves the opponent authored', () => {
    const plan = clubKitPlan({ kit, userSide: 'r', colorSafeKits: false });
    expect(plan.r).toEqual({
      base: swatchById('FOREST')!.ramp,
      pattern: swatchById('STONE')!.ramp,
      shape: 'STRIPES',
    });
    expect(plan.u).toBeUndefined();
  });

  it('reads one plain shirt when both colours are the same', () => {
    const plan = clubKitPlan({
      kit: { base: 'FOREST', pattern: 'CHECKS', patternColor: 'FOREST' },
      userSide: 'u',
      colorSafeKits: false,
    });
    expect(plan.u).toEqual({
      base: swatchById('FOREST')!.ramp,
      pattern: undefined,
      shape: 'PLAIN',
    });
  });

  it('falls back to authored art rather than throwing on an unknown id', () => {
    for (const broken of [
      { base: 'TEAL', pattern: 'STRIPES', patternColor: 'STONE' },
      { base: 'FOREST', pattern: 'TARTAN', patternColor: 'STONE' },
    ]) {
      const plan = clubKitPlan({
        kit: broken,
        userSide: 'r',
        colorSafeKits: false,
      });
      expect(plan.r).toBeUndefined();
    }
  });

  it('changes the OPPONENT, never the user, when the colours would clash', () => {
    const away = clubKitPlan({
      kit: { base: 'ROYAL', pattern: 'PLAIN', patternColor: 'ROYAL' },
      userSide: 'r',
      colorSafeKits: false,
    });
    expect(away.r?.base).toEqual(swatchById('ROYAL')!.ramp);
    expect(away.u?.base).toEqual(CHANGE_STRIP_RAMP);

    const home = clubKitPlan({
      kit: { base: 'CRIMSON', pattern: 'PLAIN', patternColor: 'CRIMSON' },
      userSide: 'u',
      colorSafeKits: false,
    });
    expect(home.u?.base).toEqual(swatchById('CRIMSON')!.ramp);
    expect(home.r?.base).toEqual(CHANGE_STRIP_RAMP);
  });

  /**
   * The regression this guards: colour-safe used to amber `r:` unconditionally.
   * Keying it to "the opponent" instead would have stripped the amber from
   * every kitless club playing at home, which is every save written before the
   * feature, under a setting that defaults ON.
   */
  it('ambers the home side for a kitless club, whichever side the user is', () => {
    for (const userSide of ['r', 'u'] as const) {
      const plan = clubKitPlan({ userSide, colorSafeKits: true });
      expect(plan.r).toEqual({ base: COLOR_SAFE_HOME_RAMP, shape: 'PLAIN' });
      expect(plan.u).toBeUndefined();
    }
  });

  it('leaves everything authored when colour-safe is off and no kit is set', () => {
    expect(clubKitPlan({ userSide: 'r', colorSafeKits: false })).toEqual({});
  });

  it("lets the user's own kit win the home slot over colour-safe amber", () => {
    const plan = clubKitPlan({ kit, userSide: 'r', colorSafeKits: true });
    expect(plan.r?.base).toEqual(swatchById('FOREST')!.ramp);
  });

  it('keeps the change strip on the home side rather than ambering it', () => {
    const plan = clubKitPlan({
      kit: { base: 'CRIMSON', pattern: 'PLAIN', patternColor: 'CRIMSON' },
      userSide: 'u',
      colorSafeKits: true,
    });
    expect(plan.r?.base).toEqual(CHANGE_STRIP_RAMP);
  });
});
