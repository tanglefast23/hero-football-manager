import { PITCH_H, PITCH_W } from '../../sim/geometry';

const MAX_VIEWPORT_HEIGHT = 440;
const MAX_VIEWPORT_SCREEN_RATIO = 0.44;

export function awakeningViewportHeight(width: number, height: number): number {
  const pitchHeight = PITCH_H * (width / PITCH_W);
  return Math.min(
    MAX_VIEWPORT_HEIGHT,
    pitchHeight * 0.72,
    height * MAX_VIEWPORT_SCREEN_RATIO,
  );
}

export function nextAwakeningAction(beat: 1 | 2 | 3): 2 | 3 | 'continue' {
  return beat === 1 ? 2 : beat === 2 ? 3 : 'continue';
}
