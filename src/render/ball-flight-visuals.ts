// Pure, worklet-safe presentation math for deterministic 2.5D ball flight.
// The sim keeps real centimetre heights; these values exaggerate the screen
// separation just enough for a phone-sized ball and its ground shadow to read.
export const BALL_HEIGHT_VISUAL_SCALE = 2.6;
export const BALL_AIRBORNE_THRESHOLD_CM = 2;
const BALL_MINIMUM_ARC_LIFT_PX = 6;

export function ballVisualOffset(heightCm: number, pitchScale: number): number {
  'worklet';
  const height = Math.max(0, heightCm);
  if (height === 0) return 0;
  // The fixed-pixel shoulder makes take-off obvious immediately; the linear
  // term preserves the sim's parabola and opens it into a tall arcade arc.
  return height * pitchScale * BALL_HEIGHT_VISUAL_SCALE
    + Math.min(BALL_MINIMUM_ARC_LIFT_PX, height / 10);
}

export function ballHeightScale(heightCm: number): number {
  'worklet';
  return 1 + Math.min(0.1, Math.max(0, heightCm) / 2000);
}

export function ballShadowRadius(heightCm: number): number {
  'worklet';
  return 7.5 - Math.min(2, Math.max(0, heightCm) / 100);
}

export function ballShadowOpacity(heightCm: number): number {
  'worklet';
  const heightFraction = Math.max(0, Math.min(1, heightCm / 240));
  return 0.52 - heightFraction * 0.14;
}
