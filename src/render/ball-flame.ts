/**
 * Pure, worklet-safe geometry for the fire riding a scorching shot.
 *
 * Split out from the worklet for the same reason `match-vfx.ts` is split from
 * `ProceduralMatchEffects`: a recipe that lives inside a `usePathValue` closure
 * can be neither unit-tested nor rendered headlessly, and the browser pane
 * cannot photograph a 0.9-second ball flight (its RAF is frozen between tool
 * calls). Geometry here, drawing in `WorkletBallFlame`.
 *
 * Deliberately NOT `WorkletFlameLayer`'s recipe: three tongues instead of five,
 * about half the reach, and a faster flicker. A ball wearing Fire Torch's exact
 * flames would read as "a power just fired", which is a lie — this is an
 * ordinary shot that happens to be terrifying.
 */

export interface BallFlameLayerStyle {
  readonly color: string;
  readonly opacity: number;
  readonly heightScale: number;
  readonly widthScale: number;
}

/** Outer flame body, then the hotter inner core. Two paths, two colours. */
export const BALL_FLAME_LAYERS: readonly BallFlameLayerStyle[] = [
  { color: '#ff6a00', opacity: 0.92, heightScale: 1, widthScale: 1 },
  { color: '#f4f1ea', opacity: 0.85, heightScale: 0.5, widthScale: 0.45 },
];

export const BALL_FLAME_TONGUE_COUNT = 3;
/**
 * Screen-pixel span the tongues are spread across.
 *
 * Wide enough that the outer tongues clear the ~5px ball sprite on both sides.
 * At 11 they sat *beside* the ball and the middle one hid behind it, so a
 * headless CanvasKit render read as two candle flames flanking a white box.
 */
export const BALL_FLAME_WIDTH = 15;
/** Screen-pixel reach of the tallest tongue. */
export const BALL_FLAME_HEIGHT = 17;
/**
 * Fatter than an even split, so neighbouring tongues overlap into one fire mass
 * instead of reading as separate spikes.
 */
const TONGUE_FATNESS = 1.7;
/** The centre tongue is the tallest, so the ball is crowned rather than flanked. */
const TONGUE_HEIGHT_BIAS = [0.74, 1, 0.74];

/** One tongue as a closed shape: base → quad to tip → quad back to base. */
export interface BallFlameTongue {
  readonly baseLeftX: number;
  readonly baseRightX: number;
  readonly baseY: number;
  readonly controlLeftX: number;
  readonly controlRightX: number;
  readonly controlY: number;
  readonly tipX: number;
  readonly tipY: number;
}

/**
 * The tongues for one layer at one presentation tick.
 *
 * `presentationTick` is the renderer's interpolated tick, never a wall clock —
 * pausing the match freezes the flame, and match speed scales it, exactly like
 * every other effect in the match scene.
 */
/**
 * @param centerX Ball centre in SCREEN pixels, already through the pitch scale.
 * @param centerY Ball centre in SCREEN pixels, already lifted by its height.
 * @param sizeScale Extra size multiplier in screen space. **Not the pitch
 *   scale.** Sizes here are absolute pixels, the way `ballShadowRadius` returns
 *   an absolute 7.5px radius. Passing the pitch scale (~0.03) once made this
 *   flame half a pixel wide, which reads on screen as a plain white ball.
 */
export function ballFlameTongues(
  centerX: number,
  centerY: number,
  sizeScale: number,
  layer: BallFlameLayerStyle,
  presentationTick: number,
  reduceMotion: boolean,
): BallFlameTongue[] {
  // Load-bearing. `WorkletBallFlame` calls this from inside a `usePathValue`
  // worklet, and `react-native-worklets/plugin` only workletizes a function
  // that says so. Without it the call throws on the UI thread — which on web
  // runs inside the RAF loop, so the match freezes mid-flight and the fire
  // crackle loops forever because nothing reaches the code that stops it.
  'worklet';
  const count = BALL_FLAME_TONGUE_COUNT;
  const width = BALL_FLAME_WIDTH * sizeScale;
  const height = BALL_FLAME_HEIGHT * sizeScale;
  // Below the ball's centre, so the fire licks UP AROUND the sprite. Anchored
  // at the centre it started above the ball and left a bare underside.
  const baseY = centerY + 4 * sizeScale;
  const tongues: BallFlameTongue[] = [];
  for (let tongue = 0; tongue < count; tongue += 1) {
    const bx = centerX - width / 2 + (width / (count - 1)) * tongue;
    // 1.9 vs the player flames' 1.1 — a shot burns faster than a body.
    const flick = reduceMotion
      ? 0
      : Math.sin(presentationTick * 1.9 + tongue * 2.1);
    const flameHeight =
      height *
      layer.heightScale *
      TONGUE_HEIGHT_BIAS[tongue] *
      (0.72 + 0.28 * flick);
    const flameWidth = (width / count) * TONGUE_FATNESS * layer.widthScale;
    const tipX = reduceMotion
      ? bx
      : bx + Math.sin(presentationTick * 1.4 + tongue) * flameWidth * 0.35;
    tongues.push({
      baseLeftX: bx - flameWidth / 2,
      baseRightX: bx + flameWidth / 2,
      baseY,
      controlLeftX: bx - flameWidth * 0.25,
      controlRightX: bx + flameWidth * 0.25,
      controlY: baseY - flameHeight * 0.55,
      tipX,
      tipY: baseY - flameHeight,
    });
  }
  return tongues;
}
