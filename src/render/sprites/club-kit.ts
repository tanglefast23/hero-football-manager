/**
 * The club's chosen kit: which colours a shirt is painted in, and whether it
 * carries stripes or checks.
 *
 * Pure TS on purpose (no react-native/Skia imports), same reason as
 * `slide-tackle.ts`: Jest can exercise it headless while the screens that draw
 * a sprite cannot be imported under the test runner.
 *
 * This module decides colours only. Turning a plan into pixels is the loader's
 * job (`withKitRewrite`), and it happens in token space before the slide,
 * webbed and back-facing frames are derived — never as a paint-time row band,
 * which would leave a sliding player two-tone.
 */

export type KitRamp = readonly [shade: string, body: string, light: string];
export type KitShape = 'PLAIN' | 'STRIPES' | 'CHECKS';
export const KIT_SHAPES: readonly KitShape[] = ['PLAIN', 'STRIPES', 'CHECKS'];

/** `r` is whichever club took the home side of a fixture; `u` the away side. */
export type KitPrefix = 'r' | 'u';

export interface KitSwatch {
  /** Persisted enum value. Never translated. */
  readonly id: string;
  readonly nameKey: string;
  readonly ramp: KitRamp;
  /** Too close to the stock home kit — red, or colour-safe amber. */
  readonly clashesHomeStock: boolean;
  /** Too close to the stock away kit — blue. */
  readonly clashesAwayStock: boolean;
}

/** What one side wears. `pattern` absent means a plain shirt. */
export interface KitSideRewrite {
  readonly base: KitRamp;
  readonly pattern?: KitRamp;
  readonly shape: KitShape;
}

/** What both sides wear in one sheet. An absent prefix keeps the authored art. */
export type KitPlan = Partial<Record<KitPrefix, KitSideRewrite>>;

/** The three ids the player picks, as they are persisted. */
export interface ClubKitChoice {
  readonly base: string;
  readonly pattern: string;
  readonly patternColor: string;
}

/**
 * Ten swatches, three authored hex values each — a jersey is a ramp, not one
 * colour (rows 16-23 of every player frame use shade, body and light).
 *
 * Ten and not more because the goalkeeper kits own two whole families: green
 * `#1d9e75` and amber `#ba7517`. Every orange, olive and teal candidate landed
 * inside a keeper's colour, and a keeper you cannot pick out of your own ten
 * outfielders costs more than a colour gains.
 *
 * The bar is measured, not felt. The stock red body `#e8433f` sits 139 (redmean)
 * from the away keeper's amber and the game ships that, so 139 is the floor.
 * Every body below clears 139 from both keeper kits and 100 from every other
 * swatch, and every swatch that sets a clash flag clears 120 from the change
 * strip. `club-kit.test.ts` holds all three.
 */
export const KIT_SWATCHES: readonly KitSwatch[] = [
  // The stock home ramp, kept as a choice: its keeper separation is by
  // definition exactly what the game ships today.
  {
    id: 'CRIMSON',
    nameKey: 'kit.color.crimson',
    ramp: ['#c22f2c', '#e8433f', '#f2938c'],
    clashesHomeStock: true,
    clashesAwayStock: false,
  },
  {
    id: 'MAROON',
    nameKey: 'kit.color.maroon',
    ramp: ['#5c1f26', '#8f2f38', '#c2606a'],
    clashesHomeStock: true,
    clashesAwayStock: false,
  },
  {
    id: 'ROSE',
    nameKey: 'kit.color.rose',
    ramp: ['#a8446b', '#e07a9f', '#f7c2d4'],
    clashesHomeStock: false,
    clashesAwayStock: false,
  },
  {
    id: 'VIOLET',
    nameKey: 'kit.color.violet',
    ramp: ['#5b3a91', '#9a63d6', '#c9a6ec'],
    clashesHomeStock: false,
    clashesAwayStock: true,
  },
  {
    id: 'PLUM',
    nameKey: 'kit.color.plum',
    ramp: ['#3d1f4a', '#68356e', '#a86fae'],
    clashesHomeStock: false,
    clashesAwayStock: false,
  },
  {
    id: 'ROYAL',
    nameKey: 'kit.color.royal',
    ramp: ['#3f6fb5', '#5a8fd6', '#a3c8f0'],
    clashesHomeStock: false,
    clashesAwayStock: true,
  },
  {
    id: 'NAVY',
    nameKey: 'kit.color.navy',
    ramp: ['#141d3f', '#26397f', '#6274b5'],
    clashesHomeStock: false,
    clashesAwayStock: true,
  },
  {
    id: 'FOREST',
    nameKey: 'kit.color.forest',
    ramp: ['#12401f', '#1f6b2f', '#5ca86b'],
    clashesHomeStock: false,
    clashesAwayStock: false,
  },
  {
    id: 'STONE',
    nameKey: 'kit.color.stone',
    ramp: ['#5c5a52', '#96938a', '#cfccc2'],
    clashesHomeStock: false,
    clashesAwayStock: false,
  },
  {
    id: 'CHARCOAL',
    nameKey: 'kit.color.charcoal',
    ramp: ['#15131c', '#2f2a3d', '#6b6675'],
    clashesHomeStock: false,
    clashesAwayStock: false,
  },
];

/**
 * What an opponent changes into when the user's colour would clash with theirs.
 *
 * Grey rather than white: a white body swallows the `W` number patch. The user's
 * own kit is never the thing that gives way — a fallback on their side would
 * silently delete a blue kit for every home fixture of the season.
 */
export const CHANGE_STRIP_RAMP: KitRamp = ['#4a4653', '#7d7887', '#b9b4c2'];

/**
 * The colour-safe home kit, which used to be a paint-time palette override.
 *
 * It is a rewrite like any other now, which is what retires its old defect: the
 * override was applied by row band after the slide frames were derived, so an
 * ambered player slid in two colours.
 *
 * Three values, not four: the old override also mapped `o`, and zero `r:`
 * jersey pixels use it.
 */
export const COLOR_SAFE_HOME_RAMP: KitRamp = ['#ba7517', '#edb54a', '#f7d894'];

export function swatchById(id: string): KitSwatch | undefined {
  return KIT_SWATCHES.find((swatch) => swatch.id === id);
}

function isKitShape(value: string): value is KitShape {
  return (KIT_SHAPES as readonly string[]).includes(value);
}

/**
 * Whether this pixel takes the pattern ramp rather than the base ramp.
 *
 * Two source pixels a band, which on a 24px-wide cell gives three stripes across
 * a torso — wide enough to read at pitch scale, narrow enough to still read as
 * stripes rather than as two shirts sewn together.
 */
export function kitPatternCell(
  shape: KitShape,
  row: number,
  col: number,
  bandTop: number,
): boolean {
  if (shape === 'PLAIN') return false;
  if (shape === 'STRIPES') return Math.floor(col / 2) % 2 === 1;
  return (Math.floor(col / 2) + Math.floor((row - bandTop) / 2)) % 2 === 1;
}

/** The rows of a cell that hold the shirt. Bounds are inclusive. */
export interface KitBand {
  readonly top: number;
  readonly bottom: number;
}

/**
 * One pixel's colour with the club's kit applied, for the two surfaces that
 * draw straight from a sheet every render — portraits, and the web walk-on
 * sprite — rather than from an atlas painted ahead of time.
 *
 * The pitch does NOT use this: its atlas is painted once from a sheet the
 * loader has already rewritten, so by the time a pixel is drawn the kit is the
 * palette. Two paths, one set of rules, because the ramp maths living in two
 * places is how a feature ends up half-applied.
 *
 * A caller collapsing runs must compare RESOLVED colours, not tokens: a stripe
 * puts two colours on the same token inside one row.
 */
export function kitResolvedColor(
  palette: Readonly<Record<string, string | null>>,
  token: string,
  row: number,
  col: number,
  band: KitBand,
  kitTokens: readonly [string, string, string],
  kit: KitSideRewrite | undefined,
): string | null | undefined {
  if (kit === undefined || row < band.top || row > band.bottom)
    return palette[token];
  const step = kitTokens.indexOf(token);
  if (step < 0) return palette[token];
  const ramp =
    kit.pattern !== undefined && kitPatternCell(kit.shape, row, col, band.top)
      ? kit.pattern
      : kit.base;
  return ramp[step];
}

/**
 * The single place the kit rules live: what each side of one fixture wears.
 *
 * Never throws. An unknown swatch or shape id — a save from a later build, or a
 * hand-edited one — falls back to the authored art, because a save that will
 * not load is worse than a shirt in the wrong colour.
 */
export function clubKitPlan(input: {
  kit?: ClubKitChoice;
  /** Which side the USER's club took in this fixture. */
  userSide: KitPrefix;
  colorSafeKits: boolean;
}): KitPlan {
  const { kit, userSide, colorSafeKits } = input;
  const opponentSide: KitPrefix = userSide === 'r' ? 'u' : 'r';
  const plan: { r?: KitSideRewrite; u?: KitSideRewrite } = {};

  const base = kit === undefined ? undefined : swatchById(kit.base);
  if (base !== undefined && kit !== undefined && isKitShape(kit.pattern)) {
    const patternSwatch = swatchById(kit.patternColor);
    // The same colour twice is a plain shirt, not a defect: the editor lets it
    // happen and there is nothing to warn about.
    const pattern =
      kit.pattern === 'PLAIN' ||
      patternSwatch === undefined ||
      patternSwatch.id === base.id
        ? undefined
        : patternSwatch.ramp;
    plan[userSide] = {
      base: base.ramp,
      pattern,
      shape: pattern === undefined ? 'PLAIN' : kit.pattern,
    };
  }

  const clashes =
    base !== undefined &&
    (opponentSide === 'r' ? base.clashesHomeStock : base.clashesAwayStock);
  if (clashes) {
    plan[opponentSide] = { base: CHANGE_STRIP_RAMP, shape: 'PLAIN' };
  }

  // Colour-safe is a property of the HOME side, not of the opponent. It ambered
  // `r:` unconditionally before this existed — including when the user was the
  // home side — so keying it to the opponent would render stock red for every
  // colour-safe fixture a kitless club played at home, which is every save
  // written before this feature.
  if (colorSafeKits && plan.r === undefined) {
    plan.r = { base: COLOR_SAFE_HOME_RAMP, shape: 'PLAIN' };
  }

  return plan;
}
